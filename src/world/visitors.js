import {walkClear} from './navigation.js';
import {annexApproach} from './interior.js';
import {initIdle,animateIdle,restIdle} from './idle.js';
import hall from '../content/hall-visitors.json' with {type:'json'};

/**
 * People in the word hall (src/content/hall-visitors.json). Each strolls over to a shelf or a desk
 * and looks at it for a while, sits down to read, or walks out through a side room's door and
 * turns up in that room from its doorway — keeping every room within its `limits`.
 *
 * Paths come from a coarse grid of the room's free floor, worked out once per room from the
 * collision registry, and pulled straight wherever `walkClear` sees a clear line. People keep
 * out of each other's way and the tourist's as they go, and give up on a walk that stays blocked.
 * Everyone moves all the time, in every room, so a room you walk into has already been lived in;
 * only the room you are in is animated.
 */
const CELL=.3,CLEAR=.38;          // grid spacing, and the clearance a cell keeps from furniture
const BODY=.34,SPACE=.4,PLAYER=.9;  // how close a walker comes to another visitor or the tourist
const SPEED=1.05;
const STEPS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=list=>list[Math.floor(Math.random()*list.length)];

/** The walkable cells of a rectangle [x0,z0,x1,z1]; with `seed`, only those joined to that spot. */
export function makeGrid(blocked,[x0,z0,x1,z1],cell=CELL,seed=null){
  const nx=Math.round((x1-x0)/cell),nz=Math.round((z1-z0)/cell),free=new Uint8Array(nx*nz);
  const g={x0,z0,cell,nx,nz,free};
  for(let n=0;n<free.length;n++){const c=centre(g,n);free[n]=blocked(c.x,c.z)?0:1;}
  if(seed){
    const start=nearestFree(g,seed),joined=start<0?[]:flood(g,start).queue;
    free.fill(0);for(const n of joined)free[n]=1;
  }
  return g;
}
export function centre(g,n){return {x:g.x0+(n%g.nx+.5)*g.cell,z:g.z0+(Math.floor(n/g.nx)+.5)*g.cell};}
function nearestFree(g,p){
  let best=-1,bestD=Infinity;
  for(let n=0;n<g.free.length;n++)if(g.free[n]){const d=gap(g,n,p);if(d<bestD){bestD=d;best=n;}}
  return best;
}
/** Squared distance from a cell's centre to a point, without making the centre. */
function gap(g,n,p){const dx=g.x0+(n%g.nx+.5)*g.cell-p.x,dz=g.z0+(Math.floor(n/g.nx)+.5)*g.cell-p.z;return dx*dx+dz*dz;}
/** Breadth first over free cells, eight ways round, never cutting the corner of a blocked cell. */
function flood(g,start){
  const prev=new Int32Array(g.free.length).fill(-1),queue=[start];prev[start]=start;
  for(let q=0;q<queue.length;q++){
    const n=queue[q],i=n%g.nx,k=(n-i)/g.nx;
    for(const [di,dk] of STEPS){
      const a=i+di,b=k+dk,m=b*g.nx+a;
      if(a<0||b<0||a>=g.nx||b>=g.nz||!g.free[m]||prev[m]>=0)continue;
      if(di&&dk&&!(g.free[k*g.nx+a]&&g.free[b*g.nx+i]))continue;
      prev[m]=n;queue.push(m);
    }
  }
  return {prev,queue};
}
/**
 * Waypoints from `from` to the reachable cell nearest `to` (to `to` itself when it can be reached).
 * `clear(a,b)` says whether a straight walk between two points is free; the path takes the
 * longest straight legs it allows.
 */
export function findPath(g,from,to,clear){
  const start=nearestFree(g,from);if(start<0)return [];
  const {prev,queue}=flood(g,start);
  let best=start,bestD=Infinity;
  for(const n of queue){const d=gap(g,n,to);if(d<bestD){bestD=d;best=n;}}
  const points=[];for(let n=best;n!==start;n=prev[n])points.unshift(centre(g,n));
  points.unshift(from,centre(g,start));
  const out=[];
  for(let i=0;i<points.length-1;){
    let j=points.length-1;while(j>i+1&&!clear(points[i],points[j]))j--;
    out.push(points[j]);i=j;
  }
  return out;
}
/** A grid with the cells round some spots ({x,z,radius} plus the grid's clearance) taken out. */
export function without(g,spots){
  if(!spots.length)return g;
  const free=g.free.slice();
  for(let n=0;n<free.length;n++)if(free[n])for(const s of spots)if(gap(g,n,s)<(s.radius+CLEAR)**2){free[n]=0;break;}
  return {...g,free};
}
/** Whether someone may walk from one room into another: `from` keeps its fewest, `to` stays within
 *  its most. Anyone already on their way somewhere counts for where they are going. */
