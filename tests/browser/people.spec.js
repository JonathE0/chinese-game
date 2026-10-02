import {test,expect} from '@playwright/test';
import {startGame} from './start.js';

// The townsfolk and the tourist as people.json archetypes (src/world/people.js): what they cost to
// draw in the town and the city. Screenshots go to SHOTS when it is set (for looking at, not comparing).
const SHOTS=process.env.SHOTS;
const SAVE_KEY='little-mandarin-town.v1';
async function start(page,clock=9){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:7,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock,dayIndex:0,vendors:{},tutorial:{done:true},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');await startGame(page);await page.waitForFunction(()=>window.__qinghe?.town);
  await page.addStyleTag({content:'.topbar,.quest-card,.mini-map,.location,.controls,#crosshair,#look-hint,#tutorial-card,#toast,#interact,.nameplate,.tip-card{display:none!important}'});
}
/**
 * Stand at (x,z) looking at (tx,tz): the median draw calls over a dozen frames, then the same with
 * everybody but the tourist hidden (what the people themselves cost), and a picture.
 */
async function view(page,name,[x,z],[tx,tz],{pitch=-6,third=false}={}){
  const look=async()=>page.evaluate(async([x,z,tx,tz,pitch,third])=>{
    const t=window.__qinghe.town,frame=()=>new Promise(r=>requestAnimationFrame(r));
    t.warp(x,z,Math.atan2(-(tx-x),-(tz-z))*180/Math.PI);t.pitch=pitch;t.setView(third?'third':'first');
    for(let i=0;i<20;i++)await frame();
    const seen=[];for(let i=0;i<12;i++){await frame();seen.push(t.app.stats.drawCalls.total);}
    return seen.sort((a,b)=>a-b)[6];
  },[x,z,tx,tz,pitch,third]);
  const all=await look();
  if(SHOTS)await page.screenshot({path:`${SHOTS}/${name}.png`});
  await page.evaluate(()=>{const t=window.__qinghe.town;
    window.__hidden=t.app.root.findByName?t.app.root.find(e=>e.name==='person'&&e!==t.player.entity&&e.enabled):[];
    for(const e of window.__hidden)e.enabled=false;return window.__hidden.length;});
  const hidden=await look();
  await page.evaluate(()=>{for(const e of window.__hidden)e.enabled=true;});
  return {all,people:all-hidden};
}

test('the town and the city still draw their people cheaply',async({page})=>{
  test.setTimeout(150000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const calls={
    square:await view(page,'square',[0,10],[-2,-7]),
    street:await view(page,'street',[28.5,0],[50,0]),
    'park-taichi':await view(page,'park-taichi',[-12.5,60.5],[-18.5,59.5]),
    'park-xiangqi':await view(page,'park-xiangqi',[5.2,61],[8.6,58.6]),
  };
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(1500);
  calls.city=await view(page,'city',[-4000,24],[-4000,0]);
  console.log(`draw calls (all, of which people): ${JSON.stringify(calls)}`);
  for(const [where,{all,people}] of Object.entries(calls)){expect(all,where).toBeLessThan(1200);expect(people,where).toBeLessThan(40);}
  expect(errors).toEqual([]);
});

// The comparison studio (people-studio.html): the turnaround, the city lineup and the village lineup,
// each in a page the size of its sheet so the figures land where the sheet has them. What each person
// costs to draw is logged; with SHOTS set the pictures go there, to set beside docs/references/wave4/.
test('the studio lines everyone up as the sheets do, each in ten draw calls, and sits them on seats',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const costs={};
  for(const sheet of ['turnaround','lineup','village','seated-front','seated-side']){
    const size={turnaround:[1774,887],lineup:[1983,793],village:[1983,793]}[sheet]??[1600,700];
    await page.setViewportSize({width:size[0],height:size[1]});
    if(!costs.turnaround&&sheet==='turnaround'){await page.goto('/tests/browser/people-studio.html');await page.waitForFunction(()=>window.studio?.ready,null,{timeout:60000});}
    // With SHOTS, first the empty stage: a background plate to tell the figures from it.
    const how=JSON.parse(process.env.STUDIO??'{}');   // e.g. STUDIO='{"distance":12}' while tuning
    if(SHOTS){await page.evaluate(([sheet,how])=>window.studio.show(sheet,{...how,empty:true}),[sheet,how]);await page.screenshot({path:`${SHOTS}/studio-${sheet}-plate.png`});}
    const built=await page.evaluate(([sheet,how])=>window.studio.show(sheet,how),[sheet,how]);
    for(const one of built)costs[one.archetype]=one;
    if(SHOTS)await page.screenshot({path:`${SHOTS}/studio-${sheet}.png`});
  }
  console.log(`per person: ${JSON.stringify(costs)}`);
  for(const [id,c] of Object.entries(costs)){expect(c.calls,id).toBeLessThanOrEqual(10);expect(c.shadows,id).toBe(2);}
  expect(errors).toEqual([]);
});

