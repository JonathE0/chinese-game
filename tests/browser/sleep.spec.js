import {test,expect} from '@playwright/test';

// Sleeping: a hop into bed, the view settling on the canopy, a fade to black while the clock jumps,
// and the tourist back on their feet beside the bed. Nothing takes input until it is over.
const SAVE_KEY='little-mandarin-town.v1';

async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},stats:{hunger:20,energy:40,hour:14},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(500);
}
/** In front of the starter bed upstairs, facing it, with the sleep panel open. */
async function openSleep(page){
  const bed=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.enterRoom('home');
    const room=t.rooms.get('home'),bed=[...room.props.values()].find(p=>p.kind==='bed');
    const front=t.onBed(bed,0,0,1.3);t.warp(front.x,front.z,(bed.rot??0),bed.y);
    return {x:front.x,z:front.z,y:bed.y};
  });
  await page.waitForTimeout(250);
  await expect(page.locator('#interact span')).toHaveText('睡觉 · 选时间');
  await page.keyboard.press('e');
  await expect(page.locator('[data-sleep]')).toHaveCount(4);
  return bed;
}
const state=page=>page.evaluate(()=>{
  const t=window.__qinghe.town,p=t.player.entity.getPosition(),veil=document.querySelector('.fade-veil');
  return {x:p.x,y:p.y,z:p.z,paused:t.paused,sleeping:!!t.sleeping,pitch:t.pitch,eye:t.camera.getPosition().y,
    veil:veil?Number(getComputedStyle(veil).opacity):null,panel:window.__qinghe.ui.panelId,view:t.view};
});

test('sleeping hops into bed, looks up at the canopy, fades through the night and stands you up beside the bed',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const bed=await openSleep(page);
  await page.locator('[data-sleep="night"]').click();
  // Mid-hop: in the air on the way in, with input locked and a clear veil already over the screen.
  await page.waitForTimeout(300);
  let now=await state(page);
  expect(now).toMatchObject({paused:true,sleeping:true,panel:null});
  expect(now.veil).toBeLessThan(.5);
  expect(now.y).toBeGreaterThan(bed.y+.3);
  // Settled: lying on the mattress, looking up; holding W and pressing a panel key change nothing.
  await page.waitForTimeout(450);
  now=await state(page);
  expect(now.pitch).toBeGreaterThan(60);
  expect(now.eye-bed.y).toBeLessThan(1.3);
  await page.keyboard.down('w');await page.keyboard.press('Digit2');await page.waitForTimeout(300);await page.keyboard.up('w');
  const still=await state(page);
  expect([still.x,still.z]).toEqual([now.x,now.z]);
  expect(still.panel).toBeNull();
  // Black, then the new time, then the veil lifts with the tourist standing beside the bed.
  await expect.poll(async()=>(await state(page)).veil,{timeout:3000}).toBeGreaterThan(.95);
  await expect(page.locator('#place-time')).toContainText('22:');
  await expect(page.locator('.fade-veil')).toHaveCount(0,{timeout:4000});
  now=await state(page);
  expect(now).toMatchObject({paused:false,sleeping:false,view:'first'});
  expect(now.pitch).toBeLessThan(10);
  expect(Math.hypot(now.x-bed.x,now.z-bed.z)).toBeLessThan(.3);
  expect(now.y).toBeCloseTo(bed.y,2);
  expect(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).stats.energy).toBe(100);
  // Walking works again.
  await page.keyboard.down('d');await page.waitForTimeout(300);await page.keyboard.up('d');
  const after=await state(page);
  expect(Math.hypot(after.x-now.x,after.z-now.z)).toBeGreaterThan(.2);
  expect(errors).toEqual([]);
});

test('with reduced motion, sleeping skips the hop and only fades',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await start(page);
  const bed=await openSleep(page);
  await page.locator('[data-sleep="morning"]').click();
  await page.waitForTimeout(200);
  const now=await state(page);
  expect(now).toMatchObject({paused:true,sleeping:false});
  expect(now.veil).not.toBeNull();
  await expect(page.locator('#place-time')).toContainText('07:');
  await expect(page.locator('.fade-veil')).toHaveCount(0,{timeout:4000});
  const up=await state(page);
  expect(up.paused).toBe(false);
  expect(Math.hypot(up.x-bed.x,up.z-bed.z)).toBeLessThan(.3);
});
