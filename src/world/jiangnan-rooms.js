import * as pc from 'playcanvas';
import {SURFACES,surface} from './look.js';
import {Kit,bevelBox,lathe,woodish,jar,bottle,tin,parcel,basket,bowls,teapot,abacus} from './jiangnan.js';
import GOODS from '../content/goods.json' with {type:'json'};

/**
 * Every interior in the Jiangnan look (task W5-rooms, docs/superpowers/specs/2026-10-01-jiangnan-look-design.md,
 * phase P2), done the first time a room is entered (town.enterRoom calls `room.dress`, made by interior.js):
 *
 * - The finish: every plain box, cylinder, ball and cone of the room, its fittings and its furniture is
 *   redrawn with softly bevelled edges on a painted surface (plaster, wood, cloth, paper, stone or the
 *   soft finish), its colour in its vertices (`finish`; models.furniture does it for each piece it makes).
 * - The ceiling that suits the room (goods.json `rooms.<id>.ceiling`): timber boards and rafters in
 *   Qinghe, a coffered one in its halls, a plaster one with light panels in 云海.
 * - The goods of its trade on its fittings: each shelf, counter, table, rail and pegboard says where
 *   goods go (`shelves`, `spots`, `rail`, `pegs`, `drawers`, from models.fitting), and goods.json says
 *   which goods a trade puts on which fitting. Hanging things from the beams and a few wall pieces too.
 *
 * Goods are built into one mesh per surface for each fitting (jiangnan.js Kit), and then everything static
 * in the room is merged once by material (`mergeStatics`), so a fuller room draws in fewer calls than the
 * bare one did and nothing is rebuilt at its door. Nothing here adds a hitbox: everything stands on a
 * fitting, hangs above head height or lies flat on a wall, so the walkable floor is unchanged.
 */

// ── The finish: plain parts redrawn bevelled, on painted surfaces ────────────────────────────────

/** Look names whose plain parts are soft furnishings (cloth, unless timber) or paper. */
const CLOTH=new Set(['quilt','pillow','blanket','cushion','rug','sofa','clothes','shirt','trousers','fitting-room','bed','mannequin','headphones']);
const PAPER=new Set(['paper','notebook','rice-paper','calligraphy','book','postcard']);
const SHAPED=new Set(['box','cylinder','sphere','cone']);
/** How much a box's edges are planed off, in metres: none on a thin plate, more on a big piece. */
export function bevelFor(s){
  const lo=Math.min(s[0],s[1],s[2]);
  return lo<.03?0:Math.min(lo*.18,Math.max(s[0],s[1],s[2])>2.5?.03:.016);
}
/** A cylinder `s` big (x and z its diameters, y its height) with its rims chamfered, at full size. */
export function drum(s){
  const r=s[0]/2,h=s[1]/2,c=Math.min(bevelFor(s),r*.3,h*.6);
  const prof=c?[[0,-h],[r-c,-h],[r-c,-h],[r,-h+c],[r,-h+c],[r,h-c],[r,h-c],[r-c,h],[r-c,h],[0,h]]:[[0,-h],[r,-h],[r,-h],[r,h],[r,h],[0,h]];
  const g=lathe(prof,r>.12?20:r>.04?14:10);
  if(Math.abs(s[2]-s[0])>1e-6)for(let v=0;v<g.p.length;v+=3){g.p[v+2]*=s[2]/s[0];g.n[v+2]*=s[0]/s[2];const l=Math.hypot(g.n[v],g.n[v+1],g.n[v+2]);for(let a=0;a<3;a++)g.n[v+a]/=l;}
  return g;
}
const meshes=new Map();
/**
 * A part's geometry `g`, made at its full size `s`, as a mesh in the part's own unit space (its entity
 * keeps its scale, which anything else may read): points divided by the size, normals multiplied by it,
 * so the engine's scaling puts both back. `unit`: it is in unit space already. UVs in metres, the
 * grain along a timber's length, as jiangnan.js Kit does.
 */
export function unitGeometry(g,s,kind,unit=false){
  const {metres,grain}=SURFACES[kind],n=g.p.length/3,p=new Array(n*3),nn=new Array(n*3),uv=new Array(n*2);
  for(let v=0;v<n;v++){
    const q=[g.p[v*3],g.p[v*3+1],g.p[v*3+2]],m=[g.n[v*3],g.n[v*3+1],g.n[v*3+2]];
    const w=unit?q.map((x,a)=>x*s[a]):q;   // the point at full size
    if(g.uv&&!unit){uv[v*2]=g.uv[v*2]/metres;uv[v*2+1]=g.uv[v*2+1]/metres;}
    else{
      const a=Math.abs(m[0])>=Math.abs(m[1])&&Math.abs(m[0])>=Math.abs(m[2])?0:Math.abs(m[1])>=Math.abs(m[2])?1:2;
      let [ua,va]=a===1?[0,2]:[a===0?2:0,1];
      if(grain&&s[ua]>s[va])[ua,va]=[va,ua];
      uv[v*2]=w[ua]/metres;uv[v*2+1]=w[va]/metres;
    }
    if(unit){for(let a=0;a<3;a++){p[v*3+a]=q[a];nn[v*3+a]=m[a];}continue;}
    const k=[m[0]*s[0],m[1]*s[1],m[2]*s[2]],l=Math.hypot(...k)||1;
    for(let a=0;a<3;a++){p[v*3+a]=q[a]/s[a];nn[v*3+a]=k[a]/l;}
  }
  return {p,n:nn,uv,i:g.i};
}
/** The engine's own ball and cone, as plain arrays. */
function engineShape(type){
  const g=type==='sphere'?new pc.SphereGeometry({radius:.5,latitudeBands:10,longitudeBands:14}):new pc.ConeGeometry({baseRadius:.5,peakRadius:0,height:1,heightSegments:1,capSegments:14});
  return {p:[...g.positions],n:[...g.normals],i:[...g.indices]};
}
function finishedMesh(type,s,hex,kind,shade){
  const key=[type,hex,kind,shade,...s.map(v=>v.toFixed(3))].join();
  let mesh=meshes.get(key);
  if(!mesh){
    const g=type==='box'?unitGeometry(bevelBox(s[0]/2,s[1]/2,s[2]/2,bevelFor(s)),s,kind):type==='cylinder'?unitGeometry(drum(s),s,kind):unitGeometry(engineShape(type),s,kind,true);
    const c=new pc.Color().fromString(hex),rgba=[c.r,c.g,c.b].map(x=>Math.round(Math.min(1,x*shade)*255)).concat(255);
    const colors=new Array(g.p.length/3*4);for(let v=0;v<colors.length;v++)colors[v]=rgba[v%4];
    mesh=pc.Mesh.fromGeometry(pc.AppBase.getApplication().graphicsDevice,Object.assign(new pc.Geometry(),{positions:g.p,normals:g.n,colors,uvs:g.uv,uvs1:g.uv,indices:g.i}));
    mesh.incRefCount();meshes.set(key,mesh);
  }
  return mesh;
}
/** Which painted surface a plain part of colour `hex` wears, in what it belongs to (`ctx`). */
export function surfaceOf(hex,ctx){
  if(hex===ctx.plaster)return 'plaster';
  if(ctx.stone)return 'stone';
  if(ctx.timber?.has(hex)||woodish(hex))return 'wood';
  if(ctx.floor)return 'stone';
  if(ctx.cloth)return 'cloth';
  if(ctx.paper)return 'paper';
  return 'soft';
}
/**
 * Finish everything plain under `root`. `plaster`: the room's wall colour; `timber`: colours that are
 * the room's own timber whatever their hue; `skip`: entities to leave alone (the furniture, already
 * finished). People are another task's, and moving parts (`noBatch`) keep their own look, but for a
 * piece of display stock (a ball or a drum of its own).
 */
