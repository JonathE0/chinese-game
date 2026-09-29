import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

/**
 * 云海's harbour (docs/superpowers/plans/2026-09-27-development-wave-3.md, B-harbour): buy a ferry
 * ticket, ride across the bay, get off on the far landing, go once round on the Ferris wheel. The
 * harbour runs off the game clock, so the tests stop the clock and step it along a frame at a time.
 * HARBOUR_SHOTS=<folder> also saves screenshots of the harbour by day and by night.
 */
const H=JSON.parse(readFileSync('src/content/harbour.json','utf8'));
const SAVE_KEY='little-mandarin-town.v1',OX=-4000;
const SHOTS=process.env.HARBOUR_SHOTS;

async function start(page,{wallet=50,quality=null}={}){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:12,dayIndex:0,vendors:{},stats:{hunger:40,energy:80,hour:12},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  if(quality)await page.evaluate(q=>import('/src/core/quality.js').then(m=>m.setQuality(q)),quality);
  await page.evaluate(()=>{
    const t=window.__qinghe.town;t.enterCity();t.daylight.paused=true;
    t.announced=[];t.onAnnounce=line=>t.announced.push(line.audio);
  });
}
/** Stop the clock at `hour`, or step it on `seconds` of real time, `step` seconds a frame. */
const clock=(page,hour)=>page.evaluate(h=>window.__qinghe.town.daylight.setHour(h),hour);
const advance=(page,seconds,step=1)=>page.evaluate(([seconds,step])=>new Promise(done=>{
  const t=window.__qinghe.town;let left=seconds;
  const tick=()=>{if(left<=0)return done();const s=Math.min(step,left);left-=s;t.daylight.setHour(t.daylight.hour+s/60);requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
}),[seconds,step]);
const frames=(page,n=3)=>page.evaluate(n=>new Promise(done=>{let i=0;const tick=()=>++i>n?done():requestAnimationFrame(tick);tick();}),n);
const draws=page=>page.evaluate(()=>new Promise(done=>{
  const app=window.__qinghe.town.app;
  requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>done(app.stats.drawCalls.total))));
}));
const warp=(page,[x,z,yaw,y,pitch=-4])=>page.evaluate(([x,z,yaw,y,pitch])=>{const t=window.__qinghe.town;t.warp(x,z,yaw,y);t.pitch=pitch;},[OX+x,z,yaw,y,pitch]);
const nearest=page=>page.evaluate(()=>window.__qinghe.town.nearest?.id??null);
const player=page=>page.evaluate(([OX])=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();
  return {x:p.x-OX,y:p.y,z:p.z,wallet:window.__qinghe.profile.wallet,riding:t.harbour.riding,seated:!!t.seated,onWheel:t.harbour.onWheel};},[OX]);
async function shot(page,name){
  if(!SHOTS)return;
  await frames(page,3);
  await page.addStyleTag({content:'*{visibility:hidden !important} #world{visibility:visible !important}'});
  await page.screenshot({path:`${SHOTS}/${name}.png`});
  await page.evaluate(()=>document.querySelectorAll('style').forEach(s=>{if(s.textContent.includes('#world{visibility'))s.remove();}));
}
const cycle=2*(H.ferry.wait+H.ferry.crossing);

