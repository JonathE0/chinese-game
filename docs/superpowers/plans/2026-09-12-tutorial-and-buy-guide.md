# First-run tutorial and the where-to-buy map guide (2026-09-12)

Requested by the player after a play session: a more comprehensive tutorial at the start, and a map
guide showing where to buy whatever a recipe or a build site is short of. Done in the same session,
before these two tasks: the welcome sign became a walk-under gateway and the alley beside the house
was cleared, study venues pay better (word hall new word +5, home desk +4 a card, anywhere else +3;
`cardCoins(venue,fresh)` in `src/core/review.js`), and the shell gained a generic route.

## Shared wiring that already exists — use it, do not rebuild it

- `ctx.ui.showWay({key,district,x,z,label})` in `src/ui/shell.js` draws the minimap's dashed route
  (the same one missions use, crossing district gates on its own) and shows a toast.
  `ctx.ui.clearRoute()` removes it; `ctx.ui.route?.key` says who set it.
- `src/main.js` already clears a route whose `key` is a room id when the player walks into that
  room, and a route keyed `'metro'` when the player uses the metro stair.
- `cardCoins(venue,fresh)` gives the coin rates: `cardCoins(null,false)` anywhere,
  `cardCoins('desk',false)` at the desk, `cardCoins('hall',true)` for a new word at the word hall.

## Running two tasks at once

Task A and Task B run in parallel in the same working tree. Each owns the files listed in its
section and must not edit the other's. Both append CSS to the end of `src/style.css`, each under its
own comment header (`/* tutorial */`, `/* where-to-buy guide */`); if an edit there fails because
the file changed, re-read it and retry. A build that fails on a locked `dist/` file is the other
task building at the same moment — run it again. Do not commit. Write the failing unit test before
the rule it tests. Finish with `npm run verify`.

Chinese text is authored: use the strings given here exactly and do not write new Chinese. If a
string you need is missing, use English only and say so in your report.

---

## Task A — First-run tutorial (model: opus)

Content is written: `src/content/tutorial.json` (steps, `ui` strings, a `note` explaining fields).
Fifteen steps: look, walk, view, word, bank, coins, missions, listen, talk, home, inside, needs,
shops, gates, done. A step with `done` finishes itself; a step without waits for 下一步.

**Owns:** `src/core/tutorial.js` (new), `src/ui/tutorial.js` (new), `tests/tutorial.test.js` (new),
`src/core/profile.js`, `src/main.js`, `src/ui/shell.js`, `src/ui/panels.js`, its block in
`src/style.css`, and any Playwright spec it adds or has to adjust.

### Rules (`src/core/tutorial.js`, pure, unit-tested)

