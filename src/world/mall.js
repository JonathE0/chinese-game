import * as pc from 'playcanvas';
import rooms from '../content/rooms.json' with {type:'json'};
import mall from '../content/mall.json' with {type:'json'};
import floors from '../content/floors.json' with {type:'json'};
import {CITY,CITY_OFFSET} from './city.js';
import {floorMaterial} from './paving.js';
import {detail} from '../core/quality.js';
import {zh,scripted} from '../services/script.js';

/**
 * 星光百货 (task Y-mall, docs/superpowers/plans/2026-09-27-development-wave-3.md; data in
 * src/content/mall.json). `buildMall(town, root)` is called once when 云海 is built: it puts the
 * building on the avenue (a city part: a glass front, a curved canopy, an LED screen and the name,
 * lit at night) and fills the `mall` room (rooms.json: its shell, counters and assistants) with
 * four floors round an atrium under a glass roof, escalators, a glass lift, shop fronts and signs.
 *
 * The floors are the room system's own collision boxes, as the house's upper floor and the hill's
 * steps are: `mallLayout` lists every solid part once, for the hitboxes, the drawing and the tests.
 * An escalator is a flight of solid steps a rise below the steps you see; the steps you see move
 * (one mesh per flight, shifted along the slope) and carry you, standing on the one under your feet.
 * The lift is a glass car you ride to the floor you pick (src/ui/mall.js).
 */

/** Everything solid in the mall, room-local: floors, steps, railings, the lift shaft, cores and piers. */
export function mallLayout(room=rooms.mall,data=mall){
  const [w,d]=room.size,levels=room.levels,[vx0,vz0,vx1,vz1]=data.void,e=data.escalators,l=data.lift;
  const {slab,roof,front}=data,parts=[],flights=[];
  const add=(kind,x0,z0,x1,z1,y0,y1,name)=>{
    if(x1-x0>1e-6&&z1-z0>1e-6&&y1-y0>1e-6)parts.push({kind,x:(x0+x1)/2,z:(z0+z1)/2,hw:(x1-x0)/2,hd:(z1-z0)/2,y0,y1,...(name?{name}:{})});
  };
  // Each floor above the ground: the galleries round the atrium and the shops, between the corner cores.
  for(const y of levels.slice(1))for(const [x0,z0,x1,z1] of floorPlan(w,d,data))add('slab',x0,z0,x1,z1,y-slab,y);
  for(const [x0,z0,x1,z1] of data.cores)add('core',x0,z0,x1,z1,0,roof);
  for(const side of [-1,1])for(const z of data.piers)add('pier',side*front-.3,z-.3,side*front+.3,z+.3,0,roof);
  const ceiling=i=>i<levels.length-1?levels[i+1]-slab:roof;
  // Between two shops side by side on one floor, a wall; at each end of a shop front, display glass.
  for(const u of data.units){
    const y=levels[u.level],[x0,x1]=u.side>0?[front+.32,w/2]:[-w/2,-front-.32],gx=u.side*(front+.12);
    if(data.units.some(v=>v.level===u.level&&v.side===u.side&&v.z[0]===u.z[1]))add('wall',x0,u.z[1]-.1,x1,u.z[1]+.1,y,ceiling(u.level));
    for(const [a,b] of [[u.z[0]+.35,u.z[0]+2.2],[u.z[1]-2.2,u.z[1]-.35]])add('glass',gx-.04,a,gx+.04,b,y,ceiling(u.level),'window');
  }
  // The escalators: solid steps, each a rise below the moving step over it, and a wall up each side.
  for(const def of e.flights){
    const rises=def.rises==='east'?1:-1,y0=levels[def.level],y1=levels[def.level+1],hw=e.width/2;
    const f={id:def.id,level:def.level,z:def.z,hw,rises,moves:def.moves==='up'?1:-1,x0:rises>0?vx0:vx1,x1:rises>0?vx1:vx0,
      y0,y1,steps:e.steps,rise:e.rise,tread:e.tread,speed:e.speed};
    flights.push(f);
    for(let k=0;k<e.steps;k++){
      const a=f.x0+rises*k*e.tread,b=a+rises*e.tread,top=y0+k*e.rise;
      add('step',Math.min(a,b),def.z-hw,Math.max(a,b),def.z+hw,def.level?top-1:y0,top);
    }
    for(const side of [-1,1]){
      add('rail',vx0,def.z+side*hw-.05,vx1,def.z+side*hw+.05,def.level?y0-1:y0,y1+1.6);
      // The handrails' ends at the landings, top and bottom.
      for(const [x,y] of [[f.x0-rises*.45,y0],[f.x1+rises*.45,y1]])add('newel',x-.3,def.z+side*hw-.05,x+.3,def.z+side*hw+.05,y,y+1.15);
    }
  }
  // The atrium's balustrades, open only where a flight arrives or leaves; the lift shaft stands in its north side.
  const shaft=[l.x-l.hw,l.x+l.hw];
  for(const y of levels.slice(1)){
    const open=x=>flights.filter(f=>(f.y0===y&&f.x0===x)||(f.y1===y&&f.x1===x)).map(f=>[f.z-f.hw,f.z+f.hw]);
    for(const [z0,z1] of spans(vz0,vz1,open(vx1)))add('balustrade',vx1,z0,vx1+.1,z1,y,y+2);
    for(const [z0,z1] of spans(vz0,vz1,open(vx0)))add('balustrade',vx0-.1,z0,vx0,z1,y,y+2);
    for(const [x0,x1] of spans(vx0,vx1,[shaft]))add('balustrade',x0,vz0-.1,x1,vz0,y,y+2);
    add('balustrade',vx0,vz1,vx1,vz1+.1,y,y+2);
  }
  // The lift shaft: glass on all four sides, the doors in the north one.
  const [sx0,sx1,sz0,sz1]=[l.x-l.hw,l.x+l.hw,l.z-l.hd,l.z+l.hd],t=.08,top=shaftTop(levels);
  add('shaft',sx0,sz0,sx1,sz0+t,0,top);add('shaft',sx0,sz1-t,sx1,sz1,0,top);
  add('shaft',sx0,sz0,sx0+t,sz1,0,top);add('shaft',sx1-t,sz0,sx1,sz1,0,top);
  // Floor directories on their stands.
  for(const [x,z,rot,level] of data.decor.directories){
    const [hw,hd]=rot%180?[.18,.55]:[.55,.18];
    add('stand',x-hw,z-hd,x+hw,z+hd,levels[level],levels[level]+2.4);
  }
  return {parts,flights};
}
const shaftTop=levels=>levels.at(-1)+4.2;
/** The floor of a storey above the ground: round the atrium, and between the corner cores. */
function floorPlan(w,d,data){
  const [vx0,vz0,vx1,vz1]=data.void,front=data.front;
  const cz=Math.min(...data.cores.map(([,z0,,z1])=>Math.min(Math.abs(z0),Math.abs(z1))));
  return [[-front,-d/2,front,-cz],[-front,cz,front,d/2],[vx1,-cz,w/2,cz],[-w/2,-cz,vx0,cz],[vx0,-cz,vx1,vz0],[vx0,vz1,vx1,cz]];
}
/** [a, b] less the `gaps` (each [from, to]), as the stretches that are left. */
function spans(a,b,gaps){
  const out=[];let from=a;
  for(const [g0,g1] of [...gaps].sort((p,q)=>p[0]-q[0])){if(g0>from)out.push([from,Math.min(g0,b)]);from=Math.max(from,g1);}
  if(b>from)out.push([from,b]);
  return out.filter(([x0,x1])=>x1-x0>1e-6);
}
/**
 * The top of the moving step `s` metres along a flight (from its foot), with the steps `phase` of a
 * step on their way round: each is a rise below the solid step it is passing, so it never lifts
 * you into the next one, and it is clamped to the two landings.
 */
