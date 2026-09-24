import {test,expect} from '@playwright/test';
import {pastGreeting} from './greeting.js';

const SAVE_KEY='little-mandarin-town.v1';
const BANK=[
  {zh:'树',pinyin:'shù',en:'tree'},{zh:'长椅',pinyin:'cháng yǐ',en:'bench'},
  {zh:'喷泉',pinyin:'pēn quán',en:'fountain'},{zh:'灯笼',pinyin:'dēng long',en:'lantern'},
  {zh:'门',pinyin:'mén',en:'door'},{zh:'窗户',pinyin:'chuāng hu',en:'window'},
  {zh:'桥',pinyin:'qiáo',en:'bridge'},{zh:'汽车',pinyin:'qì chē',en:'car'},
  {zh:'书',pinyin:'shū',en:'book'},{zh:'水',pinyin:'shuǐ',en:'water'},
  {zh:'茶',pinyin:'chá',en:'tea'},{zh:'花',pinyin:'huā',en:'flower'},
];

async function hold(page,key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
async function warp(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(150);   // let a frame run so the interaction prompt catches up
}
async function enter(page,room,z,yaw=0){
  await page.evaluate(([r,z,y])=>{
    const town=window.__qinghe.town;town.enterRoom(r);town.warp(town.rooms.get(r).offsetX,z,y);},[room,z,yaw]);
  await page.waitForTimeout(200);
}
const offsetOf=(page,room)=>page.evaluate(r=>window.__qinghe.town.rooms.get(r).offsetX,room);
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY);

async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:200,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},
    settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人',...profile,
  })]);
}
async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(400);
  await page.mouse.click(700,500);
}

test('the sky, the lamps and the clock all follow the time of day',async({page})=>{
  await seed(page,{});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.daylight.paused=true;});

  const read=hour=>page.evaluate(h=>{
    const town=window.__qinghe.town;
    town.daylight.setHour(h);
    const sky=town.camera.camera.clearColor,sun=town.sun.light;
    return {lamps:town.daylight.state.lamps,skyBlue:sky.b,skyRed:sky.r,sun:sun.intensity};
  },hour);

  const noon=await read(13),night=await read(23);
  expect(noon.sun).toBeGreaterThan(night.sun*2);        // the sun actually sets
  expect(night.lamps).toBeGreaterThan(.9);              // lanterns are lit
  expect(noon.lamps).toBeLessThan(.1);                  // and unlit at midday
  expect(night.skyBlue).toBeGreaterThan(night.skyRed);  // a blue night sky
  await page.evaluate(()=>window.__qinghe.town.daylight.setHour(21));
  await expect(page.locator('#place-time')).toContainText('21:');
  await expect(page.locator('body.after-dark')).toHaveCount(1);
});

test('a room goes dark at night until you put a lamp in it',async({page})=>{
  await seed(page,{});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.daylight.paused=true;});
  await enter(page,'home',3.0);

  const ceiling=()=>page.evaluate(()=>window.__qinghe.town.rooms.get('home').ceilings[0].light.intensity);
  await page.evaluate(()=>window.__qinghe.town.daylight.setHour(13));
  await page.waitForTimeout(150);
  const day=await ceiling();
  await page.evaluate(()=>window.__qinghe.town.daylight.setHour(23));
  await page.waitForTimeout(150);
  const dark=await ceiling();
  expect(day).toBeGreaterThan(dark*3);

  // A lamp bought for the ceiling actually lights the room after dark.
  await warp(page,await offsetOf(page,'home'),-1.6,0);
  await page.keyboard.press('e');
  await page.locator('[data-slot="ceiling"]').click();
  await page.locator('[data-choose="ceiling-lamp"]').click();
  await page.waitForTimeout(300);
  const lampLight=await page.evaluate(()=>{
    const room=window.__qinghe.town.rooms.get('home');
    return [...room.props.values()].filter(p=>p.entity.lampLight).map(p=>p.entity.lampLight.light.intensity);
  });
  expect(lampLight.length).toBe(1);
  expect(lampLight[0]).toBeGreaterThan(1);
});

