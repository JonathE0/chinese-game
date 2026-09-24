# A visible home, Lotus Pond Park and daytime snack stalls (2026-09-21)

Requested by the player: make the house obvious when the game starts, with a clear kitchen extension
(and other rooms) seen from outside; add a park with paths, bridges and water like Nan Lian Garden in
Hong Kong, open from the start area with no level gate; and daily food stalls in the start area
selling traditional food such as wontons and noodles.

Three tasks run in parallel in the same working tree. Each owns the files listed in its section and
must not edit the others'. Where a file is shared (`src/world/town.js`, `src/content/world.json`)
each task edits only the parts named for it; re-read before editing and retry if an edit fails
because the file changed. Do not rewrite whole files. Do not commit. A build that fails on a locked
`dist/` file is another task building — run it again. The Vite dev server is already running on
port 5174 and Playwright reuses it. Write a failing test before a rule. Chinese text is authored:
use the strings given here exactly and write no new Chinese — use English only for anything missing
and say so in the report. Every nameable thing uses an object key from `src/content/objects.json`
(new ones already added and voiced: `kitchen` 厨房, `chimney` 烟囱, `balcony` 阳台, `study` 书房,
`pavilion` 亭子, `watermill` 水车, `stream` 小河, `waterfall` 瀑布, `pine` 松树, `moongate` 月亮门; existing:
`bridge`, `lotus`, `pond`, `water`, `rock`, `stone`, `wall`, `lantern`, `fish`, `bench`, `path`,
`tree`, `window`, `door`, `roof`, `cart`, `stove` …).

## Already wired in the main session — use it, don't rebuild it

- `world.json` `spawn` is now read as `[x, z, yaw, pitch]` (yaw and pitch optional) by `town.js`.
- Buildings may carry `wings: [{id, x, z, width, depth, height, color?, roof?, object}]` with `x,z`
  in the building's own coordinates (before its rotation; only 0 and 180 are used). `town.js`
  registers a solid box per wing named by `object`, and `shell.js` draws wings on the minimap.
  Every box of one building carries `group: <building id>`; the footprint test in
  `tests/browser/hardware-cleanup.spec.js` ignores overlaps within a group.
- District `garden` (莲池公园 · Lotus Pond Park) is in `world.json`: bounds x −19..19, z 19..51,
  `surface: "grass"`, gate at (0, 19) on axis z with `span: 2`, `style: "moon"` and **no
  `requires`** (always open).
- `src/world/garden.js` exports `buildGarden(models, parent, lamps)` returning `{marks}` (a stub);
  `town.js` calls it after the buildings and registers each mark: `{x,z,hw,hd}` or `{x,z,radius}`,
  `y0`, `y1`, `name` (object key), `solid` (default true), optional `group`.
- `src/ui/garden-map.js` exports `gardenMapParts()` (a stub); `shell.js` draws its SVG strings
  under the buildings when the minimap shows the garden.
- `src/content/tutorial.json`: the `home` step now says the door faces the fountain (its `where`
  is a placeholder at (11, 9.6)), and a new `park` step mentions the park and the snack stalls.
- `scripts/check-content.js` accepts a gate with no `requires` (always open), gate `style`
  `paifang` (default) or `moon`, and district `surface` `paving` (default) or `grass`; the
  content map lists such a gate as open.

---

## Task H — the home compound and the first view (model: opus)

**Owns:** `src/world/models.js` (building rendering), `src/content/world.json` (`buildings`,
`spawn`, and `props` / `people` / `trees` / `ground` in the square), `src/content/rooms.json`,
`src/content/sites.json`, `src/content/quests.json`, the `where` numbers of the `home` step in
`tutorial.json`, `tests/browser/home-access.spec.js` (rewrite), `tests/browser/places.spec.js`
and any other spec that warps to the old home or teahouse spots, and a new first-view spec.

- **Move the home** to the south side of the square, facing north to the fountain (rotation 180),
  as a larger compound. Main house centred near (11, 14), about 7 wide and 6 deep, two storeys
  (about 6.2 high): ground-floor door and the 我的家 sign on the front, a first-floor balcony
  across the front (named `balcony`) and upper windows. Door at the front centre, computed the way
  other rotated buildings do it; `rooms.home.door` and `rooms.kitchen.door` move with it.
