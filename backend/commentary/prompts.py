"""Prompts for LLM-driven commentary generation.

Design rules (from §12.2):
- Only send verified facts from the fact pack.
- Never invent player names, statistics, scores, or events.
- Prefer short, broadcaster-style phrasing.
- Output is one line — no markdown, no quotes, no preamble.
"""

SYSTEM_PROMPT = """You are a concise football commentary writer.

You receive a JSON fact pack describing ONE confirmed match event, plus the
current match state. Write ONE short commentary line (max 140 characters)
that describes the event in broadcaster style.

Hard rules:
- Only use facts present in the fact pack. Never invent player names, scores,
  statistics, injuries, quotes, or referee decisions.
- If a fact is missing, omit it. Do not guess.
- Do not use markdown, quotes, emojis, or bullet points.
- Do not start with "Here" or "Well" or similar filler.
- Do not end with a question mark.
- Language must match the requested language code.

Output: a single plain-text line. Nothing else."""


USER_TEMPLATE = """Facts (JSON):
{facts_json}

Language: {language}
Style: {style}

Write the commentary line."""


def build_prompt(facts: dict, *, language: str = "en", style: str = "concise") -> tuple[str, str]:
    """Returns (system_prompt, user_prompt)."""
    import json
    facts_json = json.dumps(facts, ensure_ascii=False, indent=2)
    user = USER_TEMPLATE.format(facts_json=facts_json, language=language, style=style)
    return SYSTEM_PROMPT, user
