import os
import time
from abc import ABC, abstractmethod

from .prompts import build_prompt


class CommentaryGenerator(ABC):
    name: str = "base"

    @abstractmethod
    def generate(self, facts: dict, *, style: str = "concise") -> str:
        """Return one commentary line, or raise on failure."""


# --- Deterministic fallback (unchanged behavior) ---

class TemplateGenerator(CommentaryGenerator):
    name = "template"

    def generate(self, facts: dict, *, style: str = "concise") -> str:
        ev = facts["event"]
        match = facts["match"]
        score = facts.get("score") or {}
        etype = ev["type"]
        player = ev.get("player_name") or "the player"
        team = ev.get("team_name") or "the team"

        if etype == "goal":
            if not score:
                return f"Goal for {team}! {player} scores at {ev['minute']}'."
            h = score.get("home", 0)
            a = score.get("away", 0)
            return (
                f"GOAL! {player} scores for {team}. "
                f"It's {match['home_short']} {h}–{a} {match['away_short']}."
            )
        if etype == "card":
            return f"{player} goes into the book for {team} at {ev['minute']}'."
        if etype == "substitution":
            return f"{team} make a change at {ev['minute']}' — {player} comes on."
        return f"{team} with a {etype} at {ev['minute']}'."


# --- Shared helpers for real providers ---

def _language_from_facts(facts: dict) -> str:
    return facts.get("language", "en") or "en"


def _post_process(raw: str) -> str:
    """Trim, strip wrappers, enforce length and no trailing punctuation issues."""
    line = raw.strip()
    # Strip surrounding quotes the model sometimes adds
    if len(line) >= 2 and line[0] in "\"'" and line[-1] == line[0]:
        line = line[1:-1]
    # Remove markdown code fences if present
    if line.startswith("```"):
        line = line.strip("`").strip()
    # Kill markdown bold/italic markers
    for marker in ("**", "__", "*", "_"):
        line = line.replace(marker, "")
    # Collapse whitespace
    line = " ".join(line.split())
    # Enforce max length (spec: 140)
    if len(line) > 140:
        line = line[:137].rstrip() + "…"
    return line

# --- Groq (OpenAI-compatible) ---
class GroqGenerator(CommentaryGenerator):
    name = "llm:groq"

    def __init__(self, model: str | None = None):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.model = model or os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY not set")

    def generate(self, facts: dict, *, style: str = "concise") -> str:
        from openai import OpenAI

        system, user = build_prompt(
            facts, language=_language_from_facts(facts), style=style
        )
        client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        started = time.monotonic()

        # Plain shape — no reasoning_effort, no include_reasoning, no
        # max_completion_tokens. Just classic max_tokens. This is the only
        # shape that reliably returns content from every Groq model.
        resp = client.chat.completions.create(
            model=self.model,
            temperature=0.4,
            max_tokens=120,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        elapsed = time.monotonic() - started

        msg = resp.choices[0].message
        raw = msg.content or ""

        # Some reasoning models put the answer in `.reasoning` when content
        # is empty. Check both, prefer content.
        if not raw.strip():
            reasoning = getattr(msg, "reasoning", None) or ""
            if reasoning.strip():
                raw = reasoning

        if not raw.strip():
            raise RuntimeError(
                f"Empty completion from {self.model} "
                f"(finish_reason={resp.choices[0].finish_reason})"
            )

        self.name = f"llm:groq:{self.model}:{int(elapsed * 1000)}ms"
        return _post_process(raw)
    
# --- Anthropic ---

class AnthropicGenerator(CommentaryGenerator):
    name = "llm:anthropic"

    def __init__(self, model: str = "claude-3-5-haiku-20241022"):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.model = model
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")

    def generate(self, facts: dict, *, style: str = "concise") -> str:
        from anthropic import Anthropic

        system, user = build_prompt(
            facts, language=_language_from_facts(facts), style=style
        )
        client = Anthropic(api_key=self.api_key)
        started = time.monotonic()
        resp = client.messages.create(
            model=self.model,
            max_tokens=80,
            temperature=0.4,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        elapsed = time.monotonic() - started
        text = "".join(
            block.text for block in resp.content if getattr(block, "type", "") == "text"
        )
        # Log elapsed time in the model name so the audit trail captures latency
        self.name = f"llm:anthropic:{self.model}:{int(elapsed * 1000)}ms"
        return _post_process(text)


# --- OpenAI ---

class OpenAIGenerator(CommentaryGenerator):
    name = "llm:openai"

    def __init__(self, model: str | None = None):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY not set")

    def generate(self, facts: dict, *, style: str = "concise") -> str:
        from openai import OpenAI

        system, user = build_prompt(
            facts, language=_language_from_facts(facts), style=style
        )
        client = OpenAI(api_key=self.api_key)
        started = time.monotonic()

        # Reasoning models (o-series, gpt-5 base) reject non-default temperature.
        # Standard models (gpt-4o, gpt-4o-mini, gpt-4.1) accept it.
        model_lower = self.model.lower()
        is_reasoning = (
            model_lower.startswith(("o1", "o3", "o4"))
            or (model_lower.startswith("gpt-5") and "chat" not in model_lower)
        )

        kwargs = dict(
            model=self.model,
            max_tokens=80,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        if not is_reasoning:
            kwargs["temperature"] = 0.4

        resp = client.chat.completions.create(**kwargs)
        elapsed = time.monotonic() - started
        text = resp.choices[0].message.content or ""
        self.name = f"llm:openai:{self.model}:{int(elapsed * 1000)}ms"
        return _post_process(text)


# --- Local Ollama (OpenAI-compatible) ---

class OllamaGenerator(CommentaryGenerator):
    name = "llm:ollama"

    def __init__(self, model: str | None = None):
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2:3b")

    def generate(self, facts: dict, *, style: str = "concise") -> str:
        from openai import OpenAI

        system, user = build_prompt(
            facts, language=_language_from_facts(facts), style=style
        )
        client = OpenAI(
            api_key="ollama",  # placeholder, Ollama ignores
            base_url=f"{self.base_url}/v1",
        )
        started = time.monotonic()
        resp = client.chat.completions.create(
            model=self.model,
            temperature=0.4,
            max_tokens=80,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        elapsed = time.monotonic() - started
        text = resp.choices[0].message.content or ""
        self.name = f"llm:ollama:{self.model}:{int(elapsed * 1000)}ms"
        return _post_process(text)