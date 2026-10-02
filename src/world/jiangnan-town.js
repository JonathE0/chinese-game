import * as pc from 'playcanvas';
import {Kit,PALETTE as P,roofShape,roofAt,latticeWindow,silkLantern,bevelBox,lathe,woodish} from './jiangnan.js';
import {SURFACES,surface,paint} from './look.js';
import {detail} from '../core/quality.js';

/**
 * Qinghe in Jiangnan style (task W5-town, docs/superpowers/specs/2026-10-01-jiangnan-look-design.md,
 * P1): every shop and house in town built the way P0's 家居小铺 is (src/world/jiangnan.js
 * jiangnanFront), in white plaster on a bluestone plinth under a curved dark tile roof, from its
 * world.json entry and its `jiangnan` variant (VARIANTS):
 *
 *   floors   1 or 2: what the front shows (the rooms inside keep their own heights)
 *   front    door  a plaster front with a granite-framed door and lattice windows
 *            shop  a timber shopfront: stall boards with a counter ledge and lattice above them
 *            hall  a timber front of lattice doors (槅扇) from post to post
 *   gable    horse stepped horse-head walls (马头墙) | plain walls that follow the roof (硬山)
 *   balcony  an upstairs timber gallery across the front (two floors)
 *   shutters timber shutters folded open beside the upstairs windows
 *   hood     false: no door hood or pent roof over the ground floor (a veranda stands there)
 *   lanterns false: no red lanterns (the lighting shop hangs its own lamps)
 *   awning   a cloth awning in this colour over the shopfront's side bays
 *   eave     how far the front eave reaches out (metres; 0.55 unless something stands close in front),
 *            or with a balcony how deep the gallery is (1.05)
 *   hanging  a name board hung out from the wall on an arm (on the +x side), read from along the street
 *
 * Parts gather into Kits, one mesh per surface; the town's static batch merges them across all the
 * buildings, and every building shares one lit-paper and one red-silk material, so the street costs a
 * handful of draw calls more than plain boxes did rather than a few per building. On 低 the finest
 * pieces (lattice bars, standing ridge tiles, eave tiles, rafter ends) are left out.
 */
export const VARIANTS={
  floors:v=>v===1||v===2,
  front:v=>['door','shop','hall'].includes(v),
  gable:v=>['horse','plain'].includes(v),
  balcony:v=>typeof v==='boolean',
  shutters:v=>typeof v==='boolean',
  hood:v=>typeof v==='boolean',
  lanterns:v=>typeof v==='boolean',
  awning:v=>/^#[0-9a-f]{6}$/i.test(v),
  eave:v=>typeof v==='number'&&v>=.2&&v<=1.1,
  hanging:v=>typeof v==='boolean',
};

// ── Geometry (pure: tests/jiangnan-town.test.js) ───────────────────────────────────────────────────

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Push a convex polygon wound to face along `normal`. */
function face(g,pts,normal){
  if(dot(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])),normal)<0)pts=[...pts].reverse();
  const base=g.p.length/3;
  for(const q of pts){g.p.push(...q);g.n.push(...normal);}
  for(let k=1;k<pts.length-1;k++)g.i.push(base,base+k,base+k+1);
}
/**
 * A plain gable (硬山): the top of an end wall `t` thick (across x), from z0 to z1 and from y0 up to
 * the roof line `top(z)`, closed on its sides, its sloping top and its ends. The ridge (z 0) is one of
 * its points, so the wall peaks right under it.
 */
export function gableSlab(top,z0,z1,y0,t,n=16){
  const g={p:[],n:[],i:[],size:[t,1,z1-z0]},x=t/2;
  const zs=[...new Set([...Array.from({length:n+1},(_,k)=>z0+(z1-z0)*k/n),...(z0<0&&z1>0?[0]:[])])].sort((a,b)=>a-b),ys=zs.map(top),m=zs.length-1;
  for(let k=0;k<m;k++){
    const za=zs[k],zb=zs[k+1],ya=ys[k],yb=ys[k+1],l=Math.hypot(zb-za,yb-ya);
    for(const s of [-1,1])face(g,[[s*x,y0,za],[s*x,y0,zb],[s*x,yb,zb],[s*x,ya,za]],[s,0,0]);
    face(g,[[-x,ya,za],[x,ya,za],[x,yb,zb],[-x,yb,zb]],[0,(zb-za)/l,-(yb-ya)/l]);
  }
  face(g,[[-x,y0,z0],[x,y0,z0],[x,ys[0],z0],[-x,ys[0],z0]],[0,0,-1]);
  face(g,[[-x,y0,z1],[x,y0,z1],[x,ys[m],z1],[-x,ys[m],z1]],[0,0,1]);
  return g;
}

// ── Shared pieces ──────────────────────────────────────────────────────────────────────────────────

const mix=(a,b,k)=>{const x=new pc.Color().fromString(a),y=new pc.Color().fromString(b);return new pc.Color(x.r+(y.r-x.r)*k,x.g+(y.g-x.g)*k,x.b+(y.b-x.b)*k).toString(false);};
const lamps=new Map();
/** The town's one material for a kind of light (lit window paper, red lantern silk): its emissive
 *  follows the vertex colours, and the first building that wants it hands it to the daylight. */
