"""
Celery tasks for the football streaming studio.

`poll_matches_task` runs every 30 seconds and calls the same service
layer the `poll_matches` management command uses. It replaces the
manual `while true; do poll_matches; sleep 30; done` loop.
"""

import logging
from celery import shared_task

log = logging.getLogger(__name__)


@shared_task(
    name="matches.poll_matches",
    bind=True,
    max_retries=2,
    default_retry_delay=15,
)
def poll_matches_task(self):
    """
    Fetch fixtures + refresh every live/scheduled match's snapshot,
    events, and lineups. Fires WS updates to any subscribed studio / overlay.
    """
    from matches.services import refresh_fixtures, refresh_match

    try:
        matches = refresh_fixtures()
        refreshed = 0
        for m in matches:
            if m.status in ("live", "scheduled"):
                refresh_match(m.provider_match_id)
                refreshed += 1
        log.info("poll_matches: refreshed %d fixtures, %d live/scheduled matches", len(matches), refreshed)
        return {"fixtures": len(matches), "refreshed": refreshed}

    except Exception as exc:
        log.exception("poll_matches failed")
        # Retry after a short delay on transient errors
        raise self.retry(exc=exc)


@shared_task(name="matches.poll_changes")
def poll_changes_task():
    """Poll Bzzoiro /fixtures/changes/ and warn on any tracked match disruptions."""
    from matches.changes import poll_changes

    try:
        result = poll_changes()
        log.info("poll_changes: %s", result)
        return result
    except Exception:
        log.exception("poll_changes failed")
        return {"error": "exception"}
    