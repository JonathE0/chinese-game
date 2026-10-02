# Development wave 4 — stations, Yunhai station district, apartment tower, 繁體, characters, tutorial, mouse

Date: 2026-09-30. Working folder: `C:\Users\jonat\Documents\ChatGPT\Game-development` (branch
`development`, large uncommitted working tree that must be preserved). This wave follows the transit
wave (metro card, Condition reminder, first rental flat; see `2026-09-30-transit-checkpoint.md`).

## What the player asked for

1. Qinghe station: walk down stairs from the street before reaching the station lobby; the small
   entrance building leading straight into a big platform makes no sense.
2. Interiors bigger than their buildings (the Yunhai mall is far bigger inside than outside): find
   every instance and fix it.
3. Yunhai's station exterior is bland. Make it modern architecture like the photos
   (`docs/references/wave4/station-exterior.webp`, `station-canopy-terrace.webp`: a white canopy on
   trumpet-shaped "tree" columns with leaf-shaped openings lit warm from inside, a warm wood soffit, a
   glass hall, terraces with glass railings, side escalators, a landscaped plaza). Several exits, the
   station moved back to make room, the city expanded around it as the heart of the city.
4. The narrow road from the station leads nowhere: make it a nice walking street and remove taxis
   altogether (player confirmed: remove the cars, the taxi ride, its lesson and its quest).
5. Apartments inside one of the tall towers across the harbour: a grand lobby, a lift up to your
   floor, several apartments for rent in tiers with their own prices, amenities and restaurants by
   price, and every one with a functional window with a real view over the harbour or city.
6. A setting that switches all simplified Chinese to traditional characters, including the signs in
   the world, without a reload.
7. Every character (player and all NPCs, confirmed) in the blocky style of
   `docs/references/wave4/blocky-person.png`.
8. Trains a little further apart (not too long), with signs counting down to the next train.
9. People in the stations who walk around and board.
10. The ride screen's text runs one line behind the announcer's voice: make them match.
11. A beep when tapping in and out, and real Chinese station announcements (mind the gap etc.).
12. Readable metro signs.
13. The tutorial is a long opening slideshow: keep the steps but let them appear over time as you play.
14. The mouse gets stuck in a small window (the player thinks it's Claude's browser pane): the game
    grabs pointer lock on any click.
15. Clean up the starting page for new players (its text wraps oddly) and find a better first spawn
    than the angle in front of the house.
16. Players should explore more of the small town before the city: the metro opens only after every
    town quest, with hints along the way that the city comes later (task W4-unlock below).

## Rules for every task

- Work only in the folder above. Never touch `C:\Users\jonat\Documents\ChatGPT\Game`, Codex's
  worktrees (`C:\Users\jonat\.codex\worktrees\...`) or ports 5174/5180. Running the Python
  interpreter `..\Game\.venv\Scripts\python.exe` for voice clips is fine.
- No git commit, stash, reset, checkout, add or other staging. Don't edit `.superpowers/` or
  `docs/references/`.
- Seven tasks run at once in this folder. Edit only what your task owns (below). In shared files
  change only your own region with the Edit tool, in small hunks, re-reading before each edit; never
  rewrite, reformat or JSON.parse/stringify-rewrite a shared file. Need something in another task's
  area? Say so in your report. Test failures in other tasks' areas may be their work in progress:
  note them, don't fix them.
- Project rules in `CLAUDE.md`: content in JSON, Chinese first, no invented HSK levels, a failing test
  before changing a rule, match the style of the file you edit. Use only the Chinese in the tables at
  the end (or already in the game). Anything else: English placeholder plus a note in your report;
  the main session writes it. Every new voiced line gets a clip through
  `..\Game\.venv\Scripts\python.exe scripts/generate-voice.py --only <ids>` (never hand-edit
  `public/audio/manifest.json`; see `docs/VOICE_PRODUCTION.md`).
- Must still run on lower-end laptops: batch statics (town.js batching, `models.repaint`), `noBatch`
  only on moving parts, respect `detail()` in `src/core/quality.js`, no new textures unless tiny
  canvases, measure draw calls for new scenes (see `tests/browser/transit.spec.js`).
- Tests: `node --test tests/<file>.test.js`, `npm test`; browser
  `PW_PORT=<your port> npx playwright test <specs> --workers=1` (Playwright starts its own e2e server
  on that port). Finish with `npm run verify`. Keep a checkpoint in
  `.claude/checkpoints/<task id>.md` (in this folder) and save proof screenshots in
  `.claude/checkpoints/<task id>/`. Never open the game in a visible browser or Claude's browser pane;
  headless Playwright only.
- Report in caveman style: files changed, acceptance items with results, tests with pass/fail
  counts, what's left, Chinese wanted.

## Contracts between tasks

- **Station exits** (`src/content/city.json` → `metroStation.exits`, provisional values already in
  place): `{id, zh, to:{zh,pinyin,en}, spawn:[x,z,yaw]}`. Leaving the `yunhai-central` hall through
  exit X puts you at `spawn` (city-local metres, same yaw convention as a room's `returnSpawn`); an
  E-target "进站 · Enter station" at each spawn takes you back in at that exit's stairs. W4-yunhai
  owns the values and the city-side portals; W4-stations owns the hall, the engine support and the
  targets' behaviour. The old single `place.exit` / `returnPlace` path goes.
- **Room fit** (checked by `tests/room-fit.test.js`, written by W4-fit): every room with a
  `building` fits inside it: width ≤ exterior width − 0.4 and depth ≤ exterior depth − 0.4
  (rotation-aware), each floor's height within the exterior's storey height, multi-level rooms
  within the exterior height; annexes and wings need a real exterior volume. Rooms flagged
  `"underground": true` (the stations below street level) are exempt, but their street entrance
  must exist. Decoratable rooms (home, kitchen, study, apartments) never shrink: saved furniture
  positions depend on them.
- **Settings**: W4-script adds `settings.script` ('simplified' | 'traditional'); W4-ux adds
  `settings.mouse` ('drag' | 'lock') and the tips toggle. Both add a row to the settings panel
  (`src/ui/panels.js`) and validation in `decodeProfile` (`src/core/profile.js`): same files,
  separate hunks.
- **Signs**: every new sign text gets a `src/content/signs.json` entry (zh key → pinyin, en), so
  looking at it shows the nameplate. signs.json is shared: add entries with small edits.
- **Characters**: `person(parent,color,pos,hat)` in `src/world/models.js` keeps its signature and
  pivot/part names; commuters, crowds, staff and visitors keep calling it and pick up the new look.
- **Station name**: 云海市中心站 (Yúnhǎi Shì Zhōngxīn Zhàn, "Yunhai City Centre") everywhere, matching
  the existing announcement 下一站：云海市中心 and its quiz answer. 云海中央 / 云海中央车站 go.

## Tasks

| Id | Agent | Port | Scope |
|---|---|---|---|
| W4-stations | task-implementer-max | 5190 | items 1, 8–12 + multi-exit engine |
| W4-yunhai | task-implementer-max | 5191 | items 3, 4 + city side of item 2 |
| W4-apartments | task-implementer-max | 5192 | item 5 |
| W4-fit | task-implementer (opus) | 5193 | item 2 (town + the check) |
| W4-script | task-implementer (opus) | 5194 | item 6 |
| W4-characters | task-implementer (opus) | 5195 | item 7 |
| W4-ux | task-implementer (sonnet) | 5196 | items 13, 14 + Roots-panel test failures |

### W4-stations
1. Qinghe: the square's metro pavilion becomes a proper entrance (glass canopy over a stairwell, 地铁
   mark, 青禾站 sign). Inside you enter at street level and walk down stairs (an escalator beside them
   is welcome) to the underground concourse (站厅: top-up machines, service counter, gates), then on
   to the platform (站台). Coming back you walk up. Reuse `upper` / `upper.entrance`
   (`src/world/interior.js` `upperParts`, today used only by the home) or equivalent.
