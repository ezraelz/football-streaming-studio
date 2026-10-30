from django.urls import path, re_path
from . import views

urlpatterns = [
    path("shows", views.profiles, name="shows-list"),
    path("shows/<uuid:profile_id>", views.profile_detail, name="shows-detail"),

    path("show-sessions/<uuid:session_id>/set-scene", views.set_scene, name="show-sessions-set-scene"),
    path("show-sessions", views.show_sessions, name="show-sessions"),    path("show-sessions/all", views.list_sessions, name="show-sessions-list"),
    path("show-sessions/<uuid:session_id>", views.session_detail, name="show-sessions-detail"),
    path(
        "show-sessions/<uuid:session_id>/provision-obs",
        views.provision_obs,
        name="show-sessions-provision-obs",
    ),
    path(
        "show-sessions/<uuid:session_id>/match-availability",
        views.match_availability,
        name="show-sessions-match-availability",
    ),
    path(
        "show-sessions/<uuid:session_id>/live-scores",
        views.live_scores,
        name="show-sessions-live-scores",
    ),
    
    path(
        "show-sessions/<uuid:session_id>/player-stats-list",
        views.match_player_stats_list,
        name="show-sessions-player-stats-list",
    ),
    # Only match known transition targets — no wildcard.
    # This prevents /commentary, /log, etc. from being swallowed.
    re_path(
        r"^show-sessions/(?P<session_id>[0-9a-f-]{36})/(?P<target>armed|live|paused|stopped|configured|degraded)$",
        views.transition_view,
        name="show-sessions-transition",
    ),

    path(
        "show-sessions/<uuid:session_id>/rotate-token",
        views.rotate_token_view,
        name="show-sessions-rotate",
    ),

    path("overlay/<str:token>/state", views.overlay_state, name="overlay-state"),
    path("obs/status", views.obs_status, name="obs-status"),
    
    path(
        "show-sessions/<uuid:session_id>/editorial-cards",
        views.editorial_cards,
        name="editorial-cards",
    ),
    path(
        "show-sessions/<uuid:session_id>/editorial-cards/<uuid:card_id>",
        views.editorial_card_detail,
        name="editorial-card-detail",
    ),
    path(
        "show-sessions/<uuid:session_id>/editorial-cards/<uuid:card_id>/broadcast",
        views.broadcast_editorial,
        name="editorial-card-broadcast",
    ),
    path(
        "show-sessions/<uuid:session_id>/editorial-cards/hide",
        views.hide_all_editorial,
        name="editorial-card-hide",
    ),
    path(
        "show-sessions/<uuid:session_id>/editorial-cards/seed/<str:card_type>",
        views.seed_editorial,
        name="editorial-card-seed",
    ),
    
]