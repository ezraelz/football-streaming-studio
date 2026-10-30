"""
TTS provider adapter.

Each adapter writes an audio file to disk and returns (path, duration_ms).
Base64 audio is not used — files are simpler, cacheable, and OBS can play them
via the frontend's <audio> element directly.
"""

import os
import subprocess
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path


MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "media/tts"))
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)


class TTSProvider(ABC):
    name: str = "base"

    @abstractmethod
    def synthesize(self, text: str, *, voice: str, language: str) -> tuple[Path, int]:
        """Return (audio_file_path, duration_ms)."""


class AzureTTS(TTSProvider):
    name = "azure"

    def synthesize(self, text: str, *, voice: str, language: str) -> tuple[Path, int]:
        import azure.cognitiveservices.speech as speechsdk

        key = os.getenv("AZURE_SPEECH_KEY")
        region = os.getenv("AZURE_SPEECH_REGION", "westeurope")
        if not key:
            raise RuntimeError("AZURE_SPEECH_KEY not set")

        voice = voice or os.getenv("AZURE_SPEECH_VOICE", "en-US-JennyNeural")

        out_path = MEDIA_ROOT / f"{_slug(text)}.mp3"
        speech_config = speechsdk.SpeechConfig(subscription=key, region=region)
        speech_config.speech_synthesis_voice_name = voice
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3
        )
        audio_config = speechsdk.audio.AudioOutputConfig(filename=str(out_path))
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config, audio_config=audio_config
        )
        result = synthesizer.speak_text_async(text).get()
        if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
            raise RuntimeError(f"Azure TTS failed: {result.reason}")

        # Azure doesn't report duration; estimate from mp3 bitrate (96kbps mono)
        size = out_path.stat().st_size
        duration_ms = int((size * 8) / 96)  # 96 kbps → bytes*8/96000*1000
        return out_path, duration_ms


class ElevenLabsTTS(TTSProvider):
    name = "elevenlabs"

    def synthesize(self, text: str, *, voice: str, language: str) -> tuple[Path, int]:
        import requests

        key = os.getenv("ELEVENLABS_API_KEY")
        if not key:
            raise RuntimeError("ELEVENLABS_API_KEY not set")
        voice_id = voice or os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

        r = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": key, "Content-Type": "application/json"},
            json={"text": text, "model_id": "eleven_turbo_v2"},
            timeout=30,
        )
        if not r.ok:
            raise RuntimeError(f"ElevenLabs {r.status_code}: {r.text[:200]}")

        out_path = MEDIA_ROOT / f"{_slug(text)}.mp3"
        out_path.write_bytes(r.content)

        # Rough estimate: 150 wpm average
        words = len(text.split())
        duration_ms = int((words / 150) * 60 * 1000)
        return out_path, duration_ms


class PiperTTS(TTSProvider):
    name = "piper"

    def synthesize(self, text: str, *, voice: str, language: str) -> tuple[Path, int]:
        voice_path = voice or os.getenv("PIPER_VOICE", "voices/en_US-lessac-medium.onnx")
        out_path = MEDIA_ROOT / f"{_slug(text)}.wav"

        # Piper reads text from stdin, writes wav to stdout
        process = subprocess.run(
            ["piper", "--model", voice_path, "--output_file", str(out_path)],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )
        if process.returncode != 0:
            raise RuntimeError(f"piper failed: {process.stderr.decode()[:200]}")

        # Estimate duration from wav header
        import wave
        with wave.open(str(out_path), "rb") as w:
            frames = w.getnframes()
            rate = w.getframerate()
            duration_ms = int((frames / rate) * 1000)
        return out_path, duration_ms


def _slug(text: str) -> str:
    import hashlib
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def get_provider() -> TTSProvider:
    name = os.getenv("TTS_PROVIDER", "").lower()
    if name == "azure":
        return AzureTTS()
    if name == "elevenlabs":
        return ElevenLabsTTS()
    if name == "piper":
        return PiperTTS()
    if name == "edge":
        return EdgeTTS()
    raise RuntimeError(f"Unknown TTS_PROVIDER: {name!r}")


class EdgeTTS(TTSProvider):
    name = "edge"

    def synthesize(self, text: str, *, voice: str, language: str) -> tuple[Path, int]:
        import subprocess

        voice_name = voice or "en-US-JennyNeural"
        out_path = MEDIA_ROOT / f"{_slug(text)}.mp3"

        result = subprocess.run(
            ["edge-tts", "--voice", voice_name, "--text", text, "--write-media", str(out_path)],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"edge-tts failed: {result.stderr.decode()[:200]}")

        words = len(text.split())
        duration_ms = int((words / 150) * 60 * 1000)
        return out_path, duration_ms
    