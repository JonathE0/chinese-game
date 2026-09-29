import {test,expect} from '@playwright/test';

/**
 * 山城老火锅 on terrace T (docs/superpowers/plans/2026-09-26-development-wave-2.md, J-hotpot).
 * The tests warp straight onto the deck rather than climbing K-hill's stairway.
 */
const SAVE_KEY='little-mandarin-town.v1',OX=-4000,Y=14;
const SHOTS=process.env.HOTPOT_SHOTS;   // a folder to save screenshots in, when set

async function seed(page,wallet=200,extra={}){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:20,dayIndex:0,vendors:{},stats:{hunger:40,energy:80,hour:20},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...extra,
  })]);
}
async function onTerrace(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(([OX,Y])=>{
    const t=window.__qinghe.town;
    t.enterCity();window.__qinghe.syncPlace?.();
    t.warp(OX-72,-39.8,0,Y);
  },[OX,Y]);
}
/** The south stool of the middle front table, facing the bay. */
async function sitDown(page){
  const seat=await page.evaluate(()=>window.__qinghe.town.rooms.get('city').fittings.findIndex(f=>f.hotpot===1&&f.seat&&f.rot===180));
  expect(seat).toBeGreaterThan(-1);
  await page.evaluate(i=>window.__qinghe.town.onInteract('sit:'+i),seat);
  return seat;
}
const wallet=page=>page.evaluate(()=>window.__qinghe.profile.wallet);
const draws=page=>page.evaluate(()=>new Promise(done=>{
  const app=window.__qinghe.town.app;
  requestAnimationFrame(()=>requestAnimationFrame(()=>done(app.stats.drawCalls.total)));
}));

test('sit down, order a broth and three dishes with 扯面, a second round on the way, two noodle shows, pay',async({page})=>{
  test.setTimeout(150_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page);
  await onTerrace(page);
  const seat=await sitDown(page);
  expect(await page.evaluate(()=>window.__qinghe.town.seated?.index)).toBe(seat);
  expect(await page.evaluate(()=>window.__qinghe.town.playerY)).toBeGreaterThan(13);

  // The waiter walks over and greets you.
  const panel=page.locator('#panel');
  await expect(panel).toContainText('欢迎光临！几位？',{timeout:20_000});
  await panel.getByRole('button',{name:'一位。'}).click();
  await expect(panel).toContainText('要什么锅底？');
  await panel.locator('[data-broth="hotpot-broth-beef-tallow"]').click();
  await expect(panel).toContainText('要什么辣度？');
  await panel.getByRole('button',{name:'微辣'}).click();

  // Three dishes from three tabs, and the running total. The keyboard stays on the + it pressed.
  await panel.locator('[data-more="hotpot-feiniu"]').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>document.activeElement?.dataset.more)).toBe('hotpot-feiniu');
  await panel.locator('[data-tab="veg"]').click();
  await panel.locator('[data-more="hotpot-tudoupian"]').click();
  await panel.locator('[data-tab="staple"]').click();
  await panel.locator('[data-more="hotpot-chemian"]').click();
  await expect(panel.locator('.hotpot-bill')).toContainText('一份扯面');
  await expect(panel.locator('.hotpot-total').first()).toContainText('59');
  await panel.locator('#hotpot-order').click();
  await expect(panel).toBeHidden();
  expect(await wallet(page)).toBe(200);

  // While the waiter is still fetching it, a second round with another 扯面: it comes with the first.
  await page.evaluate(()=>window.__qinghe.town.onInteract('hotpot:table:1'));
  await expect(panel).toContainText('还要别的吗？');
  expect(await panel.locator('[data-tab="broth"]').count()).toBe(0);     // the broth is on the bill now
  await panel.locator('[data-tab="staple"]').click();
  await panel.locator('[data-more="hotpot-chemian"]').click();
  await panel.locator('[data-more="hotpot-mifan"]').click();
  await panel.locator('#hotpot-order').click();
  await expect(panel).toBeHidden();

  // The food arrives, and the noodle chef performs twice over, one show straight after the other.
  await page.waitForFunction(()=>window.__qinghe.town.hotpot.showing,null,{timeout:60_000});
  const started=Date.now();
  expect(await page.evaluate(()=>window.__qinghe.town.registry.looks.some(l=>l.name?.id==='noodle-show'))).toBe(true);
  expect(await page.evaluate(()=>window.__qinghe.profile.stats.hunger)).toBeGreaterThan(40);
  if(SHOTS){await page.waitForTimeout(1800);await page.evaluate(()=>window.__qinghe.town.setView('third'));await page.waitForTimeout(100);await page.screenshot({path:`${SHOTS}/hotpot-show.png`,scale:'css'});await page.evaluate(()=>window.__qinghe.town.setView('first'));}
  await page.waitForFunction(()=>!window.__qinghe.town.hotpot.showing,null,{timeout:30_000});
  expect(Date.now()-started).toBeGreaterThan(9000);

  // Back to the menu (the waiter asks if there is anything else), then the bill.
  await page.evaluate(()=>window.__qinghe.town.onInteract('hotpot:table:1'));
  await expect(panel).toContainText('还要别的吗？');
  await panel.locator('#hotpot-pay').click();
  await panel.getByRole('button',{name:'服务员，买单！'}).click();
  await expect(panel).toContainText('这是您的账单');
  await panel.locator('#hotpot-settle').click();
  await expect(panel).toContainText('慢走，欢迎下次再来！');
  expect(await wallet(page)).toBe(131);                                 // 28+18+5+8 and 8+2
  expect(await page.evaluate(()=>window.__qinghe.profile.hotpot)).toBeUndefined();

  // Standing up puts you back on the deck, not at the foot of the hill.
  await page.evaluate(()=>{window.__qinghe.ui.close();window.__qinghe.town.onInteract('stand');});
  expect(await page.evaluate(()=>window.__qinghe.town.playerY)).toBeGreaterThan(13.5);
  expect(errors).toEqual([]);
});

