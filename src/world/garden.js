import * as pc from 'playcanvas';
import garden from '../content/garden.json' with {type:'json'};
import {gardenMarks,shoreline,isDisc,inShape,inAny,balustrade,pavilionColumns,watersideColumns,crossingLayout,crossingFootprint,gateLayout,LANTERN_ARM} from '../core/garden.js';
import {detail,RENDER} from '../core/quality.js';
import {waterOf} from './water.js';
import {initIdle,animateIdle} from './idle.js';
import {natureKit,buildTree,buildBamboo,buildFlowerbed,blob,flag,GRANITE} from './jiangnan-nature.js';

/**
 * 莲池公园 — Lotus Pond Park, south of the square through the moon gate, and the way into town: you
 * arrive through the town gate in its south wall. Everything here is built from
 * src/content/garden.json; this returns the collision and name marks for the town registry
 * (derived in src/core/garden.js, so the unit tests check the same shapes the player walks on) and
 * the park's life (people and animals, which move, so town.js batches and names them itself).
 * Low-poly after Nan Lian Garden: a lotus pond round a golden pavilion on an island, two vermilion
 * bridges and a 九曲桥, a stream from a rockery waterfall past a timber water wheel, bamboo, pines,
 * blossom, willows and white walls.
 */
const C={paving:'#d8cdb2',plaster:'#efe9dc',coping:'#6d7471',ridge:'#565c5a',vermilion:'#b8472f',
  railRed:'#c2553a',gold:'#d6a843',goldDeep:'#b98a2c',stone:'#c9c0a8',stoneDark:'#a9a08a',
  rock:'#9d968a',rockLight:'#b0a899',timber:'#8a6a4c',timberDark:'#6e533b',pine:'#62845c',
  pineDark:'#557452',trunk:'#7d624a',blossom:'#e7b3c3',blossomDeep:'#d897ad',pad:'#7f9e6a',
  padLight:'#93b27a',lotus:'#e3a1b8',lotusDeep:'#d77f9f',foam:'#e6f0ec',slab:'#d9d2c0',
  bamboo:'#7fa35a',bambooDark:'#5f8446',bambooLeaf:'#8fb566',soil:'#7a6048',flagstone:'#c3bba6',
  plum:'#d9667f',plumLight:'#f0b8c4',peach:'#f2b7c6',peachLight:'#fad3dc',moss:'#7d9a62'};
const BLOSSOM={plum:[C.plum,C.plumLight],peach:[C.peach,C.peachLight]};
const FLOWERS=['#e4574a','#f2c94c','#f4f0e6','#e98bb0','#b58ad6','#f29a4a'];
const DEG=180/Math.PI;
// A deterministic scatter, so the park looks the same on every visit.
const jitter=(i,k=1)=>{const s=Math.sin(i*12.9898+k*78.233)*43758.5453;return s-Math.floor(s)-.5;};

