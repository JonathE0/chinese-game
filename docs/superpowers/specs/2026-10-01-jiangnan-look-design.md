# 江南水乡 look — a more realistic, more detailed Qinghe

Date: 2026-10-01. Player's words: "make it have that true Chinese style and make it super nice
looking"; "it looks very cartoony, could we make it look slightly more realistic? Lots of things are
just simple polygons and shapes within stores, can we make them have more detail". Chosen style:
the Jiangnan water town (Suzhou / Wuzhen). Characters keep the blocky look the player chose
(see `docs/references/wave4/blocky-person-detailed.png`); everything around them grows up.

## Refined target (player, later on 2026-10-01)
"The characters look way too blocky, make them look more realistic, same with everything else";
then, offered real photo textures: "make it look more stylized, I don't really like the super plain
textures on things, but don't make it look too realistic or it will look out of place"; characters
"similar to the image provided". So: no downloaded assets and no photoreal. The target is the
game's own album illustrations (`public/images/roots/*.png`, from which
`docs/references/wave4/blocky-person-detailed.png` was taken): a painterly diorama with blocky
shapes that have softly bevelled edges, hand-painted textures with gentle colour variation and
brushy grain, warm soft light with ambient occlusion in the corners, a slight film grain, and never
flat single colours. Characters follow the same finish.

## How the game draws today
PlayCanvas 2.22.1, every model built in code from boxes, cylinders and cones with flat colours
(`src/world/models.js`), repainted into one vertex-colour material and batched
(`models.repaint`, town.js batching). No textures except canvas text. That is why it reads as
cartoony: flat colour, hard 90° edges, no surface detail, simple lighting.

## Visual pillars
- 白墙黛瓦: warm white plaster walls with soft stains and a bluestone plinth; dark grey curved tile
  roofs with rows of tiles, ridges with end ornaments and upturned eaves (飞檐).
- 马头墙: stepped horse-head gable walls with small tiled caps between houses.
- Timber: dark lacquered and red-brown wood for doors, shutters, lattice windows (花格窗), columns
  and beams; couplets (对联) and plaques (匾额) on doors; red lanterns.
- Stone: 青石板 bluestone paving with joints and wear, granite steps and kerbs, stone arch bridges,
  steps down to the water (河埠头).
- Water and green: canals with reflections, willows, bamboo, plum blossom, moss in the joints.
- Light: soft, slightly misty daylight; warm lantern light at night.

## Palette (starting values)
plaster #ece8df · plaster stain #d8d2c4 · roof tile #3c4045 · ridge #2e3236 · dark timber #4a3326 ·
red-brown timber #7a3b2a · lacquer red #a5302a · lantern #c8402f · gold #b48a3c · bluestone
#6f7a80 · granite #9a9a92 · moss #6f7d4f · willow #8aa05a · water #5f7f86.

## Techniques
1. Light and post-processing: PlayCanvas `CameraFrame` (engine extras: tone mapping, bloom, SSAO,
   colour grading, vignette), hemisphere-style ambient (cool sky, warm ground), a warm sun with soft
   shadows, light mist. Grading: slightly desaturated, lifted shadows, warm highlights. Secondary
   cameras (window views, mirrors, water reflection) must match the main camera's tone mapping so
   portals don't look different.
2. Materials: a handful of shared procedural canvas textures (256–512 px, generated at start, no
   downloads): wood grain, plaster with stains, roof tile rows, bluestone slabs, cloth weave, paper;
   tuned roughness; vertex colour still tints them, so existing colours keep working.
3. Geometry: a bevelled-box helper (chamfered edges catch light; biggest single realism gain for
   boxes), curved roof meshes with upturned eaves, lattice windows from thin bars, framed doors,
   ridge ornaments; shop dressing kits (jars, bottles, tins and boxes with labels, baskets, produce,
   hanging goods, price tags) so shelves read as full and real.
4. Budgets: a street costs at most ~20% more draw calls than today, an interior ~30%; static
   geometry stays merged/batched; at most ~8 shared textures; 低 quality falls back to today's
   flat look with no post-processing, 中 keeps textures and bloom but no SSAO.

## Phases
- P0 look test (approval gate): the lighting and post pipeline, the material and bevel system, and
  one square shop rebuilt in full Jiangnan style outside and inside (plus the paving around it),
  with day and night before/after screenshots and costs. The player approves before the rollout.
- P1 town architecture rollout (all Qinghe buildings, gables, roofs, doors, windows).
- P2 interiors and props rollout (every shop and room).
- P3 water and nature (canals, bridges, willows, bamboo, paving everywhere).
- P4 characters: the detailed blocky look for everyone (after the player approves W4-hero).
- P5 Yunhai: the same lighting and materials on the modern city.
