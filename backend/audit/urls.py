from django.urls import path
from . import views

urlpatterns = [
    path("show-sessions/<uuid:session_id>/log", views.session_log, name="session-log"),
]