import {test,expect} from '@playwright/test';

// Inside a shop, the doorway shows the street: a camera in the town renders it into a texture,
// but only while the doorway is on screen, and never out in the town itself.
test('inside 慢慢咖啡 the street view renders facing the door, not facing the back wall',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  const state=()=>page.evaluate(()=>{const v=window.__qinghe.town.views,p=v.camera.getPosition();
    return {frames:v.frames,on:v.camera.camera.enabled,x:p.x,z:p.z};});
  const rendered=async()=>{const a=(await state()).frames;await page.waitForTimeout(400);return (await state()).frames-a;};

  await page.evaluate(()=>{const t=window.__qinghe.town,r=t.rooms.get('cafe');t.enterRoom('cafe');
    t.warp(r.offsetX,r.data.size[1]/2-1.5,180);});   // facing the doorway
  expect(await rendered()).toBeGreaterThan(3);
  const facing=await state();
  expect(facing.on).toBe(true);
  // The camera stands inside the café's building on the square (door at x 28, z 5.9, facing north).
  expect(facing.x).toBeCloseTo(28,2);
  expect(facing.z).toBeGreaterThan(5.9);

  await page.evaluate(()=>{window.__qinghe.town.yaw=0;});   // facing the back wall
  await page.waitForTimeout(100);
  expect(await rendered()).toBe(0);
  expect((await state()).on).toBe(false);

  await page.evaluate(()=>{const t=window.__qinghe.town;t.yaw=180;t.leaveRoom();});
  await page.waitForTimeout(100);
  expect(await rendered()).toBe(0);
});

// The worst view in town: the word hall's tall doorway onto the square, after dark with the lamps lit.
test('the word hall at night, door on screen, stays inside the 900 draw-call budget',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(()=>{const t=window.__qinghe.town,r=t.rooms.get('hall'),s=r.data.spawn;
    t.daylight.paused=true;t.daylight.setHour(22);t.enterRoom('hall');t.warp(r.offsetX+s[0],s[1],180,t.playerY);});
  await page.waitForTimeout(600);
  const {calls,rendered}=await page.evaluate(async()=>{const t=window.__qinghe.town,from=t.views.frames,calls=[];
    await new Promise(done=>{const tick=()=>{calls.push(t.app.stats.drawCalls.total);calls.length<30?requestAnimationFrame(tick):done();};requestAnimationFrame(tick);});
    calls.sort((a,b)=>a-b);return {calls:calls[15],rendered:t.views.frames-from};});
  expect(rendered).toBeGreaterThan(10);
  expect(calls).toBeLessThanOrEqual(900);
});
