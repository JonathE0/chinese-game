import {test,expect} from '@playwright/test';

// The dev server and these tests run without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: the cloud
// save must then be wholly absent, with supabase-js never loaded and no request made to Supabase
// or to Google's sign-in script.
test('without Supabase settings there is no cloud save and nothing reaches Supabase or Google',async({page})=>{
  const requests=[];
  page.on('request',r=>requests.push(r.url()));
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.locator('#settings-button').click();
  await expect(page.locator('#folder-sync')).toBeAttached();
  await expect(page.locator('#panel')).not.toContainText('云端存档');
  await expect(page.locator('#cloud-sync')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__qinghe.cloud),'the test server must run in e2e mode (npm run dev -- --port 5175 --mode e2e), which blanks the cloud settings').toBeUndefined();
  // Let a save's delayed uploads come due, then check nothing went out.
  await page.evaluate(()=>window.__qinghe.save());
  await page.waitForTimeout(11000);
  expect(requests.filter(url=>/supabase|accounts\.google\.com/i.test(url))).toEqual([]);
});