function lamp(root,key,hex,kind=null,glow=hex){
  if(!lamps.has(key)){
    const m=new pc.StandardMaterial();
    Object.assign(m,{diffuse:new pc.Color().fromString(hex),emissive:new pc.Color().fromString(glow),emissiveIntensity:.55,
      diffuseVertexColor:true,vertexColorGamma:true,emissiveVertexColor:true,useMetalness:true,metalness:0,gloss:.15});
    if(kind)paint(m,kind);else m.update();
    lamps.set(key,m);root.lamps.push(m);
  }
  return lamps.get(key);
}
/** A door knocker: a ring facing +z. */
function ring(kit,at,r,wire,colour){
  const prof=[];for(let k=0;k<=8;k++){const a=k/8*Math.PI*2;prof.push([r+Math.cos(a)*wire,Math.sin(a)*wire]);}
  kit.turn(at,prof,colour,{seg:12,rot:[90,0,0]});
}
const EAVE_TILE=[[.06,0],[.06,.035],[.06,.035],[0,.035]];   // an eave tile's face: open at the back, against the roof

/**
 * The parts a Jiangnan building is drawn into. A Kit merges its pieces into one mesh per surface, and
 * the town's static batch then merges those across every building, so the number of kits costs no draw
 * calls; but each tagged kit is one look box (its mesh bounds), so everything you can point at and name
 * (a window, a door, a lantern, a counter, the roof) is a kit of its own and its box stays round it.
 * The plaster body and end walls are named as the building is (`name`, its world.json `object`).
 * `lod`: 2 on 高, 1 on 中 (no eave tiles, sparser lattice and ridge tiles), 0 on 低 (plain windows, a solid
 * ridge, no rafters).
 */
function parts(models,root,name){
  const lod={high:2,medium:1,low:0}[detail()]??1,low=lod===0,made=[];
  /** A new kit, built under `root` as `name` and looked at as `look` (null: no look box of its own). */
  const kit=(name,look=name,{shadows=false,jitter}={})=>{
    const k=new Kit(models.painted,jitter===undefined?{}:{jitter});made.push([k,name,look,shadows]);return k;
  };
  // The soffits under the eaves and the standing ridge tiles are hidden from the look ray and cast no
  // shadow (the tiles above do both); each eave's beam, rafters and eave tiles are a kit (屋檐) of its own.
  const K={low,lod,kit,walls:kit('walls',name,{shadows:true}),ends:[kit('end-wall',name,{shadows:true}),kit('end-wall',name,{shadows:true})],
    roof:kit('roof','roof',{shadows:true}),soffit:kit('soffit',null),porch:kit('porch','eaves',{shadows:true}),stone:kit('stone','stone',{jitter:.1})};
  K.lit=lamp(root,'paper','#f6deb0','paper','#a8743a');   // cream by day, warm amber after dark
  K.red=lamp(root,'silk',P.lantern);
  /** A lattice window ww×wh centred on (x, y) on the wall plane z (facing +z, or −z with dir −1): its
   *  frame, bars and lit paper, in kit `into` (a window of its own unless given). Returns the kit. */
  K.pane=(x,y,z,ww,wh,{dir=1,step=.11,into=null}={})=>{
    const W=into??kit('window');
    if(!low){latticeWindow(W,W,x,y,z,ww,wh,{dir,step:lod>1?step:step*1.3,paper:K.lit});return W;}
    for(const s of [-1,1]){
      W.box([x+s*(ww/2+.045),y,z+dir*.035],[.09,wh+.18,.07],P.timber,{kind:'wood'});
      W.box([x,y+s*(wh/2+.045),z+dir*.035],[ww,.09,.07],P.timber,{kind:'wood'});
    }
    W.box([x,y,z+dir*.005],[ww,wh,.01],P.paper,{kind:'paper',material:K.lit});
    W.box([x,y,z+dir*.03],[.03,wh,.02],P.timber,{kind:'wood'});W.box([x,y,z+dir*.03],[ww,.03,.02],P.timber,{kind:'wood'});
    return W;
  };
  /** One lattice door leaf (槅扇) lw wide from y0 to y1 on the wall plane z, in door kit D: a frame, a
   *  panelled waist and lattice over lit paper above it. */
  K.leaf=(D,lx,y0,y1,lw,z)=>{
    const mid=(y0+y1)/2,tall=y1-y0,waist=y0+Math.min(.72,tall*.32);
    D.box([lx,mid,z+.03],[lw-.02,tall,.06],P.timber,{kind:'wood',bevel:.008});
    for(const y of [y0+.08,waist,waist+.3,y1-.05])D.box([lx,y,z+.075],[lw-.04,.06,.03],P.redwood,{kind:'wood'});
    for(const s of [-1,1])D.box([lx+s*(lw/2-.04),mid,z+.075],[.06,tall-.02,.03],P.redwood,{kind:'wood'});
    D.box([lx,(y0+.11+waist-.03)/2,z+.065],[lw-.2,waist-y0-.2,.02],P.timber,{kind:'wood',bevel:.006});
    const py0=waist+.33,py1=y1-.08;
    if(py1-py0>.3)K.pane(lx,(py0+py1)/2,z+.06,lw-.2,py1-py0-.18,{step:.1,into:D});
  };
  /** Red silk lanterns hanging from `top` at each x, `z` out; past the edge of what is over them
   *  (`edge`), from a little timber arm run out under it. Each lantern is a kit, so a look box, of its own. */
  K.lanterns=(xs,top,z,size,edge=z)=>{
    for(const x of xs){
      const L=kit('lantern');silkLantern(L,L,x,top,z,K.red,size);
      if(edge<z-.04)L.box([x,top+.02,(edge-.2+z+.04)/2],[.05,.05,z+.24-edge],P.timber,{kind:'wood'});
    }
  };
  /** The name board: a dark plaque in a timber frame with a gold fillet, `width` wide, on the plane z. */
  K.sign=(sign,y,width,z)=>{
    const tall=width/4.8,B=kit('plaque');
    B.box([0,y,z+.035],[width+.2,tall+.14,.07],P.timber,{kind:'wood',bevel:.015});
    B.box([0,y,z+.065],[width+.12,tall+.06,.03],P.gold);   // standing 1 cm proud of the frame, not flush with it
    root.addMark(0,z+.12,width/2+.1,.06,y-tall/2-.07,y+tall/2+.07,'sign');
    return models.label(root,sign,[0,y,z+.1],width,tall,'#3b2a20','#e3c27a');
  };
  /** A timber post (柱子), a kit of its own: `size` across x and z, from y0 to y1. */
  K.post=(x,z,size,y0,y1)=>kit('pillar').box([x,(y0+y1)/2,z],[size[0],y1-y0,size[1]],P.redwood,{kind:'wood',bevel:.02});
  K.build=()=>{for(const [k,name,look,shadows] of made)if(k.parts.size)k.build(root,name,{look,shadows});};
  return K;
}

