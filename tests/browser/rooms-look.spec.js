import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

/**
 * Every interior in the Jiangnan look (task W5-rooms, docs/superpowers/specs/2026-10-01-jiangnan-look-design.md,
 * phase P2): what each room costs to draw on 高, 中 and 低, seen from where you come in.
 *
 * Draw calls are counted with the room's staff hidden, so they are the room's own (people are another
 * task's). Frame times are medians of frames drawn with the GPU waited for (app.render, then a one-pixel
 * read); `entry` is the first frame after walking in a second time (whatever the batcher redoes then).
 * With SHOTS set it photographs every interior from its door and from its back half, on 高; with COSTS
 * set it writes every number to that file.
 */
const SHOTS=process.env.SHOTS,COSTS=process.env.COSTS;
const SAVE_KEY='little-mandarin-town.v1';
async function start(page,quality){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:7,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:10.5,dayIndex:0,vendors:{},tutorial:{done:true},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0,quality},playerName:'旅人'})]);
  await page.goto('/');await page.getByRole('button',{name:'开始旅行',exact:true}).click();await page.waitForFunction(()=>window.__qinghe?.town);
  const welcome=page.locator('#roots-welcome-close');if(await welcome.isVisible())await welcome.click();
  await page.addStyleTag({content:'.topbar,.quest-card,.mini-map,.location,.controls,#crosshair,#look-hint,#tutorial-card,#toast,#interact,#nameplate{display:none!important}'});
  // 云海 fits out the tower's rooms; should it fail to build, the rest are still measured.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.daylight.paused=true;try{t.ensureCity();}catch(e){console.warn('city: '+e.message);}});
}
const level=(page,value)=>page.evaluate(async value=>{
  const q=await import('/src/core/quality.js');q.setQuality(value);window.__qinghe.town.applyQuality();
},value);
/** The rooms the brief asks to be measured on every level; the rest are measured on 中. */
const KEY=['bakery','pharmacy','supermarket','library','restaurant','home','mall','harbour-one-bed'];
/** Draw calls on 中 before P2 (2026-10-01, the bare rooms), staff hidden, from each room's spawn; the
 *  spec's budget is ~30% more. Rooms its own module batches (the mall, the stations, the tower's) were
 *  already cheap; the others now draw in a fraction of these. Frame times are not held to a number:
 *  on a machine shared with other work they swing by a factor of two from one run to the next. */
const BEFORE={home:115,hall:289,lifestyle:177,cafe:176,supermarket:262,lights:126,restaurant:229,homeware:157,resale:132,bank:164,
  bakery:201,library:290,teahouse:183,'post-office':136,pharmacy:149,guesthouse:122,'clothes-shop':158,study:161,kitchen:89,hardware:333,
  reading:327,studyroom:220,listening:171,courtyard:200,'metro-platform':75,'city-bank':110,'city-bookshop':476,'city-hospital':206,
  'city-noodles':187,'city-cinema':136,'city-cinema-hall':187,'city-store':199,'city-cafe':162,mall:76,'yunhai-central':79,
  'riverside-lobby':36,'riverside-apartment':149,'harbour-lift':27,'harbour-cafe':158,'harbour-laundry':227,'harbour-gym':250,
  'harbour-one-bed':112,'harbour-garden':85,'harbour-pool':71,'harbour-view':69,'harbour-penthouse':65,'harbour-restaurant':43};

/** Into a room, at its spawn (or `back`: in its back half, looking at the front), at 10:30. */
async function stand(page,id,back=false){
  return page.evaluate(async([id,back])=>{
    const c=window.__qinghe,t=c.town;
    if(t.place!==id){t.enterRoom(id);c.syncPlace?.();}
    const room=t.rooms.get(id),[w,d]=room.data.size,[sx,sz,yaw]=room.data.spawn,y=room.data.upper?.entrance?room.data.upper.y:0;
    t.daylight.setHour(10.5);
    if(back){
      // Looking from there at the front wall, a little to the side of the door.
      const x0=room.offsetX+w*.18,z0=-d*.22,spot=t.canMove(x0,z0,y)?{x:x0,z:z0}:(t.nearestFreeSpot(x0,z0)??{x:x0,z:z0}),lx=spot.x-room.offsetX;
      t.warp(spot.x,spot.z,Math.atan2(lx+w*.12,-(d/2-spot.z))*180/Math.PI,y);
    } else t.warp(room.offsetX+sx,sz,yaw??0,y);
    t.pitch=-6;
    for(let i=0;i<20;i++)await new Promise(r=>requestAnimationFrame(r));
  },[id,back]);
}
/** The draw calls with and without the staff, the median frame, and the first frame of a second visit. */
const measure=(page,id)=>page.evaluate(async id=>{
  const c=window.__qinghe,t=c.town,app=t.app,gl=app.graphicsDevice.gl,room=t.rooms.get(id),px=new Uint8Array(4);
  const frame=()=>{const s=performance.now();app.render();const read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
    gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);return performance.now()-s;};
  const calls=app.stats.drawCalls.total;
  for(const m of room.staff??[])m.entity.enabled=false;
  for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));
  const own=app.stats.drawCalls.total,times=[];
  for(let i=0;i<15;i++)times.push(frame());
  for(const m of room.staff??[])m.entity.enabled=true;
  times.sort((a,b)=>a-b);
  // A second visit: out to the town and straight back in, then the first frame drawn.
  const p=t.player.entity.getPosition().clone(),yaw=t.yaw,y=t.playerY;
  t.leaveRoom();t.enterRoom(id);t.warp(p.x,p.z,yaw,y);t.pitch=-6;
  const entry=frame();
  for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));
  return {calls,own,ms:+times[times.length>>1].toFixed(2),entry:+entry.toFixed(1)};
},id);

