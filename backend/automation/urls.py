from django.urls import path
from . import views

urlpatterns = [
    path("shows/<uuid:profile_id>/automation-rules", views.rules_for_profile),
    path("automation-rules/<uuid:rule_id>", views.rule_detail),
]