import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {pastGreeting} from './greeting.js';

// The metro on a transit card (docs/superpowers/specs/2026-09-30-metro-redesign-design.md, wave 4
// stations): walked, not warped, from the square down the stairs, through the gates and onto the
// train, a ride in the carriage, and off it again, up into 云海市中心站's hall and out by an exit.
const METRO=JSON.parse(readFileSync('src/content/metro.json','utf8'));
const CITY=JSON.parse(readFileSync('src/content/city.json','utf8'));
const ROOMS=JSON.parse(readFileSync('src/content/rooms.json','utf8'));
const Q=METRO.stations.qinghe,Y=METRO.stations.yunhai,EXITS=CITY.metroStation.exits;
const SAVE_KEY='little-mandarin-town.v1';

/** A save from the build before the card (version 7): tickets in `metro.rides` become credit on load.
 *  `metro:check` is the station attendant's check (src/core/unlock.js): the metro is open. */
async function seed(page,profile={}){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:7,wallet:60,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter','metro:check'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},tutorial:{done:true},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...profile,
  })]);
}
async function start(page){
  await page.getByRole('button',{name:'开始旅行',exact:true}).click();
  const welcome=page.locator('#roots-welcome-close');if(await welcome.isVisible())await welcome.click();
  await page.waitForFunction(()=>window.__qinghe?.town&&!window.__qinghe.town.paused);
  await page.mouse.click(700,500);   // the world takes the keyboard
  await page.waitForTimeout(400);    // and the pointer lock that follows drops held keys: let it land first
}
const open=async page=>{await page.goto('/');await start(page);};
const reload=async page=>{await page.reload();await start(page);};
const place=page=>page.evaluate(()=>window.__qinghe.town.place);
/** Where the tourist is, in the current room's own metres, how high, and how many jumps (doors, warps) so far. */
const spot=page=>page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return {x:p.x-(t.rooms.get(t.place)?.offsetX??0),y:t.playerY,z:p.z,warps:t.warps};});
const train=(page,id)=>page.evaluate(id=>{const s=window.__qinghe.town.transit.get(id);return {state:s.state,open:s.open};},id);
const card=page=>page.evaluate(()=>{const p=window.__qinghe.profile,m=p.metro??{};return {wallet:p.wallet,balance:m.balance??0,trips:m.trips??0,journey:m.journey??null};});
const face=(page,yaw)=>page.evaluate(yaw=>{const t=window.__qinghe.town;t.yaw=yaw;t.pitch=-4;},yaw);
/** Hold a key until the tourist's spot passes `done`. */
async function walk(page,key,done,timeout=20000){
  await page.keyboard.down(key);
  try{await expect.poll(async()=>done(await spot(page)),{timeout,intervals:[50]}).toBe(true);}
  catch(error){console.log('stuck at',JSON.stringify(await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition(),r=t.rooms.get(t.place);return {place:t.place,x:p.x-(r?.offsetX??0),y:t.playerY,z:p.z,keys:[...t.keys],paused:t.paused,panel:window.__qinghe.ui.panelId,state:t.transit.get(t.place)?.state,near:t.registry.boxes.filter(b=>b.solid&&b.place===t.place&&Math.abs(b.x-p.x)<b.hw+.5&&Math.abs(b.z-p.z)<b.hd+.5&&b.y1>t.playerY&&b.y0<t.playerY+1.7).map(b=>[b.x-(r?.offsetX??0),b.z,b.hw,b.hd,b.y0,b.y1,b.name?.id])};})));throw error;}
  finally{await page.keyboard.up(key);}
  await page.waitForTimeout(250);
}
/** Hold a key for a while (into something that should not give) and say where that got you. */
async function push(page,key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await page.waitForTimeout(250);return spot(page);}
/** Down the entrance on the square into 青禾站: you come in at street level, at the top of its stairs. */
async function intoQinghe(page){
  await page.evaluate(()=>window.__qinghe.town.warp(-7.5,12.2,180));
  await expect(page.locator('#interact span')).toHaveText('进站 · Enter station');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('metro-platform');
}
/** Walk up to the gates (down the stairs first, at 青禾站), tap in at the reader (topping up first if asked), and close the machine. */
async function tapIn(page,gate,topUp=0){
  await walk(page,'w',s=>s.z<gate+1.7);
  await expect(page.locator('#interact span')).toHaveText('刷卡 · Tap card');
  await page.keyboard.press('e');
  await expect(page.locator('#panel.panel-metro')).toBeVisible();
  if(topUp)await page.locator('#transit-topup-'+topUp).click();
  await page.locator('#transit-enter').click();
  await expect(page.locator('#panel')).toBeHidden();
  await page.waitForTimeout(400);   // the pointer re-lock after a panel closes drops held keys
}
/** Through the gates to the platform doors (down the stairs first, at 云海市中心站), the train in, and one walk through its doors. */
async function board(page,id,doors){
  await walk(page,'w',s=>s.z<doors+1.2);
  await page.evaluate(id=>window.__qinghe.town.transit.get(id).dock(),id);
  await walk(page,'w',s=>s.z<doors-1.2);
  await expect(page.locator('#metro-ride')).toBeVisible({timeout:45000});   // the doors keep their time open, then close
}
/** Out at 云海市中心站 by an exit: stand at its mouth in the hall and press E. */
const exitAt=(page,id)=>page.evaluate(id=>{
  const t=window.__qinghe.town,r=t.rooms.get('yunhai-central'),e=t.cityStation()&&[...t.targets()].find(g=>g.label.startsWith(id+'出口'));
  t.warp(e.x,e.z,0,e.y);return e.label;
},id);

