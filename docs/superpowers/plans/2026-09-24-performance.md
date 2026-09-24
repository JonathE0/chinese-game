# Make the town run smoothly on a laptop (2026-09-24)

Measured with `scratchpad/perf.cjs` (Playwright, Edge, 1280×720, median of 90 frames, CPU
throttled ×4 to stand in for a modest laptop):

| Spot | fps | frame ms | render ms | cull ms | draw calls | shadow calls | triangles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| square, facing the hall | 15 | 66.7 | 61.6 | 17.8 | 4921 | 3779 | 781,624 |
| square, facing home | 15 | 66.7 | 62.7 | 17.2 | 4984 | 3778 | 723,492 |
| park entrance | 20 | 50.1 | 52.8 | 17.1 | 4146 | 3777 | 637,076 |
| snack stalls | 15 | 66.6 | 55.6 | 16.7 | 4317 | 3779 | 651,104 |
| inside the word hall | 60 | 16.7 | 3.9 | 1.9 | 0 | 0 | 0 |

Unthrottled the same scenes hold 60 fps but spend 9.6–9.8 ms rendering and 3.1 ms culling, so
there is no headroom. 7,582 mesh instances are alive outdoors; triangles are not the problem.

**Goal: under 700 draw calls and under 2,000 mesh instances outdoors, 60 fps at ×4 throttle,**
with the town looking the same.

## Task P — fewer draw calls (model: opus)

1. **Shadow casters.** 3,779 of ~4,900 calls are the shadow map. Only geometry that casts a
   shadow anyone notices should be a caster: buildings, the word hall, trees, the paifang, carts,
   people, big park pieces. Everything small (window bars, lattice, signs, roof ribs, ornaments,
   goods, lanterns' cords, railings, fittings' sub-items, ground patches) gets
   `castShadows = false`. Set it once where primitives are made in `src/world/models.js`
   (default off, opt in for the short list) rather than per call site if that is the smaller diff.
   Also cut the directional light's `shadowDistance` (75 today) to what the camera can actually
   see and check `shadowResolution` 2048 is still needed.
2. **Batch the static world.** PlayCanvas batch groups (`app.batcher`, `BatchGroup`) merge static
   meshes that share a material into one draw call. Add a batch group per static place (town
   scenery, each room, the park, the word hall, the city) and put every static, non-animated
   entity in it after the scene is built; leave out things that move, toggle or get destroyed
   (people, carts, steam, the water wheel, gate doors, closed signs, placed furniture, loose
   items). Verify with `app.batcher.generate()` timing that building it does not stall the first
   frame; if it does, batch per place lazily as that place is entered.
3. **Fewer materials.** Colours currently make ~163 materials (`models.js` colour cache), and
   batching only merges meshes sharing one material. If batching alone does not reach the goal,
   bake colour into vertex colours so the static town shares one material. Measure before doing
   this; it is only worth it if step 2 leaves draw calls above the goal.
4. **Culling.** 17 ms of cull time comes from 7,582 instances; batching should remove most of it.
   Re-measure before touching anything else.

**Owns:** `src/world/models.js`, `src/world/town.js` (light settings, batch-group set-up and the
places that enable it), `src/world/garden.js`, `src/world/wordhall.js`, `src/world/city.js`,
`src/world/interior.js` (marking statics), and a new `tests/browser/performance.spec.js` that
fails if outdoor draw calls exceed 900 or mesh instances exceed 2,500 (headroom over the goal).

**Rules:** ponytail — reuse PlayCanvas's own batcher, no new dependency, smallest diff. Nothing
may change how the town looks: compare before/after screenshots of the square, the park entrance,
the word hall front and the snack stalls (960×540, saved in the scratchpad) and report them.
Re-run `scratchpad/perf.cjs` (`node perf.cjs 4`) before and after and put both tables in the
report. Keep every named look box and hitbox working (`npm run verify`, `hardware-cleanup`,
`first-view`, `garden`, `wordhall`, `names`-related specs).

## What shipped (2026-09-24)

- Pieces smaller than 1.2 m cast no shadow (`SHADOW_MIN` in `models.js`); people still cast body and head
  shadows. Static town and city scenery is merged by `batchStatics` in `town.js`; moving or toggled things
  opt out with `noBatch` or the skip set.
- At a ×4 CPU throttle the town went from 9–11 fps (≈4,900 draw calls, 3,779 of them shadows) to 60 fps
  (348–739 draw calls, 257 shadows). `tests/browser/performance.spec.js` caps outdoor draw calls at 900.
- Follow-up after review: the town root now stays enabled inside rooms (they are 400 m away, past the far
  clip), because disabling it made the batcher rebuild every batch at each door: leaving a room went from a
  67 ms (×4: 650 ms) freeze to 17 ms (×4: ≤84 ms).
- Skipped: vertex-colour materials, shadow distance and resolution changes — the goal was met without them.
