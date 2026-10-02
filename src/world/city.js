import * as pc from 'playcanvas';
import city from '../content/city.json' with {type:'json'};
import drones from '../content/drones.json' with {type:'json'};
import {clockText} from './daylight.js';
import {createLeds,random,GLAZING} from './leds.js';
import {detail} from '../core/quality.js';
import {reflect} from './bay.js';
import {promenadeZ,towerTiers} from '../core/city.js';

/**
 * 云海市中心 — the city at the other end of the metro line, redone after a night walk round
 * Shenzhen Bay.
 *
 * The town is timber, tile and paint at the scale of a person. This is meant to read as the
 * opposite of that from the first glance: glass towers too tall to see the top of, a two-lane road
 * between wide pavements, signs that are lit rather than painted, and at the end of the avenue a
 * curving promenade along the bay with a dense skyline across the water. By day it is calm glass
 * and stone; after dark the façades come alive with light running along bands and up corners,
 * crowns washing through the colours and big lit characters (src/world/leds.js), every one of
 * them a lamp of the daylight system.
 *
 * Technically it is a *place*, the same kind of thing an interior is: built once, far from the
 * town's own coordinates, and swapped in wholesale when you arrive. It is built lazily, on the
 * first ride, so the opening scene stays as quick to load as it was. The bay, the hill to the west
 * and what happens on and over them are bay.js, hill.js, hotpot.js, drones.js and crowd.js, which
 * town.ensureCity calls once this has been built.
 */
export const CITY=city;
export const CITY_OFFSET=-4000;

/** A sign in a city is backlit: it reads at midnight as well as at noon. */
function backlight(entity,strength=.85){
  const material=entity.render.meshInstances[0].material;
  material.emissive.set(strength,strength,strength);
  material.update();
  return entity;
}

/**
 * A hitbox given in a prop's or tower's own frame, in city-local metres. Quarter turns only: the
 * registry's boxes are axis aligned, so a quarter turn swaps their sides. `face` is the way the
 * thing faces (a bench: the way you sit), for anyone who needs it.
 */
function turn(def,{x=0,z=0,hw,hd,y0=0,y1,name=def.name??null,solid}){
  const r=(def.rot??0)*Math.PI/180,c=Math.round(Math.cos(r)),s=Math.round(Math.sin(r));
  return {x:def.x+x*c+z*s,z:def.z-x*s+z*c,hw:s?hd:hw,hd:s?hw:hd,y0,y1,name,solid,face:def.rot??0};
}

/** The skyline's and the backdrop's colours: the same few as downtown's, so they share materials. */
const BODY=['#2c3d4b','#3a3342','#2d3340'],GLASS=['#7fa3b8','#9aabb8','#a597c4'];

/**
 * A glass tower across the bay with its front on local +z: a dark frame with lit floors behind the
 * glass (warm, cool, and about one floor in four dark) and whatever LEDs city.json asks for. It
 * casts no shadow; its lights are drawn heavier (`k`), so they still read from the near shore.
 */
function glassTower(models,leds,parent,def,seed=1){
  const {box}=models,{w,d,h}=def,L=def.leds??{},next=random(seed),k=2.4;
  const root=new pc.Entity('tower');root.setLocalPosition(def.x,0,def.z);
  root.setLocalEulerAngles(0,def.rot??0,0);parent.addChild(root);
  box(root,[0,h/2,0],[w,h,d],def.color).render.castShadows=false;
  const [warm,cool]=leds.windows(def.glass);
  for(let y=2.6;y<h-1.8;y+=3.2){
    const roll=next();
    if(roll>.25)leds.piece(root,[0,y,0],[w+.12,2,d+.12],roll<.62?warm:cool);
  }
  if(L.edges)for(const sx of [-1,1])for(const sz of [-1,1])
    leds.piece(root,[sx*(w/2+.07),(h-.12)/2,sz*(d/2+.07)],[.26*k,h-.12,.26*k],leds.climber);
  if(L.stripes)for(const at of [-w/4,w/4])leds.piece(root,[at,h*.5,d/2+.2],[.3*k,h*.84,.1],leds.climber);
  for(const y of L.bands??[])leds.piece(root,[0,y,0],[w+.3,.4*k,d+.3],leds.runner);
  if(L.crown!==undefined)leds.piece(root,[0,h+1.5,0],[w-1.4,3,d-1.4],leds.washes[L.crown]);
  else box(root,[0,h+.5,0],[w-1.4,1,d-1.4],def.color);            // plant room on the roof
  if(L.screen)leds.piece(root,[0,(L.screen.y0+L.screen.y1)/2,d/2+.22],[w-1.6,L.screen.y1-L.screen.y0,.1],leds.washes[L.screen.wash]);
  // Lit characters hang just clear of the tower's hitbox (0.3 m out), so a look from across the
  // street finds them rather than the tower behind them.
  if(L.text)leds.text(root,L.text.zh,[0,L.text.y,d/2+.36],L.text.cell,{color:L.text.color,vertical:L.text.vertical});
  return root;
}

/**
 * A building on the near side of the bay (task E-downtown: city.json `towers` with a `form`), its
 * front on local +z: a podium with its entrance, tiers stepping in above it, each in a skin of its
 * own, and a crown; after dark its rooms light up and go out through the night, and outlines,
 * uplights, a neon sign and on some a media wall light it (`leds`). Richer than the skyline across
 * the bay, because you walk past it: 'high' detail builds every mullion, fin, louvre and railing,
 * 'medium' about half of them, 'low' the massing, the entrance and the lights. Returns its root and
 * a hitbox for each volume, so what stands back above the podium is looked at past it.
 */
