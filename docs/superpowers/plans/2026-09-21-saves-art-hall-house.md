# Saves that survive updates, a building art pass, a grand word hall and a house that matches (2026-09-21)

Player requests (verbatim): "between each update of the game is it possible to save my status
locally on my computer as to where I was. This meaning that people can have a log of their own
progress on their hsk regardless of whatever merge or push I commit to the app." — "ensure that the
interior of the house matches … I noticed a bookshelf by the window but there was nothing inside."
— "revamp the art for every building within the game especially the word hall. I want that to be a
very large, grand library that is central within the city. This is the main hub to learn chinese …
Give it like a chinese temple vibe with many large rooms and also special areas to study, read
books, etc."

Choices the player approved: harden saves **and** sync them to a folder on the computer with an
HSK progress log; the study and an upstairs bedroom become real rooms; the word hall grows in
place at the north of the square into a temple-style academy (书院) facing the fountain; the art
pass upgrades the three shared building styles (every building improves at once) plus one
signature detail per building, then the city towers.

## Order

- **Wave 1 (parallel):** Task 1 multi-door rooms (after the movement change lands in `town.js`),
  Task 2 saves, Task 3 building styles.
- **Wave 2 (parallel):** Task 4 house interior (needs Tasks 1 and 2), Task 5 grand word hall
  (needs Task 1). Their sections are specified before they start.
- Every task: failing tests first, Opus review, a check in the main session, full browser suite.

## Rules for every task

Ponytail: reuse what exists (the codebase, the standard library, the platform), no unrequested
abstractions, no new dependencies, fewest files, smallest working diff — never skimping on
understanding the code, validation, data safety, security or accessibility. Each task owns the
files listed for it; in a shared file edit only the parts named, re-read before editing and retry if
the file changed; never rewrite a whole file. Don't commit. The Vite dev server runs on port 5174
(Playwright reuses it; the player may have the game open) — don't start or stop it. A build that
fails on a locked `dist/` file is another task building: run it again. Chinese is authored in the
main session: use the strings given here exactly and write no new Chinese. Report in caveman style.

---

## Task 1 — rooms with several doors (model: sonnet)

**Owns:** `src/world/interior.js`, in `src/world/town.js` only the room-door parts
(`registerRooms` door marks, the annex entries in `targets()`, the doorway gap in `withinPlace` /
the annex check near it, and the spot you arrive at when entering or leaving an annex room),
`src/content/rooms.json` (convert the one `annex`), `scripts/check-content.js` (annex rules),
tests.

- Replace `annex` with `annexes: [{room, zh, x, z, wall, label, stairs?}]` — `wall` is `east`,
  `west` or `back` (the wall opposite the front door); `x,z` place the door along that wall in the
  room's coordinates. Convert home → kitchen (east wall, as now) and delete the single-`annex` code
  paths rather than supporting both.
- Each door is drawn in its wall (the current east-wall door, turned to face into the room for
  `west` and `back`); `stairs: true` draws a short flight of steps going up into the wall with the
  label instead of a door leaf. Each door gets its hitbox, its target (label from `label`) and its
  gap in the wall.
- An annex room keeps `returnPlace` and `returnSpawn`; entering it uses its `spawn`, leaving puts
  you at its `returnSpawn` in the parent room, as the kitchen does now.
- Validator: every annex room exists, has `returnPlace` equal to the room that lists it and a
  `returnSpawn`; every door sits on its wall within the room's size.
- Tests: the kitchen still works end to end (enter home, enter kitchen, come back, leave); a unit
  test for whatever pure helper places a door on a wall; the content check passes.

---

## Task 2 — saves that survive every update, synced to the computer (model: opus)

**Owns:** `src/core/profile.js`, `src/core/economy.js` and `src/core/review.js` (only for the
ported claims fix), new `src/core/backup.js` (backups and the progress-log row — pure where
possible), new `src/services/filesync.js`, `src/ui/panels.js` (Settings and Journal), `src/main.js`
(start-up only: persist request, restore offer, sync after saves), tests.

