import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';
test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});

/** A thumb held on the lower left and pushed up: real touch events, so the game sees pointerType touch. */
async function pushStick(page,cdp,ms){
  const at=(x,y)=>[{x,y,id:1}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:at(80,650)});
  for(let y=640;y>=590;y-=10)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:at(80,y)});
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}

test('on a phone the thumbstick walks, 跳 jumps, 记住 saves, the interact button takes you home and 取消 ends placing',async({page})=>{
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],
    discovered:[],clock:14,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).tap();
  await page.waitForTimeout(300);
  await expect(page.locator('body')).toHaveClass(/\btouch\b/);
  expect(await page.evaluate(()=>!!document.pointerLockElement)).toBe(false);
  const cdp=await page.context().newCDPSession(page);
  const dot=page.locator('#map-player');

  const before={x:+await dot.getAttribute('cx'),z:+await dot.getAttribute('cy')};
  await pushStick(page,cdp,800);
  const after={x:+await dot.getAttribute('cx'),z:+await dot.getAttribute('cy')};
  expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeGreaterThan(1);

  // A jump is over in well under a second, so keep the highest point seen.
  await page.evaluate(()=>{window.__peak=0;const dot=document.querySelector('#map-player');
    const tick=()=>{window.__peak=Math.max(window.__peak,+dot.dataset.y||0);requestAnimationFrame(tick);};tick();});
  const ground=+await dot.getAttribute('data-y');
  await page.getByRole('button',{name:'跳',exact:true}).tap();
  await page.waitForTimeout(700);
  expect(await page.evaluate(()=>window.__peak)).toBeGreaterThan(ground+.3);

  // 记住 follows what is in the crosshair, even with the name labels turned off.
  await page.evaluate(()=>{window.__qinghe.ui.toggleNames();window.__qinghe.town.warp(0,7,0);});
  await expect(page.locator('#nameplate')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.id)).toBe('fountain');
  await page.getByRole('button',{name:'记住',exact:true}).tap();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.profile.discovered)).toContain('fountain');

  await page.evaluate(()=>window.__qinghe.town.warp(16,56.6,0));   // a few steps out from the front door, facing it
  await page.waitForTimeout(120);
  await pushStick(page,cdp,900);
  await expect(page.locator('#interact span')).toHaveText('回家');
  await page.locator('#interact-button').tap();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('home');
  expect(await page.evaluate(()=>!!document.pointerLockElement)).toBe(false);

  // Placing furniture: the stick still walks instead of putting the piece down, and 取消 ends it.
  expect(await page.evaluate(()=>window.__qinghe.town.beginPlacement({id:'wooden-bed',kind:'bed',color:'#b98b5f',footprint:[2.1,1.4]}))).toBe(true);
  await expect(page.getByRole('button',{name:'转',exact:true})).toBeVisible();
  const spot=()=>page.evaluate(()=>{const p=window.__qinghe.town.player.entity.getPosition();return {x:p.x,z:p.z};});
  const from=await spot();
  await pushStick(page,cdp,500);
  const to=await spot();
  expect(Math.hypot(to.x-from.x,to.z-from.z)).toBeGreaterThan(.3);
  expect(await page.evaluate(()=>!!window.__qinghe.town.ghost)).toBe(true);
  await page.getByRole('button',{name:'取消',exact:true}).tap();
  expect(await page.evaluate(()=>window.__qinghe.town.ghost)).toBeNull();
  await expect(page.getByRole('button',{name:'取消',exact:true})).toBeHidden();
});