export function buildGarden(models,parent,lamps,town=null){
  const {box,cylinder,ball,shape,label,tiledRoof,stoneBridge,rockery,walkway,sceneryLantern,glow}=models;
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
  const pivot=(x,y,z,yaw,at=root)=>{const e=new pc.Entity('pivot');e.setLocalPosition(x,y,z);e.setLocalEulerAngles(0,yaw,0);at.addChild(e);return e;};

  // Paths first, so everything else stands on them. The forecourt is laid in flags with darker
  // joints, and a walk of darker stone, kerbed both sides, runs up the middle from the town gate.
  // All in the Jiangnan look (src/world/jiangnan-nature.js): painted stone, one shade throughout so
  // overlapping pieces never flicker.
  const paths=natureKit(models.painted,{jitter:0});
  for(const s of garden.paths){
    if(isDisc(s)){paths.turn([s.x,0,s.z],[[s.r,0],[s.r,.06],[s.r,.06],[0,.06]],C.paving,{kind:'stone',seg:28});continue;}
    paths.box([(s.x0+s.x1)/2,.03,(s.z0+s.z1)/2],[s.x1-s.x0,.06,s.z1-s.z0],C.paving,{kind:'stone'});
    if(!s.joints)continue;
    for(let z=s.z0+s.joints;z<s.z1-.1;z+=s.joints)box(root,[(s.x0+s.x1)/2,.062,z],[s.x1-s.x0,.006,.05],C.stoneDark);
    for(let x=s.x0+s.joints;x<s.x1-.1;x+=s.joints)box(root,[x,.062,(s.z0+s.z1)/2],[.05,.006,s.z1-s.z0],C.stoneDark);
  }
  const av=garden.avenue;
  paths.box([(av.x0+av.x1)/2,.068,(av.z0+av.z1)/2],[av.x1-av.x0,.02,av.z1-av.z0],'#b3ad9c',{kind:'stone'});
  for(const x of [av.x0,av.x1])paths.box([x,.08,(av.z0+av.z1)/2],[.14,.04,av.z1-av.z0],GRANITE,{kind:'stone',bevel:.015});
  paths.build(root,'paving');
  // Winding flagstone trails across the lawns: a stone every 0.7 m, each a little off the line, each
  // stretch named as a path.
  garden.trails.forEach((t,ti)=>{
    for(let k=0;k+1<t.points.length;k++){
      const [ax,az]=t.points[k],[bx,bz]=t.points[k+1],n=Math.max(1,Math.round(Math.hypot(bx-ax,bz-az)/.7)),flags=natureKit(models.painted,{jitter:.12});
      for(let i=0;i<n;i++){
        const u=(i+.5)/n,j=ti*97+k*13+i,w=t.width*(.8+jitter(j)*.25);
        flags.add(flag(w/2,w*(.75+jitter(j,4)*.2)/2,.07,j),[ax+(bx-ax)*u+jitter(j,2)*.25,0,az+(bz-az)*u+jitter(j,3)*.25],[0,jitter(j,5)*90,0],C.flagstone,'stone');
      }
      flags.build(root,'path',{look:'path'});
    }
  });

  // The pond and the stream, edged with stones except where a bridge, a crossing or the stream meets them.
  for(const s of garden.pond)sheet(s,level,.04,pond);
  for(const s of garden.stream)sheet(s,level+.005,.04,stream(s.flow));
  sheet(garden.streamMouth,level+.005,.04,stream(garden.streamMouth.flow));   // where the stream runs into the pond
  const ws=garden.waterside,is=garden.island,crossed=crossingFootprint(garden,0),landings=crossingFootprint(garden,.3);
  // A thrown thing floats on the water and it laps at the bank; the island, the bridges, the
  // crossings and the waterside pavilion stand in it, dry.
  const dry=(x,z)=>inShape(is,x,z)||(x>ws.x0&&x<ws.x1&&z>ws.z0&&z<ws.z1)||inAny(crossed,x,z)
    ||garden.bridges.some(b=>Math.abs(x-b.x)<b.width/2&&z>b.steps[0][0]&&z<b.steps.at(-1)[1]);
  water.body('town',[...garden.pond,...garden.stream,garden.streamMouth],level+.02,dry);
  const landing=(x,z)=>garden.bridges.some(b=>Math.abs(x-b.x)<b.width/2+.3&&z>b.steps[0][0]-.3&&z<b.steps.at(-1)[1]+.3)
    ||(x>ws.x0-.3&&x<ws.x1+.3&&z>ws.z0-.3&&z<ws.z1+.3)||inAny(landings,x,z);
  const skip=garden.shoreStonesSkip;
  const stones=[...shoreline(garden.pond,1.5,(x,z)=>landing(x,z)||inAny(skip.pond,x,z)),
    ...shoreline(garden.stream,1.5,(x,z)=>landing(x,z)||inAny(skip.stream,x,z))];
  stones.forEach((p,i)=>{
    const k=natureKit(models.painted,{jitter:.1});
    k.add(blob([.5,.17,.36],i+11,{lump:.2,flat:.5,under:.75}),[p.x,.12,p.z],[0,-p.angle*DEG,0],i%2?C.stone:C.stoneDark,'stone');
    k.build(root,'stone',{look:'stone',shadows:true});
  });

  // Lotus leaves, some notched and some held up out of the water, and flowers of pink petals round
  // a gold heart; koi breaking the surface.
  // The pads, flowers and koi are named by their marks (src/core/garden.js), which sit where they float.
  garden.lotus.forEach((l,i)=>{
    cylinder(root,[l.x,level+.04,l.z],[.95,.03,.95],i%3?C.pad:C.padLight);
    if(i%2)box(root,[l.x+.3,level+.05,l.z+.05],[.36,.04,.1],'#79aaa8',[0,i*40,0]);   // the notch, in water colour
    if(i%4===1)cylinder(root,[l.x-.3,level+.3,l.z-.2],[.5,.03,.5],C.padLight,[12,0,8]).lookName='lotus-leaf';   // a leaf held up on its stalk
    if(!l.flower)return;
    const f=new pc.Entity('lotus');f.setLocalPosition(l.x+.12,level+.08,l.z+.08);root.addChild(f);
    cylinder(f,[0,.08,0],[.04,.16,.04],C.pad);
    for(let k=0;k<6;k++){
      const a=k/6*Math.PI*2;
      box(f,[Math.cos(a)*.1,.22,Math.sin(a)*.1],[.1,.2,.05],k%2?C.lotus:C.lotusDeep,[0,-a*DEG+90,k%2?-24:-34]);
    }
    box(f,[0,.24,0],[.1,.08,.1],C.gold);
  });
  for(const k of garden.koi)shape(root,'sphere',[k.x,level+.03,k.z],[.5,.08,.22],k.color,[0,k.rot,0]);

  // The island: a stone drum with a low balustrade, open where the two bridges land.
  natureKit(models.painted).turn([is.x,0,is.z],[[is.r,0],[is.r,is.top],[is.r,is.top],[0,is.top]],C.stone,{kind:'stone',seg:28,ground:.15}).build(root,'stone',{look:'stone',shadows:true});
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
  for(const b of garden.bridges)stoneBridge(root,b,b.flat?C.timber:C.vermilion,b.flat?C.timberDark:C.railRed,'wood');

  // The 九曲桥 zigzags low over the west of the pond on stone piers, with low vermilion railings
  // along its sides; the stepping stones cross the stream below the rockery.
  for(const c of garden.crossings){
    const L=crossingLayout(c),n=c.points.length-1;
    if(c.stones){
      const [[ax,az],[bx,bz]]=c.points;
      // Rounded boulders, their tops just where the stone you step on is.
      for(let i=0;i<c.stones;i++){
        const u=i/(c.stones-1),h=i===0||i===c.stones-1?c.step:c.top;
        const k=natureKit(models.painted,{jitter:.1});
        k.add(blob([.475,(h+.12)/2,.41],i+71,{lump:.14,flat:0,under:.75}),[ax+(bx-ax)*u+jitter(i,7)*.06,h/2-.06,az+(bz-az)*u+jitter(i,8)*.12],[0,i*37,0],i%2?C.stone:C.stoneDark,'stone');
        k.build(root,'stone',{look:'stone',shadows:true});
      }
      continue;
    }
    const g=new pc.Entity(c.id);g.lookName=c.name;root.addChild(g);
    const slabs=natureKit(models.painted,{jitter:.06});
    for(const s of L.deck)slabs.box([(s.x0+s.x1)/2,c.top-.12,(s.z0+s.z1)/2],[s.x1-s.x0,.24,s.z1-s.z0],C.slab,{kind:'stone',bevel:.02});
    for(const s of L.steps)slabs.box([(s.x0+s.x1)/2,c.step-.12,(s.z0+s.z1)/2],[s.x1-s.x0,.24,s.z1-s.z0],C.slab,{kind:'stone',bevel:.02});
    for(const [x,z] of c.points.slice(1,-1))slabs.box([x,(c.top-.2)/2,z],[c.width-.4,c.top-.2,c.width-.4],C.stoneDark,{kind:'stone',bevel:.03,ground:.2});
    slabs.build(g,c.id,{shadows:true});
    L.guards.forEach((s,k)=>{
      // A rail stops where the deck gives way to the step onto the bank.
      const i=k%n,alongX=s.x1-s.x0>s.z1-s.z0,r={...s},[p,q]=[c.points[i],c.points[i+1]];
      const lo=alongX?'x0':'z0',hi=alongX?'x1':'z1',forward=alongX?q[0]>p[0]:q[1]>p[1];
      if(i===0){if(forward)r[lo]+=c.ends;else r[hi]-=c.ends;}
      if(i===n-1){if(forward)r[hi]-=c.ends;else r[lo]+=c.ends;}
      const cx=(r.x0+r.x1)/2,cz=(r.z0+r.z1)/2,len=alongX?r.x1-r.x0:r.z1-r.z0;
      const rail=natureKit(models.painted,{jitter:.05});
      rail.box([cx,c.top+.55,cz],alongX?[len,.08,.08]:[.08,.08,len],C.railRed,{kind:'wood',bevel:.012});
      for(let a=0,m=Math.max(1,Math.round(len/1.7));a<=m;a++){
        const t=a/m-.5;
        rail.box([alongX?cx+t*len:cx,c.top+.28,alongX?cz:cz+t*len],[.1,.56,.1],C.vermilion,{kind:'wood',bevel:.015});
      }
      rail.build(g,'railing',{look:'railing'});
    });
  }

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

  // The rockery 假山 in the south-west: weathered rock heaped up round the waterfall, moss in its
  // folds and a little pine rooted on its top, with water falling into the stream.
  const wf=garden.waterfall;
  wf.rocks.forEach((r,i)=>{
    const heap=new pc.Entity(r.name??'waterfall');heap.lookName=r.name??'waterfall';root.addChild(heap);
    // Weathered stone stacked in tilted slabs that narrow as they climb, a rounded boulder at the
    // foot and moss in the folds.
    const tiers=r.h>2?4:3,k3=natureKit(models.painted,{jitter:.1});
    for(let k=0;k<tiers;k++){
      const f=1-k/tiers*.55,y=r.h*k/tiers,th=r.h/tiers*1.15,j=i*5+k;
      k3.box([r.x+jitter(j,13)*r.r*.35,y+th/2,r.z+jitter(j,14)*r.r*.3],[r.r*1.9*f,th,r.r*1.6*f],k%2?C.rock:C.rockLight,
        {kind:'stone',bevel:Math.min(.12,th*.2),rot:[jitter(j,15)*14,i*41+k*33,jitter(j,16)*16]});
    }
    k3.add(blob([r.r*.45,r.h*.2,r.r*.4],i+31,{lump:.22,flat:.4,under:.72}),[r.x-r.r*.4,r.h*.25,r.z+r.r*.3],null,C.rock,'stone');
    if(r.name)k3.add(blob([.28,.15,.23],i+41,{lump:.3,flat:.6}),[r.x+r.r*.3,r.h*.72,r.z-r.r*.35],null,C.moss,'soft');
    k3.build(heap,heap.name,{shadows:true});
  });
  const peak=wf.rocks.reduce((a,r)=>r.h>a.h?r:a);
  const perch=new pc.Entity('pine');perch.lookName='pine';perch.setLocalPosition(peak.x,peak.h*.9,peak.z);perch.setLocalScale(.45,.45,.45);root.addChild(perch);
  buildTree(models.painted,perch,'pine',peak.x*3+peak.z);
  wet(box(root,[wf.x,wf.top/2,wf.z],[1.1,wf.top,.14],'#79aaa8'),water.surface({flow:[0,1.4],tile:1.6,fall:true}));
  ball(root,[wf.x,level+.1,wf.z-.35],[1.5,.35,.9],C.foam);

  // The mill house and its wheel, which turns in the stream on an axle from the wall.
  const {house,wheel}=garden.mill;
  box(root,[house.x,house.height/2,house.z],[house.width,house.height,house.depth],C.plaster);
  box(root,[house.x,.25,house.z],[house.width+.1,.5,house.depth+.1],C.stoneDark);
  for(const side of [-1,1])box(root,[house.x+side*house.width/4,house.height+.45,house.z],[house.width/2+.35,.14,house.depth+.5],C.coping,[0,0,-side*28]);
  box(root,[house.x,house.height+.9,house.z],[.2,.16,house.depth+.51],C.ridge);
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

  // Planting: sculpted pines with cloud-pruned pads, plum and peach in flower, bamboo, and rocks.
  // All drawn in the Jiangnan look (src/world/jiangnan-nature.js).
  garden.pines.forEach((t,i)=>{
    const e=new pc.Entity('pine');e.lookName='pine';e.setLocalPosition(t.x,0,t.z);e.setLocalScale(t.size,t.size,t.size);e.setLocalEulerAngles(0,i*67,0);root.addChild(e);
    buildTree(models.painted,e,'pine',t.x*5+t.z*3);
  });
  garden.blossoms.forEach((t,i)=>{
    const e=new pc.Entity(t.kind??'tree');e.lookName=t.kind??'tree';e.setLocalPosition(t.x,0,t.z);e.setLocalEulerAngles(0,i*47,0);root.addChild(e);
    buildTree(models.painted,e,BLOSSOM[t.kind]?t.kind:'peach',t.x*5+t.z*3);
  });
  for(const r of garden.rocks)rockery(root,r);
  // Bamboo: culms with darker nodes and sprays of pointed leaves up their top half.
  garden.bamboo.forEach((b,i)=>{
    const clump=new pc.Entity('bamboo');clump.lookName='bamboo';clump.setLocalPosition(b.x,0,b.z);root.addChild(clump);
    buildBamboo(models.painted,clump,b.r,i+1,7);
  });

  // Lanterns on timber posts, lit after dark, all one lit material so they draw together; timber
  // benches facing the water, the lawns and the forecourt.
  const lit=glow('#e8a071');lamps.push(lit);
  for(const l of garden.lanterns){
    // A post with a bracket arm at its top; the lantern hangs from the arm's end.
    cylinder(root,[l.x,1.3,l.z],[.14,2.6,.14],C.timberDark);
    box(root,[l.x+LANTERN_ARM/2,2.55,l.z],[LANTERN_ARM+.1,.08,.08],C.timberDark);
    const g=new pc.Entity('lantern');g.lookName='lantern';root.addChild(g);
    const x=l.x+LANTERN_ARM,y=1.95;
    cylinder(g,[x,y+.35,l.z],[.035,.6,.035],'#715945');
    ball(g,[x,y,l.z],[.4,.5,.4],'#d48a66').render.meshInstances[0].material=lit;
    cylinder(g,[x,y-.31,l.z],[.045,.25,.045],'#e0b86a');
  }
  for(const b of garden.benches){
    const e=pivot(b.x,0,b.z,b.rot??0);e.lookName='bench';
    box(e,[0,.45,0],[1.6,.1,.5],C.timber);box(e,[0,.78,-.22],[1.6,.36,.08],C.timber);
    for(const x of [-.65,.65])box(e,[x,.2,0],[.12,.4,.46],C.stoneDark);
  }

  // Raised flowerbeds 花坛: a stone kerb round dark soil, leaves, and blocky flowers in mixed colours.
  garden.flowerbeds.forEach((f,i)=>{
    const bed=new pc.Entity('flowerbed');bed.lookName='flowerbed';bed.setLocalPosition(f.x,0,f.z);root.addChild(bed);
    // Little flowers on short stems in drifts of colour over a mound of leaves (fewer on 低).
    buildFlowerbed(models.painted,bed,f.r,[0,1,2].map(k=>FLOWERS[(i+k)%FLOWERS.length]),i+1);
  });

  // Stone tables with drum stools; a xiangqi board on the first, as the old men play every day.
  garden.stoneTables.forEach((t,i)=>{
    const g=new pc.Entity('stone-table');g.lookName='stone-table';root.addChild(g);
    cylinder(g,[t.x,.35,t.z],[.5,.7,.5],C.stoneDark);
    cylinder(g,[t.x,.74,t.z],[1.1,.08,1.1],C.stone);
    if(i===0){
      box(g,[t.x,.79,t.z],[.62,.02,.68],'#e6cf9e');
      for(const [dx,dz,c] of [[-.18,-.22,'#b8453a'],[.1,-.25,'#b8453a'],[-.05,-.05,'#b8453a'],[.2,.2,'#2f3238'],[-.15,.24,'#2f3238'],[.05,.08,'#2f3238']])
        cylinder(g,[t.x+dx,.81,t.z+dz],[.07,.03,.07],c);
    }
    for(const [dx,dz] of t.stools){
      const s=new pc.Entity('stone-stool');s.lookName='stone-stool';root.addChild(s);
      cylinder(s,[t.x+dx,.21,t.z+dz],[.44,.42,.44],C.stone);
      cylinder(s,[t.x+dx,.43,t.z+dz],[.4,.04,.4],C.stoneDark);
    }
  });

  // White walls with grey tile coping close the park on three sides.
  const H=garden.wallHeight;
  for(const w of garden.walls){
    const cx=(w.x0+w.x1)/2,cz=(w.z0+w.z1)/2,dx=w.x1-w.x0,dz=w.z1-w.z0,alongX=dx>dz;
    // Painted lime plaster, darker towards its foot, under a coping of dark tile.
    const body=natureKit(models.painted,{jitter:.03}),cap=natureKit(models.painted,{jitter:.05});
    body.box([cx,H/2,cz],[dx,H,dz],C.plaster,{kind:'plaster',bevel:.02,ground:.14});
    cap.box([cx,H+.08,cz],alongX?[dx+.3,.16,dz+.35]:[dx+.35,.16,dz+.3],C.coping,{kind:'tile',bevel:.03});
    cap.box([cx,H+.22,cz],alongX?[dx,.12,.16]:[.16,.12,dz],C.ridge,{kind:'tile',bevel:.02});
    body.build(root,'wall',{shadows:true});cap.build(root,'wall',{look:'wall',shadows:true});
  }
  buildGate();

  /**
   * The town gate, where every traveller comes in: vermilion columns on stone drums, a green and
   * gold plaque with the park's name between two beams, the welcome board hanging below it with a
   * red lantern either side, a tiled roof with upturned eaves, plastered piers out to the wall and
   * the doors folded back against it. The road runs off south between the hills.
   */
  function buildGate(){
    const gt=garden.gate,L=gateLayout(gt),x=gt.x,z=gt.z,Hc=gt.height,span=gt.opening/2+.3;
    const g=new pc.Entity('town-gate');g.lookName='paifang';root.addChild(g);
    for(const c of L.columns){
      cylinder(g,[c.x,.3,z],[.86,.6,.86],C.stoneDark);
      cylinder(g,[c.x,.64,z],[.72,.08,.72],C.stone);
      cylinder(g,[c.x,Hc/2,z],[.56,Hc,.56],C.vermilion);
    }
    for(const p of L.piers){
      const cx=(p.x0+p.x1)/2,w=p.x1-p.x0,ph=H+.4;
      box(g,[cx,ph/2,z],[w,ph,.62],C.plaster);
      box(g,[cx,ph+.09,z],[w+.2,.18,.95],C.coping);
    }
    const bw=span*2+1.4;
    box(g,[x,4.07,z],[bw,.3,.46],C.vermilion);                      // the beam under the plaque
    box(g,[x,5.18,z],[bw+.4,.3,.5],C.vermilion);                    // the beam over it
    for(const y of [4.24,5.01])box(g,[x,y,z],[bw-.2,.04,.5],C.gold);
    for(let bx=-bw/2+.25;bx<bw/2-.2;bx+=.45)box(g,[x+bx,5.42,z],[.2,.18,.62],C.goldDeep);   // brackets
    tiledRoof(g,x,z,bw-.2,.9,5.5,'#5d7360',3);
    label(g,gt.plaque,[x,4.63,z],3.4,.74,'#3d4f47','#e8c46a');
    // The welcome board hangs on two cords under the beam, well above your head.
    for(const s of [-1,1])cylinder(g,[x+s*1.3,3.87,z],[.03,.3,.03],'#715945');
    label(g,gt.welcome,[x,3.46,z],3.1,.52);
    for(const s of [-1,1])sceneryLantern(g,x+s*(span-.75),3.25,z,lamps);
    // The doors, folded back flat against the inner face of the piers and the wall, studded in gold.
    for(const l of L.leaves){
      const cx=(l.x0+l.x1)/2,cz=(l.z0+l.z1)/2,w=l.x1-l.x0,door=new pc.Entity('door');door.lookName='door';g.addChild(door);
      box(door,[cx,1.6,cz],[w,3.2,l.z1-l.z0],'#9a3f32');
      for(let r=0;r<3;r++)for(let k=0;k<4;k++)box(door,[cx-w/2+.5+k*(w-1)/3,.9+r*.8,l.z0-.02],[.09,.09,.05],C.gold);
    }
    // Outside, the road the traveller came in by, running off south between the hills.
    const rd=gt.road,from=z+.25;
    box(root,[x,.02,(from+rd.to)/2],[rd.width,.05,rd.to-from],C.paving);
    for(const s of [-1,1])box(root,[x+s*(rd.width/2+.15),.06,(from+rd.to)/2],[.3,.12,rd.to-from],C.stoneDark);
  }

  const life=buildLife(models,root,lamps,town);
  // The wheel turns but never comes or goes, so it rides in the life's batch: one draw call, not one a paddle.
  life.entities.push(wheelRoot);
  // Its look box is the whole turning circle (paddles reach R + .25), not its bounds at one moment.
  const reach=wheel.radius+.25;
  life.looks.push({entity:wheelRoot,name:'watermill',x:wheel.x,z:wheel.z,hw:reach,hd:wheel.thickness/2+.1,y0:wheel.y-reach,y1:wheel.y+reach});
  return {marks:gardenMarks(garden),root,wheel:wheelRoot,life};
}

