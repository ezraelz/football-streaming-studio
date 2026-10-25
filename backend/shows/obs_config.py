"""
Maps internal scene keys to OBS scene names.

The operator configures this once per show profile (or globally).
For MVP, we use a fixed mapping from the env; a full UI for editing this
comes later.
"""

import os


# Default: assume OBS scene names match our internal keys exactly.
# Override per scene via env: OBS_SCENE_SCOREBOARD, OBS_SCENE_STATS, etc.
DEFAULTS = {
    "scoreboard": "Scoreboard",
    "timeline": "Timeline",
    "stats": "Match Stats",
    "tactical": "Tactical View",
    "player": "Player Spotlight",
    "lower-third": "Lower Third",
}


def obs_scene_name(internal_key: str) -> str:
    """Resolve an internal scene key to the configured OBS scene name."""
    env_key = f"OBS_SCENE_{internal_key.replace('-', '_').upper()}"
    return os.getenv(env_key, DEFAULTS.get(internal_key, internal_key))