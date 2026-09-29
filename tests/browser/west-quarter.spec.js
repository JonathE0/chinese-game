import {test,expect} from '@playwright/test';

// 河边文化街 as a walled Suzhou garden (docs/superpowers/plans/2026-09-24-west-quarter-and-scenery.md,
// Task S): on foot from the fountain, through the square's west lane, round the post office, over
// the south canal bridge and along the bank to the restaurant door.
const SAVE_KEY='little-mandarin-town.v1';

async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],
    discovered:[],clock:14,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.waitForTimeout(300);
}
/** Open the quarter as if earned. Every save re-checks the gates against the profile (main.js
 *  refreshGates), and noting a first visit saves, so a plain setUnlocked would be closed again. */
async function openQuarter(page){
  await page.evaluate(()=>{const t=window.__qinghe.town,set=t.setUnlocked.bind(t);
    t.setUnlocked=(id,open)=>set(id,id==='riverside'||open);t.setUnlocked('riverside',true);});
}
/** Hold W, steering at (x,z) every few frames; returns how far short of it the walk stopped. */
async function walkTo(page,x,z,limit=9000){
  const t0=Date.now();let left=Infinity;
  await page.keyboard.down('w');
  try{
    while(Date.now()-t0<limit){
      left=await page.evaluate(([x,z])=>{const t=window.__qinghe.town,p=t.player.entity.getPosition(),dx=x-p.x,dz=z-p.z;
        t.yaw=Math.atan2(-dx,-dz)*180/Math.PI;return Math.hypot(dx,dz);},[x,z]);
      if(left<.45)break;
      await page.waitForTimeout(40);
    }
  }finally{await page.keyboard.up('w');}
  return left;
}

test('from the fountain through the west lane, over a canal bridge, to the restaurant door',async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await openQuarter(page);
  // Due west from the fountain into the lane between 青禾银行 and 家居小铺, and through the gate.
  for(const [x,z] of [[-9.5,5],[-9.7,0],[-11,-0.3],[-12.6,-1.85],[-19.5,-1.85],[-23.3,-1.6]])
    expect(await walkTo(page,x,z),`to ${x},${z}`).toBeLessThan(.6);
  expect(await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return t.districtAt(p.x,p.z).id;})).toBe('riverside');
  // South past the post office, west along the south wall (round the tree, whose canopy is solid,
  // and the bench), and in through the east walkway to the bridge.
  for(const [x,z] of [[-23.3,7],[-23.3,9.8],[-34,9.8],[-34,7],[-35.4,6.2],[-36.8,6.2]])
    expect(await walkTo(page,x,z),`to ${x},${z}`).toBeLessThan(.6);
  // Over the crest of the arched bridge: the water below is not somewhere you can walk.
  expect(await walkTo(page,-40,6.2),'onto the crest').toBeLessThan(.6);
  expect(await page.evaluate(()=>window.__qinghe.town.playerY)).toBeGreaterThanOrEqual(1);
  for(const [x,z] of [[-44.5,6.2],[-51,6.2],[-51,5.3]])
    expect(await walkTo(page,x,z),`to ${x},${z}`).toBeLessThan(.6);
  expect(await page.evaluate(()=>window.__qinghe.town.playerY)).toBeLessThan(.05);
  await expect(page.locator('#interact span')).toHaveText('进餐厅');
  await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('restaurant');
  expect(errors).toEqual([]);
});

test('walking at the canal from the pharmacy walkway stops at the water',async({page})=>{
  await start(page);
  await openQuarter(page);
  const z=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.warp(-40,-3.2,180);t.keys.add('KeyW');
    for(let i=0;i<120;i++)t.update(1/30);
    t.keys.delete('KeyW');return t.player.entity.getPosition().z;
  });
  expect(z).toBeGreaterThan(-2.2);       // it did walk toward the water
  expect(z).toBeLessThan(-1.2-.3);       // and stopped at the canal's head
});

test('青禾药店\'s name board reads through the open bay of the pharmacy walkway, from the crest of either canal bridge',async({page})=>{
  await start(page);
  await openQuarter(page);
  for(const z of [1.4,6.2]){
    // Stand on the crest (y 1.2) and look at the middle of the board (y 3.65, just in front of z -4.5).
    await page.evaluate(z=>{const t=window.__qinghe.town;t.warp(-40,z,0,1.2);t.pitch=Math.atan2(3.65-1.2-1.62,z+4.28)*180/Math.PI;},z);
    await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.zh),{message:`from the bridge at z ${z}`}).toBe('青禾药店');
  }
});

test('the board hung under the pharmacy walkway reads 青禾药店 from under it and from both banks',async({page})=>{
  await start(page);
  await openQuarter(page);
  // The hanging board: x -42.05, y 2.88, z -2.45. The name board over the door: y 3.65, z -4.28,
  // seen from the west bank past the north bridge's (unnamed) guard rails.
  for(const [x,z,tx,ty,tz] of [[-42.8,-2.45,-42.05,2.88,-2.45],[-44.5,-2.45,-42.05,2.88,-2.45],[-35.6,-2.45,-42.05,2.88,-2.45],
    [-44.5,0.5,-42.05,2.88,-2.45],[-44.5,3,-40,3.65,-4.28]]){
    await page.evaluate(([x,z,tx,ty,tz])=>{const t=window.__qinghe.town,dx=tx-x,dz=tz-z;
      t.warp(x,z,Math.atan2(-dx,-dz)*180/Math.PI);t.pitch=Math.atan2(ty-1.62,Math.hypot(dx,dz))*180/Math.PI;},[x,z,tx,ty,tz]);
    await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.zh),{message:`from ${x},${z}`}).toBe('青禾药店');
  }
});
