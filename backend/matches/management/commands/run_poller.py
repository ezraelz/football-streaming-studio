# matches/management/commands/poll_forever.py
import time

from django.core.management.base import BaseCommand

from matches.models import Match
from matches.services import refresh_fixtures, refresh_match
from providers.bzzoiro import TOP_5_LEAGUE_IDS
from providers.registry import get_provider


class Command(BaseCommand):
    help = "Continuously poll active matches (top 5 leagues by default). Ctrl+C to stop."

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval", type=int, default=60,
            help="Seconds between polls (default 60)",
        )
        parser.add_argument(
            "--league", dest="league_ids", action="append", type=int, default=None,
            help=(
                "Provider league id (repeatable). "
                f"Defaults to the top 5 leagues {TOP_5_LEAGUE_IDS}. "
                "Use --league all to poll every league."
            ),
        )

    def _resolve_league_ids(self, opts):
        raw = opts.get("league_ids")
        if raw is None:
            return list(TOP_5_LEAGUE_IDS)
        if raw == ["all"]:
            return None
        return [int(i) for i in raw]

    def handle(self, *args, **opts):
        interval = opts["interval"]
        league_ids = self._resolve_league_ids(opts)
        provider = get_provider()

        scope = (
            "all leagues" if league_ids is None else f"leagues {league_ids}"
        )
        self.stdout.write(
            f"Poller running every {interval}s ({scope}). Ctrl+C to stop."
        )

        try:
            while True:
                # 1. Sync fixtures for the window (scoped).
                try:
                    refresh_fixtures(league_ids=league_ids)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Fixture sync failed: {e}"))

                # 2. Reuse the provider's live cache (15s TTL).
                try:
                    live_cache = provider._get_live_cache()
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Live cache failed: {e}"))
                    live_cache = {}

                # 3. Refresh active matches, scoped to the selected leagues.
                active = Match.objects.filter(
                    provider="bzzoiro",
                    status__in=["live", "scheduled"],
                )
                if league_ids is not None:
                    active = active.filter(
                        league__provider_id__in=league_ids,
                    )

                for m in active:
                    try:
                        result = refresh_match(
                            m.provider_match_id, live_cache=live_cache,
                        )
                        self.stdout.write(
                            f"  [{m.provider_match_id}] "
                            f"{m.home_team_short} vs {m.away_team_short} | "
                            f"fresh={result['freshness']} "
                            f"new={result['created_events']}"
                        )
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(
                            f"  [{m.provider_match_id}] Error: {e}"
                        ))

                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("\nPoller stopped.")