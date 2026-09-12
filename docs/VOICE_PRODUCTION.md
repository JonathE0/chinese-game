# Mandarin voice production

Every line of authored content now has a Mandarin clip. **These are AI generated voices, not native-speaker recordings, and no human has listened through them.** The game says so wherever it plays one, and `npm run check:content` reports the count every run.

## What is currently shipped

| | |
| --- | --- |
| Provider | `edge-tts` — Microsoft Edge's neural text-to-speech |
| Clips | 2,318 (`public/audio/clips/`, ~29 MB) |
| Coverage | 4 dialogue nodes, 4 ambient lines, 4 town vocabulary words, 21 shop items, 75 named world objects, 2,209 HSK words (levels 1–3) |
| Review status | `review: "unreviewed"` on every clip |

### Usage rights — read before publishing

`edge-tts` reaches the same endpoint Edge uses for Read Aloud. That is fine for a local, personal learning prototype. **It is not a cleared commercial license**, and Microsoft's terms do not obviously permit redistributing the generated audio as game assets. Before you publish this game anywhere, either confirm the terms yourself or re-generate with a provider whose license you hold (Azure Speech, ElevenLabs, a hired voice actor). The pipeline is provider-shaped so only `src/content/voices.json` and one function in `scripts/generate-voice.py` need to change.

## Voice cast

Casting lives in `src/content/voices.json`; edit it and re-run the generator to recast anyone.

| Speaker | Voice | Intent |
| --- | --- | --- |
| `lin` | zh-CN-XiaoxiaoNeural | Auntie Lin at the tea stall — warm, unhurried |
| `mei` | zh-CN-XiaoyiNeural | Xiaomei at the practice corner — young, lively |
| `chen` | zh-CN-YunjianNeural | Uncle Chen at the souvenir stall — hearty seller |
| `narrator` | zh-CN-YunyangNeural | Calm scene narration |
| `friend-a` / `friend-b` | zh-CN-YunxiNeural / zh-CN-YunxiaNeural | The two background strollers, deliberately distinct |
| `teacher` | zh-CN-XiaoyiNeural at −20% rate | Single words and HSK drills, slower on purpose |

## Regenerating

```sh
python -m venv .venv
.venv/Scripts/python.exe -m pip install edge-tts
.venv/Scripts/python.exe scripts/generate-voice.py
```

The script collects every `audio` id referenced by content, hashes the text plus voice plus prosody, and only re-synthesises what changed. `--force` rebuilds everything; `--only <id> ...` rebuilds specific clips. It writes `public/audio/manifest.json` itself — do not hand-edit that file.

Clip sources, in the order the script reads them:

- `src/content/lessons/*.json` — `speaker` picks the voice; `intro-greeting` is narrated.
- `src/content/ambient.json` — `speaker` is `friend-a` or `friend-b`.
- `src/content/vocabulary.json` — always the `teacher` voice.
- `src/content/catalog.json` — Chen speaks the item name plus its description.
- `src/content/objects.json` — every nameable thing in the world, as `obj-<key>`, in the teacher voice.
- `public/hsk/words.json` — words carrying an `audio` id, currently HSK levels 1–3 (`AUDIO_LEVELS` in `scripts/build-hsk.py`). Widening that set and re-running the generator is all it takes to voice levels 4–6, at roughly 12 MB per level.

## Getting to reviewed audio

The honest gap is listening review, not coverage. To close it:

1. Listen to every clip against the displayed Chinese. Check tones, word boundaries, and that particles (呀, 吧, 啊) sound conversational rather than spelled out.
2. Re-cast or re-record anything that fails. Prosody is adjustable per speaker via `rate` and `pitch` in `voices.json`; a single line can be replaced by hand as long as the manifest entry keeps its `hash`.
3. Set `review` to `"reviewed"` on the clips that pass — in `voices.json` for a whole pass, or per clip in the manifest.

The UI reads this: `VoicePlayer.sourceLabel()` shows `普通话 · AI 配音` today and `普通话 · AI 配音（已审听）` once reviewed, or `普通话 · 真人录音` for `source: "recorded"`. `scripts/check-content.js` stops reporting unreviewed clips once they are marked.

Human recordings drop into the same slots: save them under `public/audio/clips/<audio id>.mp3`, set `source: "recorded"` and `review: "reviewed"`, and leave `hash` off so the generator does not overwrite them.

## Playback behaviour already built

Replay, a pitch-preserving slow replay, separate dialogue and ambience volumes, ambience ducking under foreground speech, playback only after a player gesture, and a visible unavailable state instead of a silent substitution. Background music is synthesised in the browser (`src/services/music.js`) and carries no licensing question at all.
