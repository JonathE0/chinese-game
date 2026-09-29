import {test,expect} from '@playwright/test';

// Friends and postcards (docs/superpowers/plans/2026-09-24-friends-and-postcards.md).
const SAVE_KEY='little-mandarin-town.v1';
async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:200,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...profile,
  })]);
}
async function warp(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(200);
}
const profile=page=>page.evaluate(()=>window.__qinghe.profile);

test('林阿姨 loves a pot of tea, and a postcard from the 邮筒 is answered the next day',async({page})=>{
  await seed(page,{inventory:{'pot-tea':1,postcard:1},completed:['home:tutorial','home:starter','introductions'],learning:{visited:['hall']}});
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(400);

  // A gift: 送礼物 lists what you carry; tea is one of her favourites.
  await warp(page,-4.8,-6.8,0);
  await expect(page.locator('#interact span')).toContainText('林阿姨');
  await page.keyboard.press('e');
  await expect(page.locator('#panel .friend-level')).toHaveText('认识');
  await page.locator('#social-gift').click();
  await page.locator('[data-gift="pot-tea"]').click();
  await expect(page.locator('#panel .dialogue-line .zh')).toHaveText('哇，我最喜欢这个了！谢谢你！');
  expect((await profile(page)).inventory['pot-tea']).toBeUndefined();
  // Her mission (+5) and the liked gift (+5) so far; the chat pays when it is finished.
  expect((await profile(page)).learning.friends.lin.points).toBe(10);
  await page.locator('#social-done').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#panel')).toBeHidden();

  // A postcard at the 邮筒 outside 小小商店: one tile per line, then 寄出.
  await warp(page,7.8,-3.6,0);        // the 邮筒 stands by the shop's west corner, clear of the counter
  await expect(page.locator('#interact span')).toHaveText('写明信片');
  await page.keyboard.press('e');
  for(const tile of ['陈叔叔，你好！','我今天去了词语馆。','我学了新词。','我很开心！','下次见！'])
    await page.locator('#panel [data-tile]',{hasText:tile}).click();
  await expect(page.locator('#panel .postcard-card')).toContainText('旅人');
  await page.locator('#postcard-send').click();
  await expect(page.locator('#postcard-done')).toBeVisible();
  const sent=await profile(page);
  expect(sent.inventory.postcard).toBeUndefined();
  expect(sent.learning.postcards).toEqual([{to:'chen',day:0,lines:['to-chen','went-hall','learned','happy','bye'],replied:false}]);
  await page.locator('#postcard-done').click();

  // A day later 陈叔叔 answers it and pins it up on his shop.
  await page.evaluate(()=>{window.__qinghe.profile.dayIndex=1;});
  await warp(page,4.8,-6.8,0);
  await expect(page.locator('#interact span')).toContainText('陈叔叔');
  await page.keyboard.press('e');
  // Walking off at the hello keeps his answer for next time, and the card is not up yet.
  await expect(page.locator('#social-continue')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#panel')).toBeHidden();
  expect(await page.evaluate(()=>!!window.__qinghe.town.postcardPin)).toBe(false);
  await page.keyboard.press('e');
  await page.locator('#social-continue').click();
  await expect(page.locator('#panel .dialogue-line .zh')).toHaveText('你的明信片我贴在店里了！');
  expect(await page.evaluate(()=>!!window.__qinghe.town.postcardPin)).toBe(true);
  expect((await profile(page)).learning.postcards[0].replied).toBe(true);
  expect((await profile(page)).learning.friends.chen.pinned).toBe(true);
});
