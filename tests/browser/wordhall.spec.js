import {test,expect} from '@playwright/test';

// The grand word hall at the north of the square (docs/superpowers/plans/2026-09-21-saves-art-hall-house.md,
// Task 5a): walked to on foot from the spawn. The riverside quarter it once hid now lies west of
// the fountain (2026-09-24-west-quarter-and-scenery.md, Task W), reached through the square's west lane.
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
const at=page=>page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return {x:p.x,y:p.y,z:p.z,place:t.place};});

test('from the spawn, through the paifang and up the stairs into 词语馆',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  expect(await walkTo(page,3.2,2.6)).toBeLessThan(.6);
  expect(await walkTo(page,0,-9)).toBeLessThan(.6);
  expect(await walkTo(page,0,-12.5)).toBeLessThan(.6);        // through the paifang
  expect(await walkTo(page,0,-17.4)).toBeLessThan(.6);        // up the stairs, between the columns
  expect((await at(page)).y).toBeCloseTo(1.2,1);
  await expect(page.locator('#interact span')).toHaveText('进词语馆');
  await page.keyboard.press('e');
  await expect(page.locator('.location b')).toHaveText('词语馆');
  // Coming out, you are back on the terrace, not buried in it.
  const out=await page.evaluate(()=>{const t=window.__qinghe.town;t.leaveRoom();const p=t.player.entity.getPosition();
    return {y:p.y,free:t.canMove(p.x,p.z,t.playerY)};});
  expect(out.y).toBeCloseTo(1.2,1);expect(out.free).toBe(true);
  expect(errors).toEqual([]);
});

test('the complex names its parts, stays in budget, and is photographed from the fountain',async({page})=>{
  await page.setViewportSize({width:960,height:540});
  await start(page);
  const result=await page.evaluate(()=>{
    const t=window.__qinghe.town,V=t.camera.getPosition().constructor;
    const look=(from,to)=>{const o=new V(...from),d=new V(to[0]-from[0],to[1]-from[1],to[2]-from[2]).normalize();
      return t.registry.look('town',o,d,40)?.box.name?.id??null;};
    // Every rise of the stairs is one you can walk up.
    const steps=t.registry.boxes.filter(b=>b.place==='town'&&b.group==='practice-house'&&b.name?.id==='step').map(b=>b.y1).sort((a,b)=>a-b);
    const rises=[...steps,1.2].map((y,i,all)=>y-(all[i-1]??0));
    // Reverting a layout edit puts the hall back where it is, not 22 m off its hitboxes.
    const b=t.data.buildings.find(b=>b.id==='practice-house');t.moveLayout('building',b.id,b.x,b.z);
    const parts=t.wordhall.root.children[0].getPosition();
    return {meshes:t.wordhall.root.find(e=>!!e.render).length,rises,parts:[parts.x,parts.z].map(v=>Math.round(v*1000)/1000+0),
      paifang:look([0,1.6,-6],[4,2,-10.5]),lion:look([0,1.6,-11],[3.1,1.5,-12.9]),step:look([0,1.6,-11],[0,.2,-14.3]),
      pillar:look([0,2.8,-15.8],[1.25,3,-17]),plaque:look([0,1.6,-12],[0,5.45,-18.4]),roof:look([0,1.6,6],[0,13,-22])};
  });
  console.log('word hall meshes',result.meshes);
  expect(result.meshes).toBeLessThan(520);
  expect(result.parts).toEqual([0,0]);
  for(const rise of result.rises)expect(rise).toBeLessThanOrEqual(.3+1e-6);
  expect(result).toMatchObject({paifang:'paifang',lion:'lion',step:'step',pillar:'pillar',plaque:'sign:room-hall',roof:'roof'});   // the plaque reads its own text, 词语馆
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(0,6.5,0);t.pitch=6;t.placeCamera(t.player.entity.getPosition());});
  await page.waitForTimeout(500);
  await page.screenshot({path:'test-results/wordhall-front.png'});
});

test('河边文化街 is found by walking west from the fountain, and its restaurant door opens',async({page})=>{
  await start(page);
  // Due west from the fountain, into the lane between 青禾银行 and 家居小铺.
  for(const [x,z] of [[-9.5,5],[-9.7,0],[-11,-0.3],[-12.6,-1.85],[-19.5,-1.85]])
    expect(await walkTo(page,x,z),`to ${x},${z}`).toBeLessThan(.6);
  // Locked, the gate still says what is missing.
  await expect(page.locator('#interact span')).toHaveText('看看告示');
  await page.keyboard.press('e');
  await expect(page.locator('.gate-note')).toContainText('还需要认识');
  await expect(page.locator('.gate-note')).toContainText('HSK 2');
  await page.keyboard.press('Escape');
  // Learn enough HSK 2 words for the gate to open for real; a forced unlock is re-locked by the next save.
  await page.evaluate(async()=>{
    const q=window.__qinghe,{words}=await (await fetch('/hsk/words.json')).json();
    for(const w of words.filter(w=>w.level===2).slice(0,30))q.profile.words[w.id]={recognition:{stage:1,due:Date.now()+9e6,last:Date.now(),reviews:1}};
    q.save();
  });
  await page.evaluate(()=>window.__qinghe.town.warp(-19.5,-1.85,-90));
  expect(await walkTo(page,-24,-1.85),'through the gate').toBeLessThan(.6);
  const where=await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return t.districtAt(p.x,p.z).id;});
  expect(where).toBe('riverside');
  // 家常餐厅 moved west with the quarter, door and all.
  await page.evaluate(()=>window.__qinghe.town.warp(-51,6,0));
  await expect(page.locator('#interact span')).toHaveText('进餐厅');
  await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('restaurant');
});
