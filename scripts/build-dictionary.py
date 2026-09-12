"""Build the in-game pop-up dictionary from CC-CEDICT.

    curl -L -o cedict.txt.gz https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz
    gunzip cedict.txt.gz
    .venv/Scripts/python.exe scripts/build-dictionary.py cedict.txt

Source: CC-CEDICT, licensed CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
Attribution and the share-alike term travel with any distribution of the output.

Output is a TSV of  simplified <tab> pinyin <tab> gloss;gloss;gloss  so the browser
parses one string instead of megabytes of JSON.
"""
import gzip, re, sys
from pathlib import Path
from content_policy import sanitize

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "dictionary" / "cedict.tsv.gz"
MAX_CHARS = 4          # single words and short phrases: what a learner actually selects
MAX_GLOSSES = 2
MAX_GLOSS_CHARS = 72

TONES = {
    "a": "aāáǎà", "e": "eēéěè", "i": "iīíǐì",
    "o": "oōóǒò", "u": "uūúǔù", "v": "üǖǘǚǜ",
}
CJK = re.compile(r"^[㐀-䶿一-鿿豈-﫿]+$")
DEPRIORITISE = ("variant of", "old variant", "see ", "abbr. for", "surname ")
DROP = ("CL:", "erhua variant")   # reference notation, not a meaning a learner wants


def tone_mark(syllable):
    """ni3 -> nǐ, lu:4 -> lǜ, er2 -> ér."""
    match = re.fullmatch(r"([a-zA-Z:]+)([1-5])", syllable)
    if not match:
        return syllable.replace("u:", "ü").replace("U:", "Ü")
    body, tone = match.group(1).replace("u:", "v").replace("U:", "V"), int(match.group(2))
    if tone == 5:
        return body.replace("v", "ü").replace("V", "Ü")
    lower = body.lower()
    for vowel in ("a", "o", "e"):
        if vowel in lower:
            index = lower.index(vowel)
            break
    else:
        if lower.endswith("iu"):
            index = len(lower) - 1
        elif lower.endswith("ui"):
            index = len(lower) - 1
        else:
            vowels = [i for i, ch in enumerate(lower) if ch in "aeiouv"]
            if not vowels:
                return body.replace("v", "ü")
            index = vowels[-1]
    marked = TONES[lower[index]][tone]
    if body[index].isupper():
        marked = marked.upper()
    return (body[:index] + marked + body[index + 1:]).replace("v", "ü").replace("V", "Ü")


def readable_pinyin(raw):
    return " ".join(tone_mark(s) for s in raw.split())


def clean(gloss):
    gloss = re.sub(r"\s+", " ", gloss).strip()
    gloss = re.sub(r"\|[㐀-鿿]+", "", gloss)      # drop trad|simp alternates
    gloss = re.sub(r"\[[^\]]*\]", "", gloss).strip()      # drop embedded pinyin
    return gloss


def main():
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "cedict.txt")
    if not source.exists():
        raise SystemExit(f"{source} not found. See the docstring for the download command.")

    entries = {}
    line_re = re.compile(r"^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+/(.*)/\s*$")
    kept = skipped = filtered_senses = removed_entries = 0

    for line in source.read_text(encoding="utf-8").splitlines():
        if line.startswith("#"):
            continue
        match = line_re.match(line)
        if not match:
            continue
        _, simplified, pinyin, body = match.groups()
        if len(simplified) > MAX_CHARS or not CJK.match(simplified):
            skipped += 1
            continue
        glosses = [g for g in (clean(g) for g in body.split("/")) if g and not g.startswith(DROP)]
        cleaned = sanitize(simplified, readable_pinyin(pinyin), glosses)
        filtered_senses += len(glosses) - (len(cleaned[1]) if cleaned else 0)
        if not cleaned:
            removed_entries += 1
            continue
        reading, glosses = cleaned
        # CC-CEDICT capitalises the reading for proper nouns, which is a reliable signal that
        # this sense (surname Shui, Apple the company) is not the one a learner wants first.
        head = pinyin.split()
        proper = bool(head) and head[0][:1].isupper()
        record = entries.setdefault(simplified, {"readings": [], "glosses": []})
        if reading not in record["readings"]:
            record["readings"].append(reading)
        for gloss in glosses:
            rank = (proper, any(gloss.lower().startswith(p) for p in DEPRIORITISE))
            record["glosses"].append((rank, gloss))
        kept += 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8", compresslevel=9) as out:
        out.write("# CC-CEDICT, CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/\n")
        out.write("# simplified\tpinyin\tglosses\n")
        for word in sorted(entries, key=lambda w: (len(w), w)):
            record = entries[word]
            # Proper-noun readings (capitalised, e.g. the surname Shui) go after the everyday one.
            ordered = sorted(record["readings"], key=lambda r: r[:1].isupper())
            readings = " / ".join(ordered[:2])
            seen, best = set(), []
            for _, gloss in sorted(record["glosses"], key=lambda item: item[0]):
                if gloss in seen:
                    continue
                seen.add(gloss)
                best.append(gloss if len(gloss) <= MAX_GLOSS_CHARS else gloss[:MAX_GLOSS_CHARS - 1].rstrip() + "…")
                if len(best) == MAX_GLOSSES:
                    break
            glosses = "; ".join(best)
            out.write(f"{word}\t{readings}\t{glosses}\n")

    size = OUT.stat().st_size
    print(f"{len(entries)} headwords from {kept} senses ({skipped} skipped as long or non-Chinese)")
    print(f"Family policy: {filtered_senses} senses filtered; {removed_entries} source entries removed")
    print(f"{OUT.relative_to(ROOT)}  {size/1024/1024:.2f} MB gzipped")


if __name__ == "__main__":
    main()
