# Roots Chapter One Implementation Plan

## Current status

Three broad phases, split into nine implementation stages. This plan covers the first Roots chapter, not the full HSK 1–4 game.

| Stages | Phase | Status |
| --- | --- | --- |
| 1–3 | Content, flexible answers, mastery | Implemented and locally tested |
| 4–6 | Save progression, photography, playable chapter | Implemented; full local chapter playthrough passed |
| 7–8 | Server income and collection/bank integration | Implemented; isolated PostgreSQL and client recovery tests passed; not deployed |
| 9 | Final verification and handoff | Real multi-connection checks passed; human language/voice review and hosted deployment checks remain |

The original checklist below describes the planned workflow; current evidence is recorded in `2026-09-28-roots-validation.md`. No merge or deployment is authorized.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the late-grandfather introduction and one complete fruit-stand chapter with flexible Mandarin answers, forgiving paid photography, mastery, and verified offline income.

**Architecture:** Extend existing conversation, camera, profile, and Supabase boundaries. Keep narrative and accepted-language content in JSON, story/mastery transitions in pure rules, and authoritative business settlement in database transactions. Deliver three testable phases: language, local story/photography, then online business integration.

**Tech Stack:** Existing Vite, PlayCanvas 2.22.1, JavaScript ES modules, Supabase JS, PostgreSQL, Node tests, Playwright/Edge.

**Spec:** `docs/superpowers/specs/2026-09-28-roots-chapter-one-design.md` (approved in conversation).

## Global Constraints

- Work in `C:/Users/jonat/Documents/ChatGPT/Game-development`, the existing development checkout. Preserve its extensive uncommitted work. Check for concurrent edits before each shared-file change; do not reset, stage, commit, push, or deploy without a separate request.
- Obtain filesystem permission for this sibling checkout when needed; do not silently implement in the older Game checkout.
- Six starter exposures; five exposures cost 10 coins; reopening costs 20; income is 30 coins per real day; manual cap is 72 hours; automation costs 90 per business and raises its cap to 168 hours.
- Mastery requires two distinct independent prompt variants for each of three skills. Typed and edited microphone answers are equal. Help-assisted answers never clear a mastery requirement.
- Chinese first; optional pinyin/English; authored lines get clips through the existing voice pipeline. Exact HSK labels require verified mapping.
- No local-clock payout fallback. Existing local economy remains editable; this feature protects business timestamps and server claims, not every possible save alteration.
- No new runtime dependency unless existing tools cannot satisfy the accepted design. No live LLM evaluator.
- Each rule task uses red/green tests. Task completion requires the named tests and inspection of its incremental diff, not a commit.

## Review Focus

1. A stale microphone callback must not fill another NPC's input after closing the conversation (Task 3).
2. A crash between writing a photo and charging film must not create a free repeatable exposure or charge without an image (Task 5).
3. Two tabs collecting or upgrading while auto-save runs must not duplicate money or erase local progress (Tasks 7–8).
4. A device with a story-completion flag but no image bytes must retain progress and offer a free replacement (Tasks 5–6).
5. Switching accounts during a pending payout must not apply the prior account's response to the new player (Task 8).

## Task 1: Baseline, content contract, and fixtures

**Files:** Read `CLAUDE.md`, `docs/CONTENT_MAP.md`, `playwright.config.js`, existing tests; create `tests/fixtures/roots.js`, `src/content/roots.json`, `src/content/businesses.json`; extend `scripts/check-content.js`.
**Interfaces:** `roots` JSON exposes `opening`, `memories`, `skills`, `lessons`, `ui`, `film`; `businesses` exposes the `fruit-stand` display definition. Use stable IDs: `roots-fruit`, `roots-square`, `roots-home`, `roots-next`, and skills `roots-greeting`, `roots-fruit-request`, `roots-quantity`.

- [ ] Record branch/status and a file-hash baseline without changing staging. Confirm nobody is currently editing the same development files. Run `npm run verify`; record any pre-existing failures by name.
- [ ] Inspect the square fruitstand position and collision footprint before assigning the caretaker/interaction IDs. Keep its existing location unless an access obstruction requires a small adjustment.
- [ ] Add content-validation tests for missing referenced IDs, fewer than two independent variants per skill, missing model answers, invalid prices, and contradictory match definitions. Run them and confirm failures.
- [ ] Author the chapter content, caregiver dialogue, journal, and help text as normal Mandarin with translations. Store exact accepted alternatives and bounded templates; no guessed HSK tags. The deceased grandfather supplies no newly sent dialogue.
- [ ] Implement validation and run `node --test tests/roots-content.test.js`, then `npm run check:content`; expect all new checks to pass. Generated content-map changes are allowed only through the generator.

