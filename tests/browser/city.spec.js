import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const SAVE_KEY='little-mandarin-town.v1';
const HSK=JSON.parse(readFileSync('public/hsk/words.json','utf8')).words;

async function hold(page,key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);}
async function warp(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(120);
}
const at=async(page,axis)=>Number(await page.locator('#map-player').getAttribute(axis));
const height=async page=>Number(await page.locator('#map-player').getAttribute('data-y'));
const plate=async page=>await page.locator('#nameplate').isVisible()
  ? (await page.locator('#nameplate').innerText()).replace(/\n/g,' ') : null;

/** Enough correct HSK answers at `level` to satisfy a district gate. */
function learned(level,count){
  const words={};
  for(const word of HSK.filter(w=>w.level===level).slice(0,count))
    words[word.id]={recognition:{stage:1,due:Date.now()+9e6,last:Date.now(),reviews:1}};
  return words;
}

async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:[],phrases:[],saved:[],home:[],discovered:[],
    settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人',...profile,
  })]);
}
async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(300);
  await page.mouse.click(700,500);          // take the pointer so the world has focus
}

test('looking at something names it in Chinese, and F remembers it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  await warp(page,0,7,0);                    // facing the fountain
  await expect.poll(()=>plate(page),{timeout:6000}).toContain('喷泉');
  // Chinese first: the reading and gloss stay hidden until you ask for them.
  expect(await plate(page)).not.toContain('pēn quán');

  await page.keyboard.press('f');
  await expect.poll(()=>plate(page),{timeout:4000}).toContain('pēn quán');
  expect(await plate(page)).toContain('已记住');
  await expect(page.locator('#toast')).toContainText('记住了');

  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY);
  expect(saved.discovered).toEqual(['fountain']);
  expect(saved.saved.map(w=>w.zh)).toContain('喷泉');

  // Different things have different names.
  await warp(page,0,7,180);
  await expect.poll(()=>plate(page),{timeout:6000}).not.toContain('喷泉');
  expect(errors).toEqual([]);
});

test('objects have hitboxes, and you can jump',async({page})=>{
  await seed(page,{});
  await start(page);

  // The fountain stops you rather than letting you walk through it.
  await warp(page,0,9,0);
  await hold(page,'w',1800);
  const stopped=await at(page,'cy');
  expect(stopped).toBeGreaterThan(4);        // fountain edge sits near z = 4.5
  expect(stopped).toBeLessThan(6);

  // A bench is low enough to stand on once you jump.
  expect(await height(page)).toBe(0);
  await page.keyboard.press('Space');
  await expect.poll(()=>height(page),{timeout:2000}).toBeGreaterThan(.3);
  await expect.poll(()=>height(page),{timeout:4000}).toBe(0);
});

test('a district stays shut until enough words are learned, and says what is missing',async({page})=>{
  await seed(page,{});
  await start(page);
  await page.waitForTimeout(1500);           // the word list drives the gates
  await warp(page,16,0,-90);                 // in the avenue, facing the gate
  await hold(page,'w',2000);
  expect(await at(page,'cx')).toBeLessThan(20);
  await expect(page.locator('.location b')).toHaveText('青禾广场');
  await expect(page.locator('#interact span')).toHaveText('看看告示');
  await page.keyboard.press('e');
  await expect(page.locator('.gate-note')).toContainText('还需要认识');
  await expect(page.locator('.gate-note')).toContainText('HSK 1');
});

test('learning enough opens the district, and its shop sells furniture at a fixed price',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:120,words:learned(1,26)});
  await start(page);
  await page.waitForTimeout(1800);
  await warp(page,16,0,-90);
  await hold(page,'w',2600);
  expect(await at(page,'cx')).toBeGreaterThan(24);
  await expect(page.locator('.location b')).toHaveText('商业街');

  await warp(page,39,2.5,180);               // outside the lifestyle store
  await hold(page,'w',900);
  await expect(page.locator('#interact span')).toHaveText('进生活馆');
  await page.keyboard.press('e');
  await expect(page.locator('.location b')).toHaveText('生活馆');
  await hold(page,'w',1100);
  await page.keyboard.press('e');

  await expect(page.locator('[data-shop-item="wooden-bed"]')).toBeVisible();
  await expect(page.locator('[data-shop-item="travel-hat"]')).toHaveCount(0);   // that is Chen's stall
  await page.locator('[data-shop-item="wooden-bed"]').click();
  await expect(page.locator('.negotiation')).toHaveCount(0);                    // fixed price
  await expect(page.locator('.fixed-price')).toBeVisible();
  await page.getByRole('button',{name:/马上结账/}).click();
  await page.getByRole('button',{name:'确认购买',exact:true}).click();
  await expect(page.locator('#wallet-count')).toHaveText('80');
  expect(errors).toEqual([]);
});

test('a bed you own can be placed at home, and a bad spot says so instead of cancelling',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{inventory:{'wooden-bed':1,bookshelf:1},completed:['home:tutorial','home:starter']});
  await start(page);
  await warp(page,18,19,0);
  await hold(page,'w',900);
  await page.keyboard.press('e');
  await expect(page.locator('.location b')).toHaveText('我的家');
  await hold(page,'w',900);
  await page.keyboard.press('e');

  await page.locator('[data-place="wooden-bed"]').click();
  await expect(page.locator('#placing')).toBeVisible();
  await expect(page.locator('#placing')).toContainText('木床');
  await expect(page.locator('#placing')).toContainText('放得下');
  await page.mouse.click(700,520);
  await page.mouse.click(700,520);
  await expect(page.locator('#toast')).toContainText('放好了');
  expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).home,SAVE_KEY)).map(r=>r.item)).toEqual(['wooden-bed']);

  // Putting the bookshelf on top of the bed is refused, and the piece stays in hand.
  await page.keyboard.press('e');
  await page.locator('[data-place="bookshelf"]').click();
  await expect(page.locator('#placing')).toContainText('书架');
  await expect(page.locator('#placing.blocked')).toBeVisible();
  await page.mouse.click(700,520);
  await page.mouse.click(700,520);
  await expect(page.locator('#toast')).toContainText('放不下');
  await expect(page.locator('#placing')).toBeVisible();          // still carrying it
  expect((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).home,SAVE_KEY)).length).toBe(1);
  expect(errors).toEqual([]);
});

test('the review drill plays the word so you hear it before answering',async({page})=>{
  const clips=[];page.on('request',r=>{if(r.url().includes('/audio/clips/'))clips.push(r.url());});
  await seed(page,{});
  await start(page);
  await warp(page,0,-6.2,0);
  await hold(page,'w',900);
  await page.keyboard.press('e');            // into the word hall
  await hold(page,'w',1100);
  await page.keyboard.press('e');            // the lectern
  await expect(page.locator('.syllabus-note')).toBeVisible({timeout:20000});
  await page.getByRole('button',{name:/复习这一级/}).click();
  await expect(page.locator('.drill-zh')).toBeVisible();
  await expect(page.locator('#drill-play')).toBeVisible();
  // The word is spoken as the card appears, without being asked.
  await expect.poll(()=>clips.filter(u=>u.includes('/hsk-')).length,{timeout:8000}).toBeGreaterThan(0);
});