/** A curved tile roof between x ±w/2 over the front z = f (sloping down to +z), its ridge, eave tiles,
 *  rafter ends and eave beams; `back`: how far the back slope reaches past the back wall. */
function tileRoof(K,R,f,back){
  const reachOf=s=>s>0?R.reach:f+back;
  for(const side of [-1,1]){
    const shape=roofShape({...R,sides:[side],end:reachOf(side)/R.reach});
    K.roof.add(shape.tiles,[R.x??0,0,R.z??0],null,P.tile,'tile');
    K.soffit.add(shape.under,[R.x??0,0,R.z??0],null,P.timber,'wood');K.soffit.add(shape.edges,[R.x??0,0,R.z??0],null,P.ridge);
  }
  const x0=R.x??0,z0=R.z??0,top=R.top,rw=R.w-1;
  // The ridge: a base, a row of standing tiles, a cap; a curled end at each side and a centre piece.
  K.roof.box([x0,top+.06,z0],[rw,.14,.34],P.ridge,{kind:'tile',bevel:.02});
  if(K.low)K.roof.box([x0,top+.24,z0],[rw,.22,.24],P.tile,{kind:'tile'});
  else for(let x=-rw/2+.05;x<rw/2-.04;x+=K.lod>1?.075:.1)K.soffit.box([x0+x,top+.24,z0],[.028,.22,.26],P.tile,{kind:'tile'});
  K.roof.box([x0,top+.39,z0],[rw,.08,.3],P.ridge,{kind:'tile',bevel:.02});
  for(const s of [-1,1]){
    K.roof.box([x0+s*(rw/2+.04),top+.3,z0],[.22,.52,.3],P.ridge,{kind:'tile',bevel:.03});
    K.roof.box([x0+s*(rw/2+.16),top+.58,z0],[.42,.12,.26],P.ridge,{kind:'tile',bevel:.03,rot:[0,0,s*38]});
    K.roof.box([x0+s*(rw/2+.31),top+.74,z0],[.2,.1,.22],P.ridge,{kind:'tile',bevel:.025,rot:[0,0,s*70]});
  }
  if(rw>3){K.roof.box([x0,top+.5,z0],[.3,.18,.24],P.ridge,{kind:'tile',bevel:.03});K.roof.turn([x0,top+.58,z0],[[0,0],[.1,.04],[.06,.16],[0,.2]],P.ridge,{seg:8});}
  // Eave tiles (瓦当) on every cover-tile channel, rafter ends under the front eave, and the eave beams.
  for(const side of [-1,1]){
    const tip=reachOf(side),y=roofAt(R,tip/R.reach).y,wall=side*(f+.05),E=K.kit('eaves');
    if(K.lod>1)for(let x=-R.w/2+.205;x<R.w/2-.05;x+=.25)E.turn([x0+x,y-.02,z0+side*(tip+.01)],EAVE_TILE,P.ridge,{seg:6,rot:[side*90,0,0]});
    if(!K.low&&side>0)for(let x=-R.w/2+.18;x<R.w/2-.1;x+=.3)E.box([x0+x,R.eave-.175,z0+f+.42],[.07,.07,.25],P.timber,{kind:'wood'});
    E.box([x0,R.eave-.16,z0+wall],[R.w,.2,.1],P.redwood,{kind:'wood',bevel:.015});
  }
}

/**
 * The end walls' tops above the eave line at x, from zb (back, negative) to zf (front): stepped horse
 * heads in three tiers each side of the ridge, or a plain gable following the roof under a tiled coping.
 */
