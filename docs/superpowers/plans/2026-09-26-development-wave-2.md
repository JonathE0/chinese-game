# Development wave 2 (2026-09-26)

Worktree `C:\Users\jonat\Documents\ChatGPT\Game-development`, branch `development`, served for the
player on port 5180. Wave 1 (`2026-09-25-development-wave.md`) is still uncommitted; it is frozen as
the snapshot ref `refs/snapshots/dev-wave-1`, so this wave's changes can be told apart:
`git diff refs/snapshots/dev-wave-1 -- <file>` for files tracked in HEAD, and
`git show refs/snapshots/dev-wave-1:<path> | diff - <path>` for files that were new in wave 1.

## What the player asked for

Room furnishings from the first passes are off (a backwards wardrobe, a plant in front of a door, a
leftover chair from the study desk); signs are hidden behind other things; "weird glitchy lines
whenever I walk"; the kitchen's door should be on the side where it joins the house, and from outside
its window should look like a room with depth, not a flat picture of a pan; the first-iteration
designs (the hedges, for one) need another look; the bank is in an odd spot and looks like a hut: make
it a really nice building; the word hall's big table is generic: make it grand and traditional. A
larger landscape with a mountain you can climb to see the city lights, with a softly lit path. Many
people walking in the city. Redo the metropolis after a night walk in Shenzhen Talent Park (a bay
park with a lit promenade, an LED skyline across the water and a drone light show over it): lots of
LEDs at night with Chinese characters lit on the buildings. Water everywhere should flow and react,
without lagging a browser. A Chongqing-style hotpot place overlooking the city: sit down, browse a big
menu (meats, vegetables, everything a hotpot restaurant has), order, and a noodle dancer. Drone shows
at set times over the water, and reflections on the water for realism.

## Rules for every task

- **Files.** Each task owns the files listed under it. Shared files (`town.js`, `main.js`,
  `models.js`, `world.json`, `rooms.json`, `objects.json`, `signs.json`, `catalog.json`,
  `scripts/generate-voice.py`, `scripts/check-content.js`, `style.css`): re-read right before every
  edit, small anchored edits only, never reformat or rewrite a whole file, never revert what another
  task did. Add your own keys/rows; don't touch other tasks' entries.
- **Reflections:** call `reflect(entity)` from `src/world/bay.js` on anything that should show in the
  bay (C-city: skyline, LED façades, big buildings; L-drones: the drones). H-water implements it.
- **City parts are pre-wired.** `town.ensureCity()` calls `buildBay`, `buildHill`, `buildHotpot`,
  `buildDrones` and `buildCrowd` (stubs in `src/world/bay.js`, `hill.js`, `hotpot.js`, `drones.js`,
  `crowd.js`) with `(town, root)`, before the city's look boxes are registered and its statics
  batched. Each may return `{update(dt, paused), targets()}`: `update` runs every frame in the city,
  `targets()` joins the city's E targets. `main.js` sends ids `hotpot:…` to `openHotpot(ctx, rest)`
  (`src/ui/hotpot.js`) and `crowd:…` to `openCrowd(ctx, rest)` (`src/ui/crowd.js`). Anything that
  moves sets `noBatch`. Collision: `town.mark('city', CITY_OFFSET + x, z, hw, hd, y0, y1, name, solid)`.
- **Content** stays in JSON. Chinese only from this plan's tables; a word or line you need that
  isn't here goes in your report, not in the game. `hsk` only from an exact entry in
  `public/hsk/words.json` (query with `node -e`), otherwise `null`. Every authored line and name needs
  a clip id registered in `generate-voice.py` and counted in `check-content.js`, but **don't run the
  voice generator**: list the new clip ids in your report.
