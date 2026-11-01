import os
from datetime import datetime, timezone
import logging

from django.db import transaction
from django.utils import timezone as djtz

from providers.base import FootballProvider, ProviderError
from providers.registry import get_provider
from providers.schemas import (
    Fixture, MatchSnapshot as SnapshotDTO,
    MatchEvent as EventDTO, Lineup as LineupDTO,
)

from .models import Match, MatchSnapshot, MatchEvent, Lineup

logger = logging.getLogger(__name__)
DEFAULT_STALE_SECONDS = int(os.getenv("STALE_THRESHOLD_SECONDS", "60"))

def _freshness(provider_updated_at: datetime, now: datetime) -> str:
    delta = (now - provider_updated_at).total_seconds()
    if delta < -5:
        return "disconnected"
    if delta > DEFAULT_STALE_SECONDS:
        return "stale"
    return "fresh"

# --- Upserts ---

def _upsert_match(fixture: Fixture, provider_name: str) -> Match:
    match, _ = Match.objects.update_or_create(
        provider=provider_name,
        provider_match_id=fixture.id,
        defaults={
            "competition": fixture.competition,
            "provider_league_id": getattr(fixture, "league_id", ""),
            "provider_league_name": getattr(fixture, "league_name", ""),
            "home_team_id": fixture.home.id,
            "home_team_name": fixture.home.name,
            "home_team_short": fixture.home.short_name,
            "home_team_color": fixture.home.color,
            "away_team_id": fixture.away.id,
            "away_team_name": fixture.away.name,
            "away_team_short": fixture.away.short_name,
            "away_team_color": fixture.away.color,
            "kickoff": fixture.kickoff,
            "status": fixture.status,
        },
    )
    return match

def _upsert_snapshot(match: Match, snapshot: SnapshotDTO) -> MatchSnapshot:
    obj, _ = MatchSnapshot.objects.update_or_create(
        match=match,
        defaults={
            "score_home": snapshot.score.get("home", 0),
            "score_away": snapshot.score.get("away", 0),
            "period": snapshot.period,
            "minute": snapshot.minute,
            "stats": snapshot.stats,
            "provider_updated_at": snapshot.provider_updated_at,
            "received_at": snapshot.received_at,
        },
    )
    return obj

def _upsert_event(match: Match, event: EventDTO) -> tuple[MatchEvent, bool]:
    return MatchEvent.objects.update_or_create(
        match=match,
        provider_event_id=event.event_id,
        defaults={
            "type": event.type,
            "team_id": event.team_id,
            "player_id": event.player_id,
            "player_name": event.player_name,
            "minute": event.minute,
            "status": event.status,
            "detail": event.detail,
            "source_updated_at": event.source_updated_at,
            "received_at": event.received_at,
        },
    )

def _upsert_lineup(match: Match, lineup: LineupDTO) -> Lineup:
    obj, _ = Lineup.objects.update_or_create(
        match=match,
        team_id=lineup.team_id,
        defaults={
            "formation": lineup.formation,
            "players": lineup.players,
            "source_updated_at": lineup.source_updated_at,
        },
    )
    return obj

def _infer_goals_from_score_delta(match: Match, previous: MatchSnapshot | None, current: SnapshotDTO) -> list[MatchEvent]:
    if previous is None:
        return []

    new_home = current.score.get("home", 0)
    new_away = current.score.get("away", 0)
    home_delta = max(0, new_home - previous.score_home)
    away_delta = max(0, new_away - previous.score_away)

    inferred = []
    minute = current.minute or 0
    now = djtz.now()

    for i in range(home_delta):
        obj, created = MatchEvent.objects.update_or_create(
            match=match, provider_event_id=f"inferred-home-{new_home}-{new_away}-{i + 1}",
            defaults={"type": "goal", "team_id": match.home_team_id, "minute": minute, "status": "confirmed", "source_updated_at": now, "received_at": now}
        )
        if created: inferred.append(obj)

    for i in range(away_delta):
        obj, created = MatchEvent.objects.update_or_create(
            match=match, provider_event_id=f"inferred-away-{new_home}-{new_away}-{i + 1}",
            defaults={"type": "goal", "team_id": match.away_team_id, "minute": minute, "status": "confirmed", "source_updated_at": now, "received_at": now}
        )
        if created: inferred.append(obj)

    return inferred


# --- Public service API ---

@transaction.atomic
def refresh_fixtures(provider: FootballProvider | None = None,
                     date_from: str | None = None,
                     date_to: str | None = None) -> list[Match]:
    p = provider or get_provider()
    fixtures = list(p.get_fixtures(date_from=date_from, date_to=date_to))
    return [_upsert_match(f, p.name) for f in fixtures]

