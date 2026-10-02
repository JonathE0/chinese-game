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

// 中 is where 自动 starts (src/core/quality.js, task W6-perf), so it has its own budget, taken down the
// river street, where it was 297 draw calls: lamps of one colour share one material, and each
// container's stock, gate door, closed sign and building site is a small static batch of its own, a
// few draw calls rather than one a piece (seen from there, 37 lamps, 27 pieces of fruit and 54 parts).
test('on 中 the river street stays inside 260 draw calls: lamps share a material, stock and gates batch',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
 await page.waitForFunction(()=>!!window.__qinghe?.town);
 const seen=await page.evaluate(async()=>{
  const t=window.__qinghe.town,q=await import('/src/core/quality.js');q.setQuality('medium');t.applyQuality();
  t.daylight.paused=true;t.daylight.setHour(15);t.warp(-36,4,-90);t.pitch=-4;
  for(let i=0;i<20;i++)await new Promise(r=>requestAnimationFrame(r));
  const calls=[];for(let i=0;i<20;i++){await new Promise(r=>requestAnimationFrame(r));calls.push(t.app.stats.drawCalls.total);}
  const heads=t.root.find(e=>e.lookName==='lamp'&&e.parent?.name==='prop-streetlight');
  const batched=e=>e.findComponents('render').every(r=>r.batchGroupId>=0);
  return {calls:calls.sort((a,b)=>a-b)[10],lampMaterials:new Set(heads.map(h=>h.render.meshInstances[0].material)).size,lamps:heads.length,
   stock:t.containers.every(c=>c.slots.every(s=>batched(s.entity))),gates:[...t.gates.values()].filter(g=>g.door).every(g=>batched(g.door))};
 });
 console.log('中 down the river street',JSON.stringify(seen));
 expect(seen.lamps).toBeGreaterThan(5);
 expect(seen).toMatchObject({lampMaterials:1,stock:true,gates:true});
 expect(seen.calls).toBeLessThanOrEqual(260);
 expect(errors).toEqual([]);
});