test('the entrance on the square leads down into 青禾站, and nobody outside sells tickets',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page);await open(page);
  // Round the entrance: its door, and no clerk, ticket window or second station's door.
  const near=await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(-7.5,11,180);return t.targets().filter(g=>Math.hypot(g.x+7.5,g.z-12)<8).map(g=>g.id);});
  expect(near).toContain('door:metro-platform');
  expect(near.filter(id=>/metro|ticket|yunhai|^staff:|^city:/.test(id)&&id!=='door:metro-platform')).toEqual([]);
  await intoQinghe(page);
  await expect(page.locator('.location b')).toHaveText(ROOMS['metro-platform'].zh);
  // In at street level, at the top of the stairs down.
  expect(await spot(page)).toMatchObject({y:ROOMS['metro-platform'].upper.y});
  // Tapped in, then straight back up the stairs and out of the street door: the hold goes, nothing is charged.
  await tapIn(page,Q.gate,10);
  expect((await spot(page)).y,'down the stairs to the concourse').toBe(0);
  expect((await card(page)).journey?.phase).toBe('reserved');
  await face(page,180);
  await walk(page,'w',s=>s.z>13.2);
  expect((await spot(page)).y,'back up on the street level').toBe(ROOMS['metro-platform'].upper.y);
  await expect(page.locator('#interact span')).toHaveText('出去');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('town');
  expect(await card(page)).toMatchObject({wallet:50,balance:10,journey:null});
  expect(errors).toEqual([]);
});

test('down the stairs, tap in, through the gates and aboard; the ride, then up into 云海市中心站 and out by exit A',async({page})=>{
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,{wallet:30});await open(page);
  await intoQinghe(page);
  const warps=(await spot(page)).warps;
  // The gates hold until you tap in.
  await walk(page,'w',s=>s.z<Q.gate+1.7);
  expect((await push(page,'w',1200)).z).toBeGreaterThan(Q.gate+.3);
  await page.keyboard.press('e');
  await page.locator('#transit-topup-10').click();
  await expect(page.locator('#transit-balance')).toHaveText('10');
  await page.locator('#transit-enter').click();
  await page.waitForTimeout(400);
  expect(await card(page)).toMatchObject({wallet:20,balance:10,journey:{phase:'reserved',origin:'qinghe',destination:'yunhai',cost:5}});
  // Through to the platform doors: shut, and solid, until a train is in.
  await walk(page,'w',s=>s.z<Q.doors+1.2);
  // The train comes by the timetable (the platform board counts down to it); nothing happens until you step in.
  await expect.poll(()=>train(page,'metro-platform').then(s=>s.open),{timeout:90000,intervals:[500]}).toBe(true);
  await expect(page.locator('#metro-ride')).toHaveCount(0);
  expect((await spot(page)).warps,'every step from the entrance was walked').toBe(warps);
  await walk(page,'w',s=>s.z<Q.doors-1.2);
  await expect(page.locator('#metro-ride')).toBeVisible({timeout:45000});
  expect((await card(page)).journey.phase).toBe('riding');
  // You stay in the carriage: its own, up over the station, with the tunnel going by.
  await expect.poll(()=>spot(page).then(s=>s.y),{timeout:5000}).toBeGreaterThan(30);
  await page.getByRole('button',{name:'跳过 · Skip'}).click();
  await expect.poll(()=>place(page)).toBe('yunhai-central');
  expect(await card(page)).toMatchObject({wallet:20,balance:5,trips:1,journey:null});
  await expect(page.locator('.location b')).toHaveText('云海市中心站');
  expect(await page.evaluate(()=>window.__qinghe.profile.completed.includes('metro:first'))).toBe(true);
  // Off through the open doors, up the stairs, out through the gates (they let anyone off the platform out), across the hall.
  const off=(await spot(page)).warps;
  await walk(page,'w',s=>s.z>Y.gate+1.5,30000);
  expect((await spot(page)).y,'up in the hall').toBe(ROOMS['yunhai-central'].upper.y);
  await walk(page,'w',s=>s.z>18.5);
  await expect(page.locator('#interact span')).toHaveText(`${EXITS[0].zh} · ${EXITS[0].to.zh} · ${EXITS[0].to.en}`);
  expect((await spot(page)).warps).toBe(off);
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('city');
  const out=await spot(page);
  expect(out.x).toBeCloseTo(EXITS[0].spawn[0],3);expect(out.z).toBeCloseTo(EXITS[0].spawn[1],3);
  expect((await card(page)).balance,'getting out costs nothing more').toBe(5);
  expect(errors).toEqual([]);
});

