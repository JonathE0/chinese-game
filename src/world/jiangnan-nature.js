import {Kit,lathe,bevelBox,PALETTE} from './jiangnan.js';
import {detail} from '../core/quality.js';

/**
 * Qinghe's greenery, stone and water's edge in the Jiangnan look (task W5-nature, phase P3 of
 * docs/superpowers/specs/2026-10-01-jiangnan-look-design.md): trees, bamboo and blossom shaped like
 * the album illustrations (public/images/roots/*.png: chunky soft clumps, darker underneath and
 * lighter where the sun falls), flowerbeds, the hills round the town, and the river street's canal
 * (granite embankments, steps down to the water, hump-backed stone bridges and a moored 乌篷船).
 *
 * Everything is gathered into Kits (src/world/jiangnan.js): one vertex-coloured mesh per surface, so
 * a whole tree is two or three meshes, and the town's static batch merges every tree into the same
 * few draw calls. Leaves wear the soft painted surface, bark and boats the wood, stone the bluestone;
 * on 低 the surfaces fall back to flat colour, and there are fewer strands, leaves and flowers.
 */

const TAU=Math.PI*2;
const clamp01=x=>Math.min(1,Math.max(0,x));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};

/** A small seeded random, so a plant looks the same on every visit. */
export function seeded(seed){
  let s=(Math.floor(Math.abs(seed)*9973)+7)>>>0;
  return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
}
/** How much of the fine detail (strands, leaves, flowers) each 画质 level builds. */
export const DENSITY={high:1,medium:.75,low:.45};
const share=()=>DENSITY[detail()]??1;
/** A Kit for the shared builders in models.js, which name their own imports from jiangnan.js. */
export const natureKit=(painted,opt)=>new Kit(painted,opt);

// ── Geometry, in metres (pure: unit-tested in tests/nature.test.js) ──────────────────────────────

const empty=()=>({p:[],n:[],uv:[],i:[],shade:[]});
/** A triangle a, b, c of `g`, wound to face along `want`. */
function tri(g,a,b,c,want){
  const P=k=>[g.p[k*3],g.p[k*3+1],g.p[k*3+2]];
  if(dot(cross(sub(P(b),P(a)),sub(P(c),P(a))),want)>=0)g.i.push(a,b,c);else g.i.push(a,c,b);
}
function vertex(g,p,n,uv,shade=1){g.p.push(...p);g.n.push(...n);g.uv.push(...uv);g.shade.push(shade);return g.p.length/3-1;}
/** A flat quad (corners in order round it) facing `n`. */
function quad(g,pts,n,shade=1,uvs=null){
  const k=pts.map((q,i)=>vertex(g,q,n,uvs?uvs[i]:[q[0]+q[2],q[1]],Array.isArray(shade)?shade[i]:shade));
  tri(g,k[0],k[1],k[2],n);tri(g,k[0],k[2],k[3],n);
}
/** Several geometries as one (each may carry `shade`). */
export function join(list){
  const g=empty();
  for(const one of list){
    const base=g.p.length/3;
    g.p.push(...one.p);g.n.push(...one.n);g.uv.push(...one.uv);g.shade.push(...(one.shade??one.p.filter((_,i)=>i%3===0).map(()=>1)));
    g.i.push(...one.i.map(i=>i+base));
  }
  return g;
}

/**
 * A soft lumpy clump of leaves (or a boulder): an ellipsoid of half sizes rx, ry, rz, its surface
 * pushed in and out a little (`lump`), its underside flattened (`flat`), shaded darker underneath and
 * lighter on top as the album's trees are. Seeded, so a clump keeps its shape.
 */
