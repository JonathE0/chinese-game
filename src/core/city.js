/**
 * Pure street geometry for 云海市中心 (Downtown Yunhai) — where a tower's door sits, in the same
 * local (un-offset) coordinates `city.json` itself uses. Kept separate from `src/world/city.js`,
 * which builds the scene; nothing here touches PlayCanvas or `CITY_OFFSET`.
 */

/**
 * The pavement spot in front of a tower's sign: half the tower's own depth out from its `x`,
 * plus a half-metre gap, on whichever side of the avenue it already sits — at the same `z`. This
 * is where `city.json`'s `mall` door sits in front of 星光百货.
 */
export function frontOfTower(tower) {
  const side=Math.sign(tower.x)||1;
  return {x:tower.x-side*(tower.d/2+.5),z:tower.z};
}

/**
 * Where a taxi sets the player down in front of `tower`. `frontOfTower` is only half a metre out,
 * which puts a 0.34 m player 0.14 m inside the tower's hitbox (it reaches d/2 + 0.3), so the
 * drop-off stands a full metre out instead: clear of the facade and of the street furniture.
 */
export function dropOffAtTower(tower) {
  const side=Math.sign(tower.x)||1;
  return {x:tower.x-side*(tower.d/2+1),z:tower.z};
}

/**
 * Whether a body of half-width `edge` standing at local (x,z) is on 云海's ground: `walk` is
 * city.json's list of rectangles [x0, x1, z0, z1] (downtown, the promenade, the hill side). All
 * four corners of the body's square have to land on some rectangle, so where two rectangles meet
 * there is no seam to get stuck on, while every outer edge still holds `edge` metres in.
 */
export function onCityGround(walk,x,z,edge) {
  const inside=(r,px,pz)=>typeof r==='function'?r(px,pz):px>=r[0]&&px<=r[1]&&pz>=r[2]&&pz<=r[3];
  const on=(px,pz)=>walk.some(r=>inside(r,px,pz))||addedGround.some(r=>inside(r,px,pz));
  return on(x-edge,z-edge)&&on(x+edge,z-edge)&&on(x-edge,z+edge)&&on(x+edge,z+edge);
}

/**
 * Ground a part of 云海 adds once it is built, on top of city.json's `walk`: [x0, x1, z0, z1] like
 * those (the harbour's piers and its far landing, src/world/harbour.js), or a function of local
 * (x, z) for ground that moves (the ferry's deck, while you ride it). It is checked with `walk`,
 * corner by corner, so a pier leading off the promenade, or the deck against a pier, has no seam.
 */
export const addedGround=[];

/** The middle of the promenade's lit path at local `x`: a slow wave either side of the plaza. */
export function promenadeZ(promenade,x) {
  const {z,swing,wave}=promenade.path;
  return z+swing*Math.sin(2*Math.PI*(x-promenade.plaza.x)/wave);
}

/**
 * The volumes a near-side building stacks on its podium (city.json `form.tiers`), in its own frame
 * (front on +z): {cx, cz, w, d, y0, y1, skin, windows, bulge}. A tier is the footprint less `inset`
 * all round, moved by `dx`/`dz`. A sky garden (`skin: "garden"`) is an open storey whose pillars
 * and rail stand at its edges, so it takes the ground the tiers below and above it share: it rests
 * wholly on the one and carries the other, however the tower is staggered.
 */
export function towerTiers(def) {
  const {podium,tiers}=def.form,out=[];
  const rect=t=>({cx:t.dx??0,cz:t.dz??0,w:def.w-2*(t.inset??0),d:def.d-2*(t.inset??0)});
  let y0=podium.h;
  tiers.forEach((t,i)=>{
    let r=rect(t);
    if(t.skin==='garden'){
      const below=out.at(-1)??{cx:0,cz:0,w:def.w,d:def.d},above=tiers.slice(i+1).find(one=>one.skin!=='garden');
      r=above?overlap(below,rect(above)):below;
    }
    out.push({cx:r.cx,cz:r.cz,w:r.w,d:r.d,y0,y1:t.to,skin:t.skin,windows:t.windows,bulge:t.bulge});
    y0=t.to;
  });
  return out;
}
/** Where two footprints {cx, cz, w, d} overlap (nothing, if they do not). */
function overlap(a,b) {
  const x0=Math.max(a.cx-a.w/2,b.cx-b.w/2),x1=Math.min(a.cx+a.w/2,b.cx+b.w/2);
  const z0=Math.max(a.cz-a.d/2,b.cz-b.d/2),z1=Math.min(a.cz+a.d/2,b.cz+b.d/2);
  return {cx:(x0+x1)/2,cz:(z0+z1)/2,w:Math.max(0,x1-x0),d:Math.max(0,z1-z0)};
}