## Task 2: Shared flexible-answer evaluation

**Files:** Modify `src/core/language.js`, `src/core/conversation.js`; create `tests/answers.test.js`; extend `tests/conversation.test.js` and affected lesson JSON.
**Interfaces:** Preserve `matchAnswer(text,node)` and `evaluateNode(node,text)` callers. Enrich results to `{ok,value?,choice?,reason?,examples?}`. Content `answerRules` contains allowed templates, slot alternatives, and forbidden combinations. No executable JSON regex/code. Existing exact `accepted` entries remain supported.

- [ ] Add cases with the real matcher: `assert.equal(evaluateNode(twoApples,'麻烦给我两个苹果。').ok,true)`; the five accepted forms in the spec must pass. `我不要两个苹果`, `我要三个苹果`, and `香蕉` must fail for this node. `不要香蕉，要两个苹果` passes only when explicitly supported. Run `node --test tests/answers.test.js` and observe the missing behavior.
- [ ] Normalize Unicode/punctuation and numeric slots; match exact alternatives or complete authored templates with optional polite segments. Require all objective-specific slots and reject ambiguity/contradiction. Preserve name validation and option values/state routing.
- [ ] Add tests for Arabic 2, 两/二 context, zero/negative quantities, oversized text, punctuation-only input, conflicting destinations, negated requests, valid short answers, and unsupported but plausible replies. Unrecognized replies return neutral feedback, not a claim of incorrect Chinese.
- [ ] Audit NPC text submission sites with scoped search. Adapt food orders, taxi/destination options, social replies and haggling where applicable; keep affordability, numeric-offer, and route checks. Expand authored alternatives in their content files. Do not broaden isolated vocabulary-recall tests into unconstrained conversation.
- [ ] Run `node --test tests/answers.test.js tests/conversation.test.js tests/core.test.js` plus the tests of each touched adapter. Expect all new variants and old behavior to pass.

## Task 3: Attempt-level help and mastery

**Files:** Create `src/core/mastery.js`, `tests/mastery.test.js`; modify `src/ui/dialogue.js`; create `tests/browser/roots-dialogue.spec.js`.
**Interfaces:** `recordAttempt(state,{skillId,variantId,ok,assisted},skills) -> newState`; `mastered(state,skillId,skills) -> boolean`. State stores independent successful variant IDs per skill. Dialogue accepts optional lesson data and an `onAttempt` callback while preserving existing `openDialogue(ctx,lessonId,{onFinish})` calls.

- [ ] Write failing assertions that repeating one variant does not master a skill, two distinct independent variants do, assisted successes do not, and a later miss retains earlier success.
- [ ] Implement immutable mastery rules and per-attempt help state. Showing correction examples marks the current attempt assisted. Offer a different prompt for independent retry. Replay/slow audio does not count as answer help.
- [ ] Add failure feedback with a model answer and alternatives from content, retaining typed text and respecting help settings. Successful alternative wording is full success. Preserve speech editing; never auto-submit transcripts.
- [ ] Add a browser test that opens help, submits an example, then demonstrates a different variant independently; verify only independent evidence counts. Test callback arrival after close, IME composition, keyboard focus and microphone-unavailable typing.
- [ ] Run `node --test tests/mastery.test.js` and the isolated roots-dialogue browser spec; expect all assertions green.

## Task 4: Story transitions and save migration

**Files:** Create `src/core/roots.js`, `tests/roots.test.js`; modify `src/core/profile.js`, `src/core/learning.js` only as needed; extend `tests/saves.test.js`.
**Interfaces:** `normalizeRoots(value) -> RootsState`; `applyRootsEvent(profile,event,content) -> {changed,reward}`; `currentRootsObjective(profile,content) -> objective|null`. Roots state contains introductory gift claim, discovered memories, completed photos, mastery, journal, pending reopening and a server business snapshot. Server snapshots do not authorise client payouts.

- [ ] Write failing tests for a pre-feature profile retaining wallet/inventory/furniture/friends, one-time six-film gift, repeat introductions, and invalid state IDs.
- [ ] Add an additive save-version migration and bounded normalization. Reuse claim IDs for local gifts. Do not copy old generic check-ins into story-photo completion.
- [ ] Implement discovery and chapter progression using events. Photo and mastery may arrive in either order; reopening needs both. House access remains available before mastery. Reopening/payment is pending until online activation (Task 8), preventing a local debit followed by a second server charge.
- [ ] Test event replays, reload at each milestone, all three mastery requirements, missing money, and fourth-photo unlock only after successful activation. Expected starter film assertion: `assert.equal(profile.inventory['film'],6)` after two gift events, with no other possessions changed.
- [ ] Run `node --test tests/roots.test.js tests/saves.test.js`; expect green.

