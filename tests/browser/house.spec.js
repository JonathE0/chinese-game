import {test,expect} from '@playwright/test';

// Inside, the house matches the outside: a study through the west wall, and a real upstairs.
const SAVE_KEY='little-mandarin-town.v1';

async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:200,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},stats:{hunger:20,energy:70,hour:14},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...profile,
  })]);
}
async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(500);
}
/** Stand at a room-local spot, entering the room first if need be. */
async function stand(page,room,x,z,yaw=0,y=0){
  await page.evaluate(([r,x,z,yaw,y])=>{
    const town=window.__qinghe.town;if(town.place!==r)town.enterRoom(r);town.warp(town.rooms.get(r).offsetX+x,z,yaw,y);},[room,x,z,yaw,y]);
  await page.waitForTimeout(260);
}
/** Where the tourist is, in room-local coordinates. */
const where=page=>page.evaluate(()=>{
  const t=window.__qinghe.town,p=t.player.entity.getPosition(),room=t.rooms.get(t.place);
  return {place:t.place,x:+(p.x-(room?.offsetX??0)).toFixed(2),z:+p.z.toFixed(2)};
});
const propsIn=(page,room)=>page.evaluate(r=>[...window.__qinghe.town.rooms.get(r).props.values()].map(p=>({uid:p.uid,kind:p.kind,x:p.x,z:p.z,...(p.y?{y:p.y}:{})})),room);
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY);
async function press(page,label){
  await expect(page.locator('#interact span')).toHaveText(label);
  await page.keyboard.press('e');
  await page.waitForTimeout(320);
}
/** Click to put down the piece in hand. Once the world has the pointer, Playwright's jump to the
 *  click point reads as a mouse turn and the piece would go wherever the view drifted, so
 *  mouse-look is off. The first click takes the pointer (or, if the world already has it, puts
 *  the piece down); the second waits until the world has the pointer. */
async function clickToPlace(page){
  await page.evaluate(()=>{window.__qinghe.town.sensitivity=0;});
  await page.mouse.click(700,520);
  await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);
  await page.mouse.click(700,520);
}

test('the study is through the west door: shelves lend books, the desk pays +4, and the door leads back',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const words=[['bread','面包','miànbāo','bread'],['milk','牛奶','niúnǎi','milk'],['tea','茶','chá','tea'],['water','水','shuǐ','water']]
    .map(([id,zh,pinyin,en])=>({id,zh,pinyin,en}));
  await seed(page,{saved:words});
  await start(page);
  await stand(page,'home',-4.2,-1.7,-90);
  await press(page,'进书房 · 看书');
  expect((await where(page)).place).toBe('study');
  // The look ray names the window by the bookshelf.
  expect(await page.evaluate(()=>window.__qinghe.town.registry.boxes.some(b=>b.place==='study'&&b.name?.id==='window'))).toBe(true);

  await stand(page,'study',-1.6,.9,-90);
  await press(page,'入门架 · 看看书');
  await expect(page.locator('#panel.panel-library')).toBeVisible();
  await page.evaluate(()=>window.__qinghe.ui.close());

  await stand(page,'study',-.7,-1.4,-90);
  await press(page,'复习生词 · 书桌');
  await expect(page.locator('#panel.panel-wordbank')).toBeVisible();
  await page.locator('#bank-review').click();
  const id=await page.locator('.drill-prompt').getAttribute('data-word');
  await page.locator(`[data-pick="${id}"]`).click();
  await expect(page.locator('#drill-feedback .feedback')).toBeVisible();
  expect((await saved(page)).wallet).toBe(204);
  await page.evaluate(()=>window.__qinghe.ui.close());

  // The way back faces the living room (east); the street-side doorway is walled up.
  expect(await page.evaluate(()=>{const t=window.__qinghe.town;return t.canMove(t.rooms.get('study').offsetX,2.55,0);})).toBe(false);
  await stand(page,'study',1.6,-.3,-90);
  await press(page,'回客厅');
  expect(await where(page)).toEqual({place:'home',x:-3.9,z:-1.7});
  expect(errors).toEqual([]);
});

