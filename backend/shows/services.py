import secrets
from datetime import datetime

from django.db import transaction
from django.utils import timezone as djtz

from .models import ShowProfile, ShowSession


# Allowed state transitions (§10.2)
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "configured": {"armed"},
    "armed": {"live", "configured"},
    "live": {"paused", "stopped", "degraded"},
    "paused": {"live", "stopped"},
    "degraded": {"live", "paused", "stopped"},
    "stopped": {"configured"},
}


class InvalidTransition(Exception):
    def __init__(self, current: str, target: str):
        super().__init__(f"Cannot transition {current} → {target}")
        self.current = current
        self.target = target


def generate_overlay_token() -> str:
    """Short-ish opaque token. Replace with signed JWT in production."""
    return secrets.token_urlsafe(48)


@transaction.atomic
def create_session(*, profile: ShowProfile, match) -> ShowSession:
    session = ShowSession.objects.create(
        show_profile=profile,
        match=match,
        mode=profile.mode,
        state="configured",
        overlay_token=generate_overlay_token(),
    )
    return session


@transaction.atomic
def transition(session, target, *, actor=None):
    if target not in ALLOWED_TRANSITIONS.get(session.state, set()):
        raise InvalidTransition(session.state, target)

    now = djtz.now()
    if target == "live" and session.started_at is None:
        session.started_at = now
    if target == "stopped":
        session.stopped_at = now

    session.state = target
    session.save(update_fields=["state", "started_at", "stopped_at", "updated_at"])

    broadcast_session_update(session)

    # NEW:
    from audit.services import log_and_broadcast
    from audit.models import LogKind
    log_and_broadcast(
        session,
        LogKind.OVERRIDE,
        f"Controller → {target}",
        detail={"actor": getattr(actor, "username", None), "to": target},
    )

    return session


@transaction.atomic
def rotate_token(session: ShowSession) -> ShowSession:
    session.overlay_token = generate_overlay_token()
    session.save(update_fields=["overlay_token", "updated_at"])
    return session

def _serialize_session(session) -> dict:
    # Import lazily to avoid cycles
    from .serializers import ShowSessionSerializer
    return dict(ShowSessionSerializer(session).data)


def broadcast_session_update(session) -> None:
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import session_group

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        session_group(str(session.id)),
        {"type": "session_event", "data": _serialize_session(session)},
    )
