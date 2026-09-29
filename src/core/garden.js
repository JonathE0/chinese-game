// 莲池公园's geometry rules: what counts as water, where the shore is, and the collision marks the
// town registry needs. Pure functions over src/content/garden.json, so the park can be checked
// without a renderer. Marks use world coordinates: {x,z,hw,hd} or {x,z,radius}, y0, y1, name
// (an object key or null), solid, and a group shared by the parts of one structure.

/** How far a park lantern hangs out from its post, on a bracket at the post's top. */
export const LANTERN_ARM=.45;
export const isDisc=shape=>shape.r!==undefined;

/** True when (x,z) lies inside the shape, shrunk by `margin` (a negative margin grows it). */
export function inShape(shape,x,z,margin=0){
  if(isDisc(shape))return Math.hypot(x-shape.x,z-shape.z)<shape.r-margin;
  return x>shape.x0+margin&&x<shape.x1-margin&&z>shape.z0+margin&&z<shape.z1-margin;
}
export const inAny=(shapes,x,z,margin=0)=>shapes.some(s=>inShape(s,x,z,margin));

/** Points every `spacing` metres round the outline of a union of shapes: each shape's edge,
 *  minus the parts that lie inside another shape. `skip(x,z)` drops points (bridge landings). */
export function shoreline(shapes,spacing=1,skip=()=>false){
  const points=[];
  const keep=(x,z,own)=>!shapes.some((s,i)=>i!==own&&inShape(s,x,z,.05))&&!skip(x,z);
  shapes.forEach((s,own)=>{
    if(isDisc(s)){
      const n=Math.max(8,Math.round(2*Math.PI*s.r/spacing));
      for(let i=0;i<n;i++){
        const a=i/n*Math.PI*2,x=s.x+Math.cos(a)*s.r,z=s.z+Math.sin(a)*s.r;
        if(keep(x,z,own))points.push({x,z,angle:a});
      }
      return;
    }
    const edges=[[s.x0,s.z0,s.x1,s.z0],[s.x1,s.z0,s.x1,s.z1],[s.x1,s.z1,s.x0,s.z1],[s.x0,s.z1,s.x0,s.z0]];
    for(const [ax,az,bx,bz] of edges){
      const length=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.round(length/spacing));
      for(let i=0;i<n;i++){
        const t=(i+.5)/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
        if(keep(x,z,own))points.push({x,z,angle:Math.atan2(bz-az,bx-ax)+Math.PI/2});
      }
    }
  });
  return points;
}

const shapeMark=(s,extra)=>isDisc(s)?{x:s.x,z:s.z,radius:s.r,...extra}
  :{x:(s.x0+s.x1)/2,z:(s.z0+s.z1)/2,hw:(s.x1-s.x0)/2,hd:(s.z1-s.z0)/2,...extra};

/** The side rails of a bridge: its x, its z span and the height a rail must reach to stop you
 *  stepping over it from the crest. */
export function bridgeRails(bridge){
  const z0=Math.min(...bridge.steps.map(s=>s[0])),z1=Math.max(...bridge.steps.map(s=>s[1]));
  const crest=Math.max(...bridge.steps.map(s=>s[2]));
  return [-1,1].map(side=>({x:bridge.x+side*(bridge.width/2+.1),z0,z1,crest}));
}

/** Posts round the island's balustrade: two arcs, east and west, leaving a gap where each
 *  bridge lands on the x line. Each arc ends exactly at x = ±gap so the rails meet it. */
export function balustrade(island,spacing=.55){
  const R=island.rail,phi=Math.acos(island.gap/R),points=[];
  for(const [from,to] of [[-phi,phi],[Math.PI-phi,Math.PI+phi]]){
    const n=Math.max(2,Math.ceil((to-from)*R/spacing));
    for(let i=0;i<=n;i++){const a=from+(to-from)*i/n;points.push({x:island.x+Math.cos(a)*R,z:island.z+Math.sin(a)*R,angle:a});}
  }
  return points;
}

/** An invisible fence round the water's edge, taller than a jump, so a run and a hop cannot
 *  land you on the water's surface. It opens only where a bridge crosses the shore; the
 *  bridge's own rails close the gap. */
