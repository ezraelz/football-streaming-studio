from rest_framework import serializers

from .models import ShowProfile, ShowSession


class ShowProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShowProfile
        fields = ["id", "name", "mode", "theme_config", "commentary_config", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ShowProfileCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShowProfile
        fields = ["name", "mode", "theme_config", "commentary_config"]


class ShowSessionSerializer(serializers.ModelSerializer):
    match_id = serializers.CharField(source="match.provider_match_id", read_only=True)
    show_profile_id = serializers.UUIDField(source="show_profile.id", read_only=True)

    class Meta:
        model = ShowSession
        fields = [
            "id", "show_profile_id", "match_id", "mode", "state",
            "started_at", "stopped_at", "overlay_token", "created_at",
        ]


class CreateShowSessionSerializer(serializers.Serializer):
    show_profile_id = serializers.UUIDField()
    match_id = serializers.CharField()  # the provider_match_id string