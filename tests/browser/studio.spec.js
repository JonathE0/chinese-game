import {test,expect} from '@playwright/test';

// The model studio (task W5-blender, tests/browser/studio.html): the Blender models load through
// src/world/assets.js once each, take the game's materials, batch and instance, a missing one is left
// out without breaking anything, and the studio's screenshots go to the task's checkpoint folder.
const OUT='.claude/checkpoints/W5-blender/';

test('the Blender models load once, batch, instance and a missing one is left out', async ({page}) => {
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/tests/browser/studio.html');
  await page.waitForFunction(()=>window.studio?.ready,null,{timeout:90000});
  const stats=await page.evaluate(()=>window.studio.stats);
  expect(Object.keys(stats).sort()).toEqual(['jars','lantern','lattice-window','steamer','teaset']);
  for(const [name,s] of Object.entries(stats)){
    expect(s.triangles,name).toBeGreaterThan(200);
    for(const m of s.materials)expect(m,name).toMatch(/^model-(wood|bamboo|cloth|silk|ceramic)$/);
  }

  // Loaded once: asking again hands back the same load, and a new copy fetches nothing.
  const cache=await page.evaluate(async()=>{
    const s=window.studio,assets=s.app.assets,own=assets.loadFromUrl;let fetched=0;
    assets.loadFromUrl=(...a)=>{fetched++;return own.apply(assets,a);};
    const same=s.assets.load('jars')===s.assets.load('jars'),copy=await s.assets.spawn('jars',s.app.root,{at:[0,-5,0]});
    const shared=copy.findComponents('render')[0].meshInstances[0].material===s.assets.material('ceramic');
    assets.loadFromUrl=own;copy.destroy();
    return {same,fetched,shared};
  });
  expect(cache).toEqual({same:true,fetched:0,shared:true});

  // A model whose file is missing, and one that isn't listed: null, a warning, nothing thrown, and the
  // failed load is not kept, so a later try fetches again.
  const missing=await page.evaluate(async()=>{
    const s=window.studio;s.MODELS.models.ghost={file:'ghost.glb',places:['ghost-place']};
    const [first]=await s.assets.forPlace('ghost-place'),spawned=await s.assets.spawn('ghost',s.app.root),unknown=await s.assets.spawn('no-such-model',s.app.root);
    delete s.MODELS.models.ghost;
    return {first,spawned,unknown,kept:s.assets.loading.has('ghost')};
  });
  expect(missing).toEqual({first:null,spawned:null,unknown:null,kept:false});

  // Twelve copies: apart, twelve times one copy's calls (a call per material in each pass that draws
  // it: at 高 the depth pass for ambient occlusion and the colour pass); batched or instanced, one copy's.
  const calls={};
  for(const name of Object.keys(stats)){
    const c=calls[name]=await page.evaluate(n=>window.studio.measure(n,12),name),per=stats[name].materials.length;
    expect(c.single%per,name).toBe(0);
    expect(c.separate,name).toBe(12*c.single);
    expect(c.batched,name).toBeLessThanOrEqual(c.single);
    expect(c.instanced,name).toBe(c.single);
  }

  for(const view of ['overview',...Object.keys(stats)]){
    await page.evaluate(async v=>{window.studio.view(v);await window.studio.frames(6);},view);
    await page.screenshot({path:`${OUT}studio-${view}.png`});
  }
  console.log('STUDIO '+JSON.stringify({stats,calls}));
  expect(errors).toEqual([]);
});
