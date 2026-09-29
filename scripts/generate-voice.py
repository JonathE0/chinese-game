"""Generate Mandarin voice clips for every audio id referenced by game content.

Uses edge-tts (Microsoft Edge neural voices). These are generated voices, not
native-speaker recordings: clips are written with source="generated" and
review="unreviewed" so the game and the content check can say so honestly.

    .venv/Scripts/python.exe scripts/generate-voice.py [--force] [--only ID ...]

Re-running only regenerates clips whose text, voice or prosody changed.
"""
import argparse, asyncio, hashlib, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "src" / "content"
OUT_DIR = ROOT / "public" / "audio" / "clips"
MANIFEST = ROOT / "public" / "audio" / "manifest.json"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


# A lone character read with its less common reading gives the voice no context, so it falls back
# to the usual reading (重 comes out zhòng, not chóng). Those clips speak a character with the same
# syllable and tone instead. 卡 qiǎ has no such character and still needs a human recording.
STAND_INS = {
    "hsk-3be88885": "虫",  # 重 chóng
    "hsk-4b8bc6a1": "赣",  # 干 gàn
    "hsk-82ca4a6b": "控",  # 空 kòng
    "hsk-939e2804": "掉",  # 调 diào
    "hsk-ad9a4b24": "赚",  # 转 zhuàn
    "hsk-da1f520c": "鼠",  # 数 shǔ
}


def spoken(line):
    return STAND_INS.get(line["id"], line["text"])


def collect_lines():
    """Return [{id, text, speaker, kind}] for every audio id in content."""
    lines, seen = [], set()

    def add(audio_id, text, speaker, kind):
        if not audio_id or not text:
            return
        if audio_id in seen:
            raise SystemExit(f"duplicate audio id: {audio_id}")
        seen.add(audio_id)
        lines.append({"id": audio_id, "text": text, "speaker": speaker, "kind": kind})

    for lesson in sorted((CONTENT / "lessons").glob("*.json")):
        data = read_json(lesson)
        for node in data["nodes"]:
            add(node.get("audio"), node["zh"], node.get("speaker", "narrator"), "dialogue")
        for line in data.get("extraLines", {}).values():
            add(line.get("audio"), line["zh"], line.get("speaker", "narrator"), "dialogue")

    for line in read_json(CONTENT / "ambient.json"):
        add(line.get("audio"), line["zh"], line.get("speaker", "friend-a"), "ambient")

    for word in read_json(CONTENT / "vocabulary.json"):
        add(word.get("audio"), word["zh"], "teacher", "word")

    for item in read_json(CONTENT / "catalog.json"):
        text = item["zh"]
        if item.get("description"):
            text = f"{item['zh']}。{item['description']}"
        add(item.get("audio"), text, "chen", "shop")

    # Ordering food at the snack stalls: market-<key> lines and market-total-<n> totals.
    market = read_json(CONTENT / "market.json")
    for key, line in market["lines"].items():
        add("market-" + key, line["zh"], market["speaker"], "dialogue")
    for n, text in market["totals"].items():
        add("market-total-" + n, text, market["speaker"], "dialogue")

    # Station announcements and the listening question on the metro ride: metro-<key>.
    metro = read_json(CONTENT / "metro.json")
    for key, line in metro["lines"].items():
        add("metro-" + key, line["zh"], metro["speaker"], "dialogue")

    # Festivals: greetings and replies once in each townsperson's voice (fest-<key>-<person>),
    # the noticeboard lines (fest-<key>) and the lantern riddles (fest-riddle-<n>) by the teacher.
    festivals = read_json(CONTENT / "festivals.json")
    for key, line in festivals["lines"].items():
        if key.startswith(("hi-", "reply")):
            for person in festivals["people"]:
                add(f"fest-{key}-{person}", line["zh"], person, "dialogue")
        else:
            add("fest-" + key, line["zh"], "teacher", "dialogue")
    for riddle in festivals["riddles"]:
        add(f"fest-riddle-{riddle['n']}", riddle["zh"], "teacher", "dialogue")

    # HSK words live in public/ because the study hall loads them lazily; only the
    # levels flagged by scripts/build-hsk.py carry an audio id.
    for key, entry in read_json(CONTENT / "objects.json")["objects"].items():
        add("obj-" + key, entry["zh"], "teacher", "object")
    for text, entry in read_json(CONTENT / "signs.json")["signs"].items():
        add("sign-" + entry["id"], text, "teacher", "sign")
    for line in read_json(CONTENT / "levels.json")["lines"].values():
        add(line["audio"], line["zh"], "teacher", "dialogue")

    # Friendship lines, in each townsperson's own voice: friend-<npc>-<key>. The shared gift
    # replies are voiced once per person.
    friends = read_json(CONTENT / "friends.json")
    for npc in friends["people"]:
        for key, line in {**friends["lines"][npc], **friends["shared"]}.items():
            add(f"friend-{npc}-{key}", line["zh"], npc, "dialogue")

    # Shop assistants: assistant-<key>, all in one voice.
    assistants = read_json(CONTENT / "assistants.json")
    for key, line in assistants["lines"].items():
        add("assistant-" + key, line["zh"], assistants["speaker"], "dialogue")

    # 山城老火锅: the waiter's lines (hotpot-<key>) and the noodle chef's (hotpot-chef-<key>).
    hotpot = read_json(CONTENT / "hotpot.json")
    for key, line in hotpot["lines"].items():
        add("hotpot-" + key, line["zh"], hotpot["speakers"]["waiter"], "dialogue")
    for key, line in hotpot["chef"].items():
        add("hotpot-chef-" + key, line["zh"], hotpot["speakers"]["chef"], "dialogue")

    # People in the word hall (hall-<key>), each line in its own speaker's voice.
    for line in read_json(CONTENT / "hall-visitors.json")["lines"].values():
        add(line["audio"], line["zh"], line["speaker"], "dialogue")

    # The drone show over the bay: its start and end announcements (drones-<key>).
    drones = read_json(CONTENT / "drones.json")
    for line in drones["lines"].values():
        add(line["audio"], line["zh"], drones["speaker"], "dialogue")

    # People walking around Yunhai (crowd-<n>), each line in its own speaker's voice.
    for line in read_json(CONTENT / "crowd.json")["lines"]:
        add(line["audio"], line["zh"], line["speaker"], "dialogue")

    # The 易混词 deck: its two prompts, and members without an HSK clip (homophones share one).
    confusables = read_json(CONTENT / "confusables.json")
    for prompt in confusables["prompts"].values():
        add(prompt["audio"], prompt["zh"], "teacher", "prompt")
    for member in (m for g in confusables["groups"] for m in g["members"]):
        if member.get("audio") and member["audio"] not in seen:
            add(member["audio"], member["zh"], "teacher", "word")

    hsk = ROOT / "public" / "hsk" / "words.json"
    if hsk.exists():
        for word in read_json(hsk)["words"]:
            add(word.get("audio"), word["zh"], "teacher", "hsk")

    return lines


