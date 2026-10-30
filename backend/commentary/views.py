from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from audit.models import LogKind
from audit.services import log_and_broadcast
from .services import broadcast_commentary
from shows.models import ShowSession

from .models import CommentaryItem, CommentaryStatus, SpeechJob, SpeechStatus
from .serializers import CommentaryItemSerializer
from django.http import FileResponse
import os

def _own_session(user, session_id):
    return ShowSession.objects.get(
        id=session_id, show_profile__owner=user,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_for_session(request, session_id):
    session = get_object_or_404(
        ShowSession, id=session_id, show_profile__owner=request.user
    )
    qs = session.commentary_items.all()
    if status_filter := request.query_params.get("status"):
        qs = qs.filter(status=status_filter)
    return Response(CommentaryItemSerializer(qs[:200], many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve(request, item_id):
    item = get_object_or_404(
        CommentaryItem, id=item_id, session__show_profile__owner=request.user
    )
    if item.status not in (
        CommentaryStatus.PENDING_APPROVAL, CommentaryStatus.SKIPPED,
    ):
        return Response(
            {"detail": f"Cannot approve item in status {item.status}"},
            status=status.HTTP_409_CONFLICT,
        )
    item.status = CommentaryStatus.QUEUED
    item.save(update_fields=["status", "updated_at"])
    log_and_broadcast(
        item.session, LogKind.COMMENTARY,
        f"Approved: {item.text[:60]}…",
        detail={"commentary_id": str(item.id)},
    )
    from .services import broadcast_commentary
    broadcast_commentary(item)
    return Response(CommentaryItemSerializer(item).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def skip(request, item_id):
    item = get_object_or_404(
        CommentaryItem, id=item_id, session__show_profile__owner=request.user
    )
    if item.status not in (
        CommentaryStatus.PENDING_APPROVAL, CommentaryStatus.QUEUED,
    ):
        return Response(
            {"detail": f"Cannot skip item in status {item.status}"},
            status=status.HTTP_409_CONFLICT,
        )
    item.status = CommentaryStatus.SKIPPED
    item.save(update_fields=["status", "updated_at"])
    log_and_broadcast(
        item.session, LogKind.OVERRIDE,
        "Operator skipped suggested line",
        detail={"commentary_id": str(item.id)},
    )
    from .services import broadcast_commentary
    broadcast_commentary(item)
    return Response(CommentaryItemSerializer(item).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def regenerate(request, item_id):
    item = get_object_or_404(
        CommentaryItem, id=item_id, session__show_profile__owner=request.user
    )
    if not item.trigger_event_id:
        return Response(
            {"detail": "No trigger event to regenerate from"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    from .services import generate_for_event
    # Delete the old one first so dedup lets it regenerate
    item.delete()
    new_item = generate_for_event(item.session, item.trigger_event)
    if not new_item:
        return Response(
            {"detail": "Regeneration skipped by guards"},
            status=status.HTTP_409_CONFLICT,
        )
    return Response(CommentaryItemSerializer(new_item).data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def speak(request, item_id):
    item = get_object_or_404(
        CommentaryItem, id=item_id, session__show_profile__owner=request.user
    )
    if item.status not in (CommentaryStatus.QUEUED, CommentaryStatus.PENDING_APPROVAL):
        return Response(
            {"detail": f"Cannot speak item in status {item.status}"},
            status=status.HTTP_409_CONFLICT,
        )
    from .services import speak_commentary
    job = speak_commentary(item)
    from .serializers import SpeechJobSerializer
    return Response(SpeechJobSerializer(job).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_played(request, item_id):
    item = get_object_or_404(
        CommentaryItem, id=item_id, session__show_profile__owner=request.user
    )
    from django.utils import timezone as djtz
    item.status = CommentaryStatus.PLAYED
    item.save(update_fields=["status", "updated_at"])
    job = getattr(item, "speech_job", None)
    if job:
        from .models import SpeechStatus
        job.status = SpeechStatus.PLAYED
        job.played_at = djtz.now()
        job.save(update_fields=["status", "played_at"])
    from audit.services import log_and_broadcast
    from audit.models import LogKind
    log_and_broadcast(
        item.session, LogKind.COMMENTARY,
        f"Played: {item.text[:60]}…",
        detail={"commentary_id": str(item.id)},
    )
    return Response({"status": "played"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def approve(request, item_id):
    item = get_object_or_404(
        CommentaryItem, id=item_id, session__show_profile__owner=request.user
    )
    if item.status not in (CommentaryStatus.PENDING_APPROVAL, CommentaryStatus.SKIPPED):
        return Response({"detail": f"Cannot approve item in status {item.status}"}, status=409)

    item.status = CommentaryStatus.QUEUED
    item.save(update_fields=["status", "updated_at"])

    log_and_broadcast(item.session, LogKind.COMMENTARY, f"Approved: {item.text[:60]}…", detail={"commentary_id": str(item.id)})
    broadcast_commentary(item)

    # Kick off TTS in a background thread so the approve endpoint returns fast
    import threading
    def _tts():
        from .speech_services import synthesize_for_commentary
        synthesize_for_commentary(item)
    threading.Thread(target=_tts, daemon=True).start()

    return Response(CommentaryItemSerializer(item).data)



@api_view(["GET"])
@permission_classes([AllowAny])  # token-scoped via job ID
def serve_speech(request, job_id):
    """Serve the TTS audio for a job. Public — the job UUID is the credential."""
    try:
        job = SpeechJob.objects.get(id=job_id, status=SpeechStatus.READY)
    except SpeechJob.DoesNotExist:
        return Response({"detail": "not found"}, status=404)

    path = job.audio_path
    if not path or not os.path.exists(path):
        return Response({"detail": "audio file missing"}, status=404)

    # Serve with a cache-friendly content type
    media_type = "audio/mpeg"
    if path.endswith(".wav"):
        media_type = "audio/wav"
    return FileResponse(open(path, "rb"), content_type=media_type)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_speech_played(request, job_id):
    job = get_object_or_404(
        SpeechJob, id=job_id, commentary__session__show_profile__owner=request.user
    )
    from .speech_services import mark_played
    mark_played(job)
    return Response({"status": job.status})
