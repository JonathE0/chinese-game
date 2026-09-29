# Development wave 3 (2026-09-27)

Worktree `C:\Users\jonat\Documents\ChatGPT\Game-development`, branch `development` (port 5180 for the
player). Waves 1 and 2 are uncommitted and frozen as snapshot refs: compare this wave's changes with
`git diff refs/snapshots/dev-wave-2 -- <file>` (files tracked in HEAD) or
`git show refs/snapshots/dev-wave-2:<path> | diff - <path>` (files new in waves 1–2).

## What the player asked for

The home's balcony looks odd from inside. On the left of the map near the bank, the pavilion roof
is still very low (the earlier "pavilion in the extension with low roofs, cramped, streetlights and
poles in the path" meant the west quarter's covered walkways, not 云海's bus shelter). They love the
water: a working boat that crosses now and then, a ferry and docks to go from one side of the bay to
the other, and a Ferris wheel. The near-side buildings of 云海 (not the skyline across the harbour)
look plain and their "lights going up" look low-effort: more variety in buildings and lights. Make
all the city's buildings enterable instead of closed shops, and add a giant mall with multiple floors
and complex architecture. More complex geometry is now welcome, **but the game must run on
lower-end laptops**. A sun and a moon in the sky. Uses for the left and right mouse buttons while
walking around.

## Rules for every task

- Everything in wave 2's "Rules for every task" still applies (file ownership and anchored edits in
  shared files, content in JSON, Chinese only from this plan's tables, `hsk` only from exact
  `public/hsk/words.json` entries, clip ids registered but the voice generator not run, checks with
  `PW_PORT=5185 npx playwright test <files> --workers=1` on the already-running test server, never
  ports 5174/5180, never the main Game folder, no build/verify, no git writes, checkpoints in
  `.claude/checkpoints/<task id>.md`, caveman-style reports).
- **Detail levels.** Anything heavy asks `detail()` from `src/core/quality.js` (`'high' | 'medium' |
  'low'`; a stub says `'high'` until Q-quality lands) and builds or runs a lighter version for
  medium/low: fewer pieces, no reflections, fewer animated things, simpler shaders. Richer geometry is
  allowed; merge and batch it, and keep ≤ 900 draw calls anywhere on high.