- **Port the claims-limit fix.** An earlier session fixed "every review adds a claim key and
  `decodeProfile` refuses a save with more than 10,000 claims", but only as uncommitted changes in
  the worktree `.claude/worktrees/magical-villani-8c873f` (files `src/core/economy.js`,
  `src/core/profile.js`, `src/core/review.js`, `tests/core.test.js`) built on an old base
  (commit 4c48881). Read that diff (`git -C .claude/worktrees/magical-villani-8c873f diff`) and
  re-apply the fix on the current code — `reviewWord` now has venue coins and a `learned` mark.
  Do not merge or copy the old files wholesale.
- **Never discard a save.** `decodeProfile` repairs instead of refusing: a bad field or entry is
  normalised or dropped on its own and the rest kept, with a list of what was repaired. Only JSON
  that cannot be parsed at all falls back to a fresh profile — and then the raw text is kept under
  `little-mandarin-town.v1.unreadable-<timestamp>` first. `loadProfile` returns the repair list so
  `main.js` can say so (string below).
- **Format upgrades.** The save keeps a `version`; an ordered list of upgrade steps (version n → n+1)
  runs on load. Today's saves are version 1; add the mechanism and a test with a sample step so
  the next format change has one place to go. Saving always writes the current version.
- **Rolling backups** in the browser: at most one snapshot per real day, the last 14 kept
  (IndexedDB or localStorage keys — whichever is less code and survives the save size), listed in
  Settings with a restore button (with the usual confirmation). Ask for
  `navigator.storage.persist()` once.
- **Folder sync (Chrome/Edge, `showDirectoryPicker`):** Settings button to choose a folder; keep
  the handle in IndexedDB; after saves (debounced, about 5 s) write `qinghe-save.json` (the full
  save); once per real day append a row to `qinghe-hsk-log.csv`:
  `date,hsk1,hsk2,hsk3,hsk4,hsk5,hsk6,objects,coins` — words known per level counted exactly as
  district gates count them (`learnedAtLevel` in `src/core/progress.js`), objects = named objects,
  coins = wallet. The log rows are also kept in the browser so the journal can show them without
  the folder. If permission lapses, never block the game: show 重新连接 in Settings. Browsers
  without the API show only export/import (which stays).
- **Restore from the folder:** on start, if a folder is connected and its `qinghe-save.json` holds
  more progress than the browser save (more known words, then more named objects, then more
  coins), offer to restore it.
- **Journal:** a 进度记录 tab showing the log as a table, newest first.
- **Settings warning** that each web address keeps its own save.
- **Strings** (use exactly; English after the slash, shown the way Settings already pairs them):
  - Settings section: 电脑上的存档 / SAVE TO YOUR COMPUTER
  - 选择文件夹 / Choose a folder · 重新连接 / Reconnect · 停止同步 / Stop syncing
  - 已同步到：{folder} / Syncing to: {folder} · 上次保存：{time} / Last saved: {time}
  - 这个浏览器不能直接存到文件夹，请用导出存档。 / This browser can't save to a folder; use Export instead.
  - 每个网址都有自己的存档：localhost 和 127.0.0.1 不共用。 / Each web address keeps its own save: localhost and 127.0.0.1 don't share one.
  - 自动备份 / AUTOMATIC BACKUPS · 恢复这个备份 / Restore this backup
  - 在文件夹里找到了进度更多的存档，要恢复吗？ / The folder holds a save with more progress. Restore it?
    · 恢复 / Restore · 不用了 / No thanks
  - 存档有一部分读不了，已经修好了，原来的存档另存了一份。 / Part of your save couldn't be read. It has been repaired, and a copy of the original was kept.
  - Journal tab: 进度记录 / PROGRESS LOG; columns 日期 · HSK 1 … HSK 6 · 认识的东西 · 学习币
- **Tests:** unit — repair keeps the good parts of a damaged save (bad claim, bad word record, bad
  furnishing, too many claims), unparseable JSON keeps the raw text, upgrade steps run in order,
  backup rotation keeps 14, log row matches `learnedAtLevel`, the ported claims fix (a save with
  more than 10,000 historical review claims loads; a review still cannot pay twice). Browser — mock
  `showDirectoryPicker` with an in-memory handle: choose a folder, make progress, the save file and
  a log row are written; the restore offer appears for a fuller folder save.

