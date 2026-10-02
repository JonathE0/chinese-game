import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';

/**
 * 海景公寓 in 云海中心 across the bay (wave 4, W4-apartments): the ferry over, the tower's entrance
 * on the far landing, the lobby and its front desk, the lift, the flats, the amenities and the view
 * from every window. RENTAL_SHOTS=<folder> saves screenshots of each.
 */
const R=JSON.parse(readFileSync('src/content/rental.json','utf8'));
const H=JSON.parse(readFileSync('src/content/harbour.json','utf8'));
const CITY_FAR=JSON.parse(readFileSync('src/content/city.json','utf8')).place.farClip;
const SAVE_KEY='little-mandarin-town.v1';
const SHOTS=process.env.RENTAL_SHOTS;
if(SHOTS)mkdirSync(SHOTS,{recursive:true});
const unit=tier=>R.units.find(u=>u.tier===tier);
const studio=unit(1);

async function start(page,extra={}){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:100,inventory:{'floor-rug':1},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:12,dayIndex:0,vendors:{},stats:{hunger:80,energy:80,hour:12},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',...extra,
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行',exact:true}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(()=>{const c=window.__qinghe;c.ui.close();c.town.sensitivity=0;});
}
const game=(page,fn,arg)=>page.evaluate(fn,arg);
/** Where the tourist stands, in the current place's own metres. */
const pos=page=>game(page,()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();
  return {x:p.x-(t.rooms.get(t.place)?.offsetX??0),y:p.y,z:p.z,place:t.place};});
const prompt=page=>page.locator('#interact:visible span');
const nearest=page=>game(page,()=>window.__qinghe.town.nearest?.id??null);
/**
 * Walk (W, Shift to run) straight along one axis until `axis` reaches `target`. Only the heading is
 * set; the feet do the rest, so a wall, a gap in the collision or an unreachable spot shows up as
 * the walk stalling, which fails the test with where it stuck.
 */
async function walk(page,axis,target,{run=true,tol=.25}={}){
  const from=await pos(page),dir=Math.sign(target-from[axis]),left=p=>(target-p[axis])*dir;
  if(Math.abs(target-from[axis])<=tol)return from;
  await game(page,yaw=>{const t=window.__qinghe.town;t.yaw=yaw;t.pitch=-4;},axis==='x'?(dir<0?90:-90):(dir<0?0:180));
  const stuck=p=>new Error(`walk stuck at ${p.x.toFixed(2)},${p.z.toFixed(2)} in ${p.place}, heading ${axis}→${target}`);
  if(run)await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  let last=from,moved=Date.now(),p=from;const began=Date.now();
  try{
    while(left(p=await pos(page))>(run?2:1)){
      if(Math.hypot(p.x-last.x,p.z-last.z)>.05){last=p;moved=Date.now();}
      if(Date.now()-moved>2500||Date.now()-began>60000)throw stuck(p);
      await page.waitForTimeout(30);
    }
  }finally{await page.keyboard.up('w');if(run)await page.keyboard.up('Shift');}
  await page.waitForTimeout(400);
  for(let tries=0;left(p=await pos(page))>tol;tries++){
    if(tries>30)throw stuck(p);
    await page.keyboard.down('w');await page.waitForTimeout(70);await page.keyboard.up('w');await page.waitForTimeout(250);
  }
  return p;
}
/** Close the panel with Escape. A double click selects a word, and the first Escape then closes its
 *  look-up (src/ui/lookup.js) rather than the panel. */
