import * as pc from 'playcanvas';
import garden from '../content/garden.json' with {type:'json'};
import {gardenMarks,shoreline,isDisc,inShape,inAny,balustrade,pavilionColumns,watersideColumns,LANTERN_ARM} from '../core/garden.js';
import {waterOf} from './water.js';

/**
 * 莲池公园 — Lotus Pond Park, south of the square through the moon gate. Everything here is built
 * from src/content/garden.json; this returns the collision and name marks for the town registry
 * (derived in src/core/garden.js, so the unit tests check the same shapes the player walks on).
 * Low-poly after Nan Lian Garden: a lotus pond round a golden pavilion on an island, two vermilion
 * bridges, a stream from a rock waterfall past a timber water wheel, pines and white walls.
 */
const C={paving:'#d8cdb2',plaster:'#efe9dc',coping:'#6d7471',ridge:'#565c5a',vermilion:'#b8472f',
  railRed:'#c2553a',gold:'#d6a843',goldDeep:'#b98a2c',stone:'#c9c0a8',stoneDark:'#a9a08a',
  rock:'#9d968a',rockLight:'#b0a899',timber:'#8a6a4c',timberDark:'#6e533b',pine:'#62845c',
  pineDark:'#557452',trunk:'#7d624a',blossom:'#e7b3c3',blossomDeep:'#d897ad',pad:'#7f9e6a',
  lotus:'#e3a1b8',foam:'#e6f0ec'};
const DEG=180/Math.PI;

