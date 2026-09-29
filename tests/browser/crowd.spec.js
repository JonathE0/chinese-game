import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// People walking around 云海 (src/world/crowd.js): they move, keep out of things and each other,
// cost few draw calls, and say a line when you talk to one.
const SAVE_KEY='little-mandarin-town.v1';
const CROWD=JSON.parse(readFileSync('src/content/crowd.json','utf8'));
const OFF=-4000;

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
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
}
const snapshot=page=>page.evaluate(off=>{
  const t=window.__qinghe.town,people=t.crowd.people,up=people.filter(p=>p.mode!=='sit');
  const stuck=up.filter(p=>t.registry.blocks('city',off+p.x,p.z,0,.2)).map(p=>`${p.i} ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  let closest=Infinity;
  for(let a=0;a<up.length;a++)for(let b=a+1;b<up.length;b++)closest=Math.min(closest,Math.hypot(up[a].x-up[b].x,up[a].z-up[b].z));
  return {at:people.map(p=>({x:p.x,z:p.z})),stuck,closest};
},OFF);
/** Draw calls standing somewhere, as tests/browser/performance.spec.js counts them, with the crowd
 *  and then straight after without it from the same spot, so the difference is the crowd alone. */
const drawCalls=(page,x,z,yaw)=>page.evaluate(async([x,z,yaw])=>{
  const t=window.__qinghe.town,show=on=>{for(const p of t.crowd.people)p.entity.enabled=on;};
  const count=()=>new Promise(done=>{let n=3;const frame=()=>--n?requestAnimationFrame(frame):done(t.app.stats.drawCalls.total);requestAnimationFrame(frame);});
  t.warp(x,z,yaw);
  const withCrowd=await count();show(false);const without=await count();show(true);
  return [withCrowd,without];
},[x,z,yaw]);

test('people walk around 云海, keep out of things and each other, and stay cheap to draw',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const first=await snapshot(page);
  expect(first.at.length).toBe(CROWD.count);
  expect(first.at.length).toBeGreaterThanOrEqual(24);
  expect(first.at.length).toBeLessThanOrEqual(40);
  for(let i=0;i<8;i++){
    await page.waitForTimeout(600);
    const now=await snapshot(page);
    expect(now.stuck).toEqual([]);
    expect(now.closest).toBeGreaterThan(.6);
  }
  const last=await snapshot(page);
  const moved=last.at.filter((p,i)=>Math.hypot(p.x-first.at[i].x,p.z-first.at[i].z)>.3);
  expect(moved.length).toBeGreaterThan(CROWD.count/3);
  // Looking up the street from the station and from the middle of downtown, and back from the promenade.
  const spots=[[OFF,24.5,0],[OFF,0,0],[OFF,-40,180]];
  // One material and one batch group: the whole crowd is a handful of draw calls, shadows included.
  const seen=[];for(const [x,z,yaw] of spots)seen.push(await drawCalls(page,x,z,yaw));
  console.log(`city draw calls with the crowd / without: ${seen.map(s=>s.join('/')).join(', ')}`);
  for(const [withCrowd,without] of seen){
    expect(withCrowd).toBeLessThanOrEqual(900);
    expect(withCrowd-without).toBeLessThanOrEqual(10);
  }
  expect(errors).toEqual([]);
});

test('looking at someone in the street names them 行人, and E has them say a line',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  let found=null;
  for(let attempt=0;attempt<12&&found===null;attempt++){
    // Stop someone where they are, stand a step away facing them, and see whether they are the target.
    await page.evaluate(([n,off])=>{
      const t=window.__qinghe.town,p=t.crowd.people.filter(o=>o.mode!=='sit')[n];
      Object.assign(p,{mode:'idle',wait:1e6,path:[],plan:null});
      for(let a=0;a<8;a++){
        const x=p.x+Math.sin(a*Math.PI/4)*1.2,z=p.z+Math.cos(a*Math.PI/4)*1.2;
        if(t.canMove(off+x,z,0)){t.warp(off+x,z,Math.atan2(x-p.x,z-p.z)*180/Math.PI);return;}
      }
    },[attempt,OFF]);
    await page.waitForTimeout(300);
    found=await page.evaluate(()=>{const id=window.__qinghe.town.nearest?.id;return id?.startsWith('crowd:')?Number(id.slice(6)):null;});
  }
  expect(found).not.toBeNull();
  await expect(page.locator('#nameplate')).toContainText('行人');
  await expect(page.locator('#interact span')).toHaveText('和行人说话');
  await page.keyboard.press('e');
  const line=CROWD.lines[found%CROWD.lines.length];
  await expect(page.locator('.dialogue-line').first()).toContainText(line.zh);
  // Nobody walks off while you are talking.
  const where=()=>page.evaluate(()=>window.__qinghe.town.crowd.people.map(p=>[p.x,p.z]));
  const before=await where();await page.waitForTimeout(800);
  expect(await where()).toEqual(before);
  expect(errors).toEqual([]);
});
