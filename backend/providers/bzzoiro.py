"""
Bzzoiro Sports Data (BSD) provider adapter — v2 API.
"""
import logging
import os
import re
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional
from urllib.parse import parse_qsl, urlparse

import requests

from .base import FootballProvider, ProviderError
from .helpers import TEAM_COLORS
from .schemas import Fixture, HeadToHead, Lineup, MatchEvent, MatchSnapshot, TeamRef

BASE = "https://sports.bzzoiro.com/api/v2"
logger = logging.getLogger(__name__)

LEAGUE_NAMES: dict[int, str] = {
    80: "Categoría Primera A",
}

DEFAULT_TEAM_COLOR = "#27272a"

# Audience timezone assumed for date-window trimming (UTC+3 for Addis Ababa).
# Expressed as an offset so we don't require zoneinfo at import time.
AUDIENCE_UTC_OFFSET = timedelta(hours=3)

_POSITION_MAP = {
    "G": "GK", "GK": "GK",
    "D": "DF", "DF": "DF", "DEF": "DF",
    "M": "MF", "MF": "MF", "MID": "MF",
    "F": "FW", "FW": "FW", "ATT": "FW", "ST": "FW",
}


def _slug(name: str) -> str:
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _normalize_team_name(name: str) -> str:
    for suffix in (" FC", " SC", " AFC", " CF", " CD", " AC"):
        if name.endswith(suffix):
            return name[: -len(suffix)].strip()
    return name.strip()


def _team_color(name: str) -> str:
    if not name:
        return DEFAULT_TEAM_COLOR
    if name in TEAM_COLORS:
        return TEAM_COLORS[name]
    normalized = _normalize_team_name(name)
    if normalized in TEAM_COLORS:
        return TEAM_COLORS[normalized]
    lower = name.lower()
    for key, color in TEAM_COLORS.items():
        if key.lower() == lower:
            return color
    return DEFAULT_TEAM_COLOR


def _team_from_event(ev: dict, side: str) -> TeamRef:
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


