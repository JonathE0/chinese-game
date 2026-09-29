import {test,expect} from '@playwright/test';

/**
 * 画质 (task Q-quality, docs/superpowers/plans/2026-09-27-development-wave-3.md): the game has to run
 * on lower-end laptops. 低 must hold 30 fps with the CPU slowed four times (Chrome DevTools'
 * throttling, the usual stand-in for a slow laptop's CPU) in the square, on the hotpot terrace at
 * night and in the mall's atrium; each level draws no more than the one above it; and the setting
 * survives a reload.
 */
const SAVE_KEY='little-mandarin-town.v1';
async function start(page,quality){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],
    home:[],discovered:[],clock:15,dayIndex:0,vendors:{},
    settings:{pinyin:'known',english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0,...(quality?{quality}:{})},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
}
const SPOTS={
  square:t=>t.warp(0,2,0),
  // The west quarter looking east down the market street, once 1,441 draw calls (the known hotspot).
  west:t=>t.warp(-36,4,-90),
  // From the spawn at dusk looking west-north-west (1,040 before the batching).
  dusk:t=>{t.daylight.setHour(19.3);t.warp(t.data.spawn[0],t.data.spawn[1],67.5);},
  terrace:t=>{if(t.place!=='city'){t.enterCity();window.__qinghe.syncPlace?.();}t.daylight.setHour(21);t.warp(-4000-61.2,-34.6,50,14);},
  atrium:t=>{const r=t.rooms.get('mall');t.enterRoom('mall');t.warp(r.offsetX+r.data.spawn[0],r.data.spawn[1],0,t.playerY);},
};
const go=(page,spot)=>page.evaluate(code=>{const t=window.__qinghe.town;t.daylight.paused=true;(0,eval)(code)(t);},SPOTS[spot].toString());
/** Median frame time and draw calls over a couple of seconds of real frames. */
const sample=(page,frames=90)=>page.evaluate(frames=>new Promise(done=>{
  const app=window.__qinghe.town.app,gaps=[],calls=[];let last=0;
  const tick=now=>{if(last){gaps.push(now-last);calls.push(app.stats.drawCalls.total);}last=now;
    if(gaps.length<frames)requestAnimationFrame(tick);
    else{gaps.sort((a,b)=>a-b);calls.sort((a,b)=>a-b);done({fps:1000/gaps[gaps.length>>1],calls:calls[calls.length>>1]});}};
  requestAnimationFrame(tick);
}),frames);

test('低 holds 30 fps on a CPU slowed four times: the square, the terrace at night, the mall atrium',async({page})=>{
  test.setTimeout(180_000);
  await start(page,'low');
  // The city is built on the first ride: build it before slowing the CPU, then slow it once.
  await page.evaluate(()=>window.__qinghe.town.ensureCity());
  const spin=()=>page.evaluate(()=>{const s=performance.now();let x=0;for(let i=0;i<4e6;i++)x+=Math.sqrt(i);return performance.now()-s+x*0;});
  const quick=await spin();
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  expect(await spin(),'the CPU really is slowed').toBeGreaterThan(quick*2.5);
  const seen={};
  for(const spot of ['square','terrace','atrium']){
    if(spot==='atrium'&&!await page.evaluate(()=>window.__qinghe.town.rooms.has('mall')))continue;   // until the mall is built
    await go(page,spot);
    expect(await page.evaluate(()=>window.__qinghe.town.place)).toBe({square:'town',terrace:'city',atrium:'mall'}[spot]);
    await page.waitForTimeout(2500);   // shaders and batches for a new place settle first
    seen[spot]=await sample(page);
  }
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  console.log('低 at 4x CPU throttle:',JSON.stringify(seen));
  for(const [spot,{fps}] of Object.entries(seen))expect(fps,`${spot} fps`).toBeGreaterThanOrEqual(30);
});