function building(models,leds,parent,def,level){
  const {box,cylinder}=models,F=def.form,L=def.leds??{},high=level==='high',mid=level!=='low';
  const root=new pc.Entity('tower');root.lookName='tower';
  root.setLocalPosition(def.x,0,def.z);root.setLocalEulerAngles(0,def.rot??0,0);parent.addChild(root);
  const marks=[],name=def.name??'tower',body=def.color??'#8d9299',trim=def.trim??'#dcd8cf',metal='#5b6570';
  /** A box of a colour or a material; big ones cast a shadow unless told not to. */
  const put=(what,pos,size,shadows=true,rot)=>{
    const e=box(root,pos,size,typeof what==='string'?what:'#808080',rot);
    if(typeof what!=='string')e.render.meshInstances[0].material=what;
    if(!shadows)e.render.castShadows=false;
    return e;
  };
  const tag=(e,key)=>{e.lookName=key;return e;};
  /** A clipped shrub in a planter up on a building: two blocks of leaves on a stem, a few dozen
   *  triangles where a street tree's round crown is thousands. */
  const shrub=(x,y,z,size=1)=>{
    const g=new pc.Entity('tree');g.lookName='tree';g.setLocalPosition(x,y,z);g.setLocalScale(size,size,size);
    g.setLocalEulerAngles(0,Math.abs(x*37+z*53)%90,0);root.addChild(g);
    box(g,[0,.6,0],[.18,1.2,.18],'#6b5540').render.castShadows=false;
    box(g,[0,1.55,0],[1.5,1.1,1.5],'#5f7d4f').render.castShadows=false;
    box(g,[0,2.2,0],[1,.7,1],'#7a9a62',[0,45,0]).render.castShadows=false;
    return g;
  };
  const kindOf=T=>T?.windows??L.windows??'curtain',grid=kind=>GLAZING[kind].grid;
  const glaze=(kind,frame=def.frame??null)=>leds.glazing(kind,frame);
  const hit=v=>marks.push(turn(def,{x:v.cx,z:v.cz,hw:v.w/2+.3,hd:v.d/2+.3,y0:v.y0,y1:v.y1,name}));
  const rad=(def.rot??0)*Math.PI/180,cos=Math.round(Math.cos(rad)),sin=Math.round(Math.sin(rad));
  const world=(x,z)=>[def.x+x*cos+z*sin,def.z-x*sin+z*cos];
  /** The faces of a volume (all four, 'front' or 'sides'): outward normal, how far out, half its
   *  length, its tangent (the front runs along +x), and where the city's window grid falls on it. */
  function faces(v,which='all'){
    const list=[];
    for(const [nx,nz] of [[0,1],[1,0],[0,-1],[-1,0]]){
      if((which==='front'&&nz!==1)||(which==='sides'&&nz)||(which==='fronts'&&!nz))continue;
      const out=nz?v.d/2:v.w/2,half=nz?v.w/2:v.d/2,tx=nz,tz=-nx;
      const [ax,az]=world(v.cx+nx*out,v.cz+nz*out),[bx,bz]=world(v.cx+nx*out+tx,v.cz+nz*out+tz);
      const alongX=Math.abs(bx-ax)>.5;
      list.push({nx,nz,tx,tz,out,half,a0:alongX?ax:az,s:alongX?bx-ax:bz-az});
    }
    return list;
  }
  /** Where along a face (u) the city grid's lines fall, every `step` metres, clear of its ends. */
  function lines(f,step,margin=.3){
    const out=[];
    for(let k=Math.ceil((f.a0-f.half+margin)/step);k*step<=f.a0+f.half-margin;k++)out.push((k*step-f.a0)*f.s);
    return out;
  }
  /** Storey lines (the grid's, in city metres) strictly inside y0..y1. */
  const storeys=(y0,y1,step,margin=.4)=>{const out=[];for(let y=Math.ceil((y0+margin)/step)*step;y<y1-margin;y+=step)out.push(y);return out;};
  /** A box on a face: u along it, y up, n out from it; size [along, up, out]. */
  const on=(v,f,u,y,n,[su,sy,sn],what,shadows=false,rot)=>
    put(what,[v.cx+f.nx*(f.out+n)+f.tx*u,y,v.cz+f.nz*(f.out+n)+f.tz*u],f.nz?[su,sy,sn]:[sn,sy,su],shadows,rot);
  /** A ring round a volume at height y (a band, a ledge, a louvre blade), `out` past each face. */
  const ring=(v,y,tall,out,what,shadows=false)=>put(what,[v.cx,y,v.cz],[v.w+2*out,tall,v.d+2*out],shadows);
  /** Light along the top edges of a volume, straddling them (clear of the mullions and piers below,
   *  which stop 6 cm short of the top) and proud of the faces. */
  const outline=(v,y,color,mode)=>{
    if(!color)return;
    const m=leds.strip(color,mode);
    for(const f of faces(v))on(v,f,0,y,.1,[2*f.half+.34,.16,.16],m);
  };
  const corners=(v,color)=>{
    const m=leds.strip(color);
    for(const sx of [-1,1])for(const sz of [-1,1])
      put(m,[v.cx+sx*(v.w/2+.08),(v.y0+v.y1)/2,v.cz+sz*(v.d/2+.08)],[.12,v.y1-v.y0-.3,.12],false);
  };
  const wash=(x,y,z,w,h)=>{if(mid&&L.uplight)leds.wash(root,[x,y,z],[w,h,.02],L.uplight);};
  const lobby=leds.lit('#3c4852','#ffd9a8');

  // ---- the podium ----
  const P=F.podium,pod={cx:0,cz:0,w:def.w,d:def.d,y0:0,y1:P.h},f=def.d/2,H=P.h,W=def.w,doorX=F.door?.x??0;
  /** How wide something centred at `x` on the front may be and stay on it (20 cm in from each corner). */
  const onFront=(x,width)=>Math.min(width,2*(W/2-.2-Math.abs(x)));
  /** A lit front (a shop window, a lobby) set `back` metres in, `inset` in from each end. */
  const shopfront=(back,light,inset=.5,top=H-1.3)=>put(light,[0,top/2,f-back],[W-2*inset,top,.2]);
  if(P.style==='colonnade'){
    // Granite, the lobby glass set back behind four tall columns carrying a deep cornice: the middle
    // pair frame the door with room to spare, the outer pair stand near the corners.
    put(body,[0,H/2,-.8],[W,H,def.d-1.6]);
    shopfront(1.65,lobby,.7,H-1.6);
    tag(put(trim,[0,H-.69,f-.95],[W+.1,1.5,1.9]),'roof');
    for(const x of [-(W/2-1.1),doorX-2.15,doorX+2.15,W/2-1.1]){
      tag(put(trim,[x,(H-1.44)/2,f-.6],[.95,H-1.44,.95]),'pillar');
      wash(x,(H-1.6)/2,f-.065,.9,H-1.6);
    }
  } else if(P.style==='books'){
    // A long lit window behind a row of book spines, tall and short, in the colours of their covers.
    put(body,[0,H/2,-.3],[W,H,def.d-.6]);
    shopfront(.5,leds.lit('#5a5048','#ffcf8f'));
    put(trim,[0,H-.42,f-.25],[W+.1,.96,.9]);
    if(mid){
      const covers=['#8c3b32','#2f5d62','#c9a44c','#3e4c7a','#6f7f45'],step=high?.55:1.1;
      for(let x=-W/2+.9,i=0;x<W/2-.8;x+=step,i++){
        const tall=3.6+((i*7)%5)*.3;
        if(Math.abs(x-doorX)>1.6)put(covers[(i*3)%covers.length],[x,tall/2+.3,f-.18],[.32,tall,.5],false);   // the doorway stays clear
      }
    }
  } else if(P.style==='lobby'){
    // A tall lobby of glass between white piers, under a fascia.
    put(body,[0,H/2,-.5],[W,H,def.d-1]);
    shopfront(.85,leds.lit('#3a4a56','#e6f1ff'),.4,H-1.2);
    for(const k of [-1,-1/3,1/3,1]){
      const x=k*(W/2-.35);
      tag(put(trim,[x,(H-.06)/2,f-.45],[.7,H-.06,.7]),'pillar');
      wash(x,(H-1.2)/2,f-.04,.66,H-1.2);
    }
    put(trim,[0,H-.5,f-.425],[W+.1,1.12,1.25]);
  } else if(P.style==='shopfront'||P.style==='cafe'||P.style==='store'){
    // A shop: timber or steel posts, its lit window between them, a fascia band for the name.
    const warm=P.style!=='store';
    put(body,[0,H/2,-.4],[W,H,def.d-.8]);
    shopfront(.7,warm?leds.lit('#4a4038','#ffc98e'):leds.lit('#dfe8ea','#f4fbff'));
    const post=P.style==='store'?'#e9ecef':'#7a5238';
    const n=Math.max(2,Math.round(W/2.6));
    for(let i=0;i<=n;i++){
      const x=-W/2+.3+i*(W-.6)/n;
      if(Math.abs(x-doorX)>1.6)put(post,[x,(H-1.2)/2,f-.45],[.3,H-1.2,.3],false);
    }
    put(P.style==='store'?'#2f8f5b':P.style==='cafe'?'#e8e1d2':'#7a2e25',[0,H-.57,f-.3],[W+.1,1.26,1]);
  } else if(P.style==='marquee'){
    // A cinema's front: dark, two lit poster cases and a lit foyer behind the doors.
    put(body,[0,H/2,-.3],[W,H,def.d-.6]);
    shopfront(.5,lobby,W/2-3);
    for(const x of [-W/2+2.2,W/2-2.2])put(leds.lit('#2c2a3a','#ffe0a8'),[x,2.4,f-.45],[2.2,3.2,.2]);
  } else {
    // Stone: tall punched windows in the same stone, and a cornice.
    put(glaze('punched',def.stone??'#b8b0a2'),[0,H/2,0],[W,H,def.d]);
    ring(pod,H+.04,.5,.22,trim,true);
    for(let x=-W/2+2;x<W/2-1;x+=4)wash(x,(H-1)/2,f+.08,2.6,H-1);
  }
  hit(pod);

  // ---- the entrance: a door in a portal, lit lobby glass behind it, and a canopy (none on a
  // building nobody goes into: `door: false`) ----
  const lit={colonnade:1.55,books:.4,lobby:.75,marquee:.4,stone:0}[P.style]??.6;
  if(P.style!=='stone'&&F.door!==false){
    const dg=new pc.Entity('door');dg.lookName='door';dg.setLocalPosition(doorX,0,f-lit+.38);root.addChild(dg);
    const at=(pos,size,what,shadows=false)=>{const e=box(dg,pos,size,typeof what==='string'?what:'#808080');
      if(typeof what!=='string')e.render.meshInstances[0].material=what;if(!shadows)e.render.castShadows=false;return e;};
    at([0,1.5,-.33],[2.3,3,.06],lobby);
    const pane=leds.lit('#6f8894','#caa87a');
    for(const x of [-.57,.57])at([x,1.45,-.2],[1.08,2.9,.05],pane);
    for(const x of [-1.3,1.3])at([x,1.6,-.1],[.24,3.2,.5],metal);
    at([0,3.35,-.1],[2.84,.36,.5],metal);
    for(const x of [-.1,.1])at([x,1.1,-.14],[.04,.55,.04],'#d8dde2');
    at([0,.012,.45],[2.2,.024,.9],'#3b3f45');
  }
  const canopy=new pc.Entity('canopy');canopy.setLocalPosition(doorX,0,f);root.addChild(canopy);
  const cp=(pos,size,what,rot,shadows=false)=>{const e=box(canopy,pos,size,typeof what==='string'?what:'#808080',rot);
    if(typeof what!=='string')e.render.meshInstances[0].material=what;if(!shadows)e.render.castShadows=false;return e;};
  const soffit=leds.lit('#e8e4da','#fff1d6');
  if(F.canopy==='glass'){
    // Glass on two steel beams, each hung from the wall (or the columns in front of it) by a rod.
    const gw=onFront(doorX,3.8),rx=Math.min(1.8,gw/2-.1),back=P.style==='colonnade'?-.125:0;
    const rise=5.3-3.83,run=2.35-back,rod=Math.hypot(rise,run),tilt=Math.atan2(rise,run)*180/Math.PI;
    cp([0,3.8,1.25],[gw,.05,2.5],clearGlass(.35));
    for(const x of [-rx,rx]){
      cp([x,3.72,(back+2.4)/2],[.08,.08,2.4-back],metal);
      cp([x,(5.3+3.83)/2,(back+2.35)/2],[.05,.05,rod],metal,[tilt,0,0]);
    }
  } else if(F.canopy==='slab'){
    const cw=onFront(doorX,def.canopyWidth??4.6);
    cp([0,3.9,1.2],[cw,.28,2.4],def.canopyColor??'#8a6a4c',undefined,true);
    cp([0,3.68,1.2],[cw-.6,.04,1.9],soffit);
  } else if(F.canopy==='wave'){
    // A drop-off canopy, its roof swelling in a wave out over the pavement.
    const n=high?9:5,len=3.2,ww=onFront(doorX,7.2);
    for(let i=0;i<n;i++){
      const a=i/n,b=(i+1)/n,ya=3.7+.7*Math.sin(Math.PI*a),yb=3.7+.7*Math.sin(Math.PI*b);
      const seg=Math.hypot(len/n,yb-ya)+.02;
      cp([0,(ya+yb)/2,(a+b)/2*len],[ww,.18,seg],trim,[-Math.atan2(yb-ya,len/n)*180/Math.PI,0,0],true);
    }
    cp([0,3.58,len-.06],[ww-.2,.08,.1],leds.strip(L.outline??'#e8f4ff'));
    cp([0,3.52,1.4],[ww-.8,.04,2.2],soffit);
  } else if(F.canopy==='marquee'){
    // A marquee: a deep lit box out over the pavement, bulbs marching round its edges.
    const mw=onFront(doorX,Math.min(W-3,11))-.24,bulbs=leds.strip('#ffe6a8','chase',{spacing:.4,speed:6});
    cp([0,4.6,1.3],[mw,1.3,2.6],'#2a2433',undefined,true);
    for(const y of [4.02,5.18]){
      cp([0,y,2.66],[mw+.02,.12,.12],bulbs);
      for(const x of [-mw/2-.06,mw/2+.06])cp([x,y,1.3],[.12,.12,2.6],bulbs);
    }
    cp([0,3.9,1.3],[mw-.6,.04,2.2],soffit);
  } else if(F.canopy==='awning'){
    // A canvas awning in two colours, sloping out over the door and the window.
    const aw=onFront(doorX,Math.min(W-1.4,9)),slats=high?10:5,[c1,c2]=def.awning??['#e9e2d0','#2f6f73'];
    for(let i=0;i<slats;i++)cp([-aw/2+(i+.5)*aw/slats,3.55,1.1],[aw/slats+(i%2?.01:0),.08+(i%2?.01:0),2.3],i%2?c1:c2,[16,0,0]);
    cp([0,3.08,2.2],[aw,.36,.04],c2,[0,0,0]);
  }

  // ---- the tiers ----
  // Where each tier stands (src/core/city.js: a sky garden takes the ground its neighbours share).
  let below=pod;const tiers=[],layout=towerTiers(def);
  for(const [i,T] of F.tiers.entries()){
    const kind=kindOf(T),[cw,ch]=grid(kind);
    const v={...layout[i],kind,front:0};
    tiers.push(v);
    const tall=v.y1-v.y0,mid_=(v.y0+v.y1)/2;
    if(T.skin==='bow'){
      // The front swells in a shallow curve: slices, each a little deeper towards the middle.
      const n=high?16:mid?10:6,sw=v.w/n,bulge=T.bulge??2;
      for(let i=0;i<n;i++){
        const x=-v.w/2+(i+.5)*sw,b=bulge*Math.cos(Math.PI*x/v.w);
        put(glaze(kind),[v.cx+x,mid_,v.cz+b/2],[sw,tall,v.d+b]);
        // The outline follows the curve, slice by slice.
        if(L.outline)put(leds.strip(L.outline),[v.cx+x,v.y1+.02,v.cz+v.d/2+b+.1],[sw,.16,.16],false);
      }
      v.front=bulge;
      hit({...v,d:v.d+bulge,cz:v.cz+bulge/2});below=v;
      if(L.outline){const m=leds.strip(L.outline);for(const f of faces(v))if(f.nz!==1)on(v,f,0,v.y1+.02,.1,[2*f.half+.34,.16,.16],m);}
      continue;
    } else if(T.skin==='garden'){
      // A sky garden: an open storey, its core stepped in, trees and planters round it, a rail.
      put(glaze('dark'),[v.cx,mid_,v.cz],[v.w-2.4,tall,v.d-2.4]);
      for(const sx of [-1,1])for(const sz of [-1,1])tag(put(trim,[v.cx+sx*(v.w/2-.3),mid_+.03,v.cz+sz*(v.d/2-.3)],[.5,tall-.14,.5]),'pillar');
      const plant=new pc.Entity('planter');plant.lookName='planter';root.addChild(plant);
      for(const f of faces(v,'fronts')){
        const e=on(v,f,0,v.y0+.55,-.7,[v.w-1.2,.9,.8],'#8f8a80');e.reparent(plant);
        if(mid)for(const u of high?[-v.w/4,v.w/4]:[0]){
          const [px,pz]=[v.cx+f.nx*(f.out-.7)+f.tx*u,v.cz+f.nz*(f.out-.7)+f.tz*u];
          shrub(px,v.y0+.9,pz,.6);   // small enough that its leaves stay over the planter
        }
      }
      if(mid)for(const f of faces(v))on(v,f,0,v.y0+.55,-.02,[2*f.half-.6,1.1,.04],clearGlass(.25));
      outline({...v,w:v.w-2.4,d:v.d-2.4},v.y1-.2,L.outline,'twinkle');
      below=v;hit({...v,w:v.w-2.4,d:v.d-2.4});continue;
    } else {
      put(glaze(kind),[v.cx,mid_,v.cz],[v.w,tall,v.d]);
    }
    const every=high?1:mid?2:0;
    if(T.skin==='curtain'&&every){
      // Mullions on the grid's lines, and a transom at every storey.
      for(const f of faces(v))lines(f,cw).forEach((u,i)=>{if(i%every===0)on(v,f,u,mid_,.07,[.07,tall-.12,.14],metal);});
      if(high)for(const y of storeys(v.y0,v.y1,ch))ring(v,y,.07,.07,metal);
    } else if(T.skin==='piers'&&every){
      // Stone piers between the windows, and a ledge at every storey.
      for(const f of faces(v))lines(f,cw).forEach((u,i)=>{if(i%every===0)on(v,f,u,mid_,.1,[.42,tall-.12,.3],trim);});
      if(high)for(const y of storeys(v.y0,v.y1,ch))ring(v,y,.2,.16,trim);
    } else if(T.skin==='ribbons'&&mid){
      // Deep white bands at every storey, the windows running between them.
      for(const y of storeys(v.y0,v.y1,ch))ring(v,y,1.2,.14,trim);
    } else if(T.skin==='fins'&&every){
      for(const f of faces(v))lines(f,cw).forEach((u,i)=>{if(i%every===0)on(v,f,u,mid_,.34,[.12,tall-.12,.68],def.finColor??'#9a7b58');});
    } else if(T.skin==='louvres'){
      // Timber blades all the way round, closer together the more detail there is.
      const step=high?.9:mid?1.8:3.6;
      for(let y=v.y0+step*.6;y<v.y1-.3;y+=step)ring(v,y,.08,.42,def.finColor??'#b0845a');
    } else if(T.skin==='balconies'){
      // Balconies front and back, staggered storey by storey, with glass rails and plants.
      const rail=clearGlass(.3),soft=leds.lit('#d9d2c6','#ffd9a8');
      for(const f of faces(v,'fronts'))storeys(v.y0,v.y1,ch,1).forEach((y,k)=>{
        for(const side of [-1,1]){
          const u=side*v.w/4+(k%2?.7:-.7),bw=Math.min(3,v.w/2-1.2);
          tag(on(v,f,u,y+.08,.65,[bw,.16,1.3],trim,true),'balcony');
          if(mid)on(v,f,u,y-.03,.65,[bw-.3,.04,1.0],soft);
          if(mid)tag(on(v,f,u,y+.66,1.27,[bw,.95,.04],rail),'railing');
          if(high&&(k+side)%3===0)on(v,f,u+bw/2-.5,y+.4,.9,[.7,.48,.4],'#6f8a5a');
        }
      });
    } else if(T.skin==='diagrid'&&every){
      // A steel lattice of diagonals over the glass, tied by a ring at every node.
      const rise=7.2;
      for(const f of faces(v)){
        const n=Math.max(1,Math.round(2*f.half/5)),span=2*f.half/n;
        for(let y=v.y0,j=0;y+rise<=v.y1+.01;y+=rise,j++){
          if(j%every)continue;
          for(let i=0;i<n;i++){
            const u=-f.half+(i+.5)*span,len=Math.hypot(span,rise),a=Math.atan2(rise,span)*180/Math.PI;
            for(const sgn of [-1,1])
              on(v,f,u,y+rise/2,.2,[len,.3,.26],metal,false,f.nz?[0,0,sgn*a]:[sgn*a*-f.nx,0,0]);
          }
          if(j>0)ring(v,y,.3,.3,metal);
        }
      }
    } else if(T.skin==='screen'&&every){
      // A plain box for the big screen on its front, fins down its sides.
      for(const f of faces(v,'sides'))lines(f,cw*2).forEach((u,i)=>{if(i%every===0)on(v,f,u,mid_,.3,[.14,tall-.12,.6],metal);});
    }
    if(T.corners&&L.outline)corners(v,L.outline);
    outline(v,v.y1+.02,L.outline);
    hit(v);below=v;
  }
  const top=below;

  // ---- the crown ----
  const C=F.crown,y=top.y1,glow=L.outline;
  if(C==='lantern'){
    // A lit glass lantern with a thin roof over it, outlined in light.
    put(leds.lit('#9fb3bd','#ffd27f'),[top.cx,y+1.6,top.cz],[top.w-2,3.2,top.d-2]);
    const roof={cx:top.cx,cz:top.cz,w:top.w-1.3,d:top.d-1.3};
    put(trim,[top.cx,y+3.36,top.cz],[roof.w,.32,roof.d]);
    outline(roof,y+3.36,glow);
    if(high)for(const f of faces({...roof,w:top.w-2,d:top.d-2}))for(const u of lines(f,.9,.2))on({...top,w:top.w-2,d:top.d-2},f,u,y+1.6,.1,[.08,3.1,.16],metal);
    marks.push(turn(def,{x:top.cx,z:top.cz,hw:top.w/2-.7,hd:top.d/2-.7,y0:y,y1:y+3.6,name}));
  } else if(C==='stepped'){
    let s={...top};
    for(let i=0;i<3;i++){
      s={...s,w:s.w-2.4,d:s.d-2.4};
      put(glaze(top.kind),[s.cx,y+i*2+1,s.cz],[s.w,2,s.d]);
      outline(s,y+i*2+1.85,glow);
    }
  } else if(C==='fins'){
    // Blades rising round the roof, and light twinkling along their tops.
    const every=high?1:2;
    for(const f of faces(top))lines(f,grid(top.kind)[0]).forEach((u,i)=>{if(i%every===0)on(top,f,u,y+2.4,.02,[.16,4.8,.5],trim,false);});
    outline({...top,w:top.w-.24,d:top.d-.24},y+4.86,glow,'twinkle');
    marks.push(turn(def,{x:top.cx,z:top.cz,hw:top.w/2+.3,hd:top.d/2+.3,y0:y,y1:y+4.8,name}));
  } else if(C==='helipad'){
    // A helipad on a plant room, ringed with lights.
    put(trim,[top.cx,y+.9,top.cz],[top.w-3,1.8,top.d-3]);
    const r=Math.min(top.w,top.d)/2-.6;
    cylinder(root,[top.cx,y+1.96,top.cz],[2*r,.2,2*r],'#5c6168').render.castShadows=false;
    const ringLight=leds.strip(glow??'#9dffb8','twinkle',{spacing:.5,speed:2});
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2;put(ringLight,[top.cx+Math.cos(a)*(r-.3),y+2.1,top.cz+Math.sin(a)*(r-.3)],[.25,.1,.25],false);}
    marks.push(turn(def,{x:top.cx,z:top.cz,hw:r,hd:r,y0:y,y1:y+2.1,name}));
  } else if(C==='sail'){
    // A glass sail rising over the roof, leaning back, its edges traced in light, a beacon on top.
    const sw=top.w*.8,sh=16,lean=14,t=lean*Math.PI/180;
    const sail=new pc.Entity('sail');sail.setLocalPosition(top.cx,y,top.cz+top.d/2-1.4);sail.setLocalEulerAngles(-lean,0,0);root.addChild(sail);
    const e=box(sail,[0,sh/2,0],[sw,sh,.4],'#808080');e.render.meshInstances[0].material=glaze('dark');
    const edge=leds.strip(glow??'#9fe8ff');
    for(const x of [-sw/2-.1,sw/2+.1])leds.piece(sail,[x,sh/2,.1],[.14,sh-.2,.14],edge);
    leds.piece(sail,[0,sh+.1,.1],[sw+.34,.14,.14],edge);
    leds.piece(sail,[0,sh+.5,0],[.6,.6,.6],leds.beacon);
    marks.push(turn(def,{x:top.cx,z:top.cz+top.d/2-1.4-Math.sin(t)*sh/2,hw:sw/2+.3,hd:Math.sin(t)*sh/2+.5,y0:y,y1:y+sh,name}));
  } else if(C==='garden'||C==='pavilion'){
    // A roof garden, or a small lit pavilion with lights strung round its roof.
    ring({...top,w:top.w-.1,d:top.d-.1},y+.5,1,.03,'#8f8a80');
    if(C==='pavilion'){
      put(leds.lit('#c9b99f','#ffcf94'),[top.cx,y+1.55,top.cz],[top.w*.5,2.9,top.d*.45]);
      put(trim,[top.cx,y+3.15,top.cz],[top.w*.5+1.2,.3,top.d*.45+1.2]);
      outline({cx:top.cx,cz:top.cz,w:top.w*.5+1.2,d:top.d*.45+1.2},y+3.02,'#ffd9a0','twinkle');
    }
    if(mid)for(const [a,b] of [[-.3,-.28],[.32,.26],[-.34,.3],[.3,-.3]].slice(0,high?4:2))
      shrub(top.cx+a*top.w,y+1,top.cz+b*top.d,.9);
    if(C==='garden'&&mid){
      // A pergola: posts and slats, lights along it.
      const pw=top.w*.45,pd=top.d*.35;
      for(const sx of [-1,1])for(const sz of [-1,1])put('#7a5a40',[top.cx+sx*pw/2,y+1.8,top.cz+sz*pd/2],[.16,1.6,.16],false);
      for(let x=-pw/2;x<=pw/2+.01;x+=pw/5)put('#8a6a4c',[top.cx+x,y+2.66,top.cz],[.1,.12,pd+.4],false);
      outline({cx:top.cx,cz:top.cz,w:pw+.3,d:pd+.3},y+2.5,'#ffe2a8','twinkle');
    }
    marks.push(turn(def,{x:top.cx,z:top.cz,hw:top.w/2+.3,hd:top.d/2+.3,y0:y,y1:y+1,name}));
  } else if(C==='slope'){
    // A wedge of roof rising towards the avenue (its back edge on the roof, the rest of it sunk
    // into the storey below), its high edge lit.
    const a=12*Math.PI/180,deep=top.d-.6,rise=Math.tan(a)*deep;
    put(body,[top.cx,y,top.cz],[top.w-.4,rise,deep],true,[-12,0,0]);
    if(glow)put(leds.strip(glow),[top.cx,y+rise/2*Math.cos(a)+deep/2*Math.sin(a)-.08,top.cz+deep/2*Math.cos(a)-rise/2*Math.sin(a)+.03],[top.w-.2,.14,.14],false);
  }

  // ---- the sign and the media wall ----
  if(def.sign){
    const marquee=F.canopy==='marquee',sh=marquee?.9:def.signHeight??1.2,edge=W/2-.2;
    const sw=Math.min(W-1.4,def.signWidth??7.4,2*edge-.2),reach=edge-sw/2-.1;   // the board is .1 wider each side
    const sx=Math.max(-reach,Math.min(reach,marquee?doorX:def.signX??0)),sy=marquee?4.6:H-sh/2-.05,sz=marquee?f+2.66:f+.38;
    if(!marquee)put('#1b1e24',[sx,sy,sz-.09],[sw+.2,sh+.2,.1],false);
    leds.neon(root,def.sign,[sx,sy,sz],[sw,sh],{color:L.neon,seed:def.x+def.z,bowl:!!L.bowl});
  }
  if(L.text){
    const t=L.text,n=[...t.zh].length,v=tiers.find(one=>t.y>=one.y0&&t.y<=one.y1)??top;
    const size=t.size??(t.vertical?[t.cell+1.2,n*t.cell+1.2]:[n*t.cell+1.2,t.cell+1.2]);
    leds.screen(root,t.zh,[v.cx,t.y,v.cz+v.d/2+v.front+.36],size,{vertical:!!t.vertical,seed:def.z*.13});
  }
  return {root,marks};
}

