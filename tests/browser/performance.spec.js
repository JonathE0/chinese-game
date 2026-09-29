import {test,expect} from '@playwright/test';

/**
 * The outdoor town has to stay affordable on a laptop. Static scenery is merged into a batch
 * group (Town#batchStatics) and only large pieces cast shadows (SHADOW_MIN in models.js), which
 * together took the square from about 4,900 draw calls to a few hundred. These are ceilings with
 * headroom over the goal in docs/superpowers/plans/2026-09-24-performance.md, not targets: they
 * fail when a change quietly puts the town back to a draw call per brick.
 *
 * `meshes` counts the World layer twice (the composition lists an opaque and a transparent
 * sublayer), so it is about double the number of live mesh instances.
 */
const SPOTS=[['the square, facing the word hall',0,2,0],['the square, facing home',1,5,-128],
  ['the park entrance',0,21.5,180],['the snack stalls',-5.5,4,90],
  // Once 1,441 draw calls (task Q-quality): the west quarter looking east down the market street.
  ['the west quarter, looking east',-36,4,-90]];

test('the outdoor town stays inside its draw-call and mesh budget',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
 await page.waitForFunction(()=>!!window.__qinghe?.town);
 for(const [name,x,z,yaw] of SPOTS){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  // Two frames: one to draw from the new spot, one whose stats describe that drawing.
  const seen=await page.evaluate(()=>new Promise(done=>{
   const app=window.__qinghe.town.app;
   requestAnimationFrame(()=>requestAnimationFrame(()=>done({
    drawCalls:app.stats.drawCalls.total,
    meshes:app.scene.layers.layerList.reduce((n,l)=>n+(l.meshInstances?.length??0),0)})));
  }));
  expect(seen.drawCalls,`draw calls at ${name}`).toBeLessThanOrEqual(900);
  expect(seen.meshes,`mesh instances at ${name}`).toBeLessThanOrEqual(2500);
 }
 expect(errors).toEqual([]);
});
