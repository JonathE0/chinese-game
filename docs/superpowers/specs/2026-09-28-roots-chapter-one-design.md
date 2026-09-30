# 寻根 · Roots — first playable chapter

Status: proposed implementation specification, awaiting user review. No implementation is claimed.

This specification supersedes the grandmother/alive-relative premise in
`2026-09-28-roots-story-design.md`. It records the subsequent design conversation and scopes the
first release to one complete fruit-stand chapter. The later businesses remain future chapters.

## Intent and agreed direction

The player learns Mandarin while exploring a warm, open Chinese town and discovering the life
of their late grandfather. His death is stated gently at the start, never used as a surprise twist.
His last gift is a photo album, a letter, and a key to his former house. The player discovers his
connections independently; no living grandfather sends new replies or directs the discoveries.
Dated letters and recordings may supply memories, never simulated posthumous conversations.

The town stays open. NPCs do not approach the player to initiate the story. Photographs and clues
invite exploration, and the player chooses when to introduce themselves. Some residents knew
爷爷 personally; others recognise his name only after an introduction or seeing a photograph.
Business connections are varied: he owned, co-owned, worked at, or helped establish different
places. A photograph does not automatically transfer somebody else's business to the player.

The first venture is a fruit stand. Establishing businesses creates passive income, including
while the game is closed. Collection starts in person; automation is purchased separately for
each business. Language mastery gates story and business progression, with help available for
practice. Natural alternative answers count equally for speech and typing.

## Concrete first release

Include:
- A dismissible opening explaining the loss and the final gift, available to reread in the album.
- Three starter photographs: the fruit stand, the square, and the grandfather's old house.
- An explorable house connection, preserving the existing house and decorating system.
- One fruit-stand caretaker, a complete discovery and reopening sequence, and a follow-up photo.
- A separate story-album section with clues, objectives, original images, and recreated photographs.
- Paid film, a validity preview, generous story-photo matching, and a starter supply.
- Flexible answer evaluation, corrective examples, and a mastery gate for the first chapter.
- One business with server-timed earnings, manual collection, and a per-business automation upgrade.
- Safe migration for existing saves, plus content, unit, database, and browser verification.

Exclude from this release: the remaining business chapters, new districts, a global town-rank
system, business employees with simulations or compulsory chores, live AI answer evaluation,
and a fully server-authoritative economy for every existing activity.

## Proposed defaults for review

These values were not explicitly settled in conversation. They are starting values for testing,
kept in content or server-owned business configuration rather than embedded in UI code:

| Rule | Initial value |
| --- | --- |
| Starter film | 6 exposures, once per save |
| Film pack | 5 exposures for 10 existing learning coins |
| Fruit-stand reopening contribution | 20 coins, after mastery |
| Fruit-stand income | 30 coins per 24 real hours |
| Manual accumulation cap | 72 real hours, maximum 90 coins |
| Automatic collection upgrade | 90 coins for this stand only, after banking practice |
| Automated accumulation cap | 168 real hours, maximum 210 coins |
| Mastery | Two independent successes for each of three skills, using distinct prompt variants |
| Input methods | Typing and corrected microphone transcripts have equal standing |

Use a relaxed single-player economy with protected business payouts. Existing local learning
rewards and purchases remain editable client state; this release does not claim to prevent all
save editing or cheating. Protect time calculations and duplicate server claims specifically.

## Player experience

1. **Arrive.** An opening card clearly states that the grandfather has died. His letter, album,
   and house key appear without a forced NPC conversation. Closing the card returns control;
   reading it again does not award another starter pack. Existing players see a new album notice
   without being teleported, losing furnishings, or replaying the old tutorial.
2. **Explore.** The square and house photos provide optional nearby discoveries. The house can be
   visited without passing a language test. A stored letter adds personal context. Album entries
   show only clues already found; an optional help control gives a clearer next step.
