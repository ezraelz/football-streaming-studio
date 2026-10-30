import logging
from datetime import timedelta

from django.utils import timezone as djtz

from audit.models import LogKind, LogSeverity
from audit.services import log_and_broadcast

from .models import CommentaryItem, CommentaryStatus, SpeechJob, SpeechStatus
from .tts import get_provider
import os

LINE_EXPIRY_SECONDS = 90
log = logging.getLogger(__name__)


def synthesize_for_commentary(commentary: CommentaryItem) -> SpeechJob | None:
    """
    Create + run a TTS job for a commentary item.
    Returns the SpeechJob (in whatever terminal state) or None if skipped.
    """
    if not commentary.session_id:
        return None

    # Guards: only speak a line that's about to play
    if commentary.status not in (
        CommentaryStatus.QUEUED, CommentaryStatus.PLAYING,
    ):
        return None

    # Dedup: don't synthesize twice
    if SpeechJob.objects.filter(commentary=commentary).exists():
        return SpeechJob.objects.get(commentary=commentary)

    voice = (
        (commentary.session.show_profile.commentary_config or {}).get("voice")
        or ""
    )
    language = commentary.language or "en"

    job = SpeechJob.objects.create(
        commentary=commentary,
        provider=os.getenv("TTS_PROVIDER", "azure"),
        voice=voice,
        language=language,
        status=SpeechStatus.SYNTHESIZING,
        started_at=djtz.now(),
        expires_at=djtz.now() + timedelta(seconds=LINE_EXPIRY_SECONDS),
    )

    try:
        provider = get_provider()
        audio_path, duration_ms = provider.synthesize(
            commentary.text, voice=voice, language=language,
        )
        job.audio_path = str(audio_path)
        job.duration_ms = duration_ms
        job.status = SpeechStatus.READY
        job.save(update_fields=["audio_path", "duration_ms", "status"])

        log_and_broadcast(
            commentary.session, LogKind.COMMENTARY,
            f"TTS ready ({duration_ms}ms): {commentary.text[:60]}…",
            detail={"speech_job_id": str(job.id)},
        )
        broadcast_speech_update(job)
        return job

    except Exception as e:
        job.status = SpeechStatus.FAILED
        job.error = str(e)[:500]
        job.save(update_fields=["status", "error"])
        log_and_broadcast(
            commentary.session, LogKind.ERROR,
            f"TTS failed: {type(e).__name__}: {str(e)[:120]}",
            severity=LogSeverity.WARN,
        )
        return job


def broadcast_speech_update(job: SpeechJob) -> None:
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import session_group

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        session_group(str(job.commentary.session_id)),
        {
            "type": "speech_event",
            "data": {
                "id": str(job.id),
                "commentary_id": str(job.commentary_id),
                "status": job.status,
                "audio_url": f"/api/v1/speech/{job.id}/audio/",
                "duration_ms": job.duration_ms,
                "expires_at": job.expires_at.isoformat() if job.expires_at else None,
            },
        },
    )


def mark_played(job: SpeechJob) -> None:
    if job.status in (SpeechStatus.READY, SpeechStatus.PLAYING):
        job.status = SpeechStatus.PLAYED
        job.played_at = djtz.now()
        job.save(update_fields=["status", "played_at"])

        # Also mark the commentary as played
        c = job.commentary
        if c.status in (CommentaryStatus.QUEUED, CommentaryStatus.PLAYING):
            c.status = CommentaryStatus.PLAYED
            c.save(update_fields=["status", "updated_at"])