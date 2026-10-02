import {test,expect} from '@playwright/test';

/**
 * The Jiangnan look test (task W5-look, docs/superpowers/specs/2026-10-01-jiangnan-look-design.md,
 * phase P0): 家居小铺 on 青禾广场 rebuilt in full Jiangnan style outside and in, with the light and
 * post-processing pipeline, the painterly surfaces and the tourist's refined figure.
 *
 * It measures what the shop costs to draw from the square and inside, on 高 and on 低: the draw calls
 * and the time a frame takes when the GPU is waited for (app.render, then a one-pixel read). With
 * SHOTS set it photographs the shop by day, at dusk and at night, its interior and the tourist, at
 * 1440×1000 (for looking at, not for comparing).
 */
const SHOTS=process.env.SHOTS;
const SAVE_KEY='little-mandarin-town.v1';
async function start(page,quality='high'){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:7,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:10.5,dayIndex:0,vendors:{},tutorial:{done:true},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0,quality},playerName:'旅人'})]);
  await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
  const welcome=page.locator('#roots-welcome-close');if(await welcome.isVisible())await welcome.click();
  await page.addStyleTag({content:'.topbar,.quest-card,.mini-map,.location,.controls,#crosshair,#look-hint,#tutorial-card,#toast,#interact,#nameplate{display:none!important}'});
  await page.evaluate(()=>{window.__qinghe.town.daylight.paused=true;});
}
const level=(page,value)=>page.evaluate(async value=>{
  const q=await import('/src/core/quality.js');q.setQuality(value);window.__qinghe.town.applyQuality();
},value);
/**
 * Stand at (x,z) in a place (room-local in a room), looking at (tx,tz), at an hour; let it settle,
 * then count the draw calls and time frames drawn with the GPU waited for.
 */
async function view(page,name,{place='town',at:[x,z],to:[tx,tz],pitch=-4,hour=10.5}){
  const out=await page.evaluate(async([place,x,z,tx,tz,pitch,hour])=>{
    const c=window.__qinghe,t=c.town,app=t.app,g=app.graphicsDevice,gl=g.gl;
    if(place==='town'){if(t.place!=='town')t.leaveRoom();}else if(t.place!==place){t.enterRoom(place);c.syncPlace?.();}
    const ox=place==='town'?0:t.rooms.get(place).offsetX;
    t.daylight.setHour(hour);
    t.warp(ox+x,z,Math.atan2(-(tx-x),-(tz-z))*180/Math.PI);t.pitch=pitch;
    for(let i=0;i<30;i++)await new Promise(r=>requestAnimationFrame(r));
    const calls=app.stats.drawCalls.total,px=new Uint8Array(4),times=[];
    for(let i=0;i<25;i++){
      const s=performance.now();app.render();
      const read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
      gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);
      times.push(performance.now()-s);
    }
    times.sort((a,b)=>a-b);
    for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));
    return {calls,ms:+times[times.length>>1].toFixed(2)};
  },[place,x,z,tx,tz,pitch,hour]);
  if(SHOTS&&name)await page.screenshot({path:`${SHOTS}/${name}.png`});
  return out;
}
// From the square, north-east of the shop: its front (north, onto the lane by the bank) and its east
// gable, the side that faces the square. The costs are measured here, where they were measured before
// the rebuild (BEFORE). LANE and FRONT are the closer views of its front.
const SHOP={at:[-9.6,-4.6],to:[-17.6,2.2],pitch:4};
const LANE={at:[-10.6,-3.3],to:[-17.6,1.8],pitch:6};
const FRONT={at:[-16.2,-3],to:[-18.6,1],pitch:12};
const INSIDE={place:'homeware',at:[.4,2.45],to:[-.3,-2.4],pitch:-9};
const CORNER={place:'homeware',at:[-1.2,1.6],to:[2,-2.4],pitch:-2};
/** Draw calls before the rebuild (2026-10-01, the same views, before the look pipeline). The spec's
 *  budget: a street at most ~20% more, an interior ~30%, for what is drawn (中 adds only its post
 *  passes; 高's ambient occlusion redraws the depth of everything, a cost of the level, not the shop). */
const BEFORE={square:{high:151,medium:149,low:144},interior:{high:161,medium:159,low:159}};

