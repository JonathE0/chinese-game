import {test,expect} from '@playwright/test';

for(const viewport of [{width:1440,height:1000},{width:700,height:620}]){
 test(`word feedback and interaction remain separated at ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.evaluate(()=>{
   window.__qinghe.ui.notice('已记住：青禾广场 · 这个词已经加入生词本。');
   // Keep an interaction visible while the live scene updates its nearest target.
   document.querySelector('#interact').removeAttribute('hidden');
   document.querySelector('#interact').style.setProperty('display','block','important');
   document.querySelector('#interact-button span').textContent='和小美交谈';
  });
  const toast=await page.locator('#toast').boundingBox();
  const action=await page.locator('#interact').boundingBox();
  expect(toast.y+toast.height).toBeLessThanOrEqual(action.y-7);
 });
}