---

## Task 3 — building styles and signature details (model: opus)

**Owns:** `src/world/models.js` (the building styles and a small table of detail builders),
`src/content/world.json` (a `details` list on buildings only), `scripts/check-content.js` (detail
names only), tests.

- Upgrade the three shared styles so every building improves at once, keeping each building's
  footprint, door and sign positions, and every named mark and feature the home already has
  (storeys, wings, balcony, lanterns, kitchen and study details):
  - `tiled` (old town): upturned eave corners, ridge ornaments at the ends of the ridge, tile ribs
    on the roof, lattice windows, a door frame with a lintel board, a stone plinth.
  - `shophouse`: an arcade of columns along the front, small upper balconies or railings, striped
    awnings, a hanging shop sign beside the door.
  - `modern`: framed glazing with mullions, a lit sign strip, a canopy over the entrance.
- Signature details via `details: ["…"]` on a building, one builder each, for example: bank lions
  and a gold sign frame; pharmacy green cross sign; bakery bread display in the window; café
  outdoor menu board; bookshop book display; post office green post box; lighting shop lamps in the
  window; clothes shop mannequins; homeware stacked furniture; supermarket trolley rack; restaurant
  red lanterns and a menu board. Use judgement per building; no new Chinese (existing signs only).
- Leave the word hall (`practice-house`) on the upgraded style only — Task 5 replaces it.
- Mesh budget: measure the town's mesh count before and after; stay within +40%, reuse materials
  (the existing per-colour cache), prefer fewer larger boxes to many tiny ones.
- The city towers are a later task.
- **Tests:** the footprint test, first-view, places, home-access and the full suite pass; headless
  before/after screenshots (Playwright, 960×540) of the square, the market and the riverside saved
  under `test-results/art-*.png`, described in the report.

---

## Task 4 — the house inside matches the outside (model: opus; after Tasks 1 and 2)

**Owns:** in `src/content/rooms.json` the `home` entry and new `study` and `bedroom` entries;
`src/ui/decorate.js`; the furnishing and placement parts of `src/world/town.js` (`furnish` and what
it calls); the furnishing check in `src/core/profile.js` (`validFurnishing` and where `home` is
decoded); `src/main.js` only where the home is furnished at start; tests. `src/world/interior.js`
only if a room needs something it cannot draw yet (say so in the report).

Outside today: the house faces north; kitchen wing on the exterior west (the interior east wall,
your right as you walk in); study wing with a bookshelf window on the exterior east (the interior
west wall, your left); two storeys with a balcony across the front.

- **Main room** (`home`, 我的家) keeps its door and the kitchen door (east). It gains:
  - a west-wall door to the study — label `进书房 · 看书`;
  - stairs on the back wall (`stairs: true`) up to the bedroom — label `上楼 · 卧室`, named
    `stairs` (楼梯) for the look ray.
  - Its study desk (`desk`) moves to the study. Its furnishing slots stay as they are, so existing
    saves keep everything where it is.
- **Study** (`study`): zh 书房, pinyin shūfáng, en Study. About 5×5, returns to `home` beside the
  west door, with return label `回客厅`.
  - A window in the front wall with a bookshelf beside it, matching the study window seen from
    outside.
  - The bookshelves open the library shelves (`shelf:beginner`, `shelf:everyday`,
    `shelf:stories`, the same actions as 青禾书馆).
  - The study desk opens the word bank at the desk rate (`studydesk`, +4).
- **Bedroom** (`bedroom`): zh 卧室, pinyin wòshì, en Bedroom. About 7×5, upstairs, returns to
  `home` at the foot of the stairs, with return label `下楼 · 回客厅`.
  - A glass door in the front wall onto the balcony, named `balcony` (阳台), not walkable.
  - Decoratable, with its own slots (bed, nightstand, wardrobe, rug, lamp, plant).
