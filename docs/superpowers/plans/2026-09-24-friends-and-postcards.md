# Friends and postcards (2026-09-24)

From the brainstorm the player asked to build: the three townspeople warm up to you as you spend
time with them, tell you about themselves as they do, and you can write them postcards. It gives a
reason to come back and keeps recycling everyday social Chinese.

The townspeople are 林阿姨 (`lin`, the tea stall, −9,−2), 小美 (`mei`, the practice corner,
−2.9,−6.4) and 陈叔叔 (`chen`, the small shop, 9,−2); each has a voice (`lin`, `mei`, `chen`).

## Task F-friends (model: opus)

### Friendship

- Levels by points: 认识 rènshi (0), 熟人 shúrén (10), 朋友 péngyou (25), 好朋友 hǎo péngyou (50).
  The level word shows under the NPC's name in their dialogue panel.
- Points, each at most once per NPC per game day: the first finished chat (+2), a gift (+3, or +5
  for a liked one), a postcard delivered (+4). Finishing a mission for them: +5, once per mission.
- Reaching 熟人, 朋友 and 好朋友 unlocks that level's lines, played the next time you talk (once).
  好朋友 also gives a present: 林阿姨 a tea set, 小美 a notebook (the catalog has no book), 陈叔叔 10% off at his shop from then
  on. Use existing catalog items for the tea set and the book (report which); the discount goes
  through the shop's existing price code.
- Gifts: a 送礼物 option in the NPC's dialogue lists food and small items you carry; giving one
  removes it from the inventory.
  Liked gifts — lin: pot-tea, red-bean-bun, egg-tart, tofu-pudding · mei: strawberry-donut,
  candied-hawthorn, cake, coffee · chen: lamb-skewer, jianbing, youtiao, soy-milk.
- Save under `profile.learning.friends`: `{<npc id>: {points, day, gift, post, seen: [unlock ids],
  missions: [ids]}}` with its normaliser lines in `src/core/learning.js` and tests.

### Postcards

- Press E at any 邮筒 (postbox; the square has them) to write a postcard: 写明信片. Writing one uses
  a `postcard` from your bag — the existing catalog item sold at 小小商店; with none, the panel says
  so and offers the buy guide's way there. Build it from tiles, one choice per line:
  1. To: 林阿姨，你好！ / 小美，你好！ / 陈叔叔，你好！
  2. 我今天去了{place}。 — place: 莲池公园 / 商业街 / 河边文化街 / 云海市中心 / 词语馆, offering only
     places the player has been to.
  3. 我吃了{food}。 or 我学了新词。 or 我买了{item}。 — food and item from things the player has
     bought.
  4. 我很开心！ / 有点儿累，但是很好玩。 / 希望你也来！
  5. 祝你天天开心！ / 下次见！
  Then the player's name. 寄出 sends it. The card shows the finished text in characters, with
  pinyin and English per the help settings.
- The next game day, talking to that person plays their reply line once, and adds the friendship
  points. At most one postcard per person per day. 陈叔叔 pins yours up: the last postcard sent to
  him hangs on his shop's wall (a small flat card on the shop front, named 明信片).
- Save under `profile.learning.postcards`: up to 50 `{to, day, lines: [tile ids], replied}`.

### Lines (voiced with that person's voice; clip ids `friend-<npc>-<key>`)

