"""
Thin wrapper around obs-websocket-py with graceful degradation.

Design:
  - Global singleton that connects lazily on first use.
  - All calls are wrapped in try/except; OBS being down is NEVER fatal.
  - Scene-name mapping is handled by the caller (OBS scene names may differ
    from our internal scene keys).
"""

import logging
import os
import threading
from typing import Optional

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_client = None
_connected = False



def _get_client():
    """Lazy-connect. Returns the obs-websocket client or None if unavailable."""
    global _client, _connected
    with _lock:
        if _client is not None and _connected:
            return _client

        try:
            from obswebsocket import obsws
            url = os.getenv("OBS_WS_URL", "ws://localhost:4455")
            password = os.getenv("OBS_WS_PASSWORD", "")

            # Parse ws://host:port
            if url.startswith("ws://"):
                host_port = url[5:]
            elif url.startswith("wss://"):
                host_port = url[6:]
            else:
                host_port = url
            if ":" in host_port:
                host, port = host_port.rsplit(":", 1)
                port = int(port)
            else:
                host, port = host_port, 4455

            ws = obsws(host, port, password)
            ws.connect()
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
    """
    Switch OBS to the given scene by name.
    Returns True on success, False on any failure.
    """
    ws = _get_client()
    if ws is None:
        return False

    try:
        from obswebsocket import requests as obs_requests
        ws.call(obs_requests.SetCurrentProgramScene(sceneName=scene_name))
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
        from obswebsocket import requests as obs_requests
        resp = ws.call(obs_requests.GetCurrentScene())
        return resp.getName()
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
        
def ensure_scene_with_browser_source(scene_name: str, source_name: str, url: str, width: int = 1920, height: int = 1080) -> bool:
    """
    Ensures an OBS scene exists, then creates a Browser Source inside it pointing to the given URL.
    Returns True if successful (or if it already existed), False on failure.
    """
    ws = _get_client()
    if ws is None:
        return False

    try:
        from obswebsocket import requests as obs_requests

        # 1. Check if the scene already exists to avoid errors on re-runs
        scenes = ws.call(obs_requests.GetSceneList())
        existing_scenes = [s['sceneName'] for s in scenes.getScenes()]
        if scene_name not in existing_scenes:
            logger.info("Creating OBS scene: %s", scene_name)
            ws.call(obs_requests.CreateScene(sceneName=scene_name))

        # 2. Check if the source already exists in that scene (optional but safer)
        # For simplicity, we'll just try to create it. If it exists, OBS returns an error.
        # A more robust check would use GetSceneItemList.
        try:
            ws.call(obs_requests.CreateInput(
                sceneName=scene_name,
                inputName=source_name,
                inputKind="browser_source",
                inputSettings={
                    "url": url,
                    "width": width,
                    "height": height,
                    "shutdown": False,       # Keep source alive even when not visible
                    "restart_when_active": False, # Prevent reloading on every scene switch
                },
                sceneItemEnabled=True
            ))
            logger.info("Created browser source '%s' in scene '%s'", source_name, scene_name)
        except Exception as e:
            # If the source already exists, OBS will return an error. We can ignore it.
            logger.warning("Could not create source (may already exist): %s", e)

        return True
    except Exception as e:
        logger.warning("OBS scene/source creation failed: %s", e)
        return False
    