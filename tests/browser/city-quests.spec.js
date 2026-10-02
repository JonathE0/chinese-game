import {test,expect} from '@playwright/test';
import {pastGreeting} from './greeting.js';

const SAVE_KEY='little-mandarin-town.v1';

async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:60,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},metro:{rides:1,trips:0},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...profile,
  })]);
}
async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(400);
}
async function warp(page,x,z,yaw=0){
  await page.evaluate(([x,z,yaw])=>window.__qinghe.town.warp(x,z,yaw),[x,z,yaw]);
  await page.waitForTimeout(240);
}
const profileOf=page=>page.evaluate(()=>window.__qinghe.profile);
const cityX=page=>page.evaluate(()=>window.__qinghe.town.rooms.get('city').offsetX);

/** Types a reply into the open dialogue, submits it, then clicks past the feedback screen. */
async function answer(page,text){
  await page.getByRole('textbox',{name:'你的回答'}).fill(text);
  await page.getByRole('button',{name:'提交回答'}).click();
  await page.getByRole('button',{name:'继续',exact:true}).click();
}

test('asking the way: only the student offers it, and finding the bookstore is one-time',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  const x=await cityX(page);
  // 问路 ends inside 一号书店 (wave 3): go in through its door on the street, and back out.
  const intoBookshop=async()=>{
    const door=await page.evaluate(()=>window.__qinghe.town.targets().find(t=>t.id==='door:city-bookshop'));
    await warp(page,door.x,door.z,0);
    await expect(page.locator('#interact span')).toHaveText('进书店');
    await page.keyboard.press('e');
    await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('city-bookshop');
  };
  const backOut=async()=>{
    await page.evaluate(()=>window.__qinghe.town.onInteract('door:city'));
    await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('city');
  };

  // Someone else on the street has a line to keep, but nothing to ask about directions.
  await warp(page,x-4.2,13.6,0);                   // the office worker, per city.json
  await page.keyboard.press('e');await pastGreeting(page);
  await expect(page.locator('.panel-citytalk')).toBeVisible();
  await expect(page.locator('#ask-directions')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Going into the bookstore before ever asking does nothing.
  await intoBookshop();
  await page.waitForTimeout(300);
  await expect(page.locator('#panel')).toBeHidden();
  expect((await profileOf(page)).completed).not.toContain('city:found-bookstore');
  await backOut();

  // The student, and only the student, offers directions.
  await warp(page,x+4.6,-3.4,0);                   // the student sits at (4.6,-6); radius 3
  await expect(page.locator('#interact span')).toHaveText('和学生说话');
  await page.keyboard.press('e');await pastGreeting(page);
  await expect(page.locator('.panel-citytalk')).toBeVisible();
  await page.locator('#ask-directions').click();
  await expect(page.locator('#panel-title')).toHaveText('问路');

  await answer(page,'请问，一号书店在哪儿？');
  await answer(page,'谢谢');
  await page.getByRole('button',{name:'完成对话',exact:true}).click();   // the farewell line takes no input
  await page.getByRole('button',{name:'回到小镇',exact:true}).click();
  expect((await profileOf(page)).completed).toContain('city-directions');

  // Being set down right at the door (a warp) is not finding it yet.
  const door=await page.evaluate(()=>window.__qinghe.town.targets().find(t=>t.id==='door:city-bookshop'));
  await warp(page,door.x,door.z,0);
  await expect(page.locator('#panel')).toBeHidden();
  expect((await profileOf(page)).completed).not.toContain('city:found-bookstore');

  // Going in through its door finds it, and says so.
  await intoBookshop();
  await expect(page.locator('.panel-dialogue .dialogue-line .zh')).toHaveText('找到了！这就是一号书店。',{timeout:8000});
  const found=await profileOf(page);
  expect(found.completed.filter(f=>f==='city:found-bookstore').length).toBe(1);
  await page.locator('#line-continue').click();

  // Leaving and going back in does not show it a second time.
  await backOut();
  await intoBookshop();
  await page.waitForTimeout(300);
  await expect(page.locator('#panel')).toBeHidden();
  expect(errors).toEqual([]);
});
