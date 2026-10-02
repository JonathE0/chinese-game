# 青禾田园 — the river and farmland outside the park gate

Date: 2026-10-01. Player: "maybe we can add a river and some farming land with some quests there as
well, I just want to make this feel a little bit more authentic". Chosen activities: fishing (钓鱼)
and picking vegetables (摘菜). Both quests are required for the metro unlock (they join
`unlock.json` `townQuests`). Townsfolk wear the village look from
`docs/references/wave4/character-village-lineup.webp`.

## Place
The road out of the park's town gate (the player spawns just inside it) leads south to the
countryside: a slow river (青禾河) with willows on its banks, a wooden pier with a moored boat or two,
rice paddies (scenery: flooded plots with rows of green shoots), a vegetable plot (菜地) with rows of
crops, a small farmhouse (农舍) with chickens pecking about, a water wheel, a scarecrow and a
haystack, joined by dirt and stone paths. Same painterly Jiangnan finish as the town
(`2026-10-01-jiangnan-look-design.md`), built with the shared kit and W5-nature's water, paving and
plant builders. A wooden sign where the road meets the fields: 青禾田园 (Qīnghé Tiányuán, Qinghe
Countryside). Boundaries keep players on land; the river is not swimmable.

## People
- 王爷爷 (Wáng yéye, Grandpa Wang): the fisherman on the pier, village elderly-man look (straw hat,
  basket).
- 刘奶奶 (Liú nǎinai, Grandma Liu): the farmer at the vegetable plot, village elderly-woman look
  (headscarf, apron, bamboo tray).
Check npcs.json for clashes before adding them.

## Quest 1: 跟王爷爷学钓鱼 · Learn to fish from Grandpa Wang
Quest card: zh 跟王爷爷学钓鱼, pinyin Gēn Wáng yéye xué diàoyú, en "Learn to fish from Grandpa Wang on
the river past the park gate." Done flag `fish:first` (first fish caught and shown to him).

