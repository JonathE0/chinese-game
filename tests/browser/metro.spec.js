import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';

async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:200,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...profile,
  })]);
}
async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(500);
}
async function warp(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(240);
}
const profileOf=page=>page.evaluate(()=>window.__qinghe.profile);
const cityX=page=>page.evaluate(()=>window.__qinghe.town.rooms.get('city').offsetX);

test('the fare hall sells singles and a pass, and will not let you board without one',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60});
  await start(page);
  await warp(page,-7.5,10.2,180);
  await expect(page.locator('#interact span')).toHaveText('进地铁站 · 去市里');

  await page.keyboard.press('e');
  await expect(page.locator('.fare-state')).toContainText('手上有 0 张单程票');
  await expect(page.locator('#ride')).toBeDisabled();

  // Three singles at six each.
  await page.locator('[data-want="1"]').click();
  await page.locator('[data-want="1"]').click();
  await page.locator('#buy-tickets').click();
  expect((await profileOf(page)).wallet).toBe(42);
  await expect(page.locator('.fare-state')).toContainText('手上有 3 张单程票');
  await expect(page.locator('#ride')).toBeEnabled();

  // A pass replaces the need for them entirely, and cannot be bought twice.
  await page.locator('#buy-pass').click();
  expect((await profileOf(page)).wallet).toBe(2);
  await expect(page.locator('.fare-state')).toContainText('通票还有 7 天');
  await expect(page.locator('#buy-pass')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('the ride is a scene you can skip, and it puts you in a city that is not the town',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60});
  await start(page);
  await warp(page,-7.5,10.2,180);
  await page.keyboard.press('e');
  await page.locator('#buy-tickets').click();
  await page.locator('#ride').click();

  // The announcement names the station you are going to, and the HUD is out of the way.
  await expect(page.locator('#metro-ride')).toBeVisible();
  await expect(page.locator('.announce-zh')).toHaveText('下一站，云海市中心。');
  await expect(page.locator('.mini-map')).toBeHidden();
  await page.locator('.metro-skip').click();
  await expect(page.locator('#metro-ride')).toHaveCount(0);

  expect(await page.evaluate(()=>window.__qinghe.town.place)).toBe('city');
  await expect(page.locator('.location b')).toHaveText('云海市中心');
  // One ticket was punched, and the wallet was only touched at the fare hall.
  const after=await profileOf(page);
  expect(after.metro).toEqual({rides:0,trips:1});
  expect(after.wallet).toBe(54);
  expect(errors).toEqual([]);
});

test('the city has its own street, its own people, and a free way home',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60,metro:{rides:1,trips:0}});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  const x=await cityX(page);

  // Someone on the pavement, with something to say and a note about how to say it.
  await warp(page,x-4.2,13.6,0);
  await expect(page.locator('#interact span')).toHaveText('和上班的人说话');
  await page.keyboard.press('e');
  await expect(page.locator('.panel-citytalk .dialogue-line .zh')).toBeVisible();
  await page.locator('#keep-line').click();
  expect((await profileOf(page)).saved.length).toBe(1);
  await page.keyboard.press('Escape');

  // A shop that only exists out here.
  await warp(page,x-3.6,-10.5,90);          // the kiosk window faces +x at (-5.1, -10.5)
  await expect(page.locator('#interact span')).toHaveText('看看便利店');
  await page.keyboard.press('e');
  await expect(page.locator('.shop-card',{hasText:'三明治'})).toBeVisible();
  await page.keyboard.press('Escape');

  // The way home is free: no ticket is taken and the wallet does not move.
  await warp(page,x,27.4,180);
  await expect(page.locator('#interact span')).toHaveText('坐地铁回青禾 · BACK TO TOWN');
  await page.keyboard.press('e');
  await expect(page.locator('.announce-zh')).toHaveText('下一站，青禾广场。');
  await page.locator('.metro-skip').click();
  await expect(page.locator('#metro-ride')).toHaveCount(0);

  const home=await profileOf(page);
  expect(await page.evaluate(()=>window.__qinghe.town.place)).toBe('town');
  await expect(page.locator('.location b')).toHaveText('青禾广场');
  expect(home.metro.rides).toBe(1);
  expect(home.wallet).toBe(60);
  expect(errors).toEqual([]);
});

test('the city is solid: the towers are walls and the edge of the world holds',async({page})=>{
  await seed(page,{metro:{rides:2,trips:0}});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  const x=await cityX(page);
  const blocked=await page.evaluate(offset=>{
    const t=window.__qinghe.town;
    return {
      intoTower:t.canMove(offset-17.5,0),
      onPavement:t.canMove(offset-9.2,9.5),
      downTheMiddle:t.canMove(offset,0),
      pastTheEnd:t.canMove(offset,-34.5),
      throughTheSide:t.canMove(offset-28.5,0),
      intoTheHall:t.canMove(offset,29),
    };
  },x);
  expect(blocked).toEqual({intoTower:false,onPavement:true,downTheMiddle:true,
    pastTheEnd:false,throughTheSide:false,intoTheHall:true});
});