export function finish(models,root,{plaster=null,timber=new Set(),skip=new Set()}={}){
  const walk=(e,ctx)=>{
    if(skip.has(e)||e.name==='person')return;
    const name=e.lookName;
    if(name)ctx={...ctx,cloth:ctx.cloth||CLOTH.has(name),stone:ctx.stone||name==='stone',paper:ctx.paper||PAPER.has(name),floor:name==='floor'};
    const r=e.render;
    if(r&&(!e.noBatch||(!e.children.length&&r.type!=='box')))finishOne(models,e,ctx);
    if(e.noBatch&&e.children.length)return;
    for(const child of e.children)walk(child,ctx);
  };
  walk(root,{plaster:plaster&&new pc.Color().fromString(plaster).toString(),timber});
}
function finishOne(models,e,ctx){
  const r=e.render;
  if(r.meshInstances?.length!==1||!SHAPED.has(r.type))return;
  models.repaint(e);   // a plain colour becomes the shared vertex colour; glass, glow, signs and textures stay as they are
  if(r.meshInstances[0].material!==models.painted)return;
  const hex=r.material.diffuse.toString(),w=e.getWorldTransform().getScale(),s=[Math.abs(w.x),Math.abs(w.y),Math.abs(w.z)];
  const kind=surfaceOf(hex,ctx),p=e.getPosition(),shade=1+(((Math.round(p.x*7+p.y*13+p.z*5)%5)+5)%5-2)*.012;
  r.meshInstances=[new pc.MeshInstance(finishedMesh(r.type,s,hex,kind,+shade.toFixed(3)),surface(kind))];   // keeps the part's castShadows
}

// ── Little helpers ────────────────────────────────────────────────────────────────────────────────

/** A seeded random number from 0 to 1, the same for a room every time it is dressed. */
function seeded(text){let s=[...text].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261)||7;return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
const pick=(list,r)=>list[Math.floor(r()*list.length)%list.length];
/** A colour a shade lighter (k > 1) or darker. */
export function tone(hex,k){const c=new pc.Color().fromString(hex);return '#'+[c.r,c.g,c.b].map(x=>Math.round(Math.max(0,Math.min(1,x*k))*255).toString(16).padStart(2,'0')).join('');}
/** A colour `t` of the way from `a` to `b`. */
export function mix(a,b,t){const p=new pc.Color().fromString(a),q=new pc.Color().fromString(b);return '#'+['r','g','b'].map(k=>Math.round((p[k]+(q[k]-p[k])*t)*255).toString(16).padStart(2,'0')).join('');}
/** Bare timber for ceilings, a little of the room's own painted beam colour in it. */
const TIMBER='#8a6646';
const LABEL='#efe3c6',STRING='#d9c9a3',INK='#2f2a28',BAMBOO='#c8a66a',BRASS='#b48a3c',PORCELAIN='#eceee9',COBALT='#3d5a8a',STEEL='#9aa3a6',DARK='#3b3a36',SEAL='#b8443a';
/** A thin paper label flat on a front face (+z) at (x, y, z). */
const tag=(k,x,y,z,w,h,c=LABEL)=>k.box([x,y,z+.002],[w,h,.004],c,{kind:'paper'});

// ── The goods: each knows how wide it is (`w`, from a size fraction t) and draws itself centred on
// (x, z) standing on y, its front to +z. `c` is its colour, `o` its entry in goods.json. ─────────────

