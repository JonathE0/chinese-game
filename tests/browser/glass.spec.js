import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';

/**
 * W4-glass (docs/superpowers/plans/2026-09-30-development-wave-4.md): mirrors that reflect the room
 * and the tourist, clearer windows up 云海中心, and balconies you can walk out onto in 云海.
 * GLASS_SHOTS=<folder> saves screenshots of each.
 */
const R=JSON.parse(readFileSync('src/content/rental.json','utf8'));
const ROOMS=JSON.parse(readFileSync('src/content/rooms.json','utf8'));
const SAVE_KEY='little-mandarin-town.v1';
const SHOTS=process.env.GLASS_SHOTS;
if(SHOTS)mkdirSync(SHOTS,{recursive:true});
const ALBUM=['roots-fruit','roots-square','roots-home'];
const MIRRORS=Object.entries(ROOMS).flatMap(([room,r])=>(r.fittings??[]).map((f,index)=>({room,index,...f})).filter(f=>f.kind==='mirror'));
const FLATS=Object.keys(R.balcony.flats);

async function start(page,extra={}){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:100,inventory:{'secondhand-camera':1,film:6},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],roots:{started:true,discovered:ALBUM,photos:ALBUM},
    clock:12,dayIndex:0,vendors:{},stats:{hunger:80,energy:80,hour:12},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0,quality:'high'},playerName:'旅人',...extra,
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行',exact:true}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(()=>{const c=window.__qinghe;c.ui.close();c.town.sensitivity=0;c.town.daylight.paused=true;c.town.daylight.setHour(15);});
}
const game=(page,fn,arg)=>page.evaluate(fn,arg);
const frames=(page,n=20)=>game(page,n=>new Promise(done=>{let i=0;const tick=()=>++i>=n?done():requestAnimationFrame(tick);requestAnimationFrame(tick);}),n);
const pos=page=>game(page,()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();
  return {x:p.x-(t.rooms.get(t.place)?.offsetX??0),y:p.y,z:p.z,place:t.place};});
const nearest=page=>game(page,()=>window.__qinghe.town.nearest?.id??null);
const quality=(page,level)=>game(page,async level=>{const q=await import('/src/core/quality.js');q.setQuality(level);window.__qinghe.town.applyQuality();},level);
async function shot(page,name){
  if(!SHOTS)return;
  await page.waitForTimeout(300);
  await page.addStyleTag({content:'*{visibility:hidden !important} #world{visibility:visible !important}'});
  await page.screenshot({path:`${SHOTS}/${name}.png`});
  await game(page,()=>document.querySelectorAll('style').forEach(s=>{if(s.textContent.includes('#world{visibility'))s.remove();}));
}
/** Hold a key down for `ms`. */
async function hold(page,key,ms){await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await page.waitForTimeout(150);}

