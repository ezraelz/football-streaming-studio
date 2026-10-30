"""
Poisson-based match outcome prediction.

Standard approach used across sports forecasting:

  λ_home = Attack_home × Defense_away × HomeAdv × LeagueAvg
  λ_away = Attack_away × Defense_home × LeagueAvg

  P(home win) = Σ Σ Poisson(h; λ_home) × Poisson(a; λ_away)  for h > a
  P(draw)     = Σ Σ ...                                      for h = a
  P(away win) = Σ Σ ...                                      for h < a

Attack / Defense are per-team ratios versus the league average, so a team
that scores 1.5× the league average has Attack = 1.5. Values < 0.1 are
clamped to avoid degeneracy when a team has no recent matches.

This is not a trained model — it's a transparent baseline. It's fast,
deterministic, auditable, and honest about uncertainty. Do NOT present its
output as a certainty (see spec §11.5).
"""

import math
from typing import Iterable, Mapping


MODEL_VERSION = "poisson-v1"
DEFAULT_LEAGUE_AVG = 1.35   # typical total goals per match across major leagues
DEFAULT_HOME_ADV = 1.15     # ~15% boost to home team's expected goals
MAX_GOALS = 6               # probability mass beyond 6 goals/match is negligible


def _poisson(k: int, mean: float) -> float:
    """P(X = k) for X ~ Poisson(mean)."""
    if mean <= 0:
        return 1.0 if k == 0 else 0.0
    return (mean ** k) * math.exp(-mean) / math.factorial(k)


def team_strengths(
    matches: Iterable[Mapping],
    team_id: str,
    league_avg: float = DEFAULT_LEAGUE_AVG,
) -> dict:
    """
    Return attack and defense ratios for one team from a list of finished
    matches (each row should have home_team_id, away_team_id,
    home_score, away_score).
    """
    scored = conceded = played = 0

    for m in matches:
        hg = m.get("home_score")
        ag = m.get("away_score")
        if hg is None or ag is None:
            continue

        home_id = m.get("home_team_id")
        is_home = str(home_id) == str(team_id)

        if is_home:
            scored += hg
            conceded += ag
        else:
            scored += ag
            conceded += hg
        played += 1

    if played == 0:
        return {"attack": 1.0, "defense": 1.0, "played": 0}

    attack = (scored / played) / league_avg
    defense = (conceded / played) / league_avg

    return {
        "attack": max(attack, 0.1),
        "defense": max(defense, 0.1),
        "played": played,
    }


def estimate_league_avg(all_matches: Iterable[Mapping], fallback: float = DEFAULT_LEAGUE_AVG) -> float:
    """Estimate league average goals/match from the same match set."""
    totals = []
    for m in all_matches:
        hg = m.get("home_score")
        ag = m.get("away_score")
        if hg is not None and ag is not None:
            totals.append(hg + ag)
    if not totals:
        return fallback
    return round(sum(totals) / len(totals), 3)


def predict_1x2(
    *,
    home_matches: list[Mapping],
    away_matches: list[Mapping],
    home_team_id: str,
    away_team_id: str,
    league_avg: float | None = None,
    home_advantage: float = DEFAULT_HOME_ADV,
    max_goals: int = MAX_GOALS,
) -> dict:
    """
    Return {home, draw, away} probabilities and the underlying λ values.
    """
    all_matches = list(home_matches) + list(away_matches)
    if league_avg is None:
        league_avg = estimate_league_avg(all_matches)

    home = team_strengths(home_matches, home_team_id, league_avg)
    away = team_strengths(away_matches, away_team_id, league_avg)

    lam_home = max(home["attack"] * away["defense"] * home_advantage * league_avg, 0.05)
    lam_away = max(away["attack"] * home["defense"] * league_avg, 0.05)

    home_p = draw_p = away_p = 0.0
    for h in range(max_goals + 1):
        ph = _poisson(h, lam_home)
        for a in range(max_goals + 1):
            pa = _poisson(a, lam_away)
            p = ph * pa
            if h > a:
                home_p += p
            elif h == a:
                draw_p += p
            else:
                away_p += p

    # Normalize to absorb the discarded mass beyond max_goals
    total = home_p + draw_p + away_p or 1.0
    return {
        "home": round(home_p / total, 3),
        "draw": round(draw_p / total, 3),
        "away": round(away_p / total, 3),
        "lambda_home": round(lam_home, 2),
        "lambda_away": round(lam_away, 2),
        "league_avg": round(league_avg, 3),
        "home_matches_used": home["played"],
        "away_matches_used": away["played"],
        "model_version": MODEL_VERSION,
    }


def predict_from_odds(odds: dict) -> dict | None:
    """
    Convert Bzzoiro /odds/ consensus prices to implied probabilities,
    normalized to remove the bookmaker's over-round.

    Returns None if any of the three 1X2 prices is missing or <= 1.0.
    """
    home_odds = odds.get("home_win")
    draw_odds = odds.get("draw")
    away_odds = odds.get("away_win")

    if not (home_odds and draw_odds and away_odds):
        return None
    if min(home_odds, draw_odds, away_odds) <= 1.0:
        return None

    p_home = 1.0 / home_odds
    p_draw = 1.0 / draw_odds
    p_away = 1.0 / away_odds
    total = p_home + p_draw + p_away

    if total <= 0:
        return None

    return {
        "home": round(p_home / total, 3),
        "draw": round(p_draw / total, 3),
        "away": round(p_away / total, 3),
        "model_version": "market-consensus",
        "overround": round(total - 1.0, 4),
    }
    