const turnUp=(r,h)=>[[0,0],[r,0],[r,0],[r,h],[r,h],[0,h]];
export const GOOD={
  // The bakery.
  loaf:{w:t=>.17+t*.05,put(k,x,y,z,c,t){const R=(.17+t*.05)/2;k.turn([x,y,z],[[0,0],[R,0],[R,0],[R*1.02,R*.28],[R*.86,R*.62],[R*.5,R*.84],[0,R*.9]],c,{kind:'soft',seg:16});
    k.turn([x,y+R*.86,z],[[0,0],[R*.32,0],[R*.32,0],[0,R*.05]],tone(c,1.12),{kind:'soft',seg:10});}},
  batard:{w:t=>.24+t*.08,put(k,x,y,z,c,t){const L=.24+t*.08;k.box([x,y+.04,z],[L,.08,.11],c,{kind:'soft',bevel:.035});
    for(const i of [-1,0,1])k.box([x+i*L*.24,y+.079,z],[.055,.004,.016],tone(c,1.25),{kind:'soft',rot:[0,32,0]});}},
  baguettes:{w:()=>.46,put(k,x,y,z,c){for(let i=0;i<3;i++)k.box([x,y+.024+(i===1?.04:0),z+(i-1)*.045+(i===1?0:0)],[.44,.048,.048],tone(c,1+(i-1)*.06),{kind:'soft',bevel:.02,rot:[0,(i-1)*4,0]});}},
  buns:{w:()=>.32,put(k,x,y,z,c){k.box([x,y+.008,z],[.3,.016,.22],'#6a625a',{bevel:.004});
    for(let i=0;i<3;i++)for(let j=0;j<2;j++){const R=.042;k.turn([x-.1+i*.1,y+.016,z-.05+j*.1],[[0,0],[R,0],[R,0],[R*.96,R*.35],[R*.62,R*.8],[0,R*.9]],c,{kind:'soft',seg:10});}}},
  tarts:{w:()=>.3,put(k,x,y,z,c){k.box([x,y+.006,z],[.28,.012,.2],'#7a6d60',{bevel:.003});
    for(let i=0;i<3;i++)for(let j=0;j<2;j++){const R=.036,at=[x-.09+i*.09,y+.012,z-.045+j*.09];
      k.turn(at,[[0,0],[R*.8,0],[R*.8,0],[R,.022],[R,.022],[R*.86,.022],[R*.86,.022],[0,.016]],'#c98a4a',{kind:'soft',seg:12});
      k.turn([at[0],at[1]+.014,at[2]],[[0,0],[R*.84,0],[R*.84,0],[0,.008]],c,{kind:'soft',seg:12});}}},
  cake:{w:()=>.24,put(k,x,y,z,c){k.turn([x,y,z],[[0,0],[.12,0],[.12,0],[.12,.008],[.12,.008],[0,.008]],PORCELAIN,{seg:18});
    k.turn([x,y+.008,z],[[0,0],[.1,0],[.1,0],[.1,.09],[.1,.09],[.09,.1],[0,.1]],c,{kind:'soft',seg:18});
    k.turn([x,y+.045,z],[[.101,0],[.101,.012]],tone(c,.8),{kind:'soft',seg:18});
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;k.turn([x+Math.cos(a)*.07,y+.108,z+Math.sin(a)*.07],[[0,0],[.012,.006],[0,.018]],'#c0392b',{seg:6});}}},
  steamers:{w:()=>.3,put(k,x,y,z,c,t){const R=.14,n=2+Math.round(t);
    for(let i=0;i<n;i++)k.turn([x,y+i*.068,z],[[0,0],[R,0],[R,0],[R,.068],[R,.068],[R-.012,.068],[R-.012,.068],[R-.012,.012],[R-.012,.012],[0,.012]],tone(c,1-i*.03),{kind:'wood',seg:18});
    k.turn([x,y+n*.068,z],[[0,0],[R+.004,0],[R+.004,0],[R*.9,.032],[R*.35,.06],[0,.064]],tone(c,1.05),{kind:'wood',seg:18});
    k.turn([x,y+n*.068+.058,z],[[0,0],[.025,.004],[.02,.02],[0,.024]],tone(c,.8),{kind:'wood',seg:8});}},
  // Jars, bottles, tins and boxes (the general store's, the pharmacy's, the tea house's).
  jar:{w:t=>.1+t*.04,put(k,x,y,z,c,t,o){const R=(.1+t*.04)/2;jar(k,k,[x,y,z],R,R*3.2+.03,c,{band:!!o.band&&t>.4,label:o.labels?o.labels[Math.floor(t*o.labels.length*7)%o.labels.length]:null});}},
  bottle:{w:()=>.07,put(k,x,y,z,c,t){bottle(k,[x,y,z],.03,.2+t*.08,c);tag(k,x,y+.07,z+.03,.04,.05);}},
  tin:{w:()=>.1,put(k,x,y,z,c,t){tin(k,k,[x,y,z],.045,.12+t*.04,c);}},
  box:{w:t=>.11+t*.08,put(k,x,y,z,c,t,o){const w=.11+t*.08;parcel(k,k,[x,y,z],[w,.1+t*.1,o.depth??.13],c,{ribbon:o.ribbon&&t>.6?o.ribbon:null});}},
  can:{w:()=>.074,put(k,x,y,z,c,t){for(const dz of [-.04,.04]){k.turn([x,y,z+dz],[[0,0],[.031,0],[.031,0],[.033,.012],[.033,.012],[.033,.11],[.033,.11],[.028,.122],[.028,.122],[0,.122]],c,{seg:12});
    k.turn([x,y,z+dz],[[.0335,.04],[.0335,.085]],t>.5?LABEL:tone(c,1.3),{kind:'paper',seg:12});}}},
  carton:{w:()=>.085,put(k,x,y,z,c){k.box([x,y+.08,z],[.075,.16,.075],c,{kind:'paper',bevel:.004});
    for(const s of [-1,1])k.box([x+s*.019,y+.177,z],[.046,.004,.078],tone(c,.95),{kind:'paper',rot:[0,0,s*-35]});
    k.box([x,y+.192,z],[.008,.016,.078],tone(c,.95),{kind:'paper'});tag(k,x,y+.08,z+.0375,.06,.07,'#4f86b8');}},
  packet:{w:t=>.13+t*.04,put(k,x,y,z,c,t){const w=.13+t*.04,h=.18+t*.05;k.box([x,y+h/2,z-.01],[w,h,.05],c,{kind:'paper',bevel:.022});
    for(const s of [0,1])k.box([x,y+.006+s*(h-.012),z-.01],[w*1.02,.012,.012],tone(c,.85),{kind:'paper'});
    k.turn([x,y+h*.45,z+.016],[[0,0],[w*.26,0]],LABEL,{kind:'paper',seg:12,rot:[90,0,0]});}},
  sack:{w:()=>.24,put(k,x,y,z,c){k.box([x,y+.13,z-.02],[.22,.26,.13],c,{kind:'cloth',bevel:.05});
    k.box([x,y+.27,z-.02],[.12,.05,.08],c,{kind:'cloth',bevel:.02});k.box([x,y+.25,z-.02],[.13,.012,.09],STRING);tag(k,x,y+.12,z+.046,.12,.09);}},
  // The pharmacy.
  medbox:{w:t=>.1+t*.03,put(k,x,y,z,c,t){const w=.1+t*.03,h=.055+t*.02;for(let i=0;i<2+Math.round(t*2);i++){k.box([x,y+h/2+i*h,z-.02],[w,h-.002,.09],PORCELAIN,{kind:'paper',bevel:.003});
    k.box([x,y+h/2+i*h,z+.026],[w*.92,h*.3,.004],c,{kind:'paper'});}}},
  pills:{w:()=>.06,put(k,x,y,z,c,t){k.turn([x,y,z],[[0,0],[.024,0],[.024,0],[.026,.006],[.026,.06],[.02,.07],[.02,.07],[0,.07]],'#f3f0e6',{seg:10});
    k.turn([x,y+.07,z],turnUp(.022,.022),c,{seg:10});tag(k,x,y+.034,z+.026,.03,.03);}},
  // Tea.
  teacakes:{w:()=>.22,put(k,x,y,z,c,t){const n=3+Math.round(t*2);for(let i=0;i<n;i++)k.turn([x,y+i*.032,z],[[0,0],[.1,0],[.1,0],[.1,.016],[.088,.03],[0,.032]],tone(c,1-i%2*.05),{kind:'paper',seg:16});
    k.turn([x,y+n*.032,z],[[0,0],[.03,.001]],SEAL,{kind:'paper',seg:8});}},
  // Bowls, cups and pots.
  bowls:{w:()=>.15,put(k,x,y,z,c,t){bowls(k,[x,y,z],.068,3+Math.round(t*2),c);}},
  teapot:{w:()=>.17,put(k,x,y,z,c){teapot(k,[x+.005,y,z],.055,c);}},
  cups:{w:()=>.2,put(k,x,y,z,c){for(const [dx,dz] of [[-.05,-.02],[.05,-.02],[0,.05]])k.turn([x+dx,y,z+dz],[[0,0],[.02,0],[.02,0],[.032,.045],[.032,.045],[.027,.045],[.027,.045],[0,.008]],c,{seg:12});}},
  mug:{w:()=>.12,put(k,x,y,z,c){k.turn([x,y,z],[[0,0],[.038,0],[.038,0],[.04,.095],[.04,.095],[.034,.095],[.034,.095],[0,.01]],c,{seg:14});k.box([x+.05,y+.05,z],[.014,.06,.014],c,{bevel:.004});}},
  plate:{w:()=>.2,put(k,x,y,z,c){k.turn([x,y+.095,z-.04],[[0,0],[.095,.008],[.095,.008],[.085,.016],[0,.012]],c,{seg:18,rot:[78,0,0]});}},
  vase:{w:t=>.13+t*.04,put(k,x,y,z,c,t){const R=(.13+t*.04)/2;k.turn([x,y,z],[[0,0],[R*.6,0],[R*.6,0],[R,R*1.2],[R*.75,R*2.1],[R*.38,R*2.5],[R*.42,R*2.9],[R*.5,R*3],[R*.5,R*3],[R*.36,R*3],[R*.36,R*3],[R*.36,R*2.6]],c,{seg:16});
    k.turn([x,y,z],[[R*1.005,R*1.05],[R*.98,R*1.35]],t>.5?COBALT:PORCELAIN,{seg:16});}},
  // Books.
  books:{w:t=>.3+t*.2,put(k,x,y,z,c,t,o){const w=.3+t*.2,r=seeded(x.toFixed(2)+y.toFixed(2)+z.toFixed(2));let at=x-w/2;
    while(at<x+w/2-.02){const b=.022+r()*.03,h=(o.height??.24)*(.8+r()*.28),d=.17+r()*.04,col=pick(o.colours??[c],r),lean=at+b>x+w/2-.03&&r()<.5;
      const cx=at+b/2+(lean?.03:0);k.box([cx,y+h/2,z-.02],[b,h,d],col,{kind:'paper',rot:lean?[0,0,-14]:null});
      if(!lean&&r()<.35)for(const f of [.15,.82])k.box([cx,y+h*f,z-.02+d/2+.001],[b*.8,.008,.003],tone(col,1.5));
      at+=b+.003+(lean?.06:0);}}},
  bookstack:{w:()=>.28,put(k,x,y,z,c,t,o){const r=seeded('s'+x.toFixed(2)+z.toFixed(2));let at=y;
    for(let i=0;i<2+Math.round(t*3);i++){const h=.025+r()*.025;k.box([x+(r()-.5)*.02,at+h/2,z],[.24-r()*.05,h,.17-r()*.03],pick(o.colours??[c],r),{kind:'paper',bevel:.003,rot:[0,(r()-.5)*14,0]});
      k.box([x,at+h/2,z+.07],[.2,h*.75,.02],'#f1e9d6',{kind:'paper'});at+=h;}}},
  threadbooks:{w:()=>.22,put(k,x,y,z,c,t){let at=y;for(let i=0;i<3+Math.round(t*3);i++){const h=.018;k.box([x,at+h/2,z],[.2,h*.7,.26],'#efe6d2',{kind:'paper'});
    k.box([x,at+h*.15,z],[.205,h*.3,.265],c,{kind:'paper'});k.box([x,at+h*.85,z],[.205,h*.3,.265],c,{kind:'paper'});
    k.box([x+.07,at+h,z+.06],[.025,.002,.1],LABEL,{kind:'paper'});at+=h;}}},
  // Clothes and shoes.
  folded:{w:()=>.3,put(k,x,y,z,c,t,o){const n=3+Math.round(t*3);for(let i=0;i<n;i++){const col=o.colours?pick(o.colours,seeded(x+'f'+i)):c;
    k.box([x+(i%2-.5)*.008,y+.022+i*.042,z],[.27,.04,.22],col,{kind:'cloth',bevel:.014});}}},
  hat:{w:()=>.36,put(k,x,y,z,c,t){k.turn([x,y,z],[[0,0],[.17,.004],[.17,.012],[.11,.018],[.1,.07],[.08,.1],[0,.105]],c,{kind:t>.5?'cloth':'wood',seg:18});
    k.turn([x,y+.018,z],[[.101,0],[.101,.018]],tone(c,.6),{kind:'cloth',seg:18});}},
  shoes:{w:()=>.24,put(k,x,y,z,c){for(const s of [-1,1]){const at=x+s*.055;k.box([at,y+.012,z],[.085,.024,.24],'#e9e3d6',{bevel:.008});
    k.box([at,y+.045,z-.03],[.08,.055,.17],c,{kind:'cloth',bevel:.025});k.box([at,y+.04,z+.07],[.075,.04,.08],c,{kind:'cloth',bevel:.02});}}},
  // Lamps and the lights shop.
  tablelamp:{w:()=>.26,put(k,x,y,z,c,t,o,lit){k.turn([x,y,z],[[0,0],[.07,0],[.07,0],[.07,.02],[.03,.04],[.016,.05]],c,{seg:14});
    k.box([x,y+.16,z],[.016,.24,.016],BRASS);
    k.add(lathe([[.06,0],[.11,-.15],[.11,-.15],[.06,0]],16),[x,y+.38,z],null,o.shade??'#f6e3b4',null,{material:lit});}},
  bulbs:{w:()=>.1,put(k,x,y,z,c){k.box([x,y+.06,z],[.08,.12,.08],c,{kind:'paper',bevel:.004});tag(k,x,y+.06,z+.04,.06,.05,'#f6d77a');}},
  // Curios.
  clock:{w:()=>.18,put(k,x,y,z,c){k.box([x,y+.1,z],[.15,.2,.08],c,{kind:'wood',bevel:.01});k.box([x,y+.215,z],[.1,.03,.06],c,{kind:'wood',bevel:.006});
    k.turn([x,y+.115,z+.041],[[0,0],[.05,0],[.05,0],[.05,.004],[.05,.004],[0,.004]],'#f2ead2',{seg:16,rot:[90,0,0]});k.box([x,y+.13,z+.046],[.004,.035,.003],INK);}},
  radio:{w:()=>.28,put(k,x,y,z,c){k.box([x,y+.08,z],[.26,.16,.1],c,{kind:'wood',bevel:.015});k.box([x-.05,y+.08,z+.051],[.12,.1,.003],'#d8c49a',{kind:'cloth'});
    k.turn([x+.08,y+.09,z+.05],[[0,0],[.022,0],[.022,0],[.022,.012],[.022,.012],[0,.012]],'#e7dcc0',{seg:12,rot:[90,0,0]});}},
  camera:{w:()=>.15,put(k,x,y,z,c){k.box([x,y+.045,z],[.13,.08,.06],DARK,{bevel:.01});k.box([x-.035,y+.093,z],[.04,.016,.03],DARK,{bevel:.004});
    k.turn([x,y+.045,z+.03],[[0,0],[.03,0],[.03,0],[.028,.035],[.028,.035],[0,.035]],'#2a2a2a',{seg:12,rot:[90,0,0]});k.box([x+.04,y+.045,z+.031],[.035,.05,.002],c);}},
  curios:{w:t=>[.18,.28,.15,.17,.17][Math.floor(t*4.99)],put(k,x,y,z,c,t,o,lit){[GOOD.clock,GOOD.radio,GOOD.camera,GOOD.vase,GOOD.teapot][Math.floor(t*4.99)].put(k,x,y,z,c,t*2%1,o,lit);}},
  // Tools.
  painttin:{w:()=>.15,put(k,x,y,z,c,t){k.turn([x,y,z],[[0,0],[.06,0],[.06,0],[.06,.13],[.06,.13],[.055,.135],[0,.135]],STEEL,{seg:14});
    k.turn([x,y,z],[[.0605,.025],[.0605,.105]],c,{kind:'paper',seg:14});k.box([x,y+.15,z],[.11,.006,.006],DARK);}},
  // Post.
  parcel:{w:t=>.18+t*.14,put(k,x,y,z,c,t){const w=.18+t*.14,h=.1+t*.12,d=.18+t*.1;parcel(k,k,[x,y,z-.02],[w,h,d],c,{ribbon:STRING});tag(k,x-w*.15,y+h*.6,z-.02+d/2,w*.32,h*.3);}},
  envelopes:{w:()=>.24,put(k,x,y,z,c,t){for(let i=0;i<4+Math.round(t*4);i++)k.box([x+(i%3-1)*.006,y+.003+i*.006,z],[.22,.005,.12],i%3?'#efe6d2':c,{kind:'paper',rot:[0,(i%3-1)*3,0]});}},
  // A shop's soft goods (towels, linen) and toys.
  ball:{w:()=>.15,put(k,x,y,z,c){const p=[];for(let i=0;i<=8;i++){const a=(i/8-.5)*Math.PI;p.push([Math.cos(a)*.065,.065+Math.sin(a)*.065]);}k.turn([x,y,z],p,c,{seg:14});}},
  bear:{w:()=>.17,put(k,x,y,z,c){const ball=(at,r)=>{const p=[];for(let i=0;i<=6;i++){const a=(i/6-.5)*Math.PI;p.push([Math.cos(a)*r,r+Math.sin(a)*r]);}k.turn(at,p,c,{kind:'cloth',seg:10});};
    ball([x,y,z],.06);ball([x,y+.1,z+.005],.045);for(const s of [-1,1]){ball([x+s*.035,y+.175,z],.016);ball([x+s*.05,y+.005,z+.04],.022);}}},
  blocks:{w:()=>.16,put(k,x,y,z,c,t,o){const cs=o.colours??[c];for(let i=0;i<3;i++)k.box([x+(i-1)*.05,y+.022,z+(i%2)*.02],[.044,.044,.044],cs[i%cs.length],{kind:'wood',bevel:.005});
    k.box([x,y+.066,z+.01],[.044,.044,.044],cs[3%cs.length],{kind:'wood',bevel:.005});}},
  phone:{w:()=>.14,put(k,x,y,z,c){k.box([x,y+.04,z-.02],[.11,.08,.17],LABEL,{kind:'paper',bevel:.004});k.box([x,y+.083,z-.02],[.07,.006,.14],DARK,{bevel:.002});k.box([x,y+.087,z-.02],[.062,.002,.12],c);}},
  // Restaurant tables: chopsticks, a menu card, sauces.
  chopsticks:{w:()=>.1,put(k,x,y,z,c){k.turn([x,y,z],[[0,0],[.035,0],[.035,0],[.035,.1],[.035,.1],[.03,.1],[.03,.1],[0,.012]],c,{kind:'wood',seg:12});
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2,rr=.012+(i%2)*.008;k.box([x+Math.cos(a)*rr,y+.14,z+Math.sin(a)*rr],[.006,.24,.006],i%3?'#d8c08a':'#a86a3a',{rot:[Math.sin(a)*5,0,Math.cos(a)*5]});}}},
  menucard:{w:()=>.12,put(k,x,y,z,c){for(const s of [-1,1])k.box([x,y+.065,z+s*.022],[.1,.14,.004],s>0?LABEL:c,{kind:'paper',rot:[s*-18,0,0]});}},
  sauces:{w:()=>.14,put(k,x,y,z){bottle(k,[x-.03,y,z],.022,.15,'#3b2418');bottle(k,[x+.03,y,z],.022,.15,'#6a1f1a');tag(k,x-.03,y+.05,z+.022,.03,.03);tag(k,x+.03,y+.05,z+.022,.03,.03);}},
  // Counters: scales, a mortar, an abacus, a bell, a ledger, a brush pot.
  scale:{w:()=>.36,put(k,x,y,z,c){k.box([x,y+.015,z],[.2,.03,.12],c,{kind:'wood',bevel:.006});k.box([x,y+.15,z],[.012,.26,.012],BRASS);k.box([x,y+.28,z],[.3,.008,.008],BRASS);
    for(const s of [-1,1]){for(const d of [-1,1])k.box([x+s*.14+d*.025,y+.215,z],[.002,.13,.002],DARK,{rot:[0,0,d*-11]});k.turn([x+s*.14,y+.14,z],[[0,0],[.055,.012],[.06,.018]],BRASS,{seg:14});}}},
  mortar:{w:()=>.16,put(k,x,y,z,c){k.turn([x,y,z],[[0,0],[.05,0],[.05,0],[.065,.05],[.065,.075],[.052,.075],[.052,.075],[.03,.03],[0,.028]],c,{kind:'stone',seg:14});
    k.box([x+.02,y+.1,z],[.022,.14,.022],tone(c,.9),{kind:'stone',bevel:.008,rot:[0,0,-28]});}},
  abacus:{w:()=>.44,put(k,x,y,z,c){abacus(k,[x,y,z],c);}},
  bell:{w:()=>.1,put(k,x,y,z){k.turn([x,y,z],[[0,0],[.042,0],[.042,0],[.042,.012],[.042,.012],[.036,.014],[.035,.04],[.016,.058],[0,.06]],BRASS,{seg:16});k.turn([x,y+.06,z],[[0,0],[.008,0],[.008,.012],[0,.016]],BRASS,{seg:8});}},
  ledger:{w:()=>.36,put(k,x,y,z,c){k.box([x,y+.006,z],[.34,.012,.24],c,{kind:'paper',bevel:.003});for(const s of [-1,1])k.box([x+s*.083,y+.016,z],[.16,.01,.22],'#f2ead6',{kind:'paper',rot:[0,0,s*-3]});
    for(let i=0;i<5;i++)k.box([x+.09,y+.0215,z-.07+i*.035],[.11,.001,.006],'#8c8478');}},
  brushpot:{w:()=>.12,put(k,x,y,z,c){k.turn([x,y,z],[[0,0],[.045,0],[.045,0],[.045,.12],[.045,.12],[.04,.12],[.04,.12],[0,.01]],c,{seg:14});
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2;k.box([x+Math.cos(a)*.016,y+.18,z+Math.sin(a)*.016],[.009,.25,.009],BAMBOO,{rot:[Math.sin(a)*7,0,Math.cos(a)*7]});}}},
  tray:{w:()=>.34,put(k,x,y,z,c){k.box([x,y+.012,z],[.32,.024,.22],c,{kind:'wood',bevel:.006});for(const [dx,dz] of [[-.08,-.03],[.06,.04],[.1,-.05]])k.turn([x+dx,y+.024,z+dz],[[0,0],[.02,0],[.02,0],[.028,.035],[.028,.035],[.024,.035],[.024,.035],[0,.006]],PORCELAIN,{seg:10});}},
};
/** What hangs on a clothes rail (fillRail): the goods a rail's set can name. */
export const GARMENTS=new Set(['shirt','dress']);
/** Hanging things, from (x, top, z) down: each draws its cord and returns nothing. */
export const HANG={
  gourds(k,x,top,z,c){k.box([x,top-.25,z],[.01,.5,.01],DARK);const ball=(y,r)=>{const p=[];for(let i=0;i<=6;i++){const a=(i/6-.5)*Math.PI;p.push([Math.cos(a)*r,r+Math.sin(a)*r]);}k.turn([x,y,z],p,c,{kind:'wood',seg:12});};
    ball(top-.78,.1);ball(top-.6,.065);k.box([x,top-.5,z],[.016,.04,.016],'#6b4a2a');k.box([x,top-.535,z],[.03,.012,.03],'#b8322a');},
  herbs(k,x,top,z,c){k.box([x,top-.2,z],[.01,.4,.01],DARK);for(let i=0;i<9;i++){const a=i/9*Math.PI*2;k.box([x+Math.cos(a)*.02,top-.56,z+Math.sin(a)*.02],[.012,.34,.012],tone(c,.85+(i%3)*.1),{kind:'wood',rot:[Math.sin(a)*8,i*40,Math.cos(a)*8]});}
    k.box([x,top-.42,z],[.06,.03,.06],STRING);},
  garlic(k,x,top,z){k.box([x,top-.3,z],[.012,.6,.012],STRING);for(let i=0;i<6;i++)k.turn([x+(i%2-.5)*.04,top-.66+i*.07,z],[[0,0],[.045,.03],[.04,.075],[0,.095]],'#efe8d8',{seg:8});},
  chilli(k,x,top,z){k.box([x,top-.3,z],[.012,.6,.012],STRING);for(let i=0;i<14;i++)k.box([x+((i*7)%5-2)*.012,top-.7+i*.035,z+((i*3)%5-2)*.01],[.022,.09,.022],i%4?'#b8322a':'#8f2620',{rot:[0,i*50,15+(i%3)*10]});},
  steamers(k,x,top,z,c){k.box([x,top-.15,z],[.012,.3,.012],DARK);GOOD.steamers.put(k,x,top-.52,z,c,1);},
  basket(k,x,top,z,c){k.box([x,top-.2,z],[.012,.4,.012],DARK);basket(k,[x,top-.62,z],.16,.22,c);},
  pendant(k,x,top,z,c,lit,t){const drop=.45+t*.4;k.box([x,top-drop/2,z],[.012,drop,.012],DARK);
    if(t<.5)k.add(lathe([[.04,0],[.17,-.2],[.17,-.2],[.04,0]],18),[x,top-drop,z],null,c,null,{material:lit});
    else{const p=[];for(let i=0;i<=8;i++){const a=(i/8-.5)*Math.PI;p.push([Math.max(.03,Math.cos(a)*.15),Math.sin(a)*.17]);}k.add(lathe(p,16),[x,top-drop-.17,z],null,c,null,{material:lit});}
    k.turn([x,top-drop,z],[[0,0],[.04,0],[.04,.03],[0,.03]],BRASS,{seg:10});},
  birdcage(k,x,top,z,c){k.box([x,top-.2,z],[.012,.4,.012],DARK);const y=top-.75;k.turn([x,y,z],[[0,0],[.15,0],[.15,0],[.15,.02],[.15,.02],[0,.02]],c,{kind:'wood',seg:14});
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;k.box([x+Math.cos(a)*.14,y+.17,z+Math.sin(a)*.14],[.008,.32,.008],c,{kind:'wood'});}
    k.turn([x,y+.33,z],[[0,0],[.15,0],[.15,0],[.1,.07],[0,.1]],c,{kind:'wood',seg:14});},
};