const escape=page=>expect.poll(async()=>{await page.keyboard.press('Escape');return game(page,()=>window.__qinghe.ui.panelId??null);}).toBe(null);
/** Press E and wait to be somewhere else. */
async function through(page,id,place){
  await expect.poll(()=>nearest(page)).toBe(id);
  await page.keyboard.press('e');
  await expect.poll(()=>game(page,()=>window.__qinghe.town.place)).toBe(place);
  await page.waitForTimeout(150);
}
/** Stop the clock at `hour`, or step it on `seconds` of real time, a second a frame. */
const clock=(page,hour)=>game(page,h=>window.__qinghe.town.daylight.setHour(h),hour);
const advance=(page,seconds)=>game(page,seconds=>new Promise(done=>{
  const t=window.__qinghe.town;let left=seconds;
  const tick=()=>{if(left<=0)return done();const s=Math.min(1,left);left-=s;t.daylight.setHour(t.daylight.hour+s/60);requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
}),seconds);
async function shot(page,name){
  if(!SHOTS)return;
  await page.waitForTimeout(400);
  await page.addStyleTag({content:'*{visibility:hidden !important} #world{visibility:visible !important}'});
  await page.screenshot({path:`${SHOTS}/${name}.png`});
  await game(page,()=>document.querySelectorAll('style').forEach(s=>{if(s.textContent.includes('#world{visibility'))s.remove();}));
}
const profile=page=>game(page,()=>{const p=window.__qinghe.profile;return {wallet:p.wallet,dayIndex:p.dayIndex,rental:p.rental,inventory:p.inventory,home:p.home};});
/** Ride the lift from wherever we stand in the tower to `room`, through the car, by its panel. */
async function ride(page,room,{from}={}){
  if(from)await expect.poll(()=>nearest(page)).toBe(from);
  await page.keyboard.press('e');
  await page.locator(`[data-stop="${room}"]`).click();
  await expect.poll(()=>game(page,()=>window.__qinghe.town.place)).toBe(R.lift);
  await expect.poll(()=>game(page,()=>window.__qinghe.town.place),{timeout:15000}).toBe(room);
  await page.waitForTimeout(200);
}
/**
 * Stand back from the room's front glass and look out (`up`: on its upper floor, `x` across): the
 * view draws from the tower itself, at this floor's height, over 云海. Says where its camera stood
 * and what the frame cost.
 */
async function lookOut(page,name,{x=0,up=false,back=2.4}={}){
  const seen=await game(page,async([x,up,back])=>{
    const t=window.__qinghe.town,room=t.rooms.get(t.place),[,d]=room.data.size,y=up?room.data.upper.y:0;
    t.warp(room.offsetX+x,d/2-back,180,y);t.pitch=-4;
    for(let i=0;i<30;i++)await new Promise(r=>requestAnimationFrame(r));
    const v=t.views,view=v.views.get(t.place),cam=v.camera.getPosition(),city=t.rooms.get('city');
    return {on:v.camera.camera.enabled,city:!!view?.city,cityOn:city.root.enabled,x:cam.x-city.offsetX,y:cam.y,z:cam.z,
      far:v.camera.camera.farClip,calls:t.app.stats.drawCalls.total,
      // How far the view's projection actually draws (the engine builds it through views.project).
      drawsTo:(m=>{const c=v.clipped;v.clipped=false;v.project(m);v.clipped=c;return m.data[14]/(m.data[10]+1);})(v.camera.camera.projectionMatrix.clone())};
  },[x,up,back]);
  await shot(page,name);
  return seen;
}
/** From the landing into the lobby, as if we had walked in: the city, then the door. */
async function lobby(page){
  await game(page,id=>{const t=window.__qinghe.town;t.enterCity();t.onInteract('door:'+id);},R.lobby);
  await expect.poll(()=>game(page,()=>window.__qinghe.town.place)).toBe(R.lobby);
}

test('a whole stay: ferry over, in at the tower, rent at the desk, up by lift, furnish, sleep, lapse, renew, down and home',async({page})=>{
  test.setTimeout(300_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  // Aboard at the near pier with 13 s to go, across, and off on the far pier.
  await game(page,()=>{const t=window.__qinghe.town;t.enterCity();t.daylight.paused=true;});
  await clock(page,12+2/60);
  await game(page,([x,z])=>{const t=window.__qinghe.town;t.warp(t.rooms.get('city').offsetX+x,z,0,.03);},[22,-58.4]);
  await expect.poll(()=>nearest(page)).toBe('harbour:board:near');
  await page.keyboard.press('e');
  await expect.poll(()=>game(page,()=>window.__qinghe.town.harbour.riding)).toBe(true);
  await advance(page,20);await advance(page,H.ferry.crossing-7+2);
  await expect.poll(()=>nearest(page)).toBe('harbour:off');
  await page.keyboard.press('e');
  await expect.poll(()=>game(page,()=>window.__qinghe.town.harbour.riding)).toBe(false);
  expect((await profile(page)).wallet).toBe(100-H.ferry.fare);
  const warps=await game(page,()=>window.__qinghe.town.warps);

  // On foot: up the far pier, across the landing round the plaza, to 云海中心's door.
  await walk(page,'x',50,{run:false});
  await walk(page,'z',-176,{run:false});   // between the landing's trees and the plaza's benches
  await walk(page,'x',23);
  await game(page,()=>{const t=window.__qinghe.town;t.yaw=0;t.pitch=14;});
  await shot(page,'tower-entrance');
  await walk(page,'z',-187.3,{run:false});
  await walk(page,'x',20,{run:false});
  await expect(prompt(page)).toHaveText(R.entrance.prompt);
  // The tower's front is solid: pressing on into it goes nowhere.
  await game(page,()=>{window.__qinghe.town.yaw=0;});
  await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');
  expect((await pos(page)).z).toBeGreaterThan(-188.6);
  await through(page,'door:'+R.lobby,R.lobby);
  await game(page,()=>{const t=window.__qinghe.town;t.yaw=0;t.pitch=10;});
  await shot(page,'lobby');

  // The front desk: the receptionist's welcome, the four flats, one payment however hard the button is clicked.
  await walk(page,'z',-1.9,{tol:.1});
  await walk(page,'x',-4.2,{run:false});
  await expect(prompt(page)).toHaveText('前台 · Front desk');
  await page.keyboard.press('e');
  const desk=page.locator('#panel-body');
  await expect(desk).toContainText(R.lines['desk-welcome'].zh);
  await expect(desk).toContainText('No active lease');
  for(const u of R.units)await expect(desk).toContainText(`${u.price} coins for ${R.days} in-game days`);
  await page.locator(`[data-unit="${studio.id}"]`).dblclick();await page.locator('#confirm-rent').dblclick();
  await expect(desk).toContainText(`${R.days} in-game days remaining`);
  await expect(desk).toContainText(R.lines['desk-lift'].zh);
  expect((await profile(page)).wallet).toBe(100-H.ferry.fare-studio.price);
  await expect(page.locator(`[data-unit="${studio.id}"]`)).toBeDisabled();   // paid up: no second term yet
  await escape(page);

  // The lift: its bank, its panel, the car (doors, 电梯上行, the floors going by, the chime, 八楼到了) and out.
  await walk(page,'x',4.5);
  await walk(page,'z',-5.2,{run:false});
  await expect(prompt(page)).toHaveText('电梯 · Lift');
  await page.keyboard.press('e');
  const floors=page.locator('[data-stop]');
  await expect(floors).toHaveCount(R.stops.length);
  await expect(page.locator(`[data-stop="${R.units[1].id}"]`)).toBeDisabled();   // not our flat
  await expect(page.locator(`[data-stop="${R.amenities.find(a=>a.tier===2).id}"]`)).toBeDisabled();   // above our tier
  await page.locator(`[data-stop="${studio.id}"]`).click();
  await expect.poll(()=>game(page,()=>window.__qinghe.town.place)).toBe(R.lift);
  await expect(page.locator('#toast')).toContainText(R.lines['lift-up'].zh,{timeout:5000});
  await page.waitForTimeout(900);
  await game(page,()=>{const t=window.__qinghe.town;t.yaw=180;t.pitch=6;});
  await shot(page,'lift-car');
  await expect.poll(()=>game(page,()=>window.__qinghe.town.place),{timeout:15000}).toBe(studio.id);
  await expect(page.locator('#toast')).toContainText(R.stops.find(s=>s.room===studio.id).arrive.zh);

  // The flat: its window looks out from the eighth floor of the tower itself.
  const view=await lookOut(page,'studio-view');
  expect(view).toMatchObject({on:true,city:true,cityOn:true});
  expect(view.y).toBeCloseTo(R.tower.base+7*R.tower.storey+1.6,0);
  expect(view.z).toBeLessThan(-188.6);expect(view.far).toBeGreaterThan(400);
  // Furnish one position with the rug we own.
  await walk(page,'z',-2,{run:false});
  await walk(page,'x',-3,{run:false});
  await expect(prompt(page)).toHaveText('布置房间');
  await page.keyboard.press('e');
  await page.locator('[data-slot="rug"]').click();
  await page.locator('[data-choose="floor-rug"]').click();
  await expect.poll(async()=>(await profile(page)).home.filter(r=>r.room===studio.id&&r.item==='floor-rug').length).toBe(1);
  await page.keyboard.press('Escape');
  // To the bed, and sleep in it.
  await walk(page,'z',-1.5,{run:false});
  await walk(page,'x',3,{run:false});
  await game(page,()=>{window.__qinghe.town.yaw=0;});   // turn to face the bed
  await expect(prompt(page)).toHaveText('Rest in your rented room · 休息');
  await page.keyboard.press('e');
  await page.locator('[data-sleep="evening"]').click();
  await expect.poll(()=>game(page,()=>window.__qinghe.town.daylight.hour)).toBe(18.5);
  await expect(page.locator('#toast')).toContainText('You slept until evening');   // up again once the night has faded

  // The lease runs out while we are inside: nothing moves us, nothing is taken, the bed says why.
  const here=await pos(page);
  await game(page,()=>{const c=window.__qinghe;c.profile.dayIndex=c.profile.rental.until;c.save();c.ui.update?.();});
  // Up again beside the bed: turn back to it.
  await game(page,([bx,bz])=>{const t=window.__qinghe.town,p=t.player.entity.getPosition(),x=t.rooms.get(t.place).offsetX+bx;t.yaw=Math.atan2(-(x-p.x),-(bz-p.z))*180/Math.PI;},[3,-3]);
  await expect.poll(()=>nearest(page)).toBe('sleep');
  await page.keyboard.press('e');
  await expect(page.locator('#toast')).toContainText('lease has expired');
  expect(await pos(page)).toMatchObject({place:studio.id,x:here.x,z:here.z});
  expect((await profile(page)).home.filter(r=>r.room===studio.id)).toHaveLength(1);
  expect(await game(page,()=>window.__qinghe.town.beginPlacement({id:'floor-rug',kind:'rug',footprint:[2,2]}))).toBeFalsy();
  // Down by lift: our floor is shut to us now, the lobby is not.
  await walk(page,'x',0,{run:false});
  await walk(page,'z',-3.1,{run:false});
  await expect(prompt(page)).toHaveText('电梯 · Lift');
  await page.keyboard.press('e');
  await expect(page.locator(`[data-stop="${studio.id}"]`)).toBeDisabled();
  await page.locator(`[data-stop="${R.lobby}"]`).click();
  await expect.poll(()=>game(page,()=>window.__qinghe.town.place),{timeout:15000}).toBe(R.lobby);
  const out=await pos(page);expect(out.x).toBeCloseTo(R.rooms[R.lobby].arrive[0],2);expect(out.z).toBeCloseTo(R.rooms[R.lobby].arrive[1],2);
  // Renewing counts from today, is paid once, and the rug waited for us.
  await walk(page,'z',-1.9,{run:false,tol:.1});
  await walk(page,'x',-4.2);
  await page.keyboard.press('e');
  await expect(desk).toContainText('expired');
  const before=await profile(page);
  await page.locator(`[data-unit="${studio.id}"]`).dblclick();await page.locator('#confirm-rent').dblclick();
  await expect(desk).toContainText(`${R.days} in-game days remaining`);
  const after=await profile(page);
  expect(after.wallet).toBe(before.wallet-studio.price);
  expect(after.rental.until).toBe(before.dayIndex+R.days);
  expect(after.home.filter(r=>r.room===studio.id)).toHaveLength(1);
  await escape(page);

  // Out of the door, round the plaza and down the pier to the ferry.
  await walk(page,'x',0);
  await walk(page,'z',6.2,{run:false});
  await expect(prompt(page)).toHaveText('Return to ferry · 渡轮');
  await through(page,'door:city','city');
  await walk(page,'x',23,{run:false});
  await walk(page,'z',-176,{run:false});
  await walk(page,'x',50);
  await walk(page,'z',-157.4,{run:false});
  // Doors: in, the car and the flat going up, the car and the lobby (and its lift bank) coming down,
  // out; the one jump to the flat's window to look out, and up out of its bed after sleeping.
  expect(await game(page,()=>window.__qinghe.town.warps)).toBe(warps+9);
  await clock(page,12+47/60);   // docked at the far pier with 13 s to go
  await expect.poll(()=>nearest(page)).toBe('harbour:board:far');
  await page.keyboard.press('e');
  await expect.poll(()=>game(page,()=>window.__qinghe.town.harbour.riding)).toBe(true);
  await advance(page,20);await advance(page,H.ferry.crossing-7+2);
  await expect.poll(()=>nearest(page)).toBe('harbour:off');
  await page.keyboard.press('e');
  expect((await pos(page)).z).toBeGreaterThan(-60);
  expect((await profile(page)).wallet).toBe(100-2*H.ferry.fare-2*studio.price);
  expect(errors).toEqual([]);
});

test('each tier opens its own floors, and every flat, amenity and the lobby looks out over 云海 from its own height',async({page})=>{
  test.setTimeout(300_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,{wallet:5000});
  // The way in, seen from across the plaza: the canopy, the glass doors and the name over them.
  await game(page,()=>{const t=window.__qinghe.town;t.enterCity();t.daylight.paused=true;t.daylight.setHour(15.5);t.warp(t.rooms.get('city').offsetX+27,-175.5,27,.36);t.pitch=16;});
  await shot(page,'tower-entrance-plaza');
  await lobby(page);
  await clock(page,17.5);
  await game(page,()=>{const t=window.__qinghe.town;t.warp(t.rooms.get(t.place).offsetX,5.4,0);t.pitch=8;});
  await shot(page,'lobby-desk-and-lifts');
  const lobbyView=await lookOut(page,'lobby-view',{back:3});
  expect(lobbyView).toMatchObject({on:true,city:true});
  const calls={lobby:lobbyView.calls},tower=JSON.parse(readFileSync('src/content/city.json','utf8')).skyline.towers.find(t=>t.id===R.tower.id);
  let y0=0;const tiers=tower.tiers.map(([share,tall])=>{const t={w:tower.w*share,y0,y1:y0+tall};y0+=tall;return t;});
  const expectAt=(room,seen,up=0)=>{
    const stop=R.stops.find(s=>s.room===room),y=R.tower.base+(stop.floor-1)*R.tower.storey,tier=tiers.find(t=>y>=t.y0&&y<t.y1);
    expect(seen,room).toMatchObject({on:true,city:true,cityOn:true});
    // Out as far as the city's own camera sees, not the room's 200 m.
    expect(seen.drawsTo,room).toBeCloseTo(CITY_FAR,-1);
    expect(seen.y,room).toBeCloseTo(y+up+1.6,0);
    expect(seen.z,room).toBeLessThan(tower.z+tier.w/2+.35);   // behind the tier's own face: the oblique near plane cuts it away
    expect(seen.z,room).toBeGreaterThan(tower.z+tier.w/2-4);
  };
  for(const u of R.units){
    // Rent (or move to) this tier's flat at the desk, as a tenant would.
    await game(page,id=>{const c=window.__qinghe;if(c.town.place!==id){c.ui.close();c.town.enterRoom(id);}c.town.onInteract('rental');},R.lobby);
    await page.locator(`[data-unit="${u.id}"]`).click();await page.locator('#confirm-rent').click();
    await expect.poll(async()=>(await profile(page)).rental?.id).toBe(u.id);
    await page.keyboard.press('Escape');
    // The lift offers exactly what this tier opens.
    await game(page,()=>window.__qinghe.town.onInteract('rental:lift'));
    for(const s of R.stops){
      const amenity=R.amenities.find(a=>a.id===s.room),open=s.room===u.id||(amenity&&amenity.tier<=u.tier);
      if(s.room!==R.lobby)await expect(page.locator(`[data-stop="${s.room}"]`),`${u.id}: ${s.room}`)[open?'toBeEnabled':'toBeDisabled']();
    }
    await page.keyboard.press('Escape');
    await game(page,id=>{const t=window.__qinghe.town;t.rentalLift.ride(t.place,id);},u.id);
    await expect.poll(()=>game(page,()=>window.__qinghe.town.place),{timeout:15000}).toBe(u.id);
    await game(page,()=>{window.__qinghe.town.pitch=-10;});
    await shot(page,`${u.id}-room`);
    const seen=await lookOut(page,`${u.id}-view`);
    expectAt(u.id,seen);calls[u.id]=seen.calls;
    if(rooms(u.id).upper){
      await game(page,y=>{const t=window.__qinghe.town;t.warp(t.rooms.get(t.place).offsetX+1,-2.6,180,y);t.pitch=-10;},rooms(u.id).upper.y);
      await shot(page,`${u.id}-upstairs-room`);
      const upstairs=await lookOut(page,`${u.id}-upstairs-view`,{up:true,x:2.8});
      expectAt(u.id,upstairs,rooms(u.id).upper.y);calls[u.id+'-up']=upstairs.calls;
    }
    // Back to the lobby for the next desk visit.
    await game(page,id=>{const t=window.__qinghe.town;t.rentalLift.ride(t.place,id);},R.lobby);
    await expect.poll(()=>game(page,()=>window.__qinghe.town.place),{timeout:15000}).toBe(R.lobby);
  }
  // The penthouse opens every amenity: up to each, and look out.
  for(const a of R.amenities){
    await game(page,id=>{const t=window.__qinghe.town;t.rentalLift.ride(t.place,id);},a.id);
    await expect.poll(()=>game(page,()=>window.__qinghe.town.place),{timeout:15000}).toBe(a.id);
    await game(page,()=>{window.__qinghe.town.pitch=-10;});
    await shot(page,`${a.id}-room`);
    const seen=await lookOut(page,`${a.id}-view`);
    expectAt(a.id,seen);calls[a.id]=seen.calls;
  }
  console.log('draw calls',JSON.stringify(calls));
  // The window draws the city through its own crop: well inside what walking 云海 itself costs (downtown.spec, 900).
  for(const [where,n] of Object.entries(calls))expect(n,where).toBeLessThan(400);
  // Ordering at the rooftop restaurant is the restaurant menu, under the restaurant's own name.
  await game(page,()=>window.__qinghe.town.onInteract('rental:menu'));
  await expect(page.locator('#panel .eyebrow')).toContainText('屋顶餐厅');
  await expect(page.locator('[data-dish]').first()).toBeVisible();
  expect(errors).toEqual([]);
});
const ROOMS=JSON.parse(readFileSync('src/content/rooms.json','utf8'));
const rooms=id=>ROOMS[id];

test('moving to a bigger flat hands back the unused days once, and the old flat\'s furniture comes home to the inventory',async({page})=>{
  const rug={uid:'studio-rug',room:studio.id,item:'floor-rug',kind:'rug',color:'#aabbcc',footprint:[2,2],x:0,z:1,rot:0,slot:'rug'};
  await start(page,{wallet:500,dayIndex:3,rental:{id:studio.id,until:7,revision:1},home:[rug]});
  await lobby(page);
  await game(page,()=>window.__qinghe.town.onInteract('rental'));
  const one=unit(2),refund=Math.floor(studio.price*4/R.days);
  await expect(page.locator(`[data-unit="${one.id}"]`)).toContainText(`Move here · Pay ${one.price-refund} coins`);
  // The first click only asks: the flat, its price and term, what is left after paying, and what
  // happens to the old lease and its furniture. Cancel takes nothing.
  await page.locator(`[data-unit="${one.id}"]`).dblclick();
  const confirm=page.locator('#rental-confirm');
  await expect(confirm).toContainText('确认租房');
  for(const text of [one.zh,`${one.price} 学习币`,`${R.days} in-game days`,`付款后还剩 ${500-(one.price-refund)} 学习币`,
    `${studio.zh} lease ends today`,'4 unused days',`${refund} coins`,'inventory'])await expect(confirm).toContainText(text);
  expect((await profile(page)).wallet).toBe(500);
  await confirm.getByRole('button',{name:'取消'}).click();
  await expect(confirm).toBeEmpty();
  expect((await profile(page)).rental.id).toBe(studio.id);
  await page.locator(`[data-unit="${one.id}"]`).click();
  await page.locator('#confirm-rent').dblclick();
  await expect(page.locator('#panel-body')).toContainText(`${one.zh} · ${one.en}: ${R.days} in-game days remaining`);
  const p=await profile(page);
  expect(p.wallet).toBe(500-(one.price-refund));
  expect(p.rental).toEqual({id:one.id,until:3+R.days,revision:2});
  expect(p.home.some(r=>r.uid==='studio-rug')).toBe(false);
  expect(p.inventory['floor-rug']).toBe(1);
});

test('a lapsed lease survives reloads, keeps possessions, and a stale panel never charges the wrong profile',async({page})=>{
  test.setTimeout(90_000);
  const rug={uid:'rental-proof',room:studio.id,item:'floor-rug',kind:'rug',color:'#aabbcc',footprint:[2,2],x:0,z:1,rot:0,slot:'rug'};
  await start(page,{dayIndex:4,rental:{id:studio.id,until:5,revision:1},home:[rug]});
  await game(page,()=>window.__qinghe.town.onInteract('rental'));
  await expect(page.locator('#panel-body')).toContainText('1 in-game day remaining');
  await expect(page.locator('#panel-body')).toContainText(R.lines['desk-due'].zh);
  // A day passes in play and the game is closed; opening it again, the lease has lapsed, no more.
  await game(page,()=>{const c=window.__qinghe;c.profile.dayIndex=5;c.save();});
  await page.reload();
  await page.getByRole('button',{name:'开始旅行',exact:true}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  let p=await profile(page);
  expect(p).toMatchObject({dayIndex:5,wallet:100,rental:{until:5,revision:1}});
  expect(await page.locator('#journal-button').getAttribute('title')).toContain('Lease expired');
  // The lobby is open; the lift will not stop at the flat, and its door offers the desk instead.
  await game(page,()=>window.__qinghe.ui.close());
  await lobby(page);
  await game(page,()=>window.__qinghe.town.onInteract('rental:lift'));
  await expect(page.locator(`[data-stop="${studio.id}"]`)).toBeDisabled();
  await page.keyboard.press('Escape');
  await game(page,id=>window.__qinghe.town.onInteract('door:'+id),studio.id);
  expect(await game(page,()=>window.__qinghe.town.place)).toBe(R.lobby);
  await expect(page.locator('#panel-body')).toContainText('expired');
  // Taking the furniture back keeps it owned, and spare to place in the Qinghe home.
  await page.locator('#rental-recover').click();
  p=await profile(page);
  expect(p.inventory['floor-rug']).toBe(1);
  expect(p.home.some(r=>r.uid==='rental-proof')).toBe(false);
  // Another profile arrives (a cloud save, a folder restore) while the desk is open: the old panel
  // pays for nobody, and redraws for whoever is now playing.
  await game(page,()=>window.__qinghe.town.onInteract('rental'));
  await game(page,()=>{const c=window.__qinghe;c.old=c.profile;c.profile={...structuredClone(c.profile),wallet:50,rental:undefined};});
  await page.locator(`[data-unit="${studio.id}"]`).click();
  expect(await game(page,()=>[window.__qinghe.old.wallet,window.__qinghe.profile.wallet])).toEqual([100,50]);
  await expect(page.locator('#panel-body')).toContainText('No active lease');
  await expect(page.locator('#panel-body')).toContainText('Wallet: 50');
  // Too few coins: nothing is taken, and the way to earn more is named.
  await game(page,price=>{window.__qinghe.profile.wallet=price-1;},studio.price);
  await game(page,()=>window.__qinghe.town.onInteract('rental'));
  await page.locator(`[data-unit="${studio.id}"]`).click();
  await expect(page.locator('#toast')).toContainText('Not enough coins');
  expect((await profile(page)).wallet).toBe(studio.price-1);
});

test('furniture an older save left on the studio\'s kitchen, plant or doorway goes back to the inventory on load; the rest stays',async({page})=>{
  const chair=(uid,x,z)=>({uid,room:studio.id,item:'wooden-chair',kind:'chair',color:'#8a5a3c',footprint:[.55,.55],x,z,rot:0});
  const [ex,ez]=rooms(studio.id).exit;
  const home=[chair('on-kitchen',-4.2,.6),chair('on-plant',4.1,3.4),chair('in-doorway',ex,ez+.9),chair('fine',1.5,1.5),
    {uid:'rug-at-door',room:studio.id,item:'floor-rug',kind:'rug',color:'#aabbcc',footprint:[2.2,1.6],x:ex,z:ez+1,rot:0,slot:'rug'}];
  await start(page,{dayIndex:3,rental:{id:studio.id,until:20,revision:1},inventory:{'wooden-chair':4,'floor-rug':1},home});
  const p=await profile(page);
  expect(p.home.map(r=>r.uid).sort()).toEqual(['fine','rug-at-door']);
  expect(p.inventory).toMatchObject({'wooden-chair':4,'floor-rug':1});   // still owned, now spare
  expect(await game(page,id=>[...window.__qinghe.town.rooms.get(id).props.keys()].sort(),studio.id)).toEqual(['fine','rug-at-door']);
  // Nothing furnished through a flat's own slots is ever taken for misplaced.
  const slots=R.units.flatMap(u=>Object.entries(rooms(u.id).slots??{}).map(([id,s])=>({room:u.id,id,...s})));
  expect(await game(page,slots=>slots.filter(s=>window.__qinghe.town.misplaced(s.room,{kind:s.accepts[0],footprint:[1.5,1],x:s.x,z:s.z,rot:s.rot,y:s.y}))
    .map(s=>s.room+' '+s.id),slots)).toEqual([]);
});

test('decorating a flat for the first time introduces that flat, not the Qinghe home',async({page})=>{
  await start(page,{dayIndex:3,rental:{id:studio.id,until:20,revision:1},completed:['home:starter']});
  await game(page,id=>{const t=window.__qinghe.town;t.enterRoom(id);t.onInteract('decorate');},studio.id);
  await expect(page.locator('#panel .eyebrow')).toContainText(rooms(studio.id).zh);
  const panel=page.locator('#panel');
  await expect(panel).not.toContainText('这是你的家');
  await expect(panel).not.toContainText('回家');
  // Each step: never the house's upstairs bedroom or study, and its spots are this flat's own.
  for(let step=0;step<3;step++){
    await expect(panel).not.toContainText('书房');
    if(step===0)for(const s of Object.values(rooms(studio.id).slots))await expect(panel).toContainText(s.zh);
    await page.locator('#tut-next').click();
  }
  await expect(page.locator('[data-slot]').first()).toBeVisible();
});

test('a flat\'s built-in bed takes you in with the same lie-down as a bed you own, upstairs in the penthouse too',async({page})=>{
  const penthouse=unit(4).id;
  await start(page,{dayIndex:3,rental:{id:penthouse,until:20,revision:1}});
  // Every flat's nearest bed is its fitting.
  for(const u of R.units)expect(await game(page,id=>{const t=window.__qinghe.town,bed=t.rooms.get(id).fittings.find(f=>f.kind==='rentalbed');
    t.enterRoom(id);const front=t.onBed(bed,0,0,1.3);t.warp(front.x,front.z,bed.rot??0,bed.y??0);return t.bedHere()===bed;},u.id),u.id).toBe(true);
  // And sleeping in the penthouse's (upstairs) hops you onto it.
  await page.waitForTimeout(250);
  await page.keyboard.press('e');
  await page.locator('[data-sleep="night"]').click();
  await page.waitForTimeout(300);
  expect(await game(page,()=>!!window.__qinghe.town.sleeping)).toBe(true);
  await expect.poll(()=>game(page,()=>!!window.__qinghe.town.sleeping),{timeout:10000}).toBe(false);
});

test('up in the tower the windows still look out on 云海, but its drone show is not announced indoors',async({page})=>{
  await start(page,{dayIndex:3,rental:{id:studio.id,until:20,revision:1}});
  const frames=()=>game(page,()=>new Promise(done=>{let n=0;const tick=()=>++n>10?done():requestAnimationFrame(tick);tick();}));
  const at=hour=>game(page,hour=>{const t=window.__qinghe.town;t.daylight.paused=true;t.daylight.setHour(hour);},hour);
  await game(page,id=>{const t=window.__qinghe.town;t.announced=[];t.onAnnounce=line=>t.announced.push(line.audio);t.daylight.paused=true;t.daylight.setHour(19);t.enterCity();t.enterRoom(id);},studio.id);
  await at(20+.5/3600);await frames();
  const seen=await lookOut(page,'studio-during-the-show');
  expect(seen).toMatchObject({on:true,cityOn:true});
  await at(20+.8/3600);await frames();
  expect(await game(page,()=>window.__qinghe.town.announced)).toEqual([]);
  // Out in the city, the next time a show starts, it is.
  await game(page,()=>window.__qinghe.town.enterCity());
  await at(19.5);await frames();
  await at(20+1/3600);await frames();
  expect(await game(page,()=>window.__qinghe.town.announced)).toEqual(['drones-start']);
});

test('a lease that lapses during the ride leaves you in the car, and the car still takes you down to the lobby',async({page})=>{
  await start(page,{dayIndex:3,rental:{id:studio.id,until:4,revision:1}});
  await lobby(page);
  await game(page,id=>window.__qinghe.town.rentalLift.ride(window.__qinghe.town.place,id),studio.id);
  await expect.poll(()=>game(page,()=>window.__qinghe.town.place)).toBe(R.lift);
  await game(page,()=>{window.__qinghe.profile.dayIndex=4;});   // the day turns over mid-ride
  await expect.poll(()=>game(page,()=>window.__qinghe.town.rentalLift.riding),{timeout:15000}).toBe(false);
  expect(await game(page,()=>window.__qinghe.town.place)).toBe(R.lift);
  // The car's own panel: the lobby is always there, and it goes.
  await game(page,()=>{const c=window.__qinghe;c.ui.close();c.town.onInteract('rental:lift');});
  await page.locator(`[data-stop="${R.lobby}"]`).click();
  await expect.poll(()=>game(page,()=>window.__qinghe.town.place),{timeout:15000}).toBe(R.lobby);
});

test('the desk, the lift panel and the journal reminder read on a phone-sized screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await start(page,{dayIndex:3,rental:{id:studio.id,until:4,revision:1}});
  const inside=async sel=>{const box=await page.locator(sel).boundingBox();expect(box).not.toBeNull();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);};
  expect(await page.locator('#journal-button').getAttribute('data-due')).not.toBe('');
  await page.locator('#journal-button').click();
  await expect(page.locator('#panel-body .fare-state').first()).toContainText('1 in-game day left');
  await inside('#panel-body .fare-state >> nth=0');
  if(SHOTS)await page.screenshot({path:`${SHOTS}/journal-390.png`});
  await game(page,()=>{const c=window.__qinghe;c.ui.close();c.town.onInteract('rental');});
  for(const sel of [`[data-unit="${studio.id}"]`,`[data-unit="${unit(4).id}"]`,'#rental-recover','#rental-practice','#panel-body .fare-state'])await inside(sel);
  const fits=()=>game(page,()=>{const b=document.querySelector('#panel-body');return b.scrollWidth<=b.clientWidth;});
  expect(await fits()).toBe(true);
  if(SHOTS)await page.screenshot({path:`${SHOTS}/desk-390.png`});
  await game(page,()=>{const c=window.__qinghe;c.ui.close();c.town.onInteract('rental:lift');});
  for(const s of R.stops)await inside(`[data-stop="${s.room}"]`);
  expect(await fits()).toBe(true);
  if(SHOTS)await page.screenshot({path:`${SHOTS}/lift-panel-390.png`});
});

test('the desk\'s and the lift\'s lines have clips, and the rental practice takes a natural reply',async({page})=>{
  await start(page);
  const ids=[...R.lesson.nodes.map(n=>n.audio),...Object.keys(R.lines).map(k=>'rental-'+k),...R.stops.map(s=>'rental-lift-floor-'+s.floor)];
  expect(await game(page,ids=>ids.filter(id=>!window.__qinghe.voice.available(id)),ids)).toEqual([]);
  await game(page,()=>window.__qinghe.town.onInteract('rental'));
  await page.locator('#rental-practice').click();
  await page.locator('#answer').fill('请问我想租一间房谢谢');
  await page.locator('#answer-form').evaluate(form=>form.requestSubmit());
  await expect(page.locator('#next-line')).toBeVisible();
  expect((await profile(page)).wallet).toBe(100);   // practice is free and pays nothing
});

test('no two faces of different materials lie flush in the tower\'s entrance, the pieces of its rooms or the lift car',async({page})=>{
  test.setTimeout(120_000);
  await start(page,{wallet:5000});
  const found=await game(page,ids=>{
    const t=window.__qinghe.town;t.ensureCity();
    for(const id of ids)t.enterRoom(id);   // each is fitted out the first time it is entered
    // The checker of downtown.spec.js: every axis-aligned box face and cylinder cap, same-facing,
    // overlapping by more than a millimetre each way, of different materials.
    const faces=root=>{
      const out=[];
      // A piece of furniture from src/world/models.js (a nightstand) is that file's to check, wherever it stands.
      const own=e=>{for(let n=e;n&&n!==root;n=n.parent)if(n.name.startsWith('furniture-'))return false;return true;};
      for(const e of root.find(n=>!!n.render&&own(n))){
        const type=e.render.type;if(type!=='box'&&type!=='cylinder')continue;
        const m=e.getWorldTransform().data,axes=[0,1,2].map(c=>[m[c*4],m[c*4+1],m[c*4+2]]);
        const along=axes.map(a=>{const l=Math.hypot(...a);return a.findIndex(v=>Math.abs(Math.abs(v)/l-1)<1e-4);});
        if(along.includes(-1))continue;
        const mi=e.render.meshInstances[0],b=mi.aabb,c=b.center,h=b.halfExtents,lo=[c.x-h.x,c.y-h.y,c.z-h.z],hi=[c.x+h.x,c.y+h.y,c.z+h.z];
        for(const a of type==='box'?[0,1,2]:[along[1]])for(const s of [-1,1])
          out.push({e,mat:mi.material===t.m.painted?e.render.material:mi.material,a,s,plane:s<0?lo[a]:hi[a],lo,hi});
      }
      return out;
    };
    const bad=[];
    const groups=[['entrance',t.rooms.get('city').root.findByName('residences')],...ids.map(id=>[id,t.rooms.get(id).root.findByName('residence')])];
    for(const [where,g] of groups){
      const list=faces(g);
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const p=list[i],q=list[j];
        if(p.e===q.e||p.mat===q.mat||p.a!==q.a||p.s!==q.s||Math.abs(p.plane-q.plane)>1e-3)continue;
        const [u,v]=[0,1,2].filter(k=>k!==p.a);
        const du=Math.min(p.hi[u],q.hi[u])-Math.max(p.lo[u],q.lo[u]),dv=Math.min(p.hi[v],q.hi[v])-Math.max(p.lo[v],q.lo[v]);
        if(du>1e-3&&dv>1e-3)bad.push(`${where} ${'xyz'[p.a]}${p.s>0?'+':'-'} ${p.e.parent.name}/${q.e.parent.name} @${[0,1,2].map(k=>((p.lo[k]+p.hi[k])/2).toFixed(1)).join(',')}`);
      }
    }
    return {groups:groups.filter(([,g])=>g).length,bad:[...new Set(bad)].slice(0,20)};
  },[...new Set([R.lobby,R.lift,...R.stops.map(s=>s.room)])]);
  expect(found.groups).toBe(R.stops.length+2);   // the entrance, the car and every floor
  expect(found.bad).toEqual([]);
});
