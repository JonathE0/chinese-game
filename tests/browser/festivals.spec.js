import {test,expect} from '@playwright/test';

// The last day of each game week is a festival (src/core/festivals.js, src/world/festivals.js).
const SAVE_KEY='little-mandarin-town.v1';

async function start(page,day,clock=12){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:20,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock,dayIndex:day,settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town?.festival?.root);
}

/** Every mesh of the decorations sits under a tagged entity that has a look box (the moon excepted). */
function coverage(){
  const t=window.__qinghe.town,f=t.festival,boxed=new Set(t.registry.looks.map(b=>b.entity));
  const bare=[],signs=[];
  const walk=(e,tagged)=>{
    if(e===f.moon)return;
    if(e.lookName||e.signText)tagged=e;
    if(e.signText)signs.push(e.signText);
    if(e.render&&!(tagged&&boxed.has(tagged)))bare.push(e.name);
    for(const c of e.children)walk(c,tagged);
  };
  walk(f.root,null);
  return {bare,signs,id:f.id,targets:f.targets().map(x=>x.id)};
}

test('春节 on day 6: the banner, and 林阿姨 gives a 红包 once for the right greeting',async({page})=>{
  await start(page,6);
  const seen=await page.evaluate(coverage);
  expect(seen.id).toBe('chunjie');
  expect(seen.signs).toContain('新年快乐');
  expect(seen.bare).toEqual([]);
  expect(seen.targets).toContain('shop:fest-chunjie');
  const before=await page.evaluate(()=>window.__qinghe.profile.wallet);
  await page.evaluate(()=>window.__qinghe.town.onInteract('lin'));
  await page.locator('[data-hi="hi-duanwu"]').click();
  await expect(page.locator('[data-hi="hi-duanwu"]')).toBeDisabled();
  await page.locator('[data-hi="hi-chunjie"]').click();
  await expect(page.locator('.reward')).toContainText('+8');
  await page.locator('#festival-done').click();
  // The usual chat follows, and a second visit goes straight to it with no second 红包.
  await expect(page.locator('#social-continue')).toBeVisible();
  const after=await page.evaluate(()=>window.__qinghe.profile.wallet);
  expect(after-before).toBe(8);
  await page.evaluate(()=>window.__qinghe.ui.close());
  await page.evaluate(()=>window.__qinghe.town.onInteract('lin'));
  await expect(page.locator('#social-continue')).toBeVisible();
  await expect(page.locator('[data-hi]')).toHaveCount(0);
  await page.evaluate(()=>window.__qinghe.ui.close());
  // 小美 before her first lesson ('mei-first') and 陈叔叔 greet too: three people, three 红包.
  expect(await page.evaluate(()=>window.__qinghe.profile.completed.includes('practice:first'))).toBe(false);
  for(const who of ['mei','chen']){
    await page.evaluate(who=>window.__qinghe.town.onInteract(who),who);
    await page.locator('[data-hi="hi-chunjie"]').click();
    await expect(page.locator('.reward')).toContainText('+8');
    await page.locator('#festival-done').click();
    await expect(page.locator('#social-continue')).toBeVisible();
    await page.evaluate(()=>window.__qinghe.ui.close());
  }
  expect(await page.evaluate(()=>window.__qinghe.profile.wallet)-before).toBe(24);
  // 给三个人拜年 is done and pays from the journal.
  await page.getByRole('button',{name:'旅行手册'}).click();
  const claim=page.locator('[data-claim="bainian"]');
  await expect(claim).toBeVisible();
  const paid=await page.evaluate(()=>window.__qinghe.profile.wallet);
  await claim.click();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.profile.wallet)).toBe(paid+12);
});

test('元宵节 on day 13: a lantern riddle pays one coin, once',async({page})=>{
  await start(page,13);
  const seen=await page.evaluate(coverage);
  expect(seen.id).toBe('yuanxiao');
  expect(seen.bare).toEqual([]);
  expect(seen.targets.filter(id=>id.startsWith('fest:riddle:'))).toHaveLength(10);
  const coins=()=>page.evaluate(()=>window.__qinghe.profile.wallet);
  const before=await coins();
  for(let round=0;round<2;round++){
    await page.evaluate(()=>window.__qinghe.town.onInteract('fest:riddle:1'));
    await expect(page.locator('[data-guess]')).toHaveCount(4);
    await page.locator('[data-guess="林"]').click();
    await expect(page.locator('#festival-feedback')).toContainText('木 + 木 = 林');
    await page.locator('#festival-done').click();
  }
  expect(await coins()-before).toBe(1);
  // The festival stall sells 汤圆 through the order builder.
  await page.evaluate(()=>window.__qinghe.town.onInteract('shop:fest-yuanxiao'));
  await page.locator('[data-shop-item="tangyuan"]').click();
  await expect(page.locator('.order-builder [data-measure="碗"]')).toBeVisible();
});

test('each festival dresses the town with named pieces, and the day after is ordinary again',async({page})=>{
  await start(page,20,21);
  for(const [day,id] of [[20,'duanwu'],[27,'zhongqiu'],[6,'chunjie'],[13,'yuanxiao']]){
    await page.evaluate(day=>{window.__qinghe.profile.dayIndex=day;},day);
    await page.waitForFunction(id=>window.__qinghe.town.festival.id===id,id);
    const seen=await page.evaluate(coverage);
    expect(seen.bare,id).toEqual([]);
  }
  // 中秋节 at night: the moon is up and named 月亮.
  await page.evaluate(()=>{window.__qinghe.profile.dayIndex=27;});
  await page.waitForFunction(()=>window.__qinghe.town.festival.moon?.enabled);
  expect(await page.evaluate(()=>window.__qinghe.town.registry.looks.some(b=>b.name?.id==='yueliang'))).toBe(true);
  await page.evaluate(()=>{window.__qinghe.profile.dayIndex=28;});
  await page.waitForFunction(()=>window.__qinghe.town.festival.id===null);
  expect(await page.evaluate(()=>window.__qinghe.town.registry.looks.some(b=>b.owner?.startsWith?.('festival')))).toBe(false);
});
