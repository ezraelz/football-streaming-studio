from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class TeamRef:
    id: str
    name: str
    short_name: str
    color: str
    crest_url: Optional[str] = None


@dataclass
class Fixture:
    id: str
    competition: str
    home: TeamRef
    away: TeamRef
    kickoff: datetime
    status: str  # "scheduled" | "live" | "ft"
    coverage: dict = field(default_factory=dict)


@dataclass
class MatchSnapshot:
    match_id: str
    competition: str
    home: TeamRef
    away: TeamRef
    score: dict  # {"home": int, "away": int}
    period: str
    minute: int
    status: str
    stats: dict  # {"possession": {"home": 58, "away": 42}, ...}
    provider_updated_at: datetime
    received_at: datetime
    freshness: str  # "fresh" | "stale" | "disconnected"


@dataclass
class MatchEvent:
    event_id: str
    match_id: str
    type: str  # "goal" | "card" | "substitution" | "shot" | "other"
    team_id: str
    player_id: Optional[str]
    player_name: Optional[str]
    minute: int
    status: str  # "confirmed" | "provisional" | "corrected"
    source_updated_at: datetime
    received_at: datetime
    detail: Optional[str] = None


@dataclass
class Lineup:
    match_id: str
    team_id: str
    formation: str
    players: list  # list of {"id": str, "name": str, "position": str, "x": float, "y": float}
    source_updated_at: datetime