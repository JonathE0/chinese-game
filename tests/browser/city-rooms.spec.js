import {test,expect} from '@playwright/test';

// Every other 云海 building opens inside (wave 3, N-interiors): walk up to a door on the street, go
// in, and come back out in front of the same door. The cinema's screening room takes a ticket, and
// the film on its screen plays while you sit.
const SAVE_KEY='little-mandarin-town.v1';
const ROOMS=['city-bank','city-bookshop','city-hospital','city-noodles','city-cinema','city-store','city-cafe'];
const SHOTS=process.env.SHOTS;   // a folder to save a screenshot of each room into, when set

async function start(page,profile={}){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:200,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},stats:{hunger:60,energy:70,hour:14},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...profile,
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
}
const place=page=>page.evaluate(()=>window.__qinghe.town.place);
/** Stand at a target (a door, the way out) and press E on it. */
async function useTarget(page,id,label){
  const spot=await page.evaluate(id=>{const g=window.__qinghe.town.targets().find(g=>g.id===id);return g&&{x:g.x,z:g.z};},id);
  expect(spot,`no target ${id}`).toBeTruthy();
  await page.evaluate(({x,z})=>window.__qinghe.town.warp(x,z),spot);
  await page.waitForTimeout(250);
  if(label)await expect(page.locator('#interact span')).toHaveText(label);
  await page.keyboard.press('e');
}

test('each city building is entered from its door and left back to it',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  for(const id of ROOMS){
    const {label,spawn}=await page.evaluate(id=>{const t=window.__qinghe.town,room=t.rooms.get(id);
      return {label:room.data.enterLabel,spawn:room.data.returnSpawn};},id);
    await useTarget(page,'door:'+id,label);
    await expect.poll(()=>place(page),{message:id}).toBe(id);
    if(SHOTS){
      await page.evaluate(id=>{const t=window.__qinghe.town,r=t.rooms.get(id);t.warp(r.offsetX,r.data.spawn[1],0);},id);
      await page.waitForTimeout(400);
      await page.screenshot({path:`${SHOTS}/${id}.png`,scale:'css'});
    }
    await useTarget(page,'door:city');
    await expect.poll(()=>place(page),{message:id+' out'}).toBe('city');
    const out=await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition(),x=t.rooms.get('city').offsetX;
      return {x:p.x-x,z:p.z,stuck:!!t.registry.blocks('city',p.x,p.z,t.playerY)};});
    expect(Math.hypot(out.x-spawn[0],out.z-spawn[1]),`${id}: back out at its door`).toBeLessThan(.3);
    expect(out.stuck,`${id}: set down inside something`).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('the counters sell what the plan lists, under the room\'s own name',async({page})=>{
  await start(page);
  for(const [id,title,first] of [['city-bookshop','一号书店','小说'],['city-cinema','光明电影院','电影票'],['city-store','便利店','矿泉水'],['city-cafe','海边咖啡','咖啡'],['city-hospital','中山医院','感冒药'],['pharmacy','青禾药店','感冒药']]){
    await page.evaluate(id=>window.__qinghe.town.enterRoom(id),id);
    await page.evaluate(id=>window.__qinghe.town.onInteract('shop:'+id),id);
    await expect(page.locator('#panel-title')).toHaveText(title);
    await expect(page.locator('.shop-card b').first()).toHaveText(first);
    await page.keyboard.press('Escape');
    await expect(page.locator('#panel')).toBeHidden();
  }
});

test('the screening room needs a ticket, takes one, and the film plays while you sit',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await page.evaluate(()=>window.__qinghe.town.enterRoom('city-cinema'));
  await useTarget(page,'door:city-cinema-hall');
  await expect(page.locator('#toast')).toContainText('电影票');
  expect(await place(page)).toBe('city-cinema');

  await page.evaluate(()=>{window.__qinghe.profile.inventory['city-film-ticket']=1;});
  await useTarget(page,'door:city-cinema-hall');
  await expect.poll(()=>place(page)).toBe('city-cinema-hall');
  expect(await page.evaluate(()=>window.__qinghe.profile.inventory['city-film-ticket'])).toBeUndefined();

  // The sun on the screen stays put while you stand, and moves once you sit down.
  const sun=()=>page.evaluate(()=>{const r=window.__qinghe.town.rooms.get('city-cinema-hall');
    const screen=r.fittings.find(f=>f.kind==='cinemascreen').entity;return screen.children.find(c=>c.render&&c.render.type==='cylinder').getLocalPosition().x;});
  const still=await sun();await page.waitForTimeout(500);
  expect(await sun()).toBe(still);
  const seat=await page.evaluate(()=>window.__qinghe.town.rooms.get('city-cinema-hall').fittings.findIndex(f=>f.seat!==undefined));
  await page.evaluate(i=>window.__qinghe.town.onInteract('sit:'+i),seat);
  await page.waitForTimeout(600);
  expect(await sun()).not.toBe(still);
  if(SHOTS)await page.screenshot({path:`${SHOTS}/city-cinema-hall.png`,scale:'css'});
  await page.evaluate(()=>window.__qinghe.town.onInteract('stand'));

  // Out of the hall is back into the lobby, by its door.
  await useTarget(page,'door:city-cinema');
  await expect.poll(()=>place(page)).toBe('city-cinema');
  expect(errors).toEqual([]);
});
