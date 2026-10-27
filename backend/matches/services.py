import os
from datetime import datetime, timedelta, timezone

from django.db import transaction
from django.utils import timezone as djtz

from providers.base import FootballProvider, ProviderError
from providers.registry import get_provider
from providers.schemas import (
    Fixture, MatchSnapshot as SnapshotDTO,
    MatchEvent as EventDTO, Lineup as LineupDTO,
)

from .models import Match, MatchSnapshot, MatchEvent, Lineup

DEFAULT_STALE_SECONDS = int(os.getenv("STALE_THRESHOLD_SECONDS", "30"))


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


def _infer_goals_from_score_delta(
    match: Match,
    previous: MatchSnapshot | None,
    current: SnapshotDTO,
) -> list[MatchEvent]:
    """
    When the provider doesn't supply events, synthesize goal events from
    score differences between the last snapshot and the new one.
    Deduplicates by a fingerprint that includes the resulting score.
    """
    if previous is None:
        return []

    old_home = previous.score_home
    old_away = previous.score_away
    new_home = current.score.get("home", 0)
    new_away = current.score.get("away", 0)

    home_delta = max(0, new_home - old_home)
    away_delta = max(0, new_away - old_away)

    inferred: list[MatchEvent] = []
    minute = current.minute or 0
    now = djtz.now()

    for i in range(home_delta):
        event_id = f"inferred-home-{new_home}-{new_away}-{i + 1}"
        obj, created = MatchEvent.objects.update_or_create(
            match=match,
            provider_event_id=event_id,
            defaults={
                "type": "goal",
                "team_id": match.home_team_id,
                "player_id": None,
                "player_name": None,
                "minute": minute,
                "status": "confirmed",
                "source_updated_at": now,
                "received_at": now,
            },
        )
        if created:
            inferred.append(obj)

    for i in range(away_delta):
        event_id = f"inferred-away-{new_home}-{new_away}-{i + 1}"
        obj, created = MatchEvent.objects.update_or_create(
            match=match,
            provider_event_id=event_id,
            defaults={
                "type": "goal",
                "team_id": match.away_team_id,
                "player_id": None,
                "player_name": None,
                "minute": minute,
                "status": "confirmed",
                "source_updated_at": now,
                "received_at": now,
            },
        )
        if created:
            inferred.append(obj)

    return inferred


# --- Public service API ---

@transaction.atomic
def refresh_fixtures(provider: FootballProvider | None = None) -> list[Match]:
    p = provider or get_provider()
    fixtures = list(p.get_fixtures())
    return [_upsert_match(f, p.name) for f in fixtures]


@transaction.atomic
def refresh_match(provider_match_id: str, provider: FootballProvider | None = None) -> dict:
    """
    Sync snapshot, events, and lineups for one match.
    1. Capture the previous snapshot (for score-delta inference).
    2. Upsert the new snapshot.
    3. Upsert provider-supplied events.
    4. Infer goal events from score deltas (covers providers without event feeds).
    5. Broadcast + run automation for newly-created events.
    """
    p = provider or get_provider()
    match = Match.objects.get(provider=p.name, provider_match_id=provider_match_id)

    # 1. Snapshot before update — needed for inference
    previous_snapshot = getattr(match, "snapshot", None)

    # 2. Upsert the new snapshot
    snapshot_dto = p.get_match_snapshot(provider_match_id)
    if snapshot_dto:
        _upsert_snapshot(match, snapshot_dto)

    # 3. Provider-supplied events (real providers)
    created_ids: list[MatchEvent] = []
    for event_dto in p.get_events_since(provider_match_id):
        obj, created = _upsert_event(match, event_dto)
        if created:
            created_ids.append(obj)

    # 4. Infer goals from score delta (covers TheSportsDB free tier)
    if snapshot_dto:
        inferred = _infer_goals_from_score_delta(match, previous_snapshot, snapshot_dto)
        created_ids.extend(inferred)

    # 5. Lineups
    for lineup_dto in p.get_lineups(provider_match_id):
        _upsert_lineup(match, lineup_dto)

    # 6. Freshness
    match.refresh_from_db()
    snap = getattr(match, "snapshot", None)
    freshness = "disconnected"
    if snap:
        freshness = _freshness(snap.provider_updated_at, djtz.now())

    # 7. Broadcast the match update
    broadcast_match_update(provider_match_id)

    # 8. Automation for each new event
    if created_ids:
        from shows.models import ShowSession
        from automation.services import execute_for_event
        from audit.services import log_and_broadcast
        from audit.models import LogKind, LogSeverity

        active_sessions = list(
            ShowSession.objects.filter(
                match=match, state__in=["live", "paused", "degraded"]
            )
        )
        for session in active_sessions:
            for ev in created_ids:
                try:
                    execute_for_event(session, ev)
                except Exception as e:
                    log_and_broadcast(
                        session, LogKind.ERROR,
                        f"Automation failed: {type(e).__name__}: {e}",
                        severity=LogSeverity.WARN,
                    )

    return {
        "match_id": provider_match_id,
        "created_events": len(created_ids),
        "freshness": freshness,
    }


def build_overlay_payload(provider_match_id: str, include_lineups: bool = True) -> dict | None:
    try:
        match = Match.objects.select_related("snapshot").get(
            provider_match_id=provider_match_id
        )
    except Match.DoesNotExist:
        return None

    snapshot = getattr(match, "snapshot", None)
    payload = {
        "match_id": match.provider_match_id,
        "home": {
            "id": match.home_team_id, "name": match.home_team_name,
            "shortName": match.home_team_short, "color": match.home_team_color,
        },
        "away": {
            "id": match.away_team_id, "name": match.away_team_name,
            "shortName": match.away_team_short, "color": match.away_team_color,
        },
        "snapshot": None if not snapshot else {
            "score": {"home": snapshot.score_home, "away": snapshot.score_away},
            "period": snapshot.period,
            "minute": snapshot.minute,
            "stats": snapshot.stats,
            "providerUpdatedAt": snapshot.provider_updated_at.isoformat(),
            "receivedAt": snapshot.received_at.isoformat(),
        },
        "events": [
            {
                "eventId": e.provider_event_id, "type": e.type,
                "teamId": e.team_id, "playerName": e.player_name,
                "minute": e.minute, "status": e.status,
            }
            for e in match.events.all()[:20]
        ],
    }
    if include_lineups:
        payload["lineups"] = [
            {
                "teamId": l.team_id, "formation": l.formation,
                "players": l.players,
            }
            for l in match.lineups.all()
        ]
    return payload


def broadcast_match_update(provider_match_id: str) -> None:
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import match_group

    payload = build_overlay_payload(provider_match_id, include_lineups=False)
    if payload is None:
        return

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        match_group(provider_match_id),
        {"type": "match.update", "data": payload},
    )