export function stepTop(f,s,phase){
  return Math.min(f.y1,Math.max(f.y0,f.y0+(Math.floor(s/f.tread-phase)+phase)*f.rise));
}

/** The building on the avenue, a city part (town.ensureCity). */
/**
 * One frame on the escalators: whoever stands on a flight, at the height of the moving step under
 * them, is carried along it with that step. `x`, `z` room-local, `y` the feet; `free(x, feetY)`
 * says whether x is clear to move to. Returns the new {x, y}, or null when not on a flight.
 */
export function ride(flights,x,z,y,dt,free){
  for(const f of flights){
    const s=(x-f.x0)*f.rises,run=f.steps*f.tread;
    if(s<0||s>run||Math.abs(z-f.z)>f.hw)continue;
    const here=stepTop(f,s,f.phase);
    if(Math.abs(y-here)>.45)continue;
    const nx=x+f.rises*f.moves*f.speed*dt,to=free(nx,here)?nx:x,s2=(to-f.x0)*f.rises;
    return {x:to,y:s2>=0&&s2<=run?stepTop(f,s2,f.phase):here};
  }
  return null;
}

export function buildMall(town,root){return buildFront(town,root);}

// ---------------------------------------------------------------------------------------------
// Shared pieces: glass, signs drawn once per text, and meshes made from flat faces.

function seeThrough(hex,opacity){
  const m=new pc.StandardMaterial();
  m.diffuse=new pc.Color().fromString(hex);m.opacity=opacity;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;
  m.useMetalness=true;m.metalness=.2;m.gloss=.85;m.update();
  return m;
}
/** A lit sign or screen: `map` is what it shows, glowing at `day` (raised after dark where it is a city lamp). */
function screen(map,day=.35){
  const m=new pc.StandardMaterial();
  m.diffuse=new pc.Color(.08,.08,.09);m.diffuseMap=map;m.emissive=new pc.Color(1,1,1);m.emissiveMap=map;m.emissiveIntensity=day;
  m.useMetalness=true;m.metalness=0;m.gloss=.5;m.update();
  return m;
}
function canvasTexture(canvas,repeat=false){
  const t=new pc.Texture(pc.AppBase.getApplication().graphicsDevice,{width:canvas.width,height:canvas.height,mipmaps:true,anisotropy:4,
    addressU:repeat?pc.ADDRESS_REPEAT:pc.ADDRESS_CLAMP_TO_EDGE,addressV:repeat?pc.ADDRESS_REPEAT:pc.ADDRESS_CLAMP_TO_EDGE});
  t.setSource(canvas);return t;
}
/** models.label, but a text drawn in the same colours twice shares one texture and one material. */
function signMaker(m){
  const made=new Map();
  return (parent,text,pos,w,h,bg,fg,rot=0)=>{
    const key=[text,bg,fg].join('|');let e;
    if(made.has(key)){e=m.box(parent,pos,[w,h,.08],bg);e.render.meshInstances[0].material=made.get(key);e.signText=text;}
    else{e=m.label(parent,text,pos,w,h,bg,fg);made.set(key,e.render.meshInstances[0].material);}
    e.render.castShadows=false;
    if(rot)e.setLocalEulerAngles(0,rot,0);
    return e;
  };
}
/**
 * A mesh from flat convex faces, each turned to face out of its own solid: `solids` is a list of
 * {faces: [[x,y,z], ...][], color?: [r,g,b]} (colours 0..255, for a vertex-coloured material).
 */
