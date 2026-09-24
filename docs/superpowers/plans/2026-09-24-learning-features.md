# Learning features, wave 1 (2026-09-24)

The player asked to build everything from the brainstorm. This wave covers six self-contained
tasks, one agent each, running in parallel; waves 2 and 3 (house, scenery, metro, friendship and
postcards, interiors, festivals, pinyin display) follow in their own plans. The daily board idea is
dropped: `src/core/daily.js` already gives nine daily errands, and tasks here add errands to it
rather than a second board.

## Rules for every task in this wave

- **Task id and checkpoint.** Your task id is the letter and name in your heading (e.g. `M-market`).
  Keep `.claude/checkpoints/<task id>.md` as your agent file describes.
- **Saves.** New progress goes under `profile.learning`, normalised in `src/core/learning.js` and
  tested in `tests/learning.test.js`. Keys: `sources` and `misses` (Task E), `levels` (Task L).
  Touch only your own key's lines there. Do not bump `SAVE_VERSION`; the house task owns the next
  bump.
- **Shared files.** `src/main.js`, `src/ui/panels.js`, `src/ui/menu.js`, `index.html`, the
  stylesheets, `src/content/balance.json`, `src/content/catalog.json`, `src/core/daily.js`,
  `scripts/generate-voice.py` and `scripts/check-content.js` are edited by several agents at once.
  Re-read the exact lines right before each edit, keep every edit a small anchored insertion, and
  never rewrite or reformat a whole file.
- **Chinese.** Use the lines in your section exactly. If you need player-facing Chinese that is not
  here, don't write it: reuse an existing line or list what you need in your report.
- **Voice.** Every authored line needs a clip. Put lines in content JSON and register the file as a
  source in `scripts/generate-voice.py` (one small insertion), but **do not run the generator**:
  parallel runs overwrite `public/audio/manifest.json`. List your new clip ids in your report; the
  main session generates them after the wave. Missing clips for your own new lines are expected
  until then.
- **Checks.** Run `npm test`, `npm run check:content` and your own Playwright specs with
  `--workers=1` against the dev server already running on port 5174. Do **not** run
  `npm run build` or `npm run verify`; parallel builds collide, so the main session runs them after
  the wave.
- Ponytail: reuse what exists (`src/core/daily.js` `bump`, the economy's grant/pay functions,
  `SpeechInput` in `src/services/speech.js`, the buy guide's map pin in `src/ui/buyguide.js`, the
  review scheduling in `src/core/review.js`). No new dependencies.

---

## Task M-market — order in Chinese, hear the price

At the snack stalls and in 家常餐厅 the player orders with the right measure word and pays by ear.

