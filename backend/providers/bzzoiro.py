"""
Bzzoiro Sports Data (BSD) provider adapter — v2 API.

Docs: https://sports.bzzoiro.com/docs/football/
Base: https://sports.bzzoiro.com/api/v2/
Auth: Authorization: Token <key>
Free: football REST API (no card, 10 req/s)
"""
import os
import re
import unicodedata
from datetime import datetime, timezone
from typing import Iterable, Optional

import requests

from .base import FootballProvider, ProviderError
from .schemas import Fixture, MatchSnapshot, MatchEvent, Lineup, TeamRef
from .helpers import TEAM_COLORS

BASE = "https://sports.bzzoiro.com/api/v2"

# --- League name map (BSD has league_id, not league name) ---
# Populate this as you encounter leagues. Unknown leagues fall back
# to "League #{id}" so the UI still groups them.
LEAGUE_NAMES: dict[int, str] = {
    80: "Categoría Primera A",
    # add more as you discover them
}


def _slug(name: str) -> str:
    """ASCII-safe slug for crest file lookup."""
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _normalize_team_name(name: str) -> str:
    """Strip common suffixes for color-map lookup."""
    for suffix in (" FC", " SC", " AFC", " CF", " CD", " AC"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    return name.strip()


def _team_color(name: str) -> str:
    if not name:
        return "#27272a"
    if name in TEAM_COLORS:
        return TEAM_COLORS[name]
    normalized = _normalize_team_name(name)
    if normalized in TEAM_COLORS:
        return TEAM_COLORS[normalized]
    # Case-insensitive fallback
    lower = name.lower()
    for key, color in TEAM_COLORS.items():
        if key.lower() == lower:
            return color
    return "#27272a"


def _team_from_event(ev: dict, side: str) -> TeamRef:
    """
    BSD returns flat fields: `home_team`, `home_team_id`, `away_team`, `away_team_id`.
    """
    name = ev.get(f"{side}_team") or ""
    team_id = ev.get(f"{side}_team_id") or ""
    slug = _slug(name)
    return TeamRef(
        id=str(team_id),
        name=name,
        short_name=name[:3].upper() if name else "",
        color=_team_color(name),
        crest_url=f"/static/crests/teams/{slug}.png" if slug else None,
    )


def _parse_dt(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


class BzzoiroProvider(FootballProvider):
    name = "bzzoiro"

    def __init__(self):
        self.api_key = os.getenv("FOOTBALL_API_KEY")
        if not self.api_key:
            raise ProviderError("FOOTBALL_API_KEY not set for bzzoiro provider")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Token {self.api_key}",
            "Accept": "application/json",
        })
        self._league_cache: dict[int, str] = dict(LEAGUE_NAMES)

    # --- HTTP ---

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        try:
            r = self.session.get(f"{BASE}{path}", params=params, timeout=15)
        except requests.RequestException as e:
            raise ProviderError(f"Bzzoiro transport error: {e}") from e

        if r.status_code == 401:
            raise ProviderError("Bzzoiro: invalid token (401)")
        if r.status_code == 402:
            raise ProviderError("Bzzoiro: endpoint requires paid add-on (402)")
        if r.status_code >= 400:
            raise ProviderError(f"Bzzoiro HTTP {r.status_code}: {r.text[:200]}")

        if not r.text:
            return {}
        try:
            return r.json()
        except ValueError as e:
            raise ProviderError(f"Bzzoiro returned non-JSON: {r.text[:200]}") from e

    def _league_name(self, league_id: int | None) -> str:
        """Resolve a league name from ID, caching results."""
        if not league_id:
            return "Unknown"
        if league_id in self._league_cache:
            return self._league_cache[league_id]
        try:
            data = self._get(f"/leagues/{league_id}/")
            name = data.get("name") or data.get("league_name") or f"League #{league_id}"
        except ProviderError:
            name = f"League #{league_id}"
        self._league_cache[league_id] = name
        return name

    # --- Interface methods ---

    def get_fixtures(self, date: Optional[str] = None) -> Iterable[Fixture]:
        """
        GET /events/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
        Response: {"count": N, "results": [{"id": ..., "home_team": "...", ...}]}
        """
        if not date:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        data = self._get("/events/", params={"date_from": date, "date_to": date})
        results = data.get("results") or []

        fixtures: list[Fixture] = []
        for ev in results:
            league_id = ev.get("league_id")
            league_name = self._league_name(league_id)

            fixtures.append(Fixture(
                id=str(ev["id"]),
                competition=league_name,
                league_id=str(league_id or ""),
                home=_team_from_event(ev, "home"),
                away=_team_from_event(ev, "away"),
                kickoff=_parse_dt(ev.get("event_date")),
                status=self._map_status(ev.get("status")),
                coverage={
                    "lineups": True,
                    "events": True,
                    "stats": True,
                    "coordinates": False,
                },
            ))
        return fixtures

    def get_match_snapshot(self, match_id: str) -> Optional[MatchSnapshot]:
        """
        GET /events/{id}/ + /events/{id}/stats/
        Event object is the SAME shape as the fixtures list.
        """
        ev = self._get(f"/events/{match_id}/")
        if not ev or not ev.get("id"):
            return None

        # Stats sub-resource
        try:
            stats_raw = self._get(f"/events/{match_id}/stats/")
        except ProviderError:
            stats_raw = {}
        stats = self._normalize_stats(stats_raw)

        # Score: flat fields `home_score`, `away_score`
        score = {
            "home": int(ev.get("home_score") or 0),
            "away": int(ev.get("away_score") or 0),
        }

        # Status → period mapping
        raw_status = ev.get("status") or ""
        period = self._map_period(raw_status, ev.get("period"))
        minute = int(ev.get("current_minute") or 0)

        # Updated timestamp: BSD has no `updated_at`, so we treat now as fresh
        now = datetime.now(timezone.utc)

        return MatchSnapshot(
            match_id=str(ev["id"]),
            competition=self._league_name(ev.get("league_id")),
            home=_team_from_event(ev, "home"),
            away=_team_from_event(ev, "away"),
            score=score,
            period=period,
            minute=minute,
            status=self._map_status(raw_status),
            stats=stats,
            provider_updated_at=now,
            received_at=now,
            freshness="fresh",
        )

    def get_events_since(
        self, match_id: str, since: Optional[datetime] = None
    ) -> Iterable[MatchEvent]:
        """
        GET /events/{id}/incidents/
        Response: {"incidents": [{"id": ..., "type": "goal"|"card"|"sub", "minute": N, ...}]}
        """
        try:
            data = self._get(f"/events/{match_id}/incidents/")
        except ProviderError:
            return []

        incidents = data.get("incidents") or []
        events: list[MatchEvent] = []

        for inc in incidents:
            inc_type = (inc.get("type") or "").lower()
            mapped_type = self._map_event_type(inc_type)
            if not mapped_type:
                continue

            events.append(MatchEvent(
                event_id=str(inc.get("id") or f"{match_id}-{inc.get('minute')}-{inc_type}"),
                match_id=str(match_id),
                type=mapped_type,
                team_id=str(inc.get("team_id") or ""),
                player_id=str(inc.get("player_id")) if inc.get("player_id") else None,
                player_name=inc.get("player_name") or inc.get("player"),
                minute=int(inc.get("minute") or 0),
                status="confirmed",
                source_updated_at=_parse_dt(inc.get("updated_at")),
                received_at=datetime.now(timezone.utc),
                detail=inc.get("detail") or inc.get("description"),
            ))

        return events

    def get_lineups(self, match_id: str) -> Iterable[Lineup]:
        """
        Fetch lineups from Bzzoiro and normalize to Lineup DTOs.

        Bzzoiro returns positions as single letters (G/D/M/F) and jersey number
        as `jersey_number`. We map to full role names (GK/DF/MF/FW) and to
        `number` so downstream code (and the frontend) work with a consistent shape.
        """
        import os
        import requests as http
        from .schemas import Lineup
        from datetime import datetime, timezone

        key = os.getenv("FOOTBALL_API_KEY")
        if not key:
            return []

        # Map Bzzoiro's single-letter position to full role name
        POSITION_MAP = {
            "G": "GK",
            "GK": "GK",
            "D": "DF",
            "DF": "DF",
            "DEF": "DF",
            "M": "MF",
            "MF": "MF",
            "MID": "MF",
            "F": "FW",
            "FW": "FW",
            "ATT": "FW",
            "ST": "FW",
        }

        def normalize_player(p: dict) -> dict:
            raw_pos = (p.get("position") or "").upper().strip()
            return {
                "id": p.get("id") or p.get("player_id"), # Ensure this is captured!
                "name": p.get("name") or p.get("short_name") or "",
                "number": p.get("jersey_number") or p.get("number"),
                "position": POSITION_MAP.get(raw_pos, raw_pos),
            }

        try:
            r = http.get(
                f"https://sports.bzzoiro.com/api/v2/events/{match_id}/lineups/",
                headers={"Authorization": f"Token {key}"},
                timeout=10,
            )
            if not r.ok:
                return []

            data = r.json()
            lineups = data.get("lineups")
            if not lineups:
                return []  # lineup_status: "unavailable"

            results = []
            for side in ("home", "away"):
                side_data = lineups.get(side)
                if not side_data:
                    continue

                players = [normalize_player(p) for p in (side_data.get("players") or [])]
                results.append(Lineup(
                    match_id=match_id,
                    team_id=str(side_data.get("team_id") or ""),
                    formation=side_data.get("formation") or "",
                    players=players,
                    source_updated_at=datetime.now(timezone.utc),
                ))
            return results

        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("get_lineups %s failed: %s", match_id, e)
            return []
    
    def get_head_to_head(self, team_a: str, team_b: str, limit: int = 10):
        import requests as http, os
        api_key = os.getenv("FOOTBALL_API_KEY")
        if not api_key:
            return []
        try:
            r = http.get(
                "https://sports.bzzoiro.com/api/v2/h2h/",
                headers={"Authorization": f"Token {api_key}"},
                params={"team_a": team_a, "team_b": team_b, "limit": limit},
                timeout=10,
            )
            if not r.ok:
                return []
            data = r.json()
            from .schemas import HeadToHead
            return [
                HeadToHead(
                    date=m["date"],
                    home_team=m["home_team"],
                    away_team=m["away_team"],
                    score=m["score"],
                    competition=m.get("competition", ""),
                )
                for m in (data.get("meetings") or [])
            ]
        except Exception:
            return []


    def get_upcoming_fixtures(self, team_id: str, limit: int = 5):
        """
        Fetch upcoming fixtures for a team.
        If the Bzzoiro API exposes this, call it. Otherwise return [].
        """
        try:
            return []
        except Exception:
            return []

    # --- Mapping helpers ---

    @staticmethod
    def _map_status(raw: str | None) -> str:
        """
        BSD statuses: notstarted, live, finished, postponed, cancelled, abandoned.
        Map to scheduled | live | ft.
        """
        s = (raw or "").lower()
        if s in ("finished", "awarded", "walkover"):
            return "ft"
        if s in ("live", "inprogress", "in_progress"):
            return "live"
        return "scheduled"

    @staticmethod
    def _map_period(status: str | None, period: str | int | None) -> str:
        if (status or "").lower() == "finished":
            return "FT"
        if period == 1 or period == "1" or period == "1H":
            return "1H"
        if period == 2 or period == "2" or period == "2H":
            return "2H"
        if isinstance(period, int) and period >= 3:
            return "ET"
        if isinstance(period, str) and period:
            return period.upper()
        return "NS"

    @staticmethod
    def _map_event_type(inc_type: str) -> Optional[str]:
        if "goal" in inc_type:
            return "goal"
        if "card" in inc_type or "booking" in inc_type:
            return "card"
        if "sub" in inc_type:
            return "substitution"
        if "shot" in inc_type:
            return "shot"
        return "other"

    @staticmethod
    def _normalize_stats(raw: dict) -> dict:
        """
        BSD stats shape varies; check for either flat dict or {"home": {...}, "away": {...}}.
        """
        if not raw:
            return {}

        home = raw.get("home") or {}
        away = raw.get("away") or {}

        aliases = {
            "ball_possession": "possession",
            "expected_goals": "xg",
            "total_shots": "shots",
            "shots_on_target": "shotsOnTarget",
            "corner_kicks": "corners",
            "fouls": "fouls",
            "yellow_cards": "yellowCards",
            "red_cards": "redCards",
            "offsides": "offsides",
        }

        out: dict = {}
        for bsd_key, our_key in aliases.items():
            h = home.get(bsd_key)
            a = away.get(bsd_key)
            if h is not None or a is not None:
                out[our_key] = {"home": h or 0, "away": a or 0}

        return out