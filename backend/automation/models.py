import uuid
from django.db import models


class AutomationRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    show_profile = models.ForeignKey(
        "shows.ShowProfile", on_delete=models.CASCADE, related_name="automation_rules"
    )
    label = models.CharField(max_length=128)
    enabled = models.BooleanField(default=True)

    # Trigger
    event_type = models.CharField(max_length=32)  # goal | card | substitution | ...
    required_status = models.CharField(
        max_length=16, blank=True, default="",
        help_text="'confirmed' to require confirmed events; blank = any status",
    )

    # Actions
    actions = models.JSONField(default=list)
    # [{"type": "show_scene", "sceneId": "scoreboard"}, ...]

    # Guards
    deduplicate_event = models.BooleanField(default=True)
    require_fresh_match_state = models.BooleanField(default=True)
    cooldown_seconds = models.PositiveIntegerField(default=8)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["show_profile", "-created_at"]),
            models.Index(fields=["show_profile", "event_type", "enabled"]),
        ]

    def __str__(self) -> str:
        return f"{self.label} ({self.event_type})"