/**
 * A tower's wings (city.json `wings`: {id, x, z, w, d, h} in its own frame, front on +z): the
 * volume holding a room behind or beside its main one (the cinema's screening hall, 星光百货's
 * hardware store), in stone with a cornice round its top; one with a `sign` has a lit shop window
 * and its name in neon on its front. Returns the hitboxes.
 */
function wings(models,leds,parent,def){
  const {box}=models,marks=[];
  for(const w of def.wings??[]){
    const g=new pc.Entity('city-wing');g.lookName='tower';
    g.setLocalPosition(def.x,0,def.z);g.setLocalEulerAngles(0,def.rot??0,0);parent.addChild(g);
    box(g,[w.x,w.h/2,w.z],[w.w,w.h,w.d],'#808080').render.meshInstances[0].material=leds.glazing(w.windows??'punched',w.stone??def.stone??'#b8b0a2');
    box(g,[w.x,w.h+.2,w.z],[w.w+.3,.4,w.d+.3],def.trim??'#dcd8cf');
    if(w.sign){
      const f=w.z+w.d/2,sw=Math.min(w.w-1.4,7.4),glass=box(g,[w.x,1.9,f+.03],[w.w-1.6,3,.06],'#dfe8ea');
      glass.render.meshInstances[0].material=leds.lit('#dfe8ea','#f4fbff');glass.render.castShadows=false;
      box(g,[w.x,w.h-1.1,f+.1],[sw+.2,1.4,.1],'#1b1e24').render.castShadows=false;
      leds.neon(g,w.sign,[w.x,w.h-1.1,f+.21],[sw,1.2],{color:w.neon??'#9fe3ff',seed:w.x});
    }
    marks.push(turn(def,{x:w.x,z:w.z,hw:w.w/2+.3,hd:w.d/2+.3,y0:0,y1:w.h+.4,name:'tower'}));
  }
  return marks;
}

