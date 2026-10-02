import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';

/**
 * You arrive just inside the town gate of 莲池公园, and your home stands beside it, its door facing the
 * gate. The way from where you arrive to the door must be open and the door close enough to press E
 * at; Uncle Zhou's fruit stand (Grandfather's first photograph) is a clear walk north through the
 * park and the moon gate. The gate itself: its opening is open ground, its columns are solid.
 */
test('the front door of 我的家 is a short, open walk from where you arrive, and the fruit stand a clear one',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:[],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  const result=await page.evaluate(()=>{
    // Flood the walkable ground of the square and the park from the spawn, on foot at street level.
    const t=window.__qinghe.town,step=.3,x0=-24,z0=-12,W=Math.round(60/step)+1,H=Math.round(78/step)+1;
    const at=(i,j)=>j*W+i,free=new Uint8Array(W*H),dist=new Float32Array(W*H).fill(Infinity);
    for(let j=0;j<H;j++)for(let i=0;i<W;i++)free[at(i,j)]=t.canMove(x0+i*step,z0+j*step,0)?1:0;
    const cell=(x,z)=>[Math.round((x-x0)/step),Math.round((z-z0)/step)];
    const [spawnX,spawnZ]=t.data.spawn;
    const [si,sj]=cell(spawnX,spawnZ);dist[at(si,sj)]=0;
    let frontier=[[si,sj]];
    const moves=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
    while(frontier.length){
      const next=[];
      for(const [i,j] of frontier)for(const [di,dj,cost] of moves){
        const a=i+di,b=j+dj;
        if(a<0||b<0||a>=W||b>=H||!free[at(a,b)])continue;
        if(di&&dj&&(!free[at(i+di,j)]||!free[at(i,j+dj)]))continue;
        const d=dist[at(i,j)]+cost*step;
        if(d<dist[at(a,b)]-1e-6){dist[at(a,b)]=d;next.push([a,b]);}
      }
      frontier=next;
    }
    // The nearest reachable spot from which the door prompt shows.
    const door=t.targets().find(x=>x.id==='door:home');
    let best=Infinity;
    for(let j=0;j<H;j++)for(let i=0;i<W;i++){
      const x=x0+i*step,z=z0+j*step;
      if(Math.hypot(x-door.x,z-door.z)<=door.radius-.2)best=Math.min(best,dist[at(i,j)]);
    }
    // Beside Uncle Zhou, where you stand to talk to him and to frame the fruit stand.
    const zhou=t.data.npcs.find(n=>n.id==='zhou'),walk=(x,z)=>{const [i,j]=cell(x,z);return dist[at(i,j)];};
    return {spawnFree:t.canMove(spawnX,spawnZ,0),toDoor:best,straight:Math.hypot(door.x-spawnX,door.z-spawnZ),
      zhou:walk(zhou.x+1.6,zhou.z),zhouStraight:Math.hypot(zhou.x+1.6-spawnX,zhou.z-spawnZ),
      gateway:t.canMove(0,64.7,0),column:t.canMove(3.3,64.8,0)};
  });
  expect(result.spawnFree).toBe(true);
  expect(result.toDoor).toBeLessThan(result.straight*1.1);   // nothing in the way
  // North round the pond (the bridges are steps up, so on foot at street level the way is round it)
  // and through the moon gate: never much longer than the straight line.
  expect(result.zhou).toBeLessThan(result.zhouStraight*1.35);
  expect(result.gateway).toBe(true);    // the town gate's opening is open ground
  expect(result.column).toBe(false);    // its columns are solid
});

test('walking up to the front door offers to go home, and E takes you in',async({page})=>{
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],
    discovered:[],clock:14,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(300);
  await page.mouse.click(700,500);          // take the pointer so the world has focus
  // A few steps out from the door, which faces south to the town gate: walking north reaches it.
  await page.evaluate(()=>window.__qinghe.town.warp(16,56.6,0));
  await page.waitForTimeout(120);
  await page.keyboard.down('w');await page.waitForTimeout(900);await page.keyboard.up('w');
  await expect(page.locator('#interact span')).toHaveText('回家');
  await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('home');

  // Leaving puts you on the gate side of the door, free to walk away, not inside the house.
  const out=await page.evaluate(()=>{const t=window.__qinghe.town;t.leaveRoom();const p=t.player.entity.getPosition();
    return {x:p.x,z:p.z,free:t.canMove(p.x,p.z,0)};});
  expect(out.z).toBeGreaterThan(53.7);
  expect(out.free).toBe(true);
  await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');
  const after=await page.evaluate(()=>window.__qinghe.town.player.entity.getPosition().z);
  expect(after).toBeGreaterThan(out.z+.5);
});
