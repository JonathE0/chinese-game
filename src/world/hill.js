import * as pc from 'playcanvas';
import hill from '../content/hill.json' with {type:'json'};
import {CITY_OFFSET} from './city.js';

/**
 * The 山城 hill west of downtown: terraces, the lit stone stairway and the viewpoint (task K-hill, docs/superpowers/plans/2026-09-26-development-wave-2.md).
 * Called once when 云海 is built, before its look boxes are registered and its statics batched:
 * add entities under `root` (already at CITY_OFFSET; anything that moves sets `noBatch`) and
 * marks through `town.mark('city', CITY_OFFSET + x, z, ...)`. Return null, or an object with
 * `update(dt, paused)` and/or `targets()` (called every frame while you are in the city).
 *
 * The hill is a grid of 4 m cells (hill.json). The stairway runs along whole cells, so it never
 * cuts a terrace column in half: every other cell is a solid column of retaining wall with grass
 * on top. Steps and landings are solid from the ground up, each rise low enough to walk up with W
 * the way the house's stairs are (registry STEP 0.42), and every side of the way that does not
 * lead on has a parapet whose hitbox stands far above any jump, so nobody leaves the stairway.
 */

const SIDES={e:[1,0],w:[-1,0],s:[0,1],n:[0,-1]};
const OPPOSITE={e:'w',w:'e',s:'n',n:'s'};
const RAIL=.3;           // parapet thickness, inside the edge of the way
const RAIL_ABOVE=3.2;    // a parapet's hitbox reaches this far above the way: well past a jump
const PARAPET=1.1;       // how far the drawn parapet stands above the way
const round=v=>Math.round(v*1000)/1000;

