import {test,expect} from '@playwright/test';

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
async function enter(page,room,z,yaw=0){
  await page.evaluate(([r,z,y])=>{
    const town=window.__qinghe.town;town.enterRoom(r);town.warp(town.rooms.get(r).offsetX,z,y);},[room,z,yaw]);
  await page.waitForTimeout(240);
}
const profileOf=page=>page.evaluate(()=>window.__qinghe.profile);

test('the kitchen is a room off the house, and walking out of it goes back inside',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  await enter(page,'home',2.8,-90);
  await page.evaluate(()=>window.__qinghe.town.warp(window.__qinghe.town.rooms.get('home').offsetX+3.2,2.8,-90));
  await page.waitForTimeout(240);
  await expect(page.locator('#interact span')).toHaveText('进厨房 · 做饭');

  await page.keyboard.press('e');
  await page.waitForTimeout(320);
  expect(await page.evaluate(()=>window.__qinghe.town.place)).toBe('kitchen');

  // Standing at the stove offers cooking, not the way out.
  await page.evaluate(()=>window.__qinghe.town.warp(window.__qinghe.town.rooms.get('kitchen').offsetX,-1.2,0));
  await page.waitForTimeout(240);
  await expect(page.locator('#interact span')).toHaveText('做饭 · 厨房');

  // The doorway leads back into the living room rather than out onto the street.
  await page.evaluate(()=>window.__qinghe.town.warp(window.__qinghe.town.rooms.get('kitchen').offsetX,3.4,0));
  await page.waitForTimeout(240);
  await page.keyboard.press('e');
  await page.waitForTimeout(320);
  const back=await page.evaluate(()=>{
    const t=window.__qinghe.town,p=t.player.entity.getPosition();
    return {place:t.place,x:+(p.x-t.rooms.get('home').offsetX).toFixed(2),z:+p.z.toFixed(2)};
  });
  expect(back).toEqual({place:'home',x:3.5,z:2.5});
  expect(errors).toEqual([]);
});

test('groceries become one meal that fills you up, and the pot cooks while you are elsewhere',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{inventory:{'rice-grain':1,tomato:1,tofu:1,noodles:1}});
  await start(page);
  await enter(page,'kitchen',-1.2,0);
  await page.keyboard.press('e');

  // Every card says what the groceries cost against buying the same amount of food ready-made.
  const card=page.locator('.recipe-card',{hasText:'番茄豆腐盖饭'});
  await expect(card).toBeVisible();
  await expect(card.locator('.recipe-save')).toContainText('买现成的要');
  // A recipe you are short of says so instead of pretending to be available.
  await expect(page.locator('.recipe-card',{hasText:'青菜豆腐饭'}).locator('.recipe-go')).toBeDisabled();

  await card.getByRole('button',{name:'开火'}).click();
  await expect(page.locator('.pot-card')).toContainText('正在做');
  expect((await profileOf(page)).inventory['tofu']).toBeUndefined();     // reserved, not still in the bag

  // Walk out mid-simmer: the stove keeps going, and the town says when it is ready.
  await page.evaluate(()=>{window.__qinghe.ui.close();window.__qinghe.town.enterRoom('home');});
  await page.evaluate(()=>{window.__qinghe.profile.cooking.remaining=0.2;});
  await expect(page.locator('#toast')).toContainText('做好了');
  expect((await profileOf(page)).cooking.remaining).toBe(0);

  await enter(page,'kitchen',-1.2,0);
  await page.keyboard.press('e');
  await page.getByRole('button',{name:'盛出来'}).click();
  const served=await profileOf(page);
  expect(served.inventory['home-tomato-rice']).toBe(1);
  expect(served.cooking).toBeUndefined();
  expect(served.daily.counts.cooked).toBe(1);

  await page.locator('[data-eat="home-tomato-rice"]').click();
  const fed=await profileOf(page);
  expect(fed.stats.hunger).toBeGreaterThan(99);
  expect(fed.inventory['home-tomato-rice']).toBeUndefined();
  expect(errors).toEqual([]);
});
