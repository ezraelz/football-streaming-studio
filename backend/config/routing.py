from django.urls import path

from matches.consumers import MatchConsumer
from shows.consumers import SessionConsumer

websocket_urlpatterns = [
    path("ws/v1/matches/<str:match_id>", MatchConsumer.as_asgi()),
    path("ws/v1/show-sessions/<str:session_id>", SessionConsumer.as_asgi()),
]