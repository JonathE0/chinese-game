# City quests: the first three

Approved 2026-09-11. Builds the "build first" picks from the quest brainstorm: the tea-house
questline, 问路 (ask the way) and 打车 (taxi) in Downtown Yunhai, and the 海风面馆 noodle window
that teaches a home recipe. All Chinese is already written; the tasks wire it up.

## Ground rules
- Follow `CLAUDE.md`. Don't write new player-facing Chinese: all of it is below or in the lesson
  files. If something is missing, leave a marked placeholder and report it.
- Don't generate voice clips; one run at the end covers every new audio id. Missing clips are only
  warnings in check-content, so `npm run verify` still passes.
- Don't commit or stage. Run `npm run verify` before reporting.
- Tasks run in order and build on each other. Seams below come from a code survey; verify them.

## Already done by the main session
- `src/content/lessons/city-directions.json`, `city-taxi.json`, `city-noodles.json`: the three
  conversations, written to the schema extension below.
- Missions `teahouse-permit` (flag `permit:shop`) and `teahouse-build` (flag `built:teahouse`) in
  `quests.json`. They use existing flags, so no code is needed for them.

## Lesson schema extension
Backwards compatible: `introductions.json` must keep working unchanged.
- `intent: "option"` with `store` and `options: [{value, choice, accepted[]}]`. The reply is
  matched (same normaliser as `variants`) against each option's `accepted`; the matching option's
  `value` is saved as `state[store]`; the answer buttons show each option's `choice`. No match
  shows the node's `hint`, as today.
- `intent: "none"`: the line plays and the player continues with a 继续 button; no input.
- Optional `note` on any node or extra line: shown together with the English help.
- Optional lesson `host: {zh, pinyin, en, color}`: header and portrait when the speaker isn't a
  town NPC.
- Optional lesson `extraLines: {key: {zh, pinyin, en, speaker, audio, note?}}`: lines a gameplay
  adapter shows after the conversation (arrival, served, and so on), rendered and voiced like
  dialogue lines and respecting the pinyin/English settings.
- New speakers for the `voices.json` cast: `student` (zh-CN-XiaoxiaoNeural, rate +8%, pitch +8Hz),
  `driver` (zh-CN-YunjianNeural, +6%, +2Hz), `cook` (zh-CN-YunxiNeural, +4%, -3Hz). These are
  starting picks and need a listening review like every clip.

## Task 1 — Conversation engine
Seams: `src/ui/dialogue.js:8` `openDialogue` is hard-coded to `introductions` and only dispatched
from `src/main.js:63`; nodes advance strictly in order (`dialogue.js:24`); completion grants
`lesson:introductions` and pushes the lesson id (`dialogue.js:28-29`); `npcs.json` `lesson` is
never read at runtime.
- `openDialogue(ctx, lessonId, {onFinish})` loads any lesson by id; header and portrait come from
  the NPC or the lesson `host`. Auntie Lin opens via her `npcs.json` `lesson`.
- Implement `option`, `none`, `note` and `extraLines`, plus a helper adapters can call to show and
  voice one extra line (for example `showLine(ctx, lessonId, key)`).
- Completion: grant `lesson:<id>` once (existing reward rules), push the lesson id once, then call
  `onFinish(state)` every time the conversation completes. These conversations are repeatable.
- Put matching and state logic in a pure `src/core/` module with unit tests: option matching
  including normalised punctuation, `none` advancing, state capture, `onFinish` once per
  completion, no second reward on repeat.
- `scripts/generate-voice.py` `collect_lines()` and `scripts/check-content.js`: include
  `extraLines`; validate option nodes (non-empty value, choice and accepted; unique values) and
  that every node and extra line has zh, pinyin, en, audio and a speaker in the cast.
- Add the three cast entries.

