import {test,expect} from '@playwright/test';
test('Condition reminder follows low needs and clears only when both recover',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
 const badge=page.locator('#condition-warning');
 for(const [hunger,energy,visible] of [[80,85,false],[29,85,true],[80,29,true],[10,10,true],[80,10,true],[30,30,false]]){
  await page.evaluate(([hunger,energy])=>{const c=window.__qinghe;c.town.setPaused(true);c.profile.stats={hunger,energy,hour:c.town.daylight.hour};c.ui.update();},[hunger,energy]);
  if(visible)await expect(badge).toBeVisible();else await expect(badge).toBeHidden();
 }
});
