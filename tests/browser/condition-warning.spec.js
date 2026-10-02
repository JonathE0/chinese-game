import {test,expect} from '@playwright/test';

const start=async page=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
 return {badge:page.locator('#condition-warning'),button:page.locator('#status-button')};
};
// Set the needs and refresh the HUD the way the stats tick does.
const setStats=(page,hunger,energy)=>page.evaluate(([hunger,energy])=>{const c=window.__qinghe;c.town.setPaused(true);c.profile.stats={hunger,energy,hour:c.town.daylight.hour};c.ui.updateCondition();},[hunger,energy]);

test('Condition reminder follows low needs and names them',async({page})=>{
 const {badge,button}=await start(page);
 for(const [hunger,energy,visible,name] of [[80,85,false,'状态'],[29,85,true,'Hungry'],[80,29,true,'Needs rest'],[10,10,true,'Hungry · 累了 Needs rest'],[30,30,false,'状态']]){
  await setStats(page,hunger,energy);
  if(visible)await expect(badge).toBeVisible();else await expect(badge).toBeHidden();
  await expect(badge).toHaveAttribute('aria-hidden','true');
  await expect(button).toHaveAttribute('aria-label',new RegExp(name));
  await expect(button).toHaveAttribute('title',new RegExp(visible?name.replace(' and ','.*'):'Condition'));
 }
});

test('Eating clears hunger, sleeping clears rest, and one remaining need keeps the badge',async({page})=>{
 const {badge,button}=await start(page);
 await setStats(page,10,10);
 await page.evaluate(async()=>{const {eat}=await import('/src/core/stats.js'),c=window.__qinghe;eat(c.profile,{nutrition:60});c.ui.updateCondition();});
 // Eating also restores a little rest, but 10 + 18 is still low: badge stays, hunger is dropped from the name.
 await expect(badge).toBeVisible();
 await expect(button).toHaveAttribute('aria-label',/^状态 · Condition — 累了 Needs rest$/);
 await page.evaluate(async()=>{const {sleep}=await import('/src/core/stats.js'),c=window.__qinghe;sleep(c.profile,2);c.ui.updateCondition();});
 await expect(badge).toBeHidden();
 await expect(button).toHaveAttribute('aria-label','状态 · Condition');
 // Sleeping alone leaves a hungry player flagged.
 await setStats(page,10,10);
 await page.evaluate(async()=>{const {sleep}=await import('/src/core/stats.js'),c=window.__qinghe;sleep(c.profile,1);c.ui.updateCondition();});
 await expect(badge).toBeVisible();
 await expect(button).toHaveAttribute('aria-label',/^状态 · Condition — 饿了 Hungry$/);
});

test('The badge follows a remapped Condition shortcut',async({page})=>{
 const {badge,button}=await start(page);
 await setStats(page,10,80);
 await page.evaluate(()=>{const c=window.__qinghe;c.profile.settings.keys={...c.profile.settings.keys,status:'KeyJ'};c.ui.applyKeys();});
 await expect(button.locator('kbd')).toHaveText('J');
 await expect(button).toHaveAttribute('aria-keyshortcuts','J');
 await expect(button).toHaveAttribute('title',/\(J\)$/);
 await expect(button).toHaveAttribute('title',/Hungry/);
 await expect(button.locator('#condition-warning')).toBeVisible();
 await expect(badge).toHaveCount(1);
 // A later change of need must not drop the new key from the tooltip.
 await setStats(page,80,10);
 await expect(button).toHaveAttribute('title',/Needs rest.*\(J\)$/);
});

test('An unchanged state does not touch the DOM',async({page})=>{
 await start(page);
 await setStats(page,10,80);
 const mutations=await page.evaluate(()=>{const c=window.__qinghe;let n=0;const o=new MutationObserver(r=>{n+=r.length;});
  o.observe(document.querySelector('#status-button'),{attributes:true,subtree:true,childList:true,characterData:true});
  for(let i=0;i<20;i++)c.ui.updateCondition();
  return new Promise(res=>setTimeout(()=>{o.disconnect();res(n);},50));});
 expect(mutations).toBe(0);
});

for(const [w,h] of [[390,844],[768,1024]]){
 test(`The badge stays whole and clear of neighbours at ${w}x${h}`,async({page})=>{
  await page.setViewportSize({width:w,height:h});
  const {badge,button}=await start(page);
  await setStats(page,5,5);
  await expect(badge).toBeVisible();
  const b=await badge.boundingBox(),own=await button.boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x+b.width).toBeLessThanOrEqual(w);
  // Inside the button's own column, so it can't cover the next button.
  expect(b.x).toBeGreaterThanOrEqual(own.x-0.5);expect(b.x+b.width).toBeLessThanOrEqual(own.x+own.width+0.5);
  const key=await button.locator('kbd').boundingBox();
  expect(b.y+b.height).toBeLessThanOrEqual(key.y+0.5);
  for(const id of ['journal-button','inventory-button','review-button','settings-button']){
   const n=await page.locator('#'+id).boundingBox();
   if(!n)continue;
   expect(b.x+b.width<=n.x+0.5||b.x>=n.x+n.width-0.5||b.y+b.height<=n.y+0.5||b.y>=n.y+n.height-0.5,`${id} overlap`).toBe(true);
  }
 });
}
