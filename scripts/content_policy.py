"""Shared family-friendly dictionary policy loader for build scripts."""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POLICY = json.loads((ROOT / "src" / "content" / "dictionary-policy.json").read_text(encoding="utf-8"))
BLOCKED = [re.compile(pattern, re.IGNORECASE) for pattern in POLICY["blockedSensePatterns"]]


def sanitize(word, pinyin, senses):
    override = POLICY["wordOverrides"].get(word)
    candidates = override.get("senses", []) if override else senses
    kept = [sense.strip() for sense in candidates if sense.strip() and not any(p.search(sense) for p in BLOCKED)]
    if not kept:
        return None
    return override.get("pinyin", pinyin) if override else pinyin, kept
