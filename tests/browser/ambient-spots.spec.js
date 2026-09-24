import {test,expect} from '@playwright/test';

// Three places where the town talks to itself (docs/superpowers/plans/2026-09-21-metro-wayfinding-ambience.md,
// Task 3): the square, the park's entrance court and the word hall's forecourt each have a pair of
// neighbours whose chatter bubbles up when you stand nearby with no panel open.
const SAVE_KEY='little-mandarin-town.v1';

test('each chat spot has its neighbours and talks when you stand near it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],
    discovered:[],clock:14,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  const spots=await page.evaluate(()=>window.__qinghe.town.data.ambient);
  expect(spots.length).toBe(3);
  const lines=[];
  for(const [i,[ax,az]] of spots.entries()){
    // Stand a few steps south-east of the pair, facing them.
    await page.evaluate(([x,z])=>{const t=window.__qinghe.town;t.warp(x+3,z+3,Math.atan2(3,3)*180/Math.PI);},[ax,az]);
    await page.waitForTimeout(200);
    const here=await page.evaluate(([i,ax,az])=>{const c=window.__qinghe,t=c.town;
      // Skip the opening silence; this spot's conversation is only made once you have been near it.
      c.ambientConversations[i].next=0;
      return {friends:t.targets().filter(g=>/^friend-/.test(g.id)&&Math.hypot(g.x-ax,g.z-az)<2).length,
        // Nothing built where the new pairs stand (they are not solid themselves). The square's
        // original pair has always leaned on its bench.
        clear:i===0||t.canMove(ax,az)&&t.canMove(ax-1.3,az+.5)};},[i,ax,az]);
    expect(here,`spot ${i}`).toEqual({friends:2,clear:true});
    const bubble=page.locator('#ambient-bubble');
    await expect(bubble).toBeVisible();
    lines.push(await bubble.locator('span').textContent());
  }
  const ambient=(await import('../../src/content/ambient.json',{with:{type:'json'}})).default;
  for(const zh of lines)expect(ambient.map(a=>a.zh)).toContain(zh);
  expect(errors).toEqual([]);
});
