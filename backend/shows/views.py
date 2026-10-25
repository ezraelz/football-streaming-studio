from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from matches.models import Match

from .models import ShowProfile, ShowSession
from .services import (
    create_session, transition, rotate_token, InvalidTransition,
)
from .serializers import (
    ShowProfileSerializer, ShowProfileCreateSerializer,
    ShowSessionSerializer, CreateShowSessionSerializer,
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

    from automation.services import broadcast_scene_command
    from audit.services import log_and_broadcast
    from audit.models import LogKind

    broadcast_scene_command(session, scene_id, rule_id=None)
    log_and_broadcast(
        session, LogKind.SCENE,
        f"Scene → {scene_id}",
        detail={"source": "manual"},
    )
    return Response({"scene_id": scene_id})

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
    