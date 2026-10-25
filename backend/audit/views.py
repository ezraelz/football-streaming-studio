from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from shows.models import ShowSession
from .models import ShowLogEntry
from .serializers import ShowLogEntrySerializer


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def session_log(request, session_id):
    session = get_object_or_404(
        ShowSession, id=session_id, show_profile__owner=request.user
    )

    if request.method == "DELETE":
        deleted, _ = session.log_entries.all().delete()
        return Response({"deleted": deleted})

    qs = session.log_entries.all()
    if kind := request.query_params.get("kind"):
        qs = qs.filter(kind=kind)
    if severity := request.query_params.get("severity"):
        qs = qs.filter(severity=severity)
    qs = qs[:500]
    return Response(ShowLogEntrySerializer(qs, many=True).data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def clear_session_log(request, session_id):
    session = get_object_or_404(
        ShowSession, id=session_id, show_profile__owner=request.user
    )
    deleted, _ = session.log_entries.all().delete()
    return Response({"deleted": deleted}, status=status.HTTP_200_OK)