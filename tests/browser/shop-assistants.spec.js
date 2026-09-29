import {test,expect} from '@playwright/test';

// Every shop has a shop assistant behind its counter who greets you, says a line about the shop,
// and offers to let you browse (the shop's own panel) or say goodbye (D1-shops).
const SAVE_KEY='little-mandarin-town.v1';

test.beforeEach(async({page})=>{
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:20,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    dayIndex:1,settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
});

test('the bakery assistant greets you, talks about the bread and opens the shop',async({page})=>{
  const targets=await page.evaluate(()=>{const t=window.__qinghe.town;t.enterRoom('bakery');return t.targets().map(x=>x.id);});
  expect(targets).toContain('staff:bakery-clerk');
  expect(targets).toContain('shop:bakery');
  await page.evaluate(()=>window.__qinghe.town.onInteract('staff:bakery-clerk'));
  // One page: the greeting and, not led here, the offer to look around.
  await expect(page.locator('.dialogue-line')).toHaveText([/欢迎光临/,/随便看看/]);
  await page.locator('#assistant-next').click();
  await expect(page.locator('.dialogue-line')).toContainText('面包刚出炉');
  await page.locator('#assistant-browse').click();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.ui.panelId)).toBe('shop');
  await expect(page.locator('#toast')).toContainText('在这边付钱');         // said as the shop opens
});

test('led here by the buy guide, the assistant asks what you are looking for',async({page})=>{
  // Arriving through the door on a route to this shop, the way the buy guide's 带路 sets one.
  await page.evaluate(()=>{const q=window.__qinghe;q.ui.route={key:'bakery',shop:'bakery'};q.town.onInteract('door:bakery');});
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('bakery');
  await page.evaluate(()=>window.__qinghe.town.onInteract('staff:bakery-clerk'));
  await expect(page.locator('.dialogue-line')).toHaveText([/欢迎光临/,/你要找什么/]);
});

test('the post office assistant offers a postcard instead of goods, and waiters still take orders',async({page})=>{
  await page.evaluate(()=>{window.__qinghe.town.enterRoom('post-office');window.__qinghe.town.onInteract('staff:post-clerk');});
  await page.locator('#assistant-next').click();
  await expect(page.locator('.dialogue-line')).toContainText('寄信请在这里买邮票');
  await expect(page.locator('#assistant-browse')).toHaveCount(0);
  await page.locator('#assistant-postcard').click();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.ui.panelId)).toBe('postcard');
  await page.evaluate(()=>window.__qinghe.ui.close());
  // The pharmacy has nothing on sale and sends no post: only goodbye.
  await page.evaluate(()=>{window.__qinghe.town.enterRoom('pharmacy');window.__qinghe.town.onInteract('staff:pharmacist');});
  await page.locator('#assistant-next').click();
  await expect(page.locator('#assistant-browse, #assistant-postcard')).toHaveCount(0);
  await page.locator('#assistant-bye').click();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.ui.panelId)).toBe(null);
  await expect(page.locator('#toast')).toContainText('谢谢光临');
  // The restaurant's waiters keep their own greeting, which leads to the menu.
  await page.evaluate(()=>{window.__qinghe.town.enterRoom('restaurant');window.__qinghe.town.onInteract('staff:waiter-a');});
  await expect(page.locator('#social-continue')).toBeVisible();
  await expect(page.locator('#assistant-next')).toHaveCount(0);
});

test('standing at the counter and looking at the assistant offers to talk, not the shop',async({page})=>{
  await page.evaluate(()=>{
    const t=window.__qinghe.town;t.enterRoom('bakery');
    const r=t.rooms.get('bakery'),f=r.fittings.find(f=>f.kind==='bakerycounter'),clerk=r.staff[0];
    for(const s of r.staff){s.speed=0;}                      // hold the clerk still behind the counter
    t.warp(r.offsetX+f.x,f.z+1.1);
    t.yaw=Math.atan2(-(clerk.x-f.x),-(clerk.z-(f.z+1.1)))*180/Math.PI;t.pitch=0;   // eye level: at the face, over the counter
  });
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.nearest?.id),{timeout:5000}).toBe('staff:bakery-clerk');
  // Looking down at the counter itself still opens the shop.
  await page.evaluate(()=>{window.__qinghe.town.pitch=-60;});
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.nearest?.id),{timeout:5000}).toBe('shop:bakery');
});

test('the buy guide leads to the city hardware store through the metro, and its assistant asks what you need',async({page})=>{
  await page.evaluate(()=>{const q=window.__qinghe;q.ui.route={key:'metro-platform',shop:'hardware'};q.town.onInteract('door:metro-platform');});
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('metro-platform');
  await page.evaluate(()=>{window.__qinghe.town.onInteract('door:hardware');});
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('hardware');
  await page.evaluate(()=>window.__qinghe.town.onInteract('staff:hardware-clerk'));
  await expect(page.locator('.dialogue-line')).toHaveText([/欢迎光临/,/你要找什么/]);
});

test('a route that is not the buy guide (去找找) does not make the assistant ask, and the bank does not ask you to pay',async({page})=>{
  await page.evaluate(()=>{const q=window.__qinghe;q.ui.route={key:'bank'};q.town.onInteract('door:bank');});
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('bank');
  await page.evaluate(()=>window.__qinghe.town.onInteract('staff:bank-clerk'));
  await expect(page.locator('.dialogue-line')).toHaveText([/欢迎光临/,/随便看看/]);
  await page.locator('#assistant-next').click();
  await expect(page.locator('#assistant-next')).toHaveCount(0);
  await expect(page.locator('#assistant-browse')).toBeFocused();         // the first button after 继续
  await page.locator('#assistant-browse').click();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.ui.panelId)).not.toBe('dialogue');
  await expect(page.locator('#toast')).not.toContainText('在这边付钱');
});