## Task 5: Forgiving photography and recoverable film spending

**Files:** Create `src/core/story-photo.js`, `src/services/photos.js`, `tests/story-photo.test.js`; adapt `src/ui/camera.js`, `src/ui/album.js`, `src/core/checkins.js`; extend `tests/browser/camera.spec.js`.
**Interfaces:** `qualifiesMemory(memory,shot) -> boolean` consumes place, subject ID, distance, visible-in-view flag and occlusion result. `commitCapture({captureId,profileId,memoryId?,src,filmCost},store,profileStore)` and `recoverCaptures(profileId,store,profileStore)` own capture recovery. Move only the necessary existing IndexedDB access into the photo service.

- [ ] Add failing tests for generous off-centre framing, wrong place, subject behind the camera, obstruction, invalid story shutter with zero debit, one debit for personal photo, and double-click protection.
- [ ] Extend geometry querying to allow the target anywhere in a generous view area while retaining visibility/occlusion. Show validity for the selected memory and recheck on shutter. Personal mode is explicitly paid; looking/cancelling is free.
- [ ] Implement an IndexedDB pending capture record with a stable capture ID and profile identity. Persist image/pending operation, write the idempotent profile debit/completion, then finalize the capture. On reload reconcile both stores before allowing another capture. If the profile write fails, retain the pending record for safe recovery or rollback; do not grant access to unpaid images. Profile identity must distinguish imported/replaced saves.
- [ ] Protect story images from the personal 60-photo eviction. Recover missing completed-story images by an explicitly free replacement. Persist flags even when image bytes are absent on another device.
- [ ] Test injected failures before/after each storage stage, duplicate recovery, storage quota exhaustion, deleting personal photos, and account/profile changes. Run `node --test tests/story-photo.test.js tests/checkins.test.js` and camera browser tests; expect no lost exposures or duplicate debits.

## Task 6: Playable local chapter and assets

**Files:** Create `src/ui/roots.js`, `tests/browser/roots.spec.js`, `public/images/roots/`; integrate `src/main.js`, `src/ui/panels.js`, `src/ui/shop.js`, `src/ui/bank.js`, `src/content/catalog.json`, `src/content/npcs.json`, `src/content/world.json`, `src/style.css` only at required boundaries.
**Interfaces:** `openRootsAlbum(ctx)`, `openRootsCaretaker(ctx)`, `showRootsOpening(ctx)`, `refreshRootsWorld(ctx)` consume Tasks 1–5. Business commands use Task 8's adapter; pending setup has honest online-required UI until available.

- [ ] Add a failing browser journey: dismiss opening, reopen album, independently approach caretaker, show photograph, visit house, complete practice, capture memory and reach pending reopening without forced NPC approaches.
- [ ] Implement opening, three starter memories, clue help, story gallery, caretaker and journal. Add the film pack using existing purchasing rules. Render a stocked stand/repaired sign only after reopening. Reuse HUD stacking and existing accessible controls.
- [ ] Generate coherent archival illustration assets using the image skill. Produce NPC clips through `scripts/generate-voice.py`; update voice content sources and let the pipeline own the manifest. Listen for pronunciation/naturalness and record review status.
- [ ] Test old saves keep home layout and tutorial progress; zero coins/film never block free practice; chapters resume after reload; missing images keep progress; Chinese-first help, keyboard, touch and HUD overlap behave correctly.
- [ ] Run the roots browser journey, `npm run check:content`, and voice coverage. Require real assets and generated clips for chapter completion; no placeholder-only success claim.

## Task 7: Authoritative business ledger and database proof

**Files:** Create `supabase/migrations/20260928000000_roots_businesses.sql`, `supabase/tests/roots_businesses.sql`; extend `docs/CLOUD_SETUP.md`.
**Interfaces:** RPC `roots_business_command(p_business text,p_action text,p_request uuid,p_seen timestamptz)` where action is activate/collect/automate; returns status, canonical profile, save revision, payout amount and business snapshot. Read-only `roots_business_status()` returns server time and the caller's records. No client amount/time/rate arguments.

