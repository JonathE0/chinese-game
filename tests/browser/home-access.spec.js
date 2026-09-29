import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';

/**
 * Your home stands on the south side of the square with its door facing the fountain, and you
 * arrive a few steps north-west of it. The way from where you arrive to the door must be short and
 * open, and the door must be close enough to press E at.
 */
test('the front door of 我的家 is a short, open walk from where you arrive',async({page})=>{
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:[],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  const result=await page.evaluate(()=>{
    const t=window.__qinghe.town,step=.25,x0=-21,z0=-19,W=Math.round(42/step)+1,H=Math.round(38/step)+1;
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
    // In front of 陈叔叔's counter, where you stand to talk to him.
    const chen=t.data.npcs.find(n=>n.id==='chen');
    const walk=(x,z)=>{const [i,j]=cell(x,z);return dist[at(i,j)];};
    return {spawnFree:t.canMove(spawnX,spawnZ,0),toDoor:best,straight:Math.hypot(door.x-spawnX,door.z-spawnZ),
      chen:walk(chen.x,chen.z+2.6),underSign:t.canMove(0,17,0),post:t.canMove(2.2,17,0)};
  });
  expect(result.spawnFree).toBe(true);
  expect(result.toDoor).toBeLessThan(result.straight*1.1);   // nothing in the way
  expect(result.chen).toBeLessThan(16);
  expect(result.underSign).toBe(true);   // the welcome board hangs above your head
  expect(result.post).toBe(false);       // its posts are still solid
});

test('walking up to the front door offers to go home, and E takes you in',async({page})=>{
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],
    discovered:[],clock:14,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(300);
  await page.mouse.click(700,500);          // take the pointer so the world has focus
  await page.evaluate(()=>window.__qinghe.town.warp(11,7.8,180));
  await page.waitForTimeout(120);
  await page.keyboard.down('w');await page.waitForTimeout(900);await page.keyboard.up('w');
  await expect(page.locator('#interact span')).toHaveText('回家');
  await page.keyboard.press('e');
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('home');

  // Leaving puts you on the square side of the door, free to walk away, not inside the house.
  const out=await page.evaluate(()=>{const t=window.__qinghe.town;t.leaveRoom();const p=t.player.entity.getPosition();
    return {x:p.x,z:p.z,free:t.canMove(p.x,p.z,0)};});
  expect(out.z).toBeLessThan(10.7);
  expect(out.free).toBe(true);
  await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');
  const after=await page.evaluate(()=>window.__qinghe.town.player.entity.getPosition().z);
  expect(after).toBeLessThan(out.z-.5);
});
