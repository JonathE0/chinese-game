# 青禾小镇 · Little Mandarin Town

Browser-based low-poly 3D Mandarin-learning game. The player is a tourist in the town of Qinghe who
learns by talking to NPCs, shopping, cooking and riding the metro to the city of Yunhai. Vite +
PlayCanvas 2.22, plain ES modules, and all game data in JSON.

World: 青禾广场 (level 1) → 商业街 (level 2) → 河边文化街 (level 3), plus 云海市中心 by metro.
Design spec: `docs/superpowers/specs/`. Plans and "what shipped" notes: `docs/superpowers/plans/`.
Everything the content defines (districts, buildings, rooms, shops, NPCs, missions, the city,
recipes) is indexed in `docs/CONTENT_MAP.md`, which is generated; never edit it by hand.

## Commands
- `npm run verify` — unit tests, content check, content map and build in one go, with quiet
  output. Run this after changes.
- `npm run dev` — Vite dev server. The Browser pane config `town` runs it on port 5174, which
  Playwright also uses.
- `npm test` — unit tests (`node --test tests/*.test.js`)
- `npm run check:content` — content validator (also reports voice-clip coverage), then regenerates
  the content map. `npm run map` regenerates the map alone.
- `npm run test:browser` — Playwright specs in `tests/browser/` (Edge; slow)
- `npm run build` — production build
- Voice clips: `.venv/Scripts/python.exe scripts/generate-voice.py --only <id> ...` — see
  `docs/VOICE_PRODUCTION.md`. Never hand-edit `public/audio/manifest.json`.

## Layout
- `src/content/` — game data: `quests.json`, `npcs.json`, `rooms.json` (interiors), `world.json`
  (districts, buildings), `city.json` (Yunhai), `catalog.json`, `recipes.json`, `sites.json`,
  `vocabulary.json`, `lessons/`
- `src/core/` — game rules (economy, review, progress, metro, cooking, construction); unit-tested
- `src/world/` — PlayCanvas scene (`town.js`, `city.js`, `interior.js`)
- `src/ui/` — panels and dialogue · `src/services/` — audio, speech, translation, dictionary

## Rules
- Content lives in JSON, never hard-coded in scene or UI code.
- Chinese first; pinyin and English are optional help. Every authored line needs a voice clip
  (current clips are AI-generated and not yet human-reviewed).
- Don't guess HSK levels; the spec forbids labels that aren't verified against the syllabus.
- Write a failing test before changing a rule.
- Don't commit or change git staging unless asked.

## Keeping token use down
- Start any content question with `docs/CONTENT_MAP.md` before opening the JSON.
- `.rgignore` hides the huge data files from default searches: `public/hsk/words.json` (1.8 MB),
  `public/audio/manifest.json` (780 KB), `src/content/hsk-chinese.json` (25k lines) and
  `package-lock.json`. Pass a path explicitly to search one, and query them with `node -e`
  rather than reading them. Read `rooms.json`, `world.json` and `catalog.json` (1,200–1,600
  lines each) by line range.

Delegate to the project agents in `.claude/agents/`:
- `content-scout` (Haiku, read-only) — lookups that would sweep content files
- `test-runner` (Haiku) — tests and checks; returns failures only
- `browser-checker` (Sonnet) — anything that needs the running game or screenshots
- `task-implementer` (Sonnet) — one self-contained plan task at a time. Invoke it with model
  `opus` when the task is complex or cross-cutting (new systems, engine changes, tricky state).
- `reviewer` (Opus, read-only) — reviews finished agent work for bugs, plan compliance and
  invented Chinese before it counts as done

Add a new agent (and list it here) when a job keeps recurring and produces bulky output the main
conversation doesn't need word for word. Give it a narrow job, the cheapest model that does it
well, and the fewest tools.

Keep these in the main conversation: design discussion, writing Mandarin dialogue, small edits,
and anything that depends on what was just discussed. Run agents in parallel when their tasks don't
touch the same files: wire shared files first, and start the dev server first so parallel
Playwright runs reuse it. Agent worktrees start from the last commit, so they don't see uncommitted
work. Don't send several agents after the same question.
