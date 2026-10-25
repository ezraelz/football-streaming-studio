from django.db import transaction
from django.utils import timezone as djtz

from .models import ShowLogEntry, LogKind, LogSeverity


@transaction.atomic
def log(
    session,
    kind: str,
    message: str,
    *,
    severity: str = LogSeverity.INFO,
    detail: dict | None = None,
) -> ShowLogEntry:
    """Persist an audit entry for a show session."""
    if kind not in LogKind.values:
        raise ValueError(f"Unknown log kind: {kind}")
    return ShowLogEntry._default_manager.create(
        session=session,
        kind=kind,
        severity=severity,
        message=message,
        detail=detail or {},
    )

def broadcast_log(session, entry) -> None:
    """Send the log line to any WS subscriber of this session."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import session_group
    from .serializers import ShowLogEntrySerializer

    data = ShowLogEntrySerializer(entry).data
    # Convert UUID to str for JSON
    data["id"] = str(data["id"])
    data["created_at"] = data["created_at"]
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        session_group(str(session.id)),
        {"type": "log_event", "data": data},
    )


def log_and_broadcast(session, kind, message, *, severity=LogSeverity.INFO, detail=None):
    entry = log(session, kind, message, severity=severity, detail=detail)
    broadcast_log(session, entry)
    return entry