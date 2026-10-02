import {test,expect} from '@playwright/test';
import {startGame} from './start.js';
import {readFileSync} from 'node:fs';

const SHOW=JSON.parse(readFileSync('src/content/drones.json','utf8'));

// The drone show runs off the game clock (a game hour is 60 real seconds): stop the clock
// `seconds` into the 20:00 show, on the promenade, looking up at the formation over the bay.
const HOLD=SHOW.launch+SHOW.rise+SHOW.hold/2;   // the middle of the first formation, 你好
async function watch(page,seconds){
  await page.evaluate(([hour])=>{
    const t=window.__qinghe.town;
    t.daylight.paused=true;t.daylight.setHour(hour);
    t.warp(-4000+15,-44,0);t.pitch=40;
  },[20+seconds/60]);
  // A few frames, so the show catches up with the clock and the look box follows the drones.
  await page.evaluate(()=>new Promise(done=>{let n=0;const tick=()=>++n>4?done():requestAnimationFrame(tick);tick();}));
}
const stats=page=>page.evaluate(()=>new Promise(done=>{
  const app=window.__qinghe.town.app;
  requestAnimationFrame(()=>requestAnimationFrame(()=>done(app.stats.drawCalls.total)));
}));

test('the drone show draws 你好 over the bay in two draw calls, and looking at it names it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await startGame(page);
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(()=>window.__qinghe.town.enterCity());

  await watch(page,-30);   // half a minute before the show: no drones out
  expect(await page.evaluate(()=>window.__qinghe.town.rooms.get('city').root.findByName('drones').enabled)).toBe(false);

  await watch(page,1);     // lights on at the barge, before take-off
  await watch(page,HOLD);
  const during=await stats(page);
  const drones=await page.evaluate(()=>{
    const entity=window.__qinghe.town.rooms.get('city').root.findByName('drones');
    return {enabled:entity.enabled,instances:entity.render.meshInstances.map(mi=>mi.instancingCount)};
  });
  expect(drones.enabled).toBe(true);
  expect(drones.instances.reduce((a,b)=>a+b,0)).toBe(SHOW.count);
  expect(drones.instances.length).toBe(2);
  // Two instanced draws for the drones, and two more if the bay reflects them. Measured by hiding
  // the drones at the same moment: the boats sail on with the clock, so an earlier frame differs.
  await page.evaluate(()=>{window.__qinghe.town.rooms.get('city').root.findByName('drones').render.enabled=false;});
  const without=await stats(page);
  await page.evaluate(()=>{window.__qinghe.town.rooms.get('city').root.findByName('drones').render.enabled=true;});
  expect(during-without,'draw calls the show adds').toBeLessThanOrEqual(4);
  expect(during,'draw calls on the promenade during the show').toBeLessThanOrEqual(900);

  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.zh??null),{timeout:6000}).toBe('你好');
  // Between formations the lights are just drones.
  await watch(page,SHOW.launch+SHOW.rise+SHOW.hold+SHOW.move/2);
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.zh??null),{timeout:6000}).toBe('无人机');

  // As the drones come down, the 20:00 show says there is another one at eleven.
  const length=SHOW.launch+SHOW.rise+SHOW.formations.length*SHOW.hold+(SHOW.formations.length-1)*SHOW.move+SHOW.land;
  await page.evaluate(()=>{const t=window.__qinghe.town;t.announced=[];t.onAnnounce=line=>t.announced.push(line.audio);});
  await watch(page,length-SHOW.land-.5);
  await watch(page,length-SHOW.land+.5);
  expect(await page.evaluate(()=>window.__qinghe.town.announced)).toEqual(['drones-end-first']);

  // Admin and tests can start one in the morning.
  await watch(page,-600);
  await page.evaluate(()=>import('/src/world/drones.js').then(m=>m.startShow()));
  await page.waitForTimeout(400);
  expect(await page.evaluate(()=>window.__qinghe.town.rooms.get('city').root.findByName('drones').enabled)).toBe(true);
  expect(await page.evaluate(()=>window.__qinghe.town.announced)).toEqual(['drones-end-first','drones-start']);
  expect(errors).toEqual([]);
});

test('a show announcement that starts while a panel is open plays ducked under it',async({page})=>{
  await page.goto('/');await startGame(page);
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  const volumes=await page.evaluate(line=>{
    const ctx=window.__qinghe;
    ctx.voice.clips[line.audio]={approved:true,src:'/audio/clips/assistant-bye.mp3',voice:'zh-CN'};
    ctx.ui.open('shop','商店','');
    ctx.town.onAnnounce(line);
    return {playing:ctx.voice.ambient.volume,full:ctx.voice.settings.ambientVolume};
  },SHOW.lines.start);
  expect(volumes.playing).toBeCloseTo(volumes.full*.18,3);
});
