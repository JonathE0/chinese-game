import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';

async function warp(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(180);
}
async function enter(page,room,z,yaw=0){
  await page.evaluate(([r,z,y])=>{
    const town=window.__qinghe.town;town.enterRoom(r);town.warp(town.rooms.get(r).offsetX,z,y);},[room,z,yaw]);
  await page.waitForTimeout(240);
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
  await page.waitForTimeout(500);
}

test('fruit can be lifted out of a stall, thrown, and the gap quietly restocks',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  // The stall stands at (-6.4, 0) and 周叔叔 keeps it from its east end (-5, 1.2): come at it from the west.
  await warp(page,-7.4,1.6,0);
  await expect(page.locator('#interact span')).toHaveText('拿一个水果');

  await page.keyboard.press('e');
  await expect(page.locator('#carrying')).toBeVisible();
  const held=await page.evaluate(()=>{
    const t=window.__qinghe.town,c=t.containers.find(c=>c.place==='town'&&c.slots.some(s=>!s.filled));
    return {carrying:!!t.toys.held,bodies:t.toys.count,emptySlots:c.slots.filter(s=>!s.filled).length};
  });
  expect(held).toEqual({carrying:true,bodies:1,emptySlots:1});

  // Nothing you lift out of a display is inventory: it cannot be eaten, worn or sold.
  // (Grandpa's camera is every traveller's from the start: roots.json `camera`.)
  expect(Object.keys((await saved(page)).inventory)).toEqual(['grandpa-camera']);

  const flight=await page.evaluate(async()=>{
    const t=window.__qinghe.town;
    t.pitch=4;t.throwHeld();
    const body=t.toys.bodies[0],from={x:body.x,z:body.z};
    for(let i=0;i<220;i++)t.toys.update(1/60,'town');
    return {moved:+Math.hypot(body.x-from.x,body.z-from.z).toFixed(2),resting:body.rest>0,held:!!t.toys.held};
  });
  expect(flight.held).toBe(false);
  expect(flight.moved).toBeGreaterThan(1.5);
  expect(flight.resting).toBe(true);

  // The stall puts one back once its timer is up, and leaving tidies the street.
  const after=await page.evaluate(()=>{
    const t=window.__qinghe.town,c=t.containers.find(c=>c.place==='town'&&c.slots.some(s=>!s.filled));
    c.tick(t.clock+40);
    const restocked=c.slots.every(s=>s.filled);
    t.enterRoom('home');
    return {restocked,loose:t.toys.in('town').length};
  });
  expect(after).toEqual({restocked:true,loose:0});
  expect(errors).toEqual([]);
});

test('the bakery sells a basket of things in one transaction',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:40});
  await start(page);
  await page.evaluate(()=>window.__qinghe.town.setUnlocked('market',true));
  await enter(page,'bakery',2.6);
  await warp(page,await offsetOf(page,'bakery'),-1.1,0);        // in front of the glass counter
  await page.evaluate(()=>{window.__qinghe.town.pitch=-30;});   // looking at the counter, not the assistant behind it
  await expect(page.locator('#interact span')).toHaveText('看看今天的面包');
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('麦香面包');
  await expect(page.locator('[data-shop-item="strawberry-donut"]')).toBeVisible();
  await expect(page.locator('[data-shop-item="egg-tart"]')).toBeVisible();
  await expect(page.locator('[data-shop-item="red-bean-bun"]')).toBeVisible();

  await page.locator('[data-add="egg-tart"]').click();
  await page.locator('[data-add="egg-tart"]').click();
  await page.locator('[data-add="red-bean-bun"]').click();
  await expect(page.locator('.cart-count')).toHaveText('3');
  await page.locator('#cart-open').click();

  await expect(page.locator('.cart-table tbody tr')).toHaveCount(2);
  await page.locator('[data-more="red-bean-bun"]').click();
  await expect(page.getByRole('button',{name:/一起结账/})).toContainText('22');
  await page.locator('[data-less="egg-tart"]').click();
  await page.getByRole('button',{name:/一起结账/}).click();

  await expect(page.locator('.completion h3')).toHaveText('谢谢，欢迎再来！');
  const after=await saved(page);
  expect(after.inventory['egg-tart']).toBe(1);
  expect(after.inventory['red-bean-bun']).toBe(2);
  expect(after.wallet).toBe(40-6-10);
  expect(errors).toEqual([]);
});