/** See-through glass (canopies, balcony rails), shared by opacity. */
const GLASSES=new Map();
function clearGlass(opacity){
  if(!GLASSES.has(opacity)){
    const m=new pc.StandardMaterial();
    m.diffuse=new pc.Color().fromString('#cfe3ea');m.opacity=opacity;m.blendType=pc.BLEND_NORMAL;
    m.depthWrite=false;m.gloss=.9;m.useMetalness=true;m.metalness=.2;m.update();
    GLASSES.set(opacity,m);
  }
  return GLASSES.get(opacity);
}

/**
 * One of the blocks round the edge of downtown (city.json `backdrop`), seen from the hill and the
 * promenade and never reached: a body in one of the glazing kinds, sometimes on a podium or stepping
 * in near the top, plant on the roof, and now and then a lit crown or a band of light.
 */
const CROWNS=['#ffd9a0','#9fe8ff','#ff9ad5','#b8ffcf'];
function block(models,leds,parent,def,next,level){
  const {box,cylinder}=models,{x,z,w,d,h}=def,g=new pc.Entity('block');
  g.setLocalPosition(x,0,z);parent.addChild(g);
  const put=(what,pos,size)=>{const e=box(g,pos,size,typeof what==='string'?what:'#808080');
    if(typeof what!=='string')e.render.meshInstances[0].material=what;e.render.castShadows=false;return e;};
  const kinds=Object.keys(GLAZING),kind=kinds[Math.floor(next()*kinds.length)];
  const pod=next()<.4?Math.min(8,Math.round(h*.18)):0,step=next()<.55?Math.round(h*(.62+next()*.25)):h;
  if(pod)put(leds.glazing('punched'),[0,pod/2,0],[w+1.2,pod,d+1.2]);
  put(leds.glazing(kind),[0,(pod+step)/2,0],[w,step-pod,d]);
  const tw=step<h?w-3:w,td=step<h?d-3:d;
  if(step<h)put(leds.glazing(kind),[0,(step+h)/2,0],[tw,h-step,td]);
  put('#6b7079',[tw*.18,h+1.1,-td*.1],[tw*.4,2.2,td*.45]);
  if(level!=='low'&&next()<.5)cylinder(g,[-tw*.25,h+1.4,td*.22],[2.2,2.8,2.2],'#8a8f96').render.castShadows=false;
  const roll=next();
  if(roll<.35){
    const m=leds.strip(CROWNS[Math.floor(next()*CROWNS.length)]);
    for(const [px,pz,sx,sz] of [[0,td/2+.08,tw+.3,.12],[0,-td/2-.08,tw+.3,.12],[tw/2+.08,0,.12,td+.3],[-tw/2-.08,0,.12,td+.3]])
      put(m,[px,h-.12,pz],[sx,.12,sz]);
  } else if(roll<.5&&level!=='low')put(leds.strip(CROWNS[0],'twinkle',{spacing:.8,speed:1.5}),[0,Math.round(h*.5)+.3,0],[w+.24,.14,d+.24]);
  return g;
}

/**
 * Searchlights on the gate (city.json's `gate` prop), their beams sweeping slowly over the avenue
 * after dark: two a side on high detail, one on medium, none on low. The beams are light, not
 * things: nothing names them, and a look passes through.
 */
function searchlights(models,leds,root,level){
  const gate=city.props.find(p=>p.kind==='gate'),n=level==='high'?2:level==='medium'?1:0,list=[];
  if(!gate||!n)return ()=>{};
  const material=leds.beam('#e4ecff');
  for(const side of [-1,1])for(let i=0;i<n;i++){
    const pivot=new pc.Entity('searchlight');pivot.noBatch=true;
    pivot.setLocalPosition(gate.x+side*(11.6-i*1.4),12.95,gate.z);root.addChild(pivot);
    models.box(pivot,[0,-.15,0],[.5,.3,.5],'#3b4148').lookName='lamp';
    const cone=models.shape(pivot,'cone',[0,45,0],[6,90,6],'#000000',[180,0,0]);
    cone.name='sky';cone.enabled=false;cone.render.castShadows=false;cone.render.receiveShadows=false;
    cone.render.meshInstances[0].material=material;
    list.push({pivot,cone,phase:side*1.3+i*2.1,side});
  }
  let t=0;
  return dt=>{
    const on=material.emissiveIntensity>0&&detail()!=='low';
    for(const one of list)if(one.cone.enabled!==on)one.cone.enabled=on;
    if(!on)return;
    t+=dt;
    for(const one of list)one.pivot.setLocalEulerAngles(16+9*Math.sin(t*.21+one.phase),one.side*25+35*Math.sin(t*.13+one.phase),0);
  };
}

/**
 * 云海中心, the tower the skyline is arranged round: five glass tiers stepping in as they rise,
 * each setback edged with running light and every corner lit, a colour-washed point, and a spire
 * with a blinking red beacon on top. Returns its hitboxes, one a tier.
 */
function landmark(models,leds,parent,def){
  const {box,shape,cylinder}=models,[warm,cool]=leds.windows(def.glass),text=def.leds.text,marks=[];
  const root=new pc.Entity('landmark');root.setLocalPosition(def.x,0,def.z);parent.addChild(root);
  let y=0;
  for(const [share,tall] of def.tiers){   // city.json: 海景公寓's floors (src/world/rental.js) sit in these tiers
    const w=def.w*share;
    marks.push({x:def.x,z:def.z,hw:w/2+.05,hd:w/2+.05,y0:y,y1:y+tall,name:'tower'});
    box(root,[0,y+tall/2,0],[w,tall,w],'#1b2836').render.castShadows=false;
    for(let fy=y+2.2;fy<y+tall-1.2;fy+=3.2)leds.piece(root,[0,fy,0],[w+.12,2,w+.12],Math.floor(fy*7)%3?warm:cool);
    for(const sx of [-1,1])for(const sz of [-1,1])leds.piece(root,[sx*(w/2+.1),y+tall/2-.03,sz*(w/2+.1)],[.4,tall-.18,.4],leds.climber);
    leds.piece(root,[0,y+tall-.3,0],[w+.3,.5,w+.3],leds.runner);
    if(text.y>y&&text.y<y+tall)leds.text(root,text.zh,[0,text.y,w/2+.24],text.cell,{color:text.color,vertical:text.vertical});
    y+=tall;
  }
  const point=shape(root,'cone',[0,y+7,0],[def.w*.66,14,def.w*.66],'#27313d');
  point.render.meshInstances[0].material=leds.washes[1];point.render.castShadows=false;
  cylinder(root,[0,y+14+(def.h-y-14)/2,0],[.6,def.h-y-14,.6],'#aab3bb').render.castShadows=false;
  leds.piece(root,[0,def.h+.3,0],[.7,.7,.7],leds.beacon);
  marks.push({x:def.x,z:def.z,hw:def.w*.33,hd:def.w*.33,y0:y,y1:def.h+1,name:'tower'});
  return marks;
}

/**
 * The land round the bay (city.json `land`): the city side, the two flanks and the far shore,
 * whose edges on the water are the sea walls. On it the paving (`paving`: [x0, x1, z0, z1] and a
 * colour if it is not the city's stone: the streets and squares, and the park's lawn), and laid
 * into that the patterns (`pattern`: a band [x0, x1, z0, z1, colour, top] or a ring {disc: [x, z,
 * r], color, top}), each a few millimetres higher than whatever it lies on, so none lies flush.
 */