test('each exit leads to its own spot in the city, and each spot back in by the same exit',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page);await open(page);
  for(const exit of EXITS){
    await page.evaluate(()=>{const c=window.__qinghe;c.town.enterCity();c.town.leaveCity();c.syncPlace();});
    expect(await place(page)).toBe('yunhai-central');
    const label=await exitAt(page,exit.id);
    expect(label).toBe(`${exit.zh} · ${exit.to.zh} · ${exit.to.en}`);
    await expect(page.locator('#interact span')).toHaveText(label);
    await page.keyboard.press('e');
    await expect.poll(()=>place(page)).toBe('city');
    const out=await spot(page);
    expect(out.x,`out by ${exit.id}`).toBeCloseTo(exit.spawn[0],3);expect(out.z,`out by ${exit.id}`).toBeCloseTo(exit.spawn[1],3);
    // Straight back in from where you came out: at that exit's stairs, up in the hall.
    await expect(page.locator('#interact span')).toHaveText('进站 · Enter station');
    await page.keyboard.press('e');
    await expect.poll(()=>place(page)).toBe('yunhai-central');
    const back=await spot(page);
    expect(back.y).toBe(ROOMS['yunhai-central'].upper.y);
    expect(await page.evaluate(()=>{const t=window.__qinghe.town;return t.targets().filter(g=>g.id==='door:city').map(g=>g.label)[0];})).toBeTruthy();
    const nearest=await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();let best=null,d=1e9;for(const g of t.targets().filter(g=>g.id==='door:city')){const dd=Math.hypot(g.x-p.x,g.z-p.z);if(dd<d){d=dd;best=g.label;}}return best;});
    expect(nearest,`back in by ${exit.id}`).toBe(label);
  }
  expect(errors).toEqual([]);
});

