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

test('a short recipe offers 哪儿有卖, which marks and routes to the supermarket',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Short of vegetable only, for 青菜豆腐饭.
  await seed(page,{inventory:{'rice-grain':1,tofu:1}});
  await start(page);
  await enter(page,'kitchen',-1.2,0);
  await page.keyboard.press('e');

  const card=page.locator('.recipe-card',{hasText:'青菜豆腐饭'});
  await expect(card).toBeVisible();
  const buyButton=card.getByRole('button',{name:'哪儿有卖'});
  await expect(buyButton).toBeVisible();
  await buyButton.click();

  await expect(page.locator('.buyguide-svg')).toBeVisible();
  const row=page.locator('.buy-row',{hasText:'青禾超市'});
  await expect(row).toBeVisible();
  await expect(row).toContainText('蔬菜');
  await expect(page.locator('.buy-pin')).toHaveCount(1);

  await row.getByRole('button',{name:'带路'}).click();
  // 带路 closes the whole panel.
  await expect(page.locator('#panel')).toBeHidden();
  const route=await page.evaluate(()=>window.__qinghe.ui.route);
  expect(route).toMatchObject({key:'supermarket',district:'market',x:28,z:-5.9});
  expect(errors).toEqual([]);
});

test('with a pot on, a short recipe still offers 哪儿有卖 and the guide stays open while it simmers',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Enough for 鸡蛋汤面; 青菜豆腐饭 is still short of vegetable.
  await seed(page,{inventory:{noodles:1,egg:1,'rice-grain':1,tofu:1}});
  await start(page);
  await enter(page,'kitchen',-1.2,0);
  await page.keyboard.press('e');
  await page.locator('.recipe-card',{hasText:'鸡蛋汤面'}).locator('[data-cook]').click();
  await expect(page.locator('[data-pot-bar]')).toBeVisible();
  await page.locator('.recipe-card',{hasText:'青菜豆腐饭'}).getByRole('button',{name:'哪儿有卖'}).click();
  await expect(page.locator('.buyguide-svg')).toBeVisible();
  await page.waitForTimeout(900);            // several ticks of the kitchen's 250 ms pot timer
  await expect(page.locator('.buyguide-svg')).toBeVisible();
  expect(errors).toEqual([]);
});

test('返回 goes back to the kitchen without losing the pot',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{inventory:{'rice-grain':1,tofu:1}});
  await start(page);
  await enter(page,'kitchen',-1.2,0);
  await page.keyboard.press('e');
  const card=page.locator('.recipe-card',{hasText:'青菜豆腐饭'});
  await card.getByRole('button',{name:'哪儿有卖'}).click();
  await expect(page.locator('.buyguide-svg')).toBeVisible();
  await page.getByRole('button',{name:'返回'}).click();
  await expect(page.locator('.recipe-list')).toBeVisible();
  await expect(page.locator('.buyguide-svg')).toHaveCount(0);
  expect(errors).toEqual([]);
});