test('each level draws no more than the one above it, and 高 stays inside 900 draw calls',async({page})=>{
  test.setTimeout(120_000);
  await start(page,'high');
  const table={};
  for(const spot of ['square','west','dusk','terrace']){
    await go(page,spot);
    for(const level of ['high','medium','low']){
      await page.evaluate(async level=>{const q=await import('/src/core/quality.js');q.setQuality(level);window.__qinghe.town.applyQuality();},level);
      await page.waitForTimeout(300);
      (table[spot]??={})[level]=(await sample(page,20)).calls;
    }
  }
  console.log('draw calls per level:',JSON.stringify(table));
  for(const [spot,c] of Object.entries(table)){
    expect(c.high,`${spot} on 高`).toBeLessThanOrEqual(900);
    expect(c.medium,`${spot}: 中 against 高`).toBeLessThanOrEqual(c.high+5);
    expect(c.low,`${spot}: 低 against 中`).toBeLessThanOrEqual(c.medium+5);
  }
});

// The browser tests count people, reflections and draw calls built for one level, so they run on 高
// (the test server's `--mode e2e`), not on whatever 自动 makes of the machine: a software GPU (a CI box
// without one) would start 低, and a busy machine could step down half-way through a spec.
test('the browser tests run on 高 unless their save picks a level, whatever the GPU',async({page})=>{
  await page.addInitScript(()=>{
    for(const gl of [WebGLRenderingContext,WebGL2RenderingContext]){
      const get=gl.prototype.getParameter;
      gl.prototype.getParameter=function(p){return p===0x9246?'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)':get.call(this,p);};
    }
  });
  await start(page);
  expect(await page.evaluate(async()=>[window.__qinghe.town.app.graphicsDevice.unmaskedRenderer,(await import('/src/core/quality.js')).detail()]))
    .toEqual([expect.stringContaining('SwiftShader'),'high']);
});

test('画质 in Settings changes the renderer and survives a reload',async({page})=>{
  await start(page);
  const renderer=()=>page.evaluate(async()=>{const t=window.__qinghe.town,g=t.app.graphicsDevice,l=t.sun.light,q=await import('/src/core/quality.js');
    return {level:q.detail(),saved:window.__qinghe.profile.settings.quality??null,pixelRatio:g.maxPixelRatio,samples:g.samples,
      shadow:[l.shadowType,l.shadowResolution,l.shadowDistance]};});
  expect((await renderer()).saved).toBe(null);   // 自动 by default
  await page.locator('#settings-button').click();
  const select=page.getByRole('combobox',{name:/画质/});
  await expect(select).toHaveValue('auto');
  await select.selectOption('low');
  const low=await renderer();
  expect(low).toMatchObject({level:'low',saved:'low',pixelRatio:1,samples:1});
  expect(low.shadow.slice(1)).toEqual([1024,45]);
  await page.reload();
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  expect(await renderer()).toEqual(low);
  await page.locator('#settings-button').click();
  await expect(page.getByRole('combobox',{name:/画质/})).toHaveValue('low');
  await page.getByRole('combobox',{name:/画质/}).selectOption('high');
  expect(await renderer()).toMatchObject({level:'high',saved:'high',shadow:[4,2048,75]});
});

// Batched pieces share their meshes (models.repaint), so nothing may take a shared mesh away with it:
// a market cart struck at closing time once did, and the batcher then threw on every frame in 云海.
test('云海 loads with no page errors, and carts struck and raised again leave every batch whole',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const broken=()=>page.evaluate(()=>{const out=[];window.__qinghe.town.app.root.forEach(e=>{const r=e.render;
    if(r&&r.batchGroupId>=0&&r.meshInstances.some(mi=>!mi.mesh?.vertexBuffer))out.push(e.name);});return out;});
  const frames=n=>page.evaluate(n=>new Promise(done=>{let k=0;const f=()=>++k>=n?done():requestAnimationFrame(f);requestAnimationFrame(f);}),n);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();window.__qinghe.syncPlace?.();t.warp(-4000,-46.5,0);});
  await frames(10);
  expect(await page.evaluate(()=>window.__qinghe.town.place)).toBe('city');
  // Out of sight of the town, every cart comes down and goes up again, twice.
  const cycled=await page.evaluate(()=>{const t=window.__qinghe.town;let n=0;
    for(let round=0;round<2;round++)for(const market of [t.market,t.dayMarket])for(const pitch of market.pitches){
      if(pitch.cart){market.strike(pitch);n++;}
      market.raise(pitch);
    }
    return n;});
  expect(cycled).toBeGreaterThan(0);
  await frames(10);
  expect(await broken()).toEqual([]);
  expect(errors).toEqual([]);
});