function ground(models,root){
  const {box,cylinder}=models,data=city.place;
  for(const [x0,x1,z0,z1,top] of city.land)box(root,[(x0+x1)/2,top-.95,(z0+z1)/2],[x1-x0,1.9,z1-z0],data.ground);
  for(const [x0,x1,z0,z1,color=data.pave] of city.paving)box(root,[(x0+x1)/2,-.05,(z0+z1)/2],[x1-x0,.1,z1-z0],color);
  for(const p of city.pattern){
    if(p.disc){const [x,z,r]=p.disc;cylinder(root,[x,p.top-.005,z],[2*r,.01,2*r],p.color);continue;}
    const [x0,x1,z0,z1,color,top]=p;
    box(root,[(x0+x1)/2,top-.005,(z0+z1)/2],[x1-x0,.01,z1-z0],color);
  }
}

/** An entity drawing one mesh of its own (a column's flare, the leaves let into it). */
function meshOn(parent,name,mesh,material,shadows=false){
  const e=new pc.Entity(name);parent.addChild(e);
  e.addComponent('render',{castShadows:shadows,receiveShadows:true});
  e.render.meshInstances=[new pc.MeshInstance(mesh,material)];
  return e;
}
/** A mesh from positions, normals and triangles. */
function meshOf(positions,normals,indices){
  const g=new pc.Geometry();g.positions=positions;g.normals=normals;g.indices=indices;
  return pc.Mesh.fromGeometry(pc.Application.getApplication().graphicsDevice,g);
}
/**
 * The facets of a column turned round its axis: frustums stacked up `profile` ([y, radius], bottom
 * up), `sides` round, each facet flat shaded so it catches the light on its own. `each(facet)` is
 * handed every facet: {m (the angle of its middle), y0, y1, r0, r1, n (its outward normal)}.
 */
function facets(profile,sides,each){
  const half=Math.PI/sides;
  for(let k=0;k+1<profile.length;k++){
    const [y0,r0]=profile[k],[y1,r1]=profile[k+1],tip=-(r1-r0)/(y1-y0)*Math.cos(half);
    for(let i=0;i<sides;i++){
      const m=(2*i+1)*half,l=Math.hypot(1,tip);
      each({k,i,m,y0,y1,r0,r1,n:[Math.sin(m)/l,tip/l,Math.cos(m)/l]});
    }
  }
}
/** A trumpet column: a slim stem flaring out into the canopy, eight flat facets round. */
function trumpet(profile){
  const positions=[],normals=[],indices=[],half=Math.PI/8;
  facets(profile,8,({m,y0,y1,r0,r1,n})=>{
    const a=m-half,b=m+half,base=positions.length/3;
    for(const [ang,y,r] of [[a,y0,r0],[b,y0,r0],[b,y1,r1],[a,y1,r1]]){positions.push(Math.sin(ang)*r,y,Math.cos(ang)*r);normals.push(...n);}
    indices.push(base,base+1,base+2,base,base+2,base+3);
  });
  return meshOf(positions,normals,indices);
}
/**
 * The openings let into a trumpet column's flare, as lit leaves standing a hair off its facets:
 * two to a facet on its widest stretch, one on the stretch below (and only the widest on medium).
 */
function leafMesh(profile,high){
  const positions=[],normals=[],indices=[],half=Math.PI/8;
  facets(profile,8,({k,m,y0,y1,r0,r1,n})=>{
    const rows=k===profile.length-2?[-.27,.27]:k===profile.length-3&&high?[0]:[];
    const t=[Math.cos(m),0,-Math.sin(m)],rise=(r1-r0)*Math.cos(half),slant=Math.hypot(rise,y1-y0);
    const v=[Math.sin(m)*rise/slant,(y1-y0)/slant,Math.cos(m)*rise/slant],y=(y0+y1)/2,r=(r0+r1)/2*Math.cos(half)+.03;
    const wide=2*(r0+r1)/2*Math.sin(half),a=rows.length>1?wide*.16:wide*.3,b=slant*.36;
    for(const u of rows){
      const c=[Math.sin(m)*r+t[0]*u*wide,y,Math.cos(m)*r+t[2]*u*wide],base=positions.length/3;
      for(const [du,dv] of [[0,-b],[a,0],[0,b],[-a,0]]){positions.push(c[0]+t[0]*du+v[0]*dv,c[1]+v[1]*dv,c[2]+t[2]*du+v[2]*dv);normals.push(...n);}
      indices.push(base,base+1,base+2,base,base+2,base+3);
    }
  });
  return meshOf(positions,normals,indices);
}

/**
 * 云海市中心站, the heart of the city (after Chongqing East): a white canopy with every edge rounded,
 * held up by trumpet columns that flare out of slim stems into it, leaves of light let into their
 * flare; a warm timber soffit, lit after dark; a glass hall under it, lit from inside; a terrace
 * either side of the main exit with a glass balustrade, reached by escalators rising outward from
 * it; and the name over the front in big red characters, the English beneath. Built with its front
 * on local +z and turned to face the square (city.json `metroStation.building`). The platforms are
 * underground (the yunhai-central room): this is walked round, and the ways down are its exits.
 */
function station(models,leds,parent,level){
  const {box,cylinder,ball}=models,S=city.metroStation.building,high=level==='high',mid=level!=='low';
  const root=new pc.Entity('metro-hall');root.lookName='metro-station';
  root.setLocalPosition(S.x,0,S.z);root.setLocalEulerAngles(0,S.rot??0,0);parent.addChild(root);
  const white='#f2f1ec',steel='#8e959c',hw=S.w/2,hd=S.d/2,thick=1.2,r=thick/2,under=S.h-thick;
  const marks=[],hit=(x,z,hx,hz,y0,y1,name='metro-station')=>marks.push(turn(S,{x,z,hw:hx,hd:hz,y0,y1,name}));
  const group=key=>{const g=new pc.Entity(key);g.lookName=key;root.addChild(g);return g;};
  const paint=(e,material,shadows=false)=>{e.render.meshInstances[0].material=material;e.render.castShadows=shadows;return e;};

  // ---- the canopy: a white slab, every edge rounded, over a timber soffit ----
  const roof=group('roof');
  box(roof,[0,S.h-r,0],[S.w-thick,thick,S.d-thick],white);
  for(const s of [-1,1]){
    cylinder(roof,[0,S.h-r,s*(hd-r)],[thick,S.w-thick,thick],white,[0,0,90]);
    cylinder(roof,[s*(hw-r),S.h-r,0],[thick,S.d-thick,thick],white,[90,0,0]);
    for(const t of [-1,1])ball(roof,[s*(hw-r),S.h-r,t*(hd-r)],[thick,thick,thick],white);
  }
  paint(box(roof,[0,under-.05,0],[S.w-2*thick,.06,S.d-2*thick],'#b98150'),leds.lit('#b98150','#ffb46a',.5));
  if(mid)for(let z=-hd+thick+.45;z<hd-thick;z+=high?.9:1.8)box(roof,[0,under-.13,z],[S.w-2*thick,.06,.1],'#9a6a40').render.castShadows=false;
  leds.piece(roof,[0,under-.03,hd-r],[S.w-thick,.05,.12],leds.strip('#fff1d6'));
  if(mid)for(const x of [-15,-5,5,15])ball(roof,[x,S.h+.2,0],[5,1.2,5],'#dfe6ea');       // skylights

  // ---- the trumpet columns, leaves of light let into their flare ----
  const profile=[[0,.55],[6,.8],[10,2],[under,4.2]],shaft=trumpet(profile),leaves=mid?leafMesh(profile,high):null;
  const stone=models.material(white),glow=leds.lit('#f3dcae','#ffc27a',.95);
  for(const [x,z] of S.columns){
    const c=new pc.Entity('column');c.lookName='pillar';c.setLocalPosition(x,0,z);root.addChild(c);
    meshOn(c,'shaft',shaft,stone,true);
    if(leaves)meshOn(c,'leaves',leaves,glow);
    hit(x,z,.95,.95,0,under,'pillar');
  }

  // ---- the glass hall under the canopy, lit from inside ----
  const [x0,x1,z0,z1,hh]=S.hall,hallW=x1-x0,hallD=z1-z0,cx=(x0+x1)/2,cz=(z0+z1)/2,glass=clearGlass(.28);
  const hall=group('window');
  box(hall,[cx,hh-.2,cz],[hallW,.4,hallD],white);
  paint(box(hall,[cx,(hh-.4)/2,z0+.15],[hallW-.2,hh-.4,.3],'#dcd6ca'),leds.glazing('curtain','#d9d6cf'),true);   // its back: offices behind glass
  box(hall,[cx,6,cz+.6],[hallW-.4,.3,hallD-1.8],'#d9d6cf');                         // a mezzanine inside
  for(const [px,pz,sx,sz] of [[cx,z1-.05,hallW,.04],[x0+.05,cz+.15,.04,hallD-.3],[x1-.05,cz+.15,.04,hallD-.3]])
    paint(box(hall,[px,(hh-.4)/2,pz],[sx,hh-.4,sz],'#cfe3ea'),glass);
  // Mullions run up into the roof and the transoms stop short of the corners, so neither lies flush with the glass.
  if(mid)for(let x=x0+2;x<x1-1;x+=high?2:4)box(hall,[x,(hh-.3)/2,z1],[.1,hh-.3,.16],steel);
  for(const y of [6.5,hh-.52])box(hall,[cx,y,z1],[hallW-.1,.12,.18],steel);
  hit(cx,cz,hallW/2,hallD/2,0,hh);

  // ---- a terrace either side of the main exit: shops under it, a glass balustrade along it,
  // and an escalator rising out to it from beside the exit ----
  const T=S.terrace,E=S.escalator,tz=(T.z[0]+T.z[1])/2,td=T.z[1]-T.z[0],ez=(E.z[0]+E.z[1])/2,ew=E.z[1]-E.z[0];
  const rails=clearGlass(.3),shops=leds.lit('#4a4038','#ffc98e');
  for(const s of [-1,1]){
    const tx=s*(T.x[0]+T.x[1])/2,tw=T.x[1]-T.x[0],lx=s*(E.x[1]+T.x[1])/2,lw=T.x[1]-E.x[1];
    const deck=group('patio');
    box(deck,[tx,T.y/2,tz],[tw,T.y,td],white);
    paint(box(deck,[tx,T.y/2-.3,T.z[1]+.04],[tw-1,T.y-1.4,.06],'#4a4038'),shops);
    box(deck,[tx,T.y+.15,tz],[tw+.3,.3,td+.3],white);
    box(deck,[lx,T.y+.15,(T.z[1]+.15+E.z[1]+.1)/2],[lw+.3,.3,E.z[1]-T.z[1]-.05],white);   // the landing
    const rail=group('railing');
    for(const [ax,bx,z] of [[T.x[0],E.x[1],T.z[1]+.1],[E.x[1],T.x[1],E.z[1]+.1]]){
      paint(box(rail,[s*(ax+bx)/2,T.y+.8,z],[bx-ax,1,.04],'#cfe3ea'),rails);
      box(rail,[s*(ax+bx)/2,T.y+1.33,z],[bx-ax+.1,.06,.1],'#c9ced2');
    }
    if(high)for(let x=T.x[0]+2.5;x<T.x[1]-1;x+=5)box(deck,[s*x,T.y+.6,tz-.6],[1.6,.6,1],'#8f8a80');   // planters
    hit(tx,tz,tw/2+.15,td/2+.15,0,T.y+1.4,'patio');
    hit(lx,(T.z[1]+E.z[1])/2,lw/2+.15,(E.z[1]-T.z[1])/2+.1,T.y-.2,T.y+1.4,'patio');
    // The escalator: a truss sloping up at thirty degrees, glass sides and a handrail each side.
    const run=E.x[1]-E.x[0],len=Math.hypot(run,T.y),climb=Math.atan2(T.y,run)*180/Math.PI;
    const esc=group('escalator');esc.setLocalPosition(s*(E.x[0]+E.x[1])/2,T.y/2,ez);esc.setLocalEulerAngles(0,0,s*climb);
    box(esc,[0,0,0],[len,.5,ew],'#a3a9ae');
    box(esc,[0,.27,0],[len,.04,ew-.5],'#3b4046');
    for(const t of [-1,1]){
      paint(box(esc,[0,.75,t*(ew/2-.12)],[len,.9,.04],'#cfe3ea'),rails);
      box(esc,[0,1.22,t*(ew/2-.12)],[len,.07,.1],'#2b2f34');
    }
    hit(s*(E.x[0]+E.x[1])/2,ez,run/2,ew/2,0,T.y+1.2,'escalator');
  }

  // ---- the name over the front, big and red, the English beneath, on a white board ----
  const cell=2.4,tall=cell*1.55,sy=S.h+tall/2+.3,n=[...S.name].length;
  box(root,[0,sy,hd-.9],[n*cell+.9,tall+.6,.3],white);
  leds.text(root,S.name,[0,sy,hd-.9+.21],cell,{color:'#ff3b2f',sub:S.en});
  return marks;
}

