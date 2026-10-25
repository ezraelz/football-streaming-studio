from rest_framework import serializers
from .models import ShowLogEntry


class ShowLogEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ShowLogEntry
        fields = ["id", "kind", "severity", "message", "detail", "created_at"]
        read_only_fields = fields