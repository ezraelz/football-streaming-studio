"""
Thin wrapper around obsws-python (OBS WebSocket v5) with graceful degradation.

Design:
  - Global singleton that connects lazily on first use.
  - All calls are wrapped in try/except; OBS being down is NEVER fatal.
  - Scene-name mapping is handled by the caller.
"""

import logging
import os
import threading
from typing import Optional
from dotenv import load_dotenv
load_dotenv()  
logger = logging.getLogger(__name__)

_lock = threading.Lock()
_client = None
_connected = False


def _get_client():
    """Lazy-connect. Returns the obsws-python ReqClient or None if unavailable."""
    global _client, _connected
    with _lock:
        if _client is not None and _connected:
            return _client

        try:
            from obsws_python import ReqClient

            url = os.getenv("OBS_WS_URL", "ws://127.0.0.1:4455")
            password = os.getenv("OBS_WS_PASSWORD", "")

            # Strip scheme
            hostport = url.replace("ws://", "").replace("wss://", "").rstrip("/")

            # Split host and port — CRITICAL: ReqClient wants them as separate args
            if ":" in hostport:
                host, port_str = hostport.rsplit(":", 1)
                port = int(port_str)
            else:
                host, port = hostport, 4455

            logger.info("Attempting OBS connection to %s:%s", host, port)
            ws = ReqClient(host=host, port=port, password=password)
            # Validate with a lightweight call
            ws.get_version()

            _client = ws
            _connected = True
            logger.info("OBS WebSocket connected at %s:%s", host, port)
            return ws
        except Exception as e:
            logger.warning("OBS WebSocket not available: %s", e)
            _client = None
            _connected = False
            return None


def is_connected() -> bool:
    return _connected


def set_current_scene(scene_name: str) -> bool:
    """Switch OBS to the given scene by name. Returns True on success."""
    ws = _get_client()
    if ws is None:
        return False

    try:
        ws.set_current_program_scene(scene_name)
        logger.info("OBS scene → %s", scene_name)
        return True
    except Exception as e:
        logger.warning("OBS set scene failed: %s", e)
        global _connected
        _connected = False
        return False


def get_current_scene() -> Optional[str]:
    """Return the current OBS scene name, or None if unavailable."""
    ws = _get_client()
    if ws is None:
        return None
    try:
        resp = ws.get_current_program_scene()
        return resp.scene_name
    except Exception as e:
        logger.warning("OBS get scene failed: %s", e)
        return None


def disconnect():
    global _client, _connected
    with _lock:
        if _client is not None:
            try:
                _client.disconnect()
            except Exception:
                pass
        _client = None
        _connected = False

def ensure_scene_with_browser_source(
    scene_name: str,
    source_name: str,
    url: str,
    width: int = 1920,
    height: int = 1080,
) -> bool:
    """
    Ensure an OBS scene exists with a Browser Source pointing at `url`.
    Idempotent. Returns True only if the source is confirmed present after the call.
    """
    ws = _get_client()
    if ws is None:
        logger.warning("ensure_scene: OBS not connected")
        return False

    try:
        # 1. Ensure the scene exists
        try:
            existing_scenes = {s["sceneName"] for s in ws.get_scene_list().scenes}
        except Exception as e:
            logger.warning("get_scene_list failed: %s", e)
            existing_scenes = set()

        if scene_name not in existing_scenes:
            logger.info("Creating OBS scene: %s", scene_name)
            ws.create_scene(sceneName=scene_name)

        # 2. Check whether the input exists (globally, not per scene)
        try:
            all_inputs = {i["inputName"] for i in ws.get_input_list().inputs}
        except Exception as e:
            logger.warning("get_input_list failed: %s", e)
            all_inputs = set()

        input_exists = source_name in all_inputs

        if not input_exists:
            logger.info(
                "Creating browser source '%s' in scene '%s' → %s",
                source_name, scene_name, url,
            )
            ws.create_input(
                sceneName=scene_name,
                inputName=source_name,
                inputKind="browser_source",
                inputSettings={
                    "url": url,
                    "width": width,
                    "height": height,
                    "shutdown": False,
                    "restart_on_activate": False,  # ← correct v5 key
                    "reroute_audio": False,
                },
                sceneItemEnabled=True,
            )
        else:
            # Update URL in place (helps when tokens rotate)
            logger.info("Updating browser source '%s' → %s", source_name, url)
            try:
                ws.set_input_settings(
                    name=source_name,
                    settings={"url": url, "width": width, "height": height},
                    overlay=True,
                )
            except Exception as e:
                logger.warning("set_input_settings failed: %s", e)

        # 3. Apply transform to make it fill the canvas
        try:
            item_id = ws.get_scene_item_id(
                scene_name=scene_name, source_name=source_name
            ).scene_item_id
            ws.set_scene_item_transform(
                scene_name=scene_name,
                item_id=item_id,
                transform={
                    "alignment": 5,
                    "boundsAlignment": 0,
                    "boundsType": "OBS_BOUNDS_SCALE_INNER",
                    "boundsWidth": width,
                    "boundsHeight": height,
                    "positionX": 0,
                    "positionY": 0,
                },
            )
        except Exception as e:
            # Transform failing is cosmetic — leave it
            logger.warning("transform failed for '%s': %s", source_name, e)

        # 4. Confirm the source is now present
        try:
            all_inputs_after = {i["inputName"] for i in ws.get_input_list().inputs}
        except Exception:
            all_inputs_after = set()

        ok = source_name in all_inputs_after
        if ok:
            logger.info("✓ Source '%s' present in OBS", source_name)
        else:
            logger.error("✗ Source '%s' STILL MISSING after create", source_name)
        return ok

    except Exception as e:
        logger.error("ensure_scene_with_browser_source failed: %s", e, exc_info=True)
        return False