- **Checks.** `node --test tests/*.test.js`, `node scripts/check-content.js`, and Playwright only as
  `PW_PORT=5185 npx playwright test <files> --workers=1` (a test server already runs on 5185; hot
  reload is off, so other tasks' edits no longer reload your pages). Never use ports 5174 or 5180,
  never touch `C:\Users\jonat\Documents\ChatGPT\Game`, no `npm run build`/`verify`, no git writes.
  Screenshots in your scratchpad only.
- **Performance.** Outdoors ≤ 900 draw calls anywhere (reflection and drones included), measured
  like `tests/browser/performance.spec.js`; nothing allocates per frame in a hot path; animated
  things update uniforms or a few transforms, not geometry. Say what you measured before and after.
- **Checkpoint** in `.claude/checkpoints/<task id>.md` (worktree) as you go. Report in caveman style.

## 云海 master layout (city-local metres; x east, z south, metro at the south end)

| zone | owner | where |
| --- | --- | --- |
| Downtown (keep every function: metro spawn 0,24.5 and exit 0,28.6, 星光五金百货 door −10.5,0, 海风面馆 10.5,1, kiosk, taxis, 一号书店 for 问路, the three people and their lines, crossing, lights) | C-city | x −28…28, z −34…34 |
| Promenade: the curving waterfront walk with a lit path in the floor, railing at the water's edge (z −48), trees, benches, lamps, a small plaza at 0,−41 and the drone-show board | C-city | x −40…70, z −48…−34, ground y 0 |
| The bay (water y −0.6, below the promenade) | H-water | x −160…170, z −170…−48 |
| The skyline across the bay (backdrop, not walkable), LED façades, signature tower 云海中心 about 20,−200, ~150 m | C-city | x −150…170, z −230…−175 |
| The hill, rising to the west, its lit stone stairway from the promenade's west end (about −40,−40) and from downtown's west side (about −28,5) | K-hill | x −120…−40, z −48…34 |
| Terrace T for the hotpot, flat, floor y 14, open to the north over the bay | J-hotpot builds on it; K-hill leaves it flat, walkable and reached by the stairway at its east side | x −84…−60, z −46…−30 |
| Summit viewpoint 观景台, railing, over the bay and skyline | K-hill | about −100,−25, y ≈ 26 |
| Drone show airspace | L-drones | x −60…90, z −130…−80, y 25…75 |
| Walkers | P-crowd | flat ground (downtown sidewalks, the promenade); not the stairs |

The city sits at `CITY_OFFSET` −4000, far from the town and every room, so it may grow and may see
further: C-city raises the camera's far clip while you are in the city (restored on leaving) and adds
haze so the far edge never shows.

---

## R-rooms — every interior sound and tidy; the kitchen door; a grand desk (task-implementer, opus, effort high)

- Audit every room (headless shots at 960×540 from the door and from the middle, written into the
  checkpoint): furniture facing the wrong way (the wardrobe with its back to the room), anything in
  front of a door, exit or annex doorway (the plant), leftovers (the study desk's chair with no desk),
  signs and boards hidden behind shelves or furniture (a room sign behind a bookshelf), things
  clipping into walls or each other. Fix through `rooms.json` and `interior.js`; fix furniture models'
  facing in `models.js` where the model itself is backwards.
- The home's kitchen: its door to the rest of the house goes in the side wall where the kitchen joins
  the house, not the front; arriving and leaving put you on the right side of it.
- The word hall's big table becomes a grand traditional 书案: a long dark rosewood desk with upturned
  ends (翘头案) and carved legs and apron, a brush pot with brushes, an inkstone, rice paper with
  writing, paperweights, flanked by a pair of standing palace lanterns. Keep whatever the table does
  today (its action and label).
- Tests: a unit or browser check that no fitting stands within 1.2 m in front of any door/exit/annex,
  that wardrobes/cabinets/shelves face into the room, that every room sign is visible from its room's
  middle (a ray to it isn't blocked by a fitting), and a browser check for the kitchen door.
- Words (objects.json, add the missing ones): 书案 shū'àn writing desk (`writing-desk`) · 笔筒 bǐtǒng
  brush pot (`brush-pot`) · 毛笔 máobǐ writing brush (`brush`) · 砚台 yàntai inkstone (`inkstone`) ·
  镇纸 zhènzhǐ paperweight (`paperweight`) · 宣纸 xuānzhǐ rice paper (`rice-paper`).
- **Owns:** `rooms.json` (all rooms except the bank room's `door` line, which is X-exterior's),
  `interior.js`, fitting and furniture models in `models.js`, those objects.json keys, tests.

## G-glitch — the weird lines when walking (task-implementer-max, effort max)

- Find out what the lines are before changing anything: walk the town, several rooms and the city
  headlessly (1280×720 and 960×540), capture frame pairs while moving and turning, and name the
  causes with evidence (shadow acne or cascade shimmer, z-fighting of coplanar faces such as signs,
  rugs, floors, trims and wall pieces, texture aliasing of the new floor patterns or signs, seams,
  depth precision). Write the evidence into the checkpoint.
- Fix at the root: light and shadow settings (bias, normal offset, cascades, resolution, distance),
  camera near/far, antialiasing, texture filtering, and small offsets/polygon offset for coplanar
  pieces in whichever builder makes them (tiny anchored edits; list each in the checkpoint so owners
  can see them). No visible regressions in shadows or look.
- Tests: a regression check for what you fixed (e.g. no two solid coplanar faces within 1 mm in the
  builders you touched, shadow settings asserted), plus before/after frame pairs in the report.
- **Owns:** renderer, light, shadow and camera setup (`town.js`, `interior.js`, `city.js` light
  setup lines only), material filtering, tiny offset edits anywhere (listed).

## X-exterior — first-iteration designs, a real bank, the kitchen window (task-implementer, opus, effort high)

- Audit every exterior model in the town and garden with headless shots and pick out the
  first-iteration ones that look crude (the hedges above all; also fences, walls, gates, stalls,
  awnings, early buildings — D6 already redid trees, benches, bins, lamps, planters and crates).
  Rebuild them to match the town's newer style, low-poly and batched.
- The bank: move it to a prominent, sensible spot (a main street front, not tucked away), and make it
  a handsome building instead of a hut — e.g. a Republic-era stone bank with columns, steps, a clock
  and 青禾银行 in gold. Keep its room door, quests, buy guide routes and `rooms.json` bank door line in
  step (that one line is yours), and keep every lane and door walkable.
- The home's kitchen window from outside: instead of the flat picture of a pan, a shallow lit room
  behind the glass (counter, hanging pans, shelf, warm light) that reads as depth as you walk past.
- Signs in the town hidden behind other things: move whichever is in the way.
- Tests: the existing footprint, layout, west-quarter and name tests stay green; add one for the
  bank's door and approach.
- **Owns:** building, hedge, fence, wall, gate and stall builders in `models.js` (plus `garden.js`
  hedges), `world.json` buildings, hedges and props, the town scene-building lines in `town.js`, the
  bank room's `door` line in `rooms.json`.

## H-water — flowing, reacting water everywhere; reflections on the bay (task-implementer-max, effort max)

- One shared water module (`src/world/water.js`): a flowing surface (scrolling normal/ripple
  textures generated once on a canvas, colour by depth/angle, sparkle), each water body with its own
  flow direction and speed, one shared update per frame, no per-frame allocations.
- Reacting: ripple rings where something touches the water (a thrown toy landing in it, the player at
  the edge, fish jumping in the lotus pond), pooled and cheap.
- Use it for all the water: the riverside quarter's canal/river, the lotus pond, the fountain pool
  (D6's water may keep its jets and sheets), and the city's bay (`src/world/bay.js`, called from the
  city build; zone in the master layout).
- Reflections on the bay: a planar reflection (a mirrored camera with an oblique clip plane at the
  water, like `src/world/views.js`), rendering only the skyline, LED façades, drones and big buildings
  (a layer, not everything), at half or quarter size, only while the bay is on screen, rippled by the
  water normals. A 水面倒影 setting (on by default on desktop, off on touch) turns it off.
- Tests: frame budget with and without the reflection on the promenade and the hill terrace at
  night; the ripple pool never grows; water looks the same after leaving and re-entering a place.
- Words: setting label 水面倒影 shuǐmiàn dàoyǐng · Reflections on water.
- **Owns:** `src/world/water.js`, `src/world/bay.js`, the water parts of `garden.js`, `fountain.js`
  and the town's canal/river builder, the settings line.

## C-city — 云海 redone after Shenzhen Bay at night (task-implementer-max, effort max)

- Rebuild the metropolis to the master layout: the downtown block livelier and modern (glass towers
  with LED façades that light at night — running light bands, colour washes, big lit Chinese
  characters from the table below), the curving promenade with a softly lit path set in the paving,
  railings, trees, benches and the drone-show board, and a dense skyline across the bay with a
  signature tower. Many LEDs at night, calm by day. Use the daylight system's lamps so they switch
  with the hour.
- Keep every function and quest of today's city working (see the downtown row), and nothing in the
  walkways (the earlier complaint: lamps and poles in the middle of the path).
- Signs in the city not hidden behind anything.
- Far clip raised in the city (with haze), restored on leaving; ≤ 900 draw calls everywhere.
- Tests: the existing city, taxi, metro and names specs stay green; a night check that the LED
  characters are lit and named; walkways clear.
- LED texts and signs (`signs.json`, clip `sign-<id>`):

| zh | pinyin | en |
| --- | --- | --- |
| 我爱云海 | wǒ ài Yúnhǎi | I love Yunhai |
| 欢迎来到云海 | huānyíng láidào Yúnhǎi | Welcome to Yunhai |
| 云海中心 | Yúnhǎi Zhōngxīn | Yunhai Centre |
| 好好学习 | hǎohǎo xuéxí | Study hard |
| 天天向上 | tiāntiān xiàngshàng | Make progress every day |
| 万家灯火 | wàn jiā dēnghuǒ | Lights in ten thousand homes |
| 一路平安 | yílù píng'ān | Have a safe journey |
| 你好 | nǐ hǎo | Hello |
| 晚安 | wǎn'ān | Good night |
| 学中文 | xué Zhōngwén | Learn Chinese |
| 城市之光 | chéngshì zhī guāng | Light of the city |
| 海风大厦 | Hǎifēng Dàshà | Sea Breeze Tower |
| 云海湾 | Yúnhǎi Wān | Yunhai Bay |
| 滨海步道 | bīnhǎi bùdào | Seaside promenade |
| 无人机表演 | wúrénjī biǎoyǎn | Drone show |

  The drone-show board reads 无人机表演 with the times 20:00 · 23:00 in numerals. Object added in review: 马路 mǎlù road (`road`, hsk 1). The gate couplet reads left to right from the avenue: 好好学习 left, 天天向上 right.
- **Owns:** `src/world/city.js`, `src/content/city.json`, a new `src/world/leds.js` if useful, the
  far-clip hook in `town.js`, city tests.

## K-hill — the 山城 hill with a lit stairway and a viewpoint (task-implementer, opus, effort high)

- In `src/world/hill.js` (and `src/content/hill.json`): a hill west of downtown, built Chongqing
  style from stepped terraces and retaining walls with trees, a winding stone stairway (steps low
  enough to walk up with W, like the house's stairs) from the promenade's west end and from
  downtown's west side, softly lit at night by lights set into the step edges and low path lamps,
  rest spots with benches, the flat terrace T for the hotpot (master layout; you build the stairway to
  its east side and leave it clear), and the summit 观景台 with a railing looking over the bay and the
  skyline. Walkable heights through marks; nobody falls through or gets stuck.
- Signs: 山城步道 Shānchéng bùdào · Mountain City Trail; 观景台 guānjǐngtái · Viewing platform;
  小心台阶 xiǎoxīn táijiē · Mind the steps. Objects: 台阶 táijiē steps (`steps`), 山 shān mountain
  (`mountain`) if missing.
- Tests: walk from the promenade to the summit and back with W alone; the terrace is reachable; the
  path lights are on at night and off by day; draw calls.
- **Owns:** `src/world/hill.js`, `src/content/hill.json`, its signs/objects entries, tests.

## J-hotpot — 山城老火锅 on the hill terrace (task-implementer, opus, effort high)

- In `src/world/hotpot.js`, `src/ui/hotpot.js`, `src/content/hotpot.json`: an open-air Chongqing
  hotpot terrace on T (master layout), overlooking the bay: tables with a pot set into each, stools,
  string lights and lanterns, a small kitchen/cashier building at the back, a 蘸料台 sauce station,
  the noodle chef's spot, a railing along the north edge. At night it glows; the city lights are the
  view.
- Sit at a table (the game's sitting), and the waiter comes: greeting, broth, spice level, then the
  menu by category (tabs), add items with + / −, a running total, 下单 to order, 买单 to pay (coins;
  not enough money says so and nothing is lost). Ordered food appears around the pot and goes in; the
  broth bubbles (cheap animation). Eating fills you up like other food. Ordering 扯面 calls the noodle
  chef, who performs the noodle dance (a long ribbon of dough swung in loops, a short choreographed
  animation) at your table and serves it.
- Menu items are catalog rows (`catalog.json`, shop `hotpot`, clip `shop-<id>`), with the measure
  word shown on the order (一份, 一碗 …). Prices are in coins.
- Tests: unit for ordering and paying (totals, not enough money, items once), browser: sit, order a
  broth and three dishes including 扯面, see the noodle show start, pay.
- Signs and objects: 山城老火锅 Shānchéng Lǎo Huǒguō · Mountain City Old Hotpot (sign); 蘸料台
  zhànliàotái · Sauce station (sign); 火锅 huǒguō hotpot (`hotpot`); 扯面师傅 chěmiàn shīfu
  noodle-pulling chef (`noodle-chef`); 扯面表演 chěmiàn biǎoyǎn noodle-pulling show (look name
  while it plays).
- UI labels: 锅底 guōdǐ Broth · 辣度 làdù Spice level · 荤菜 hūncài Meat · 素菜 sùcài Vegetables ·
  豆制品和菌菇 dòuzhìpǐn hé jūngū Tofu & mushrooms · 主食 zhǔshí Staples · 蘸料 zhànliào Dips ·
  饮品和甜品 yǐnpǐn hé tiánpǐn Drinks & desserts · 点菜 diǎn cài Order · 下单 xià dān Place the order ·
  买单 mǎi dān Pay the bill · 已点 yǐ diǎn Ordered · 合计 héjì Total. Spice: 不辣 bú là Not spicy ·
  微辣 wēi là Mild · 中辣 zhōng là Medium · 特辣 tè là Extra hot. Player replies: 一位。 Yí wèi. (Just
  one.) · 服务员，买单！ Fúwùyuán, mǎi dān! (Waiter, the bill please!)
- Waiter lines (one cast voice; clip `hotpot-<key>`):

| key | zh | pinyin | en |
| --- | --- | --- | --- |
| greet | 欢迎光临！几位？ | Huānyíng guānglín! Jǐ wèi? | Welcome! How many of you? |
| seat | 这边请，这是菜单。 | Zhèbiān qǐng, zhè shì càidān. | This way, please. Here's the menu. |
| broth | 要什么锅底？ | Yào shénme guōdǐ? | Which broth would you like? |
| spice | 要什么辣度？ | Yào shénme làdù? | How spicy would you like it? |
| more | 还要别的吗？ | Hái yào bié de ma? | Anything else? |
| served | 菜来了，请慢用！ | Cài lái le, qǐng màn yòng! | Here's your food. Enjoy! |
| dips | 蘸料台在那边，可以自己调。 | Zhànliàotái zài nàbiān, kěyǐ zìjǐ tiáo. | The sauce station's over there; you can mix your own. |
| bill | 好的，这是您的账单。 | Hǎo de, zhè shì nín de zhàngdān. | Sure, here's your bill. |
| short | 钱好像不够，要不要少点一些？ | Qián hǎoxiàng bú gòu, yào bu yào shǎo diǎn yìxiē? | It looks like that's not enough money. Would you like to order a bit less? |
| bye | 慢走，欢迎下次再来！ | Màn zǒu, huānyíng xià cì zài lái! | Take care, and come again! |

- Noodle chef (a different cast voice; clip `hotpot-chef-<key>`): start 扯面来喽！ Chěmiàn lái lou!
  (Here come the pulled noodles!) · done 面好了，请慢用！ Miàn hǎo le, qǐng màn yòng! (Your noodles
  are ready. Enjoy!)
- The menu (`id` · zh · pinyin · en · measure · coins; descriptions only where given):

| category | items |
| --- | --- |
| 锅底 (个) | `broth-beef-tallow` 牛油锅底 niúyóu guōdǐ spicy beef-tallow broth 28 · `broth-clear` 清汤锅底 qīngtāng guōdǐ clear broth 20 · `broth-yuanyang` 鸳鸯锅底 yuānyang guōdǐ half-and-half broth 32 (一半辣，一半不辣。 Half spicy, half not.) · `broth-tomato` 番茄锅底 fānqié guōdǐ tomato broth 24 · `broth-mushroom` 菌汤锅底 jūntāng guōdǐ mushroom broth 26 |
| 荤菜 (份) | `feiniu` 肥牛 féiniú fatty beef slices 18 · `nen-niurou` 嫩牛肉 nèn niúròu tender beef 20 · `yangroujuan` 羊肉卷 yángròujuǎn lamb rolls 18 · `maodu` 毛肚 máodǔ beef tripe 22 (七上八下，十五秒就好。 Dip it up and down seven or eight times: fifteen seconds and it's done.) · `yachang` 鸭肠 yācháng duck intestines 16 (涮几秒就能吃。 A few seconds in the pot and it's ready.) · `huanghou` 黄喉 huánghóu beef aorta 18 · `echang` 鹅肠 écháng goose intestines 20 · `wucanrou` 午餐肉 wǔcānròu luncheon meat 12 · `xiahua` 虾滑 xiāhuá shrimp paste 22 · `niurouwan` 牛肉丸 niúròuwán beef balls 14 · `yuwan` 鱼丸 yúwán fish balls 12 · `yaxue` 鸭血 yāxuè duck blood 10 · `surou` 酥肉 sūròu crispy fried pork 16 |
| 素菜 (份) | `tudoupian` 土豆片 tǔdòupiàn potato slices 5 · `oupian` 藕片 ǒupiàn lotus root slices 6 · `donggua` 冬瓜 dōngguā winter melon 5 · `wosun` 莴笋 wōsǔn celtuce 6 · `shengcai` 生菜 shēngcài lettuce 5 · `wawacai` 娃娃菜 wáwacài baby cabbage 6 · `douya` 豆芽 dòuyá bean sprouts 4 · `tonghao` 茼蒿 tónghāo crown daisy greens 6 · `haidai` 海带 hǎidài kelp 5 · `yumi` 玉米 yùmǐ corn 6 |
| 豆制品和菌菇 (份) | `doufu` 豆腐 dòufu tofu 5 · `dongdoufu` 冻豆腐 dòngdòufu frozen tofu 6 · `fuzhu` 腐竹 fǔzhú dried tofu sticks 7 · `doupi` 豆皮 dòupí tofu skin 6 · `jinzhengu` 金针菇 jīnzhēngū enoki mushrooms 7 · `xianggu` 香菇 xiānggū shiitake mushrooms 8 · `pinggu` 平菇 pínggū oyster mushrooms 7 |
| 主食 | `hongshufen` 红薯粉 hóngshǔfěn sweet potato noodles (份) 6 · `kuanfen` 宽粉 kuānfěn wide glass noodles (份) 6 · `chemian` 扯面 chěmiàn hand-pulled noodles (份) 8 (师傅现场给你表演扯面。 The chef pulls the noodles right in front of you.) · `niangao` 年糕 niángāo rice cakes (份) 6 · `mifan` 米饭 mǐfàn rice (碗) 2 |
| 蘸料 (碟) | `xiangyoudie` 香油碟 xiāngyóudié sesame oil dip 3 (重庆人吃火锅最爱的蘸料。 Chongqing's favourite dip for hotpot.) · `majiang` 麻酱 májiàng sesame paste 3 · `suanni` 蒜泥 suànní minced garlic 1 · `xiangcai` 香菜 xiāngcài coriander 1 · `conghua` 葱花 cōnghuā chopped spring onion 1 · `xiaomila` 小米辣 xiǎomǐlà bird's eye chilli 1 |
| 饮品和甜品 | `suanmeitang` 酸梅汤 suānméitāng sour plum drink (杯) 6 · `dounai` 豆奶 dòunǎi soy milk (杯) 5 · `bingfen` 冰粉 bīngfěn ice jelly (碗) 6 (吃完辣的，来一碗冰粉。 After the spicy food, have a bowl of ice jelly.) · `hongtang-ciba` 红糖糍粑 hóngtáng cíbā brown-sugar rice cakes (份) 10 · `xigua` 西瓜 xīguā watermelon (盘) 5 |

  Catalog ids carry the prefix `hotpot-` (e.g. `hotpot-maodu`) so they never clash with existing items.
- **Owns:** `src/world/hotpot.js`, `src/ui/hotpot.js`, `src/content/hotpot.json`, the `hotpot-`
  rows of `catalog.json`, its signs/objects entries, hotpot styles in `style.css`, tests.

## L-drones — the drone show over the bay (task-implementer, opus, effort high)

- In `src/world/drones.js` (and `src/content/drones.json`): about 400 drones drawn in one or two draw
  calls (instancing), flying in over the bay at 20:00 and 23:00 each night, forming a sequence and
  flying off; each show lasts about 150 real seconds (a game day is 24 real minutes). Formations are made by rasterising the
  characters on a canvas and sampling points (text), or from simple point sets (shapes), with smooth
  eased transitions and colour changes; drones twinkle a little.
- The sequence: 你好 → 欢迎来到云海 → a boat with a pavilion on it (shape, look name 船) → 福 → a lotus
  (shape, look name from the existing lotus object) → 学中文 → 加油 → 晚安. While a text formation
  stands, looking at it names the phrase (the sign entry) and F saves it, like a sign.
- A voice announces the start and the end (clip `drones-<key>`): start 无人机表演马上开始！ Wúrénjī
  biǎoyǎn mǎshàng kāishǐ! (The drone show is about to start!) · end 今天的表演结束了，谢谢大家！
  Jīntiān de biǎoyǎn jiéshù le, xièxie dàjiā! (That's the end of today's show. Thank you, everyone!)
- New sign entries: 福 fú · Good fortune; 加油 jiāyóu · Keep going! (the others are C-city's). New
  object: 无人机 wúrénjī drone (`drone`); 船 chuán boat (`boat`) if missing.
- Admin and tests can start a show at once (an exported function or the clock).
- Tests: the schedule (unit), formations sample the right number of points, one or two draw calls,
  frame budget from the promenade during a show, looking at 你好 names it.
- **Owns:** `src/world/drones.js`, `src/content/drones.json`, its signs/objects entries, tests.

## P-crowd — people walking around 云海 (task-implementer, opus, effort high)

- In `src/world/crowd.js`, `src/ui/crowd.js`, `src/content/crowd.json`: 24–40 people walking between
  places on the city's flat ground (downtown sidewalks, crossings, the promenade), pausing, looking at
  the bay, sitting on benches. Reuse the word hall's walking code (`src/world/visitors.js`: a grid
  from the registry, BFS paths, avoidance) rather than writing a second one; generalise it if needed
  without breaking the hall. Cheap to draw (merged or batched people, far ones simplified or hidden),
  updated only in the city. The three existing people keep their spots and lines.
- Looking at one names 行人 xíngrén (pedestrian, `pedestrian`); E says one of their lines (voices from
  the existing cast; clip `crowd-<n>`):

| n | zh | pinyin | en |
| --- | --- | --- | --- |
| 1 | 今天天气真好！ | Jīntiān tiānqì zhēn hǎo! | Lovely weather today! |
| 2 | 晚上一起去看无人机表演吧！ | Wǎnshang yìqǐ qù kàn wúrénjī biǎoyǎn ba! | Let's go and watch the drone show tonight! |
| 3 | 我去山上吃火锅。 | Wǒ qù shān shàng chī huǒguō. | I'm going up the hill for hotpot. |
| 4 | 地铁站在那边。 | Dìtiězhàn zài nàbiān. | The metro station's over there. |
| 5 | 云海的夜景真漂亮。 | Yúnhǎi de yèjǐng zhēn piàoliang. | Yunhai looks beautiful at night. |
| 6 | 不好意思，借过一下。 | Bù hǎoyìsi, jièguò yíxià. | Excuse me, coming through. |
| 7 | 我要去上班了。 | Wǒ yào qù shàngbān le. | I'm off to work. |
| 8 | 你也是来旅游的吗？ | Nǐ yě shì lái lǚyóu de ma? | Are you here on holiday too? |

- Tests: people move and never walk through things or each other; limits and draw calls; talking.
- **Owns:** `src/world/crowd.js`, `src/ui/crowd.js`, `src/content/crowd.json`, changes to
  `src/world/visitors.js` (keep `hall-life.spec.js` green), its objects entry, tests.