- **Wings** (exterior only; the interior stays one room plus the kitchen annex):
  - `kitchen` on the exterior **west** side, because inside, the kitchen door is on your right as
    you walk in and the house now faces north: roughly x 4.5..7.5, z 12..17, one storey (about
    3.4). Make it read as a kitchen at a glance: a chimney (named `chimney`), a window showing a
    stove and a pot, a plaque reading 厨房 over a side door, strings of garlic or chillies, and a
    warm window light after dark (a lamp material handed to the daylight system). A few slow
    steam puffs from the chimney are welcome if cheap.
  - `study` on the exterior **east** side: roughly x 14.5..17.5, z 12..17, one storey, a window
    with a bookshelf behind it.
- **Front yard:** paving to the door, two red lanterns by it, potted plants; keep the approach open.
- **Move the teahouse build site into the park:** `sites.json` teahouse → (12.5, 46.5) rotation
  180 (door facing the pond); the `teahouse` building in `world.json` → same spot, district
  `garden`, style `tiled`; `rooms.teahouse.door` → its front (about (12.5, 43.7)); the
  `teahouse-build` mission `where` → there. Task G keeps that lot clear.
- **Clear the square's south half** for the compound and the sightline: move or remove what is in
  the way — bollard (3.4, 16.5), streetlight (12.6, 16.8), planter (6.5, 7), crates (4, 9.1) and
  (8.1, 9.1), townsperson (5.5, 9.25), bicycle (14, 7.2). Keep the night-market pitch (5.8, 5.4)
  and its path from (8.8, 5.4) clear; it is used after 18:00.
- **First view:** set `spawn` to `[x, z, yaw, pitch]` in the square's south half, north-west of
  the house (around (2, 4.5)), so the first frame shows the whole front of the house — door, sign,
  balcony, roofline — and the kitchen wing with its chimney, unobstructed. For a target offset
  `(dx, dz)`, `yaw = atan2(-dx, -dz)` in degrees. The spawn must be walkable and clear of the
  fountain rim (radius 2.12 around (0, 1.8)).
- Update everything that pointed at the old home (16.1, 12) / door (16.1, 15.6) or the old
  teahouse site (7, 13) / door (7, 10.2): the `home` tutorial step's `where` (stand just in front
  of the new door), the `furnish` mission `where`, specs. `grep` src and tests.
- **Tests:** rewrite `home-access.spec.js` for the new layout (walking distance from the spawn to
  the door, and the door target reachable); a first-view spec: on a fresh start the door and the
  sign project inside the viewport and a `registry.look` ray from the camera towards the sign hits
  the home before anything else; the footprint test passes.
- **Verify:** `npm run verify`; the specs above plus `places`, `tutorial`, `city`,
  `hardware-cleanup`, `buyguide`. Take one screenshot of the first frame (scale ≤ 0.5), save it
  under `test-results/`, and describe what it shows.

---

## Task G — 莲池公园, Lotus Pond Park (model: opus)

**Owns:** `src/content/garden.json` (new), `src/world/garden.js`, `src/ui/garden-map.js`, in
`town.js` only `buildGates`, the district paving loop in `build()`, and the two lines that place
the southern hills; `tests/browser/garden.spec.js` (new) and unit tests for any pure logic. It does
not edit `models.js` — build park geometry in `garden.js` from the primitives `models.js` already
exports (`box`, `cylinder`, `ball`, `shape`, `tree`, `lantern`, `label`, …).

- **Gate:** for a district with no `requires`, build no door leaves and no door hitbox — it is
  open from the first frame, even if the word list never loads. `style: "moon"`: a white plaster
  wall with grey tile coping along the boundary (the same extent as `half`), about 3 high, with a
  round opening about 4 across centred on the gate; a plaque reading 莲池公园 above it. Name the
  arch `moongate` and the wall `wall`. The welcome gateway's posts stand at (±2.2, 17) just north
  of it: frame them, don't collide.
- **Ground:** a `surface: "grass"` district gets grass, not the square's paving; paths are laid
  on it. Move the southern hills (now centred on z = 34) south beyond z ≈ 62.
- **Layout** — low-poly, after Nan Lian Garden:
  - An entrance court inside the gate (z 19..24), paved, a rockery (`rock`) and a sculpted pine
    (`pine`) each side.
  - A lotus pond (`pond` / `water`), irregular (a union of rectangles and discs), roughly x −12..12,
    z 26..42, with lotus pads and flowers (`lotus`) and a few koi (`fish`).
  - A golden octagonal pavilion (`pavilion`, plaque 莲心亭) on an island near (0, 34), about 3 in
    radius, reached by two vermilion arched bridges (`bridge`) on the x = 0 line, one from the north
    bank and one from the south bank.
  - A stream (`stream`) from a rock waterfall (`waterfall`) in the south-west corner (about
    (−15, 47)) into the pond's west side, with a timber water wheel (`watermill`) turning slowly
    beside a small mill house near (−15, 38), and a small flat bridge where the path crosses it.
  - A paved loop path (about 2.4 wide) round the pond joining the entrance, both bridges and the
    mill; timber benches (`bench`); lanterns (`lantern`) lit after dark (their materials go into
    `lamps`); pines and a few flowering trees.
  - White perimeter walls with grey coping along x = ±19 and z = 51 (decorative: the bounds already
    stop you).
  - Keep the lot x 8..17, z 43.5..50.5 clear except for the path reaching its door at (12.5, 43):
    the teahouse build site moves there (Task H).
  - Nothing outside the park's bounds except the gate wall.
