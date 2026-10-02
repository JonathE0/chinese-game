import {test,expect} from '@playwright/test';

/**
 * The Jiangnan look across the whole town (task W5-town, docs/superpowers/specs/2026-10-01-jiangnan-look-design.md,
 * phase P1): every Qinghe building in white plaster and dark tile. It measures what the town costs to
 * draw from the spawn, the square, the market street and the riverside on 高, 中 and 低 (draw calls,
 * and the time a frame takes with the GPU waited for), and with SHOTS set it photographs each
 * district by day and at night at 1440×1000 (for looking at, not for comparing).
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
/** Stand at (x,z) looking at (tx,tz) at an hour, let it settle, then count the draw calls and time
 *  frames drawn with the GPU waited for (app.render, then a one-pixel read). */
async function view(page,name,{at:[x,z],to:[tx,tz],pitch=-4,hour=10.5}){
  const out=await page.evaluate(async([x,z,tx,tz,pitch,hour])=>{
    const t=window.__qinghe.town,app=t.app,gl=app.graphicsDevice.gl;
    if(t.place!=='town')t.leaveRoom();
    t.daylight.setHour(hour);
    t.warp(x,z,Math.atan2(-(tx-x),-(tz-z))*180/Math.PI);t.pitch=pitch;
    for(let i=0;i<30;i++)await new Promise(r=>requestAnimationFrame(r));
    const calls=app.stats.drawCalls.total,px=new Uint8Array(4),times=[];
    for(let i=0;i<25;i++){
      const s=performance.now();app.render();
      const read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
      gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);
      times.push(performance.now()-s);
    }
    times.sort((a,b)=>a-b);
    return {calls,ms:+times[times.length>>1].toFixed(2)};
  },[x,z,tx,tz,pitch,hour]);
  if(SHOTS&&name)await page.screenshot({path:`${SHOTS}/${name}.png`});
  return out;
}
// Where the costs are measured: the spawn by the park gate, the square, down the market street, and
// the riverside looking west at its shops.
const COSTS={
  spawn:{at:[.8,63.4],to:[-1.2,52],pitch:3},
  square:{at:[0,2],to:[0,-10]},
  market:{at:[34,0],to:[60,0]},
  riverside:{at:[-27,5],to:[-52,2]},
};
// Each district by day and at night.
const SCENES={
  'square-west':{at:[-5,1],to:[-17,-4],pitch:2},
  'square-south':{at:[-8,7],to:[-18,10],pitch:2},
  'square-east':{at:[3,-1],to:[13,-3],pitch:2},
  'market-east':{at:[25,0],to:[45,-3],pitch:1},
  'market-west':{at:[62,1],to:[42,4],pitch:1},
  'riverside-post':{at:[-25.5,9],to:[-31,1],pitch:3},
  'riverside-west':{at:[-45,8],to:[-53,0],pitch:3},
  'riverside-pharmacy':{at:[-36.5,-1.5],to:[-41,-8.5],pitch:4},
  'home':{at:[13,61],to:[17,48],pitch:4},
  'wordhall':{at:[0,-6],to:[0,-22],pitch:6},
  'teahouse':{at:[20,21],to:[23,30],pitch:4},
};
/** Draw calls on 中 before the rollout (2026-10-01, the same spots, P0's 家居小铺 already in; 高 469/136/137/117,
 *  低 259/97/84/69). The budget on 中: at most 20% more. */
const BEFORE={spawn:284,square:114,market:109,riverside:95};

test('the town in Jiangnan style: what it costs from the spawn, the square, the market and the riverside, and how each district looks',async({page})=>{
  test.setTimeout(400000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await start(page,'high');
  const costs={};
  for(const lv of ['high','medium','low']){
    await level(page,lv);
    for(const [spot,where] of Object.entries(COSTS))(costs[spot]??={})[lv]=await view(page,'',where);
  }
  console.log('town costs:',JSON.stringify(costs));
  await level(page,'high');
  if(SHOTS){
    // The tea house's site, built, for its photographs.
    await page.evaluate(()=>window.__qinghe.town.revealSite('teahouse'));
    for(const [name,where] of Object.entries(SCENES)){
      await view(page,name+'-day',where);
      await view(page,name+'-night',{...where,hour:22});
    }
  }
  for(const [spot,c] of Object.entries(costs)){
    expect(c.high.calls,`${spot} on 高`).toBeLessThanOrEqual(900);
    expect(c.medium.calls,`${spot} on 中`).toBeLessThanOrEqual(BEFORE[spot]*1.2);
  }
  expect(errors).toEqual([]);
});