/** What each hanging thing is looked at by (objects.json). */
export const HUNG={gourds:'gourd',herbs:'herbs',garlic:'garlic',chilli:'chilli',steamers:'steamer',basket:'basket',pendant:'lamp',birdcage:'birdcage'};

// ── Where goods go ────────────────────────────────────────────────────────────────────────────────

/** A weighted pick from a set's goods. */
function choose(goods,r){
  const total=goods.reduce((a,g)=>a+(g.weight??1),0);let at=r()*total;
  for(const g of goods){at-=g.weight??1;if(at<=0)return g;}
  return goods[goods.length-1];
}
/** Along each shelf row [y, x0, x1, z]: one good after another, a finger's width apart. */
function fillRows(kits,rows,set,r,lit){
  for(const [y,x0,x1,z] of rows){
    let x=x0,miss=0;
    while(x<x1-.05&&miss<4){
      const g=choose(set.goods,r),t=r(),b=GOOD[g.good],w=b.w(t);
      if(x+w>x1){miss++;continue;}
      b.put(kits(g.look??set.look),x+w/2,y,z,pick(g.colours??['#c9a77a'],r),t,g,lit);
      x+=w+(set.gap??.012);
    }
  }
}
/** One good at each spot [x, y, z] in turn (a table, a counter). */
function fillSpots(kits,spots,set,r,lit){
  set.goods.forEach((g,i)=>{const at=spots[i];if(at)GOOD[g.good].put(kits(g.look??set.look),at[0],at[1],at[2],pick(g.colours??['#c9a77a'],r),r(),g,lit);});
}
/**
 * Clothes on a rail [y, x0, x1, z]: each on its hanger, side on to the aisle as a shop hangs them,
 * shirts and jackets and the odd long coat or dress.
 */
