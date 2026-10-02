import {test,expect} from '@playwright/test';

/**
 * Qinghe's ground, water and greenery in the Jiangnan look (task W5-nature, phase P3 of
 * docs/superpowers/specs/2026-10-01-jiangnan-look-design.md): bluestone paving, the river street's
 * canal, the plants, the park and the hills.
 *
 * It measures what four views cost on 高, 中 and 低 (draw calls, and the time a frame takes with the
 * GPU waited for), from where the tourist arrives, the square, the river street and the park. With
 * SHOTS set it photographs each, plus a few closer views, at 1440×1000.
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
/** Stand at (x,z) looking at (tx,tz) at an hour; let it settle, then count draw calls and time frames. */
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
    for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));
    return {calls,ms:+times[times.length>>1].toFixed(2)};
  },[x,z,tx,tz,pitch,hour]);
  if(SHOTS&&name)await page.screenshot({path:`${SHOTS}/${name}.png`});
  return out;
}
const VIEWS={
  spawn:{at:[0.8,63.4],to:[0,48],pitch:-2},
  square:{at:[0,12],to:[0,-12],pitch:-2},
  river:{at:[-30,8.5],to:[-42,2],pitch:-6},
  park:{at:[2,47],to:[-2,32],pitch:-6},
};
const EXTRA={
  canal:{at:[-40,1.4],to:[-40,10],pitch:-22},
  willow:{at:[-6.5,39],to:[-11.6,34.9],pitch:10},
  bank:{at:[-45.5,9.5],to:[-38,-1],pitch:-8},
  lane:{at:[-6,-8],to:[-16,-2],pitch:-10},
  pond:{at:[-12,44],to:[0,32],pitch:-8},
  rockery:{at:[-20,48],to:[-28,58],pitch:-4},
  market:{at:[30,0],to:[50,0],pitch:-4},
  edge:{at:[0,50],to:[-30,75],pitch:8},
};
/** Draw calls before this task (2026-10-01, the same views), so the budget can be checked: a street at
 *  most ~20% more on 中. Measured with the other W5 tasks' work in progress in the same folder. */
const BEFORE={spawn:{high:491,medium:296,low:274},square:{high:211,medium:154,low:137},
  river:{high:120,medium:99,low:72},park:{high:399,medium:249,low:228}};

test('nature: the paving, the canal, the plants, the park and the hills, with what each view costs',async({page})=>{
  test.setTimeout(400000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await start(page,'high');
  const costs={};
  for(const q of ['high','medium','low']){
    await level(page,q);
    for(const [name,spot] of Object.entries(VIEWS))costs[name+'-'+q]=await view(page,`${name}-${q}`,spot);
    if(q!=='medium')for(const [name,spot] of Object.entries(EXTRA))await view(page,`${name}-${q}`,spot);
  }
  await level(page,'high');
  await view(page,'river-night-high',{...VIEWS.river,hour:21.5});
  await view(page,'canal-dusk-high',{...EXTRA.canal,hour:19.2});
  console.log('nature costs:',JSON.stringify(costs));
  if(BEFORE)for(const name of Object.keys(VIEWS))
    expect(costs[name+'-medium'].calls,`${name} on medium`).toBeLessThanOrEqual(Math.ceil(BEFORE[name].medium*1.2));
  expect(errors).toEqual([]);
});
