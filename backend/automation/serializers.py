from rest_framework import serializers
from .models import AutomationRule


class AutomationRuleSerializer(serializers.ModelSerializer):
    show_profile_id = serializers.UUIDField(source="show_profile.id", read_only=True)

    class Meta:
        model = AutomationRule
        fields = [
            "id", "show_profile_id", "label", "enabled",
            "event_type", "required_status", "actions",
            "deduplicate_event", "require_fresh_match_state", "cooldown_seconds",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "show_profile_id", "created_at", "updated_at"]