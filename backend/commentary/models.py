import uuid
from django.db import models


class CommentaryStatus(models.TextChoices):
    PENDING_APPROVAL = "pending_approval", "Pending approval"
    APPROVED = "approved", "Approved"
    QUEUED = "queued", "Queued"
    PLAYING = "playing", "Playing"
    PLAYED = "played", "Played"
    SKIPPED = "skipped", "Skipped"
    EXPIRED = "expired", "Expired"
    CANCELLED = "cancelled", "Cancelled"
    FAILED = "failed", "Failed"


class CommentaryMode(models.TextChoices):
    SUGGESTION = "suggestion", "Suggestion"
    AUTO = "auto", "Auto"


class CommentaryPriority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"


class CommentaryItem(models.Model):
    """A generated line for a specific event, tied to a session."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        "shows.ShowSession", on_delete=models.CASCADE, related_name="commentary_items"
    )
    trigger_event = models.ForeignKey(
        "matches.MatchEvent",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="commentary_items",
    )

    mode = models.CharField(max_length=16, choices=CommentaryMode.choices)
    status = models.CharField(
        max_length=24, choices=CommentaryStatus.choices,
        default=CommentaryStatus.PENDING_APPROVAL,
    )
    text = models.TextField()
    language = models.CharField(max_length=8, default="en")
    priority = models.CharField(
        max_length=8, choices=CommentaryPriority.choices,
        default=CommentaryPriority.NORMAL,
    )

    source_facts = models.JSONField(default=dict)
    model_version = models.CharField(max_length=64, blank=True, default="")

    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["session", "-created_at"]),
            models.Index(fields=["session", "status"]),
            models.Index(fields=["trigger_event"]),
        ]

    def __str__(self) -> str:
        return f"[{self.status}] {str(self.text)[:60]}"
    
    
class SpeechStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    SYNTHESIZED = "synthesized", "Synthesized"     # audio file ready
    PLAYED = "played", "Played"
    FAILED = "failed", "Failed"
    EXPIRED = "expired", "Expired"


class SpeechJob(models.Model):
    """A TTS synthesis + playback lifecycle for one commentary line."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    commentary_item = models.OneToOneField(
        CommentaryItem,
        on_delete=models.CASCADE,
        related_name="speech_job",
    )
    status = models.CharField(
        max_length=16, choices=SpeechStatus.choices, default=SpeechStatus.QUEUED
    )
    provider = models.CharField(max_length=64, blank=True, default="")
    audio_path = models.CharField(max_length=512, blank=True, default="")
    audio_url = models.CharField(max_length=512, blank=True, default="")
    duration_seconds = models.FloatField(null=True, blank=True)

    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    played_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
        ]