- **Collision** (the registry's step height is 0.42): water is solid from below ground up to about
  0.6 so it cannot be stepped into; bridges are steps rising at most 0.3 each to a crest of about
  1.0–1.2, with every step over water at or above the water's top, and solid railings on both
  sides; the island is walkable; pavilion columns, rocks, pines (discs), lanterns, benches, the mill
  house and the wheel are solid. Parts of one structure share a `group`.
- **Minimap:** `gardenMapParts()` draws water, paths, bridges, the pavilion and the pines from
  `garden.json`, in the minimap's colours (world coordinates, z down).
- **Performance:** a few hundred meshes at most; share materials; the wheel's rotation is one
  entity turned per frame.
- **Tests:** `garden.spec.js` — walk (hold W) from the square through the moon gate and the
  location card reads 莲池公园; a grid search over `canMove` from (0, 17) reaches the pond's north
  bank, the mill and the teahouse lot's path; stepping into the pond is blocked; walking the north
  bridge by script lands the player on the island (height rises then falls, and x/z reach the
  island); looking at the pavilion names it 亭子; the footprint test passes.
- **Verify:** `npm run verify`, `garden`, `hardware-cleanup`, `city`. One screenshot from the
  entrance looking across the pond (scale ≤ 0.5) saved under `test-results/`, described in the report.

---

## Task F — daytime snack stalls (model: sonnet)

**Owns:** `src/content/catalog.json` (new items), `src/ui/shop.js` (new shop entries),
`src/world/stalls.js`, in `town.js` only the market lines (the constructor's market set-up, the
market loop in `targets()`, and the market calls in `update()`), item art (`src/ui/art.js`,
`src/ui/item-drawings.js`), and `tests/browser/snacks.spec.js` (new).

- **Stalls:** a second instance of the stall system (`NightMarket` already takes a `schedule`) for
  three daytime pitches, open 6:00–18:00 (the night market keeps 18:00–2:00). Spots on the square's
  west side beside 家居小铺, carts facing east to the square: 馄饨摊 at (−11.5, 1.2), 面摊 at
  (−11.5, 4.0), 早点摊 at (−11.5, 6.8). Vendors wheel their carts in from off the west edge; pick
  waypoints that miss the buildings, the tree at (−11.7, 9.8), the bicycle at (−14.2, 9), the
  streetlights and the night carts' paths. Each cart shows its stall name on the canopy. When the
  game loads during open hours the day stalls are already standing at their spots; night-market
  behaviour must not change.
- **Shops** (`shop.js`), exact text:
  - `wonton`: title 馄饨摊, sub 馄饨 · 小笼包, greeting 刚包好的馄饨，来一碗吗？ /
    Gāng bāo hǎo de húntun, lái yì wǎn ma? / Freshly wrapped wontons. Fancy a bowl? — note:
    来一碗 is how you order a bowl of something; 碗 (wǎn) is the measure word for bowls.
  - `noodlestall`: title 面摊, sub 阳春面 · 炸酱面, greeting 想吃什么面？我们的面都是现做的。 /
    Xiǎng chī shénme miàn? Wǒmen de miàn dōu shì xiàn zuò de. / What noodles would you like? Ours
    are all made fresh. — note: 现做 (xiàn zuò) means made on the spot, right now.
  - `breakfast`: title 早点摊, sub 包子 · 豆浆 · 油条 · 煎饼, greeting 包子刚出锅，热乎着呢！来几个？ /
    Bāozi gāng chū guō, rèhu zhe ne! Lái jǐ ge? / The buns have just come out of the steamer, nice
    and hot! How many would you like? — note: 出锅 (chū guō) is taking food out of the pot or
    steamer; 来几个 asks how many you want.
- **Items** (`catalog.json`), category food, fixed price, not negotiable; follow the existing
  food items' fields and pinyin style, and calibrate `nutrition` against them (a 3-coin bun is a
  snack; a bowl of wontons is nearly a meal):

  | id | shop | zh | pinyin | en | price | description | descriptionEn |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | wonton | wonton | 馄饨 | húntun | wonton soup | 8 | 一碗热馄饨，汤里有紫菜和葱花。 | A bowl of hot wontons in broth with seaweed and chopped scallion. In Hong Kong the same dish is called 云吞 (wonton). |
  | xiaolongbao | wonton | 小笼包 | xiǎolóngbāo | soup dumplings | 10 | 一笼八个，小心，里面的汤很烫。 | Eight to a steamer basket. Careful: the soup inside is very hot. |
  | yangchun-noodles | noodlestall | 阳春面 | yángchūnmiàn | plain noodle soup | 6 | 清汤面条，放一点葱花，简单又好吃。 | Noodles in clear broth with a little scallion: simple and good. |
  | zhajiang-noodles | noodlestall | 炸酱面 | zhájiàngmiàn | noodles with bean sauce | 9 | 北京的老味道，面上有肉酱和黄瓜丝。 | An old Beijing favourite: noodles topped with meat sauce and shredded cucumber. |
  | baozi | breakfast | 包子 | bāozi | steamed bun | 3 | 热乎乎的肉包子，刚蒸好的。 | A hot pork bun, fresh from the steamer. |
  | soy-milk | breakfast | 豆浆 | dòujiāng | soy milk | 2 | 一杯热豆浆，可以加糖，也可以不加。 | A cup of hot soy milk, with or without sugar. |
  | youtiao | breakfast | 油条 | yóutiáo | fried dough stick | 2 | 又长又脆，最好配着豆浆吃。 | Long and crisp, best with soy milk. |
  | jianbing | breakfast | 煎饼 | jiānbing | jianbing crêpe | 6 | 薄薄的饼，加鸡蛋和薄脆，现做现吃。 | A thin crêpe with egg and a crispy cracker, made while you wait. |