test('walking off with the bill pays it, and so does loading a save that still has one',async({page})=>{
  test.setTimeout(90_000);
  // A save left with 肥牛 on the bill: paid the moment the game starts, leaving 25.
  await seed(page,43,{hotpot:{'hotpot-feiniu':1}});
  await onTerrace(page);
  expect(await wallet(page)).toBe(25);
  expect(await page.evaluate(()=>window.__qinghe.profile.hotpot)).toBeUndefined();
  // 25 coins: the clear broth (20) is offered, the beef-tallow one (28) is not.
  await sitDown(page);
  const panel=page.locator('#panel');
  await expect(panel).toContainText('欢迎光临！几位？',{timeout:20_000});
  await panel.getByRole('button',{name:'一位。'}).click();
  await expect(panel.locator('[data-broth="hotpot-broth-beef-tallow"]')).toBeDisabled();
  await panel.locator('[data-broth="hotpot-broth-clear"]').click();
  await panel.getByRole('button',{name:'不辣'}).click();
  // The broth can still be changed from its tab until the first round goes in.
  await panel.locator('[data-tab="broth"]').click();
  await expect(panel.locator('[data-more="hotpot-broth-tomato"]')).toBeEnabled();   // 24
  await expect(panel.locator('[data-more="hotpot-broth-clear"]')).toBeDisabled();   // already chosen
  await panel.locator('#hotpot-order').click();
  await expect(panel).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.profile.hotpot)).toEqual({'hotpot-broth-clear':1});
  // Stand up and leave the terrace: the waiter's bill line, and the bill is paid.
  await page.evaluate(([OX])=>{const t=window.__qinghe.town;t.onInteract('stand');t.warp(OX,24.5,0,0);},[OX]);
  await expect.poll(()=>wallet(page)).toBe(5);
  await expect(page.locator('#toast')).toContainText('这是您的账单');
  expect(await page.evaluate(()=>window.__qinghe.profile.hotpot)).toBeUndefined();
});

test('a dish on the table names itself, and the noodle ribbon reads 扯面表演',async({page})=>{
  test.setTimeout(120_000);
  await seed(page);
  await onTerrace(page);
  await sitDown(page);
  const panel=page.locator('#panel');
  await expect(panel).toContainText('欢迎光临！几位？',{timeout:20_000});
  await panel.getByRole('button',{name:'一位。'}).click();
  await panel.locator('[data-broth="hotpot-broth-clear"]').click();
  await panel.getByRole('button',{name:'不辣'}).click();
  await panel.locator('[data-more="hotpot-maodu"]').click();
  await panel.locator('[data-tab="staple"]').click();
  await panel.locator('[data-more="hotpot-chemian"]').click();
  await panel.locator('#hotpot-order').click();
  await expect(panel).toBeHidden();
  // The plate lands; hold the world still and look straight down at it.
  await page.waitForFunction(()=>window.__qinghe.town.registry.looks.some(b=>b.name?.id==='food:hotpot-maodu'),null,{timeout:60_000,polling:'raf'});
  const lookDown=id=>page.evaluate(id=>{
    const t=window.__qinghe.town,box=t.registry.looks.find(b=>b.name?.id===id);
    return box&&t.registry.look('city',{x:box.x,y:box.y1+.6,z:box.z},{x:0,y:-1,z:0})?.box.name?.zh;
  },id);
  await page.evaluate(()=>window.__qinghe.town.setPaused(true));
  expect(await lookDown('food:hotpot-maodu')).toBe('毛肚');
  await page.evaluate(()=>window.__qinghe.town.setPaused(false));
  // Once it has gone into the pot the plate no longer names it.
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.registry.looks.some(b=>b.name?.id==='food:hotpot-maodu')),{timeout:15_000}).toBe(false);
  await page.waitForFunction(()=>window.__qinghe.town.hotpot.showing,null,{timeout:60_000});
  await page.waitForTimeout(1500);
  const show=await page.evaluate(()=>{
    const t=window.__qinghe.town,box=t.registry.looks.find(b=>b.owner==='hotpot-show');
    return box&&t.registry.look('city',{x:box.x,y:box.y1+.6,z:box.z},{x:0,y:-1,z:0})?.box.name?.zh;
  });
  expect(show).toBe('扯面表演');
  await page.waitForFunction(()=>!window.__qinghe.town.hotpot.showing,null,{timeout:30_000});
  expect(await page.evaluate(()=>window.__qinghe.town.registry.looks.some(b=>b.owner==='hotpot-show'))).toBe(false);
});

test('the terrace at night stays inside the draw-call budget',async({page})=>{
  await seed(page);
  await onTerrace(page);
  await page.evaluate(([OX,Y])=>{const t=window.__qinghe.town;t.daylight.setHour(21);t.warp(OX-61.2,-34.6,50,Y);},[OX,Y]);
  await page.waitForTimeout(400);
  const here=await draws(page);
  console.log('draw calls on the terrace, looking over the tables to the bay:',here);
  if(SHOTS)await page.screenshot({path:`${SHOTS}/hotpot-night.png`,scale:'css'});
  expect(here).toBeLessThanOrEqual(900);
});