- **Coplanar faces.** New geometry must not have flush faces of different materials: run the checker
  from `tests/browser/coplanar.spec.js` (X-exterior's) on what you build.
- **Pre-wired hooks.** `town.ensureCity()` now also calls `buildHarbour` (`src/world/harbour.js`) and
  `buildMall` (`src/world/mall.js`), before `buildCrowd`, with the same `{update, targets}` contract as
  wave 2's city parts. `main.js` sends `harbour:…` ids to `openHarbour(ctx, rest)`
  (`src/ui/harbour.js`). City doors: `town.cityTargets` lists city.json `doors` entries
  `{room, x, z, label}` as `door:<room>` targets; a city room returns to the city like the hardware
  store (`interiorOnly`, `returnPlace:"city"`, `returnSpawn`).

## 云海 additions to the master layout (city-local metres)

| what | owner | where |
| --- | --- | --- |
| Near pier (ferry, ticket booth), off the promenade | B-harbour | x 14…26, z −60…−47 |
| Far landing: a walkable waterfront strip with a pier, plaza, lamps, benches, trees; move any skyline tower that stands on it | B-harbour | x −40…90, z −190…−172 |
| Ferris wheel on the far landing (about 50 m, lit at night) | B-harbour | around x 62, z −182 |
| Ferry route and ambient boats across the bay | B-harbour | the bay |
| The mall 星光百货 (west side of the avenue; its entrance where 星光五金百货's door was, x −10.5, z 0) | Y-mall | block x −30…−10, z −9…9 |
| Every other near-side building (downtown, both sides of the avenue, the promenade's buildings) | E-downtown | as today, minus the mall block |

City doors (E-downtown puts them on the fronts and lists them in city.json `doors`; N-interiors and
Y-mall build the rooms with exactly these ids):

| room id | building | zh | pinyin | en | enterLabel |
| --- | --- | --- | --- | --- | --- |
| city-bank | 云海银行 | 云海银行 | Yúnhǎi Yínháng | Yunhai Bank | 进银行 |
| city-bookshop | 一号书店 | 一号书店 | Yī Hào Shūdiàn | No. 1 Bookshop | 进书店 |
| city-hospital | 中山医院 | 中山医院 | Zhōngshān Yīyuàn | Zhongshan Hospital | 进医院 |
| city-noodles | 海风面馆 | 海风面馆 | Hǎifēng Miànguǎn | Sea Breeze Noodles | 进面馆 |
| city-cinema | 光明电影院 | 光明电影院 | Guāngmíng Diànyǐngyuàn | Guangming Cinema | 进电影院 |
| city-store | an unsigned tower | 便利店 | biànlìdiàn | Convenience store | 进便利店 |
| city-cafe | an unsigned tower | 海边咖啡 | Hǎibiān Kāfēi | Seaside Café | 进咖啡馆 |
| mall | 星光百货 | 星光百货 | Xīngguāng Bǎihuò | Starlight Department Store | 进商场 |

---

## T-town — the balcony, and the west quarter's low walkways (task-implementer, opus, effort high)

- The home's upstairs balcony seen from inside: find what looks odd (shots from inside at several
  angles, day and night: the glass door, the portal street view through it, the balcony floor and
  railing, the wall around the opening) and fix it.
- The west quarter (河边文化街, "near the bank"): its covered walkways (走廊, `walkway` in world.json
  scenery; `walkwayLayout` / `models.walkway`) and any pavilion there are too low and cramped. Raise
  the roofs to a comfortable clear height (≥ 2.9 m under the beams), widen where they crowd, and take
  posts, lamps and props out of every walking line; keep the canal, bridges and shop boards working.
- Tests: clear height under every walkway/pavilion roof; no pole or lamp inside a walking line in
  the west quarter; the existing west-quarter, names, footprint and garden tests stay green.
- **Owns:** the home balcony in `rooms.json`/`interior.js`/`views.js` if needed, the walkway,
  veranda and pavilion builders and their layout code, `world.json` west-quarter scenery and props.

## S-sky — a sun, a moon and stars (task-implementer, opus, effort high)

- A visible sun disc with a soft glow at exactly the daylight sun's direction (it must agree with the
  shadows), tinted at dawn and dusk, setting below the horizon; a moon with phases over an 8-day
  cycle (full on 中秋节, where the festival's bigger moon already exists — unify, don't duplicate),
  glowing at night; stars fading in after dusk. Drawn cheaply (a few draw calls, camera-following at a
  fixed far distance inside the far clip), in the town and in 云海, and shown in the bay's reflection
  (`reflect()` from `bay.js`). Looking at them names them (far look boxes with `reach`).
- Objects: 太阳 tàiyáng sun (`sun`); 星星 xīngxing star (`star`); the moon uses the existing 月亮 entry.
- Tests: sun direction = light direction at several hours; moon phase by day; nothing drawn by day
  that belongs to night; draw calls.
- **Owns:** a new `src/world/sky.js`, the sky parts of `src/world/daylight.js`, the festival moon in
  `src/world/festivals.js`.

## M-camera — left and right mouse: a camera for 打卡 (task-implementer, opus, effort high)

China's tourists 打卡 (check in) by photographing famous spots; the mouse buttons become a camera.
- **Hold the right mouse button** to raise the camera: a viewfinder frame, a gentle zoom (about 2.5×)
  so far signs and LED characters become readable, and the name of what's in the centre shown large.
  **Left click while holding** takes a photo: shutter sound, a flash, and the shot is saved. Left and
  right click keep doing what they do today when you're placing furniture or holding a toy. The
  context menu never opens over the game. Keyboard: a new key action `camera` (default `KeyC`) toggles
  the viewfinder and Enter takes the photo; touch: a camera button and a shutter button.
- **Photos** are small JPEG thumbnails (about 320×180) kept in IndexedDB on this device (never in the
  save file or the cloud), at most 60 (the oldest goes, with a notice), each with its place, time and
  what was centred. A 相册 section in the 旅行手册 (journal) shows them with their captions, and a
  photo can be deleted.
- **打卡点**: photographing a check-in spot (the table below; the right thing centred, from nearby,
  at the right time) the first time says 打卡成功！, plays its line, pays 5 学习币 and stamps it in the
  album. Save only which spots are done (`profile`, sanitised).
- Words (UI, no clips): 拍照 pāizhào Take a photo · 相册 xiàngcè Photo album · 照片 zhàopiàn Photo ·
  打卡点 dǎkǎdiǎn Check-in spot · 放大 fàngdà Zoom · 还没有照片。 Hái méiyǒu zhàopiàn. No photos
  yet. · 按住右键取景，点左键拍照。 Ànzhù yòujiàn qǔjǐng, diǎn zuǒjiàn pāizhào. Hold the right mouse
  button to frame a shot; click the left one to take it. · 照片只保存在这台设备上。 Zhàopiàn zhǐ
  bǎocún zài zhè tái shèbèi shang. Photos are kept on this device only. Key action `camera`: 相机
  xiàngjī · Camera. Object: 相机 xiàngjī camera (`camera`).
- Voiced (teacher voice): 打卡成功！ Dǎkǎ chénggōng! Checked in! (clip `checkin-success`), and each
  spot's line (clip `checkin-<id>`):

| id | spot | zh name | pinyin | en | line | line pinyin | line en |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fountain | town square | 喷泉 | pēnquán | the fountain | 青禾广场的喷泉，大家都在这儿拍照。 | Qīnghé Guǎngchǎng de pēnquán, dàjiā dōu zài zhèr pāizhào. | The fountain in Qinghe Square: everyone takes photos here. |
| wordhall | town | 词语馆 | Cíyǔguǎn | the Word Hall | 词语馆里有很多中文书。 | Cíyǔguǎn lǐ yǒu hěn duō Zhōngwén shū. | The Word Hall is full of Chinese books. |
| lotus-park | park | 莲池公园 | Liánchí Gōngyuán | Lotus Pond Park | 夏天的莲花最漂亮。 | Xiàtiān de liánhuā zuì piàoliang. | The lotus flowers are loveliest in summer. |
| bank | town | 青禾银行 | Qīnghé Yínháng | Qinghe Bank | 这是青禾最老的银行。 | Zhè shì Qīnghé zuì lǎo de yínháng. | This is Qinghe's oldest bank. |
| riverside | west quarter | 河边文化街 | Hébiān Wénhuà Jiē | Riverside Culture Street | 河边文化街有很多老房子。 | Hébiān Wénhuà Jiē yǒu hěn duō lǎo fángzi. | The riverside street has lots of old houses. |
| yunhai-centre | 云海 | 云海中心 | Yúnhǎi Zhōngxīn | Yunhai Centre | 云海中心是云海最高的楼。 | Yúnhǎi Zhōngxīn shì Yúnhǎi zuì gāo de lóu. | Yunhai Centre is the tallest building in Yunhai. |
| ferris-wheel | far landing | 摩天轮 | mótiānlún | the Ferris wheel | 坐摩天轮可以看到整个城市。 | Zuò mótiānlún kěyǐ kàndào zhěnggè chéngshì. | From the Ferris wheel you can see the whole city. |
| drones | during a show | 无人机表演 | wúrénjī biǎoyǎn | the drone show | 无人机在天上写字！ | Wúrénjī zài tiānshang xiě zì! | The drones are writing in the sky! |
| hotpot | hill terrace | 山城老火锅 | Shānchéng Lǎo Huǒguō | Mountain City Old Hotpot | 边吃火锅边看夜景。 | Biān chī huǒguō biān kàn yèjǐng. | Eat hotpot and watch the night view at the same time. |
| viewpoint | hill summit | 观景台 | guānjǐngtái | the viewing platform | 从这儿看，云海的灯火真美。 | Cóng zhèr kàn, Yúnhǎi de dēnghuǒ zhēn měi. | From up here, Yunhai's lights are beautiful. |
| ferry | near pier | 渡轮码头 | dùlún mǎtou | the ferry pier | 坐渡轮去对岸看看吧！ | Zuò dùlún qù duì'àn kànkan ba! | Take the ferry and have a look at the other side! |
| moon | at night | 月亮 | yuèliang | the moon | 今晚的月亮真美。 | Jīnwǎn de yuèliang zhēn měi. | The moon is beautiful tonight. |

- Tests: unit (spot matching, rewards once, album cap), browser (hold right, name shown, left click
  saves a photo, the fountain spot pays once, context menu suppressed, placing/throwing unchanged).
- **Owns:** new `src/core/checkins.js`, `src/content/checkins.json`, `src/ui/camera.js`,
  `src/ui/album.js`, the mouse lines of `town.js`'s pointer handler, the `camera` key in
  `keys.json`, the journal's 相册 section, camera styles in `style.css`.

## B-harbour — a ferry across the bay, boats, and a Ferris wheel (task-implementer-max, effort max)

- In `src/world/harbour.js`, `src/ui/harbour.js`, `src/content/harbour.json` (zones in the layout
  above): a near pier off the promenade with a ticket booth 售票处, a far landing across the bay (a
  walkable waterfront strip with its own pier, plaza, lamps, benches and trees in front of the skyline
  — move any skyline tower that stands on it, touching only those city.json skyline entries), and a
  ferry 渡轮 that shuttles between the two piers on a schedule (a crossing of about 30 s, a short wait
  at each end) whether you're aboard or not. Board with E at the pier (a ticket costs 3 学习币), ride
  standing on its deck (you move with it, can look around, can't fall off), get off at the far side.
  A tour boat 游船 (lit at night) and a small sailboat 帆船 cross now and then. Everything floats with
  a gentle bob, leaves a wake, and calls `reflect()`.
- A Ferris wheel 摩天轮 on the far landing, about 50 m, turning slowly and lit at night with changing
  patterns. Ride it: E at its platform (8 学习币), you sit in a cabin that goes round once (about
  90 s) with the view of the bay, the skyline and the hill, then get off.
- Walkable areas: add the piers and the far landing to the city's walk areas (`src/core/city.js`,
  anchored).
- Signs: 渡轮码头 dùlún mǎtou · Ferry pier; 售票处 shòupiàochù · Ticket office; 摩天轮 mótiānlún ·
  Ferris wheel. Objects: 渡轮 dùlún ferry (`ferry`); 码头 mǎtou pier (`pier`); 摩天轮 mótiānlún Ferris
  wheel (`ferris-wheel`); 游船 yóuchuán tour boat (`tour-boat`); 帆船 fānchuán sailboat (`sailboat`).
  UI: 船票 chuánpiào ferry ticket · 上船 shàng chuán Board · 下船 xià chuán Get off.
- Lines (clip `harbour-<key>`; the ferry crew in one cast voice, the wheel attendant in another):

| key | zh | pinyin | en |
| --- | --- | --- | --- |
| board | 渡轮马上开了，请上船！ | Dùlún mǎshàng kāi le, qǐng shàng chuán! | The ferry's about to leave. All aboard! |
| ticket | 一张船票三块。 | Yì zhāng chuánpiào sān kuài. | A ferry ticket is three kuai. |
| arrive | 到对岸了，请慢慢下船。 | Dào duì'àn le, qǐng mànmàn xià chuán. | We've reached the other side. Please get off carefully. |
| wheel-on | 请坐好，摩天轮要转了。 | Qǐng zuò hǎo, mótiānlún yào zhuàn le. | Please sit down; the wheel's about to turn. |
| wheel-off | 到了，小心下来！ | Dào le, xiǎoxīn xiàlái! | We're back. Mind your step getting off! |

- Tests: unit (schedule, fares once per ride, boarding rules), browser (buy, board, cross, get off
  on the far landing, ride the wheel once round, draw calls at night from the promenade and the far
  landing, detail levels).
- **Owns:** `src/world/harbour.js`, `src/ui/harbour.js`, `src/content/harbour.json`, the far-landing
  and skyline-tower moves in `city.json`, the walk-area hook in `src/core/city.js`, its signs/objects.

## E-downtown — the near side of 云海: better buildings, better lights (task-implementer-max, effort max)

- Rebuild the near-side buildings (both sides of the avenue, the promenade's buildings; not the
  skyline across the harbour, which the player likes; not the mall block) with real variety and
  richer geometry: podiums and setbacks, curtain walls with mullions, fins and louvres, balconies,
  sky gardens, crowns, arcades and entrance canopies, so no two read alike.
- Lights with variety and craft instead of plain bands climbing up: façade media walls with
  animated patterns and characters, outline lighting of edges and crowns, window life (lit rooms that
  change through the evening), uplights on podiums, signs with neon tubes, spotlights at the gate;
  calm and sparse by day. Uniform-driven, nothing allocates per frame; detail levels for low-end.
- Every building gets a real entrance (door, canopy, lit lobby glass) at the door points of the city
  doors table, listed in city.json `doors`; the old outdoor noodle counter (`CITY.noodles`) goes, since
  N-interiors moves the noodle lesson inside.
- Fix the about 460 exact coplanar pairs G-glitch found in the city geometry (with the checker), and
  keep ≥ 5 cm between layers on façades seen from far.
- Tests: the city, taxi, metro, quests, yunhai, names and performance specs stay green; doors reach
  their rooms; LED update count 0 material updates per frame; coplanar check on the city.
- **Owns:** `src/world/city.js`, `src/content/city.json` (except the far landing/skyline moves and the
  mall block), `src/world/leds.js`, city tests.

## N-interiors — every other city building open inside (task-implementer, opus, effort high)

- Rooms (room system, like 星光五金百货; ids and labels from the doors table) with real fittings,
  staff (the D1 assistant system) and lit, decorated interiors: 云海银行 (teller counter, ATM 取款机,
  queue rail; the existing bank panel), 一号书店 (shelves by subject, reading corner, counter; the
  问路 quest now ends inside), 中山医院 (lobby with 挂号 registration, waiting chairs 候诊区 and a
  药房 pharmacy window selling the pharmacy's items), 海风面馆 (tables, open kitchen; the city-noodles
  lesson moves to its counter — update its quest markers), 光明电影院 (ticket counter 售票处, posters,
  popcorn stand, and a screening room you can enter with a ticket, where a short wordless animation
  loops on the screen while you sit), 便利店 (shelves, fridges, counter), 海边咖啡 (café counter,
  tables by a window over the bay).
- Signs: 挂号 guàhào · Registration; 药房 yàofáng · Pharmacy; 候诊区 hòuzhěnqū · Waiting area;
  售票处 (shared with B-harbour) shòupiàochù · Ticket office. Object: 取款机 qǔkuǎnjī ATM (`atm`).
- New catalog rows (prefix `city-`; shops reuse existing items where the table says so):

| shop | items (zh · pinyin · en · measure · coins) |
| --- | --- |
| bookshop | 小说 xiǎoshuō novel 本 25 · 词典 cídiǎn dictionary 本 40 · 漫画 mànhuà comic book 本 15 |
| cinema | 电影票 diànyǐngpiào film ticket 张 20 · 爆米花 bàomǐhuā popcorn 桶 12 · 可乐 kělè cola 杯 6 |
| store | 饭团 fàntuán rice ball 个 8 · 酸奶 suānnǎi yoghurt 盒 6 · plus the kiosk's items |
| cafe | the coffee menu of 慢慢咖啡 |
| hospital | the pharmacy's items |

- Assistant lines (clip `assistant-shop-<id>`, the assistant voice):

| id | zh | pinyin | en |
| --- | --- | --- | --- |
| city-bank | 您好，要办什么业务？ | Nín hǎo, yào bàn shénme yèwù? | Hello, what can I do for you today? |
| city-bookshop | 新书在前面，词典在后面。 | Xīn shū zài qiánmiàn, cídiǎn zài hòumiàn. | New books are at the front, dictionaries at the back. |
| city-hospital | 挂号请到这边。 | Guàhào qǐng dào zhèbiān. | Registration is over here, please. |
| city-noodles | 我们的牛肉面最有名。 | Wǒmen de niúròumiàn zuì yǒumíng. | Our beef noodles are the most famous. |
| city-cinema | 今天的电影七点开始。 | Jīntiān de diànyǐng qī diǎn kāishǐ. | Today's film starts at seven. |
| city-store | 需要袋子吗？ | Xūyào dàizi ma? | Do you need a bag? |
| city-cafe | 今天想喝点儿什么？ | Jīntiān xiǎng hē diǎnr shénme? | What would you like to drink today? |

- Tests: each room entered from its city door and left back to it; counters reachable; the quests
  (city-directions, city-noodles) still complete; room audit (no blocked doors, signs visible).
- **Owns:** the seven rooms in `rooms.json`, their fittings in `models.js`, `city-` catalog rows,
  their assistants entries, quest markers for the bookshop and noodles.

## Y-mall — 星光百货, a giant mall (task-implementer-max, effort max)

- The building (a city part in `src/world/mall.js`, on the mall block): a striking modern façade —
  a glass atrium front, a curved canopy, LED screens, the name 星光百货 lit at night — with its
  entrance where 星光五金百货's door was.
- Inside (a room, or a set of floors built by `mall.js`, using the room system's collision so floors,
  stairs and railings work like the house's upper floor and the hill's steps): four floors around a
  central atrium under a glass roof, walkable escalators (moving steps if you can make them solid and
  cheap, otherwise stairs styled as escalators) and a lift 电梯 that takes you to a chosen floor, glass
  balustrades, a floor directory 楼层导览, benches and planters, and shops you can use: 1F phones and a
  bubble tea bar, 2F clothes and sportswear, 3F toys, 4F a food court 美食广场; 星光五金百货 stays
  reachable from 1F. Staff through the D1 assistant system; purchases through the existing shop code.
- Signs: 楼层导览 lóucéng dǎolǎn · Floor directory; 一楼 yī lóu · 1F; 二楼 èr lóu · 2F; 三楼 sān lóu ·
  3F; 四楼 sì lóu · 4F; 美食广场 měishí guǎngchǎng · Food court; 自动扶梯 zìdòng fútī · Escalator; 电梯
  diàntī · Lift; 洗手间 xǐshǒujiān · Toilets; 入口 rùkǒu · Entrance; 出口 chūkǒu · Exit; 奶茶店 nǎichá
  diàn · Bubble tea; 手机店 shǒujī diàn · Phone shop; 玩具店 wánjù diàn · Toy shop; 运动用品 yùndòng
  yòngpǐn · Sportswear; 服务台 fúwùtái · Information desk.
- Catalog rows (prefix `mall-`): 奶茶 nǎichá milk tea 杯 10 · 珍珠奶茶 zhēnzhū nǎichá bubble tea 杯
  12 · 水果茶 shuǐguǒ chá fruit tea 杯 12 · 手机壳 shǒujīké phone case 个 20 · 耳机 ěrjī earphones 副
  60 · 充电器 chōngdiànqì charger 个 25 · 玩具熊 wánjùxióng teddy bear 只 30 · 拼图 pīntú jigsaw puzzle
  盒 18 · 风筝 fēngzheng kite 个 15 · T恤 T xù T-shirt 件 40 · 运动鞋 yùndòngxié trainers 双 80 · 炒饭
  chǎofàn fried rice 份 15 · 拉面 lāmiàn hand-pulled noodles 碗 16 · 汉堡 hànbǎo burger 个 18 · 披萨
  pīsà pizza 块 12 · 寿司 shòusī sushi 份 25 · 冰淇淋 bīngqílín ice cream 个 8 (wearable if the wear
  system supports tops and shoes).
- Assistant lines (clip `assistant-shop-<id>`):

| id | zh | pinyin | en |
| --- | --- | --- | --- |
| mall-tea | 奶茶要少糖吗？ | Nǎichá yào shǎo táng ma? | Would you like your tea with less sugar? |
| mall-phones | 这款耳机很受欢迎。 | Zhè kuǎn ěrjī hěn shòu huānyíng. | These earphones are very popular. |
| mall-toys | 小朋友都喜欢这只熊。 | Xiǎopéngyǒu dōu xǐhuan zhè zhī xióng. | Children all love this bear. |
| mall-sports | 这双鞋可以试一下。 | Zhè shuāng xié kěyǐ shì yíxià. | You're welcome to try these shoes on. |
| mall-food | 美食广场在四楼。 | Měishí guǎngchǎng zài sì lóu. | The food court is on the fourth floor. |
| mall-info | 您好，需要帮忙吗？ | Nín hǎo, xūyào bāngmáng ma? | Hello, can I help you? |

- Tests: enter from the avenue, ride/walk to every floor and back, the lift, buy one item per shop,
  the hardware store still reachable, draw calls per floor, detail levels, room audit.
- **Owns:** `src/world/mall.js`, the mall's rooms/interior, `mall-` catalog rows, its signs,
  objects and assistants entries, the hardware store's door line.

## Q-quality — runs on lower-end laptops (task-implementer-max, effort max)

- `src/core/quality.js`: a 画质 setting (自动 default / 高 / 中 / 低) in 设置, sanitised in the
  profile; 自动 picks a level from a short measurement at start (and the GPU string where it helps)
  and can step down if frames stay slow. `detail()` returns the level for everyone else.
- What each level changes (measure the cost of each first): device pixel ratio cap, MSAA, shadow
  map size / cascades / filter (PCF5 → PCF3/PCF1) / distance, far clip and haze, the bay reflection
  and door street views, crowd size and animation distance, LED and water animation, drone count.
- Fix the known hotspot: the west quarter looking east from about (−36, 4) draws ~1,424 calls (limit
  900): batch or cull it (by district batch groups, merging static props). Also make the door portal
  quads (`src/world/views.js`) precise far from the origin (G-glitch's camera-relative fix doesn't
  reach their ShaderMaterial), and calm the thin shadows (lamp posts) that still shimmer.
- Tests: a Playwright run with 4× CPU throttle (CDP) on 低 must hold ≥ 30 fps in the square, the
  hotpot terrace at night and the mall atrium (once it exists); draw calls per level; the setting
  persists.
- Words (UI labels): 画质 huàzhì · Graphics quality; 自动 zìdòng · Auto; 高 gāo · High; 中 zhōng ·
  Medium; 低 dī · Low.
- **Owns:** `src/core/quality.js`, its settings line, renderer/device setup in `main.js`/`town.js`,
  static batching and culling (`batchStatics`), `views.js` precision, shadow setup.

## Added during the wave (main session)

- N-interiors: a `pharmacy` shop (hospital 药房 window and the town's 青禾药店): 感冒药 gǎnmàoyào cold
  medicine 盒 15 (感冒了就吃这个。) · 创可贴 chuāngkětiē plasters 盒 6 (手破了，贴一个。) · 口罩 kǒuzhào face
  masks 包 5 (一包十个。) · 维生素 wéishēngsù vitamins 瓶 20 (每天吃一片。) · 润喉糖 rùnhóutáng throat
  lozenges 盒 8 (嗓子不舒服的时候吃。). Descriptions for the `city-` items: 小说 一本很好看的小说。 · 词典
  查生词的好帮手。 · 漫画 有图有字，看起来很轻松。 · 电影票 凭票入场。 · 爆米花 看电影一定要吃爆米花。 · 可乐
  冰的更好喝。 · 饭团 早上来不及吃饭，就买一个饭团。 · 酸奶 饭后喝一盒酸奶。
- M-camera notices: 相册满了，最早的照片删掉了。 · 照片没有保存成功。 · 照片删掉了。 · 照片没有删掉。 · 删除照片.
- N-interiors review: ticket notice 没有电影票。请先去售票处买票。 Méiyǒu diànyǐngpiào. Qǐng xiān qù shòupiàochù
  mǎi piào. Bag labels 药品 yàopǐn · Medicine, 票 piào · Ticket. Shelf signs 小说/词典/漫画 approved.
- Y-mall review: the 1F info desk says 您好，需要帮忙吗？ then 美食广场在四楼。; the 4F food-court staff say
  想吃点儿什么？ Xiǎng chī diǎnr shénme? (What would you like to eat?) (clip `assistant-shop-mall-eat`).

## What shipped (2026-09-27)

- T-town: the balcony door (panelled, glass above a solid panel, balusters); the west quarter's
  walkways raised to 3.1 m clear with props out of the walking lines; flush faces fixed on every town
  building (coplanar check now sees repainted colours).
- S-sky: sun, moon (14-day phases, full on every 中秋节) and stars, drawn in 2–3 calls; an old
  upside-down sun pitch fixed; smooth light through dawn and dusk.
- M-camera: hold right to frame (2.5× zoom, the centred name), left click (or Enter) to shoot; photos
  in IndexedDB (60 max) shown in the journal's 相册; 12 打卡点 paying 5 学习币 once each.
- B-harbour: a ferry between the promenade and a walkable far landing (3 学习币), a tour boat and a
  sailboat, a ~50 m Ferris wheel you ride (8 学习币).
- E-downtown: nine different near-side buildings with window life, outline shows, neon, media walls
  and searchlights (uniform-driven); seven entrances; city flush faces 66 → 0.
- N-interiors: the bank, bookshop (问路 ends inside), hospital (挂号, 药房 selling five medicines,
  also at 青禾药店), noodle shop (the lesson moved inside), cinema with a screening room, store, café.
- Y-mall: 星光百货 with four floors round a glass atrium, moving escalators, a lift, shops on every
  floor and a food court; built on first entry.
- Q-quality: 画质 自动/高/中/低; plain colours repainted into one material before batching (town
  square 594 → 92 draw calls, west quarter 1,441 → 271); ≥ 38 fps everywhere at 4× CPU throttle.
- Left for the player to decide: doors for 海风大厦 and the promenade tower; moving the bank to a new
  plot.
