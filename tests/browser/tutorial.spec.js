import {test,expect} from '@playwright/test';
import {startGame} from './start.js';

/**
 * The first-run tips (docs/superpowers/plans/2026-09-30-development-wave-4.md, W4-ux item 1): after
 * 开始旅行 and the one short Roots welcome there is no slideshow. Small tips appear one at a time
 * as you play, each once, a minute apart, and keep clear of the rest of the HUD.
 */
const SAVE_KEY='little-mandarin-town.v1';
const card=page=>page.locator('#tutorial-card');
const seen=page=>page.evaluate(()=>window.__qinghe.profile.tutorial?.seen);
const showTip=(page,id)=>page.evaluate(async id=>{
  const {STEPS}=await import('/src/core/tutorial.js'),c=window.__qinghe;
  c.tutorial.show(STEPS.find(s=>s.id===id));c.tutorial.sync();
},id);

test('a fresh game gives the look tip, then walk, and nothing else at the start',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(card(page)).toBeHidden();                       // not before 开始旅行
  await page.getByRole('button',{name:'开始旅行',exact:true}).click();
  await expect(page.locator('#roots-welcome-close')).toBeVisible();
  await expect(card(page)).toBeHidden();                       // nor over the Roots welcome panel
  await page.locator('#roots-welcome-close').click();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText('按住鼠标左键拖动');         // the default mouse mode is drag
  await expect(card(page)).not.toContainText(' / 16');          // no step counter: it is not a slideshow
  expect(await seen(page)).toEqual([]);
  // The pinyin sits behind ?, the way the mission card does it.
  await expect(card(page).locator('.help-content')).toBeHidden();
  await card(page).locator('[data-help]').click();
  await expect(card(page).locator('.help-content')).toContainText('Ànzhù shǔbiāo zuǒjiàn tuōdòng');
  await card(page).locator('[data-help]').click();

  // Crossing the ±360 wrap is a small turn, not a whole circle: -350 to -10 is 20°.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.startYaw=t.yaw;t.yaw=t.startYaw+10-360;});
  await page.waitForTimeout(100);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.yaw=t.startYaw-10;});
  await page.waitForTimeout(100);
  await expect(card(page)).toContainText('按住鼠标左键拖动');
  expect(await seen(page)).toEqual([]);
  // Turn the view by script, the way the mouse would.
  await page.evaluate(()=>{window.__qinghe.town.yaw=-30;});
  await page.waitForTimeout(100);
  await page.evaluate(()=>{window.__qinghe.town.yaw=-130;});
  await expect(card(page)).toContainText('做到了！');
  await expect(card(page)).toContainText('按 W A S D 走几步。',{timeout:4000});   // walk follows at once
  expect(await seen(page)).toEqual(['look']);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).tutorial.seen,SAVE_KEY)).toEqual(['look']);

  // Any panel hides the card; closing it brings it back.
  await page.keyboard.press('Digit1');
  await expect(page.locator('#panel')).toBeVisible();
  await expect(card(page)).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeVisible();

  // The next tip waits a minute even though its moment has come; then it shows, and only once.
  await page.evaluate(()=>{window.__qinghe.tutorial.left=0;});   // walk times out
  await expect(card(page)).toBeHidden();
  expect(await seen(page)).toEqual(['look','walk']);
  await page.evaluate(()=>window.__qinghe.tutorial.trigger('look-object'));
  await page.waitForTimeout(400);
  await expect(card(page)).toBeHidden();
  await page.evaluate(()=>{window.__qinghe.tutorial.time+=61;});
  await expect(card(page)).toContainText('准星');
  await page.evaluate(()=>{window.__qinghe.tutorial.left=0;});
  await expect(card(page)).toBeHidden();
  await page.evaluate(()=>{window.__qinghe.tutorial.time+=200;});
  await page.waitForTimeout(400);
  await expect(card(page)).not.toContainText('准星');            // 'word' does not come back
  expect(errors).toEqual([]);
});

test('closing a tip is final, skipping ends the tutorial, Settings can replay it or switch tips off',async({page})=>{
  await page.goto('/');await startGame(page);
  await expect(card(page)).toBeVisible();
  await card(page).locator('[data-tutorial="close"]').click();
  await expect(card(page)).toContainText('走几步');              // closing look lets walk follow
  expect(await seen(page)).toEqual(['look']);
  await card(page).locator('[data-tutorial="close"]').click();
  await expect(card(page)).toBeHidden();
  expect(await seen(page)).toEqual(['look','walk']);

  await showTip(page,'view');
  await expect(card(page)).toContainText('第三人称');
  await card(page).getByRole('button',{name:/跳过教程/}).click();
  await expect(card(page)).toBeHidden();
  await expect(page.locator('#toast')).toContainText('教程已跳过');
  expect((await seen(page)).length).toBe(16);
  expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).tutorial.seen,SAVE_KEY)).length).toBe(16);

  await page.keyboard.press('Digit5');
  await page.getByRole('button',{name:/重新开始新手教程/}).click();
  await expect(page.locator('#panel')).toBeHidden();
  expect(await seen(page)).toEqual([]);
  await expect(card(page)).toBeVisible();

  await page.keyboard.press('Digit5');
  await page.locator('#setting-tips').uncheck();
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.profile.settings.tips)).toBe(false);
  await page.waitForTimeout(400);
  await expect(card(page)).toBeHidden();
});