test('a doorway holds the train only a moment and nobody is shut in; walking back out cancels the tap',async({page})=>{
  test.setTimeout(150000);
  await seed(page,{wallet:30});await open(page);
  await intoQinghe(page);await tapIn(page,Q.gate,10);
  await walk(page,'w',s=>s.z<Q.doors+1.2);
  await page.evaluate(()=>window.__qinghe.town.transit.get('metro-platform').dock());
  // Stand in the doorway without stepping aboard.
  await walk(page,'w',s=>s.z<Q.doors+.45);
  const before=(await spot(page)).warps;
  // The doors wait past their time, then see you back onto the platform, shut and leave without you.
  await expect.poll(()=>spot(page).then(s=>s.z),{timeout:METRO.timetable.open*1000+METRO.timetable.hold*1000+15000}).toBeGreaterThan(Q.doors+.8);
  expect((await spot(page)).warps).toBe(before+1);
  await expect.poll(()=>train(page,'metro-platform').then(s=>s.state),{timeout:10000}).toBe('departing');
  await expect(page.locator('#metro-ride')).toHaveCount(0);
  expect(await card(page)).toMatchObject({balance:10,journey:{phase:'reserved'}});
  // Changed your mind: back out through the gates. The tap goes and nothing was charged.
  await face(page,180);
  await walk(page,'w',s=>s.z>Q.gate+1.2);
  expect(await card(page)).toMatchObject({balance:10,wallet:20,journey:null});
  // And the gates are shut to you again.
  await face(page,0);
  expect((await push(page,'w',1500)).z).toBeGreaterThan(Q.gate+.3);
  // Nobody is left in the carriage's space either: stepping in with no fare holds the doors open.
  await page.evaluate(()=>{const t=window.__qinghe.town,r=t.rooms.get('metro-platform'),s=t.transit.get('metro-platform');s.dock();t.warp(r.offsetX,s.layout.dz+1.3,0);});
  await walk(page,'w',s=>s.z<Q.doors-1.2);
  await page.waitForTimeout((METRO.timetable.open+METRO.timetable.closing+2)*1000);
  expect((await train(page,'metro-platform')).open,'held open for someone who is not travelling').toBe(true);
  await face(page,180);
  await walk(page,'w',s=>s.z>Q.doors+1);
  await expect.poll(()=>train(page,'metro-platform').then(s=>s.state),{timeout:15000}).toBe('departing');
  expect(await card(page)).toMatchObject({balance:10,trips:0,journey:null});
});

test('the way home: into 云海市中心站 from the street, old ticket credit, always fade, and up the stairs onto the square',async({page})=>{
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // One unused single ticket from before the card: six coins of credit, and not a coin in the wallet.
  await seed(page,{wallet:0,metro:{rides:1,trips:2,heard:2}});await open(page);
  expect(await card(page)).toMatchObject({balance:6,trips:2,wallet:0});
  await page.evaluate(([x,z])=>{const c=window.__qinghe;c.town.enterCity();c.syncPlace();c.town.warp(c.town.rooms.get('city').offsetX+x,z,180);},EXITS[0].spawn);
  await expect(page.locator('#interact span')).toHaveText('进站 · Enter station');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('yunhai-central');
  await walk(page,'w',s=>s.z<Y.gate+1.7);
  await page.keyboard.press('e');
  await page.locator('#transit-fade').check();
  await page.locator('#transit-enter').click();
  await page.waitForTimeout(400);
  await walk(page,'w',s=>s.z<Y.doors+1.2,30000);
  expect((await spot(page)).y,'down on the platform').toBe(0);
  await page.evaluate(()=>window.__qinghe.town.transit.get('yunhai-central').dock());
  await walk(page,'w',s=>s.z<Y.doors-1.2);
  // Always fade: through in a moment, to the same platform and the same fare as riding it out.
  await expect.poll(()=>place(page),{timeout:45000}).toBe('metro-platform');
  expect(await card(page)).toMatchObject({balance:1,trips:3,journey:null,wallet:0});
  expect(await page.evaluate(()=>window.__qinghe.profile.metro.fade)).toBe(true);
  // Off the train, out through the gates and up the stairs you came down.
  await walk(page,'w',s=>s.z>Q.gate+1.5);
  await walk(page,'w',s=>s.z>13.2);
  await expect(page.locator('#interact span')).toHaveText('出去');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('town');
  expect(errors).toEqual([]);
});