function gableTop(K,R,x,zb,zf,f,h,t,horse,plaster){
  const roofY=z=>roofAt(R,Math.min(1,Math.abs(z)/R.reach)).y,z0=R.z??0;
  if(horse){
    // Three tiers each side of the ridge, each capped with a little tiled coping, a dark frieze under
    // it and a horse head turned up at its outer end.
    const a=.4*f,b=.82*f,tiers=[{lo:-a,hi:a,y:R.top+.95,heads:[-1,1]}];
    tiers.push({lo:-b,hi:-a,y:roofY(a)+.62,heads:[-1]},{lo:zb,hi:-b,y:roofY(b)+.55,heads:[-1]},
      {lo:a,hi:b,y:roofY(a)+.62,heads:[1]},{lo:b,hi:zf,y:roofY(b)+.55,heads:[1]});
    for(const {lo,hi,y,heads} of tiers){
      const zc=z0+(lo+hi)/2,len=hi-lo;
      K.walls.box([x,(h-.3+y)/2,zc],[t-.01,y-h+.3,len],plaster,{kind:'plaster',bevel:.02});
      K.roof.box([x,y-.09,zc],[t+.03,.14,len+.02],P.frieze,{kind:'plaster'});
      for(const k of [-1,1])K.roof.box([x+k*.14,y+.04,zc],[.24,.05,len+.16],P.tile,{kind:'tile',rot:[0,0,k*-24]});
      K.roof.box([x,y+.1,zc],[.12,.1,len+.16],P.ridge,{kind:'tile',bevel:.02});
      for(const o of heads){
        const end=z0+(o>0?hi:lo);
        K.roof.box([x,y+.15,end-o*.1],[t+.1,.2,.3],P.ridge,{kind:'tile',bevel:.03});
        K.roof.box([x,y+.31,end+o*.08],[t-.02,.09,.36],P.ridge,{kind:'tile',bevel:.025,rot:[o*-30,0,0]});
      }
    }
    return;
  }
  // A plain gable: the wall rises under the roof's curve, a little proud of the tiles, under a coping.
  const top=z=>roofY(z)+.16;
  K.walls.add(gableSlab(top,zb+.005,zf-.005,h-.3,t-.01),[x,0,z0],null,plaster,'plaster');
  const n=14;
  for(let k=0;k<n;k++){
    const za=zb+(zf-zb)*k/n,zc=zb+(zf-zb)*(k+1)/n,ya=top(za),yc=top(zc);
    K.roof.box([x,(ya+yc)/2+.045,z0+(za+zc)/2],[t+.14,.07,Math.hypot(zc-za,yc-ya)+.04],P.ridge,{kind:'tile',rot:[-Math.atan2(yc-ya,zc-za)*180/Math.PI,0,0]});
  }
  K.roof.box([x,R.top+.24,z0],[t+.1,.2,.34],P.ridge,{kind:'tile',bevel:.03});
}

/**
 * A Jiangnan building (models.building, world.json `style: "jiangnan"` with a `jiangnan` variant), in
 * its own frame with its front at +z. Marks its plaque, posts, balcony and the end walls that run out
 * past its box; `root.displays` says where the shop windows are (models' windowDisplay).
 */
