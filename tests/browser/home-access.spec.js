import {test,expect} from '@playwright/test';

const SAVE_KEY='little-mandarin-town.v1';

/**
 * Your front door faces the square's south edge, so the way in runs under the welcome sign or
 * down the alley beside the house. Both used to be blocked — the sign's hitbox filled the whole
 * gateway and a signboard and a low tree sealed the alley — and the walk from the middle of the
 * square to the door was two or three times the distance as the crow flies.
 */
test('the front door of 我的家 is a short walk from anywhere in the square',async({page})=>{
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:[],phrases:[],saved:[],home:[],discovered:[],
    clock:14,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  const result=await page.evaluate(()=>{
    const t=window.__qinghe.town,step=.25,x0=-21,z0=-19,W=Math.round(42/step)+1,H=Math.round(38/step)+1;
    const at=(i,j)=>j*W+i,free=new Uint8Array(W*H),dist=new Float32Array(W*H).fill(Infinity);
    for(let j=0;j<H;j++)for(let i=0;i<W;i++)free[at(i,j)]=t.canMove(x0+i*step,z0+j*step,0)?1:0;
    // Walking distance to the spot in front of the door, over a quarter-metre grid.
    const cell=(x,z)=>[Math.round((x-x0)/step),Math.round((z-z0)/step)];
    const [gi,gj]=cell(16.1,16.5);dist[at(gi,gj)]=0;
    let frontier=[[gi,gj]];
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
    const walk=(x,z)=>{const [i,j]=cell(x,z);return dist[at(i,j)];};
    return {spawn:walk(0,9),chen:walk(9,0),underSign:t.canMove(0,17,0),post:t.canMove(2.2,17,0)};
  });
  expect(result.underSign).toBe(true);   // the board hangs above your head
  expect(result.post).toBe(false);       // the posts are still solid
  expect(result.spawn).toBeLessThan(26); // was 31 m
  expect(result.chen).toBeLessThan(27);  // was 44 m, round the far side of the sign
});