1. **Measure words.** Give each food item in `catalog.json` a `measure`, plus `orderName` where the
   item's name already carries its measure. If items already carry measure data, keep it, fill the
   gaps from this table and report any disagreement instead of overwriting.

   | id | zh | measure | orderName |
   | --- | --- | --- | --- |
   | coffee | 咖啡 | 杯 | |
   | cake | 蛋糕 | 块 | |
   | bread | 面包 | 个 | |
   | fruit | 水果 | 份 | |
   | milk | 牛奶 | 瓶 | |
   | egg | 鸡蛋 | 个 | |
   | noodles | 面条 | 包 | |
   | vegetable | 蔬菜 | 份 | |
   | dumplings | 饺子 | 盘 | |
   | fried-rice | 炒饭 | 盘 | |
   | hot-soup | 汤 | 碗 | |
   | greens | 青菜 | 盘 | |
   | steamed-rice | 米饭 | 碗 | |
   | pot-tea | 茶 | 杯 | |
   | egg-tart | 蛋挞 | 个 | |
   | red-bean-bun | 豆沙包 | 个 | |
   | strawberry-donut | 草莓甜甜圈 | 个 | |
   | pineapple-bun | 菠萝包 | 个 | |
   | candied-hawthorn | 糖葫芦 | 串 | |
   | lamb-skewer | 烤串 | 串 | |
   | tofu-pudding | 豆花 | 碗 | |
   | rice-grain | 大米 | 袋 | |
   | tomato | 番茄 | 个 | |
   | tofu | 豆腐 | 块 | |
   | home-noodle-bowl | 家常鸡蛋汤面 | 碗 | |
   | home-vegetable-rice | 家常青菜豆腐饭 | 份 | |
   | home-tomato-rice | 家常番茄豆腐饭 | 份 | |
   | home-tomato-egg-noodles | 家常番茄鸡蛋面 | 碗 | |
   | city-water | 矿泉水 | 瓶 | |
   | city-sandwich | 三明治 | 个 | |
   | city-tea-can | 冰红茶 | 瓶 | |
   | city-beef-noodles-small | 小碗牛肉面 | 小碗 | 牛肉面 |
   | city-beef-noodles-large | 大碗牛肉面 | 大碗 | 牛肉面 |
   | city-egg-noodles-small | 小碗鸡蛋面 | 小碗 | 鸡蛋面 |
   | city-egg-noodles-large | 大碗鸡蛋面 | 大碗 | 鸡蛋面 |
   | wonton | 馄饨 | 碗 | |
   | xiaolongbao | 小笼包 | 笼 | |
   | yangchun-noodles | 阳春面 | 碗 | |
   | zhajiang-noodles | 炸酱面 | 碗 | |
   | baozi | 包子 | 个 | |
   | soy-milk | 豆浆 | 杯 | |
   | youtiao | 油条 | 根 | |
   | jianbing | 煎饼 | 个 | |

2. **Order builder 点餐.** Where a stall or the restaurant sells food, choosing an item opens a
   builder for 我要＿＿＿。: a number row (一 / 两 / 三), a measure row (the right measure plus
   three others from the table) and the item (its `orderName` or `zh`). The order reads e.g.
   我要两碗馄饨。 A wrong measure plays `measureHint` and highlights the right tile. The number sets
   the quantity, within wallet and stock. Keep the existing bargaining and fixed-price paths; the
   builder replaces only the step where the item and quantity are chosen, and payment still goes
   through the existing economy functions.
   With speech recognition available, a 说出来 button listens (`SpeechInput`, zh-CN). The order
   passes when the recognised text holds the number, the measure and the item. Accept Arabic digits
   (recognisers often write 2 for 两). Reject 二 before a measure word (二碗) with `measureHint`
   text replaced by the correct phrase shown on screen.
   A correct spoken order pays `orderBonus.spoken` coins and a correct built order with no wrong tile
   pays `orderBonus.built` (new in `balance.json`: 2 and 1), each at most once per order.
   Bump a new daily metric `ordered` and add the errand below to `src/core/daily.js`.
3. **Pay by ear.** After the order, the vendor says the total (`market-total-N`, N 1–99). The
   player pays by picking one of three amounts: the right one and two confusions (四 and 十 swapped,
   e.g. 14 ↔ 40, or tens and units swapped). A wrong pick plays `wrongPay` and replays the total at
   playback rate 0.8; a second wrong pick shows the total in characters. No coins are lost for a
   wrong pick. Totals over 99 skip this step and show the price.
   Write `sayNumber(n)` (1–99 in characters: 两 only when n is 2; 十, 十一 … 十九, 二十, 二十二 …)
   with a unit test; it builds the text of the total clips.
