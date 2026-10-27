import os

from .football_data_org import FootballDataOrgProvider
from .thesportsdb import TheSportsDBProvider
from .base import FootballProvider
from .mock import MockProvider
from .bzzoiro import BzzoiroProvider

_REGISTRY: dict[str, type[FootballProvider]] = {
    "mock": MockProvider,
    "thesportsdb": TheSportsDBProvider,
    "football-data-org": FootballDataOrgProvider,
    "bzzoiro": BzzoiroProvider, 
}


def get_provider() -> FootballProvider:
    """Return the configured provider adapter. Raises if unknown."""
    name = os.getenv("FOOTBALL_PROVIDER", "mock").lower()
    cls = _REGISTRY.get(name)
    if cls is None:
        raise RuntimeError(
            f"Unknown FOOTBALL_PROVIDER '{name}'. Known: {sorted(_REGISTRY)}"
        )
    return cls()