export function blob([rx,ry,rz],seed=1,{seg=9,rings=6,lump=.13,flat=.4,under=.66}={}){
  const r=seeded(seed),a=[r()*TAU,r()*TAU,r()*TAU],profile=[];
  for(let k=0;k<=rings;k++){const f=-Math.PI/2+Math.PI*k/rings;profile.push([Math.cos(f),Math.sin(f)]);}
  const g=lathe(profile,seg),n=g.p.length/3;g.shade=[];
  for(let v=0;v<n;v++){
    const x=g.p[v*3],y=g.p[v*3+1],z=g.p[v*3+2],th=Math.hypot(x,z)<1e-6?0:Math.atan2(z,x),ph=Math.asin(Math.max(-1,Math.min(1,y)));
    const s=1+lump*(Math.sin(3*th+a[0])*Math.cos(2*ph+a[1])+.5*Math.sin(5*th+a[2]+2*ph));
    const down=y<0?1-flat:1;
    g.p[v*3]=x*rx*s;g.p[v*3+1]=y*ry*s*down;g.p[v*3+2]=z*rz*s;
    const N=unit([x/rx,y/(ry*down),z/rz]);g.n[v*3]=N[0];g.n[v*3+1]=N[1];g.n[v*3+2]=N[2];
    g.shade.push(under+(1.1-under)*clamp01((y+1)/2)**.8);
  }
  const k=(rx+rz)/2;g.uv=g.uv.map((u,i)=>u*(i%2?ry:k));
  return g;
}
/** A tapered round limb from a to b (radius r0 to r1), open at both ends. */
export function tube(a,b,r0,r1,seg=6){
  const g=empty(),d=sub(b,a),len=Math.hypot(...d)||1e-6,ax=d.map(v=>v/len);
  const u=unit(cross(Math.abs(ax[1])<.9?[0,1,0]:[1,0,0],ax)),w=cross(u,ax);
  for(let j=0;j<=seg;j++){
    const t=TAU*j/seg,c=Math.cos(t),s=Math.sin(t),n=[0,1,2].map(k=>c*u[k]+s*w[k]);
    for(const [end,r,v] of [[a,r0,0],[b,r1,len]])vertex(g,[0,1,2].map(k=>end[k]+n[k]*r),n,[t*(r0+r1)/2,v]);
  }
  for(let j=0;j<seg;j++){const A=j*2,B=A+2;g.i.push(A,A+1,B,B,A+1,B+1);}
  return g;
}
/** A strip through `points`, `widths` across along `side`, seen from both faces: a willow strand. */
export function ribbon(points,widths,side,shades=null){
  const g=empty(),m=points.length;
  for(const face of [1,-1]){
    const base=g.p.length/3;
    for(let k=0;k<m;k++){
      const p=points[k],w=widths[k]/2,t=sub(points[Math.min(m-1,k+1)],points[Math.max(0,k-1)]),n=unit(cross(side,t)).map(v=>v*face);
      for(const s of [-1,1])vertex(g,[p[0]+side[0]*w*s,p[1]+side[1]*w*s,p[2]+side[2]*w*s],n,[s*w,k*.3],shades?.[k]??1);
    }
    for(let k=0;k<m-1;k++){
      const a=base+k*2,n=g.n.slice(a*3,a*3+3);
      tri(g,a,a+1,a+2,n);tri(g,a+1,a+3,a+2,n);
    }
  }
  return g;
}
/** A pointed leaf blade from `base` along `dir` (unit), `len` long and `width` wide, flat in the
 *  plane of `dir` and `across`, seen from both faces. */
export function blade(base,dir,across,len,width,shade=1){
  const g=empty(),tip=base.map((v,k)=>v+dir[k]*len),mid=base.map((v,k)=>v+dir[k]*len*.4);
  const L=mid.map((v,k)=>v-across[k]*width/2),R=mid.map((v,k)=>v+across[k]*width/2),n=unit(cross(across,dir));
  for(const face of [1,-1]){
    const nn=n.map(v=>v*face),k=[base,L,tip,R].map((q,i)=>vertex(g,q,nn,[i%2?width:0,i*len/3],i===2?shade*1.08:shade));
    tri(g,k[0],k[1],k[2],nn);tri(g,k[0],k[2],k[3],nn);
  }
  return g;
}

/** A flat stone of irregular outline, rx by rz across and h thick, its top edge softened: a
 *  flagstone or stepping stone. */
export function flag(rx,rz,h,seed=1,seg=7){
  const r=seeded(seed),k=Array.from({length:seg},()=>.82+r()*.3),g=lathe([[1,0],[1,h*.7],[1,h*.7],[.9,h],[.9,h],[0,h]],seg);
  for(let v=0;v<g.p.length/3;v++){
    const a=Math.atan2(g.p[v*3+2],g.p[v*3]),j=Math.round(((a+TAU)%TAU)/TAU*seg)%seg;
    g.p[v*3]*=rx*k[j];g.p[v*3+2]*=rz*k[j];
  }
  return g;
}

// ── Trees ────────────────────────────────────────────────────────────────────────────────────────

/** Leaf greens for each street tree (deep, mid, sunlit), and the bark. */
const LEAVES={
  tree:['#56784a','#6f9358','#93b26e'],willow:['#7a9750','#91ad5e','#afc77c'],
  ginkgo:['#c08d31','#d6aa43','#e8c660'],osmanthus:['#4b6b43','#5e7f4d','#77975c'],
  pine:['#46644a','#557552','#6a8a5e'],
};
const BARK='#6b5745',BARK_DARK='#4d3e33',GOLD='#e8b445';
/** The pine's layered pads, bottom to top: the height a branch leaves the trunk, the way it points,
 *  how far it reaches, and the pad's half sizes. A conifer reads by its tiers. */
export const PINE_TIERS=[
  {y:1.45,turn:20,reach:.45,pad:[.68,.24,.56]},{y:2.05,turn:150,reach:.42,pad:[.64,.23,.52]},
  {y:2.6,turn:265,reach:.36,pad:[.56,.22,.46]},{y:3.1,turn:60,reach:.26,pad:[.46,.2,.4]},{y:3.55,turn:0,reach:0,pad:[.4,.26,.36]},
];