function fillRail(k,[y,x0,x1,z],set,r){
  for(let x=x0+.04;x<x1-.03;x+=.075+r()*.03){
    const g=choose(set.goods,r),c=pick(g.colours,r),long=g.good==='dress'||r()<.2,len=long?.85:.55+r()*.12;
    k.box([x,y-.025,z],[.006,.05,.006],STEEL);
    k.box([x,y-.07,z],[.01,.012,.36],tone(c,.8),{kind:'wood',bevel:.003});   // the hanger
    k.box([x,y-.08-len/2,z],[.035,len,.36],c,{kind:'cloth',bevel:.012});
    if(g.good==='dress')k.box([x,y-.08-len*.82,z],[.04,len*.36,.46],c,{kind:'cloth',bevel:.012});
    else for(const s of [-1,1])k.box([x,y-.08-len*.3,z+s*.19],[.03,len*.55,.07],tone(c,.94),{kind:'cloth',bevel:.01,rot:[s*-6,0,0]});
  }
}
/** Tools on a pegboard [y0, y1, x0, x1, z] (its face, facing +z): hammers, saws, spanners and screwdrivers. */
function fillPegs(k,[y0,y1,x0,x1,z],r){
  for(let y=y1-.12;y>y0+.2;y-=.38)for(let x=x0+.12;x<x1-.1;x+=.24){
    const kind=Math.floor(r()*4),handle=pick(['#b8322a','#2f6f8f','#d9a03a','#6e4a32'],r);
    k.box([x,y+.07,z+.012],[.012,.012,.024],DARK);   // the peg
    if(kind===0){k.box([x,y-.08,z+.02],[.028,.26,.022],handle,{bevel:.006});k.box([x,y+.06,z+.02],[.11,.035,.03],STEEL,{bevel:.005});}
    else if(kind===1){k.box([x,y-.06,z+.016],[.1,.3,.004],'#c9ced0',{rot:[0,0,4]});k.box([x,y+.1,z+.02],[.1,.06,.028],handle,{kind:'wood',bevel:.008});}
    else if(kind===2){k.box([x,y-.05,z+.016],[.024,.26,.008],STEEL,{bevel:.003});for(const s of [-1,1])k.box([x,y-.05+s*.13,z+.016],[.05,.03,.008],STEEL,{bevel:.003});}
    else{k.box([x,y+.02,z+.02],[.03,.11,.03],handle,{bevel:.008});k.box([x,y-.1,z+.02],[.008,.14,.008],STEEL);}
  }
}
/** A rail of kitchen tools on the wall over a worktop [y, x0, x1, z]: ladles, a spatula, a strainer, a cleaver. */
function fillUtensils(k,[y,x0,x1,z]){
  k.box([(x0+x1)/2,y,z],[x1-x0,.018,.018],STEEL);
  for(const x of [x0+.02,x1-.02])k.box([x,y,z-.02],[.02,.04,.04],STEEL);
  const n=Math.floor((x1-x0-.1)/.16);
  for(let i=0;i<n;i++){
    const x=x0+.12+i*(x1-x0-.2)/Math.max(1,n-1),kind=i%4;
    k.box([x,y-.03,z+.012],[.006,.05,.006],DARK);
    if(kind===0){k.box([x,y-.2,z+.015],[.016,.3,.008],STEEL);k.turn([x,y-.38,z+.04],[[0,0],[.045,.01],[.05,.03],[.045,.03],[0,.006]],STEEL,{seg:12});}
    else if(kind===1){k.box([x,y-.16,z+.015],[.02,.22,.01],'#6e4a32',{kind:'wood'});k.box([x,y-.32,z+.016],[.07,.1,.006],STEEL);}
    else if(kind===2){k.box([x,y-.18,z+.015],[.014,.26,.008],BAMBOO,{kind:'wood'});k.turn([x,y-.37,z+.05],[[0,0],[.06,.035],[.065,.04]],'#c8a66a',{kind:'wood',seg:12,rot:[0,0,0]});}
    else{k.box([x,y-.12,z+.015],[.026,.12,.02],'#3b2a20',{kind:'wood',bevel:.006});k.box([x,y-.26,z+.012],[.1,.16,.004],'#b9c2c4');}
  }
}
/** A brass pull and a paper label on every drawer of a cabinet: `drawers` {x:[first, step, n], y:[...], z}. */
function fillDrawers(k,{x:[x0,dx,nx],y:[y0,dy,ny],z}){
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
    const x=x0+i*dx,y=y0+j*dy;
    k.turn([x,y-.06,z],[[0,0],[.018,0],[.018,.008],[.012,.016],[0,.018]],BRASS,{seg:10,rot:[90,0,0]});
    k.box([x,y+.06,z+.002],[.13,.05,.004],LABEL,{kind:'paper'});
    k.box([x,y+.06,z+.005],[.02,.03,.002],INK);
  }
}

