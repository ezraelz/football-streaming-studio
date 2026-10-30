import os, json, requests
from dotenv import load_dotenv
load_dotenv(".env")

import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from matches.models import Match

key = os.getenv("FOOTBALL_API_KEY")

# Try the top leagues first
for league_name in ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"]:
    candidates = Match.objects.filter(
        provider="bzzoiro",
        competition__icontains=league_name,
    ).order_by("-kickoff")[:5]

    for m in candidates:
        r = requests.get(
            f"https://sports.bzzoiro.com/api/v2/events/{m.provider_match_id}/player-stats/",
            headers={"Authorization": f"Token {key}"},
            timeout=10,
        )
        if not r.ok:
            continue
        data = r.json()
        count = data.get("count") or 0
        if count > 0:
            print(f"FOUND: {m.competition}")
            print(f"  match: {m.provider_match_id} · {m.home_team_short} vs {m.away_team_short}")
            print(f"  kickoff: {m.kickoff}")
            print(f"  player_stats count: {count}")
            players = data.get("player_stats") or []
            if players:
                print(f"  FIRST PLAYER (raw):")
                print(json.dumps(players[0], indent=2))
            break
    else:
        continue
    break
else:
    print("No match with player-stats found in your DB. Try refreshing fixtures from a top league.")
