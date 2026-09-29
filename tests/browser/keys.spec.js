import {test,expect} from '@playwright/test';
import {pastGreeting} from './greeting.js';

const SAVE_KEY='little-mandarin-town.v1';
const BUTTONS=['journal-button','inventory-button','review-button','status-button','settings-button','labels-button'];

async function seed(page,extra={}){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:60,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},tutorial:{done:true},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...extra,
  })]);
}
async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await expect.poll(()=>page.evaluate(()=>!!window.__qinghe?.town)).toBe(true);
}

/** The six HUD buttons: all inside .top-actions, on one line, apart, and inside the screen. */
async function checkRow(page){
  const box=await page.evaluate(ids=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
    const row=document.querySelector('.top-actions');
    const card=document.querySelector('#quest-card');
    return {inRow:ids.every(id=>row.contains(document.getElementById(id))),dock:!!document.querySelector('.utility-dock'),
      buttons:ids.map(id=>rect(document.getElementById(id))),wallet:rect(row.querySelector('.wallet')),brand:rect(document.querySelector('.brand')),
      card:card&&getComputedStyle(card).display!=='none'?rect(card):null,width:innerWidth,
      titleOneLine:(h=>h.getBoundingClientRect().height<parseFloat(getComputedStyle(h).fontSize)*1.8)(document.querySelector('.brand h1')),
      brandFits:[...document.querySelectorAll('.brand, .brand *')].every(el=>el.scrollWidth<=el.clientWidth+1)};
  },BUTTONS);
  expect(box.inRow).toBe(true);
  expect(box.dock).toBe(false);
  const mid=b=>(b.top+b.bottom)/2;
  // Round, not squeezed thin to make them fit.
  for(const b of box.buttons){expect(Math.abs(mid(b)-mid(box.buttons[0]))).toBeLessThan(1);expect(Math.abs((b.right-b.left)-(b.bottom-b.top))).toBeLessThan(1);}
  expect(box.brandFits).toBe(true);
  for(let i=1;i<box.buttons.length;i++)expect(box.buttons[i].left).toBeGreaterThanOrEqual(box.buttons[i-1].right);
  expect(box.buttons[0].left).toBeGreaterThanOrEqual(box.wallet.right);
  expect(box.wallet.left).toBeGreaterThanOrEqual(box.brand.right+4);
  expect(box.titleOneLine).toBe(true);
  expect(box.buttons.at(-1).right).toBeLessThanOrEqual(box.width);
  // Nothing else up there (the mission card) may sit under a button.
  const meets=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
  if(box.card)for(const b of [box.wallet,...box.buttons])expect(meets(box.card,b)).toBe(false);
}

for(const [width,height] of [[1280,720],[960,540]]){
  test(`the six HUD buttons share one row at ${width}×${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await seed(page);await start(page);
    await checkRow(page);
    await expect(page.locator('#labels-button kbd')).toHaveText('H');
    await expect(page.locator('#status-button')).toHaveAttribute('aria-keyshortcuts','4');
  });
}

test.describe('on a phone',()=>{
  test.use({viewport:{width:375,height:667},hasTouch:true,isMobile:true});
  test('the six HUD buttons share one row at phone width, even with a four-digit wallet',async({page})=>{
    await seed(page,{wallet:1000});await start(page);
    await expect(page.locator('#wallet-count')).toHaveText('1000');
    await expect(page.locator('body')).toHaveClass(/\btouch\b/);
    await checkRow(page);
  });
});

test('closing settings while a key waits for a press ends the wait, and the town gets its keys back',async({page})=>{
  await seed(page);await start(page);
  await page.keyboard.press('5');
  await page.locator('[data-bind="forward"]').click();
  await expect(page.locator('[data-bind="forward"]')).toHaveText('请按新键…');
  await page.locator('.close-button').click();
  await expect(page.locator('#panel')).toBeHidden();
  await page.evaluate(()=>window.__qinghe.town.warp(0,9,180));
  const z=()=>page.evaluate(()=>window.__qinghe.town.player.entity.getPosition().z);
  const before=await z();
  await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');
  expect(Math.abs(await z()-before)).toBeGreaterThan(.5);
  expect(await page.evaluate(()=>window.__qinghe.profile.settings.keys)).toBeUndefined();
});

test('talk can move to Q, everything shown follows, and 恢复默认 brings E back',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page);await start(page);
  await page.keyboard.press('5');
  await expect(page.locator('#panel-title')).toHaveText('按你的节奏');
  const talk=page.locator('[data-bind="interact"]');
  await expect(talk).toHaveText('E');

  // Esc while waiting cancels the capture, not the panel.
  await talk.click();
  await expect(talk).toHaveText('请按新键…');
  await page.keyboard.press('Escape');
  await expect(page.locator('#panel')).toBeVisible();
  await expect(talk).toHaveText('E');

  await talk.click();
  await page.keyboard.press('q');
  await expect(talk).toHaveText('Q');
  await expect(talk).toHaveAttribute('aria-label',/交谈 · 进门.*Q/);
  // A key another action already has swaps the two.
  await page.locator('[data-bind="collect"]').click();
  await page.keyboard.press('q');
  await expect(page.locator('.key-note')).toContainText('和「交谈 · 进门」互换了。');
  await expect(talk).toHaveText('F');
  await page.locator('[data-bind="collect"]').click();
  await page.keyboard.press('f');
  await expect(talk).toHaveText('Q');
  // A reserved key is refused; Tab cancels and moves focus on as usual.
  const view=page.locator('[data-bind="view"]');
  await view.click();
  await page.keyboard.press('Meta');
  await expect(page.locator('.key-note')).toContainText('这个键不能用。');
  await expect(view).toHaveText('V');
  await view.click();
  await page.keyboard.press('Tab');
  await expect(view).toHaveText('V');
  await expect(page.locator('[data-bind="labels"]')).toBeFocused();
  await expect(page.locator('#panel')).toBeVisible();
  await page.locator('.close-button').click();
  await expect(page.locator('#panel')).toBeHidden();

  await expect(page.locator('#controls kbd[data-key="interact"]')).toHaveText('Q');
  await page.evaluate(()=>window.__qinghe.town.warp(-5.6,-5.3,0));
  await expect(page.locator('#interact')).toBeVisible();
  await expect(page.locator('#interact-button kbd')).toHaveText('Q');
  await page.keyboard.press('e');
  await page.waitForTimeout(200);
  await expect(page.locator('#panel')).toBeHidden();
  await page.keyboard.press('q');
  await pastGreeting(page);
  await expect(page.locator('#panel')).toBeVisible();

  await page.reload();
  await start(page);
  expect(await page.evaluate(()=>window.__qinghe.profile.settings.keys)).toEqual({interact:'KeyQ'});
  await expect(page.locator('#controls kbd[data-key="interact"]')).toHaveText('Q');

  await page.keyboard.press('5');
  await page.getByRole('button',{name:/恢复默认/}).click();
  await expect(page.locator('[data-bind="interact"]')).toHaveText('E');
  expect(await page.evaluate(()=>window.__qinghe.profile.settings.keys)).toBeUndefined();
  await expect(page.locator('#controls kbd[data-key="interact"]')).toHaveText('E');
  expect(errors).toEqual([]);
});
