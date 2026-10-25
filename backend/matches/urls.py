from django.urls import path
from . import views

urlpatterns = [
    path("fixtures", views.list_fixtures, name="fixtures-list"),
    path("matches/<str:match_id>", views.get_match, name="match-detail"),
    path("matches/<str:match_id>/events", views.get_events, name="match-events"),
    path("matches/<str:match_id>/lineups", views.get_lineups, name="match-lineups"),
]