/**
 * A way down into the station (city.json `metroStation.exits`): a glass box over a stair, open
 * where you step out, its roof carrying the metro roundel, the exit's letter and where it leads.
 * It stands just behind the exit's spawn with its mouth towards it, so you come up the stair and
 * step out facing away from it; the E-target at the spawn takes you back down.
 */
function exitPortal(models,leds,parent,exit){
  const {box,cylinder,label}=models,[sx,sz,yaw]=exit.spawn,a=yaw*Math.PI/180,W=5.4,D=6.4,H=2.9;
  const def={x:sx+Math.sin(a)*2.2,z:sz+Math.cos(a)*2.2,rot:yaw+180};
  const root=new pc.Entity('city-metro-exit');root.lookName='metro-station';
  root.setLocalPosition(def.x,0,def.z);root.setLocalEulerAngles(0,def.rot,0);parent.addChild(root);
  const steel='#6f7880',granite='#b3b4ae',glass=clearGlass(.3);
  const paint=(e,m)=>{e.render.meshInstances[0].material=m;e.render.castShadows=false;return e;};
  // The granite floor, the top step, and the dark of the stair going down with its treads fading.
  box(root,[0,.06,-D/2],[W,.12,D],granite);
  const stair=new pc.Entity('stairs');stair.lookName='stairs';root.addChild(stair);
  box(stair,[0,.125,-.55],[3.4,.03,.5],'#c9cbc6');
  box(stair,[0,.125,-(D+.3)/2],[3.4,.03,D-1.3],'#1d2226');
  ['#8d918f','#6b6f6e','#4f5352','#3a3e3e'].forEach((c,i)=>box(stair,[0,.15,-1.1-i*.55],[3.3,.02,.08],c));
  for(const s of [-1,1]){
    box(root,[s*1.85,.595,-(D+.3)/2],[.2,.95,D-1.3],granite);
    paint(box(root,[s*(W/2-.05),1.51,-D/2],[.04,H-.3,D-.2],'#cfe3ea'),glass);
    for(const z of [-.12,-D/2,-D+.12])box(root,[s*(W/2-.05),(H+.12)/2,z],[.12,H-.12,.12],steel);   // up to the roof
  }
  paint(box(root,[0,1.51,-D+.05],[W-.2,H-.3,.04],'#cfe3ea'),glass);
  // The roof reaches out over the way out, lit along its front edge.
  box(root,[0,H+.12,-D/2+.45],[W+.5,.24,D+.9],'#e9ebea');
  leds.piece(root,[0,H-.03,.85],[W+.3,.05,.08],leds.light('#e6eef5'));
  // The sign band: the roundel, the exit's letter and where it leads, lit from within after dark.
  const band=new pc.Entity('sign');band.lookName='sign';root.addChild(band);
  box(band,[0,H+.62,.78],[W+.5,.76,.14],'#1f3552');
  cylinder(band,[-W/2+.55,H+.62,.87],[.5,.03,.5],'#f2f5f7',[90,0,0]);
  cylinder(band,[-W/2+.55,H+.62,.89],[.38,.03,.38],'#2c68b0',[90,0,0]);
  box(band,[-W/2+.55,H+.62,.91],[.07,.27,.02],'#f2f5f7');
  // Both read from across the square, the way you look for your exit.
  backlight(label(band,exit.zh,[-.62,H+.62,.88],1.5,.44,'#f0c43a','#1f3552'),.8).lookReach=30;
  backlight(label(band,exit.to.zh,[1.5,H+.62,.88],2.3,.44,'#1f3552','#f4f7fa'),.8).lookReach=30;
  // Solid: the glass walls and the roof, and the stairwell past the top step (you go down by the
  // exit's E-target, not by walking off the edge). Unnamed: a look finds the stair, a sign, or the
  // exit itself (地铁站).
  const at=(x,z,hw,hd,y0,y1)=>turn(def,{x,z,hw,hd,y0,y1,name:null});
  return [at(-W/2+.05,-D/2,.12,D/2,0,H),at(W/2-.05,-D/2,.12,D/2,0,H),at(0,-D+.05,W/2,.12,0,H),
    at(0,-D/2+.45,W/2+.25,(D+.9)/2,H,H+.3),at(0,-(D+.3)/2,1.95,(D-1.3)/2,0,1.1)];
}

/**
 * City street furniture: steel, concrete and light, deliberately not the town's timber. Returns
 * its hitboxes in its own frame (see `turn`); a lamp's glow is shared with every lamp of its colour.
 */
