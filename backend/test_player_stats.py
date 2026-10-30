import os, json, requests
from dotenv import load_dotenv
load_dotenv(".env")

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from matches.models import Match

key = os.getenv("FOOTBALL_API_KEY")
m = Match.objects.filter(provider="bzzoiro").order_by("-kickoff").first()

print("match:", m.provider_match_id, m.home_team_short, "vs", m.away_team_short)

r = requests.get(
    f"https://sports.bzzoiro.com/api/v2/events/{m.provider_match_id}/player-stats/",
    headers={"Authorization": f"Token {key}"},
    timeout=10,
)
print("HTTP", r.status_code)
data = r.json()

print("\n--- TOP-LEVEL SHAPE ---")
print("top keys:", list(data.keys()))
print("count field:", data.get("count"))

ps = data.get("player_stats")
print("\n--- player_stats ---")
print("type:", type(ps).__name__)

if isinstance(ps, list):
    print("length:", len(ps))
    if ps:
        print("FIRST PLAYER (raw):")
        print(json.dumps(ps[0], indent=2))
elif isinstance(ps, dict):
    print("keys:", list(ps.keys()))
    for k in list(ps.keys())[:2]:
        v = ps[k]
        print(f"\nps[{k!r}] type: {type(v).__name__}")
        if isinstance(v, list) and v:
            print("  first entry:")
            print(json.dumps(v[0], indent=2)[:1500])
        elif isinstance(v, dict):
            print(json.dumps(v, indent=2)[:1500])