test('you can order from the tablet, in Chinese, and it banks the dish name',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  await page.evaluate(()=>window.__qinghe.town.setUnlocked('riverside',true));
  await enter(page,'restaurant',2.6);
  await warp(page,(await offsetOf(page,'restaurant'))-3.4,2.6,0);
  await expect(page.locator('#interact span')).toHaveText('看菜单点菜');
  await page.keyboard.press('e');
  await expect(page.locator('[data-dish]')).toHaveCount(6);

  await page.locator('[data-dish="dumplings"]').click();
  // A phrase that is not an order is not accepted.
  await page.locator('#order-text').fill('你好');
  await page.getByRole('button',{name:'说出来'}).click();
  await expect(page.locator('#order-feedback')).toContainText('没听懂');

  await page.locator('#order-text').fill('我要一份饺子');
  await page.getByRole('button',{name:'说出来'}).click();
  await expect(page.locator('.completion h3')).toContainText('点好了');

  const after=await saved(page);
  expect(after.inventory.dumplings).toBe(1);
  expect(after.wallet).toBe(200-12+3);                       // dish cost, minus the Chinese-order bonus
  expect(after.saved.map(w=>w.zh)).toContain('饺子');
  expect(errors).toEqual([]);
});

test('a waiter walks the floor and can take the order too',async({page})=>{
  await seed(page,{});
  await start(page);
  await page.evaluate(()=>window.__qinghe.town.setUnlocked('riverside',true));
  await enter(page,'restaurant',3.4);                         // where you arrive through the door
  const where=()=>page.evaluate(()=>window.__qinghe.town.rooms.get('restaurant').staff.map(s=>[+s.x.toFixed(2),+s.z.toFixed(2)]));
  const before=await where(page);
  await page.waitForTimeout(1200);
  const after=await where(page);
  expect(after).not.toEqual(before);                          // arriving does not stop anyone

  // Step into a waiter's way: they stop short of you rather than walking through you, and carry
  // on once you move.
  const blocked=await page.evaluate(async()=>{
    const t=window.__qinghe.town,room=t.rooms.get('restaurant'),w=room.staff[0];
    const [tx,tz]=w.path[w.target];
    const dx=tx-w.x,dz=tz-w.z,len=Math.hypot(dx,dz)||1;
    t.warp(room.offsetX+w.x+dx/len*.95,w.z+dz/len*.95,0);
    let closest=Infinity;
    for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,50));
      const p=t.player.entity.getPosition();closest=Math.min(closest,Math.hypot(p.x-room.offsetX-w.x,p.z-w.z));}
    return +closest.toFixed(2);
  });
  expect(blocked).toBeGreaterThan(.6);                        // never inside the player's space
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(t.rooms.get('restaurant').offsetX+4.5,3.6,0);});
  const freed=await where(page);await page.waitForTimeout(1500);
  expect(await where(page)).not.toEqual(freed);

  // Stand where a waiter is and talk to them.
  const spot=await page.evaluate(()=>{
    const room=window.__qinghe.town.rooms.get('restaurant');
    // Stand just on the door side of a waiter, so they are nearer than the counter behind them.
    const waiter=room.staff[0];
    return [room.offsetX+waiter.x,waiter.z+.9];
  });
  await warp(page,spot[0],spot[1],0);
  await expect(page.locator('#interact span')).toContainText('服务员');
  await page.keyboard.press('e');await pastGreeting(page);
  await expect(page.locator('#panel-title')).toHaveText('菜单');
});

