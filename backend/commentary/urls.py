from django.urls import path
from . import views

urlpatterns = [
    path("show-sessions/<uuid:session_id>/commentary", views.list_for_session, name="commentary-list"),
    path("commentary/<uuid:item_id>/approve", views.approve, name="commentary-approve"),
    path("commentary/<uuid:item_id>/skip", views.skip, name="commentary-skip"),
    path("commentary/<uuid:item_id>/regenerate", views.regenerate, name="commentary-regenerate"),
    
    path("commentary/<uuid:item_id>/speak", views.speak),
    path("commentary/<uuid:item_id>/played", views.mark_played),
    
    path("speech/<uuid:job_id>/audio", views.serve_speech),
    path("speech/<uuid:job_id>/played", views.mark_speech_played),
]