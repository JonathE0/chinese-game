# Every building furnished, decorated and labelled (2026-09-24)

Player: "go into each building one by one and ensure they are all properly decorated and furnished
with appropriate labels."

Interiors today (`src/content/rooms.json`, built by `src/world/interior.js` with fittings from
`models.fitting`): the word hall and its four side rooms (reading, studyroom, listening, courtyard),
青禾超市, 慢慢咖啡, 麦香面包, 生活馆, 青禾书馆, 青禾灯具, 家常餐厅, 家居小铺, 青禾银行, 旧物铺,
青禾茶楼 (after it is built) and the city's 星光五金百货. Four buildings have no interior at all:
青禾邮局 (world id `bank`, riverside), 青禾药店 (`pharmacy`, riverside), 客栈 (`guesthouse`,
square) and 服装店 (`clothes-shop`, market). 青禾茶铺 and 小小商店 stay outdoor counters with
their shopkeepers in front; don't give them interiors. The home and its rooms belong to the house
task (`2026-09-24-two-storey-house.md`); leave them alone.

## What "properly" means, room by room

1. **Reads as its trade from the door**: the fittings a real one has (a bakery has a glass pastry
   case, bread racks, an oven behind the counter; a bank has teller windows and a queue rail; a
   bookshop has shelves by subject and a reading table…), and no big empty wall or floor.
2. **Decorated**: at least a few things that make it lived-in and in keeping with the town —
   plants, lanterns, a scroll or poster, a clock, a rug, a noticeboard.
3. **Labelled**: every distinct item names itself when looked at (the naming engine: `lookName` on
   the entity; `tests/browser/names.spec.js` must stay green), department and service signs where a
   real shop would have them, all from the list below.
4. **Sound**: nothing floating, sunk into the floor, clipping through walls or blocking the door or
   counter; the player can reach every counter and walk every aisle (use the existing hitbox and
   route tests).

## Task I1-rooms — audit and finish the existing interiors (model: opus)

Visit every existing interior above headlessly (Playwright, 960×540, screenshots in your
scratchpad, never in the repo), write the audit per room into your checkpoint (what is missing,
wrong or broken), then fix it through `rooms.json` fittings and décor, and new fitting kinds in
`models.fitting` only where no existing kind will do. Report a short per-room before/after list.

## Task I2-new-rooms — interiors for the four buildings without one (model: opus)

Give each a walk-in interior with a door in its building's front, using the room system as the
other shops do (`door`, `size`, `spawn`, `exit`, `enterLabel`, fittings, staff where a shop has
one). No new shop stock or mechanics beyond what exists; the post office counter may later host
postcards (a separate task).

| building | room zh | pinyin | en | enterLabel | what's inside |
| --- | --- | --- | --- | --- | --- |
| bank (青禾邮局) | 青禾邮局 | Qīnghé Yóujú | Qinghe Post Office | 进邮局 | counter with scales, parcel shelves, a stamp display, a letter slot, a clerk |
| pharmacy | 青禾药店 | Qīnghé Yàodiàn | Qinghe Pharmacy | 进药店 | a wall of small herb drawers, shelves of medicine boxes, a counter, a pharmacist |
| guesthouse | 客栈 | kèzhàn | Guesthouse | 进客栈 | a reception desk with a key board, a lounge with tables and chairs, a staircase going up (decorative, blocked by a rope), lanterns |
| clothes-shop | 服装店 | fúzhuāng diàn | Clothes shop | 进服装店 | clothes racks, shelves of hats and shoes, mannequins, a mirror, a curtained fitting room, a clerk |

## Words you may use

Object names (add to `objects.json` if the key is missing; set `hsk` only from an exact entry in
`public/hsk/words.json`, otherwise `null`):
前台 qiántái reception desk · 钥匙 yàoshi key · 试衣间 shìyījiān fitting room · 镜子 jìngzi mirror ·
衣架 yījià clothes rack · 药柜 yàoguì medicine cabinet · 秤 chèng scales · 包裹 bāoguǒ parcel ·
邮票 yóupiào stamp · 营业员 yíngyèyuán shop assistant · 药剂师 yàojìshī pharmacist · 衣服 yīfu
clothes · 鞋 xié shoes · 帽子 màozi hat · 海报 hǎibào poster · 挂钟 guàzhōng wall clock ·
布告栏 bùgàolán noticeboard

