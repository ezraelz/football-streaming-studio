import logging
from datetime import date

from django.core.cache import cache
from django.shortcuts import get_object_or_404
from django.utils import timezone as djtz
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from providers.base import ProviderError
from providers.registry import get_provider

from .models import Match
from .serializers import (
    FixtureSerializer,
    LineupSerializer,
    MatchEventSerializer,
    MatchSnapshotSerializer,
    event_model_to_dto,
    lineup_model_to_dto,
    match_model_to_fixture_dto,
    snapshot_model_to_dto,
)
from .services import _freshness, refresh_fixtures, refresh_match

logger = logging.getLogger(__name__)

FIXTURES_SYNC_TTL = 60  # seconds


def _parse_iso_date(value: str | None, field: str) -> tuple[date | None, Response | None]:
    """Parse an ISO date string; return (parsed, None) on success or (None, 400) on failure."""
    if not value:
        return None, None
    try:
        return date.fromisoformat(value[:10]), None
    except ValueError:
        return None, Response(
            {"detail": f"invalid '{field}' date; expected YYYY-MM-DD"},
            status=status.HTTP_400_BAD_REQUEST,
        )


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(str(value).split("+")[0].split("'")[0])
    except (TypeError, ValueError):
        return default


@api_view(["GET"])
@permission_classes([AllowAny])
def list_fixtures(request):
    provider = get_provider()
    date_from_raw = request.query_params.get("from")
    date_to_raw = request.query_params.get("to")
    league_id = request.query_params.get("league_id")

    date_from, err = _parse_iso_date(date_from_raw, "from")
    if err:
        return err
    date_to, err = _parse_iso_date(date_to_raw, "to")
    if err:
        return err

    # Normalize the window so the cache key is stable across implicit defaults.
    from django.utils import timezone
    today = timezone.localdate()
    effective_from = date_from or today
    effective_to = date_to or (effective_from + __import__("datetime").timedelta(days=7))

    cache_key = (
        f"fixtures-sync:{provider.name}:"
        f"{effective_from.isoformat()}:{effective_to.isoformat()}"
    )
    stale = False
    stale_reason: str | None = None

    if not cache.get(cache_key):
        try:
            refresh_fixtures(
                date_from=effective_from.isoformat(),
                date_to=effective_to.isoformat(),
            )
            cache.set(cache_key, True, FIXTURES_SYNC_TTL)
        except ProviderError as e:
            stale = True
            stale_reason = str(e)
            logger.exception("fixtures refresh failed for %s..%s: %s",
                             effective_from, effective_to, e)

    qs = Match.objects.filter(provider=provider.name)
    if date_from:
        qs = qs.filter(kickoff__date__gte=date_from)
    if date_to:
        qs = qs.filter(kickoff__date__lte=date_to)
    if league_id:
        qs = qs.filter(provider_league_id=league_id)
    qs = qs.order_by("kickoff")

    dtos = [match_model_to_fixture_dto(m) for m in qs]
    resp = Response(FixtureSerializer(dtos, many=True).data)
    if stale:
        resp["X-Fixtures-Stale"] = "1"
        if stale_reason:
            # Short reason only; full detail is in the server log.
            resp["X-Fixtures-Stale-Reason"] = stale_reason[:120]
    return resp


@api_view(["GET"])
@permission_classes([AllowAny])
def get_match(request, match_id: str):
    match = get_object_or_404(Match, provider_match_id=match_id)

    snapshot = getattr(match, "snapshot", None)
    if snapshot is None:
        try:
            refresh_match(match_id)
        except ProviderError as e:
            return Response(
                {"detail": f"provider error: {e}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        match.refresh_from_db()
        snapshot = getattr(match, "snapshot", None)
        if snapshot is None:
            return Response(
                {"detail": "no snapshot available"},
                status=status.HTTP_404_NOT_FOUND,
            )

    dto = snapshot_model_to_dto(snapshot)
    dto.freshness = _freshness(snapshot.provider_updated_at, djtz.now())
    return Response(MatchSnapshotSerializer(dto).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_events(request, match_id: str):
    match = get_object_or_404(Match, provider_match_id=match_id)

    qs = match.events.all().order_by("minute", "received_at", "id")
    dtos = [event_model_to_dto(e) for e in qs]
    return Response(MatchEventSerializer(dtos, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_lineups(request, match_id: str):
    match = get_object_or_404(Match, provider_match_id=match_id)
    dtos = [lineup_model_to_dto(l) for l in match.lineups.all()]
    return Response(LineupSerializer(dtos, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_h2h(request, match_id):
    match = get_object_or_404(Match, provider_match_id=match_id)

    from dataclasses import asdict
    try:
        meetings = list(get_provider().get_head_to_head(
            match.home_team_id, match.away_team_id,
        ))
    except ProviderError as e:
        logger.warning("h2h %s failed: %s", match_id, e)
        return Response(
            {"detail": f"provider error: {e}", "meetings": []},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response({"meetings": [asdict(m) for m in meetings]})


@api_view(["GET"])
@permission_classes([AllowAny])
def get_team_fixtures(request, team_id):
    from dataclasses import asdict
    try:
        rows = list(get_provider().get_upcoming_fixtures(team_id))
    except NotImplementedError:
        return Response(
            {"detail": "team fixtures are not supported by the active provider"},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )
    except ProviderError as e:
        logger.warning("team fixtures %s failed: %s", team_id, e)
        return Response(
            {"detail": f"provider error: {e}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    return Response({"fixtures": [asdict(r) for r in rows]})


@api_view(["GET"])
@permission_classes([AllowAny])
def get_prediction(request, match_id):
    match = get_object_or_404(Match, provider_match_id=match_id)

    from dataclasses import asdict
    from analysis.predictions import predict_from_h2h

    provider = get_provider()
    try:
        h2h = list(provider.get_head_to_head(
            match.home_team_id, match.away_team_id,
        ))
    except ProviderError as e:
        logger.warning("prediction h2h %s failed: %s", match_id, e)
        return Response(
            {"detail": f"provider error: {e}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    # Keep the DTO representation consistent with what predict_from_h2h expects.
    # If predict_from_h2h expects dicts, pass [asdict(m) for m in h2h] instead.
    result = dict(predict_from_h2h(
        match.home_team_name, match.away_team_name, h2h,
    ))
    result["match_id"] = match.provider_match_id
    result["team_a"] = match.home_team_name
    result["team_b"] = match.away_team_name
    return Response(result)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_incidents(request, match_id):
    match = get_object_or_404(Match, provider_match_id=match_id)
    provider = get_provider()

    try:
        events = list(provider.get_events_since(match.provider_match_id))
    except NotImplementedError:
        return Response(
            {"detail": "incidents not supported by provider", "incidents": []},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )
    except ProviderError as e:
        logger.warning("incidents %s failed: %s", match.provider_match_id, e)
        return Response(
            {"detail": f"provider error: {e}", "incidents": []},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    ordered = sorted(
        events,
        key=lambda ev: (ev.minute, ev.source_updated_at or ev.received_at),
    )
    return Response({
        "match_id": match.provider_match_id,
        "incidents": [
            {
                "id": ev.event_id,
                "type": ev.type,
                "minute": ev.minute,
                "team_id": ev.team_id,
                "player_id": ev.player_id,
                "player_name": ev.player_name,
                "detail": ev.detail,
                "status": ev.status,
                "source_updated_at": ev.source_updated_at.isoformat()
                    if ev.source_updated_at else None,
            }
            for ev in ordered
        ],
        "count": len(ordered),
    })
    