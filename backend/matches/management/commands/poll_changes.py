from django.core.management.base import BaseCommand
from matches.changes import poll_changes


class Command(BaseCommand):
    help = "Poll Bzzoiro fixture changes and warn on anything affecting tracked matches."

    def handle(self, *args, **options):
        result = poll_changes()
        if result.get("error"):
            self.stderr.write(self.style.ERROR(f"Error: {result['error']}"))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Checked {result['checked']} changes, actioned {result['actioned']}."
            ))