function cityProp(models,leds,parent,def){
  const {box,cylinder,ball,label}=models;
  const e=new pc.Entity('city-'+def.kind);
  e.setLocalPosition(def.x,0,def.z);e.setLocalEulerAngles(0,def.rot??0,0);parent.addChild(e);
  const k=def.kind;
  if(k==='citylamp'){
    // One arm, out over the road or the lane it lights, so the pole stays on the kerb line.
    cylinder(e,[0,.1,0],[.5,.2,.5],'#6d7278');
    cylinder(e,[0,2.9,0],[.18,5.6,.18],'#8d939a');
    box(e,[.8,5.5,0],[1.6,.14,.14],'#8d939a').lookName='streetlight';
    const head=box(e,[1.5,5.36,0],[.9,.2,.46],'#e9f0f6');head.lookName='streetlight';
    head.render.meshInstances[0].material=leds.light('#e8f1ff');
    return [{hw:.3,hd:.3,y1:5.7}];
  }
  if(k==='promenadelamp'){
    // Slim poles along the railing, their heads leaning in over the promenade.
    cylinder(e,[0,.08,0],[.36,.16,.36],'#6d7278');
    cylinder(e,[0,2.4,0],[.12,4.8,.12],'#9aa1a8');
    box(e,[0,4.82,.3],[.12,.08,.72],'#9aa1a8').lookName='streetlight';
    const head=box(e,[0,4.74,.62],[.34,.1,.34],'#eef4ff');head.lookName='streetlight';
    head.render.meshInstances[0].material=leds.light('#fff1d6');
    return [{hw:.2,hd:.2,y1:5}];
  }
  if(k==='citytree'){
    // A street tree, or (`tree`) any of the town's kinds: willows round the park's pond.
    e.setLocalEulerAngles(0,Math.abs(def.x*37+def.z*53)%360,0);
    models.tree(e,0,0,def.size??1.05,def.tree);
    return [{hw:.35,hd:.35,y1:3.6}];
  }
  if(k==='cityplanter'){
    box(e,[0,.34,0],[2.6,.68,1.5],'#9c9a94');
    box(e,[0,.7,0],[2.3,.12,1.2],'#5d6b52');
    for(const x of [-.7,0,.7]){
      cylinder(e,[x,1.35,0],[.14,1.4,.14],'#6b6250').lookName='tree';
      ball(e,[x,2.15,0],[1.3,1.1,1.1],'#6d8a5c').lookName='tree';
    }
    return [{hw:1.35,hd:.8,y1:1.1}];
  }
  if(k==='citybench'){
    for(const x of [-1.1,1.1])box(e,[x,.24,0],[.18,.48,.7],'#7d848b');
    for(let i=0;i<5;i++)box(e,[0,.48,-.28+i*.14],[2.5,.09,.11],'#98a0a7');
    box(e,[0,.86,-.36],[2.5,.5,.1],'#98a0a7',[14,0,0]);
    return [{hw:1.3,hd:.5,y1:.95}];
  }
  if(k==='bin'){
    box(e,[0,.5,0],[.56,1,.56],'#7c838a');
    box(e,[0,1.04,0],[.66,.1,.66],'#5f666c');
    box(e,[0,.86,.29],[.3,.22,.06],'#464c52');
    return [{hw:.34,hd:.34,y1:1.1}];
  }
  const low=detail()==='low',paint=(one,material)=>{one.render.meshInstances[0].material=material;one.render.castShadows=false;return one;};
  if(k==='pool'){
    // The boulevard's water: a long shallow pool in a granite kerb, dark stone under still water,
    // and low jets down its middle. Its hitbox stands a little above the kerb, so nobody steps in.
    e.lookName='fountain';
    const {w,d}=def,rim='#b9b4a8';
    for(const s of [-1,1]){
      box(e,[s*(w/2-.15),.25,0],[.3,.5,d],rim);
      box(e,[0,.25,s*(d/2-.15)],[w-.6,.5,.3],rim);
    }
    box(e,[0,.1,0],[w-.6,.2,d-.6],'#34454d');
    paint(box(e,[0,.36,0],[w-.6,.02,d-.6],'#79aaa8'),models.waterMaterial());
    if(!low)for(let z=-d/2+1.4;z<=d/2-1.3;z+=2.5)paint(models.shape(e,'cone',[0,.66,z],[.12,.6,.12],'#eaf7ff',[180,0,0]),spray());
    return [{hw:w/2,hd:d/2,y1:.6}];
  }
  if(k==='fountain'){
    // A round basin on a square: a granite rim in twenty stones, still water, a stone bowl on a
    // stem in the middle with a spray rising out of it.
    e.lookName='fountain';
    const R=def.radius??5,n=20;
    for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2;
      box(e,[Math.sin(a)*(R-.2),.3,Math.cos(a)*(R-.2)],[2*(R-.2)*Math.tan(Math.PI/n)+.05,.6,.4],'#b9b4a8',[0,a*180/Math.PI,0]);
    }
    cylinder(e,[0,.1,0],[2*R-.6,.2,2*R-.6],'#34454d');
    paint(cylinder(e,[0,.45,0],[2*R-.7,.02,2*R-.7],'#79aaa8'),models.waterMaterial());
    cylinder(e,[0,.95,0],[.7,1.9,.7],'#c9c4b8');
    cylinder(e,[0,2,0],[2.6,.3,2.6],'#c9c4b8');
    if(!low)paint(models.shape(e,'cone',[0,3.3,0],[1.5,2.4,1.5],'#eaf7ff'),spray());
    return [{hw:R,hd:R*.42,y1:.7},{hw:R*.42,hd:R,y1:.7},{hw:R*.72,hd:R*.72,y1:.7}];
  }
  if(k==='pond'){
    // The park's pond, its ends rounded: still water edged with stones, lotus on it. Its hitbox
    // follows the rounded ends (an octagon each), so the path round it is clear to the edge.
    e.lookName='pond';
    const {w,d}=def,r=d/2,run=(w-d)/2;
    paint(box(e,[0,.1,0],[w-d,.02,d-.6],'#79aaa8'),models.waterMaterial());
    for(const s of [-1,1])paint(cylinder(e,[s*run,.1,0],[d-.6,.02,d-.6],'#79aaa8'),models.waterMaterial());
    const stones=[];
    for(let x=-run;x<=run+.01;x+=1.3)for(const s of [-1,1])stones.push([x,s*(r-.3),0]);
    for(const s of [-1,1])for(let i=1;i<12;i++){const a=i/12*Math.PI;stones.push([s*(run+Math.sin(a)*(r-.3)),Math.cos(a)*(r-.3),s*a]);}
    stones.forEach(([x,z,a],i)=>models.shape(e,'sphere',[x,.14,z],[1.1,.34,.7],i%2?'#b3ab98':'#9d968a',[0,a*180/Math.PI,0]));
    for(const [x,z,flower] of def.lotus??[]){
      cylinder(e,[x,.12,z],[.9,.03,.9],'#7f9e6a');
      if(flower)ball(e,[x+.12,.3,z+.08],[.32,.3,.32],'#e3a1b8');
    }
    const out=[{hw:run,hd:r,y1:.6}];
    for(const s of [-1,1])out.push({x:s*run,hw:r,hd:r*.42,y1:.6},{x:s*run,hw:r*.42,hd:r,y1:.6},{x:s*run,hw:r*.72,hd:r*.72,y1:.6});
    return out;
  }
  if(k==='pavilion'){
    // A pavilion by the water after the station: four white posts under a white roof on a warm
    // timber soffit, lit after dark, and a bench inside.
    e.lookName='pavilion';
    const s=def.size??5,h=3.3;
    for(const x of [-1,1])for(const z of [-1,1])box(e,[x*(s/2-.3),(h-.06)/2,z*(s/2-.3)],[.3,h-.06,.3],'#f2f1ec');
    box(e,[0,h+.2,0],[s+.8,.4,s+.8],'#f2f1ec');
    paint(box(e,[0,h-.03,0],[s+.4,.06,s+.4],'#b98150'),leds.lit('#b98150','#ffb46a',.5));
    box(e,[0,.08,0],[s,.16,s],'#c9c2b0');
    for(const x of [-1.1,1.1])box(e,[x,.4,-s/2+.9],[.18,.48,.5],'#7d848b');
    box(e,[0,.68,-s/2+.9],[2.6,.08,.6],'#a67c52');
    return [{hw:s/2,hd:s/2,y1:.16,name:'floor'},...[-1,1].flatMap(x=>[-1,1].map(z=>({x:x*(s/2-.3),z:z*(s/2-.3),hw:.2,hd:.2,y1:h}))),
      {z:-s/2+.9,hw:1.3,hd:.35,y0:.16,y1:.72,name:null}];   // not the crowd's to sit on: it stands on the floor
  }
  if(k==='flowerbed'){
    // A raised bed of flowers in a granite kerb.
    e.lookName='planter';
    const {w,d}=def,colors=def.colors??['#e3a1b8','#f2d27a','#e46c5a','#b98fd6'],step=low?.9:.45;
    box(e,[0,.2,0],[w,.4,d],'#b9b4a8');
    box(e,[0,.46,0],[w-.3,.14,d-.3],'#5f7d4f');
    let i=0;
    for(let x=-w/2+.4;x<w/2-.3;x+=step)for(let z=-d/2+.4;z<d/2-.3;z+=step,i++)
      box(e,[x,.6,z],[.16,.16,.16],colors[i%colors.length],[0,45,0]);
    return [{hw:w/2,hd:d/2,y1:.5}];
  }
  if(k==='rockery'){
    models.rockery(e,{x:0,z:0,r:def.r??1.2,h:def.h??1.4});
    return [{hw:def.r??1.2,hd:(def.r??1.2)*.85,y1:def.h??1.4}];
  }
  if(k==='shopfront'){
    // A small shop on the food street: two storeys, its window lit, an awning out over the
    // pavement, its name in neon over the window. Not a way in: its lit window says it is open.
    e.lookName=def.name??'shop';
    const {w,d}=def,h=def.h??7,f=d/2,[c1,c2]=def.awning??['#f1e6d0','#b8392f'],sw=Math.min(w-1.2,6.2);
    box(e,[0,h/2,0],[w,h,d],def.color??'#c9b9a2');
    paint(box(e,[0,1.9,f+.03],[w-1.2,2.9,.06],'#4a4038'),leds.lit('#4a4038','#ffc98e'));
    paint(box(e,[0,h-1.2,f+.03],[w-1.2,1.4,.06],'#5c6670'),leds.glazing('home'));
    const slats=low?4:8,aw=w-.8;
    for(let i=0;i<slats;i++)box(e,[-aw/2+(i+.5)*aw/slats,3.62,f+.95],[aw/slats+(i%2?.01:0),.08+(i%2?.01:0),1.9],i%2?c1:c2,[16,0,0]);
    box(e,[0,4.45,f+.08],[sw+.2,1.1,.1],'#1b1e24');
    leds.neon(e,def.sign,[0,4.45,f+.19],[sw,.9],{color:def.neon??'#ffcf7a',seed:def.x});
    return [{hw:w/2+.1,hd:f+.1,y1:h}];
  }
  if(k==='arch'){
    // A gateway over the food street: red posts on granite plinths, a dark beam with the street's
    // name lit on both faces, and a red ridge on top.
    e.lookName='paifang';
    const half=def.span/2,h=6.2;
    for(const s of [-1,1]){
      box(e,[s*half,h/2,0],[.7,h,.7],'#a8322b');
      box(e,[s*half,.3,0],[1.1,.6,1.1],'#8f8a80');
    }
    box(e,[0,h+.6,0],[def.span+1.4,1.6,.8],'#1c2129');
    leds.text(e,def.text,[0,h+.6,.46],1.1,{color:'#ffd36b',reach:60});
    leds.text(e,def.text,[0,h+.6,-.46],1.1,{color:'#ffd36b',reach:60,rot:180});
    box(e,[0,h+1.55,0],[def.span+2.2,.3,1.3],'#a8322b');
    return [{x:-half,hw:.55,hd:.55,y1:h},{x:half,hw:.55,hd:.55,y1:h}];
  }
  // The kiosk is roofed well above head height, so standing under it (or swinging the camera past
  // it) never feels like ducking under a low shed.
  if(k==='citykiosk'){
    box(e,[0,1.6,0],[3.4,3.2,2.4],'#8b9299');
    box(e,[0,3.35,0],[3.8,.3,2.8],'#6e757c');
    const glass=box(e,[0,1.6,1.24],[2.6,1.7,.08],'#cfe0e6');
    glass.render.meshInstances[0].material=leds.light('#f3ead0');
    box(e,[0,.62,1.3],[2.8,.18,.5],'#a9b0b6');
    backlight(label(e,'便利店',[0,2.9,1.45],2.4,.66,'#2f4436','#ecf3e4'),.8);
    return [{hw:1.9,hd:1.5,y1:3.5}];
  }
  if(k==='gate'){
    // The welcome gate across the end of the avenue: two steel posts beyond the pavements and a
    // screen high enough to walk under, welcoming you on the side you arrive from and wishing you
    // a safe journey on the side you leave by.
    e.lookName=def.name;
    for(const side of [-1,1]){
      box(e,[side*12.25,5.6,0],[1.7,11.2,.9],'#6f767d');
      // A couplet down the posts, the way one hangs either side of a gateway, reading left to right
      // like the words across the top: the first line on the left from whichever side you face it.
      const [south,north]=side<0?def.couplet:[...def.couplet].reverse();
      leds.text(e,south,[side*12.25,5,.5],1.3,{color:'#ff5a4a',vertical:true,reach:60});
      leds.text(e,north,[side*12.25,5,-.5],1.3,{color:'#ff5a4a',vertical:true,reach:60,rot:180});
    }
    box(e,[0,10.1,0],[25.8,4.6,.8],'#1c2129');
    for(const y of [7.75,12.45])leds.piece(e,[0,y,0],[25.9,.3,.98],leds.runner);
    leds.text(e,def.text,[0,10.1,.46],3.2,{color:'#ffe9b8',reach:80});
    leds.text(e,def.back,[0,10.1,-.46],3.2,{color:'#aee6ff',reach:80,rot:180});
    return [{x:-12.25,hw:.85,hd:.5,y1:11.3},{x:12.25,hw:.85,hd:.5,y1:11.3}];
  }
  if(k==='ledsign'){
    // A granite plinth with a dark slab set on it and the name lit into the slab.
    const w=[...def.text].length*def.cell+.8,h=def.cell+.5;
    box(e,[0,.25,0],[w+.4,.5,.9],'#8f8a80').lookName='sign';
    box(e,[0,.5+h/2,-.05],[w,h,.5],'#2a2f36').lookName='sign';
    leds.text(e,def.text,[0,.5+h/2,.22],def.cell,{color:def.color,reach:40});
    // The plinth, and the slab above it only as deep as the slab, so its lit name stands proud of it.
    return [{hw:(w+.4)/2,hd:.45,y1:.5},{z:-.05,hw:w/2,hd:.25,y0:.5,y1:.5+h}];
  }
  if(k==='droneboard'){
    // When the drones fly (drones.json `times`, so the board and the show never disagree): the
    // board by the plaza, lit after dark like everything else here.
    e.lookName=def.name;
    for(const x of [-1.5,1.5])box(e,[x,1.2,0],[.14,2.4,.14],'#6f767d');
    box(e,[0,2.35,-.04],[3.6,2.1,.16],'#1c2129');
    leds.text(e,def.text,[0,2.35,.09],.66,{color:'#ffd36b',sub:drones.times.map(show=>clockText(show.at)).join(' · '),reach:40});
    return [{z:-.04,hw:1.8,hd:.12,y1:3.4}];                 // the case: its lit face stands proud of it
  }
  return [];
}
/** Water thrown up by a jet, pale and see-through, shared by every fountain. */
let sprayMaterial=null;
function spray(){
  if(!sprayMaterial){
    const m=new pc.StandardMaterial();
    m.diffuse=new pc.Color().fromString('#eaf7ff');m.emissive=new pc.Color(.12,.14,.16);m.opacity=.35;
    m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.gloss=.8;m.useMetalness=true;m.metalness=0;m.update();
    sprayMaterial=m;
  }
  return sprayMaterial;
}