export function buildGarden(models,parent,lamps){
  const {box,cylinder,ball,shape,label,lantern,tiledRoof,stoneBridge,rockery,walkway}=models;
  const root=new pc.Entity('garden');parent.addChild(root);
  const W=garden.water,level=W.level;

  // The water (src/world/water.js): the pond drifts, each stretch of the stream runs its own way
  // (its `flow`) from the fall to the pond, and the fall pours. Opaque, so the overlapping pieces
  // of the pond's outline read as one sheet; the stream lies a hair above the pond where they meet.
  const app=pc.AppBase.getApplication(),water=waterOf(app),pond=water.surface({flow:[.03,.05],tile:3.4,ripple:.13});
  const streams=new Map(),stream=flow=>{
    if(!streams.has(String(flow)))streams.set(String(flow),water.surface({flow,tile:2.6,ripple:.2}));
    return streams.get(String(flow));
  };
  const wet=(e,material)=>{e.render.meshInstances[0].material=material;e.render.castShadows=false;return e;};
  const sheet=(s,y,thick,material)=>wet(isDisc(s)?cylinder(root,[s.x,y,s.z],[s.r*2,thick,s.r*2],'#79aaa8')
    :box(root,[(s.x0+s.x1)/2,y,(s.z0+s.z1)/2],[s.x1-s.x0,thick,s.z1-s.z0],'#79aaa8'),material);
  // A pivot turned about y, so a part can be laid out along its own x axis.
  const pivot=(x,y,z,yaw)=>{const e=new pc.Entity('pivot');e.setLocalPosition(x,y,z);e.setLocalEulerAngles(0,yaw,0);root.addChild(e);return e;};

  // Paths first, so everything else stands on them.
  for(const s of garden.paths)box(root,[(s.x0+s.x1)/2,.03,(s.z0+s.z1)/2],[s.x1-s.x0,.06,s.z1-s.z0],C.paving);

  // The pond and the stream, edged with stones except where a bridge or the stream meets them.
  for(const s of garden.pond)sheet(s,level,.04,pond);
  for(const s of garden.stream)sheet(s,level+.005,.04,stream(s.flow));
  sheet(garden.streamMouth,level+.005,.04,stream(garden.streamMouth.flow));   // where the stream runs into the pond
  const ws=garden.waterside,is=garden.island;
  // A thrown thing floats on the water and it laps at the bank; the island, the bridges and the
  // waterside pavilion stand in it, dry.
  const dry=(x,z)=>inShape(is,x,z)||(x>ws.x0&&x<ws.x1&&z>ws.z0&&z<ws.z1)
    ||garden.bridges.some(b=>Math.abs(x-b.x)<b.width/2&&z>b.steps[0][0]&&z<b.steps.at(-1)[1]);
  water.body('town',[...garden.pond,...garden.stream,garden.streamMouth],level+.02,dry);
  const landing=(x,z)=>garden.bridges.some(b=>Math.abs(x-b.x)<b.width/2+.3&&z>b.steps[0][0]-.3&&z<b.steps.at(-1)[1]+.3)
    ||(x>ws.x0-.3&&x<ws.x1+.3&&z>ws.z0-.3&&z<ws.z1+.3);
  const skip=garden.shoreStonesSkip;
  const stones=[...shoreline(garden.pond,1.5,(x,z)=>landing(x,z)||inAny(skip.pond,x,z)),
    ...shoreline(garden.stream,1.5,(x,z)=>landing(x,z)||inAny(skip.stream,x,z))];
  stones.forEach((p,i)=>{shape(root,'sphere',[p.x,.12,p.z],[1.0,.3,.7],i%2?C.stone:C.stoneDark,[0,-p.angle*DEG,0]).lookName='stone';});

  // Lotus pads, a few flowers, and koi breaking the surface.
  for(const l of garden.lotus){
    cylinder(root,[l.x,level+.04,l.z],[.95,.03,.95],C.pad);
    if(l.flower){ball(root,[l.x+.12,level+.2,l.z+.08],[.34,.3,.34],C.lotus);}
  }
  for(const k of garden.koi)shape(root,'sphere',[k.x,level+.03,k.z],[.5,.08,.22],k.color,[0,k.rot,0]);

  // The island: a stone drum with a low balustrade, open where the two bridges land.
  cylinder(root,[is.x,is.top/2,is.z],[is.r*2,is.top,is.r*2],C.stone).lookName='stone';
  cylinder(root,[is.x,is.top-.06,is.z],[is.r*2+.2,.1,is.r*2+.2],C.stoneDark).lookName='railing';
  // Every other collision post is drawn, plus each arc's end post beside a bridge rail.
  const all=balustrade(is),half=all.length/2;
  for(const arc of [all.slice(0,half),all.slice(half)]){
    const posts=arc.filter((_,i)=>i%2===0||i===arc.length-1);
    posts.forEach((p,i)=>{
      box(root,[p.x,is.top+.42,p.z],[.18,.84,.18],C.stoneDark).lookName='railing';
      const q=posts[i+1];if(!q)return;
      const mid=pivot((p.x+q.x)/2,is.top+.7,(p.z+q.z)/2,-Math.atan2(q.z-p.z,q.x-p.x)*DEG);
      box(mid,[0,0,0],[Math.hypot(q.x-p.x,q.z-p.z)+.05,.1,.12],C.stone).lookName='railing';
    });
  }

  // 莲心亭: a golden octagonal pavilion, open on every side, with its plaque facing the gate.
  const pv=garden.pavilion,y0=pv.floorTop,top=y0+pv.height;
  cylinder(root,[pv.x,y0-.1,pv.z],[pv.floor*2,.2,pv.floor*2],C.stoneDark);
  for(const c of pavilionColumns(pv))cylinder(root,[c.x,y0+pv.height/2,c.z],[.26,pv.height,.26],C.vermilion);
  for(let i=0;i<8;i++){
    const side=pivot(pv.x,top-.15,pv.z,45*i-90);
    box(side,[pv.r*Math.cos(Math.PI/8),0,0],[.2,.3,2*pv.r*Math.sin(Math.PI/8)+.2],C.goldDeep).lookName='pavilion';
    const corner=pivot(pv.x,0,pv.z,22.5+45*i-90),reach=pv.r+.9,rise=1.5;
    box(corner,[reach/2,top+.05+rise/2,0],[Math.hypot(reach,rise),.14,.16],C.goldDeep,[0,0,-Math.atan2(rise,reach)*DEG]).lookName='pavilion';
    box(corner,[reach+.15,top+.12,0],[.55,.12,.14],C.gold,[0,0,24]).lookName='pavilion';
  }
  cylinder(root,[pv.x,top+.02,pv.z],[(pv.r+.9)*2,.12,(pv.r+.9)*2],C.goldDeep);
  shape(root,'cone',[pv.x,top+.8,pv.z],[(pv.r+.85)*2,1.5,(pv.r+.85)*2],C.gold);
  ball(root,[pv.x,top+1.65,pv.z],[.35,.35,.35],C.gold);
  cylinder(root,[pv.x,top+1.95,pv.z],[.1,.5,.1],C.goldDeep).lookName='pavilion';
  label(root,pv.plaque,[pv.x,top-.55,pv.z-pv.r*Math.cos(Math.PI/8)-.02],1.5,.42,'#3d4f47','#e8c46a');

  // Bridges: stepped slabs, a pier under the crest, and a hand-rail that follows the steps.
  for(const b of garden.bridges)stoneBridge(root,b,b.flat?C.timber:C.vermilion,b.flat?C.timberDark:C.railRed);

  // 荷风水榭: a waterside pavilion on the east bank, its floor reaching out over the pond, with a
  // low railing on the three sides over the water and its plaque facing the covered walkway.
  const wy=ws.floorTop,wx=(ws.x0+ws.x1)/2,wz=(ws.z0+ws.z1)/2,wW=ws.x1-ws.x0,wD=ws.z1-ws.z0;
  const pier=box(root,[wx,(wy-.4)/2-.01,wz],[wW,wy+.4,wD],C.stoneDark);pier.lookName='waterside';
  box(root,[wx,wy-.04,wz],[wW+.1,.08,wD+.1],C.timber).lookName='waterside';
  box(root,[ws.x1+.3,wy/4,wz],[.6,wy/2,2.4],C.stone).lookName='waterside';          // the step up from the bank
  for(const c of watersideColumns(ws))cylinder(root,[c.x,wy+ws.height/2,c.z],[.24,ws.height,.24],C.timberDark).lookName='pillar';
  for(const [x,z,w,d] of [[wx,ws.z0+.06,wW,.1],[wx,ws.z1-.06,wW,.1],[ws.x0+.06,wz,.1,wD]]){
    const rail=new pc.Entity('railing');rail.lookName='railing';root.addChild(rail);
    box(rail,[x,wy+.62,z],[w,.1,d],C.timber);box(rail,[x,wy+.2,z],[w,.08,d],C.timber);
  }
  tiledRoof(root,wx,wz,wW-.2,wD-.2,wy+ws.height,C.coping,4);
  // The plaque hangs from a tie beam a little inside the east face: on the face itself it sat up
  // behind the covered walkway's roof, and from under that roof you could not see it.
  box(root,[ws.x1-.8,wy+ws.height-.07,wz],[.14,.14,wD],C.timberDark).lookName='waterside';
  const plaque=label(root,ws.plaque,[ws.x1-.8,wy+ws.height-.36,wz],1.7,.44,'#3d4f47','#e8c46a');
  plaque.setLocalEulerAngles(0,90,0);
  walkway(root,garden.walkway,lamps);

  // The waterfall: a pile of rock in the south-west corner with water falling into the stream.
  const wf=garden.waterfall;
  for(const r of wf.rocks){
    ball(root,[r.x,r.h*.45,r.z],[r.r*2,r.h,r.r*1.8],C.rock);
    ball(root,[r.x+r.r*.35,r.h*.2,r.z-r.r*.4],[r.r,r.h*.5,r.r],C.rockLight);
  }
  wet(box(root,[wf.x,wf.top/2,wf.z],[1.1,wf.top,.14],'#79aaa8'),water.surface({flow:[0,1.4],tile:1.6,fall:true}));
  ball(root,[wf.x,level+.1,wf.z-.35],[1.5,.35,.9],C.foam);

  // The mill house and its wheel, which turns in the stream on an axle from the wall.
  const {house,wheel}=garden.mill;
  box(root,[house.x,house.height/2,house.z],[house.width,house.height,house.depth],C.plaster);
  box(root,[house.x,.25,house.z],[house.width+.1,.5,house.depth+.1],C.stoneDark);
  for(const side of [-1,1])box(root,[house.x+side*house.width/4,house.height+.45,house.z],[house.width/2+.35,.14,house.depth+.5],C.coping,[0,0,-side*28]);
  box(root,[house.x,house.height+.9,house.z],[.2,.16,house.depth+.5],C.ridge);
  box(root,[house.x+house.width/2+.03,1.0,house.z-.3],[.06,2,.9],C.timberDark);          // door, on the path side
  box(root,[house.x,1.5,house.z+house.depth/2+.03],[.9,.7,.06],C.timberDark);            // window over the stream
  cylinder(root,[wheel.x,wheel.y,(house.z+house.depth/2+wheel.z)/2],[.14,wheel.z-house.z-house.depth/2,.14],C.timberDark,[90,0,0]).lookName='watermill';
  const wheelRoot=new pc.Entity('watermill-wheel');wheelRoot.noBatch=true;wheelRoot.lookName='watermill';wheelRoot.setLocalPosition(wheel.x,wheel.y,wheel.z);root.addChild(wheelRoot);
  const R=wheel.radius,T=wheel.thickness;
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2,mid=a+Math.PI/8;
    box(wheelRoot,[Math.cos(mid)*R,Math.sin(mid)*R,0],[2*R*Math.sin(Math.PI/8)+.06,.1,T],C.timber,[0,0,mid*DEG+90]);
    box(wheelRoot,[Math.cos(a)*(R+.1),Math.sin(a)*(R+.1),0],[.3,.06,T+.04],C.timberDark,[0,0,a*DEG]);
  }
  for(let i=0;i<4;i++)for(const z of [-T/2+.05,T/2-.05])box(wheelRoot,[0,0,z],[R*2,.08,.08],C.timberDark,[0,0,i*45]);
  cylinder(wheelRoot,[0,0,0],[.3,T+.1,.3],C.timberDark,[90,0,0]);

  // Now and then a koi leaps out of the open water, and rings spread where it leaves and lands. One
  // fish, carried along its arc by a pivot (heading) and a body (pitch); hidden between leaps.
  const koi=new pc.Entity('koi-leap');koi.noBatch=true;koi.enabled=false;root.addChild(koi);
  const fish=new pc.Entity('koi');koi.addChild(fish);
  shape(fish,'sphere',[0,0,0],[.5,.16,.22],garden.koi[0].color);
  shape(fish,'cone',[-.3,0,0],[.14,.22,.2],garden.koi[0].color,[0,0,-90]);
  const LEAP={time:.8,high:.55,reach:.9},leap={on:false,wait:4,t:0,x:0,z:0,dx:0,dz:0};
  const open=(x,z)=>inAny(garden.pond,x,z,1)&&!dry(x,z)&&!inShape(is,x,z,-1.2)&&!garden.lotus.some(l=>Math.hypot(x-l.x,z-l.z)<1);
  app.on('update',dt=>{
    if(!root.enabled)return;
    dt=Math.min(dt,.05);
    wheelRoot.rotateLocal(0,0,wheel.spin*dt);
    if(water.place!=='town')return;   // only where someone could see it
    if(!leap.on){
      if((leap.wait-=dt)>0)return;
      const p=garden.pond[0],a=Math.random()*Math.PI*2;
      leap.x=p.x0+Math.random()*(p.x1-p.x0);leap.z=p.z0+Math.random()*(p.z1-p.z0);
      leap.dx=Math.cos(a)*LEAP.reach;leap.dz=Math.sin(a)*LEAP.reach;
      if(!open(leap.x,leap.z)||!open(leap.x+leap.dx,leap.z+leap.dz)){leap.wait=.5;return;}
      leap.on=true;leap.t=0;leap.wait=4+Math.random()*6;
      koi.setLocalEulerAngles(0,-a*DEG,0);koi.enabled=true;water.ripple(leap.x,leap.z,.8);
    }
    const k=Math.min(1,(leap.t+=dt)/LEAP.time);
    koi.setLocalPosition(leap.x+leap.dx*k,level+4*LEAP.high*k*(1-k),leap.z+leap.dz*k);
    fish.setLocalEulerAngles(0,0,Math.atan2(4*LEAP.high*(1-2*k),LEAP.reach)*DEG);
    if(k<1)return;
    leap.on=false;koi.enabled=false;water.ripple(leap.x+leap.dx,leap.z+leap.dz,1);
  });

  // Planting: sculpted pines with cloud-pruned pads, flowering trees, and the court's rockeries.
  for(const t of garden.pines){
    const e=new pc.Entity('pine');e.setLocalPosition(t.x,0,t.z);e.setLocalScale(t.size,t.size,t.size);root.addChild(e);
    cylinder(e,[.1,1.2,0],[.34,2.5,.34],C.trunk,[0,0,-7]);
    ball(e,[.6,2.1,.2],[2.1,.55,1.7],C.pine);ball(e,[-.55,2.7,-.1],[1.7,.5,1.4],C.pineDark);
    ball(e,[.15,3.25,.1],[1.2,.45,1.1],C.pine);ball(e,[.9,1.55,-.35],[1.2,.4,1.0],C.pineDark);
  }
  for(const t of garden.blossoms){
    cylinder(root,[t.x,1.1,t.z],[.26,2.2,.26],C.trunk);
    ball(root,[t.x,2.7,t.z],[2.4,1.8,2.2],C.blossom);ball(root,[t.x+.6,2.3,t.z+.3],[1.4,1.1,1.3],C.blossomDeep);
  }
  for(const r of garden.rocks)rockery(root,r);

  // Lanterns on timber posts, lit after dark; timber benches facing the water.
  for(const l of garden.lanterns){
    // A post with a bracket arm at its top; the lantern hangs from the arm's end.
    cylinder(root,[l.x,1.3,l.z],[.14,2.6,.14],C.timberDark);
    box(root,[l.x+LANTERN_ARM/2,2.55,l.z],[LANTERN_ARM+.1,.08,.08],C.timberDark);
    const made=lantern(root,l.x+LANTERN_ARM,1.95,l.z);lamps.push(made.material);
  }
  for(const b of garden.benches){
    const e=pivot(b.x,0,b.z,b.rot??0);e.lookName='bench';
    box(e,[0,.45,0],[1.6,.1,.5],C.timber);box(e,[0,.78,-.22],[1.6,.36,.08],C.timber);
    for(const x of [-.65,.65])box(e,[x,.2,0],[.12,.4,.46],C.stoneDark);
  }

  // White walls with grey tile coping close the park on three sides.
  const H=garden.wallHeight;
  for(const w of garden.walls){
    const cx=(w.x0+w.x1)/2,cz=(w.z0+w.z1)/2,dx=w.x1-w.x0,dz=w.z1-w.z0,alongX=dx>dz;
    box(root,[cx,H/2,cz],[dx,H,dz],C.plaster);
    box(root,[cx,H+.08,cz],alongX?[dx+.3,.16,dz+.35]:[dx+.35,.16,dz+.3],C.coping).lookName='wall';
    box(root,[cx,H+.22,cz],alongX?[dx,.12,.16]:[.16,.12,dz],C.ridge).lookName='wall';
  }

  return {marks:gardenMarks(garden),root,wheel:wheelRoot};
}