## Task 2 — 问路 (ask the way)
Seams: `src/ui/citytalk.js:16` `openCityTalk(ctx, personId)`.
- For the student only, add a 问路 · Ask the way button that opens `city-directions`.
- Once that lesson has been completed, arriving on the pavement in front of 一号书店 pushes
  `city:found-bookstore` once and shows `extraLines.found`. The spot in front of a tower is
  x − sign(x)·(d/2 + 0.5) at the same z; that is how `city.json` `department` sits in front of
  星光百货. Use a radius of about 4, in a pure helper with a unit test.
- Add the mission after the tea-house ones:
  `{"id":"city-directions","zh":"问路找书店","pinyin":"Wèn lù zhǎo shūdiàn","en":"In Yunhai, ask the student on the avenue where 一号书店 is, then walk there.","done":{"flag":"city:found-bookstore"}}`
- Create `tests/browser/city-quests.spec.js` with an ask-the-way test (see
  `tests/browser/city.spec.js` for reaching the city) and run just that spec.

## Task 3 — 打车 (taxi)
Seams: interactables in `src/world/town.js:425-436` `cityTargets()` (the kiosk at `:432-433` is the
model); dispatch in `src/main.js:49-87` `interact()`; taxis are drawn at `src/world/city.js:189-196`
from `city.json` props; the player's position is `ctx.town.player.entity.getPosition()` and
`setPosition(x,0,z)` moves them.
- Both taxis become interactable (label 打车 · TAXI) and open `city-taxi`.
- `onFinish`: find the `city.json` tower whose `sign` is `state.destination`. With fewer than 5
  coins, show `extraLines.broke` and stop. Otherwise fade to black (a new small overlay, about
  0.4 s each way), move the player to the pavement in front of that tower (Task 2's formula, clear
  of props), fade back in, charge 5 through the existing wallet and ledger, and show
  `extraLines.arrived`.
- Fare rule in `src/core/` with unit tests: not enough coins means no move and no debit; enough
  means exactly one debit.
- Add the mission:
  `{"id":"city-taxi","zh":"用中文打车","pinyin":"Yòng Zhōngwén dǎ chē","en":"Take a taxi in Yunhai: tell the driver where you want to go.","done":{"flag":"city-taxi"}}`
- Add a taxi test to `tests/browser/city-quests.spec.js` and run that spec.

## Task 4 — 海风面馆 and the home recipe
- Counter: add a `noodles` entry to `city.json` in front of 海风面馆 (same formula; label
  海风面馆 · 点面), registered like the kiosk and opening `city-noodles`.
- `onFinish` receives `dish` (beef|egg), `size` (large|small), `spice` (hot|mild|none) and `where`
  (here|takeaway):
  1. First completion only: show `extraLines.recipe`, push `recipe:tomato-egg-noodles`, and toast
     学会了：番茄鸡蛋面. This is a learning reward, so it doesn't depend on paying.
  2. The item is `city-<dish>-noodles-<size>`. Show the existing purchase confirmation (item,
     quantity 1, total, remaining balance). If they can't afford it, show
     `extraLines.cant-afford`; if they cancel, show `extraLines.cancelled`. Nothing else changes in
     either case.
  3. Once paid: `here` eats it straight away through the normal eating path; `takeaway` puts it in
     the bag. Then show `served-here` or `served-takeaway`.
- Catalog: shop `noodles`, audio ids following the catalog's pattern, and a category that keeps
  them off the riverside restaurant's menu (`src/ui/menu.js:9` lists every `dish`). Set nutrition
  so check-content's recipe rules still pass and a large bowl is better value than a small one.
  - `city-beef-noodles-small` 小碗牛肉面 xiǎo wǎn niúròu miàn, 16: 一小碗牛肉面，汤很香。 / A small bowl of beef noodles in a fragrant broth.
  - `city-beef-noodles-large` 大碗牛肉面 dà wǎn niúròu miàn, 19: 一大碗牛肉面，肉多面也多。 / A big bowl of beef noodles, with plenty of meat and noodles.
  - `city-egg-noodles-small` 小碗鸡蛋面 xiǎo wǎn jīdàn miàn, 12: 一小碗鸡蛋面，清淡好吃。 / A small bowl of egg noodles, light and tasty.
  - `city-egg-noodles-large` 大碗鸡蛋面 dà wǎn jīdàn miàn, 15: 一大碗鸡蛋面，吃得饱饱的。 / A big bowl of egg noodles that fills you right up.
  - `home-tomato-egg-noodles` 家常番茄鸡蛋面 jiācháng fānqié jīdàn miàn, not sold in a shop, priced like the other home dishes (at most 11): 自己做的番茄鸡蛋面，酸酸甜甜的。 / Home-made tomato and egg noodles, sweet and tangy.
