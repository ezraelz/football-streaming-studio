from datetime import datetime, timedelta
from django.utils import timezone as djtz

from audit.models import LogKind, LogSeverity
from audit.services import log_and_broadcast
from matches.models import Match, MatchEvent
from shows.models import ShowSession

from .models import AutomationRule


DEFAULT_RULES = [
    {
        "label": "Confirmed goal",
        "event_type": "goal",
        "required_status": "confirmed",
        "actions": [
            {"type": "update_scoreboard"},
            {"type": "show_scene", "sceneId": "scoreboard"},
            {"type": "generate_commentary", "template": "goal_short"},
            {"type": "speak_if_enabled"},
        ],
        "deduplicate_event": True,
        "require_fresh_match_state": True,
        "cooldown_seconds": 8,
    },
    {
        "label": "Half-time summary",
        "event_type": "half_time",
        "required_status": "",
        "actions": [
            {"type": "show_scene", "sceneId": "stats"},
            {"type": "generate_commentary", "template": "first_half_summary"},
        ],
        "deduplicate_event": True,
        "require_fresh_match_state": True,
        "cooldown_seconds": 30,
    },
    {
        "label": "Substitution",
        "event_type": "substitution",
        "required_status": "confirmed",
        "actions": [
            {"type": "show_scene", "sceneId": "player"},
            {"type": "generate_commentary", "template": "substitution_line"},
        ],
        "deduplicate_event": True,
        "require_fresh_match_state": True,
        "cooldown_seconds": 20,
    },
    {
        "label": "Feed becomes stale",
        "event_type": "feed_stale",
        "required_status": "",
        "actions": [{"type": "show_scene", "sceneId": "scoreboard"}],
        "deduplicate_event": False,
        "require_fresh_match_state": False,
        "cooldown_seconds": 60,
    },
]


def seed_default_rules(profile) -> None:
    """Called on profile creation — idempotent."""
    if profile.automation_rules.exists():
        return
    for rule in DEFAULT_RULES:
        AutomationRule.objects.create(show_profile=profile, **rule)
        
# Actions the executor knows how to perform
SUPPORTED_ACTIONS = {"show_scene", "update_scoreboard", "generate_commentary", "speak_if_enabled"}


def _cooldown_ok(session: ShowSession, rule: AutomationRule, event_type: str) -> bool:
    """Has enough time passed since this rule last fired for this session?"""
    from audit.models import ShowLogEntry
    cutoff = djtz.now() - timedelta(seconds=rule.cooldown_seconds)
    return not ShowLogEntry.objects.filter(
        session=session,
        kind=LogKind.AUTOMATION,
        detail__rule_id=str(rule.id),
        created_at__gte=cutoff,
    ).exists()


def _event_already_handled(session: ShowSession, rule: AutomationRule, event: MatchEvent) -> bool:
    from audit.models import ShowLogEntry
    if not rule.deduplicate_event:
        return False
    return ShowLogEntry.objects.filter(
        session=session,
        kind=LogKind.AUTOMATION,
        detail__rule_id=str(rule.id),
        detail__event_id=event.provider_event_id,
    ).exists()


def _execute_action(
    session: ShowSession, event: MatchEvent, action: dict, rule: AutomationRule
) -> None:
    """Perform one action. Every action is logged + pushed over WS."""
    a_type = action.get("type")
    if a_type not in SUPPORTED_ACTIONS:
        log_and_broadcast(
            session, LogKind.AUTOMATION,
            f"Unknown action type: {a_type}",
            severity=LogSeverity.WARN,
            detail={"rule_id": str(rule.id)},
        )
        return

    if a_type == "show_scene":
        scene_id = action.get("sceneId")
        if not scene_id:
            return
        broadcast_scene_command(session, scene_id, rule_id=str(rule.id))
        log_and_broadcast(
            session, LogKind.AUTOMATION,
            f"Scene → {scene_id}",
            detail={
                "rule_id": str(rule.id),
                "event_id": event.provider_event_id,
                "action": "show_scene",
                "scene_id": scene_id,
            },
        )

    elif a_type == "update_scoreboard":
        # The scoreboard is data-driven — the overlay already picks up new
        # scores from the match socket. This action is a signal only.
        log_and_broadcast(
            session, LogKind.AUTOMATION,
            "Scoreboard update signal",
            detail={
                "rule_id": str(rule.id),
                "event_id": event.provider_event_id,
                "action": "update_scoreboard",
            },
        )

    elif a_type == "generate_commentary":
        from commentary.services import generate_for_event
        try:
            item = generate_for_event(session, event)
        except Exception as e:
            log_and_broadcast(
                session, LogKind.ERROR,
                f"Commentary generation failed: {type(e).__name__}",
                severity=LogSeverity.WARN,
                detail={"rule_id": str(rule.id), "event_id": event.provider_event_id},
            )
            return
        log_and_broadcast(
            session, LogKind.AUTOMATION,
            f"Commentary generated ({action.get('template', 'default')})",
            detail={
                "rule_id": str(rule.id),
                "event_id": event.provider_event_id,
                "action": "generate_commentary",
                "commentary_id": str(item.id) if item else None,
            },
        )

    elif a_type == "speak_if_enabled":
        from commentary.services import speak_commentary
        from commentary.models import CommentaryItem
        # Find the most recent queued commentary item for this event
        item = (
            CommentaryItem.objects
            .filter(session=session, trigger_event=event)
            .order_by("-created_at")
            .first()
        )
        if item and item.mode == "auto":
            job = speak_commentary(item)
            log_and_broadcast(
                session, LogKind.AUTOMATION,
                f"TTS queued ({'ok' if job and job.status == 'synthesized' else 'failed'})",
                detail={
                    "rule_id": str(rule.id),
                    "event_id": event.provider_event_id,
                    "action": "speak_if_enabled",
                    "speech_job_id": str(job.id) if job else None,
                },
            )


def execute_for_event(session: ShowSession, event: MatchEvent) -> int:
    """
    Run all enabled rules for a session against a single confirmed event.
    Returns the number of actions executed.
    """
    if session.state not in ("live", "paused", "degraded"):
        return 0

    from commentary.facts import build_fact_pack
    facts = build_fact_pack(event.match, event)

    if facts["freshness"] != "fresh":
        # Global guard: don't trigger automation on stale data
        return 0

    rules = AutomationRule.objects.filter(
        show_profile=session.show_profile,
        enabled=True,
        event_type=event.type,
    )

    executed = 0
    for rule in rules:
        if rule.required_status and event.status != rule.required_status:
            continue
        if _event_already_handled(session, rule, event):
            continue
        if not _cooldown_ok(session, rule, event.type):
            log_and_broadcast(
                session, LogKind.AUTOMATION,
                f"Skipped {rule.label}: cooldown active",
                severity=LogSeverity.INFO,
                detail={"rule_id": str(rule.id), "event_id": event.provider_event_id},
            )
            continue

        for action in (rule.actions or []):
            _execute_action(session, event, action, rule)
            executed += 1

    return executed

def broadcast_scene_command(session: ShowSession, scene_id: str, *, rule_id: str | None = None) -> None:
    """Push a scene-change command to the studio WS AND to OBS (if connected)."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from audit.groups import session_group

    # 1. Tell the studio UI
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        session_group(str(session.id)),
        {
            "type": "scene_event",
            "data": {
                "scene_id": scene_id,
                "rule_id": rule_id,
                "source": "automation",
            },
        },
    )

    # 2. Tell OBS, if connected
    from shows import obs_client
    from shows.obs_config import obs_scene_name
    obs_name = obs_scene_name(scene_id)
    obs_client.set_current_scene(obs_name)