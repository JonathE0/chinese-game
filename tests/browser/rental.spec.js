import {test,expect} from '@playwright/test';
test('rental expires without losing furniture; renewal and Mandarin alternatives work',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
 await page.evaluate(()=>{const c=window.__qinghe;c.ui.close();c.profile.wallet=100;c.town.ensureCity();c.town.enterRoom('riverside-lobby');c.town.onInteract('rental');});
 await page.locator('#rental-confirm').click();expect(await page.evaluate(()=>window.__qinghe.profile.wallet)).toBe(65);await page.locator('#rental-enter').click();await page.waitForFunction(()=>window.__qinghe.town.place==='riverside-apartment');
 await page.evaluate(()=>{const c=window.__qinghe;c.profile.inventory['furniture-rug']=1;c.profile.home.push({uid:'rental-proof',room:'riverside-apartment',item:'furniture-rug',kind:'rug',color:'#aabbcc',footprint:[2,2],x:0,z:0,rot:0});c.profile.dayIndex=c.profile.rental.until;c.town.onInteract('sleep');});
 await expect(page.locator('#panel')).toBeHidden();await page.evaluate(()=>window.__qinghe.town.onInteract('rental'));await expect(page.locator('#panel-body')).toContainText('Lease expired');await page.locator('#rental-recover').click();expect(await page.evaluate(()=>window.__qinghe.profile.inventory['furniture-rug'])).toBe(1);expect(await page.evaluate(()=>window.__qinghe.profile.home.some(r=>r.uid==='rental-proof'))).toBe(false);
 await page.locator('#rental-confirm').click();expect(await page.evaluate(()=>window.__qinghe.profile.wallet)).toBe(30);await page.locator('#rental-practice').click();await page.locator('#answer').fill('请问我想租一间房谢谢');await page.locator('#answer-form').evaluate(form=>form.requestSubmit());await expect(page.locator('#next-line')).toBeVisible();
});
test('capture station and apartment views',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
 for(const place of ['metro-platform','yunhai-central','riverside-apartment']){await page.evaluate(place=>{const c=window.__qinghe;c.ui.close();c.town.enterRoom(place);},place);await page.waitForTimeout(500);await page.screenshot({path:'.superpowers/sdd/2026-09-30-transit/'+place+'.png'});}
});