| npc | key | zh | pinyin | en |
| --- | --- | --- | --- | --- |
| lin | shuren-1 | 我在青禾住了三十年了。 | Wǒ zài Qīnghé zhù le sānshí nián le. | I've lived in Qinghe for thirty years. |
| lin | shuren-2 | 年轻的时候，我在云海开过一家小茶馆。 | Niánqīng de shíhou, wǒ zài Yúnhǎi kāi guo yì jiā xiǎo cháguǎn. | When I was young, I ran a little teahouse in Yunhai. |
| lin | pengyou-1 | 你的中文越来越好了！ | Nǐ de Zhōngwén yuè lái yuè hǎo le! | Your Chinese keeps getting better! |
| lin | pengyou-2 | 有空常来喝茶，我请客。 | Yǒu kòng cháng lái hē chá, wǒ qǐngkè. | Come by for tea whenever you're free. It's on me. |
| lin | hao-1 | 这套茶具送给你，回家也能泡茶。 | Zhè tào chájù sòng gěi nǐ, huí jiā yě néng pào chá. | This tea set is for you, so you can make tea at home too. |
| mei | shuren-1 | 我在大学学英语，所以常来练习角。 | Wǒ zài dàxué xué Yīngyǔ, suǒyǐ cháng lái liànxí jiǎo. | I study English at university, so I often come to the practice corner. |
| mei | shuren-2 | 我们可以互相学习！ | Wǒmen kěyǐ hùxiāng xuéxí! | We can learn from each other! |
| mei | pengyou-1 | 我最喜欢去莲池公园看书。 | Wǒ zuì xǐhuan qù Liánchí Gōngyuán kàn shū. | My favourite thing is reading in Lotus Pond Park. |
| mei | pengyou-2 | 下次我们一起去吧！ | Xià cì wǒmen yìqǐ qù ba! | Let's go together next time! |
| mei | hao-1 | 这个本子送给你，学中文的时候用吧！ | Zhège běnzi sòng gěi nǐ, xué Zhōngwén de shíhou yòng ba! | This notebook is for you. Use it when you study Chinese! |
| chen | shuren-1 | 这家小商店是我爸爸开的。 | Zhè jiā xiǎo shāngdiàn shì wǒ bàba kāi de. | My dad opened this little shop. |
| chen | shuren-2 | 我每天早上六点就开门了。 | Wǒ měitiān zǎoshang liù diǎn jiù kāi mén le. | I open up at six every morning. |
| chen | pengyou-1 | 你是我们这儿的老顾客了！ | Nǐ shì wǒmen zhèr de lǎo gùkè le! | You're one of our regulars now! |
| chen | pengyou-2 | 有什么需要，跟我说一声。 | Yǒu shénme xūyào, gēn wǒ shuō yì shēng. | If you need anything, just let me know. |
| chen | hao-1 | 以后你来买东西，我给你打九折！ | Yǐhòu nǐ lái mǎi dōngxi, wǒ gěi nǐ dǎ jiǔ zhé! | From now on you get 10% off here! |
| each | gift-liked | 哇，我最喜欢这个了！谢谢你！ | Wā, wǒ zuì xǐhuan zhège le! Xièxie nǐ! | Wow, this is my favourite! Thank you! |
| each | gift-plain | 谢谢你，你太客气了。 | Xièxie nǐ, nǐ tài kèqi le. | Thank you, that's very kind of you. |
| each | gift-again | 今天已经收过你的礼物啦，明天再说吧！ | Jīntiān yǐjīng shōu guo nǐ de lǐwù la, míngtiān zài shuō ba! | You've already given me something today. Let's leave it till tomorrow! |
| lin | post-reply | 收到你的明信片了，写得真好！ | Shōudào nǐ de míngxìnpiàn le, xiě de zhēn hǎo! | I got your postcard. It's beautifully written! |
| mei | post-reply | 谢谢你的明信片！我也想去看看！ | Xièxie nǐ de míngxìnpiàn! Wǒ yě xiǎng qù kànkan! | Thanks for your postcard! I want to go and see too! |
| chen | post-reply | 你的明信片我贴在店里了！ | Nǐ de míngxìnpiàn wǒ tiē zài diàn lǐ le! | I've put your postcard up in the shop! |

Postcard tiles (text only, no clips; the player writes them): the lines in the Postcards section,
with pinyin — 林阿姨，你好！ Lín āyí, nǐ hǎo! · 小美，你好！ Xiǎoměi, nǐ hǎo! · 陈叔叔，你好！ Chén
shūshu, nǐ hǎo! · 我今天去了… Wǒ jīntiān qù le … · 我吃了… Wǒ chī le … · 我学了新词。 Wǒ xué le xīn
cí. · 我买了… Wǒ mǎi le … · 我很开心！ Wǒ hěn kāixīn! · 有点儿累，但是很好玩。 Yǒudiǎnr lèi, dànshì
hěn hǎowán. · 希望你也来！ Xīwàng nǐ yě lái! · 祝你天天开心！ Zhù nǐ tiāntiān kāixīn! · 下次见！
Xià cì jiàn!
UI labels: 送礼物 give a gift · 写明信片 write a postcard · 寄出 send · 明信片 postcard · 认识 · 熟人 ·
朋友 · 好朋友. Object name: `postcard` 明信片 míngxìnpiàn, postcard.

### Tests
Unit: points once per day per source, level thresholds, unlocks played once, the 九折 price, the
postcard reply the next day only. Browser: give 林阿姨 a pot of tea and see 哇，我最喜欢这个了！,
write and send a postcard at a 邮筒 and get the reply after a day passes.

**Owns:** new `src/core/friends.js`, new `src/ui/postcard.js`, `src/content/friends.json`, the NPC
dialogue panel code (`src/ui/dialogue.js` / `src/ui/social.js`, whichever shows NPC chats), the
`friends` and `postcards` lines of `src/core/learning.js`, one `objects.json` key (`postcard`, for the card on 陈叔叔's wall; check `public/hsk/words.json`
for 明信片's level). Follow the
shared-file, voice and checks rules of `2026-09-24-learning-features.md`.

## What shipped (2026-09-24)

- Friendship levels, gifts, per-level lines and presents (林阿姨 a tea set, 小美 a notebook — her line became
  这个本子送给你，学中文的时候用吧！ because the catalog has no book — 陈叔叔 九折); each line and present
  counts only once it has been shown.
- Postcards at any 邮筒 using the existing `postcard` item; places are offered only once visited
  (`learning.visited`); 陈叔叔 keeps your card pinned by a flag on his record. Postboxes stand at building
  corners, clear of counters.
