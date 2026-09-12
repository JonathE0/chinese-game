import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';

async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:60,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},metro:{rides:1,trips:0},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...profile,
  })]);
}
async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(400);
}
async function warp(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(240);
}
const profileOf=page=>page.evaluate(()=>window.__qinghe.profile);
const cityX=page=>page.evaluate(()=>window.__qinghe.town.rooms.get('city').offsetX);
const playerPos=page=>page.evaluate(()=>{const p=window.__qinghe.town.player.entity.getPosition();return {x:p.x,z:p.z};});

/** Types a reply into the open dialogue, submits it, then clicks past the feedback screen. */
async function answer(page,text){
  await page.getByRole('textbox',{name:'你的回答'}).fill(text);
  await page.getByRole('button',{name:'提交回答'}).click();
  await page.getByRole('button',{name:'继续',exact:true}).click();
}
/** Tells the driver where to go and sits through the farewell line, up to and including the
 *  completion screen — the same steps whichever way the ride then plays out. */
async function orderRide(page,phrase,{closeWith='button'}={}){
  await page.keyboard.press('e');
  await expect(page.locator('.panel-dialogue')).toBeVisible();
  await answer(page,phrase);
  await page.getByRole('button',{name:'完成对话',exact:true}).click();   // 好嘞，上车吧 takes no input
  // The ride follows however the completion screen is closed: its button, or Esc.
  if(closeWith==='escape'){
    await expect(page.getByRole('button',{name:'回到小镇',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
  }else await page.getByRole('button',{name:'回到小镇',exact:true}).click();
}

test('a taxi ride: both taxis offer it, the driver takes you to the tower you asked for, and the fare is charged on arrival',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // The dialogue's own one-time completion reward is pre-claimed, so the only wallet change left
  // to check is the fare itself — otherwise this test would also depend on balance.json's numbers.
  await seed(page,{wallet:60,claims:{'lesson:city-taxi':true}});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  const x=await cityX(page);

  // Both taxis on the avenue offer the same ride, per city.json's two `taxi` props.
  await warp(page,x+3.8,23.9);
  await expect(page.locator('#interact span')).toHaveText('打车 · TAXI');
  await warp(page,x+3.8,18.1);
  await expect(page.locator('#interact span')).toHaveText('打车 · TAXI');

  // Closed with Esc rather than the button: the ride must still happen.
  await orderRide(page,'我要去一号书店。',{closeWith:'escape'});
  // The fade hides the jump: two legs of about 0.4s each, plus a little render slack.
  await page.waitForTimeout(1100);

  await expect(page.locator('.panel-dialogue .dialogue-line .zh')).toHaveText('到了！车费五块。');
  const pos=await playerPos(page);
  // 一号书店 sits at local (-17.5,-16) with d:12 — dropOffAtTower sets you down a metre clear of
  // the facade, at (-10.5,-16).
  expect(Math.abs(pos.x-(x-10.5))).toBeLessThan(.3);
  expect(Math.abs(pos.z-(-16))).toBeLessThan(.3);

  const after=await profileOf(page);
  expect(after.wallet).toBe(55);
  // Telling the driver where to go is what the mission is for; the dialogue engine grants it the
  // same way any lesson's first completion does, not something this code has to track itself.
  expect(after.completed).toContain('city-taxi');

  await page.locator('#line-continue').click();
  expect(errors).toEqual([]);
});

test('too poor for the fare: the driver says so, and nobody moves or pays',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Same pre-claimed reward as above, so a low wallet stays low right up to the fare check —
  // otherwise the first-time conversation bonus would cover the ride and mask the broke path.
  await seed(page,{wallet:2,claims:{'lesson:city-taxi':true}});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  const x=await cityX(page);

  await warp(page,x+3.8,23.9);
  const before=await playerPos(page);
  // The claim that "nobody moves or pays" is best proven by the things a ride actually touches:
  // the town's own warp counter (bumped by every teleport, including the fade-hidden jump a paid
  // ride makes) and whether a `.fade-veil` — the ride's only visual tell — ever gets created.
  const warpsBefore=await page.evaluate(()=>window.__qinghe.town.warps??0);
  await page.evaluate(()=>{
    window.__fadeSeen=false;
    const observer=new MutationObserver(muts=>{
      for(const m of muts)for(const node of m.addedNodes)
        if(node.nodeType===1&&node.classList?.contains('fade-veil'))window.__fadeSeen=true;
    });
    observer.observe(document.querySelector('#app'),{childList:true});
    window.__fadeObserver=observer;
  });
  await orderRide(page,'我要去光明电影院。');
  await page.waitForTimeout(400);

  await expect(page.locator('.panel-dialogue .dialogue-line .zh')).toHaveText('车费是五块，你的钱好像不够。');
  const after=await profileOf(page);
  expect(after.wallet).toBe(2);
  const warpsAfter=await page.evaluate(()=>window.__qinghe.town.warps??0);
  expect(warpsAfter).toBe(warpsBefore);
  expect(await page.evaluate(()=>window.__fadeSeen)).toBe(false);
  const pos=await playerPos(page);
  expect(Math.abs(pos.x-before.x)).toBeLessThan(.5);
  expect(Math.abs(pos.z-before.z)).toBeLessThan(.5);

  await page.evaluate(()=>window.__fadeObserver.disconnect());
  await page.locator('#line-continue').click();
  expect(errors).toEqual([]);
});