4. **Lines**, in `src/content/market.json`, clip ids `market-<key>`:

   | key | zh | pinyin | en |
   | --- | --- | --- | --- |
   | greet | 你好！要点什么？ | Nǐ hǎo! Yào diǎn shénme? | Hello! What would you like? |
   | ok | 好的，马上来！ | Hǎo de, mǎshàng lái! | OK, coming right up! |
   | again | 不好意思，没听清楚，请再说一遍。 | Bù hǎoyìsi, méi tīng qīngchu, qǐng zài shuō yí biàn. | Sorry, I didn't catch that. Please say it again. |
   | measureHint | 量词不对，再试一次吧。 | Liàngcí bú duì, zài shì yí cì ba. | That measure word isn't right. Try again. |
   | wrongPay | 不对哦，再听一遍。 | Bú duì o, zài tīng yí biàn. | Not quite. Listen again. |
   | paid | 谢谢！慢走！ | Xièxie! Màn zǒu! | Thanks! Take care! |
   | praise | 说得真好！ | Shuō de zhēn hǎo! | You said that really well! |
   | total-N | 一共N块。 (N in characters, e.g. 一共十四块。) | Yígòng N kuài. | That's N kuai altogether. |

   UI labels (no clips): 点餐 order · 说出来 say it · 拼句子 build it · 付钱 pay · 再听一遍 listen
   again · 我要 I want · 一 · 两 · 三.
   Daily errand: id `order`, zh 用中文点一次餐, pinyin Yòng Zhōngwén diǎn yí cì cān, en Order a meal in
   Chinese, done when ordered ≥ 1, coins 10.
5. **Tests.** Unit: `sayNumber`, order matching (digits, 两 vs 二, wrong measure), the bonus paid
   once. Browser: at the wonton stall build 我要两碗馄饨, hear `market-total-*` requested, pay the
   right amount, and own two 馄饨.

**Owns:** `src/ui/shop.js`, `src/ui/money.js`, a new `src/ui/order.js`, `src/content/market.json`,
the food rows of `catalog.json`, and the order wiring in `src/main.js`.

---

## Task E-review — confusable words, and where you met each word

1. **Misses.** A wrong review answer adds one to `learning.misses[zh]`.
2. **Confusables deck 易混词.** `src/content/confusables.json` holds the groups below. A new
   practice mode shows groups where the player has met at least one member, most-missed first.
   `look` groups ask 哪个字是这个意思？ with the meaning shown; `sound` groups play one member and ask
   听一听，是哪个字？. Members that are HSK words reuse their HSK clips and pay through the normal
   review path; the rest pay nothing.

   Look-alike groups (`kind: "look"`):
   买 mǎi buy / 卖 mài sell · 大 dà big / 太 tài too · 人 rén person / 入 rù enter / 八 bā eight ·
   天 tiān sky, day / 夫 fū man, husband · 午 wǔ noon / 牛 niú cow · 已 yǐ already / 己 jǐ oneself ·
   问 wèn ask / 间 jiān room, between · 木 mù wood / 本 běn root; measure word for books ·
   千 qiān thousand / 干 gān dry · 找 zhǎo look for / 我 wǒ I, me · 休 xiū rest / 体 tǐ body ·
   刀 dāo knife / 力 lì strength · 目 mù eye / 自 zì self · 土 tǔ earth / 士 shì scholar ·
   未 wèi not yet / 末 mò end · 贝 bèi shell / 见 jiàn see ·
   晴 qíng sunny / 睛 jīng eye / 请 qǐng please / 情 qíng feeling / 清 qīng clear ·
   左 zuǒ left / 右 yòu right · 住 zhù live / 往 wǎng towards · 儿 ér child / 几 jǐ how many / 九 jiǔ nine

   Sound-alike groups (`kind: "sound"`):
   买 mǎi buy / 卖 mài sell · 四 sì four / 十 shí ten · 汤 tāng soup / 糖 táng sugar, sweets ·
   水饺 shuǐjiǎo boiled dumplings / 睡觉 shuìjiào sleep · 书 shū book / 树 shù tree ·
   在 zài at / 再 zài again · 做 zuò do, make / 坐 zuò sit / 作 zuò do, work ·
   他 tā he / 她 tā she / 它 tā it · 哪 nǎ which / 那 nà that · 几 jǐ how many / 鸡 jī chicken ·
   包 bāo bag, bun / 饱 bǎo full / 报 bào newspaper · 进 jìn enter / 近 jìn near

