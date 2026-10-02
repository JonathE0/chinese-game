import {makeGrid,findPath,centre,without} from './visitors.js';
import {initIdle,animateIdle,restIdle} from './idle.js';
import {CITY,CITY_OFFSET} from './city.js';
import {detail,RENDER} from '../core/quality.js';
import crowd from '../content/crowd.json' with {type:'json'};
import objects from '../content/objects.json' with {type:'json'};

/**
 * People walking around 云海 (task P-crowd, docs/superpowers/plans/2026-09-26-development-wave-2.md;
 * data in src/content/crowd.json). They stroll between spots on the city's flat ground, stop for a
 * while, sit on benches and stand at the railing looking out over the bay.
 *
 * The walking is the word hall's (src/world/visitors.js): a grid of free floor worked out once from
 * the collision registry, when the city is built — so it follows whatever layout the city has —
 * breadth-first paths over it pulled straight, and people who give way to each other and to the
 * tourist as they go. Positions are city-local; the city root sits at CITY_OFFSET.
 *
 * They are cheap to draw: every body part carries its colour in its vertices and shares one
 * material, and all of them sit in one dynamic batch group, so the whole crowd is two draw calls
 * (what casts a shadow and what does not) rather than twenty per person. Only people near the
 * tourist move their limbs and faces. The per-frame walk allocates nothing.
 */
// Grid spacing, and the clearance kept from anything solid by every point of a free cell: a cell's
// centre keeps that plus half its diagonal.
const CELL=.5,CLEAR=.3,REACH=CLEAR+CELL*.71;
const BODY=.4,SPACE=.45,PLAYER=.9;  // how close a walker comes to someone else, and to the tourist
const SEAT_DROP=.66;                // as town.js: how far a body sinks so the hips land on the seat
const STROLL=45;                    // how far (m) someone usually heads off to next
const NAME={id:'pedestrian',...objects.objects.pedestrian};
const NONE=[];
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=list=>list[Math.floor(Math.random()*list.length)];