@transaction.atomic
def refresh_match(provider_match_id: str, provider: FootballProvider | None = None, live_cache: dict | None = None) -> dict:
    """
    Sync snapshot, events, and lineups for one match.
    Uses `live_cache` to prevent hitting the Bzzoiro API quota.
    """
    p = provider or get_provider()
    
    try:
        match = Match.objects.get(provider=p.name, provider_match_id=provider_match_id)
    except Match.DoesNotExist:
        return {"match_id": provider_match_id, "created_events": 0, "freshness": "disconnected"}

    previous_snapshot = getattr(match, "snapshot", None)
    snapshot_dto = None

    # 1. Snapshot
    try:
        if live_cache is not None and provider_match_id in live_cache:
            # Build from cache to save API calls
            ev = live_cache[provider_match_id]
            snapshot_dto = SnapshotDTO(
                match_id=provider_match_id,
                competition=p._league_name(ev.get("league_id")),
                home=p._team_from_event(ev, "home"),
                away=p._team_from_event(ev, "away"),
                score={"home": int(ev.get("home_score") or 0), "away": int(ev.get("away_score") or 0)},
                period=p._map_period(ev.get("status"), ev.get("period")),
                minute=int(ev.get("current_minute") or 0),
                status=p._map_status(ev.get("status")),
                stats={},
                provider_updated_at=djtz.now(),
                received_at=djtz.now(),
                freshness="fresh",
            )
        else:
            # Fallback to provider call
            snapshot_dto = p.get_match_snapshot(provider_match_id)
            
        if snapshot_dto:
            _upsert_snapshot(match, snapshot_dto)
    except Exception as e:
        logger.warning("Snapshot fetch failed for %s: %s", provider_match_id, e)

    # 2. Events (Only fetch incidents if the score actually changed to save quota)
    created_ids = []
    score_changed = False
    if snapshot_dto and previous_snapshot:
        if previous_snapshot.score_home != snapshot_dto.score.get("home") or previous_snapshot.score_away != snapshot_dto.score.get("away"):
            score_changed = True

    if score_changed:
        try:
            for event_dto in p.get_events_since(provider_match_id):
                obj, created = _upsert_event(match, event_dto)
                if created: created_ids.append(obj)
        except Exception as e:
            logger.warning("Events fetch failed for %s: %s", provider_match_id, e)

    # 3. Infer goals from delta (always run)
    if snapshot_dto:
        inferred = _infer_goals_from_score_delta(match, previous_snapshot, snapshot_dto)
        created_ids.extend(inferred)

    # 4. Lineups (Only fetch if we don't have them yet)
    if not match.lineups.exists():
        try:
            for lineup_dto in p.get_lineups(provider_match_id):
                _upsert_lineup(match, lineup_dto)
        except Exception as e:
            logger.warning("Lineups fetch failed for %s: %s", provider_match_id, e)

    # 5. Freshness & Broadcast
    match.refresh_from_db()
    snap = getattr(match, "snapshot", None)
    freshness = _freshness(snap.provider_updated_at, djtz.now()) if snap else "disconnected"

    broadcast_match_update(provider_match_id)

    # 6. Automation
    if created_ids:
        from shows.models import ShowSession
        from automation.services import execute_for_event
        from audit.services import log_and_broadcast
        from audit.models import LogKind, LogSeverity

        active_sessions = list(ShowSession.objects.filter(match=match, state__in=["live", "paused", "degraded"]))
        for session in active_sessions:
            for ev in created_ids:
                try:
                    execute_for_event(session, ev)
                except Exception as e:
                    log_and_broadcast(session, LogKind.ERROR, f"Automation failed: {type(e).__name__}: {e}", severity=LogSeverity.WARN)

    return {"match_id": provider_match_id, "created_events": len(created_ids), "freshness": freshness}

def build_overlay_payload(provider_match_id: str, include_lineups: bool = True) -> dict | None:
    try:
        match = Match.objects.select_related("snapshot").get(provider_match_id=provider_match_id)
    except Match.DoesNotExist:
        return None

    snapshot = getattr(match, "snapshot", None)
    payload = {
        "match_id": match.provider_match_id,
        "kickoff": match.kickoff.isoformat(),          # NEW
        "match_status": match.status, 
        "home": {"id": match.home_team_id, "name": match.home_team_name, "shortName": match.home_team_short, "color": match.home_team_color},
        "away": {"id": match.away_team_id, "name": match.away_team_name, "shortName": match.away_team_short, "color": match.away_team_color},
        "snapshot": None if not snapshot else {
            "score": {"home": snapshot.score_home, "away": snapshot.score_away},
            "period": snapshot.period, "minute": snapshot.minute, "stats": snapshot.stats,
            "providerUpdatedAt": snapshot.provider_updated_at.isoformat(), "receivedAt": snapshot.received_at.isoformat(),
        },
        "events": [{"eventId": e.provider_event_id, "type": e.type, "teamId": e.team_id, "playerName": e.player_name, "minute": e.minute, "status": e.status} for e in match.events.all()[:20]],
    }
    if include_lineups:
        payload["lineups"] = [{"teamId": l.team_id, "formation": l.formation, "players": l.players} for l in match.lineups.all()]
    return payload

def broadcast_match_update(provider_match_id: str) -> None:
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import match_group

    payload = build_overlay_payload(provider_match_id, include_lineups=False)
    if payload is None: return

    async_to_sync(get_channel_layer().group_send)(
        match_group(provider_match_id), {"type": "match.update", "data": payload},
    )
    