test('buy a ticket, cross the bay, get off on the far landing, and go once round the Ferris wheel',async({page})=>{
  test.setTimeout(150_000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  // Docked at the near pier with 13 s to go (noon is a whole number of cycles).
  expect(720%cycle).toBe(0);
  await clock(page,12+2/60);
  await warp(page,[22,-58.4,0,.03]);
  await expect.poll(()=>nearest(page)).toBe('harbour:board:near');
  await page.evaluate(()=>window.__qinghe.town.onInteract('harbour:board:near'));
  let me=await player(page);
  expect(me.wallet).toBe(50-H.ferry.fare);
  expect(me.riding).toBe(true);
  expect(me.z).toBeLessThan(-60.4);   // on the deck, past the pier head
  // The fare is taken once: asking again while aboard neither charges nor moves anyone.
  await page.evaluate(()=>window.__qinghe.town.onInteract('harbour:board:near'));
  expect((await player(page)).wallet).toBe(50-H.ferry.fare);
  // The deck is ground while you ride it; the water beside it and the cabin on it are not.
  const ground=await page.evaluate(([OX])=>{const t=window.__qinghe.town,f=t.harbour.ferry;
    return {deck:t.canMove(OX+f.x+2.4,f.z+5),water:t.canMove(OX+f.x+4.5,f.z+5),cabin:t.canMove(OX+f.x,f.z)};},[OX]);
  expect(ground).toEqual({deck:true,water:false,cabin:false});
  await shot(page,'ride-day-boarded');
  // Stepping back onto the pier before it leaves and boarding again is still the same ticket.
  await warp(page,[22,-57,0,.03]);await frames(page,2);
  expect((await player(page)).riding).toBe(false);
  await expect.poll(()=>nearest(page)).toBe('harbour:board:near');
  await page.evaluate(()=>window.__qinghe.town.onInteract('harbour:board:near'));
  me=await player(page);
  expect(me.riding).toBe(true);
  expect(me.wallet).toBe(50-H.ferry.fare);

  // All aboard, off it goes, and across: the ferry carries you with it.
  await advance(page,20);
  expect(await page.evaluate(()=>window.__qinghe.town.announced)).toContain('harbour-board');
  me=await player(page);
  expect(me.riding).toBe(true);
  expect(me.z).toBeLessThan(-75);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.setView('third');t.yaw=150;t.pitch=-18;});
  await shot(page,'ride-day-crossing-third');
  await page.evaluate(()=>{const t=window.__qinghe.town;t.setView('first');t.yaw=0;t.pitch=-2;});
  await advance(page,H.ferry.crossing-7+2);
  me=await player(page);
  expect(me.riding).toBe(true);
  expect(Math.abs(me.x-50)).toBeLessThan(4);
  expect(me.z).toBeLessThan(-139);
  expect(await page.evaluate(()=>window.__qinghe.town.announced)).toContain('harbour-arrive');
  await expect.poll(()=>nearest(page)).toBe('harbour:off');
  await page.evaluate(()=>window.__qinghe.town.onInteract('harbour:off'));
  me=await player(page);
  expect(me.riding).toBe(false);
  expect(me.z).toBeLessThan(-156.5);
  expect(me.z).toBeGreaterThan(-160);
  expect(me.y).toBeCloseTo(H.piers.far.top,2);
  await shot(page,'ride-day-far-pier');
  // The far landing is ground, from the pier to the wheel; the water off it is not.
  const landing=await page.evaluate(([OX])=>{const t=window.__qinghe.town;
    return [[50,-165],[50,-178],[-35,-180],[85,-172],[60,-165],[50,-150]].map(([x,z])=>t.canMove(OX+x,z,.36));},[OX]);
  expect(landing).toEqual([true,true,true,true,false,false]);

  // The wheel: pay at the gate, sit in the cabin at the bottom, go once round and step off.
  await warp(page,[H.wheel.gate[0],H.wheel.gate[1]+.8,0,.36]);
  await expect.poll(()=>nearest(page)).toBe('harbour:wheel');
  await page.evaluate(()=>window.__qinghe.town.onInteract('harbour:wheel'));
  me=await player(page);
  expect(me.wallet).toBe(50-H.ferry.fare-H.wheel.fare);
  expect(me.onWheel&&me.seated).toBe(true);
  await advance(page,H.wheel.turn/4,1.5);
  // Nobody gets out of a Ferris wheel halfway up: Space and E do nothing, and nothing says they would.
  await page.keyboard.press('Space');await frames(page,2);
  me=await player(page);
  expect(me.onWheel&&me.seated).toBe(true);
  expect(await nearest(page)).not.toBe('stand');
  await expect(page.locator('#seated')).toBeHidden();
  await advance(page,H.wheel.turn/4,1.5);
  me=await player(page);
  expect(me.y).toBeGreaterThan(H.wheel.hub+H.wheel.radius-6);   // at the top
  await page.evaluate(()=>{const t=window.__qinghe.town;t.yaw=180;t.pitch=-12;});
  await shot(page,'ride-day-wheel-top');
  await advance(page,H.wheel.turn/2+2,1.5);
  me=await player(page);
  expect(me.onWheel).toBe(false);
  expect(me.seated).toBe(false);
  expect(me.y).toBeLessThan(1);
  expect(Math.hypot(me.x-H.wheel.gate[0],me.z-H.wheel.gate[1])).toBeLessThan(2);
  expect(await page.evaluate(()=>window.__qinghe.town.announced)).toContain('harbour-wheel-off');
  expect(errors).toEqual([]);
});