test('the stairs are walked up with W alone, the starter bed is upstairs, and W walks back down',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{completed:['home:tutorial']});
  await start(page);
  // A new player's bed and nightstand are upstairs, the rug downstairs.
  const props=await propsIn(page,'home');
  expect(props.filter(p=>p.y===2.9).map(p=>p.kind).sort()).toEqual(['bed','nightstand']);
  expect(props.filter(p=>!p.y).map(p=>p.kind)).toEqual(['rug']);
  // Every label the interact prompt shows from here on is kept, to prove nobody offers 上楼.
  await page.evaluate(()=>{window.__prompts=[];new MutationObserver(()=>window.__prompts.push(document.querySelector('#interact')?.textContent??''))
    .observe(document.querySelector('#interact'),{subtree:true,childList:true,characterData:true,attributes:true});});
  await stand(page,'home',-4.45,4.05,0);
  const warps=await page.evaluate(()=>window.__qinghe.town.warps);
  const height=async()=>Number(await page.locator('#map-player').getAttribute('data-y'));
  expect(await height()).toBeLessThan(.3);   // at the foot of the flight, on the first step at most
  // W stays down until the tourist stands on the upper floor. Under load frames come slowly, so a
  // fixed hold, or letting go a step or two short and waiting for the slide, varies with frame rate.
  await page.keyboard.down('w');
  try{await expect.poll(height,{timeout:20000,intervals:[100]}).toBeCloseTo(2.9,2);}finally{await page.keyboard.up('w');}
  await page.waitForTimeout(300);
  expect(await height()).toBeCloseTo(2.9,2);
  expect(await page.evaluate(()=>window.__qinghe.town.warps)).toBe(warps);
  expect((await where(page)).place).toBe('home');
  // Upstairs, the bed is somewhere to sleep; standing on the same spot downstairs offers nothing of the kind.
  await stand(page,'home',3.0,.5,-90,2.9);
  await expect(page.locator('#interact span')).toHaveText('睡觉 · 选时间');
  await stand(page,'home',3.0,.5,-90);
  expect(await page.evaluate(()=>window.__qinghe.town.nearest?.id??null)).not.toBe('sleep');
  // From the landing, W walks back down to the ground floor.
  await stand(page,'home',-4.45,-.9,180,2.9);
  await page.keyboard.down('w');
  try{await expect.poll(height,{timeout:20000,intervals:[100]}).toBe(0);}finally{await page.keyboard.up('w');}
  expect(await height()).toBe(0);
  expect((await page.evaluate(()=>window.__prompts)).filter(t=>t.includes('上楼'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('upstairs furniture, in a slot or placed by hand, is still upstairs after a reload',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{inventory:{'wooden-bed':1,'potted-plant':1}});
  await start(page);
  await stand(page,'home',1.9,-1.6,180,2.9);
  await press(page,'布置房间');
  // Upstairs, the panel offers the upstairs slots only.
  await expect(page.locator('[data-slot="up-bed"]')).toBeVisible();
  await expect(page.locator('[data-slot="bed"]')).toHaveCount(0);
  await page.locator('[data-slot="up-bed"]').click();
  await page.locator('[data-choose="wooden-bed"]').click();
  await page.locator('#slot-back').click();
  // The plant goes down by hand, two metres ahead on the upper floor, towards the balcony.
  await page.locator('[data-place="potted-plant"]').click();
  await expect(page.locator('#placing')).toContainText('放得下');
  await clickToPlace(page);
  await expect(page.locator('#toast')).toContainText('放好了');
  const home=(await saved(page)).home;
  expect(home).toEqual([
    expect.objectContaining({item:'wooden-bed',room:'home',slot:'up-bed',y:2.9}),
    expect.objectContaining({item:'potted-plant',room:'home',y:2.9})]);

  await page.reload();
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(500);
  const props=await propsIn(page,'home');
  expect(props).toEqual(expect.arrayContaining([expect.objectContaining({kind:'bed',x:4.25,z:.5,y:2.9}),expect.objectContaining({kind:'plant',y:2.9})]));
  expect(await page.evaluate(()=>[...window.__qinghe.town.rooms.get('home').props.values()].every(p=>Math.abs(p.entity.getLocalPosition().y-2.9)<.01))).toBe(true);
  expect(errors).toEqual([]);
});

test('an existing save with a bed in the living room loads with the bed where it was',async({page})=>{
  const bed={uid:'bed-old',item:'wooden-bed',kind:'bed',color:'#b98b5f',footprint:[2.1,1.4],x:2.9,z:-2.6,rot:0,slot:'bed'};
  await seed(page,{inventory:{'wooden-bed':1},home:[bed]});
  await start(page);
  expect(await propsIn(page,'home')).toEqual([{uid:'bed-old',kind:'bed',x:2.9,z:-2.6}]);
  expect(await page.evaluate(()=>window.__qinghe.profile.home)).toEqual([bed]);
  await stand(page,'home',2.9,-1.4,0);
  await expect(page.locator('#interact span')).toHaveText('睡觉 · 选时间');
});

test('an HSK certificate you own hangs on the wall and is still there after a reload; one you do not own is not offered',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{inventory:{'hsk-cert-1':1}});
  await start(page);
  await stand(page,'home',-1.6,-2.4,0);
  await press(page,'布置房间');
  await page.locator('[data-slot="wall-1"]').click();
  // The wall spot also sells paintings; of the certificates, only the one you own is offered.
  await expect(page.locator('[data-choose^="hsk-cert"]')).toHaveCount(1);
  await page.locator('[data-choose="hsk-cert-1"]').click();
  const after=await saved(page);
  expect(after.wallet).toBe(200);
  expect(after.home).toEqual([expect.objectContaining({item:'hsk-cert-1',kind:'certificate',slot:'wall-1'})]);
  // It hangs on the wall: nothing on the floor to walk into.
  expect(await page.evaluate(()=>window.__qinghe.town.registry.boxes.some(b=>b.place==='home'&&b.name?.id==='certificate'))).toBe(false);

  await page.reload();
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(500);
  expect(await propsIn(page,'home')).toEqual([expect.objectContaining({kind:'certificate',x:-1.2,z:-4.44})]);
  expect(errors).toEqual([]);
});
