# Metro and Condition Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a rechargeable-card Qinghe–Yunhai journey with physical train boarding, redesigned stations and a visible low-needs reminder.
**Architecture:** Extend existing metro rules and saves; keep journey state independent of station geometry and ride presentation. Use editable route/station content and reuse announcements, wallet and stats.
**Tech Stack:** JavaScript modules, PlayCanvas, Vite, Node tests, Playwright.
**Spec:** ../specs/2026-09-30-metro-redesign-design.md

## Global constraints
- One operating route: Qinghe–Yunhai. Future lines are labelled inactive placeholders.
- Five coins each way, no emergency/free return. Players may study to earn top-up money.
- Preserve old ticket value and unexpired pass validity; top-ups transfer existing wallet money.
- Physical boarding precedes scenic travel or fade. Skip changes presentation only.
- Preserve cute low-poly style and English beginner guidance. Original images: ../../references/metro/.
- No business-income deployment, apartment construction, new dependencies or automatic merge in this scope.
- Reuse the available release checkout after checking current modifications; preserve unrelated files and running previews.

## Review focus
1. Reload during charging or transit: one fare and recoverable location (tasks 2, 4).
2. Doors close on the player: safe platform/carriage placement (task 3).
3. Both needs low, only one restored: badge remains (task 1).
4. Insufficient return funds: study remains accessible, no free trip (tasks 2, 5).
5. Future-line entrance looks usable: clearly closed, cannot charge (task 5).

### Task 1: Condition warning
**Files:** src/ui/shell.js, src/style.css; reuse src/core/stats.js and src/core/keys.js; tests/browser/condition-warning.spec.js.
**Interface:** HUD derives the badge from readStats(profile) and existing band(value); do not persist a separate alert flag.
- [ ] Inspect the current stat bands and HUD refresh/key rendering; write a failing browser test for hunger-only, rest-only, both low and healthy defaults.
- [ ] Add one non-flashing exclamation badge above Condition's key label, with accessible text naming the low need(s). Keep current button action and key mapping.
- [ ] Verify eating/sleeping clears the relevant warning, one remaining low need retains it, remapping follows the shortcut, and narrow layouts do not overlap adjacent controls.

### Task 2: Card and journey rules
**Files:** src/core/metro.js, src/core/profile.js, src/content/metro.json, src/content/city.json; tests/metro.test.js, tests/saves.test.js.
**Interfaces:** topUpCard(profile, amount), quoteFare(origin,destination), enterJourney(profile,origin,destination), cancelJourney(profile), completeJourney(profile,journeyId). Return structured ok/reason/cost results; mutations use existing profile save ownership.
- [ ] Write failing tests for top-up conservation, insufficient balance, same-route five-coin fare in both directions, invalid amounts and destinations, and fare-band distance boundaries.
- [ ] Add route distance/fare data and card balance, reserved fare, journey ID/phase to saved metro state. Migrate unused rides at legacy single-ticket value, retaining unexpired passes and trip/listening counters.
- [ ] Implement reserve/cancel/complete with a single completion receipt; test duplicate arrival, reload and cancellation never lose/duplicate money. Remove normal and emergency free-return paths.
- [ ] Run metro/save tests and confirm old saves load with unrelated progress preserved.

### Task 3: Qinghe station and physical train
**Files:** src/world/city.js, src/world/interior.js, src/world/town.js, src/content/rooms.json; new src/world/metro-train.js; tests/browser/metro.spec.js.
**Interface:** train controller exposes stopped/open/closing/departed state, door trigger volumes, boarding membership and safe arrival/exit points. World update advances it with bounded delta time.
- [ ] Locate existing station construction, landing machine, platform interaction and NPC registration. Add a failing test that proximity alone never boards.
- [ ] Replace outside ticket-selling interaction with station machines/gates; rebuild the underground platform from saved references. Keep exit and top-up routes accessible.
- [ ] Implement visible arrival/departure, synchronised platform/train doors and walk-in carriage boarding. Keep track space inaccessible.
- [ ] Test walking through open doors, rejecting closed-door boarding, leaving before departure and safely resolving a player in the doorway. Inspect screenshots and collision paths.

### Task 4: Travel UI and recovery
**Files:** src/ui/metro.js, src/main.js, src/core/profile.js; new src/ui/transit-card.js if needed to keep machine UI separate; tests/browser/metro.spec.js.
**Interface:** station UI uses task 2 rules; train boarding event starts the existing announcement/ride flow; arrival completes the saved journey once.
- [ ] Write failing tests for physical boarding before ride, normal arrival and skip producing identical fare/location, plus reload at each journey phase.
- [ ] Add top-ups and clear fare/balance feedback, short scenic carriage travel, Skip to arrival and saved always-fade preference. Reuse recorded announcements.
- [ ] At arrival open doors onto the destination platform and allow walking out. Preserve existing optional listening practice without rewarding skipped questions.
- [ ] Verify typing/study access with insufficient funds and both-direction travel, including existing passes. Run relevant browser tests.

### Task 5: Yunhai Central and integration
**Files:** src/world/city.js, src/world/town.js, src/content/city.json, src/content/rooms.json; new src/world/metro-station.js if shared platform construction warrants extraction; tests/browser/metro.spec.js, tests/browser/city.spec.js.
**Interface:** destination station defines safe train/platform/concourse/city transitions; inactive line entrances are scenery/content only.
- [ ] Add failing checks for arrival inside the station, a walkable city exit, return route and inactive placeholder entrances.
- [ ] Build the grand high-ceiling hall with decorative ring lighting, bilingual directions and colour-coded future-line spaces. Build one operational line only.
- [ ] Play through top-up, gate entry, board, ride/skip, alight, city exploration and paid return. Verify low-funds study and Condition reminder during travel.
- [ ] Run npm run verify and relevant metro/city/Condition browser checks. Compare screenshots to references, inspect geometry and browser responsiveness. Fix only task-related regressions.
- [ ] Record results and remaining limits; obtain a final code review. Keep changes available for review, without merging automatically.

## Execution handoff
Recommend native execution in this chat because card, journey and world transitions share sequential interfaces. Review this written plan before implementation; use a single final independent review rather than a fresh agent per task.

## Apartment question
The earlier Roots concept (2026-09-28-roots-story-design.md, Layer 2) mentions renting/decorating a Yunhai apartment. No apartment-complex implementation or detailed delivery plan was found. It remains a separate future feature.
