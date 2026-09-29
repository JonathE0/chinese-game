import test from 'node:test';
import assert from 'node:assert/strict';
import {Registry} from '../src/world/registry.js';
import {timeline,showLength,showTime,showIndex,startShow,stepAt,samplePoints,accentPicks} from '../src/world/drones.js';
import SHOW from '../src/content/drones.json' with {type:'json'};
import signs from '../src/content/signs.json' with {type:'json'};
import objects from '../src/content/objects.json' with {type:'json'};

const length=showLength(timeline());
const at=(hour,seconds=0)=>hour+seconds/60;   // a game hour is 60 real seconds

test('the drone show starts at 20:00 and 23:00, runs about two and a half minutes, and closes with its own line',()=>{
  assert.equal(showTime(at(20)),0);
  assert.equal(Math.round(showTime(at(20,30))),30);
  assert.equal(showTime(at(23)),0);
  assert.equal(showTime(at(19,59)),null);
  assert.equal(showTime(at(20,length+1)),null);
  assert.equal(showTime(at(23,length+1)),null);
  assert.equal(showTime(at(12)),null);
  assert.ok(length>=140&&length<=160,`a show of ${length} s`);
  // The first show points to the second; the last one thanks everyone.
  assert.equal(SHOW.times[showIndex(at(20,60))].end,'end-first');
  assert.equal(SHOW.times[showIndex(at(23,60))].end,'end');
  assert.equal(showIndex(at(12)),-1);
  for(const {end} of SHOW.times)assert.ok(SHOW.lines[end],`no line ${end}`);
  assert.equal(SHOW.lines['end-first'].audio,'drones-end-first');
  // The 23:00 show runs on past midnight.
  assert.equal(Math.round(showTime(at(23,90))),90);
  assert.equal(SHOW.times[showIndex((23+90/60)%24)].end,'end');
  assert.equal(Math.round(showTime((23+90/60)%24)),90);
  // Admin and tests start a show by its place in `times`; anything else is refused.
  assert.equal(startShow(SHOW.times.length),false);
  assert.equal(startShow(-1),false);
  assert.equal(startShow(1.5),false);
});

test('the show flies every formation in order, from the barge and back to it',()=>{
  const steps=timeline(),seen=[],step={};
  for(let t=0;t<length;t+=.25){stepAt(steps,t,step);if(step.from===step.to&&step.from>=0&&seen.at(-1)!==step.from)seen.push(step.from);}
  assert.deepEqual(seen,SHOW.formations.map((_,i)=>i));
  assert.deepEqual(stepAt(steps,0,{}),{from:-1,to:-1,u:0});
  assert.equal(stepAt(steps,length,{}).to,-1);
});

test('a formation samples exactly as many points as there are drones, spread over its ink',()=>{
  const w=120,h=60,data=new Uint8ClampedArray(w*h*4);
  // Two blocks of ink: a big one and a small one.
  for(let y=5;y<55;y++)for(let x=5;x<70;x++)data[(y*w+x)*4+3]=255;
  for(let y=20;y<30;y++)for(let x=90;x<110;x++)data[(y*w+x)*4+3]=255;
  const points=samplePoints(data,w,h,SHOW.count);
  assert.equal(points.length,SHOW.count*2);
  for(let i=0;i<points.length;i+=2){
    const x=points[i],y=points[i+1],inBig=x>=5&&x<70&&y>=5&&y<55,inSmall=x>=90&&x<110&&y>=20&&y<30;
    assert.ok(inBig||inSmall,`point ${x},${y} is off the ink`);
    if(i)assert.ok(points[i-2]<=x,'points run left to right');
  }
  const small=[...Array(SHOW.count).keys()].filter(i=>points[i*2]>=90).length;
  assert.ok(small>5&&small<SHOW.count/5,`the small block got ${small} of ${SHOW.count}`);
  // A mask with fewer inked pixels than drones still yields one point per drone.
  const tiny=new Uint8ClampedArray(10*10*4);tiny[(5*10+5)*4+3]=255;
  assert.equal(samplePoints(tiny,10,10,50).length,100);
  assert.equal(accentPicks(SHOW.count,SHOW.accent).size,SHOW.accent);
});

test('every formation is named: text by its sign, shapes by an object',()=>{
  for(const f of SHOW.formations){
    if(f.text)assert.ok(signs.signs[f.text]?.id,`${f.text} has no sign entry`);
    else{assert.ok(objects.objects[f.look],`${f.look} is not an object`);assert.ok(f.main.length&&f.accent.length);}
    assert.equal(f.colors.length,2);
  }
  assert.ok(objects.objects.drone,'无人机 is an object');
  for(const line of Object.values(SHOW.lines))assert.match(line.audio,/^drones-/);
});

test('a look box can be seen from further than arm\'s length when it says so',()=>{
  const registry=new Registry();
  const far=registry.addLook({place:'city',x:0,z:-60,hw:20,hd:1,y0:20,y1:40,name:{id:'drone'}});
  const eye={x:0,y:1.6,z:0},dir={x:0,y:Math.sin(.4),z:-Math.cos(.4)};
  assert.equal(registry.look('city',eye,dir),null);
  far.reach=180;
  assert.equal(registry.look('city',eye,dir)?.box,far);
});

test('a far look box is hidden by anything solid in the way',()=>{
  const registry=new Registry();
  const far=registry.addLook({place:'city',x:0,z:-60,hw:20,hd:1,y0:20,y1:40,name:{id:'drone'}});
  far.reach=180;
  const eye={x:0,y:1.6,z:0},dir={x:0,y:Math.sin(.4),z:-Math.cos(.4)};
  const tower=registry.add({place:'city',x:0,z:-30,hw:5,hd:5,y0:0,y1:40,name:'building'});
  assert.equal(registry.look('city',eye,dir),null);
  tower.solid=false;   // a look-only box (a sign, a canopy) does not hide it
  assert.equal(registry.look('city',eye,dir)?.box,far);
  // Nearby, the usual rule still holds: the closest named thing is what you see.
  const cup=registry.add({place:'city',x:0,z:-3,hw:.5,hd:.5,y0:0,y1:4,name:'cup'});
  assert.equal(registry.look('city',eye,dir)?.box,cup);
});
