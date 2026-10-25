from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from shows.models import ShowProfile
from .models import AutomationRule
from .serializers import AutomationRuleSerializer


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def rules_for_profile(request, profile_id):
    profile = get_object_or_404(ShowProfile, id=profile_id, owner=request.user)

    if request.method == "GET":
        qs = profile.automation_rules.all()
        return Response(AutomationRuleSerializer(qs, many=True).data)

    serializer = AutomationRuleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    rule = serializer.save(show_profile=profile)
    return Response(AutomationRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def rule_detail(request, rule_id):
    rule = get_object_or_404(
        AutomationRule, id=rule_id, show_profile__owner=request.user
    )

    if request.method == "GET":
        return Response(AutomationRuleSerializer(rule).data)
    if request.method == "DELETE":
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = AutomationRuleSerializer(rule, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)