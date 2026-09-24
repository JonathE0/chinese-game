import {test,expect} from '@playwright/test';

// The word hall is a hub: a hall with the HSK lectern, and four rooms off it that each lead back.
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
async function stand(page,room,x,z,yaw=0){
  await page.evaluate(([r,x,z,y])=>{
    const town=window.__qinghe.town;if(town.place!==r)town.enterRoom(r);town.warp(town.rooms.get(r).offsetX+x,z,y);},[room,x,z,yaw]);
  await page.waitForTimeout(260);
}
const place=page=>page.evaluate(()=>window.__qinghe.town.place);
const wallet=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)).wallet,SAVE_KEY);
async function pickRight(page){
  const id=await page.locator('.drill-prompt').getAttribute('data-word');
  await page.locator(`[data-pick="${id}"]`).click();
  await expect(page.locator('#drill-feedback .feedback')).toBeVisible();
}

test('every room off the hall is reachable from it and leads back to it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  const doors=[
    ['reading','进阅览室 · 看书',-6.8,0,90],
    ['studyroom','进自习室 · 复习',6.8,0,-90],
    ['listening','进听力室 · 练听力',-4,-4.6,0],
    ['courtyard','去庭院 · 坐一坐',4,-4.6,0],
  ];
  for(const [room,label,x,z,yaw] of doors){
    await stand(page,'hall',x,z,yaw);
    await expect(page.locator('#interact span')).toHaveText(label);
    await page.keyboard.press('e');
    await page.waitForTimeout(320);
    expect(await place(page)).toBe(room);
    const exit=await page.evaluate(r=>window.__qinghe.town.rooms.get(r).data.exit,room);
    await stand(page,room,exit[0],exit[1]-.3,180);
    await expect(page.locator('#interact span')).toHaveText('回大厅');
    await page.keyboard.press('e');
    await page.waitForTimeout(320);
    expect(await place(page)).toBe('hall');
  }
  await expect(page.locator('.location b')).toHaveText('词语馆');
  expect(errors).toEqual([]);
});

test('the lectern opens HSK and a reading-room shelf opens the library',async({page})=>{
  await seed(page,{});
  await start(page);
  await stand(page,'hall',0,-1.4,0);
  await expect(page.locator('#interact span')).toHaveText('查词 · HSK');
  await page.keyboard.press('e');
  await expect(page.locator('.syllabus-note')).toBeVisible({timeout:20000});
  await page.locator('#panel .close-button').click();

  await stand(page,'reading',-4.5,-1.5,90);
  await expect(page.locator('#interact span')).toHaveText('入门架 · 看看书');
  await page.keyboard.press('e');
  await expect(page.locator('#panel.panel-library')).toBeVisible();
});

test('a study carrel opens the word bank and pays the desk rate',async({page})=>{
  const saved=[['bread','面包','miànbāo','bread'],['milk','牛奶','niúnǎi','milk'],['tea','茶','chá','tea'],['water','水','shuǐ','water']]
    .map(([id,zh,pinyin,en])=>({id,zh,pinyin,en}));
  await seed(page,{saved});
  await start(page);
  await stand(page,'studyroom',-3.6,-2.6,90);
  await expect(page.locator('#interact span')).toHaveText('复习生词 · 书桌');
  await page.keyboard.press('e');
  await expect(page.locator('#panel.panel-wordbank')).toBeVisible();
  await page.locator('#bank-review').click();
  await pickRight(page);
  expect(await wallet(page)).toBe(204);
});

test('a listening booth opens listening practice at the hall rate',async({page})=>{
  await seed(page,{});
  await start(page);
  await stand(page,'listening',-3.3,-1.6,0);
  await expect(page.locator('#interact span')).toHaveText('戴上耳机 · 听力练习');
  await page.keyboard.press('e');
  await expect(page.locator('.drill-mode')).toHaveText('听力 · LISTENING',{timeout:20000});
  await pickRight(page);
  expect(await wallet(page)).toBe(205);
});

test('the courtyard is open to the sky and its bench seats you',async({page})=>{
  await seed(page,{});
  await start(page);
  await stand(page,'courtyard',-2,1.8,0);
  expect(await page.evaluate(()=>!!window.__qinghe.town.rooms.get('courtyard').root.findByName('room-ceiling'))).toBe(false);
  // Looking straight up names nothing: no invisible lid over the courtyard.
  expect(await page.evaluate(()=>{const t=window.__qinghe.town;
    return t.registry.look('courtyard',{x:t.rooms.get('courtyard').offsetX-2,y:1.6,z:1.8},{x:0,y:1,z:0});})).toBeNull();
  // Its daylight follows the clock.
  const sun=hour=>page.evaluate(h=>{const t=window.__qinghe.town;t.daylight.paused=true;t.daylight.setHour(h);t.lightRoom();
    return t.rooms.get('courtyard').sun.light.intensity;},hour);
  const noon=await sun(13),night=await sun(23);
  expect(noon).toBeGreaterThan(.5);
  expect(night).toBeLessThan(noon/4);
  await expect(page.locator('#interact span')).toHaveText('坐下');
  await page.keyboard.press('e');
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>!!window.__qinghe.town.seated)).toBe(true);
});
