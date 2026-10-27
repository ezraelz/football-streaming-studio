from django.db import models


class Match(models.Model):
    """A normalized match reference — one row per (provider, provider_match_id)."""
    provider = models.CharField(max_length=64)
    provider_match_id = models.CharField(max_length=128)
    competition = models.CharField(max_length=128)
    provider_league_id = models.CharField(max_length=64, blank=True, default="")
    provider_league_name = models.CharField(max_length=128, blank=True, default="")
    home_team_id = models.CharField(max_length=64)
    home_team_name = models.CharField(max_length=128)
    home_team_short = models.CharField(max_length=16)
    home_team_color = models.CharField(max_length=16)
    away_team_id = models.CharField(max_length=64)
    away_team_name = models.CharField(max_length=128)
    away_team_short = models.CharField(max_length=16)
    away_team_color = models.CharField(max_length=16)
    kickoff = models.DateTimeField()
    status = models.CharField(max_length=16)  # scheduled | live | ft

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("provider", "provider_match_id")]
        indexes = [
            models.Index(fields=["provider", "provider_match_id"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.home_team_short} vs {self.away_team_short} ({self.provider_match_id})"


class MatchSnapshot(models.Model):
    """Latest known normalized state. One-to-one with Match."""
    match = models.OneToOneField(Match, on_delete=models.CASCADE, related_name="snapshot")
    score_home = models.IntegerField(default=0)
    score_away = models.IntegerField(default=0)
    period = models.CharField(max_length=16, default="NS")
    minute = models.IntegerField(default=0)
    stats = models.JSONField(default=dict)

    provider_updated_at = models.DateTimeField()   # when the provider last reported
    received_at = models.DateTimeField()           # when our system saw it

    class Meta:
        indexes = [models.Index(fields=["provider_updated_at"])]


class MatchEvent(models.Model):
    """Deduplicated event timeline. Provider ID is the natural key."""
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="events")
    provider_event_id = models.CharField(max_length=128)
    type = models.CharField(max_length=32)
    team_id = models.CharField(max_length=64)
    player_id = models.CharField(max_length=64, blank=True, null=True)
    player_name = models.CharField(max_length=128, blank=True, null=True)
    minute = models.IntegerField()
    status = models.CharField(max_length=16, default="confirmed")
    detail = models.TextField(blank=True, null=True)

    source_updated_at = models.DateTimeField()
    received_at = models.DateTimeField()

    class Meta:
        unique_together = [("match", "provider_event_id")]
        indexes = [
            models.Index(fields=["match", "minute"]),
            models.Index(fields=["match", "source_updated_at"]),
        ]
        ordering = ["minute", "id"]


class Lineup(models.Model):
    """Starting lineup / formation per team per match."""
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="lineups")
    team_id = models.CharField(max_length=64)
    formation = models.CharField(max_length=16, blank=True, default="")
    players = models.JSONField(default=list)
    source_updated_at = models.DateTimeField()

    class Meta:
        unique_together = [("match", "team_id")]