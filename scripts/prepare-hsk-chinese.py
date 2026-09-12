"""Build src/content/hsk-chinese.json: one Chinese definition per HSK card, in its original script.

Sources (download into --source-dir, which defaults to .cache/hsk-sources — NOT test-results/,
because Playwright deletes that directory at the start of every browser run):

  hsk-source.json  complete-hsk-vocabulary (MIT)
                   https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json
  moe.json.xz      重編國語辭典（修訂本）as JSON, from g0v/moedict-data (CC BY-ND 3.0 TW, text © 教育部),
                   xz-compressed: https://github.com/g0v/moedict-data  (dict-revised.json)
  ci.json          chinese-xinhua (MIT)  https://github.com/pwxcoo/chinese-xinhua  data/ci.json
  word.json        chinese-xinhua (MIT)  data/word.json

The MOE dictionary text is kept in traditional characters exactly as published; it is attributed
in public/hsk/MOE-ATTRIBUTION.md. Xinhua is only used for words MOE does not have.

A character with several readings has one MOE heteronym per reading (長 is cháng "long" and zhǎng
"to grow; elder"). A card is one word with one reading, so only the heteronym whose pinyin matches
the card is used. Joining every heteronym gave the 长 (cháng) card a definition that began with the
senses of zhǎng. When no heteronym matches — tone sandhi, erhua, a reading MOE spells differently —
every heteronym is kept, as before, rather than guessing.
"""
import json, lzma, argparse, unicodedata, re
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--source-dir', type=Path, default=Path('.cache/hsk-sources'))
base = parser.parse_args().source_dir

source = json.loads((base / 'hsk-source.json').read_text(encoding='utf8'))
preferred = json.loads(Path('src/content/hsk-readings.json').read_text(encoding='utf8'))
# The reading each card actually shows, so the definition describes that reading.
cards = json.loads(Path('public/hsk/words.json').read_text(encoding='utf8'))
shown = {w['zh']: w['pinyin'] for w in cards['words']}


def plain(pinyin):
    """Compare readings without spacing, case, apostrophes or compatibility forms."""
    text = unicodedata.normalize('NFC', pinyin or '').lower()
    return ''.join(ch for ch in text if ch not in " '’-·")


def form_score(f, word):
    p = f.get('i', {}).get('y', ''); meanings = f.get('m', [])
    reference = all(m.startswith(('variant of', 'old variant', 'used in', 'see ', 'surname ')) for m in meanings)
    return (reference, bool(preferred.get(word) and p != preferred[word]), p[:1].isupper(), -len(meanings))


def definitions(heteronyms):
    return list(dict.fromkeys(d['def'] for h in heteronyms for d in h.get('definitions', []) if d.get('def')))


def for_reading(entry, reading, depth=0):
    """The senses of the heteronym read the way the card is read, and the title they came from.

    Some readings carry no text of their own, only a cross-reference: 濕 read shī says 同「溼」
    ("same as 溼"). Those are followed, at most twice, to the entry that does the explaining.
    """
    heteronyms = entry.get('heteronyms', [])
    same = [h for h in heteronyms if reading and plain(h.get('pinyin')) == reading]
    defs = definitions(same or heteronyms)
    if defs or depth >= 2:
        return defs, entry['title'], bool(same)
    for h in same or heteronyms:
        for d in h.get('definitions', []):
            for target in re.findall(r'「([^」]+)」', ' '.join(d.get('link', []))):
                if target in moe:
                    found, title, hit = for_reading(moe[target], reading, depth + 1)
                    if found:
                        return found, title, hit
    return [], entry['title'], bool(same)


moe = {r['title']: r for r in json.loads(lzma.decompress((base / 'moe.json.xz').read_bytes()))}
xinhua = {r['ci']: r['explanation'] for r in json.loads((base / 'ci.json').read_text(encoding='utf8'))}
for r in json.loads((base / 'word.json').read_text(encoding='utf8')):
    xinhua.setdefault(r['word'], r['explanation'])

out, missing, matched, unmatched = {}, [], 0, []
for w in source:
    if not any('n' + str(i) in w['l'] for i in range(1, 7)):
        continue
    word = w['s']
    titles = [f['t'] for f in sorted(w['f'], key=lambda f: form_score(f, word))] + [word]
    entry = next((moe[t] for t in titles if t in moe), None)
    if entry:
        reading = plain(shown.get(word))
        defs, title, hit = for_reading(entry, reading)
        if len(entry.get('heteronyms', [])) > 1:
            if hit: matched += 1
            else: unmatched.append(word)
        if defs:
            out[word] = {'text': '\n'.join(defs), 'source': 'moe', 'title': title}
    if word not in out and word in xinhua:
        out[word] = {'text': xinhua[word], 'source': 'xinhua'}
    if word not in out:
        missing.append(word)

Path('src/content/hsk-chinese.json').write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', encoding='utf8')
(base / 'missing-chinese.json').write_text(json.dumps(missing, ensure_ascii=False), encoding='utf8')
print('Definitions:', len(out), 'Missing:', len(missing))
print('Several readings, matched to the card:', matched, '· unmatched, all kept:', len(unmatched))
print('Unmatched:', '|'.join(unmatched))
