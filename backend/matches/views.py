from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Match
from .serializers import (
    FixtureSerializer, MatchSnapshotSerializer, MatchEventSerializer,
    LineupSerializer, snapshot_model_to_dto, match_model_to_fixture_dto,
    event_model_to_dto, lineup_model_to_dto,
)
from .services import refresh_fixtures, refresh_match, _freshness
from django.utils import timezone as djtz
from providers.registry import get_provider

@api_view(["GET"])
@permission_classes([AllowAny])
def list_fixtures(request):
    provider = get_provider()
    qs = Match.objects.filter(provider=provider.name).order_by("kickoff")
    if not qs.exists():
        refresh_fixtures()
        qs = Match.objects.filter(provider=provider.name).order_by("kickoff")
    dtos = [match_model_to_fixture_dto(m) for m in qs]
    return Response(FixtureSerializer(dtos, many=True).data)

@api_view(["GET"])
@permission_classes([AllowAny])
def get_match(request, match_id: str):
    try:
        match = Match.objects.select_related("snapshot").get(provider_match_id=match_id)
    except Match.DoesNotExist:
        return Response({"detail": "match not found"}, status=status.HTTP_404_NOT_FOUND)

    if not hasattr(match, "snapshot"):
        # Nothing persisted yet — try one refresh then re-check
        try:
            refresh_match(match_id)
            match.refresh_from_db()
        except Exception as e:
            return Response(
                {"detail": f"provider error: {e}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        if not hasattr(match, "snapshot"):
            return Response(
                {"detail": "no snapshot available"},
                status=status.HTTP_404_NOT_FOUND,
            )

    dto = snapshot_model_to_dto(match.snapshot)
    dto.freshness = _freshness(match.snapshot.provider_updated_at, djtz.now())
    return Response(MatchSnapshotSerializer(dto).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_events(request, match_id: str):
    try:
        match = Match.objects.get(provider_match_id=match_id)
    except Match.DoesNotExist:
        return Response({"detail": "match not found"}, status=status.HTTP_404_NOT_FOUND)

    events = match.events.all().order_by("minute", "id")
    dtos = [event_model_to_dto(e) for e in events]
    return Response(MatchEventSerializer(dtos, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_lineups(request, match_id: str):
    try:
        match = Match.objects.get(provider_match_id=match_id)
    except Match.DoesNotExist:
        return Response({"detail": "match not found"}, status=status.HTTP_404_NOT_FOUND)

    dtos = [lineup_model_to_dto(l) for l in match.lineups.all()]
    return Response(LineupSerializer(dtos, many=True).data)

@api_view(["GET"])
@permission_classes([AllowAny])
def get_h2h(request, match_id):
    try:
        match = Match.objects.get(provider_match_id=match_id)
    except Match.DoesNotExist:
        return Response({"detail": "match not found"}, status=404)

    from providers.registry import get_provider
    from dataclasses import asdict
    meetings = list(get_provider().get_head_to_head(match.home_team_id, match.away_team_id))
    return Response([asdict(m) for m in meetings])


@api_view(["GET"])
@permission_classes([AllowAny])
def get_team_fixtures(request, team_id):
    from providers.registry import get_provider
    from dataclasses import asdict
    rows = list(get_provider().get_upcoming_fixtures(team_id))
    return Response([asdict(r) for r in rows])


@api_view(["GET"])
@permission_classes([AllowAny])
def get_prediction(request, match_id):
    try:
        match = Match.objects.get(provider_match_id=match_id)
    except Match.DoesNotExist:
        return Response({"detail": "match not found"}, status=404)

    from providers.registry import get_provider
    from dataclasses import asdict
    from analysis.predictions import predict_from_h2h

    provider = get_provider()
    h2h = [asdict(m) for m in provider.get_head_to_head(match.home_team_id, match.away_team_id)]
    result = predict_from_h2h(match.home_team_name, match.away_team_name, h2h)
    result["match_id"] = match.provider_match_id
    result["team_a"] = match.home_team_name
    result["team_b"] = match.away_team_name
    return Response(result)

@api_view(["GET"])
@permission_classes([AllowAny])
def get_incidents(request, match_id):
    """
    Proxy Bzzoiro's /events/{id}/incidents/.
    Returns the normalized incidents list for this match.
    """
    import os
    import logging
    import requests as http
    from django.http import JsonResponse

    log = logging.getLogger(__name__)

    try:
        match = Match.objects.get(provider_match_id=match_id)
    except Match.DoesNotExist:
        return Response({"detail": "match not found"}, status=404)

    api_key = os.getenv("FOOTBALL_API_KEY")
    if not api_key:
        return Response({"detail": "FOOTBALL_API_KEY not configured", "incidents": []}, status=503)

    try:
        r = http.get(
            f"https://sports.bzzoiro.com/api/v2/events/{match.provider_match_id}/incidents/",
            headers={"Authorization": f"Token {api_key}"},
            timeout=10,
        )
        if not r.ok:
            log.warning("incidents %s → HTTP %s", match.provider_match_id, r.status_code)
            return Response({"detail": f"provider {r.status_code}", "incidents": []}, status=502)

        data = r.json()
        raw_incidents = data.get("incidents") or data.get("events") or []

        normalized = []
        for inc in raw_incidents:
            if not isinstance(inc, dict):
                continue

            # Player names — Bzzoiro returns nested objects
            player_obj = inc.get("player") or {}
            related_obj = inc.get("related_player") or {}
            player_name = player_obj.get("name") if isinstance(player_obj, dict) else None
            related_name = related_obj.get("name") if isinstance(related_obj, dict) else None

            # Sort key: (period, minute, second)
            second = inc.get("second")
            minute = inc.get("minute")
            period = inc.get("period")
            sort_key = (
                int(period or 0),
                int(minute or 0),
                int(second or 0),
            )

            normalized.append({
                "id": inc.get("id"),
                "type": inc.get("type"),
                "period": period,
                "minute": minute,
                "added_time": inc.get("added_time"),
                "second": second,
                "team": inc.get("team"),         # "home" | "away" | null
                "player_name": player_name,
                "related_name": related_name,
                "score": inc.get("score"),
                "important": bool(inc.get("important")),
                "rescinded": bool(inc.get("rescinded")),
                "sort_key": sort_key,
            })

        # Sort newest-first for timeline display
        normalized.sort(key=lambda i: i["sort_key"])

        return Response({
            "match_id": match.provider_match_id,
            "incidents": normalized,
            "count": len(normalized),
        })

    except Exception as e:
        log.warning("incidents %s failed: %s", match.provider_match_id, e)
        return Response({"detail": str(e), "incidents": []}, status=502)
    