3. **Find the fruit stand.** Reuse a square fruit-stand location and visual model after checking
   the current layout. Give the stand and caretaker stable interaction IDs. The caretaker's
   normal greeting remains available; showing the photo starts the story branch. They explain
   that the grandfather helped establish the stand and worked there with them.
4. **Practice and demonstrate mastery.** Three practical skills cover greeting a customer,
   identifying/requesting fruit, and supplying the requested quantity. Practice is free. Help,
   example answers, and slow/replayed audio remain available. Mastery rules are described below.
5. **Recreate the photograph.** This can happen before or after the language practice. A valid
   photo is remembered, so the player never has to spend another exposure merely because they
   completed steps in a different order.
6. **Reopen together.** After the photo and mastery are complete, the caretaker offers a clear
   partnership with a 20-coin contribution. The player chooses to pay; inadequate funds cause no
   lost progress. Existing learning activities remain available to earn coins. A small visible
   change, such as the repaired sign and stocked crates, marks the reopening.
7. **Collect.** Earnings start at server-confirmed activation, not at an imported local timestamp.
   Manual collection requires interacting with the caretaker and being connected. The collection
   conversation is short; additional practice is optional and does not withhold earned income.
8. **Automate.** A bank setup conversation introduces payments, with its own independent practice
   check. Purchasing the stand's upgrade enables automatic settlement on reconnect and periodic
   connected refresh. This is a transfer arrangement, not hiring a simulated worker.
9. **Discover more.** Reopening unlocks a fourth photograph shared by the caretaker, hinting at a
   later connection. It is a keepsake, not a quest requiring an unimplemented region. The chapter
   ends with a journal entry addressed to 爷爷; it never receives a reply from him.

## Flexible answers and mastery

Extend the existing `language.js` and `conversation.js` evaluation boundary; do not bolt a second
unrelated evaluator into each screen. Audit every free-text NPC interaction (dialogue, food
orders, shopping/haggling, taxi and social interactions) and route compatible answer evaluation
through shared normalization and matching helpers. Preserve separate transactional checks such
as affordability and allowed destinations. Vocabulary recall exercises still test the target word;
accepting a conversational synonym must not silently change a spelling/recall objective.

Content defines multiple exact accepted phrases, canonical examples, and bounded intent rules.
Rules describe required concepts and slots (item, quantity, destination), allowed alternatives,
optional politeness, and explicit contradictions. Use finite, authored templates and synonyms,
not arbitrary keyword inclusion or substring matching. Exact matches and approved composed
variants both count as fully correct; no penalty for wording different from the model answer.

Examples for requesting two apples include 我要两个苹果, 我想买两个苹果, 给我两个苹果吧,
麻烦给我两个苹果, and 两个苹果，谢谢. Bare 苹果 can answer a fruit-identification question but
cannot satisfy a task requiring two apples. 我要三个苹果 has the wrong quantity; 我不要两个苹果
must not pass because it contains the expected keywords. Negated alternatives and corrections
such as 不要香蕉，要两个苹果 need an explicitly supported composition, not a universal ban on 不.
Digits and Chinese numerals are equivalent within supported numeric slots; handle 二/两 in context.
Keep normalization bounded; do not silently turn arbitrary malformed text into a correct answer.

When a response is incomplete, contradictory, or unrecognised, preserve the input and show an
appropriate model answer plus alternatives. Say the game did not understand when uncertain,
not that all unmatched Chinese is wrong. Explain a missing required detail when it is known.
All feedback is Chinese-first; pinyin/English follow help settings. Recognition is curated and
cannot promise to understand every valid Mandarin sentence.

Speech produces editable text and never auto-submits. Both input modes use the same evaluator.
Do not penalise speech-engine confidence or require a microphone. An unrecognised answer can
be reported locally with its prompt for later content improvement; no automatic external upload.

