from datetime import datetime, timezone as dttz

from matches.models import Match, MatchEvent
import os

STALE_AGE = int(os.getenv("STALE_THRESHOLD_SECONDS", "30"))


def build_fact_pack(match: Match, event: MatchEvent) -> dict:
    snapshot = getattr(match, "snapshot", None)
    now = datetime.now(dttz.utc)

    is_home = event.team_id == match.home_team_id
    opponent_name = (
        match.away_team_name if is_home else match.home_team_name
    )

    facts = {
        "event": {
            "type": event.type,
            "minute": event.minute,
            "player_name": event.player_name,
            "team_id": event.team_id,
            "team_name": (
                match.home_team_name if is_home
                else match.away_team_name if event.team_id == match.away_team_id
                else None
            ),
            "opponent_name": opponent_name if (is_home or event.team_id == match.away_team_id) else None,
            "confirmed": event.status == "confirmed",
        },
        "match": {
            "competition": match.competition,
            "home_team": match.home_team_name,
            "away_team": match.away_team_name,
            "home_short": match.home_team_short,
            "away_short": match.away_team_short,
        },
        "score": None,
        "stats": None,
        "freshness": "disconnected",
        "age_seconds": None,
        "language": "en",  # overridden by caller from session profile
    }

    if snapshot:
        facts["score"] = {"home": snapshot.score_home, "away": snapshot.score_away}
        facts["stats"] = snapshot.stats
        age = (now - snapshot.provider_updated_at).total_seconds()
        facts["age_seconds"] = int(age)
        facts["freshness"] = "fresh" if age < STALE_AGE else "stale"

    return facts