/** Everything the hill is made of, in city-local metres, with no drawing: shared by the scene and the tests. */
export function hillLayout(data=hill){
  const {grid,rise,width}=data,cell=grid.cell,half=cell/2;
  const key=(x,z)=>x+','+z;
  const corridor=new Set(),landings=new Map(),open=new Map();
  const steps=[],flats=[],rails=[];
  const opens=(x,z,side)=>{const k=key(x,z);if(!open.has(k))open.set(k,new Set());open.get(k).add(side);};
  const landing=(x,z,y)=>{
    if(y===0)return;                       // the street end of a route: the ground itself
    const k=key(x,z),had=landings.get(k);
    if(had&&had.y!==y)throw new Error(`hill: landing ${k} at two heights, ${had.y} and ${y}`);
    landings.set(k,{x,z,y});corridor.add(k);
  };
  // A rail from a to b (points on one edge line of the way, with the height of the way at each end).
  const rail=(ax,az,ay,bx,bz,by,inner=null)=>{
    const alongX=az===bz;
    rails.push({x:(ax+bx)/2,z:(az+bz)/2,hw:alongX?Math.abs(bx-ax)/2:RAIL/2,hd:alongX?RAIL/2:Math.abs(bz-az)/2,
      y0:0,y1:round(Math.max(ay,by)+RAIL_ABOVE),from:[ax,az,ay],to:[bx,bz,by],inner});
  };
  for(const route of data.routes){
    for(const node of route.nodes)landing(...node);
    for(let i=1;i<route.nodes.length;i++){
      const [px,pz,py]=route.nodes[i-1],[qx,qz,qy]=route.nodes[i];
      const axis=px!==qx?'x':'z';
      if(axis==='x'&&pz!==qz)throw new Error(`hill: ${route.id} turns between two nodes`);
      const sign=Math.sign(axis==='x'?qx-px:qz-pz),toward=axis==='x'?(sign>0?'e':'w'):(sign>0?'s':'n');
      opens(px,pz,toward);opens(qx,qz,OPPOSITE[toward]);
      const a0=(axis==='x'?px:pz)+sign*half,a1=(axis==='x'?qx:qz)-sign*half,across=axis==='x'?pz:px;
      const run=Math.abs(a1-a0),at=(a,b)=>axis==='x'?[a,b]:[b,a];
      if(run<=0)continue;                  // two landings side by side
      for(let c=Math.min(a0,a1)+half;c<Math.max(a0,a1);c+=cell)corridor.add(key(...at(c,across)));
      const dy=qy-py;
      if(dy===0){
        const [x,z]=at((a0+a1)/2,across),[hw,hd]=at(run/2,width/2);
        flats.push({x,z,hw,hd,y:py});
      } else {
        const n=Math.round(Math.abs(dy)/rise),tread=run/n;
        for(let s=0;s<n;s++){
          const [x,z]=at(a0+sign*(s+.5)*tread,across),[hw,hd]=at(tread/2,width/2);
          // Climbing, the step nearest the lower landing is one rise up; the last is flush with the top.
          const y=round(dy>0?py+(s+1)*rise:py-s*rise);
          steps.push({x,z,hw,hd,y,axis,front:dy>0?-sign:sign,tread,route:route.id});
        }
      }
      for(const side of [-1,1]){
        const edge=across+side*(half-RAIL/2);
        rail(...at(a0,edge),py,...at(a1,edge),qy,at(0,-side));
      }
    }
  }
  const onPlatform=(x,z)=>data.platform.cells.some(([px,pz])=>px===x&&pz===z);
  for(const [x,z] of data.platform.cells)landing(x,z,data.platform.y);
  for(const {cell:[x,z],side} of data.open??[])opens(x,z,side);
  // Round each landing, a parapet on every side that leads nowhere.
  for(const {x,z,y} of landings.values()){
    for(const [side,[sx,sz]] of Object.entries(SIDES)){
      if(open.get(key(x,z))?.has(side)||onPlatform(x,z)&&onPlatform(x+sx*cell,z+sz*cell))continue;
      const ex=x+sx*(half-RAIL/2),ez=z+sz*(half-RAIL/2);
      if(sx)rail(ex,z-half,y,ex,z+half,y,[-sx,0]);else rail(x-half,ez,y,x+half,ez,y,[0,-sz]);
    }
  }
  for(const r of data.rails??[])rail(r.from[0],r.from[1],r.y,r.to[0],r.to[1],r.y);

  // The terraces: every cell off the stairway, falling away from the summit in retaining-wall steps.
  const t=data.terrace,s=data.summit;
  let seed=s.seed;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const columns=[],trees=[];
  for(let r=0;r<grid.rows;r++){
    let last=null;
    for(let c=0;c<grid.cols;c++){
      const x=grid.x0+half+c*cell,z=grid.z0+half+r*cell,noise=rand(),treeRoll=rand(),tx=rand(),tz=rand();
      if(corridor.has(key(x,z))){last=null;continue;}
      const inT=x>t.x0&&x<t.x1&&z>t.z0&&z<t.z1;
      let h=s.peak-s.fall*Math.hypot(x-s.x,z-s.z)+(noise*2-1)*s.jitter;
      h=Math.max(data.min,Math.min(data.platform.y-data.level,Math.round(h/data.level)*data.level));
      // Behind the hotpot terrace (south and west) the hill stands higher than its floor.
      if(x>t.x0-cell&&x<t.x1&&z>t.z0&&z<t.z1+cell)h=Math.max(h,t.bank);
      const kind=inT?'terrace':'mountain';
      if(inT)h=t.y;
      // No tree stands tall enough round the summit to block the view from it.
      if(kind==='mountain'&&treeRoll<data.trees&&h<data.platform.y-4)trees.push({x:x+(tx-.5)*2,z:z+(tz-.5)*2,y:h,scale:.8+tx*.5,shade:Math.floor(tz*3)%3});
      if(last&&last.kind===kind&&last.h===h&&last.x+last.hw===x-half){last.x+=half;last.hw+=half;continue;}
      // The hotpot deck (J-hotpot) is the terrace's top 0.4 m; its drawn wall stops under it so
      // the two side faces never share a plane. `h` stays the floor you stand on.
      last={x,z,hw:half,hd:half,h,kind,top:inT?t.y-.4:h};columns.push(last);
    }
  }
  // Low lamps along the parapets, one every cell.
  const lamps=[];
  for(const r of rails){
    const [ax,az,ay]=r.from,[bx,bz,by]=r.to,length=Math.hypot(bx-ax,bz-az);
    for(let d=half;d<length;d+=cell){
      const f=d/length;
      lamps.push({x:ax+(bx-ax)*f,z:az+(bz-az)*f,y:round(ay+(by-ay)*f+PARAPET)});
    }
  }
  return {cell,width,steps,flats,landings:[...landings.values()],rails,columns,trees,lamps,corridor,seawall:data.seawall};
}

/** Where each bench stands: against the named side of its landing, facing into it. */
function benchSpots(layout,data=hill){
  const half=layout.cell/2;
  return (data.benches??[]).map(({cell:[x,z],side})=>{
    const l=layout.landings.find(one=>one.x===x&&one.z===z);
    const [sx,sz]=SIDES[side],inset=half-RAIL-.4;
    return {x:x+sx*inset,z:z+sz*inset,y:l.y,yaw:{n:0,s:180,e:-90,w:90}[side],hw:sx?.5:1.3,hd:sx?1.3:.5};
  });
}