- **Decorating in every decoratable room.**
  - Furnishing records gain `room`, and a missing `room` means `home`, so old saves load unchanged.
  - `decodeProfile` accepts only decoratable room ids. A bad `room` is repaired the way other bad
    furnishings are.
  - The decorate panel and free placement work in whichever decoratable room you stand in.
  - Sleeping works from the bed wherever it stands.
  - A brand-new player's starter bed and nightstand go into the bedroom slots, and the rug stays
    in the main room.
- **Tests:**
  - Home, then the study through the west door: a shelf opens the library, the desk opens the
    word bank at +4, and you can come back.
  - The stairs lead to the bedroom and back. A bed placed there survives a reload.
  - An existing save with a bed in `home` loads with the bed where it was.
  - A fresh profile's starter bed ends up in the bedroom.
  - The kitchen still works.
  - The content check and the footprint test pass.

---

## Task 5a — the grand word hall outside, and the square's north re-laid (model: opus; after Task 3)

**Owns:** new `src/world/wordhall.js` (the exterior and its marks); `src/content/world.json` (the
square's and riverside's bounds, the `practice-house` entry, the north half of the square, and every
riverside entry); in `src/world/town.js` only the build loop (skip a building marked `bespoke` and
call the word-hall builder), registering its marks (as the park does) and the two lines placing the
northern hills; in `rooms.json` only `hall.door` and the doors of riverside rooms;
`src/content/quests.json` (`where` values that move); tests (new `wordhall.spec.js` and any spec
that walks to the hall or into the riverside).

- **Make room.**
  - The square's north bound goes from z −19 to z −31.
  - The whole riverside district moves 12 north: its bounds become z −55..−31, and every riverside
    building, prop, person, tree, ground patch, room door and mission `where` shifts by −12 in z.
    Its gate becomes (0, −31), same `half` and requirement.
  - The northern hills move 12 further north too.
  - Do the shift with a small script that edits exactly those entries, and check the diff.
- **The complex**, centred on x = 0, facing south to the fountain, within x −14..14 and z −30..−10:
  - A paifang (named `paifang`, plaque reading 学海无涯) at the front, about z −10.5, about 8 wide.
  - A forecourt with two stone lions (named `lion`).
  - A white stone terrace about 1.2 high (named `step` for its stairs), with a wide staircase on
    the south face (every rise at most 0.3) and balustrades.
  - The main hall on the terrace, about 18 wide by 11 deep:
    - red columns across the front colonnade (named `pillar`);
    - lattice doors;
    - a double-eaved golden roof whose ridge stands about 14 above the ground (named `roof`);
    - a plaque reading 词语馆 under the upper eave (named `plaque`);
    - the door at the front centre, which becomes `rooms.hall.door`.
  - Side halls east and west (single eave): the reading room is on the west, the study room on
    the east.
  - Everything is solid where it looks solid. The lions, columns and paifang have their own
    marks. Parts of the complex share a `group`.
- The `practice-house` entry stays in `world.json` for the minimap and the door, with the main
  hall's footprint and `bespoke: "wordhall"`. `town.js` skips the standard model for it.
- **The north of the square:**
  - Remove or move the trees at (−5.7, −13.2), (7.8, −15.2) and (−13.7, −12.7), and the gravel
    patch at (0, −16).
  - Keep Lin's tea stall, Xiaomei's corner, Uncle Chen's stall and the lantern line as the
    approach.
  - Keep walkways of at least 3 m along both sides of the complex and behind it, so the riverside
    gate at (0, −31) can be reached.
- **Budget:** about 500 meshes for the complex. Share materials.
- **Tests:**
  - From the spawn, walk through the paifang, up the stairs, press E at the door and arrive in
    词语馆.
  - The riverside is reachable on foot through its gate once unlocked.
  - The footprint test and first-view pass.
  - Every moved riverside door still works (the restaurant ordering spec and the others).
  - One headless screenshot from the fountain towards the hall, saved to
    `test-results/wordhall-front.png`.

---

## Task 5b — the word hall inside: a hub of rooms (model: opus; after Task 1)