test('each mirror shows the room and all of the tourist, head too from their own eyes; one at a time, near, plain glass on 低',async({page})=>{
  test.setTimeout(120_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  expect(MIRRORS.length).toBeGreaterThanOrEqual(6);
  for(const m of MIRRORS){
    // Two metres in front of the glass, facing it, from your own eyes.
    const seen=await game(page,async m=>{
      const t=window.__qinghe.town,r=t.rooms.get(m.room),a=(m.rot??0)*Math.PI/180;
      t.enterRoom(m.room);t.setView('first');
      t.warp(r.offsetX+m.x+Math.sin(a)*2.2,m.z+Math.cos(a)*2.2,m.rot??0,m.y??0);t.pitch=-6;
      for(let i=0;i<20;i++)await new Promise(f=>requestAnimationFrame(f));
      const v=t.mirrors,cam=v.camera.camera,world=t.app.scene.layers.getLayerByName('World');
      const parts=e=>e.findComponents('render').flatMap(c=>c.meshInstances);
      const drawn=camera=>new Set(world.getCulledInstances(camera.camera).opaque);
      const inMirror=drawn(cam),inEyes=drawn(t.camera.camera);
      const from=v.frames;for(let i=0;i<5;i++)await new Promise(f=>requestAnimationFrame(f));
      return {on:cam.enabled,active:v.active?.fitting===r.fittings[m.index],frames:v.frames-from,
        head:parts(t.player.head).some(mi=>inMirror.has(mi)),body:parts(t.player.upper).some(mi=>inMirror.has(mi)),
        headInEyes:parts(t.player.head).some(mi=>inEyes.has(mi)),headShown:t.player.head.enabled};
    },m);
    expect(seen,`${m.room} #${m.index}`).toEqual({on:true,active:true,frames:5,head:true,body:true,headInEyes:false,headShown:false});
    // The picture in the glass changes when the tourist is not there: it is them in it. The glass's part
    // of the screen fills the texture's bottom-left corner (`rect`: its half size in NDC, its share of the screen).
    const diff=await game(page,async()=>{
      const t=window.__qinghe.town,rt=t.mirrors.rt,[,,hx,hy]=t.mirrors.rect;
      const read=()=>rt.colorBuffer.read(0,0,Math.floor(rt.width*hx),Math.floor(rt.height*hy),{renderTarget:rt,immediate:true});
      const wait=async n=>{for(let i=0;i<n;i++)await new Promise(f=>requestAnimationFrame(f));};
      const a=await read();t.player.entity.enabled=false;await wait(3);
      const b=await read();t.player.entity.enabled=true;await wait(3);
      let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>40)changed++;
      return changed/(a.length/4);
    });
    expect(diff,`${m.room} #${m.index}: share of the mirror's picture that is the tourist`).toBeGreaterThan(.03);
    await shot(page,`mirror-${m.room}-${m.index}`);
  }
  // What a mirror costs: the gym's, drawn and then left as plain glass, from the same spot.
  const cost=await game(page,async m=>{
    const t=window.__qinghe.town,q=await import('/src/core/quality.js'),r=t.rooms.get(m.room),a=(m.rot??0)*Math.PI/180;
    t.enterRoom(m.room);t.warp(r.offsetX+m.x+Math.sin(a)*2.2,m.z+Math.cos(a)*2.2,m.rot??0,0);t.pitch=-6;
    const wait=async n=>{for(let i=0;i<n;i++)await new Promise(f=>requestAnimationFrame(f));};
    const sample=async()=>{await wait(15);const calls=[],ms=[];let last=performance.now();
      for(let i=0;i<60;i++){await wait(1);const now=performance.now();ms.push(now-last);last=now;calls.push(t.app.stats.drawCalls.total);}
      const mid=a=>[...a].sort((x,y)=>x-y)[a.length>>1];return {calls:mid(calls),ms:+mid(ms).toFixed(2)};};
    const on=await sample(),k=q.RENDER[q.detail()].mirrorScale;q.RENDER[q.detail()].mirrorScale=0;
    const off=await sample();q.RENDER[q.detail()].mirrorScale=k;
    return {on,off};
  },MIRRORS.find(m=>m.room==='harbour-gym'));
  console.log('mirror cost (gym)',JSON.stringify(cost));
  // Out of reach, or turned away: nothing drawn.
  const off=await game(page,async m=>{
    const t=window.__qinghe.town,r=t.rooms.get(m.room),a=(m.rot??0)*Math.PI/180,wait=async()=>{for(let i=0;i<5;i++)await new Promise(f=>requestAnimationFrame(f));};
    t.enterRoom(m.room);t.warp(r.offsetX+m.x+Math.sin(a)*2.2,m.z+Math.cos(a)*2.2,(m.rot??0)+180,0);await wait();
    const away=t.mirrors.camera.camera.enabled;
    t.leaveRoom();await wait();
    return {away,town:t.mirrors.camera.camera.enabled};
  },MIRRORS[0]);
  expect(off).toEqual({away:false,town:false});
  // 低: plain glass, no second camera.
  await quality(page,'low');
  const low=await game(page,async m=>{
    const t=window.__qinghe.town,r=t.rooms.get(m.room),a=(m.rot??0)*Math.PI/180;
    t.enterRoom(m.room);t.warp(r.offsetX+m.x+Math.sin(a)*2.2,m.z+Math.cos(a)*2.2,m.rot??0,0);
    for(let i=0;i<5;i++)await new Promise(f=>requestAnimationFrame(f));
    const glass=r.fittings[m.index].glass.render.meshInstances[0];
    return {on:t.mirrors.camera.camera.enabled,plain:glass.material!==t.mirrors.material};
  },MIRRORS[0]);
  expect(low).toEqual({on:false,plain:true});
  // 中: half the canvas.
  await quality(page,'medium');
  const half=await game(page,async m=>{
    const t=window.__qinghe.town,r=t.rooms.get(m.room),a=(m.rot??0)*Math.PI/180;t.warp(r.offsetX+m.x+Math.sin(a)*2.2,m.z+Math.cos(a)*2.2,m.rot??0,0);
    for(let i=0;i<5;i++)await new Promise(f=>requestAnimationFrame(f));
    const g=t.app.graphicsDevice;return {on:t.mirrors.camera.camera.enabled,w:t.mirrors.rt.width,canvas:g.width};
  },MIRRORS[0]);
  expect(half.on).toBe(true);expect(half.w).toBe(Math.floor(half.canvas/2));
  expect(errors).toEqual([]);
});

