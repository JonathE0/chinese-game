import {test,expect} from '@playwright/test';
import {startGame} from './start.js';

// The people of src/world/people.js in the running game: every archetype builds with the pivots and
// parts the animations use, each in eight draw calls; idle.js still blinks, glances, smiles and
// breathes them; the tourist's own eyes see only legs; and equipping clothes repaints the tourist.
const SAVE_KEY='little-mandarin-town.v1';
async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:7,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:11,dayIndex:0,vendors:{},tutorial:{done:true},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');await startGame(page);await page.waitForFunction(()=>window.__qinghe?.town);
}

test('every archetype builds with its pivots and parts, in ten draw calls and two shadows',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const built=await page.evaluate(async()=>{
    const t=window.__qinghe.town,{default:people}=await import('/src/content/people.json');
    const scratch=new (t.root.constructor)('scratch'),out={};
    for(const archetype of Object.keys(people.archetypes)){
      const p=t.m.person(scratch,null,[0,0,0],false,0,{archetype,props:true});
      let calls=0,triangles=0,shadows=0;
      const walk=e=>{if(!e._enabled)return;for(const mi of e.render?.meshInstances??[]){calls++;triangles+=mi.mesh.primitive[0].count/3;if(e.render.castShadows)shadows++;}e.children.forEach(walk);};walk(p.entity);
      const named=['upper','torso','head','neck','face','eyes','mouth','hat'].every(n=>p.entity.findByName(n));
      out[archetype]={calls,triangles,shadows,named,legs:p.legs.length,arms:p.arms.length,
        limbs:[...p.legs,...p.arms].every(l=>l.limb?.render)&&p.legs.every(l=>l.knee&&l.shin&&l.shoe?.render),hands:p.arms.every(a=>a.hand&&a.hang),
        eyes:p.eyes[0]===p.entity.findByName('eyes'),seat:p.seatDrop>.25&&p.seatDrop<.7,look:p.look.archetype===archetype};
    }
    scratch.destroy();return out;
  });
  console.log(`per archetype [draw calls, triangles]: ${JSON.stringify(Object.fromEntries(Object.entries(built).map(([k,v])=>[k,[v.calls,v.triangles]])))}`);
  for(const [id,b] of Object.entries(built)){
    expect(b,id).toMatchObject({calls:10,shadows:2,named:true,legs:2,arms:2,limbs:true,hands:true,eyes:true,seat:true,look:true});
    expect(b.triangles,id).toBeLessThan(4500);
  }
  // The named townsfolk are who npcs.json says.
  expect(await page.evaluate(()=>['lin','mei','chen','zhou'].map(id=>{const a=window.__qinghe.town.actors.get(id);return `${a.look.archetype} ${a.look.style}`;})))
    .toEqual(['auntie bun','v-young-woman bob','v-young-man side','v-grandpa short']);
  expect(errors).toEqual([]);
});

test('idle.js still blinks, glances, smiles and breathes the new people',async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const seen=await page.evaluate(async()=>{
    const t=window.__qinghe.town,{initIdle,animateIdle}=await import('/src/world/idle.js');
    const scratch=new (t.root.constructor)('scratch'),p=initIdle(t.m.person(scratch,null,[0,0,0],false,3,{archetype:'v-young-man'}),.2);
    const s=p.idle,out={blink:1,mouth:new Set(),neck:new Set(),upper:new Set()};
    s.blinkIn=0;s.glanceIn=0;s.moodIn=0;
    for(let i=0;i<240;i++){
      animateIdle(p,1/30);
      out.blink=Math.min(out.blink,p.eyes[0].getLocalScale().y);
      out.mouth.add(p.mouth.getLocalScale().y.toFixed(2));out.neck.add(p.neck.getLocalEulerAngles().y.toFixed(1));out.upper.add(p.upper.getLocalEulerAngles().x.toFixed(2));
    }
    // The walk and sitting turn the same pivots.
    p.legs.forEach(l=>l.setLocalEulerAngles(78,0,0));p.arms.forEach(a=>a.setLocalEulerAngles(14,0,5));
    const sitting=p.legs.every(l=>Math.abs(l.getLocalEulerAngles().x-78)<.01);
    scratch.destroy();
    return {blink:out.blink,mouth:out.mouth.size,neck:out.neck.size,upper:out.upper.size,sitting};
  });
  expect(seen.blink).toBeLessThan(.2);        // the eyes shut
  expect(seen.mouth).toBeGreaterThan(5);      // the smile opens
  expect(seen.neck).toBeGreaterThan(5);       // a glance
  expect(seen.upper).toBeGreaterThan(5);      // breathing
  expect(seen.sitting).toBe(true);
  expect(errors).toEqual([]);
});

test('from your own eyes only your legs draw, and clothes you put on repaint you',async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const firstPerson=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.setView('first');
    const legs=new Set(t.player.legs),seen=[];
    const walk=(e,leg)=>{if(!e._enabled)return;if(e.render&&!leg)seen.push(e.name);e.children.forEach(c=>walk(c,leg||legs.has(c)));};
    walk(t.player.entity,false);return {seen,archetype:t.player.look.archetype};
  });
  expect(firstPerson).toEqual({seen:[],archetype:'tourist'});
  // The colours live in the vertices: read them back off the meshes.
  const colours=()=>page.evaluate(()=>{
    const t=window.__qinghe.town,hexes=part=>{const c=[];part.render.meshInstances[0].mesh.getColors(c);const set=new Set();
      const k=c.some(v=>v>1)?1:255;   // bytes or 0..1, as the stream stores them
      for(let i=0;i<c.length;i+=4)set.add('#'+[c[i],c[i+1],c[i+2]].map(v=>Math.round(v*k).toString(16).padStart(2,'0')).join(''));return [...set];};
    return {torso:hexes(t.player.torso),leg:[...hexes(t.player.legs[0].limb),...hexes(t.player.legs[0].shoe)],arm:hexes(t.player.arms[0].limb)};
  });
  const near=(list,hex)=>list.some(h=>[1,3,5].every(i=>Math.abs(parseInt(h.slice(i,i+2),16)-parseInt(hex.slice(i,i+2),16))<=14));
  await page.evaluate(()=>window.__qinghe.town.equip({hat:'hat',shirtColor:'#4f7fa6',trousersColor:'#22446a',shoesColor:'#aa2222'}));
  const dressed=await colours();
  expect(await page.evaluate(()=>window.__qinghe.town.player.hat._enabled)).toBe(true);
  expect(near(dressed.torso,'#4f7fa6')&&near(dressed.arm,'#4f7fa6')).toBe(true);   // shirt and sleeves
  expect(near(dressed.leg,'#22446a')&&near(dressed.leg,'#aa2222')).toBe(true);     // trousers and shoes
  await page.evaluate(()=>window.__qinghe.town.equip({}));
  const plain=await colours();
  expect(near(plain.torso,'#4f7fa6')).toBe(false);
  expect(near(plain.torso,'#e4d3c3')).toBe(true);   // back to the turnaround sheet's cream
  expect(errors).toEqual([]);
});