test('the ride: each line shows as its clip starts, replay waits, one coin for the right stop, and skipping pays none',async({page})=>{
  test.setTimeout(180000);
  await seed(page,{wallet:30});await open(page);
  // The voice is stood in for: what was played, and what the strip said as it started.
  await page.evaluate(()=>{const v=window.__qinghe.voice;window.__heard=[];v.available=()=>true;v.play=id=>{window.__heard.push([id,document.querySelector('#metro-ride .announce-zh')?.textContent??null]);return Promise.resolve();};});
  await intoQinghe(page);await tapIn(page,Q.gate,20);await board(page,'metro-platform',Q.doors);
  await expect(page.locator('.announce-zh')).toHaveText(METRO.lines['next-city'].zh,{timeout:20000});
  await page.locator('.metro-replay').click();
  const choices=page.locator('.announce-quiz [data-stop]');
  await expect(choices).toHaveCount(3,{timeout:40000});
  const heard=await page.evaluate(()=>window.__heard.filter(([id])=>id.startsWith('metro-')));
  expect(heard.filter(([id])=>id==='metro-next-city').length,'played again on Replay').toBeGreaterThanOrEqual(2);
  // Never a line behind: each line of the ride is already on the strip when its clip starts.
  for(const [id,shown] of heard.filter(([,shown])=>shown!==null))expect(shown,id).toBe(METRO.lines[id.slice(6)].zh);
  const order=heard.filter(([,shown])=>shown!==null).map(([id])=>id.slice(6));
  for(const key of ['hold','bound-city','next-city','get-ready','arrive-city','arrived','question'])expect(order,`${key} is said`).toContain(key);
  await choices.filter({hasText:'莲池公园'}).click();
  expect((await card(page)).wallet).toBe(10);
  await choices.filter({hasText:METRO.answers.city}).click();
  await expect.poll(()=>place(page)).toBe('yunhai-central');
  expect(await card(page)).toMatchObject({wallet:11,balance:15,trips:1});
  // Back the other way, skipped: the same fare, the same platform, and no coin.
  await face(page,180);
  await walk(page,'w',s=>s.z>Y.gate+1.2,30000);
  await face(page,0);
  await tapIn(page,Y.gate);await board(page,'yunhai-central',Y.doors);
  await page.getByRole('button',{name:'跳过 · Skip'}).click();
  await expect.poll(()=>place(page)).toBe('metro-platform');
  expect(await card(page)).toMatchObject({wallet:11,balance:10,trips:2});
});

test('the stations speak: a welcome on walking in and the doors closing, one line at a time',async({page})=>{
  test.setTimeout(120000);
  await seed(page);await open(page);
  await page.evaluate(()=>{const v=window.__qinghe.voice;window.__heard=[];v.available=()=>true;v.play=id=>{window.__heard.push(id);return Promise.resolve();};});
  await intoQinghe(page);
  await expect.poll(()=>page.evaluate(()=>window.__heard),{timeout:5000}).toContain('metro-welcome');
  await page.evaluate(()=>window.__qinghe.town.transit.get('metro-platform').dock());
  await expect.poll(()=>page.evaluate(()=>window.__heard),{timeout:(METRO.timetable.open+5)*1000}).toContain('metro-doors-closing');
});

test('a reload charges once and never leaves anyone on a train, whatever the journey was doing',async({page})=>{
  test.setTimeout(180000);
  await seed(page,{wallet:30});await open(page);
  // Tapped in: the reload lets the tap go.
  await intoQinghe(page);await tapIn(page,Q.gate,10);
  await reload(page);
  expect(await card(page)).toMatchObject({balance:10,journey:null});
  expect(await place(page)).toBe('town');
  // Mid-ride: the reload opens at the far platform, the fare taken once.
  await intoQinghe(page);await tapIn(page,Q.gate);await board(page,'metro-platform',Q.doors);
  await reload(page);
  expect(await place(page)).toBe('yunhai-central');
  expect(await card(page)).toMatchObject({balance:5,trips:1,journey:null});
  expect((await train(page,'yunhai-central')).open).toBe(true);
  await walk(page,'w',s=>s.z>Y.doors+1);
  // Just arrived: nothing more to pay.
  await reload(page);
  expect(await card(page)).toMatchObject({balance:5,trips:1,journey:null});
});