test('a vendor mood shifts by day and rapport, and pushing a sour one can raise the price',async({page})=>{
  // Rapport lifts the same day's mood.
  await seed(page,{dayIndex:3});
  await start(page);
  await warp(page,9,0.6,0);
  await page.keyboard.press('e');await pastGreeting(page);
  const plain=await page.locator('.vendor-mood b').textContent();
  await page.evaluate(k=>{
    const p=JSON.parse(localStorage.getItem(k));p.vendors={chen:{rapport:36}};localStorage.setItem(k,JSON.stringify(p));
  },SAVE_KEY);
  await page.reload();
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(400);await page.mouse.click(700,500);
  await warp(page,9,0.6,0);
  await page.keyboard.press('e');await pastGreeting(page);
  const friendly=await page.locator('.vendor-mood b').textContent();
  const order=['心情不好','不太热情','心情不错','今天很开心'];
  expect(order.indexOf(friendly)).toBeGreaterThanOrEqual(order.indexOf(plain));

  // The floor the vendor will accept is shown, and a lowball never gets taken.
  await page.locator('[data-shop-item="travel-hat"]').click();
  const floor=Number((await page.locator('.negotiation h3 small').textContent()).match(/[0-9]+/)[0]);
  expect(floor).toBeGreaterThanOrEqual(18);
  expect(floor).toBeLessThanOrEqual(24);
  await page.locator('#offer').fill('五可以吗');
  await page.getByRole('button',{name:'出价',exact:true}).click();
  expect(Number(await page.locator('#quoted-price').textContent())).toBeGreaterThanOrEqual(floor);
});

test('the games use your own words and pay out once a day',async({page})=>{
  await seed(page,{saved:BANK});
  await start(page);
  await warp(page,(await offsetOf(page,'home')),0,0);   // not needed, but keeps focus in the world
  await enter(page,'study',0);                                   // the desk is in the study now
  await warp(page,(await offsetOf(page,'study'))-.7,-1.4,-90);
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('生词本');
  await page.getByRole('button',{name:/小游戏/}).click();
  await expect(page.locator('[data-game]')).toHaveCount(2);

  await page.locator('[data-game="match"]').click();
  await expect(page.locator('[data-card]')).toHaveCount(12);
  // Turning two cards over never throws and never pays out twice.
  await page.locator('[data-card]').nth(0).click();
  await page.waitForTimeout(120);
  await page.locator('[data-card]').nth(1).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-card]')).toHaveCount(12);

  const claims=Object.keys((await saved(page)).claims).filter(k=>k.startsWith('game:'));
  expect(claims.length).toBeLessThanOrEqual(1);
});

test('a wild pointer-lock delta cannot spin the view, and you never get stuck inside geometry',async({page})=>{
  await seed(page,{});
  await start(page);
  const heading=async()=>Number((await page.locator('#map-facing').getAttribute('transform')).match(/rotate\(([-\d.]+)\)/)[1]);
  await warp(page,0,10,0);
  expect(await heading()).toBe(0);

  // The huge delta some browsers emit as pointer lock engages is dropped outright.
  await page.evaluate(()=>dispatchEvent(new MouseEvent('mousemove',{movementX:4000,movementY:0})));
  await page.waitForTimeout(120);
  expect(await heading()).toBe(0);

  // Later absurd deltas are clamped: 9000px would be three full turns without the cap.
  await page.evaluate(()=>dispatchEvent(new MouseEvent('mousemove',{movementX:9000,movementY:0})));
  await page.waitForTimeout(120);
  const spun=Math.abs(await heading());
  expect(spun).toBeGreaterThan(0);
  expect(spun).toBeLessThan(100);

  // An ordinary flick still turns the view normally.
  const before=await heading();
  await page.evaluate(()=>dispatchEvent(new MouseEvent('mousemove',{movementX:-250,movementY:0})));
  await page.waitForTimeout(120);
  expect(Math.abs((await heading())-before)).toBeGreaterThan(20);

  // Dropped inside the fountain, the tourist walks back out instead of freezing.
  const at=async axis=>Number(await page.locator('#map-player').getAttribute(axis));
  await warp(page,0,1.8,0);
  await expect.poll(async()=>Math.hypot(await at('cx'),(await at('cy'))-1.8),{timeout:6000}).toBeGreaterThan(2.4);
});
