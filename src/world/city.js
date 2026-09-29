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

  // ---- the entrance: a door in a portal, lit lobby glass behind it, and a canopy ----
  const lit={colonnade:1.55,books:.4,lobby:.75,marquee:.4,stone:0}[P.style]??.6;
  if(P.style!=='stone'){
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
  for(const [share,tall] of [[1,34],[.89,32],[.77,30],[.64,22],[.5,14]]){
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
 * whose edges on the water are the sea walls; downtown's pavement and the back street to the hill;
 * the carriageway between its kerbs with a dashed centre line; and the station forecourt.
 */
function ground(models,root){
  const {box}=models,data=city.place,{road:[rx0,rx1,rz0,rz1],asphalt,kerb}=city.street;
  for(const [x0,x1,z0,z1,top] of city.land)box(root,[(x0+x1)/2,top-.95,(z0+z1)/2],[x1-x0,1.9,z1-z0],data.ground);
  const [dx0,dx1,dz0,dz1]=city.street.pavement;
  box(root,[(dx0+dx1)/2,-.05,(dz0+dz1)/2],[dx1-dx0,.1,dz1-dz0],data.pave);
  const mid=(rz0+rz1)/2,long=rz1-rz0;
  box(root,[(rx0+rx1)/2,.015,mid],[rx1-rx0,.03,long],asphalt);
  // The kerbs, stepping out round each taxi lay-by.
  const kerbs=[[rx0,rz0,rz1]];
  let from=rz0;
  for(const [bx0,bx1,bz0,bz1] of city.street.bays){
    box(root,[(bx0+bx1)/2,.015,(bz0+bz1)/2],[bx1-bx0,.03,bz1-bz0],asphalt);
    box(root,[bx1,.04,(bz0+bz1)/2],[.22,.08,bz1-bz0+.2],kerb);
    box(root,[(bx0+bx1)/2,.04,bz0],[bx1-bx0+.22,.08,.22],kerb);
    kerbs.push([rx1,from,bz0]);from=bz1;
  }
  kerbs.push([rx1,from,rz1]);
  for(const [x,z0,z1] of kerbs)if(z1>z0)box(root,[x,.04,(z0+z1)/2],[.22,.08,z1-z0+.2],kerb);
  for(let z=rz0+2;z<rz1-1;z+=4)box(root,[0,.04,z],[.2,.02,2.2],'#dfe1dd');
  box(root,[0,.01,26],[30,.02,10],'#b3b3ab');                            // the station forecourt
}

/**
 * The headhouse you arrive in and leave through.
 *
 * It is open to the street on the avenue side, because a station you cannot see into is just a
 * wall: the concourse, the sign and the stair down to the platform all have to be visible from
 * out on the pavement, or nobody would guess that is how you get home.
 */
function station(models,leds,parent){
  const {box,cylinder,label}=models;
  const root=new pc.Entity('metro-hall');root.lookName='metro-station';root.setLocalPosition(0,0,30.5);parent.addChild(root);
  box(root,[0,.15,0],[13,.3,7.4],'#b0b2ae');
  for(const side of [-1,1]){
    box(root,[side*6,2.4,0],[.7,4.8,7.2],'#9299a1');                 // side piers
    box(root,[side*4.4,2.35,-3.4],[2.5,4.7,.4],'#a9bcc6');           // glazing flanking the mouth
  }
  box(root,[0,4.5,-3.4],[9,.6,.5],'#8e959c');                        // the header over the way in
  box(root,[0,2.35,3.45],[12.4,4.7,.4],'#a9bcc6');                   // the back of the concourse
  for(let i=0;i<5;i++)cylinder(root,[0,4.9,-3+i*1.6],[.22,12.4,.22],'#8e959c',[0,0,90]);
  box(root,[0,5.15,0],[12.9,.4,7.4],'#c3d2d8');
  // The stair down to the platform: you never go down it, but it has to look like you could.
  for(let i=0;i<6;i++)box(root,[0,.14-i*.24,1.1+i*.5],[5.4,.26,.55],'#9fa4a6').lookName='stairs';
  for(const side of [-1,1])box(root,[side*2.9,.75,2.1],[.14,1.2,3],'#c2c8cb');
  const sign=label(root,'地铁 1 号线',[0,3.5,-3.62],6.4,1.3,'#20303f','#dfe9f2');
  sign.setLocalPosition(0,3.5,-3.66);backlight(sign);
  leds.piece(root,[0,2.6,-3.64],[6.4,.18,.14],leds.light('#5b93c8'));
  return [
    {x:-6,z:30.5,hw:.5,hd:3.7,y0:0,y1:5.2,name:'metro-station'},
    {x: 6,z:30.5,hw:.5,hd:3.7,y0:0,y1:5.2,name:'metro-station'},
    {x:-4.4,z:27.1,hw:1.4,hd:.3,y0:0,y1:5.2,name:'metro-station'},
    {x: 4.4,z:27.1,hw:1.4,hd:.3,y0:0,y1:5.2,name:'metro-station'},
    {x:0,z:34,hw:6.3,hd:.3,y0:0,y1:5.2,name:'metro-station'},
    // The stair mouth is a hole in the floor; the balustrade round it is what stops you.
    {x:0,z:32,hw:3.1,hd:2.2,y0:0,y1:1.3,name:'metro-station'},
  ];
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
    e.setLocalEulerAngles(0,Math.abs(def.x*37+def.z*53)%360,0);
    models.tree(e,0,0,1.05);
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
  if(k==='citycrossing'){
    for(let i=-2;i<=2;i++)box(e,[i*1.3,.045,0],[.75,.02,4.4],'#e2e4e2');
    // Paint, not an obstacle: a named patch of road that says where to cross.
    return [{hw:3.6,hd:2.2,y0:-.2,y1:.05,solid:false}];
  }
  if(k==='trafficlight'){
    cylinder(e,[0,.1,0],[.44,.2,.44],'#5f656b');
    cylinder(e,[0,1.9,0],[.16,3.6,.16],'#71777d');
    box(e,[0,3.5,.2],[.42,1.15,.42],'#3a4046');
    const colors=['#d4574f','#e0b652','#6fb072'];
    for(let i=0;i<3;i++){
      const bulb=ball(e,[0,3.9-i*.36,.42],[.24,.24,.12],colors[i]);bulb.lookName='traffic-light';
      if(i===2)bulb.render.meshInstances[0].material=leds.light(colors[i]);
    }
    return [{hw:.3,hd:.3,y1:4.2}];
  }
  // The shelter and the kiosk are roofed well above head height, so standing under them (or
  // swinging the camera past them) never feels like ducking under a low shed.
  if(k==='cityshelter'){
    for(const x of [-2.4,2.4])cylinder(e,[x,1.6,0],[.16,3.2,.16],'#868d94');
    box(e,[0,3.25,0],[5.4,.16,2.2],'#b8c8d0');
    box(e,[0,1.6,-1.0],[5.2,3.0,.1],'#c3d3da');
    for(let i=0;i<4;i++)box(e,[-1.6+i*1.05,.6,-.7],[.9,.1,.5],'#98a0a7');
    backlight(label(e,'公交站',[1.9,2.3,.98],1.7,.6,'#26333f','#e2ecf3'),.7);
    return [{hw:2.8,hd:1.2,y1:3.45}];
  }
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
  if(k==='taxi'){
    box(e,[0,.62,0],[1.9,.72,4.3],'#d8c06a');
    box(e,[0,1.25,-.25],[1.7,.66,2.3],'#e3ddd2');
    box(e,[0,1.66,-.3],[.7,.2,.5],'#3d4650');
    for(const [x,z] of [[-.95,1.4],[.95,1.4],[-.95,-1.4],[.95,-1.4]])
      cylinder(e,[x,.34,z],[.68,.26,.68],'#3a3f45',[0,0,90]);
    return [{hw:1.1,hd:2.3,y1:1.9}];
  }
  return [];
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
  // The carriageway and its lay-bys are named ground that people walking about keep off (crowd.js).
  for(const [x0,x1,z0,z1] of [city.street.road,...city.street.bays])
    marks.push({x:(x0+x1)/2,z:(z0+z1)/2,hw:(x1-x0)/2,hd:(z1-z0)/2,y0:-.2,y1:.05,name:'road',solid:false});
  marks.push(...station(models,leds,root));
  for(const def of city.towers){
    if(def.drawnBy)continue;   // a city part draws it (星光百货: src/world/mall.js); the entry still names its door for the taxi
    const made=building(models,leds,root,def,level);
    reflect(made.root);marks.push(...made.marks);
  }
  for(const def of city.props)for(const hit of cityProp(models,leds,root,def))marks.push(turn(def,hit));
  promenade(models,leds,root);
  edges(models,root);
  marks.push(...skyline(models,leds,root));
  backdrop(models,leds,root,level);
  const beams=searchlights(models,leds,root,level);
  const people=city.people.map(def=>{
    const made=models.person(root,def.color,[def.x,0,def.z]);
    made.entity.setLocalEulerAngles(0,def.rot??0,0);
    return {...def,...made,leg:0};
  });
  return {root,marks,people,lamps:leds.lamps,data:city.place,update:dt=>{leds.update(dt);beams(dt);}};
}

/**
 * The way in, back in 青禾广场: a modern metro entrance, a glass pavilion under a rounded steel
 * canopy over a stair going down, its open front facing the square. A sign band across the front
 * carries the metro roundel, the station's name 青禾站 and the exit letter A出入口, and a pair of
 * granite steps lead up to it.
 *
 * Built with the town, not with the city, because it has to be standing on the square from the
 * first minute — it is how you find out the city exists at all. The town's ground is one solid
 * slab, so the stairwell below the top step is drawn as a dark opening rather than cut into it;
 * pressing E on the top step takes you down to the platform (rooms.json `metro-platform`).
 */
export function buildStationEntrance(models,parent,lamps){
  const {box,cylinder,label,glow}=models;
  const def=city.station;
  const root=new pc.Entity('metro-entrance');root.lookName='metro-station';
  root.setLocalPosition(def.x,0,def.z);root.setLocalEulerAngles(0,def.rotation??0,0);
  parent.addChild(root);
  const granite='#a9aaa5',steel='#8f989f',dark='#65707a';
  // The granite deck round the stairwell, open where the stair drops away (x ±1.7, z -1.72 to
  // 1.45), and two granite steps up to it along the front.
  for(const side of [-1,1])box(root,[side*2.075,.1,.35],[.75,.2,5.06],granite);
  box(root,[0,.1,-1.95],[3.4,.2,.46],granite);
  box(root,[0,.1,2.17],[3.4,.2,1.42],granite);
  box(root,[0,.075,-2.33],[4.9,.15,.3],'#b3b4ae');
  box(root,[0,.04,-2.63],[4.9,.08,.3],'#b3b4ae');
  // The top step, then the dark of the stairwell going down.
  box(root,[0,-.06,-1.5],[3.4,.28,.44],'#9ba09f').lookName='stairs';
  box(root,[0,.03,.09],[3.4,.02,2.72],'#1d2226').lookName='stairs';
  box(root,[0,-.6,1.6],[3.8,2,.3],'#3c4247');
  // Clear glass on three sides, in a slim steel frame. The glass casts no shadow.
  const glass=new pc.StandardMaterial();
  glass.diffuse=new pc.Color().fromString('#cfe3ea');glass.opacity=.3;glass.blendType=pc.BLEND_NORMAL;
  glass.depthWrite=false;glass.gloss=.9;glass.useMetalness=true;glass.metalness=.2;glass.update();
  const pane=(pos,size)=>{const e=box(root,pos,size,'#cfe3ea');e.render.meshInstances[0].material=glass;e.render.castShadows=false;};
  for(const side of [-1,1]){
    pane([side*2.3,1.48,.35],[.05,2.56,4.9]);
    for(const z of [-2.1,-.55,1.05,2.8])box(root,[side*2.3,1.475,z],[.12,2.55,.12],steel);   // tops just under the glass's
    box(root,[side*2.3,.28,.35],[.14,.12,5.02],steel);
    box(root,[side*2.3,2.8,.35],[.18,.16,5.1],steel);
  }
  pane([0,1.48,2.8],[4.5,2.56,.05]);
  box(root,[0,2.8,2.8],[4.7,.16,.18],steel);
  box(root,[0,2.8,-2.1],[4.7,.16,.18],steel);
  // The rounded canopy: a shallow barrel vault of steel panels, rising 0.7 m over the 5.2 m span
  // and reaching out over the steps, with darker ribs at its ends and in the middle.
  const half=2.6,rise=.7,spring=2.9,R=(half*half+rise*rise)/(2*rise),top=Math.asin(half/R),n=8;
  for(let i=0;i<n;i++){
    const a=-top+(i+.5)*2*top/n,x=R*Math.sin(a),y=spring+rise-R+R*Math.cos(a),wide=2*R*Math.sin(top/n)+.03;
    box(root,[x,y,.2],[wide,.08,5.9],'#aab3b9',[0,0,-a*180/Math.PI]);
    for(const z of [-2.72,.2,3.12])box(root,[x,y-.07,z],[wide,.1,.12],dark,[0,0,-a*180/Math.PI]);
  }
  // The sign band along the front, read from the square (local -x is on your right): roundel,
  // name and exit letter, lit from within after dark.
  box(root,[0,2.45,-2.2],[4.62,.62,.12],'#1f3552');
  cylinder(root,[1.95,2.45,-2.27],[.48,.03,.48],'#f2f5f7',[90,0,0]);
  cylinder(root,[1.95,2.45,-2.29],[.36,.03,.36],'#2c68b0',[90,0,0]);
  box(root,[1.95,2.45,-2.31],[.07,.26,.02],'#f2f5f7');
  backlight(label(root,'青禾站',[.45,2.45,-2.28],2.4,.5,'#1f3552','#f4f7fa'),.8);
  backlight(label(root,'A出入口',[-1.5,2.45,-2.28],1.44,.3,'#f0c43a','#1f3552'),.8);
  const lit=glow('#e6eef5');
  const strip=box(root,[0,2.11,-2.2],[4.4,.05,.1],'#e6eef5');
  strip.render.meshInstances[0].material=lit;
  lamps?.push(lit);
  // The registry is axis aligned and knows nothing about the entity's rotation, so the hitboxes
  // are turned by hand here. Getting this wrong leaves a solid canopy floating on the wrong side
  // of the stair, which is invisible until you walk into it.
  const turn=(def.rotation??0)*Math.PI/180,cos=Math.cos(turn),sin=Math.sin(turn);
  const at=(lx,lz,hw,hd)=>({
    x:def.x+lx*cos+lz*sin, z:def.z-lx*sin+lz*cos,
    hw:Math.abs(cos)>.5?hw:hd, hd:Math.abs(cos)>.5?hd:hw,
  });
  // The canopy and the glass walls are solid, and so is the stairwell past the top step: you go
  // down by pressing E, not by walking off the edge. None of them is named, so a look lands on
  // the step or the stairwell (楼梯), a sign, or anywhere else on the entrance (地铁站). The boxes
  // meet without overlapping: walls up to 2.1 m, the roof above, the back wall between the sides.
  return {root,marks:[
    {...at(0,.2,2.65,3),y0:2.1,y1:3.7,name:null},
    {...at(-2.3,.35,.14,2.55),y0:0,y1:2.1,name:null},
    {...at(2.3,.35,.14,2.55),y0:0,y1:2.1,name:null},
    {...at(0,2.8,2.12,.14),y0:0,y1:2.1,name:null},
    {...at(0,.24,1.6,1.52),y0:0,y1:1.1,name:null},
  ]};
}