/**
 * A tree of `kind` (world.json `trees`: `tree` 香樟, `willow`, `ginkgo`, `osmanthus`, `pine`; the
 * park's `plum` and `peach`) drawn into `root`, in its own frame (the caller places, turns and
 * scales it). Trunk and limbs in wood, the crown in soft clumps; a willow's hanging strands and the
 * flowers and fallen leaves cast no shadow. `seed` keeps each tree's own shape.
 */
export function buildTree(painted,root,kind='tree',seed=1,{pit=false}={}){
  const lod=share(),r=seeded(seed),wood=new Kit(painted,{jitter:.1}),leaf=new Kit(painted,{jitter:.12}),fine=new Kit(painted,{jitter:.1});
  const [dark,mid,light]=LEAVES[kind]??LEAVES.tree;
  // A street tree's pit: a granite kerb ring 0.3 m high round dark soil, moss at the trunk's foot.
  if(pit){
    const stone=new Kit(painted,{jitter:.05});
    stone.add(lathe([[.85,0],[.85,.27],[.85,.27],[.88,.3],[.88,.3],[.68,.3],[.68,.3],[.68,.26]],16),[0,0,0],null,PALETTE.granite,'stone');
    stone.add(lathe([[.68,.29],[0,.31]],12),[0,0,0],null,'#6e5644','soft');
    for(let k=0;k<4;k++){const a=k*1.7+.4;stone.add(blob([.16,.07,.14],seed+k,{seg:6,rings:3,lump:.3}),[Math.cos(a)*.42,.31,Math.sin(a)*.42],null,PALETTE.moss,'soft');}
    stone.build(root,'pit',{shadows:true});
  }
  const limb=(a,b,r0,r1,c=BARK)=>wood.add(tube(a,b,r0,r1,6),[0,0,0],null,c,'wood');
  // A trunk through `pts`, tapering r0 → r1, flaring into the ground at its foot.
  const trunk=(pts,r0,r1,c=BARK)=>{
    for(let k=0;k+1<pts.length;k++)limb(pts[k],pts[k+1],r0+(r1-r0)*k/(pts.length-1),r0+(r1-r0)*(k+1)/(pts.length-1),c);
    wood.add(lathe([[r0*1.9,0],[r0*1.15,.22],[r0,.45]],7),[pts[0][0],0,pts[0][2]],null,c,'wood');
  };
  const clump=(at,size,c,opt={})=>leaf.add(blob(size,r()*1e4,opt),at,[0,r()*360,0],c,'soft');
  const ring=(n,rad,y0,y1)=>Array.from({length:n},(_,i)=>{const a=i/n*TAU+r()*.5;return [Math.cos(a)*rad,y0+(y1-y0)*(i%2),Math.sin(a)*rad];});
  if(kind==='willow'){
    trunk([[0,0,0],[.12,1.0,.02],[.06,1.95,.06]],.2,.13);
    for(let i=0;i<3;i++){const a=i/3*TAU+.4;limb([.06,1.75,.06],[Math.cos(a)*.85,2.75,Math.sin(a)*.85],.1,.05);}
    // A rounded crown of small clumps, and from all round it the strands arch out and fall, a
    // fountain of thin leafy ribbons wider at the foot than at the crown.
    ring(4,.42,3.0,3.15).forEach((p,i)=>clump(p,[.58,.42,.54],i%2?mid:dark,{lump:.22}));
    clump([0,3.42,0],[.55,.38,.5],light,{lump:.22});
    const n=Math.round(60*lod),strands=[[],[],[]];
    for(let i=0;i<n;i++){
      const a=i/n*TAU+r()*.3,r0=.38+r()*.4,y0=3.0+r()*.45,L=1.0+r()*1.2,out=.2+r()*.2,pts=[],w=[],sh=[];
      for(let k=0;k<=7;k++){
        const t=k/7,rad=r0+out*Math.sin(Math.min(1,t*1.6)*Math.PI/2);
        pts.push([Math.cos(a)*rad,y0+.18*Math.sin(Math.min(1,t*2.2)*Math.PI)-L*t**1.4,Math.sin(a)*rad]);w.push(.12*(1-.7*t)+.02);sh.push(.92+.14*t);
      }
      strands[i%3].push(ribbon(pts,w,[-Math.sin(a),0,Math.cos(a)],sh));
    }
    strands.forEach((list,k)=>list.length&&fine.add(join(list),[0,0,0],null,[dark,mid,light][k],'soft'));
  } else if(kind==='pine'){
    // 黑松: a leaning, twisting trunk and flat cloud pads on short branches, tier on tier.
    const pts=[[0,0,0],[.14,1.0,0],[-.08,2.0,.08],[.08,2.9,0],[0,3.5,0]],at=y=>{
      for(let k=0;k+1<pts.length;k++)if(y<=pts[k+1][1]){const t=(y-pts[k][1])/(pts[k+1][1]-pts[k][1]);return pts[k].map((v,i)=>v+(pts[k+1][i]-v)*t);}
      return pts.at(-1);
    };
    trunk(pts,.2,.08,BARK_DARK);
    PINE_TIERS.forEach((t,i)=>{
      const a=t.turn*Math.PI/180,from=at(t.y),end=[from[0]+Math.cos(a)*t.reach,t.y+.12,from[2]+Math.sin(a)*t.reach];
      if(t.reach)limb(from,end,.07,.04,BARK_DARK);
      clump(end,t.pad,i%2?mid:dark,{flat:.7,lump:.16,under:.6});
      clump([end[0],end[1]+t.pad[1]*.55,end[2]],t.pad.map((v,k)=>v*(k===1?.5:.7)),light,{flat:.8,lump:.18});
    });
  } else if(kind==='ginkgo'){
    // Tall and narrow, gold tiers stacked one on another, a few leaves already down.
    trunk([[0,0,0],[.03,1.6,0],[0,3.1,.02]],.17,.1);
    for(const [y,turn] of [[1.9,0],[2.5,2.1],[3.0,4.2]])limb([0,y,0],[Math.cos(turn)*.6,y+.55,Math.sin(turn)*.6],.07,.04);
    [[1.95,.98,dark],[2.5,.92,mid],[3.02,.8,mid],[3.5,.62,light],[3.92,.4,light]].forEach(([y,w,c])=>
      clump([(r()-.5)*.15,y,(r()-.5)*.15],[w,.36,w*.94],c,{flat:.55,lump:.12}));
    for(let i=0;i<Math.round(8*lod);i++){const a=r()*TAU,d=.5+r()*.6;fine.add(bevelBox(.06,.006,.045),[Math.cos(a)*d,.03,Math.sin(a)*d],[0,r()*180,0],light);}
  } else if(kind==='osmanthus'){
    // 桂花: a short trunk splitting low into a dense round crown, dotted with tiny gold flowers.
    trunk([[0,0,0],[0,1.0,0]],.17,.13);
    for(let i=0;i<3;i++){const a=i/3*TAU+.5;limb([0,.95,0],[Math.cos(a)*.55,1.75,Math.sin(a)*.55],.09,.05);}
    clump([0,2.2,0],[1.15,.95,1.1],dark,{lump:.12});
    for(const [p,c] of ring(3,.62,1.95,2.45).map((p,i)=>[p,i%2?mid:dark]))clump(p,[.7,.58,.66],c);
    clump([0,2.95,0],[.72,.48,.68],light);
    const n=Math.round(26*lod);
    for(let i=0;i<n;i++){
      const a=i*2.4,e=-.2+(i%6)*.16,d=[Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e)];
      fine.add(bevelBox(.045,.045,.045),[d[0]*1.18,2.2+d[1]*.98,d[2]*1.12],[r()*90,r()*90,0],GOLD);
    }
  } else if(kind==='plum'||kind==='peach'){
    // 梅 / 桃: a dark gnarled trunk, branches reaching out and up, airy clumps of blossom with
    // bare twigs between, and petals on the ground.
    const [deep,pale]=kind==='plum'?['#d9667f','#f0b8c4']:['#f0a9bd','#fad3dc'];
    trunk([[0,0,0],[.12,.8,.05],[-.05,1.45,.1],[.08,1.95,0]],.16,.09,BARK_DARK);
    for(let i=0;i<4;i++){
      const a=i/4*TAU+r()*.6,from=[[.12,1.3,.05],[-.05,1.6,.1],[.08,1.95,0],[0,1.8,.05]][i],d=.75+r()*.35,end=[Math.cos(a)*d,2.25+r()*.6,Math.sin(a)*d];
      limb(from,end,.065,.03,BARK_DARK);
      limb(end,[end[0]*1.35,end[1]+.35,end[2]*1.35],.03,.012,BARK_DARK);
      clump(end,[.55,.4,.5],i%2?deep:pale,{lump:.2,flat:.5});
    }
    clump([0,2.75,0],[.7,.48,.65],pale,{lump:.2});clump([-.3,2.45,.35],[.45,.34,.42],deep,{lump:.2});
    for(let i=0;i<Math.round(9*lod);i++){const a=r()*TAU,d=.5+r()*.7;fine.add(bevelBox(.06,.006,.045),[Math.cos(a)*d,.025,Math.sin(a)*d],[0,r()*180,0],pale);}
  } else {
    // 香樟: a broad dome of clumps over three limbs.
    trunk([[0,0,0],[.06,1.2,.02],[-.02,2.0,.05]],.2,.12);
    for(let i=0;i<3;i++){const a=i/3*TAU+.3;limb([0,1.7,0],[Math.cos(a)*.75,2.55,Math.sin(a)*.75],.09,.05);}
    clump([0,2.95,0],[1.2,.82,1.15],mid);
    ring(5,.56,2.5,2.9).forEach((p,i)=>clump(p,[.72,.55,.68],p[1]<2.7?dark:mid));
    clump([.1,3.55,0],[.78,.52,.72],light);
  }
  wood.build(root,'trunk',{shadows:true});
  leaf.build(root,'canopy',{shadows:true});
  if(fine.parts.size)fine.build(root,kind==='willow'?'strands':'blossom');
  return root;
}