/** Every hitbox the hill registers, in city-local metres. */
export function hillMarks(layout){
  const half=layout.cell/2,marks=[];
  // The terrace's own floor is the hotpot deck's solid block (J-hotpot), so only the hill round it is marked here.
  for(const c of layout.columns)if(c.kind==='mountain')marks.push({x:c.x,z:c.z,hw:c.hw,hd:c.hd,y0:0,y1:c.h,name:'mountain'});
  for(const l of layout.landings)marks.push({x:l.x,z:l.z,hw:half,hd:half,y0:0,y1:l.y,name:'path'});
  for(const f of layout.flats)marks.push({x:f.x,z:f.z,hw:f.hw,hd:f.hd,y0:0,y1:f.y,name:'path'});
  for(const s of layout.steps)marks.push({x:s.x,z:s.z,hw:s.hw,hd:s.hd,y0:0,y1:s.y,name:'step'});
  // The parapets carry their names on their meshes: the hitbox stands in the air well above them.
  for(const r of layout.rails)marks.push({x:r.x,z:r.z,hw:r.hw,hd:r.hd,y0:r.y0,y1:r.y1,name:null});
  for(const b of benchSpots(layout))marks.push({x:b.x,z:b.z,hw:b.hw,hd:b.hd,y0:b.y,y1:b.y+.95,name:'bench'});
  const s=layout.seawall;
  if(s)marks.push({x:(s.x0+s.x1)/2,z:(s.z0+s.z1)/2,hw:(s.x1-s.x0)/2,hd:(s.z1-s.z0)/2,y0:0,y1:s.y+s.rail,name:'wall'});
  return marks;
}

