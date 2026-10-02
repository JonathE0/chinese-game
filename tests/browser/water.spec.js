import {test,expect} from '@playwright/test';
import {startGame} from './start.js';

/**
 * Flowing, reacting water and the bay's reflection (docs/superpowers/plans/2026-09-26-development-wave-2.md, H-water).
 * Draw calls are measured like performance.spec.js; the frame times are reported, not judged,
 * since a test browser's timing says little about a player's.
 */
async function start(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await startGame(page);
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  return errors;
}
/** Draw calls of the frame after next, the median frame time over 30 frames, whether the bay's
 *  mirror is on, and how many frames it actually drew meanwhile. */
const frame=page=>page.evaluate(()=>new Promise(done=>{
  const t=window.__qinghe.town,app=t.app,times=[];let last=0,from=0;
  const mirror=t.rooms.get('city')?.parts.find(part=>part.mirror)?.mirror;
  const tick=now=>{
    if(last)times.push(now-last);else from=mirror?.frames??0;
    last=now;
    if(times.length<30)return requestAnimationFrame(tick);
    times.sort((a,b)=>a-b);
    done({calls:app.stats.drawCalls.total,ms:+times[15].toFixed(1),mirror:!!mirror?.camera.camera.enabled,drew:(mirror?.frames??0)-from});
  };
  requestAnimationFrame(()=>requestAnimationFrame(tick));
}));

test('the bay stays inside the draw-call budget at night, with and without its reflection',async({page})=>{
  const errors=await start(page);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.daylight.setHour(21);t.daylight.paused=true;});
  // The promenade by the railing, and the hotpot terrace on the hill, both looking out over the bay.
  for(const [name,x,z,y] of [['the promenade',30,-46.5,0],['the hill terrace',-72,-40,14.2]]){
    const seen={};
    for(const on of [true,false]){
      await page.evaluate(([x,z,y,on])=>{const t=window.__qinghe.town;t.reflections=on;t.warp(-4000+x,z,0,y);},[x,z,y,on]);
      seen[on]=await frame(page);
      expect(seen[on].mirror,`${name}: the mirror ${on?'draws':'is off'}`).toBe(on);
      if(on)expect(seen[on].drew,`${name}: frames the mirror drew`).toBeGreaterThanOrEqual(25);
      else expect(seen[on].drew,`${name}: frames the mirror drew`).toBe(0);
      expect(seen[on].calls,`draw calls at ${name}`).toBeLessThanOrEqual(900);
    }
    expect(seen.true.calls-seen.false.calls,`the reflection's own draw calls at ${name}`).toBeLessThanOrEqual(150);
    const note=`${name}: ${seen.true.calls} draw calls, ${seen.true.ms} ms with the reflection; ${seen.false.calls}, ${seen.false.ms} ms without`;
    test.info().annotations.push({type:'water',description:note});console.log(note);
  }
  expect(errors).toEqual([]);
});

test('ripples stay in their pool, and a toy thrown into the pond floats and rings spread',async({page})=>{
  const errors=await start(page);
  const seen=await page.evaluate(()=>new Promise(done=>{
    const t=window.__qinghe.town,w=t.water,length=w.ripples.data.length;
    for(let i=0;i<50;i++)w.ripple(i,i);
    const full=w.ripples.active;
    // An apple dropped over the open pond, clear of the island and the bridges.
    const body=t.toys.spawn({parent:t.toyRoot,place:'town',x:-5,y:2,z:28,size:[.3,.3,.3]});
    const before=w.ripples.data.slice(),spawned=w.levelAt('town',-5,28);
    setTimeout(()=>done({length,after:w.ripples.data.length,full,y:body.y,afloat:!!body.afloat,spawned,
      rung:[...w.ripples.data].some((v,i)=>i%4===0&&v!==before[i])}),1500);
  }));
  expect(seen.after).toBe(seen.length);
  expect(seen.full).toBe(8);
  expect(seen.spawned,'there is water there').not.toBeNull();
  expect(seen.afloat).toBe(true);
  expect(seen.y).toBeLessThan(seen.spawned+.2);
  expect(seen.rung,'a ring where it landed').toBe(true);
  expect(errors).toEqual([]);
});

/** A block of pixels from the frame just drawn, read before the canvas is cleared. */
const pixels=page=>page.evaluate(()=>new Promise(done=>{
  const app=window.__qinghe.town.app,gl=app.graphicsDevice.gl;
  requestAnimationFrame(()=>app.once('postrender',()=>{
    const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,out=new Uint8Array(96*48*4);
    gl.readPixels(Math.round(w/2-48),Math.round(h*.25),96,48,gl.RGBA,gl.UNSIGNED_BYTE,out);
    done([...out]);
  }));
}));
const difference=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length;

test('water looks the same after leaving and coming back, and the bay mirrors again',async({page})=>{
  const errors=await start(page);
  // The pond from its north bank, with the water's clock and the day held still.
  const look=()=>page.evaluate(()=>{const t=window.__qinghe.town;t.warp(0,23.5,180);t.pitch=-20;});
  await page.evaluate(()=>{const t=window.__qinghe.town;t.daylight.setHour(13);t.daylight.paused=true;t.water.paused=true;});
  await look();await page.waitForTimeout(300);
  const before=await pixels(page);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterRoom('cafe');});
  await page.waitForTimeout(300);
  await page.evaluate(()=>window.__qinghe.town.leaveRoom());
  await look();await page.waitForTimeout(300);
  const after=await pixels(page);
  expect(difference(before,after),'the pond, before and after a visit to the café').toBeLessThan(3);

  // 云海: the mirror is back on with everything it reflected, after a trip home and back.
  const state=()=>page.evaluate(()=>{
    const t=window.__qinghe.town,m=t.rooms.get('city').parts.find(part=>part.mirror).mirror;
    return {on:m.camera.camera.enabled,meshes:m.layer.meshInstances.length,size:[m.rt.width,m.rt.height],strength:m.strength};
  });
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.daylight.setHour(21);t.warp(-3970,-46.5,0);});
  await frame(page);
  const first=await state();
  expect(first.on).toBe(true);
  await page.evaluate(()=>window.__qinghe.town.leaveCity());
  await frame(page);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.warp(-3970,-46.5,0);});
  await frame(page);
  expect(await state()).toEqual(first);
  expect(errors).toEqual([]);
});

test('水面倒影 in Settings turns the bay\'s reflection off and on',async({page})=>{
  await start(page);
  await page.locator('#settings-button').click();
  const box=page.getByRole('checkbox',{name:/水面倒影/});
  await expect(box).toBeChecked();
  await box.uncheck();
  expect(await page.evaluate(()=>[window.__qinghe.town.reflections,window.__qinghe.profile?.settings?.reflections])).toEqual([false,false]);
  await box.check();
  expect(await page.evaluate(()=>window.__qinghe.town.reflections)).toBe(true);
});