/**
 * A clump of bamboo `r` across: tall culms with darker nodes, leaning a little, and sprays of
 * pointed leaves up their top half. `stalks` culms (fewer on 低).
 */
export function buildBamboo(painted,root,r,seed=1,stalks=7){
  const lod=share(),rnd=seeded(seed),wood=new Kit(painted,{jitter:.08}),leaf=new Kit(painted,{jitter:.1});
  const CULM=['#7fa35a','#6a9049'],NODE='#5a7a40',LEAF=['#6f9a4c','#8fb566'];
  const n=Math.max(3,Math.round(stalks*(.6+.4*lod))),culms=[],nodes=[],leaves=[[],[]];
  for(let k=0;k<n;k++){
    const a=k/n*TAU+rnd()*.6,d=r*(.25+.6*rnd()),h=4.2+rnd()*1.6,lean=[(rnd()-.5)*.35,0,(rnd()-.5)*.35];
    const base=[Math.cos(a)*d,0,Math.sin(a)*d],top=[base[0]+lean[0]*h/4,h,base[2]+lean[2]*h/4],at=t=>base.map((v,i)=>v+(top[i]-v)*t);
    (k%2?culms:nodes).push(tube(base,top,.05,.035,5));
    for(let y=.45;y<h-.3;y+=.45+rnd()*.1){const t=y/h;nodes.push(tube(at(t-.008),at(t+.008),.058,.058,5));}
    // Sprays: a few blades fanning out and drooping from each node in the top half.
    const sprays=Math.round((4+rnd()*3)*lod)+1;
    for(let s=0;s<sprays;s++){
      const t=.5+.48*s/sprays,o=at(t),turn=rnd()*TAU;
      for(let b=0;b<4;b++){
        const ang=turn+(b-1.5)*.5,dir=unit([Math.cos(ang),-.35-rnd()*.4,Math.sin(ang)]),across=unit(cross(dir,[0,1,0]));
        leaves[b%2].push(blade(o,dir,across,.32+rnd()*.12,.06,.9+rnd()*.2));
      }
    }
  }
  wood.add(join(culms),[0,0,0],null,CULM[0],'wood');wood.add(join(nodes),[0,0,0],null,CULM[1],'wood');
  leaves.forEach((list,i)=>leaf.add(join(list),[0,0,0],null,LEAF[i],'soft'));
  wood.build(root,'culms',{shadows:true});leaf.build(root,'leaves');
  return root;
}

