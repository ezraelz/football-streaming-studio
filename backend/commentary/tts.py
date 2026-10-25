"""
TTS provider adapter. Same pattern as the LLM adapter:
  - abstract interface
  - one concrete provider per backend
  - graceful degradation (raise on failure, caller falls back or logs)
"""

import asyncio
import os
import time
from abc import ABC, abstractmethod
from pathlib import Path


class TTSProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def synthesize(self, text: str, *, voice: str, language: str, out_path: Path) -> None:
        """Write a playable audio file to out_path. Raise on failure."""


# --- Edge TTS (default, no key required) ---

class EdgeTTSProvider(TTSProvider):
    name = "tts:edge"

    async def synthesize(self, text: str, *, voice: str, language: str, out_path: Path) -> None:
        import edge_tts

        # Map our internal voice names to edge-tts voice IDs.
        # edge-tts voices follow: {locale}-{Name}Neural
        edge_voice = _resolve_edge_voice(voice, language)

        communicate = edge_tts.Communicate(text=text, voice=edge_voice)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        await communicate.save(str(out_path))
        self.name = f"tts:edge:{edge_voice}"


# --- ElevenLabs (production-quality, requires key) ---

class ElevenLabsTTSProvider(TTSProvider):
    name = "tts:elevenlabs"

    def __init__(self, voice_id: str | None = None):
        self.api_key = os.getenv("ELEVENLABS_API_KEY")
        self.voice_id = voice_id or os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
        if not self.api_key:
            raise RuntimeError("ELEVENLABS_API_KEY not set")

    async def synthesize(self, text: str, *, voice: str, language: str, out_path: Path) -> None:
        import httpx

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        body = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(resp.content)
        self.name = f"tts:elevenlabs:{self.voice_id}"


# --- helpers ---

_EDGE_VOICE_MAP = {
    # Our internal voice names → edge-tts voice IDs
    "en-US-Neural-A": "en-US-AriaNeural",
    "en-US-Neural-B": "en-US-GuyNeural",
    "en-GB-Neural-A": "en-GB-SoniaNeural",
    "en-GB-Neural-B": "en-GB-RyanNeural",
}

_LANG_DEFAULT_VOICE = {
    "en": "en-US-AriaNeural",
    "es": "es-ES-ElviraNeural",
    "pt": "pt-BR-FranciscaNeural",
    "fr": "fr-FR-DeniseNeural",
}


def _resolve_edge_voice(voice: str, language: str) -> str:
    if voice in _EDGE_VOICE_MAP:
        return _EDGE_VOICE_MAP[voice]
    return _LANG_DEFAULT_VOICE.get(language, "en-US-AriaNeural")


def get_tts_provider() -> TTSProvider:
    """Select the TTS provider based on TTS_PROVIDER env var."""
    provider = os.getenv("TTS_PROVIDER", "edge").lower()
    if provider == "elevenlabs":
        try:
            return ElevenLabsTTSProvider()
        except Exception:
            return EdgeTTSProvider()
    return EdgeTTSProvider()