/**
 * The promenade along the bay: granite paving whose face on the water side is the sea wall, a
 * path curving either side of the plaza with a line of light set into each edge, the plaza with a
 * ring of lights in its floor, and a glass railing along the water with a light under its rail.
 */
function promenade(models,leds,root){
  const {box,cylinder}=models,p=city.promenade,[x0,x1]=p.x,[z0,z1]=p.z,mid=(x0+x1)/2,half=p.path.width/2;
  const g=new pc.Entity('promenade');root.addChild(g);
  box(g,[mid,-.99,(z0+z1)/2],[x1-x0,2.02,z1-z0],'#b9b5ab').lookName='path';
  const {x:px,z:pz,radius}=p.plaza;
  cylinder(g,[px,.03,pz],[radius*2,.02,radius*2],'#d2cbbb').lookName='square';
  for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2,x=px+Math.cos(a)*(radius-.6),z=pz+Math.sin(a)*(radius-.6);
    if(Math.abs(z-promenadeZ(p,x))>half+.3)leds.piece(g,[x,.045,z],[.34,.02,.34],leds.washes[2],[0,-a*180/Math.PI,0]);
  }
  const path=new pc.Entity('path');path.lookName='path';g.addChild(path);
  const edge=leds.light('#86d6ff');
  for(let x=x0;x<x1-.01;x+=1.25){
    const xb=Math.min(x+1.25,x1),za=promenadeZ(p,x),zb=promenadeZ(p,xb);
    const seg=new pc.Entity('path');seg.setLocalPosition((x+xb)/2,0,(za+zb)/2);
    seg.setLocalEulerAngles(0,-Math.atan2(zb-za,xb-x)*180/Math.PI,0);path.addChild(seg);
    const len=Math.hypot(xb-x,zb-za)+.05;
    box(seg,[0,.05,0],[len,.02,p.path.width],'#8e9aa4');
    for(const side of [-1,1])leds.piece(seg,[0,.07,side*(half-.1)],[len,.02,.1],edge);
  }
  const rail=new pc.Entity('railing');rail.lookName='railing';g.addChild(rail);
  // The railing opens where a pier leads off the promenade (`gaps`, [x0, x1]: the ferry pier, src/world/harbour.js).
  const gaps=p.gaps??[],spans=[];let from=x0;
  for(const [a,b] of gaps){spans.push([from,a]);from=b;}
  spans.push([from,x1]);
  for(let x=x0+.3;x<x1;x+=2.5)if(!gaps.some(([a,b])=>x>a-.3&&x<b+.3))box(rail,[x,.56,p.railing],[.09,1.12,.09],'#8f979e');
  for(const [a,b] of gaps)for(const x of [a-.05,b+.05])box(rail,[x,.56,p.railing],[.09,1.12,.09],'#8f979e');
  const glass=new pc.StandardMaterial();
  glass.diffuse=new pc.Color().fromString('#cfe3ea');glass.opacity=.22;glass.blendType=pc.BLEND_NORMAL;
  glass.depthWrite=false;glass.gloss=.9;glass.useMetalness=true;glass.metalness=.2;glass.update();
  for(const [a,b] of spans){
    const c=(a+b)/2;
    box(rail,[c,1.14,p.railing],[b-a,.06,.14],'#b0b8be');
    leds.piece(rail,[c,1.08,p.railing+.04],[b-a,.035,.05],edge);
    const pane=box(rail,[c,.6,p.railing],[b-a,.9,.025],'#cfe3ea');
    pane.render.meshInstances[0].material=glass;pane.render.castShadows=false;
  }
}

/**
 * The skyline across the bay (a backdrop, never walked on): the towers city.json names, 云海中心
 * among them, and rows of others filled in round them, lower in front and taller behind, each with
 * a seeded choice of LEDs. The whole of it shows in the bay (bay.js `reflect`). Nobody reaches it,
 * but each tower is solid, so what stands behind it is hidden from a look across the water too.
 */
function skyline(models,leds,root){
  const s=city.skyline,next=random(s.seed),g=new pc.Entity('skyline'),marks=[];root.addChild(g);
  const solid=({x,z,w,d,h})=>marks.push({x,z,hw:w/2+.05,hd:d/2+.05,y0:0,y1:h+3.5,name:'tower'});
  // The filled-in towers also keep off `keepClear` ([x0, x1, z0, z1]: the far landing, src/world/harbour.js).
  const clear=(s.keepClear??[]).map(([x0,x1,z0,z1])=>({x:(x0+x1)/2,z:(z0+z1)/2,w:x1-x0,d:z1-z0}));
  const placed=[],fits=(x,z,w,d)=>![...placed,...clear].some(o=>Math.abs(x-o.x)<(w+o.w)/2+3&&Math.abs(z-o.z)<(d+o.d)/2+3);
  const bound=({x,z,w,d})=>root.skylineBounds.push({x,z,hw:w/2+.6,hd:d/2+.6});
  for(const def of s.towers){
    placed.push(def);bound(def);
    if(def.landmark)marks.push(...landmark(models,leds,g,def));
    else{glassTower(models,leds,g,{color:BODY[placed.length%BODY.length],...def},placed.length);solid(def);}
  }
  const body=BODY,glass=GLASS;
  const rows=[[-182,30,58],[-202,44,86],[-222,58,110]];                 // front to back: z, lowest, tallest
  for(let i=0,tries=0;i<s.fill&&tries<s.fill*30;tries++){
    const [row,low,high]=rows[tries%3],w=12+next()*10,d=10+next()*5;   // a full row never stalls the others
    const x=s.x[0]+w/2+next()*(s.x[1]-s.x[0]-w),z=row+(next()-.5)*4;
    if(!fits(x,z,w,d))continue;
    const h=low+next()*(high-low),L={};
    if(next()<.45)L.bands=[Math.round(h*.35),Math.round(h*.7)].slice(0,1+Math.floor(next()*2));
    if(next()<.35)L.edges=true;
    if(next()<.4)L.crown=Math.floor(next()*3);
    if(next()<.3)L.screen={y0:Math.round(h*.3),y1:Math.round(h*.72),wash:Math.floor(next()*3)};
    else if(next()<.45)L.stripes=true;
    const def={x,z,w,d,h,color:body[i%body.length],glass:glass[i%glass.length],leds:L};
    placed.push(def);bound(def);solid(def);i++;
    glassTower(models,leds,g,def,tries+7);
  }
  // The far shore's own waterfront: a line of lamps along its sea wall, broken where a `keepClear`
  // stretch comes down to it (the harbour's far landing has lamps and a railing of its own).
  const shore=s.shore-.6,runs=[];let from=s.x[0]-10;
  for(const [a,b,z0,z1] of [...s.keepClear??[]].sort((p,q)=>p[0]-q[0]))if(shore>=z0&&shore<=z1){runs.push([from,a]);from=b;}
  runs.push([from,s.x[1]+10]);
  for(const [a,b] of runs)if(b>a)leds.piece(g,[(a+b)/2,.42,shore],[b-a,.1,.1],leds.light('#ffe2a8'));
  reflect(g);
  return marks;
}

/** Where the ground ends over open land rather than at the railing, the hill or a building, a low
 *  granite wall with a clipped hedge along it says so (city.json `edges`). */
function edges(models,root){
  for(const [x0,x1,z0,z1] of city.edges){
    const x=(x0+x1)/2,z=(z0+z1)/2;
    models.box(root,[x,.3,z],[x1-x0,.6,z1-z0],'#8f8a80').lookName='wall';
    models.box(root,[x,.85,z],[x1-x0-.1,.5,z1-z0-.1],'#5f7d52').lookName='hedge';
  }
}

/**
 * Blocks round the edge (city.json `backdrop`): lit floors and now and then a band of light, no
 * detail, no collision, clear of everywhere you can walk; and hills beyond the bay's west end.
 */
function backdrop(models,leds,root,level){
  const b=city.backdrop,next=random(b.seed),style=random(b.seed+1),placed=[...city.towers];
  const fits=(x,z,w,d)=>!placed.some(o=>Math.abs(x-o.x)<(w+(o.w??0))/2+4&&Math.abs(z-o.z)<(d+(o.d??0))/2+4);
  for(const [x0,x1,z0,z1,count] of b.zones)
    for(let i=0,tries=0;i<count&&tries<count*30;tries++){
      const w=10+next()*12,d=10+next()*12,x=x0+w/2+next()*(x1-x0-w),z=z0+d/2+next()*(z1-z0-d);
      if(!fits(x,z,w,d))continue;
      const h=18+next()*46,def={x,z,w,d,h};
      next();                                // the old choice of a band, so the blocks stand where they did
      placed.push(def);i++;
      block(models,leds,root,def,style,level);
      root.skylineBounds.push({x,z,hw:w/2+.6,hd:d/2+.6});
    }
  for(const [x,z,r,h] of b.hills)models.shape(root,'cone',[x,-.5,z],[r*2,h,r*2],'#5e7162').name='hill';
}

export function buildCity(models,parent,town=null){
  const root=new pc.Entity('city');root.setLocalPosition(CITY_OFFSET,0,0);parent.addChild(root);
  root.skylineBounds=[];                     // backdrop, never looked at up close (names.spec.js)
  const level=detail(),marks=[];
  const leds=createLeds(models,{origin:CITY_OFFSET,hour:()=>town?.daylight?.hour??21});

  ground(models,root);
  // Each structure's hitboxes carry a `group`: its parts (a tower and its wings, a pavilion's floor
  // and posts, an exit's walls) meet or overlap by design, unlike two separate things.
  const one=(list,group)=>list.map(m=>({...m,group}));
  marks.push(...one(station(models,leds,root,level),'metro-hall'));
  for(const exit of city.metroStation.exits)marks.push(...one(exitPortal(models,leds,root,exit),'metro-exit-'+exit.id));
  for(const def of city.towers){
    marks.push(...one(wings(models,leds,root,def),def.id));
    if(def.drawnBy)continue;   // a city part draws it (星光百货: src/world/mall.js); the entry is its place and size
    const made=building(models,leds,root,def,level);
    reflect(made.root);marks.push(...one(made.marks,def.id));
  }
  city.props.forEach((def,i)=>{for(const hit of cityProp(models,leds,root,def))marks.push({...turn(def,hit),group:'prop-'+i});});
  promenade(models,leds,root);
  edges(models,root);
  marks.push(...skyline(models,leds,root));
  backdrop(models,leds,root,level);
  const beams=searchlights(models,leds,root,level);
  const people=city.people.map(def=>{
    const made=models.person(root,def.color,[def.x,0,def.z],false,undefined,{mix:'city'});   // Yunhai's people (people.json)
    made.entity.setLocalEulerAngles(0,def.rot??0,0);
    return {...def,...made,leg:0};
  });
  return {root,marks,people,lamps:leds.lamps,data:city.place,update:dt=>{leds.update(dt);beams(dt);}};
}
// The metro entrance on 青禾广场 (buildStationEntrance) is built with the stations: src/world/metro-station.js.