/**
 * Grass over a w × d patch centred on the origin of `kit`: tufts of three blades leaning apart, as
 * many as the 画质 level allows; `each(x, z, i)` is told where each tuft stands (for flowers).
 */
export function lawn(kit,w,d,seed=1,each=null,{per=.8,colours=['#7c9a63','#94b07a']}={}){
  const rnd=seeded(seed),n=Math.round(w*d*per*share());
  for(let i=0;i<n;i++){
    const x=(rnd()-.5)*w,z=(rnd()-.5)*d,turn=rnd()*TAU,blades=[];
    for(let b=0;b<3;b++){
      const a=turn+b*2.1,dir=unit([Math.cos(a)*.35,1,Math.sin(a)*.35]);
      blades.push(blade([x,.04,z],dir,[-Math.sin(a),0,Math.cos(a)],.24+rnd()*.14,.07,.85+rnd()*.25));
    }
    kit.add(join(blades),[0,0,0],null,colours[i%colours.length],'soft');
    each?.(x,z,i);
  }
}
/** Flowers in drifts of a colour: `n` blooms on short stems over a disc `r` across at height `y`. */
export function flowers(kit,n,r,y,colours,seed=1,{stem='#6c8a58'}={}){
  const rnd=seeded(seed);
  for(let k=0;k<n;k++){
    const a=k*2.4,d=r*Math.sqrt((k+.5)/n),x=Math.cos(a)*d,z=Math.sin(a)*d,h=y+.08+rnd()*.14;
    kit.add(bevelBox(.012,(h-y)/2,.012),[x,(h+y)/2,z],null,stem);
    kit.add(blob([.06,.045,.06],k+seed,{seg:5,rings:3,lump:.25,flat:.5,under:.85}),[x,h,z],null,colours[Math.floor(k/4)%colours.length],'soft');
  }
}

/**
 * A raised round flowerbed 花坛 `r` across (garden.json `flowerbeds`): a granite kerb with a coping,
 * dark soil, a low mound of leaves and blooms in drifts of colour.
 */