3. **Where you met it.** The first time a word, object or phrase enters the word bank or is named
   (F on an object or sign, saving from dialogue or lookup), record
   `learning.sources[zh] = {place, x, z, line?}` (`place` is `town`, a room id or `city`). Review
   cards show 在「X」见过, where X is the district name at that spot, the room's zh, or 云海市中心.
   A 去找找 button closes the review and puts the buy guide's map pin on that spot (a room's pin sits
   on its door in town).
4. **Lines** in `src/content/confusables.json` (clip ids `conf-<key>`): prompt `look`
   哪个字是这个意思？ Nǎge zì shì zhège yìsi? Which character has this meaning? · prompt `sound`
   听一听，是哪个字？ Tīng yi tīng, shì nǎge zì? Listen: which character is it? Members not in the HSK
   list get clips `conf-<member pinyin, ascii>`.
   UI labels: 易混词 easily confused words · 在「X」见过 seen at X · 去找找 go and find it.
5. **Tests.** Unit: misses counted once per wrong answer, deck order, source recorded only the first
   time. Browser: name the kitchen sink, open review, see 在「厨房」见过, press 去找找, and the map
   pin appears.

**Owns:** `src/core/review.js`, `src/ui/practice.js`, `src/content/confusables.json`, the `sources`
and `misses` lines of `src/core/learning.js`, and the collect and save paths in `src/main.js`.

---

## Task C-collection — the collection book 图鉴 and component hunts

1. **图鉴.** A panel reached from the menu, one tab per area: 青禾广场, 商业街, 河边文化街, 莲池公园,
   云海市中心 and 室内 (rooms, grouped by room zh). Each lists every nameable object id present in
   that area, read from the live registry (boxes and look boxes by place and position), not a
   second hand-written list. Found objects (in `profile.discovered`) show zh, pinyin and en per the
   help settings and play their clip; unfound ones show ？？. Counts per tab and in total. Signs and
   people are left out.
2. **Component hunts 找部首.** A second tab. `src/content/radicals.json` holds the hunts below; a
   hunt's targets are the objects whose zh contains any of its characters, computed at run time.
   Report the computed target list for each hunt, and drop hunts with fewer than three targets.
   Completing a hunt pays `huntCoins` (new in `balance.json`: 5), once.

   | mark | title | en | characters |
   | --- | --- | --- | --- |
   | 氵 | 带“氵”的字 | water | 河湖海池洗汤油沙泳酒汁游渴澡浴温清满没汉江注法活深浅港泡淡流漂演源济 |
   | 木 | 带“木”的字 | wood, tree | 木树林森桌椅床柜架板桥楼梯杯枕松桃桶机果相箱植标样格棵模 |
   | 艹 | 带“艹”的字 | grass, plants | 花草茶菜药荷莲苹萝蒜葱蕉芽蔬薯葡萄莓菠落蓝英苦节 |
   | 火 | 带“火”或“灬”的字 | fire | 火灯烤炒炸烟烧炉煎热煮点照蒸熟燃 |
   | 钅 | 带“钅”的字 | metal | 钱钟锅银铁钢镜钥锁铃针钉链铺错 |
   | 饣 | 带“饣”的字 | food | 饭饺馆饼饿饱饮馄饨馒馅 |
   | ⺮ | 带“⺮”的字 | bamboo | 笔笑等第篮筷箱算答简管筒笼签篇 |
   | 石 | 带“石”的字 | stone | 石碗砖碟码砂破硬碎础研磨 |
   | 土 | 带“土”的字 | earth | 土地场城块坐墙塔坡堆垃圾坛在 |
   | 口 | 带“口”的字 | mouth | 口吃喝叫唱吗呢吧听味咖啡嘴员品器号只句可哈喂啊哪哭 |

   Daily errand: id `hunt`, zh 认出一样带部首的东西, pinyin Rènchū yí yàng dài bùshǒu de dōngxi, en
   Name something with a hunt's component, done when hunt-found ≥ 1, coins 8. Bump `hunt-found`
   when a newly discovered object belongs to any hunt.
   UI labels (no clips): 图鉴 collection · 找部首 component hunts · 已找到 found · 室内 indoors.
