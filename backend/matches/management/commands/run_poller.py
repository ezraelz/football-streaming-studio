import time
from django.core.management.base import BaseCommand
from matches.models import Match
from matches.services import refresh_fixtures, refresh_match
from providers.registry import get_provider

class Command(BaseCommand):
    help = "Continuously poll active matches. Ctrl+C to stop."

    def add_arguments(self, parser):
        parser.add_argument("--interval", type=int, default=60, help="Seconds between polls (default 60)")

    def handle(self, *args, **opts):
        interval = opts["interval"]
        self.stdout.write(f"Poller running every {interval}s. Ctrl+C to stop.")
        
        try:
            while True:
                # 1. Sync fixtures (1 API call for today + next 7 days)
                try:
                    refresh_fixtures()
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Fixture sync failed: {e}"))

                # 2. Fetch live matches ONCE (1 API call)
                live_cache = {}
                try:
                    p = get_provider()
                    live_data = p._get("/events/live/")
                    for ev in live_data.get("events", []):
                        live_cache[str(ev["id"])] = ev
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Live fetch failed: {e}"))

                # 3. Refresh active matches using the cache
                active = Match.objects.filter(provider="bzzoiro", status__in=["live", "scheduled"])
                
                for m in active:
                    try:
                        result = refresh_match(m.provider_match_id, live_cache=live_cache)
                        self.stdout.write(
                            f"  [{m.provider_match_id}] {m.home_team_short} vs {m.away_team_short} | fresh={result['freshness']} new={result['created_events']}"
                        )
                    except Exception as e:
                        self.stdout.write(self.style.WARNING(f"  [{m.provider_match_id}] Error: {e}"))
                        
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("\nPoller stopped.")