- Recipe `tomato-egg-noodles`: 番茄鸡蛋面, Fānqié jīdàn miàn, Tomato and egg noodles; noodles, egg,
  tomato; 25 seconds; output `home-tomato-egg-noodles`; `"learnedBy": "recipe:tomato-egg-noodles"`.
- Gating: a recipe with `learnedBy` is locked until that flag is in `profile.completed`.
  `src/ui/kitchen.js:74` shows it as a locked card reading 去云海的海风面馆学吧 / Learn it at the
  noodle house in Yunhai, and `src/core/cooking.js:15` `cookingProblem` refuses it. The existing
  recipes stay open.
- Collecting a meal pushes `cooked:<recipeId>` once.
- Unit tests: price for each dish and size; can't-afford and cancel change nothing; eating here
  versus takeaway; a locked recipe is refused and a learned one allowed; the `cooked:` flag.
- Add the missions:
  - `{"id":"city-noodles","zh":"在海风面馆吃碗面","pinyin":"Zài Hǎifēng miànguǎn chī wǎn miàn","en":"Order a bowl at 海风面馆 in Yunhai. The cook may teach you a recipe.","done":{"flag":"city-noodles"}}`
  - `{"id":"home-noodles","zh":"在家做番茄鸡蛋面","pinyin":"Zài jiā zuò fānqié jīdàn miàn","en":"Cook the tomato and egg noodles the noodle cook taught you, in your home kitchen.","done":{"flag":"cooked:tomato-egg-noodles"}}`
- Add a noodle-order test (including the kitchen showing the learned recipe) to
  `tests/browser/city-quests.spec.js` and run that spec.

## Task 5 — Review fixes and voice clips
Two Opus reviews of Tasks 1–4 found these. Fix all of them, then generate the clips, keeping every
existing test passing. The taxi and noodle browser tests live in `taxi.spec.js` and
`noodles.spec.js` rather than `city-quests.spec.js`; that is fine.

Dialogue engine
1. `onFinish` and `showLine`'s `onDone` must run exactly once however the panel closes: its
   button, Esc (`src/ui/shell.js:55`) or × (`:97`). Today they only run from the button, although
   `finish()` has already paid and saved the lesson id, so Esc skips the taxi ride, drops a noodle
   order, or skips the purchase step after the recipe line. Closing before a conversation
   completes must still run nothing. Suggested shape: a one-shot close hook armed in `finish()` and
   `showLine` (for example `ctx.ui.open(…, {onClose})`, run once by `Shell.close()`), with the
   sequencing in `src/core/conversation.js` and a unit test.
2. A node's `note` must not hide its `hint` (`src/ui/shell.js:11` uses `line.note||line.hint`).
   Show them as separate lines, and show the node's `hint` on a reply that matches nothing.
3. Narrator extra lines (such as `city-directions` `found`) must not use the host's portrait or
   the introductions-only label 你的第一句话 (`src/ui/dialogue.js:92`): show no portrait, and use
   the lesson's `title` as the label.
4. Host portraits: give the glyph a light colour such as #fff5da so it reads against `host.color`
   (`src/ui/dialogue.js:40`, `:90`).
5. check-content: using the real matcher (`evaluateNode`), every `choices` entry must be accepted
   by its own node, and every option's `choice` must map to its own `value`.

Taxi and 问路
6. A taxi drop-off at 一号书店 must not count as walking there or show the found line; only
   arriving on foot counts (for example, after any warp the player must leave the arrival radius
   before entering it counts). Unit-test the rule.
