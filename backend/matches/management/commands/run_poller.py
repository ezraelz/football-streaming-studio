import time
from django.core.management.base import BaseCommand
from django.utils import timezone as djtz
from datetime import timedelta

from matches.models import Match
from matches.services import refresh_match


class Command(BaseCommand):
    help = "Continuously poll active matches. Ctrl+C to stop."

    def add_arguments(self, parser):
        parser.add_argument("--interval", type=int, default=30)

    def handle(self, *args, **opts):
        interval = opts["interval"]
        self.stdout.write(f"Poller running every {interval}s. Ctrl+C to stop.")
        try:
            while True:
                active = Match.objects.filter(
                    provider="thesportsdb",
                    status__in=["live", "scheduled"],
                )
                for m in active:
                    try:
                        result = refresh_match(m.provider_match_id)
                        self.stdout.write(
                            f"  [{m.provider_match_id}] freshness={result['freshness']} new={result['created_events']}"
                        )
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"  [{m.provider_match_id}] {e}"))
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("\nPoller stopped.")