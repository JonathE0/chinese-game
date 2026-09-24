# The walled quarter moves west, and a classical-garden look (2026-09-24)

Player: "move the hsk 3 region to the left of the fountain because currently it is covered by the
word hall and hard to navigate to" — clarified as "level 2, the walls with the restaurant area",
i.e. 河边文化街 (the district gated at HSK level 2, holding the restaurant, post office and
pharmacy). It now sits north, behind the word hall complex, where nobody finds it. Also: bring the
scenery closer to classical Suzhou-garden architecture (reference photos: grey tiled roofs with
upturned eaves, white plaster walls, dark timber columns, covered walkways, lattice windows, red
lanterns, rockeries, lotus water, arched bridges).

---

## Task W — move 河边文化街 west of the fountain (model: opus)

Move the whole district by **dx −40, dz +42**, so its bounds become **x −59..−21, z −13..11** —
straight out to the left of the fountain (0, 1.8). Its gate becomes a lane between the bank and
the homeware shop, the only gap in the square's west side.

- `world.json`:
  - district `riverside` bounds → x [−59, −21], z [−13, 11]; gate → `{x:-21, z:-1, axis:"x",
    half:12, span:1.6, requires:{level:2, words:30}}` (walls then cover the whole shared edge
    z −13..11; the 3.2 m opening fits the gap between 青禾银行 (z −8.5..−3.5) and 家居小铺
    (z 0.5..5.5) with clearance on both sides).
  - every riverside building, prop, person, tree and ground patch: x −40, z +42 (restaurant
    −11,−41 → −51,1; post office 11,−41 → −29,1; pharmacy 0,−49 → −40,−7). Do it with a small
    script that touches only entries whose `district` is `riverside`, then read the diff.
- `rooms.json`: riverside room doors move with their buildings (restaurant door −11,−37.9 →
  −51,4.1, and any other riverside room). `quests.json`: riverside `where` values likewise.
- The square's north edge (z −31) loses its gate wall. It must still read as an edge rather than
  an invisible wall: bring the northern hills in close behind the word hall, or run a wall of the
  park's kind along it — whichever is the smaller diff.
- Check the lane: the player must be able to walk from the fountain due west into the gate, and
  the gate notice must still say what is missing. Nothing may overlap the opening.
- Anything that described the district's old place in Chinese (the house poster in
  `src/ui/guide.js`, tutorial text, mission text) — report the exact lines; the main session
  writes any new Chinese.
- **Tests:** a unit test for the new bounds and gate (like `tests/wordhall.test.js` checks the
  shift); a browser test walking from the fountain west through the lane into 河边文化街 once the
  gate is open, and the restaurant door still opening; every existing riverside spec updated
  (`living`, `city-quests`, `metro`, `buyguide`, whatever greps show); `npm run verify`.

---

## Task S — classical-garden scenery (draft; build after Task P, the performance work)

The reference photos are Suzhou garden architecture. Four reusable pieces give most of the look,
and they must be batched-friendly (Task P): flat colours, no per-instance materials.

1. **Covered walkway 走廊** — a run of timber posts on a low plinth, a grey tiled roof with
   upturned ends, a railing on the open side, a lantern every few bays. Used to link buildings
   around a courtyard, and along the park pond.
2. **White wall with lattice windows 花窗** — white plaster, grey tile coping, round or hexagonal
   lattice openings you can see through. Used to enclose the new west quarter and the park.
3. **Veranda front 檐廊** — a building front set back behind two or three columns with a railing
   between them, so shops read as courtyard halls rather than boxes.
4. **Rockery and water** — the park's existing rockery and pond pieces, reused at the west
   quarter's canal with an arched stone bridge (the park's bridge builder).

Where it goes, in order of payoff: the new west quarter (a walled courtyard quarter around a
lotus canal: restaurant, post office and pharmacy joined by walkways); the park (a walkway along
the pond, a waterside pavilion); the word hall's side halls (linking corridors); then the square's
older shops (verandas instead of flat fronts).

New nameable words this needs (main session authors them): 走廊 corridor, 花窗 lattice window,
水榭 waterside pavilion, 屋檐 eaves. Existing keys cover rockery, lantern, railing, pillar, bridge,
pond, roof, wall.

**Order:** Task P (performance) first, because this adds geometry; then W, then S in pieces, each
with its own review.

## What shipped (2026-09-24)

- Task W: 河边文化街 moved by dx −40, dz +42 to x −59..−22, z −13..11, entered through a lane in the square's
  west edge; the gate sits at x −22 (not −21: the hedge clipped three square buildings). Northern hills widened
  so they meet at ground level and close the square's north edge.
- Task S: reusable `walkway`, `latticeWall`, `veranda`, `waterEdge`, `stoneBridge`, `rockery` builders in
  `models.js`; a lotus canal with two arched bridges, walkways and lattice walls in the west quarter; a walkway
  and the 荷风水榭 pavilion in the park; corridors on the word hall's side halls; verandas on the guesthouse
  and bank branch. Canal and pond corners carry fence posts; a 青禾药店 board hangs under the walkway eaves.
- Worst outdoor spot after the scenery: 792 of 900 draw calls.
