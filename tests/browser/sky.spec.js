import {test,expect} from '@playwright/test';
import {startGame} from './start.js';

/**
 * S-sky: the sun, the moon and the stars (src/world/sky.js). The sun is drawn where the light comes
 * from, the night's things are never drawn by day, looking at each names it, and the sky costs a
 * handful of draw calls in the town and in 云海, where the bay mirrors it.
 */
async function start(page){
  await page.setViewportSize({width:1280,height:720});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await startGame(page);
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(()=>{
    const town=window.__qinghe.town,app=town.app;
    town.daylight.paused=true;
    window.__frames=n=>new Promise(done=>{let k=0;const f=()=>{if(++k>=n){app.off('frameend',f);done();}};app.on('frameend',f);});
    /** Set the hour, face a sky thing (or not), and read what is drawn and named after two frames. */
    window.__sky=async(hour,face)=>{
      town.daylight.setHour(hour);await window.__frames(2);
      const sky=town.sky,eye=town.camera.getPosition();
      if(face){const d=sky[face].getPosition().clone().sub(eye).normalize();town.yaw=Math.atan2(-d.x,-d.z)*180/Math.PI;town.pitch=Math.asin(d.y)*180/Math.PI;}
      await window.__frames(3);
      const toSun=sky.sun.getPosition().clone().sub(town.camera.getPosition()).normalize();
      return {sun:sky.sun.enabled,moon:sky.moon.enabled,stars:sky.stars.enabled,
        agree:toSun.dot(town.sun.up),looking:town.looking?.id??null,drawCalls:app.stats.drawCalls.total};
    };
  });
  return errors;
}

test('the sun agrees with the light, and night things stay out of the day',async({page})=>{
  const errors=await start(page);
  // In the open square, not at the park gate where new travellers start under the pines.
  await page.evaluate(()=>{window.__qinghe.profile.dayIndex=27;window.__qinghe.town.warp(0.6,4.9,0);});   // 中秋节: a full moon
  for(const hour of [7.5,10,12.5,16,18]){
    const seen=await page.evaluate(h=>window.__sky(h,'sun'),hour);
    expect(seen.sun,`sun up at ${hour}`).toBe(true);
    expect(seen.agree,`sun where the light is at ${hour}`).toBeGreaterThan(.9999);
    expect(seen.moon||seen.stars,`nothing of the night at ${hour}`).toBe(false);
    expect(seen.looking,`named at ${hour}`).toBe('sun');
  }
  const night=await page.evaluate(()=>window.__sky(23,'moon'));
  expect(night).toMatchObject({sun:false,moon:true,stars:true,looking:'yueliang'});
  const stars=await page.evaluate(()=>{const t=window.__qinghe.town;t.yaw=180;t.pitch=70;return window.__frames(3).then(()=>t.looking?.id);});
  expect(stars).toBe('star');
  // A new moon (a week after 中秋节) is not drawn at all.
  const dark=await page.evaluate(async()=>{window.__qinghe.profile.dayIndex=34;await window.__frames(2);return window.__sky(23);});
  expect(dark.moon).toBe(false);
  expect(errors).toEqual([]);
});

test('in 云海 the sky holds with the light, shows in the bay and stays within the draw-call budget',async({page})=>{
  const errors=await start(page);
  // On the promenade at the railing: the evening sun is low over the bay, to the west-north-west.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.warp(-4000,-46.5,0);});
  const evening=await page.evaluate(()=>window.__sky(18.5,'sun'));
  expect(evening).toMatchObject({sun:true,moon:false,stars:false,looking:'sun'});
  expect(evening.agree).toBeGreaterThan(.9999);
  // An hour on, far from town: the light turns in steps, and the sun goes with it.
  const later=await page.evaluate(async()=>{
    const t=window.__qinghe.town;t.daylight.setHour(12);t.daylight.paused=false;t.app.timeScale=30;await window.__frames(20);
    t.app.timeScale=1;t.daylight.paused=true;await window.__frames(2);
    return t.sky.sun.getPosition().clone().sub(t.camera.getPosition()).normalize().dot(t.sun.up);
  });
  expect(later).toBeGreaterThan(.9999);
  const night=await page.evaluate(async()=>{
    window.__qinghe.profile.dayIndex=27;const t=window.__qinghe.town;
    const seen=await window.__sky(22);t.yaw=0;t.pitch=6;await window.__frames(3);
    const layer=t.app.scene.layers.getLayerByName('bay-reflection');
    return {...seen,drawCalls:t.app.stats.drawCalls.total,mirrored:t.sky.moon.render.layers.includes(layer.id)};
  });
  expect(night).toMatchObject({sun:false,moon:true,stars:true,mirrored:true});
  expect(night.drawCalls).toBeLessThanOrEqual(900);
  expect(errors).toEqual([]);
});

test('on 中秋节 looking at the moon from the park after dark still counts for the errand',async({page})=>{
  const errors=await start(page);
  const seen=await page.evaluate(async()=>{
    const q=window.__qinghe,t=q.town;
    q.profile.dayIndex=27;t.warp(-9,26,0);
    const before=q.profile.daily?.day===27?q.profile.daily.counts.moon??0:0;
    const s=await window.__sky(23,'moon');
    const p=t.player.entity.getPosition();
    return {before,looking:s.looking,district:t.districtAt(p.x,p.z)?.id,moonNorth:t.sky.moon.getPosition().z<p.z,
      counted:q.profile.daily?.counts?.moon??0};
  });
  expect(seen).toMatchObject({before:0,looking:'yueliang',district:'garden',moonNorth:true,counted:1});
  expect(errors).toEqual([]);
});
