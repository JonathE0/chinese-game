# Hardware store, graphics cleanup and HSK cards — completion notes

Continues the plan handed over from Codex: finish the hardware store, clear world-placement
overlaps, verify NPC movement, inspect graphics by day and night, keep the HSK cards word-specific,
and clean up.

## World placement

`tests/browser/layout.spec.js` replaces the one-off `audit-layout.js` / `layout-overlaps.cjs` pair.
It measures what is actually drawn — every mesh's world bounds, part by part, with round parts
(trunks, canopies, poles) compared as discs — rather than the collision registry, which is smaller
than the meshes and ignores soft props entirely. It covers the town by day, the night market through
arrival, trading and departure, and 云海. Intended contact is listed explicitly: a parasol through its
own table, a vendor at the handle of their own cart.

Fixed:

- The café, bakery and lifestyle shop fronts (the `shophouse` build) carry their own cloth awning.
  A second awning prop had been placed over each, and the two intersected. The duplicates are gone;
  the supermarket's modern front has no built-in awning and keeps its prop.
- The café's two parasols stood under that awning, pushing through it, into the wall and round two
  lamp posts. The tables stay under the awning as a covered terrace; one full table, parasol and
  chairs set moved to the open corner at (22.2, 8.2), clear of the district hedge and the café wall.
- A planter sat on the home-goods shop's front step; a tree canopy grew into the restaurant's
  corner; the tea house's roof met the bank's in mid-air. Each moved the minimum needed.
- The restaurant's waiters looped past the spot you arrive on, so walking in froze one of them.
  Their front leg moved from z 2.8 to 2.3.

## NPC movement

Waiters and night-market carts already wait when blocked (Codex). Added coverage: a waiter blocked
by the player never comes within 0.6 m and carries on once the player moves; the market is driven
through its whole route with every intermediate pose checked for overlaps.

## Hardware store

Each department is signed overhead from a new optional `sign` field on room fittings: 建材部, 五金部,
灯具部, 家居部, 生活用品部, 全店目录, 收银台. The two racks previously shared one hard-coded board.
Shops now keep their lights on after dark; only your own home waits for a lamp you bought. The
missing `obj-hardware-rack` voice clip was generated. Mixed-basket checkout is covered by Codex's
`hardware-cleanup.spec.js`.

## Graphics

Town, home, store and 云海 were captured by day (13:00) and night (21:00) and reviewed: paving,
shadows, entrances and the skyline read cleanly, with no floating props. The town was also captured
after the night market had built and destroyed its carts, to rule out shared-material damage.

**Paving draw calls**, measured live in the same town view by re-laying the old one-mesh-per-2 m-tile
paving (913 tiles across the three districts) over the current textured slabs:

| | total | forward | shadow |
|---|---|---|---|
| per-tile paving | 5,032 | 1,719 | 3,313 |
| one textured slab per district | 3,604 | 1,204 | 2,400 |
| saved per frame | **1,428 (−28%)** | 515 | 913 |

Every tile cast into the shadow map, so the shadow saving is exactly one draw per tile; the forward
saving is smaller because frustum culling was already discarding tiles off screen. The remaining
2,400 shadow draws are the obvious next target — most small props do not need to cast.

## HSK cards

All 5,363 cards keep Chinese and English definitions, provenance and alternate readings; 黄 is
"yellow" only and 黄色 keeps its full meaning. One real defect was found and fixed:
`prepare-hsk-chinese.py` joined every heteronym of a character, so a card got the senses of readings
it does not have — 长 (cháng, "long") opened with zhǎng's "elder, leader, to grow". It now uses the
heteronym matching the card's pinyin (416 cards) and follows MOE cross-references (濕 read shī →
同「溼」). Nine cards whose reading MOE spells differently keep the previous behaviour.

Regeneration was re-run from freshly downloaded sources: identical 5,363 IDs in the same order; the
only changed fields are `definitionZh` on 415 cards and one `definitionTitle` (湿 → 溼). Every changed
definition except 湿 is a strict subset of its previous text.

The sources had been kept in `test-results/sources/`, which Playwright empties at the start of every
browser run, so they had already been lost. They now live in git-ignored `.cache/hsk-sources/`, and
the README documents the four downloads and both build steps.

## Cleanup

Removed `scripts/audit-layout.js`, `scripts/layout-overlaps.cjs`, `scripts/inspect-browser.js` and
`scripts/sanitize-generated.py` (the build scripts already apply the content policy themselves).
JSON imports were already consistent — all 46 carry `with {type:'json'}`.

## Verification

Final run after all edits: 59/59 unit tests, content validation, production build, and the full
browser suite at 67/67 with no retries. Nothing was committed.