export function jiangnanHouse(models,root,data){
  const j=data.jiangnan??{},w=data.width,d=data.depth,h=data.height,f=d/2,t=.32,plinth=.32;
  const two=(j.floors??data.storeys??1)>1,front=j.front??'door',g=two?3:h,balcony=two&&!!j.balcony;
  // The front eave overhangs `ov` (over the gallery, `out` deep, with one) and the end walls run `wing`
  // out past the front to hold it; at the back the eave barely overhangs, leaving the lane behind clear.
  const out=balcony?j.eave??1.05:0,ov=balcony?out+.05:j.eave??.55,wing=ov+.07,pentReach=Math.min(.6,wing-.08);
  const xw=w/2-t/2+.03,xi=xw-t/2,zEnd=s=>s>0?f+wing:f+.03;
  const plaster=mix(P.plaster,data.color??P.plaster,.2),K=parts(models,root,data.object??'wall');
  // Body and plinth; the plaster darkens a little towards its foot.
  K.walls.box([0,(plinth+h)/2,0],[w,h-plinth,d],plaster,{kind:'plaster',bevel:.03,ground:.12});
  K.stone.box([0,plinth/2,0],[w+.12,plinth,d+.12],P.bluestone,{kind:'stone',bevel:.025});
  const zc=(zEnd(1)-zEnd(-1))/2,zl=zEnd(1)+zEnd(-1),end=s=>K.ends[s<0?0:1];
  for(const s of [-1,1]){
    end(s).box([s*xw,(plinth+h)/2+.005,zc],[t,h-plinth+.01,zl],plaster,{kind:'plaster',bevel:.03,ground:.12});
    end(s).box([s*xw,(plinth+.01)/2,zc],[t+.1,plinth+.01,zl+.1],P.bluestone,{kind:'stone',bevel:.025});
  }
  const R={w:w-t*2+.1,reach:f+ov,top:h+.44*(f+ov),eave:h+.06,thick:.14};
  tileRoof(K,R,f,.14);
  for(const s of [-1,1]){
    const x=s*xw;
    gableTop({walls:end(s),roof:end(s)},R,x,-zEnd(-1),zEnd(1),f,h,t,(j.gable??'horse')==='horse',plaster);
    // 墀头: a stepped corbel under the eave on the front end of the wall.
    for(let k=0;k<3;k++)end(s).box([x,h-.55+k*.16,zEnd(1)-.02+k*.04],[t+.06+k*.04,.14,.12+k*.08],k===1?P.frieze:plaster,{kind:'plaster',bevel:.02});
    // Where the end walls run out past the building's own box: solid, and named as the building is.
    if(wing>.32)root.addMark(x,f+(.3+wing)/2,t/2+.01,(wing-.3)/2,0,h+1.4,data.object??'wall',true);
  }
  // The ground floor's front, then the floor above.
  const dw=1.44,leaf=dw/2;
  root.displays=[];
  /** The street door, a kit of its own: two leaves with lattice over lit paper above a panel, rings and
   *  a timber sill, in a granite frame if `framed`; granite steps up to it. Returns the kit. */
  const doors=(dh,framed)=>{
    const D=K.kit('door');
    if(framed){
      for(const s of [-1,1])D.box([s*(dw/2+.1),(plinth+dh+.22)/2,f+.06],[.2,dh+.22-plinth,.14],P.granite,{kind:'stone',bevel:.02});
      D.box([0,dh+.11,f+.07],[dw+.5,.22,.16],P.granite,{kind:'stone',bevel:.02});
    }
    for(const s of [-1,1]){
      const cx=s*leaf/2,mid=(plinth+dh)/2+.06,tall=dh-plinth-.1;
      D.box([cx,mid,f+.02],[leaf-.02,tall,.06],P.timber,{kind:'wood',bevel:.01});
      for(const y of [plinth+.12,1.18,dh-.06])D.box([cx,y,f+.06],[leaf-.04,.07,.03],P.redwood,{kind:'wood'});
      for(const k of [-1,1])D.box([cx+k*(leaf/2-.05),mid,f+.06],[.07,tall,.03],P.redwood,{kind:'wood'});
      D.box([cx,(plinth+.12+1.18)/2,f+.065],[leaf-.26,.62,.02],P.timber,{kind:'wood',bevel:.008});
      const y0=1.26,y1=dh-.12;K.pane(cx,(y0+y1)/2,f+.05,leaf-.2,y1-y0-.02,{step:.1,into:D});
      ring(D,[s*.09,1.32,f+.09],.05,.008,P.gold);
      D.turn([s*.09,1.37,f+.06],[[0,0],[.035,0],[.035,0],[.035,.02],[.035,.02],[0,.02]],P.gold,{seg:10,rot:[90,0,0]});
    }
    D.box([0,plinth+.05,f+.05],[dw,.1,.12],P.redwood,{kind:'wood'});
    if(framed){
      K.stone.box([0,plinth*.25,f+.27],[dw+.7,plinth*.5,.42],P.granite,{kind:'stone',bevel:.02});
      K.stone.box([0,plinth*.75,f+.17],[dw+.5,plinth*.5,.22],P.granite,{kind:'stone',bevel:.02});
    } else K.stone.box([0,plinth*.5,f+.18],[dw+.3,plinth,.24],P.granite,{kind:'stone',bevel:.02});
    return D;
  };
  const lit=j.lanterns!==false;
  if(front==='door'){
    const dh=two?2.3:2.5;doors(dh,true);
    if(!two&&j.hood!==false){
      // The door hood (门罩): a little tiled roof with upturned corners on two brackets, the plaque under it.
      const hood={w:2.9,reach:.62,top:3.78,eave:3.36,sides:[1],lift:.2,flare:.12,thick:.08},hs=roofShape(hood);
      K.porch.add(hs.tiles,[0,0,f],null,P.tile,'tile');K.porch.add(hs.under,[0,0,f],null,P.timber,'wood');K.porch.add(hs.edges,[0,0,f],null,P.ridge);
      K.porch.box([0,hood.top+.05,f+.06],[hood.w-.1,.12,.16],P.ridge,{kind:'tile',bevel:.02});
      for(const s of [-1,1])K.porch.box([s*(hood.w/2-.02),hood.top+.12,f+.06],[.22,.08,.14],P.ridge,{kind:'tile',bevel:.02,rot:[0,0,s*30]});
      K.porch.box([0,3.3,f+.06],[2.5,.1,.12],P.redwood,{kind:'wood',bevel:.015});
      for(const s of [-1,1]){K.porch.box([s*1.08,3.15,f+.12],[.12,.26,.24],P.redwood,{kind:'wood',bevel:.02});K.porch.box([s*1.08,3.0,f+.07],[.08,.12,.12],P.timber,{kind:'wood'});}
      K.sign(data.sign,3.0,1.6,f);
      if(lit)K.lanterns([-1.3,1.3],3.42,f+.5,.9);
    } else {
      K.sign(data.sign,dh+.45,1.44,f);
      // From the pent roof or the gallery over the door; under a veranda, from the eaves near the corners.
      if(lit&&two&&j.hood===false&&!balcony)K.lanterns([-(xi-.3),xi-.3],h-.04,f+.5,.85,f+ov);
      else if(lit)K.lanterns([-1.12,1.12],two?g+.02:h-.04,f+.5,.8,f+(!two?ov:balcony?out:pentReach));
    }
    // Lattice windows either side of the door on granite sills under little tiled ledges: one a side,
    // two on a wide front.
    const span=xi-.92,n=span>=3?2:span>=1.4?1:0,ww=Math.min(1.18,span/Math.max(1,n)-.5),wh=1.24,y=1.66;
    for(let k=0;k<n;k++)for(const s of [-1,1]){
      const x=s*(.92+span*(k+.5)/n),W=K.pane(x,y,f,ww,wh);
      W.box([x,y-wh/2-.13,f+.06],[ww+.34,.08,.14],P.granite,{kind:'stone',bevel:.015});
      W.box([x,y+wh/2+.2,f+.12],[ww+.4,.05,.28],P.tile,{kind:'tile',rot:[22,0,0]});
      W.box([x,y+wh/2+.25,f+.02],[ww+.4,.06,.06],P.ridge,{kind:'tile'});
      if(k===0)root.displays.push({x,y:1.0,width:Math.min(1.29,ww+.3)});
    }
  } else {
    // A timber shopfront from end wall to end wall: posts, a lintel, the doors in the middle bay and
    // stall boards with lattice (a shop) or lattice doors (a hall) in the bays either side.
    const top=two?g-.22:2.75,postTop=two?g:h-.2,bays=[];
    const side=xi-.1-(leaf+.1),nb=Math.max(1,Math.round(side/2.6)),posts=[];
    for(let k=0;k<=nb;k++)posts.push(leaf+.1+side*k/nb);
    for(const s of [-1,1])for(const x of posts)K.post(s*x,f+.06,[.2,.12],plinth,postTop);
    for(let k=0;k<nb;k++)for(const s of [-1,1]){const a=posts[k]+.1,b=posts[k+1]-.1;bays.push({x:s*(a+b)/2,w:b-a,first:k===0});}
    K.walls.box([0,top+.11,f+.06],[2*xi,.22,.12],P.timber,{kind:'wood',bevel:.015});   // the lintel
    const dh=two?2.3:top,D=doors(dh,false);
    for(const bay of bays){
      if(front==='hall'){
        const n=Math.max(2,Math.round(bay.w/.62)),lw=bay.w/n,B=K.kit('door');
        for(let k=0;k<n;k++)K.leaf(B,bay.x-bay.w/2+lw*(k+.5),plinth,top,lw,f);
      } else {
        const C=K.kit('counter');
        C.box([bay.x,(plinth+.95)/2,f+.04],[bay.w,.95-plinth,.08],P.timber,{kind:'wood',bevel:.01});
        C.box([bay.x,(plinth+.95)/2,f+.09],[bay.w-.16,.95-plinth-.16,.02],P.redwood,{kind:'wood'});
        C.box([bay.x,.975,f+.14],[bay.w+.04,.05,.3],P.redwood,{kind:'wood',bevel:.01});
        K.pane(bay.x,(1+top)/2,f+.02,bay.w-.22,top-1.2);
        if(bay.first)root.displays.push({x:bay.x,y:1.04,width:Math.min(1.29,bay.w)});
      }
      // A cloth awning over the bay, clear of the lanterns by the door.
      if(j.awning){
        const s=Math.sign(bay.x),a=Math.max(Math.abs(bay.x)-bay.w/2,1.75),b=Math.abs(bay.x)+bay.w/2;
        if(b-a>.6){
          const x=s*(a+b)/2,aw=b-a,deep=.95,tilt=18,r=tilt*Math.PI/180,y0=top+.08,A=K.kit('awning');
          A.box([x,y0-Math.sin(r)*deep/2,f+.12+Math.cos(r)*deep/2],[aw,.03,deep],j.awning,{kind:'cloth',rot:[tilt,0,0]});
          A.box([x,y0-Math.sin(r)*deep-.09,f+.12+Math.cos(r)*deep],[aw,.18,.02],[j.awning,.82],{kind:'cloth'});
        }
      }
    }
    if(two){
      // Over the doors a board with the plaque; the floor above starts at the lintel.
      D.box([0,(dh+top)/2+.005,f+.03],[dw,top-dh-.01,.06],P.timber,{kind:'wood'});
      K.sign(data.sign,(dh+top)/2,1.44,f+.06);
    } else {
      // A band of lattice over the shopfront, the plaque on a board over the door.
      const y0=top+.22,y1=h-.2,band=y1-y0;
      if(band>.45)for(const bay of bays)K.pane(bay.x,(y0+y1)/2,f+.02,bay.w-.22,band-.22);
      D.box([0,(y0+y1)/2,f+.03],[dw,band,.06],P.timber,{kind:'wood'});
      K.sign(data.sign,(y0+y1)/2,Math.min(2.2,(band-.16)*4.8),f+.12);
    }
    if(lit){
      const xs=[-1.45,1.45];if(front==='hall'&&w>=10)xs.push(-(xi-.7),xi-.7);
      K.lanterns(xs,two?g+.02:h-.04,f+.5,two?.8:.85,f+(!two?ov:balcony?out:pentReach));
    }
  }
  if(two){
    if(balcony){
      // An upstairs gallery across the front: a boarded floor on brackets, posts up to the eave beam,
      // a balustrade, and lattice doors onto it in the middle with lattice windows either side.
      const bw=2*xi-.3,z1=f+out,y=g,last=bw/2-.08,m=Math.max(0,Math.round((last-1.45)/2.6)),cols=[];
      for(let k=0;k<=m;k++)for(const s of [-1,1])cols.push(s*(m?1.45+(last-1.45)*k/m:last));
      const B=K.kit('balcony'),rail=K.kit('railing');
      B.box([0,y+.06,f+out/2],[bw,.12,out],P.timber,{kind:'wood',bevel:.015});
      B.box([0,y-.01,z1-.04],[bw+.02,.14,.08],P.redwood,{kind:'wood'});
      const len=Math.hypot(out*.8,.6),tilt=Math.atan2(.6,out*.8)*180/Math.PI;
      for(const x of cols){
        K.post(x,z1-.08,[.14,.14],y+.12,h-.2);
        B.box([x,y-.32,f+out*.4],[.09,.09,len],P.timber,{kind:'wood',rot:[-tilt,0,0]});
      }
      K.kit('eaves').box([0,h-.1,z1-.08],[bw+.1,.2,.16],P.redwood,{kind:'wood',bevel:.015});
      rail.box([0,y+.95,z1-.08],[bw,.07,.09],P.redwood,{kind:'wood'});
      rail.box([0,y+.22,z1-.08],[bw,.06,.07],P.redwood,{kind:'wood'});
      for(let x=-bw/2+.2;x<bw/2-.1;x+=K.low?.5:.2)if(!cols.some(c=>Math.abs(c-x)<.1))rail.box([x,y+.585,z1-.08],[.035,.67,.035],P.timber,{kind:'wood'});
      for(const s of [-1,1]){
        rail.box([s*(bw/2-.04),y+.95,f+out/2],[.07,.07,out-.16],P.redwood,{kind:'wood'});
        rail.box([s*(bw/2-.04),y+.22,f+out/2],[.06,.06,out-.16],P.redwood,{kind:'wood'});
      }
      root.addMark(0,f+out/2,bw/2,out/2,y-.1,y+1,'balcony');
      const ud=Math.min(2.3,h-.35-(y+.12)),U=K.kit('door');
      for(const s of [-1,1])K.leaf(U,s*.33,y+.12,y+.12+ud,.66,f);
      U.box([0,y+.12+ud+.04,f+.05],[1.46,.08,.1],P.redwood,{kind:'wood'});
      const wh=Math.min(1.3,h-y-1.3),sp=(xi-.8)/2;
      if(wh>.4)for(const s of [-1,1])for(const x of [.8+sp*.5,.8+sp*1.5])K.pane(s*x,y+.95+wh/2,f,Math.min(1.18,sp-.5),wh);
    } else {
      // A pent roof (腰檐) across the front over the ground floor, unless a veranda does that job.
      if(j.hood!==false){
        const pent={w:2*xi+.02,reach:pentReach,top:g+.5,eave:g+.06,sides:[1],thick:.08},ps=roofShape(pent);
        K.porch.add(ps.tiles,[0,0,f],null,P.tile,'tile');K.porch.add(ps.under,[0,0,f],null,P.timber,'wood');K.porch.add(ps.edges,[0,0,f],null,P.ridge);
        K.porch.box([0,pent.top+.05,f+.06],[pent.w,.12,.16],P.ridge,{kind:'tile',bevel:.02});
        if(K.lod>1)for(let x=-pent.w/2+.2;x<pent.w/2-.05;x+=.25)K.porch.turn([x,pent.eave-.02,f+pent.reach+.01],EAVE_TILE,P.ridge,{seg:6,rot:[90,0,0]});
      }
      // Upstairs windows, with shutters folded open beside them if asked.
      const n=Math.max(2,Math.round(2*xi/2.6)),sp=2*xi/n,ww=Math.min(1.2,j.shutters?sp/2-.15:sp-.9),wh=Math.min(1.2,h-g-1.1),y=g+.8+wh/2;
      if(wh>.4)for(let k=0;k<n;k++){
        const x=-xi+sp*(k+.5),W=K.pane(x,y,f,ww,wh);
        W.box([x,y-wh/2-.13,f+.06],[ww+.3,.08,.14],P.granite,{kind:'stone',bevel:.015});
        if(j.shutters)for(const s of [-1,1]){
          const sx=x+s*(ww/2+.09+ww/4);
          W.box([sx,y,f+.03],[ww/2,wh+.14,.05],P.redwood,{kind:'wood',bevel:.01});
          for(const k2 of [-1,0,1])W.box([sx,y+k2*wh/3,f+.06],[ww/2-.08,.05,.02],P.timber,{kind:'wood'});
        }
      }
    }
  }
  // A round window high on each open end wall, two lattice windows at the back.
  if(!data.wings)for(const s of [-1,1]){
    const x=s*(xw+t/2),r=.42,y=two?g+(h-g)/2:Math.min(2.75,h-.9),W=K.kit('window');
    W.turn([x,y,0],[[r,-.02],[r+.1,-.02],[r+.1,-.02],[r+.1,.06],[r+.1,.06],[r,.06],[r,.06],[r,-.02]],P.stain,{kind:'plaster',seg:20,rot:[0,0,s*-90]});
    W.turn([x,y,0],[[r,.004],[0,.004]],P.paper,{seg:20,rot:[0,0,s*-90],material:K.lit});
    if(!K.low)for(const k of [-2,-1,0,1,2]){
      const half=Math.sqrt(r*r-(k*.15)**2);
      W.box([x+s*.02,y+k*.15,0],[.02,.022,half*2],P.timber,{kind:'wood'});
      W.box([x+s*.02,y,k*.15],[.02,half*2,.022],P.timber,{kind:'wood'});
    }
  }
  for(const s of [-1,1])K.pane(s*Math.min(w*.3,xi-.8),1.85,-f,1,1,{dir:-1});
  if(j.hanging){
    // The name again on a board hung out on an arm beside the door, read from along the street.
    const x=leaf+.4,z=f+.78,H=K.kit('plaque');
    H.box([x,2.35,f+.68],[.06,.06,1.14],P.timber,{kind:'wood'});
    H.box([x,2.08,f+.3],[.05,.05,.62],P.timber,{kind:'wood',rot:[-40,0,0]});
    for(const k of [-.4,.4])H.box([x,2.24,z+k],[.02,.18,.02],P.ridge);
    H.box([x,2.0,z],[.06,.3,1.08],P.timber,{kind:'wood',bevel:.01});
    models.label(root,data.sign,[x,2.0,z],.96,.2,'#3b2a20','#e3c27a').setLocalEulerAngles(0,90,0);
  }
  K.build();
  return root;
}

