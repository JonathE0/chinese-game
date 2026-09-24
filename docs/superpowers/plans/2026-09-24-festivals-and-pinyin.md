# Festivals, and pinyin that fades as you learn (2026-09-24)

Wave 3 of the brainstorm the player asked to build. Two tasks; they touch different files. The
shared-file, voice and checks rules of `2026-09-24-learning-features.md` apply (no generator runs,
no builds during the wave, re-read before editing shared files, Chinese only from this plan).

---

## Task K-festivals — four festivals through the town's year (model: opus)

The town's calendar (`src/core/calendar.js`) counts days and 7-day weeks. The last day of each week
(`dayOfWeek === 6`) is a festival, cycling by week: week % 4 = 0 春节, 1 元宵节, 2 端午节, 3 中秋节.
A new player meets 春节 on day 6.

On a festival day:
- **Decorations** appear in the square (and the park where noted), and go away the next day. They
  are added at run time, so keep them out of the static batching (`batchStatics` skip set, or
  created after it) and tag every piece for the naming engine (`lookName`/`signText`).
  - 春节: red lanterns across the square, a 福 upside down on each shop door, a banner 新年快乐.
  - 元宵节: coloured lanterns (花灯) around the fountain; ten of them carry a riddle (below).
  - 端午节: a dragon boat circling the lotus pond in the park.
  - 中秋节: a bigger, brighter full moon at night and lanterns along the park paths.
- **A festival stall** in the square sells the festival food, through the order builder from
  Task M-market: 春节 饺子 (existing `dumplings`), 元宵节 汤圆, 端午节 粽子, 中秋节 月饼.
- **Greetings.** Each townsperson (林阿姨, 小美, 陈叔叔) greets you with the festival's greeting in
  their own voice. You answer by picking the right greeting from all four; right answers get
  their reply. On 春节 the reply comes with a 红包 of 8 coins, once per person per festival.
- **A noticeboard line** by the fountain says what the festival is (teacher voice).
- **A festival errand** joins that day's errands in `src/core/daily.js`.
- **Lantern riddles** (元宵节): look at a riddle lantern and press E to guess — the riddle, then
  打一字 (dǎ yí zì, "guess the character"), with four characters to choose from. A right answer
  pays 1 coin, once per riddle per festival.

### Lines (clip ids `fest-<key>`; greetings and replies once per townsperson voice)

| key | zh | pinyin | en |
| --- | --- | --- | --- |
| hi-chunjie | 新年快乐！ | Xīnnián kuàilè! | Happy New Year! |
| hi-yuanxiao | 元宵节快乐！ | Yuánxiāojié kuàilè! | Happy Lantern Festival! |
| hi-duanwu | 端午节快乐！ | Duānwǔjié kuàilè! | Happy Dragon Boat Festival! |
| hi-zhongqiu | 中秋节快乐！ | Zhōngqiūjié kuàilè! | Happy Mid-Autumn Festival! |
| reply-chunjie | 恭喜发财！这是给你的红包。 | Gōngxǐ fācái! Zhè shì gěi nǐ de hóngbāo. | Wishing you prosperity! Here's a red envelope for you. |
| reply | 谢谢！你也是！ | Xièxie! Nǐ yě shì! | Thanks! You too! |
| about-chunjie | 今天是春节，大家一起吃饺子、贴春联。 | Jīntiān shì Chūnjié, dàjiā yìqǐ chī jiǎozi, tiē chūnlián. | Today is Spring Festival: everyone eats dumplings and puts up spring couplets. |
| about-yuanxiao | 今天是元宵节，晚上可以看花灯、猜灯谜。 | Jīntiān shì Yuánxiāojié, wǎnshang kěyǐ kàn huādēng, cāi dēngmí. | Today is the Lantern Festival: in the evening you can see the lanterns and guess lantern riddles. |
| about-duanwu | 今天是端午节，大家吃粽子、看龙舟。 | Jīntiān shì Duānwǔjié, dàjiā chī zòngzi, kàn lóngzhōu. | Today is the Dragon Boat Festival: everyone eats zongzi and watches the dragon boats. |
| about-zhongqiu | 今天是中秋节，晚上一起吃月饼、看月亮。 | Jīntiān shì Zhōngqiūjié, wǎnshang yìqǐ chī yuèbǐng, kàn yuèliang. | Today is the Mid-Autumn Festival: in the evening we eat mooncakes and look at the moon. |

Riddles (teacher voice, clip ids `fest-riddle-<n>`; the answer is one character):

| n | riddle | pinyin | en | answer |
| --- | --- | --- | --- | --- |
| 1 | 两棵树 | Liǎng kē shù | Two trees | 林 |
| 2 | 三棵树 | Sān kē shù | Three trees | 森 |
| 3 | 两个人 | Liǎng ge rén | Two people | 从 |
| 4 | 三个人 | Sān ge rén | Three people | 众 |
| 5 | 太阳和月亮 | Tàiyáng hé yuèliang | The sun and the moon | 明 |
| 6 | 两个月亮 | Liǎng ge yuèliang | Two moons | 朋 |
| 7 | 女儿和儿子 | Nǚ'ér hé érzi | A daughter and a son | 好 |
| 8 | 一个人靠着一棵树 | Yí ge rén kàozhe yì kē shù | A person leaning on a tree | 休 |
| 9 | 一口咬掉牛尾巴 | Yì kǒu yǎo diào niú wěiba | One bite takes off the cow's tail | 告 |
| 10 | 一人在内 | Yì rén zài nèi | A person inside 内 | 肉 |

