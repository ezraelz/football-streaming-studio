"""
Background job: poll Bzzoiro's /fixtures/changes/ and warn when a live
or upcoming match in the DB has been postponed, cancelled, or moved.

Called from Celery beat every ~5 minutes, or from a manual shell command
during development.
"""

import os
import logging
from datetime import datetime, timedelta, timezone

import requests as http

from matches.models import Match
from shows.models import ShowSession
from audit.models import LogKind, LogSeverity
from audit.services import log_and_broadcast

log = logging.getLogger(__name__)


# How far back to look for changes (Bzzoiro default is 24h; we cap at 24h)
LOOKBACK_MINUTES = 60
# Which Bzzoiro statuses should trigger a warning
ALERT_STATUSES = {"postponed", "cancelled", "abandoned", "suspended", "walkover", "awarded"}


def poll_changes():
    """
    Fetch recent fixture changes from Bzzoiro and act on any that affect
    a match we're currently tracking. Returns a summary dict.
    """
    api_key = os.getenv("FOOTBALL_API_KEY")
    if not api_key:
        log.warning("poll_changes: FOOTBALL_API_KEY not set")
        return {"error": "no api key"}

    # Only look back a bounded window — we don't want to alert on changes
    # from days ago that we already processed.
    since = (datetime.now(timezone.utc) - timedelta(minutes=LOOKBACK_MINUTES)).isoformat()

    try:
        r = http.get(
            "https://sports.bzzoiro.com/api/v2/fixtures/changes/",
            headers={"Authorization": f"Token {api_key}"},
            params={"since": since, "change": "status,kickoff,venue", "limit": 200},
            timeout=15,
        )
        if not r.ok:
            log.warning("poll_changes: HTTP %s %s", r.status_code, r.text[:200])
            return {"error": f"http {r.status_code}"}

        data = r.json()
        changes = data.get("changes") or []
        if not changes:
            return {"checked": 0, "actioned": 0}

        actioned = 0
        for change in changes:
            if not isinstance(change, dict):
                continue

            event_id = change.get("event_id")
            change_kind = change.get("change")
            if not event_id:
                continue

            # Find our Match row by provider_match_id
            try:
                match = Match.objects.get(
                    provider="bzzoiro", provider_match_id=str(event_id)
                )
            except Match.DoesNotExist:
                continue

            # Find any active session for this match
            sessions = ShowSession.objects.filter(
                match=match, state__in=["live", "paused", "armed", "degraded"]
            ).select_related("match")

            if not sessions.exists():
                continue

            if change_kind == "status":
                new_status = change.get("new_value")
                old_status = change.get("old_value")
                if new_status in ALERT_STATUSES:
                    for session in sessions:
                        _alert_status_change(session, match, old_status, new_status)
                        actioned += 1

            elif change_kind == "kickoff":
                old_ko = change.get("old_value")
                new_ko = change.get("new_value")
                for session in sessions:
                    _alert_kickoff_change(session, match, old_ko, new_ko)
                    actioned += 1

            elif change_kind == "venue":
                old_v = change.get("old_value")
                new_v = change.get("new_value")
                for session in sessions:
                    _alert_venue_change(session, match, old_v, new_v)
                    actioned += 1

        return {"checked": len(changes), "actioned": actioned}

    except Exception as e:
        log.exception("poll_changes failed")
        return {"error": str(e)}


def _alert_status_change(session, match, old_status, new_status):
    """A match we're tracking changed status to something disruptive."""
    message = f"⚠ Match {match.home_team_short} vs {match.away_team_short}: status {old_status or '?'} → {new_status.upper()}"

    # Log to audit
    log_and_broadcast(
        session, LogKind.DATA, message,
        severity=LogSeverity.ERROR,
        detail={
            "kind": "fixture_status_change",
            "event_id": match.provider_match_id,
            "old_status": old_status,
            "new_status": new_status,
        },
    )

    # Push a studio banner
    _push_alert_to_studio(
        session,
        severity="error",
        title="Match postponed or cancelled",
        body=message,
        action={
            "label": "Open match",
            "url": f"/matches/{match.provider_match_id}",
        },
    )

    # Also update the local Match row so the rest of the app knows
    if new_status in ("postponed", "cancelled"):
        match.status = new_status
        match.save(update_fields=["status", "updated_at"])


def _alert_kickoff_change(session, match, old_ko, new_ko):
    message = f"Kickoff moved: {match.home_team_short} vs {match.away_team_short} ({old_ko or '?'} → {new_ko})"
    log_and_broadcast(
        session, LogKind.DATA, message,
        severity=LogSeverity.WARN,
        detail={"kind": "fixture_kickoff_change", "event_id": match.provider_match_id},
    )
    _push_alert_to_studio(
        session,
        severity="warn",
        title="Kickoff time changed",
        body=message,
    )


def _alert_venue_change(session, match, old_v, new_v):
    message = f"Venue changed: {match.home_team_short} vs {match.away_team_short} ({old_v} → {new_v})"
    log_and_broadcast(
        session, LogKind.DATA, message,
        severity=LogSeverity.INFO,
        detail={"kind": "fixture_venue_change", "event_id": match.provider_match_id},
    )


def _push_alert_to_studio(session, *, severity, title, body, action=None):
    """Broadcast a `system.alert` message to the studio for a persistent banner."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import session_group

    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        session_group(str(session.id)),
        {
            "type": "system_alert",
            "data": {
                "severity": severity,
                "title": title,
                "body": body,
                "action": action,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        },
    )