test('the crew call all aboard to the pier, not to the whole promenade',async({page})=>{
  await start(page);
  // Out on the promenade, fifteen metres from the gangway: the call is not for you.
  await clock(page,12+2/60);
  await warp(page,[22,-44,180,0]);
  await advance(page,12);
  expect(await page.evaluate(()=>window.__qinghe.town.announced)).not.toContain('harbour-board');
  // On the pier's walkway, one cycle later: it is.
  await clock(page,12+(cycle+2)/60);
  await warp(page,[22,-50,180,.03]);
  await advance(page,12);
  expect(await page.evaluate(()=>window.__qinghe.town.announced)).toContain('harbour-board');
});

test('the wheel is named where it is, its rim and its hub, not across the square it turns in',async({page})=>{
  await start(page);
  // An eighth of a turn past noon: the rim's corners, were it boxed, would stand out 32 m from the hub.
  await clock(page,12+H.wheel.turn/8/60);
  await frames(page,2);
  const seen=await page.evaluate(([OX,W])=>{
    const t=window.__qinghe.town,eye={x:OX+W.x,y:12,z:W.z+32};
    const at=(r,a)=>{
      const p={x:OX+W.x+r*Math.cos(a),y:W.hub+r*Math.sin(a),z:W.z},d={x:p.x-eye.x,y:p.y-eye.y,z:p.z-eye.z},len=Math.hypot(d.x,d.y,d.z);
      return t.registry.look('city',eye,{x:d.x/len,y:d.y/len,z:d.z/len})?.box.name?.id??null;
    };
    return {rim:at(W.radius,.3),hub:at(1,1),corner:at(W.radius+6,0),inside:at(12,.8)};
  },[OX,H.wheel]);
  expect(seen.rim).toBe('ferris-wheel');
  expect(seen.hub).toBe('ferris-wheel');
  expect(seen.corner).not.toBe('ferris-wheel');
  expect(seen.inside).not.toBe('ferris-wheel');
});

test('nothing of the skyline stands on the far landing',async({page})=>{
  await start(page);
  const [x0,x1,z0,z1]=H.landing.area;
  const on=await page.evaluate(([x0,x1,z0,z1,OX])=>{
    const sky=window.__qinghe.town.rooms.get('city').root.findByName('skyline'),out=[];
    sky.forEach(e=>{for(const mi of e.render?.meshInstances??[]){
      const c=mi.aabb.center,h=mi.aabb.halfExtents;
      if(c.x+h.x>OX+x0&&c.x-h.x<OX+x1&&c.z+h.z>z0&&c.z-h.z<z1&&c.y-h.y<3)out.push(`${e.name} @${(c.x-OX).toFixed(1)},${c.y.toFixed(2)},${c.z.toFixed(1)}`);
    }});
    return out;
  },[x0,x1,z0,z1,OX]);
  expect(on).toEqual([]);
});

