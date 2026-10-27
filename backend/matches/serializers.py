from rest_framework import serializers
from providers.schemas import (
    Fixture, MatchSnapshot, MatchEvent, Lineup, TeamRef,
    MatchEvent as MatchEventDTO,
    Lineup as LineupDTO,
)

from .models import Match, MatchSnapshot as MatchSnapshotModel, MatchEvent as MatchEventModel, Lineup as LineupModel

def match_model_to_fixture_dto(m) -> Fixture:
    return Fixture(
        id=m.provider_match_id,
        competition=m.competition,
        home=TeamRef(
            id=m.home_team_id, name=m.home_team_name,
            short_name=m.home_team_short, color=m.home_team_color,
        ),
        away=TeamRef(
            id=m.away_team_id, name=m.away_team_name,
            short_name=m.away_team_short, color=m.away_team_color,
        ),
        kickoff=m.kickoff,
        status=m.status,
        coverage={"lineups": True, "events": True, "stats": True, "coordinates": False},
    )


def snapshot_model_to_dto(s) -> MatchSnapshot:
    m = s.match
    return MatchSnapshot(
        match_id=m.provider_match_id,
        competition=m.competition,
        home=TeamRef(
            id=m.home_team_id, name=m.home_team_name,
            short_name=m.home_team_short, color=m.home_team_color,
        ),
        away=TeamRef(
            id=m.away_team_id, name=m.away_team_name,
            short_name=m.away_team_short, color=m.away_team_color,
        ),
        score={"home": s.score_home, "away": s.score_away},
        period=s.period,
        minute=s.minute,
        status=m.status,
        stats=s.stats,
        provider_updated_at=s.provider_updated_at,
        received_at=s.received_at,
        freshness="fresh",  # caller overrides with computed freshness
    )


def event_model_to_dto(e: MatchEvent) -> MatchEventDTO:
    return MatchEventDTO(
        event_id=e.provider_event_id,
        match_id=e.match.provider_match_id,
        type=e.type,
        team_id=e.team_id,
        player_id=e.player_id,
        player_name=e.player_name,
        minute=e.minute,
        status=e.status,
        source_updated_at=e.source_updated_at,
        received_at=e.received_at,
        detail=e.detail,
    )


def lineup_model_to_dto(l: Lineup) -> LineupDTO:
    return LineupDTO(
        match_id=l.match.provider_match_id,
        team_id=l.team_id,
        formation=l.formation,
        players=l.players,
        source_updated_at=l.source_updated_at,
    )

class TeamRefSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    shortName = serializers.CharField(source="short_name")
    color = serializers.CharField()
    crestUrl = serializers.CharField(source="crest_url", allow_null=True, required=False)


class FixtureSerializer(serializers.Serializer):
    id = serializers.CharField()
    competition = serializers.CharField()
    leagueId = serializers.CharField(source="league_id", required=False, default="")
    home = TeamRefSerializer()
    away = TeamRefSerializer()
    kickoff = serializers.DateTimeField()
    status = serializers.CharField()
    coverage = serializers.DictField()
    
class MatchSnapshotSerializer(serializers.Serializer):
    matchId = serializers.CharField(source="match_id")
    competition = serializers.CharField()
    home = TeamRefSerializer()
    away = TeamRefSerializer()
    score = serializers.DictField()
    period = serializers.CharField()
    minute = serializers.IntegerField()
    status = serializers.CharField()
    stats = serializers.DictField()
    providerUpdatedAt = serializers.DateTimeField(source="provider_updated_at")
    receivedAt = serializers.DateTimeField(source="received_at")
    freshness = serializers.CharField()


class MatchEventSerializer(serializers.Serializer):
    eventId = serializers.CharField(source="event_id")
    matchId = serializers.CharField(source="match_id")
    type = serializers.CharField()
    teamId = serializers.CharField(source="team_id")
    playerId = serializers.CharField(source="player_id", allow_null=True)
    playerName = serializers.CharField(source="player_name", allow_null=True)
    minute = serializers.IntegerField()
    status = serializers.CharField()
    sourceUpdatedAt = serializers.DateTimeField(source="source_updated_at")
    receivedAt = serializers.DateTimeField(source="received_at")
    detail = serializers.CharField(allow_null=True, required=False)


class LineupSerializer(serializers.Serializer):
    matchId = serializers.CharField(source="match_id")
    teamId = serializers.CharField(source="team_id")
    formation = serializers.CharField()
    players = serializers.ListField(child=serializers.DictField())
    sourceUpdatedAt = serializers.DateTimeField(source="source_updated_at")