2. Yunhai: arrive on the underground platform, go up stairs/escalators to the grand hall (high
   ceiling, ring lighting, colour-coded closed line 2/3 entrances) and leave through four exit
   passages A–D, each signed from `metroStation.exits` ("A出口 · 站前广场"). Build generic multi-exit
   support in `src/world/town.js` room enter/leave and the city targets (contract above).
3. Timetable: a full cycle of about 70 s (arrive ~6 s, doors open ~20 s, closing ~4 s, depart ~6 s,
   then a gap), with countdown boards on the concourse and platform: 下一班 N 分钟 · Next train N min,
   即将到站 under 30 s, 列车进站 while arriving. Keep the doorway hold and never trap anyone.
4. Commuters: 6–10 per station (scaled by `detail()`), `person()` walkers that go between entrance,
   machines, gates and platform, wait behind the yellow line, board when the doors open, alight on
   arrival and respawn. They never stand in a doorway for long. Walk animation as in
   `src/world/crowd.js`.
5. Sound: a short synthesized gate beep (WebAudio, 嘀) on tap in and out; a low error tone plus
   余额不足 on the gate display when the balance is short. Announcements from `metro.json` at the
   right moments (approach, doors opening, closing, in the carriage, arrival) with no overlaps and
   sensible cooldowns, at the dialogue volume; generate clips for the new lines (same voice as the
   existing metro clips).
6. Ride: fix the board lagging one line behind the voice (`announce()` in `src/ui/metro.js` writes
   the text after the clip ends; show each line when its clip starts) and the replay race (the
   shared `sequence` counter in `src/ui/order.js` `say`). Replace the 2D overlay with the spec's 3D
   ride: you stay in the carriage, the doors close, tunnel lights and scenery stream past the
   windows, a subtitle strip shows the current announcement (zh / pinyin / en per settings) in sync
   with the audio, with Skip and Replay and the listening question at the end (reward rules
   unchanged), then you arrive at the other platform with the doors opening. Always-fade still works.
   About 20–30 s.
7. Readable signs: large, high-contrast, at sensible heights; every station sign in signs.json;
   the station name rule above.
8. Leftovers: top-up buttons get a double-click guard (review finding); `walls.json` lamps for the
   station rooms; remove the unused `platformedge` builder; station rooms flagged `underground`.
- Owns: `src/world/metro-station.js`, `src/ui/metro.js`, `src/ui/order.js` (`say`),
  `src/content/metro.json`, station rooms in `rooms.json`, station entries in `walls.json` and
  `signs.json`, `src/world/town.js` (room enter/leave, transit hooks, the station targets in
  `cityTargets`), `src/world/interior.js` (stairs only if needed), `src/services/audio.js` (an SFX
  helper), `src/world/models.js` (kiosk/train/ticketmachine only), `world.json` (the square's metro
  pavilion only), tests for metro/transit/stairs. Reads `metroStation` (W4-yunhai owns its values).

### W4-yunhai
1. Station building: move it south into the empty strip beyond z 34 (extend `walk`, move backdrop
   blocks) and build the new exterior after the photos, low-poly: white canopy slab with rounded
   edges on 8–10 trumpet columns (low-sided flared frustums) whose leaf openings glow warm, a wood
   soffit, a glass curtain wall, terraces with glass balustrades, side escalators, and big red
   characters 云海市中心站 with English on the canopy front. Grand from the square and at night.
2. Exits A–D on different sides, each with a visible portal (stairs/escalator canopy, "A出口" sign),
   leading to different places; write their spawns and `to` names into `metroStation.exits`.
3. The avenue becomes a pedestrian boulevard: no carriageway, crossings, lay-bys or bus shelter;
   paving pattern, trees, planters, benches, a water feature; every tower door still reachable.
4. Taxis removed completely: the props and `taxi:i` targets, `src/ui/taxi.js`, `src/core/taxi.js`,
   `lessons/city-taxi.json` and its clips (through the voice pipeline), the quest
   (quests.json 205-213), objects.json 出租车, taxi-only rows in `hsk-authored.tsv`, the references
   in `translation.js`, `dialogue.js`, `main.js:163`, `town.js:910-911`, `street.bays` data and the
   tests (taxi.test.js, taxi.spec.js, taxi parts of city.test.js, conversation.test.js,
   town-fixes.test.js). Keep `src/ui/fade.js` (sleep uses it).
5. Expand the city around the station as its heart: new explorable areas off the exits — the
   station square to the north, and e.g. a pedestrian/food street to the west, a cultural/business
   plaza to the east toward 海风大厦, a city park with a pond and garden to the south — with paths,
   trees, benches, lamps and shopfronts; extend the crowd's bounds so people walk there.
6. City side of item 2: the mall's exterior must contain its 36×36, four-level interior (move the
   mall into the new district or enlarge it; the old plot becomes a plaza or another building), and
   fix bank (+2 w), hospital (+2.2 w), store (+3 w), café, cinema (interior depth 22 vs 12) and the
   bookshop/café podium setbacks, all by the room-fit rule.