// Pictures of the people where you meet them (only with SHOTS): the tourist in the park, the square's
// named townsfolk, a street of townsfolk, the park's tai chi and xiangqi, the kite flyer and Yunhai's crowd.
test('pictures of the people in the town and the city',async({page})=>{
  test.skip(!SHOTS,'pictures only');
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,9.5);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.setView('third');t.warp(1.5,64,180);t.pitch=-8;});   // facing north, into the park
  for(let i=0;i<30;i++)await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
  await page.screenshot({path:`${SHOTS}/player-third-park.png`});
  await page.evaluate(()=>window.__qinghe.town.setView('first'));
  await view(page,'square-townsfolk',[-.5,-2.5],[-4.2,-8.4],{pitch:-6});
  await view(page,'street-mixed',[29,-2.6],[40,.6],{pitch:-4});
  await view(page,'park-taichi-close',[-14.2,59.6],[-18.5,59.6],{pitch:-8});
  await view(page,'park-xiangqi-close',[6.2,61.6],[8.6,58.6],{pitch:-14});
  await view(page,'park-kite',[-21.2,34.4],[-23.8,31.8],{pitch:-5});
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(2000);
  // The city walker with the most people near them, from a few metres in front.
  const [spot,at]=await page.evaluate(()=>{
    const crowd=window.__qinghe.town.crowd?.people??[],near=p=>crowd.filter(o=>o.entity.getPosition().distance(p.entity.getPosition())<6).length;
    const e=crowd.reduce((a,b)=>near(b)>near(a)?b:a).entity,p=e.getPosition(),f=e.forward;
    return [[p.x-f.x*6+f.z*2,p.z-f.z*6-f.x*2],[p.x,p.z]];
  });
  await view(page,'city-crowd',spot,at,{pitch:-6});
  expect(errors).toEqual([]);
});

