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
        if data and data.get("lineups"):
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
            }
            title = f"Lineups · {match.home_team_short} vs {match.away_team_short}"
        else:
            payload = {
                "home": {"formation": "TBD", "players": []},
                "away": {"formation": "TBD", "players": []},
            }
            title = f"Lineups · {match.home_team_short} vs {match.away_team_short} (manual)"

    # --- standings ---
    elif card_type == "standings":
        league_id = getattr(match, "provider_league_id", "") or ""
        rows: list[dict] = []

        if league_id:
            data = bsd_get(
                f"/leagues/{league_id}/standings/",
                params={"season_id": season_year},
            )
            if data:
                # BSD standings shape varies: try common keys
                table = data.get("standings") or data.get("table") or data.get("results") or []
                if isinstance(table, list):
                    for row in table:
                        if not isinstance(row, dict):
                            continue
                        rows.append({
                            "position": row.get("position") or row.get("rank") or 0,
                            "team": row.get("team_name") or row.get("team") or "",
                            "played": row.get("played") or row.get("matches") or 0,
                            "points": row.get("points") or 0,
                        })

        payload = {
            "competition": base["competition"],
            "rows": rows,
        }
        title = f"{base['competition']} Standings"

    # --- top_scorers ---
    elif card_type == "top_scorers":
        league_id = getattr(match, "provider_league_id", "") or ""
        players: list[dict] = []

        if league_id:
            data = bsd_get(
                f"/leagues/{league_id}/topscorers/",
                params={"season_id": season_year},
            )
            if data:
                scorers = data.get("scorers") or data.get("results") or []
                if isinstance(scorers, list):
                    for s in scorers[:10]:
                        if not isinstance(s, dict):
                            continue
                        players.append({
                            "name": s.get("player_name") or s.get("name") or "",
                            "team": s.get("team_name") or s.get("team") or "",
                            "goals": s.get("goals") or 0,
                        })

        payload = {
            "competition": base["competition"],
            "players": players,
        }
        title = f"{base['competition']} Top Scorers"

    # --- head_to_head ---
    elif card_type == "head_to_head":
        payload = {"meetings": []}
        title = f"H2H · {match.home_team_short} vs {match.away_team_short}"

    # --- form ---
    elif card_type == "form":
        payload = {
            "team": base["home"]["name"],
            "results": [],
        }
        title = f"Recent form · {base['home']['name']}"

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
    
    