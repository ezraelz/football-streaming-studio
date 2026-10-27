"""
Historical H2H-based match prediction.

This is NOT a trained model. It's a transparent baseline that:
  - Counts wins/draws over the last N meetings
  - Weights recent meetings more heavily
  - Returns probabilities + a "confidence" and the input facts used

The spec (§11.5) requires:
  - Store model version, inputs, timestamp, probabilities
  - Label probabilities as estimates
  - Never present a forecast as a guaranteed outcome
"""

from datetime import datetime, timezone as dttz
from typing import Iterable

MODEL_VERSION = "h2h-weighted-v1"


def predict_from_h2h(
    team_a_name: str,
    team_b_name: str,
    meetings: Iterable[dict],  # [{date, home_team, away_team, score, ...}]
) -> dict:
    """
    Given past meetings, produce a win/draw/win probability triple.
    Returns a dict with probabilities, sample size, model version, timestamp,
    and the raw inputs used.
    """
    meetings = list(meetings)
    if not meetings:
        return {
            "probabilities": None,
            "sample_size": 0,
            "model_version": MODEL_VERSION,
            "timestamp": datetime.now(dttz.utc).isoformat(),
            "reason": "no_h2h_data",
        }

    wins_a = wins_b = draws = 0
    weighted_a = weighted_b = weighted_d = 0.0

    # Newest meetings first — weight by recency (1.0, 0.8, 0.64, ...)
    for idx, m in enumerate(meetings):
        weight = 0.8 ** idx  # recency decay
        score = m["score"]
        try:
            h_goals, a_goals = (int(x) for x in score.split("-"))
        except Exception:
            continue
        home = m["home_team"]
        winner_name = (
            home if h_goals > a_goals
            else m["away_team"] if a_goals > h_goals
            else None
        )

        if winner_name is None:
            draws += 1
            weighted_d += weight
        elif winner_name == team_a_name:
            wins_a += 1
            weighted_a += weight
        elif winner_name == team_b_name:
            wins_b += 1
            weighted_b += weight

    total_weight = weighted_a + weighted_d + weighted_b
    if total_weight == 0:
        return {
            "probabilities": None,
            "sample_size": len(meetings),
            "model_version": MODEL_VERSION,
            "timestamp": datetime.now(dttz.utc).isoformat(),
            "reason": "all_meetings_unparsed",
        }

    p_a = weighted_a / total_weight
    p_d = weighted_d / total_weight
    p_b = weighted_b / total_weight

    return {
        "probabilities": {
            "home_win": round(p_a, 3),
            "draw":     round(p_d, 3),
            "away_win": round(p_b, 3),
        },
        "sample_size": len(meetings),
        "raw_counts": {"wins_a": wins_a, "draws": draws, "wins_b": wins_b},
        "model_version": MODEL_VERSION,
        "timestamp": datetime.now(dttz.utc).isoformat(),
    }