- Owns: `src/world/city.js` (except what W4-apartments needs for its tower), `src/content/city.json`
  (all but the far-shore tower entry), `src/core/city.js`, `src/world/mall.js` (exterior only; not
  the lift/floors, and not the sign drawing W4-script hooks), `src/world/crowd.js`,
  `src/content/crowd.json`, `src/world/leds.js` (except W4-script's text redraw), the taxi files
  above, city entries in `signs.json`, city/yunhai/downtown/crowd/mall/taxi specs and unit tests.

### W4-apartments
1. Put the apartments in the far-shore landmark 云海中心 (20, −200), 22×22×160 (its base front is at
   the landing's back edge, in the hedge gap x 9–31), unless it can't work, then another tall
   far-shore tower. Give it a grand entrance (canopy, glass doors, sign 海景公寓 · Harbour View
   Residences) and make it enterable. Remove Codex's small block at (−12, −183) and its signpost.
   Walkable route from the ferry pier with no gaps.
2. Lobby: double height, stone floor, feature lighting, front desk (前台) with a receptionist who
   says the vetted lines, sofas, mailboxes, plants, a lift bank with a floor indicator.
3. Lift: pick a floor (reuse the pattern of the mall lift `src/world/mall.js` 448-505 and the floor
   picker `src/ui/mall.js`; import, don't edit mall.js), 电梯上行/下行 and "N楼到了" voice lines, a
   ding, a short ride.
4. Tiers (a proposal for the player; all numbers in `rental.json`): 单间 studio (35 coins for 7 days,
   matching the lesson's 三十五块), 一室一厅 one-bedroom, 海景房 harbour-view flat, 顶层公寓 penthouse.
   Check the economy (coins per study session and day, ferry fare 3, metro 5) and set prices so the
   studio is affordable early and the penthouse is aspirational. Each unit has its own furnished
   layout, is decoratable, has a bed; higher tiers are bigger with a balcony/terrace, study, bathtub
   and better views. Amenities by tier: 健身房, 游泳池, 空中花园, 屋顶餐厅 (ordering through the
   existing restaurant ordering with existing dishes), 咖啡厅, 洗衣房; access checked by tier.
   Rules: one active lease at a time, per-unit quote/rent/renew/status, wallet conserved, revision
   guard, no offline rent, belongings never lost when you move or a lease ends (existing putAway);
   Codex's `rental {id, until, revision}` (riverside-apartment) becomes the studio.
5. Functional windows: every unit, the lobby and the amenities have real window views. Extend
   `src/world/views.js` (a live render-target portal, today town rooms only) to rooms in a city
   tower, with the portal camera at the tower's real position and the floor's real height, looking
   out the window's side (the harbour side faces +z, toward downtown). Keep its performance rules.
6. Every room fits the tower footprint and floor height (room-fit rule).
7. Leftovers from review: a bad `rental` record must go through `fix('rental')` (repair note and
   backup), not vanish; make the double-rent protection testable in the rules; a content check that
   the lesson's price line matches the studio price; the coplanar faces at city z −175
   (downtown.spec:151); give the rental desk its own voice (a voices.json cast entry) and regenerate
   the rental lesson clips with it.
- Owns: `src/core/rental.js`, `src/ui/rental.js`, `src/world/rental.js`, `src/content/rental.json`,
  rental rooms in `rooms.json`, `src/world/views.js`, far-shore parts of `harbour.json` /
  `src/world/harbour.js` (not `figure()`), the far-shore tower entry in `city.json` and the minimal
  `city.js` hook to hand that tower to rental.js, the receptionist in `voices.json`, apartment
  entries in `signs.json`, the rental section of `scripts/check-content.js`, lease lines in
  `shell.js`/`panels.js`/`rest.js`/`decorate.js`, rental tests.

### W4-fit
1. Write `tests/room-fit.test.js` (rule above), reading the content, not a hard-coded list.
2. Fix every town mismatch (explorer table, e.g. home 7×6 vs 10×9, kitchen 3×5 vs 8×8, reading/study
   wings 4×7 vs 12×9, listening and courtyard with no volume behind the hall, restaurant +4/+3,
   homeware +4/+3, bank +4/+3, clothes-shop +4/+3 ...): enlarge the exterior where there is room
   (always for decoratable rooms), otherwise shrink the shop interior and move its fittings, slots
   and staff to fit. Give the hall's wings and courtyard real volumes. Nothing new may overlap
   (layout and hardware-cleanup specs), NPC paths and doors must still work, and the window-view
   portals must still line up.
3. hardware-cleanup.spec:43 (Zhou overlaps a bench).
4. At handback, list the city/apartment/station cases still failing the check (other tasks fix
   them).
- Owns: `world.json` (town buildings and people, except the metro pavilion), town rooms in
  `rooms.json`, `building()` and wing builders in `src/world/models.js`, wing/annex volumes in
  `src/world/interior.js`, `src/world/wordhall.js`, building placement in `src/world/town.js`,
  `tests/room-fit.test.js`, town layout specs.

### W4-script
1. `settings.script` 'simplified' (default) | 'traditional', validated in `decodeProfile`, a settings
   row 汉字 · Characters: 简体字 / 繁體字. Live both ways, no reload.
2. Converter: `opencc-js` (new dependency: correct conversion needs phrase dictionaries), mainland to
   Taiwan standard characters without vocabulary changes (`from:'cn', to:'tw'`), loaded by dynamic
   import only when traditional is on; plus the reverse for folding input.
3. DOM: while traditional is on, a MutationObserver converts text nodes and the title / aria-label /
   placeholder attributes; never input values or contenteditable; cache conversions; restore exact
   originals when switching back.
4. Canvas text: `label()` in `src/world/models.js`, `src/world/leds.js` text/screen/neon, the mall's
   directory and vertical sign (`src/world/mall.js` 510-537), drones' text (convert when sampled) and
   any other canvas text redraw live and re-upload their textures. `signText` (the look key) stays
   simplified.
5. Input and lookup: typed traditional folds to simplified before matching (a hook in
   `normalize`, `src/core/language.js`); `src/ui/lookup.js` converts a traditional selection before
   the dictionary lookup.
6. Tests: folding unit tests; browser: toggle shows 從一句你好開始 on the quest card, a 3D label
   redraws, 謝謝 is accepted where 谢谢 is expected, toggling back restores the originals, no reload.
- Owns: new `src/services/script.js`, `package.json` / lock, `label()` in models.js, text drawing in
  leds.js / mall.js / drones.js, `normalize` in language.js, `src/ui/lookup.js`, its settings row in
  panels.js and validation in profile.js, its init line in main.js, tests.

### W4-characters
1. Every person blocky like `docs/references/wave4/blocky-person.png`: cube head (skin) a little
   wider than the body, blocky hair cap with fringe and sides (styles: short, side part, bob,
   ponytail or bun, grey for elders), square dark eyes with a light glint, brows, a wide smile;
   boxy torso in a collared shirt (the `color` argument), short sleeves with skin forearms and
   hands, a belt, trousers, dark shoes.
2. Deterministic variety from a seed (skin tones, hair style and colour, trouser colour) so crowds
   differ; named NPCs keep their recognisable colours; the player's clothes (`equip`) still recolour
   hat, shirt, trousers and shoes.
3. Keep `person()`'s signature and the pivots/part names that `src/world/idle.js` (blink, glance,
   smile, breathing), the walk/sit/lie animations, first-person hiding (`town.js` 1342-1351) and
   batching rely on; update them where names must change. `harbour.js` `figure()` bakes the new
   body; hotpot apron and chef hat, stall vendors and the player's backpack still fit.
4. Boxes only, shadows on torso and head only, no more triangles than today.
5. Screenshots: the player in third person, a shopkeeper, a busy street, someone sitting.
- Owns: `person()` and helpers in models.js, `src/world/idle.js`, `figure()` in harbour.js, the
  add-on lines in hotpot.js / stalls.js, `equip()`, first-person hiding and the person-creation lines
  in town.js, a characters spec.

### W4-ux
1. Tutorial over time: after Start and the one short Roots welcome panel, no slideshow. Tips show
   one at a time, small and non-blocking, hiding after ~10 s or when done, at least 60 s apart, each
   once, triggered by play: look and walk at the start (only these); `word` when you first look at a
   nameable object; `bank` after your first word; `talk` near the first NPC; `missions` after ~2 min
   or when the quest card first changes; `coins` on the first coin change; `view` after ~4 min;
   `listen` when an NPC first speaks; `home` near home; `inside` on first entering home; `needs`
   when the Condition badge first shows; `shops` near the first shop; `park` near the park; `gates`
   near a district gate. Reuse the tutorial.json texts (shorten the English if needed; no new
   Chinese). A tips on/off setting. Migrate old `profile.tutorial` ({step, progress} / {done:true}).
2. Mouse: `settings.mouse` 'drag' (default) | 'lock'. Drag never requests pointer lock: hold the
   left button and drag to look; a click without a drag (< 6 px and < 300 ms) keeps today's
   left-click actions (place, throw, photo); right-hold camera unchanged; cursor visible; hint texts
   updated. Lock keeps today's behaviour plus release on window blur / visibility change and no
   automatic re-lock after a panel. Settings row 鼠标 · Mouse: 拖动转视角 / 锁定鼠标.
3. The 18 browser failures where the Roots welcome panel covers fresh saves (game ×8, tutorial ×4,
   city ×4, water, hardware-cleanup:7): fix once in a shared place (a test helper or an explicit
   e2e flag the specs opt into), without changing what real players see; don't edit the city or
   yunhai specs beyond that shared fix.
4. Starting page (the arrival screen, `src/ui/shell.js` ~83, with the sign-in / guest choice):
   clean, calm layout that reads well at 1440×1000, 1280×720 and 390×844; no odd wrapping (balanced
   lines, no orphaned single characters or words, Chinese lines never broken mid-phrase); clear
   primary action. Keep its content and the sign-in / guest flow.
5. First spawn: pick a better arrival spot than the angle in front of the house. Try at least three
   candidates (e.g. arriving at the town's entrance gate or bus stop looking into the square, the
   square's edge with the fountain and lanterns in view, the riverside approach), screenshot each at
   the default camera, and choose the one that best shows the town, fits the Roots opening (you
   arrive with your grandfather's album) and keeps the first photo or quest target in easy reach.
   Put the spawn in content, not code; list the candidates and screenshots in the report.
- Also owns: the arrival screen markup and styles, and the town spawn in content.
- Owns: `src/core/tutorial.js`, `src/ui/tutorial.js`, `src/content/tutorial.json`, the start flow and
  tutorial hooks in main.js, `src/ui/roots.js` (opening order only if essential), the input region
  of town.js (~1240-1390), mouse bits of `src/ui/camera.js`, hint texts in shell.js, its settings row
  and validation, tutorial/keys/mouse specs and the shared test helper.

### W4-unlock (added after the player's answers)
Decisions (player, 2026-09-30): every town quest must be done first, with hints that the city comes
later; the only language check is a final chat with the station attendant; in the story Auntie Lin
gives you Grandpa's old transit card and a new album photo from Yunhai; before that you may walk
down and look round the concourse (trains, commuters) but the gates won't let you through.
1. Rule (new `src/core/unlock.js`, unit-tested): `townQuestsLeft(profile)` = the town quests in
   quests.json not yet done (everything except `metro-first` and the city quests: greet, four-words,
   name-things, souvenir, furnish, market, order, furnish-shop, daily, teahouse-permit,
   teahouse-build, home-noodles) plus the Qinghe steps of Roots chapter 1 (album photos and the fruit
   stand) that a guest can finish offline. Check every required step can be completed in town
   without the city or the cloud; leave out any that can't and say which. `metroOpen(profile)` is
   true once the check chat is passed, or for saves that already travelled (metro trips, the
   `metro:first` flag or a city visit), and in admin mode.
2. Hints before it opens: the metro-first quest shows 完成青禾的任务后开放 with the count left; a few
   townsfolk now and then say the vetted hint lines; the album shows a blurred Yunhai page; the
   station attendant says the locked lines with your progress (N / M) at the gates.
3. When the last town step is done: a notice 林阿姨在找你！, Lin's target shows it, and talking to her
   plays the card scene (vetted lines, one reply 谢谢), giving `交通卡` (Grandpa's card, an inventory
   item with a description) and a new album page: a photo of Grandpa by the sea in Yunhai with the
   note 云海的海风，很舒服。 (its retake spot on the promenade, if Roots photos can target the city).
   Check Lin's Chinese name in npcs.json; if it isn't 林阿姨, say so instead of changing the lines.
4. The check: at the concourse service counter (服务中心) the attendant's chat (vetted, four nodes,
   the listening node reuses the existing `metro-next-city` clip). Finishing it activates the card
   and opens the gates; no coins change hands.
5. Voice: Lin's existing voice; a new cast voice for the station attendant (站务员); clips for every
   new line. Tests: the rule, grandfathered saves, hints, the full unlock path in a browser spec.
- Contract with W4-stations: W4-stations' gates call `metroOpen(profile)` and, when closed, show
  the attendant's locked lines and progress instead of opening; its service counter target
  `metro:service` calls `openMetroCheck(ctx)` from new `src/ui/unlock.js` (W4-unlock). The
  concourse stays walkable before the unlock.
- Owns: `src/core/unlock.js`, `src/ui/unlock.js`, a new content file `src/content/unlock.json` (the
  chats, hints and card item text), the card in `catalog.json`, the new page in `roots.json`, the
  locked quest display in the quest card (shell.js quest rendering only), its interaction lines in
  main.js, the attendant in `voices.json`, the ambient hint hook for townsfolk, its tests. Port 5197.

### W4-camera (added later; starts when W4-ux has finished, since both touch input and camera.js)
Player requests and decisions (2026-09-30): the zoom is too strong to recreate the "friends in the
square" album photo, so zoom must be adjustable; taking photos is impossible on a trackpad; the
camera you start with becomes Grandpa's camera, which photographs album places only and never uses
film (retakes included); film is only for your own camera, bought secondhand at the Qinghe resale
shop (about 40 coins), and getting it is a main town quest (so it counts for the metro unlock).
1. Two cameras. 爷爷的相机 (keepsake, given at the Roots opening instead of the 6 starter film):
   album photos only, free, unlimited retakes; aimed anywhere else the shutter says 爷爷的相机只拍相册里
   的地方。 with an English line pointing to the secondhand shop. 二手相机 (catalog item, resale shop,
   ~40 coins): 打卡 check-ins and free photos, one film each; film sold as today. The viewfinder shows
   which camera is up (爷爷的相机, or 我的相机 · 胶卷 N); the game picks Grandpa's at an album spot while
   that photo is being sought, otherwise yours if owned; a key or button switches. Existing film
   stays in the inventory; saves that already took album photos keep them.
2. Zoom: adjustable about 1×–4× (default gentler than today's fixed zoom) by mouse wheel / two-finger
   scroll, the +/- keys and an on-screen slider; aim sensitivity follows the zoom (as today).
3. Trackpad and keyboard: the camera key toggles the viewfinder (hold right mouse still works); a
   single click or tap on the viewfinder, Enter / Space or an on-screen shutter button takes the photo;
   the arrow keys turn and tilt (outside the camera too, for trackpad players); Esc lowers it;
   the viewfinder shows these controls. Also works with touch (src/ui/touch.js).
4. The friends-in-the-square album photo: reproduce, check its `qualifies()` thresholds and reference
   framing, make it achievable at the default zoom, and prove it in a browser test that walks there
   and captures it. Give gentle framing hints if they're cheap.
5. Quest `my-camera` (town, near the resale shop): 用自己的相机打卡 · Buy a secondhand camera at the
   resale shop and take a check-in photo with it. Done on the first 打卡 stamp taken with your own
   camera, recorded as a `done.flag` (e.g. `camera:first`) pushed to `completed`: W4-unlock's rule and
   tests (tests/unlock.test.js, tests/browser/unlock.spec.js) read the quest's `done.flag`.
- Owns: `src/ui/camera.js`, `src/core/story-photo.js`, `src/ui/album.js`, the film and opening-gift
  bits of `src/ui/roots.js` / `src/content/roots.json`, `src/content/checkins.json` (zoom and ui
  labels), the camera items in `catalog.json`, the resale shop's stock, the `my-camera` quest in
  quests.json, camera/zoom/shutter/look keys in `keys.json`, the camera parts of town.js input,
  camera/checkin/roots-photo tests. Port 5198.

### W4-park (added 2026-09-30 after the player's answers)
The player starts at the town gate inside 莲池公园, so the park becomes the game's first impression:
"make the park super nice". Push the park wall back to enlarge it, move Grandpa's house (home +
kitchen + study) to a new, larger plot beside the park entrance (interiors unchanged, so saved
furniture stays valid), and choose the spawn there. Port 5202. Owns: the garden district in
`world.json` (park, home building and wings, spawn, park people), `src/content/garden.json`,
`src/world/garden.js` / `src/core/garden.js`, the park/home construction in town.js, the Roots
house memory aim point, quests `where` markers for home/furnish, the tutorial's home trigger, park
and home tests (first-view, home-layout, home-access, room-fit home todo, layout, hardware-cleanup).

### W4-hero (2026-10-01)
A more detailed blocky look from `docs/references/wave4/blocky-person-detailed.png`, for the
player only until the player approves it; then for everyone.

### W4-glass (2026-10-01; starts after W4-fixB, which is editing views.js and the rental files)
1. Mirrors: the `mirror` fittings in rooms.json reflect for real: a planar render-target reflection
   (reuse the bay.js `reflect` / views.js patterns) showing the room and the player's whole body
   (head too, even in first person); rendered only while on screen and near, one at a time, low
   resolution or off on 低.
2. Apartment windows clearer: higher render-target resolution for tower-room views (full on 高),
   lighter haze for those views so the city reads clearly, and the real sky instead of a flat one;
   measure the cost.
3. Balconies you can walk onto: in flats with a balcony or terrace, a door leads out onto a real
   balcony at the tower's true height in the city (place 'city', solid glass railings, small walk
   area), so the view is the actual city with no glass; walking back in returns to the flat; a
   reload there puts you safely inside; the camera works out there. Door labels: 去阳台 qù yángtái
   (To the balcony), 回房间 huí fángjiān (Back inside).

## Vetted Chinese

### Station announcements (new `metro.json` lines, voiced)

| id | zh | pinyin | en |
|---|---|---|---|
| welcome | 欢迎乘坐青禾地铁。 | Huānyíng chéngzuò Qīnghé Dìtiě. | Welcome to the Qinghe Metro. |
| bound-city | 本次列车开往云海市中心。 | Běn cì lièchē kāiwǎng Yúnhǎi Shì Zhōngxīn. | This train is bound for Yunhai City Centre. |
| bound-town | 本次列车开往青禾。 | Běn cì lièchē kāiwǎng Qīnghé. | This train is bound for Qinghe. |
| yellow-line | 请站在黄线以内候车。 | Qǐng zhàn zài huángxiàn yǐnèi hòuchē. | Please wait behind the yellow line. |
| off-first | 请先下后上。 | Qǐng xiān xià hòu shàng. | Please let passengers off first. |
| gap | 请注意列车与站台之间的空隙。 | Qǐng zhùyì lièchē yǔ zhàntái zhījiān de kòngxì. | Please mind the gap between the train and the platform. |
| doors-closing | 车门即将关闭，请勿上下车。 | Chēmén jíjiāng guānbì, qǐng wù shàng xià chē. | The doors are closing. Please don't board or alight. |
| move-in | 请往车厢中部走。 | Qǐng wǎng chēxiāng zhōngbù zǒu. | Please move to the middle of the carriage. |
| seats | 请为有需要的乘客让座。 | Qǐng wèi yǒu xūyào de chéngkè ràngzuò. | Please offer your seat to passengers in need. |
| no-lean | 请勿倚靠车门。 | Qǐng wù yǐkào chēmén. | Please don't lean on the doors. |
| get-ready | 下车的乘客请做好准备。 | Xià chē de chéngkè qǐng zuòhǎo zhǔnbèi. | Passengers getting off, please get ready. |
| arrive-city | 云海市中心站到了。 | Yúnhǎi Shì Zhōngxīn Zhàn dào le. | This is Yunhai City Centre. |
| arrive-town | 青禾站到了。 | Qīnghé Zhàn dào le. | This is Qinghe. |
| low-balance | 余额不足，请充值。 | Yú'é bùzú, qǐng chōngzhí. | Insufficient balance. Please top up. |

Existing lines stay: doors, hold, next-city, next-town, arriving, arrived, question.

### Station signs (signs.json; not voiced)

| zh | pinyin | en |
|---|---|---|
| 青禾站 | Qīnghé Zhàn | Qinghe Station |
| 云海市中心站 | Yúnhǎi Shì Zhōngxīn Zhàn | Yunhai City Centre Station |
| 地铁 | dìtiě | Metro |
| 1号线 / 2号线 / 3号线 | yī / èr / sān hào xiàn | Line 1 / 2 / 3 |
| 建设中 · 即将开通 | jiànshè zhōng · jíjiāng kāitōng | Under construction · Opening soon |
| 进站 / 出站 / 出口 | jìn zhàn / chū zhàn / chūkǒu | Entrance / Way out / Exit |
| A出口 … D出口 | A chūkǒu … | Exit A … Exit D |
| 刷卡进站 / 刷卡出站 | shuā kǎ jìn zhàn / chū zhàn | Tap card to enter / exit |
| 充值 · 交通卡 · 余额 | chōngzhí · jiāotōngkǎ · yú'é | Top up · Transit card · Balance |
| 余额不足 | yú'é bùzú | Insufficient balance |
| 闸机 · 屏蔽门 · 列车 | zhájī · píngbìmén · lièchē | Gates · Platform doors · Train |
| 站厅 · 站台 | zhàntīng · zhàntái | Concourse · Platform |
| 楼梯 · 扶梯 · 电梯 | lóutī · fútī · diàntī | Stairs · Escalator · Lift |
| 往云海市中心 / 往青禾 | wǎng Yúnhǎi Shì Zhōngxīn / wǎng Qīnghé | To Yunhai City Centre / To Qinghe |
| 下一班 N 分钟 | xià yì bān N fēnzhōng | Next train N min |
| 即将到站 · 列车进站 | jíjiāng dào zhàn · lièchē jìn zhàn | Arriving soon · Train arriving |
| 小心站台间隙 | xiǎoxīn zhàntái jiànxì | Mind the gap |
| 请站在黄线以内 | qǐng zhàn zài huángxiàn yǐnèi | Stay behind the yellow line |
| 换乘 · 候车区 | huànchéng · hòuchē qū | Transfer · Waiting area |
| 洗手间 · 服务中心 | xǐshǒujiān · fúwù zhōngxīn | Toilets · Service centre |
| 重播 | chóngbō | Replay |

### Yunhai around the station (place names; W4-yunhai)

站前广场 zhànqián guǎngchǎng Station Square · 步行街 bùxíng jiē Pedestrian Street · 美食街 měishí jiē Food
Street · 滨海步道 bīnhǎi bùdào Seaside Promenade · 城市公园 chéngshì gōngyuán City Park · 中心广场
zhōngxīn guǎngchǎng Central Square · 文化中心 wénhuà zhōngxīn Cultural Centre · 商务区 shāngwù qū
Business District · 天桥 tiānqiáo Footbridge · 地下通道 dìxià tōngdào Underpass · 喷泉 pēnquán
Fountain · 花园 huāyuán Garden · 湖 hú Lake · 博物馆 bówùguǎn Museum · 图书馆 túshūguǎn Library ·
音乐厅 yīnyuètīng Concert Hall · 艺术馆 yìshùguǎn Art Gallery · 书店 shūdiàn Bookshop · 咖啡店
kāfēidiàn Café · 奶茶店 nǎichádiàn Bubble Tea · 面包店 miànbāodiàn Bakery · 小吃 xiǎochī Snacks ·
欢迎来到云海 Huānyíng lái dào Yúnhǎi Welcome to Yunhai. No new dialogue: list any you want.

### Apartments (W4-apartments)

Signs: 海景公寓 Hǎijǐng Gōngyù Harbour View Residences · 大堂 dàtáng Lobby · 前台 qiántái Front desk ·
电梯 diàntī Lift · 信箱 xìnxiāng Mailboxes · 物业 wùyè Management office · N楼 N lóu Floor N · 顶楼
dǐnglóu Top floor · 单间 dānjiān Studio · 一室一厅 yí shì yì tīng One-bedroom flat · 海景房 hǎijǐng
fáng Harbour-view flat · 顶层公寓 dǐngcéng gōngyù Penthouse · 卧室 wòshì Bedroom · 客厅 kètīng Living
room · 厨房 chúfáng Kitchen · 浴室 yùshì Bathroom · 书房 shūfáng Study · 阳台 yángtái Balcony · 露台
lùtái Terrace · 健身房 jiànshēnfáng Gym · 游泳池 yóuyǒngchí Pool · 空中花园 kōngzhōng huāyuán Sky
garden · 屋顶餐厅 wūdǐng cāntīng Rooftop restaurant · 咖啡厅 kāfēitīng Café · 洗衣房 xǐyīfáng Laundry.

Voiced lines:

| id | zh | pinyin | en |
|---|---|---|---|
| desk-welcome | 欢迎来到海景公寓！ | Huānyíng lái dào Hǎijǐng Gōngyù! | Welcome to Harbour View Residences! |
| desk-rent | 您好，想租房吗？ | Nín hǎo, xiǎng zūfáng ma? | Hello, are you looking to rent? |
| desk-lift | 电梯在那边。 | Diàntī zài nàbiān. | The lift is over there. |
| desk-home | 欢迎回家！ | Huānyíng huíjiā! | Welcome home! |
| desk-due | 您的房租快到期了。 | Nín de fángzū kuài dàoqī le. | Your rent is almost due. |
| lift-up | 电梯上行。 | Diàntī shàngxíng. | Going up. |
| lift-down | 电梯下行。 | Diàntī xiàxíng. | Going down. |
| lift-floor-N | N楼到了。 | N lóu dào le. | Floor N. |

For "N楼到了" write N in Chinese numerals (一楼 yī lóu, 二楼 èr lóu … 十五楼 shíwǔ lóu, 二十八楼 èrshíbā
lóu); the top floor is 顶楼到了。 Dǐnglóu dào le.

### Metro unlock (W4-unlock; all voiced except the quest note and the notice)

| id | who | zh | pinyin | en |
|---|---|---|---|---|
| locked-1 | attendant | 去云海要先多学一点中文。 | Qù Yúnhǎi yào xiān duō xué yìdiǎn Zhōngwén. | Before Yunhai, learn a bit more Chinese. |
| locked-2 | attendant | 先把青禾的任务做完，再来找我吧！ | Xiān bǎ Qīnghé de rènwu zuòwán, zài lái zhǎo wǒ ba! | Finish Qinghe's tasks first, then come and find me! |
| hint-1 | townsfolk | 云海很大，也很热闹！ | Yúnhǎi hěn dà, yě hěn rènao! | Yunhai is big and lively! |
| hint-2 | townsfolk | 等你中文更好了，一定要去云海看看。 | Děng nǐ Zhōngwén gèng hǎo le, yídìng yào qù Yúnhǎi kànkan. | When your Chinese is better, you must go and see Yunhai. |
| hint-3 | townsfolk | 坐地铁去云海，很快就到。 | Zuò dìtiě qù Yúnhǎi, hěn kuài jiù dào. | By metro you're in Yunhai in no time. |
| quest-locked | quest card | 完成青禾的任务后开放 | Wánchéng Qīnghé de rènwu hòu kāifàng | Opens after you finish Qinghe's tasks |
| lin-calls | notice | 林阿姨在找你！ | Lín āyí zài zhǎo nǐ! | Auntie Lin is looking for you! |
| lin-card-1 | Lin | 你来青禾以后，中文进步了很多！ | Nǐ lái Qīnghé yǐhòu, Zhōngwén jìnbù le hěn duō! | Your Chinese has come a long way since you came to Qinghe! |
| lin-card-2 | Lin | 这是你爷爷的交通卡。他以前常常坐地铁去云海。 | Zhè shì nǐ yéye de jiāotōngkǎ. Tā yǐqián chángcháng zuò dìtiě qù Yúnhǎi. | This is your grandpa's transit card. He often took the metro to Yunhai. |
| lin-card-3 | Lin | 去地铁站的服务中心，请他们帮你开通吧。 | Qù dìtiězhàn de fúwù zhōngxīn, qǐng tāmen bāng nǐ kāitōng ba. | Go to the station's service centre and ask them to activate it. |
| photo-note | album | 云海的海风，很舒服。 | Yúnhǎi de hǎifēng, hěn shūfu. | The sea breeze in Yunhai feels wonderful. |

Lin's scene: lin-card-1 and lin-card-2 just continue; after lin-card-3 the prompt 说谢谢。(Shuō
xièxie. Say thank you.) accepts 谢谢 / 谢谢你 / 谢谢林阿姨 / 谢谢阿姨 / 太谢谢了, model 谢谢林阿姨！

The attendant's check (站务员 zhànwùyuán):

| node | attendant says | prompt | accepted (model first) |
|---|---|---|---|
| card | 你好！这张卡是你的吗？ Nǐ hǎo! Zhè zhāng kǎ shì nǐ de ma? (Hello! Is this card yours?) | 说这是你爷爷的卡。 Shuō zhè shì nǐ yéye de kǎ. (Say it's your grandpa's card.) | 这是我爷爷的卡 · 是我爷爷的 · 我爷爷的卡 · 这是我爷爷的交通卡 · 是我爷爷的卡 |
| where | 到了云海，你想去哪儿？ Dàole Yúnhǎi, nǐ xiǎng qù nǎr? (Once you're in Yunhai, where would you like to go?) | 说一个你想去的地方。 Shuō yí ge nǐ xiǎng qù de dìfang. (Name a place you'd like to go.) | template {我想去, 我要去, 去}{海边, 商场, 书店, 公园, 银行, 医院, 电影院, 面馆, 咖啡店, 步行街, 美食街}; model 我想去海边 |
| listen | (the existing announcement clip `metro-next-city`: 下一站：云海市中心。) | the existing line 刚才广播说下一站是哪儿？ | 云海市中心 · 下一站是云海市中心 · 是云海市中心 · 云海市中心站 |
| done | 很好！你的中文没问题。卡开通了，祝你玩得开心！ Hěn hǎo! Nǐ de Zhōngwén méi wèntí. Kǎ kāitōng le, zhù nǐ wán de kāixīn! (Great, your Chinese is fine. Your card is active, have fun!) | 说谢谢。 Shuō xièxie. (Say thank you.) | 谢谢 · 谢谢你 · 谢谢您 · 太好了谢谢 |

Card item: 爷爷的交通卡 yéye de jiāotōngkǎ, Grandpa's transit card; description 很旧的交通卡，上面写着爷爷的名字。
Hěn jiù de jiāotōngkǎ, shàngmiàn xiězhe yéye de míngzi. (An old transit card with Grandpa's name on
it.)

### Cameras (W4-camera)

| use | zh | pinyin | en |
|---|---|---|---|
| keepsake | 爷爷的相机 | yéye de xiàngjī | Grandpa's camera |
| its description | 爷爷的老相机，用来拍相册里的地方。 | Yéye de lǎo xiàngjī, yònglái pāi xiàngcè lǐ de dìfang. | Grandpa's old camera, for the places in the album. |
| item | 二手相机 | èrshǒu xiàngjī | Secondhand camera |
| its description | 一台旧的二手相机，拍照要用胶卷。 | Yì tái jiù de èrshǒu xiàngjī, pāizhào yào yòng jiāojuǎn. | An old secondhand camera; photos use film. |
| viewfinder | 我的相机 · 胶卷 N | wǒ de xiàngjī · jiāojuǎn N | My camera · film N |
| notice | 爷爷的相机只拍相册里的地方。 | Yéye de xiàngjī zhǐ pāi xiàngcè lǐ de dìfang. | Grandpa's camera only photographs the places in the album. |
| buttons | 拍照 · 变焦 · 放下 | pāizhào · biànjiāo · fàngxià | Take photo · Zoom · Put down |
| quest | 用自己的相机打卡 | Yòng zìjǐ de xiàngjī dǎkǎ | Check in with a camera of your own |

### Park (W4-park; signs and look names, not voiced unless a sign is)

莲池公园 Liánchí Gōngyuán Lotus Pond Park (existing) · 九曲桥 jiǔqū qiáo zigzag bridge · 莲心亭 (existing
pavilion) · 假山 jiǎshān rockery · 竹林 zhúlín bamboo grove · 柳树 liǔshù willow · 荷花 héhuā lotus flower ·
荷叶 héyè lotus leaf · 锦鲤 jǐnlǐ koi · 鸭子 yāzi duck · 太极拳 tàijíquán tai chi · 下象棋 xià xiàngqí
playing Chinese chess · 地书 dìshū water calligraphy · 放风筝 fàng fēngzheng flying a kite · 石桌
shízhuō stone table · 石凳 shídèng stone stool · 小溪 xiǎoxī stream · 瀑布 pùbù waterfall · 花坛 huātán
flowerbed · 梅花 méihuā plum blossom · 桃花 táohuā peach blossom · 蝴蝶 húdié butterfly · 萤火虫
yínghuǒchóng firefly · 欢迎来到青禾 Huānyíng lái dào Qīnghé Welcome to Qinghe. New look names need an
objects.json entry; take HSK levels only from public/hsk/words.json, never guess. No new dialogue.

### Settings

汉字 hànzì Characters · 简体字 jiǎntǐzì Simplified · 繁體字 fántǐzì Traditional · 鼠标 shǔbiāo Mouse ·
拖动转视角 tuōdòng zhuǎn shìjiǎo Hold and drag to look · 锁定鼠标 suǒdìng shǔbiāo Lock the mouse.

## What shipped (2026-09-30 to 2026-10-02)

Nothing is committed. Everything lives in this folder's working tree; the state before this work
began is saved as `refs/snapshots/transit-start` (be24655). Agent notes for every task are in
`.claude/checkpoints/<task id>.md`, with screenshots beside them.

**Codex's transit plan, finished first.** TX-metro (card-only rules, save version 8 with an explicit
upgrade from old tickets, journey recovery, station rebuild), TX-rental and TX-condition, then a
review and its fixes (journal tooltip, rent reminder, Chinese-first condition labels).

**Wave 4.**
- W4-stations: Qinghe's street entrance with stairs down to the concourse and platform; Yunhai's
  hall with four exits (multi-exit rooms); a 70 s timetable with countdown boards; commuters; gate
  beeps and an announcement queue; the ride strip in sync with the voice and a 3D carriage ride;
  readable signs; 云海市中心站 as the one station name.
- W4-yunhai: the station moved south with the canopy-and-trumpet-column exterior; exits to
  站前广场, 美食街, 文化中心 and 城市公园; the avenue became a pedestrian boulevard; taxis removed
  entirely; the mall moved onto 美食街 at 37×37; every city room fits its building.
- W4-apartments: 海景公寓 in the 云海中心 tower: lobby with a receptionist, a lift, four tiers
  (35 / 90 / 180 / 420 coins per 7 in-game days), amenities by tier, live window views.
- W4-fit: `tests/room-fit.test.js` and town buildings resized so interiors fit.
- W4-script: the 繁體字 setting (opencc-js, loaded on demand), live page and canvas conversion,
  traditional input folded for matching.
- W4-ux: tips over time instead of the opening slideshow, a new start page, the shared
  `startGame` test helper. (Its drag-to-look default was reverted on 10-02: pointer lock is the
  default again, drag stays an option; the e2e server keeps drag.)
- W4-unlock: the metro opens after every town step (14 now, including fishing, vegetables and
  the camera quest); 林阿姨 gives 爷爷的交通卡; the attendant's check chat.
- W4-camera: Grandpa's camera (album only, never uses film), the 二手相机 at the resale shop,
  zoom 1–4×, trackpad/keyboard/touch controls, the square photo made achievable, quest my-camera.
- W4-park: the park redesigned as the first view, Grandpa's house moved beside the park gate, the
  spawn at the gate.
- W4-glass: planar mirrors, sharper tower windows, walk-out balconies.
- W4-fixA / W4-fixB: review fixes. The journal's 生词本 list folds.

**Wave 5, the Jiangnan look** (spec `../specs/2026-10-01-jiangnan-look-design.md`, approved by
the player after the P0 test).
- W5-look: the CameraFrame pipeline, painterly textures and the `jiangnan.js` kit.
- W5-town: every Qinghe building restyled (`jiangnan-town.js`); old front builders deleted.
- W5-rooms: every interior dressed (`jiangnan-rooms.js`, `goods.json`), furniture bevelled; all
  rooms on 中 went from 7752 to 2878 draw calls.
- W5-nature: paving, the sunk canal, bridges, boats, trees and the park's materials
  (`jiangnan-nature.js`).
- W5-people: everyone rebuilt from the three reference sheets in `docs/references/wave4/`
  (`people.js`, `people.json`): the player, Qinghe's villagers and Yunhai's city people; sitting
  reworked.
- W5-blender: Blender run headless (`scripts/blender`, `npm run models`), the loader
  `src/world/assets.js` and five pilot models, not yet placed in the world.

**Wave 6.**
- W6-fields: 青禾田园 past the park gate with the fishing and vegetable quests
  (spec `../specs/2026-10-01-fields-design.md`).
- W6-perf: an automatic quality governor that starts on 中 at pixel ratio 1.25, pixel-ratio caps,
  shared lamp materials and small batches, cropped mirror/view renders, an admin performance
  overlay. The park spawn went from about 15 ms to 9 ms of work a frame on 中 (Iris Xe).
- W6-cleanA / W6-cleanB: the full browser suite's 39 failures fixed (outdated tests updated, real
  regressions fixed, including waiters opening as shop assistants).

**Open.** Place the Blender pilot models and make village props (baskets, hats, boats) in Blender;
hair and props are not fully 1:1 with the sheets; children's and sofa seated feet; the Yunhai
painterly materials pass (P5); real art for the Yunhai album page; the Roots business migration on
the hosted database is still deferred (from Codex).