// ── Ceilings ──────────────────────────────────────────────────────────────────────────────────────

/** Where the room's four beams run across it (interior.js draws them, town.js boxes them). */
const beamsOf=(d)=>[0,1,2,3].map(i=>-d/2+1.4+i*((d-2.8)/3));
/**
 * The ceiling, under the room's plaster lid: `rafters` (timber boards with rafters across the beams
 * and a wall plate round the top of the walls), `boards` (the boards and wall plate only), `coffers`
 * (a timber grid of sunk panels, for halls), `panels` (云海: a plaster cornice and lit panels between
 * the beams). Tagged 天花板 as the lid is, so looking up still names the ceiling.
 */
function ceiling(models,root,data,style,glowing,slabs){
  if(data.open||!style)return null;
  const [w,d]=data.size,h=data.height,k=new Kit(models.painted,{jitter:.04}),beam=data.roofBeam,trim=data.trim;
  if(style==='rafters'||style==='boards'||style==='coffers'){
    const boards=tone(mix(TIMBER,beam,.35),1.18),rafter=mix(TIMBER,beam,.3);
    k.box([0,h-.008,0],[w,.016,d],boards,{kind:'wood'});
    if(style==='rafters')for(let x=-w/2+.32;x<w/2-.15;x+=.42)k.box([x,h-.05,0],[.075,.06,d-.02],rafter,{kind:'wood',bevel:.01});
    // Joists under an upper floor, across its shorter span, so the ground floor has a timber ceiling too.
    for(const s of slabs)for(let a=-(s.hw<s.hd?s.hd:s.hw)+.25;a<(s.hw<s.hd?s.hd:s.hw)-.1;a+=.5){
      if(s.hw<s.hd)k.box([s.x,s.y0-.06,s.z+a],[s.hw*2-.02,.12,.08],rafter,{kind:'wood',bevel:.01});
      else k.box([s.x+a,s.y0-.06,s.z],[.08,.12,s.hd*2-.02],rafter,{kind:'wood',bevel:.01});
    }
    if(style==='coffers'){
      const b=beamsOf(d);
      for(let x=-w/2+1.2;x<w/2-.6;x+=1.2)k.box([x,h-.07,0],[.1,.12,d-.02],beam,{kind:'wood',bevel:.012});
      for(let i=0;i<3;i++)k.box([0,h-.07,(b[i]+b[i+1])/2],[w-.02,.12,.1],beam,{kind:'wood',bevel:.012});
    }
    for(const s of [-1,1]){
      k.box([0,h-.09,s*(d/2-.06)],[w,.14,.12],trim,{kind:'wood',bevel:.012});
      k.box([s*(w/2-.06),h-.09,0],[.12,.14,d-.24],trim,{kind:'wood',bevel:.012});
    }
  } else if(style==='panels'){
    const plaster=data.wall;
    for(const s of [-1,1]){
      k.box([0,h-.05,s*(d/2-.05)],[w,.1,.1],tone(plaster,.97),{kind:'plaster',bevel:.02});
      k.box([s*(w/2-.05),h-.05,0],[.1,.1,d-.2],tone(plaster,.97),{kind:'plaster',bevel:.02});
    }
    const beams=beamsOf(d),gaps=[];
    for(let i=0;i<beams.length-1;i++)gaps.push((beams[i]+beams[i+1])/2);
    gaps.push((beams[0]-d/2)/2,(beams[3]+d/2)/2);
    for(const z of gaps)for(let x=-w/2+1.6;x<w/2-1.2;x+=2.4){
      k.box([x,h-.012,z],[.9,.024,.5],tone(plaster,.9),{kind:'plaster'});
      k.box([x,h-.026,z],[.78,.008,.38],'#fff6e0',{material:glowing});
    }
  }
  return k.build(root,'ceiling-works',{look:'ceiling'});
}