- [ ] Establish an isolated PostgreSQL/Supabase test database. Local psql, Docker and Supabase executables were not found during planning; discover an available test environment or arrange test tooling before claiming SQL validation. Never test financial mutations against live players.
- [ ] Write database tests that call real SQL under authenticated/anonymous roles. Assert 12 hours earns 15, manual 4 days caps at 90, automated 8 days caps at 210, duplicate request pays once, and two users cannot access each other's records. Run before migration behavior exists and capture expected failures.
- [ ] Add protected ledger/receipt/config tables with RLS, explicit grants and security-definer functions with fixed search paths. Validate auth identity and action/business IDs; lock save and business records in consistent order. Enforce idempotency before mutation and bind request IDs to operation inputs.
- [ ] Use database UTC time and rational/integer remainder arithmetic, cap elapsed accrual, charge activation/automation atomically, and settle old terms before upgrading. Start accrual at activation; no retroactive local progress timestamps.
- [ ] Integrate the existing five-second save throttle: return a retryable outcome and roll back the entire transaction when throttled, never bypass it with a client-settable flag. Preserve the 1 MB save bound. Guard server business snapshots and settlement revisions on ordinary save writes; deleting/recreating saves cannot recreate receipts or reset the ledger.
- [ ] Add two-connection concurrency tests and tests for stale p_seen, insufficient money, malformed actions, forged snapshot writes, save deletion/recreation, fractional remainders and upgrade boundaries. Use server-owned SQL fixtures for historical timestamps only in the isolated test database, never a production time-override parameter.
- [ ] Run migration plus SQL suite with the chosen database tool, requiring zero assertion failures. Document exact repeatable commands and deployment/rollback steps. Keep ledger data on rollback; disable RPC access instead of dropping earned records.

## Task 8: Cloud settlement, collection and automation UI

**Files:** Create `src/services/businesses.js`, `src/core/business-sync.js`, `tests/business-sync.test.js`, `tests/browser/roots-business.spec.js`; adapt `src/services/cloud.js`, `src/core/cloudsync.js`, `src/ui/panels.js`, `src/ui/bank.js`, `src/ui/roots.js`.
**Interfaces:** `commandBusiness({businessId,action,requestId,seen}) -> BusinessResult`; `readBusinesses() -> status`. `settleBusiness(ctx,action)` coordinates cloud flush, account identity, revision and request lifecycle. Results distinguish settled, conflict, throttled, offline, signed-out, insufficient-funds and unavailable-backend.

- [ ] Write failing tests for a duplicate response, stale revision, concurrent auto-save, loss of connectivity after server commit, and account switch during a pending request. Inject an API for client tests; do not confuse it with SQL proof.
- [ ] Serialize business mutation with normal save synchronization. Flush local work first, retain request IDs across retries, and update seen/known revisions together. Keep existing user conflict choices and backup behavior; never silently prefer server state over unsynced progress.
- [ ] Wire manual collection to caretaker interaction. Wire automation purchase to bank practice mastery and server confirmation. Automated collection runs on reconnect and a bounded connected refresh interval (60 seconds), not every animation frame. Server ledger remains authoritative while closed.
- [ ] Display pending reopening and online-required income honestly for local-only players. In admin/e2e use a build/mode-limited isolated ledger, with no production network fallback. Sign-out clears pending account-bound UI operations; late responses are ignored and recovered under the proper account later.
- [ ] Test duplicate-click UI, offline recovery, 5-second throttle retry, and that automatic collection only affects the upgraded business. Run `node --test tests/business-sync.test.js tests/cloudsync.test.js` and the roots-business browser spec; expect green.

## Task 9: Integrated verification and handoff

**Files:** Extend relevant browser tests and add `docs/superpowers/plans/2026-09-28-roots-validation.md` containing actual results, not planned results.

- [ ] Run the entire chapter from a new profile and an existing migrated profile, through activation, collection, bank upgrade and fourth-photo discovery. Verify recorded outcomes against every acceptance item in the approved spec.
- [ ] Run `npm run verify`. Run focused browser specs for roots, roots-dialogue, roots-business, camera and cloud, then affected existing NPC/shop/taxi flows. Use e2e mode with blank production cloud settings and a free PW_PORT; do not reuse the user's admin server.
- [ ] Run the real database suite. Capture screenshots of opening, correction feedback, album, photo validity and business collection; inspect keyboard/touch and HUD layout. Review Mandarin and listen to the new voice clips.
- [ ] Obtain a focused independent review of cross-store recovery, save migration, matching false positives, SQL permissions and concurrency. Fix findings and rerun the relevant proof, then the required overall gate after code changes.
- [ ] Record files changed, tests/results, known pre-existing failures, backend setup still needed, and exact rollback steps. Do not describe business income as live until the deployed database migration is confirmed. Do not push/publish without user authorization for the concrete release.

## Execution recommendation

Native execution in this chat, with one focused independent review at the end, minimizes repeated
context while the shared profile/UI/cloud interfaces remain closely coupled. Subagent-driven
execution is available if the user prefers per-task independent reviews. Implementation begins
after the user reviews this plan and chooses the method. No commit steps are included because the
repository explicitly reserves staging and committing for a separate user request.
