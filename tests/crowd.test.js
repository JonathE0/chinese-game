import test from 'node:test';
import assert from 'node:assert/strict';
import {Registry} from '../src/world/registry.js';
import {buildCrowd} from '../src/world/crowd.js';
import {CITY_OFFSET} from '../src/world/city.js';
import crowd from '../src/content/crowd.json' with {type:'json'};

const BODY_SPACE=.85;   // crowd.js BODY+SPACE: the closest two walkers ever come
// A stand-in 云海: a 56 x 68 street with a block of towers down each side, benches, and one of the
// city's own people standing still. The crowd builds its grid from whatever the registry holds.
// A bench's `face` is the way someone sitting on it looks (the city copies it from the prop's rot).
function fakeCity({extra=[],player={x:0,z:24.5}}={}){
  const registry=new Registry();
  for(const side of [-1,1])registry.add({place:'city',x:CITY_OFFSET+side*17,z:0,hw:7,hd:30,y0:0,y1:30,name:{id:'tower'}});
  for(const z of [-10,10])registry.add({place:'city',x:CITY_OFFSET+7,z,hw:1.3,hd:.5,y0:0,y1:.95,name:{id:'bench'}});
  registry.add({place:'city',x:CITY_OFFSET-4,z:0,hw:.52,hd:.48,y0:0,y1:1.95,name:{id:'person'}});
  for(const box of extra)Object.assign(registry.add({place:'city',...box,x:CITY_OFFSET+box.x}),{face:box.face});
  const node=()=>({children:[],yaw:0,setLocalPosition(){},setLocalEulerAngles(x,y){this.yaw=y;}});
  const at={x:CITY_OFFSET+player.x,z:player.z};
  const town={registry,lookingBox:null,app:{batcher:{addGroup:()=>({id:7})}},
    rooms:new Map([['city',{data:{size:[56,68],spawn:[0,24.5]},people:[{x:-4,z:0}]}]]),
    withinPlace:(place,x,z,edge)=>Math.abs(x-CITY_OFFSET)<=28-edge&&Math.abs(z)<=34-edge,
    m:{person:()=>({entity:node(),legs:[node(),node()],arms:[node(),node()],eyes:[]})},
    player:{entity:{getPosition:()=>at}}};
  return {town,registry,at,part:buildCrowd(town,node())};
}
const upright=part=>part.people.filter(p=>p.mode!=='sit');

test('people in 云海 walk about, keep out of everything solid and out of each other',()=>{
  const {registry,part}=fakeCity();
  const people=part.people;
  assert.equal(people.length,crowd.count);
  assert.ok(crowd.count>=24&&crowd.count<=40,'24 to 40 people');
  const start=people.map(p=>({x:p.x,z:p.z}));
  let sat=0;
  for(let step=0;step<3600;step++){
    part.update(.05,false);
    const up=upright(part);
    sat=Math.max(sat,people.length-up.length);
    for(const p of up)assert.ok(!registry.blocks('city',CITY_OFFSET+p.x,p.z,0,.2),`inside something at ${p.x},${p.z}`);
    for(let a=0;a<up.length;a++)for(let b=a+1;b<up.length;b++)
      assert.ok(Math.hypot(up[a].x-up[b].x,up[a].z-up[b].z)>BODY_SPACE-1e-6,'two people walked into each other');
    assert.ok(people.every(p=>p.box.x===CITY_OFFSET+p.x&&p.box.z===p.z),'look boxes follow them');
  }
  const moved=people.filter((p,i)=>Math.hypot(p.x-start[i].x,p.z-start[i].z)>1).length;
  assert.ok(moved>people.length/2,`only ${moved} moved`);
  assert.ok(sat>0,'nobody sat on a bench');
});

test('walkers keep clear of the tourist standing among them, and nobody heads for the metro exit',()=>{
  const {part}=fakeCity({player:{x:0,z:-20}});
  assert.ok(part.goals.every(c=>Math.hypot(c.x,c.z-24.5)>2),'a goal at the metro spawn');
  for(const p of part.people)if(Math.hypot(p.x,p.z+20)<2){p.x+=3;p.box.x+=3;}   // nobody starts on top of you
  for(let step=0;step<2400;step++){
    part.update(.05,false);
    for(const p of upright(part))assert.ok(Math.hypot(p.x,p.z+20)>1.2,`walked into the tourist at ${p.x},${p.z}`);
  }
});

test('walkers keep off a marked road except at its crossing',()=>{
  const road={x:0,z:-4,hw:10,hd:2,y0:-.2,y1:.02,solid:false,name:{id:crowd.keepOff}};
  const crossing={x:3,z:-4,hw:1.5,hd:2.2,y0:-.2,y1:.03,solid:false,name:{id:crowd.crossAt}};
  const {part}=fakeCity({extra:[road,crossing]});
  const onRoad=(x,z,inset)=>Math.abs(x)<10-inset&&Math.abs(z+4)<2-inset&&!(Math.abs(x-3)<1.5+inset);
  assert.ok(!part.goals.some(c=>onRoad(c.x,c.z,0)),'a goal on the road');
  assert.ok(part.goals.some(c=>Math.abs(c.x-3)<1.5&&Math.abs(c.z+4)<1),'the crossing is walkable');
  for(let step=0;step<2400;step++){
    part.update(.05,false);
    for(const p of upright(part))assert.ok(!onRoad(p.x,p.z,.4),`walking down the road at ${p.x},${p.z}`);
  }
});

test('someone sitting down faces the way the bench does, or its open side if it does not say',()=>{
  const faced={x:-7,z:-20,hw:.5,hd:1.3,y0:0,y1:.95,name:{id:'bench'},face:90};
  // A wall right behind the bench at z 10 leaves it open to the north (-z) only.
  const wall={x:7,z:11,hw:3,hd:.2,y0:0,y1:2,name:{id:'wall'}};
  const {part}=fakeCity({extra:[faced,wall]});
  const sit=seat=>{
    const p=upright(part).find(o=>!o.seat);
    Object.assign(p,{mode:'walk',path:[],plan:{seat,goal:seat},seat});seat.by=p;
    part.update(.01,false);
    assert.equal(p.mode,'sit');
    return p.entity.yaw;
  };
  assert.equal(sit(part.seats.find(s=>s.bench.x===-7)),90);
  assert.equal(sit(part.seats.find(s=>s.bench.z===10)),180);
});

test('the tourist cannot walk into someone, but can always step away',()=>{
  const {part}=fakeCity();
  const p=part.people[0],from={x:CITY_OFFSET+p.x+1,z:p.z};
  assert.equal(part.blocks('city',CITY_OFFSET+p.x+.7,p.z,from),true);
  assert.equal(part.blocks('city',CITY_OFFSET+p.x+.8,p.z,{x:CITY_OFFSET+p.x+.7,z:p.z}),false);
  assert.equal(part.blocks('town',CITY_OFFSET+p.x+.7,p.z,from),false);
});