export function mayGo(people,limits,from,to){
  const count=room=>people.filter(p=>(p.bound??p.place)===room).length;
  return count(from)-1>=limits[from][0]&&count(to)<limits[to][1];
}

export class Visitors {
  /** `rooms` is the town's room map; `player()` says where the tourist is: {place,x,z,seat}. */
  constructor({registry,rooms,models,player,seatDrop}){
    Object.assign(this,{registry,rooms,player,seatDrop});this.grids=new Map();
    this.people=hall.people.filter(def=>rooms.has(def.room)).map((def,index)=>{
      const made=models.person(rooms.get(def.room).root,def.color,[0,0,0]);
      made.entity.lookName=def.role;
      return initIdle({...def,...made,index,place:def.room,x:0,z:0,mode:'idle',wait:rand(0,3),
        settled:rand(0,20),path:[],leg:0,seat:null,bound:null,plan:null,blocked:0,doorWait:0});
    });
    for(const p of this.people){
      const g=this.grid(p.place),off=this.rooms.get(p.place).offsetX;
      const spots=[...g.free.keys()].filter(n=>g.free[n]).map(n=>centre(g,n))
        .filter(c=>this.people.every(o=>o===p||o.place!==p.place||Math.hypot(c.x-off-o.x,c.z-o.z)>1.2));
      const spot=pick(spots)??{x:off,z:0};
      this.put(p,spot.x-off,spot.z);p.entity.setLocalEulerAngles(0,rand(0,360),0);
    }
  }
  /** The free floor of a room, joined to the spot the tourist walks in at. */
  grid(place){
    if(!this.grids.has(place)){
      const {offsetX,data}=this.rooms.get(place),[w,d]=data.size;
      this.grids.set(place,makeGrid((x,z)=>this.registry.blocks(place,x,z,0,CLEAR),
        [offsetX-w/2,-d/2,offsetX+w/2,d/2],CELL,{x:offsetX+data.spawn[0],z:data.spawn[1]}));
    }
    return this.grids.get(place);
  }
  here(place){return this.people.filter(p=>p.place===place);}
  /** Talk to the person you are looking at. Only then: people walk past the lectern and the doors,
   *  and should not take their place as the nearest thing to press E on. */
  targets(place,looked){
    const off=this.rooms.get(place)?.offsetX;
    return this.here(place).filter(p=>p.entity===looked).map(p=>({id:'hall:'+p.index,x:off+p.x,z:p.z,radius:2.2,
      label:'和'+hall.roles[p.role].zh+'说话',wide:false}));
  }
  /** True when the tourist stepping to (x,z) would walk into someone rather than away from them. */
  blocks(place,x,z,from){
    const off=this.rooms.get(place)?.offsetX;
    return this.here(place).some(p=>{
      const d=Math.hypot(x-off-p.x,z-p.z);
      return d<.86&&d<Math.hypot(from.x-off-p.x,from.z-p.z);
    });
  }
  put(p,x,z,y=0){p.x=x;p.z=z;p.entity.setLocalPosition(x,y,z);}
  update(dt){
    const player=this.player();
    for(const p of this.people){
      const shown=p.place===player.place;
      p.settled-=dt;
      if(p.mode==='walk'){this.walk(p,dt,player,shown);continue;}
      p.wait-=dt;
      // The tourist sat down in their seat: they get up and make room.
      if(p.mode==='sit'&&shown&&player.seat===p.seat)p.wait=0;
      if(shown)animateIdle(p,dt,p.mode==='sit');
      if(p.wait<=0){if(p.mode==='sit')this.standUp(p);else this.next(p,player);}
    }
  }
  /** Choose what to do next: go through a door now and then, sit down, or look at something. */
  next(p,player){
    if(p.bound)return this.goThrough(p,player);
    const room=this.rooms.get(p.place),roll=Math.random();
    if(roll<.25&&p.settled<=0){
      // Not a door the tourist is standing at: nobody squeezes past them to get through it.
      const exits=this.exits(p.place).filter(e=>mayGo(this.people,hall.limits,p.place,e.to)&&
        !(player.place===p.place&&Math.hypot(player.x-room.offsetX-e.x,player.z-e.z)<2.5));
      const exit=pick(exits);
      if(exit&&this.head(p,exit,{door:exit.to}))return;
    }
    if(roll<.6){
      const seat=this.freeSeat(p,player);
      if(seat!==null&&this.head(p,room.fittings[seat],{seat}))return;
    }
    const thing=pick(room.fittings.filter(f=>f.name&&f.top>.6&&f.seat===undefined));
    if(thing&&this.head(p,thing,{look:thing}))return;
    p.mode='idle';p.wait=rand(1,3);
  }
  /** Each way out of a room that leads somewhere visitors go: `to`, and a spot just inside it. */
  exits(place){
    const {data}=this.rooms.get(place),[w,d]=data.size;
    const out=(data.annexes??[]).filter(a=>hall.limits[a.room]&&this.rooms.has(a.room))
      .map(a=>({to:a.room,...annexApproach(a.wall,a.x,a.z,w,d,.6)}));
    if(hall.limits[data.returnPlace])out.push({to:data.returnPlace,x:data.exit[0],z:data.exit[1]});
    return out;
  }
  freeSeat(p,player){
    const taken=new Set(this.here(p.place).map(o=>o.seat));
    if(player.place===p.place)taken.add(player.seat);
    const free=[...this.rooms.get(p.place).fittings.keys()].filter(i=>this.rooms.get(p.place).fittings[i].seat!==undefined&&!taken.has(i));
    return free.length?pick(free):null;
  }
  /** Set off towards a spot; false when the nearest place to stand is not near it. */
  head(p,goal,plan){
    const off=this.rooms.get(p.place).offsetX,player=this.player();
    // Plan round anyone standing about, and the tourist, as well as the furniture.
    const still=this.here(p.place).filter(o=>o!==p&&o.mode==='idle').map(o=>({x:off+o.x,z:o.z,radius:.8-CLEAR}));
    if(player.place===p.place)still.push({x:player.x,z:player.z,radius:1.3-CLEAR});
    const clear=(a,b)=>walkClear(this.registry,p.place,a,b,still,CLEAR);
    const path=findPath(without(this.grid(p.place),still),{x:off+p.x,z:p.z},{x:off+goal.x,z:goal.z},clear)
      .map(q=>({x:q.x-off,z:q.z}));
    const end=path.at(-1)??p;
    if(Math.hypot(end.x-goal.x,end.z-goal.z)>1.8)return false;
    Object.assign(p,{path,plan:{...plan,goal},mode:'walk',blocked:0,bound:plan.door??null,seat:plan.seat??null});
    return true;
  }
  walk(p,dt,player,shown){
    const target=p.path[0];
    if(!target)return this.arrive(p,player);
    const dx=target.x-p.x,dz=target.z-p.z,distance=Math.hypot(dx,dz);
    if(distance<.04){p.path.shift();return;}
    const step=Math.min(distance,SPEED*dt),x=p.x+dx/distance*step,z=p.z+dz/distance*step;
    // The path already keeps clear of the furniture; what is left is the people. Stepping away from
    // somebody too close is always allowed, so two people who end up overlapping can part.
    const off=this.rooms.get(p.place).offsetX;
    const others=this.here(p.place).filter(o=>o!==p&&o.mode!=='sit').map(o=>({x:o.x,z:o.z,r:SPACE}));
    if(player.place===p.place)others.push({x:player.x-off,z:player.z,r:PLAYER});
    const blocked=others.some(o=>{const d=Math.hypot(x-o.x,z-o.z);return d<BODY+o.r&&d<Math.hypot(p.x-o.x,p.z-o.z);});
    if(blocked){
      p.blocked+=dt;
      if(shown){restIdle(p);animateIdle(p,dt);}
      // Still in the way: find a way round them once, then do something else.
      if(p.blocked>2&&!(!p.plan.retried&&this.head(p,p.plan.goal,{...p.plan,retried:true})))this.giveUp(p);
      return;
    }
    p.blocked=0;this.put(p,x,z);
    // The model's face looks down its own +z, so the heading is atan2 with no half turn added.
    p.entity.setLocalEulerAngles(0,Math.atan2(dx,dz)*180/Math.PI,0);
    if(!shown)return;
    p.leg+=dt*7;
    p.legs.forEach((leg,i)=>leg.setLocalEulerAngles(Math.sin(p.leg+i*Math.PI)*21,0,0));
    p.arms.forEach((arm,i)=>arm.setLocalEulerAngles(Math.sin(p.leg+i*Math.PI)*-16,0,0));
    animateIdle(p,dt,true);
  }
  giveUp(p){Object.assign(p,{path:[],plan:null,bound:null,seat:null,mode:'idle',wait:rand(.5,2),blocked:0});}
  arrive(p,player){
    const plan=p.plan;p.plan=null;restIdle(p);
    if(plan?.door)return this.goThrough(p,player);
    if(plan?.seat!==undefined)return this.sitDown(p,player);
    if(plan?.look)p.entity.setLocalEulerAngles(0,Math.atan2(plan.look.x-p.x,plan.look.z-p.z)*180/Math.PI,0);
    p.mode='idle';p.wait=rand(3,8);
  }
  sitDown(p,player){
    const seat=this.rooms.get(p.place).fittings[p.seat];
    if(player.place===p.place&&player.seat===p.seat){p.seat=null;p.mode='idle';p.wait=1;return;}
    p.standAt={x:p.x,z:p.z};
    this.put(p,seat.x,seat.z,seat.seat-this.seatDrop);
    p.entity.setLocalEulerAngles(0,seat.rot??0,0);
    p.legs.forEach(leg=>leg.setLocalEulerAngles(78,0,0));
    p.arms.forEach((arm,i)=>arm.setLocalEulerAngles(14,0,i?-5:5));
    p.mode='sit';p.wait=rand(10,25);
  }
  /** Up off the seat where they sat down from, or the nearest free spot if someone stands there now. */
  standUp(p){
    const player=this.player(),off=this.rooms.get(p.place).offsetX;
    const clear=(x,z)=>(player.place!==p.place||Math.hypot(player.x-off-x,player.z-z)>=.9)&&
      this.here(p.place).every(o=>o===p||Math.hypot(o.x-x,o.z-z)>=.8);
    let spot=p.standAt;
    if(!clear(spot.x,spot.z)){
      const g=this.grid(p.place);
      spot=[...g.free.keys()].filter(n=>g.free[n]).map(n=>centre(g,n)).map(c=>({x:c.x-off,z:c.z}))
        .filter(c=>clear(c.x,c.z)).sort((a,b)=>Math.hypot(a.x-spot.x,a.z-spot.z)-Math.hypot(b.x-spot.x,b.z-spot.z))[0]??spot;
    }
    this.put(p,spot.x,spot.z);
    p.legs.forEach(leg=>leg.setLocalEulerAngles(0,0,0));
    p.arms.forEach(arm=>arm.setLocalEulerAngles(0,0,0));
    p.seat=null;p.mode='idle';p.wait=rand(.5,2);
  }
  /** At the door: step into the other room from its doorway once nobody is standing there. */
  goThrough(p,player){
    const from=this.rooms.get(p.place),to=this.rooms.get(p.bound);
    // Someone else may have given up a trip this one was counting on: check the rooms as they are.
    const [least]=hall.limits[p.place],[,most]=hall.limits[p.bound];
    if(this.here(p.place).length-1<least||this.here(p.bound).length>=most){p.bound=null;p.mode='idle';p.wait=rand(.5,2);return;}
    // Into a back room you arrive at its door; back out, at the door you left the hall by.
    const spot=(to.data.returnPlace!==p.place&&from.data.returnSpawn)||to.data.spawn;
    const taken=this.here(p.bound).some(o=>Math.hypot(o.x-spot[0],o.z-spot[1])<.9)||
      player.place===p.bound&&Math.hypot(player.x-to.offsetX-spot[0],player.z-spot[1])<1.3;
    if(taken){
      p.doorWait+=.6;
      if(p.doorWait>8){p.bound=null;p.doorWait=0;}
      p.mode='idle';p.wait=.6;return;
    }
    p.doorWait=0;
    p.entity.reparent(to.root);p.place=p.bound;p.bound=null;
    this.put(p,spot[0],spot[1]);
    // A spawn's yaw is the tourist's view; the body faces the other way round.
    p.entity.setLocalEulerAngles(0,(spot[2]??0)+180,0);
    p.settled=rand(15,30);p.mode='idle';p.wait=rand(.3,1.2);
  }
}