export function buildHill(town,root){
  const data=hill,layout=hillLayout(data),{box,cylinder,ball,label,glow}=town.m,C=data.colors;
  const hillRoot=new pc.Entity('yunhai-hill');root.addChild(hillRoot);

  for(const c of layout.columns){
    const wall=box(hillRoot,[c.x,c.top/2,c.z],[c.hw*2,c.top,c.hd*2],C.wall);
    if(c.kind==='terrace')wall.lookName='wall';     // unmarked (the deck's block is its hitbox): named by its mesh
    if(c.kind==='mountain')box(hillRoot,[c.x,c.h-.04,c.z],[c.hw*2+.04,.1,c.hd*2+.04],C.grass);
  }
  for(const l of layout.landings)box(hillRoot,[l.x,l.y/2,l.z],[layout.cell,l.y,layout.cell],C.landing);
  // The sea wall along the water under the north face: stone, a coping and a steel railing on top.
  const sw=layout.seawall;
  if(sw){
    const cx=(sw.x0+sw.x1)/2,len=sw.x1-sw.x0,depth=sw.z1-sw.z0,rz=sw.z0+.15;
    box(hillRoot,[cx,sw.y/2,(sw.z0+sw.z1)/2],[len,sw.y,depth],C.wall).lookName='wall';
    box(hillRoot,[cx,sw.y+.05,(sw.z0+sw.z1)/2],[len+.1,.1,depth+.1],C.parapet);
    const railing=new pc.Entity('hill-seawall-railing');railing.lookName='railing';hillRoot.addChild(railing);
    for(const y of [sw.y+sw.rail-.04,sw.y+.5])box(railing,[cx,y,rz],[len,.06,.06],C.post);
    for(let x=sw.x0+.1;x<=sw.x1;x+=2)box(railing,[x,sw.y+sw.rail/2,rz],[.07,sw.rail,.07],C.post);
  }
  for(const f of layout.flats)box(hillRoot,[f.x,f.y/2,f.z],[f.hw*2,f.y,f.hd*2],C.landing);

  // Steps, each with a strip of light set into its nosing; one lit material for all of them.
  const strip=glow(C.stripLight),lamp=glow(C.lampLight);
  const inner=layout.width-2*RAIL-.3;
  for(const s of layout.steps){
    box(hillRoot,[s.x,s.y/2,s.z],[s.hw*2,s.y,s.hd*2],C.step);
    const nose=s.tread/2+.015;
    const lit=s.axis==='x'
      ?box(hillRoot,[s.x+s.front*nose,s.y-.035,s.z],[.05,.05,inner],C.stripLight)
      :box(hillRoot,[s.x,s.y-.035,s.z+s.front*nose],[inner,.05,.05],C.stripLight);
    lit.render.meshInstances[0].material=strip;
  }
  // Parapets: a stone band along each edge, sloping with the flight it runs beside.
  for(const r of layout.rails){
    const [ax,az,ay]=r.from,[bx,bz,by]=r.to,run=Math.hypot(bx-ax,bz-az),alongX=az===bz;
    const rise=(alongX?Math.sign(bx-ax):Math.sign(bz-az))*(by-ay);
    const angle=Math.atan2(rise,run)*180/Math.PI,length=Math.hypot(run,by-ay)+RAIL;
    const mid=[(ax+bx)/2,(ay+by)/2+PARAPET-.65,(az+bz)/2];
    // Along a level stretch, a line of light set into the paving at the foot of the parapet.
    if(ay===by&&r.inner){
      const [nx,nz]=r.inner,off=RAIL/2+.1,line=box(hillRoot,[mid[0]+nx*off,ay+.006,mid[2]+nz*off],alongX?[run,.02,.07]:[.07,.02,run],C.stripLight);
      line.render.meshInstances[0].material=strip;
    }
    // Round the viewpoint a light steel railing instead, so the view goes through it.
    if(ay===data.platform.y&&by===ay){
      const railing=new pc.Entity('hill-railing');railing.lookName='railing';hillRoot.addChild(railing);
      for(const [y,thick] of [[ay+PARAPET-.04,.08],[ay+.55,.05]])
        box(railing,[mid[0],y,mid[2]],alongX?[length,thick,thick]:[thick,thick,length],C.post);
      for(let d=0;d<=run+1e-6;d+=1){
        const f=run?d/run:0;
        box(railing,[ax+(bx-ax)*f,ay+PARAPET/2,az+(bz-az)*f],[.07,PARAPET,.07],C.post);
      }
      continue;
    }
    box(hillRoot,mid,alongX?[length,1.3,RAIL]:[RAIL,1.3,length],C.parapet,alongX?[0,0,angle]:[-angle,0,0]).lookName='railing';
  }
  for(const l of layout.lamps){
    const post=new pc.Entity('hill-lamp');post.lookName='lamp';hillRoot.addChild(post);
    cylinder(post,[l.x,l.y+.17,l.z],[.1,.34,.1],C.post);
    box(post,[l.x,l.y+.4,l.z],[.16,.12,.16],C.lampLight).render.meshInstances[0].material=lamp;
  }
  // Soft, not floodlit: the lights glow at about half the strength of a street lamp.
  town.daylight.addLamp(strip,.55);town.daylight.addLamp(lamp,.7);

  for(const t of layout.trees){
    const tree=new pc.Entity('hill-tree');tree.lookName='tree';
    tree.setLocalPosition(t.x,t.y,t.z);tree.setLocalScale(t.scale,t.scale,t.scale);hillRoot.addChild(tree);
    cylinder(tree,[0,1,0],[.26,2,.26],C.trunk);
    ball(tree,[0,2.5,0],[2.2,1.9,2.2],C.crowns[t.shade]);
  }
  for(const b of benchSpots(layout)){
    const bench=new pc.Entity('hill-bench');bench.lookName='bench';
    bench.setLocalPosition(b.x,b.y,b.z);bench.setLocalEulerAngles(0,b.yaw,0);hillRoot.addChild(bench);
    for(const x of [-1.1,1.1])box(bench,[x,.24,0],[.14,.48,.6],C.benchFrame);
    for(let i=0;i<4;i++)box(bench,[0,.48,-.22+i*.14],[2.5,.08,.12],C.bench);
    box(bench,[0,.86,-.32],[2.5,.42,.08],C.bench,[12,0,0]);
  }
  // Signs are lit from within, so they read on the way up at night too.
  for(const sign of data.signs){
    const [x,z,y]=sign.at,[w,h]=sign.size;
    const board=label(hillRoot,sign.text,[x,y,z],w,h,C.signBg,C.signInk);
    board.setLocalEulerAngles(0,{e:90,w:-90,s:0,n:180}[sign.face],0);
    const m=board.render.meshInstances[0].material;m.emissive.set(.75,.75,.75);m.update();
  }

  // The hill is one connected structure: its parapets stand on its steps, its steps against its terraces.
  for(const m of hillMarks(layout))town.mark('city',CITY_OFFSET+m.x,m.z,m.hw,m.hd,m.y0,m.y1,m.name).group='yunhai-hill';
  return {layout,lamps:[strip,lamp]};
}