export function shoreFence(g){
  const water=[...g.pond,...g.stream];
  const underBridge=(x,z)=>g.bridges.some(b=>Math.abs(x-b.x)<b.width/2+.35&&z>b.steps[0][0]-.3&&z<b.steps.at(-1)[1]+.3);
  // A waterside pavilion's platform reaches over the water; its own guard rails close that edge.
  const ws=g.waterside,platform=ws?{x0:ws.x0-.35,x1:ws.x1+.35,z0:ws.z0-.35,z1:ws.z1+.35}:null;
  const skip=(x,z)=>underBridge(x,z)||(!!platform&&inShape(platform,x,z));
  // shoreline() spaces its points along each edge and never lands on a rectangle's corner, which
  // left a gap there wide enough to hop onto the water's edge: every open corner gets a post too.
  const corners=water.filter(s=>!isDisc(s)).flatMap(s=>[[s.x0,s.z0],[s.x1,s.z0],[s.x0,s.z1],[s.x1,s.z1]])
    .filter(([x,z])=>!water.some(o=>inShape(o,x,z,.05))&&!skip(x,z)).map(([x,z])=>({x,z,angle:0}));
  return [...shoreline(water,g.water.fenceSpacing,skip),...corners];
}

/** A bridge's step slabs and its tall invisible side guards, for a bridge that runs along z. */
function bridgeMarks(b,guard,group){
  const marks=b.steps.map(([z0,z1,y1])=>({x:b.x,z:(z0+z1)/2,hw:b.width/2,hd:(z1-z0)/2,y0:0,y1,name:'bridge',group}));
  // The guards are invisible and taller than the rails, so they stay unnamed: a look passes through
  // them to the bridge's own meshes, or to whatever stands behind it.
  for(const r of bridgeRails(b))marks.push({x:r.x,z:(r.z0+r.z1)/2,hw:.08,hd:(r.z1-r.z0)/2,y0:0,y1:r.crest+guard,name:null,group});
  return marks;
}

export function pavilionColumns(p){
  return Array.from({length:8},(_,i)=>{const a=(22.5+45*i)*Math.PI/180;return {x:p.x+Math.sin(a)*p.r,z:p.z+Math.cos(a)*p.r};});
}

/** Every collision and name mark in the park. */
export function gardenMarks(g){
  const marks=[],{top,bottom,level}=g.water;
  for(const s of g.pond)marks.push(shapeMark(s,{y0:bottom,y1:top,name:'pond',group:'pond'}));
  for(const s of g.stream)marks.push(shapeMark(s,{y0:bottom,y1:top,name:'stream',group:'pond'}));
  for(const p of shoreFence(g))marks.push({x:p.x,z:p.z,radius:.3,y0:0,y1:g.water.fence,name:null,group:'pond'});
  const is=g.island;
  marks.push({x:is.x,z:is.z,radius:is.r,y0:bottom,y1:is.top,name:null,group:'pond'});
  for(const p of balustrade(is))marks.push({x:p.x,z:p.z,radius:.3,y0:is.top,y1:is.railTop,name:null,group:'pond'});
  const pv=g.pavilion;
  marks.push({x:pv.x,z:pv.z,radius:pv.floor,y0:is.top-.05,y1:pv.floorTop,name:'pavilion',group:'pond'});
  for(const c of pavilionColumns(pv))marks.push({x:c.x,z:c.z,radius:.18,y0:pv.floorTop,y1:pv.floorTop+pv.height,name:'pavilion',group:'pond'});
  marks.push({x:pv.x,z:pv.z,radius:pv.r+.6,y0:pv.floorTop+pv.height,y1:pv.floorTop+pv.height+1.8,name:'pavilion',solid:false});
  for(const b of g.bridges)marks.push(...bridgeMarks(b,g.guards.bridgeRail,'pond'));
  // 荷风水榭: a platform over the water at floor height, a step up from the bank, corner
  // columns, and guard rails on the three sides over the water (the bank side, +x, is open).
  const ws=g.waterside,guard=ws.floorTop+g.guards.bridgeRail;
  marks.push(shapeMark(ws,{y0:bottom,y1:ws.floorTop,name:'waterside',group:'pond'}));
  marks.push({x:ws.x1+.3,z:(ws.z0+ws.z1)/2,hw:.3,hd:1.2,y0:0,y1:ws.floorTop/2,name:'waterside',group:'pond'});
  for(const c of watersideColumns(ws))marks.push({x:c.x,z:c.z,radius:.13,y0:ws.floorTop,y1:ws.floorTop+ws.height,name:'pillar',group:'pond'});
  for(const z of [ws.z0,ws.z1])marks.push({x:(ws.x0+ws.x1)/2,z,hw:(ws.x1-ws.x0)/2,hd:.08,y0:0,y1:guard,name:'railing',group:'pond'});
  marks.push({x:ws.x0,z:(ws.z0+ws.z1)/2,hw:.08,hd:(ws.z1-ws.z0)/2,y0:0,y1:guard,name:'railing',group:'pond'});
  marks.push(...walkwayMarks(g.walkway,'pond'));
  for(const r of g.waterfall.rocks)marks.push({x:r.x,z:r.z,radius:r.r,y0:0,y1:Math.max(r.h,g.guards.climbable),name:'waterfall',group:'pond'});
  const {house,wheel}=g.mill;
  marks.push({x:house.x,z:house.z,hw:house.width/2,hd:house.depth/2,y0:0,y1:house.height+1.2,name:'watermill',group:'mill'});
  marks.push({x:wheel.x,z:wheel.z,hw:wheel.radius,hd:wheel.thickness/2+.05,y0:0,y1:wheel.y+wheel.radius,name:'watermill',group:'pond'});
  for(const p of g.paths)marks.push(shapeMark(p,{y0:0,y1:.05,name:'path',solid:false}));
  for(const r of g.rocks)marks.push({x:r.x,z:r.z,radius:r.r,y0:0,y1:r.h,name:'rock'});
  for(const p of g.pines){
    marks.push({x:p.x,z:p.z,radius:.4*p.size,y0:0,y1:3*p.size,name:'pine'});
    marks.push({x:p.x,z:p.z,radius:1.5*p.size,y0:1.2*p.size,y1:3.4*p.size,name:'pine',solid:false});
  }
  for(const t of g.blossoms){
    marks.push({x:t.x,z:t.z,radius:.3,y0:0,y1:2.2,name:'tree'});
    marks.push({x:t.x,z:t.z,radius:1.4,y0:1.6,y1:3.6,name:'tree',solid:false});
  }
  for(const l of g.lanterns){
    marks.push({x:l.x,z:l.z,radius:.2,y0:0,y1:3,name:'lantern'});
    marks.push({x:l.x+LANTERN_ARM,z:l.z,radius:.28,y0:1.6,y1:2.3,name:'lantern',solid:false});
  }
  for(const b of g.benches){
    const across=(b.rot??0)%180!==0;
    marks.push({x:b.x,z:b.z,hw:across?.28:.8,hd:across?.8:.28,y0:0,y1:.52,name:'bench'});
  }
  // Lotus pads and koi float on the pond's actual water level, not its top rim, so a look box
  // must sit at `level`, where they are drawn (`buildGarden`), not `top`.
  for(const l of g.lotus)marks.push({x:l.x,z:l.z,radius:.5,y0:level-.05,y1:level+.4,name:'lotus',solid:false});
  for(const k of g.koi)marks.push({x:k.x,z:k.z,radius:.35,y0:level-.05,y1:level+.15,name:'fish',solid:false});
  for(const w of g.walls)marks.push(shapeMark(w,{y0:0,y1:g.wallHeight,name:'wall',group:'park-wall'}));
  return marks;
}