// ── Hanging things and wall pieces ────────────────────────────────────────────────────────────────

/**
 * Spots along the beams for `n` hanging things: clear of the door's way in, the signs hung over
 * counters, the room's lanterns, anything tall underneath and what already hangs there (`taken`, which
 * the chosen spots join), spread out along the room.
 */
export function hangSpots(data,fittings,n,drop,taken=[]){
  const [w,d]=data.size,h=data.height,bottom=h-drop,spots=[];
  const signs=fittings.filter(f=>f.sign&&!f.signed&&f.kind!=='hardwarebay');
  for(const z of beamsOf(d))for(let x=-w/2+1;x<=w/2-1;x+=.9){
    if(z>d/2-2.2&&Math.abs(x)<1.6)continue;
    if(signs.some(f=>Math.abs(f.x-x)<1.3&&Math.abs(f.z-z)<1.3))continue;
    if((data.lanterns??[]).some(([lx,lz])=>Math.hypot(lx-x,lz-z)<1.1))continue;
    if(fittings.some(f=>f.entity&&(f.y??0)+(f.top??0)>bottom-.25&&Math.abs(f.x-x)<f.hw+.3&&Math.abs(f.z-z)<f.hd+.3))continue;
    if(taken.some(([tx,tz])=>Math.hypot(tx-x,tz-z)<1.2))continue;
    spots.push([x,z]);
  }
  const chosen=spots.length<=n?spots:Array.from({length:n},(_,i)=>spots[Math.floor((i+.5)*spots.length/n)]);
  taken.push(...chosen);
  return chosen;
}
/** The kinds of wall piece a trade can put up (goods.json `wall`), drawn here; interior.js finds them a free stretch of wall. */
export const WALL_KINDS=new Set(['pigeonholes','wallshelf']);
/** A wall shelf: a timber plank on two brackets with a row of a set's goods on it, its top at y. */
function wallShelf(k,y,set,r){
  k.box([0,y-.02,.14],[1.2,.04,.26],'#7a5a3e',{kind:'wood',bevel:.006});
  for(const x of [-.46,.46])k.box([x,y-.12,.07],[.04,.16,.12],'#6e4a32',{kind:'wood',bevel:.004});
  fillRows(()=>k,[[y,-.56,.56,.14]],set,r,null);
}
/** Pigeonholes for letters: a timber grid of cubbies on a wall, letters in most of them. */
function pigeonholes(k,y,r){
  const W=1.3,H=.9,cols=6,rows=4,cw=W/cols,ch=H/rows;
  k.box([0,y,.012],[W+.06,H+.06,.024],'#6e4a32',{kind:'wood',bevel:.006});
  for(let i=0;i<=cols;i++)k.box([-W/2+i*cw,y,.12],[.016,H,.2],'#8a6a4c',{kind:'wood'});
  for(let j=0;j<=rows;j++)k.box([0,y-H/2+j*ch,.12],[W,.016,.2],'#8a6a4c',{kind:'wood'});
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)if(r()<.75){
    const x=-W/2+(i+.5)*cw,yy=y-H/2+j*ch+.012,n=1+Math.floor(r()*3);
    for(let m=0;m<n;m++)k.box([x+(m-1)*.012,yy+.04,.16-m*.02],[cw*.7,.08,.004],m%2?'#efe6d2':'#e8dcc0',{kind:'paper',rot:[-8,0,0]});
  }
}

