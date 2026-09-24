import {test,expect} from '@playwright/test';
// Task L-levels: passing the HSK 1 mock exam gives its certificate.
test('take the HSK 1 mock exam answering right and own the certificate',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
 await page.waitForFunction(()=>window.__qinghe?.hskWords?.length>0);
 await page.evaluate(async()=>{const c=window.__qinghe;c.hskLevel=1;const {openHsk}=await import('/src/ui/hsk.js');await openHsk(c);});
 await page.locator('#hsk-mock').click();
 for(let i=1;i<=20;i++){
  await expect(page.locator('.step-label')).toContainText(`${i} / 20`);
  const id=await page.locator('.drill-prompt').getAttribute('data-word');
  await page.locator(`[data-pick="${id}"]`).click();
 }
 await expect(page.locator('#level-score')).toContainText('20 / 20');
 await expect(page.locator('.level-certificate')).toContainText('HSK一级证书');
 const p=await page.evaluate(()=>window.__qinghe.profile);
 expect(p.inventory['hsk-cert-1']).toBe(1);
 expect(p.learning.levels.passed['1']).toBeDefined();
 expect(errors).toEqual([]);
});
test('a placement test with no known words says just starting, once a day',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
 await page.waitForFunction(()=>window.__qinghe?.hskWords?.length>0);
 await page.evaluate(async()=>{const {openHsk}=await import('/src/ui/hsk.js');await openHsk(window.__qinghe);});
 await page.locator('#hsk-placement').click();
 for(let i=1;i<=8;i++){await expect(page.locator('.step-label')).toContainText(`${i} / 8`);await page.locator('[data-pick=""]').click();}
 await expect(page.locator('#level-result')).toHaveText('你的水平：刚开始');
 await page.locator('#back').click();
 await expect(page.locator('#hsk-placement')).toBeDisabled();
});
