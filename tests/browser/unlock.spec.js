import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {startGame} from './start.js';

/**
 * The metro unlock (src/core/unlock.js, src/ui/unlock.js): the gates turn a new traveller back with
 * the town's progress, the album shows a blurred Yunhai page, and once every town step is done Lin
 * calls, gives Grandpa's card and the photo, and the attendant's chat opens the gates. SHOTS=<folder>
 * saves screenshots of each beat.
 */
const SAVE_KEY='little-mandarin-town.v1',SHOTS=process.env.SHOTS;
if(SHOTS)mkdirSync(SHOTS,{recursive:true});
const shot=async(page,name)=>{if(SHOTS)await page.screenshot({path:`${SHOTS}/${name}.png`});};

async function start(page,completed=[]){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:7,wallet:50,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter',...completed],phrases:[],saved:[],home:[],discovered:[],
    clock:12,dayIndex:0,vendors:{},tutorial:{done:true},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await startGame(page);
  await page.waitForFunction(()=>!!window.__qinghe?.town&&!!window.__qinghe.gateStates);
}
const act=(page,id)=>page.evaluate(id=>window.__qinghe.town.onInteract(id),id);
const enter=(page,room)=>page.evaluate(room=>{const c=window.__qinghe;c.town.enterRoom(room);c.syncPlace();},room);
/** Type a reply in the open conversation and go on to the next line. */
async function reply(page,text){
  await page.locator('#answer').fill(text);
  await page.locator('#answer-form button[type=submit]').click();
  await page.locator('#next-line').click();
}

test('a new traveller is turned back until the town is done, then Lin and the attendant open the metro',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);

  // The mission card says the metro waits for the town, with the count.
  await expect(page.locator('#quest-list')).toContainText(/完成青禾的任务后开放（\d+ \/ \d+）/);
  await shot(page,'1-quest-locked');

  // The concourse is open to walk in, but the gates send you to finish the town first.
  await enter(page,'metro-platform');
  await act(page,'metro');
  await expect(page.locator('#panel-body')).toContainText('去云海要先多学一点中文。');
  await expect(page.locator('#panel-body')).toContainText('先把青禾的任务做完，再来找我吧！');
  await expect(page.locator('#unlock-progress')).toContainText(/（\d+ \/ \d+）/);
  await expect(page.locator('#transit-enter')).toHaveCount(0);
  await shot(page,'2-gates-locked');
  // The service counter says the same while there is no card.
  await page.evaluate(()=>window.__qinghe.ui.close());
  await act(page,'metro:service');
  await expect(page.locator('#unlock-progress')).toBeVisible();
  await page.evaluate(()=>window.__qinghe.ui.close());
  await act(page,'leave');

  // Grandfather's album keeps a blurred page for Yunhai.
  await page.evaluate(async()=>{const {openRootsAlbum}=await import('/src/ui/roots.js');openRootsAlbum(window.__qinghe);});
  const blurred=page.locator('[data-locked="roots-yunhai"]');
  await expect(blurred).toBeVisible();
  await blurred.scrollIntoViewIfNeeded();
  await shot(page,'3-album-blurred');
  await page.evaluate(()=>window.__qinghe.ui.close());

  // Finish every town step at once: Lin calls, on the toast, her label and the mission card.
  await page.evaluate(async()=>{
    const c=window.__qinghe,p=c.profile,roots=(await import('/src/content/roots.json')).default;
    p.completed.push('introductions','practice:first','purchase:first','homeware:first','daily:first','permit:shop','built:teahouse','fish:first','veg:first');
    while(p.discovered.length<10)p.discovered.push('test-thing-'+p.discovered.length);
    while(p.home.length<4)p.home.push({uid:'test-'+p.home.length,item:'floor-rug',kind:'rug',color:'#fff',footprint:[1,1],x:0,z:0,rot:0});
    p.claims['order:test']=true;
    const camera=(await import('/src/content/quests.json')).default.quests.find(q=>q.id==='my-camera');if(camera?.done?.flag)p.completed.push(camera.done.flag);
    (p.learning??={}).visited=['market'];
    Object.assign(p.roots,{met:true,photos:['roots-fruit','roots-square','roots-home'],mastery:Object.fromEntries(roots.skills.map(s=>[s.id,s.variants.slice(0,2).map(v=>v.id)]))});
    c.save();
  });
  await expect(page.locator('#toast')).toContainText('林阿姨在找你！');
  await expect(page.locator('#label-lin .label-call')).toHaveText('林阿姨在找你！');
  await expect(page.locator('#quest-list')).toContainText('林阿姨在找你！');

  // Lin's scene: two lines, then say thank you.
  await act(page,'lin');
  await expect(page.locator('#panel-body')).toContainText('你来青禾以后，中文进步了很多！');
  await page.locator('#next-line').click();
  await expect(page.locator('#panel-body')).toContainText('这是你爷爷的交通卡。他以前常常坐地铁去云海。');
  await page.locator('#next-line').click();
  await expect(page.locator('#panel-body')).toContainText('去地铁站的服务中心，请他们帮你开通吧。');
  await expect(page.locator('#panel-body')).toContainText('说谢谢。');
  await shot(page,'4-lin-card');
  await reply(page,'谢谢阿姨');
  await expect(page.locator('.completion')).toBeVisible();
  await expect(page.locator('.completion .reward')).toHaveCount(0);   // no coins for this one
  await page.locator('#back-town').click();

  // The card is in the bag, the Lin label is gone, and the album opens on Grandfather's Yunhai photo.
  const after=await page.evaluate(()=>{const p=window.__qinghe.profile;return {card:p.inventory['grandpa-card'],page:p.roots.discovered.includes('roots-yunhai')};});
  expect(after).toEqual({card:1,page:true});
  await expect(page.locator('#label-lin .label-call')).toHaveCount(0);
  const photo=page.locator('[data-memory="roots-yunhai"]');
  await expect(photo).toContainText('云海的海风，很舒服。');
  await expect(page.locator('[data-locked="roots-yunhai"]')).toHaveCount(0);
  await photo.scrollIntoViewIfNeeded();
  await shot(page,'5-album-page');
  await page.evaluate(()=>window.__qinghe.ui.close());

  // Still shut at the gates until the card is activated; the counter's chat does that.
  await enter(page,'metro-platform');
  await act(page,'metro');
  await expect(page.locator('#unlock-service')).toBeVisible();
  await page.locator('#unlock-service').click();
  await expect(page.locator('#panel-body')).toContainText('你好！这张卡是你的吗？');
  await reply(page,'这是我爷爷的卡');
  await expect(page.locator('#panel-body')).toContainText('到了云海，你想去哪儿？');
  await reply(page,'我要去商场');
  await expect(page.locator('#panel-body')).toContainText('刚才广播说下一站是哪儿？');
  await shot(page,'6-check-chat');
  await reply(page,'云海市中心');
  await expect(page.locator('#panel-body')).toContainText('很好！你的中文没问题。卡开通了，祝你玩得开心！');
  const wallet=await page.evaluate(()=>window.__qinghe.profile.wallet);
  await reply(page,'谢谢');
  await page.locator('#back-town').click();
  const done=await page.evaluate(()=>({wallet:window.__qinghe.profile.wallet,checked:window.__qinghe.profile.completed.includes('metro:check')}));
  expect(done).toEqual({wallet,checked:true});

  // The gates open: the card machine panel and tapping in.
  await act(page,'metro');
  await expect(page.locator('#transit-enter')).toBeVisible();
  await expect(page.locator('#quest-list')).not.toContainText('完成青禾的任务后开放');
  await page.locator('[data-topup]').first().click();
  await page.locator('#transit-enter').click();
  await page.waitForTimeout(1500);   // the gates swing open for a paid journey
  await shot(page,'7-gates-open');
  expect(errors).toEqual([]);
});

