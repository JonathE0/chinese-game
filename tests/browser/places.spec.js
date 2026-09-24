import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const SAVE_KEY='little-mandarin-town.v1';

async function hold(page,key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}

/** Drop the tourist just short of a door, then walk the last stretch on foot so that
 *  collision and the interaction prompt are still exercised for real. */
async function approach(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(120);
}
async function walkToHall(page){await approach(page,0,-12.5);await hold(page,'w',1300);}   // up the hall's stairs
async function walkToHome(page){await approach(page,11,7.8,180);await hold(page,'w',900);}

async function seed(page,profile){
  // addInitScript runs on every navigation, so only seed when there is nothing saved yet:
  // a reload must keep whatever the previous page wrote.
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:null,claims:{},words:{},completed:[],phrases:[],saved:[],home:[],
    settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人',...profile,
  })]);
}

test('the word hall is a place you walk into, and it states its HSK caveat',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await walkToHall(page);
  await expect(page.locator('#interact')).toBeVisible();
  await expect(page.locator('#interact span')).toHaveText('进词语馆');
  await page.keyboard.press('e');
  await expect(page.locator('.location b')).toHaveText('词语馆');
  // Indoors there is no square to map and nobody to overhear.
  await expect(page.locator('.mini-map')).toBeHidden();
  await expect(page.locator('#ambient-bubble')).toBeHidden();

  await hold(page,'w',1100);
  await expect(page.locator('#interact span')).toHaveText('查词 · HSK');
  await page.keyboard.press('e');

  await expect(page.locator('.syllabus-note')).toContainText('HSK 3.0',{timeout:20000});
  await expect(page.locator('.syllabus-note')).toContainText('尚未');
  await expect(page.locator('.level-tab').first()).toContainText('506');
  await expect(page.locator('.level-tabs .level-tab')).toHaveCount(6);
  // Level 1 has generated audio; level 6 does not, so no listening drill is offered there.
  await expect(page.locator('#hsk-listen')).toBeVisible();
  await page.locator('.level-tab').nth(5).click();
  await expect(page.locator('#hsk-listen')).toHaveCount(0);
  await page.locator('.level-tab').first().click();

  await page.locator('#hsk-search').fill('water');
  await expect(page.locator('.hsk-row .zh').first()).toHaveText('水');
  await page.locator('#hsk-search').fill('');
  expect(errors).toEqual([]);
});

test('an HSK drill credits one skill and stops offering a word until it is due again',async({page})=>{
  const first=JSON.parse(readFileSync('public/hsk/words.json','utf8')).words.find(w=>w.level===1);
  // Seed that word as overdue so the drill must offer it first.
  await seed(page,{words:{[first.id]:{recognition:{stage:1,due:1,last:1,reviews:1}}}});
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await walkToHall(page);await page.keyboard.press('e');
  await hold(page,'w',1100);await page.keyboard.press('e');
  await expect(page.locator('.syllabus-note')).toBeVisible({timeout:20000});

  const answer=async()=>{
    const id=await page.locator('.drill-prompt').getAttribute('data-word');
    await page.locator(`[data-pick="${id}"]`).click();
    await expect(page.locator('#drill-feedback .feedback')).toBeVisible();
    await page.locator('#drill-next').click();
    return id;
  };
  const saved=async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY);

  await page.getByRole('button',{name:/复习这一级/}).click();
  await expect(page.locator('.drill-zh')).toHaveText(first.zh);
  expect(await answer()).toBe(first.id);

  const after=await saved();
  expect(after.wallet).toBeGreaterThan(0);
  // A reading drill credits recognition only; listening and production stay untouched.
  expect(after.words[first.id].recognition.stage).toBe(2);
  expect(after.words[first.id].listening).toBeUndefined();
  expect(after.words[first.id].production).toBeUndefined();
  expect(after.words[first.id].recognition.due).toBeGreaterThan(Date.now());

  // Having just been answered, it is no longer due, so the next session offers something else.
  await page.reload();await page.getByRole('button',{name:'开始旅行'}).click();
  await walkToHall(page);await page.keyboard.press('e');
  await hold(page,'w',1100);await page.keyboard.press('e');
  await expect(page.locator('.syllabus-note')).toBeVisible({timeout:20000});
  await page.getByRole('button',{name:/复习这一级/}).click();
  await expect(page.locator('.drill-zh')).toBeVisible();
  expect(await page.locator('.drill-prompt').getAttribute('data-word')).not.toBe(first.id);
  expect((await saved()).words[first.id].recognition.reviews).toBe(2);
});

