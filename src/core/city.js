/**
 * Pure street geometry for 云海市中心 (Downtown Yunhai) — where a tower's door sits, in the same
 * local (un-offset) coordinates `city.json` itself uses. Kept separate from `src/world/city.js`,
 * which builds the scene; nothing here touches PlayCanvas or `CITY_OFFSET`.
 */

/**
 * The pavement spot in front of a tower's sign: half the tower's own depth out from its `x`,
 * plus a half-metre gap, on whichever side of the avenue it already sits — at the same `z`. This
 * is the formula `city.json`'s own `department` entry uses to sit in front of 星光百货.
 */
export function frontOfTower(tower) {
  const side=Math.sign(tower.x)||1;
  return {x:tower.x-side*(tower.d/2+.5),z:tower.z};
}

/** Whether (x,z) has arrived at the pavement in front of `tower`, within `radius` metres. */
export function arrivedAtTower(x,z,tower,radius=4) {
  const spot=frontOfTower(tower);
  return Math.hypot(x-spot.x,z-spot.z)<=radius;
}

/**
 * Where a taxi sets the player down in front of `tower`. `frontOfTower` is only half a metre out,
 * which puts a 0.34 m player 0.14 m inside the tower's hitbox (it reaches d/2 + 0.3), so the
 * drop-off stands a full metre out instead: clear of the facade and of the street furniture,
 * and still well inside the arrival radius around `frontOfTower`.
 */
export function dropOffAtTower(tower) {
  const side=Math.sign(tower.x)||1;
  return {x:tower.x-side*(tower.d/2+1),z:tower.z};
}

/**
 * One frame of "did the player walk up to it?". `inside` is whether they are within the arrival
 * radius now; `warps` is a counter the scene bumps on every warp or place change. Only a step
 * from outside to inside with no warp in between arrives: a warp — a taxi drop-off, a test
 * teleport, coming out of the metro — resets things, and a player set down inside the radius
 * has to leave it on foot before walking back in counts. Pass the previous result (or null).
 */
export function arrivalStep(prev,inside,warps) {
  const jumped=!prev||prev.warps!==warps;
  return {warps,outside:!inside,arrived:!jumped&&inside&&prev.outside};
}
