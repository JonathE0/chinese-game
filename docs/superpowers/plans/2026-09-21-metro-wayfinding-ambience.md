# A real metro platform, a findable word hall, and a livelier town (2026-09-21)

Player request (verbatim): "the metro does not look like it is part of anything its just randomly
in the center of the city ensure that it has its own place or the player can go underground in
order to board the train" — chose the underground-platform approach over a surface plaza. Also
flagged that the word-hall study venue is hard to find, and asked for a general immersion pass.

## What's there today (verified against the code, not guessed)

- The metro entrance is `buildStationEntrance` in `src/world/city.js:278-317`: a small canopy over
  seven steps at `city.json` `station` (-7.5, 14.6), standing alone on open pavement with no plaza,
  building or signage around it. Pressing E at the stair mouth (`src/world/town.js:490-492`) opens
  the fare-hall panel (`src/ui/metro.js`) directly and, on boarding, plays a real tunnel-ride
  cutscene (`ride()` in the same file) before swapping to the city scene. The "going underground" is
  currently cosmetic — the player never actually walks down into anything.
- The word hall (词语馆, `practice-house` in `world.json`) is a striking building — paifang, gold
  roof — but the minimap (`drawMap` in `src/ui/shell.js:242-270`) draws every building as a plain
  coloured rectangle with **no text label for anything, anywhere**. The only time the player is ever
  routed there is the tutorial's one-time `showWay` call.
- Ambient life is thin: exactly one background-conversation spot exists in the whole game
  (`data.ambient` read as a single `[x,z]` in `src/world/town.js:137,472`, one `AmbientConversations`
  instance in `src/core/social.js`), cycling the same six generic exchanges in
  `src/content/ambient.json` regardless of where the player is. None of them mention the park,
  the snack stalls or the word hall added today.
- Wayfinding audit: `guesthouse` in `world.json` (square, -18,12) has no `rooms.json` entry — it is
  a decorative shell with no function. It gets a note below rather than invented content. No other
  building lacks a room entry.

## Order

Three tasks in the same working tree, each owning the files listed. `world.json` is shared —
each task touches only the keys named for it; re-read before editing and retry if it changed
underneath you. Do not rewrite whole files. Do not commit. The dev server on port 5174 may already
be running (Playwright reuses it) — don't stop it. A build failing on a locked `dist/` file means
another task is building — run it again. Chinese text below is authored; use it exactly and write
no new Chinese. Ponytail: reuse what exists, smallest working diff, no unrequested abstractions.
Report in caveman style.

---

## Task 1 — an underground platform to actually walk into (model: opus)

**Owns:** `src/content/world.json` (a new bespoke `metro-station` building entry only),
`src/content/rooms.json` (a new `metro-platform` entry only), `src/world/city.js` (only
`buildStationEntrance`, if the stair needs a door gap cut into what it draws),
`src/world/interior.js` (only if the platform room needs a fixture it can't draw yet — say so in
the report), `src/world/town.js` (only the `'metro'` target/interact wiring — do not touch the
market or annex code near it), `src/main.js` (only the `id==='metro'` / `'metro:home'` branches),
`src/ui/metro.js` (only if the panel needs to open from inside the room instead of the street),
tests.

- Add `metro-station` to `world.json` `buildings` the same way `practice-house` was added for the
  word hall: `district: "square"`, footprint matching the existing entrance prop (about 5.6×4.4 at
  -7.5,14.6, rotation 180), `bespoke: "metro-entrance"` so `town.js`'s build loop skips the standard
  model for it (reuse the `practice-house`/`bespoke` pattern from the word hall task, don't invent a
  new mechanism).
- Add `rooms.metro-platform`: zh 地铁站台, pinyin dìtiě zhàntái, en Metro platform. `building:
  "metro-station"`, `door` at the base of the existing stairs (the bottom step's position in
  `buildStationEntrance`, roughly (def.x, def.z-1.5) in the entity's local space, converted to world
  space the same way the function already turns its hitboxes). About 8×5: a fare gate / ticket
  machine prop (reuse `models.js` primitives — a waist-height box with a small screen quad), a
  platform edge with a painted safety line, a bench, a subway line map poster on the wall. No train
  model is needed — the ride is still the existing DOM cutscene.
- **Entering:** walking down the stairs and pressing E at the door target now enters the room via
  the same `enterPlace` path other rooms use (do not special-case it) instead of opening the fare
  panel directly from the street. Remove the `'metro'` target from `targets()` in `town.js:490-492`;
  add `door:metro-platform` the way other building doors are added.
