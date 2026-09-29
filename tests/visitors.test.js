import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Registry} from '../src/world/registry.js';
import {walkClear} from '../src/world/navigation.js';
import {makeGrid,findPath,mayGo,Visitors} from '../src/world/visitors.js';

const json=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));

test('a visitor walks round a wall rather than through it, and every leg of the path is clear',()=>{
  const registry=new Registry();
  // A 10 x 6 room with a wall across the middle that leaves a gap at the east end.
  registry.add({place:'r',x:-1,z:0,hw:4,hd:.2,y0:0,y1:2});
  const blocked=(x,z)=>registry.blocks('r',x,z,0,.38);
  const grid=makeGrid(blocked,[-5,-3,5,3]);
  const clear=(a,b)=>walkClear(registry,'r',a,b,[],.38);
  const from={x:-3,z:-2},path=findPath(grid,from,{x:-3,z:2},clear);
  const end=path.at(-1);
  assert.ok(Math.hypot(end.x+3,end.z-2)<.3,'ends beside the goal');
  assert.ok(path.some(p=>p.x>3),'goes round by the gap');
  // Walkers check their steps against a body slightly slimmer than the grid's clearance.
  [from,...path].reduce((a,b)=>{assert.ok(walkClear(registry,'r',a,b,[],.34),`clear from ${a.x},${a.z} to ${b.x},${b.z}`);return b;});
});

test('an unreachable goal leads to the nearest reachable spot instead',()=>{
  const registry=new Registry();
  registry.add({place:'r',x:0,z:0,hw:5,hd:.2,y0:0,y1:2});      // wall right across
  const grid=makeGrid((x,z)=>registry.blocks('r',x,z,0,.38),[-5,-3,5,3]);
  const end=findPath(grid,{x:0,z:-2},{x:0,z:2},()=>true).at(-1);
  assert.ok(end.z<0&&end.z>-.8,'stops on the near side of the wall');
});

test('people go through a door only when both rooms stay within their limits',()=>{
  const limits={hall:[3,5],reading:[1,2]};
  const at=(hall,reading)=>[...Array(hall)].map(()=>({place:'hall'})).concat([...Array(reading)].map(()=>({place:'reading'})));
  assert.equal(mayGo(at(4,1),limits,'hall','reading'),true);
  assert.equal(mayGo(at(3,1),limits,'hall','reading'),false,'the hall keeps three');
  assert.equal(mayGo(at(4,2),limits,'hall','reading'),false,'a side room holds two');
  assert.equal(mayGo(at(4,1),limits,'reading','hall'),false,'a side room keeps one');
  assert.equal(mayGo(at(4,2),limits,'reading','hall'),true);
  // Someone already on the way counts for where they are going, not where they stand.
  const people=at(4,1);people[0].bound='reading';
  assert.equal(mayGo(people,limits,'hall','reading'),false);
});

test('the word hall visitors are all named, voiced and start within the room limits',()=>{
  const hall=json('src/content/hall-visitors.json'),rooms=json('src/content/rooms.json');
  const objects=json('src/content/objects.json').objects,cast=json('src/content/voices.json').cast;
  for(const room of Object.keys(hall.limits))assert.ok(rooms[room],room);
  // A role is looked at under its own key, so what the nameplate says is what they are called.
  for(const [role,{zh}] of Object.entries(hall.roles))assert.equal(objects[role]?.zh,zh,'objects.json names '+role);
  for(const [key,line] of Object.entries(hall.lines)){
    assert.equal(line.audio,'hall-'+key);
    assert.ok(cast[line.speaker],'voice cast for '+line.speaker);
    assert.ok(line.zh&&line.pinyin&&line.en,key);
  }
  for(const one of hall.people){
    assert.ok(hall.roles[one.role],one.role);
    assert.ok(hall.lines[one.line],one.line);
    assert.ok(hall.limits[one.room],one.room);
  }
  for(const [room,[min,max]] of Object.entries(hall.limits)){
    const n=hall.people.filter(one=>one.room===room).length;
    assert.ok(n>=min&&n<=max,`${room} starts with ${n}`);
  }
});

test('someone getting up from a seat does not stand up inside the tourist',()=>{
  const registry=new Registry();
  const node=()=>({setLocalPosition(){},setLocalEulerAngles(){},getLocalScale:()=>({x:1,y:1,z:1,clone(){return this;}}),reparent(){}});
  const models={person:()=>({entity:node(),legs:[node(),node()],arms:[node(),node()],eyes:[]})};
  const data={size:[12,10],spawn:[0,3],annexes:[]};
  const rooms=new Map([['hall',{data,root:node(),fittings:[],offsetX:0}]]);
  let player={place:'hall',x:2,z:1,seat:undefined};
  const visitors=new Visitors({registry,rooms,models,seatDrop:.66,player:()=>player});
  const p=visitors.here('hall')[0];
  Object.assign(p,{mode:'sit',seat:0,standAt:{x:2,z:1}});
  visitors.standUp(p);
  assert.ok(Math.hypot(p.x-player.x,p.z-player.z)>=.9,`stood at ${p.x},${p.z}`);
  for(const o of visitors.here('hall'))if(o!==p)assert.ok(Math.hypot(p.x-o.x,p.z-o.z)>=.8,'clear of the others');
});
