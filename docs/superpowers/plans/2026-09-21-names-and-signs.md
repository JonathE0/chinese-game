# Every item nameable, every sign readable

## Context
Player request: "for every single item in the game that has a different sprite can you ensure that it
has an identifier. For example, sink in kitchen, cups on tables, also when I look at signs show me
what the sign says exactly."

Today a look ray (`registry.look`, `src/world/registry.js:70-78`) returns the nearest **named box**;
boxes are hand-placed (`town.mark`, `root.addMark`, fitting/furniture/prop boxes). Audits found:
- Sub-items inside one parent box all read as the parent: the kitchen fitting's sink, tap, pot,
  hood and cupboards all read 灶台 (`stove`); cups/plates on tables read 桌子; pillows/quilt read 床;
  book spines read 书架; building windows/awnings/roofs read the building; etc.
- Some items have no box at all (hall lanterns, waiters, ambient friends, gate paifangs, closed
  signs, counter goods, décor placed on a table, loose items) or a broken one (ceiling lamp box on
  the floor, wardrobe/dresser boxes too short, `desklamp`/`teaset` keys missing → blank plate,
  postbox/trolley/stacked-furniture names `undefined`, bookshop named 词语馆, lotus/koi boxes at
  the wrong height, zebra crossing mark never added, an opened gate still reads 门, the unbuilt
  teahouse's invisible marks over the hoarding).
- Every sign reads the generic 招牌; its text is never shown. All 3D text goes through
  `label()` (`src/world/models.js:30-36`), which does not keep the text.
- `look` picks the smallest entry distance, so a small item inside a bigger box always loses, and a
  box containing the eye wins in every direction (gates, pine canopies, awnings).

Decisions (asked): signs show exact text, **F saves the phrase to 生词本** (not counted as a named
object, no HSK gate effect); **repeated tiny items share one cluster name**; **people by role**
(waiter 服务员, stall keeper 摊主, townsfolk 人).

## Approach
Tag instead of hand-placing boxes: builders set a plain property on the entity that is the item —
`e.lookName='sink'` (object key) — and `label()` sets `e.signText=text`. One walk per place turns
each tagged entity into a **look-only box** from the union world AABB of its meshes
(`meshInstance.aabb`, valid right after building, even under disabled roots). Look-only boxes live
in a separate `registry.looks` list, so collision loops don't grow. `look()` gains two rules:
ignore boxes that contain the eye, and a more specific (smaller) box hit before the ray leaves a
bigger box wins.

### 1. Engine (registry, town hooks, look, UI)
- `src/world/registry.js`: `looks=[]`; `addLook(box)` (keeps `place`, AABB, `name`, `owner`);
  `clearLooks(place,owner?)`; `look()` scans `boxes`+`looks`: skip a box whose extent contains
  the eye; collect hits with entry/exit t; winner = nearest entry, replaced by any hit whose entry
  lies before the winner's exit and whose volume is smaller. Existing unit test pattern:
  `tests/living.test.js:139-151`.
- `src/world/town.js`: `registerLooks(place,root,{owner,skip})` — walk `root`, for each entity
  with `lookName` or `signText` register one box (union AABB of its render meshes; nested tagged
  children get their own boxes and win by the specificity rule). Call it:
  - town: end of `registerTown` over `this.root`, skipping people, carts, closed signs, steam,
    water wheel, disabled site buildings (re-run for a site on `revealSite`);
  - rooms: in `registerRooms` per `room.root` (meshes already at `offsetX`; don't skip disabled
    roots); city: in `ensureCity` over `built.root` (never re-run `registerRooms` there);
  - furniture: `addProp`/`removeProp` register/clear looks with `owner=record.uid` (décor on a
    table then gets its own box);
  - moving things (stall carts while open, waiters, ambient friends): per-frame update reusing the
    `NightMarket.syncHitboxes` pattern (`src/world/stalls.js:157-173`), named by role.
- Sign names: `src/content/signs.json` `{ "<exact text>": {"id":"ascii-id","pinyin","en"} }`;
  a sign box's name is `{id:'sign:'+id, zh:text, pinyin, en, sign:true}`.
- `lateUpdate` (`town.js:1077-1085`): fire `onLook` when the box changes, not just `name.id`.
- `src/ui/shell.js` `nameplate` (L230-241): sign → exact text; "known" = phrase in `profile.saved`.
- `src/main.js` `collect` (L120-135): sign → `addWord({zh,pinyin,en,audio:'sign-'+id})`, no
  `discovered` push; objects unchanged.
- `scripts/generate-voice.py`: add `signs.json` as a source (`sign-<id>`, teacher voice);
  `scripts/check-content.js`: signs ids unique ASCII, pinyin/en present, clip coverage.
- Fixes owned here: opened gate drops its `door` name (`setUnlocked`), unbuilt site buildings not
  registered until `revealSite` and the hoarding `wall` mark removed when built, bookshop object →
  `bookshop`.

### 2. Tagging passes (set `lookName` / use existing keys; no hand coordinates)
- **models.js** — every builder's distinct sub-items, clusters for repeats. Kitchen fitting: sink,
  tap, pot, rangehood, cupboard, stove (hob); coffeebar: coffee-machine, cup, cake; dining/café
  tables: cup, plate; tea set: teapot, cup; bed: pillow, quilt; sofa: cushion; bookcase/shelf/
  study-wing shelf: book (one cluster per shelf); reading/study desk: book, notebook, pen, paper;
  shelfunit: jar; fridge: milk; pastry case: eggtart, bread, donut; checkout: till; bank counter
  screens: window; fishtank: water, plant; cupshelf: bowl; carrel: lamp, chair, paper; booth:
  monitor, stool; pond patch: water, stone, lotus, fish, rock; streetlight head, parasol canopy,
  bicycle basket, planter flower; buildings: window, roof, awning (striped + modern canopy),
  pillar (posts/arcade), stone (plinth), hanging sign (text via `label`); kitchen wing garlic,
  chilli; details: postbox, trolley, dresser/chair for stacked furniture, green cross → sign;
  furniture: ceiling lamp tagged on the lamp itself (fixes the floor box), wardrobe/dresser full
  height, desklamp, teaset, round stool → stool; stall cart: hawthorn, skewer, lantern-string,
  pot, awning, canopy sign.
- **interior.js / town.js scene / garden / wordhall / city / stalls** — room shell ceiling, beam,
  lanterns, corner pillars, stair railings, motto and all room/department/annex labels (text);
  desk notebook/pens; square counter goods; district paifang gates (paifang + plaque text);
  closed signs (text 暂停营业); hoarding notice 工地; welcome sign text; garden shore stones,
  island rim/balustrade (railing), lotus/koi at their drawn height; word hall terrace, balustrade
  (railing), stair cheeks (stone), windows, beam, side halls; metro stair treads (stairs); city
  tower signs and all city texts, crossing, department door, lamp heads, planter trees; waiters
  (waiter), stall keepers (vendor), ambient friends (person); loose items by kind.

### 3. Content (main session, before the passes)
- `src/content/objects.json` new keys (Chinese authored here, HSK only from
  `public/hsk/words.json`, clip `obj-<key>` each): sink, tap, pot, rangehood, cupboard, teapot,
  plate, bowl, pillow, quilt, cushion, till, coffee-machine, jar, calligraphy, postbox, trolley,
  mannequin, desklamp, teaset, ceiling, beam, monitor, garlic, chilli, railing, vendor, goods.
  (Existing keys reused: cup, book, notebook, pen, paper, lamp, chair, stool, milk, bread, cake,
  eggtart, donut, water, stone, rock, lotus, fish, flower, basket, window, roof, awning, pillar,
  stairs, lantern, lantern-string, skewer, hawthorn, waiter, person, stove, oven, crossing.)
- `src/content/signs.json`: every drawn text (≈60: building boards, welcome signs, district and
  park plaques, 暂停营业, 工地, 学海无涯, 词语馆, 厨房, 莲心亭, stall names, 21 room names,
  学而时习之, annex and department labels, 生词本, city tower/street texts, 营业中 OPEN) with pinyin
  and English; clips `sign-<id>`.

## Execution (parallel agents, file ownership)
1. Main session: content above + voice clips (`.venv/Scripts/python.exe scripts/generate-voice.py
   --only …`).
2. In parallel (tagging is a plain property, so no dependency on the engine):
   - **E, engine** (opus): `registry.js`, town.js look hooks (`registerTown` end, `registerRooms`,
     `ensureCity`, `addProp`/`removeProp`, `lateUpdate`, `setUnlocked`, `revealSite`), `label()`
     `signText` only, `shell.js`, `main.js` collect, `generate-voice.py`, `check-content.js`,
     tests.
   - **T1, models.js tagging** (opus): all builders in `models.js` except `label()`.
   - **T2, scene tagging** (sonnet): `interior.js`, `garden.js`/`src/core/garden.js`,
     `wordhall.js`, `stalls.js`, `city.js`, town.js `build()`/`buildGates`/`buildClosedSigns`/
     hoarding lines only.
3. Opus review per task + my own check (headless screenshots of the kitchen, a café table, a
   sign), then the coverage test must pass.

## Verification
- Unit: `registry` look rules (eye-inside ignored; small box inside big box wins; nearest wins
  otherwise); `signs.json`/`objects.json` content checks; sign collect adds to word bank only.
- Browser `tests/browser/names.spec.js` (new): **coverage** — walk town, every room and the city;
  every visible mesh must be covered by a named box (legacy or look) unless allowlisted (terrain,
  paving, sky, hills, skyline, steam); every `signText` has a `signs.json` entry; every name id
  used exists in `objects.json`. Spot checks: kitchen sink reads 水池-key name, a café cup reads
  杯子, the welcome board reads 欢迎来到青禾 and F adds it to 生词本 without changing
  `discovered`, a waiter reads 服务员.
- Update `tests/browser/city.spec.js:57-61` (expects 招牌 on the welcome board → exact text).
- Existing look tests stay green: first-view chimney/sign, garden 亭子, wordhall plaque,
  courtyard look-up null, city fountain; `hardware-cleanup` (look boxes are not solid).
- `npm run verify` + full browser suite `--workers=2`; hand back at http://127.0.0.1:5174 with the
  Browser pane closed.
