# Transit and rentals — implementation checkpoint

Working checkout: C:/Users/jonat/Documents/ChatGPT/Game-development (development branch).
Status: implementation in progress, user requested a safe checkpoint before usage limits. Nothing committed, pushed or merged in this run. Do not restart from the older Game checkout or copy it over this work.

## Implemented
- Condition exclamation badge below 30 hunger/rest, accessible label, updates with game stats and clears when both recover. Uses existing configured Condition shortcut.
- Transit-card balance, old-ticket credit at legacy six-coin value, retained passes, configurable distance bands. Current Qinghe–Yunhai fare five each way; no emergency/free return UI.
- Top-up UI, fare reservation/cancellation/completion and saved journey state; single completion charge.
- Two new shared station layouts: Qinghe underground and larger Yunhai Central with inactive Line 2/3 spaces. Moving train and sliding platform doors. Entering carriage triggers departure; scenic/skip and saved always-fade option. Actual arrival is at the destination platform.
- Far-shore rental building at (-12,-183) in city coordinates, lobby and apartment interior. Existing ferry retained. Rent 35 coins for seven in-game days, explicit renewals, expiry access checks, journal reminders. Price/term configurable in src/content/rental.json.
- Furnishing and sleep reuse existing systems. Furniture recovery reuses putAway from decorate.js: inventory stores TOTAL owned counts and placements are subtracted only when calculating spare items, so removing placement records preserves ownership. Automatic approval initially rejected a custom recovery implementation; read-only inspection proved this model and approved retry uses the shipped routine.
- Optional flexible Mandarin rental practice, currently text content; new neural voice clip not generated yet.

## Verification evidence
All logs/screenshots under .superpowers/sdd/2026-09-30-transit/.
- Observed RED then GREEN for missing Condition badge; missing card interfaces; missing physical-boarding UI; missing rental rules.
- 6 transit/legacy core tests passed; 3 rental core tests passed.
- npm run verify passed (checkpoint-verify.log): units, structural content and production build. Existing notices: 890 generated voices unreviewed, HSK/native review pending, large bundle.
- transit.spec.js passed full top-up/reserve/carriage/skip/Yunhai arrival, balance 5 from 10.
- rental.spec.js passed rent/expiry/ownership-preserving recovery/renewal/flexible reply; screenshot test passed.
- Combined final browser gate: 3 passed, Condition threshold test failed because unpaused stat decay crossed 30. Test now pauses game time and aligns stats.hour; final result in warning-final.log. Confirm exit status before claiming it passed.
- Visually inspected initial and corrected station/apartment screenshots. Fixed clipped signs and undefined floor-sign text. Interiors are functional blockouts requiring further polish, not a final match to reference quality.

## Next work — do not claim plan complete
1. Confirm warning-final.log passes. Check remapped key, eating/sleeping-driven clearing and narrow HUD layout.
2. Expand actual keyboard-walking/collision tests: current transit test warps into carriage to exercise trigger; it does not prove every path is unobstructed. Walk through gate/doors, handle doorway closure, cancellation and safe paid return, then fade/reload cases.
3. Audit train state: arrival holding, gate exit, walking out before departure, unauthorised track access, account/profile swaps and persistence failures. Recovery currently completes saved riding state during install; importing/switching profiles mid-session needs explicit proof.
4. Legacy buyTickets/buyPass/board/returnTrip exports remain for compatibility and old unit tests. New UI uses card rules, but legacy returnTrip still implements free travel; decide migration/removal and update affected tests instead of leaving contradictory dead paths.
5. Existing tests/browser/metro.spec.js describes the OLD ticket/pass/free-return/upper-floor station and must be updated to the approved replacement behavior. Run relevant city/home/harbour/save regressions after that. stairs.test.js was updated to step-free stations; original home stair tests retained.
6. Verify/remove the specific outside ticket-selling NPC the user mentioned. New station UI no longer has the clerk/ticket flow, but no distinct exterior seller entity was identified and removed. Do not assume removal is proven.
7. Polish Yunhai Central visually: broad room has ring lights and placeholders but still sparse; inspect views facing both platform and concourse with tutorial/HUD hidden. Check train windows/seats and accurate collision bounds. Apartment bed uses existing moon-gate bed drawing with a simple fitting hitbox; inspect fit/interaction.
8. Prove apartment approach from ferry via real walking, entry/exit, expiry while inside and after save/load, free placement at expiry, renewal double-click/account switch. Add content validation for rental lesson/rent configuration and generate/review its voice clip through existing pipeline.
9. Save schema fields are additive at current SAVE_VERSION; inspect project migration policy and add an explicit upgrade step if needed for new-format compatibility.
10. Final independent review (required by native execution skill) has NOT run. Fix findings, rerun relevant checks and update handover. No merge/deployment without user instruction. Business income remains deferred.

## Main files
New: src/core/rental.js, src/content/rental.json, src/ui/rental.js, src/world/rental.js, src/world/metro-station.js, tests/transit-card.test.js, tests/rental.test.js, tests/browser/{condition-warning,transit,rental}.spec.js.
Changed: src/core/metro.js, src/core/profile.js, src/content/{metro,rooms,harbour}.json, src/main.js, src/ui/{shell,metro,decorate,rest,panels}.js, src/world/{town,models}.js, src/style.css, tests/stairs.test.js; generated docs/CONTENT_MAP.md.
Original versions before this run's first edits: .superpowers/sdd/2026-09-30-transit/baseline/. Writer: write.mjs. Development already had extensive uncommitted work from prior stages—git diff against HEAD includes much more than this task. Do not stage everything or delete scratch/baselines.

## User decisions
User authorised implementation of metro/Condition and rental plans. Only Qinghe–Yunhai operates. Other lines are placeholders. No emergency ride home. Preserve grandfather's Qinghe home. No offline rent. Rental expiry must preserve possessions. User asked to checkpoint tasks before usage limits.