- **Inside the room:** the ticket-machine prop is the interact target that calls the existing
  `openMetro(ctx)` — the fare-hall panel and its buy/board logic are unchanged. Boarding still plays
  the existing `ride()` cutscene and calls `ctx.town.enterCity()` on arrival, unchanged.
- **Returning:** `rideHome`'s `arrive` (currently `ctx.town.leaveCity()`) should land the player back
  inside `metro-platform` (at the ticket-machine end, facing the exit), not directly on the street —
  so the trip is symmetric. Leaving the room through its door uses the room's normal `returnPlace`/
  `returnSpawn` (the door at the top of the stairs, matching where the player already stands at
  street level today).
- **Tests:** walking to the stair door and pressing E enters `metro-platform`; the ticket machine
  opens the fare panel; buying a ticket and boarding still plays the ride and arrives in the city;
  taking the train home lands the player in the platform room, and walking out reaches the street at
  the same spot as before; the footprint test and content check pass.

---

## Task 2 — landmark labels on the minimap (model: sonnet)

**Owns:** `src/ui/shell.js` (only `drawMap`), `src/content/world.json` (a new optional `label`
field on building entries only — do not touch buildings' other fields), `scripts/check-content.js`
(validate `label` is a non-empty string when present), tests.

- `drawMap` currently draws every building as a bare coloured rectangle
  (`src/ui/shell.js:249-255`) — no building anywhere has a text label. Add: when a building carries
  a `label` field, draw a small centred `<text>` (reuse the SVG string-building style already used
  for the district rect and gates) above its rectangle, in a size legible at the minimap's zoom.
- Give `practice-house` `label: "词语馆"` — this is the one landmark players currently can't find
  outside the one-time tutorial route. Do not add labels to buildings the player already reaches
  through normal quest routing (shops, home) — this is about the word hall's specific
  discoverability gap, not a general label-everything pass.
- **Known gap, not fixed here:** `guesthouse` (-18,12 in the square) has no `rooms.json` entry and
  no function — it's a decorative shell. Leave it alone; note it in the report as a candidate for a
  future task rather than inventing an interior for it now.
- **Tests:** a building with a `label` renders a text element in the minimap SVG; one without does
  not; content check rejects an empty-string label; the footprint/content tests still pass.

---

## Task 3 — three more places where the town talks to itself (model: sonnet)

**Owns:** `src/content/ambient.json` (new exchanges only, appended), `src/content/world.json` (the
`ambient` field only — turning it into a list of spots), `src/world/town.js` (only the `ambient`
read at lines 137 and 472, and whatever loop is needed to instantiate one friend pair + one
`AmbientConversations` per spot instead of one fixed pair), `src/core/social.js` (only if
`AmbientConversations` needs a constructor change to support several independent instances — it may
already support this with no change; check before editing), tests.

- Today `data.ambient` is a single `[x,z]`. Change it to a list of `[x,z]` pairs; `town.js`
  instantiates one friend pair and one `AmbientConversations` per entry instead of the current
  single pair, each cycling the full `ambient.json` exchange pool independently (no per-zone
  filtering — simplest thing that adds life without new plumbing). Keep the existing square-district
  spot as the first entry so nothing regresses.
- Add two more spots: one in 莲池公园 near the pond entrance court (around (0, 24), clear of the
  path), one near the word hall's approach (around (0, -13), clear of the paifang and the stalls).
- **New ambient exchanges** (append to `ambient.json`, same shape as existing entries, `speaker`
  `friend-a`/`friend-b`, one new `audio` id per line — generate clips with
  `.venv/Scripts/python.exe scripts/generate-voice.py --only <ids>`, report if generation fails):

  | id | exchange | zh | pinyin | en | note |
  | --- | --- | --- | --- | --- | --- |
  | ambient-park-view | park-view | 这个公园真漂亮！ | Zhège gōngyuán zhēn piàoliang! | This park is really pretty! | — |
  | ambient-park-lotus | park-view | 是啊，荷花开得正好。 | Shì a, héhuā kāi de zhènghǎo. | Yeah, the lotus flowers are blooming just right. | — |
  | ambient-park-fish | park-fish | 你看，那些鱼！ | Nǐ kàn, nàxiē yú! | Look at those fish! | — |
  | ambient-park-feed | park-fish | 它们好像在等人喂食。 | Tāmen hǎoxiàng zài děng rén wèishí. | They look like they're waiting to be fed. | — |
  | ambient-snack-wonton | snack-wonton | 这家馄饨摊看起来不错。 | Zhè jiā húntun tān kànqǐlái búcuò. | This wonton stall looks good. | — |
  | ambient-snack-try | snack-wonton | 我们去尝尝吧。 | Wǒmen qù chángchang ba. | Let's go try it. | 尝尝 (chángchang) — to have a taste. |
  | ambient-snack-breakfast | snack-morning | 早点吃了吗？ | Zǎodiǎn chī le ma? | Have you had breakfast yet? | — |
  | ambient-snack-youtiao | snack-morning | 还没，我们去买油条吧。 | Hái méi, wǒmen qù mǎi yóutiáo ba. | Not yet — let's go buy some youtiao. | — |
  | ambient-study-words | study-words | 你今天背了多少生词？ | Nǐ jīntiān bèi le duōshao shēngcí? | How many new words did you memorize today? | 背 (bèi) — to memorize. |
  | ambient-study-count | study-words | 差不多十个吧。 | Chàbuduō shí ge ba. | About ten, I'd guess. | — |
  | ambient-study-quiet | study-quiet | 这里很安静，适合看书。 | Zhè lǐ hěn ānjìng, shìhé kànshū. | It's quiet here — good for reading. | — |
  | ambient-study-like | study-quiet | 对啊，我最喜欢来这儿学习。 | Duì a, wǒ zuì xǐhuan lái zhèr xuéxí. | Right, I like coming here to study best of all. | — |

  These are enrichment ambient chatter, not claimed HSK vocabulary — do not add HSK labels to them,
  consistent with the existing `ambient.json` entries.
- **Tests:** three ambient spots exist and each produces conversation lines when the player is
  nearby and idle (reuse whatever test pattern already covers the existing square spot); the content
  check passes; voice clips exist for the new ids.

---

## Task 4 — station announcements you have to listen to (added 2026-09-24, model: opus)

The ride cutscene in `src/ui/metro.js` (`ride()`) plays station announcements, as a real
metro does, and one listening question per ride checks the player caught where the train is going.

- Announcements, played in order during the ride with the teacher voice (in `src/content/metro.json`, or wherever the metro's lines already live; clip ids
  `metro-<key>`):

  | key | zh | pinyin | en |
  | --- | --- | --- | --- |
  | doors | 车门即将关闭，请注意。 | Chēmén jíjiāng guānbì, qǐng zhùyì. | The doors are closing. Please take care. |
  | hold | 请站稳扶好。 | Qǐng zhàn wěn fú hǎo. | Please hold on. |
  | next-city | 下一站：云海市中心。 | Xià yí zhàn: Yúnhǎi Shì Zhōngxīn. | Next stop: Yunhai City Centre. |
  | next-town | 下一站：青禾。 | Xià yí zhàn: Qīnghé. | Next stop: Qinghe. |
  | arriving | 列车即将进站，请注意安全。 | Lièchē jíjiāng jìn zhàn, qǐng zhùyì ānquán. | The train is arriving. Please stand clear. |
  | arrived | 到站了，请带好随身物品。 | Dào zhàn le, qǐng dài hǎo suíshēn wùpǐn. | We have arrived. Please take all your belongings. |

  The next-stop line matches the direction of travel. Text shows only after the clip has played,
  per the Chinese-first rule (pinyin and English on request).
- Listening question on arrival, once per ride: 刚才广播说下一站是哪儿？ (Gāngcái guǎngbō shuō xià
  yí zhàn shì nǎr? — Where did the announcement say the next stop was?), clip `metro-question`,
  with three choices: 云海市中心, 青禾, 莲池公园. Right: 1 coin, once per ride. Wrong: the
  next-stop clip replays and the choices stay until the right one is picked. Skippable (跳过).
- Tests: unit for the once-per-ride coin; browser: ride to the city, hear `metro-next-city` requested, answer 云海市中心 and gain 1 coin.

## Verification

Each task: `npm run verify`, an Opus review, fixes applied, then checked in the main session before
being called done. Full browser suite at the end.

## What shipped

- Task 1 (2026-09-24): `metro-platform` room. You arrive on a street-level landing by the 售票机 and walk
  down a real flight to the platform (the home's `upper` mechanism), board at the edge (上车), and walk back
  up to leave. The town entrance shows a stairwell whose steps read 楼梯.
- Task 2: 词语馆 is labelled on the minimap. Task 3: chat spots in the square, the park and by the word hall
  (the chatter panel now says 小镇上的闲聊).
- Task 4: the ride plays six announcements, each heard before it is shown, then 刚才广播说下一站是哪儿？ with a
  1-coin answer once per ride.
