import {test,expect} from '@playwright/test';

// Pinyin that fades for words you know, and tone colours (2026-09-24-festivals-and-pinyin.md, Task P-pinyin).
const SAVE_KEY='little-mandarin-town.v1';

async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:['fountain'],
    settings:{pinyin:'known',toneColors:false,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.mouse.click(700,500);
}
// Look away and back at the fountain, so the nameplate is drawn again.
const lookAgain=page=>page.evaluate(async()=>{
  const t=window.__qinghe.town;t.warp(0,7,0);t.pitch=60;
  await new Promise(done=>setTimeout(done,300));t.pitch=-4;
});

test('a learned word stops showing pinyin on its nameplate, and tone colours mark each syllable',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await lookAgain(page);
  const plate=page.locator('#nameplate');
  await expect.poll(()=>plate.innerText(),{timeout:6000}).toContain('喷泉');
  await expect(plate.locator('.np-pinyin')).toHaveText('pēn quán');

  // Answer it right once, unaided, as review does: now it is learned.
  await page.evaluate(async()=>{
    const {reviewWord}=await import('/src/core/review.js');const {wordId}=await import('/src/core/bank.js');
    reviewWord(window.__qinghe.profile,wordId('喷泉'),'recognition',{correct:true,hinted:false,zh:'喷泉'});
  });
  await lookAgain(page);
  await expect.poll(()=>plate.innerText(),{timeout:6000}).toContain('喷泉');
  await expect(plate.locator('.np-pinyin')).toHaveCount(0);

  // Always show, with tone colours on: each syllable carries its tone's class.
  await page.keyboard.press('5');   // the settings shortcut (the canvas holds the pointer)
  await page.locator('#setting-pinyin').selectOption('always');
  await page.locator('#setting-tones').check();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>window.__qinghe.profile.settings)).toMatchObject({pinyin:'always',toneColors:true});
  await lookAgain(page);
  await expect(plate.locator('.np-pinyin .tone-1')).toHaveText('pēn',{timeout:6000});
  await expect(plate.locator('.np-pinyin .tone-2')).toHaveText('quán');
  expect(errors).toEqual([]);
});
