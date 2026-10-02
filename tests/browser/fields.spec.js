import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

/**
 * 青禾田园, the countryside past the park's town gate (src/world/fields.js, src/ui/fields.js,
 * docs/superpowers/specs/2026-10-01-fields-design.md): walking out of the gate to the pier and the
 * plot, 王爷爷's fishing with its mini-game, 刘奶奶's basket, selling the catch, the minimap's way
 * there and the metro unlock counting both. SHOTS=<folder> saves screenshots; PERF=1 logs what the
 * countryside costs to draw on 高, 中 and 低.
 */
const SAVE_KEY='little-mandarin-town.v1',SHOTS=process.env.SHOTS;
if(SHOTS)mkdirSync(SHOTS,{recursive:true});
const shot=async(page,name)=>{if(SHOTS)await page.screenshot({path:`${SHOTS}/${name}.png`});};
const HUD='.topbar,.quest-card,.mini-map,.location,.controls,#crosshair,#look-hint,#tutorial-card,#interact,#nameplate,#world-labels,#ambient-bubble';

async function start(page,{quality,completed=[],inventory={},hud=true}={}){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:7,wallet:20,inventory,equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter',...completed],phrases:[],saved:[],home:[],discovered:[],
    clock:11,dayIndex:0,vendors:{},tutorial:{done:true},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0,...(quality?{quality}:{})},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行',exact:true}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town&&!!window.__qinghe.gateStates);
  const welcome=page.locator('#roots-welcome-close');if(await welcome.isVisible())await welcome.click();
  if(!hud)await page.addStyleTag({content:`${HUD}{display:none!important}`});
}
const act=(page,id)=>page.evaluate(id=>window.__qinghe.town.onInteract(id),id);
const where=page=>page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return {x:p.x,y:p.y,z:p.z,district:t.districtAt(p.x,p.z).id,nearest:t.nearest?.id??null};});
/** Face a heading and hold W until standing near (x, z), or give up after `limit` seconds. */
async function walkTo(page,x,z,limit=20){
  await page.evaluate(([x,z])=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();t.yaw=Math.atan2(-(x-p.x),-(z-p.z))*180/Math.PI;t.pitch=-6;},[x,z]);
  await page.keyboard.down('KeyW');
  try{await page.waitForFunction(([x,z])=>{const p=window.__qinghe.town.player.entity.getPosition();return Math.hypot(p.x-x,p.z-z)<.6;},[x,z],{timeout:limit*1000});}
  catch(error){throw new Error(`stuck short of ${x}, ${z}: ${JSON.stringify(await where(page))}`);}
  finally{await page.keyboard.up('KeyW');}
  await page.waitForTimeout(300);
}
/** Type a reply in the open conversation and go on to the next line. */
async function reply(page,text){
  await page.locator('#answer').fill(text);
  await page.locator('#answer-form button[type=submit]').click();
  await page.locator('#next-line').click();
}
/** Wait in the page for the float to dip, then reel in at once: a key (Space, Enter) or a press on the screen (mouse, touch). */
const reelOnBite=(page,how)=>page.evaluate(how=>new Promise(done=>{
  const check=()=>{
    const el=document.querySelector('.fishing.bite');
    if(!el)return requestAnimationFrame(check);
    if(how==='Space'||how==='Enter')dispatchEvent(new KeyboardEvent('keydown',{code:how==='Space'?'Space':'Enter',key:how==='Space'?' ':'Enter',bubbles:true}));
    else el.dispatchEvent(new PointerEvent('pointerdown',{pointerType:how,bubbles:true,cancelable:true}));
    done();
  };
  check();
}),how);
const frames=(page,n=20)=>page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r));},n);

