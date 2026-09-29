# Development wave: shops, views out, interiors, word hall life, town fixes, trees and fountain (2026-09-25)

The player play-tests on the **admin** server (main folder, port 5174) while this wave lands on the
**development** branch in its own worktree, `C:\Users\jonat\Documents\ChatGPT\Game-development`,
served on port 5180. Six tasks run in parallel; each owns its files.

## Rules for every task

- **Work only in `C:\Users\jonat\Documents\ChatGPT\Game-development`.** Never touch
  `C:\Users\jonat\Documents\ChatGPT\Game` or ports 5174 and 5180 (the player's servers).
- **Tests:** run Playwright with `PW_PORT=5185` (a persistent e2e server for this worktree runs there;
  if it is down, Playwright starts one). Use `--workers=1`. Unit tests with `npm test`. Do not run
  `npm run build`/`verify` (the main session does); do not run the voice generator (list clip ids).
- **Do not commit.** Several agents share this worktree; the main session reviews and commits.
- **Shared files** (`src/world/models.js`, `src/world/town.js`, `src/main.js`, `src/content/objects.json`,
  `src/content/signs.json`, `scripts/generate-voice.py`, `scripts/check-content.js`, `src/style.css`):
  re-read the exact lines before each edit, keep edits small and anchored, append new builders rather
  than reorganising, never rewrite or reformat a whole file.
- **Chinese:** only the lines in your section. New object names: `hsk` only from an exact entry in
  `public/hsk/words.json`, else `null`.
- **Naming engine:** every new mesh gets a `lookName`/`signText`; `tests/browser/names.spec.js` must pass.
- **Performance:** outdoor draw calls stay under 900 (`tests/browser/performance.spec.js`); new static
  outdoor geometry must be batchable (built before `batchStatics`) and small pieces cast no shadow.
- Checkpoint at `.claude/checkpoints/<task id>.md` inside the worktree. Report in caveman style.

---

## D1-shops — a counter for every trade, and shop assistants who help (effort high)

Every shop still uses the same early counter. Give each shop a counter that fits its trade, in the
spirit of the clothes shop (which the player likes, so leave it as it is): a bakery's glass case
counter, a café's espresso bar, a bank's teller windows (already there, keep), a pharmacy's dispensary
(keep), a supermarket checkout lane, a bookshop's lending desk, a lighting shop's display counter, a
homeware shop's wrapping table, a teahouse's tea bar, the city hardware store's trade counter, the
post office (keep). Add a shop assistant (营业员, existing object key `clerk`) behind the counter of
every shop that has none (not the restaurant, which has waiters; not 旧物铺, which has 老周).

Talking to any shop assistant opens a short dialogue that helps you shop (today, talking to staff
opens the restaurant menu; fix that path for shop assistants only): their greeting, the shop's own
line, then buttons **看看商品** (browse: opens that shop's panel) and **再见** (bye). Lines go in
`src/content/assistants.json`, voiced with an existing cast voice that suits a shop assistant
(register the file in `generate-voice.py`; clip ids `assistant-<key>`).

| key | zh | pinyin | en |
| --- | --- | --- | --- |
| greet | 欢迎光临！需要帮忙吗？ | Huānyíng guānglín! Xūyào bāngmáng ma? | Welcome! Can I help you? |
| browse | 随便看看，有问题就叫我。 | Suíbiàn kànkan, yǒu wèntí jiù jiào wǒ. | Have a look around. Call me if you need anything. |
| find | 你要找什么？我带你去。 | Nǐ yào zhǎo shénme? Wǒ dài nǐ qù. | What are you looking for? I'll show you. |
| pay | 在这边付钱就可以了。 | Zài zhèbiān fù qián jiù kěyǐ le. | You can pay over here. |
| bye | 谢谢光临，欢迎再来！ | Xièxie guānglín, huānyíng zài lái! | Thanks for coming, come again! |

One line of its own per shop (key `shop-<room id>`):

| room | zh | pinyin | en |
| --- | --- | --- | --- |
| supermarket | 今天的水果很新鲜。 | Jīntiān de shuǐguǒ hěn xīnxiān. | The fruit is very fresh today. |
| cafe | 我们的咖啡是现磨的。 | Wǒmen de kāfēi shì xiàn mó de. | Our coffee is freshly ground. |
| bakery | 面包刚出炉，还是热的。 | Miànbāo gāng chūlú, hái shì rè de. | The bread is fresh out of the oven, still warm. |
| lifestyle | 买家具可以先看看尺寸。 | Mǎi jiājù kěyǐ xiān kànkan chǐcùn. | When you buy furniture, check the size first. |
| library | 新书在门口这边。 | Xīn shū zài ménkǒu zhèbiān. | The new books are over here by the door. |
| lights | 这盏灯晚上特别好看。 | Zhè zhǎn dēng wǎnshang tèbié hǎokàn. | This lamp looks especially nice at night. |
| homeware | 布置房间，从一块地毯开始吧。 | Bùzhì fángjiān, cóng yí kuài dìtǎn kāishǐ ba. | To decorate a room, start with a rug. |
| bank | 请先拿号，稍等一下。 | Qǐng xiān ná hào, shāo děng yíxià. | Please take a number first and wait a moment. |
| post-office | 寄信请在这里买邮票。 | Jì xìn qǐng zài zhèlǐ mǎi yóupiào. | To send a letter, buy stamps here. |
| pharmacy | 哪里不舒服？我帮你看看。 | Nǎlǐ bù shūfu? Wǒ bāng nǐ kànkan. | Where do you feel unwell? Let me help. |
| hardware | 你要修什么？我帮你找工具。 | Nǐ yào xiū shénme? Wǒ bāng nǐ zhǎo gōngjù. | What do you need to fix? I'll help you find the tools. |
| clothes-shop | 这件衣服你可以试试。 | Zhè jiàn yīfu nǐ kěyǐ shìshi. | You could try this one on. |
| teahouse | 来一壶茶吧，慢慢喝。 | Lái yì hú chá ba, mànmàn hē. | Have a pot of tea, and take your time. |

UI labels: 看看商品 browse the goods · 再见 goodbye.
**Owns:** the `fittings` and `staff` of existing shop rooms in `src/content/rooms.json` (not `home`,
not the word hall's rooms, not `guesthouse`), new counter kinds appended to `models.fitting`, new
`src/content/assistants.json`, the staff-talk path in `src/main.js`/`src/ui/`, tests.

## D2-views — see the street through doors and windows (effort max)

Inside a shop the doorway and windows show nothing (the room is a box 400 m from the town). Make
them show what the shop would look out on: for each room, a camera in the town at the building's
front, facing out, renders the street into a texture that the room's doorway and front windows show,
positioned so the view lines up with the player's position (a portal: the town camera mirrors the
player's offset from the doorway, with an oblique near plane or clipping so the building's own wall
isn't drawn). Render only when a doorway or window is actually on screen (frustum test), at reduced
resolution (half size is fine), and never when the player is in the town. Night and day must match
the town. If a room has no building front (the city's store, the word hall's side rooms), leave its
openings as they are. Keep draw calls sane inside rooms: report the frame time and draw calls inside
three shops before and after (`scratchpad` perf script adapted to rooms).
**Owns:** new `src/world/views.js`, small hooks in `src/world/town.js` (enter/leave/update) and in
`src/world/interior.js` (which meshes are openings). Tests: a browser spec that inside 慢慢咖啡 the
view texture is being rendered when facing the door and not when facing the back wall.

## D3-interiors-art — floors, walls and more to decorate with (effort high)

1. **Floors:** every building gets its own floor, drawn as a canvas texture like the town's paving
   (`pavingMaterial` in `src/world/town.js`): wood planks in varied tones, stone or terrazzo tiles,
   checkerboard, herringbone parquet, tatami, patterned tiles. Map room id → style in a new
   `src/content/floors.json` (do not edit `rooms.json` for this), applied in `src/world/interior.js`.
2. **Walls:** large bare walls get fitting décor: wainscoting, hanging scrolls, framed pictures,
   shelves with objects, lattice windows, wall lamps. Put per-room wall décor in a new
   `src/content/walls.json`; keep clear of doors, windows, counters and signs.
3. **More things to decorate your home with** than rugs: new catalog items sold at 家居小铺 (and 生活馆
   for the bigger ones), each placeable through the existing decoration system (wall pieces use the
   certificate's wall-hanging kind), with a model in `models.furniture()` and an item drawing:

   | id | zh | pinyin | en | where | price |
   | --- | --- | --- | --- | --- | --- |
   | scroll-painting | 字画 | zìhuà | calligraphy scroll | wall | 45 |
   | landscape-painting | 山水画 | shānshuǐhuà | landscape painting | wall | 60 |
   | vase | 花瓶 | huāpíng | vase | floor or table | 30 |
   | folding-screen | 屏风 | píngfēng | folding screen | floor | 90 |
   | bonsai | 盆景 | pénjǐng | bonsai | floor or table | 40 |
   | tea-table | 茶几 | chájī | tea table | floor | 70 |
   | birdcage | 鸟笼 | niǎolóng | birdcage | floor | 35 |

   Object names: the same zh/pinyin/en as keys `scroll-painting`, `landscape-painting`, `vase` (hsk 6),
   `folding-screen`, `bonsai`, `tea-table`, `birdcage`; `painting` 画 huà (hsk 2) for any framed
   picture you hang yourself. Clips `shop-<id>` and `obj-<key>` (listed, not generated).
4. **The nightstand** slot upstairs at home sits far from the moon-gate bed's new place (east wall,
   facing the landing): move `up-nightstand` beside the bed's head end.
**Owns:** new `floors.json`, `walls.json`, the room floor/wall code in `src/world/interior.js`, the new
catalog rows, new `models.furniture()` kinds (appended), item drawings, the `home` entry's slots in
`rooms.json`.

## D4-hall-life — people in the word hall (effort max)

The word hall (词语馆: `hall` and its side rooms 阅览室 `reading`, 自习室 `studyroom`, 听力室
`listening`, 庭院 `courtyard`) is empty. Add a few people who walk around it: they stroll between
shelves and desks, sit to read or study for a while, and now and then walk to a side room's door and
go in (they leave this room and appear in the side room from its door, and later come back). Paths
avoid furniture and each other (reuse `src/world/navigation.js`). Each is interactable: E shows their
line (voiced; clip ids `hall-<key>`; lines in new `src/content/hall-visitors.json`, registered in
`generate-voice.py`). Roles: 学生 (`student`, xuésheng, student, hsk 1), 图书管理员 (`librarian`,
túshū guǎnlǐyuán, librarian, hsk null), 游客 (existing `person`). Three to five people in the hall,
one or two in each side room at a time.

| key | who | zh | pinyin | en |
| --- | --- | --- | --- | --- |
| student-1 | student | 我在准备HSK考试，每天都来这儿复习。 | Wǒ zài zhǔnbèi HSK kǎoshì, měitiān dōu lái zhèr fùxí. | I'm preparing for the HSK exam; I come here to review every day. |
| student-2 | student | 听力室的耳机很好用。 | Tīnglìshì de ěrjī hěn hǎo yòng. | The headphones in the listening room are great. |
| student-3 | student | 你也是来学中文的吗？ | Nǐ yě shì lái xué Zhōngwén de ma? | Are you here to learn Chinese too? |
| librarian-1 | librarian | 阅览室里请保持安静。 | Yuèlǎnshì lǐ qǐng bǎochí ānjìng. | Please keep quiet in the reading room. |
| librarian-2 | librarian | 这本书很适合初学者。 | Zhè běn shū hěn shìhé chūxuézhě. | This book is great for beginners. |
| visitor-1 | person | 词语馆真大啊！ | Cíyǔguǎn zhēn dà a! | The word hall is really big! |

**Owns:** new `src/world/visitors.js`, `src/content/hall-visitors.json`, small hooks in `town.js` and
`main.js`, the two object keys, tests (a browser spec: people move over time, one can be talked to,
someone walks through a side-room door).

## D5-town-fixes — the lane, the tea stall, the inn, the metro, the city (effort high)

1. **West lane:** walking toward 河边文化街 glitches at the signpost near the lane; and a shop sign near
   the corridor into the quarter blocks the way. Find both (in `world.json` square props and the
   scenery), move or remove them so the lane is clear and smooth to walk.
2. **青禾茶铺 (tea-house):** its early counter (and 林阿姨's stall) blocks the building's door. Move the
   stall outside to a sensible spot beside the building (keep 林阿姨 and her missions working, update
   any tests), or make the counter a decorative outdoor tea stall, so the door is free.
3. **客栈 (guesthouse):** its door sits along the wall at a weird angle, facing the park wall across a
   narrow walk. Give it a proper entrance facing the square (rotate the building or move the door),
   updating its room door and tests.
4. **Metro entrance** (the town's, `buildStationEntrance` in `src/world/city.js`): the rail looks out of
   place and the sign is in the way. Rebuild it like a modern Chinese metro entrance (the player's
   reference photo): a glass pavilion with a rounded steel canopy, clear glass walls, a sign band along
   the front reading **青禾站** (Qīnghé Zhàn, Qinghe Station) with the metro logo, a smaller **A出入口**
   (A chūrùkǒu, Entrance A), and granite steps at the front. Add both to `signs.json`. Keep the way
   down to the platform working (`tests/browser/metro.spec.js`).
5. **The city (云海市中心):** the pavilions' roofs are too low (raise them to a comfortable height),
   and the paths are cramped with streetlights and poles in the middle: move lights and poles to the
   edges so people can walk freely.
**Owns:** `world.json` square/riverside props and the tea-house/guesthouse entries, the tea stall code,
the `guesthouse` room door in `rooms.json`, `src/world/city.js`, `src/content/city.json`, the metro
signs in `signs.json`, tests.

## D6-trees-fountain — nicer trees, a flowing fountain, fresher street props (effort high)

1. **Trees:** the first-iteration trees are simple. Make them fuller and varied: layered canopies with
   a few tones, a proper trunk and branches, and three kinds (plus the existing pine): weeping willow
   near water (柳树 `willow`, liǔshù), ginkgo (银杏树 `ginkgo`, yínxìngshù) and osmanthus (桂花树
   `osmanthus`, guìhuāshù), with objects keys and `hsk: null`. Batchable, few shadow casters.
2. **The fountain** in the middle of the square: make it beautiful and flowing. A carved stone basin,
   a central tiered bowl, water arcing from spouts, falling sheets, a gently rippling pool surface
   (animated texture or vertex motion), splash rings, and an optional soft water sound (reuse the
   audio service's ambient lane) that fades with distance. Animate cheaply (a few moving meshes or a
   scrolling texture; not hundreds of particles), keep it off the static batch, and keep its hitbox.
3. **Early street props** (benches, bins, streetlights, planters, crates): refresh them to match the
   newer scenery (rounded timber benches, lantern-style streetlights, stone planters).
**Owns:** `models.tree`/tree placement (`world.json` `trees` only), the fountain build in
`src/world/town.js` and a new `src/world/fountain.js`, `streetProp` builders in `models.js`, the new
object keys, tests.

## D7-keys — change key bindings, and one row of HUD buttons (effort high)

Player: "allow the user to change their keybinds if necessary. Plus also move the 4, 5 and H up to
the top or somewhere else where all of them are aligned."

Today keys are hard-wired: `town.js` (movement WASD + arrows, Space jump/stand, E interact, F learn
the looked-at word, V view, G put down, R rotate and X cancel while placing), `main.js` (H labels,
1–5 panels, Numpad digits too). The key letters shown on screen are written out separately
(`CONTROLS` and the HUD in `src/ui/shell.js`, the interact button, the nameplate's F, the carrying,
seated and placing hints, the placing notice in `src/ui/decorate.js`, and any key named in content
JSON such as tutorial steps). 1, 2, 3 sit in the top bar (`.top-actions`); 4, 5, H sit apart in
`.utility-dock`.

### Build
- **One row of buttons:** move 状态 (4), 设置 (5) and 名字标签 (H) into `.top-actions` after 生词本 (3),
  same `icon-button` style, ids unchanged; remove `.utility-dock` and its CSS. It must still fit and
  not overlap anything at 1280×720, 960×540 and phone width (375 px, touch layout).
- **Bindings:** a small module (e.g. `src/core/keys.js`) with the default map below, `label(code)`
  (KeyX → X, DigitN/NumpadN → N, Space → Space, arrows → ↑ ↓ ← →, otherwise the code), and one way
  to ask "is this event action X". Every handler above reads bindings through it (Numpad digits still
  count as their digit). Arrow keys stay fixed extra movement keys and can't be bound; Escape, Tab,
  Meta and ContextMenu can't be bound either. Mouse buttons and touch controls are unchanged.
- **Saved** as `profile.settings.keys`: only the actions changed from the default, `{action: code}`.
  Extend the settings sanitiser in `src/core/profile.js`: drop unknown actions, codes that aren't
  plain `[A-Za-z0-9]+`, reserved keys, and a later action repeating a code already used. Old saves
  without it load unchanged.
- **Settings panel** (`openSettings`, `src/ui/panels.js`): a 按键设置 section after 视角. One row per
  action: its name, and a button showing the key. Click (or Enter) the button → it shows 请按新键…
  and the next key press becomes the binding. Esc cancels without closing the panel (the panel's own
  Esc-to-close must not fire); Tab cancels and moves focus as usual. A key used by another action
  swaps the two and says so; a reserved key says it can't be used. 恢复默认 resets all. Buttons are
  keyboard-reachable with aria-labels naming the action and key.
- **Everything shown follows the bindings:** the HUD `<kbd>`s, `title` and `aria-keyshortcuts`, the
  controls bar, the interact button, the nameplate's 记住 key, carrying/seated/placing hints and
  notices, and content text that names a key (use a placeholder such as `{interact}` in the JSON
  and fill it at display time; check-content must still pass). Re-render when a binding changes.
- Tests: unit (defaults, label, sanitise cases, swap); browser: the six buttons share one row in
  `.top-actions` at the three sizes; rebind 交谈 to Q, press Q next to an NPC and the talk opens, the
  interact button and controls bar show Q; reload keeps Q; 恢复默认 gives E back; Esc while waiting
  keeps the panel open.

### Words (UI labels, no clips; use exactly)

| action | default | zh | pinyin | en |
| --- | --- | --- | --- | --- |
| forward | KeyW | 向前走 | xiàng qián zǒu | Move forward |
| back | KeyS | 向后走 | xiàng hòu zǒu | Move back |
| left | KeyA | 向左走 | xiàng zuǒ zǒu | Move left |
| right | KeyD | 向右走 | xiàng yòu zǒu | Move right |
| jump | Space | 跳 · 站起来 | tiào · zhàn qǐlái | Jump / stand up |
| interact | KeyE | 交谈 · 进门 | jiāotán · jìn mén | Talk / enter |
| collect | KeyF | 记住这个词 | jìzhù zhège cí | Learn this word |
| view | KeyV | 视角 | shìjiǎo | Switch view |
| labels | KeyH | 隐藏名字 | yǐncáng míngzi | Hide labels |
| drop | KeyG | 放下 | fàngxià | Put down |
| rotate | KeyR | 转向 | zhuǎnxiàng | Rotate |
| cancel | KeyX | 取消放置 | qǔxiāo fàngzhì | Cancel placing |
| journal | Digit1 | 旅行手册 | lǚxíng shǒucè | Journal |
| inventory | Digit2 | 背包 | bēibāo | Inventory |
| wordbank | Digit3 | 生词本 | shēngcíběn | Word bank |
| status | Digit4 | 状态 | zhuàngtài | Condition |
| settings | Digit5 | 设置 | shèzhì | Settings |

Section title 按键设置 · KEY BINDINGS. Microcopy: 点一下按键，再按你想用的新键。按 Esc 取消。 · Click a key,
then press the new key you want. Esc cancels. Waiting: 请按新键… · Press a new key…. Swap: 和「{zh}」互换了。
· Swapped with {en}. Reserved: 这个键不能用。 · That key can't be used. Reset: 恢复默认 · Reset to defaults.

**Owns:** new `src/core/keys.js`, the key handling in `town.js` and `main.js`, the HUD, `CONTROLS` and
hints in `shell.js`, the key lines of `decorate.js`, the settings section in `panels.js`, the settings
sanitiser in `profile.js`, key placeholders in content JSON, `style.css` HUD rules, tests. D5 is
still fixing `world.json`, `tutorial.json`, `quests.json` and a stall line in `town.js`: re-read before
every edit to a shared file, small anchored edits only.

## What shipped (2026-09-25)

- D1: every shop counter rebuilt (eight counter kinds; the clothes shop keeps its style) with a clerk
  behind it. Assistants in the shops talk in two pages (greeting plus a find or browse line, then the
  shop's line with its buttons); the post office also offers 写明信片. Looking at the clerk at eye
  level talks to them, looking down at the counter opens the shop. The find line follows the buy
  guide (the hardware store too); the pay line only plays where something is sold.
- D2: the street shows through shop doorways and front windows (a second camera in the town with its
  near plane on the building front, cropped to the openings, rendered at half size, only while an
  opening is on screen). The view has no sun shadows: a guarded opt-out keeps every case under 900
  draw calls (word hall at night 597).
- D3: a patterned floor for every room (`floors.json`), panelling and wall pieces in 22 rooms
  (`walls.json`), seven new home items at 家居小铺 and 生活馆 (字画, 山水画, 花瓶, 屏风, 盆景, 茶几,
  鸟笼, with descriptions by the main session). The home's wall spots are now 墙面 and also take
  paintings. The upstairs nightstand moved beside the bed, with a save upgrade (version 4).
- D4: nine people in the word hall (students, librarians, a 游客) walk between the hall and its side
  rooms and can be talked to when looked at; they hold still while you talk.
- D5: the inn turned to face the lane, the lane cleared (streetlight, signpost), 林阿姨's and 陈叔叔's
  stalls moved beside their shops (−4.8,−9.4 and 4.8,−9.4) so both doors are clear, the breakfast
  cart moved, the metro entrance rebuilt as a glass pavilion with a rounded canopy and a 青禾站 /
  A出入口 band, city lamps on the kerb, bus shelter and kiosk roofs raised.
- D6: four tree kinds (ginkgo, osmanthus, weeping willow, pine), refreshed benches, bins, lamps,
  planters and crates, and a carved fountain with moving water, four jets and a water sound; nobody
  can jump into it.
- D7 (asked for during the wave): key bindings in 设置 (按键设置), saved with the profile, every key
  hint on screen following them; the 1–5 and H buttons share one row in the top bar.
- Left as is: the unused `地铁` sign entry, the lamp at (−12,0), no panelling on upper floors, the
  librarians speak with the narrator's voice.