/** Photograph the tourist from `turn` degrees round from their front. */
async function hero(page,name,turn){
  await page.evaluate(([turn])=>{
    const t=window.__qinghe.town;if(t.place!=='town')t.leaveRoom();t.daylight.setHour(10.5);t.warp(0,10,0);t.setView('third');
    const p=t.player.entity.getPosition().clone(),f=t.player.entity.forward,a=Math.atan2(-f.x,-f.z)+turn*Math.PI/180;
    t.app.off('prerender',window.__heroShot);
    window.__heroShot=()=>{t.camera.setPosition(p.x+Math.sin(a)*2.7,p.y+1.45,p.z+Math.cos(a)*2.7);t.camera.lookAt(p.x,p.y+1.05,p.z);};
    t.app.on('prerender',window.__heroShot);
  },[turn]);
  for(let i=0;i<25;i++)await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
  if(SHOTS)await page.screenshot({path:`${SHOTS}/${name}.png`});
  await page.evaluate(()=>{const t=window.__qinghe.town;t.app.off('prerender',window.__heroShot);t.setView('first');});
}
/** What the renderer is doing at the level in force: the post pass, its ambient occlusion, painted surfaces. */
const pipeline=page=>page.evaluate(()=>{
  const t=window.__qinghe.town,cam=t.camera.camera,frame=t.look.frame,m=t.player.torso.render.meshInstances[0].material;
  return {post:cam.framePasses.length>0,ssao:!!frame?.enabled&&frame.ssao.type!=='none',textured:!!m.diffuseMap,fog:t.app.scene.fog.type};
});

test('the look test: the shop by day, dusk and night, inside, and the tourist, with what each costs',async({page})=>{
  test.setTimeout(300000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await start(page,'high');
  expect(await page.evaluate(()=>{const t=window.__qinghe.town,b=t.buildings.get('homeware');return [t.data.buildings.find(x=>x.id==='homeware').style,!!b.findByName('roof'),!!t.rooms.get('homeware').root.findByName('goods-wall')];}))
    .toEqual(['jiangnan',true,true]);
  expect(await pipeline(page)).toEqual({post:true,ssao:true,textured:true,fog:'exp2'});
  const costs={
    'square-high':await view(page,'square-day-high',SHOP),
    'square-dusk-high':await view(page,'square-dusk-high',{...SHOP,hour:19.3}),
    'square-night-high':await view(page,'square-night-high',{...SHOP,hour:22}),
    'interior-high':await view(page,'interior-high',INSIDE),
  };
  for(const [name,spot] of [['lane-day-high',LANE],['lane-dusk-high',{...LANE,hour:19.3}],['lane-night-high',{...LANE,hour:22}],
    ['front-day-high',FRONT],['front-night-high',{...FRONT,hour:22}],['interior-corner-high',CORNER],['interior-night-high',{...INSIDE,hour:22}]])
    await view(page,name,spot);
  await hero(page,'hero-front-high',0);
  await hero(page,'hero-three-quarter-high',40);
  await level(page,'medium');
  expect(await pipeline(page)).toEqual({post:true,ssao:false,textured:true,fog:'exp2'});
  costs['square-medium']=await view(page,'square-day-medium',SHOP);
  costs['interior-medium']=await view(page,'',INSIDE);
  await level(page,'low');
  expect(await pipeline(page)).toEqual({post:false,ssao:false,textured:false,fog:'none'});
  costs['square-low']=await view(page,'square-day-low',SHOP);
  costs['square-night-low']=await view(page,'square-night-low',{...SHOP,hour:22});
  costs['interior-low']=await view(page,'interior-low',INSIDE);
  await view(page,'lane-day-low',LANE);
  console.log('look costs:',JSON.stringify(costs));
  for(const level of ['medium','low']){
    expect(costs['square-'+level].calls,`the square on ${level}`).toBeLessThanOrEqual(BEFORE.square[level]*1.2);
    expect(costs['interior-'+level].calls,`the shop inside on ${level}`).toBeLessThanOrEqual(BEFORE.interior[level]*1.3);
  }
  expect(costs['square-high'].calls).toBeLessThanOrEqual(900);
  expect(errors).toEqual([]);
});