- **Buying:** `shop:<id>` opens the shop panel with the greeting and the stall's items; a purchase
  counts toward the grocery errand the way other food does; the items can be eaten from the bag.
- **Art:** item drawings for the new foods (reuse an existing visual only where it genuinely fits).
- **Voice:** each new item needs its clip: `.venv/Scripts/python.exe scripts/generate-voice.py
  --only <the eight audio ids>` (the generator voices catalog items itself; never hand-edit
  `public/audio/manifest.json`). Report it if generation fails.
- **Tests:** `snacks.spec.js` — at 10:00 the three stalls stand at their spots; 馄饨摊's panel shows
  its greeting and 馄饨; buying one adds it to the bag and takes 8 coins; at 20:00 the day stalls are
  gone and the night stalls trade; the footprint test passes.
- **Verify:** `npm run verify`, `snacks`, `hardware-cleanup`, `city`.

---

## What shipped

All three tasks landed, each reviewed by an Opus reviewer and checked in the main session.

- **Home (H):** two-storey house at (11, 14) facing the fountain, balcony, lanterns, kitchen wing
  west (chimney with steam, lit stove window, 厨房 plaque) and study wing east; spawn
  `[0.6, 4.9, -128, 11]` frames the whole front. Teahouse site moved into the park lot at
  (12.5, 46.5). Review fixes: leaving a building now steps out by the building's facing (this also
  fixes homeware, bank, resale, cafe and lifestyle, which faced north and dropped you inside their
  walls); wing hitboxes no longer hide the chimney; about 200 small meshes merged.
- **Park (G):** 莲池公园 behind a moon gate at (0, 19), open from the first frame with no door;
  lotus pond, 莲心亭 on an island, two arched bridges, stream, waterfall, turning water wheel,
  paths, pines, lanterns; about 420 meshes. Review fix: an invisible fence taller than a jump
  round all water, so the pond cannot be jumped onto; jump tests added.
- **Snack stalls (F):** 馄饨摊, 面摊 and 早点摊 on the square's west side, 6:00–18:00, eight foods
  with art and voice clips. Review fixes: stalls are placed for the saved clock (not 15:00) on
  load; canopy sign textures are freed; signs face the square; walk-in test; the kitchen's
  eating-out comparison includes the stall foods.
- **Main session:** `warp()` levels the view (the spawn's upward pitch no longer leaks into
  teleports); `tests/browser/greeting.js` steps past the small-talk greeting that commit a06f435
  put in front of NPC conversations, which had broken game, living, metro and city-quests specs;
  teahouse site blurb rewritten for its new place; stall footer 白天出摊，天黑以前收摊。

Known: `game.spec.js` "ambient music … audible" measures 0.0028 against 0.01 since the a06f435
music rewrite (separate task offered); `living.spec.js` "a waiter walks the floor" can miss its
1.2 s movement check because waiters idle up to 2 s at random.