Wrong choices come from the other answers. After a right answer, show how the parts make the
character (e.g. 木 + 木 = 林) in the panel; that text needs no clip.

Festival errands (add to `src/core/daily.js` on festival days only):

| festival | id | zh | pinyin | en | done when | coins |
| --- | --- | --- | --- | --- | --- | --- |
| 春节 | bainian | 给三个人拜年 | Gěi sān ge rén bàinián | Wish three people a happy new year | greeted ≥ 3 | 12 |
| 元宵节 | dengmi | 猜对三个灯谜 | Cāi duì sān ge dēngmí | Guess three lantern riddles | riddles ≥ 3 | 12 |
| 端午节 | zongzi | 吃一个粽子 | Chī yí ge zòngzi | Eat a zongzi | ate-zongzi ≥ 1 | 10 |
| 中秋节 | shangyue | 晚上在公园看月亮 | Wǎnshang zài gōngyuán kàn yuèliang | Look at the moon in the park in the evening | moon ≥ 1 | 10 |

`moon` counts looking at the moon (it becomes nameable as 月亮 on 中秋节) from inside the park after
18:00.

New catalog items (festival stall only; measure words for the order builder):
`tangyuan` 汤圆 tāngyuán, sweet rice balls, 碗, 6 · `zongzi` 粽子 zòngzi, sticky rice dumpling,
个, 5 · `mooncake` 月饼 yuèbǐng, mooncake, 块, 8.
New object names (`objects.json`; `hsk` only from an exact entry in `public/hsk/words.json`):
春联 chūnlián spring couplets · 福字 fú zì the character 福 · 红包 hóngbāo red envelope · 花灯 huādēng
festive lantern · 灯谜 dēngmí lantern riddle · 龙舟 lóngzhōu dragon boat · 月亮 yuèliang moon.
New sign (`signs.json`): 新年快乐 xīnnián kuàilè, Happy New Year.
UI labels: 过节 festival · 猜灯谜 guess the riddle · 打一字 guess the character.

Save: festival claims (红包, riddles) go through `claimPeriod` in `src/core/calendar.js` with the
festival's day as the period, so nothing pays twice.
Tests: unit — which festival a day is, claims once; browser — warp the clock to day 6 and see the
春节 banner, greet 林阿姨 and receive the 红包 once; on day 13 answer a riddle.
**Owns:** new `src/core/festivals.js`, `src/world/festivals.js`, `src/content/festivals.json`, the
festival rows of `catalog.json` and `daily.js`, one hook each in `src/world/town.js` and
`src/main.js`.

---

## Task P-pinyin — pinyin that fades for words you know, and tone colours (model: opus)

- **Pinyin setting** becomes three-way: 总是显示 (zǒngshì xiǎnshì, always show) · 学会的就不显示
  (xuéhuì de jiù bù xiǎnshì, hide for words I know) · 不显示 (bù xiǎnshì, never show). The middle
  one is the new default for new saves; existing `true`/`false` settings keep meaning always/never.
  A word counts as known when review marks it `learned` (see `src/core/review.js`); a whole line
  of dialogue hides its pinyin when every Han character in it belongs to a known word.
- **Tone colours** 声调颜色 (shēngdiào yánsè), off by default: each pinyin syllable coloured by its
  tone — 1 #d64545, 2 #d9831f, 3 #2f9e5b, 4 #3b6fd8, neutral #8a8a8a — with the tone marks kept,
  so colour is never the only cue. Check contrast in every theme the UI has.
- Route every place that renders pinyin (about fourteen UI files: `grep -l pinyin src/ui/*.js`)
  through one small helper, rather than adding the rule fourteen times. Settings live where the
  current pinyin toggle is; extend the profile's settings sanitiser for the new value.
- Tests: unit for the helper (known-word hiding, a line with one unknown word keeps its pinyin,
  tone classes from marks), and browser: learn a word, and its nameplate stops showing pinyin in
  自动 mode.
**Owns:** the pinyin rendering lines of `src/ui/*.js`, one new helper file, the settings UI and
the settings sanitiser in `src/core/profile.js`.

## What shipped (2026-09-24)

- K: the last day of each week is 春节, 元宵节, 端午节 or 中秋节 in turn, with decorations built after batching,
  a festival stall on the order builder, greetings from all three townspeople (8-coin 红包 on 春节), lantern
  riddles with their character breakdowns, a moon on 中秋节 nights and a dragon boat on 端午节. Food
  descriptions and drawings for 汤圆, 粽子 and 月饼 were added by the main session.
- An accident during this task emptied `catalog.json`; it was rebuilt from the 03:16 build plus the later
  edits and verified item by item against that build — nothing was lost.
- P: pinyin setting 总是显示 / 学会的就不显示 / 不显示 (the middle one is the default) through one helper in
  `src/core/pinyin.js`; reference tools (lookup, definitions, word bank, drill hints) always show pinyin. Tone
  colours use a darker AA-contrast set on the panels and a lighter one on the metro ride board.
