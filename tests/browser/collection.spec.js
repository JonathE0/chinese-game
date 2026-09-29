import {test,expect} from '@playwright/test';

// The collection book 图鉴 (2026-09-24-learning-features.md, Task C-collection).
const SAVE_KEY='little-mandarin-town.v1';

test('图鉴 counts a named fountain in the square and lists the 氵 hunt',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.mouse.click(700,500);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(0,7,0);t.pitch=-4;});   // facing the fountain
  await expect.poll(()=>page.locator('#nameplate').innerText(),{timeout:6000}).toContain('喷泉');
  await page.keyboard.press('f');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.profile.discovered),{timeout:4000}).toContain('fountain');

  await page.keyboard.press('1');
  await page.locator('#journal-collection').click();
  const square=page.locator('[data-tab="square"]');
  await expect(square).toContainText('青禾广场');
  const [found]=(await square.locator('small').innerText()).split('/').map(Number);
  expect(found).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#collection-body')).toContainText('喷泉');

  await page.locator('[data-tab="hunts"]').click();
  await expect(page.locator('#collection-body')).toContainText('氵');
  expect(errors).toEqual([]);
});

test('a finished hunt pays its coins once from the claim button',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // 石 hunt: 石狮子, 石头, 碗 and the harbour's 码头 are its only targets in the world.
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:['lion','stone','bowl','pier'],
    settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.keyboard.press('1');
  await page.locator('#journal-collection').click();
  await page.locator('[data-tab="hunts"]').click();
  const wallet=()=>page.evaluate(()=>window.__qinghe.profile.wallet);
  const before=await wallet();
  await page.locator('[data-hunt="stone"]').click();
  expect(await wallet()).toBe(before+5);
  await expect(page.locator('[data-hunt="stone"]')).toHaveCount(0);
  await expect(page.locator('#collection-body')).toContainText('已领');
  // Reopening the book does not offer it again.
  await page.locator('[data-tab="square"]').click();
  await page.locator('[data-tab="hunts"]').click();
  await expect(page.locator('[data-hunt="stone"]')).toHaveCount(0);
  expect(await wallet()).toBe(before+5);
  expect(errors).toEqual([]);
});