Signs (add each to `src/content/signs.json` with its pinyin and English):

| zh | pinyin | en |
| --- | --- | --- |
| 欢迎光临 | huānyíng guānglín | Welcome |
| 收银台 | shōuyíntái | Checkout |
| 请排队 | qǐng páiduì | Please queue |
| 营业时间 | yíngyè shíjiān | Opening hours |
| 小心地滑 | xiǎoxīn dì huá | Caution: wet floor |
| 今日特价 | jīnrì tèjià | Today's special offer |
| 今日推荐 | jīnrì tuījiàn | Today's recommendation |
| 新鲜 | xīnxiān | Fresh |
| 水果区 | shuǐguǒ qū | Fruit |
| 蔬菜区 | shūcài qū | Vegetables |
| 饮料 | yǐnliào | Drinks |
| 零食 | língshí | Snacks |
| 日用品 | rìyòngpǐn | Household goods |
| 菜单 | càidān | Menu |
| 茶叶 | cháyè | Tea leaves |
| 点心 | diǎnxin | Pastries |
| 借书 | jiè shū | Borrow books |
| 还书 | huán shū | Return books |
| 新书 | xīn shū | New books |
| 儿童读物 | értóng dúwù | Children's books |
| 请保持安静 | qǐng bǎochí ānjìng | Please keep quiet |
| 存款 | cúnkuǎn | Deposits |
| 取款 | qǔkuǎn | Withdrawals |
| 咨询 | zīxún | Enquiries |
| 家具 | jiājù | Furniture |
| 床上用品 | chuángshàng yòngpǐn | Bedding |
| 厨具 | chújù | Kitchenware |
| 灯具 | dēngjù | Lighting |
| 工具 | gōngjù | Tools |
| 五金 | wǔjīn | Hardware |
| 旧物回收 | jiùwù huíshōu | We buy second-hand goods |
| 寄信 | jì xìn | Send letters |
| 包裹 | bāoguǒ | Parcels |
| 邮票 | yóupiào | Stamps |
| 中药 | zhōngyào | Chinese medicine |
| 西药 | xīyào | Western medicine |
| 取药 | qǔ yào | Collect medicine |
| 前台 | qiántái | Reception |
| 客房 | kèfáng | Guest rooms |
| 男装 | nánzhuāng | Menswear |
| 女装 | nǚzhuāng | Womenswear |
| 试衣间 | shìyījiān | Fitting room |
| 鞋 | xié | Shoes |
| 帽子 | màozi | Hats |

If a room needs a word or sign not on these lists, don't write it: list it in your report.

## Rules and checks (both tasks)

- Voice: register nothing new in the generator beyond what `objects.json`/`signs.json` already
  feed it, and don't run it; list the new `obj-<key>` and `sign-<id>` clip ids in your report.
- Keep `npm test`, `npm run check:content` (missing clips for your new words are expected),
  `names.spec.js`, `hardware-cleanup.spec.js`, `places.spec.js`, `living.spec.js` and
  `performance.spec.js` green (`--workers=1`, dev server already on 5174). Add a browser test that
  enters each new interior and walks to its counter. No `npm run build` or `verify`.
- `rooms.json`, `models.js` and `objects.json` are shared between the two tasks: re-read before each
  edit, small anchored edits only. I1 owns existing room entries; I2 owns the four new ones and the
  four buildings' door lines in `world.json`.

## What shipped (2026-09-24)

- I1: all eighteen existing interiors audited and furnished (clocks, noticeboards, queue rails, tool walls,
  section and service signs from this plan's list); shop shelves read 货架, bookcases 书架.
- I2: walk-in 青禾邮局 (`post-office`), 青禾药店, 客栈 and 服装店 with fittings, signs and staff (营业员, 药剂师).
- Open: the new staff cannot be talked to yet (talking to any staff opens the restaurant menu), 衣架 unused,
  and a poster's text lines hang below its frame.
