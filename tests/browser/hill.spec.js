import {test,expect} from '@playwright/test';
import {startGame} from './start.js';
import {readFileSync} from 'node:fs';

// The 山城 hill in 云海 (src/world/hill.js): walked up and down with W alone, its path lights on at
// night and off by day, and inside the outdoor draw-call budget.
const HILL=JSON.parse(readFileSync('src/content/hill.json','utf8'));
const OFFSET=-4000;
const nodes=id=>HILL.routes.find(r=>r.id===id).nodes.map(([x,z])=>[x,z]);
const UP=[[-36,-40],...nodes('promenade'),...nodes('terrace').slice(1),[-61.5,-36],[-58,-36],...nodes('summit').slice(1),[-98,-26]];

async function start(page){
  await page.goto('/');
  await startGame(page);
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace?.();});
  await page.mouse.click(700,500);
  await page.waitForTimeout(600);           // taking the pointer clears held keys: let it settle first
}
/** Hold W and turn towards each point in turn (turning is the mouse's job; only W moves you). */
async function walk(page,points){
  // A key pressed while the pointer lock is still changing hands is dropped: press until it holds.
  for(let i=0;i<5;i++){
    await page.keyboard.down('w');await page.waitForTimeout(150);
    if(await page.evaluate(()=>window.__qinghe.town.keys.has('KeyW')))break;
    await page.keyboard.up('w');
  }
  const result=await page.evaluate(([points,offset])=>new Promise(done=>{
    const t=window.__qinghe.town;let i=0,best=Infinity,since=performance.now(),heights=[];
    const tick=()=>{
      const p=t.player.entity.getPosition(),[tx,tz]=points[i],dx=offset+tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);
      if(d<.35){
        heights.push(+t.playerY.toFixed(2));
        if(++i===points.length){done({ok:true,heights});return;}
        best=Infinity;since=performance.now();
      } else {
        t.yaw=Math.atan2(-dx,-dz)*180/Math.PI;
        if(d<best-.05){best=d;since=performance.now();}
        if(performance.now()-since>4000){done({ok:false,at:[p.x-offset,p.z,t.playerY],target:points[i],heights,paused:t.paused,keys:[...t.keys],seated:!!t.seated,place:t.place,panel:document.activeElement?.id||document.activeElement?.tagName});return;}
      }
      requestAnimationFrame(tick);
    };
    tick();
  }),[points,OFFSET]);
  await page.keyboard.up('w');
  return result;
}
async function drawCalls(page,x,z,yaw,y){
  await page.evaluate(([x,z,yaw,y])=>window.__qinghe.town.warp(x,z,yaw,y),[OFFSET+x,z,yaw,y]);
  return page.evaluate(()=>new Promise(done=>{
    const app=window.__qinghe.town.app;
    requestAnimationFrame(()=>requestAnimationFrame(()=>done(app.stats.drawCalls.total)));
  }));
}

test('from the promenade up the stairway to the terrace and the summit viewpoint, and back, with W alone',async({page})=>{
  test.setTimeout(180000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await page.evaluate(([x])=>window.__qinghe.town.warp(x,-40,90),[OFFSET-36]);
  const up=await walk(page,UP);
  expect(up.ok,JSON.stringify(up)).toBe(true);
  // The hotpot terrace floor, and the viewpoint at the top.
  expect(up.heights[UP.findIndex(([x,z])=>x===-61.5&&z===-36)]).toBeCloseTo(HILL.terrace.y,1);
  expect(up.heights.at(-1)).toBeCloseTo(HILL.platform.y,1);
  const down=await walk(page,[...UP].reverse().slice(1));
  expect(down.ok,JSON.stringify(down)).toBe(true);
  expect(down.heights.at(-1)).toBeCloseTo(0,1);
  expect(errors).toEqual([]);
});

test("from downtown's west side up to the junction landing and back, with W alone",async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await page.evaluate(([x])=>window.__qinghe.town.warp(x,8,90),[OFFSET-20]);
  const way=[[-20,8],...nodes('downtown')];
  const up=await walk(page,way.slice(1));
  expect(up.ok,JSON.stringify(up)).toBe(true);
  expect(up.heights.at(-1)).toBeCloseTo(HILL.routes.find(r=>r.id==='downtown').nodes.at(-1)[2],1);
  const down=await walk(page,[...way].reverse().slice(1));
  expect(down.ok,JSON.stringify(down)).toBe(true);
  expect(down.heights.at(-1)).toBeCloseTo(0,1);
  expect(errors).toEqual([]);
});

test('the path lights are on at night and off by day, and the hill stays inside the draw-call budget',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const lit=hour=>page.evaluate(h=>{
    const t=window.__qinghe.town;t.daylight.setHour(h);
    return t.rooms.get('city').parts.find(p=>p.layout).lamps.map(m=>m.emissiveIntensity);
  },hour);
  for(const value of await lit(22))expect(value).toBeGreaterThan(.5);
  for(const value of await lit(12))expect(value).toBe(0);
  for(const [name,x,z,yaw,y] of [['the foot of the stairway',-36,-40,90,0],['the terrace',-58,-36,90,14],
    ['the summit, over the bay',-98,-26,0,26],['the summit, over downtown',-98,-26,-90,26]]){
    await lit(22);
    expect(await drawCalls(page,x,z,yaw,y),`draw calls at ${name}`).toBeLessThanOrEqual(900);
  }
  expect(errors).toEqual([]);
});
