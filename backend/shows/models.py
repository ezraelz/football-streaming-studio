import uuid
from django.conf import settings
from django.db import models


class ShowProfile(models.Model):
    """Reusable settings a session inherits."""
    MODE_CHOICES = [("human", "Human"), ("automated", "Automated")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="show_profiles"
    )
    name = models.CharField(max_length=128)
    mode = models.CharField(max_length=16, choices=MODE_CHOICES, default="human")
    theme_config = models.JSONField(default=dict)
    commentary_config = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["owner", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.mode})"


class ShowSession(models.Model):
    """One live production session — the state machine lives here."""
    STATE_CHOICES = [
        ("configured", "Configured"),
        ("armed", "Armed"),
        ("live", "Live"),
        ("paused", "Paused"),
        ("degraded", "Degraded"),
        ("stopped", "Stopped"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    show_profile = models.ForeignKey(
        ShowProfile, on_delete=models.CASCADE, related_name="sessions"
    )
    match = models.ForeignKey(
        "matches.Match", on_delete=models.PROTECT, related_name="sessions"
    )
    mode = models.CharField(max_length=16, choices=ShowProfile.MODE_CHOICES)
    state = models.CharField(max_length=16, choices=STATE_CHOICES, default="configured")

    started_at = models.DateTimeField(null=True, blank=True)
    stopped_at = models.DateTimeField(null=True, blank=True)

    overlay_token = models.CharField(max_length=64, unique=True, db_index=True)

    operator_overrides = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["state"]),
            models.Index(fields=["match", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.show_profile.name} @ {self.match.provider_match_id} [{self.state}]"
    
    
class EditorialCard(models.Model):
    """A manually-authored scene payload for pre/post match segments."""
    CARD_TYPES = [
        ("fixture_intro", "Fixture intro"),
        ("lineups", "Lineups"),
        ("standings", "Standings"),
        ("form", "Recent form"),
        ("head_to_head", "Head to head"),
        ("top_scorers", "Top scorers"),
        ("match_summary", "Match summary"),
        ("countdown", "Countdown"),
        ("custom", "Custom"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        "shows.ShowSession", on_delete=models.CASCADE, related_name="editorial_cards"
    )
    card_type = models.CharField(max_length=32, choices=CARD_TYPES)
    title = models.CharField(max_length=128)
    payload = models.JSONField(default=dict)  # shape varies by card_type
    visible = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        