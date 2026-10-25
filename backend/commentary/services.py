import os
import concurrent.futures
from datetime import datetime, timedelta, timezone as dttz
import time

from django.db import transaction
from django.utils import timezone as djtz

from audit.models import LogKind, LogSeverity
from audit.services import log_and_broadcast
from matches.models import Match, MatchEvent
from shows.models import ShowSession

from .facts import build_fact_pack
from .llm import CommentaryGenerator, TemplateGenerator
from .models import (
    CommentaryItem, CommentaryMode, CommentaryPriority, CommentaryStatus,
)
from .serializers import CommentaryItemSerializer
from pathlib import Path
from django.conf import settings

LLM_TIMEOUT_SECONDS = 8

COOLDOWN_SECONDS: dict[str, int] = {
    "goal": 8,
    "card": 20,
    "substitution": 20,
    "half_time": 30,
    "full_time": 30,
    "default": 45,
}
LINE_EXPIRES_SECONDS = 90


def _get_generator() -> CommentaryGenerator:
    provider = os.getenv("COMMENTARY_PROVIDER", "template").lower()

    if provider == "groq":
        try:
            from .llm import GroqGenerator
            return GroqGenerator()
        except Exception:
            return TemplateGenerator()
        
    if provider == "anthropic":
        try:
            from .llm import AnthropicGenerator
            return AnthropicGenerator()
        except Exception:
            return TemplateGenerator()
    if provider == "openai":
        try:
            from .llm import OpenAIGenerator
            return OpenAIGenerator()
        except Exception:
            return TemplateGenerator()
    if provider == "ollama":
        try:
            from .llm import OllamaGenerator
            return OllamaGenerator()
        except Exception:
            return TemplateGenerator()

    return TemplateGenerator()


def _cooldown_ok(session: ShowSession, event_type: str) -> bool:
    window = COOLDOWN_SECONDS.get(event_type, COOLDOWN_SECONDS["default"])
    cutoff = djtz.now() - timedelta(seconds=window)
    return not CommentaryItem.objects.filter(
        session=session,
        created_at__gte=cutoff,
        trigger_event__type=event_type,
    ).exists()


def _is_duplicate(session: ShowSession, event: MatchEvent) -> bool:
    return CommentaryItem.objects.filter(
        session=session, trigger_event=event
    ).exists()


def _pick_priority(event_type: str) -> str:
    if event_type == "goal":
        return CommentaryPriority.HIGH
    if event_type in ("card", "substitution"):
        return CommentaryPriority.NORMAL
    return CommentaryPriority.LOW


def _generate_text(
    session: ShowSession, facts: dict, gen: CommentaryGenerator
) -> str:
    """
    Call the generator exactly once, honoring the LLM timeout and falling
    back to templates on any failure.
    """
    if not gen.name.startswith("llm:"):
        return gen.generate(facts)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        future = ex.submit(gen.generate, facts)
        try:
            return future.result(timeout=LLM_TIMEOUT_SECONDS)
        except concurrent.futures.TimeoutError:
            log_and_broadcast(
                session, LogKind.ERROR,
                f"Commentary generation timed out after {LLM_TIMEOUT_SECONDS}s",
                severity=LogSeverity.WARN,
            )
        except Exception as e:
            log_and_broadcast(
                session, LogKind.ERROR,
                f"Commentary generation failed: {type(e).__name__}",
                severity=LogSeverity.WARN,
            )

    return TemplateGenerator().generate(facts)


@transaction.atomic
def generate_for_event(
    session: ShowSession,
    event: MatchEvent,
    *,
    generator: CommentaryGenerator | None = None,
) -> CommentaryItem | None:
    if event.status != "confirmed":
        return None

    if _is_duplicate(session, event):
        return None

    if not _cooldown_ok(session, event.type):
        log_and_broadcast(
            session, LogKind.DATA,
            f"Skipped {event.type}: cooldown active",
            severity=LogSeverity.INFO,
        )
        return None

    match = event.match
    facts = build_fact_pack(match, event)
    facts["language"] = (session.show_profile.commentary_config or {}).get("language", "en")

    if facts["freshness"] != "fresh" and event.type in ("goal", "card", "substitution"):
        log_and_broadcast(
            session, LogKind.DATA,
            f"Skipped {event.type}: data is {facts['freshness']}",
            severity=LogSeverity.WARN,
        )
        return None

    gen = generator or _get_generator()
    text = _generate_text(session, facts, gen)

    profile_mode = (session.show_profile.commentary_config or {}).get("mode", "approval")
    mode = (
        CommentaryMode.AUTO if profile_mode == "auto"
        else CommentaryMode.SUGGESTION
    )

    item = CommentaryItem.objects.create(
        session=session,
        trigger_event=event,
        mode=mode,
        status=(
            CommentaryStatus.PENDING_APPROVAL if mode == CommentaryMode.SUGGESTION
            else CommentaryStatus.QUEUED
        ),
        text=text,
        language=(session.show_profile.commentary_config or {}).get("language", "en"),
        priority=_pick_priority(event.type),
        source_facts=facts,
        model_version=gen.name,
        expires_at=djtz.now() + timedelta(seconds=LINE_EXPIRES_SECONDS),
    )

    log_and_broadcast(
        session,
        LogKind.COMMENTARY,
        f"Generated [{item.model_version}]: {item.text[:70]}{'…' if len(item.text) > 70 else ''}",
        detail={
            "commentary_id": str(item.id),
            "event_id": event.provider_event_id,
            "mode": item.mode,
            "priority": item.priority,
        },
    )
    broadcast_commentary(item)
    return item


