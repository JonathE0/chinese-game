import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';

async function hold(page,key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
async function warp(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(160);
}
async function enter(page,room,z,yaw=0){
  await page.evaluate(([r,z,y])=>{
    const town=window.__qinghe.town;town.enterRoom(r);town.warp(town.rooms.get(r).offsetX,z,y);},[room,z,yaw]);
  await page.waitForTimeout(220);
}
const offsetOf=(page,room)=>page.evaluate(r=>window.__qinghe.town.rooms.get(r).offsetX,room);
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY);

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
  await page.waitForTimeout(400);
}

test('the mission card folds away, the list scrolls, and the choice is remembered',async({page})=>{
  await seed(page,{});
  await start(page);
  const card=page.locator('#quest-card');
  await expect(card).not.toHaveClass(/collapsed/);
  // With every mission listed the card has more than it can show, so it has to scroll.
  const list=page.locator('#quest-list');
  expect(await list.evaluate(el=>getComputedStyle(el).overflowY)).toBe('auto');
  expect(await list.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  await list.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  expect(await list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);

  await page.locator('#quest-toggle').click();
  await expect(card).toHaveClass(/collapsed/);
  await expect(page.locator('#quest-body')).toBeHidden();
  await expect(page.locator('#quest-count')).toBeVisible();      // the count survives the fold
  expect((await saved(page)).settings.hud.quests).toBe(false);

  await page.reload();
  await page.getByRole('button',{name:'开始旅行'}).click();
  await expect(page.locator('#quest-card')).toHaveClass(/collapsed/);
});

test('the key hints start in English and the Chinese is one click away',async({page})=>{
  await seed(page,{});
  await start(page);
  const controls=page.locator('#controls');
  await expect(controls).toHaveAttribute('data-lang','en');
  await expect(controls.locator('[data-en]').first()).toBeVisible();
  await expect(controls.locator('[data-zh]').first()).toBeHidden();

  await page.locator('#controls-lang').click();
  await expect(controls).toHaveAttribute('data-lang','zh');
  await expect(controls.locator('[data-zh]').first()).toBeVisible();
  await expect(controls.locator('[data-en]').first()).toBeHidden();
  await page.locator('#controls-lang').click();
  await expect(controls).toHaveAttribute('data-lang','both');    // nothing is ever thrown away
  await expect(controls.locator('[data-en]').first()).toBeVisible();
  await expect(controls.locator('[data-zh]').first()).toBeVisible();
  expect((await saved(page)).settings.hud.controls).toBe('both');
});

test('H puts the name in the middle of the screen away and brings it back',async({page})=>{
  await seed(page,{});
  await start(page);
  await page.mouse.click(700,500);
  await warp(page,0,7,0);
  await expect(page.locator('#nameplate')).toContainText('喷泉');

  await page.keyboard.press('h');
  await expect(page.locator('#nameplate')).toBeHidden();
  await expect(page.locator('#labels-button')).toHaveClass(/off/);
  expect((await saved(page)).settings.hud.names).toBe(false);
  // Looking somewhere else does not sneak it back on.
  await warp(page,0,7,180);
  await page.waitForTimeout(300);
  await expect(page.locator('#nameplate')).toBeHidden();

  await page.keyboard.press('h');
  await warp(page,0,7,0);
  await expect(page.locator('#nameplate')).toContainText('喷泉');
});

test('tapping a mission draws a line to it on the map',async({page})=>{
  await seed(page,{});
  await start(page);
  await expect(page.locator('#map-route')).toBeEmpty();
  await page.locator('[data-route="greet"]').click();
  await expect(page.locator('#map-route circle')).toHaveCount(2);
  await expect(page.locator('#map-route line')).toHaveCount(1);
  await expect(page.locator('#map-caption')).toContainText('m');
  await expect(page.locator('[data-route="greet"]')).toHaveClass(/routed/);
  // A mission in another district routes you to that district's gate first.
  await page.locator('[data-route="order"]').click();
  await expect(page.locator('#map-caption')).toContainText('河边文化街');
  await page.locator('[data-route="order"]').click();
  await expect(page.locator('#map-route')).toBeEmpty();
});

test('from your own eyes you see your legs, and a shop floor stays first person',async({page})=>{
  await seed(page,{});
  await start(page);
  const body=()=>page.evaluate(()=>{
    const p=window.__qinghe.town.player;
    return {upper:p.upper.enabled,head:p.head.enabled,legScale:+p.legs[0].getLocalScale().x.toFixed(2)};
  });
  expect(await body()).toEqual({upper:false,head:false,legScale:.84});
  await page.keyboard.press('v');
  expect(await body()).toEqual({upper:true,head:true,legScale:1});
  await page.keyboard.press('v');

  await enter(page,'cafe',2.0);
  await page.keyboard.press('v');
  expect(await page.evaluate(()=>window.__qinghe.town.view)).toBe('first');
  await expect(page.locator('#toast')).toContainText('第三人称');
  // Home is your own room, so you can still stand back and look at what you are wearing.
  await enter(page,'home',3.0);
  await page.keyboard.press('v');
  expect(await page.evaluate(()=>window.__qinghe.town.view)).toBe('third');
});

test('you can sit down at a restaurant table and stand up again',async({page})=>{
  await seed(page,{});
  await start(page);
  await page.evaluate(()=>window.__qinghe.town.setUnlocked('riverside',true));
  await enter(page,'restaurant',2.6);
  await warp(page,(await offsetOf(page,'restaurant'))-4.75,1.5,0);
  await expect(page.locator('#interact span')).toHaveText('坐下');
  await page.keyboard.press('e');

  await expect(page.locator('#seated')).toBeVisible();
  const seated=await page.evaluate(()=>{
    const town=window.__qinghe.town,pos=town.camera.getPosition();
    return {index:town.seated?.index,eye:+pos.y.toFixed(2)};
  });
  expect(seated.index).toBeGreaterThanOrEqual(0);
  expect(seated.eye).toBeLessThan(1.6);                 // sitting really is lower than standing
  await expect(page.locator('#interact span')).toHaveText('站起来');

  await page.keyboard.press('Space');
  await expect(page.locator('#seated')).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.town.seated)).toBe(null);
  expect((await saved(page)).daily.counts.sits).toBe(1);
});

