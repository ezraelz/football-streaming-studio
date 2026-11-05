# matches/management/commands/list_leagues.py
from django.core.management.base import BaseCommand
from providers.registry import get_provider


class Command(BaseCommand):
    help = "List league ids from the provider (filter by --country)."

    def add_arguments(self, parser):
        parser.add_argument("--country", help="Filter by country name, e.g. Argentina")
        parser.add_argument("--include-inactive", action="store_true")

    def handle(self, *args, **opts):
        p = get_provider()
        params = {"limit": 50, "offset": 0}
        if opts.get("country"):
            params["country"] = opts["country"]
        if opts.get("include_inactive"):
            params["include_inactive"] = "true"

        offset = 0
        while True:
            page = p._get("/leagues/", {**params, "offset": offset})
            rows = page.get("results") or page.get("leagues") or page
            if not rows:
                break
            for r in rows:
                self.stdout.write(f"{r['id']:>6}  {r.get('name','')}  [{r.get('country','')}]")
            if not page.get("next"):
                break
            offset += len(rows)