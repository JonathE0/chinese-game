import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';
const later=Date.now()+1e10;
// Three words already known and resting, so the review holds only the word named here.
const known=[['bank-a','杯子','bēizi','cup'],['bank-b','桌子','zhuōzi','table'],['bank-c','椅子','yǐzi','chair']];

test('naming the kitchen sink records where it was met, and 去找找 pins that spot on the map',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},completed:['home:tutorial','home:starter'],phrases:[],home:[],discovered:[],
    saved:known.map(([id,zh,pinyin,en])=>({id,zh,pinyin,en})),
    words:Object.fromEntries(known.map(([id])=>[id,{recognition:{stage:3,due:later,last:0,reviews:1}}])),
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.mouse.click(700,500);
  await page.evaluate(()=>window.__qinghe.town.enterRoom('kitchen'));
  await page.waitForTimeout(200);

  // Stand in front of the sink (1.55 m right of the room's middle, on the back counter) and look at it.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(t.rooms.get('kitchen').offsetX+1.55,-1.5,0);t.pitch=-25;});
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.id)).toBe('sink');
  await page.keyboard.press('f');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.profile.learning?.sources?.['水池']?.place)).toBe('kitchen');

  // Review the word bank: the sink is the only card due.
  await page.evaluate(async()=>{const {openBank}=await import('/src/ui/bank.js');openBank(window.__qinghe);});
  await page.locator('#bank-review').click();
  await page.locator('.drill-choice').first().click();
  const seen=page.locator('.seen-at');
  await expect(seen).toContainText(/在「[^」]*厨房」见过/);
  await seen.getByRole('button',{name:'去找找'}).click();
  await expect(page.locator('#panel')).toBeHidden();
  const route=await page.evaluate(()=>window.__qinghe.ui.route);
  expect(route).toMatchObject({key:'kitchen',district:'garden',x:16,z:53.7});
  // Back outside, the minimap draws the pin on the house door.
  await page.evaluate(()=>window.__qinghe.town.leaveRoom?.());
  await expect(page.locator('#map-route circle').first()).toBeAttached();
  expect(errors).toEqual([]);
});

test('易混词 drills a met group, and a wrong pick counts as a miss',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],home:[],discovered:[],
    saved:[{id:'bank-t',zh:'土',pinyin:'tǔ',en:'earth'}],
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(async()=>{const {openBank}=await import('/src/ui/bank.js');openBank(window.__qinghe);});
  await page.locator('#bank-confusables').click();
  // Only 土 / 士 has been met, so the deck is that one look-alike group.
  await expect(page.locator('.drill-choice')).toHaveCount(2);
  await expect(page.locator('.drill-prompt')).toContainText('哪个字是这个意思？');
  const meaning=await page.locator('.drill-prompt .drill-zh').innerText();
  await page.locator('.drill-choice',{hasText:meaning==='earth'?'士':'土'}).click();
  await expect(page.locator('#drill-feedback')).toContainText('再看一眼。');
  const misses=await page.evaluate(()=>window.__qinghe.profile.learning.misses);
  expect(misses).toEqual(meaning==='earth'?{'土':1}:{'士':1});
  expect(errors).toEqual([]);
});

test('易混词 homophones (在/再) show the meaning and count as recognition, not listening',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],home:[],discovered:[],
    saved:[{id:'bank-z',zh:'在',pinyin:'zài',en:'at'}],
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(async()=>{const {openBank}=await import('/src/ui/bank.js');openBank(window.__qinghe);});
  await page.locator('#bank-confusables').click();
  await expect(page.locator('.drill-prompt')).toContainText('听一听，是哪个字？');
  await expect(page.locator('.drill-prompt .drill-zh')).toHaveText(/^(at|again)$/);
  await page.locator('.drill-choice').first().click();
  const skills=await page.evaluate(()=>Object.values(window.__qinghe.profile.words).flatMap(Object.keys));
  expect(skills).toEqual(['recognition']);
  expect(errors).toEqual([]);
});
