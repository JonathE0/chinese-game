"""Build the HSK vocabulary list used by the study hall.

    curl -L -o hsk-source.json https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json
    .venv/Scripts/python.exe scripts/build-hsk.py hsk-source.json

Source: complete-hsk-vocabulary (MIT, Yanis Zafiropulos), which tags each word with
HSK 3.0 bands (n1-n7), classic HSK 2.0 bands (o1-o6) and TOCFL bands. This script keeps
the two HSK standards in separate fields so they are never silently mixed, and records
that the mapping has not been verified against the official syllabus.
"""
import hashlib, json, sys
from pathlib import Path
from content_policy import sanitize

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "hsk" / "words.json"
META = ROOT / "src" / "content" / "hsk.json"
NEW_BANDS = ["n1", "n2", "n3", "n4", "n5", "n6"]
AUDIO_LEVELS = {1, 2, 3}    # levels with generated clips; see docs/VOICE_PRODUCTION.md
READINGS = json.loads((ROOT/'src/content/hsk-readings.json').read_text(encoding='utf8'))
CHINESE = json.loads((ROOT/'src/content/hsk-chinese.json').read_text(encoding='utf8'))
for line in (ROOT/'src/content/hsk-authored.tsv').read_text(encoding='utf8').splitlines():
    word, definition = line.split('\t', 1)
    CHINESE[word] = {'text':definition, 'source':'authored'}

SYLLABUS = {
    "standard": "HSK 3.0",
    "fullName": "国际中文教育中文水平等级标准 (2021)",
    "shortName": "HSK 3.0 (2021 standard)",
    "source": "https://www.chinesetest.cn/syllabus",
    "dataset": "complete-hsk-vocabulary (MIT) — https://github.com/drkameleon/complete-hsk-vocabulary",
    "validated": False,
    "validationNote": (
        "Levels come from the dataset above and have NOT been verified word-by-word against the "
        "official published syllabus. Classic HSK 2.0 bands are carried separately in legacyLevel "
        "and are never merged with HSK 3.0 levels."
    ),
}
LEVEL_NAMES = {
    1: {"zh": "一级", "en": "Level 1 — first words"},
    2: {"zh": "二级", "en": "Level 2 — everyday basics"},
    3: {"zh": "三级", "en": "Level 3 — getting around"},
    4: {"zh": "四级", "en": "Level 4 — opinions and plans"},
    5: {"zh": "五级", "en": "Level 5 — fuller conversation"},
    6: {"zh": "六级", "en": "Level 6 — abstract and formal"},
}


def pick_form(entry):
    """Prefer the everyday reading over a proper-noun one (CC-CEDICT style capitalisation)."""
    forms = entry.get("f") or []
    if not forms:
        return None
    preferred=READINGS.get(entry.get('s'))
    def score(f):
        p=f.get('i',{}).get('y','')
        meanings=f.get('m',[])
        reference=all(m.startswith(('variant of','old variant','used in','see ','surname ')) for m in meanings)
        return (reference, bool(preferred and p!=preferred), p[:1].isupper(), -len(meanings))
    forms = sorted(forms, key=score)
    return forms[0]


def main():
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "hsk-source.json")
    if not source.exists():
        raise SystemExit(f"{source} not found. See the docstring for the download command.")
    data = json.loads(source.read_text(encoding="utf-8"))

    words, seen = [], set()
    filtered_senses = removed_words = 0
    for entry in data:
        bands = entry.get("l") or []
        band = next((b for b in NEW_BANDS if b in bands), None)
        if band is None:
            continue
        simplified = entry.get("s")
        form = pick_form(entry)
        if not simplified or not form or simplified in seen:
            continue
        raw_meanings = [m for m in (form.get("m") or []) if m and not m.startswith("CL:")]
        pinyin = form.get("i", {}).get("y", "").strip()
        cleaned = sanitize(simplified, pinyin, raw_meanings)
        filtered_senses += len(raw_meanings) - (len(cleaned[1]) if cleaned else 0)
        if not cleaned or not pinyin:
            removed_words += 1
            continue
        pinyin, meanings = cleaned
        seen.add(simplified)
        level = int(band[1])
        legacy = next((int(b[1]) for b in ("o1", "o2", "o3", "o4", "o5", "o6") if b in bands), None)
        record = {
            "id": "hsk-" + hashlib.sha1(simplified.encode("utf-8")).hexdigest()[:8],
            "zh": simplified,
            "pinyin": pinyin,
            "en": "; ".join(meanings),
            "level": level,
            "pos": (entry.get("p") or [None])[0],
            "rank": entry.get("q"),
            "definitionZh": CHINESE[simplified]['text'],
            "definitionSource": CHINESE[simplified]['source'],
        }
        if CHINESE[simplified].get('title'):record['definitionTitle']=CHINESE[simplified]['title']
        readings=[]
        for other in entry.get('f',[]):
            reading=other.get('i',{}).get('y','')
            gloss='; '.join(other.get('m',[]))
            if other is form or not gloss or simplified=='黄':continue
            candidate={'pinyin':reading,'en':gloss}
            if candidate not in readings:readings.append(candidate)
        if readings:record['readings']=readings
        if legacy:
            record["legacyLevel"] = legacy       # classic HSK 2.0, kept strictly separate
        if level in AUDIO_LEVELS:
            record["audio"] = record["id"]
        words.append(record)

    words.sort(key=lambda w: (w["level"], w["rank"] if w["rank"] is not None else 10**9, w["zh"]))
    ids = {w["id"] for w in words}
    if len(ids) != len(words):
        raise SystemExit("id collision: widen the hash")

    counts = {}
    for w in words:
        counts[w["level"]] = counts.get(w["level"], 0) + 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"syllabus": SYLLABUS, "words": words}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    META.write_text(
        json.dumps(
            {
                "syllabus": SYLLABUS,
                "wordsFile": "/hsk/words.json",
                "audioLevels": sorted(AUDIO_LEVELS),
                "levels": [
                    {"level": level, **LEVEL_NAMES[level], "count": counts.get(level, 0)}
                    for level in sorted(counts)
                ],
                "total": len(words),
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"{len(words)} words  " + "  ".join(f"L{k}:{v}" for k, v in sorted(counts.items())))
    print(f"Word-specific policy: {filtered_senses} senses filtered; {removed_words} words removed")
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size/1024:.0f} KB")
    print(f"{META.relative_to(ROOT)}  metadata, {sum(1 for w in words if 'audio' in w)} words flagged for audio")


if __name__ == "__main__":
    main()
