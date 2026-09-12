# Home Kitchen and Metropolis Starter

Approved scope: user requests kitchen first, then as much useful Metropolis progress as possible.

## Kitchen
- Free kitchen annex entered from home; preserve existing furniture and town return position.
- Three grocery recipes costing 9–14 coins; one meal restores hunger to 100. Cooking takes 20–35 seconds. Show ingredient counts, total cost and ready-food comparison.
- Reserve ingredients once, one job at a time; completion/collection replay-safe. Persist remaining real cooking seconds, progress only during visible active play, including kitchen UI. No sleep/time-change exploit.
- Finished meals can be eaten from inventory. No resale profit from cooking.
- Verify affordability, missing ingredients, duration, save/reload, collection, full hunger, actual grocery→kitchen→eat UI flow.

## Metropolis starter
- A metro entrance in the starting square leads through a short train transition to a distinct first city district, with a safe free return.
- Lazy-build city geometry on first visit. High-rise skyline, lit shop signs, pedestrian street, useful stores/NPC conversations, Chinese labels.
- Keep current town and saves intact; use the existing place/room interfaces with explicit outdoor-zone treatment where needed.
- State clearly that this is a starter district; full transit simulation, department store and further districts are future work.

## Verification
- Focused failing tests before rule changes; existing content/build/unit checks and browser regressions after integration.
- Inspect screenshots of kitchen and city; preserve staging and do not commit.

## Ledger
- Working in existing codex/mandarin-town-mvp checkout; latest handover baseline has 53 passing unit tests and 53 passing browser tests.

## What shipped

### Kitchen — complete
- `kitchen` room reached through an annex door on the east wall of the house; walking out of it
  returns you to the living room at the doorway, not to the street.
- `src/ui/kitchen.js`: hunger bar, the pot with a live countdown, three recipe cards showing
  ingredients held against ingredients needed, the grocery cost against the cheapest ready-made
  equivalent, and the time; a "ready to eat" row for serving up straight away.
- Cooking is charged against `town.clock`, which only advances while the tab is being rendered, so
  sleeping, reloading and backgrounding the tab cannot cook a meal for you.
- `collectMeal` records the errand credit, so a new daily task (`cook`) can ask for a home-cooked
  meal wherever it is served from.
- Validation in `scripts/check-content.js` proves every recipe is cheaper than buying the same
  hunger ready-made, and that no cooked dish is listed above the cost of its ingredients.

### Metropolis — a first district, playable end to end
- `src/content/city.json` + `src/world/city.js`: 云海市中心, an avenue with eight rotated towers,
  backlit shop signs, a crossing, traffic lights, planters, benches, bins, a bus shelter, a
  convenience-store kiosk, taxis, a big screen, three people, and a backdrop skyline.
- Built lazily on the first ride and then kept; registered as an outdoor `place` in `town.rooms`,
  which is why entering, leaving, collision, naming, third person and the HUD all work unchanged.
- `src/core/metro.js` + `src/ui/metro.js`: singles and a seven-day pass, a boarding gate, and a
  seven-second tunnel scene with running announcements. The return leg is free.
- `src/ui/citytalk.js`: street conversation that changes with the day and the number of journeys.
- Two new missions (`metro-first`, `city-line`) and seven new city words, all voiced.

### Not done
- No interiors in the city, no second metro line or network map.
- The department store is a signed facade, not floors you can climb.
- Occlusion culling and LOD are untouched.

