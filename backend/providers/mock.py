from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from .base import FootballProvider
from .schemas import Fixture, MatchSnapshot, MatchEvent, Lineup, TeamRef, utcnow


def _mins_ago(m: float) -> datetime:
    return utcnow() - timedelta(minutes=m)


def _mins_from_now(m: float) -> datetime:
    return utcnow() + timedelta(minutes=m)


ARS = TeamRef(id="ars", name="Arsenal", short_name="ARS", color="#EF0107")
CHE = TeamRef(id="che", name="Chelsea", short_name="CHE", color="#034694")
RMA = TeamRef(id="rma", name="Real Madrid", short_name="RMA", color="#FFFFFF")
BAR = TeamRef(id="bar", name="Barcelona", short_name="BAR", color="#A50044")
INT = TeamRef(id="int", name="Inter", short_name="INT", color="#0068A8")
MIL = TeamRef(id="mil", name="AC Milan", short_name="MIL", color="#FB090B")


class MockProvider(FootballProvider):
    """Static data mirroring the frontend mock fixtures."""

    name = "mock"

    def __init__(self) -> None:
        self._fixtures: dict[str, Fixture] = {
            "match-001": Fixture(
                id="match-001",
                competition="Premier League",
                home=ARS,
                away=CHE,
                kickoff=_mins_from_now(15),
                status="live",
                coverage={"lineups": True, "events": True, "stats": True, "coordinates": False},
            ),
            "match-002": Fixture(
                id="match-002",
                competition="La Liga",
                home=RMA,
                away=BAR,
                kickoff=_mins_ago(120),
                status="ft",
                coverage={"lineups": True, "events": True, "stats": True, "coordinates": True},
            ),
            "match-003": Fixture(
                id="match-003",
                competition="Serie A",
                home=INT,
                away=MIL,
                kickoff=_mins_ago(1440),
                status="scheduled",
                coverage={"lineups": False, "events": False, "stats": False, "coordinates": False},
            ),
        }

        self._events: dict[str, list[MatchEvent]] = {
            "match-001": [
                MatchEvent(
                    event_id="ev-1",
                    match_id="match-001",
                    type="goal",
                    team_id="ars",
                    player_id="p-saka",
                    player_name="Saka",
                    minute=23,
                    status="confirmed",
                    source_updated_at=_mins_ago(44),
                    received_at=_mins_ago(44),
                ),
                MatchEvent(
                    event_id="ev-2",
                    match_id="match-001",
                    type="card",
                    team_id="che",
                    player_id="p-caicedo",
                    player_name="Caicedo",
                    minute=41,
                    status="confirmed",
                    source_updated_at=_mins_ago(26),
                    received_at=_mins_ago(26),
                ),
                MatchEvent(
                    event_id="ev-3",
                    match_id="match-001",
                    type="goal",
                    team_id="che",
                    player_id="p-palmer",
                    player_name="Palmer",
                    minute=52,
                    status="confirmed",
                    source_updated_at=_mins_ago(15),
                    received_at=_mins_ago(15),
                ),
                MatchEvent(
                    event_id="ev-4",
                    match_id="match-001",
                    type="goal",
                    team_id="ars",
                    player_id="p-havertz",
                    player_name="Havertz",
                    minute=67,
                    status="confirmed",
                    source_updated_at=_mins_ago(0),
                    received_at=_mins_ago(0),
                ),
            ],
            "match-002": [],
            "match-003": [],
        }

    # --- Interface ---

    def get_fixtures(self, date: Optional[str] = None) -> Iterable[Fixture]:
        return list(self._fixtures.values())

    def get_match_snapshot(self, match_id: str) -> Optional[MatchSnapshot]:
        fixture = self._fixtures.get(match_id)
        if not fixture:
            return None

        if match_id == "match-001":
            return MatchSnapshot(
                match_id="match-001",
                competition=fixture.competition,
                home=fixture.home,
                away=fixture.away,
                score={"home": 2, "away": 1},
                period="2H",
                minute=67,
                status="live",
                stats={
                    "possession":     {"home": 58, "away": 42},
                    "shots":          {"home": 11, "away": 7},
                    "shotsOnTarget":  {"home": 5,  "away": 3},
                    "corners":        {"home": 6,  "away": 2},
                    "fouls":          {"home": 8,  "away": 12},
                },
                provider_updated_at=utcnow(),
                received_at=utcnow(),
                freshness="fresh",
            )

        # FT / scheduled: minimal snapshot
        return MatchSnapshot(
            match_id=match_id,
            competition=fixture.competition,
            home=fixture.home,
            away=fixture.away,
            score={"home": 0, "away": 0},
            period="FT" if fixture.status == "ft" else "NS",
            minute=90 if fixture.status == "ft" else 0,
            status=fixture.status,
            stats={},
            provider_updated_at=utcnow(),
            received_at=utcnow(),
            freshness="fresh",
        )

    def get_events_since(
        self, match_id: str, since: Optional[datetime] = None
    ) -> Iterable[MatchEvent]:
        events = self._events.get(match_id, [])
        if since is None:
            return list(events)
        return [e for e in events if e.source_updated_at > since]

    def get_lineups(self, match_id: str) -> Iterable[Lineup]:
        if match_id != "match-001":
            return []
        now = utcnow()
        return [
            Lineup(
                match_id="match-001",
                team_id="ars",
                formation="4-3-3",
                players=[
                    {"id": "ars-gk", "name": "Raya",     "position": "GK", "x": 10, "y": 50},
                    {"id": "ars-lb", "name": "Timber",   "position": "LB", "x": 30, "y": 20},
                    {"id": "ars-cb1","name": "Saliba",   "position": "CB", "x": 28, "y": 40},
                    {"id": "ars-cb2","name": "Gabriel",  "position": "CB", "x": 28, "y": 60},
                    {"id": "ars-rb", "name": "White",    "position": "RB", "x": 30, "y": 80},
                    {"id": "ars-cm1","name": "Rice",     "position": "CM", "x": 48, "y": 35},
                    {"id": "ars-cm2","name": "Ødegaard", "position": "CM", "x": 48, "y": 65},
                    {"id": "ars-am", "name": "Havertz",  "position": "AM", "x": 62, "y": 50},
                    {"id": "ars-lw", "name": "Martinelli","position": "LW", "x": 75, "y": 20},
                    {"id": "ars-st", "name": "Jesus",    "position": "ST", "x": 82, "y": 50},
                    {"id": "ars-rw", "name": "Saka",     "position": "RW", "x": 75, "y": 80},
                ],
                source_updated_at=now,
            ),
            Lineup(
                match_id="match-001",
                team_id="che",
                formation="4-2-3-1",
                players=[
                    {"id": "che-gk", "name": "Sanchez",  "position": "GK", "x": 90, "y": 50},
                    {"id": "che-lb", "name": "Cucurella", "position": "LB", "x": 70, "y": 20},
                    {"id": "che-cb1","name": "Colwill",   "position": "CB", "x": 72, "y": 40},
                    {"id": "che-cb2","name": "Fofana",    "position": "CB", "x": 72, "y": 60},
                    {"id": "che-rb", "name": "James",     "position": "RB", "x": 70, "y": 80},
                    {"id": "che-dm1","name": "Caicedo",   "position": "DM", "x": 55, "y": 40},
                    {"id": "che-dm2","name": "Fernández", "position": "DM", "x": 55, "y": 60},
                    {"id": "che-lw", "name": "Sterling",  "position": "LW", "x": 40, "y": 20},
                    {"id": "che-am", "name": "Palmer",    "position": "AM", "x": 40, "y": 50},
                    {"id": "che-rw", "name": "Madueke",   "position": "RW", "x": 40, "y": 80},
                    {"id": "che-st", "name": "Jackson",   "position": "ST", "x": 25, "y": 50},
                ],
                source_updated_at=now,
            ),
        ]