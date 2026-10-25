# backend/providers/football_data_org.py
import os
import json
from datetime import datetime, timezone
from typing import Iterable, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import requests

from .base import FootballProvider
from .schemas import Fixture, MatchSnapshot, MatchEvent, Lineup, TeamRef

class FootballDataOrgProvider(FootballProvider):
    name = "football-data-org"

    def __init__(self):
        self.api_key = os.getenv("FOOTBALL_API_KEY")
        if not self.api_key:
            raise ValueError("FOOTBALL_API_KEY not set")
        self.base_url = "https://api.football-data.org/v4"
        self.headers = {"X-Auth-Token": self.api_key}

    def _get(self, endpoint, params=None):
        resp = requests.get(f"{self.base_url}{endpoint}", headers=self.headers, params=params)
        resp.raise_for_status() # Let the caller handle errors
        return resp.json()

    def get_fixtures(self, date: Optional[str] = None) -> Iterable[Fixture]:
        # Note: You may need to filter by competition ID for your target league
        data = self._get("/matches", params={"date": date})
        fixtures = []
        for m in data.get("matches", []):
            fixtures.append(Fixture(
                id=str(m["id"]),
                competition=m["competition"]["name"],
                home=TeamRef(id=str(m["homeTeam"]["id"]), name=m["homeTeam"]["name"], 
                             short_name=m["homeTeam"]["tla"], color="#000000"), # Color not provided
                away=TeamRef(id=str(m["awayTeam"]["id"]), name=m["awayTeam"]["name"], 
                             short_name=m["awayTeam"]["tla"], color="#000000"),
                kickoff=datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00")),
                status=m["status"], # e.g., "LIVE", "FINISHED"
                coverage={"lineups": False, "events": True, "stats": False, "coordinates": False}
            ))
        return fixtures

    def get_match_snapshot(self, match_id: str) -> Optional[MatchSnapshot]:
        data = self._get(f"/matches/{match_id}")
        # Map score, minute, stats (if available in your tier)
        # Note: football-data.org free tier has limited stats. You may need to return empty dicts.
        return MatchSnapshot(
            match_id=str(data["id"]),
            competition=data["competition"]["name"],
            home=TeamRef(...), # Map home team
            away=TeamRef(...), # Map away team
            score={"home": data["score"]["fullTime"]["home"], "away": data["score"]["fullTime"]["away"]},
            period=data["status"],
            minute=data.get("minute", 0),
            status="live" if data["status"] in ("IN_PLAY", "PAUSED") else "ft",
            stats={}, # Free tier usually lacks possession/shots
            provider_updated_at=datetime.now(timezone.utc),
            received_at=datetime.now(timezone.utc),
            freshness="fresh"
        )

    def get_events_since(self, match_id: str, since=None) -> Iterable[MatchEvent]:
        # football-data.org free tier does NOT provide a play-by-play event feed (goals, cards).
        # It only provides the final score. This is a MAJOR limitation for your commentary engine.
        # You will likely need to infer "goals" by comparing score changes over time.
        return []

    def get_lineups(self, match_id: str) -> Iterable[Lineup]:
        # Lineups are typically not available on the free tier.
        return []