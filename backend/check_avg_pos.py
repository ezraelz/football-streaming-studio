import os, json, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from dotenv import load_dotenv
load_dotenv(".env")

import requests
from matches.models import Match

key = os.getenv("FOOTBALL_API_KEY")
# Try the same SUN vs LEE match that had xG samples
m = Match.objects.filter(provider_match_id="209614").exclude(provider="mock").first()
if not m:
    m = Match.objects.filter(competition__icontains="Premier").exclude(provider="mock").first()

print(f"Match: {m.provider_match_id} · {m.home_team_short} vs {m.away_team_short}")

r = requests.get(
    f"https://sports.bzzoiro.com/api/v2/events/{m.provider_match_id}/stats/",
    headers={"Authorization": f"Token {key}"},
    timeout=10,
)
print(f"HTTP {r.status_code}")
data = r.json()

ap = data.get("average_positions") or {}
home = ap.get("home") or []
away = ap.get("away") or []
print(f"home positions: {len(home)}")
print(f"away positions: {len(away)}")
if home:
    print("first home sample:", json.dumps(home[0], indent=2))
