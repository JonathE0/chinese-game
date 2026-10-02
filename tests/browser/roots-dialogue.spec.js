import {test,expect} from '@playwright/test';
test('alternative replies unlock mastery only after independent variants',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
 await page.evaluate(async()=>{const {openRootsCaretaker}=await import('/src/ui/roots.js');openRootsCaretaker(window.__qinghe);});await page.locator('#roots-show').click();await page.locator('#roots-practice').click();
 await page.locator('#answer').fill('不知道');await page.locator('#answer-form [type=submit]').click();await expect(page.locator('#answer-feedback')).toContainText('您好');
 await page.locator('#answer').fill('您好');await page.locator('#answer-form [type=submit]').click();await page.locator('#next-line').click();await page.locator('#back-town').click();
 expect(await page.evaluate(()=>window.__qinghe.profile.roots.mastery['roots-greeting'])).toEqual([]);
 for(let i=0;i<6;i++){
  const answer=await page.evaluate(async()=>{const data=(await import('/src/content/roots.json')).default;return data.skills.flatMap(s=>s.variants).find(v=>v.id===window.__qinghe.rootsLastVariant).accepted[0];});
  await page.locator('#answer').fill(answer);await page.locator('#answer-form [type=submit]').click();await page.locator('#next-line').click();await page.locator('#back-town').click();
 }
 expect(await page.evaluate(()=>Object.values(window.__qinghe.profile.roots.mastery).every(a=>a.length>=2))).toBe(true);
 await expect(page.locator('#roots-activate')).toBeDisabled();
});
test('a valid off-centre story photograph with Grandpa’s camera uses no film and records the memory',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
 await page.evaluate(()=>{const c=window.__qinghe;c.ui.close();c.town.warp(-11,5,-42);c.town.pitch=-3;c.storyMemory='roots-fruit';c.town.onCamera(true);});
 await expect(page.locator('#viewfinder .vf-name')).toContainText('可以记录');await page.evaluate(()=>window.__qinghe.town.onShutter());
 expect(await page.evaluate(()=>window.__qinghe.profile.inventory.film??0)).toBe(0);expect(await page.evaluate(()=>window.__qinghe.profile.roots.photos)).toContain('roots-fruit');
 await page.reload();await page.getByRole('button',{name:'开始旅行',exact:true}).click();expect(await page.evaluate(()=>window.__qinghe.profile.roots.photos)).toContain('roots-fruit');
});

test('retakes with Grandpa’s camera are free, and it photographs album places only',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
 await page.evaluate(()=>{const c=window.__qinghe;c.ui.close();c.town.warp(-11,5,-42);c.town.pitch=-3;c.storyMemory='roots-fruit';c.profile.roots.photos.push('roots-fruit');c.town.onCamera(true);});
 await expect(page.locator('#viewfinder .vf-name')).toContainText('可以记录');await page.evaluate(()=>window.__qinghe.town.onShutter());await page.evaluate(()=>window.__qinghe.town.onShutter());expect(await page.evaluate(()=>window.__qinghe.profile.inventory.film??0)).toBe(0);await expect(page.locator('#toast')).toContainText('Memory captured');
 // Out of reach of every album place (roots.json memories: the old home at 16,53 reaches 15 m).
 await page.evaluate(()=>{const t=window.__qinghe.town;t.onCamera(false);t.warp(12.5,28,0);t.onCamera(true);});await expect(page.locator('#viewfinder .vf-name')).toContainText('爷爷的相机只拍相册里的地方。');await page.evaluate(()=>window.__qinghe.town.onShutter());await expect(page.locator('#toast')).toContainText('爷爷的相机只拍相册里的地方。');
});

test('a delayed microphone transcript cannot fill a newly opened conversation',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
 await page.evaluate(async()=>{const c=window.__qinghe;const {openRootsPractice}=await import('/src/ui/roots.js');c.speech.start=callbacks=>{window.oldMic=callbacks;};openRootsPractice(c);});await page.locator('#microphone').click();
 await page.evaluate(async()=>{const c=window.__qinghe;c.ui.close();const {openRootsPractice}=await import('/src/ui/roots.js');openRootsPractice(c);});await page.locator('#answer').fill('my current draft');
 await page.evaluate(()=>{window.oldMic.onTranscript('您好');window.oldMic.onStatus('old request');});await expect(page.locator('#answer')).toHaveValue('my current draft');await expect(page.locator('#speech-status')).not.toContainText('old request');
});
