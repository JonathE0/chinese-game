import {test,expect} from '@playwright/test';
test('new traveller can understand the opening and photography without opening translation help',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await expect(page.locator('#roots-welcome-close')).toHaveText('Start exploring');await expect(page.locator('#panel-body')).toContainText('Find the places in his old photographs');
 await page.locator('#roots-welcome-close').click();await page.evaluate(async()=>{const {openRootsAlbum}=await import('/src/ui/roots.js');openRootsAlbum(window.__qinghe);});await expect(page.locator('#panel-title')).toContainText("Grandfather’s album");await expect(page.locator('#roots-photo-guide')).toBeVisible();await expect(page.locator('#roots-photo-guide')).toContainText('exact framing');await expect(page.locator('#photo-roots-fruit')).toHaveText('Recreate this photo');await expect(page.locator('#roots-film')).toContainText('10 coins');
 await page.screenshot({path:'.superpowers/sdd/2026-09-28-roots-chapter-one/english-onboarding.png'});
 await page.evaluate(async()=>{const {openRootsCaretaker}=await import('/src/ui/roots.js');openRootsCaretaker(window.__qinghe);});await expect(page.locator('#roots-show')).toHaveText('Show him the old photo');await page.locator('#roots-show').click();await expect(page.locator('#roots-practice')).toHaveText('Practise Mandarin');
});

test('Mandarin labels appear after independent mastery, while English guidance remains',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.evaluate(async()=>{const c=window.__qinghe;c.profile.roots.mastery['roots-greeting']=['greet-a','greet-b'];const {openRootsAlbum}=await import('/src/ui/roots.js');openRootsAlbum(c);});await expect(page.locator('#photo-roots-fruit')).toHaveText('Recreate this photo · 重拍这张照片');await expect(page.locator('#roots-photo-guide')).toBeVisible();await expect(page.locator('[data-memory="roots-fruit"]')).toContainText('In Grandfather’s old photograph');
});