/** Whether a city-local spot lies in a free cell of the grid. */
function freeAt(g,x,z){
  const i=Math.floor((x-g.x0)/g.cell),k=Math.floor((z-g.z0)/g.cell);
  return i>=0&&k>=0&&i<g.nx&&k<g.nz&&g.free[k*g.nx+i]===1;
}
/** A straight walk between two points stays on free cells (the grid already keeps its clearance). */
const clearIn=g=>(a,b)=>{
  const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/(g.cell/4));
  for(let i=1;i<=n;i++)if(!freeAt(g,a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;
  return true;
};

export function buildCrowd(town,root){
  const room=town.rooms.get('city'),reg=town.registry;
  const bounds=[Math.min(...crowd.areas.map(a=>a[0])),Math.min(...crowd.areas.map(a=>a[1])),
    Math.max(...crowd.areas.map(a=>a[2])),Math.max(...crowd.areas.map(a=>a[3]))];
  // Only the city's solid shapes near the walkable ground matter: the town, its rooms and the skyline
  // across the bay have thousands of their own.
  const near=b=>b.x+b.hw>CITY_OFFSET+bounds[0]-1&&b.x-b.hw<CITY_OFFSET+bounds[2]+1&&b.z+b.hd>bounds[1]-1&&b.z-b.hd<bounds[3]+1;
  const local=Object.create(reg),solids=reg.boxes.filter(b=>b.place==='city'&&b.solid&&near(b));
  // The grid runs to about a hundred thousand cells: each looks only at the solids in its 8 m square
  // (every solid is filed under each square it reaches into, its reach included), not at them all.
  const S=8,squares=new Map(),square=(i,k)=>i*4096+k;
  for(const b of solids){
    const x=b.x-CITY_OFFSET;
    for(let i=Math.floor((x-b.hw-REACH)/S);i<=Math.floor((x+b.hw+REACH)/S);i++)
      for(let k=Math.floor((b.z-b.hd-REACH)/S);k<=Math.floor((b.z+b.hd+REACH)/S);k++){
        const id=square(i,k);if(!squares.has(id))squares.set(id,[]);squares.get(id).push(b);
      }
  }
  const inArea=(x,z)=>crowd.areas.some(([x0,z0,x1,z1])=>x>=x0&&x<=x1&&z>=z0&&z<=z1);
  const blocked=(x,z)=>{
    if(!inArea(x,z)||!town.withinPlace('city',CITY_OFFSET+x,z,REACH))return true;
    local.boxes=squares.get(square(Math.floor(x/S),Math.floor(z/S)))??NONE;
    return local.blocks('city',CITY_OFFSET+x,z,0,REACH)||local.groundAt('city',CITY_OFFSET+x,z,0,REACH)>.05;
  };
  const spawn={x:room.data.spawn[0],z:room.data.spawn[1]};
  const grid=makeGrid(blocked,bounds,CELL,spawn);
  local.boxes=solids;
  const cells=[...grid.free.keys()].filter(n=>grid.free[n]).map(n=>centre(grid,n));
  if(!cells.length)return null;
  // Where people head for: anywhere but the metro's exits, where the tourist steps out of the station.
  const exits=[spawn,...(CITY.metroStation?.exits??[]).map(one=>({x:one.spawn[0],z:one.spawn[1]}))];
  const goals=cells.filter(c=>exits.every(e=>Math.hypot(c.x-e.x,c.z-e.z)>2));
  const lookouts=goals.filter(c=>c.z<crowd.bay.z);
  // Two places on every bench the city marks, one each side of the middle. A bench's `face` (the
  // prop's rot) is the way its sitters look; without one they face its more open side.
  const seats=local.boxes.filter(b=>b.name?.id==='bench'&&inArea(b.x-CITY_OFFSET,b.z)).flatMap(b=>{
    const x=b.x-CITY_OFFSET,along=b.hw>=b.hd;
    const open=side=>cells.filter(c=>along?Math.abs(c.x-x)<b.hw&&(c.z-b.z)*side>0&&(c.z-b.z)*side<b.hd+2
      :Math.abs(c.z-b.z)<b.hd&&(c.x-x)*side>0&&(c.x-x)*side<b.hw+2).length;
    const face=b.face??(open(1)>=open(-1)?(along?0:90):(along?180:-90));
    return [-1,1].map(side=>({x:along?x+side*b.hw*.45:x,z:along?b.z:b.z+side*b.hd*.45,bench:{x,z:b.z,face},by:null}));
  });
  // Every body part in one dynamic batch, all in one material (models.repaint): two draw calls
  // however many people. A lower graphics level (src/core/quality.js) has fewer of them.
  const group=town.app.batcher.addGroup('city-crowd',true);
  const batch=e=>{if(e.render){town.m.repaint(e);e.render.batchGroupId=group.id;}for(const child of e.children)batch(child);};
  const still=room.people??[];
  const people=[];
  for(let i=0;i<Math.round(crowd.count*RENDER[detail()].crowd);i++){
    const made=town.m.person(root,crowd.colors[i%crowd.colors.length],[0,0,0],false,undefined,{mix:crowd.mix});
    batch(made.entity);
    // Somewhere at random clear of the exits and of everyone placed so far (drawn until one is, not
    // filtered out of the whole grid for every person).
    const clear=c=>exits.every(e=>Math.hypot(c.x-e.x,c.z-e.z)>3)&&people.every(o=>Math.hypot(c.x-o.x,c.z-o.z)>1.5);
    let spot=null;
    for(let tries=0;tries<400&&!spot;tries++){const c=pick(goals.length?goals:cells);if(clear(c))spot=c;}
    spot??=pick(cells);
    const p=initIdle({...made,i,color:crowd.colors[i%crowd.colors.length],line:i%crowd.lines.length,x:spot.x,z:spot.z,
      speed:rand(1,1.4),mode:'idle',wait:rand(0,4),path:[],plan:null,blocked:0,leg:rand(0,6),seat:null,standAt:null,near:false});
    p.entity.setLocalPosition(p.x,0,p.z);p.entity.setLocalEulerAngles(0,rand(0,360),0);
    p.box=reg.addLook({place:'city',x:CITY_OFFSET+p.x,z:p.z,hw:.34,hd:.34,y0:0,y1:1.95,name:NAME,owner:'crowd',entity:p.entity});
    people.push(p);
  }

  const player={x:0,z:0};
  /** True when stepping to (x,z) takes p closer to someone already too close. */
  function bumps(p,x,z){
    for(const o of people){
      if(o===p||o.mode==='sit')continue;
      const d=Math.hypot(x-o.x,z-o.z);
      if(d<BODY+SPACE&&d<Math.hypot(p.x-o.x,p.z-o.z))return true;
    }
    for(const o of still){const d=Math.hypot(x-o.x,z-o.z);if(d<BODY+SPACE&&d<Math.hypot(p.x-o.x,p.z-o.z))return true;}
    const d=Math.hypot(x-player.x,z-player.z);
    return d<BODY+PLAYER&&d<Math.hypot(p.x-player.x,p.z-player.z);
  }
  /** Set off towards a spot, round `avoid` if given; false when nowhere near it can be reached. */
  function head(p,goal,plan,avoid=[]){
    const g=without(grid,avoid);
    const path=findPath(g,{x:p.x,z:p.z},goal,clearIn(g));
    const end=path.at(-1)??p;
    if(Math.hypot(end.x-goal.x,end.z-goal.z)>1.8)return false;
    Object.assign(p,{path,plan:{...plan,goal},mode:'walk',blocked:0});
    return true;
  }
  /** One of `list` within a stroll of p if a few draws find one, else any: the path search then
   *  covers a stroll's worth of the grid rather than the whole city. */
  function nearby(p,list){
    for(let tries=0;tries<12;tries++){const c=pick(list);if(Math.hypot(c.x-p.x,c.z-p.z)<STROLL)return c;}
    return pick(list);
  }
  /** Sit on a free bench now and then, look out over the bay, or just walk somewhere else. */
  function next(p){
    const roll=Math.random();
    if(roll<.2){
      const free=seats.filter(s=>!s.by),seat=free.length?nearby(p,free):null;
      if(seat&&head(p,seat,{seat})){seat.by=p;p.seat=seat;return;}
    }
    if(roll<.4&&lookouts.length&&head(p,nearby(p,lookouts),{yaw:crowd.bay.yaw}))return;
    if(goals.length&&head(p,nearby(p,goals),{}))return;
    p.mode='idle';p.wait=rand(1,3);
  }
  function giveUp(p){
    if(p.seat)p.seat.by=null;
    Object.assign(p,{path:[],plan:null,seat:null,mode:'idle',wait:rand(.5,2),blocked:0});
  }
  function walk(p,dt,near){
    const target=p.path[0];
    if(!target)return arrive(p);
    const dx=target.x-p.x,dz=target.z-p.z,distance=Math.hypot(dx,dz);
    if(distance<.04){p.path.shift();return;}
    const step=Math.min(distance,p.speed*dt),x=p.x+dx/distance*step,z=p.z+dz/distance*step;
    if(bumps(p,x,z)){
      p.blocked+=dt;
      if(near){restIdle(p);animateIdle(p,dt);}
      // Still in the way: find a way round whoever is close, once, then do something else.
      if(p.blocked>1.5&&!planned){
        planned=true;
        const avoid=people.filter(o=>o!==p&&o.mode!=='sit'&&Math.hypot(o.x-p.x,o.z-p.z)<4).map(o=>({x:o.x,z:o.z,radius:.8-CLEAR}));
        avoid.push({x:player.x,z:player.z,radius:1.3-CLEAR});
        if(p.plan.retried||!head(p,p.plan.goal,{...p.plan,retried:true},avoid))giveUp(p);
      }
      return;
    }
    p.blocked=0;p.x=x;p.z=z;
    p.entity.setLocalPosition(x,0,z);
    // The model's face looks down its own +z, so the heading is atan2 with no half turn added.
    p.entity.setLocalEulerAngles(0,Math.atan2(dx,dz)*180/Math.PI,0);
    if(!near)return;
    p.leg+=dt*6.5;
    for(let i=0;i<2;i++){
      p.legs[i].setLocalEulerAngles(Math.sin(p.leg+i*Math.PI)*21,0,0);
      p.arms[i].setLocalEulerAngles(Math.sin(p.leg+i*Math.PI)*-16,0,0);
    }
    animateIdle(p,dt,true);
  }
  function arrive(p){
    const plan=p.plan;p.plan=null;restIdle(p);
    for(let i=0;i<2;i++){p.legs[i].setLocalEulerAngles(0,0,0);p.arms[i].setLocalEulerAngles(0,0,0);}
    if(plan?.seat)return sitDown(p);
    if(plan?.yaw!==undefined)p.entity.setLocalEulerAngles(0,plan.yaw,0);
    p.mode='idle';p.wait=plan?.yaw!==undefined?rand(6,15):rand(2,6);
  }
  /** Onto the bench, facing the way it faces; not if the tourist is on it. */
  function sitDown(p){
    const seat=p.seat,{bench}=seat;
    if(Math.hypot(player.x-seat.x,player.z-seat.z)<.9)return giveUp(p);
    p.standAt={x:p.x,z:p.z};
    p.x=seat.x;p.z=seat.z;
    p.entity.setLocalPosition(seat.x,crowd.seatHeight-(p.seatDrop??SEAT_DROP),seat.z);   // hips on the bench
    p.entity.setLocalEulerAngles(0,bench.face,0);
    p.sit(crowd.seatHeight);   // thighs level, feet on the ground, hands on the knees (src/world/people.js)
    p.mode='sit';p.wait=rand(10,25);
  }
  /** Up where they sat down from, or the nearest free spot within a few steps if somebody stands
   *  there now; failing that they stay seated a little longer. */
  function standUp(p){
    const clear=c=>Math.hypot(player.x-c.x,player.z-c.z)>=BODY+PLAYER&&
      people.every(o=>o===p||o.mode==='sit'||Math.hypot(o.x-c.x,o.z-c.z)>=BODY+SPACE);
    let spot=clear(p.standAt)?p.standAt:null,best=9;
    if(!spot)for(const c of cells){
      const dx=c.x-p.standAt.x,dz=c.z-p.standAt.z,d=dx*dx+dz*dz;
      if(d<best&&clear(c)){best=d;spot=c;}
    }
    if(!spot){p.wait=rand(2,4);return;}
    p.x=spot.x;p.z=spot.z;p.entity.setLocalPosition(p.x,0,p.z);
    p.stand();
    p.seat.by=null;p.seat=null;p.mode='idle';p.wait=rand(.5,2);
  }

  // A path is a search over much of the grid: at most one person plans one a frame; the rest wait a frame.
  let planned=false;
  const part={
    people,grid,seats,goals,
    update(dt,paused){
      // Hold still while a panel is open: you may be talking to one of them.
      if(paused)return;
      const at=town.player.entity.getPosition();player.x=at.x-CITY_OFFSET;player.z=at.z;
      planned=false;
      const reach=RENDER[detail()].animate;   // closer than this (x plus z) limbs and faces animate
      for(const p of people){
        const near=Math.abs(p.x-player.x)+Math.abs(p.z-player.z)<reach;
        // Out of range the limbs stop being driven: straighten them rather than freeze mid-stride.
        if(p.near&&!near&&p.mode!=='sit')for(let i=0;i<2;i++){p.legs[i].setLocalEulerAngles(0,0,0);p.arms[i].setLocalEulerAngles(0,0,0);}
        p.near=near;
        if(p.mode==='walk')walk(p,dt,near);
        else{
          p.wait-=dt;
          if(near)animateIdle(p,dt,p.mode==='sit');
          if(p.wait<=0){if(p.mode==='sit')standUp(p);else if(!planned){planned=true;next(p);}}
        }
        p.box.x=CITY_OFFSET+p.x;p.box.z=p.z;
      }
    },
    /** Talk to the one you are looking at, and only then: they walk past everything else. Being
     *  looked at (`aimed`) wins over a kiosk or a door that happens to be nearer. */
    targets(){
      const looked=town.lookingBox?.entity;
      if(!looked)return NONE;
      for(const p of people)if(p.entity===looked)
        return [{id:'crowd:'+p.i,x:CITY_OFFSET+p.x,z:p.z,radius:2.2,label:'和'+NAME.zh+'说话',wide:false,aimed:true}];
      return NONE;
    },
    /** True when the tourist stepping to (x,z) would walk into someone rather than away from them.
     *  Only a step: asking about somewhere across the street is not walking into anybody. */
    blocks(place,x,z,from){
      if(place!=='city'||Math.hypot(x-from.x,z-from.z)>1)return false;
      for(const p of people){
        const d=Math.hypot(x-CITY_OFFSET-p.x,z-p.z);
        if(d<.86&&d<Math.hypot(from.x-CITY_OFFSET-p.x,from.z-p.z))return true;
      }
      return false;
    },
  };
  town.crowd=part;
  return part;
}