function facesMesh(solids){
  const positions=[],normals=[],colors=[],indices=[];
  for(const {faces,color} of solids){
    const all=faces.flat(),c=[0,1,2].map(i=>all.reduce((s,p)=>s+p[i],0)/all.length);
    for(let pts of faces){
      const [a,b,q]=pts,u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[q[0]-a[0],q[1]-a[1],q[2]-a[2]];
      let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const mid=[0,1,2].map(i=>pts.reduce((s,p)=>s+p[i],0)/pts.length);
      if(n[0]*(mid[0]-c[0])+n[1]*(mid[1]-c[1])+n[2]*(mid[2]-c[2])<0){pts=[...pts].reverse();n=n.map(x=>-x);}
      const len=Math.hypot(...n)||1,base=positions.length/3;
      for(const p of pts){positions.push(...p);normals.push(n[0]/len,n[1]/len,n[2]/len);if(color)colors.push(...color,255);}
      for(let i=1;i<pts.length-1;i++)indices.push(base,base+i,base+i+1);
    }
  }
  const g=new pc.Geometry();g.positions=positions;g.normals=normals;g.indices=indices;
  if(colors.length)g.colors=colors;
  return pc.Mesh.fromGeometry(pc.AppBase.getApplication().graphicsDevice,g);
}
const cuboid=([x0,y0,z0],[x1,y1,z1])=>[
  [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],[[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],
  [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],
  [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],[[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]]];
function meshEntity(parent,name,mesh,material,shadows=false){
  const e=new pc.Entity(name);parent.addChild(e);
  e.addComponent('render',{castShadows:shadows,receiveShadows:true});
  e.render.meshInstances=[new pc.MeshInstance(mesh,material)];
  return e;
}
const RGB=hex=>{const c=new pc.Color().fromString(hex);return [c.r,c.g,c.b].map(v=>Math.round(v*255));};

/** One escalator's moving steps, in its own frame (x up the flight, y up, z across): a step more
 *  than the flight, so shifting the lot by up to a step never leaves a gap. */
function stepsMesh(f){
  const sw=1.0,dark=RGB('#50565d'),edge=RGB('#e2bf45'),solids=[];
  for(let i=-1;i<f.steps;i++){
    const x=i*f.tread,y=i*f.rise;
    solids.push({faces:cuboid([x,y-f.rise,-sw/2],[x+f.tread,y,sw/2]),color:dark});
    solids.push({faces:cuboid([x,y,-sw/2+.02],[x+.05,y+.006,sw/2-.02]),color:edge});
    for(const side of [-1,1])solids.push({faces:cuboid([x+.05,y,side>0?sw/2-.05:-sw/2],[x+f.tread,y+.006,side>0?sw/2:-sw/2+.05]),color:edge});
  }
  return facesMesh(solids);
}

// ---------------------------------------------------------------------------------------------
// Inside: the four floors, drawn round the room's own shell, counters and assistants.

/**
 * Called by town.buildRooms for the room with `levels`: draws the floors, escalators, lift and shop
 * fronts into it, leaves its solid parts in `room.solids` for registerRooms to mark (the meshes carry
 * the names), and returns the part that moves them and offers the lift: {update, targets}.
 */
export function mallFloors(town,room){
  const m=town.m,{box}=m,data=room.data,[w,d]=data.size,{parts}=mallLayout(data);
  room.solids=parts;
  const style=floors.styles[floors.rooms.mall],floorMats=new Map();
  const floorMat=(pw,pd,x0,z1)=>{
    const key=pw+'x'+pd;
    if(!floorMats.has(key))floorMats.set(key,style?floorMaterial(town.app,style,pw,pd,x0+w/2,d/2-z1):m.material(data.floor));
    return floorMats.get(key);
  };
  const upstairs=new pc.Entity('mall-floors');room.root.addChild(upstairs);
  const fl=new pc.Entity('floor');fl.lookName='floor';upstairs.addChild(fl);
  const ce=new pc.Entity('ceiling');ce.lookName='ceiling';upstairs.addChild(ce);
  for(const p of parts.filter(p=>p.kind==='slab')){
    box(fl,[p.x,p.y1-.01,p.z],[p.hw*2,.02,p.hd*2],data.floor).render.meshInstances[0].material=floorMat(p.hw*2,p.hd*2,p.x-p.hw,p.z+p.hd);
    box(ce,[p.x,(p.y0+p.y1-.02)/2,p.z],[p.hw*2,p.y1-p.y0-.02,p.hd*2],CEILING);
  }
  room.prepare=()=>{if(!room.parts)room.parts=[fitOut(town,room)];};
}
const CEILING='#f4f2ed';

/** The rest of the mall, on first entry and at the detail then in force; the moving parts and the
 *  lift in `room.parts` ({update, targets}) and `room.lift`. */
function fitOut(town,room){
  const m=town.m,{box,cylinder}=m,lod=detail(),high=lod==='high',low=lod==='low';
  const data=room.data,ox=room.offsetX,[w,d]=data.size,levels=data.levels,{parts,flights}=mallLayout(data);
  const [vx0,vz0,vx1,vz1]=mall.void,{slab,roof,front,lift:l}=mall,sign=signMaker(m);
  const root=new pc.Entity('mall-inside');room.root.addChild(root);
  const group=(name,look,parent=root)=>{const g=new pc.Entity(name);if(look)g.lookName=look;parent.addChild(g);return g;};
  const paint=(e,material)=>{e.render.meshInstances[0].material=material;return e;};
  const glass=seeThrough('#d7e7ee',.22),steel='#c4c9cd',metal='#2d333a',ceilingHex=CEILING,stone='#dcd6cb',fascia='#cdbfa2';
  const see=(e)=>{paint(e,glass).render.castShadows=false;return e;};
  const lampLight=m.glow('#fff4dc');
  const ceilingOf=i=>i<levels.length-1?levels[i+1]-slab:roof;

  // The roof over the galleries (the floors below it are drawn at startup, by mallFloors).
  const ce=group('mall-roof','ceiling');
  for(const [x0,z0,x1,z1] of floorPlan(w,d,mall))box(ce,[(x0+x1)/2,roof+.2,(z0+z1)/2],[x1-x0,.4,z1-z0],ceilingHex);
  // Along the edges of the atrium, a band over each slab's edge, and the floor's number on it.
  const fa=group('mall-fascia','ceiling');
  const band=(x,z,sx,sz,y)=>box(fa,[x,y-.3125,z],[sx,.615,sz],fascia);
  for(const [i,y] of levels.entries()){
    if(!i)continue;
    band(vx1-.03,(vz0+vz1)/2,.06,vz1-vz0,y);band(vx0+.03,(vz0+vz1)/2,.06,vz1-vz0,y);
    band(0,vz1-.03,vx1-vx0,.06,y);
    for(const [x0,x1] of spans(vx0,vx1,[[l.x-l.hw,l.x+l.hw]]))band((x0+x1)/2,vz0+.03,x1-x0,.06,y);
    sign(fa,mall.signs.floors[i],[0,y-.31,vz1-.105],1.5,.46,'#2d333a','#f3dfb0',180);
    sign(fa,mall.signs.floors[i],[(vx0+l.x-l.hw)/2,y-.31,vz0+.105],1.5,.46,'#2d333a','#f3dfb0');
  }
  // Glass balustrades on a steel shoe, a handrail along the top.
  const rails=group('mall-railings','railing');
  for(const p of parts.filter(p=>p.kind==='balustrade')){
    const alongX=p.hw>p.hd,len=2*(alongX?p.hw:p.hd),size=(t,h,extra=0)=>alongX?[len+extra,h,t]:[t,h,len+extra];
    see(box(rails,[p.x,p.y0+.56,p.z],size(.03,1.04),'#d7e7ee'));
    box(rails,[p.x,p.y0+1.11,p.z],size(.07,.06,.08),steel);
    box(rails,[p.x,p.y0+.03,p.z],size(.08,.06,.04),steel);
    if(high)for(let a=-len/2+.75;a<len/2-.4;a+=1.5)box(rails,alongX?[p.x+a,p.y0+.56,p.z]:[p.x,p.y0+.56,p.z+a],[.05,1.08,.05],steel);
  }
  // Cores, piers, the wall between two shops, and the display glass at each end of a shop front.
  const walls=group('mall-walls','wall');
  for(const p of parts.filter(p=>p.kind==='core'))box(walls,[p.x,(roof+.42)/2,p.z],[p.hw*2,roof+.42,p.hd*2],data.wall);   // just above the roof: the room's corner pillars end at its top
  for(const p of parts.filter(p=>p.kind==='wall'))box(walls,[p.x,(p.y0+p.y1)/2,p.z],[p.hw*2,p.y1-p.y0,p.hd*2],data.wall);
  const piers=group('mall-piers','pillar');
  for(const p of parts.filter(p=>p.kind==='pier'))cylinder(piers,[p.x,(roof+.2)/2,p.z],[.6,roof+.2,.6],stone);   // into the roof, past the bands' tops
  const fronts=group('mall-shopfronts','window'),bands=group('mall-shop-bands','shop'),tints=group('mall-shop-walls','wall');
  for(const p of parts.filter(p=>p.kind==='glass')){
    const h=p.y1-p.y0-1.1;
    see(box(fronts,[p.x,p.y0+h/2+.01,p.z],[.03,h-.02,p.hd*2],'#d7e7ee'));   // its edges inside the frame, not flush with it
    for(const y of [p.y0+.05,p.y0+h])box(fronts,[p.x,y,p.z],[.07,.1,p.hd*2+.04],metal);
  }
  // Each shop: a band over its front in its colour with its name, and its colour on the wall inside.
  for(const u of mall.units){
    const y=levels[u.level],top=ceilingOf(u.level),s=u.side,[z0,z1]=u.z,zc=(z0+z1)/2,len=z1-z0;
    box(bands,[s*(front+.15),top-.55,zc],[.3,1.1,len-.04],u.tint);
    sign(bands,u.sign,[s*(front-.05),top-.55,zc],Math.min(u.sign.length*.75+1,len-2),.8,u.tint,'#fbf6ea',s>0?-90:90);
    const pale=new pc.Color().lerp(new pc.Color().fromString(u.tint),new pc.Color(1,1,1),.6).toString();
    box(tints,[s*(w/2-.03),y+2.55,zc],[.04,3.9,len-.8],pale);
  }
  // 1F: the way out, a star in the floor under the atrium, and the hardware store's door.
  const exit=group('mall-exit','door');
  for(const side of [-1,1]){
    see(box(exit,[side*.42,1.555,d/2-.02],[.78,3.09,.03],'#d7e7ee'));
    box(exit,[side*.86,1.6,d/2-.05],[.08,3.2,.06],metal);
    for(let x=side*1.35;Math.abs(x)<5;x+=side*1.25)box(exit,[x,2.76,d/2-.05],[.06,5.48,.06],metal);
    box(exit,[side*3.05,2.755,d/2-.025],[4.1,5.45,.03],'#d3e2ea');
  }
  box(exit,[0,3.25,d/2-.05],[1.8,.1,.07],metal);
  sign(exit,mall.signs.exit,[0,3.75,d/2-.12],1.1,.42,'#2e6b4f','#f4f1e6',180);
  // Upstairs the front is glass too: bright panes between mullions, over the avenue.
  const glazed=group('mall-front-windows','window');
  for(const y of levels.slice(1)){
    box(glazed,[0,y+2.85,d/2-.025],[21,4.1,.03],'#d3e2ea');
    for(let x=-10.5;x<=10.51;x+=1.5)box(glazed,[x,y+2.85,d/2-.05],[.06,4.16,.06],metal);
    box(glazed,[0,y+.78,d/2-.05],[21.06,.06,.06],metal);
  }
  const star=group('mall-star','floor');
  cylinder(star,[0,.0035,6],[5,.005,5],'#b8955a');                 // .001 to .006
  cylinder(star,[0,.007,6],[4.7,.006,4.7],'#39414a');                // .004 to .010
  for(const a of [0,45,90,135])box(star,[0,.011,6],[a%90?3.2:4.3,.008,.32],'#dcb86a',[0,a,0]);   // .007 to .015
  sign(root,'五金 · 家居 · 灯具',[-w/2+.1,2.95,0],3.6,.62,'#23493e','#f1e6c8',90);
  // 服务台, hung over the information desk.
  const desk=data.fittings.find(f=>f.kind==='reception');
  if(desk){
    const hanger=group('mall-hanger','sign'),top=ceilingOf(0),across=(desk.rot??0)%180!==0;
    sign(root,mall.signs.info,[desk.x,3.3,desk.z],1.6,.46,'#2d333a','#f4f1e6',desk.rot??0);
    for(const d of [-.6,.6])box(hanger,[desk.x+(across?0:d),(3.53+top)/2,desk.z+(across?d:0)],[.03,top-3.53,.03],metal);
  }
  // The toilets, on the same core on every floor.
  const loo=mall.decor.toilets;
  for(const [i,y] of levels.entries()){
    const door=group('mall-toilet-'+i,'door');
    box(door,[loo.x-.03,y+1.105,loo.z],[.05,2.19,1.1],'#7f8b93');
    for(const dz of [-.6,.6])box(door,[loo.x-.04,y+1.15,loo.z+dz],[.06,2.3,.08],metal);
    sign(root,mall.signs.toilets,[loo.x-.1,y+2.6,loo.z],1.2,.36,'#2d333a','#f4f1e6',-90);
  }
  // Floor directories, on stands by the lift and in the entrance hall: one board for them all.
  const board=directoryMaterial();
  for(const [x,z,rot,level] of mall.decor.directories){
    const stand=group('mall-directory','sign');stand.setLocalPosition(x,levels[level],z);stand.setLocalEulerAngles(0,rot,0);
    box(stand,[0,1.2,0],[1.1,2.4,.3],metal);
    const face=paint(box(stand,[0,1.35,.16],[.98,1.9,.02],'#1f252c'),board);face.signText=mall.signs.directory;face.render.castShadows=false;
  }
  // Screens on the back wall of every floor, one picture flowing across them all.
  const media=screen(canvasTexture(starfield(512,128,11),true),.9);
  media.emissiveMapTiling=media.diffuseMapTiling=new pc.Vec2(2,1);media.update();
  const [mx0,mx1]=mall.decor.screens;
  for(const [i,y] of levels.entries()){
    const h=Math.min(3.6,ceilingOf(i)-y-1.6);
    const e=paint(box(root,[(mx0+mx1)/2,y+(ceilingOf(i)-y)/2,-d/2+.05],[mx1-mx0,h,.06],'#111111'),media);
    e.lookName='screen';e.render.castShadows=false;
  }
  // Lights in the ceilings: of the shops and the galleries, and under the roof.
  const lamps=group('mall-lamps','ceilinglamp'),every=high?3:low?7.5:4.5;
  const clear=(x,z)=>!(x>vx0-.5&&x<vx1+.5&&z>vz0-.5&&z<vz1+.5)&&!mall.cores.some(([a,b,c,e])=>x>a-.5&&x<c+.5&&z>b-.5&&z<e+.5);
  for(const [i] of levels.entries()){
    const y=ceilingOf(i)-.012;
    for(let x=-w/2+2.5;x<w/2-2;x+=every)for(let z=-d/2+2.5;z<d/2-2;z+=every)
      if(clear(x,z))paint(box(lamps,[x,y,z],[.5,.02,1.6],'#fff4dc'),lampLight).render.castShadows=false;
  }
  // A glass lantern over the atrium, on steel beams.
  const sky=group('mall-skylight','roof'),lh=1.5,lt=roof+.4+lh;
  see(box(sky,[0,lt,0],[vx1-vx0,.04,vz1-vz0],'#d7e7ee'));
  for(const [x,z,sx,sz] of [[0,vz0,vx1-vx0,.04],[0,vz1,vx1-vx0,.04],[vx0,0,.04,vz1-vz0],[vx1,0,.04,vz1-vz0]])
    see(box(sky,[x,roof+.4+lh/2,z],[sx,lh,sz],'#d7e7ee'));
  for(let z=vz0;z<=vz1+1e-6;z+=(vz1-vz0)/(low?4:8))box(sky,[0,lt-.14,z],[vx1-vx0+.2,.22,.14],metal);
  for(const x of [vx0,0,vx1])box(sky,[x,lt-.15,0],[.14,.22,vz1-vz0+.24],metal);
  for(const x of [vx0,vx1])for(const z of [vz0,vz1])box(sky,[x,roof+.4+lh/2+.01,z],[.16,lh+.1,.16],metal);

  // The escalators: truss, side panels, glass and handrails, and the moving steps.
  const ribbonMaterial=new pc.StandardMaterial();
  Object.assign(ribbonMaterial,{diffuseVertexColor:true,vertexColorGamma:true,useMetalness:true,metalness:.35,gloss:.45});ribbonMaterial.update();
  const ribbon=stepsMesh(flights[0]),ribbons=[],signed=new Set();
  for(const f of flights){
    const fe=group('escalator-'+f.id,'escalator');
    fe.setLocalPosition(f.x0,f.y0,f.z);fe.setLocalEulerAngles(0,f.rises>0?0:180,0);
    const run=f.steps*f.tread,lift=f.y1-f.y0,slope=Math.hypot(run,lift),angle=Math.atan2(lift,run)*180/Math.PI;
    const th=Math.atan2(lift,run),nx=Math.sin(th),ny=-Math.cos(th);
    // A piece running along the slope, `off` below the edges of the steps (above them if negative).
    const sloped=(u0,u1,off,thick,width,z,color)=>{
      const u=(u0+u1)/2,c=off+thick/2;
      return box(fe,[u*run+nx*c,u*lift+ny*c,z],[(u1-u0)*slope,thick,width],color,[0,0,angle]);
    };
    if(f.level)sloped(-.02,1.02,.42,.7,1.2,0,'#e6e8ea');
    else meshEntity(fe,'escalator-base',facesMesh([{faces:[
      [[.9,0,-.65],[run,0,-.65],[run,0,.65],[.9,0,.65]],[[run,0,-.65],[run,lift-.45,-.65],[run,lift-.45,.65],[run,0,.65]],
      [[.9,0,-.65],[run,lift-.45,-.65],[run,lift-.45,.65],[.9,0,.65]],[[.9,0,-.65],[run,0,-.65],[run,lift-.45,-.65]],
      [[.9,0,.65],[run,0,.65],[run,lift-.45,.65]]]}]),m.material('#dfe2e4'),true);
    for(const side of [-1,1]){
      sloped(0,1,-.36,.92,.04,side*.54,steel);   // down past the steps' undersides
      see(sloped(-.02,1.02,-1.02,.72,.025,side*.62,'#d7e7ee'));
      sloped(-.04,1.04,-1.11,.08,.1,side*.62,'#1d2125');
      for(const [x,y] of [[-.45,0],[run+.45,lift]]){
        box(fe,[x,y+1.04,side*.62],[.9,.08,.1],'#1d2125');
        box(fe,[x+(x<0?-.42:.42),y+.52,side*.62],[.08,1.04,.07],steel);
      }
    }
    for(const [x,y] of [[-.45,0],[run+.45,lift]])box(fe,[x,y+.012,0],[.9,.02,1.1],'#b3b8bc');
    const steps=new pc.Entity('escalator-steps');steps.noBatch=true;fe.addChild(steps);
    steps.addComponent('render',{castShadows:false,receiveShadows:true});
    steps.render.meshInstances=[new pc.MeshInstance(ribbon,ribbonMaterial)];
    ribbons.push(steps);
    // 自动扶梯 over the foot of each pair of flights.
    const pair=f.level+':'+f.x0;
    if(!signed.has(pair)){
      signed.add(pair);
      const mates=flights.filter(g=>g.level===f.level&&g.x0===f.x0),z=mates.reduce((s,g)=>s+g.z,0)/mates.length;
      const x=f.x0-f.rises*1.5,y=f.y0+3.3,top=ceilingOf(f.level);
      sign(root,mall.signs.escalator,[x,y,z],1.9,.46,'#2d333a','#f4f1e6',f.rises>0?-90:90);
      const hanger=group('mall-hanger','sign');
      for(const dz of [-.8,.8])box(hanger,[x,(y+.23+top)/2,z+dz],[.03,top-y-.23,.03],metal);
    }
  }

  // The lift: a glass shaft through every floor, landing doors that slide, and the car.
  const lg=group('mall-lift','lift'),[sx0,sx1,sz0,sz1]=[l.x-l.hw,l.x+l.hw,l.z-l.hd,l.z+l.hd],top=shaftTop(levels);
  for(const [x,z,sx,sz] of [[sx1-.04,l.z,.03,l.hd*2-.28],[sx0+.04,l.z,.03,l.hd*2-.28],[l.x,sz1-.04,l.hw*2-.28,.03]])see(box(lg,[x,top/2,z],[sx,top,sz],'#d7e7ee'));
  for(const [x,z] of [[sx0+.06,sz0+.06],[sx1-.06,sz0+.06],[sx0+.06,sz1-.06],[sx1-.06,sz1-.06]])box(lg,[x,top/2,z],[.12,top,.12],steel);
  box(lg,[l.x,top+.15,l.z],[l.hw*2+.1,.3,l.hd*2+.1],steel);
  const doors=[];
  for(const [i,y] of levels.entries()){
    for(const side of [-1,1]){
      see(box(lg,[l.x+side*(l.hw+.62)/2,y+1.25,sz0+.04],[l.hw-.62-.28,2.5,.03],'#d7e7ee'));   // between the jamb and the corner post
      box(lg,[l.x+side*.7,y+1.25,sz0+.02],[.08,2.5,.1],steel);
    }
    const next=i<levels.length-1?levels[i+1]:top;
    box(lg,[l.x,y+2.55,sz0+.02],[l.hw*2,.14,.1],steel);
    see(box(lg,[l.x,(y+2.62+next)/2,sz0+.04],[l.hw*2-.28,next-y-2.62,.03],'#d7e7ee'));
    box(lg,[l.x,y+.012,sz0-.27],[1.5,.024,.46],'#8d949a');   // stops short of the door frame
    sign(root,mall.signs.lift,[l.x,y+2.85,sz0-.08],.9,.36,'#2d333a','#f4f1e6',180);
    sign(root,mall.signs.floors[i],[l.x-1.05,y+1.55,sz0-.06],.5,.3,'#2d333a','#f3dfb0',180);
    const leaves=[-1,1].map(side=>{
      const leaf=new pc.Entity('lift-door');leaf.noBatch=true;lg.addChild(leaf);
      leaf.setLocalPosition(l.x+side*.3,y,sz0-.03);
      see(box(leaf,[0,1.24,0],[.6,2.46,.03],'#d7e7ee'));
      box(leaf,[-side*.29,1.24,-.02],[.03,2.5,.05],steel);
      return {leaf,side,base:l.x+side*.3};
    });
    doors.push({y,leaves,open:0});
  }
  const car=new pc.Entity('lift-car');car.noBatch=true;room.root.addChild(car);car.setLocalPosition(l.x,levels[0],l.z);
  box(car,[0,-.045,0],[l.hw*2-.2,.12,l.hd*2-.2],'#6f777e');
  box(car,[0,2.62,0],[l.hw*2-.2,.12,l.hd*2-.2],steel);
  paint(box(car,[0,2.55,0],[1.2,.02,1.2],'#fff4dc'),lampLight);
  for(const [x,z,sx,sz] of [[l.hw-.14,0,.03,l.hd*2-.3],[-(l.hw-.14),0,.03,l.hd*2-.3],[0,l.hd-.14,l.hw*2-.3,.03]])see(box(car,[x,1.3,z],[sx,2.5,sz],'#d7e7ee'));
  box(car,[0,.95,l.hd-.2],[l.hw*2-.4,.05,.05],steel);

  // Real lights: one over each floor on high, fewer lower down the settings.
  for(const [i] of levels.entries()){
    if(low||i===levels.length-1||(!high&&i%2))continue;   // the room's own lamp lights the top floor
    const light=new pc.Entity('mall-light-'+i);
    light.addComponent('light',{type:'omni',color:new pc.Color(1,.95,.86),intensity:.55,range:24,castShadows:false});
    light.setLocalPosition(0,ceilingOf(i)-.8,0);root.addChild(light);
  }

  // Daylight comes in through the glass roof, with the town's sun and its shadows: no courtyard sun too.
  if(room.sun)room.sun.enabled=false;
  town.registerLooks('mall',root);
  town.batchStatics('mall-scenery',room.root);

  // --- the moving parts ------------------------------------------------------------------------
  const player=town.player.entity,floorOf=y=>levels.reduce((at,ly,i)=>y>ly-.5?i:at,0);
  const lift={
    car,y:levels[0],from:0,to:0,stage:null,wait:0,floorOf,
    get riding(){return !!this.stage;},
    /** Into the car on this floor, doors shut, up or down to floor `to`, doors open, and out. */
    ride(to){
      const from=floorOf(town.playerY);
      if(this.stage||to===from||levels[to]===undefined)return false;
      this.from=from;this.to=to;this.y=levels[from];this.stage='close';this.wait=.7;
      car.setLocalPosition(l.x,this.y,l.z);
      town.warp(ox+l.x,l.z,180,this.y);   // facing out over the atrium
      return true;
    },
    step(dt){
      const at=this.stage?null:floorOf(this.y+.01);
      for(const [i,door] of doors.entries()){
        const want=(this.stage==='open'&&i===this.to)||(at===i)?1:0;
        if(door.open===want)continue;
        door.open=want>door.open?Math.min(want,door.open+dt*2):Math.max(want,door.open-dt*2);
        for(const {leaf,side,base} of door.leaves)leaf.setLocalPosition(base+side*.62*door.open,door.y,sz0-.03);
      }
      if(!this.stage)return;
      if(this.stage==='move'){
        const target=levels[this.to],dy=target-this.y;
        this.y+=Math.sign(dy)*Math.min(Math.abs(dy),l.speed*dt);car.setLocalPosition(l.x,this.y,l.z);
        if(Math.abs(target-this.y)<1e-6){this.stage='open';this.wait=.9;}
      } else if((this.wait-=dt)<=0){
        if(this.stage==='close')this.stage='move';
        else{this.stage=null;town.warp(ox+l.x,sz0-.95,0,levels[this.to]);return;}
      }
      // Riding: wherever you stand in the car, you are at its floor.
      const p=player.getPosition();
      player.setPosition(p.x,this.y,p.z);town.playerY=this.y;town.velocityY=0;town.grounded=true;
    },
  };
  room.lift=lift;
  const media0=new Float32Array([2,0,0]),media1=new Float32Array([0,1,0]);
  let clock=0,flow=0;
  return {
    update(dt,paused){
      clock=(clock+dt)%3600;
      for(const [i,f] of flights.entries()){
        f.phase=((clock*f.speed/f.tread*f.moves)%1+1)%1;
        ribbons[i].setLocalPosition(f.phase*f.tread,f.phase*f.rise,0);
      }
      lift.step(dt);
      if(detail()!=='low'){   // what runs every frame follows the setting at once
        flow=(flow+dt*.012)%1;media0[2]=flow;
        for(const name of ['texture_emissiveMapTransform','texture_diffuseMapTransform']){media.setParameter(name+'0',media0);media.setParameter(name+'1',media1);}
      }
      if(paused||lift.riding||town.velocityY>.5)return;
      // On an escalator: carried along, and up or down with the step under your feet.
      const p=player.getPosition(),on=ride(flights,p.x-ox,p.z,town.playerY,dt,(x,feet)=>town.canMove(ox+x,p.z,feet));
      if(on){player.setPosition(ox+on.x,on.y,p.z);town.playerY=on.y;town.velocityY=0;town.grounded=true;}
    },
    targets(){
      if(lift.riding)return [];
      return levels.map(y=>({id:'mall:lift',x:ox+l.x,z:sz0-.9,y,radius:2.3,label:mall.signs.lift,wide:true}));
    },
  };
}

/** The floor directory: 楼层导览 over the four floors and what is on each. */
function directoryMaterial(){
  const c=document.createElement('canvas');c.width=512;c.height=1000;
  const g=c.getContext('2d');
  const draw=()=>{
    g.fillStyle='#1f252c';g.fillRect(0,0,512,1000);
    g.fillStyle='#b8955a';g.fillRect(0,0,512,150);
    g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='#fdf8ec';g.font='bold 76px "Microsoft YaHei","PingFang SC",sans-serif';g.fillText(zh(mall.signs.directory),256,78);
    mall.directory.forEach(([floor,shops],i)=>{
      const y=190+i*200;
      g.fillStyle='#2e363f';g.fillRect(24,y,464,176);
      g.fillStyle='#f3cf73';g.font='bold 60px "Microsoft YaHei","PingFang SC",sans-serif';g.fillText(zh(floor),256,y+50);
      g.fillStyle='#e8ecef';g.font='34px "Microsoft YaHei","PingFang SC",sans-serif';
      const parts=shops.split(' · '),rows=[parts.slice(0,2).join(' · '),parts.slice(2).join(' · ')].filter(Boolean);
      rows.forEach((row,k)=>g.fillText(zh(row),256,y+112+k*44));
    });
  };
  draw();
  const map=canvasTexture(c);scripted(()=>{draw();map.upload();});   // 繁體字, live
  return screen(map,.45);
}
/** Characters one above the other, gold on dark: a sign hung down a pier. Its texture, redrawn live for 繁體字. */
function stacked(text){
  const chars=[...text],c=document.createElement('canvas');c.width=256;c.height=256*chars.length;
  const g=c.getContext('2d');
  const draw=()=>{
    g.shadowBlur=0;g.fillStyle='#1a1d24';g.fillRect(0,0,c.width,c.height);
    g.strokeStyle='#f3cf73';g.lineWidth=8;g.strokeRect(14,14,c.width-28,c.height-28);
    g.fillStyle='#f3cf73';g.font='bold 180px "Microsoft YaHei","PingFang SC",sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.shadowColor='#f3cf73';g.shadowBlur=18;
    [...zh(text)].slice(0,chars.length).forEach((ch,i)=>g.fillText(ch,128,128+i*256+6));
  };
  draw();
  const map=canvasTexture(c);scripted(()=>{draw();map.upload();});
  return map;
}
/** A strip of night sky with a slow aurora through it, repeating across. */
function starfield(w,h,seed){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');let s=seed;
  const rnd=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
  const across=w>=h,bg=across?g.createLinearGradient(0,0,w,0):g.createLinearGradient(0,0,0,h);
  for(const [at,col] of [[0,'#0c1233'],[.33,'#2a1450'],[.66,'#0b2b48'],[1,'#0c1233']])bg.addColorStop(at,col);
  g.fillStyle=bg;g.fillRect(0,0,w,h);
  const L=across?w:h,S=across?h:w;
  for(const [col,amp,off,wide] of [['rgba(80,230,255,.55)',.22,.35,.18],['rgba(255,110,220,.45)',.18,.6,.14],['rgba(255,214,110,.4)',.12,.8,.1]]){
    g.fillStyle=col;
    for(let a=0;a<L;a+=2){const b=S*(off+amp*Math.sin(a/L*Math.PI*4+off*9));if(across)g.fillRect(a,b-S*wide/2,2,S*wide);else g.fillRect(b-S*wide/2,a,S*wide,2);}
  }
  for(let i=0;i<w*h/180;i++){const x=rnd()*w,y=rnd()*h,r=rnd()<.1?2.2:1.1;g.fillStyle=rnd()<.2?'#ffe7a8':'#ffffff';g.fillRect(x,y,r,r);}
  return c;
}

// ---------------------------------------------------------------------------------------------
// Outside: the building on the avenue.

function buildFront(town,root){
  const m=town.m,{box,cylinder}=m,lod=detail(),high=lod==='high',low=lod==='low';
  // Drawn in its own frame with its front on +x (x runs front to back, z along the front), stood
  // where city.json's entry for it stands and turned the way that faces. Its body is at least as
  // tall as the four floors inside it.
  const T=CITY.towers.find(t=>t.drawnBy==='mall'),{height:H,glass:span}=mall.exterior,top=Math.max(mall.roof,rooms.mall.height),sign=signMaker(m);
  const x1=T.d/2,x0=-x1,z1=T.w/2,z0=-z1,yaw=(T.rot??0)-90;
  const g=new pc.Entity('mall-building');g.lookName='tower';g.setLocalPosition(T.x,0,T.z);g.setLocalEulerAngles(0,yaw,0);root.addChild(g);
  const paint=(e,material)=>{e.render.meshInstances[0].material=material;return e;};
  const lamp=(hex,glowHex=hex,peak=1)=>{
    const mt=new pc.StandardMaterial();mt.diffuse=new pc.Color().fromString(hex);mt.emissive=new pc.Color().fromString(glowHex);
    mt.emissiveIntensity=0;mt.useMetalness=true;mt.metalness=0;mt.gloss=.4;mt.update();town.daylight.addLamp(mt,peak);return mt;
  };
  const clad='#e8e3d9',frame='#343b45',glass=seeThrough('#bcd6e2',.3),bodyFront=x1-.7,[ga,gb]=[-span/2,span/2];
  const turned=Math.abs(Math.round(Math.sin(yaw*Math.PI/180)))===1,deep=(x1-x0)/2+.05,wide=(z1-z0)/2+(high?.2:.05);
  town.mark('city',CITY_OFFSET+T.x,T.z,turned?wide:deep,turned?deep:wide,0,H,'tower').group=T.id;   // one building with its wings (city.js)
  // The body, and dark piers either side of a glass front that rises above the roof.
  box(g,[(x0+bodyFront)/2,top/2,(z0+z1)/2],[bodyFront-x0,top,z1-z0],clad);
  for(const [a,b] of [[z0,ga],[gb,z1]])box(g,[(bodyFront+x1-.05)/2,top/2,(a+b)/2],[x1-.05-bodyFront,top,b-a],frame);
  paint(box(g,[bodyFront+.025,H/2,0],[.03,H,gb-ga],'#c9b596'),lamp('#c9b596','#ffd7a0',.8));
  for(const y of [6,12,18,24])box(g,[x1-.4,y-.2,0],[.56,.4,gb-ga-.02],clad);
  const front=paint(box(g,[x1-.05,H/2,0],[.04,H,gb-ga],'#bcd6e2'),glass);front.render.castShadows=false;
  const bays=low?3:6;
  for(let i=0;i<=bays;i++){
    const z=ga+(gb-ga)*i/bays,door=Math.abs(z)<1.3;
    box(g,[x1-.01,door?(H+3.2)/2:H/2,z],[.1,door?H-3.2:H,.08],frame);
  }
  for(const y of [6,12,18,24])box(g,[x1-.01,y,0],[.1,.12,gb-ga],frame);
  box(g,[(bodyFront+x1)/2,H+.08,0],[x1-bodyFront+.1,.16,gb-ga+.2],frame);
  paint(box(g,[x1+.07,H-.25,0],[.06,.12,gb-ga],'#9fb3bf'),lamp('#9fb3bf','#bfe8ff'));
  // The doors, under a curved canopy lit from underneath and round its edge.
  for(const z of [-1.3,1.3])box(g,[x1+.03,1.5,z],[.16,3,.14],frame);
  box(g,[x1+.03,3.1,0],[.16,.2,2.74],frame);
  box(g,[x1+.03,1.45,0],[.08,2.9,.06],frame);
  for(const z of [-.55,.55])box(g,[x1+.1,1.05,z],[.04,.04,.7],'#c4c9cd');
  const entrance=sign(g,mall.signs.entrance,[x1+.16,3.55,0],1.1,.4,'#1f2a33','#f5e7c0',90);
  entrance.render.meshInstances[0].material.emissive.set(.8,.8,.8);entrance.render.meshInstances[0].material.update();
  const arc=[];for(let i=0;i<=16;i++){const a=-Math.PI/2+Math.PI*i/16;arc.push([Math.cos(a),Math.sin(a)]);}
  const disc=(r,y0,y1)=>facesMesh([{faces:[arc.map(([c,s])=>[c*r,y1,s*r]),arc.map(([c,s])=>[c*r,y0,s*r]),
    ...arc.slice(1).map(([c,s],i)=>[[arc[i][0]*r,y0,arc[i][1]*r],[c*r,y0,s*r],[c*r,y1,s*r],[arc[i][0]*r,y1,arc[i][1]*r]]),
    [[0,y0,-r],[0,y1,-r],[0,y1,r],[0,y0,r]]]}]);
  const canopy=new pc.Entity('mall-canopy');canopy.lookName='awning';g.addChild(canopy);canopy.setLocalPosition(x1,0,0);
  meshEntity(canopy,'canopy',disc(4.2,3.9,4.2),m.material('#f1efea'),true);
  meshEntity(canopy,'canopy-lights',disc(3.9,3.86,3.9),lamp('#e9e1d2','#ffe2b0'));
  const ring=new pc.Entity('canopy-edge');canopy.addChild(ring);ring.setLocalPosition(0,4.05,0);ring.setLocalEulerAngles(0,90,0);
  ring.addComponent('render',{castShadows:false});
  ring.render.meshInstances=[new pc.MeshInstance(pc.Mesh.fromGeometry(town.app.graphicsDevice,
    new pc.TorusGeometry({tubeRadius:.09,ringRadius:4.2,sectorAngle:180,segments:24,sides:6})),lamp('#8fb4c4','#9fe3ff'))];
  if(!low)for(const z of [-2.6,2.6]){
    const [ax,ay,bx,by]=[0,8,3.4,4.25],len=Math.hypot(bx-ax,by-ay);
    cylinder(canopy,[(ax+bx)/2,(ay+by)/2,z],[.05,len,.05],'#c4c9cd',[0,0,Math.atan2(bx-ax,ay-by)*180/Math.PI]);
  }
  // A tall LED screen on the north pier and a light running up the south one.
  const show=screen(canvasTexture(starfield(128,512,5),true),.3);
  show.emissiveMapTiling=show.diffuseMapTiling=new pc.Vec2(1,1.5);show.update();
  const tall=paint(box(g,[x1+.01,13.8,(z0+ga)/2],[.06,16.4,ga-z0-.8],'#111111'),show);tall.lookName='screen';tall.render.castShadows=false;
  const strip=lamp('#3a4350','#ffffff');
  for(const z of [gb+.12,z1-.12])paint(box(g,[x1+.01,12.2,z],[.06,21,.14],'#3a4350'),strip).render.castShadows=false;
  // The name, in lit characters across the top of the glass.
  const name=sign(g,mall.signs.name,[x1+.1,21.4,0],5.9,1.5,'#1a1d24','#f3cf73',90);
  const lit=name.render.meshInstances[0].material;lit.emissive.set(1,1,1);
  name.lookReach=120;
  // The name again, down the south pier, and the store's star on top of the glass.
  const upright=screen(stacked(mall.signs.name),.15);
  const down=paint(box(g,[x1+.06,11.6,(gb+z1)/2],[1.7,7.2,.08],'#1a1d24',[0,90,0]),upright);
  down.signText=mall.signs.name;down.lookReach=120;down.render.castShadows=false;
  const emblem=new pc.Entity('mall-star');emblem.lookName='sign';g.addChild(emblem);emblem.setLocalPosition(x1-.35,H+3.4,0);
  box(g,[x1-.35,H+.5,0],[.16,1,.16],frame);
  const star=[];
  for(let i=0;i<5;i++){
    const at=(a,r)=>[0,Math.cos(a)*r,Math.sin(a)*r],a=i*Math.PI*2/5,k=[at(0,0),at(a-Math.PI/5,1.05),at(a,2.6),at(a+Math.PI/5,1.05)];
    star.push({faces:[k.map(([,y,z])=>[-.15,y,z]),k.map(([,y,z])=>[.15,y,z]),...k.map((q,j)=>{const n=k[(j+1)%4];return [[-.15,q[1],q[2]],[.15,q[1],q[2]],[.15,n[1],n[2]],[-.15,n[1],n[2]]];})]});
  }
  meshEntity(emblem,'star',facesMesh(star),lamp('#cdb27a','#ffd46a',1.2),true);
  const halo=new pc.Entity('star-halo');emblem.addChild(halo);halo.setLocalEulerAngles(0,0,90);halo.addComponent('render',{castShadows:false});
  halo.render.meshInstances=[new pc.MeshInstance(pc.Mesh.fromGeometry(town.app.graphicsDevice,
    new pc.TorusGeometry({tubeRadius:.07,ringRadius:3.1,segments:40,sides:6})),lamp('#9fb3bf','#bfe8ff',.9))];
  // Round the sides: fins, a lit line under the roof's edge, and a glowing lantern on top.
  const outline=lamp('#d9d2c4','#ffe9c4',.7);
  for(const [x,z,sx,sz] of [[(x0+bodyFront)/2,z0-.03,bodyFront-x0,.06],[(x0+bodyFront)/2,z1+.03,bodyFront-x0,.06],[x0-.03,(z0+z1)/2,.06,z1-z0]])
    paint(box(g,[x,top-.35,z],[sx,.14,sz],'#d9d2c4'),outline);
  if(high)for(let x=x0+1;x<bodyFront-.6;x+=1.6)for(const [z,dz] of [[z0,-1],[z1,1]])box(g,[x,(top-.6)/2,z+dz*.12],[.14,top-.6,.24],frame);
  paint(box(g,[(x0+bodyFront)/2,top+.7,(z0+z1)/2],[bodyFront-x0-8,1.4,z1-z0-4],'#9fb8c8'),lamp('#9fb8c8','#fff0d0',.8));
  // The screen and the name glow a little by day and brightly after dark; the screen's picture
  // flows and the strip turns through the colours, written straight into their uniforms.
  const flow0=new Float32Array([1,0,0]),flow1=new Float32Array([0,1.5,0]),wash=new Float32Array(3);
  let clock=0,shown=-1;
  return {update(dt){
    const night=town.daylight.state?.lamps??0;
    if(Math.abs(night-shown)>.02){shown=night;show.emissiveIntensity=.3+night*.9;show.update();lit.emissiveIntensity=.15+night*1.4;lit.update();upright.emissiveIntensity=.15+night*1.4;upright.update();}
    if(detail()==='low'||night<.05)return;
    clock=(clock+dt)%3600;
    flow1[2]=-(clock*.02%1)*1.5;
    for(const n of ['texture_emissiveMapTransform','texture_diffuseMapTransform']){show.setParameter(n+'0',flow0);show.setParameter(n+'1',flow1);}
    const h=clock*.05%1*6.283;wash[0]=(.5+.5*Math.sin(h))**2.2;wash[1]=(.5+.5*Math.sin(h+2.1))**2.2;wash[2]=(.5+.5*Math.sin(h+4.2))**2.2;
    strip.setParameter('material_emissive',wash);
  }};
}
