import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';

async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:60,inventory:{},equipped:{},claims:{},words:{},
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
async function warp(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(240);
}
async function enterKitchen(page){
  await page.evaluate(()=>{
    const town=window.__qinghe.town;town.enterRoom('kitchen');town.warp(town.rooms.get('kitchen').offsetX,-1.2,0);
  });
  await page.waitForTimeout(240);
}
const profileOf=page=>page.evaluate(()=>window.__qinghe.profile);
const cityX=page=>page.evaluate(()=>window.__qinghe.town.rooms.get('city').offsetX);

/** Types a reply into the open dialogue, submits it, then clicks past the feedback screen. */
async function answer(page,text){
  await page.getByRole('textbox',{name:'你的回答'}).fill(text);
  await page.getByRole('button',{name:'提交回答'}).click();
  await page.getByRole('button',{name:'继续',exact:true}).click();
}
/** Walks the whole 来一碗面 conversation (already open) to its completion screen, then leaves it. */
async function orderBowl(page,{dish,size,spice,where}){
  const DISH={beef:'我要一碗牛肉面',egg:'我要一碗鸡蛋面'};
  const SIZE={large:'大碗',small:'小碗'};
  const SPICE={hot:'要辣的',mild:'微辣',none:'不要辣'};
  const WHERE={here:'在这儿吃',takeaway:'带走'};
  await answer(page,DISH[dish]);
  await answer(page,SIZE[size]);
  await answer(page,SPICE[spice]);
  await answer(page,WHERE[where]);
  await page.getByRole('button',{name:'完成对话',exact:true}).click();
  await page.getByRole('button',{name:'回到小镇',exact:true}).click();
}

test('ordering noodles teaches the home recipe once, serves what you paid for, and unlocks it in the kitchen',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{inventory:{noodles:1,egg:1,tomato:1}});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  const x=await cityX(page);

  await warp(page,x+10.5,1,0);
  await expect(page.locator('#interact span')).toHaveText('海风面馆 · 点面');
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('来一碗面');

  await orderBowl(page,{dish:'egg',size:'large',spice:'none',where:'here'});
  // Finishing the conversation itself pays its own (unrelated) lesson reward first, so the
  // balance the noodle purchase debits from is whatever the wallet is once that has landed.
  const walletBeforeBowl=(await profileOf(page)).wallet;

  // First bowl ever: the cook teaches the home recipe, free, and says so with a toast.
  await expect(page.locator('#toast')).toContainText('学会了：番茄鸡蛋面');
  await expect(page.locator('.panel-dialogue .dialogue-line .zh')).toHaveText('第一次来吧？教你做个家常的番茄鸡蛋面，回家试试！');
  expect((await profileOf(page)).completed).toContain('recipe:tomato-egg-noodles');
  await page.locator('#line-continue').click();

  // Then the purchase confirmation: item, quantity, total, and what is left.
  await expect(page.locator('#panel-title')).toHaveText('大碗鸡蛋面');
  const confirm=page.locator('.purchase-confirm');
  await expect(confirm).toContainText('大碗鸡蛋面 × 1');
  await expect(confirm).toContainText('15 学习币');
  await expect(confirm).toContainText(`${walletBeforeBowl-15} 学习币`);
  await page.locator('#confirm-purchase').click();

  // Eating here serves it straight away, through the normal eating path.
  await expect(page.locator('.panel-dialogue .dialogue-line .zh')).toHaveText('面来了，慢慢吃！');
  await page.locator('#line-continue').click();

  const afterOrder=await profileOf(page);
  expect(afterOrder.wallet).toBe(walletBeforeBowl-15);
  expect(afterOrder.inventory['city-egg-noodles-large']).toBeUndefined();
  expect(afterOrder.completed).toContain('city-noodles');
  expect(afterOrder.stats.hunger).toBeGreaterThan(20);
  expect(afterOrder.daily.counts.meals).toBe(1);

  // The home kitchen now offers the recipe instead of a locked card.
  await enterKitchen(page);
  await expect(page.locator('#interact span')).toHaveText('做饭 · 厨房');
  await page.keyboard.press('e');
  const card=page.locator('.recipe-card',{hasText:'番茄鸡蛋面'});
  await expect(card).toBeVisible();
  await expect(card).not.toContainText('去云海');
  await card.getByRole('button',{name:'开火'}).click();
  await expect(page.locator('.pot-card')).toContainText('正在做');

  // Skip ahead to the pot being ready, the same way the kitchen's own tests do.
  await page.evaluate(()=>{window.__qinghe.ui.close();window.__qinghe.town.enterRoom('home');});
  await page.evaluate(()=>{window.__qinghe.profile.cooking.remaining=0.2;});
  await expect(page.locator('#toast')).toContainText('做好了');

  await enterKitchen(page);
  await page.keyboard.press('e');
  await page.getByRole('button',{name:'盛出来'}).click();
  const cooked=await profileOf(page);
  expect(cooked.inventory['home-tomato-egg-noodles']).toBe(1);
  expect(cooked.completed).toContain('cooked:tomato-egg-noodles');   // the home-noodles mission flag
  expect(errors).toEqual([]);
});

test('an order you cannot afford shows the cook saying so, and cancelling leaves everything as it was',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:20});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  const x=await cityX(page);
  await warp(page,x+10.5,1,0);

  // First visit still teaches the recipe, win or lose the sale. That conversation pays its own
  // lesson reward before the purchase step even starts, so capture the balance after it lands.
  await page.keyboard.press('e');
  await orderBowl(page,{dish:'beef',size:'small',spice:'none',where:'here'});
  const walletBeforeBowl=(await profileOf(page)).wallet;
  // Closing the recipe line with Esc still moves on to the purchase step.
  await expect(page.locator('#line-continue')).toBeVisible();
  await page.keyboard.press('Escape');

  // Affordable, but the player backs out: nothing about the wallet or bag changes.
  await expect(page.locator('.purchase-confirm')).toContainText('小碗牛肉面 × 1');
  await page.locator('#cancel-purchase').click();
  await expect(page.locator('.panel-dialogue .dialogue-line .zh')).toHaveText('没关系，下次再来！');
  await page.locator('#line-continue').click();
  const afterCancel=await profileOf(page);
  expect(afterCancel.wallet).toBe(walletBeforeBowl);
  expect(afterCancel.inventory['city-beef-noodles-small']).toBeUndefined();

  // Closing the confirmation with Esc is cancelling too.
  await page.keyboard.press('e');
  await orderBowl(page,{dish:'beef',size:'small',spice:'none',where:'takeaway'});
  await expect(page.locator('.purchase-confirm')).toContainText('小碗牛肉面 × 1');
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel-dialogue .dialogue-line .zh')).toHaveText('没关系，下次再来！');
  await page.locator('#line-continue').click();
  const afterEscape=await profileOf(page);
  expect(afterEscape.wallet).toBe(walletBeforeBowl);
  expect(afterEscape.inventory['city-beef-noodles-small']).toBeUndefined();

  // Too poor for even the cheapest bowl: the confirmation never appears at all.
  await page.evaluate(()=>{window.__qinghe.profile.wallet=5;});
  await page.keyboard.press('e');
  await orderBowl(page,{dish:'egg',size:'small',spice:'none',where:'takeaway'});
  await expect(page.locator('.panel-dialogue .dialogue-line .zh')).toHaveText('不好意思，钱好像不够。');
  await page.locator('#line-continue').click();
  const afterBroke=await profileOf(page);
  expect(afterBroke.wallet).toBe(5);
  expect(afterBroke.inventory['city-egg-noodles-small']).toBeUndefined();
  expect(errors).toEqual([]);
});