- Save shape: `profile.tutorial` is `{step,progress}` while running (`step` an index into
  `steps`, `progress` a number accumulated towards the step's `done.amount`), `{done:true}` once
  finished or skipped, and `undefined` for a save that has never met the tutorial.
- `shouldAutoStart(profile)`: true only when `profile.tutorial` is undefined **and** the player is
  brand new: no entries in `completed` other than `home:starter` (the starter home adds that on
  every first load), nothing in `discovered`, and no `words`. Existing players are never
  interrupted.
- `startTutorial(profile)` sets `{step:0,progress:0}` (also used by Settings to replay).
- `tutorialEvent(profile,{type,id,amount})`: when the current step's `done.event` equals `type`
  (and `done.id`, when the step has one, equals `id`), add `amount` (default 1) to `progress`;
  once `progress >= (done.amount ?? 1)` advance to the next step with `progress` 0. Past the last
  step the save becomes `{done:true}`. Returns `'advanced'`, `'progress'` or `null`. Events never
  advance a step without `done`.
- `nextStep(profile)` advances unconditionally (下一步; on the last step it finishes).
  `skipTutorial(profile)` sets `{done:true}`.
- `currentStep(profile)` returns the step object or null. `fillText(text)` replaces `{anywhere}`,
  `{desk}` and `{hallNew}` with `cardCoins(null,false)`, `cardCoins('desk',false)` and
  `cardCoins('hall',true)`.
- `decodeProfile` keeps a valid `tutorial` and quietly drops a malformed one (it is not worth
  refusing a whole save over): valid means `{done:true}`, or `step` an integer within the steps
  list and `progress` a finite number ≥ 0.

Tests at least: auto-start only for a brand-new save (and not once `home:starter` is joined by any
other flag, a discovered word or a word record); look progress accumulating to 90; an id-specific
step ignoring the wrong id (`talk` from `chen` does not finish the `lin` step); an info step
ignoring events; next, skip and finishing; `fillText` matching `cardCoins`; decode keeping a valid
tutorial and dropping a bad one.

### Screen (`src/ui/tutorial.js`, plus markup in `shell.js`)

- A card at the top centre, under the top bar, clear of the mission card (top left), the wallet
  (top right), the minimap (bottom right) and the controls strip (bottom). It must not overlap any
  of them at 1280×720 or at the 375×812 touch layout, and must not block clicks on them.
- It shows: `ui.eyebrow` (新手教程 · TUTORIAL) and `n / 15`; the step's `zh` (after `fillText`) in
  bold; a `?` using the existing `data-help` / `.help-content` pattern (the quest card's) that
  reveals the pinyin; the `en` (after `fillText`) as small text, always visible, the way missions
  show English. Buttons: `ui.next` (primary on a step without `done`, quiet on a step with one) —
  `ui.finish` on the last step — and a quiet `ui.skip` link.
- When a step finishes itself, show `ui.didIt` for about a second (with `ctx.music?.cue('collect')`)
  before the next step. Skipping shows `ui.skipped` as a toast.
- Hidden before 开始旅行, while any panel is open (`ctx.ui.panelId`), and when no tutorial is
  running. Visibility can be refreshed from the frame loop the way `#crosshair` is.
- A step with `where` calls `ctx.ui.showWay({key:'tutorial',...where,label:where.zh})` when it
  becomes current; leaving that step (advance, skip) clears the route if its key is still
  `'tutorial'`.
- The arrival screen gets `ui.arrival` (zh, with the en as small text). Settings gets a button
  labelled `ui.replay` (zh with the en small) that starts the tutorial again and closes the panel.

### Events (hooks, mostly `src/main.js`)

- Start button: if `shouldAutoStart`, start the tutorial and save.
- `look`: accumulated absolute change of `town.yaw`, in degrees and wrap-aware, measured in the
  frame loop while playing (not paused, no panel).
- `walk`: metres the player moves in the frame loop outdoors while playing.
- `view`: `town.view` changing, in either direction.
- `collect`: a new word collected with F (`collect()` in `main.js`).
- `panel`: any `ctx.ui.open(id)` — hook it inside `Shell.open`.
- `route`: `Shell.followQuest` setting a route (not clearing one).
- `talk`: `interact()` for `lin`, `mei`, `chen`, `city:*` (id without the prefix) and `staff:*`.
- `enter`: `enterPlace(id)` after the player is inside.
- Save on every advance; per-frame `look`/`walk` progress lives on the profile but is only written
  to storage when the step advances.

### Verification

`npm run verify`, then the full `npm run test:browser` (existing specs seed brand-new saves, so the
tutorial will be running in them — the card must not get in their way; adjust a spec only if the
card is legitimately in the way of something it clicks, and say so). Add a Playwright spec that
starts a fresh game, sees step 1, turns the view by script (`window.__qinghe.town.yaw`), sees
step 2, skips, and sees the card gone and `profile.tutorial.done`.

---

## Task B — Where-to-buy map guide (model: sonnet)

When the kitchen or a build site is short of something, a 哪儿有卖 button opens a guide inside the
same panel: a map of the town marking every place that sells what is missing, a list of those
places, and a 带路 button that routes the minimap there.

**Owns:** `src/core/sellers.js` (new), `tests/sellers.test.js` (new), `src/ui/buyguide.js` (new),
`src/ui/kitchen.js`, `src/ui/build.js`, its block in `src/style.css`, and
`tests/browser/kitchen.spec.js` or a new spec. It does not edit `main.js` or `shell.js`.

### Rules (`src/core/sellers.js`, pure, unit-tested; import the content JSON directly)

- `sellersOf(itemId)`: every seller of a catalog item. `catalog.json` `shop` is a string or an
  array of shop ids.
  - A shop id that is a room with a building in `world.json`: `{shop, zh, en, district, x, z}` with
    the room's `door` as `x,z` and the building's `district`, plus `opens` (the room's `opens`)
    when it has one.
  - A room whose `building` starts with `city:` (星光五金百货): `{shop, zh, en, city:true,
    district, x, z}` pointing at the town's metro stair — `city.json` `station.x` and
    `station.z - 3`, the same spot as the `metro` target in `src/world/town.js` — with `district`
    found from the district bounds that contain it, not hard-coded.
  - An NPC stall (`npcs.json` id, e.g. `chen`): the NPC's placement in `world.json` `npcs`,
    `zh` `"陈叔叔 · 小商店"` style (`${npc.zh} · ${npc.role}`), `en` the NPC's `en`.
  - Any other id (moving market stalls, city kiosks) has no fixed door and is left out.
- `whereToBuy(needs)`: `needs` is `[{id, short}]`; returns sellers grouped with what each sells
  from the list — `[{seller, items:[{id, zh, pinyin, en, price, short}]}]` — town sellers before
  city ones, and items nobody sells collected separately as `unsold`.

Tests at least: `egg` → the supermarket in `market` at its door; `timber` → 家居小铺 in `square`
and 星光五金百货 with `city:true` at the metro stair; `postcard` → 陈叔叔's stall; an unknown id →
`[]`; grouping several items and an unsold one.

### Screen (`src/ui/buyguide.js`)

- `openBuyGuide(ctx, body, needs, {back})` renders into the open panel's body:
  - `<h3 class="section-title">去哪儿买 <small>WHERE TO BUY</small></h3>`, then
    `地图上标出了卖这些东西的地方。点「带路」，小地图会带你过去。<br>The map marks where these are
    sold. Tap 带路 and the minimap leads you there.` as microcopy.
  - An SVG map of all three districts in the minimap's style (district rects `#f6eedb`, buildings
    in their `roof` colour, trees, fountain; north up, so z runs down the page), with a numbered
    pin at each seller's door (the metro stair for city sellers) and a "你在这儿" marker: the
    player's position outdoors, or the door of the building they are in when indoors (the kitchen
    counts as the house). Draw it from `world.json`, not from the DOM minimap.
  - One row per seller, numbered to match its pin: `zh` and the district's `zh`; the items as
    `${zh} 还差 ${short} · 每个 ${price} 学习币`; notes when they apply —
    `gateMessage(state)` from `src/core/progress.js` when the seller's district gate is still shut
    (`ctx.gateStates`), the room's `opens.zh` when that shop has not opened, and
    `在云海 · 先坐地铁 / In Yunhai — take the metro first` for a city seller; and a `带路` button.
  - 带路 calls `ctx.ui.showWay({key, district, x, z, label})` with `key` the room id (`'metro'`
    for a city seller, label `青禾地铁站 → ${zh}`; the NPC id for a stall) and closes the panel.
    `main.js` clears the route on arrival.
  - Unsold items: `城里暂时买不到。 / Not sold anywhere yet.` A `返回` button calls `back()`.
- Kitchen (`kitchen.js`): a recipe card short of ingredients gets a `哪儿有卖` button (with
  `<small>where to buy</small>`) beside its disabled 材料不够 button, opening the guide for that
  recipe's shortfall with `back` returning to the kitchen. The kitchen's 250 ms timer re-renders
  the panel when the pot has no progress bar on screen — it must leave the guide alone while the
  guide is showing, or it will throw the player out of it mid-read.
- Build site (`build.js`): when any material is short, one `哪儿有卖` button under the materials
  opens the guide for every short material, `back` returning to the site.

### Verification

`npm run verify`, the kitchen browser spec, and a Playwright check that a short recipe's 哪儿有卖
shows the supermarket pin and row, and that 带路 closes the panel and sets
`window.__qinghe.ui.route` to the supermarket's door.

---

## What shipped

Both tasks landed as briefed and passed an Opus review; fixes from the reviews:

- Guide: a build site's shortfall now subtracts materials already carried; a short recipe offers
  哪儿有卖 while a pot is on (so the timer guard is reachable — covered by a new spec); unsold items
  are named; any interaction whose id matches the route key (a stall keeper, the metro) clears it.
- Tutorial: a step's route no longer replaces a route the player picked; 做到了！ is shown for the
  talk step (celebrated from the frame loop once the conversation closes); importing a save
  clears a leftover tutorial route; the spec now really crosses the yaw wrap; the arrival line
  only shows to players the tutorial will actually start for.
- Welcome sign: the board's hitbox was narrowed to clear its posts (the footprint-conflict spec),
  and `city.spec.js` now tilts the view up to name the sign, which no longer fills eye level.
- `tests/browser/home-access.spec.js` holds the walk to the front door under 26–27 m (it was 31 m
  from spawn and 44 m from 陈叔叔's stall).

Full browser suite: 81/81 with two workers. At the default worker count, `taxi.spec.js` "too poor
for the fare" and a `noodles.spec.js` ordering test occasionally miss their E press 240 ms after a
warp; both pass alone and in the two-worker run.