test('the ferry and the wheel are named from across the bay, and the harbour has no coplanar faces',async({page})=>{
  await start(page);
  // From the near pier head, the wheel 130 m away across the water (the ferry over at the far
  // pier, out of the way), and then the ferry back at the gangway.
  await clock(page,12+50/60);
  await warp(page,[22,-59.5,-19.76,.03,10.5]);   // at the hub
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.zh??null)).toBe('摩天轮');
  await clock(page,12+2/60);
  await warp(page,[22,-59.3,0,.03,-12]);
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.zh??null)).toBe('渡轮');
  await warp(page,[22,-55,180,.03,20]);
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.zh??null)).toBe('渡轮码头');
  // X-exterior's checker (tests/browser/coplanar.spec.js) on everything the harbour stands up.
  const bad=await page.evaluate(([OX,floors])=>{
    // The harbour, and the promenade's railing where it opens onto the pier.
    const city=window.__qinghe.town.rooms.get('city').root,out=[];
    const scopes=[[city.findByName('harbour'),null],[city.findByName('promenade'),[OX+17,OX+27,-49,-47]]];
    for(const [root,region] of scopes)for(const e of root.find(n=>!!n.render&&n.enabled)){
      const type=e.render.type;if(type!=='box'&&type!=='cylinder')continue;
      const m=e.getWorldTransform().data,axes=[0,1,2].map(c=>[m[c*4],m[c*4+1],m[c*4+2]]);
      const along=axes.map(a=>{const l=Math.hypot(...a);return a.findIndex(v=>Math.abs(Math.abs(v)/l-1)<1e-4);});
      if(along.includes(-1))continue;
      const mi=e.render.meshInstances[0],b=mi.aabb,c=b.center,h=b.halfExtents,lo=[c.x-h.x,c.y-h.y,c.z-h.z],hi=[c.x+h.x,c.y+h.y,c.z+h.z];
      if(region&&(hi[0]<region[0]||lo[0]>region[1]||hi[2]<region[2]||lo[2]>region[3]))continue;
      for(const a of type==='box'?[0,1,2]:[along[1]])for(const s of [-1,1]){
        const plane=s<0?lo[a]:hi[a];
        if(a===1&&s<0&&(plane<.05||floors.some(f=>Math.abs(plane-f)<.002)))continue;   // standing on the ground, or on a pier
        out.push({e,mat:mi.material.name==='vertex-colour'?e.render.material:mi.material,a,s,plane,lo,hi});   // a repainted piece's own colour
      }
    }
    const found=[];
    for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
      const p=out[i],q=out[j];
      if(p.a!==q.a||p.s!==q.s||p.e===q.e||p.mat===q.mat||Math.abs(p.plane-q.plane)>1e-3)continue;
      const [u,v]=[0,1,2].filter(k=>k!==p.a);
      if(Math.min(p.hi[u],q.hi[u])-Math.max(p.lo[u],q.lo[u])>1e-3&&Math.min(p.hi[v],q.hi[v])-Math.max(p.lo[v],q.lo[v])>1e-3)
        found.push(`${'xyz'[p.a]}${p.s>0?'+':'-'} ${p.plane.toFixed(3)} ${p.e.parent?.name}/${q.e.parent?.name} @${((p.lo[u]+p.hi[u])/2).toFixed(1)},${((p.lo[v]+p.hi[v])/2).toFixed(1)}`);
    }
    return found;
  },[OX,[H.piers.near.top,H.landing.top,H.wheel.floor]]);   // what stands on a pier, the landing or the wheel's platform
  expect(bad).toEqual([]);
});