export function buildFlowerbed(painted,root,r,colours,seed=1){
  const lod=share(),stone=new Kit(painted,{jitter:.05}),green=new Kit(painted,{jitter:.1}),bloom=new Kit(painted,{jitter:.08});
  stone.add(lathe([[r,0],[r,.38],[r,.38],[r+.04,.4],[r+.04,.46],[r+.04,.46],[r-.16,.46],[r-.16,.46],[r-.16,.4]],18),[0,0,0],null,PALETTE.granite,'stone');
  stone.add(lathe([[r-.16,.42],[0,.43]],14),[0,0,0],null,'#6e5644','soft');
  green.add(blob([r*.82,.13,r*.82],seed,{seg:12,rings:4,lump:.18,flat:1}),[0,.44,0],null,'#6f9a55','soft');
  for(let k=0;k<Math.round(5*lod)+2;k++){const a=k*2.1+seed,d=r*.45;green.add(blob([.22,.14,.2],seed+k,{seg:6,rings:4,lump:.2}),[Math.cos(a)*d,.55,Math.sin(a)*d],null,'#5f8a4c','soft');}
  flowers(bloom,Math.round(r*14*lod)+4,r*.76,.5,colours,seed);
  stone.build(root,'kerb',{shadows:true});green.build(root,'leaves');bloom.build(root,'blooms');
  return root;
}

// ── The hills round the town ─────────────────────────────────────────────────────────────────────

/** A hill's outline, base radius 1 and height 1: a cone's lower slopes with a rounded crown, so its
 *  footprint at the town's ground stays where the old cone's was. */
const HILL=[[1,0],[.8,.2],[.6,.4],[.44,.58],[.31,.74],[.17,.88],[.05,.96],[0,.97]];
/** How wide a hill is (fraction of its base radius) at a fraction `t` of its height. */
export function hillRadius(t){
  for(let k=0;k+1<HILL.length;k++)if(t<=HILL[k+1][1]){const [r0,y0]=HILL[k],[r1,y1]=HILL[k+1];return r0+(r1-r0)*(t-y0)/(y1-y0);}
  return 0;
}
/**
 * The hills that close the town off: `list` of [x, z, width, height, depth, colour], each standing
 * with its foot half a height below the ground, as the cones did. Soft rounded crowns, folds in their
 * slopes, lighter towards the top, and small trees dotted over the side that faces the town.
 */
export function buildHills(painted,parent,list){
  const lod=share(),land=new Kit(painted,{jitter:.04}),woods=new Kit(painted,{jitter:.12}),root=parent;
  list.forEach(([x,z,w,h,d,colour],i)=>{
    const rnd=seeded(i*31+7),g=lathe(HILL,16),y0=-.5-h/2,ph=[rnd()*TAU,rnd()*TAU];g.shade=[];
    for(let v=0;v<g.p.length/3;v++){
      const px=g.p[v*3],py=g.p[v*3+1],pz=g.p[v*3+2],th=Math.atan2(pz,px),s=1+.08*Math.sin(3*th+ph[0])+.05*Math.sin(7*th+ph[1])*(1-py);
      g.p[v*3]=px*s*w/2;g.p[v*3+1]=py*h;g.p[v*3+2]=pz*s*d/2;g.shade.push(.82+.28*py);
    }
    land.add(g,[x,y0,z],null,colour,'soft');
    // Trees on the slope facing the town (the hills to the north face south, and so on).
    const face=Math.atan2(-z,-x),n=Math.round(w*.5*lod);
    for(let k=0;k<n;k++){
      const t=.42+rnd()*.4,a=face+(rnd()-.5)*2.2,R=hillRadius(t)*.98,ty=y0+t*h;
      if(ty<.5)continue;
      const tx=x+Math.cos(a)*R*w/2,tz=z+Math.sin(a)*R*d/2,s=.7+rnd()*.7;
      woods.add(blob([.9*s,1.15*s,.9*s],i*100+k,{seg:6,rings:4,lump:.2}),[tx,ty+.6*s,tz],null,k%3?'#5f7d58':'#6e8c63','soft');
    }
  });
  land.build(root,'hill');woods.build(root,'hill');
}

// ── The canal: embankments, steps, bridges and a boat ────────────────────────────────────────────

export const GRANITE='#a3a198';
const GRANITE_DARK='#858479',WET='#59625c';
/**
 * The river street's canal sunk between granite embankments (world.json scenery `waterEdge`):
 * `channel` rects whose water lies at `level`; walls a quarter of a metre thick down each side, a
 * dark wet band at the water line, and a granite coping along the top. `landing(x, z)` says where a
 * bridge lands (no coping drawn there).
 */