test('the poster by the door explains furnishing, and the bed sets the time of day',async({page})=>{
  await seed(page,{completed:['home:tutorial']});      // starter furniture, so there is a bed
  await start(page);
  await enter(page,'home',3.0);
  const home=await offsetOf(page,'home');

  await warp(page,home+3.3,-1.2,-90);
  await expect(page.locator('#interact span')).toHaveText('看看布置指南');
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('布置指南');
  await expect(page.locator('.guide-section')).toHaveCount(4);
  await page.locator('.guide-section summary').first().click();
  await expect(page.locator('.guide-section').first()).toHaveAttribute('open','');
  await page.locator('.close-button').click();

  // The starter bed is upstairs.
  await page.evaluate(x=>window.__qinghe.town.warp(x,.5,-90,2.9),home+3.0);
  await page.waitForTimeout(200);
  await expect(page.locator('#interact span')).toHaveText('睡觉 · 选时间');
  await page.keyboard.press('e');
  await expect(page.locator('[data-sleep]')).toHaveCount(4);
  await page.locator('[data-sleep="night"]').click();
  await expect(page.locator('#place-time')).toContainText('22:');
  await expect(page.locator('body.after-dark')).toHaveCount(1);
  // Sleeping fills you back up rather than charging you for the hours skipped.
  expect((await saved(page)).stats.energy).toBe(100);
});

test('a shop that has not opened says so, and opens on the milestone',async({page})=>{
  await seed(page,{});
  await start(page);
  await warp(page,15.5,0.2,180);
  await expect(page.locator('#interact span')).toHaveText('看看告示 · 暂停营业');
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('旧物铺');
  await expect(page.locator('.gate-note')).toContainText('买过东西');
  await page.locator('.close-button').click();

  await page.evaluate(()=>{
    window.__qinghe.profile.completed.push('purchase:first');window.__qinghe.save();
  });
  await warp(page,15.5,0.2,180);
  await expect(page.locator('#interact span')).toHaveText('进旧物铺');
});

test('the second-hand shop makes an offer and the bank lends against tomorrow',async({page})=>{
  await seed(page,{wallet:0,inventory:{'travel-hat':1,postcard:2},
    completed:['home:tutorial','home:starter','purchase:first','practice:first']});
  await start(page);

  await enter(page,'resale',1.8);
  await warp(page,await offsetOf(page,'resale'),1.0,0);
  await expect(page.locator('#interact span')).toHaveText('卖旧东西 · 老周收货');
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('旧物铺');
  await expect(page.locator('[data-sell]')).toHaveCount(2);
  await page.locator('[data-sell="travel-hat"]').click();
  await page.getByRole('button',{name:'卖了'}).click();
  const afterSale=await saved(page);
  expect(afterSale.inventory['travel-hat']).toBe(undefined);
  expect(afterSale.wallet).toBeGreaterThan(0);
  expect(afterSale.wallet).toBeLessThanOrEqual(24);      // never more than it cost new
  await page.locator('.close-button').click();

  await enter(page,'bank',2.6);
  await warp(page,await offsetOf(page,'bank'),0.5,0);
  await expect(page.locator('#interact span')).toHaveText('柜台 · 存钱与借钱');
  await page.keyboard.press('e');
  // The counter opens on savings now; borrowing is its own tab.
  await page.locator('[data-tab="loan"]').click();
  await expect(page.locator('[data-loan]')).toHaveCount(3);
  await page.locator('[data-loan="small"]').click();
  await page.getByRole('button',{name:'确认借款'}).click();
  const borrowed=await saved(page);
  expect(borrowed.wallet).toBe(afterSale.wallet+60);
  expect(borrowed.debt.owed).toBe(67);
  expect(borrowed.debt.perDay).toBe(17);
  await expect(page.getByRole('button',{name:/一次还清/})).toBeVisible();
});

