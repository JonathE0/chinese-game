# The house becomes a real two-storey house (2026-09-24)

Player: "the stairs are a little bit sloppy in my opinion. Just make it an actual 2 story house at
that point with stairs that you can directly walk up."

Today `home` (10 × 9, height 3.1) has an annex `bedroom` with `stairs:true`, drawn as four
0.28 m boxes against the back wall (`src/world/interior.js`, the `annex.stairs` branch); pressing E
teleports the player into a separate 7 × 5 room whose `returnStairs` draws a stub going back down.
Outside, the house is already `storeys:2`, 6.2 m tall, with a balcony — so the exterior is honest
and the interior is not.

**Target: one room with two floors and a staircase the player walks up. No prompt, no teleport.**

## Build

- `home` room height 3.1 → **6.0**; an upper floor slab 0.2 thick with its top at **y 2.9**,
  covering the 10 × 9 footprint minus the stairwell opening.
- **Staircase:** a straight run along the west wall, **14 steps, rise 0.207, tread 0.32**
  (4.5 m run, 1.1 m wide), each step a solid registry box, so the existing step-up (STEP 0.42 in
  `src/world/registry.js`) carries the player up by walking into it. A 栏杆 railing down the open
  side and across the landing edge, so nobody walks off the hole. Stairwell opening ≈ 1.5 × 5.0.
- **Upstairs** holds what the bedroom held: the bed, nightstand, wardrobe, rug, lamp and plant
  slots, and the balcony door in `frontWindows` lined up with the exterior balcony. Downstairs
  keeps the living room, the kitchen door east and the study door west.
- **Light per floor.** The room's single lamp sits at `h − 0.75`; with a slab in the way the
  ground floor would go dark. One lamp under the slab, one above it.
- The `bedroom` room and the `stairs` annex go away once nothing else needs them. If the
  `annex.stairs` branch in `interior.js` then has no user, delete it.

## Certificates on the wall (added 2026-09-24)

The level checks (`src/core/levels.js`) give `hsk-cert-1` … `hsk-cert-6` (category `keepsake`,
`visual: certificate`, drawing in `src/ui/item-drawings.js`), meant to hang at home, but the
furniture code has no wall-hanging kind. Add one to `models.furniture()`: a thin framed board
standing off the wall, named `certificate` 证书 (zhèngshū; check `public/hsk/words.json` for its
level). Give the home wall slots that accept it, at least two downstairs and one upstairs, placed by
the existing slot system. The decoration panel must list only items the player owns and never offer
to buy an item with an empty `shop` list. Test: own `hsk-cert-1`, hang it, reload, it is still
on the wall.

## Saves (do not skip)

Furniture the player has already placed in 卧室 must end up upstairs, and nothing may be lost.
Add a `UPGRADES` entry with a bumped `SAVE_VERSION` in `src/core/profile.js` that maps each
`bedroom` placement into the upper floor's coordinates (clamped inside the floor, off the stairwell
opening); anything that still does not fit goes back to the inventory with a message rather than
being dropped. Unit test: an old save carrying bedroom furniture comes back with the same items,
none missing.

## Text

Report (do not rewrite) every Chinese line that treats the bedroom as a separate place or says
上楼 — the annex label `上楼 · 卧室`, `returnLabel` `下楼 · 回客厅`, tutorial steps, missions, the
house poster in `src/ui/guide.js`. The main session writes the replacements.

## Tests

- Browser: enter the house, hold W into the staircase, `#map-player[data-y]` climbs above 2.5
  without any key but W; the bed is up there; walk back down to y 0; `#interact` never offers 上楼.
- Browser: place a bed upstairs and it is still there after a reload.
- Unit: the save upgrade above.
- Keep green: `house`, `home-access`, `first-view`, `living`, and the bed-placement test in
  `tests/browser/city.spec.js`.

## What shipped (2026-09-24)

- `home` is one 6 m room with an `upper` floor at y 2.9 and a 14-step flight you walk up; the separate
  `bedroom` room is gone. The same `upper` mechanism (`upperParts()` in `interior.js`) is reused by the
  metro platform. Rail hitboxes stand 1.6 m above the landing so they cannot be jumped.
- `SAVE_VERSION` 2 moves bedroom furniture upstairs; pieces that would overlap go back to the bag, with the
  notices 卧室的家具搬到二楼了。 and 有的家具放不下，放回背包里了。
- Certificates hang on wall slots (`wall-1`, `wall-2`, `wall-up`). The registry's headroom check now ignores
  anything low enough to step onto (needed for narrow treads); reviewed world-wide.
