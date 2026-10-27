from abc import ABC, abstractmethod
from datetime import datetime
from typing import Iterable, Optional

from .schemas import Fixture, MatchSnapshot, MatchEvent, Lineup, HeadToHead, TeamFixture


class ProviderError(Exception):
    """Raised when a provider call fails in a way callers must handle."""


class FootballProvider(ABC):
    """
    Contract every provider adapter implements.

    Implementations MUST:
      - Translate their wire format into the schemas in providers.schemas.
      - Use provider IDs for stable de-duplication (event_id, match_id).
      - Never raise on empty data; return [] or None.
      - Raise ProviderError only for transport/parse failures.
    """

    name: str = "base"

    @abstractmethod
    def get_fixtures(self, date: Optional[str] = None) -> Iterable[Fixture]:
        """Return fixtures for a given ISO date, or the live/upcoming set."""

    @abstractmethod
    def get_match_snapshot(self, match_id: str) -> Optional[MatchSnapshot]:
        """Return the latest normalized state for a match, or None if unknown."""

    @abstractmethod
    def get_events_since(
        self, match_id: str, since: Optional[datetime] = None
    ) -> Iterable[MatchEvent]:
        """Return confirmed events newer than `since` (or all, if None)."""

    @abstractmethod
    def get_lineups(self, match_id: str) -> Iterable[Lineup]:
        """Return available lineups. Empty list is valid."""
        
    @abstractmethod
    def get_head_to_head(self, team_a: str, team_b: str, limit: int = 10) -> Iterable[HeadToHead]:
        """Return past meetings between the two teams, newest first."""

    @abstractmethod
    def get_upcoming_fixtures(self, team_id: str, limit: int = 5) -> Iterable[TeamFixture]:
        """Return upcoming fixtures for a given team."""