/**
 * A one-storey side wing of a Jiangnan house (the home's kitchen and study, world.json `wings`), in the
 * house's frame: plaster on a bluestone plinth under its own tile roof, a plain gable at its outer end
 * and its inner end against the house's end wall. `win` cuts the kitchen's window opening (x, y, w, h,
 * D deep) out of its front; models.buildWing fits what is seen through it, and the chimney.
 */
export function jiangnanWing(models,root,data,wing,win){
  const {x,z,width:w,depth:d,height:h}=wing,f=z+d/2,s=Math.sign(x)||1,t=.3,plinth=.32;
  const plaster=mix(P.plaster,wing.color??data.color??P.plaster,.2),K=parts(models,root,wing.object??data.object??'wall');
  const x0=x-w/2,x1=x+w/2;
  if(win){
    const wx0=win.x-win.w/2,wx1=win.x+win.w/2,y0=win.y-win.h/2,y1=win.y+win.h/2,zf=f-win.D/2,o={kind:'plaster',bevel:.02,ground:.12};
    K.walls.box([x,(plinth+h)/2,z-win.D/2],[w,h-plinth,d-win.D],plaster,o);
    K.walls.box([(x0+wx0)/2,(plinth+h)/2,zf],[wx0-x0,h-plinth,win.D],plaster,o);
    K.walls.box([(wx1+x1)/2,(plinth+h)/2,zf],[x1-wx1,h-plinth,win.D],plaster,o);
    K.walls.box([win.x,(plinth+y0)/2,zf],[win.w,y0-plinth,win.D],plaster,o);
    K.walls.box([win.x,(y1+h)/2,zf],[win.w,h-y1,win.D],plaster,o);
  } else K.walls.box([x,(plinth+h)/2,z],[w,h-plinth,d],plaster,{kind:'plaster',bevel:.03,ground:.12});
  K.stone.box([x,plinth/2,z],[w+.12,plinth,d+.12],P.bluestone,{kind:'stone',bevel:.025});
  // The outer end wall, its face 3 cm proud, running out under the front eave.
  const ow=x+s*(w/2-t/2+.03),wing2=.62,zb=z-d/2-.03,zf=f+wing2,E=K.ends[0];
  E.box([ow,(plinth+h)/2+.005,(zb+zf)/2],[t,h-plinth+.01,zf-zb],plaster,{kind:'plaster',bevel:.03,ground:.12});
  E.box([ow,(plinth+.01)/2,(zb+zf)/2],[t+.1,plinth+.01,zf-zb+.1],P.bluestone,{kind:'stone',bevel:.025});
  root.addMark(ow,f+(.3+wing2)/2,t/2+.01,(wing2-.3)/2,0,h+1.4,wing.object??data.object??'wall',true);
  // The roof from the house's end wall to the outer wall, its ridge along the wing's middle.
  const house=s*(data.width/2+.03),inner=ow-s*t/2,R={w:Math.abs(inner-house)+.04,reach:d/2+.55,top:h+.44*(d/2+.55),eave:h+.06,thick:.14,x:(house+inner)/2,z};
  tileRoof(K,R,d/2,.14);
  gableTop({walls:E,roof:E},R,ow,-(d/2+.03),d/2+wing2,d/2,h,t,false,plaster);
  for(let k=0;k<3;k++)E.box([ow,h-.55+k*.16,zf-.02+k*.04],[t+.06+k*.04,.14,.12+k*.08],k===1?P.frieze:plaster,{kind:'plaster',bevel:.02});
  K.build();
}