export const watersideColumns=w=>[[w.x0+.25,w.z0+.25],[w.x0+.25,w.z1-.25],[w.x1-.25,w.z0+.25],[w.x1-.25,w.z1-.25]].map(([x,z])=>({x,z}));

// ---- Classical garden pieces shared by the park, the west quarter and the word hall ----
// A covered walkway, a lattice wall, a veranda front and a canal crossed by stone bridges. The
// builders in src/world/models.js draw them from the same layouts these marks come from. Every
// run lies along x or along z.

/**
 * A covered walkway 走廊 from (x0,z0) to (x1,z1) (so z0===z1 or x0===x1), `width` across, its floor
 * at `y`. Posts stand every `bay` metres down both sides. The side `rail` names (+1 toward +x/+z,
 * -1 toward -x/-z) has a railing, broken by `gaps` ([from,to] along the run) where a bridge or a
 * doorway meets it; no post stands in a gap on that side.
 */
export function walkwayLayout(w){
  const ax=w.z0===w.z1,a0=Math.min(ax?w.x0:w.z0,ax?w.x1:w.z1),a1=Math.max(ax?w.x0:w.z0,ax?w.x1:w.z1),c=ax?w.z0:w.x0;
  const width=w.width??2.2,n=Math.max(1,Math.round((a1-a0)/(w.bay??2.4))),bay=(a1-a0)/n;
  const at=(a,side)=>ax?{x:a,z:c+side*width/2}:{x:c+side*width/2,z:a};
  const inGap=(lo,hi)=>(w.gaps??[]).some(([g0,g1])=>hi>Math.min(g0,g1)&&lo<Math.max(g0,g1));
  const stops=Array.from({length:n+1},(_,i)=>a0+i*bay);
  const posts=[],rails=[],lanterns=[];
  for(const side of [-1,1])for(const a of stops)if(side!==w.rail||!inGap(a-.2,a+.2))posts.push(at(a,side));
  if(w.rail)for(let i=0;i<n;i++){
    const lo=stops[i]+.15,hi=stops[i+1]-.15;
    if(inGap(lo-.3,hi+.3))continue;
    const p=at((lo+hi)/2,w.rail),half=(hi-lo)/2;
    rails.push({...p,hw:ax?half:.08,hd:ax?.08:half});
  }
  // The roof is high enough to walk under with room to spare (2.9 m or more under the beams), and
  // each lantern hangs from just under it, its tassel well above your head.
  const y=w.y??0,height=w.height??3.3;
  if(w.lanterns!==false)for(let i=0;i<n;i+=2)lanterns.push({...at(stops[i]+bay/2,0),y:y+height-.7});
  return {ax,a0,a1,c,width,bay,posts,rails,lanterns,y,height};
}

