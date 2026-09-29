import {test,expect} from '@playwright/test';

// Every existing interior reads as its trade: a few of its own named things and signs are there,
// every counter, shelf and seat can be walked to from the door, and no two fittings stand inside
// each other.
const SAVE_KEY='little-mandarin-town.v1';
const EXPECT={
  hall:['bench','noticeboard','wallclock','rug'],
  lifestyle:['sofa','sign:dept-daily-goods','sign:dept-furniture','sign:welcome'],
  cafe:['sign:menu','sign:dept-pastries','sign:recommended','poster'],
  supermarket:['sign:dept-fruit','sign:dept-drinks','sign:dept-snacks','sign:checkout','sign:wet-floor','wallclock'],
  lights:['sign:dept-lamps','lantern','lamp','sign:special-offer'],
  restaurant:['sign:menu','sign:recommended','lantern','wallclock'],
  homeware:['sign:dept-bedding','sign:dept-kitchenware','sign:dept-furniture','sofa'],
  resale:['sign:buy-second-hand','sign:opening-hours','noticeboard','wallclock'],
  bank:['sign:deposits','sign:withdrawals','sign:enquiries','sign:please-queue','railing'],
  bakery:['sign:dept-pastries','sign:fresh','bread','oven'],
  library:['sign:borrow-books','sign:return-books','sign:new-books','sign:childrens-books','sign:keep-quiet'],
  teahouse:['sign:dept-tea-leaves','sign:menu','teaset','lantern'],
  hardware:['sign:dept-tools','sign:dept-hardware-goods','sign:welcome','noticeboard'],
  reading:['sign:keep-quiet','wallclock','noticeboard'],
  studyroom:['sign:keep-quiet','desk','wallclock'],
  listening:['sign:keep-quiet','sofa','noticeboard'],
  courtyard:['pine','plant','bench'],
  'metro-platform':['wallclock','poster','sign:please-queue','sign:metro-line-1'],
  'city-bank':['atm','sign:deposits','sign:please-queue','railing','sofa','noticeboard'],
  'city-bookshop':['shelf','sign:shelf-dictionaries','sign:shelf-novels','sign:shelf-comics','sign:new-books','sign:checkout','sofa','lamp'],
  'city-hospital':['sign:registration','sign:hospital-pharmacy','sign:waiting-area','bench','medicine-cabinet','poster'],
  'city-noodles':['stove','menu','table','stool','lantern','sign:recommended','sign:menu'],
  'city-cinema':['sign:ticket-office','poster','bench','counter'],
  'city-cinema-hall':['screen','chair'],
  'city-store':['fridge','goods-shelf','sign:checkout','sign:welcome','basket'],
  'city-cafe':['window','sign:menu','sign:dept-pastries','sofa','stool'],
};

test('each interior has its own named things, reachable counters and no fittings inside each other',async({page})=>{
  test.setTimeout(120000);
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:[],phrases:[],saved:[],home:[],discovered:[],
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  const report=await page.evaluate(ids=>{
    const t=window.__qinghe.town,out={};
    for(const id of ids){
      t.enterRoom(id);
      const room=t.rooms.get(id),[w,d]=room.data.size,ox=room.offsetX;
      const names=new Set([...t.registry.boxes,...t.registry.looks].filter(b=>b.place===id&&b.name).map(b=>b.name.id));
      // Walk a 0.2 m grid out from the spawn point; every target needs a reachable spot in range.
      const step=.2,seen=new Set(),cells=[],queue=[[room.data.spawn[0],room.data.spawn[1]]];
      while(queue.length){
        const [x,z]=queue.pop(),key=Math.round(x/step)+','+Math.round(z/step);
        if(seen.has(key))continue;seen.add(key);
        if(Math.abs(x)>w/2||Math.abs(z)>d/2||t.registry.blocks(id,ox+x,z,0,.34))continue;
        cells.push([x,z]);
        for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]])queue.push([Math.round((x+dx)/step)*step,Math.round((z+dz)/step)*step]);
      }
      const unreachable=t.targets().filter(tg=>!cells.some(([x,z])=>Math.hypot(ox+x-tg.x,z-tg.z)<tg.radius-.1)).map(tg=>tg.id);
      const solid=t.registry.boxes.filter(b=>b.place===id&&b.solid&&b.name&&b.y1>.3&&!['wall','window'].includes(b.name.id));
      const overlaps=[];
      for(let i=0;i<solid.length;i++)for(let j=i+1;j<solid.length;j++){
        const a=solid[i],b=solid[j];
        if(a.y0<b.y1&&b.y0<a.y1&&Math.abs(a.x-b.x)<a.hw+b.hw-.02&&Math.abs(a.z-b.z)<a.hd+b.hd-.02)overlaps.push(a.name.id+'/'+b.name.id);
      }
      out[id]={names:[...names],unreachable,overlaps};
    }
    return out;
  },Object.keys(EXPECT));
  for(const [id,want] of Object.entries(EXPECT)){
    expect(want.filter(name=>!report[id].names.includes(name)),`${id} is missing`).toEqual([]);
    expect(report[id].unreachable,`${id} targets out of reach`).toEqual([]);
    expect(report[id].overlaps,`${id} fittings inside each other`).toEqual([]);
  }
});