Keep help state per attempt, rather than using the current lesson-wide supported flag alone.
Opening translation/pinyin or model-answer help marks that attempt as assisted. Replaying or
slowing the question does not. An assisted success is practice, not mastery. Offer a different
prompt variant next; do not award independent mastery for immediately copying the shown answer.
Require two independent successful variants for each skill. Persist earned successes by skill
and variant; replaying the same variant does not manufacture mastery. Mistakes do not erase prior
successes, cost coins, or force restarting the conversation. A mastered skill need not be repeated
when returning later. The next story milestone unlocks only after all three skill requirements.

## Photography and film

Separate the story album from the existing personal-photo gallery. Starter and discovered archival
images are authored assets, with captions and accessible descriptions. Recreated photos are actual
player captures. Story progress persists in the profile independently of local image storage.

All newly saved camera photographs consume one exposure after the feature is introduced. Merely
looking through the viewfinder, cancelling, or failing to save an image consumes none. A shutter
lock prevents double spending from rapid clicks. Preserve existing personal photos and check-ins.
Explain the change to existing players and award their one-time starter film too.

In story mode, show whether the selected memory qualifies before shutter release. Require the
correct place and a relevant visible subject within a generous distance and view area. Exact
framing, angle, pose, weather, and time do not matter for this chapter. Do not accept shots through
walls, from another district, or with the relevant subject behind the camera. Reuse registry
geometry for visibility and use a wider view-area check than the current centre-ray lookup.
Revalidate on capture; an invalid story attempt does not spend film. A separate personal-photo
mode allows non-quest pictures and clearly consumes film.

One shutter/save operation must either store the image and record the film debit and story event,
or leave the exposure unspent and permit retry. Since IndexedDB and the profile are separate
stores, use a capture ID and pending-operation recovery rather than assuming one cross-store
transaction exists. Test reloads between storage and profile writes.

Story captures are excluded from the personal gallery's 60-image eviction. Missing local image
bytes on another device never revoke a completed objective; show a clear local-image notice and
allow an optional free replacement capture for that completed memory. Do not put image data in
the existing size-limited cloud profile. Film shortages cannot block free learning or exploration.

## Server time and business income

Reuse the existing Supabase account and cloud-save integration. Add an additive database migration
for per-user business records and narrowly scoped authenticated RPCs. Business records store the
activation time, settlement cursor, accrued remainder, upgrade state, and operation receipts.
Rates and caps come from trusted server configuration, never client-supplied amounts or time.

Calculate fractional-day earnings from database UTC time, with integer coin settlement and a
retained fractional remainder. Cap the uncollected interval. Sleeping in the game, changing time
zones, changing the OS clock, or sending a fabricated timestamp must not affect the calculation.
Accrue the old rate/cap up to an upgrade transaction before applying the new rules, so purchasing
an upgrade does not retroactively improve an old interval.

Each activation, collection, and upgrade request uses an idempotency key. Lock the relevant rows
and atomically update the ledger, accepted cloud profile wallet, and save revision. Duplicate or
concurrent requests return the recorded outcome. Use the existing cloud-save conflict mechanism:
settle only against an acknowledged revision, refresh on conflict, and never discard unsynced
local progress to force a payout. Account switches must not carry requests or earnings across users.

Ordinary cloud-save writes must not overwrite server-owned business fields or erase the latest
settlement revision. Enforce that boundary in SQL, not only in UI code. Preserve the current
save-size and write-rate protections. RPC permissions and row-level policies prevent cross-user
reads, client-written timestamps/rates, and unauthenticated payouts. No service-role credential
belongs in the browser.

This protects offline payout time and server transaction replay. It does not certify client-learned
mastery or prevent forging the rest of a locally editable wallet. Document that boundary plainly.

Offline players can complete the chapter and record a pending reopening. Income starts when they
sign in and activate it on the server; local time is never used to backdate it. With no configured
backend, show that verified income requires online setup rather than simulate trusted payouts.
Admin/e2e mode uses an isolated controllable test ledger, visibly test-only, never production rows.

## Architecture and persistence

- `src/content/roots.json` (new): narrative, memory definitions, objective text, caretaker dialogue,
  answer rules, model alternatives, skill prompt variants, and UI copy.