test('a save that already rode the metro keeps it, and the townsfolk hint only while it is shut',async({page})=>{
  await start(page,['metro:first']);
  await enter(page,'metro-platform');
  await act(page,'metro');
  await expect(page.locator('#transit-enter')).toBeVisible();
  await expect(page.locator('#quest-list')).not.toContainText('完成青禾的任务后开放');
  const hints=await page.evaluate(async()=>{
    const {townHint,AMBIENT_HINTS}=await import('/src/ui/unlock.js');const c=window.__qinghe;
    const open=townHint(c,AMBIENT_HINTS[0]);
    c.profile.completed=c.profile.completed.filter(f=>f!=='metro:first');
    return {open,shut:townHint(c,AMBIENT_HINTS[0])?.zh};
  });
  expect(hints).toEqual({open:null,shut:'云海很大，也很热闹！'});
});

test('the card machines top up before the unlock, and a locked save in Yunhai can still ride home',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  // Qinghe: the machines open the card panel to top up, with no tap-in; the gates still send you back.
  await enter(page,'metro-platform');
  await act(page,'metro:machine');
  await expect(page.locator('#panel.panel-metro')).toBeVisible();
  await expect(page.locator('#transit-enter')).toHaveCount(0);
  await expect(page.locator('#transit-locked')).toContainText('完成青禾的任务后开放');
  await page.locator('[data-topup]').first().click();
  await expect(page.locator('#transit-balance')).not.toHaveText('0');
  await page.evaluate(()=>window.__qinghe.ui.close());
  await act(page,'metro');
  await expect(page.locator('#unlock-progress')).toBeVisible();
  await page.evaluate(()=>window.__qinghe.ui.close());
  // Yunhai (an import or a sign-in that has not unlocked): the gates let you tap in for home.
  await enter(page,'yunhai-central');
  await act(page,'metro');
  await expect(page.locator('#panel.panel-metro')).toBeVisible();
  await expect(page.locator('#transit-enter')).toBeVisible();
  expect(errors).toEqual([]);
});