/**
 * Who is in the park, and when (garden.json `life`): tai chi on the paved circle in the morning, two
 * old men at xiangqi at the stone table with a third watching, someone writing 地书 with water on the
 * paving, a kite flyer on the west lawn, ducks paddling on the pond, butterflies over the flowerbeds
 * by day and fireflies after dark. Everything here moves, so each part is `noBatch`: town.js puts them
 * in one dynamic batch, gives the people a hitbox and a name, and names the animals by their meshes
 * within the region they roam (`looks`). People only move their limbs near the tourist (RENDER
 * `animate`); on 低 there are fewer butterflies and fireflies.
 */
function buildLife(models,root,lamps,town){
  const {person,box,ball,cylinder,glow}=models,L=garden.life,low=detail()==='low';
  const app=pc.AppBase.getApplication(),level=garden.water.level;
  const people=[],looks=[],entities=[];
  const during=(from,to)=>h=>from<to?h>=from&&h<to:h>=from||h<to;
  // `look` is who they are (garden.json: a people.json archetype, colour, hair or hat), hands free.
  const add=(color,x,z,rot,name,when,act,look,y=0)=>{
    const one=person(root,color,[x,y,z],false,undefined,look);
    one.entity.setLocalEulerAngles(0,rot,0);initIdle(one,Math.random());
    // The tai chi group moves as one; everyone else keeps their own time.
    Object.assign(one,{x,z,y,rot,name,when,act,phase:name==='taiji'?0:Math.random()*20});
    people.push(one);entities.push(one.entity);
    return one;
  };

  // Tai chi: the group follows the teacher through the same slow form, turning at the waist and
  // raising and lowering their arms, sinking a little into the knees as the arms come down.
  const tai=L.taichi,taiWhen=during(tai.from,tai.to);
  tai.people.forEach(([x,z,rot],i)=>add(i?'#f0ede4':'#b8453a',x,z,rot,'taiji',taiWhen,(one,t)=>{
    const k=(t*2*Math.PI)/9,raise=.5-.5*Math.cos(k),turn=Math.sin(k/2)*22;
    one.entity.setLocalEulerAngles(0,one.rot+turn,0);
    one.entity.setLocalPosition(one.x,-raise*.05,one.z);
    // A positive turn swings a limb backwards (people face +z), so arms raised in front are negative.
    one.arms.forEach((arm,s)=>arm.setLocalEulerAngles(-(8+raise*72),0,(s?-1:1)*(6+raise*10)));
    one.legs.forEach((leg,s)=>leg.setLocalEulerAngles((s?-1:1)*4*raise,0,(s?-1:1)*5));
  },tai.looks?.[i]));

  // Xiangqi: two players on the stools either side of the board, one thinking and one moving a
  // piece now and then, and a neighbour standing behind to watch.
  const xq=L.xiangqi,table=garden.stoneTables[xq.table],xqWhen=during(xq.from,xq.to),stoolTop=.45;
  xq.players.forEach(([dx,dz,rot],i)=>{
    const one=add(i?'#6f8f6a':'#8c6a52',table.x+dx,table.z+dz,rot,'xiangqi',xqWhen,(one,t)=>{
      const beat=(t+i*4.5)%9,reach=beat<1.2?Math.sin(beat/1.2*Math.PI):0;
      // Hands on the board, one reaching across now and then to move a piece.
      one.arms.forEach((arm,s)=>arm.setLocalEulerAngles(-(one.armRest+(s===0?reach*18:0)),0,s?-6:6));
    },xq.looks?.[i]);
    one.y=stoolTop-one.seatDrop;one.entity.setLocalPosition(one.x,one.y,one.z);   // hips on the stool
    one.group='stone-table:'+xq.table;one.seated=true;
    one.sit(stoolTop,{table:.8});   // thighs level, feet on the paving, hands on the board (src/world/people.js)
  });
  {
    const [dx,dz,rot]=xq.watcher;
    const one=add('#9aa8b5',table.x+dx,table.z+dz,rot,'xiangqi',xqWhen,(one,t)=>{
      one.arms.forEach((arm,s)=>arm.setLocalEulerAngles(12+Math.sin(t*.5)*2,0,s?-18:18));   // hands behind the back
    },xq.looks?.[2]);
    one.group='stone-table:'+xq.table;
  }

  // 地书: a long brush dipped in water, the characters drying on the stone as they are written.
  const cal=L.calligraphy;
  const writer=add('#d6c8a8',cal.x,cal.z,cal.rot,'dishu',during(cal.from,cal.to),(one,t)=>{
    const sweep=Math.sin(t*1.6),lift=Math.max(0,Math.sin(t*.8));
    one.arms[1].setLocalEulerAngles(-(52+lift*8),0,-8+sweep*12);
    one.arms[0].setLocalEulerAngles(-4,0,6);
  },cal.look);
  // The brush runs on from the hand, nearly along the arm held out in front, down to the stone.
  const brush=new pc.Entity('brush');writer.arms[1].hang.addChild(brush);   // in the arm's hanging frame, as its hand is
  cylinder(brush,[0,-1.22,-.085],[.05,1.27,.05],'#8a6a4c',[7.6,0,0]);
  ball(brush,[0,-1.85,-.17],[.12,.16,.12],'#e8e2d4');
  // It sweeps out past the writer's own box: a box of its own round the reach in front.
  looks.push({entity:brush,name:'brush',x:cal.x+Math.sin(cal.rot/DEG)*1.1,z:cal.z+Math.cos(cal.rot/DEG)*1.1,hw:1.1,hd:1.1,y0:-.3,y1:1.7});   // its tip dips to the stone
  // The wet strokes: dark on the paving in front, three characters' worth, written left to right.
  const ink=new pc.Entity('dishu');ink.lookName='dishu';root.addChild(ink);
  const face=cal.rot/DEG,fx=Math.sin(face),fz=Math.cos(face);
  for(let c=0;c<3;c++)for(let s=0;s<5;s++){
    const along=(c-1)*.75+jitter(c*7+s,9)*.3,out=1.35+jitter(c*7+s,10)*.35,alongX=(c+s)%2===0;
    box(ink,[cal.x+fx*out-fz*along,.065,cal.z+fz*out+fx*along],alongX?[.42,.01,.06]:[.06,.01,.4],'#8d8672',[0,cal.rot+jitter(c*7+s,11)*40,0]);
  }

  // The kite flyer, one hand up on the line; the kite rides the wind high over the lawn.
  const K=L.kite,kiteWhen=during(K.from,K.to);
  const [sx,sy,sz]=K.sky,flyer=add('#c9a06d',K.x,K.z,Math.atan2(sx-K.x,sz-K.z)*DEG,'kite',kiteWhen,(one,t)=>{
    one.arms[1].setLocalEulerAngles(-(150+Math.sin(t*1.3)*6),0,-8);
    one.arms[0].setLocalEulerAngles(-20,0,10);
  },K.look);
  const kite=new pc.Entity('kite');kite.noBatch=true;kite.lookName='kite';root.addChild(kite);
  const sail=new pc.Entity('sail');kite.addChild(sail);
  box(sail,[0,0,0],[1.1,1.1,.04],'#d9483a',[0,0,45]);
  box(sail,[0,0,.03],[.55,.55,.02],'#f2c94c',[0,0,45]);
  box(sail,[0,0,.05],[.05,1.5,.03],'#6e533b');box(sail,[0,.12,.05],[1.5,.05,.03],'#6e533b');
  for(let k=0;k<4;k++)box(sail,[jitter(k,12)*.2,-.95-k*.42,0],[.22,.1,.02],k%2?'#f2c94c':'#d9483a',[0,0,k*30]);
  const line=new pc.Entity('kite-line');line.noBatch=true;line.lookName='kite';root.addChild(line);
  box(line,[0,0,-.5],[.015,.015,1],'#efe9dc');   // along −z, which lookAt turns to the kite
  entities.push(kite,line);
  looks.push({entity:kite,name:'kite',x:sx,z:sz,hw:3,hd:3,y0:sy-3,y1:sy+3});
  // The line, from the flyer's raised hand up to the kite.
  looks.push({entity:line,name:'kite',x:(K.x+sx)/2,z:(K.z+sz)/2,hw:Math.abs(sx-K.x)/2+1,hd:Math.abs(sz-K.z)/2+1,y0:1,y1:sy+1});
  const hand=new pc.Vec3(),sky=new pc.Vec3(),up=new pc.Vec3(0,1,0);

  // Ducks: a body, a raised tail, a green head and an orange bill, each paddling its own circle.
  const ducks=L.ducks.map((d,i)=>{
    const e=new pc.Entity('duck');e.noBatch=true;e.lookName='duck';root.addChild(e);
    ball(e,[0,.12,0],[.5,.26,.34],i%2?'#8a6a4c':'#f0ede4');
    box(e,[0,.2,-.26],[.18,.12,.12],i%2?'#6e533b':'#e6e0d2',[-30,0,0]);
    ball(e,[0,.34,.2],[.2,.2,.2],i%2?'#8a6a4c':'#3f6b4a');
    box(e,[0,.32,.33],[.08,.05,.12],'#e59a3a');
    entities.push(e);
    looks.push({entity:e,name:'duck',x:d.x,z:d.z,hw:d.r+.4,hd:d.r+.4,y0:level-.1,y1:level+.6});
    return {...d,e,a:i*2.1};
  });

  // Butterflies over the flowerbeds by day: a body and two wings, flapping.
  const beds=garden.flowerbeds,flutter=[],flies=[];
  const butterflies=new pc.Entity('butterflies');root.addChild(butterflies);
  for(let i=0;i<(low?Math.ceil(L.butterflies/2):L.butterflies);i++){
    const bed=beds[i%beds.length],e=new pc.Entity('butterfly');e.noBatch=true;e.lookName='butterfly';butterflies.addChild(e);
    const color=['#f4f0e6','#f2c94c','#e98b4a','#9fc3e6'][i%4];
    box(e,[0,0,0],[.03,.03,.14],'#3b3a35');
    const wings=[-1,1].map(s=>{const w=new pc.Entity('wing');e.addChild(w);box(w,[s*.09,0,0],[.16,.01,.14],color);return {w,s};});
    entities.push(e);flutter.push({e,wings,bed,phase:i*1.7});
    looks.push({entity:e,name:'butterfly',x:bed.x,z:bed.z,hw:bed.r+1.2,hd:bed.r+1.2,y0:.4,y1:2});
  }

  // Fireflies after dark: tiny lit specks drifting low over the water, the stream and the bamboo.
  const fireflies=new pc.Entity('fireflies');fireflies.enabled=false;root.addChild(fireflies);
  const spark=glow('#e8f27a');lamps.push(spark);
  const areas=L.fireflies.areas,count=low?Math.ceil(L.fireflies.count/2):L.fireflies.count;
  for(let i=0;i<count;i++){
    const a=areas[i%areas.length],e=new pc.Entity('firefly');e.noBatch=true;fireflies.addChild(e);
    ball(e,[0,0,0],[.15,.15,.15],'#e8f27a').render.meshInstances[0].material=spark;
    entities.push(e);
    flies.push({e,x:a.x0+(a.x1-a.x0)*(.5+jitter(i,20)),z:a.z0+(a.z1-a.z0)*(.5+jitter(i,21)),y:.6+Math.abs(jitter(i,22))*1.4,phase:i*.83});
  }
  for(const a of areas)looks.push({entity:fireflies,name:'firefly',x:(a.x0+a.x1)/2,z:(a.z0+a.z1)/2,hw:(a.x1-a.x0)/2+1,hd:(a.z1-a.z0)/2+1,y0:.2,y1:2.6});

  let clock=0;
  app.on('update',dt=>{
    if(!root.enabled||town?.place!=='town')return;
    dt=Math.min(dt,.05);clock+=dt;
    // Who is out: a person out of hours is gone, and so is their hitbox; fireflies come out after
    // dark and the butterflies go. Only a change touches the entities (and remakes their batch).
    const hour=town.daylight?.hour??15,night=(town.daylight?.state?.lamps??0)>.5;
    for(const one of people){
      const on=one.when(hour);
      if(one.entity.enabled!==on){one.entity.enabled=on;if(one.box)one.box.solid=on;}
    }
    if(kite.enabled!==flyer.entity.enabled)kite.enabled=line.enabled=flyer.entity.enabled;
    if(fireflies.enabled!==night)fireflies.enabled=night;
    if(butterflies.enabled===night)butterflies.enabled=!night;
    const eye=town.player?.entity.getPosition(),reach=RENDER[detail()].animate;
    for(const one of people){
      if(!one.entity.enabled||(eye&&Math.abs(one.x-eye.x)+Math.abs(one.z-eye.z)>reach))continue;
      one.act(one,clock+one.phase,dt);animateIdle(one,dt,true);
    }
    for(const d of ducks){
      d.a+=dt*d.speed;
      const x=d.x+Math.cos(d.a)*d.r,z=d.z+Math.sin(d.a)*d.r;
      d.e.setLocalPosition(x,level+Math.sin(clock*2+d.a*3)*.015,z);
      d.e.setLocalEulerAngles(0,(d.speed>0?-d.a:Math.PI-d.a)*DEG,0);
    }
    if(butterflies.enabled)for(const b of flutter){
      const t=clock+b.phase;
      b.e.setLocalPosition(b.bed.x+Math.cos(t*.7)*(b.bed.r+.5)+Math.sin(t*1.9)*.3,.95+Math.sin(t*1.3)*.3,b.bed.z+Math.sin(t*.9)*(b.bed.r+.4));
      b.e.setLocalEulerAngles(0,-t*.7*DEG,0);
      for(const {w,s} of b.wings)w.setLocalEulerAngles(0,0,s*Math.sin(t*16)*55);
    }
    if(fireflies.enabled)for(const f of flies){
      const t=clock*.35+f.phase,glowAt=.5+.5*Math.sin(clock*2.2+f.phase*3);
      f.e.setLocalPosition(f.x+Math.sin(t)*1.2,f.y+Math.sin(t*1.7)*.25,f.z+Math.cos(t*.8)*1.2);
      const s=.4+glowAt*.9;f.e.setLocalScale(s,s,s);
    }
    if(kite.enabled){
      kite.setLocalPosition(sx+Math.sin(clock*.45)*1.6,sy+Math.sin(clock*.7)*.9,sz+Math.cos(clock*.35)*1.1);
      sail.setLocalEulerAngles(-25+Math.sin(clock*.9)*6,Math.sin(clock*.6)*10,Math.sin(clock*1.1)*12);
      // The line runs from the flyer's raised hand to the kite.
      hand.copy(flyer.arms[1].hand.getPosition());sky.copy(kite.getPosition());
      line.setPosition(hand);line.lookAt(sky,up);line.setLocalScale(1,1,hand.distance(sky));
    }
  });
  return {people,looks,entities};
}