export function buildEmbankment(painted,parent,channel,level,landing=()=>false){
  const wet=new Kit(painted,{jitter:.06}),T=.25,low=level-.55,top=.04;
  for(const s of channel){
    const cx=(s.x0+s.x1)/2,cz=(s.z0+s.z1)/2,W=s.x1-s.x0,D=s.z1-s.z0;
    // Each side is its own named stone (one look box round the whole canal would swallow the water):
    // its wall, faced inside the channel, a wet band where the water meets it, and a coping of
    // granite kerb stones a little proud of the wall, broken where a bridge lands.
    for(const [x,z,w,d,x0,z0,x1,z1,out] of [[s.x0+T/2,cz,T,D,s.x0,s.z0,s.x0,s.z1,[1,0]],[s.x1-T/2,cz,T,D,s.x1,s.z0,s.x1,s.z1,[-1,0]],
      [cx,s.z0+T/2,W,T,s.x0,s.z0,s.x1,s.z0,[0,1]],[cx,s.z1-T/2,W,T,s.x0,s.z1,s.x1,s.z1,[0,-1]]]){
      const stone=new Kit(painted,{jitter:.1});
      stone.add(bevelBox(w/2,(top-low)/2,d/2,.02),[x,(low+top)/2,z],null,GRANITE_DARK,'stone',{shade:.92});
      wet.add(bevelBox(w/2+.012,.07,d/2+.012),[x,level+.04,z],null,WET,'stone');
      const len=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.round(len/.9)),along=x1!==x0;
      for(let k=0;k<n;k++){
        const u=(k+.5)/n,px=x0+(x1-x0)*u,pz=z0+(z1-z0)*u;
        if(landing(px,pz))continue;
        const l=len/n-.02;
        stone.add(bevelBox(along?l/2:.22,.04,along?.22:l/2,.018),[px+(along?0:out[0]*.07),top+.03,pz+(along?out[1]*.07:0)],null,GRANITE,'stone');
      }
      stone.build(parent,'stone',{look:'stone',shadows:true});
    }
  }
  wet.build(parent,'stone');
}
/**
 * 河埠头: steps down a canal wall to the water, `n` of them from just under the coping at
 * (x, z0) along z to z1, standing `out` metres from the wall (+1: towards +x).
 */
export function buildLanding(painted,parent,{x,z0,z1,out=.6,level,n=6}){
  const kit=new Kit(painted,{jitter:.12}),run=(z1-z0)/n,low=level-.55,drop=(.06-(level-.3))/n;
  for(let k=0;k<n;k++){
    const top=-.02-drop*k,z=z0+run*(k+.5);
    kit.add(bevelBox(Math.abs(out)/2,(top-low)/2,run/2+.005,.02),[x+out/2,(top+low)/2,z],null,GRANITE,'stone',{shade:k>n-3?.8:1});
  }
  kit.build(parent,'stone',{look:'stone',shadows:true});
}
/** The lower edge of a hump-backed bridge's side at x: its arch, the canal bed, or the bank. */
function bridgeFloor(x,arch,bank0,bank1,bed){
  if(x<=bank0||x>=bank1)return 0;
  const d=x-arch.x;
  return Math.abs(d)<arch.r?arch.y+Math.sqrt(arch.r*arch.r-d*d):bed;
}
/**
 * A hump-backed stone bridge 拱桥 across a canal along x (world.json `bridges`: `steps` [x0, x1, top],
 * `z`, `width`): granite steps over solid sides with a round arch, its ring of voussoirs picked out
 * darker, the barrel under it, and low stone parapets of posts and panels. `span` [x0, x1] is the
 * water between the embankment walls; the arch springs from just under the water there.
 */
export function archBridge(painted,parent,b,span,level){
  const kit=new Kit(painted,{jitter:.08}),ring=new Kit(painted,{jitter:.04}),dressed=b.width+.32,side=dressed/2-.04;
  const steps=b.steps,x0=steps[0][0],x1=steps.at(-1)[1],bed=level-.6;
  const arch={x:(span[0]+span[1])/2,r:(span[1]-span[0])/2,y:level-.2};
  for(const [a,c,top] of steps)kit.add(bevelBox((c-a)/2+.005,.14,dressed/2,.025),[(a+c)/2,top-.14,b.z],null,GRANITE,'stone');
  // The sides: columns between the floor (arch, bed or bank) and the underside of the steps.
  const cuts=new Set([x0,x1,...steps.flatMap(s=>[s[0],s[1]]),span[0],span[1]]);
  for(let k=0;k<=24;k++)cuts.add(arch.x-arch.r+2*arch.r*k/24);
  const xs=[...cuts].filter(x=>x>=x0&&x<=x1).sort((a,c)=>a-c),topAt=x=>(steps.find(s=>x>=s[0]&&x<=s[1])??steps[0])[2]-.27;
  const face=empty(),band=empty(),barrel=empty();
  for(let k=0;k+1<xs.length;k++){
    const a=xs[k],c=xs[k+1],m=(a+c)/2,top=topAt(m),fa=bridgeFloor(a+1e-6,arch,span[0],span[1],bed),fc=bridgeFloor(c-1e-6,arch,span[0],span[1],bed);
    const inArch=Math.abs(m-arch.x)<arch.r,shade=inArch&&k%2?.9:1;
    for(const s of [-1,1]){
      const z=b.z+s*side,n=[0,0,s];
      if(top>Math.max(fa,fc))quad(face,[[a,fa,z],[c,fc,z],[c,top,z],[a,top,z]],n);
      if(inArch){const za=z+s*.012;quad(band,[[a,fa,za],[c,fc,za],[c,Math.min(top,fc+.13),za],[a,Math.min(top,fa+.13),za]],n,shade);}
    }
    if(inArch){
      const na=unit([0,arch.y-fa,arch.x-a]),nc=unit([0,arch.y-fc,arch.x-c]),norm=unit([0,(na[1]+nc[1])/2,(na[2]+nc[2])/2]);
      // The barrel's normal points in towards the arch's centre (down and across).
      quad(barrel,[[a,fa,b.z-side],[c,fc,b.z-side],[c,fc,b.z+side],[a,fa,b.z+side]],[norm[2],norm[1],0]);
    }
  }
  kit.add(face,[0,0,0],null,GRANITE_DARK,'stone');kit.add(barrel,[0,0,0],null,'#6f716b','stone');
  ring.add(band,[0,0,0],null,'#77766d','stone');
  // Parapets on the guard line (core/garden.js bridgeRails: half the width and 0.1 out): a post at
  // every other step and at the ends, a low panel along each step, a capping rail on top.
  for(const s of [-1,1]){
    const z=b.z+s*(b.width/2+.1);
    steps.forEach(([a,c,top],i)=>{
      kit.add(bevelBox((c-a)/2+.01,.2,.06,.015),[(a+c)/2,top+.2,z],null,GRANITE,'stone');
      kit.add(bevelBox((c-a)/2+.02,.035,.08,.012),[(a+c)/2,top+.43,z],null,GRANITE_DARK,'stone');
      if(i%2===0||i===steps.length-1)kit.add(bevelBox(.08,.31,.08,.02),[i%2===0?a+.08:c-.08,top+.31,z],null,GRANITE,'stone');
    });
  }
  const root=kit.build(parent,'bridge',{look:'bridge',shadows:true});ring.build(root,'bridge');
  return root;
}
/**
 * A 乌篷船, moored along z at (x, z): a slim timber hull, its ends rising, a plank deck and two
 * arched black awnings of woven bamboo, a long sculling oar laid along it. `len` metres long.
 */