/** Posts and railings stop you; the roof is high enough to walk under and is named by its meshes. */
export function walkwayMarks(w,group){
  const L=walkwayLayout(w),y=L.y;
  return [...L.posts.map(p=>({x:p.x,z:p.z,radius:.14,y0:y,y1:y+L.height,name:'pillar',group})),
    ...L.rails.map(r=>({...r,y0:y,y1:y+1,name:'railing',group}))];
}

/** Where the windows of a lattice wall {x0,x1,z0,z1} fall, as offsets along it from its centre. */
export function latticeWindows(w){
  const len=Math.max(w.x1-w.x0,w.z1-w.z0),every=w.every??5,n=Math.max(0,Math.floor((len-1.6)/every));
  return Array.from({length:n},(_,i)=>(i-(n-1)/2)*every);
}
export const latticeWallMarks=(w,group)=>[shapeMark(w,{y0:0,y1:w.height??3,name:'wall',group})];

/**
 * A veranda 檐廊 across a building's front: columns `depth` metres out at the local x offsets
 * `columns`, a railing between neighbouring columns except across the doorway (the bay that spans
 * x 0), and a lean-to roof back to the wall. World positions follow the building's rotation.
 */
export function verandaLayout(v,b){
  const face=(b.rotation??0)===180?-1:1,f=b.depth/2,depth=v.depth??1.5,cols=[...v.columns].sort((p,q)=>p-q);
  const world=(lx,lz)=>({x:b.x+face*lx,z:b.z+face*lz});
  const columns=cols.map(x=>world(x,f+depth));
  const rails=[];
  for(let i=0;i+1<cols.length;i++){
    if(cols[i]<0&&cols[i+1]>0)continue;          // the doorway
    const lo=cols[i]+.18,hi=cols[i+1]-.18;
    rails.push({...world((lo+hi)/2,f+depth),hw:(hi-lo)/2,hd:.08,lo,hi});
  }
  return {face,f,depth,cols,columns,rails,height:v.height??2.8};
}
export function verandaMarks(v,b){
  const L=verandaLayout(v,b);
  return [...L.columns.map(c=>({...c,radius:.16,y0:0,y1:L.height,name:'pillar',group:b.id})),
    ...L.rails.map(r=>({x:r.x,z:r.z,hw:r.hw,hd:r.hd,y0:0,y1:1,name:'railing',group:b.id}))];
}

// A canal runs along z and its bridges cross it along x. The park's rules are written for bridges
// that run along z, so the canal works in a frame with x and z swapped and swaps the marks back.
const swapShape=s=>isDisc(s)?{x:s.z,z:s.x,r:s.r}:{x0:s.z0,x1:s.z1,z0:s.x0,z1:s.x1};
const swapMark=m=>m.radius?{...m,x:m.z,z:m.x}:{...m,x:m.z,z:m.x,hw:m.hd,hd:m.hw};
/** The canal in the park's own terms (x and z swapped), for the park's shoreline and fence rules. */
export const canalAsPark=c=>({water:c.water,pond:c.channel.map(swapShape),stream:[],bridges:c.bridges.map(b=>({...b,x:b.z}))});

/** Water too high to step into, a fence round it too high to jump, and walkable arched bridges. */
export function canalMarks(c,group){
  const g=canalAsPark(c),{top,bottom,fence}=c.water,marks=[];
  for(const s of g.pond)marks.push(shapeMark(s,{y0:bottom,y1:top,name:'water',group}));
  for(const p of shoreFence(g))marks.push({x:p.x,z:p.z,radius:.3,y0:0,y1:fence,name:null,group});
  for(const b of g.bridges)marks.push(...bridgeMarks(b,c.guards.bridgeRail,group));
  return [...marks.map(swapMark),...(c.rocks??[]).map(r=>({x:r.x,z:r.z,radius:r.r,y0:0,y1:r.h,name:'rock',group}))];
}

/** Every mark a world.json `scenery` entry makes; `buildings` finds a veranda's building. */
export function sceneryMarks(def,buildings){
  const group=def.group??'scenery';
  if(def.kind==='walkway')return walkwayMarks(def,group);
  if(def.kind==='latticeWall')return latticeWallMarks(def,group);
  if(def.kind==='veranda')return verandaMarks(def,buildings.find(b=>b.id===def.building));
  if(def.kind==='waterEdge')return canalMarks(def,group);
  throw new Error('unknown scenery '+def.kind);
}