test('furniture bought in town can be placed at home and survives a reload',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60,inventory:{'low-table':1,'potted-plant':1},completed:['home:tutorial','home:starter']});
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await walkToHome(page);
  await expect(page.locator('#interact span')).toHaveText('回家');
  await page.keyboard.press('e');
  await expect(page.locator('.location b')).toHaveText('我的家');

  await hold(page,'w',900);
  await expect(page.locator('#interact span')).toHaveText('布置房间');
  await page.keyboard.press('e');
  await expect(page.getByRole('heading',{name:'布置房间'})).toBeVisible();
  await expect(page.locator('[data-place="low-table"]')).toBeEnabled();

  await page.locator('[data-place="low-table"]').click();
  await expect(page.locator('#panel')).toBeHidden();
  await page.mouse.click(700,500);                 // first click grabs the mouse
  await page.mouse.click(700,500);                 // second click sets the table down
  await expect.poll(async()=>(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).home.length,SAVE_KEY)),{timeout:8000}).toBe(1);

  const record=(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).home[0],SAVE_KEY));
  expect(record.item).toBe('low-table');
  expect([0,90,180,270]).toContain(record.rot);

  // It is still standing there after a reload, and the panel now offers to put it away.
  await page.reload();await page.getByRole('button',{name:'开始旅行'}).click();
  await walkToHome(page);await page.keyboard.press('e');
  await hold(page,'w',900);await page.keyboard.press('e');
  await expect(page.locator('.placed-row')).toHaveCount(1);
  await expect(page.locator('[data-place="low-table"]')).toHaveCount(0);   // none spare while it is out
  await page.locator('[data-remove="0"]').click();
  await expect(page.locator('.placed-row')).toHaveCount(0);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).home.length,SAVE_KEY)).toBe(0);
  expect(errors).toEqual([]);
});

test('touch drives the same first-person controls: drag to look, thumbstick to walk',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(600);

  // Synthetic touch pointers, because Playwright's touchscreen can tap but not drag.
  const touch=(type,x,y,id=7)=>page.evaluate(([type,x,y,id])=>{
    document.querySelector('#world').dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true}));
  },[type,x,y,id]);
  const heading=async()=>Number((await page.locator('#map-facing').getAttribute('transform')).match(/rotate\(([-\d.]+)\)/)[1]);
  const at=async axis=>Number(await page.locator('#map-player').getAttribute(axis));

  // Dragging the right of the screen looks around; the mouse is never locked on touch.
  // Dragging leftwards turns the view left, which is a negative rotation on the map.
  const facing=await heading();              // you arrive facing your home, not north
  await touch('pointerdown',300,300);
  await touch('pointermove',230,300);
  await touch('pointerup',230,300);
  await expect.poll(heading,{timeout:5000}).toBeLessThan(facing-5);
  expect(await page.evaluate(()=>document.pointerLockElement?.id??null)).toBeNull();

  // Holding the lower left walks; releasing slides briefly, then stops.
  const startX=await at('cx'),startY=await at('cy');
  await touch('pointerdown',80,700,9);
  await touch('pointermove',80,630,9);
  await page.waitForTimeout(900);
  await touch('pointerup',80,630,9);
  await page.waitForTimeout(700);
  // You walk the way you face, which is towards your home rather than north.
  const walked=await at('cy'),walkedX=await at('cx');
  expect(Math.hypot(walkedX-startX,walked-startY)).toBeGreaterThan(.5);
  await page.waitForTimeout(500);
  expect(await at('cy')).toBeCloseTo(walked,2);
  expect(await at('cx')).toBeCloseTo(walkedX,2);
  expect(errors).toEqual([]);
  await context.close();
});
