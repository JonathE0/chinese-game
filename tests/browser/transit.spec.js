import {test,expect} from '@playwright/test';
test('top-up and gate entry never board; walking into an open train does',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
 await page.evaluate(()=>{const c=window.__qinghe;c.ui.close();c.town.enterRoom('metro-platform');c.profile.wallet=40;c.town.onInteract('metro');});
 await expect(page.locator('#transit-topup-10')).toBeVisible();await page.locator('#transit-topup-10').click();await page.locator('#transit-enter').click();await expect(page.locator('#metro-ride')).toHaveCount(0);
 await page.evaluate(()=>{const c=window.__qinghe,r=c.town.rooms.get(c.town.place);c.town.transit.get(r.id).dock();c.town.warp(r.offsetX,-7,0);});
 await expect(page.locator('#metro-ride')).toBeVisible({timeout:25000});await page.locator('.metro-skip').click();await page.waitForFunction(()=>window.__qinghe.town.place==='yunhai-central');
 expect(await page.evaluate(()=>window.__qinghe.profile.metro.balance)).toBe(5);
});