test('up 云海中心 the windows look out sharper, through a lighter haze, under the real sky; cost logged',async({page})=>{
  test.setTimeout(400_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await game(page,()=>window.__qinghe.town.ensureCity());
  // On 高 only: switching the graphics level rebuilds every shader, minutes in a headless browser.
  // tests/glass.test.js holds each level's window size.
  const measure=async(room,before)=>{
    return game(page,async([room,before,haze])=>{
      const t=window.__qinghe.town,v=t.views,q=await import('/src/core/quality.js'),r=t.rooms.get(room),[,d]=r.data.size;
      const saved=q.RENDER[q.detail()].towerScale,update=t.sky.update;
      if(before){q.RENDER[q.detail()].towerScale=2;t.sky.update=function(){const s=v.tower;v.tower=false;update.call(this);v.tower=s;};}
      if(t.place!==room)t.enterRoom(room);
      t.warp(r.offsetX,d/2-2.4,180,0);t.pitch=-4;
      const wait=async n=>{for(let i=0;i<n;i++)await new Promise(f=>requestAnimationFrame(f));};
      await wait(10);
      if(before){v.haze.start=140;v.haze.end=500;}else{v.haze.start=haze[0];v.haze.end=haze[1];}
      await wait(20);
      const calls=[],ms=[];let last=performance.now();
      for(let i=0;i<45;i++){await wait(1);const now=performance.now();ms.push(now-last);last=now;calls.push(t.app.stats.drawCalls.total);}
      const mid=a=>[...a].sort((x,y)=>x-y)[a.length>>1],g=t.app.graphicsDevice,cam=v.camera.getPosition(),sky=t.sky.root;
      const out={on:v.camera.camera.enabled,w:v.rt.width,canvas:g.width,haze:[v.camera.camera.fog?.start,v.camera.camera.fog?.end],
        sky:sky.enabled&&sky.getPosition().distance(cam)<1,calls:mid(calls),ms:+mid(ms).toFixed(2)};
      // Put back once the 'before' screenshot is taken.
      if(before)window.__glassRestore=()=>{q.RENDER[q.detail()].towerScale=saved;t.sky.update=update;v.haze.start=haze[0];v.haze.end=haze[1];};
      return out;
    },[room,before,R.tower.viewHaze]);
  };
  const cost={};
  for(const room of ['harbour-one-bed','harbour-view']){
    const old=await measure(room,true);
    await shot(page,`window-${room}-before`);
    await game(page,()=>window.__glassRestore());
    const now=await measure(room,false);
    await shot(page,`window-${room}-after`);
    expect(old,room).toMatchObject({on:true,sky:false,haze:[140,500]});
    expect(old.w).toBe(Math.floor(old.canvas/2));
    expect(now,room).toMatchObject({on:true,sky:true,haze:R.tower.viewHaze});
    expect(now.w,room).toBe(now.canvas);   // full size on 高
    cost[room]={before:old,after:now};
    console.log(room,JSON.stringify(cost[room]));
  }
  console.log('tower window cost',JSON.stringify(cost));
  // A shop's door onto the street keeps its half size and no sky.
  const shop=await game(page,async()=>{
    const t=window.__qinghe.town,r=t.rooms.get('cafe');t.enterRoom('cafe');t.warp(r.offsetX,r.data.size[1]/2-1.5,180);
    for(let i=0;i<10;i++)await new Promise(f=>requestAnimationFrame(f));
    return {on:t.views.camera.camera.enabled,tower:t.views.tower,sky:t.sky.root.enabled,fog:t.views.camera.camera.fog};
  });
  expect(shop).toEqual({on:true,tower:false,sky:false,fog:null});
  expect(errors).toEqual([]);
});

test('a flat\'s balcony door leads out onto a real balcony in 云海 and back; walled in, the camera works, a lapsed lease and a reload never strand you',async({page})=>{
  test.setTimeout(180_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,{rental:{id:FLATS[0],until:7,revision:1}});
  for(const id of FLATS){
    const def=R.balcony.flats[id],floor=def.y??0;
    await game(page,id=>{const t=window.__qinghe.town;t.ensureCity();t.enterRoom(id);},id);
    // At the glass door under the 阳台 sign: you cannot walk through it, but E takes you out.
    await game(page,([id,x,z,y])=>{const t=window.__qinghe.town;t.warp(t.rooms.get(id).offsetX+x,z-1.2,180,y);},[id,def.door.x,def.door.z,floor]);
    await hold(page,'w',900);
    expect((await pos(page)).z,`${id}: the door is shut to walking`).toBeLessThan(def.door.z-.3);
    await expect.poll(()=>nearest(page)).toBe('rental:balcony:'+id);
    await expect(page.locator('#interact:visible')).toContainText('去阳台');
    await page.keyboard.press('e');
    await expect.poll(()=>game(page,()=>window.__qinghe.town.place)).toBe('city');
    const b=await game(page,id=>{const t=window.__qinghe.town,p=t.player.entity.getPosition(),c=t.rooms.get('city');
      return {x:p.x-c.offsetX,y:p.y,z:p.z};},id);
    const tower=JSON.parse(readFileSync('src/content/city.json','utf8')).skyline.towers.find(t=>t.id===R.tower.id);
    const stop=R.stops.find(s=>s.room===id),y=R.tower.base+(stop.floor-1)*R.tower.storey+floor;
    expect(b.y,id).toBeCloseTo(y,1);
    expect(Math.abs(b.x-(tower.x+def.x))).toBeLessThan(.5);
    // Run at the railing and both side screens: you stay on the balcony, at its height.
    await game(page,()=>{window.__qinghe.town.yaw=180;});
    await hold(page,'w',1500);
    let p=await pos(page);
    expect(p.y,`${id}: still standing on it`).toBeCloseTo(y,1);
    expect(p.z,`${id}: stopped by the railing`).toBeLessThan(b.z+def.d);
    for(const yaw of [90,-90]){
      await game(page,yaw=>{window.__qinghe.town.yaw=yaw;},yaw);
      await page.keyboard.down('Shift');await hold(page,'w',2500);await page.keyboard.up('Shift');
      p=await pos(page);
      expect(p.y,`${id}: still up`).toBeCloseTo(y,1);
      expect(Math.abs(p.x-(tower.x+def.x)),`${id}: inside its screens`).toBeLessThan(def.w/2);
    }
    // The view, looking out over the city with no glass in the way, from your own eyes and from behind.
    await game(page,([x])=>{const t=window.__qinghe.town;t.warp(t.rooms.get('city').offsetX+x,t.player.entity.getPosition().z,180,t.playerY);t.pitch=-8;},[tower.x+def.x]);
    await shot(page,`balcony-${id}`);
    await game(page,()=>{window.__qinghe.town.pitch=-50;});
    await shot(page,`balcony-${id}-railing`);
    expect(await game(page,()=>window.__qinghe.town.setView('third'))).toBe('third');
    await frames(page,10);
    await shot(page,`balcony-${id}-third`);
    await game(page,()=>window.__qinghe.town.setView('first'));
    // A photo out there.
    if(id===FLATS[0]){
      await page.keyboard.press('c');
      await expect(page.locator('#viewfinder')).toBeVisible();
      await page.keyboard.press('Enter');
      await expect.poll(()=>page.evaluate(()=>new Promise(resolve=>{
        const open=indexedDB.open('qinghe-photos',1);open.onupgradeneeded=()=>open.result.createObjectStore('kv');
        open.onsuccess=()=>{const get=open.result.transaction('kv').objectStore('kv').get('photos');get.onsuccess=()=>{resolve(get.result?.length??0);open.result.close();};};
      })),{timeout:5000}).toBe(1);
      await page.keyboard.press('c');
      await expect(page.locator('#viewfinder')).toBeHidden();
    }
    // Back to the door, and in.
    await game(page,([x,z])=>{const t=window.__qinghe.town;t.warp(t.rooms.get('city').offsetX+x,z,0,t.playerY);},[tower.x+def.x,b.z]);
    await expect.poll(()=>nearest(page)).toBe('rental:balcony:'+id);
    await expect(page.locator('#interact:visible')).toContainText('回房间');
    await page.keyboard.press('e');
    await expect.poll(()=>game(page,()=>window.__qinghe.town.place)).toBe(id);
    p=await pos(page);
    expect(p.y).toBeCloseTo(floor,1);expect(p.z).toBeLessThan(def.door.z);
  }
  // The balconies from the far landing's plaza, standing out from the tower's face.
  await game(page,()=>{const t=window.__qinghe.town,c=t.rooms.get('city');t.enterRoom('city');t.warp(c.offsetX+20,-120,180,.36);t.yaw=0;t.pitch=30;});
  await shot(page,'balconies-from-below');
  // Down on the landing under the balconies, the tower's door is the only way in.
  await game(page,()=>{const t=window.__qinghe.town,c=t.rooms.get('city');t.enterRoom('city');t.warp(c.offsetX+20,-188.4,180,.36);});
  await frames(page,5);
  expect(await nearest(page)).not.toMatch(/^rental:balcony/);
  // A lapsed lease: out and back in all the same.
  const id=FLATS[0];
  await game(page,id=>{const c=window.__qinghe;c.profile.dayIndex=30;c.town.enterRoom(id);},id);
  await game(page,id=>window.__qinghe.town.onInteract('rental:balcony:'+id),id);
  expect(await game(page,()=>window.__qinghe.town.place)).toBe('city');
  await game(page,id=>window.__qinghe.town.onInteract('rental:balcony:'+id),id);
  expect(await game(page,()=>window.__qinghe.town.place)).toBe(id);
  // A reload out on the balcony starts you back on the ground, never up there.
  await game(page,id=>window.__qinghe.town.onInteract('rental:balcony:'+id),id);
  expect(await game(page,()=>window.__qinghe.town.place)).toBe('city');
  await game(page,()=>window.__qinghe.save());
  await page.reload();
  await page.getByRole('button',{name:'开始旅行',exact:true}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await frames(page,10);
  const after=await pos(page);
  expect(after.place).not.toBe('city');
  expect(after.y).toBeLessThan(5);
  expect(errors).toEqual([]);
});
