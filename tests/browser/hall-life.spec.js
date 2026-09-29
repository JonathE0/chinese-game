import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// People in the word hall: they walk about, can be talked to, and go through the side-room doors.
const SAVE_KEY='little-mandarin-town.v1';
const HALL=JSON.parse(readFileSync('src/content/hall-visitors.json','utf8'));

async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:200,inventory:{},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},stats:{hunger:20,energy:70,hour:14},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterRoom('hall');});
  await page.waitForTimeout(300);
}
/** Where everyone is, how many are in each room, and anyone standing inside the furniture. */
const snapshot=page=>page.evaluate(()=>{
  const t=window.__qinghe.town,people=t.visitors.people;
  const counts={};for(const p of people)counts[p.place]=(counts[p.place]??0)+1;
  const stuck=people.filter(p=>p.mode!=='sit'&&t.registry.blocks(p.place,t.rooms.get(p.place).offsetX+p.x,p.z,0,.2))
    .map(p=>`${p.index} ${p.place} ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  return {at:people.map(p=>({place:p.place,x:p.x,z:p.z,mode:p.mode})),counts,stuck};
});
const withinLimits=counts=>Object.entries(HALL.limits).every(([room,[min,max]])=>(counts[room]??0)>=min&&(counts[room]??0)<=max);

test('people in the word hall move about, keep out of the furniture and within each room\'s limits',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const first=await snapshot(page);
  expect(first.counts.hall).toBeGreaterThanOrEqual(3);
  for(let i=0;i<8;i++){
    await page.waitForTimeout(700);
    const now=await snapshot(page);
    expect(withinLimits(now.counts),JSON.stringify(now.counts)).toBe(true);
    expect(now.stuck).toEqual([]);
  }
  const last=await snapshot(page);
  const moved=last.at.filter((p,i)=>p.place!==first.at[i].place||Math.hypot(p.x-first.at[i].x,p.z-first.at[i].z)>.3);
  expect(moved.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a visitor in the hall can be talked to, and says their line',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  let found=null;
  for(let attempt=0;attempt<12&&!found;attempt++){
    // Stand a step away from someone, facing them, and see whether they are the nearest thing.
    await page.evaluate(n=>{
      const t=window.__qinghe.town,off=t.rooms.get('hall').offsetX,here=t.visitors.here('hall');
      const p=here[n%here.length];
      for(let a=0;a<8;a++){
        const x=p.x+Math.sin(a*Math.PI/4)*1.1,z=p.z+Math.cos(a*Math.PI/4)*1.1;
        if(t.canMove(off+x,z,0)){t.warp(off+x,z,Math.atan2(x-p.x,z-p.z)*180/Math.PI);return;}
      }
    },attempt);
    await page.waitForTimeout(250);
    found=await page.evaluate(()=>{const id=window.__qinghe.town.nearest?.id;return id?.startsWith('hall:')?Number(id.slice(5)):null;});
  }
  expect(found).not.toBeNull();
  await expect(page.locator('#interact span')).toHaveText(/^和.+说话$/);
  await page.keyboard.press('e');
  const who=HALL.people[found];
  await expect(page.locator('.dialogue-line').first()).toContainText(HALL.lines[who.line].zh);
  // Everyone holds still while the panel is open, so the one you are talking to stays put.
  const where=()=>page.evaluate(i=>{const p=window.__qinghe.town.visitors.people[i];return [p.x,p.z,p.place];},found);
  const before=await where();await page.waitForTimeout(1200);
  expect(await where()).toEqual(before);
  expect(errors).toEqual([]);
});

test('someone walks to a side-room door and comes in through it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  // Play up to three minutes in one go, so nothing (a dev server reload) can cut it short, until
  // someone in the hall goes off into a side room of their own accord.
  const run=await page.evaluate(limits=>{
    const t=window.__qinghe.town,v=t.visitors,tracks=new Map(v.here('hall').map(p=>[p,[]]));
    const broken=[];
    for(let i=0;i<3600;i++){
      for(const [p,track] of tracks)if(p.place==='hall')track.push({x:p.x,z:p.z});
      v.update(.05);
      const counts={};for(const p of v.people)counts[p.place]=(counts[p.place]??0)+1;
      for(const [room,[min,max]] of Object.entries(limits))if(!((counts[room]??0)>=min&&(counts[room]??0)<=max))broken.push(JSON.stringify(counts));
      const gone=[...tracks.keys()].find(p=>p.place!=='hall');
      if(gone){
        const room=t.rooms.get(gone.place),spawn=room.data.spawn;
        return {broken,track:tracks.get(gone).slice(-40),parent:gone.entity.parent===room.root,
          near:Math.hypot(gone.x-spawn[0],gone.z-spawn[1])};
      }
    }
    return {broken,track:null};
  },HALL.limits);
  expect(run.track,'nobody left the hall in three minutes').not.toBeNull();
  expect(run.broken).toEqual([]);
  // They walked up to the door over the last two seconds rather than jumping there...
  const steps=run.track.slice(1).map((p,i)=>Math.hypot(p.x-run.track[i].x,p.z-run.track[i].z));
  expect(Math.max(...steps)).toBeLessThan(.2);
  expect(Math.hypot(run.track.at(-1).x-run.track[0].x,run.track.at(-1).z-run.track[0].z)).toBeGreaterThan(.5);
  // ...and came into the side room at its doorway.
  expect(run.parent).toBe(true);
  expect(run.near).toBeLessThan(.1);
  expect(errors).toEqual([]);
});
