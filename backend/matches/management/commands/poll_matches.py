from django.core.management.base import BaseCommand

from matches.services import refresh_fixtures, refresh_match


class Command(BaseCommand):
    help = "Fetch fixtures and sync all match states from the configured provider."

    def add_arguments(self, parser):
        parser.add_argument(
            "--match", dest="match_id", help="Provider match id (sync only this one)"
        )
        parser.add_argument(
            "--fixtures-only", action="store_true", help="Refresh fixtures only"
        )

    def handle(self, *args, **opts):
        if opts.get("match_id"):
            result = refresh_match(opts["match_id"])
            self.stdout.write(self.style.SUCCESS(
                f"[{result['match_id']}] freshness={result['freshness']} "
                f"new_events={result['created_events']}"
            ))
            return

        matches = refresh_fixtures()
        self.stdout.write(f"Upserted {len(matches)} fixtures.")
        if opts.get("fixtures_only"):
            return

        for m in matches:
            if m.status == "live" or m.status == "scheduled":
                result = refresh_match(m.provider_match_id)
                self.stdout.write(
                    f"  [{result['match_id']}] freshness={result['freshness']} "
                    f"new_events={result['created_events']}"
                )