test('a tip ends itself after about ten seconds, but not while you are reading it',async({page})=>{
  await page.goto('/');await startGame(page);
  await expect(card(page)).toBeVisible();
  expect(await page.evaluate(()=>window.__qinghe.tutorial.left)).toBeGreaterThan(8000);
  await card(page).locator('[data-help]').click();           // the pinyin is open: the clock stops
  const held=await page.evaluate(()=>window.__qinghe.tutorial.left);
  await page.waitForTimeout(600);
  expect(await page.evaluate(()=>window.__qinghe.tutorial.left)).toBe(held);
  await card(page).locator('[data-help]').click();
  await page.mouse.move(5,5);
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.tutorial.left)).toBeLessThan(held-400);
});

test('an existing player is not interrupted, and an old saved tutorial becomes the tips it had shown',async({page})=>{
  const save=extra=>({version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],
    phrases:[],saved:[],home:[],discovered:[],clock:14,dayIndex:0,vendors:{},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...extra});
  await page.addInitScript(([key,value])=>{localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify(save())]);
  await page.goto('/');await startGame(page);
  await page.waitForTimeout(400);
  await expect(card(page)).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.profile.tutorial)).toBeUndefined();

  const other=await page.context().newPage();
  await other.addInitScript(([key,value])=>{localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify(save({tutorial:{step:4,progress:0}}))]);
  await other.goto('/');await startGame(other);
  expect(await other.evaluate(()=>window.__qinghe.profile.tutorial)).toEqual({seen:['look','walk','view','word']});
});

test('the talk tip leads to 林阿姨, and only she finishes it',async({page})=>{
  await page.goto('/');await startGame(page);
  await showTip(page,'talk');
  await expect(card(page)).toContainText('去茶铺找林阿姨');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.ui.route)).toMatchObject({key:'tutorial',district:'square',x:-4.8,z:-9.4});
  await page.evaluate(()=>window.__qinghe.town.onInteract('chen'));
  await expect(page.locator('#panel')).toBeVisible();
  expect(await seen(page)).not.toContain('talk');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__qinghe.town.onInteract('lin'));
  expect(await seen(page)).toContain('talk');
  expect(await page.evaluate(()=>window.__qinghe.ui.route)).toBeNull();
});

test('doing something before its tip means the tip never shows',async({page})=>{
  await page.goto('/');await startGame(page);
  await page.evaluate(()=>{const c=window.__qinghe;c.profile.tutorial.seen.push('look','walk');c.tutorial.leaveStep();});
  await expect(card(page)).toBeHidden();
  await page.evaluate(()=>{const c=window.__qinghe;c.town.setView('third');c.tutorial.time+=300;});
  await page.waitForTimeout(300);
  expect(await seen(page)).toContain('view');
  await page.evaluate(()=>{window.__qinghe.tutorial.left=0;});
  await page.waitForTimeout(300);
  await expect(card(page)).toBeHidden();                      // view was due, but the player got there first
});

// Runs in the page: the card's box against every piece of HUD it must keep clear of, and whether
// each of them still gets the click at its own centre.
function clearance(){
  const box=el=>el.getBoundingClientRect();
  const card=box(document.querySelector('#tutorial-card'));
  const hud={quests:'#quest-card',wallet:'.wallet',actions:'.top-actions',brand:'.brand',minimap:'.mini-map',controls:'#controls'};
  const report={card:{left:card.left,top:card.top,right:card.right,bottom:card.bottom},overlaps:[],blocked:[]};
  for(const [name,selector] of Object.entries(hud)){
    const el=document.querySelector(selector);
    if(!el||getComputedStyle(el).display==='none')continue;
    const r=box(el);
    if(!r.width||!r.height)continue;
    if(r.left<card.right&&r.right>card.left&&r.top<card.bottom&&r.bottom>card.top)report.overlaps.push(name);
    const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
    if(hit&&document.querySelector('#tutorial-card').contains(hit))report.blocked.push(name);
  }
  return report;
}

for(const layout of [
  {name:'desktop 1280×720',viewport:{width:1280,height:720},touch:false},
  {name:'touch 375×812',viewport:{width:375,height:812},touch:true},
]){
  test(`the tip card keeps clear of the HUD at ${layout.name}`,async({browser})=>{
    const context=await browser.newContext({viewport:layout.viewport,hasTouch:layout.touch,isMobile:layout.touch});
    const page=await context.newPage();
    await page.goto('/');await startGame(page);
    await expect(card(page)).toBeVisible();
    // Check the longest tip as well as the first, with its pinyin open.
    const longest=await page.evaluate(async()=>{
      const {STEPS}=await import('/src/core/tutorial.js'),c=window.__qinghe;
      let best=STEPS[0].id,bestLength=0;
      for(const s of STEPS){c.tutorial.show(s);c.tutorial.sync();
        const h=document.querySelector('#tutorial-card').scrollHeight;if(h>bestLength){bestLength=h;best=s.id;}}
      return best;
    });
    for(const id of ['look',longest]){
      await showTip(page,id);
      await card(page).locator('[data-help]').click();
      await expect(card(page).locator('.help-content')).toBeVisible();
      const report=await page.evaluate(clearance);
      expect(report.overlaps,JSON.stringify(report)).toEqual([]);
      expect(report.blocked,JSON.stringify(report)).toEqual([]);
      await expect(card(page).getByRole('button',{name:/跳过教程/})).toBeInViewport();
      await expect(card(page).locator('[data-tutorial="close"]')).toBeInViewport();
    }
    await page.screenshot({path:`test-results/tutorial-${layout.viewport.width}.png`});
    await context.close();
  });
}