test('walk out of the town gate down the road to the pier, then over to the plot',async({page})=>{
  test.setTimeout(150000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,{hud:!SHOTS});
  if(SHOTS)await page.addStyleTag({content:'#toast{display:none!important}'});
  expect((await where(page)).district).toBe('garden');
  // Through the gate and down the road: the countryside starts past the park's south wall.
  await walkTo(page,.8,70);
  let at=await where(page);
  expect(at.district).toBe('fields');
  await expect(page.locator('.location b')).toHaveText('青禾田园');
  await page.evaluate(()=>{const t=window.__qinghe.town;t.yaw=180;t.pitch=-3;});
  await frames(page);await shot(page,'1-road-out-of-the-gate');
  // On down the road and out along the pier: up onto its deck, and no further than its end.
  await walkTo(page,.3,103);
  at=await where(page);
  expect(at.y).toBeGreaterThan(.3);
  await walkTo(page,1.2,106);
  await page.keyboard.down('KeyW');await page.waitForTimeout(1500);await page.keyboard.up('KeyW');
  at=await where(page);
  expect(at.z).toBeLessThan(107);
  expect(at.nearest).toBe('fish');
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(.2,100.3,180,.38);t.pitch=-7;});
  await frames(page);await shot(page,'2-river-and-pier');
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(1.2,106.2,180,.38);});
  // The river is no place to walk: off the side of the pier there is nothing to stand on.
  const wet=await page.evaluate(()=>{const t=window.__qinghe.town;return [t.canMove(4,103),t.canMove(-4,106),t.canMove(0,108),t.canMove(.5,102)];});
  expect(wet).toEqual([false,false,false,true]);
  // Back up the road and across to 刘奶奶 at her plot.
  await walkTo(page,.3,105);
  await walkTo(page,.3,99);
  await walkTo(page,.8,84);
  await walkTo(page,2.6,84);
  at=await where(page);
  expect(at.nearest).toBe('liu');
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(1.0,89.5,-50);t.pitch=-9;});
  await frames(page);await shot(page,'4-plot-with-grandma-liu');
  // The paddies from the bund between them, with the scarecrow.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(-13,87,-120);t.pitch=-12;});
  await frames(page);await shot(page,'3-paddies');
  // Looking back at the town gate from the road.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(.5,90,0);t.pitch=4;});
  await frames(page);await shot(page,'5-looking-back-at-town');
  expect(errors).toEqual([]);
});

