import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';

async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:60,inventory:{},equipped:{},claims:{},words:{},
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
  await page.waitForTimeout(180);
}

test('the three daytime stalls are already standing at their spots by mid-morning',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  const spots=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.daylight.setHour(10);
    return t.dayMarket.pitches.map(p=>({id:p.id,state:p.state,x:+p.x.toFixed(1),z:+p.z.toFixed(1)}));
  });
  expect(spots).toEqual([
    {id:'wonton',state:'open',x:-11.5,z:1.2},
    {id:'noodlestall',state:'open',x:-11.5,z:4},
    {id:'breakfast',state:'open',x:-19.2,z:6.9},
  ]);
  expect(errors).toEqual([]);
});

test('day stalls snap to the saved hour on load, not the constructor default',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{clock:10});
  await start(page);
  const open=await page.evaluate(()=>window.__qinghe.town.dayMarket.pitches.map(p=>p.state));
  expect(open).toEqual(['open','open','open']);
  expect(errors).toEqual([]);
});

test('a save from the night leaves the day stalls away, no walk-out in view on load',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{clock:20});
  await start(page);
  const away=await page.evaluate(()=>window.__qinghe.town.dayMarket.pitches.map(p=>p.state));
  expect(away).toEqual(['away','away','away']);
  expect(errors).toEqual([]);
});

test('the day stalls walk themselves in around six in the morning',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{clock:20});
  await start(page);
  const states=await page.evaluate(()=>{
    const t=window.__qinghe.town;
    for(let i=0;i<60;i++)t.dayMarket.update(1/60,{hour:5.983,place:'town',offCamera:()=>true});   // 05:59, still shut
    const beforeSix=t.dayMarket.pitches.map(p=>p.state);
    for(let i=0;i<600;i++)t.dayMarket.update(1/60,{hour:6.5,place:'town',offCamera:()=>true});    // 06:30, trading
    return {beforeSix,afterSix:t.dayMarket.pitches.map(p=>p.state)};
  });
  expect(states.beforeSix).toEqual(['away','away','away']);
  expect(states.afterSix).toEqual(['open','open','open']);
  expect(errors).toEqual([]);
});

test('the wonton stall greets you and sells a bowl of wontons from the bag',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  await page.evaluate(()=>window.__qinghe.town.daylight.setHour(10));
  await warp(page,-11.5,0.5,0);
  await expect(page.locator('#interact span')).toHaveText('看看馄饨摊');
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('馄饨摊');
  await expect(page.locator('.shop-greeting .zh')).toHaveText('刚包好的馄饨，来一碗吗？');
  await expect(page.locator('[data-shop-item="wonton"]')).toBeVisible();
  await expect(page.locator('[data-shop-item="xiaolongbao"]')).toBeVisible();

  await page.locator('[data-shop-item="wonton"]').click();
  const walletBefore=await page.evaluate(()=>window.__qinghe.profile.wallet);
  await page.locator('#buy-quote').click();
  await page.locator('#confirm-purchase').click();
  const after=await page.evaluate(()=>window.__qinghe.profile);
  expect(after.wallet).toBe(walletBefore-8);
  expect(after.inventory.wonton).toBe(1);
  expect(errors).toEqual([]);
});

test('after dark the day stalls pack up and the night market trades in their place',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  const states=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.daylight.setHour(20);
    for(let i=0;i<2000;i++){
      t.market.update(1/60,{hour:20,place:'town',offCamera:()=>true});
      t.dayMarket.update(1/60,{hour:20,place:'town',offCamera:()=>true});
    }
    t.market.syncHitboxes(t.registry,id=>({id}));
    t.dayMarket.syncHitboxes(t.registry,id=>({id}));
    return {day:t.dayMarket.pitches.map(p=>p.state),night:t.market.pitches.map(p=>p.state)};
  });
  expect(states.day).toEqual(['away','away','away']);
  expect(states.night).toEqual(['open','open']);
  expect(errors).toEqual([]);
});