- `src/content/businesses.json` (new): public business descriptions and display values. Validate
  consistency with authoritative server balance constants; frontend values do not authorise money.
- `src/core/roots.js` (new): monotonic story transitions, discovered-photo sets, prerequisite checks,
  and replay-safe reward IDs. It consumes events; it does not manipulate scene entities.
- `src/core/mastery.js` (new): per-skill independent/assisted evidence and variant selection.
- Existing language/conversation modules: shared answer evaluation and explicit result reasons.
- Existing profile migration/normalization: versioned Roots state, validated bounded IDs, safe
  defaults. Preserve wallets, inventories, furniture, friendships, tutorial state, and existing claims.
- Story UI and thin adapters: album, caretaker conversation, current-objective HUD, camera, bank,
  and world interactions. Content remains editable JSON; scene code only places/interacts.
- `src/services/businesses.js` (new): RPC adapter and typed failure outcomes integrated with cloud
  save coordination. Unit rules use injected time/ledger dependencies; production settlement is SQL.
- Additive Supabase migration and database tests: ownership, settlement, conflict handling, and
  permissions. Update cloud setup instructions for deployment and new endpoints.

Use stable IDs for memories, skills, dialogue nodes, receipts, and business records. Completing
steps out of order is supported where logically valid; every transition and reward is idempotent.
Never interpret an old generic check-in as a newly paid story photograph without explicit migration.

## Assets, accessibility, and failure behavior

Create the archival photographs as coherent illustrated snapshots in the game's visual style;
avoid placeholder images in the shipped chapter. Generate authored NPC voice clips through the
existing production script and validate manifest coverage. Label their review status honestly;
AI-generated speech requires listening review for pronunciation and naturalness before release.

Keep keyboard and touch flows, focus restoration, labels, readable feedback, and reduced-motion
preferences. Use the existing HUD layout so objectives, word-added notices, and interaction prompts
do not overlap. No grief-triggered gameplay penalties, timed story choices, or unskippable opening.

Network/auth errors retain progress and offer retry. Storage failures do not charge film. Unknown
answer rules fail content validation. Save upgrades are additive and repeat-safe. Existing missing
voice assets or unrelated test failures are reported separately rather than silently dismissed.

## Acceptance and verification

Before each rule change, add a focused failing test. Run `npm run verify` after implementation and
focused Playwright coverage on the isolated e2e server. Required proof includes:

- Old saves retain all existing possessions and progress; opening gifts and milestones pay once.
- Starter photos, house interaction, caretaker discovery, mastery, photograph, reopening, journal,
  and fourth-photo discovery form one playable sequence and resume correctly after reload.
- Accepted alternative phrases are fully correct; wrong quantities, negation, mixed intentions,
  empty input, punctuation, digits, and unsupported phrases have explicit regression cases.
- Assisted attempts cannot unlock mastery; distinct independent variants can; speech and typing
  submit through the same path. Prior skill successes survive mistakes and reloads.
- Correct off-centre photographs pass; wrong locations and obscured subjects fail without film
  loss; successful personal shots spend once. Storage failure, rapid shutter clicks, and interrupted
  captures do not lose film or duplicate completion. Personal-photo eviction preserves story images.
- Fake client clocks have no effect on payouts; partial days, caps, fractional remainders, repeated
  requests, two devices, stale saves, upgrades, account switches, and unauthenticated calls are tested.
- Database tests exercise the actual SQL transaction and permissions, not only a JavaScript imitation.
- Automation affects only the purchased business and requires no background browser process.
- Chinese help preferences, editable speech, keyboard/touch interaction, HUD spacing, assets, and
  voices are checked in the running chapter.

Completion means the chapter works end to end and its server migration is validated. Local build
success alone does not mean the hosted backend or public game is updated. Deploying the database,
pushing changes, and publishing the game are reported as separate actions with concrete reviewable
artifacts. If backend access is unavailable, provide the tested migration and exact setup instructions
and report verified income as not yet live; do not substitute device-clock rewards.
