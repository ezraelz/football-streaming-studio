from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from matches.models import Match

from .models import ShowProfile, ShowSession, EditorialCard
from .services import (
    create_session, transition, rotate_token, InvalidTransition,
)
from .serializers import (
    ShowProfileSerializer, ShowProfileCreateSerializer,
    ShowSessionSerializer, CreateShowSessionSerializer,
    EditorialCardSerializer,
)


# --- Show Profiles ---

def _name_of(value) -> str:
    """Extract a display name from a team field: string, dict, or None."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("name") or value.get("short_name") or ""
    return ""


def _id_of(value):
    """Extract an id from a team field: int, dict, or None."""
    if value is None:
        return None
    if isinstance(value, dict):
        return value.get("id")
    return value

def _normalize_standing_row(row: dict) -> dict:
    """Map Bzzoiro's short keys (gf, ga, gd, pts) to the frontend's long keys."""
    gf = row.get("gf") or row.get("goals_for") or 0
    ga = row.get("ga") or row.get("goals_against") or 0
    gd = row.get("gd")
    if gd is None:
        gd = gf - ga
    return {
        "position": row.get("position") or 0,
        "team": row.get("team_name") or "",
        "team_id": row.get("team_id"),
        "played": row.get("played") or 0,
        "won": row.get("won") or 0,
        "drawn": row.get("drawn") or 0,
        "lost": row.get("lost") or 0,
        "goals_for": gf,
        "goals_against": ga,
        "goal_difference": gd,
        "points": row.get("pts") or row.get("points") or 0,
        "form": row.get("form") or "",
        "zone": row.get("zone"),
    }

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def profiles(request):
    if request.method == "GET":
        qs = ShowProfile.objects.filter(owner=request.user)
        return Response(ShowProfileSerializer(qs, many=True).data)

    serializer = ShowProfileCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    profile = serializer.save(owner=request.user)
    return Response(ShowProfileSerializer(profile).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def profile_detail(request, profile_id):
    profile = get_object_or_404(ShowProfile, id=profile_id, owner=request.user)

    if request.method == "GET":
        return Response(ShowProfileSerializer(profile).data)

    if request.method == "DELETE":
        profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = ShowProfileSerializer(profile, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_scene(request, session_id):
    session = get_object_or_404(
        ShowSession.objects.select_related("show_profile"),
        id=session_id, show_profile__owner=request.user,
    )
    scene_id = request.data.get("scene_id")
    if not scene_id:
        return Response(
            {"detail": "scene_id required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from shows.obs_config import obs_scene_name
    from shows import obs_client

    obs_scene = obs_scene_name(scene_id)
    obs_ok = obs_client.set_current_scene(obs_scene)

    # Always broadcast to the overlay (so its preview follows even if OBS is off)
    from automation.services import broadcast_scene_command
    from audit.services import log_and_broadcast
    from audit.models import LogKind

    broadcast_scene_command(session, scene_id, rule_id=None)
    log_and_broadcast(
        session, LogKind.SCENE,
        f"Scene → {scene_id}",
        detail={
            "source": "manual",
            "obs_ok": obs_ok,
            "obs_scene": obs_scene,
        },
    )

    return Response({
        "scene_id": scene_id,
        "obs_scene": obs_scene,
        "obs_ok": obs_ok,
    })
    
# --- Show Sessions ---

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def show_sessions(request):
    if request.method == "GET":
        qs = (
            ShowSession.objects
            .select_related("show_profile", "match")
            .filter(show_profile__owner=request.user)
            .order_by("-created_at")
        )
        if state := request.query_params.get("state"):
            states = [s.strip() for s in state.split(",") if s.strip()]
            if states:
                qs = qs.filter(state__in=states)
        limit = min(int(request.query_params.get("limit", 20)), 100)
        return Response(ShowSessionSerializer(qs[:limit], many=True).data)

    # POST — create session (existing logic)
    ser = CreateShowSessionSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    profile = get_object_or_404(
        ShowProfile, id=ser.validated_data["show_profile_id"], owner=request.user
    )
    match = get_object_or_404(
        Match, provider_match_id=ser.validated_data["match_id"]
    )

    session = create_session(profile=profile, match=match)
    
    from shows.obs_config import obs_scene_name, DEFAULTS
    from shows import obs_client

    # Your internal scene keys (matches DEFAULTS in obs_config.py)
    SCENE_KEYS = ["scoreboard", "timeline", "stats", "tactical", "player", "lower-third"]

    for scene_key in SCENE_KEYS:
        # Get the OBS scene name from your env mapping (e.g., "⚽ Scoreboard")
        obs_scene = obs_scene_name(scene_key)
        
        # Build the overlay URL for this specific scene
        overlay_url = (
            f"http://localhost:3000/overlay/{session.id}"
            f"?scene={scene_key}&token={session.overlay_token}"
        )
        
        # Create the scene + source (idempotent—skips if already exists)
        obs_client.ensure_scene_with_browser_source(
            scene_name=obs_scene,
            source_name=f"Overlay {scene_key}",
            url=overlay_url,
        )

    from audit.services import log_and_broadcast
    from audit.models import LogKind
    log_and_broadcast(
        session, LogKind.DATA,
        f"Session created for {match.home_team_short} vs {match.away_team_short}",
        detail={"match_id": match.provider_match_id, "profile": profile.name},
    )

    return Response(ShowSessionSerializer(session).data, status=status.HTTP_201_CREATED)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_detail(request, session_id):
    session = get_object_or_404(
        ShowSession.objects.select_related("show_profile", "match"),
        id=session_id,
        show_profile__owner=request.user,
    )
    return Response(ShowSessionSerializer(session).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def transition_view(request, session_id, target):
    session = get_object_or_404(
        ShowSession.objects.select_related("show_profile"),
        id=session_id,
        show_profile__owner=request.user,
    )
    try:
        session = transition(session, target, actor=request.user)
    except InvalidTransition as e:
        return Response(
            {"detail": str(e), "current": e.current, "target": e.target},
            status=status.HTTP_409_CONFLICT,
        )
    return Response(ShowSessionSerializer(session).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rotate_token_view(request, session_id):
    session = get_object_or_404(
        ShowSession.objects.select_related("show_profile"),
        id=session_id,
        show_profile__owner=request.user,
    )
    session = rotate_token(session)
    return Response(ShowSessionSerializer(session).data)


# --- Overlay (public, token-scoped, read-only) ---

@api_view(["GET"])
@permission_classes([AllowAny])
def overlay_state(request, token):
    try:
        session = ShowSession.objects.select_related(
            "show_profile", "match__snapshot"
        ).get(overlay_token=token)
    except ShowSession.DoesNotExist:
        return Response({"detail": "invalid token"}, status=status.HTTP_404_NOT_FOUND)

    match = session.match
    snapshot = getattr(match, "snapshot", None)

    # Active commentary line: most recent queued item for this session
    from commentary.models import CommentaryItem, CommentaryStatus
    active_commentary = (
        CommentaryItem.objects
        .filter(session=session, status=CommentaryStatus.QUEUED)
        .order_by("-created_at")
        .first()
    )
    
    # Lineups (for the tactical scene)
    lineups_payload = None
    try:
        from matches.models import Lineup as LineupModel
        lines = LineupModel.objects.filter(match=match)
        if lines.exists():
            lineups_payload = {
                "home": None,
                "away": None,
            }
            for lu in lines:
                side = "home" if lu.team_id == match.home_team_id else "away" if lu.team_id == match.away_team_id else None
                if side:
                    lineups_payload[side] = {
                        "formation": lu.formation or "",
                        "players": lu.players or [],
                    }
    except Exception:
        lineups_payload = None

    payload = {
        "session_id": str(session.id),
        "state": session.state,
        "match_id": match.provider_match_id,
        "home": {
            "id": match.home_team_id,
            "name": match.home_team_name,
            "shortName": match.home_team_short,
            "color": match.home_team_color,
        },
        "away": {
            "id": match.away_team_id,
            "name": match.away_team_name,
            "shortName": match.away_team_short,
            "color": match.away_team_color,
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
                "eventId": e.provider_event_id,
                "type": e.type,
                "teamId": e.team_id,
                "playerName": e.player_name,
                "minute": e.minute,
                "status": e.status,
            }
            for e in match.events.all()[:20]
        ],
        "active_commentary": None if not active_commentary else {
            "id": str(active_commentary.id),
            "text": active_commentary.text,
            "priority": active_commentary.priority,
            "expires_at": active_commentary.expires_at.isoformat(),
        },
        "lineups": lineups_payload,
    }
    return Response(payload)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_sessions(request):
    """
    List sessions owned by the current user, optionally filtered by state.
    Ordered newest-first so the most recent active session is easy to find.
    """
    qs = (
        ShowSession.objects
        .select_related("show_profile", "match")
        .filter(show_profile__owner=request.user)
        .order_by("-created_at")
    )

    if state := request.query_params.get("state"):
        # Accept comma-separated states: ?state=live,paused,degraded
        states = [s.strip() for s in state.split(",") if s.strip()]
        if states:
            qs = qs.filter(state__in=states)

    limit = min(int(request.query_params.get("limit", 20)), 100)
    return Response(ShowSessionSerializer(qs[:limit], many=True).data)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def obs_status(request):
    from shows import obs_client

    if request.method == "GET":
        return Response({
            "connected": obs_client.is_connected(),
            "current_scene": obs_client.get_current_scene(),
        })

    # POST → force a reconnect attempt
    obs_client.disconnect()
    from shows.obs_client import _get_client
    _get_client()
    return Response({
        "connected": obs_client.is_connected(),
        "current_scene": obs_client.get_current_scene(),
    })
    

def _broadcast_editorial(card):
    """Push a card update to all subscribers of this session."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import session_group

    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        session_group(str(card.session_id)),
        {"type": "editorial_event", "data": EditorialCardSerializer(card).data},
    )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def editorial_cards(request, session_id):
    session = get_object_or_404(
        ShowSession, id=session_id, show_profile__owner=request.user
    )

    if request.method == "GET":
        return Response(EditorialCardSerializer(session.editorial_cards.all(), many=True).data)

    ser = EditorialCardSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    card = ser.save(session=session)
    return Response(EditorialCardSerializer(card).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def editorial_card_detail(request, session_id, card_id):
    card = get_object_or_404(
        EditorialCard, id=card_id, session__show_profile__owner=request.user
    )

    if request.method == "GET":
        return Response(EditorialCardSerializer(card).data)
    if request.method == "DELETE":
        card.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    ser = EditorialCardSerializer(card, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    card = ser.save()

    if "visible" in request.data:
        _broadcast_editorial(card)
    return Response(EditorialCardSerializer(card).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def broadcast_editorial(request, session_id, card_id):
    card = get_object_or_404(
        EditorialCard, id=card_id, session__show_profile__owner=request.user
    )
    # Only one editorial card visible at a time
    card.session.editorial_cards.exclude(id=card.id).update(visible=False)
    card.visible = True
    card.save(update_fields=["visible", "updated_at"])
    _broadcast_editorial(card)

    from audit.services import log_and_broadcast
    from audit.models import LogKind
    log_and_broadcast(
        card.session, LogKind.SCENE,
        f"Editorial card shown: {card.title} ({card.card_type})",
        detail={"card_id": str(card.id), "card_type": card.card_type},
    )

    return Response(EditorialCardSerializer(card).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def hide_all_editorial(request, session_id):
    session = get_object_or_404(
        ShowSession, id=session_id, show_profile__owner=request.user
    )
    session.editorial_cards.filter(visible=True).update(visible=False)

    # Broadcast an empty "visible: false" for the session
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import session_group

    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        session_group(str(session.id)),
        {"type": "editorial_event", "data": {"visible": False, "session_id": str(session.id)}},
    )
    return Response({"hidden": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def seed_editorial(request, session_id, card_type):
    """Pre-fill an editorial card from the current Match / MatchSnapshot / BSD."""
    import os
    import logging
    import requests as http

    from matches.models import Match

    log = logging.getLogger(__name__)

    session = get_object_or_404(
        ShowSession, id=session_id, show_profile__owner=request.user
    )
    match = session.match
    snapshot = getattr(match, "snapshot", None)

    def bsd_get(path, params=None):
        """Call BSD with proper error logging. Returns None on any failure."""
        api_key = os.getenv("FOOTBALL_API_KEY")
        if not api_key:
            log.warning("seed_editorial: FOOTBALL_API_KEY missing")
            return None
        try:
            r = http.get(
                f"https://sports.bzzoiro.com/api/v2{path}",
                headers={"Authorization": f"Token {api_key}"},
                params=params,
                timeout=10,
            )
            if not r.ok:
                log.warning("bsd_get %s → HTTP %s: %s", path, r.status_code, r.text[:200])
                return None
            return r.json()
        except Exception as e:
            log.warning("bsd_get %s failed: %s", path, e)
            return None

    # Season derivation: BSD seasons are usually named by start year
    # (e.g. "2026/2027" → 2026). Use the match year minus a bit if in H1.
    kickoff_year = match.kickoff.year
    kickoff_month = match.kickoff.month
    season_year = kickoff_year if kickoff_month >= 7 else kickoff_year - 1

    base = {
        "competition": match.competition or "Unknown",
        "home": {"name": match.home_team_name or match.home_team_short, "color": match.home_team_color or "#27272a"},
        "away": {"name": match.away_team_name or match.away_team_short, "color": match.away_team_color or "#27272a"},
    }

    # --- fixture_intro ---
    if card_type == "fixture_intro":
        payload = {
            **base,
            "kickoff_label": match.kickoff.strftime("Kickoff · %a %H:%M"),
            "venue": "",
        }
        title = f"{match.home_team_short} vs {match.away_team_short}"

    # --- countdown ---
    elif card_type == "countdown":
        payload = {
            "competition": base["competition"],
            "home_name": base["home"]["name"],
            "away_name": base["away"]["name"],
            "kickoff": match.kickoff.isoformat(),
        }
        title = f"Countdown · {match.home_team_short} vs {match.away_team_short}"

    # --- match_summary ---
    elif card_type == "match_summary":
        goals = [
            {
                "minute": e.minute,
                "player": e.player_name or "—",
                "team": (
                    match.home_team_short if e.team_id == match.home_team_id
                    else match.away_team_short
                ),
            }
            for e in match.events.filter(type="goal").order_by("minute")
        ]
        payload = {
            **base,
            "score": {
                "home": snapshot.score_home if snapshot else 0,
                "away": snapshot.score_away if snapshot else 0,
            },
            "goals": goals,
        }
        title = f"FT · {match.home_team_short} {payload['score']['home']}–{payload['score']['away']} {match.away_team_short}"

    # --- lineups ---
    elif card_type == "lineups":
        data = bsd_get(f"/events/{match.provider_match_id}/lineups/")
        lineup_status = "unavailable"
        payload = {
            "home": {"formation": "TBD", "players": []},
            "away": {"formation": "TBD", "players": []},
            "lineup_status": "unavailable",
        }
        title = f"Lineups · {match.home_team_short} vs {match.away_team_short}"

        if data:
            lineup_status = data.get("lineup_status") or "unavailable"
            payload["lineup_status"] = lineup_status

            if data.get("lineups"):
                lu = data["lineups"]
                payload = {
                    "home": {
                        "formation": (lu.get("home") or {}).get("formation", ""),
                        "players": (lu.get("home") or {}).get("players", []),
                    },
                    "away": {
                        "formation": (lu.get("away") or {}).get("formation", ""),
                        "players": (lu.get("away") or {}).get("players", []),
                    },
                    "lineup_status": lineup_status,
                }
                title = (
                    f"Lineups · {match.home_team_short} vs {match.away_team_short}"
                    + ("" if lineup_status == "confirmed" else f" ({lineup_status})")
                )
            
    # --- standings ---
    elif card_type == "standings":
        league_id = getattr(match, "provider_league_id", "") or ""
        rows: list[dict] = []
        zones: list[dict] = []

        if league_id:
            season_data = bsd_get(f"/leagues/{league_id}/season/")
            season_id = season_data.get("id") if isinstance(season_data, dict) else None

            params = {"season_id": season_id} if season_id else {}
            data = bsd_get(f"/leagues/{league_id}/standings/", params=params)

            if data and isinstance(data, dict):
                table = data.get("standings") or data.get("groups") or []

                if isinstance(table, list):
                    for item in table:
                        # Grouped competitions: item = { "name": "Group A", "rows": [...] }
                        if isinstance(item, dict) and "rows" in item:
                            for row in item["rows"]:
                                if isinstance(row, dict):
                                    rows.append(_normalize_standing_row(row))
                        # Flat competitions: item = a single row
                        elif isinstance(item, dict) and "team_name" in item:
                            rows.append(_normalize_standing_row(item))

                zones = data.get("zones") or []

        payload = {
            "competition": base["competition"],
            "rows": rows,
            "zones": zones,
        }
        title = f"{base['competition']} Standings"
    
    # --- top_scorers ---
    elif card_type == "top_scorers":
        league_id = getattr(match, "provider_league_id", "") or ""
        players: list[dict] = []

        if league_id:
            # 1. Resolve the current season ID from the league.
            #    This is the correct path (not /seasons/?league_id=).
            season_data = bsd_get(f"/leagues/{league_id}/season/")
            season_id = None
            if season_data and isinstance(season_data, dict):
                season_id = season_data.get("id")

            # 2. Fetch top scorers, passing the resolved season_id.
            params = {}
            if season_id:
                params["season_id"] = season_id

            data = bsd_get(
                f"/leagues/{league_id}/top/scorers/",
                params={"season_id": season_id},
            )

            if data:
                # Bzzoiro returns "leaders" in the top-scorers response,
                # not "scorers" or "results".
                leaders = data.get("leaders") or data.get("scorers") or []
                if isinstance(leaders, list):
                    for entry in leaders[:10]:
                        if not isinstance(entry, dict):
                            continue
                        players.append({
                            "name": (
                                entry.get("player_name")
                                or entry.get("player")
                                or entry.get("name")
                                or ""
                            ),
                            "team": (
                                entry.get("team_name")
                                or entry.get("team")
                                or ""
                            ),
                            "goals": (
                                entry.get("value")
                                or entry.get("goals")
                                or 0
                            ),
                        })

        payload = {
            "competition": base["competition"],
            "players": players,
        }
        title = f"{base['competition']} Top Scorers"
    
    # --- top_assists ---
    elif card_type == "top_assists":
        league_id = getattr(match, "provider_league_id", "") or ""
        players: list[dict] = []

        if league_id:
            season_data = bsd_get(f"/leagues/{league_id}/season/")
            season_id = season_data.get("id") if isinstance(season_data, dict) else None

            params = {"season_id": season_id} if season_id else {}
            data = bsd_get(f"/leagues/{league_id}/top/assists/", params=params)

            if data:
                leaders = data.get("leaders") or data.get("scorers") or []
                if isinstance(leaders, list):
                    for entry in leaders[:10]:
                        if not isinstance(entry, dict):
                            continue
                        players.append({
                            "name": (
                                entry.get("player_name")
                                or entry.get("player")
                                or entry.get("name")
                                or ""
                            ),
                            "team": (
                                entry.get("team_name")
                                or entry.get("team")
                                or ""
                            ),
                            "assists": (
                                entry.get("value")
                                or entry.get("assists")
                                or 0
                            ),
                        })

        payload = {
            "competition": base["competition"],
            "players": players,
        }
        title = f"{base['competition']} Top Assists"
    
    # --- head_to_head ---
    elif card_type == "head_to_head":
        meetings: list[dict] = []
        aggregate: dict = {}

        data = bsd_get(f"/events/{match.provider_match_id}/h2h/")
        if data:
            # Aggregate stats (optional — the frontend can show them later)
            aggregate = {
                "total_matches": data.get("total_matches") or 0,
                "home_wins": data.get("home_wins") or 0,
                "draws": data.get("draws") or 0,
                "away_wins": data.get("away_wins") or 0,
                "home_goals": data.get("home_goals") or 0,
                "away_goals": data.get("away_goals") or 0,
                "avg_total_goals": data.get("avg_total_goals") or 0.0,
                "home_win_rate": data.get("home_win_rate") or 0.0,
                "away_win_rate": data.get("away_win_rate") or 0.0,
            }

            for row in (data.get("recent_matches") or [])[:10]:
                if not isinstance(row, dict):
                    continue

                home_score = row.get("home_score")
                away_score = row.get("away_score")

                # Spec: prefer integer fields; fall back to score string ONLY if both ints null
                if home_score is not None and away_score is not None:
                    score_str = f"{home_score}-{away_score}"
                else:
                    score_str = row.get("score") or "—"

                meetings.append({
                    "date": str(row.get("date") or "")[:10],
                    "home_team": row.get("home") or "",
                    "away_team": row.get("away") or "",
                    "score": score_str,
                    "competition": base["competition"],  # not in payload — use match competition
                })

        payload = {
            "meetings": meetings,
            "aggregate": aggregate,
        }
        title = f"H2H · {match.home_team_short} vs {match.away_team_short}"
    
    # --- best_xi ---
    elif card_type == "best_xi":
        league_id = getattr(match, "provider_league_id", "") or ""
        payload = {
            "competition": base["competition"],
            "formation": "4-3-3",
            "players": [],
            "unavailable": True,
        }
        title = f"Team of the Season · {base['competition']}"

        if league_id:
            season_data = bsd_get(f"/leagues/{league_id}/season/")
            season_id = season_data.get("id") if isinstance(season_data, dict) else None

            if season_id:
                data = bsd_get(f"/leagues/{league_id}/bestxi/{season_id}/")

                if data and isinstance(data, dict):
                    payload["formation"] = data.get("formation") or "4-3-3"

                    raw_players = data.get("players") or data.get("xi") or data.get("eleven") or []
                    for p in raw_players:
                        if not isinstance(p, dict):
                            continue

                        # Bzzoiro returns players with pitch coordinates
                        # (x, y on a 0..100 grid, x = goal line direction).
                        pos = p.get("pos") or p.get("position") or {}
                        if isinstance(pos, dict):
                            x = pos.get("x")
                            y = pos.get("y")
                        else:
                            x = p.get("x")
                            y = p.get("y")

                        # Skip players without coordinates — can't render them
                        if x is None or y is None:
                            continue

                        payload["players"].append({
                            "name": p.get("player_name") or p.get("name") or "",
                            "team": p.get("team_name") or p.get("team") or "",
                            "position": p.get("position") or p.get("role") or "",
                            "rating": p.get("rating") or p.get("value"),
                            "x": round(float(x), 1),
                            "y": round(float(y), 1),
                        })

                    if payload["players"]:
                        payload["unavailable"] = False
                        
    # --- form ---
    elif card_type == "form":
        results_by_side: dict[str, list[dict]] = {"home": [], "away": []}

        for side, team_id, team_name in (
            ("home", match.home_team_id, base["home"]["name"]),
            ("away", match.away_team_id, base["away"]["name"]),
        ):
            if not team_id:
                continue

            data = bsd_get(
                "/events/",
                params={"team_id": team_id, "status": "finished", "limit": 5},
            )
            if not data:
                continue

            raw = (
                data.get("results")
                or data.get("events")
                or data.get("data")
                or (data if isinstance(data, list) else [])
            )

            for row in (raw or [])[:5]:
                if not isinstance(row, dict):
                    continue

                home_id = _id_of(row.get("home_team_id")) or _id_of(row.get("home_team")) or _id_of(row.get("home"))
                away_id = _id_of(row.get("away_team_id")) or _id_of(row.get("away_team")) or _id_of(row.get("away"))
                is_home = str(home_id) == str(team_id)

                hg = row.get("home_score")
                ag = row.get("away_score")
                score_obj = row.get("score")
                if isinstance(score_obj, dict):
                    hg = hg if hg is not None else score_obj.get("home")
                    ag = ag if ag is not None else score_obj.get("away")

                if hg is None or ag is None:
                    continue

                ours = hg if is_home else ag
                theirs = ag if is_home else hg
                outcome = "W" if ours > theirs else "D" if ours == theirs else "L"

                home_name = (
                    _name_of(row.get("home"))
                    or _name_of(row.get("home_team"))
                    or row.get("home_team_name")
                    or ""
                )
                away_name = (
                    _name_of(row.get("away"))
                    or _name_of(row.get("away_team"))
                    or row.get("away_team_name")
                    or ""
                )
                opponent = away_name if is_home else home_name

                results_by_side[side].append({
                    "outcome": outcome,
                    "opponent": opponent,
                    "score": f"{hg}-{ag}",
                })

        payload = {
            "home": {"team": base["home"]["name"], "results": results_by_side["home"]},
            "away": {"team": base["away"]["name"], "results": results_by_side["away"]},
        }
        title = f"Form · {match.home_team_short} vs {match.away_team_short}"
        
        
    # --- prediction ---
    elif card_type == "prediction":
        payload = {
            "competition": base["competition"],
            "home_name": base["home"]["name"],
            "away_name": base["away"]["name"],
            "markets": {},
            "model_version": None,
            "generated_at": None,
            "unavailable": True,
            "reason": "No prediction available for this match.",
        }
        title = f"Prediction · {match.home_team_short} vs {match.away_team_short}"

        def as_unit(v):
            if v is None:
                return None
            try:
                f = float(v)
            except (TypeError, ValueError):
                return None
            return f / 100.0 if f > 1 else f

        def pick(source, *keys, default=None):
            if not isinstance(source, dict):
                return default
            for k in keys:
                v = source.get(k)
                if v is not None:
                    return v
            return default

        # ── Step 1: try Bzzoiro's own model ─────────────────────────────────
        bsd_model = bsd_get(f"/predictions/{match.provider_match_id}/")
        if not bsd_model or (isinstance(bsd_model, dict) and bsd_model.get("detail")):
            bsd_model = bsd_get(f"/events/{match.provider_match_id}/prediction/")

        if bsd_model and isinstance(bsd_model, dict) and not bsd_model.get("detail"):
            raw_markets = (
                bsd_model.get("markets")
                or bsd_model.get("predictions")
                or bsd_model.get("probabilities")
                or bsd_model
            )
            result = raw_markets.get("result") if isinstance(raw_markets, dict) else None
            probs = result or raw_markets or {}

            home_p = as_unit(pick(probs, "home_win", "home", "1", "home_win_probability"))
            draw_p = as_unit(pick(probs, "draw", "x", "draw_probability"))
            away_p = as_unit(pick(probs, "away_win", "away", "2", "away_win_probability"))

            if home_p is not None and draw_p is not None and away_p is not None:
                payload["markets"]["1x2"] = {
                    "home": round(home_p, 3),
                    "draw": round(draw_p, 3),
                    "away": round(away_p, 3),
                }
                payload["unavailable"] = False
                payload["reason"] = None
                payload["model_version"] = (
                    bsd_model.get("model_version")
                    or bsd_model.get("model")
                    or "bzzoiro-model"
                )
                payload["generated_at"] = (
                    bsd_model.get("generated_at")
                    or bsd_model.get("timestamp")
                    or bsd_model.get("updated_at")
                )

                # O/U 2.5 from the Bzzoiro model if present
                totals = raw_markets.get("totals") or raw_markets.get("over_under") or {}
                over25 = as_unit(pick(totals, "over_25", "over_25_goals", "over25"))
                under25 = as_unit(pick(totals, "under_25", "under_25_goals", "under25"))
                if over25 is not None or under25 is not None:
                    payload["markets"]["over_under_25"] = {"over": over25, "under": under25}

                btts = raw_markets.get("btts") or {}
                yes = as_unit(pick(btts, "yes", "btts_yes"))
                no = as_unit(pick(btts, "no", "btts_no"))
                if yes is not None or no is not None:
                    payload["markets"]["btts"] = {"yes": yes, "no": no}

        # ── Step 2: Poisson model from recent results ───────────────────────
        if payload["unavailable"]:
            home_data = bsd_get(
                "/events/",
                params={"team_id": match.home_team_id, "status": "finished", "limit": 15},
            )
            away_data = bsd_get(
                "/events/",
                params={"team_id": match.away_team_id, "status": "finished", "limit": 15},
            )

            def extract_list(payload_obj):
                if not payload_obj:
                    return []
                if isinstance(payload_obj, list):
                    return payload_obj
                return (
                    payload_obj.get("results")
                    or payload_obj.get("events")
                    or payload_obj.get("data")
                    or []
                )

            home_matches = extract_list(home_data)
            away_matches = extract_list(away_data)

            if len(home_matches) >= 3 and len(away_matches) >= 3:
                try:
                    from analysis.poisson import predict_1x2
                    result = predict_1x2(
                        home_matches=home_matches,
                        away_matches=away_matches,
                        home_team_id=match.home_team_id,
                        away_team_id=match.away_team_id,
                    )
                    payload["markets"]["1x2"] = {
                        "home": result["home"],
                        "draw": result["draw"],
                        "away": result["away"],
                    }
                    payload["unavailable"] = False
                    payload["reason"] = None
                    payload["model_version"] = result["model_version"]
                    payload["generated_at"] = None
                    payload["model_notes"] = (
                        f"λ_home={result['lambda_home']}, λ_away={result['lambda_away']}, "
                        f"league_avg={result['league_avg']}"
                    )
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning("poisson prediction failed: %s", e)

        # ── Step 3: fall back to market consensus from odds ─────────────────
        if payload["unavailable"]:
            odds_data = bsd_get(f"/events/{match.provider_match_id}/odds/")
            if odds_data and isinstance(odds_data, dict) and odds_data.get("odds"):
                from analysis.poisson import predict_from_odds
                odds_payload = predict_from_odds(odds_data["odds"])
                if odds_payload:
                    payload["markets"]["1x2"] = {
                        "home": odds_payload["home"],
                        "draw": odds_payload["draw"],
                        "away": odds_payload["away"],
                    }
                    payload["unavailable"] = False
                    payload["reason"] = None
                    payload["model_version"] = odds_payload["model_version"]
                    payload["generated_at"] = odds_data.get("last_update_at")

        # ── Step 4: still empty? Tell the operator why ──────────────────────
        if payload["unavailable"]:
            # Prefer Bzzoiro's own reason if it returned one
            if isinstance(bsd_model, dict) and bsd_model.get("detail"):
                payload["reason"] = bsd_model["detail"]
            else:
                payload["reason"] = (
                    "Not enough recent match data or market odds "
                    "to build a prediction for this fixture."
                )
                
    # --- momentum ---
    elif card_type == "momentum":
        data = bsd_get(f"/events/{match.provider_match_id}/stats/")

        payload = {
            "competition": base["competition"],
            "home_name": base["home"]["name"],
            "away_name": base["away"]["name"],
            "home_short": match.home_team_short,
            "away_short": match.away_team_short,
            "home_color": base["home"]["color"],
            "away_color": base["away"]["color"],
            "samples": [],
            "unavailable": True,
        }
        title = f"Momentum · {match.home_team_short} vs {match.away_team_short}"

        if data and isinstance(data, dict):
            raw = data.get("momentum") or []
            if isinstance(raw, list) and raw:
                samples = []
                for point in raw:
                    if not isinstance(point, dict):
                        continue
                    minute = point.get("m") if "m" in point else point.get("minute")
                    value = point.get("v") if "v" in point else point.get("value")
                    if minute is None or value is None:
                        continue
                    try:
                        samples.append({"minute": int(minute), "value": float(value)})
                    except (TypeError, ValueError):
                        continue

                if samples:
                    # Normalize so the max |value| across the whole match = 1.
                    # Bzzoiro's values are already signed (positive = home pressure).
                    max_abs = max(abs(s["value"]) for s in samples) or 1.0
                    for s in samples:
                        s["value"] = round(s["value"] / max_abs, 3)

                    payload["samples"] = samples
                    payload["unavailable"] = False
            
    # --- shot_map ---
    elif card_type == "shot_map":
        data = bsd_get(f"/events/{match.provider_match_id}/stats/")

        shots = []
        payload = {
            "competition": base["competition"],
            "home_name": base["home"]["name"],
            "away_name": base["away"]["name"],
            "home_color": base["home"]["color"],
            "away_color": base["away"]["color"],
            "shots": shots,
            "home_xg": None,
            "away_xg": None,
            "unavailable": True,
        }
        title = f"Shot map · {match.home_team_short} vs {match.away_team_short}"

        if data and isinstance(data, dict):
            raw_shots = data.get("shotmap") or data.get("shots") or []
            if isinstance(raw_shots, list):
                for s in raw_shots:
                    if not isinstance(s, dict):
                        continue

                    # pos: origin of the shot {x, y} on 0..100 pitch coordinates
                    pos = s.get("pos") or {}
                    x = pos.get("x")
                    y = pos.get("y")
                    if x is None or y is None:
                        continue

                    # side: true if the shot was by the home team
                    is_home = bool(s.get("home"))

                    # Skip shootout attempts (they aren't match shots)
                    if s.get("sit") == "shootout":
                        continue

                    shots.append({
                        "x": round(float(x), 1),
                        "y": round(float(y), 1),
                        "type": s.get("type") or "miss",  # goal | save | miss | block | post
                        "is_home": is_home,
                        "minute": s.get("min"),
                        "player": s.get("player_name") or s.get("player"),
                        "xg": s.get("xg"),
                        "xgot": s.get("xgot"),
                    })

                payload["unavailable"] = len(shots) == 0

            # Team xG from the stats bag
            stats = data.get("stats") or {}
            home_stats = stats.get("home") or {}
            away_stats = stats.get("away") or {}
            home_xg = (home_stats.get("xg") or {}).get("actual")
            away_xg = (away_stats.get("xg") or {}).get("actual")
            if home_xg is not None:
                payload["home_xg"] = round(float(home_xg), 2)
            if away_xg is not None:
                payload["away_xg"] = round(float(away_xg), 2)
            
            
    # --- match_preview ---
    elif card_type == "match_preview":
        # Two sources of data on Bzzoiro:
        #   /events/{id}/           — static detail: venue, weather, referee, kickoff
        #   /events/{id}/metadata/  — AI-generated preview paragraph, fun facts, kits
        detail = bsd_get(f"/events/{match.provider_match_id}/")
        meta = bsd_get(f"/events/{match.provider_match_id}/metadata/")

        payload = {
            "competition": base["competition"],
            "home_name": base["home"]["name"],
            "away_name": base["away"]["name"],
            "home_color": base["home"]["color"],
            "away_color": base["away"]["color"],
            "kickoff": match.kickoff.isoformat() if match.kickoff else None,
            "venue": None,
            "city": None,
            "weather": None,
            "temperature_c": None,
            "referee": None,
            "attendance": None,
            "preview": None,
            "fun_fact": None,
            "unavailable": True,
        }
        title = f"Preview · {match.home_team_short} vs {match.away_team_short}"

        # --- Static detail (/events/{id}/) ------------------------------------
        if detail and isinstance(detail, dict):
            venue_obj = detail.get("venue") or {}
            if isinstance(venue_obj, dict):
                payload["venue"] = venue_obj.get("name") or detail.get("venue_name")
                payload["city"] = venue_obj.get("city") or detail.get("venue_city")
            else:
                payload["venue"] = venue_obj or detail.get("venue_name")
                payload["city"] = detail.get("venue_city")

            # Weather object (varies; try a few keys)
            weather_obj = detail.get("weather") or {}
            if isinstance(weather_obj, dict):
                payload["weather"] = weather_obj.get("description") or weather_obj.get("condition")
                temp = weather_obj.get("temperature") or weather_obj.get("temp_c")
                if temp is not None:
                    try:
                        payload["temperature_c"] = round(float(temp), 1)
                    except (TypeError, ValueError):
                        pass

            # Referee (string or object)
            ref = detail.get("referee")
            if isinstance(ref, dict):
                payload["referee"] = ref.get("name")
            elif isinstance(ref, str):
                payload["referee"] = ref

            # Attendance (may be null pre-match)
            att = detail.get("attendance")
            if att is not None:
                try:
                    payload["attendance"] = int(att)
                except (TypeError, ValueError):
                    pass

            if payload["venue"]:
                payload["unavailable"] = False  # at least we have venue info

        # --- AI preview (/metadata/) -------------------------------------------
        if meta and isinstance(meta, dict):
            # Preview paragraph under several plausible keys
            preview = (
                meta.get("preview")
                or meta.get("preview_text")
                or meta.get("match_preview")
                or (meta.get("ai_preview") or {}).get("text") if isinstance(meta.get("ai_preview"), dict) else None
                or meta.get("summary")
            )
            if isinstance(preview, str) and preview.strip():
                payload["preview"] = preview.strip()
                payload["unavailable"] = False

            # Fun fact (one-liner)
            fun_fact = (
                meta.get("fun_fact")
                or meta.get("fact")
                or meta.get("did_you_know")
            )
            if isinstance(fun_fact, str) and fun_fact.strip():
                payload["fun_fact"] = fun_fact.strip()

            # Kit colours (optional — for future kit-color icon)
            home_kit = meta.get("home_kit") or meta.get("kit", {}).get("home") if isinstance(meta.get("kit"), dict) else meta.get("home_kit")
            away_kit = meta.get("away_kit") or meta.get("kit", {}).get("away") if isinstance(meta.get("kit"), dict) else meta.get("away_kit")
            if isinstance(home_kit, dict):
                color = home_kit.get("primary") or home_kit.get("color")
                if color:
                    payload["home_color"] = color
            if isinstance(away_kit, dict):
                color = away_kit.get("primary") or away_kit.get("color")
                if color:
                    payload["away_color"] = color

        # Fallback: at least show something useful if only one source worked
        if payload["unavailable"] and not payload["preview"] and not payload["venue"]:
            payload["unavailable"] = True
            
    # --- custom / unknown ---
    else:
        payload = base
        title = card_type.replace("_", " ").title()

    card = EditorialCard.objects.create(
        session=session,
        card_type=card_type,
        title=title,
        payload=payload,
    )
    return Response(EditorialCardSerializer(card).data, status=status.HTTP_201_CREATED)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def provision_obs(request, session_id):
    """
    (Re)create OBS scenes and browser sources for an existing session.
    Idempotent — safe to call repeatedly.
    """
    session = get_object_or_404(
        ShowSession.objects.select_related("show_profile", "match"),
        id=session_id,
        show_profile__owner=request.user,
    )

    from shows.obs_config import obs_scene_name
    from shows import obs_client
    import os

    overlay_base = os.getenv("OVERLAY_BASE_URL", "http://localhost:3000")
    overlay_url_base = f"{overlay_base}/overlay/{session.id}"

    SCENE_KEYS = ["scoreboard", "timeline", "stats", "tactical", "player", "lower-third"]

    results = []
    for scene_key in SCENE_KEYS:
        obs_scene = obs_scene_name(scene_key)
        url = f"{overlay_url_base}?scene={scene_key}&token={session.overlay_token}"
        ok = obs_client.ensure_scene_with_browser_source(
            scene_name=obs_scene,
            source_name=f"Overlay {scene_key}",
            url=url,
        )
        results.append({
            "scene_key": scene_key,
            "obs_scene": obs_scene,
            "created_or_updated": ok,
        })

    return Response({
        "session_id": str(session.id),
        "obs_connected": obs_client.is_connected(),
        "results": results,
    })
    
   
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def match_availability(request, session_id):
    """
    Proxy to Bzzoiro's /events/{id}/availability/ for this session's match.
    Returns the availability map, so the studio can grey out seed buttons
    and warn before burning a fetch on empty data.
    """
    session = get_object_or_404(
        ShowSession.objects.select_related("match"),
        id=session_id,
        show_profile__owner=request.user,
    )
    match = session.match

    import os
    import requests as http
    import logging

    log = logging.getLogger(__name__)
    api_key = os.getenv("FOOTBALL_API_KEY")
    if not api_key:
        return Response(
            {"detail": "FOOTBALL_API_KEY not configured", "available": {}},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        r = http.get(
            f"https://sports.bzzoiro.com/api/v2/events/{match.provider_match_id}/availability/",
            headers={"Authorization": f"Token {api_key}"},
            timeout=10,
        )
        if not r.ok:
            log.warning(
                "availability %s → HTTP %s: %s",
                match.provider_match_id, r.status_code, r.text[:200],
            )
            return Response(
                {"detail": f"provider returned {r.status_code}", "available": {}},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(r.json())
    except Exception as e:
        log.warning("availability %s failed: %s", match.provider_match_id, e)
        return Response(
            {"detail": str(e), "available": {}},
            status=status.HTTP_502_BAD_GATEWAY,
        ) 
        

_LIVE_CACHE: dict[str, dict] = {}


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def live_scores(request, session_id):
    """
    Return live matches from Bzzoiro, enriched with team short names.

    Bzzoiro's /events/live/ shape (as of Nov 2026):
        { id, league_id, league_name, status, period, current_minute,
          home_team_id, home_team, away_team_id, away_team,
          home_score, away_score, home_score_ht, away_score_ht,
          event_date, live_websocket, websocket_plus, last_updated }

    Team names come through as `home_team` / `away_team` (full names, no short
    form). We derive 3-letter codes from those, or look up known short names
    from the local Match table when available.
    """
    import os
    import re
    import time
    import logging
    import requests as http

    log = logging.getLogger(__name__)

    session = get_object_or_404(
        ShowSession.objects.select_related("match"),
        id=session_id,
        show_profile__owner=request.user,
    )
    current_match_id = str(session.match.provider_match_id)

    api_key = os.getenv("FOOTBALL_API_KEY")
    if not api_key:
        return Response(
            {"detail": "FOOTBALL_API_KEY not configured", "matches": []},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Lookup: team_id -> short_name from matches already in the DB.
    from matches.models import Match
    team_short_by_id: dict[str, str] = {}
    for m in Match.objects.all().values(
        "home_team_id", "home_team_short", "away_team_id", "away_team_short",
    ):
        if m["home_team_id"] and m["home_team_short"]:
            team_short_by_id[str(m["home_team_id"])] = m["home_team_short"]
        if m["away_team_id"] and m["away_team_short"]:
            team_short_by_id[str(m["away_team_id"])] = m["away_team_short"]

    def derive_short(full_name: str) -> str:
        """Best-effort 3-letter code from a team name."""
        if not full_name:
            return ""
        # "Manchester City" -> "MC", "Paris Saint-Germain" -> "PSG",
        # "Cherno More Varna" -> "CMV", "Arsenal" -> "ARS"
        cleaned = re.sub(r"[^A-Za-z0-9 ]", "", full_name).strip()
        words = [w for w in cleaned.split() if w]
        if len(words) >= 2:
            initials = "".join(w[0] for w in words[:3]).upper()
            if len(initials) >= 2:
                return initials[:3]
        return cleaned[:3].upper()

    league_filter = request.query_params.get("league_id")
    cache_key = f"live:{league_filter or 'all'}"
    now = time.monotonic()

    cached = _LIVE_CACHE.get(cache_key)
    if cached and now - cached["ts"] < 10:
        return Response(cached["data"])

    params = {"league_id": league_filter} if league_filter else {}

    try:
        r = http.get(
            "https://sports.bzzoiro.com/api/v2/events/live/",
            headers={"Authorization": f"Token {api_key}"},
            params=params,
            timeout=10,
        )
        if not r.ok:
            log.warning("live_scores → HTTP %s: %s", r.status_code, r.text[:200])
            return Response(
                {"detail": f"provider returned {r.status_code}", "matches": []},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        raw = r.json()
        events = (
            raw.get("events")
            or raw.get("results")
            or raw.get("data")
            or (raw if isinstance(raw, list) else [])
        )

        matches = []
        for e in events or []:
            if not isinstance(e, dict):
                continue
            event_id = e.get("id") or e.get("event_id")
            if str(event_id) == current_match_id:
                continue

            # Skip matches that haven't started (they pollute the "live now" ticker)
            if e.get("status") == "notstarted":
                continue

            home_id = e.get("home_team_id")
            away_id = e.get("away_team_id")
            home_name = e.get("home_team") or e.get("home_team_name") or ""
            away_name = e.get("away_team") or e.get("away_team_name") or ""

            # Prefer known short names from DB, then derive from full name
            home_short = (
                team_short_by_id.get(str(home_id))
                or derive_short(home_name)
            )
            away_short = (
                team_short_by_id.get(str(away_id))
                or derive_short(away_name)
            )

            if not home_short or not away_short:
                continue  # can't render a legible ticker without names

            matches.append({
                "match_id": str(event_id),
                "competition": e.get("league_name") or e.get("competition") or "",
                "home_short": home_short,
                "away_short": away_short,
                "home_name": home_name,
                "away_name": away_name,
                "home_score": e.get("home_score"),
                "away_score": e.get("away_score"),
                "minute": e.get("current_minute"),
                "period": e.get("period") or e.get("status") or "",
                "status": e.get("status") or "live",
            })

        # Sort: live matches first, then by competition, then by minute desc
        def sort_key(m):
            live_rank = 0 if m["status"] == "inprogress" else 1
            return (live_rank, m["competition"] or "zzz", -(m["minute"] or 0))

        matches.sort(key=sort_key)

        data = {
            "matches": matches,
            "count": len(matches),
            "fetched_at": int(time.time()),
        }
        _LIVE_CACHE[cache_key] = {"ts": now, "data": data}
        return Response(data)

    except Exception as e:
        log.warning("live_scores failed: %s", e)
        return Response(
            {"detail": str(e), "matches": []},
            status=status.HTTP_502_BAD_GATEWAY,
        )
        