/** Which painted surface a landmark's piece wears: tile on its roofs (and the colours in `roof`), a
 *  soft finish on its windows, plaster on the colours in `plaster`, wood on timber and on lacquered
 *  columns and beams, stone on greys and creams (terraces, steps, lions, ashlar), plaster on the rest. */
export function landmarkSurface(e,hex,{roof=[],plaster=[]}={}){
  const look=e.lookName??e.parent?.lookName,c=new pc.Color().fromString(hex),spread=Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b);
  const is=list=>list.some(x=>x.toLowerCase()===hex);
  if(look==='roof'||look==='eaves'||is(roof))return 'tile';
  if(is(plaster))return 'plaster';
  if(look==='window')return 'soft';
  if(woodish(hex)||look==='beam'||look==='pillar'||e.render.type==='cylinder'&&spread>.2)return 'wood';
  return spread<.12?'stone':'plaster';
}
const finishes=new Map();
/** The painted finish on a landmark built from plain boxes and cylinders (the word hall, the bank):
 *  every piece keeps its shape and colour but wears a painted surface, `kindOf(entity, hex)` saying
 *  which (null: leave it plain). One mesh per shape, colour, surface and size, as interiors do. */
export function finish(root,kindOf){
  const device=pc.AppBase.getApplication().graphicsDevice;
  root.forEach(e=>{
    const r=e.render,mi=r?.meshInstances?.[0],m=mi?.material;
    if(!m||r.meshInstances.length!==1||!['box','cylinder'].includes(r.type)||m!==r.material||m.diffuseMap||m.emissiveMap||m.opacity<1||m.diffuseVertexColor||e.noBatch||e.signText)return;
    if(m.emissive&&(m.emissive.r||m.emissive.g||m.emissive.b))return;
    const hex=m.diffuse.toString(),kind=kindOf(e,hex);if(!kind)return;
    const sc=e.getWorldTransform().getScale(),key=[r.type,hex,kind,...[sc.x,sc.y,sc.z].map(v=>v.toFixed(3))].join();
    if(!finishes.has(key)){
      const geo=r.type==='box'?bevelBox(.5,.5,.5,0):lathe([[0,-.5],[.5,-.5],[.5,-.5],[.5,.5],[.5,.5],[0,.5]],16);
      const c=new pc.Color().fromString(hex),metres=SURFACES[kind].metres,uv=[],size=[sc.x,sc.y,sc.z];
      for(let v=0;v<geo.p.length;v+=3){
        const q=[geo.p[v]*sc.x,geo.p[v+1]*sc.y,geo.p[v+2]*sc.z],n=[geo.n[v],geo.n[v+1],geo.n[v+2]].map(Math.abs);
        const a=n[0]>=n[1]&&n[0]>=n[2]?0:n[1]>=n[2]?1:2;
        let [ua,va]=a===1?[0,2]:[a===0?2:0,1];
        if(SURFACES[kind].grain&&size[ua]>size[va])[ua,va]=[va,ua];
        if(r.type==='cylinder'&&a!==1){uv.push(geo.uv[v/3*2]*sc.x/metres,q[1]/metres);continue;}
        uv.push(q[ua]/metres,q[va]/metres);
      }
      const colors=Array.from({length:geo.p.length/3},()=>[c.r,c.g,c.b].map(k=>Math.round(k*255)).concat(255)).flat();
      const mesh=pc.Mesh.fromGeometry(device,Object.assign(new pc.Geometry(),{positions:geo.p,normals:geo.n,colors,uvs:uv,uvs1:uv,indices:geo.i}));
      mesh.incRefCount();finishes.set(key,mesh);
    }
    r.meshInstances=[new pc.MeshInstance(finishes.get(key),surface(kind))];   // keeps the part's castShadows
  });
}
