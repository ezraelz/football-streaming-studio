import os
import json
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from dotenv import load_dotenv
load_dotenv(".env")

from django.test import Client
from django.contrib.auth import get_user_model
from shows.models import ShowSession

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()
if not user:
    print("No superuser found")
    raise SystemExit(1)

session = ShowSession.objects.first()
if not session:
    print("No show session found")
    raise SystemExit(1)

print(f"Testing as user={user.username} session={session.id}")

c = Client()
c.force_login(user)
r = c.get(f"/api/v1/show-sessions/{session.id}/live-scores")
print(f"HTTP {r.status_code}")
print(json.dumps(r.json(), indent=2)[:2000])
