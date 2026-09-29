import {test,expect} from '@playwright/test';
import {pastGreeting} from './greeting.js';

const SAVE_KEY='little-mandarin-town.v1';

async function seed(page,profile){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:200,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...profile,
  })]);
}
async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(500);
}
async function warp(page,x,z,yaw=0,y=0){
  await page.evaluate(([x,z,yaw,y])=>window.__qinghe.town.warp(x,z,yaw,y),[x,z,yaw,y]);
  await page.waitForTimeout(240);
}
const profileOf=page=>page.evaluate(()=>window.__qinghe.profile);
const cityX=page=>page.evaluate(()=>window.__qinghe.town.rooms.get('city').offsetX);

const place=page=>page.evaluate(()=>window.__qinghe.town.place);
const roomX=(page,id)=>page.evaluate(id=>window.__qinghe.town.rooms.get(id).offsetX,id);
/** Down the stair on the square and in, onto the landing at the top of the station stairs. */
async function intoStation(page){
  await warp(page,-7.5,12.2,180);
  await expect(page.locator('#interact span')).toHaveText('进地铁站 · 去市里');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('metro-platform');
}
const height=page=>page.evaluate(()=>window.__qinghe.town.playerY);
/** The ticket machine by the door on the landing, which opens the fare hall. */
async function toTicketMachine(page){
  const x=await roomX(page,'metro-platform');
  await warp(page,x+1.7,2.8,90,2.9);
  await expect(page.locator('#interact span')).toHaveText('买票 · BUY A TICKET');
}
/** Down on the platform, at the edge where the train is boarded. */
async function toPlatformEdge(page){
  const x=await roomX(page,'metro-platform');
  await warp(page,x+.7,-2.4,0);
  await expect(page.locator('#interact span')).toHaveText('上车 · Board the train');
}
/** Hold W until the tourist's height passes a mark. */
async function walkUntil(page,done){
  await page.keyboard.down('w');
  try{await expect.poll(async()=>done(await height(page)),{timeout:8000,intervals:[100]}).toBe(true);}finally{await page.keyboard.up('w');}
  await page.waitForTimeout(300);
}
/** Record every clip the ride asks for. None is generated yet, so each is made to count as available. */
async function listen(page){
  await page.evaluate(()=>{const v=window.__qinghe.voice;window.__heard=[];v.available=()=>true;v.play=id=>{window.__heard.push(id);return Promise.resolve();};});
}

test('the stair on the square leads down to a platform, and the step reads 楼梯',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60});
  await start(page);
  // Looking down the stair mouth names the stair, not the canopy, the balustrade or the patio.
  await warp(page,-7.5,12.2,180);
  await page.evaluate(()=>{window.__qinghe.town.pitch=-40;});
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.id)).toBe('stairs');
  await intoStation(page);
  await expect(page.locator('.location b')).toHaveText('地铁站台');
  expect(errors).toEqual([]);
});

test('the fare hall sells singles and a pass, and will not let you board without one',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60});
  await start(page);
  await intoStation(page);
  await toTicketMachine(page);

  await page.keyboard.press('e');
  await expect(page.locator('.fare-state')).toContainText('手上有 0 张单程票');
  await expect(page.locator('#ride')).toBeHidden();   // the train is boarded down on the platform

  // Three singles at six each.
  await page.locator('[data-want="1"]').click();
  await page.locator('[data-want="1"]').click();
  await page.locator('#buy-tickets').click();
  expect((await profileOf(page)).wallet).toBe(42);
  await expect(page.locator('.fare-state')).toContainText('手上有 3 张单程票');

  // A pass replaces the need for them entirely, and cannot be bought twice.
  await page.locator('#buy-pass').click();
  expect((await profileOf(page)).wallet).toBe(2);
  await expect(page.locator('.fare-state')).toContainText('通票还有 7 天');
  await expect(page.locator('#buy-pass')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('the ride announces the next stop, and catching it on arrival pays a coin',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60});
  await start(page);
  await intoStation(page);
  await toTicketMachine(page);
  await page.keyboard.press('e');
  await page.locator('#buy-tickets').click();
  await page.keyboard.press('Escape');
  await toPlatformEdge(page);
  await page.keyboard.press('e');
  await listen(page);
  await page.locator('#ride').click();

  // The announcement names the station you are going to, and the HUD is out of the way.
  await expect(page.locator('#metro-ride')).toBeVisible();
  await expect(page.locator('.mini-map')).toBeHidden();
  await expect(page.locator('.announce-zh')).toHaveText('下一站：云海市中心。',{timeout:10000});
  expect(await page.evaluate(()=>window.__heard)).toContain('metro-next-city');

  // On arrival: where was it going? A wrong stop replays the line and leaves the choices up.
  const choices=page.locator('.announce-quiz [data-stop]');
  await expect(choices).toHaveCount(3,{timeout:10000});
  await expect(page.locator('.announce-zh')).toHaveText('刚才广播说下一站是哪儿？');
  const heardBefore=(await page.evaluate(()=>window.__heard)).length;
  await choices.filter({hasText:'莲池公园'}).click();
  expect((await page.evaluate(()=>window.__heard)).slice(heardBefore)).toEqual(['metro-next-city']);
  await expect(choices).toHaveCount(3);
  expect((await profileOf(page)).wallet).toBe(54);
  await choices.filter({hasText:'云海市中心'}).click();
  await expect(page.locator('#metro-ride')).toHaveCount(0);

  expect(await place(page)).toBe('city');
  await expect(page.locator('.location b')).toHaveText('云海市中心');
  // One ticket was punched, and the one coin came from the answer.
  const after=await profileOf(page);
  expect(after.metro).toEqual({rides:0,trips:1,heard:1});
  expect(after.wallet).toBe(55);
  expect(errors).toEqual([]);
});

