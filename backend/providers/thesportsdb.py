# backend/providers/thesportsdb.py
import os
import requests
from datetime import datetime, timezone
from typing import Iterable, Optional

from .base import FootballProvider
from .schemas import Fixture, MatchSnapshot, MatchEvent, Lineup, TeamRef


def _team_ref(team_id: str, team_name: str) -> TeamRef:
    return TeamRef(
        id=team_id or "",
        name=team_name or "",
        short_name=(team_name or "")[:3].upper(),
        color="#27272a",
    )


def _parse_kickoff(event: dict) -> datetime:
    ts = event.get("strTimestamp")
    if ts:
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            # If no tz was attached, assume UTC
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            pass

    date = event.get("dateEvent")
    time = event.get("strTime") or "00:00:00"
    try:
        dt = datetime.fromisoformat(f"{date}T{time}")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


def _map_status(event: dict) -> str:
    """TheSportsDB uses 'strStatus' with values like 'Match Finished', 'Not Started', etc."""
    raw = (event.get("strStatus") or "").lower()
    if "not started" in raw or raw == "":
        return "scheduled"
    if "finished" in raw or "ft" in raw:
        return "ft"
    if "live" in raw or "in play" in raw or "1h" in raw or "2h" in raw or "ht" in raw:
        return "live"
    return "scheduled"


class TheSportsDBProvider(FootballProvider):
    name = "thesportsdb"

    def __init__(self):
        self.api_key = os.getenv("FOOTBALL_API_KEY", "123")
        self.base_url = f"https://www.thesportsdb.com/api/v1/json/{self.api_key}"

    def _get(self, endpoint: str, params: Optional[dict] = None) -> dict:
        resp = requests.get(f"{self.base_url}/{endpoint}", params=params, timeout=15)
        resp.raise_for_status()
        return resp.json() or {}

    # --- Interface methods ---

    def get_fixtures(self, date: Optional[str] = None) -> Iterable[Fixture]:
        date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        data = self._get("eventsday.php", params={"d": date, "s": "Soccer"})
        fixtures = []
        for ev in data.get("events") or []:
            fixtures.append(Fixture(
                id=str(ev["idEvent"]),
                competition=ev.get("strLeague") or "Unknown",
                home=_team_ref(ev.get("idHomeTeam"), ev.get("strHomeTeam")),
                away=_team_ref(ev.get("idAwayTeam"), ev.get("strAwayTeam")),
                kickoff=_parse_kickoff(ev),
                status=_map_status(ev),
                coverage={
                    "lineups": False,
                    "events": False,   # free tier has no per-event feed
                    "stats": False,
                    "coordinates": False,
                },
            ))
        return fixtures

    def get_match_snapshot(self, match_id: str) -> Optional[MatchSnapshot]:
        data = self._get("lookupevent.php", params={"id": match_id})
        events = data.get("events") or []
        if not events:
            return None
        ev = events[0]
        now = datetime.now(timezone.utc)
        return MatchSnapshot(
            match_id=str(ev["idEvent"]),
            competition=ev.get("strLeague") or "Unknown",
            home=_team_ref(ev.get("idHomeTeam"), ev.get("strHomeTeam")),
            away=_team_ref(ev.get("idAwayTeam"), ev.get("strAwayTeam")),
            score={
                "home": int(ev.get("intHomeScore") or 0),
                "away": int(ev.get("intAwayScore") or 0),
            },
            period="2H" if _map_status(ev) == "live" else ("FT" if _map_status(ev) == "ft" else "NS"),
            minute=0,  # free tier: no live minute
            status=_map_status(ev),
            stats={},  # free tier: no stats
            provider_updated_at=now,
            received_at=now,
            freshness="fresh",
        )

    def get_events_since(self, match_id: str, since=None) -> Iterable[MatchEvent]:
        """Free tier has no per-event feed. Returns empty."""
        return []

    def get_lineups(self, match_id: str) -> Iterable[Lineup]:
        """Free tier has no lineups. Returns empty."""
        return []