def broadcast_commentary(item: CommentaryItem) -> None:
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import session_group

    data = CommentaryItemSerializer(item).data
    data["id"] = str(data["id"])
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        session_group(str(item.session_id)),
        {"type": "commentary_event", "data": data},
    )
    

def _tts_output_path(item: CommentaryItem) -> Path:
    """Where to store the MP3 on disk."""
    media_root = Path(settings.MEDIA_ROOT)
    return media_root / "tts" / f"{item.id}.mp3"


def _tts_url(item: CommentaryItem) -> str:
    """Public URL to serve the MP3 from."""
    return f"{settings.MEDIA_URL}tts/{item.id}.mp3"


def speak_commentary(item: CommentaryItem) -> "SpeechJob | None":
    """
    Synthesize the audio for a commentary item and broadcast readiness.

    Safe to call multiple times — if a SpeechJob already exists and is
    synthesized/played, returns the existing one.
    """
    from .models import SpeechJob, SpeechStatus
    from .tts import get_tts_provider
    from audit.services import log_and_broadcast
    from audit.models import LogKind, LogSeverity
    import asyncio

    # Idempotency: don't re-synthesize the same line
    existing = getattr(item, "speech_job", None)
    if existing and existing.status in (SpeechStatus.SYNTHESIZED, SpeechStatus.PLAYED):
        return existing

    session = item.session
    profile = session.show_profile
    config = (profile.commentary_config or {})

    voice = config.get("voice", "en-US-Neural-A")
    language = item.language or config.get("language", "en")

    provider = get_tts_provider()
    out_path = _tts_output_path(item)
    out_url = _tts_url(item)

    job = existing or SpeechJob.objects.create(
        commentary_item=item,
        status=SpeechStatus.QUEUED,
        expires_at=item.expires_at,
    )

    started = time.monotonic()
    try:
        asyncio.run(provider.synthesize(
            item.text, voice=voice, language=language, out_path=out_path
        ))
    except Exception as e:
        job.status = SpeechStatus.FAILED
        job.provider = provider.name
        job.save(update_fields=["status", "provider"])
        log_and_broadcast(
            session, LogKind.ERROR,
            f"TTS failed: {type(e).__name__}: {e}",
            severity=LogSeverity.WARN,
            detail={"commentary_id": str(item.id)},
        )
        return job

    elapsed = time.monotonic() - started
    try:
        size_bytes = out_path.stat().st_size
    except FileNotFoundError:
        size_bytes = 0

    job.status = SpeechStatus.SYNTHESIZED
    job.provider = provider.name
    job.audio_path = str(out_path)
    job.audio_url = out_url
    job.duration_seconds = round(elapsed, 3)
    job.save(update_fields=["status", "provider", "audio_path", "audio_url", "duration_seconds"])

    log_and_broadcast(
        session, LogKind.COMMENTARY,
        f"TTS synthesized [{job.provider}] {size_bytes}B: {item.text[:50]}…",
        detail={
            "commentary_id": str(item.id),
            "speech_job_id": str(job.id),
            "audio_url": job.audio_url,
        },
    )
    broadcast_speech_ready(job)
    return job


def broadcast_speech_ready(job) -> None:
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import session_group

    item = job.commentary_item
    data = {
        "commentary_id": str(item.id),
        "speech_job_id": str(job.id),
        "audio_url": job.audio_url,
        "text": item.text,
        "priority": item.priority,
    }
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        session_group(str(item.session_id)),
        {"type": "speech_event", "data": data},
    )