test('fishing with 王爷爷: his rod, too early, a bite and a catch, then showing it to him',async({page})=>{
  test.setTimeout(150000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,{hud:!SHOTS});
  await page.evaluate(()=>window.__qinghe.town.warp(1.2,106.1,180,.38));
  // No rod yet: 王爷爷 first.
  await act(page,'fish');
  await expect(page.locator('#toast')).toContainText('Grandpa Wang');
  await expect(page.locator('.fishing')).toHaveCount(0);
  await act(page,'wang');
  await expect(page.locator('#panel-body')).toContainText('年轻人，你也喜欢钓鱼吗？');
  await expect(page.locator('#panel-body')).toContainText('说你想学钓鱼。');
  await expect(page.locator('.dialogue-top')).toContainText('王爷爷');
  await reply(page,'我想学钓鱼');
  await expect(page.locator('#panel-body')).toContainText('好啊！这是鱼竿。把鱼钩放到水里，等鱼上钩。');
  await reply(page,'谢谢王爷爷');
  await expect(page.locator('.completion')).toBeVisible();
  await page.locator('#back-town').click();
  // Too early: reeling in before the float dips loses the fish.
  await act(page,'fish');
  await expect(page.locator('.fishing')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('.fishing')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('鱼跑了。');
  // Too slow: the fish gets away once the window has passed.
  await act(page,'fish');
  await expect(page.locator('.fishing.bite')).toBeVisible({timeout:10000});
  await expect(page.locator('.fishing-state')).toContainText('鱼上钩了！');
  if(SHOTS)await shot(page,'6-a-bite');
  await expect(page.locator('.fishing')).toHaveCount(0,{timeout:4000});
  await expect(page.locator('#toast')).toContainText('鱼跑了。');
  let p=await page.evaluate(()=>({carp:window.__qinghe.profile.inventory.carp??0,caught:window.__qinghe.profile.completed.includes('fish:caught')}));
  expect(p).toEqual({carp:0,caught:false});
  // In time, with Space: the first fish is always a carp. The page reels in the frame the float
  // dips, as a player watching it would; from the test runner the window could pass in transit.
  await act(page,'fish');
  await reelOnBite(page,'Space');
  await expect(page.locator('#toast')).toContainText('钓到了！ 鲤鱼');
  await shot(page,'7-a-catch');
  p=await page.evaluate(()=>({carp:window.__qinghe.profile.inventory.carp??0,caught:window.__qinghe.profile.completed.includes('fish:caught')}));
  expect(p).toEqual({carp:1,caught:true});
  // A click lands one too, and so does a tap; after the first, any of the three fish.
  for(const how of ['Enter','mouse','touch']){
    await act(page,'fish');
    await reelOnBite(page,how);
    await expect(page.locator('#toast')).toContainText('钓到了！');
  }
  const fish=await page.evaluate(()=>['carp','crucian','grass-carp'].reduce((n,id)=>n+(window.__qinghe.profile.inventory[id]??0),0));
  expect(fish).toBe(4);
  // Showing the first fish to 王爷爷 finishes the mission.
  await act(page,'wang');
  await expect(page.locator('#panel-body')).toContainText('钓到了吗？给我看看。');
  await reply(page,'我钓到了一条鱼');
  await expect(page.locator('#panel-body')).toContainText('不错！这是一条鲤鱼。今天晚上可以做红烧鱼。');
  await reply(page,'谢谢');
  await page.locator('#back-town').click();
  expect(await page.evaluate(()=>window.__qinghe.profile.completed.includes('fish:first'))).toBe(true);
  await expect(page.locator('#quest-list .quest.done')).toContainText(['跟王爷爷学钓鱼']);
  expect(errors).toEqual([]);
});

test('刘奶奶 and her basket: what she wants, a wrong basket, putting one back, and her vegetables',async({page})=>{
  test.setTimeout(150000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await page.evaluate(()=>window.__qinghe.town.warp(2.4,84.4,-90));
  const wallet=await page.evaluate(()=>window.__qinghe.profile.wallet);
  await act(page,'liu');
  await expect(page.locator('#panel-body')).toContainText('你好！你能帮我摘菜吗？');
  await expect(page.locator('.dialogue-top')).toContainText('刘奶奶');
  await reply(page,'没问题');
  await expect(page.locator('#panel-body')).toContainText('请帮我摘三个西红柿和两根黄瓜。');
  await expect(page.locator('#panel-body')).toContainText('再说一遍她要什么。');
  await reply(page,'三个西红柿和两根黄瓜');
  await page.locator('#back-town').click();
  await expect(page.locator('#fields-basket')).toBeVisible();
  // An empty basket is not what she asked for.
  await act(page,'liu');
  await expect(page.locator('#panel-body')).toContainText('不对哦，我要三个西红柿和两根黄瓜。');
  await page.locator('#line-continue').click();
  // Picking with E from the furrow, looking at the row.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(8,81,0);t.pitch=-35;});
  await expect.poll(()=>where(page).then(w=>w.nearest)).toBe('veg:tomato');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#fields-basket')).toContainText('西红柿');
  await expect(page.locator('#fields-basket')).toContainText('×1');
  for(const id of ['tomato','tomato','cucumber','cucumber','carrot'])await act(page,'veg:'+id);
  await expect(page.locator('#fields-basket')).toContainText('胡萝卜');
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(4.8,85.2,-60);t.pitch=-12;});
  if(SHOTS){await page.addStyleTag({content:'#world-labels,#interact,#nameplate,#crosshair{display:none!important}'});await frames(page);await shot(page,'8-basket');}
  await act(page,'liu');
  await expect(page.locator('#panel-body')).toContainText('不对哦，我要三个西红柿和两根黄瓜。');
  await page.locator('#line-continue').click();
  await page.locator('#fields-basket [data-back="carrot"]').click();
  await expect(page.locator('#fields-basket')).not.toContainText('胡萝卜');
  await act(page,'liu');
  await expect(page.locator('#panel-body')).toContainText('摘好了吗？');
  await reply(page,'摘好了');
  await expect(page.locator('#panel-body')).toContainText('太好了！这些菜送给你，回家做饭吧。');
  await reply(page,'谢谢刘奶奶');
  await page.locator('#back-town').click();
  await expect(page.locator('#toast')).toContainText('番茄 ×3');
  await expect(page.locator('#fields-basket')).toBeHidden();
  const p=await page.evaluate(()=>{const p=window.__qinghe.profile;return {tomato:p.inventory.tomato,vegetable:p.inventory.vegetable,done:p.completed.includes('veg:first'),wallet:p.wallet};});
  expect(p.tomato).toBe(3);expect(p.vegetable).toBe(2);expect(p.done).toBe(true);
  expect(p.wallet).toBeGreaterThan(wallet+10);   // her coins, and each conversation's
  await expect(page.locator('#quest-list .quest.done')).toContainText(['帮刘奶奶摘菜']);
  expect(errors).toEqual([]);
});