// ── Merging a room's static parts ────────────────────────────────────────────────────────────────

/**
 * Merge every static part of a room drawn with the vertex-colour materials (the painted surfaces and
 * models.painted) once, by material and by whether it casts a shadow, with the engine's own batcher
 * used by hand: the room then draws in a handful of calls, and nothing is rebuilt as it is switched
 * on and off at its door (a batch group is, at every entry: the mall's took 30 ms and more). The parts
 * keep their meshes, switched off, for their look boxes; `noBatch` keeps them and the merged meshes
 * out of a batch group of a module's own (the mall's, the stations', the tower's). Under a lid
 * (`closed`) only the room's plaster shell, its walls and ceiling, keeps casting the sun's shadow: it
 * already shades everything inside, so a shelf's or a pillar's shadow there is a draw call nobody sees.
 */
export function mergeStatics(models,root,skip=new Set(),closed=true){
  const app=pc.AppBase.getApplication(),batcher=app.batcher,merge=new Set([models.painted,...Object.keys(SURFACES).map(surface)]),shell=surface('plaster');
  const lists={cast:[],still:[]},taken=[];
  const walk=e=>{
    if(skip.has(e)||e.noBatch||e.name==='person')return;
    const r=e.render;
    if(r?.enabled&&r.meshInstances?.length&&r.meshInstances.every(mi=>merge.has(mi.material)&&mi.mesh?.vertexBuffer)){
      const cast=r.castShadows&&(!closed||e.parent===root&&r.meshInstances[0].material===shell);
      lists[cast?'cast':'still'].push(...r.meshInstances);taken.push(e);
    }
    for(const child of e.children)walk(child);
  };
  walk(root);
  const made=[];
  for(const [key,mis] of Object.entries(lists)){
    if(!mis.length)continue;
    const out=batcher.prepare(mis,false,Number.POSITIVE_INFINITY,false).map(list=>batcher.create(list,false,-1).meshInstance);
    const e=new pc.Entity('room-merged-'+key);e.noBatch=true;root.addChild(e);
    e.addComponent('render',{castShadows:key==='cast',receiveShadows:true});
    e.render.meshInstances=out;made.push(e);
  }
  for(const e of taken){e.render.enabled=false;e.noBatch=true;}
  return made;
}

// ── Dressing a room ──────────────────────────────────────────────────────────────────────────────

/** The set of goods a trade puts on a fitting: by fitting kind, then by its sign ("*" any other). */
function setFor(trade,f){
  const want=GOODS.trades[trade]?.[f.kind]??GOODS.trades['*']?.[f.kind];
  const name=typeof want==='string'?want:want?.[f.sign??'']??want?.['*'];
  return name?GOODS.sets[name]:null;
}
/** The trade of a fitting: the room's, or in a building of several shops (the mall) its zone's. */
function tradeOf(look,f){
  for(const z of look.zones??[])if((f.y??0)===z.y&&Math.sign(f.x)===z.side&&(!z.z||(f.z>=z.z[0]&&f.z<=z.z[1])))return z.trade;
  return look.trade;
}

/**
 * Dress a room the first time it is entered: finish it, give it its ceiling, its goods and its
 * hanging things, register what can be looked at, and batch it. `extra`: {wainscot, panes}.
 */
export function dressRoom(models,town,room,{wainscot=null,panes=[],wallSpot=()=>null,slabs=[]}={}){
  const {data,id,root}=room,look=GOODS.rooms[id]??{},r=seeded(id),lamps=[],named=[];
  const modern=look.ceiling==='panels';
  for(const pane of panes)pane.noBatch=true;   // the street shows through these (src/world/views.js)
  const props=new Set([...room.props.values()].map(p=>p.entity));
  finish(models,root,{plaster:data.wall,timber:new Set(modern?[]:[data.trim,data.roofBeam,wainscot].filter(Boolean).map(hex=>new pc.Color().fromString(hex).toString())),skip:props});
  const glowing=look.ceiling==='panels'?models.glow('#fff4dc'):null;
  const lid=ceiling(models,root,data,look.ceiling,glowing,slabs);if(lid)named.push(lid);
  // Goods on the fittings, a cluster per look name on each.
  let lit=null;const litMaterial=()=>{if(!lit){lit=models.glow('#f7e3b4');lamps.push(lit);}return lit;};
  for(const f of room.fittings??[]){
    if(!f.entity||!f.kind)continue;
    const trade=tradeOf(look,f),set=trade&&setFor(trade,f);
    const kits=new Map(),kitFor=name=>{if(!kits.has(name))kits.set(name,new Kit(models.painted,{jitter:.05}));return kits.get(name);};
    const fr=seeded(id+f.kind+f.x+','+f.z);
    if(set&&f.shelves)fillRows(kitFor,f.shelves,set,fr,set.lit?litMaterial():null);
    if(set&&f.spots)fillSpots(kitFor,f.spots,set,fr,set.lit?litMaterial():null);
    if(set&&f.rail)fillRail(kitFor(set.look),f.rail,set,fr);
    if(f.pegs)fillPegs(kitFor('goods'),f.pegs,fr);
    if(f.drawers)fillDrawers(kitFor('medicine-cabinet'),f.drawers);
    if(f.utensils)fillUtensils(kitFor('kitchen'),f.utensils);
    for(const [name,k] of kits)named.push(k.build(f.entity,'goods-'+name,{look:name}));
  }
  // Things hanging from the beams, each kind clear of the last, and wall pieces where a wall is free.
  const hung=[];
  for(const [kind,n,c] of look.hang??[]){
    const drop=kind==='pendant'?1.05:kind==='gourds'||kind==='birdcage'||kind==='steamers'?.95:.8;
    const glowLit=kind==='pendant'?litMaterial():null;
    hangSpots(data,room.fittings??[],n,drop,hung).forEach(([x,z],i)=>{
      const k=new Kit(models.painted,{jitter:.05});HANG[kind](k,x,data.height-.14,z,c??'#c8a66a',glowLit,(i*.37+.2)%1);
      named.push(k.build(root,'hanging-'+kind,{look:HUNG[kind]}));
    });
  }
  for(const piece of look.wall??[]){
    const spot=wallSpot(piece.kind);if(!spot)continue;
    const k=new Kit(models.painted,{jitter:.05});
    const set=piece.set&&GOODS.sets[piece.set];
    if(piece.kind==='pigeonholes')pigeonholes(k,spot.y,r);
    else if(piece.kind==='wallshelf')wallShelf(k,spot.y,set,r);
    named.push(k.build(spot.frame,'wall-'+piece.kind,{look:piece.look??set?.look??'goods'}));
  }
  for(const node of named)town.registerLooks(id,node);
  for(const m of lamps)town.daylight?.addLamp(m);
  mergeStatics(models,root,props,!data.open);
  return named;
}