test('a hedge is a wall you cannot hop, and a waiter walks forwards',async({page})=>{
  await seed(page,{});
  await start(page);
  const at=async axis=>Number(await page.locator('#map-player').getAttribute(axis));
  // Beside the shopping-street gate, where the boundary is hedge rather than door.
  await warp(page,17,7,-90);
  await page.keyboard.down('w');
  for(let i=0;i<5;i++){await page.keyboard.press('Space');await page.waitForTimeout(420);}
  await page.keyboard.up('w');
  expect(await at('cx')).toBeLessThan(19.6);
  await expect(page.locator('.location b')).toHaveText('青禾广场');

  await page.evaluate(()=>window.__qinghe.town.setUnlocked('riverside',true));
  await enter(page,'restaurant',3.0);
  const headings=await page.evaluate(async()=>{
    const staff=window.__qinghe.town.rooms.get('restaurant').staff;
    // The model's face looks down its own +Z, which is the opposite of PlayCanvas's `forward`.
    // Reading euler angles back is not safe: (0,180,0) comes back as (180,0,180).
    const sample=()=>staff.map(s=>({x:s.x,z:s.z,fx:-s.entity.forward.x,fz:-s.entity.forward.z}));
    const readings=[];
    let before=sample();
    for(let step=0;step<10;step++){
      await new Promise(done=>setTimeout(done,260));
      const now=sample();
      for(let i=0;i<now.length;i++){
        const dx=now[i].x-before[i].x,dz=now[i].z-before[i].z,len=Math.hypot(dx,dz);
        if(len<.08)continue;
        readings.push(+(((now[i].fx*dx+now[i].fz*dz)/len).toFixed(2)));
      }
      before=now;
    }
    return readings;
  });
  expect(headings.length).toBeGreaterThan(2);
  // +1 means the model's face points the way it is travelling; -1 was the moonwalk.
  for(const dot of headings)expect(dot).toBeGreaterThan(.9);
});

test('mouse sensitivity is adjustable and sticks',async({page})=>{
  await seed(page,{});
  await start(page);
  expect(await page.evaluate(()=>window.__qinghe.town.sensitivity)).toBeCloseTo(.12,3);
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.locator('#look-sensitivity').fill('0.06');
  await page.locator('#look-sensitivity').dispatchEvent('input');
  expect(await page.evaluate(()=>window.__qinghe.town.sensitivity)).toBeCloseTo(.06,3);
  await page.locator('.close-button').click();
  await page.reload();
  await page.getByRole('button',{name:'开始旅行'}).click();
  expect(await page.evaluate(()=>window.__qinghe.town.sensitivity)).toBeCloseTo(.06,3);
});

test('the errands refresh daily and pay out once, from the journal',async({page})=>{
  await seed(page,{wallet:0});
  await start(page);
  await page.getByRole('button',{name:'旅行手册'}).click();
  await expect(page.locator('.daily-row')).toHaveCount(3);
  await expect(page.locator('[data-claim]')).toHaveCount(0);
  await page.locator('.close-button').click();

  await page.evaluate(()=>{
    const p=window.__qinghe.profile;
    p.daily={day:p.dayIndex??0,claimed:[],counts:{reviews:99,discovered:99,'bought-food':99,meals:99,visits:99,talks:99,sits:99,furnished:99,cooked:99,ordered:99,'hunt-found':99}};
    window.__qinghe.save();
  });
  await page.getByRole('button',{name:'旅行手册'}).click();
  await expect(page.locator('[data-claim]')).toHaveCount(3);
  const reward=Number((await page.locator('[data-claim]').first().textContent()).match(/[0-9]+/)[0]);
  await page.locator('[data-claim]').first().click();
  await expect(page.locator('#wallet-count')).toHaveText(String(reward));
  await expect(page.locator('[data-claim]')).toHaveCount(2);     // that one cannot pay twice
  expect((await saved(page)).completed).toContain('daily:first');
});

test('the home shop on the square sells furniture before any district opens',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60});
  await start(page);
  await warp(page,-17.5,-1.2,180);
  await expect(page.locator('#interact span')).toHaveText('进家居小铺');
  await page.keyboard.press('e');
  await expect(page.locator('.location b')).toHaveText('家居小铺');

  await warp(page,await offsetOf(page,'homeware'),-0.6,0);
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('家居小铺');
  await expect(page.locator('[data-shop-item="wooden-bed"]')).toBeVisible();
  await expect(page.locator('[data-shop-item="cloth-shoes"]')).toBeVisible();
  await expect(page.locator('[data-shop-item="travel-hat"]')).toHaveCount(0);   // that is Chen's stall

  await page.locator('[data-shop-item="cloth-shoes"]').click();
  await page.getByRole('button',{name:/马上结账/}).click();
  await page.getByRole('button',{name:'确认购买',exact:true}).click();
  await page.getByRole('button',{name:'现在穿上'}).click();
  const after=await saved(page);
  expect(after.wallet).toBe(44);
  expect(after.equipped.shoes).toBe('cloth-shoes');
  expect(after.completed).toContain('homeware:first');
  expect(errors).toEqual([]);
});
