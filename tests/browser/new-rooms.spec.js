import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// The post office, pharmacy, guesthouse and clothes shop: walk in through the front door, then
// on to the counter, on foot the whole way so collision and the door prompt are exercised.
const ROOMS=JSON.parse(readFileSync('src/content/rooms.json','utf8'));
const WORLD=JSON.parse(readFileSync('src/content/world.json','utf8'));
const COUNTERS=['postcounter','checkout','reception'];
// Where to turn on the way to the counter, where a straight line would clip the furniture.
const LEGS={'post-office':[],pharmacy:[],guesthouse:[[-.3,-1.2]],'clothes-shop':[[0,-1],[2.4,-1]]};
// The guesthouse faces the garden wall across a narrow walk, so you come along the walk.
const APPROACH={guesthouse:[[-21.2,18],[-18,18]]};

/** Hold W and steer at (x,z) in the current place until there, or until something stops you. */
async function walkTo(page,x,z,offset=0){
  await page.keyboard.down('w');
  let last=null,still=0;
  for(let i=0;i<120&&still<4;i++){
    const at=await page.evaluate(([x,z])=>{
      const t=window.__qinghe.town,p=t.player.entity.getPosition();
      t.yaw=Math.atan2(-(x-p.x),-(z-p.z))*180/Math.PI;
      return {x:p.x,z:p.z,left:Math.hypot(x-p.x,z-p.z)};
    },[x+offset,z]);
    if(at.left<.25)break;
    still=last&&Math.hypot(at.x-last.x,at.z-last.z)<.02?still+1:0;last=at;
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('w');
  // Momentum carries you on a little after W is let go; stand still before reading the door prompt.
  await expect.poll(()=>page.evaluate(()=>{const v=window.__qinghe.town.velocity;return Math.hypot(v.x,v.z);}),{timeout:3000}).toBeLessThan(.05);
}

for(const [id,data] of Object.entries(ROOMS).filter(([id])=>id in LEGS)){
  test(`walk into ${data.zh} from the street and up to its counter`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
    await page.waitForFunction(()=>!!window.__qinghe?.town);
    // A few steps out from the front, facing the door: south of it, or north for a building turned round.
    const face=(WORLD.buildings.find(b=>b.id===data.building).rotation??0)===180?-1:1;
    const [from,to]=APPROACH[id]??[[data.door.x,data.door.z+face*4],[data.door.x,data.door.z+face*1.2]];
    await page.evaluate(([x,z])=>window.__qinghe.town.warp(x,z),from);
    await walkTo(page,...to);
    // A door answers to E only while you face it; turn to it as a player would.
    await page.evaluate(([x,z])=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();t.yaw=Math.atan2(-(x-p.x),-(z-p.z))*180/Math.PI;},[data.door.x,data.door.z]);
    await expect(page.locator('#interact')).toBeVisible();
    await expect(page.locator('#interact span')).toHaveText(data.enterLabel);
    await page.keyboard.press('e');
    await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe(id);
    const offset=await page.evaluate(id=>window.__qinghe.town.rooms.get(id).offsetX,id);

    const counter=data.fittings.find(f=>COUNTERS.includes(f.kind));
    for(const [x,z] of LEGS[id])await walkTo(page,x,z,offset);
    await walkTo(page,counter.x,counter.z,offset);
    const at=await page.evaluate(()=>{const p=window.__qinghe.town.player.entity.getPosition();return {x:p.x,z:p.z};});
    const {hw,hd}=await page.evaluate(([id,i])=>window.__qinghe.town.rooms.get(id).fittings[i],[id,data.fittings.indexOf(counter)]);
    // Stopped by the counter itself, standing at its customer side.
    expect(Math.abs(at.x-offset-counter.x)).toBeLessThan(hw);
    expect(at.z-(counter.z+hd)).toBeGreaterThan(0);
    expect(at.z-(counter.z+hd)).toBeLessThan(.8);
    // And back out onto the street, somewhere you can walk on from.
    await walkTo(page,data.exit[0],data.exit[1],offset);
    await expect(page.locator('#interact span')).toHaveText('出去');
    await page.keyboard.press('e');
    await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('town');
    expect(await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return t.canMove(p.x,p.z,0);})).toBe(true);
    expect(errors).toEqual([]);
  });
}