export function buildBoat(painted,parent,{x,z,level,len=2.8,width=.9,rot=0}){
  const wood=new Kit(painted,{jitter:.06}),mat=new Kit(painted,{jitter:.05}),g=empty(),inner=empty(),N=10,H=.32;
  // Cross-sections along the hull: half-width, keel depth and the gunwale's rise at the ends.
  const sec=t=>({w:width/2*Math.sqrt(Math.max(.02,1-t**4)),y:H+.16*t**4,k:-.1*(1-t*t)});
  const pt=(t,s,j)=>{const c=sec(t),u=[-1,-.85,0,.85,1][j],v=[1,.35,0,.35,1][j];return [u*c.w*(1-.25*(1-v)),c.k+(c.y-c.k)*v,t*len/2];};
  const grid=[];for(let i=0;i<=N;i++){const t=-1+2*i/N;grid.push([0,1,2,3,4].map(j=>pt(t,0,j)));}
  for(let i=0;i<N;i++)for(let j=0;j<4;j++){
    const q=[grid[i][j],grid[i+1][j],grid[i+1][j+1],grid[i][j+1]],m=q.reduce((a,p)=>a.map((v,k)=>v+p[k]/4),[0,0,0]);
    const out=unit([m[0],m[1]-H*.6,0]);
    quad(g,q,out,[.85,.85,1,1][j]);quad(inner,q,out.map(v=>-v),.55);
  }
  wood.add(g,[x,level,z],[0,rot,0],'#5a4231','wood');wood.add(inner,[x,level,z],[0,rot,0],'#4a3628','wood');
  const deck=[-.62,-.2,.25,.7].map(t=>t*len/2);
  for(const dz of deck)wood.add(bevelBox(width/2*.82,.02,.16,.01),[x,level+H-.08,z+dz],[0,rot,0],'#7a5c42','wood');
  // The awnings: half-barrels of dark matting over the middle of the boat.
  for(const [c,l] of [[-.12,.42],[.3,.34]]){
    const barrel=empty();
    for(let k=0;k<8;k++){
      const a0=Math.PI*k/8,a1=Math.PI*(k+1)/8,p=a=>[Math.cos(a)*width/2*.88,H+Math.sin(a)*.5],[u0,v0]=p(a0),[u1,v1]=p(a1),n=unit([Math.cos((a0+a1)/2),Math.sin((a0+a1)/2),0]);
      const zz=[c*len-l*len/2,c*len+l*len/2];
      quad(barrel,[[u0,v0,zz[0]],[u1,v1,zz[0]],[u1,v1,zz[1]],[u0,v0,zz[1]]],n,k%2?.9:1);
      quad(barrel,[[u0,v0,zz[0]],[u1,v1,zz[0]],[u1,v1,zz[1]],[u0,v0,zz[1]]],n.map(v=>-v),.5);
    }
    mat.add(barrel,[x,level,z],[0,rot,0],'#2f2c28','cloth');
  }
  wood.add(tube([-.12,H+.08,-len*.55],[.1,H+.12,len*.3],.025,.02,5),[x,level,z],[0,rot,0],'#8a6a4c','wood');
  const root=wood.build(parent,'boat',{look:'boat',shadows:true});mat.build(root,'boat');
  return root;
}
