import os
import json
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from dotenv import load_dotenv
load_dotenv(".env")

import requests
from matches.models import Match

key = os.getenv("FOOTBALL_API_KEY")

# Find a match that likely has stats (live or scheduled from a top league)
m = Match.objects.filter(competition__icontains="Premier").exclude(provider="mock").first()

if not m:
    print("No Premier League match found in DB")
    raise SystemExit

print(f"Testing Match: {m.provider_match_id} · {m.home_team_short} vs {m.away_team_short} (Status: {m.status})")

r = requests.get(
    f"https://sports.bzzoiro.com/api/v2/events/{m.provider_match_id}/stats/",
    headers={"Authorization": f"Token {key}"},
    timeout=10,
)
print(f"HTTP {r.status_code}")
data = r.json()

xg = data.get("xg_per_minute") or []
print(f"xG samples: {len(xg)}")
if xg:
    print("first:", json.dumps(xg[0], indent=2))
    print("last:", json.dumps(xg[-1], indent=2))
else:
    print("No xg_per_minute data for this match.")
