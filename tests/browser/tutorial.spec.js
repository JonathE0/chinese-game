import {test,expect} from '@playwright/test';

/**
 * The first-run tutorial (docs/superpowers/plans/2026-09-12-tutorial-and-buy-guide.md, Task A):
 * a brand-new save is walked through the basics one card at a time, and the card keeps clear of
 * the rest of the HUD.
 */
const SAVE_KEY='little-mandarin-town.v1';

test('a fresh game starts the tutorial, a turn of the view finishes step 1, and skipping ends it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  const card=page.locator('#tutorial-card');
  await expect(card).toBeHidden();                           // not before 开始旅行
  await page.getByRole('button',{name:'开始旅行'}).click();
  await expect(card).toBeVisible();
  await expect(card).toContainText('1 / 16');
  await expect(card).toContainText('点一下画面，再移动鼠标，看看四周。');
  await expect(card).toContainText('新手教程 · TUTORIAL');
  expect(await page.evaluate(()=>window.__qinghe.profile.tutorial)).toEqual({step:0,progress:0});
  // The pinyin sits behind ?, the way the mission card does it.
  await expect(card.locator('.help-content')).toBeHidden();
  await card.locator('[data-help]').click();
  await expect(card.locator('.help-content')).toContainText('Diǎn yíxià huàmiàn');

  // Crossing the ±360 wrap is a small turn, not a whole circle: -350 to -10 is 20°.
  // You arrive facing your home, so the turns are measured from wherever the view starts.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.startYaw=t.yaw;t.yaw=t.startYaw+10-360;});
  await page.waitForTimeout(100);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.yaw=t.startYaw-10;});
  await page.waitForTimeout(100);
  await expect(card).toContainText('1 / 16');
  expect(await page.evaluate(()=>window.__qinghe.profile.tutorial.progress)).toBeLessThan(90);
  // Turn the view by script, the way the mouse would.
  await page.evaluate(()=>{window.__qinghe.town.yaw=-30;});
  await page.waitForTimeout(100);
  await page.evaluate(()=>{window.__qinghe.town.yaw=-130;});
  await expect(card).toContainText('做到了！');
  await expect(card).toContainText('2 / 16',{timeout:4000});
  await expect(card).toContainText('按 W A S D 走几步。');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).tutorial,SAVE_KEY);
  expect(saved.step).toBe(1);

  // Any panel hides the card; closing it brings the card back.
  await page.keyboard.press('Digit1');
  await expect(page.locator('#panel')).toBeVisible();
  await expect(card).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(card).toBeVisible();

  await card.getByRole('button',{name:/跳过教程/}).click();
  await expect(card).toBeHidden();
  await expect(page.locator('#toast')).toContainText('教程已跳过');
  expect(await page.evaluate(()=>window.__qinghe.profile.tutorial)).toEqual({done:true});
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).tutorial,SAVE_KEY)).toEqual({done:true});

  // Settings can start it again.
  await page.keyboard.press('Digit5');
  await page.getByRole('button',{name:/重新开始新手教程/}).click();
  await expect(page.locator('#panel')).toBeHidden();
  await expect(card).toContainText('1 / 16');
  expect(errors).toEqual([]);
});

test('an existing player is not interrupted',async({page})=>{
  await page.addInitScript(([key,value])=>{localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],
    phrases:[],saved:[],home:[],discovered:[],clock:14,dayIndex:0,vendors:{},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(300);
  await expect(page.locator('#tutorial-card')).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.profile.tutorial)).toBeUndefined();
});

test('the talk step leads to 林阿姨, and only she finishes it',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  const index=await page.evaluate(()=>{
    const c=window.__qinghe;
    c.profile.tutorial={step:8,progress:0};c.tutorial.shown=null;c.tutorial.sync();
    return c.profile.tutorial.step;
  });
  expect(index).toBe(8);
  const card=page.locator('#tutorial-card');
  await expect(card).toContainText('去茶铺找林阿姨');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.ui.route)).toMatchObject({key:'tutorial',district:'square',x:-4.8,z:-9.4});
  await page.evaluate(()=>window.__qinghe.town.onInteract('chen'));
  await expect(page.locator('#panel')).toBeVisible();
  expect(await page.evaluate(()=>window.__qinghe.profile.tutorial.step)).toBe(8);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__qinghe.town.onInteract('lin'));
  expect(await page.evaluate(()=>window.__qinghe.profile.tutorial.step)).toBe(9);
  expect(await page.evaluate(()=>window.__qinghe.ui.route)).toBeNull();
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
  test(`the tutorial card keeps clear of the HUD at ${layout.name}`,async({browser})=>{
    const context=await browser.newContext({viewport:layout.viewport,hasTouch:layout.touch,isMobile:layout.touch});
    const page=await context.newPage();
    await page.goto('/');
    await page.getByRole('button',{name:'开始旅行'}).click();
    const card=page.locator('#tutorial-card');
    await expect(card).toBeVisible();
    // Check the longest step as well as the first, with its pinyin open.
    const longest=await page.evaluate(()=>{
      const c=window.__qinghe,steps=[...Array(16).keys()];
      let best=0,bestLength=0;
      for(const i of steps){c.profile.tutorial={step:i,progress:0};c.tutorial.shown=null;c.tutorial.sync();
        const h=document.querySelector('#tutorial-card').scrollHeight;if(h>bestLength){bestLength=h;best=i;}}
      return best;
    });
    for(const step of [0,longest]){
      await page.evaluate(i=>{const c=window.__qinghe;c.profile.tutorial={step:i,progress:0};c.tutorial.shown=null;c.tutorial.sync();},step);
      await card.locator('[data-help]').click();
      await expect(card.locator('.help-content')).toBeVisible();
      const report=await page.evaluate(clearance);
      expect(report.overlaps,JSON.stringify(report)).toEqual([]);
      expect(report.blocked,JSON.stringify(report)).toEqual([]);
      // Buttons must be reachable inside the card.
      await expect(card.getByRole('button',{name:/跳过教程/})).toBeInViewport();
    }
    await page.screenshot({path:`test-results/tutorial-${layout.viewport.width}.png`});
    await context.close();
  });
}
