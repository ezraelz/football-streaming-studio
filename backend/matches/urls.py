from django.urls import path
from . import views

urlpatterns = [
    path("fixtures", views.list_fixtures, name="fixtures-list"),
    path("matches/<str:match_id>", views.get_match, name="match-detail"),
    path("matches/<str:match_id>/events", views.get_events, name="match-events"),
    path("matches/<str:match_id>/lineups", views.get_lineups, name="match-lineups"),
    path("matches/<str:match_id>/h2h", views.get_h2h),
    path("matches/<str:match_id>/prediction", views.get_prediction),
    path("teams/<str:team_id>/fixtures", views.get_team_fixtures),
]