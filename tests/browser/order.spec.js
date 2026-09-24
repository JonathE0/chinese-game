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
// The market clips may not be generated yet, so the manifest is patched to list them.
async function fakeMarketClips(page){
  await page.route('**/audio/manifest.json',async route=>{
    const manifest=await (await route.fetch()).json();
    for(const id of ['greet','ok','measureHint','wrongPay','paid',...Array.from({length:99},(_,i)=>`total-${i+1}`)])
      manifest.clips[`market-${id}`]={approved:true,src:`/audio/clips/market-${id}.mp3`,source:'generated'};
    await route.fulfill({json:manifest});
  });
  await page.route('**/audio/clips/market-*',route=>route.fulfill({status:200,contentType:'audio/mpeg',body:''}));
}

test('at the wonton stall you order 我要两碗馄饨 and pay the total you hear',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const clips=[];page.on('request',r=>{if(r.url().includes('/audio/clips/market-'))clips.push(r.url());});
  await fakeMarketClips(page);
  await seed(page,{});
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(500);
  await page.evaluate(()=>window.__qinghe.town.daylight.setHour(10));
  await page.evaluate(()=>window.__qinghe.town.warp(-11.5,0.5,0));
  await page.waitForTimeout(200);
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('馄饨摊');
  await page.locator('[data-shop-item="wonton"]').click();

  await page.locator('[data-num="2"]').click();
  const wrong=page.locator('[data-measure]:not([data-measure="碗"])').first();
  await wrong.click();
  await expect(page.locator('[data-measure="碗"]')).toHaveClass(/hint/);
  await page.locator('[data-measure="碗"]').click();
  await expect(page.locator('#order-sentence')).toHaveText('我要两碗馄饨。');
  await page.locator('#order-go').click();
  await expect.poll(()=>clips.some(u=>u.includes('market-total-16'))).toBe(true);

  const wallet=await page.evaluate(()=>window.__qinghe.profile.wallet);
  const misses=page.locator('[data-pay]:not([data-pay="16"])');
  await misses.nth(0).click();
  expect(await page.evaluate(()=>window.__qinghe.profile.wallet)).toBe(wallet);
  await expect(page.locator('#pay-feedback')).not.toContainText('一共十六块');
  await misses.nth(1).click();
  await expect(page.locator('#pay-feedback')).toContainText('一共十六块。');
  await page.locator('[data-pay="16"]').click();

  const after=await page.evaluate(()=>window.__qinghe.profile);
  expect(after.inventory.wonton).toBe(2);
  expect(after.wallet).toBe(wallet-16);            // a wrong tile was picked, so no build bonus
  expect(after.daily.counts.ordered).toBe(1);
  await expect(page.locator('.completion')).toContainText('谢谢！慢走！');
  expect(errors).toEqual([]);
});

test('a clean build earns the bonus once, and a second clean order the same day earns none',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await fakeMarketClips(page);
  await seed(page,{});
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(500);
  await page.evaluate(()=>window.__qinghe.town.daylight.setHour(10));
  await page.evaluate(()=>window.__qinghe.town.warp(-11.5,0.5,0));
  await page.waitForTimeout(200);
  await page.keyboard.press('e');
  await expect(page.locator('#panel-title')).toHaveText('馄饨摊');
  const wallet=()=>page.evaluate(()=>window.__qinghe.profile.wallet);
  const orderOne=async()=>{
    await page.locator('[data-shop-item="wonton"]').click();
    await page.locator('[data-num="1"]').click();
    await page.locator('[data-measure="碗"]').click();
    await page.locator('#order-go').click();
    await page.locator('[data-pay="8"]').click();
    await expect(page.locator('.completion')).toBeVisible();
  };
  const start=await wallet();
  await orderOne();
  expect(await wallet()).toBe(start-8+1);
  await page.locator('#keep-shopping').click();
  await orderOne();
  expect(await wallet()).toBe(start-8+1-8);
  expect(await page.evaluate(()=>window.__qinghe.profile.inventory.wonton)).toBe(2);
  expect(errors).toEqual([]);
});