7. The drop-off spot is 0.14 m inside the tower's collision box: `frontOfTower` is d/2+0.5 from the
   centre, the box reaches d/2+0.3, and the player's radius is 0.34. Use a separate drop-off spot
   clear of the tower and props (for example d/2+1.0, or through the existing free-spot helper),
   and keep `frontOfTower` as it is for the arrival check.

Noodles and kitchen
8. The locked recipe's button says 尚未解锁, which nobody supplied (`src/ui/kitchen.js:90`). Use
   还没学会 (hái méi xuéhuì, "not learned yet").
9. `cookingProblem` checks `busy` before the recipe lock (`src/core/cooking.js:17-20`), so the
   locked card turns into a normal card while the pot is on. Check the lock first.
10. A paid bowl skips the shop's generic purchase effects (`src/ui/shop.js:168-170`), so
    `purchase:first` (a mission flag and a room-opening flag) is never set if noodles are the
    player's first purchase. Apply the same generic first-purchase effect; shopkeeper rapport
    isn't needed.
11. Closing the purchase confirmation with Esc or × counts as cancelling: show
    `extraLines.cancelled`.
12. Move the rule "teach the recipe once, on the first completed order, whether or not the player
    pays" from `src/ui/noodles.js` `afterOrder` into `src/core/noodles.js`. Unit-test: a first
    visit with enough money; a first visit without enough (recipe learned, nothing charged,
    cant-afford line); cancelling changes nothing; a second visit doesn't teach it again.

Voice clips
13. When the fixes pass, run `.venv/Scripts/python.exe scripts/generate-voice.py`. It synthesises
    only new or changed ids and needs network access. check-content should then report no missing
    clips. If synthesis fails, report the error and leave the clips missing.

Finish with `npm run verify` and
`npx playwright test tests/browser/city-quests.spec.js tests/browser/taxi.spec.js tests/browser/noodles.spec.js tests/browser/kitchen.spec.js tests/browser/game.spec.js --reporter=line`.

## Known gap, out of scope
The city street lines in `city.json` have no audio, and neither the voice script nor
check-content looks at them.

## What shipped
- **Conversation engine.** Any lesson opens by id from anywhere (`openDialogue(ctx, lessonId,
  {onFinish})`, `showLine(ctx, lessonId, key, {onDone})`), with `option` and `none` nodes, notes,
  hosts and `extraLines`. Completion and follow-on lines run exactly once however a panel closes
  (button, Esc or ×); held Esc no longer cascades. Auntie Lin's lesson now opens from her
  `npcs.json` `lesson` and behaves as before. Highlight-to-translate covers every lesson.
- **问路.** The student offers 问路; the bookstore counts only when the player walks in, not when a
  taxi drops them there.
- **打车.** Both taxis take the player to any of the six signed towers for 5 coins, with a fade
  and a drop-off clear of the tower; too little money means no ride and no charge.
- **海风面馆.** Dish, size, spice and eat-here or takeaway, then the shop-style confirmation. The
  first completed order teaches 番茄鸡蛋面 whether or not the player pays; a paid bowl sets
  `purchase:first` like any shop.
- **Kitchen.** Recipes with `learnedBy` stay locked (还没学会) until learned, even while the pot is
  busy; collecting a meal sets `cooked:<recipeId>`.
- **Missions.** `teahouse-permit`, `teahouse-build`, `city-directions`, `city-taxi`,
  `city-noodles`, `home-noodles`.
- **Checks.** check-content validates option nodes, `extraLines`, and every modelled answer with
  the real matcher; the voice script covers `extraLines` and no longer crashes on a Windows
  console. All 193 clips are present (still AI voices awaiting a listening review, including the
  new `student`, `driver` and `cook` cast).
- **Tests.** Unit tests for the conversation core, arrival and drop-off, taxi fares, noodle orders
  and recipe gating; browser specs `city-quests`, `taxi` and `noodles` alongside the existing
  `kitchen` and `game` specs. Three Opus reviews; all findings fixed.
- **Open.** `tests/browser/dbg.spec.js` is a leftover debug spec awaiting a decision.
