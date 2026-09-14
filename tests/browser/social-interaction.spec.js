import {test,expect} from '@playwright/test';

test('a voluntary NPC interaction opens with a voiced greeting',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
 await page.evaluate(async()=>{
  const ctx=window.__qinghe;ctx.ui.nearby({id:'chen',label:'和陈叔叔交谈'});
  const {openNpcGreeting}=await import('/src/ui/social.js');openNpcGreeting(ctx,'chen',()=>{});
 });
 await expect(page.locator('.dialogue-line .zh')).toHaveText('你好啊！随便看看，有喜欢的就跟我说。');
 await expect(page.getByRole('button',{name:'继续'})).toBeVisible();
 await expect(page.locator('#interact')).toBeHidden();
 expect(await page.locator('.audio-source').textContent()).toContain('普通话');
 expect(errors).toEqual([]);
});

test('a learned word can unlock an occasional longer street conversation',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
 await page.evaluate(async()=>{
  const ctx=window.__qinghe;
  ctx.profile.words.water={recognition:{stage:2,due:Date.now()+100000,last:Date.now(),reviews:2,learned:true}};
  Math.random=()=>0;
  const {openNpcGreeting}=await import('/src/ui/social.js');
  openNpcGreeting(ctx,'friend-a',()=>{});
 });
 await page.getByRole('button',{name:'继续'}).click();
 await expect(page.locator('#social-answer')).toBeVisible();
 await page.getByText('需要一个例子？').click();
 await page.getByRole('button',{name:'带了。'}).click();
 await expect(page.locator('.dialogue-line .zh')).toContainText('路上记得喝水');
});