test('night stalls stay away by day and are pushed into place after dark',async({page})=>{
  await seed(page,{});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.daylight.paused=true;});

  // Midday: nothing is raised however long the town runs.
  const byDay=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.daylight.setHour(12);
    for(let i=0;i<120;i++)t.market.update(1/60,{hour:12,place:'town',offCamera:()=>true});
    return t.market.pitches.map(p=>p.state);
  });
  expect(byDay).toEqual(['away','away']);

  // The spot is only built while nobody can see it; the walk in is meant to be watched.
  const inView=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.daylight.setHour(19);
    for(let i=0;i<30;i++)t.market.update(1/60,{hour:19,place:'town',offCamera:()=>false});
    return t.market.pitches.map(p=>p.state);
  });
  expect(inView).toEqual(['away','away']);

  const arrival=await page.evaluate(()=>{
    const t=window.__qinghe.town;
    const seen=[];
    for(let i=0;i<1600;i++){
      t.market.update(1/60,{hour:19,place:'town',offCamera:()=>true});
      if(i===20)seen.push(t.market.pitches[0].state);
    }
    t.market.syncHitboxes(t.registry,id=>({id}));
    return {early:seen[0],now:t.market.pitches.map(p=>p.state),
      parked:t.market.pitches.map(p=>[+p.x.toFixed(1),+p.z.toFixed(1)]),
      boxes:t.market.pitches.filter(p=>p.box).length};
  });
  expect(arrival.early).toBe('arriving');
  expect(arrival.now).toEqual(['open','open']);
  expect(arrival.parked).toEqual([[-5.6,5.4],[5.8,5.4]]);
  expect(arrival.boxes).toBe(2);

  await warp(page,-4.2,6.8,45);
  await expect(page.locator('#interact span')).toHaveText('看看糖葫芦摊');
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('夜市小摊');
  await expect(page.locator('[data-shop-item="candied-hawthorn"]')).toBeVisible();
});

test('a tea set goes on the table, never on the bed, and the two become one piece',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // A new player's starter bed is upstairs now, so this living room keeps a bed from an older save.
  const bed={uid:'bed-old',item:'wooden-bed',kind:'bed',color:'#b98b5f',footprint:[2.1,1.4],x:2.9,z:-3.75,rot:0,slot:'bed'}   // at its slot by the wall;
  await seed(page,{inventory:{'low-table':1,'tea-set':1,'wooden-bed':1},home:[bed],completed:['home:tutorial','home:starter']});
  await start(page);
  await enter(page,'home',3.0);
  const home=await offsetOf(page,'home');

  const place=async(item)=>{
    await page.evaluate(i=>window.__qinghe.town.beginPlacement(i),item);
    await page.waitForTimeout(120);
  };
  const table={id:'low-table',zh:'矮桌',kind:'table',color:'#c2a883',footprint:[1.5,1.0]};
  const teaset={id:'tea-set',zh:'茶具',kind:'teaset',color:'#9db08f',footprint:[0.65,0.45]};

  await warp(page,home,2.0,0);
  await place(table);
  await page.evaluate(()=>window.__qinghe.town.tryPlace());
  await page.waitForTimeout(200);
  // The table joins the bed already in the room.
  const afterTable=await saved(page);
  const tableRecord=afterTable.home.at(-1);
  expect(tableRecord.item).toBe('low-table');
  expect(tableRecord.on).toBe(undefined);

  // Over the bed the tea set is refused, and it says why.
  await place(teaset);
  await warp(page,home+2.9,-1.75,0);   // two metres short of the bed, facing it
  const onBed=await page.evaluate(()=>{
    const g=window.__qinghe.town.ghost;return {valid:g.valid,problem:g.problem?.zh??null,on:g.on};
  });
  expect(onBed.valid).toBe(false);
  expect(onBed.problem).toBe('不能放在床上');

  // Over the table it snaps to the top and records what it is standing on.
  await warp(page,home,2.0,0);
  const onTable=await page.evaluate(()=>{
    const g=window.__qinghe.town.ghost;return {valid:g.valid,on:!!g.on,y:+g.entity.getLocalPosition().y.toFixed(2)};
  });
  expect(onTable).toEqual({valid:true,on:true,y:.47});
  await page.evaluate(()=>window.__qinghe.town.tryPlace());
  await page.waitForTimeout(200);

  const composed=await saved(page);
  expect(composed.home.at(-1).item).toBe('tea-set');
  expect(composed.home.at(-1).on).toBe(tableRecord.uid);

  // The furnishing panel calls the pair one thing, and putting the base away takes both.
  await warp(page,home-1.6,-1.6,180);
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('布置房间');
  await expect(page.locator('.placed-row.assembly')).toHaveCount(1);
  await expect(page.locator('.assembly-tag')).toContainText('自定义家具');
  await expect(page.locator('.assembly-part')).toHaveCount(1);
  const before=(await saved(page)).home.length;
  await page.locator('.placed-row.assembly > [data-remove]').click();
  // Table and tea set leave together: one assembly, one removal.
  await expect.poll(async()=>(await saved(page)).home.length,{timeout:5000}).toBe(before-2);
  expect(errors).toEqual([]);
});

