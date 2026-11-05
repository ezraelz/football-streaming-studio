# matches/management/commands/poll_changes.py
from django.core.management.base import BaseCommand

from matches.services import refresh_fixtures, refresh_match
from providers.bzzoiro import TOP_5_LEAGUE_IDS


class Command(BaseCommand):
    help = "Fetch fixtures and sync match states (top 5 leagues by default)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--match", dest="match_id",
            help="Provider match id (sync only this one)",
        )
        parser.add_argument(
            "--league", dest="league_ids", action="append", type=int, default=None,
            help=(
                "Provider league id (repeatable). "
                f"Defaults to the top 5 leagues {TOP_5_LEAGUE_IDS}. "
                "Use --league all to poll every league."
            ),
        )
        parser.add_argument(
            "--fixtures-only", action="store_true",
            help="Refresh fixtures only",
        )

    def _resolve_league_ids(self, opts):
        raw = opts.get("league_ids")
        if raw is None:
            return list(TOP_5_LEAGUE_IDS)       # default scope
        if raw == ["all"]:
            return None                          # explicit "everything"
        return [int(i) for i in raw]

    def handle(self, *args, **opts):
        if opts.get("match_id"):
            result = refresh_match(opts["match_id"])
            self.stdout.write(self.style.SUCCESS(
                f"[{result['match_id']}] freshness={result['freshness']} "
                f"new_events={result['created_events']}"
            ))
            return

        league_ids = self._resolve_league_ids(opts)
        matches = refresh_fixtures(league_ids=league_ids)
        self.stdout.write(
            f"Upserted {len(matches)} fixtures "
            f"({'all leagues' if league_ids is None else f'leagues {league_ids}'})."
        )

        if opts.get("fixtures_only"):
            return

        for m in matches:
            if m.status in ("live", "scheduled"):
                result = refresh_match(m.provider_match_id)
                self.stdout.write(
                    f"  [{result['match_id']}] freshness={result['freshness']} "
                    f"new_events={result['created_events']}"
                )