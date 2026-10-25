import uuid
from django.db import models


class LogKind(models.TextChoices):
    DATA = "data", "Data"
    COMMENTARY = "commentary", "Commentary"
    SCENE = "scene", "Scene"
    OVERRIDE = "override", "Override"
    ERROR = "error", "Error"
    AUTOMATION = "automation", "Automation"


class LogSeverity(models.TextChoices):
    INFO = "info", "Info"
    WARN = "warn", "Warn"
    ERROR = "error", "Error"


class ShowLogEntry(models.Model):
    """One line of the durable audit trail for a show session."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        "shows.ShowSession",
        on_delete=models.CASCADE,
        related_name="log_entries",
    )
    kind = models.CharField(max_length=16, choices=LogKind.choices)
    severity = models.CharField(
        max_length=8, choices=LogSeverity.choices, default=LogSeverity.INFO
    )
    message = models.TextField()
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["session", "-created_at"]),
            models.Index(fields=["session", "kind"]),
        ]

    def __str__(self) -> str:
        return f"[{self.kind}] {str(self.message)[:60]}"