test('every interior: what it costs to draw on each level, and how it looks',async({page})=>{
  test.setTimeout(1500000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await start(page,'high');
  const ids=await page.evaluate(()=>[...window.__qinghe.town.rooms.values()].filter(r=>!r.data.outdoor).map(r=>r.id));
  const costs={};
  for(const lv of ['high','medium','low']){
    await level(page,lv);
    for(const id of ids){
      if(lv!=='medium'&&!KEY.includes(id)&&!(lv==='high'&&SHOTS))continue;
      await stand(page,id);
      if(SHOTS&&lv==='high')await page.screenshot({path:`${SHOTS}/${id}.png`});
      (costs[id]??={})[lv]=await measure(page,id);
      if(SHOTS&&lv==='high'){await stand(page,id,true);await page.screenshot({path:`${SHOTS}/${id}-back.png`});}
    }
  }
  // The furniture the player buys, one of each kind set out in the home, photographed and put away.
  if(SHOTS){
    await level(page,'high');
    await page.evaluate(async()=>{
      const t=window.__qinghe.town,catalog=(await import('/src/content/catalog.json')).default,seen=new Set(),wall=['certificate','scroll-painting','landscape-painting'];
      if(t.place!=='home')t.enterRoom('home');
      const pieces=catalog.filter(i=>i.footprint&&i.kind&&!seen.has(i.kind)&&seen.add(i.kind));
      let x=-4.2,z=-.6,hang=-3;
      for(const [n,item] of pieces.entries()){
        const on=wall.includes(item.kind),[fw,fd]=item.footprint;
        const at=on?{x:(hang+=1.3),z:-4.48}:{x:x+fw/2,z};
        if(!on){x+=fw+.35;if(x>3.8){x=-4.2;z+=1.9;}}
        t.addProp('home',{uid:'show-'+n,item:item.id,kind:item.kind,color:item.color,footprint:item.footprint,x:at.x,z:at.z,rot:0});
      }
      t.daylight.setHour(10.5);t.warp(t.rooms.get('home').offsetX+.6,4.1,8);t.pitch=-20;
      for(let i=0;i<20;i++)await new Promise(r=>requestAnimationFrame(r));
    });
    await page.screenshot({path:`${SHOTS}/furniture.png`});
    await page.evaluate(()=>window.__qinghe.town.furnish('home',[]));
  }
  if(COSTS)writeFileSync(COSTS,JSON.stringify(costs,null,1));
  console.log('room costs:',JSON.stringify(Object.fromEntries(KEY.map(id=>[id,costs[id]]))));
  for(const id of ids)if(BEFORE[id])
    expect(costs[id].medium.own,`${id} on 中`).toBeLessThanOrEqual(Math.ceil(BEFORE[id]*1.3));
  // Every interior was dressed: its parts merged, its ceiling up where goods.json gives it one, and every
  // piece it gained named for the look-at by an objects.json key.
  const dressing=await page.evaluate(async()=>{
    const t=window.__qinghe.town,goods=(await import('/src/content/goods.json')).default,objects=(await import('/src/content/objects.json')).default.objects,out=[];
    for(const room of t.rooms.values()){
      if(room.data.outdoor)continue;
      if(!room.root.findByName('room-merged-still')&&!room.root.findByName('room-merged-cast'))out.push(room.id+': not merged');
      if(goods.rooms[room.id]?.ceiling&&!room.root.findByName('ceiling-works'))out.push(room.id+': no ceiling');
      room.root.forEach(e=>{if(e.parent?.name!==e.name&&/^(goods-|hanging-|wall-(pigeonholes|wallshelf)|ceiling-works)/.test(e.name)&&!objects[e.lookName])out.push(`${room.id}: ${e.name} has no name`);});
    }
    return out;
  });
  expect(dressing).toEqual([]);
  expect(errors).toEqual([]);
});

test('a trade\'s own things name themselves when looked at: 蒸笼, 筷子筒, 葫芦, 药材 and 格子',async({page})=>{
  await start(page,'low');
  // Aimed at from a standing eye a little way off, towards the middle of the room, the way the crosshair would be.
  const lookAt=(place,id)=>page.evaluate(([place,id])=>{
    const t=window.__qinghe.town;t.enterRoom(place);
    const room=t.rooms.get(place),box=t.registry.looks.find(b=>b.place===place&&b.name?.id===id);
    if(!box)return 'no '+id+' box';
    // The middle of its look box; the eye no higher than just under the ceiling, for what hangs from the beams.
    const c={x:box.x,y:(box.y0+box.y1)/2,z:box.z};
    let ax=room.offsetX-c.x,az=-c.z;const len=Math.hypot(ax,az)||1;ax/=len;az/=len;
    const eye={x:c.x+ax*1.2,y:Math.min(Math.max(c.y+.5,1.2),room.data.height-.3),z:c.z+az*1.2},d={x:c.x-eye.x,y:c.y-eye.y,z:c.z-eye.z},n=Math.hypot(d.x,d.y,d.z);
    return t.registry.look(place,eye,{x:d.x/n,y:d.y/n,z:d.z/n})?.box.name?.zh??null;
  },[place,id]);
  expect(await lookAt('bakery','steamer')).toBe('蒸笼');
  expect(await lookAt('restaurant','chopstick-holder')).toBe('筷子筒');
  expect(await lookAt('pharmacy','gourd')).toBe('葫芦');
  expect(await lookAt('pharmacy','herbs')).toBe('药材');
  expect(await lookAt('post-office','pigeonholes')).toBe('格子');
});