test('the metro unlock counts both errands, the minimap leads there, and the supermarket buys fish',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,{inventory:{carp:2}});
  const steps=()=>page.evaluate(async()=>{const {townSteps}=await import('/src/core/unlock.js');const c=window.__qinghe;
    return Object.fromEntries(townSteps(c.profile,c.gateStates).filter(s=>['fishing','vegetables'].includes(s.id)).map(s=>[s.id,s.done]));});
  expect(await steps()).toEqual({fishing:false,vegetables:false});
  await page.evaluate(()=>{const c=window.__qinghe;c.profile.completed.push('fish:first','veg:first');c.save();});
  expect(await steps()).toEqual({fishing:true,vegetables:true});
  // The way to the pier: from the park through its town gate, from the square through the park first.
  await page.evaluate(()=>{const c=window.__qinghe;c.profile.completed=c.profile.completed.filter(f=>f!=='fish:first');c.save();c.ui.followQuest('fishing');});
  await expect(page.locator('#map-caption')).toContainText('先去 青禾田园');
  await page.evaluate(()=>window.__qinghe.town.warp(0,5,0));
  await expect(page.locator('#map-caption')).toContainText('先去 莲池公园');
  await page.evaluate(()=>window.__qinghe.town.warp(0,80,180));
  await expect(page.locator('#map-caption')).toContainText('跟王爷爷学钓鱼');
  expect(await page.locator('#map-content rect').count()).toBeGreaterThan(10);
  // 青禾超市 buys the catch at its price.
  await page.evaluate(async()=>{const {openShop}=await import('/src/ui/shop.js');openShop(window.__qinghe,'supermarket');});
  await expect(page.locator('.shop-catch')).toContainText('鲤鱼');
  const before=await page.evaluate(()=>window.__qinghe.profile.wallet);
  await page.locator('[data-sell-catch="carp"]').click();
  await page.locator('[data-sell-catch="carp"]').click();
  await expect(page.locator('.shop-catch')).toHaveCount(0);
  const after=await page.evaluate(()=>({wallet:window.__qinghe.profile.wallet,carp:window.__qinghe.profile.inventory.carp??0}));
  expect(after).toEqual({wallet:before+8,carp:0});
  expect(errors).toEqual([]);
});

/** What the countryside costs to draw: draw calls and the median frame at the pier, at the plot and
 *  looking back at town, on each 画质 level, and the same look back with the countryside switched off. */
test('what the countryside costs to draw on 高, 中 and 低',async({browser})=>{
  test.skip(!process.env.PERF,'PERF=1 to measure');
  test.setTimeout(400000);
  const rows=[];
  for(const quality of ['high','medium','low']){
    const page=await browser.newPage();
    await start(page,{quality,hud:false});
    const views={pier:[.3,101,170,-5,.38],plot:[1,89.5,-50,-9,0],'back-at-town':[.5,90,0,3,0],park:[.8,63.4,-10,3,0]};
    const measure=()=>page.evaluate(async()=>{
      const t=window.__qinghe.town;for(let i=0;i<30;i++)await new Promise(r=>requestAnimationFrame(r));
      const times=[];let last=performance.now();
      for(let i=0;i<90;i++){await new Promise(r=>requestAnimationFrame(r));const now=performance.now();times.push(now-last);last=now;}
      times.sort((a,b)=>a-b);
      return {calls:t.app.stats.drawCalls.total,tris:t.app.stats.frame.triangles,ms:+times[45].toFixed(1)};
    });
    for(const [name,[x,z,yaw,pitch,y]] of Object.entries(views)){
      await page.evaluate(([x,z,yaw,pitch,y])=>{const t=window.__qinghe.town;t.warp(x,z,yaw,y);t.pitch=pitch;},[x,z,yaw,pitch,y]);
      rows.push({quality,view:name,...await measure()});
    }
    await page.evaluate(()=>{const t=window.__qinghe.town;t.fields.root.enabled=false;t.warp(.5,90,0);t.pitch=3;});
    rows.push({quality,view:'back-at-town, fields off',...await measure()});
    await page.close();
  }
  console.log(JSON.stringify(rows));
});
