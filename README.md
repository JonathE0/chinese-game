# 青禾小镇 · Little Mandarin Town

**[Play in your browser](https://mini-chinese-game.netlify.app)**

A local, playable browser game for learning Mandarin by living in a small Chinese city, seen through your own eyes. Walk the streets, look at things to learn their names, talk to people, shop, and furnish your own home. Built with the PlayCanvas standalone engine and modular JavaScript. No Unity or hosted editor account required.

## Start playing

Requires Node.js 22.12+ (developed on Node 24).

```sh
npm install
npm run dev -- --port 5174
```

Open http://127.0.0.1:5174 and click **开始旅行**.

| | |
| --- | --- |
| **WASD / arrows** | Walk, relative to where you are looking |
| **Mouse** | Look around — click the city once to grab the cursor, **Esc** to release it |
| **Space** | Jump (onto benches, planters, kerbs), or stand up from a seat |
| **Shift** | Run |
| **F** | Learn the name of whatever you are looking at |
| **E** | Talk, enter a door, use a counter, sit down, start decorating |
| **V** | Third person — outdoors and at home, where there is room to swing the camera |
| **H** | Hide or show the name that follows the crosshair |
| **Click / G** | Throw what you are holding / put it down gently |
| **1**–**5** | Journal, bag, word bank, condition, settings — disabled while you are typing |

On touch devices, drag the right of the screen to look and the lower left as a thumbstick to walk.

**The screen gets out of your way.** The mission card folds to its header, the crosshair label
hides on **H**, and the key hints switch between English, Chinese and both from the button at
their right end. English is the default there, because you need those hints before you can read
them; everywhere you are looking *at* the town, Chinese still comes first. All three choices are
saved. Tapping a mission draws a dashed line to it on the minimap, through the right gate if it
is in another district.

## Learning by living in it

**Everything has a Chinese name.** Point the crosshair at a tree, a bench, a bin, a shop sign, a window, a person — the label appears in Chinese. Press **F** and you hear it, see the pinyin and gloss, and it goes into your word bank. 87 objects are named, tagged with the HSK level their word belongs to. Your journal tracks how many you have found.

**A city, not a set.** Three districts joined by gated streets: 青禾广场 (the square), 商业街 (the shopping street), and 河边文化街 (the riverside quarter). 15 buildings, 88 pieces of street furniture, 12 townsfolk going about their day, plus terraces, gravel paths and a pond. 7 buildings can be entered, each fitted out for its trade.

**Progression is deliberately slow.** A district's gate stays shut until you have actually learned enough of the level below it — 25 HSK 1 words for the shopping street, 30 HSK 2 words for the riverside. Drilling in the word hall counts; so does walking around pressing F. The gate tells you exactly how many you still need. The point is to keep you in one level's vocabulary long enough for it to stick.

**词语馆, the word hall.** 5,363 HSK words across levels 1–6, searchable, with recognition and listening drills on a spaced-review schedule. Every word in levels 1–3 is spoken, and the drill plays it as the card appears.

**Highlight anything.** Select up to 500 characters of Chinese across dialogue, signs, or nested UI text. Known authored sentences and contiguous library passages show their meaning first, with an expandable dictionary breakdown for saving individual words. Unknown selections explicitly say that a sentence translation is unavailable; no online translation provider is configured.

**Seven shops, two of them open from the first minute.** 家居小铺 on the square sells beds, tables,
rugs and shoes, so you can furnish your room before any district opens; 陈叔叔's souvenir stall by
the fountain is the only one that haggles. In the shopping street, 生活馆 (a MUJI-ish lifestyle
store) sells furniture, stationery and clothes, 慢慢咖啡 sells coffee and cake, 青禾超市 groceries,
青禾灯具 lighting. 家常餐厅 in the riverside quarter serves dinner. Clothes go into hat, shirt,
trouser and shoe slots and change how you look.

**旧物铺, and 青禾银行.** The second-hand shop buys back what you no longer want, at a price
rerolled once per in-game day — on a good day, something you haggled hard for sells for more than
you paid. The bank lends against tomorrow: one loan at a time, repaid in equal daily instalments
taken automatically as each day turns over. Missing one adds a late fee and the town notices, but
nothing is ever repossessed. Both open on a milestone; until then their door hangs a 暂停营业 sign
saying what is still needed.

**Things you can actually pick up.** Fruit in a basket, buns in a bakery case, produce on a
supermarket rack: press **E** to lift one out, then click to throw it and watch it arc, bounce off
a wall and roll to a stop on a bench. The stall quietly restocks the gap a little later, anything
left on the floor is tidied when you leave, and at most a dozen are ever loose at once. None of it
is inventory — a display apple is a toy, never food you can eat or sell, so a fruit rack cannot be
farmed for money.

**A basket before the till.** Fixed-price shops let you add several things, change your mind about
quantities and read an itemised bill before paying once. The basket sits above the goods rather than
below them, each card shows what is already in it, and opening an item gives you a quantity stepper
right there — because the person who opened an item is usually the person who wants three of them.
Uncle Chen still sells one at a time, and says so: a price you talked him down to belongs to that
conversation, not to a running total.

**麦香面包, the bakery.** Egg tarts, red bean buns, pineapple buns and a strawberry-glazed doughnut,
in a room with a glass pastry case, a wall of bread and a bank of ovens.

**The night market.** After 18:00 two handcarts are pushed into the square — candied hawthorn on one,
skewers and warm tofu pudding on the other — and wheeled away again before 02:00. They are only ever
*built* while the spot is off the side of your screen or you are indoors, so what you see is a vendor
walking their cart down the street, never a stall blinking into existence.

**青禾书馆, the library.** Six graded stories on three shelves, from a six-line HSK 1 morning to an
HSK 4 piece about a night market. Each book counts the vocabulary it leans on against what you have
shown you know — collected in the town, saved from a lookup, or answered in the word hall — and marks
itself readable, a stretch, or not yet. A book you cannot read names the exact words standing in the
way and hands you six of them for your word bank, so a shelf is a reading list rather than a wall.
Every line is highlightable, so the sentence popup explains the sentence you are looking at.

**A bank that does more than lend.** Deposit and withdraw at the counter; each in-game morning the
balance pays **2% simple interest, capped at 25 coins a day**. Those numbers are deliberate: a busy
day of errands and review is about 75 coins, so a maxed account is a third of that — a steady
supplement, never a replacement — and because the payout lands in your wallet rather than the
balance, it does not compound unless you walk back and re-deposit. Even then the cap holds it to
roughly linear: 1,000 banked and re-deposited every day is 1,712 after thirty days.

**Building permits.** A large construction project needs one, and the bank is the only place to get
it. Pay the whole thing now, or spread it over four in-game weeks for a 20% surcharge — the
instalment is taken automatically from your wallet, then your savings.

**A build site you finish over days.** The empty lot on the north side of the square is hoarded off.
It wants the shop permit first, then eight lengths of timber, six bricks and four bolts of cloth —
bought a few at a time from the builders' merchant at 家居小铺, or earned helping out. You hand
materials over as you get them and the site remembers, so it is somewhere you come back to rather
than one expensive click. Finish it and 青禾茶楼 goes up where the hoarding was, opens its door, and
pays a little of the day's takings into your wallet each morning.

**Somewhere to sit, and something to do tomorrow.** Chairs, stools and the café sofa can be sat
on. Your own bed sets the time of day — morning, midday, evening or night — so you do not have to
wait out the cycle. Three errands a day sit in the journal and pay coins when you collect them.

**Day and night.** A full day passes every 24 real minutes. Hunger drains at 2.1 points per in-game hour, half the earlier rate. The sky, sun and ambient light shift through dawn, midday, dusk and night; lanterns and street lamps light themselves after dark. Indoors, daylight comes through the windows — after dark a room is genuinely dim until you buy a lamp from 青禾灯具 and put it in.

**Your home comes furnished.** A bed, nightstand and rug are already there, along with a permanent **study desk**. Furnish the rest by position: click a spot — bed, dresser, wardrobe, ceiling light — and order straight into it, nothing to carry. A first-visit tutorial walks you through it, and a **poster by the door** repeats all of it — how to place things, where to buy them, how the learning works — whenever you have forgotten. Free placement is still there for anything you want exactly where you like.

**Furniture that goes together.** A tea set, a desk lamp or a pot plant can stand on a table, desk,
dresser or shelf — and never on the bed, which says so when you try. Once something is standing on
something else the pair is one **自定义家具 / Customized furniture**: the furnishing panel lists the
parts, and putting the base away takes its decor with it.

**A metro line, and a city at the end of it.** A stair goes down under a steel canopy on the north
side of the square. Buy a single at the fare hall, or a seven-day pass that pays for itself from the
seventh journey, and the train takes you to 云海市中心 — a downtown that is deliberately nothing like
青禾. Concrete and glass instead of timber and tile; a straight avenue with a zebra crossing instead
of a square you wander round; eight towers with backlit shop signs, a screen at the far end, taxis,
a bus shelter, and a skyline behind all of it. The street furniture is drawn again from scratch in
the city's own vocabulary rather than recoloured from the town's. Three people stand about on the
pavement with something to say, and what they say moves with the day and with how many journeys you
have made, so the fourth visit is not the first visit again. There is a 便利店 out there that sells
things 青禾 does not. **The journey home is always free** — being stranded in a city you cannot
afford to leave is not a lesson worth teaching.

**The ride is a scene, not a loading screen.** The doors close, the tunnel lights go past the window,
and the announcements run in the order a real one does: mind the doors, next station, we are
arriving, please alight on the left. Each line is Chinese first with pinyin and English under it.
Skip is always one key away.

**A kitchen of your own.** A door on the east wall of the house opens into a back room with a
stove. Groceries from 青禾超市 are cheap and barely worth eating on their own — rice, tofu, a
tomato — but two or three of them together make a proper meal that fills you completely. Buying
your way from starving to full with restaurant food costs about 16 coins; the three recipes cost
7, 9 and 10 in groceries, and the panel prints that comparison on every card so the saving is not
something you have to work out. What you pay instead is time: a pot takes 20 to 35 seconds of
real play, counted in the frame loop, so sleeping through it or reloading will not cook your
dinner. You can walk away while it simmers and the town tells you when it is ready. Selling a
cooked meal back to the second-hand shop can never beat what its ingredients cost, so the stove
feeds you rather than funding you.

**Hunger, rest, and how you come across.** You get hungry and tired as the day passes; both slow
you down, and the floor is a limp rather than a halt. Anything edible in your bag can be eaten
from it. Sleeping fills your rest back up. Shoes change how fast you walk, and turning up well
dressed — with nothing owing at the bank — nudges every vendor mood in your favour. The heart
button beside the location display shows all of it on one page; key **4** opens it too.

**The study desk** is your vocabulary bank. Everything you collected by looking at the world or highlighting text lands here, ready to review on the same spaced schedule, with two quick games that use your own words.

**Eating out.** 家常餐厅 in the riverside quarter has a menu, tablets on the tables, and waiters walking the floor. Order from either. Ordering in Chinese — 我要一份饺子 — pays a bonus the first time for each dish and banks the dish name.

**Haggling has a mood.** Uncle Chen's mood is rerolled once per in-game day and shown on his stall. Sour, and he holds a higher floor, gives fewer rounds, and may put the price *up* if you keep pushing. Sunny, and he is generous. Politeness (请, 谢谢, 您) and every closed deal build rapport, which lifts every future day.

**Voices and music.** Every authored line and every level 1–3 HSK word is spoken, cast per character.
The score is written and synthesised in your browser: a swung shuffle over jazz sevenths, marimba on
the tune, a soft walking bass and a shaker on the offbeat, re-voiced per building so a café and a
library do not sound alike. Rumble is filtered out below 55 Hz — under the lowest note the band plays.

Chinese is displayed by default everywhere. **?** reveals the pinyin/English you chose in Settings; help never silently changes the default language.

## Honest current limits

**The voices are AI generated.** All 2,342 clips come from `edge-tts` (Microsoft Edge's neural voices), and **no human has listened through them**. The game labels them `AI 配音` wherever it plays one. Tone accuracy, naturalness and character consistency are unverified. `edge-tts` is also not a cleared commercial license — fine for local personal use, but **confirm the terms or re-generate with a licensed provider before publishing this anywhere**. See [voice production](docs/VOICE_PRODUCTION.md).

**HSK levels are not verified.** Level bands come from the [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) dataset (MIT), not from a word-by-word check against the [official syllabus](https://www.chinesetest.cn/syllabus). HSK 3.0 (2021) drives the hall and the gates; classic HSK 2.0 bands are carried separately in `legacyLevel` and never merged. The hall says this on screen. Only levels 1–3 have audio. The HSK levels tagged on world objects in `objects.json` are my own judgement and are not verified either.

**The dictionary is CC BY-SA.** CC-CEDICT under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), attributed in the popup. Share-alike travels with it if you distribute the game.

**Curriculum text is not native-speaker reviewed.** The town's lesson content is a beginner slice. The answer matcher is curated; an unrecognised answer can still be valid Chinese.

**Scheduled systems share one calendar.** `core/calendar.js` owns what day it is, whether a schedule
is open across midnight, and whether a once-per-period payout has already happened — so a repayment
cannot be taken twice because a tab was hidden. The night market, morning interest, weekly permit
instalments and a built shop's daily takings all read it.

**Three shop fronts, not one.** Buildings declare a `style`: `tiled` (layered eaves and lattice
glazing), `shophouse` (plastered upper storey, arched heads, a cloth awning) or `modern` (glass and
steel, flat parapet, a sign strip that lights after dark). They share a footprint and a doorway, so
collision and the door prompts are unaffected.

**The city is a starter district.** One street, a convenience kiosk, one store you can walk into,
three people, and a line with two stations on it. The store — 星光五金百货 — is a single floor laid
out in departments (building materials, hardware, furniture, lighting, household goods, a checkout),
each signed overhead; it is not yet the multi-storey department store with stairs. The metro has no
map or second line. The town remains the game; 云海 is the beginning of somewhere else.

**Gameplay scope.** Walking slides against obstacles rather than pathfinding. Jumping is a simple arc with no ledge grabbing. Waiters walk a fixed loop and pause at each stop; if you stand in their way they stop short of you and wait, then carry on, but they do not path around you; townsfolk blink, glance about and shift their weight, but none of it is aimed at the player. Clothing changes colour only. NPC conversation is still the one introduction lesson — shops and the restaurant have scripted exchanges, but nobody holds a real conversation. Sitting fixes you to the seat until you stand. The pond is shallow: you wade through it rather than swim. The bank is a game mechanic in a game currency; nothing about it is financial advice.

**Microphone input** uses the browser's speech recognition, which may send audio to its online service. Transcripts are editable and never auto-submitted.

Progress saves locally: not cloud synced, not tamper proof, and clearing site data clears it unless exported.

## Manual editing

| File | Purpose |
| --- | --- |
| `src/content/world.json` | Districts, bounds and gates; buildings, street props, townsfolk, trees, ground patches |
| `src/content/quests.json` | Main missions: curated Chinese names, English briefs, completion rules, map waypoints |
| `src/content/objects.json` | The Chinese name, pinyin, gloss and HSK level of every nameable thing |
| `src/content/rooms.json` | Interiors: size, spawn, door, windows, shop counter, fittings, furniture slots, staff patrol paths, opening milestones |
| `src/content/catalog.json` | Shop stock: prices, bargaining, furniture footprints, clothing and shoe slots, how filling each food is |
| `src/content/translations.json` | Authored sentence meanings for dialogue, signs and notices |
| `src/content/dictionary-policy.json` | Curated senses and the blocked-sense sweep applied to CC-CEDICT |
| `src/content/stories.json` | The library's books: level, blurb, the vocabulary each one gates on, and every line |
| `src/content/sites.json` | Build sites: the permit, the pile of materials, what finishing unlocks, and the daily takings |
| `src/content/recipes.json` | Home cooking: what each dish combines, how long the pot takes, and what it produces |
| `src/content/city.json` | 云海市中心: the fares, the station on the square, and every tower, prop and person downtown |
| `src/content/npcs.json` | Names, roles, colors, lesson links |
| `src/content/voices.json` | Voice cast and prosody per speaker |
| `src/content/lessons/introductions.json` | Dialogue, accepted answers, examples, usage notes |
| `src/content/vocabulary.json` | Town practice words |
| `src/content/balance.json` | Review intervals, rewards, retry delays |
| `src/content/hsk.json` | Syllabus metadata, level names, validation status |
| `public/hsk/words.json` | The HSK word list (generated) |
| `public/dictionary/cedict.tsv.gz` | Pop-up dictionary (generated) |
| `public/audio/manifest.json` | Voice clip references (generated) |

`npm run check:content` validates all of it: ids, district and shop references, building rotations, furniture footprints, clothing slots, gate requirements, mission waypoints, building styles, and which clips are missing or unreviewed. It checks that every shape the world
asks for exists in `models.js`, and that no two solid pieces of street furniture stand inside each
other (canopies and poles are exempt — an awning is *meant* to overlap the shop it is bolted to). It also lays every interior out on paper — fittings, the shop counter and its shelves, the study desk, the furniture slots — and fails if two of them overlap, if one sticks through a wall or stands in the doorway, or if you would spawn inside one.

Scene and character geometry live in `src/world/` (`registry.js` owns hitboxes, standing surfaces and look-at — boxes, or discs for round things like
the fountain; `daylight.js` the day/night cycle; `idle.js` the small signs of life; `physics.js` the
things you can throw and the containers that restock them; `stalls.js` the night market and its
off-camera arrivals; `interior.js` builds rooms; `models.js` holds every shape), UI in `src/ui/`, pure rules in `src/core/` (`vendor.js` owns mood and rapport, `stats.js` hunger and rest, `finance.js` the loan, `daily.js` the errands, `resale.js` the second-hand offers, `bank.js` the
vocabulary bank, `progress.js` the district gates, `calendar.js` the one clock every scheduled system
reads, `cart.js` the shopping basket, `surfaces.js` what may stand on what, `reading.js` which books
you are ready for, `construction.js` the build sites and what they pay, `cooking.js` the stove,
`metro.js` tickets and passes), browser adapters in `src/services/`. Keep stable ids when editing so saved progress survives.

### Regenerating the built data

All three generators are Python and need a virtualenv:

```sh
python -m venv .venv
.venv/Scripts/python.exe -m pip install edge-tts
```

```sh
.venv/Scripts/python.exe scripts/generate-voice.py
```

**The HSK cards** are built in two steps from four downloaded sources. They go in `.cache/hsk-sources/`,
which is git-ignored — deliberately *not* `test-results/`, which Playwright empties at the start of every
browser run and which is where the sources were silently lost once already.

```sh
mkdir -p .cache/hsk-sources && cd .cache/hsk-sources
curl -L -o hsk-source.json https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json
curl -L -o moe.json.xz     https://raw.githubusercontent.com/g0v/moedict-data/master/dict-revised.json.xz
curl -L -o ci.json         https://raw.githubusercontent.com/pwxcoo/chinese-xinhua/master/data/ci.json
curl -L -o word.json       https://raw.githubusercontent.com/pwxcoo/chinese-xinhua/master/data/word.json
cd ../..
.venv/Scripts/python.exe scripts/prepare-hsk-chinese.py        # -> src/content/hsk-chinese.json
.venv/Scripts/python.exe scripts/build-hsk.py .cache/hsk-sources/hsk-source.json   # -> public/hsk/words.json
```

`prepare-hsk-chinese.py` takes each card's Chinese definition from the 重編國語辭典 entry for *the reading
the card shows* — 长 is cháng, "long", not zhǎng, "to grow" — follows cross-references such as 濕 → 溼,
and keeps the dictionary's traditional script as published (attribution in `public/hsk/MOE-ATTRIBUTION.md`).
Words the MOE dictionary lacks come from chinese-xinhua. `build-hsk.py` then merges those with the
authored overrides in `src/content/hsk-authored.tsv` and the preferred readings in
`src/content/hsk-readings.json`. Regenerating from unchanged sources reproduces the committed card file
exactly: same 5,363 IDs in the same order, so saved review history is never orphaned.

```sh
.venv/Scripts/python.exe scripts/build-dictionary.py cedict.txt
```

The CC-CEDICT pop-up dictionary; the script's docstring carries the download command. Both HSK and
dictionary builds apply the family-friendly policy in `src/content/dictionary-policy.json` before they
truncate meanings. Voice generation is incremental — it only re-synthesises clips whose text, voice or
prosody changed.

## Progress and rewards

The spaced-review schedule is inspired by Anki; it does not implement FSRS or integrate Anki. Eligible unassisted successes schedule the next review at 10 minutes, 1 day, 3 days, 7 days, 14 days, then 30 days. Hints hold the stage and return in 10 minutes; errors drop it by one and return in 2 minutes. Practice before a word is due neither advances the stage nor pays coins.

Recognition, listening and production are tracked separately — recognising 书 does not mean you can say it. Unassisted due success earns 3 coins, supported success 1. Purchases update wallet and inventory together, only after confirmation, and buying a word does not confer mastery of it.

District gates count a word once you have answered it correctly at least once, or named the object in the world with F. That is a deliberately gentle bar applied to a large number of words, rather than a harsh bar on a few — it paces by volume, not by waiting.

## Verification and production build

```sh
npm test
npm run check:content
npm run build
npm run test:browser
```

59 unit tests, structural content validation, and 67 browser tests (Microsoft Edge on Windows, local server on port 5174 — change the Playwright channel or install Playwright Chromium elsewhere). The browser tests use `window.__qinghe`, a debug handle the app exposes so tests and layout tools can reposition the player instead of steering through a city whose streets change.

PlayCanvas dominates the JS bundle (~0.55 MB gzip) and triggers Vite's large-chunk advisory. Generated assets in `public/` add ~33 MB: 29 MB of voice clips, 2.9 MB of dictionary, 0.7 MB of HSK words. The dictionary and word list are fetched lazily, on first use. No deployment has been performed.