3. **Tests.** Unit: hunt target computation and the once-only reward. Browser: open 图鉴, the square
   tab counts at least one found object after naming the fountain, and the hunt tab lists 氵.

**Owns:** new `src/ui/collection.js`, `src/content/radicals.json`, one menu entry
(`src/ui/menu.js` or `src/ui/panels.js`, whichever holds the menu), the `hunt` errand in
`src/core/daily.js`, and one line in `src/main.js`.

---

## Task L-levels — placement test, mock exams and certificates

1. **Placement 水平测试**, from the word hall lectern panel (`src/ui/hsk.js`). Adaptive from HSK 1
   upwards: eight words of the level from `public/hsk/words.json`, meaning multiple choice (four
   options from the same level) plus 我不知道. Six right passes the level; stop at the first level
   failed. Result: 你的水平：HSK N 级, or 刚开始 when no level passed. Words answered right enter the
   review schedule as already known (a later due date than a new card), pay no coins, and count
   for district gates like any right answer. Store `learning.levels.placement` `{level, day}`.
   Retake at most once per game day.
2. **Mock exam 模拟考试**, per level: 20 questions from that level, ten on meaning (four options)
   and ten on listening (hear the word's clip, pick among four). Pass with 16. The result shows
   得分 and the words missed. The first pass of a level records `learning.levels.passed[level]` and
   gives that level's certificate.
3. **Certificates.** Catalog items `hsk-cert-1` … `hsk-cert-6`: zh HSK一级证书, HSK二级证书,
   HSK三级证书, HSK四级证书, HSK五级证书, HSK六级证书; pinyin HSK yī jí zhèngshū, HSK èr jí zhèngshū,
   HSK sān jí zhèngshū, HSK sì jí zhèngshū, HSK wǔ jí zhèngshū, HSK liù jí zhèngshū; en HSK 1
   certificate … HSK 6 certificate. Not sold anywhere. They hang on a wall at home by reusing the
   existing wall-decoration kind (the scroll or picture kind), with an item drawing of a framed
   certificate with a red seal (`src/ui/item-drawings.js`).
4. **Lines** in `src/content/levels.json` (clip ids `level-<key>`): ask 这个词是什么意思？ Zhège cí
   shì shénme yìsi? What does this word mean? · listen 听一听，是哪个词？ Tīng yi tīng, shì nǎge cí?
   Listen: which word is it? · pass 通过了！ Tōngguò le! Passed! · fail 还差一点，再努力！ Hái chà
   yìdiǎn, zài nǔlì! Almost there. Keep at it!
   UI labels: 水平测试 level test · 模拟考试 mock exam · 我不知道 I don't know · 得分 score · 证书
   certificate · 你的水平 your level · 刚开始 just starting.
5. **Tests.** Unit: placement stops at the first failed level, no coins, known words scheduled
   later; the certificate is given once. Browser: take the HSK 1 mock exam answering right and own
   `hsk-cert-1`.

**Owns:** `src/ui/hsk.js`, new `src/ui/levels.js` and `src/core/levels.js`,
`src/content/levels.json`, the certificate rows of `catalog.json`, `src/ui/item-drawings.js`, and
the `levels` lines of `src/core/learning.js`.

---

## Task T-touch — play on a phone or tablet

On a touch screen (`matchMedia('(pointer: coarse)')`, or the first `touchstart`): a joystick on the
left moves, dragging on the right half looks, and buttons give 跳 (jump), the interact button
(mirroring `#interact`'s text, so it says what E would do) and 记住 (F) whenever the nameplate
shows. Whatever opens the menu and map stays tappable. No pointer lock on touch. The desktop
controls must not change. Add `<meta name="viewport" content="width=device-width, initial-scale=1">`
if `index.html` lacks one.
Tests: a Playwright spec with `hasTouch` and a 390×844 viewport — dragging the joystick moves
`#map-player`, tapping 跳 raises `data-y`, and tapping the interact button at the front door takes
you home.
**Owns:** new `src/ui/touch.js`, the input lines of `src/world/town.js` `update()` and of
`src/main.js`, `index.html`, and its own styles.

---

## Task Q-voice — voice clips worth a human listen

`npm run audit:voice` (`scripts/audit-voice.js`) reads `public/audio/manifest.json` and the
content's authored pinyin and writes `docs/VOICE_REVIEW.md`: first the clips whose text holds a
character with several readings where the authored pinyin uses a less common reading, then
single-character clips, then 一 and 不 words (tone changes), each as a table of id, text, authored
pinyin and reason, highest risk first; then how to regenerate one clip. Link it from
`docs/VOICE_PRODUCTION.md`. Flag by simple rules (a less common reading's syllable appears in the
pinyin of a text holding that character); no syllable alignment needed.
Readings, most common first: 行 xíng/háng · 长 cháng/zhǎng · 了 le/liǎo · 得 de/dé/děi ·
还 hái/huán · 为 wèi/wéi · 都 dōu/dū · 重 zhòng/chóng · 地 de/dì · 的 de/dí/dì · 着 zhe/zháo/zhuó ·
好 hǎo/hào · 看 kàn/kān · 中 zhōng/zhòng · 只 zhǐ/zhī · 乐 lè/yuè · 觉 jué/jiào · 教 jiāo/jiào ·
数 shù/shǔ · 发 fā/fà · 分 fēn/fèn · 便 biàn/pián · 当 dāng/dàng · 相 xiāng/xiàng · 少 shǎo/shào ·
种 zhǒng/zhòng · 转 zhuǎn/zhuàn · 调 tiáo/diào · 传 chuán/zhuàn · 空 kōng/kòng · 差 chà/chā/chāi ·
和 hé/huo/hè/huó/huò · 假 jiǎ/jià · 间 jiān/jiàn · 结 jié/jiē · 角 jiǎo/jué · 难 nán/nàn ·
量 liàng/liáng · 没 méi/mò · 薄 báo/bó · 朝 cháo/zhāo · 处 chù/chǔ · 倒 dǎo/dào · 干 gān/gàn ·
更 gèng/gēng · 给 gěi/jǐ · 将 jiāng/jiàng · 卡 kǎ/qiǎ · 省 shěng/xǐng · 应 yīng/yìng · 系 xì/jì ·
要 yào/yāo · 背 bèi/bēi · 场 chǎng/cháng · 把 bǎ/bà · 冲 chōng/chòng · 弹 tán/dàn · 露 lù/lòu ·
模 mó/mú · 盛 shèng/chéng · 藏 cáng/zàng · 降 jiàng/xiáng · 称 chēng/chèn · 参 cān/shēn ·
片 piàn/piān · 兴 xìng/xīng · 与 yǔ/yù.
Change no content and no clips. **Owns:** `scripts/audit-voice.js`, `docs/VOICE_REVIEW.md`, one
`package.json` script line, one line in `docs/VOICE_PRODUCTION.md`.

## What shipped (2026-09-24)

- M-market: measure words (and `alsoOk` alternatives) on every food; the 点餐 builder and spoken orders at the
  snack stalls and 家常餐厅; totals heard as 一共N块 and paid by ear; bonus at most once a day per kind; the
  `liang` line for 二 before a measure word.
- E-review: misses per word, the 易混词 deck (homophone groups show the meaning), 在「X」见过 with 去找找.
- C-collection: 图鉴 tabs from the live registry and ten 找部首 hunts (people never count).
- L-levels: adaptive 水平测试, per-level 模拟考试 (homophones never distractors), HSK certificates.
- T-touch: joystick, look drag, 跳/记住, and 转/取消 while placing furniture.
- Q-voice: `npm run audit:voice` → `docs/VOICE_REVIEW.md`; six single-character clips are spoken through a
  same-syllable stand-in (`STAND_INS` in `generate-voice.py`); 卡 qiǎ still needs a human recording.
