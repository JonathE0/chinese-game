import {test,expect} from '@playwright/test';

// ?dev on the dev server opens every district gate and tops the wallet up to 1000, for previewing.
test('dev mode opens every gate and tops up the wallet',async({page})=>{
  await page.goto('/?dev');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await expect(page.locator('#wallet-count')).toHaveText('1000');
  await expect.poll(()=>page.evaluate(()=>{const s=window.__qinghe.gateStates;return !!s?.length&&s.every(x=>x.unlocked);}),{timeout:15000}).toBe(true);
  expect(await page.evaluate(()=>document.body.classList.contains('dev'))).toBe(true);
});

test('without ?dev the gates stay shut and the wallet is untouched',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await expect(page.locator('#wallet-count')).not.toHaveText('1000');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.gateStates?.length??0),{timeout:15000}).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__qinghe.gateStates.some(x=>!x.unlocked))).toBe(true);
});