**Owns:** in `rooms.json` the `hall` entry (all but `door`) and new `reading`, `studyroom`,
`listening` and `courtyard` entries; `src/world/interior.js` (only what these rooms need, e.g. a
room open to the sky and listening booths); `src/main.js` (only a `listen` action); `src/ui/hsk.js`
(opening straight into listening practice); tests (new `wordhall-rooms.spec.js`).

- **大厅, the hall hub** (`hall`; its zh stays 词语馆, so the location card reads 词语馆):
  - About 16×12, about 6 high, grand.
  - Red columns inside, hanging lanterns, bookcases along the walls.
  - A large scroll reading 学而时习之.
  - The HSK lectern at the centre back, as now (new words +5).
  - Doors:
    - west: 阅览室 (reading room), label `进阅览室 · 看书`;
    - east: 自习室 (study room), label `进自习室 · 复习`;
    - back wall at x −4: 听力室 (listening room), label `进听力室 · 练听力`;
    - back wall at x +4: 庭院 (courtyard), label `去庭院 · 坐一坐`.
  - Every annex room returns to `hall` with return label `回大厅`.
- **阅览室** (`reading`): zh 阅览室, pinyin yuèlǎnshì, en Reading room.
  - Shelves with the library shelf actions (`shelf:beginner`, `shelf:everyday`, `shelf:stories`).
  - Reading desks with chairs you can sit on, and lamps.
- **自习室** (`studyroom`): zh 自习室, pinyin zìxíshì, en Study room.
  - Four to six carrels: desk, chair and lamp.
  - Each carrel opens the word bank at the desk rate (`studydesk`, +4), label `复习生词 · 书桌`.
- **听力室** (`listening`): zh 听力室, pinyin tīnglìshì, en Listening room.
  - Four booths with headphones (named `headphones`), label `戴上耳机 · 听力练习`.
  - A booth opens the HSK panel straight into listening practice for the current level. New
    listening words pay at the hall's new-word rate.
- **庭院** (`courtyard`): zh 庭院, pinyin tíngyuàn, en Courtyard.
  - Open to the sky: no ceiling, daylight comes in.
  - A small pond (named `pond`), a pine (`pine`), rocks (`rock`), a stone path (`path`) and
    benches to sit on (`bench`).
- **Tests:**
  - Every room is reachable from the hub and returns to it.
  - The lectern opens HSK.
  - A reading shelf opens the library.
  - A carrel opens the word bank and pays 4.
  - A booth opens listening practice.
  - A courtyard bench seats you.
  - The content check passes.

---

## What shipped

Every task passed an Opus review, had its findings fixed, and was checked in the main session
(tests and headless screenshots). Final gate: `npm run verify` green, full browser suite 118/118.

- **Movement (added the same day):** Source-style ground friction and acceleration (friction 5.2,
  accelerate 7, stop speed 1.44, air accelerate 0.7); air speed can never exceed takeoff speed or
  the cap, with a 12% floor so a standing jump can still reach a bench — no bunny hopping.
- **Task 1:** `annexes` on any wall, doors and prompts computed from the drawn door, validator for
  wall line, corners, spacing and windows.
- **Task 2:** repairing loader, format upgrades, unreadable copies kept (IndexedDB when localStorage
  is full), newer-version saves open read-only, 14 daily backups, folder sync with
  `qinghe-save.json` and `qinghe-hsk-log.csv`, restore offer (declining keeps a dated copy),
  进度记录 in the journal, the claims-limit fix ported.
- **Task 3:** upgraded tiled, shophouse and modern styles and 13 signature details; building meshes
  623 → about 1000 after trimming.
- **Task 4:** study (west door, readable shelves, desk +4) and bedroom (stairs, balcony door,
  decoratable); each room's way back is on the wall it leads to; furnishings carry a room and old
  saves keep theirs.
- **Task 5a:** the square extended north to z −31, the riverside moved 12 north with its gate at
  (0, −31); the hall complex (paifang 学海无涯, lions, terrace, double golden roof, 词语馆 plaque,
  side halls), 348 meshes.
- **Task 5b:** the hall hub with 阅览室, 自习室, 听力室 and an open-sky 庭院; listening booths open
  straight into listening practice; chairs in older rooms now face their tables.