Lesson `fishing-wang` (voiced, Grandpa Wang):
| node | he says | prompt | accepted (model first) |
|---|---|---|---|
| ask | 年轻人，你也喜欢钓鱼吗？ Niánqīngrén, nǐ yě xǐhuan diàoyú ma? (Young one, do you like fishing too?) | 说你想学钓鱼。 Shuō nǐ xiǎng xué diàoyú. (Say you'd like to learn to fish.) | 我想学钓鱼 · 我要学钓鱼 · 我想学 · 我喜欢钓鱼 · 请教我钓鱼 · 你可以教我吗 · 王爷爷，我想学钓鱼 |
| rod | 好啊！这是鱼竿。把鱼钩放到水里，等鱼上钩。 Hǎo a! Zhè shì yúgān. Bǎ yúgōu fàng dào shuǐ lǐ, děng yú shàng gōu. (Sure! Here's a rod. Put the hook in the water and wait for a bite.) | 说谢谢。 Shuō xièxie. (Say thank you.) | 谢谢王爷爷 · 谢谢 · 谢谢您 · 好的谢谢 |

Then the fishing mini-game (see below). Lesson `fishing-wang-show` (voiced), after the first catch:
| node | he says | prompt | accepted (model first) |
|---|---|---|---|
| see | 钓到了吗？给我看看。 Diàodào le ma? Gěi wǒ kànkan. (Did you catch one? Let me see.) | 说你钓到了一条鱼。 Shuō nǐ diàodào le yì tiáo yú. (Say you caught a fish.) | 我钓到了一条鱼 · 我钓到鱼了 · 钓到了一条鱼 · 我钓到了 · 钓到了 |
| carp | 不错！这是一条鲤鱼。今天晚上可以做红烧鱼。 Búcuò! Zhè shì yì tiáo lǐyú. Jīntiān wǎnshang kěyǐ zuò hóngshāo yú. (Not bad! That's a carp. You could make braised fish tonight.) | 说谢谢。 | 谢谢王爷爷 · 谢谢 · 谢谢您 · 太好了谢谢 |

The quest's first catch is always a 鲤鱼 so the voiced line is true; later catches are random among
鲤鱼 lǐyú (carp), 鲫鱼 jìyú (crucian carp) and 草鱼 cǎoyú (grass carp), kept in the bag (they can be
sold where food is bought).

Mini-game (works with mouse, trackpad, keyboard and touch): at the pier, interact to cast; a float
bobs on the water; after a short random wait it dips: 鱼上钩了！ (Yú shàng gōu le! A bite!) appears and
the player has a short window to reel in (click, Space, Enter or tap). Success: 钓到了！ (Diàodào le!
Got one!) and the fish's name with pinyin and English; too slow or too early: 鱼跑了。 (Yú pǎo le. It
got away.) These three are short on-screen notices, not voiced.

## Quest 2: 帮刘奶奶摘菜 · Help Grandma Liu pick vegetables
Quest card: zh 帮刘奶奶摘菜, pinyin Bāng Liú nǎinai zhāi cài, en "Help Grandma Liu pick vegetables in
her plot by the river." Done flag `veg:first`.

Lesson `veggies-liu` (voiced, Grandma Liu):
| node | she says | prompt | accepted (model first) |
|---|---|---|---|
| help | 你好！你能帮我摘菜吗？ Nǐ hǎo! Nǐ néng bāng wǒ zhāi cài ma? (Hello! Could you help me pick vegetables?) | 说可以。 Shuō kěyǐ. (Say you can.) | 没问题 · 可以 · 好的 · 好啊 · 当然可以 · 可以啊 |
| order | 请帮我摘三个西红柿和两根黄瓜。 Qǐng bāng wǒ zhāi sān ge xīhóngshì hé liǎng gēn huángguā. (Please pick me three tomatoes and two cucumbers.) | 再说一遍她要什么。 Zài shuō yí biàn tā yào shénme. (Repeat what she wants.) | 三个西红柿和两根黄瓜 · 三个西红柿，两根黄瓜 · 三个西红柿两根黄瓜 · 西红柿三个，黄瓜两根 |

Feedback on `order`: "个 and 根 are measure words: 根 is for long thin things like cucumbers and
carrots. 西红柿 is also called 番茄."

Picking: the plot has rows of 西红柿 (xīhóngshì, tomato), 黄瓜 (huángguā, cucumber), 白菜 (báicài,
Chinese cabbage), 胡萝卜 (húluóbo, carrot), 茄子 (qiézi, aubergine) and 葱 (cōng, spring onion). Looking
at a plant shows its name; interacting picks one into a basket shown on screen with counts. Talking
to her again runs lesson `veggies-liu-check`:
| node | she says | prompt | accepted (model first) |
|---|---|---|---|
| done | 摘好了吗？ Zhāihǎo le ma? (All picked?) | 说摘好了。 Shuō zhāihǎo le. (Say you're done.) | 摘好了，给您 · 摘好了 · 好了 · 我摘好了 |
| thanks | 太好了！这些菜送给你，回家做饭吧。 Tài hǎo le! Zhèxiē cài sòng gěi nǐ, huí jiā zuò fàn ba. (Wonderful! These are for you, go home and cook.) | 说谢谢。 | 谢谢刘奶奶 · 谢谢 · 谢谢您 · 太谢谢了 |

If the basket is wrong she says (voiced) 不对哦，我要三个西红柿和两根黄瓜。 Bú duì o, wǒ yào sān ge
xīhóngshì hé liǎng gēn huángguā. (Not quite, I want three tomatoes and two cucumbers.) and the player
can keep picking or put extras back. The reward: coins plus the vegetables as cooking ingredients
(use the catalog's existing tomato item if there is one).

## Look names (objects.json; HSK levels only from public/hsk/words.json)
鱼竿 yúgān fishing rod · 鱼钩 yúgōu hook · 渔网 yúwǎng fishing net · 小船 xiǎochuán boat · 码头 mǎtou
pier · 河 hé river · 稻田 dàotián rice paddy · 菜地 càidì vegetable plot · the six vegetables above ·
鸡 jī chicken · 农舍 nóngshè farmhouse · 水车 shuǐchē water wheel · 稻草人 dàocǎorén scarecrow · 草垛
cǎoduò haystack · 柳树 liǔshù willow · 斗笠 dǒulì conical straw hat · 篮子 lánzi basket.