def _parse_dt(value: str | None) -> Optional[datetime]:
    """Return a tz-aware datetime, or None if the value is missing/unparseable."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _to_date(value):
    """'2026-11-01' (or full ISO) -> date, else None."""
    if not value:
        return None
    dt = _parse_dt(str(value))
    return dt.date() if dt else None


def _safe_int(value, default: int = 0) -> int:
    try:
        return int(str(value).split("+")[0].split("'")[0])
    except (TypeError, ValueError):
        return default


class BzzoiroProvider(FootballProvider):
    name = "bzzoiro"
    MAX_WINDOW_DAYS = 62      # ~2 months: one month ahead + the month after
    MAX_PAGES = 12            # safety stop for pagination

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
        # In-memory live cache to prevent multiple /events/live/ calls in one loop
        self._live_cache: dict[str, dict] = {}
        self._live_cache_ts: float = 0.0

    # --- HTTP ---

    def _paged(self, path: str, params: dict) -> list[dict]:
        """Follow DRF-style `next` links so a big window isn't silently cut at the first page."""
        rows: list[dict] = []
        next_path, next_params = path, dict(params)
        for _ in range(self.MAX_PAGES):
            data = self._get(next_path, params=next_params)
            rows.extend(data.get("results") or [])
            nxt = data.get("next")
            if not nxt:
                break
            u = urlparse(nxt)
            next_path = u.path.replace("/api/v2", "", 1)
            next_params = dict(parse_qsl(u.query))
        else:
            logger.warning("_paged hit MAX_PAGES=%d for %s; results may be truncated",
                           self.MAX_PAGES, path)
        return rows

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        try:
            r = self.session.get(f"{BASE}{path}", params=params, timeout=15)
        except requests.RequestException as e:
            raise ProviderError(f"Bzzoiro transport error on {path}: {e}") from e

        if r.status_code == 401:
            raise ProviderError("Bzzoiro: invalid token (401)")
        if r.status_code == 402:
            raise ProviderError("Bzzoiro: endpoint requires paid add-on (402)")
        if r.status_code == 429:
            raise ProviderError("Bzzoiro: rate limited (429)")
        if r.status_code >= 400:
            raise ProviderError(
                f"Bzzoiro HTTP {r.status_code} on {path}: {r.text[:200]}"
            )

        if not r.text:
            return {}
        try:
            return r.json()
        except ValueError as e:
            raise ProviderError(
                f"Bzzoiro returned non-JSON on {path}: {r.text[:200]}"
            ) from e

    def _league_name(self, league_id: int | None) -> str:
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

    def get_fixtures(self, date_from: Optional[str] = None,
                     date_to: Optional[str] = None) -> Iterable[Fixture]:
        today = datetime.now(timezone.utc).date()
        start = _to_date(date_from) or today
        end = _to_date(date_to) or (start + timedelta(days=7))
        if end < start:
            start, end = end, start

        capped = start + timedelta(days=self.MAX_WINDOW_DAYS)
        if end > capped:
            logger.warning("get_fixtures window %s..%s exceeds MAX_WINDOW_DAYS; "
                           "clamping to %s", start, end, capped)
            end = capped

        # Provider dates are UTC but the audience isn't (UTC+3): fetch with a margin
        # so matches that are "today" locally don't vanish on the UTC boundary.
        q_from = (start - timedelta(days=1)).isoformat()
        q_to = (end + timedelta(days=1)).isoformat()

        fixtures: dict[str, Fixture] = {}
        errors: list[str] = []

        # 1) Scheduled / finished events in the window (paginated).
        try:
            for ev in self._paged("/events/", {"date_from": q_from, "date_to": q_to, "limit": 200}):
                fx = self._build_fixture(ev)
                if fx is not None:
                    fixtures[str(ev["id"])] = fx
        except ProviderError as e:
            errors.append(str(e))
            logger.warning("Fixtures window %s..%s failed: %s", q_from, q_to, e)

        # 2) Live overrides — only relevant if the window includes today.
        if start <= today <= end:
            try:
                live = self._get("/events/live/")
                for ev in (live.get("events") or []):
                    fx = self._build_fixture(ev, force_status="live")
                    if fx is not None:
                        fixtures[str(ev["id"])] = fx
            except ProviderError as e:
                errors.append(str(e))
                logger.warning("Live fixtures failed: %s", e)

        # Don't hide a total failure behind an empty list.
        if not fixtures and errors:
            raise ProviderError("; ".join(errors))

        # Trim the safety margin back to the user's local date range.
        lo = start - timedelta(days=1)
        hi = end + timedelta(days=1)

        def _local_date(dt: datetime):
            return (dt + AUDIENCE_UTC_OFFSET).date()

        return [f for f in fixtures.values() if lo <= _local_date(f.kickoff) <= hi]

    @staticmethod
    def _map_status(raw: str | None) -> str:
        s = (raw or "").lower().replace(" ", "_")
        if s in ("finished", "ended", "ft", "aet", "after_penalties", "awarded", "walkover"):
            return "ft"
        if s in ("live", "inprogress", "in_progress", "1st_half", "2nd_half",
                 "first_half", "second_half", "halftime", "half_time", "ht",
                 "extra_time", "penalties", "break"):
            return "live"
        return "scheduled"  # notstarted / scheduled / postponed / cancelled

    def _build_fixture(self, ev: dict, force_status: str | None = None) -> Optional[Fixture]:
        kickoff = _parse_dt(ev.get("event_date"))
        if kickoff is None:
            logger.warning("Skipping event %s: missing/invalid event_date", ev.get("id"))
            return None
        league_id = ev.get("league_id")
        return Fixture(
            id=str(ev["id"]),
            competition=self._league_name(league_id),
            league_id=str(league_id or ""),
            home=_team_from_event(ev, "home"),
            away=_team_from_event(ev, "away"),
            kickoff=kickoff,
            status=force_status or self._map_status(ev.get("status")),
            coverage={"lineups": True, "events": True, "stats": True, "coordinates": False},
        )

    def _get_live_cache(self) -> dict[str, dict]:
        """Fetch live matches once every 15 seconds; return the last good cache on failure."""
        now = time.time()
        if now - self._live_cache_ts < 15:
            return self._live_cache
        try:
            live_data = self._get("/events/live/")
            events = live_data.get("events") or []
            self._live_cache = {str(ev["id"]): ev for ev in events}
            self._live_cache_ts = now
            logger.debug("live cache refreshed: %d events", len(events))
        except ProviderError as e:
            logger.warning("Live cache fetch failed: %s", e)
        return self._live_cache

    def get_match_snapshot(self, match_id: str,
                           live_cache: dict | None = None) -> Optional[MatchSnapshot]:
        """
        Try the live endpoint first (fast, free, updates every 10-30s).
        Fall back to the detail endpoint if the match isn't live.

        NOTE: snapshots sourced from the live endpoint carry empty `stats`
        (the live feed omits them). Pollers should tolerate that.
        """
        cache = live_cache if live_cache is not None else self._get_live_cache()

        if str(match_id) in cache:
            ev = cache[str(match_id)]
            now = datetime.now(timezone.utc)
            return MatchSnapshot(
                match_id=str(ev["id"]),
                competition=self._league_name(ev.get("league_id")),
                home=_team_from_event(ev, "home"),
                away=_team_from_event(ev, "away"),
                score={
                    "home": _safe_int(ev.get("home_score")),
                    "away": _safe_int(ev.get("away_score")),
                },
                period=self._map_period(ev.get("status"), ev.get("period")),
                minute=_safe_int(ev.get("current_minute")),
                status=self._map_status(ev.get("status")),
                stats={},
                provider_updated_at=now,
                received_at=now,
                freshness="fresh",
            )

        try:
            ev = self._get(f"/events/{match_id}/")
            if not ev or not ev.get("id"):
                return None

            stats_raw: dict = {}
            try:
                stats_raw = self._get(f"/events/{match_id}/stats/")
            except ProviderError:
                pass

            now = datetime.now(timezone.utc)
            return MatchSnapshot(
                match_id=str(ev["id"]),
                competition=self._league_name(ev.get("league_id")),
                home=_team_from_event(ev, "home"),
                away=_team_from_event(ev, "away"),
                score={
                    "home": _safe_int(ev.get("home_score")),
                    "away": _safe_int(ev.get("away_score")),
                },
                period=self._map_period(ev.get("status"), ev.get("period")),
                minute=_safe_int(ev.get("current_minute")),
                status=self._map_status(ev.get("status")),
                stats=self._normalize_stats(stats_raw),
                provider_updated_at=now,
                received_at=now,
                freshness="fresh",
            )
        except ProviderError:
            return None

    def get_events_since(self, match_id: str,
                         since: Optional[datetime] = None) -> Iterable[MatchEvent]:
        try:
            data = self._get(f"/events/{match_id}/incidents/")
        except ProviderError:
            return []

        events: list[MatchEvent] = []
        for inc in data.get("incidents") or []:
            inc_type = (inc.get("type") or "").lower()
            mapped_type = self._map_event_type(inc_type)
            if mapped_type is None:
                continue

            updated_at = _parse_dt(inc.get("updated_at"))
            if since is not None and updated_at is not None and updated_at <= since:
                continue

            events.append(MatchEvent(
                event_id=str(inc.get("id") or f"{match_id}-{inc.get('minute')}-{inc_type}"),
                match_id=str(match_id),
                type=mapped_type,
                team_id=str(inc.get("team_id") or ""),
                player_id=str(inc.get("player_id")) if inc.get("player_id") else None,
                player_name=inc.get("player_name") or inc.get("player"),
                minute=_safe_int(inc.get("minute")),
                status="confirmed",
                source_updated_at=updated_at or datetime.now(timezone.utc),
                received_at=datetime.now(timezone.utc),
                detail=inc.get("detail") or inc.get("description"),
            ))
        return events

    @staticmethod
    def _normalize_player(p: dict) -> dict:
        raw_pos = (p.get("position") or "").upper().strip()
        return {
            "id": p.get("id") or p.get("player_id"),
            "name": p.get("name") or p.get("short_name") or "",
            "number": p.get("jersey_number") or p.get("number"),
            "position": _POSITION_MAP.get(raw_pos, raw_pos),
        }

    def get_lineups(self, match_id: str) -> Iterable[Lineup]:
        try:
            data = self._get(f"/events/{match_id}/lineups/")
        except ProviderError as e:
            logger.warning("get_lineups %s failed: %s", match_id, e)
            return []

        lineups = data.get("lineups")
        if not isinstance(lineups, dict):
            return []

        results: list[Lineup] = []
        for side in ("home", "away"):
            side_data = lineups.get(side)
            if not side_data:
                continue
            players = [self._normalize_player(p)
                       for p in (side_data.get("players") or [])]
            results.append(Lineup(
                match_id=match_id,
                team_id=str(side_data.get("team_id") or ""),
                formation=side_data.get("formation") or "",
                players=players,
                source_updated_at=datetime.now(timezone.utc),
            ))
        return results

    def get_head_to_head(self, team_a: str, team_b: str,
                         limit: int = 10) -> list[HeadToHead]:
        try:
            data = self._get("/h2h/", params={
                "team_a": team_a, "team_b": team_b, "limit": limit,
            })
        except ProviderError as e:
            logger.warning("get_head_to_head failed: %s", e)
            return []

        out: list[HeadToHead] = []
        for m in data.get("meetings") or []:
            try:
                out.append(HeadToHead(
                    date=m["date"],
                    home_team=m["home_team"],
                    away_team=m["away_team"],
                    score=m["score"],
                    competition=m.get("competition", ""),
                ))
            except KeyError:
                continue
        return out

    def get_upcoming_fixtures(self, team_id: str, limit: int = 5):
        # TODO: implement once BSD exposes a per-team fixtures endpoint.
        # Returning [] silently masks "not implemented" from callers.
        raise NotImplementedError(
            "BzzoiroProvider.get_upcoming_fixtures is not implemented yet"
        )

    # --- Mapping helpers ---

    @staticmethod
    def _map_period(status: str | None, period: str | int | None) -> str:
        s = (status or "").lower()
        if s == "finished":
            return "FT"
        if period in (1, "1", "1H"):
            return "1H"
        if period in (2, "2", "2H"):
            return "2H"
        if isinstance(period, int) and period >= 3:
            return "ET"
        if isinstance(period, str) and period:
            return period.upper()
        if s in ("live", "inprogress", "in_progress"):
            return "LIVE"
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
                out[our_key] = {
                    "home": h if h is not None else 0,
                    "away": a if a is not None else 0,
                }
        return out