test('the library shelves books by what you can read, and hands over what you are missing',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  await page.evaluate(()=>window.__qinghe.town.setUnlocked('market',true));
  await enter(page,'library',3.4);
  await warp(page,await offsetOf(page,'library'),-1.7,0);       // in front of the lending desk
  await page.evaluate(()=>{window.__qinghe.town.pitch=-30;});   // looking at the counter, not the assistant behind it
  await expect(page.locator('#interact span')).toHaveText('借书 · 所有书架');
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('青禾书馆');

  // Nothing learned yet, so every book is out of reach — and says so rather than hiding.
  await expect(page.locator('.book')).toHaveCount(6);
  await expect(page.locator('.book.locked')).toHaveCount(6);
  await page.locator('[data-book="morning"]').click();
  await expect(page.locator('.gate-note b')).toContainText('还差');
  await expect(page.locator('.missing-word')).toHaveCount(6);

  await page.locator('#take-words').click();
  await expect(page.locator('.book')).toHaveCount(6);
  expect((await saved(page)).saved.length).toBe(6);
  // Six of ten key words is enough to attempt it, so the book opens now.
  await expect(page.locator('.book.stretch')).toHaveCount(1);
  await page.locator('[data-book="morning"]').click();
  await expect(page.locator('.book-line .zh')).toHaveText('天亮了。');

  for(let page_=0;page_<5;page_++)await page.getByRole('button',{name:/下一页/}).click();
  await page.getByRole('button',{name:/读完了/}).click();
  await expect(page.locator('.completion h3')).toContainText('早上');
  expect((await saved(page)).read).toEqual(['morning']);
  expect(errors).toEqual([]);
});

test('the bank takes deposits, pays capped interest and sells a permit on instalments',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:400,completed:['home:tutorial','home:starter','practice:first']});
  await start(page);
  await enter(page,'bank',2.6);
  await warp(page,await offsetOf(page,'bank')-2.8,0,90);         // at the teller windows on the west wall
  await page.evaluate(()=>{window.__qinghe.town.pitch=-30;});   // looking at the counter, not the assistant behind it
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('青禾银行');

  await page.locator('#deposit-amount').fill('300');
  await page.locator('#do-deposit').click();
  await expect(page.locator('.bank-balance b').nth(1)).toHaveText('300');
  expect((await saved(page)).savings.balance).toBe(300);
  await expect(page.locator('.interest-card b')).toHaveText('+6');   // 2% of 300

  await page.locator('#withdraw-amount').fill('100');
  await page.locator('#do-withdraw').click();
  await expect(page.locator('.interest-card b')).toHaveText('+4');

  await page.locator('[data-tab="permit"]').click();
  await expect(page.locator('.permit-card')).toHaveCount(2);
  await page.locator('[data-permit="shop"][data-plan="weekly"]').click();
  const after=await saved(page);
  expect(after.completed).toContain('permit:shop');
  expect(after.permitPlans[0].owed).toBe(216);
  await expect(page.locator('.permit-card.held .permit-state')).toContainText('已办好');
  expect(errors).toEqual([]);
});

test('buying several of one thing is reachable from the item you clicked',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:200});
  await start(page);
  await enter(page,'homeware',2.6);
  await warp(page,await offsetOf(page,'homeware'),-0.6,0);
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('家居小铺');

  // The basket sits above the goods, not below them, and every fixed-price card can fill it.
  await expect(page.locator('#cart-bar')).toBeAttached();
  await expect(page.locator('[data-add]').first()).toBeVisible();

  // Opening an item is what a player does; the quantity has to be there.
  await page.locator('[data-shop-item="wooden-chair"]').click();
  await expect(page.locator('#item-basket')).toBeVisible();
  await page.locator('#item-more').click();
  await page.locator('#item-more').click();
  await expect(page.locator('#item-count')).toHaveText('3');
  await page.locator('#item-add').click();

  await expect(page.locator('.cart-count')).toHaveText('3');
  await expect(page.locator('[data-shop-item="wooden-chair"] .card-badge')).toContainText('3');

  // A second, different item joins the same basket.
  await page.locator('[data-add="potted-plant"]').click();
  await expect(page.locator('.cart-count')).toHaveText('4');
  await page.locator('#cart-open').click();
  await expect(page.locator('.cart-table tbody tr')).toHaveCount(2);
  await page.getByRole('button',{name:/一起结账/}).click();

  const after=await saved(page);
  expect(after.inventory['wooden-chair']).toBe(3);
  expect(after.inventory['potted-plant']).toBe(1);
  expect(after.wallet).toBe(200-8*3-12);
  expect(errors).toEqual([]);
});