def fingerprint(line, cast):
    voice = cast[line["speaker"]]
    payload = json.dumps(
        [spoken(line), voice["voice"], voice.get("rate", "+0%"), voice.get("pitch", "+0Hz")],
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


async def synthesize(edge_tts, line, cast, path):
    voice = cast[line["speaker"]]
    comm = edge_tts.Communicate(
        spoken(line),
        voice["voice"],
        rate=voice.get("rate", "+0%"),
        pitch=voice.get("pitch", "+0Hz"),
    )
    await comm.save(str(path))


async def main():
    # Printing Chinese text (line previews, error messages) to a console whose default encoding
    # can't represent it must not abort the run before the manifest is written — most visible on
    # Windows, where the console's native code page is not UTF-8.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="regenerate every clip")
    parser.add_argument("--only", nargs="*", default=None, help="only these audio ids")
    args = parser.parse_args()

    try:
        import edge_tts
    except ImportError:
        raise SystemExit(
            "edge-tts is not installed. Run:\n"
            "  python -m venv .venv\n"
            "  .venv/Scripts/python.exe -m pip install edge-tts"
        )

    voices = read_json(CONTENT / "voices.json")
    cast = voices["cast"]
    lines = collect_lines()
    if args.only:
        lines = [l for l in lines if l["id"] in set(args.only)]

    missing = sorted({l["speaker"] for l in lines} - set(cast))
    if missing:
        raise SystemExit(f"no voice cast for speaker(s): {', '.join(missing)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    previous = read_json(MANIFEST).get("clips", {}) if MANIFEST.exists() else {}
    clips, made, kept, failed = {}, 0, 0, []

    for line in lines:
        digest = fingerprint(line, cast)
        path = OUT_DIR / f"{line['id']}.mp3"
        stale = args.force or not path.exists() or previous.get(line["id"], {}).get("hash") != digest
        if stale:
            for attempt in range(3):
                try:
                    await synthesize(edge_tts, line, cast, path)
                    break
                except Exception as error:  # network flakiness is the common case
                    if attempt == 2:
                        failed.append((line["id"], repr(error)))
                        path = None
                        break
                    await asyncio.sleep(1.5 * (attempt + 1))
            if path is None:
                continue
            made += 1
            print(f"generated {line['id']:<22} {cast[line['speaker']]['voice']:<30} {line['text'][:24]}")
        else:
            kept += 1

        clips[line["id"]] = {
            "src": f"/audio/clips/{line['id']}.mp3",
            "approved": True,
            "source": "generated",
            "review": "unreviewed",
            "provider": voices["provider"],
            "voice": cast[line["speaker"]]["voice"],
            "speaker": line["speaker"],
            "kind": line["kind"],
            "text": line["text"],
            "bytes": path.stat().st_size,
            "hash": digest,
        }

    if args.only:
        merged = dict(previous)
        merged.update(clips)
        clips = merged

    MANIFEST.write_text(
        json.dumps(
            {
                "version": 2,
                "status": "Generated Mandarin speech (edge-tts). Not native-speaker recordings; not listening-reviewed.",
                "provider": voices["provider"],
                "providerName": voices["providerName"],
                "review": voices["review"],
                "clips": dict(sorted(clips.items())),
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )

    total = sum(c["bytes"] for c in clips.values())
    print(f"\n{made} generated, {kept} unchanged, {len(clips)} in manifest, {total/1024:.0f} KB total")
    if failed:
        print(f"\n{len(failed)} FAILED:", file=sys.stderr)
        for clip_id, error in failed:
            print(f"  {clip_id}: {error}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