test('a save swapped in mid-ride, or saves that fail, still end with one fare each and nobody shut in',async({page})=>{
  test.setTimeout(180000);
  await seed(page,{wallet:30});await open(page);
  // Every save fails: the journey still runs and arrives once.
  await page.evaluate(()=>{const c=window.__qinghe;c.keptSave=c.save;c.save=()=>{throw Error('disk full');};});
  await intoQinghe(page);await tapIn(page,Q.gate,20);await board(page,'metro-platform',Q.doors);
  await page.getByRole('button',{name:'跳过 · Skip'}).click();
  await expect.poll(()=>place(page)).toBe('yunhai-central');
  expect(await card(page)).toMatchObject({balance:15,trips:1,journey:null});
  await page.evaluate(()=>{const c=window.__qinghe;c.save=c.keptSave;});
  // Mid-ride, another save takes over, itself on a train to 青禾: it arrives there once; the ride on
  // screen pays and charges nobody.
  await face(page,180);await walk(page,'w',s=>s.z>Y.gate+1.2,30000);await face(page,0);
  await tapIn(page,Y.gate);await board(page,'yunhai-central',Y.doors);
  await page.evaluate(()=>{const c=window.__qinghe,other=structuredClone(c.profile);
    other.metro={balance:20,trips:4,sequence:7,journey:{id:7,origin:'yunhai',destination:'qinghe',cost:5,phase:'riding'}};c.profile=other;});
  await expect.poll(()=>place(page)).toBe('metro-platform');
  await page.getByRole('button',{name:'跳过 · Skip'}).click();
  await expect(page.locator('#metro-ride')).toHaveCount(0);
  expect(await card(page)).toMatchObject({balance:15,trips:5,journey:null});
  await walk(page,'w',s=>s.z>Q.doors+1);
  // Mid-ride again, and this time the save that takes over was going nowhere: the traveller is set down
  // on the platform they left, with nothing charged to anyone.
  await walk(page,'w',s=>s.z>Q.gate+1.2);await face(page,0);
  await tapIn(page,Q.gate);await board(page,'metro-platform',Q.doors);
  await page.evaluate(()=>{const c=window.__qinghe,other=structuredClone(c.profile);delete other.metro;c.profile=other;});
  await page.getByRole('button',{name:'跳过 · Skip'}).click();
  await expect(page.locator('#metro-ride')).toHaveCount(0);
  await expect.poll(()=>spot(page).then(s=>s.z),{timeout:5000}).toBeGreaterThan(Q.doors+.5);
  expect(await spot(page)).toMatchObject({y:0});
  expect(await place(page)).toBe('metro-platform');
  expect(await card(page)).toMatchObject({balance:0,trips:0,journey:null});
});

test('short of coins: the machine says to study and opens the word bank, and the gates stay shut, at both ends',async({page})=>{
  await seed(page,{wallet:3});await open(page);
  for(const [id,gate,level] of [['metro-platform',Q.gate,Q.gateLevel],['yunhai-central',Y.gate,Y.gateLevel]]){
    await page.evaluate(id=>{const c=window.__qinghe;c.town.enterRoom(id);c.syncPlace();c.town.onInteract('metro');},id);
    await expect(page.locator('#transit-enter')).toBeDisabled();
    await expect(page.locator('#panel')).toContainText('study words to earn coins');
    for(const n of METRO.topUps)await expect(page.locator('#transit-topup-'+n)).toBeDisabled();
    await page.locator('#transit-study').click();
    await expect(page.locator('#panel.panel-wordbank')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(([id,gate,level])=>{const t=window.__qinghe.town,r=t.rooms.get(id);return [-1.5,0,1.5].some(x=>t.canMove(r.offsetX+x,gate,level));},[id,gate,level])).toBe(false);
  }
  expect(await card(page)).toMatchObject({wallet:3,balance:0,journey:null});
});

test('a quick second click on a top-up does not top up twice',async({page})=>{
  await seed(page,{wallet:40});await open(page);
  await page.evaluate(()=>{const c=window.__qinghe;c.town.enterRoom('metro-platform');c.syncPlace();c.town.onInteract('metro');});
  await page.locator('#transit-topup-10').dblclick();
  await expect(page.locator('#transit-balance')).toHaveText('10');
  expect(await card(page)).toMatchObject({wallet:30,balance:10});
});

test('云海市中心站 is the big one, and lines 2 and 3 are closed scenery that can neither charge nor carry anyone',async({page})=>{
  await seed(page);await open(page);
  const seen=await page.evaluate(([future,level])=>{
    const t=window.__qinghe.town,c=window.__qinghe;c.town.enterRoom('yunhai-central');c.syncPlace();
    const y=t.rooms.get('yunhai-central'),q=t.rooms.get('metro-platform'),area=r=>r.data.size[0]*r.data.size[1];
    const portals=y.root.find(e=>e.name==='future-line').length;
    // Right up against each closed entrance: nothing to press, and the shutter out of reach.
    const offers=[],reach=[];
    for(const f of future){const s=f.wall==='west'?-1:1;t.warp(y.offsetX+s*18.5,f.at,s*90,level);const p=t.player.entity.getPosition();offers.push(...t.targets().filter(g=>Math.hypot(g.x-p.x,g.z-p.z)<g.radius).map(g=>g.id));reach.push(t.canMove(y.offsetX+s*19.4,f.at,level));}
    return {bigger:area(y)/area(q),taller:y.data.height-q.data.height,portals,offers:[...new Set(offers)],reach};
  },[Y.future,Y.gateLevel]);
  expect(seen.bigger).toBeGreaterThan(2);
  expect(seen.taller).toBeGreaterThan(3);
  expect(seen.portals).toBe(Y.future.length);
  expect(seen.offers.filter(id=>/metro|door:|shop:|ticket/.test(id))).toEqual([]);
  expect(seen.reach).toEqual([false,false]);
});