test('at night, from the promenade and from the far landing, the harbour stays inside the draw-call budget',async({page})=>{
  await start(page);
  await clock(page,21.5);   // the ferry mid-crossing, the tour boat and the wheel lit
  const seen={};
  for(const [name,spot] of Object.entries({promenade:[20,-46,-10,0,4],'near pier':[22,-59.5,-20,.03,6],'far landing':[40,-172,160,.36,4],'at the wheel':[66,-172,0,.36,20]})){
    await warp(page,spot);
    seen[name]=await draws(page);
    expect(seen[name],`draw calls, ${name}`).toBeLessThanOrEqual(900);
  }
  // What the harbour itself costs: the same views with everything it built switched off.
  const without={};
  await page.evaluate(()=>{const root=window.__qinghe.town.rooms.get('city').root;
    for(const n of ['harbour','ferry','ferry-wake','tour-boat','tour-boat-wake','sailboat','sailboat-wake','ferris-wheel','wheel-cabins'])root.findByName(n)&&(root.findByName(n).enabled=false);});
  for(const [name,spot] of Object.entries({promenade:[20,-46,-10,0,4],'near pier':[22,-59.5,-20,.03,6],'far landing':[40,-172,160,.36,4],'at the wheel':[66,-172,0,.36,20]})){
    await warp(page,spot);without[name]=await draws(page);
  }
  console.log('DRAWS high',JSON.stringify(seen),'without the harbour',JSON.stringify(without));
});

for(const quality of ['medium','low'])test(`on ${quality} detail the harbour builds lighter`,async({page})=>{
  await start(page,{quality});
  await clock(page,21.5);
  const built=await page.evaluate(()=>{const root=window.__qinghe.town.rooms.get('city').root;
    return ['ferry','tour-boat','sailboat','ferry-wake','ferris-wheel','wheel-cabins'].filter(n=>root.findByName(n));});
  expect(built).toEqual(quality==='low'?['ferry','ferris-wheel','wheel-cabins']:['ferry','tour-boat','ferry-wake','ferris-wheel','wheel-cabins']);
  const seen={};
  for(const [name,spot] of Object.entries({promenade:[20,-46,-10,0,4],'far landing':[40,-172,160,.36,4]})){
    await warp(page,spot);seen[name]=await draws(page);
  }
  console.log('DRAWS',quality,JSON.stringify(seen));
  // The ferry still runs, and still takes you across.
  await clock(page,12+2/60);
  await warp(page,[22,-58.4,0,.03]);
  await expect.poll(()=>nearest(page)).toBe('harbour:board:near');
});

test('views',async({page})=>{
  test.skip(!SHOTS,'screenshots only');
  test.setTimeout(150_000);
  await page.setViewportSize({width:960,height:640});
  await start(page);
  const views={
    'ferry-docked':[12.05,21.05,[27,-46,30,0,2]],
    'ferry-crossing':[12.5,21.5,[22,-58.5,-25,.03,0]],
    'tour':[13.1667,21.1667,[-20,-47.4,76,0,1]],
    'sail':[14.5,23.5,[22,-59.5,-88,.03,1]],
    'wheel-across':[12.5,21.5,[22,-59.5,-20,.03,8]],
    'wheel-landing':[12.5,21.5,[40,-172,-69,.36,22]],
    'landing-back':[12.5,21.5,[20,-173,180,.36,2]],
    'landing-along':[12.5,21.5,[84,-173,78,.36,4]],
  };
  for(const night of [false,true])for(const [name,[day,dark,spot]] of Object.entries(views)){
    await clock(page,night?dark:day);await warp(page,spot);
    await shot(page,`${night?'night':'day'}-${name}`);
  }
  // Night rides: on deck mid-crossing, and at the top of the wheel.
  await clock(page,21+2/60);
  await warp(page,[22,-58.4,0,.03]);
  await page.evaluate(()=>window.__qinghe.town.onInteract('harbour:board:near'));
  await advance(page,26);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.setView('third');t.yaw=160;t.pitch=-15;});
  await shot(page,'ride-night-crossing-third');
  await page.evaluate(()=>{const t=window.__qinghe.town;t.setView('first');t.yaw=0;t.pitch=0;});
  await shot(page,'ride-night-crossing-first');
  await warp(page,[H.wheel.gate[0],H.wheel.gate[1]+.8,0,.36]);
  await page.evaluate(()=>window.__qinghe.town.onInteract('harbour:wheel'));
  await advance(page,H.wheel.turn/2,1.5);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.yaw=180;t.pitch=-12;});
  await shot(page,'ride-night-wheel-top');
});
