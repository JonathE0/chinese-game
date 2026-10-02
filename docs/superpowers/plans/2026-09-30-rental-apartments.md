# Far-shore rental apartments — implementation plan

Status: planning only; user requested this addition for Claude handover. No apartment code implemented. Confirm tuning choices below before implementing their dependent rules.

## Confirmed intent
- Rent, rather than permanently buy, an apartment in Yunhai.
- Recurring housing costs give the player an ongoing reason to study and earn coins.
- Place the complex on the opposite shore, reached after taking the existing ferry.
- Allow decorating the rented home, as proposed in the earlier Roots sandbox concept.
- Preserve the existing cute low-poly style and beginner-friendly English guidance with Mandarin learning.

## Location and access
Extend the existing far-shore ferry landing in src/content/harbour.json rather than invent another ferry route. The game currently describes this water as a bay; the user's river-crossing intent is the far side of this existing crossing. Add a short clearly signed waterfront walk to the complex. Verify shore geometry, boundaries and ferry boarding/return paths in play before finalising building coordinates.

Start with one explorable lobby, a rental desk or terminal, and one rentable apartment interior. Additional doors may be clearly inactive future units. Make the complex feel residential through balconies, mailboxes and floor numbers without simulating every apartment. Do not change ferry fares or add a metro line as part of this feature.

## Proposed rental rules — not yet confirmed
- Use a fixed lease term measured in in-game days, paid in advance from earned coins. Prototype seven in-game days, with rent configurable in content and selected after checking actual study rewards, ferry costs and the game clock's pace.
- Display price, term and expiry before confirmation. No automatic renewal by default; offer explicit renewal while the lease is active.
- Show remaining lease time in the housing panel and a gentle reminder near expiry.
- Prefer billing based on played game time: closing the game does not accrue rent debt. Real-world expiry/offline rent was not requested and must be decided explicitly if desired later.
- At expiry, stop apartment sleep/decorate access until renewed. Never delete owned items, progress or decorations. Preserve the layout for the player's next lease and let them recover furniture to inventory from outside.
- If expiry happens while inside, allow leaving safely; do not trap or abruptly teleport the player. State clearly which services are unavailable.
- No permanent purchase, escalating late fees, borrowing, forced eviction cutscenes or loss of possessions in the first version.
- Keep the grandfather's existing Qinghe home available. Renting adds a convenient Yunhai base; do not remove prior story housing without a separate decision. This means rent is ongoing motivation for keeping a city home, not a requirement to retain all shelter.

## Language and everyday life
Use rental interactions to practise 房租 (rent), 房间 (room), 钥匙 (key), 住 (live/stay), 天 (day), 多少钱 (how much), and renewal expressions. Verify level mapping instead of inventing HSK labels. Accept natural alternatives through the existing flexible-answer system. Explain actual payment/access conditions in English for beginners; viewing help must not obscure financial terms. Keep independent study available outside the apartment so low funds do not prevent earning rent.

## Implementation tasks
1. Inspect existing home ownership, furnishing, bed/sleep, harbour transitions and save migration. Confirm the exact files and available far-shore space; capture a baseline screenshot. Review proposed lease rules and economy tuning.
2. Add editable apartment/rent content and pure lease rules in new src/core/rental.js: quoteLease, rentApartment, renewLease, leaseStatus. Test wallet conservation, insufficient funds, invalid terms, renewal extending from the later of current expiry/current game day, and duplicate confirmation. Use existing game-day accounting; no new wall-clock dependency.
3. Extend src/core/profile.js with additive rental state: apartment ID, paid-through day and preserved decoration layout. Old saves default to no lease. Validate imported state and test save/load, expiry, renewal and existing housing preservation. Keep transaction receipt/state updates in the same saved profile operation as payment.
4. Extend src/content/harbour.json and the existing harbour/world registration with the waterfront path and apartment entrance. Add the lobby and room through existing interior patterns; avoid unrelated world refactoring. Test walking from the far pier to the lobby and back without collision gaps or inaccessible exits.
5. Add rental/renewal UI, clear lease status and a confirmation summary. Reuse furnishing and sleep systems with rental access checks; keep furnishing ownership independent of tenancy. Test active lease, expired lease, expiry while inside, retained furniture, recovery and later renewal.
6. Add optional rental-language practice using existing lesson content/matcher and voice-production workflow. Do not require exact single wording. Test accepted variants, help and incorrect payment/term requests.
7. Play through studying for coins, ferry crossing, renting, decorating, sleeping, expiry, renewal and return. Run relevant unit/browser tests and npm run verify. Inspect station/harbour signage and small-screen UI. Record results before any merge request.

## Acceptance
A player can reach the complex by ferry, understand and pay rent, use/decorate their temporary city home, see when rent is due and renew through earned coins. Repeated UI actions/reloads do not double-charge. Expiry never destroys possessions or blocks independent study, exiting the room, or travelling back once fares are paid. Existing Qinghe housing remains intact.

## Scope boundaries
Separate from Chapter 1 and the metro redesign. Implement after transport unless the user changes priority. No business-income deployment, new real-time rent backend, permanent home purchases, operational placeholder transit lines or automatic merge.