test('you arrive on the landing, walk down the stairs to board, and come home up them and out',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60,metro:{rides:1,trips:0}});
  await start(page);
  await intoStation(page);
  expect(await height(page)).toBeCloseTo(2.9,2);
  const px=await roomX(page,'metro-platform');
  // From the top of the flight, W alone walks down to the platform: no prompt, no warp.
  await warp(page,px-4.45,-2,180,2.9);
  const warps=await page.evaluate(()=>window.__qinghe.town.warps);
  await walkUntil(page,y=>y<.01);
  expect(await height(page)).toBe(0);
  expect(await page.evaluate(()=>window.__qinghe.town.warps)).toBe(warps);
  expect(await place(page)).toBe('metro-platform');
  // Down here, standing under the ticket machine offers nothing: it is upstairs.
  await warp(page,px+1.7,2.8,90);
  expect(await page.evaluate(()=>window.__qinghe.town.nearest)).toBeNull();
  // The train is boarded at the platform edge.
  await toPlatformEdge(page);
  await page.keyboard.press('e');
  await listen(page);
  await page.locator('#ride').click();
  await page.locator('.metro-skip').click();
  await expect.poll(()=>place(page)).toBe('city');

  // Home again, the train sets you down on the landing by the ticket machine.
  await page.evaluate(()=>{window.__qinghe.town.leaveCity();window.__qinghe.syncPlace();});
  expect(await place(page)).toBe('metro-platform');
  expect(await height(page)).toBeCloseTo(2.9,2);
  await expect(page.locator('#interact span')).toHaveText('买票 · BUY A TICKET');
  // The stairs are walked back up from the platform, and the way out is at the top.
  await warp(page,px-4.45,3.55,0);
  await walkUntil(page,y=>y>2.5);
  expect(await height(page)).toBeCloseTo(2.9,2);
  await warp(page,px,3.0,0,2.9);
  await expect(page.locator('#interact span')).toHaveText('出去');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('town');
  expect(errors).toEqual([]);
});

test('the city has its own street, its own people, and a free way home to the platform',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:60,metro:{rides:1,trips:0}});
  await start(page);
  await intoStation(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  const x=await cityX(page);

  // Someone on the pavement, with something to say and a note about how to say it.
  await warp(page,x-4.2,13.6,0);
  await expect(page.locator('#interact span')).toHaveText('和上班的人说话');
  await page.keyboard.press('e');await pastGreeting(page);
  await expect(page.locator('.panel-citytalk .dialogue-line .zh')).toBeVisible();
  await page.locator('#keep-line').click();
  expect((await profileOf(page)).saved.length).toBe(1);
  await page.keyboard.press('Escape');

  // A shop that only exists out here.
  await warp(page,x-9.6,-10.5,-90);         // the kiosk at (-7.3, -10.5) opens onto the pavement, facing -x
  await expect(page.locator('#interact span')).toHaveText('看看便利店');
  await page.keyboard.press('e');await pastGreeting(page);
  await expect(page.locator('.shop-card',{hasText:'三明治'})).toBeVisible();
  await page.keyboard.press('Escape');

  // The way home is free: no ticket is taken and the wallet does not move. Skipping the ride
  // skips its question too.
  await warp(page,x,27.4,180);
  await expect(page.locator('#interact span')).toHaveText('坐地铁回青禾 · BACK TO TOWN');
  await listen(page);
  await page.keyboard.press('e');await pastGreeting(page);
  await expect(page.locator('.announce-zh')).toHaveText('下一站：青禾。',{timeout:10000});
  await page.locator('.metro-skip').click();
  await expect(page.locator('#metro-ride')).toHaveCount(0);

  // The train pulls in at the platform, by the ticket machine, facing the way out.
  expect(await place(page)).toBe('metro-platform');
  await expect(page.locator('.location b')).toHaveText('地铁站台');
  await expect(page.locator('#interact span')).toHaveText('买票 · BUY A TICKET');
  const home=await profileOf(page);
  expect(home.metro.rides).toBe(1);
  expect(home.wallet).toBe(60);

  // Walking out comes back up the stair onto the square, just short of where you went down.
  const px=await roomX(page,'metro-platform');
  await warp(page,px,3.0,0,2.9);
  await expect(page.locator('#interact span')).toHaveText('出去');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('town');
  const spot=await page.evaluate(()=>{const p=window.__qinghe.town.player.entity.getPosition();return [p.x,p.z];});
  expect(spot[0]).toBeCloseTo(-7.5,1);
  expect(spot[1]).toBeCloseTo(11.6,1);
  await expect(page.locator('.location b')).toHaveText('青禾广场');
  expect(errors).toEqual([]);
});

test('the city is solid: the towers are walls, and the railing and the edge of the world hold',async({page})=>{
  await seed(page,{metro:{rides:2,trips:0}});
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  const x=await cityX(page);
  const blocked=await page.evaluate(offset=>{
    const t=window.__qinghe.town;
    return {
      intoTower:t.canMove(offset-17.5,0),
      onPavement:t.canMove(offset-9.2,9.5),
      downTheMiddle:t.canMove(offset,0),
      // The avenue runs on into the promenade, which ends at the railing along the bay.
      ontoThePromenade:t.canMove(offset,-40),
      pastTheEnd:t.canMove(offset,-48.5),
      throughTheSide:t.canMove(offset+28.5,0),
      intoTheHall:t.canMove(offset,29),
    };
  },x);
  expect(blocked).toEqual({intoTower:false,onPavement:true,downTheMiddle:true,
    ontoThePromenade:true,pastTheEnd:false,throughTheSide:false,intoTheHall:true});
});
