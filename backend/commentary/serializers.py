from rest_framework import serializers
from .models import CommentaryItem, SpeechJob


class SpeechJobSerializer(serializers.ModelSerializer):
    commentary_id = serializers.UUIDField(source="commentary_item.id", read_only=True)

    class Meta:
        model = SpeechJob
        fields = [
            "id", "commentary_id", "status", "provider",
            "audio_url", "duration_seconds", "created_at", "played_at",
        ]
        
class CommentaryItemSerializer(serializers.ModelSerializer):
    trigger_event_id = serializers.CharField(
        source="trigger_event.provider_event_id", allow_null=True, read_only=True
    )

    class Meta:
        model = CommentaryItem
        fields = [
            "id", "trigger_event_id", "mode", "status", "text",
            "language", "priority", "source_facts", "model_version",
            "expires_at", "created_at",
        ]
        read_only_fields = fields