// Sitting (src/world/people.js sit): wherever somebody sits, their thighs rest on the seat and a
// grown-up's feet on the floor. Checked off the meshes themselves for the tourist on a teahouse chair, a
// café stool and sofa, the word hall's bench and a hotpot stool, and for the park's xiangqi players and a
// city walker on a bench. With SHOTS, each from the front and the side.
test('sitting puts hips on the seat and feet on the floor, everywhere people sit',async({page})=>{
  test.setTimeout(240000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,9.5);
  const frames=(n=12)=>page.evaluate(async n=>{for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r));},n);
  /** The lowest points of a person's thighs and shins (world y), from their meshes' bounds. */
  const lows=who=>page.evaluate(who=>{
    const t=window.__qinghe.town,p=who==='player'?t.player:eval(who);
    const low=e=>e.render.meshInstances[0].aabb.getMin().y;
    return {thighs:Math.min(...p.legs.map(l=>low(l.limb))),feet:Math.min(...p.legs.map(l=>low(l.shoe))),kid:['girl','boy','v-girl','v-boy'].includes(p.look.archetype)};
  },who);
  /** Pictures from in front of and beside someone (`at` their world position, `face` their yaw). */
  const shoot=async(name,who,front=0)=>{
    if(!SHOTS)return;
    for(const [side,turn] of [['front',front],['side',90]]){
      await page.evaluate(([who,turn])=>{
        const t=window.__qinghe.town,p=who==='player'?t.player:eval(who),e=p.entity,at=e.getPosition().clone(),f=e.forward;
        // The tourist is drawn whole for the picture (a room keeps you in first person).
        if(who==='player'){window.__view=t.view;t.view='third';t.applyView();}
        const a=Math.atan2(-f.x,-f.z)+turn*Math.PI/180,y=at.y;   // a person faces their local +z
        t.app.off('prerender',window.__sitShot);
        window.__sitShot=()=>{t.camera.setPosition(at.x+Math.sin(a)*2.4,y+1.75,at.z+Math.cos(a)*2.4);t.camera.lookAt(at.x,y+.85,at.z);};
        t.app.on('prerender',window.__sitShot);
      },[who,turn]);
      await frames(20);
      await page.screenshot({path:`${SHOTS}/sit-${name}-${side}.png`});
    }
    await page.evaluate(who=>{const t=window.__qinghe.town;t.app.off('prerender',window.__sitShot);if(who==='player'){t.view=window.__view;t.applyView();}},who);
  };
  const seen={};
  // The tourist, in rooms: the first seat of a kind.
  for(const [room,kind] of [['teahouse','chair'],['cafe','stool'],['cafe','sofa'],['hall','bench']]){
    const seat=await page.evaluate(([room,kind])=>{
      const t=window.__qinghe.town;t.enterRoom(room);window.__qinghe.syncPlace();t.setView('third');
      const index=t.rooms.get(room).fittings.findIndex(f=>f.seat!==undefined&&f.name===kind);
      if(index<0||!t.sit(index))return null;
      const f=t.rooms.get(room).fittings[index];return {height:(f.y??0)+f.seat,floor:f.y??0};
    },[room,kind]);
    if(!seat)continue;
    await frames();
    seen[`${room} ${kind}`]={...seat,...await lows('player')};
    await shoot(`${room}-${kind}`,'player');
    await page.evaluate(()=>window.__qinghe.town.stand());
  }
  // The park's xiangqi players, on the stone stools (.45 m).
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterRoom?.('town');t.warp(6.2,61.6,0);});
  await frames(30);
  const players=await page.evaluate(()=>window.__qinghe.town.garden.life.people.filter(p=>p.seated).length);
  for(let i=0;i<players;i++){
    seen[`xiangqi ${i}`]={height:.45,floor:0,...await lows(`window.__qinghe.town.garden.life.people.filter(p=>p.seated)[${i}]`)};
  }
  await shoot('xiangqi',`window.__qinghe.town.garden.life.people.filter(p=>p.seated)[0]`,40);
  // A walker sitting on a bench in 云海 (the crowd sits now and then).
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  const sits=await page.waitForFunction(()=>window.__qinghe.town.crowd?.people.some(p=>p.mode==='sit'),null,{timeout:60000}).then(()=>true,()=>false);
  if(sits){
    const who='window.__qinghe.town.crowd.people.find(p=>p.mode==="sit")';
    await page.evaluate(who=>{const p=eval(who),at=p.entity.getPosition();window.__qinghe.town.warp(at.x+3,at.z+3,0);},who);
    await frames(20);
    seen['city bench']={height:.5,floor:0,...await lows(who)};
    await shoot('city-bench',who);
  }
  // The tourist at a hotpot table, up on the hill's terrace.
  const pot=await page.evaluate(()=>{
    const t=window.__qinghe.town,room=t.rooms.get('city'),index=room.fittings.findIndex(f=>f.hotpot!==undefined&&f.seat!==undefined);
    if(index<0)return null;const f=room.fittings[index];
    t.warp(room.offsetX+f.x,f.z+1,0,f.seat-.47);t.playerY=f.seat-.47;
    return t.sit(index)?{height:f.seat,floor:f.seat-.47}:null;
  });
  if(pot){await frames();seen['hotpot stool']={...pot,...await lows('player')};await shoot('hotpot','player');await page.evaluate(()=>window.__qinghe.town.stand());}
  console.log(`seated (seat, floor, lowest thigh, lowest foot): ${JSON.stringify(Object.fromEntries(Object.entries(seen).map(([k,v])=>[k,[v.height,v.floor,+v.thighs.toFixed(3),+v.feet.toFixed(3)]])))}`);
  expect(Object.keys(seen).length).toBeGreaterThanOrEqual(5);
  for(const [where,{height,floor,thighs,feet,kid}] of Object.entries(seen)){
    expect(thighs,`${where}: thighs on the seat`).toBeGreaterThan(height-.05);
    expect(thighs,`${where}: thighs on the seat`).toBeLessThan(height+.03);
    if(!kid&&height-floor<=.55)expect(Math.abs(feet-floor),`${where}: feet on the floor`).toBeLessThan(.05);
  }
  expect(errors).toEqual([]);
});