test('the stations have no coplanar faces of different materials, with the train in and out',async({page})=>{
  await seed(page);await open(page);
  const found=await page.evaluate(()=>{
    const t=window.__qinghe.town,out={};
    const inPerson=e=>{for(let n=e;n;n=n.parent)if(n.name==='person')return true;return false;};
    // Bottom faces standing on a floor (the ground, or a station's upper level) are hidden against it.
    const faces=(root,level)=>{
      const list=[];
      for(const e of root.find(n=>!!n.render&&n.enabled)){
        const type=e.render.type;if((type!=='box'&&type!=='cylinder')||inPerson(e))continue;
        const m=e.getWorldTransform().data,axes=[0,1,2].map(c=>[m[c*4],m[c*4+1],m[c*4+2]]);
        const along=axes.map(a=>{const l=Math.hypot(...a);return a.findIndex(v=>Math.abs(Math.abs(v)/l-1)<1e-4);});
        if(along.includes(-1))continue;
        const mi=e.render.meshInstances[0],b=mi.aabb,c=b.center,h=b.halfExtents,lo=[c.x-h.x,c.y-h.y,c.z-h.z],hi=[c.x+h.x,c.y+h.y,c.z+h.z];
        for(const a of type==='box'?[0,1,2]:[along[1]])for(const s of [-1,1]){
          const plane=s<0?lo[a]:hi[a];
          if(a===1&&s<0&&(plane<.05||Math.abs(plane-level)<.05))continue;
          list.push({e,mat:mi.material===t.m.painted?e.render.material:mi.material,a,s,plane,lo,hi});
        }
      }
      return list;
    };
    const pairs=list=>{
      const bad=[];
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const p=list[i],q=list[j];
        if(p.a!==q.a||p.s!==q.s||p.e===q.e||p.mat===q.mat||Math.abs(p.plane-q.plane)>1e-3)continue;
        const [u,v]=[0,1,2].filter(k=>k!==p.a);
        if(Math.min(p.hi[u],q.hi[u])-Math.max(p.lo[u],q.lo[u])>1e-3&&Math.min(p.hi[v],q.hi[v])-Math.max(p.lo[v],q.lo[v])>1e-3)
          bad.push(`${'xyz'[p.a]}${p.s>0?'+':'-'} ${p.plane.toFixed(3)}: ${p.e.parent?.name}>${p.e.render.material?.diffuse?.toString()}/${q.e.parent?.name}>${q.e.render.material?.diffuse?.toString()} @${((p.lo[u]+p.hi[u])/2).toFixed(2)},${((p.lo[v]+p.hi[v])/2).toFixed(2)}`);
      }
      return bad;
    };
    for(const id of ['metro-platform','yunhai-central']){
      t.enterRoom(id);const room=t.rooms.get(id),s=t.transit.get(id);
      s.dock();s.update(0,false);out[id+' docked']=pairs(faces(room.root,room.data.upper?.y??0));
    }
    return out;
  });
  for(const [where,bad] of Object.entries(found))expect(bad,where).toEqual([]);
});

test('the city\'s way home is the station, at each exit\'s spot',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page);await open(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  const x=await page.evaluate(()=>window.__qinghe.town.rooms.get('city').offsetX);
  // No free ride from the street, and no old single way in: one 进站 at each exit, none elsewhere.
  const ins=await page.evaluate(()=>window.__qinghe.town.targets().filter(g=>g.id==='door:yunhai-central').map(g=>[g.x,g.z]));
  expect(ins.length).toBe(EXITS.length);
  EXITS.forEach((e,i)=>{expect(ins[i][0]).toBeCloseTo(x+e.spawn[0],3);expect(ins[i][1]).toBeCloseTo(e.spawn[1],3);});
  await page.evaluate(([x,z])=>window.__qinghe.town.warp(x,z,180),[x+EXITS[2].spawn[0],EXITS[2].spawn[1]]);
  await expect(page.locator('#interact span')).toHaveText('进站 · Enter station');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('yunhai-central');
  await expect(page.locator('#metro-ride')).toHaveCount(0);
  expect(await card(page)).toMatchObject({wallet:60,balance:0,trips:0});
  expect(errors).toEqual([]);
});
