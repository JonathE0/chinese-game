import {test,expect} from '@playwright/test';

// The two stations as a player sees them, and what they cost to draw. Screenshots go to SHOTS when it
// is set (they are for looking at, not for comparing).
const SHOTS=process.env.SHOTS;
const SAVE_KEY='little-mandarin-town.v1';
async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:7,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter','metro:check'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},tutorial:{done:true},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
  const welcome=page.locator('#roots-welcome-close');if(await welcome.isVisible())await welcome.click();
  await page.addStyleTag({content:'.topbar,.quest-card,.mini-map,.location,.controls,#crosshair,#look-hint,#tutorial-card,#toast,#interact,.nameplate{display:none!important}'});
}
/** Stand somewhere (room-local, at height y), look somewhere, let a few frames draw, and say how many draw calls that took. */
async function view(page,name,room,[x,z,yaw,pitch,y=0],setup=null){
  const calls=await page.evaluate(async([room,x,z,yaw,pitch,y,setup])=>{
    const c=window.__qinghe,t=c.town;if(room==='town'){if(t.place!=='town')t.leaveRoom();}else if(t.place!==room){t.enterRoom(room);c.syncPlace();}
    if(setup)new Function('t',setup)(t);
    t.warp((room==='town'?0:t.rooms.get(room).offsetX)+x,z,yaw,y);t.pitch=pitch;
    for(let i=0;i<20;i++)await new Promise(r=>requestAnimationFrame(r));
    return t.app.stats.drawCalls.total;
  },[room,x,z,yaw,pitch,y,setup]);
  if(SHOTS)await page.screenshot({path:`${SHOTS}/${name}.png`});
  return calls;
}

test('both stations draw cheaply, with the train in, from where a traveller stands',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const Q='metro-platform',Y='yunhai-central';
  const calls={
    'qinghe-entrance':await view(page,'qinghe-entrance','town',[-7.5,8.2,180,-3]),
    'qinghe-stairs':await view(page,'qinghe-stairs',Q,[1.2,12.4,8,-34,4]),
    'qinghe-concourse':await view(page,'qinghe-concourse',Q,[-3,4.6,20,-2]),
    'qinghe-platform':await view(page,'qinghe-platform',Q,[3,-2.4,15,-3],"t.transit.get('metro-platform').dock()"),
    'carriage':await view(page,'carriage',Q,[1.2,-10.3,-90,-4]),
    'yunhai-platform':await view(page,'yunhai-platform',Y,[-7,-12,30,4],"t.transit.get('yunhai-central').dock()"),
    'yunhai-stairs':await view(page,'yunhai-stairs',Y,[6,-9,160,12]),
    'yunhai-hall':await view(page,'yunhai-hall',Y,[0,19,0,6,5]),
    'yunhai-hall-back':await view(page,'yunhai-hall-back',Y,[3,6,160,6,5]),
    'yunhai-exit':await view(page,'yunhai-exit',Y,[-12,14,-60,4,5]),
  };
  console.log(JSON.stringify(calls));
  // The entrance is out in the town, so it costs what the restyled town costs from there (183 on
  // 2026-10-02, with 166-238 elsewhere in town); the station's hall below is held to 160.
  for(const [where,n] of Object.entries(calls))expect(n,where).toBeLessThan(where==='qinghe-entrance'?200:160);
  expect(errors).toEqual([]);
});

test('commuters board a standing train and leave with it, and the ride streams past the carriage windows',async({page})=>{
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  // A train in: people waiting behind the yellow line walk on while its doors are open.
  const boarded=await page.evaluate(async()=>{
    const c=window.__qinghe,t=c.town;t.enterRoom('metro-platform');c.syncPlace();
    const s=t.transit.get('metro-platform'),room=t.rooms.get('metro-platform'),dz=s.layout.dz;
    t.warp(room.offsetX-2.5,dz+3.6,-35);t.pitch=-4;
    const people=()=>room.root.children.filter(e=>e.name==='person'&&e.getLocalPosition().y>-10&&!e.findByName('hat')?.enabled);
    const waiting=()=>people().filter(e=>{const p=e.getLocalPosition();return p.z>dz+.8&&p.z<dz+2.4;}).length;
    const frames=async n=>{for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r));};
    for(let i=0;i<120&&waiting()<2;i++)await frames(30);
    const before=waiting();
    s.dock();await frames(300);
    const aboard=()=>people().filter(e=>e.getLocalPosition().z<dz-.3).length;
    for(let i=0;i<40&&aboard()<1;i++)await frames(10);
    return {walking:people().length,waiting:before,aboard:aboard()};
  });
  console.log(JSON.stringify(boarded));
  if(SHOTS)await page.screenshot({path:`${SHOTS}/commuters-boarding.png`});
  expect(boarded.walking).toBeGreaterThan(0);
  expect(boarded.aboard,'someone got on').toBeGreaterThan(0);
  // They leave with the train: once it has gone, nobody is left standing where the carriage was.
  const left=await page.evaluate(async()=>{
    const t=window.__qinghe.town,s=t.transit.get('metro-platform'),room=t.rooms.get('metro-platform'),dz=s.layout.dz;
    // By the clock, not by frames: a headless browser can draw 120 a second, and the doors alone take
    // 30 s (metro.json timetable open, closing and departing).
    for(const end=performance.now()+60000;s.state!=='away'&&performance.now()<end;)await new Promise(r=>requestAnimationFrame(r));
    return {state:s.state,inTrack:room.root.children.filter(e=>e.name==='person'&&e.getLocalPosition().y>-10&&e.getLocalPosition().z<dz-.3).length};
  });
  expect(left).toEqual({state:'away',inTrack:0});
  // The ride's own carriage, over the station, with the tunnel going by.
  const ride=await page.evaluate(async()=>{
    const t=window.__qinghe.town,s=t.transit.get('metro-platform'),room=t.rooms.get('metro-platform');
    t.warp(room.offsetX+6.5,s.layout.carZ+1.1,55);
    const r=s.startRide();t.pitch=-3;
    for(let i=0;i<150;i++)await new Promise(q=>requestAnimationFrame(q));
    const here=t.player.entity.getPosition();
    return {y:here.y,moving:r.moving,calls:t.app.stats.drawCalls.total};
  });
  if(SHOTS)await page.screenshot({path:`${SHOTS}/ride.png`});
  expect(ride.y).toBeGreaterThan(30);
  expect(ride.moving).toBe(true);
  expect(ride.calls).toBeLessThan(160);
  await page.evaluate(()=>window.__qinghe.town.transit.get('metro-platform').endRide());
  expect(await page.evaluate(()=>window.__qinghe.town.playerY)).toBeLessThan(1);
  expect(errors).toEqual([]);
});
