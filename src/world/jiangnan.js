import * as pc from 'playcanvas';
import {SURFACES,surface,paint} from './look.js';

/**
 * Jiangnan buildings (task W5-look, docs/superpowers/specs/2026-10-01-jiangnan-look-design.md, P0):
 * the geometry helpers (bevelled boxes, turned shapes, curved tile roofs, stepped horse-head gables,
 * lattice windows, framed doors, lanterns), the dressing kit for shop shelves, and the showcase:
 * 家居小铺 rebuilt in white plaster and dark tile outside (world.json `style: "jiangnan"`) and
 * dressed inside (rooms.json `look: "jiangnan"`).
 *
 * Everything is gathered into a Kit: one mesh per material, vertex-coloured, so a whole cluster draws
 * in one call per surface it uses. Outdoors the town's static batch merges kits further; rooms are not
 * batched, so there a kit per named cluster (the jars, the baskets) is what keeps the draw calls down.
 */

// ── Geometry, in metres (pure: unit-tested in tests/jiangnan.test.js) ─────────────────────────────

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Push a convex polygon wound to face along `normal`. */
function polygon(g,pts,normal){
  if(dot(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])),normal)<0)pts=[...pts].reverse();
  const base=g.p.length/3;
  for(const q of pts){g.p.push(...q);g.n.push(...normal);}
  for(let k=1;k<pts.length-1;k++)g.i.push(base,base+k,base+k+1);
}
/**
 * A box of half sizes hx, hy, hz with every edge chamfered by `b` (none at 0): six faces, twelve
 * 45° edge strips and eight corner triangles, so the edges catch the light. `size` is kept for the
 * texture's grain.
 */
export function bevelBox(hx,hy,hz,b=0){
  const h=[hx,hy,hz],g={p:[],n:[],i:[],size:[hx*2,hy*2,hz*2]};
  b=Math.max(0,Math.min(b,hx*.45,hy*.45,hz*.45));
  // The corner `s` (signs) as it lies on face `f`: full size along f, inset by b along the others.
  const at=(s,f)=>[0,1,2].map(a=>s[a]*(a===f?h[a]:h[a]-b));
  for(let f=0;f<3;f++)for(const sf of [-1,1]){
    const u=(f+1)%3,v=(f+2)%3,n=[0,0,0];n[f]=sf;
    polygon(g,[[-1,-1],[1,-1],[1,1],[-1,1]].map(([su,sv])=>{const s=[0,0,0];s[f]=sf;s[u]=su;s[v]=sv;return at(s,f);}),n);
  }
  if(b>0){
    for(let e=0;e<3;e++){
      const a1=(e+1)%3,a2=(e+2)%3;
      for(const s1 of [-1,1])for(const s2 of [-1,1]){
        const S=se=>{const s=[0,0,0];s[e]=se;s[a1]=s1;s[a2]=s2;return s;},n=[0,0,0];n[a1]=s1*Math.SQRT1_2;n[a2]=s2*Math.SQRT1_2;
        polygon(g,[at(S(-1),a1),at(S(1),a1),at(S(1),a2),at(S(-1),a2)],n);
      }
    }
    const k=1/Math.sqrt(3);
    for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){const s=[sx,sy,sz];polygon(g,[at(s,0),at(s,1),at(s,2)],[sx*k,sy*k,sz*k]);}
  }
  return g;
}
/**
 * A profile [[radius, height], ...] turned about the y axis (from angle `from` to `to`): jars,
 * bottles, lanterns, discs. A point given twice is a crease. UVs in metres: round the widest girth,
 * and along the profile.
 */
export function lathe(profile,seg=12,from=0,to=Math.PI*2){
  const g={p:[],n:[],uv:[],i:[]},m=profile.length,R=Math.max(.01,...profile.map(q=>q[0]));
  const along=[0];for(let k=1;k<m;k++)along.push(along[k-1]+Math.hypot(profile[k][0]-profile[k-1][0],profile[k][1]-profile[k-1][1]));
  // Outward normals: the profile's tangent turned a quarter. A crease's two copies each see one side.
  const flat=profile.map((q,k)=>{const a=profile[Math.max(0,k-1)],b=profile[Math.min(m-1,k+1)],dr=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dr,dy)||1;return [dy/l,-dr/l];});
  for(let j=0;j<=seg;j++){
    const a=from+(to-from)*j/seg,c=Math.cos(a),s=Math.sin(a);
    for(let k=0;k<m;k++){const [r,y]=profile[k],[nr,ny]=flat[k];g.p.push(r*c,y,r*s);g.n.push(nr*c,ny,nr*s);g.uv.push((to-from)*j/seg*R,along[k]);}
  }
  for(let j=0;j<seg;j++)for(let k=0;k<m-1;k++){const a=j*m+k,b=a+m;g.i.push(a,a+1,b,b,a+1,b+1);}
  return g;
}
/** A grid of points (rows × columns) as one surface, normals from its neighbours, on the `up` side (+1 above). */
export function sheet(rows,uvs,up=1){
  const g={p:[],n:[],uv:[],i:[]},R=rows.length,C=rows[0].length;
  for(let r=0;r<R;r++)for(let c=0;c<C;c++){
    const dr=sub(rows[Math.min(R-1,r+1)][c],rows[Math.max(0,r-1)][c]),dc=sub(rows[r][Math.min(C-1,c+1)],rows[r][Math.max(0,c-1)]);
    let n=unit(cross(dc,dr));if(n[1]*up<0)n=n.map(v=>-v);
    g.p.push(...rows[r][c]);g.n.push(...n);g.uv.push(...uvs[r][c]);
  }
  for(let r=0;r<R-1;r++)for(let c=0;c<C-1;c++){
    const a=r*C+c,b=a+1,d=a+C+1,e=a+C,P=k=>g.p.slice(k*3,k*3+3);
    const n=g.n.slice(a*3,a*3+3);
    if(dot(cross(sub(P(b),P(a)),sub(P(d),P(a))),n)>=0)g.i.push(a,b,d,a,d,e);else g.i.push(a,d,b,a,e,d);
  }
  return g;
}
/**
 * A curved tile roof over x ∈ [−w/2, w/2]: each side in `sides` (+1 towards +z, −1 towards −z) runs
 * from the ridge line (z = 0, height `top`) out to the eave (`reach` metres out, height `eave`),
 * sagging as Jiangnan roofs do, steep near the ridge and nearly flat at the eave; towards both ends
 * the eave rises `lift` and reaches `flare` further out (飞檐); `end` < 1 stops the slope short (a back
 * eave that barely overhangs). Returns the tile surface, the boards under it (`thick` lower) and the
 * fascia and end strips that close the slab, as three geometries.
 */
export function roofShape({w,reach,top,eave,sides=[-1,1],lift=0,flare=0,thick=.14,end=1}){
  const NX=Math.max(8,Math.round(w/.35)),NS=12,rise=top-eave;
  const point=(x,s,side,down=0)=>{
    const corner=smooth(.5,1,Math.abs(x)/(w/2))**2;
    const y=eave+rise*((1-s)**1.7*.72+(1-s)*.28)+lift*corner*s*s-down;
    return [x,y,side*s*(reach+flare*corner)];
  };
  const tiles=[],under=[],edges={p:[],n:[],i:[]};
  for(const side of sides){
    const rows=[],low=[],uv=[];
    for(let k=0;k<=NS;k++){
      const s=k/NS*end,row=[],lrow=[],urow=[];
      for(let j=0;j<=NX;j++){const x=-w/2+w*j/NX;row.push(point(x,s,side));lrow.push(point(x,s,side,thick));urow.push([x,0]);}
      rows.push(row);low.push(lrow);uv.push(urow);
    }
    // v runs down the slope, in metres along it, so the tile courses keep their size.
    for(let j=0;j<=NX;j++){let v=0;for(let k=0;k<=NS;k++){if(k)v+=Math.hypot(...sub(rows[k][j],rows[k-1][j]));uv[k][j][1]=v;}}
    tiles.push(sheet(rows,uv,1));under.push(sheet(low,uv,-1));
    // The fascia along the eave, and each end of the slab.
    for(let j=0;j<NX;j++){const a=rows[NS][j],b=rows[NS][j+1];polygon(edges,[a,b,low[NS][j+1],low[NS][j]],unit([0,0,side]));}
    for(const [j,sx] of [[0,-1],[NX,1]])for(let k=0;k<NS;k++)polygon(edges,[rows[k][j],rows[k+1][j],low[k+1][j],low[k][j]],[sx,0,0]);
  }
  return {tiles:merge(tiles),under:merge(under),edges};
}
/** The roof's height and reach at a fraction `s` of the way from ridge to eave, for whatever sits on it. */
export function roofAt({reach,top,eave},s){return {y:eave+(top-eave)*((1-s)**1.7*.72+(1-s)*.28),z:s*reach};}
function merge(list){
  const g={p:[],n:[],uv:[],i:[]};
  for(const one of list){const base=g.p.length/3;g.p.push(...one.p);g.n.push(...one.n);g.uv.push(...one.uv);g.i.push(...one.i.map(i=>i+base));}
  return g;
}

// ── The kit: parts gathered into one mesh per material ─────────────────────────────────────────────

const M=new pc.Mat4(),Q=new pc.Quat(),V=new pc.Vec3(),W=new pc.Vec3(),ONE=new pc.Vec3(1,1,1);
let seed=20261001;
const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
export class Kit {
  /** `painted`: the models' shared vertex-colour material (models.painted), for parts with no surface.
   *  `jitter`: each part's colour is nudged by up to this much, so no two boards are quite alike. */
  constructor(painted,{jitter=.06}={}){this.painted=painted;this.jitter=jitter;this.parts=new Map();}
  /**
   * Add geometry `g` at `at`, turned by `rot` (degrees), in `colour` (a hex, or [hex, shade]) on
   * `kind` (a SURFACES key; none is plain) or on an explicit `material`. `ground`: darken towards
   * the foot of the part, as weather does to a wall. UVs are the geometry's own, else projected
   * from the part in metres (grain along a timber's length).
   */
  add(g,at,rot,colour,kind=null,{material=null,ground=0,shade=1}={}){
    const mat=material??(kind?surface(kind):this.painted),metres=SURFACES[kind]?.metres??1,grain=!!SURFACES[kind]?.grain;
    let part=this.parts.get(mat);if(!part)this.parts.set(mat,part={p:[],n:[],c:[],uv:[],i:[]});
    const [hex,k0]=Array.isArray(colour)?colour:[colour,1],c=new pc.Color().fromString(hex),k=k0*shade*(1+(rand()-.5)*this.jitter);
    Q.setFromEulerAngles(...(rot??[0,0,0]));M.setTRS(V.set(...at),Q,ONE);
    const base=part.p.length/3,size=g.size??[1,1,1];
    for(let v=0;v<g.p.length;v+=3){
      const q=[g.p[v],g.p[v+1],g.p[v+2]],n=[g.n[v],g.n[v+1],g.n[v+2]];
      M.transformPoint(V.set(...q),W);part.p.push(W.x,W.y,W.z);
      Q.transformVector(V.set(...n),W);part.n.push(W.x,W.y,W.z);
      const dark=(ground?1-ground*(1-smooth(0,1.4,W.y)):1)*(g.shade?.[v/3]??1);
      part.c.push(...[c.r,c.g,c.b].map(x=>Math.round(Math.min(1,x*k*dark)*255)),255);
      if(g.uv){part.uv.push(g.uv[v/3*2]/metres,g.uv[v/3*2+1]/metres);continue;}
      // Projected: the face's own axes, u across and v up a wall, v along a timber's length.
      const a=Math.abs(n[0])>=Math.abs(n[1])&&Math.abs(n[0])>=Math.abs(n[2])?0:Math.abs(n[1])>=Math.abs(n[2])?1:2;
      let [ua,va]=a===1?[0,2]:[a===0?2:0,1];
      if(grain&&size[ua]>size[va])[ua,va]=[va,ua];
      part.uv.push((q[ua]+at[ua])/metres,(q[va]+at[va])/metres);
    }
    for(const i of g.i)part.i.push(base+i);
    return this;
  }
  /** A box `size` big centred on `at`, chamfered by `bevel`. */
  box(at,size,colour,{kind=null,bevel=0,rot=null,...opt}={}){return this.add(bevelBox(size[0]/2,size[1]/2,size[2]/2,bevel),at,rot,colour,kind,opt);}
  /** A turned shape standing on `at`. */
  turn(at,profile,colour,{kind=null,seg=12,rot=null,from,to,...opt}={}){return this.add(lathe(profile,seg,from,to),at,rot,colour,kind,opt);}
  /** One entity per material under a new node (tagged `look` for the look-at names). */
  build(parent,name,{look=null,shadows=false}={}){
    const root=new pc.Entity(name);if(look)root.lookName=look;parent.addChild(root);
    const device=pc.AppBase.getApplication().graphicsDevice;
    for(const [mat,part] of this.parts){
      const geometry=Object.assign(new pc.Geometry(),{positions:part.p,normals:part.n,colors:part.c,uvs:part.uv,uvs1:part.uv,indices:part.i});
      const e=new pc.Entity(name);e.addComponent('render',{castShadows:shadows,receiveShadows:true});
      e.render.meshInstances=[new pc.MeshInstance(pc.Mesh.fromGeometry(device,geometry),mat)];
      root.addChild(e);
    }
    this.parts=new Map();
    return root;
  }
}

// ── Pieces ───────────────────────────────────────────────────────────────────────────────────────

/** The spec's palette (white walls, dark tiles, timber, stone, red). */
export const PALETTE={plaster:'#ece8df',stain:'#d8d2c4',tile:'#3c4045',ridge:'#2e3236',timber:'#4a3326',redwood:'#7a3b2a',
  lacquer:'#a5302a',lantern:'#c8402f',gold:'#b48a3c',bluestone:'#6f7a80',granite:'#9a9a92',moss:'#6f7d4f',paper:'#f3e6c8',frieze:'#51565a'};
const P=PALETTE;

/** A glowing material for lanterns and lit paper (`glow`: the colour it burns, if not its own): its
 *  emissive follows the vertex colours, so ribs and frames stay darker; the daylight dims it by day
 *  (models.glow's convention). */
function lampMaterial(hex,kind=null,glow=hex){
  const m=new pc.StandardMaterial(),c=new pc.Color().fromString(hex);
  Object.assign(m,{diffuse:c,emissive:new pc.Color().fromString(glow),emissiveIntensity:.55,diffuseVertexColor:true,vertexColorGamma:true,emissiveVertexColor:true,useMetalness:true,metalness:0,gloss:.15});
  if(kind)paint(m,kind);else m.update();
  return m;
}
/** A lattice window `w`×`h` centred on (x, y) on the wall plane z, facing +z (`dir` −1: −z): a timber
 *  frame, a 灯笼锦 lattice (an open centre panel inside a grid of bars) and paper behind (`paper`: a
 *  lit material for it). */
export function latticeWindow(frame,glass,x,y,z,w,h,{bar=.022,step=.11,timber=P.timber,dir=1,paper=null}={}){
  const fw=.09;
  for(const s of [-1,1]){
    frame.box([x+s*(w/2+fw/2),y,z+dir*.035],[fw,h+fw*2,.07],timber,{kind:'wood',bevel:.012});
    frame.box([x,y+s*(h/2+fw/2),z+dir*.035],[w,fw,.07],timber,{kind:'wood',bevel:.012});
  }
  glass.box([x,y,z+dir*.005],[w,h,.01],P.paper,{kind:'paper',material:paper});
  const cx=w*.2,cy=h*.18,zb=z+dir*.03;
  const bars=(x0,y0,x1,y1)=>frame.box([x+(x0+x1)/2,y+(y0+y1)/2,zb],[Math.max(bar,x1-x0),Math.max(bar,y1-y0),.02],timber,{kind:'wood'});
  for(let u=-w/2+step;u<w/2-step*.4;u+=step){
    if(Math.abs(u)<cx+.01){bars(u,-h/2,u,-cy);bars(u,cy,u,h/2);}else bars(u,-h/2,u,h/2);
  }
  for(let v=-h/2+step;v<h/2-step*.4;v+=step){
    if(Math.abs(v)<cy+.01){bars(-w/2,v,-cx,v);bars(cx,v,w/2,v);}else bars(-w/2,v,w/2,v);
  }
  for(const s of [-1,1]){bars(-cx,s*cy,cx,s*cy);bars(s*cx,-cy,s*cx,cy);}
}
/** A red silk lantern hanging from (x, top, z): cord, gold caps, a ribbed glowing body and a tassel. */
export function silkLantern(kit,glowKit,x,top,z,lit,size=1){
  const s=size,cy=top-.22*s-.3*s;
  kit.box([x,top-.11*s,z],[.015,.22*s,.015],'#3b2e26');
  kit.turn([x,cy+.31*s,z],[[0,0],[.09*s,0],[.09*s,0],[.09*s,.05*s],[.09*s,.05*s],[0,.05*s]],P.gold,{seg:10});
  kit.turn([x,cy-.36*s,z],[[0,0],[.09*s,0],[.09*s,0],[.09*s,.05*s],[.09*s,.05*s],[0,.05*s]],P.gold,{seg:10});
  // Ribs: every other column a shade darker, so the glow shows the silk panels.
  const body=[];for(let k=0;k<=8;k++){const t=k/8,a=(t-.5)*Math.PI;body.push([Math.max(.06,Math.cos(a)*.27)*s,Math.sin(a)*.32*s]);}
  const g=lathe(body,16);
  for(let v=0;v<g.p.length/3;v++){const j=Math.floor(v/body.length);g.shade??=[];g.shade.push(j%2?.78:1);}
  glowKit.add(g,[x,cy,z],null,P.lantern,null,{material:lit});
  kit.box([x,cy-.5*s,z],[.02,.16*s,.02],P.gold);
  kit.turn([x,cy-.74*s,z],[[0,0],[.045*s,.06*s],[.02*s,.2*s],[0,.2*s]],P.lantern,{seg:8});
}
/** Eight segments of a ring (radius `r`, wire `t`) facing +z at `at`: a door knocker. */
function ring(kit,at,r,t,colour){
  const prof=[];for(let k=0;k<=8;k++){const a=k/8*Math.PI*2;prof.push([r+Math.cos(a)*t,Math.sin(a)*t]);}
  kit.turn(at,prof,colour,{seg:12,rot:[90,0,0]});
}

/**
 * The showcase shopfront (models.building, `style: "jiangnan"`): a white plaster body on a bluestone
 * plinth, a curved dark tile roof with a standing-tile ridge and curled ends, eave tiles and rafter
 * ends, stepped horse-head gables (马头墙) at both ends running out past the eaves (墀头 corbels on
 * their ends), a granite-framed door with lattice leaves, its sign as a plaque under a little tiled
 * hood with upturned corners, lattice windows with lit paper, red silk lanterns, and bluestone paving
 * round it (world.json `paving`: metres out to the left, right, front and back, in its own frame).
 * In the building's own frame, its front at +z. Parts are tagged with objects.json names.
 */
export function jiangnanFront(models,root,data){
  // The front eave overhangs `ov` and the end walls run `wing` out past the front to hold it; at the
  // back the eave barely overhangs and the walls stop at the wall, leaving the lane behind clear.
  const w=data.width,d=data.depth,h=data.height,f=d/2,t=.32,plinth=.32,ov=.55,wing=.62,zEnd=side=>side>0?f+wing:f+.03;
  const walls=new Kit(models.painted),roofKit=new Kit(models.painted),eaves=new Kit(models.painted),stone=new Kit(models.painted,{jitter:.1});
  const door=new Kit(models.painted),lattice=new Kit(models.painted),paper=new Kit(models.painted,{jitter:0}),lanterns=new Kit(models.painted),glowKit=new Kit(models.painted,{jitter:0});
  const xw=w/2-t/2+.03;   // the end walls' centre line: their outer face 3 cm proud of the body
  // Body and plinth. The plaster darkens a little towards its foot.
  walls.box([0,(plinth+h)/2,0],[w,h-plinth,d],P.plaster,{kind:'plaster',bevel:.03,ground:.12});
  stone.box([0,plinth/2,0],[w+.12,plinth,d+.12],P.bluestone,{kind:'stone',bevel:.025});
  const zc=(zEnd(1)-zEnd(-1))/2,zl=zEnd(1)+zEnd(-1);
  for(const s of [-1,1]){
    walls.box([s*xw,(plinth+h)/2+.005,zc],[t,h-plinth+.01,zl],P.plaster,{kind:'plaster',bevel:.03,ground:.12});
    stone.box([s*xw,plinth/2,zc],[t+.1,plinth,zl+.1],P.bluestone,{kind:'stone',bevel:.025});
  }
  // The roof, between the gables.
  const R={w:w-t*2+.1,reach:f+ov,top:h+1.62,eave:h+.06,thick:.14},backReach=f+.14,reachOf=side=>side>0?R.reach:backReach;
  for(const side of [-1,1]){
    const shape=roofShape({...R,sides:[side],end:reachOf(side)/R.reach});
    roofKit.add(shape.tiles,[0,0,0],null,P.tile,'tile');
    eaves.add(shape.under,[0,0,0],null,P.timber,'wood');eaves.add(shape.edges,[0,0,0],null,P.ridge);
  }
  // The ridge: a base, a row of standing tiles, a cap; a curled end at each side and a centre piece.
  const top=R.top,rw=R.w-1;
  roofKit.box([0,top+.06,0],[rw,.14,.34],P.ridge,{kind:'tile',bevel:.02});
  for(let x=-rw/2+.05;x<rw/2-.04;x+=.075)roofKit.box([x,top+.24,0],[.028,.22,.26],P.tile,{kind:'tile'});
  roofKit.box([0,top+.39,0],[rw,.08,.3],P.ridge,{kind:'tile',bevel:.02});
  for(const s of [-1,1]){
    roofKit.box([s*(rw/2+.04),top+.3,0],[.22,.52,.3],P.ridge,{kind:'tile',bevel:.03});
    roofKit.box([s*(rw/2+.16),top+.58,0],[.42,.12,.26],P.ridge,{kind:'tile',bevel:.03,rot:[0,0,s*38]});
    roofKit.box([s*(rw/2+.31),top+.74,0],[.2,.1,.22],P.ridge,{kind:'tile',bevel:.025,rot:[0,0,s*70]});
  }
  roofKit.box([0,top+.5,0],[.3,.18,.24],P.ridge,{kind:'tile',bevel:.03});
  roofKit.turn([0,top+.58,0],[[0,0],[.1,.04],[.06,.16],[0,.2]],P.ridge,{seg:8});
  // Eave tiles (瓦当) on the end of every cover-tile channel, and rafter ends under the eave.
  for(const side of [-1,1]){
    const tip=reachOf(side),y=roofAt(R,tip/R.reach).y;
    for(let x=-R.w/2+.205;x<R.w/2-.05;x+=.25)roofKit.turn([x,y-.02,side*(tip+.01)],[[0,0],[.06,0],[.06,0],[.06,.035],[.06,.035],[0,.035]],P.ridge,{seg:8,rot:[side*90,0,0]});
    if(side>0)for(let x=-R.w/2+.18;x<R.w/2-.1;x+=.3)eaves.box([x,h-.115,f+.42],[.07,.07,.25],P.timber,{kind:'wood'});   // rafter ends, under the boards
    eaves.box([0,h-.1,side*(f+.05)],[R.w,.2,.1],P.redwood,{kind:'wood',bevel:.015});   // the eave beam along the wall top
  }
  // Horse-head gables: three tiers each side of the ridge, each capped with a little tiled coping,
  // a dark frieze under it and a horse head at its outer end.
  const roofY=z=>roofAt(R,Math.min(1,Math.abs(z)/R.reach)).y;
  const tiers=[{lo:-1.25,hi:1.25,y:top+.95,heads:[-1,1]}];
  for(const side of [-1,1]){
    const span=(a,b)=>[Math.min(a*side,b*side),Math.max(a*side,b*side)];
    const [lo,hi]=span(1.25,2.55),[lo2,hi2]=span(2.55,zEnd(side));
    tiers.push({lo,hi,y:roofY(1.25)+.62,heads:[side]},{lo:lo2,hi:hi2,y:roofY(2.55)+.55,heads:[side]});
  }
  for(const s of [-1,1]){
    const x=s*xw;
    for(const {lo,hi,y,heads} of tiers){
      const zc=(lo+hi)/2,len=hi-lo;
      walls.box([x,(h-.3+y)/2,zc],[t,y-h+.3,len],P.plaster,{kind:'plaster',bevel:.02});
      roofKit.box([x,y-.09,zc],[t+.03,.14,len+.02],P.frieze,{kind:'plaster'});
      for(const k of [-1,1])roofKit.box([x+k*.14,y+.04,zc],[.24,.05,len+.16],P.tile,{kind:'tile',rot:[0,0,k*-24]});
      roofKit.box([x,y+.1,zc],[.12,.1,len+.16],P.ridge,{kind:'tile',bevel:.02});
      // The horse head at each outer end, its tip turned up.
      for(const o of heads){
        const end=o>0?hi:lo;
        roofKit.box([x,y+.15,end-o*.1],[t+.1,.2,.3],P.ridge,{kind:'tile',bevel:.03});
        roofKit.box([x,y+.31,end+o*.08],[t-.02,.09,.36],P.ridge,{kind:'tile',bevel:.025,rot:[o*-30,0,0]});
      }
    }
    // 墀头: a stepped corbel under the eave on the front end of the wall.
    for(let k=0;k<3;k++)
      walls.box([x,h-.55+k*.16,zEnd(1)-.02+k*.04],[t+.06+k*.04,.14,.12+k*.08],k===1?P.frieze:P.plaster,{kind:'plaster',bevel:.02});
  }
  // Lit paper in the windows and door lattice glows after dark, like any lit window in town.
  const lit=lampMaterial('#f6deb0','paper','#a8743a');root.lamps.push(lit);   // cream by day, warm amber after dark
  // The door: a granite frame, two leaves with lattice over lit paper above a panel, door rings,
  // a timber sill and two granite steps.
  const dw=1.44,dh=2.5,leaf=dw/2;
  for(const s of [-1,1])stone.box([s*(dw/2+.1),(plinth+2.72)/2,f+.06],[.2,2.72-plinth,.14],P.granite,{kind:'stone',bevel:.02});
  stone.box([0,2.61,f+.07],[dw+.5,.22,.16],P.granite,{kind:'stone',bevel:.02});
  for(const s of [-1,1]){
    const cx=s*leaf/2;
    door.box([cx,(plinth+dh)/2+.06,f+.02],[leaf-.02,dh-plinth-.1,.06],P.timber,{kind:'wood',bevel:.01});
    for(const y of [plinth+.12,1.18,dh-.06])door.box([cx,y,f+.06],[leaf-.04,.07,.03],P.redwood,{kind:'wood'});
    for(const k of [-1,1])door.box([cx+k*(leaf/2-.05),(plinth+dh)/2+.06,f+.06],[.07,dh-plinth-.1,.03],P.redwood,{kind:'wood'});
    door.box([cx,(plinth+.12+1.18)/2,f+.065],[leaf-.26,.62,.02],P.timber,{kind:'wood',bevel:.008});
    latticeWindow(lattice,paper,cx,1.84,f+.05,leaf-.2,1.1,{step:.1,paper:lit});
    ring(door,[s*.09,1.32,f+.09],.05,.008,P.gold);
    door.turn([s*.09,1.37,f+.06],[[0,0],[.035,0],[.035,0],[.035,.02],[.035,.02],[0,.02]],P.gold,{seg:10,rot:[90,0,0]});
  }
  door.box([0,plinth+.05,f+.05],[dw,.1,.12],P.redwood,{kind:'wood'});
  stone.box([0,plinth*.25,f+.06+.21],[dw+.7,plinth*.5,.42],P.granite,{kind:'stone',bevel:.02});
  stone.box([0,plinth*.75,f+.06+.11],[dw+.5,plinth*.5,.22],P.granite,{kind:'stone',bevel:.02});
  // The door hood (门罩): a little tiled roof with upturned corners on two brackets, the plaque under it.
  const hood={w:2.9,reach:.62,top:3.78,eave:3.36,sides:[1],lift:.2,flare:.12,thick:.08};
  const hs=roofShape(hood);
  roofKit.add(hs.tiles,[0,0,f],null,P.tile,'tile');eaves.add(hs.under,[0,0,f],null,P.timber,'wood');eaves.add(hs.edges,[0,0,f],null,P.ridge);
  roofKit.box([0,hood.top+.05,f+.06],[hood.w-.1,.12,.16],P.ridge,{kind:'tile',bevel:.02});
  for(const s of [-1,1])roofKit.box([s*(hood.w/2-.02),hood.top+.12,f+.06],[.22,.08,.14],P.ridge,{kind:'tile',bevel:.02,rot:[0,0,s*30]});
  eaves.box([0,3.3,f+.06],[2.5,.1,.12],P.redwood,{kind:'wood',bevel:.015});
  for(const s of [-1,1]){eaves.box([s*1.08,3.15,f+.12],[.12,.26,.24],P.redwood,{kind:'wood',bevel:.02});eaves.box([s*1.08,3.0,f+.07],[.08,.12,.12],P.timber,{kind:'wood'});}
  door.box([0,3.0,f+.035],[1.64,.5,.07],P.timber,{kind:'wood',bevel:.015});
  door.box([0,3.0,f+.06],[1.56,.42,.02],P.gold);
  const plaque=models.label(root,data.sign,[0,3.0,f+.1],1.44,.36,'#3b2a20','#e3c27a');
  root.addMark(0,f+.12,.78,.06,2.78,3.22,'sign');
  // Lattice windows either side of the door, on granite sills under little tiled ledges.
  for(const s of [-1,1]){
    const x=s*1.98,y=1.66,ww=1.18,wh=1.24;
    latticeWindow(lattice,paper,x,y,f,ww,wh,{paper:lit});
    stone.box([x,y-wh/2-.13,f+.06],[ww+.34,.08,.14],P.granite,{kind:'stone',bevel:.015});
    roofKit.box([x,y+wh/2+.2,f+.12],[ww+.4,.05,.28],P.tile,{kind:'tile',rot:[22,0,0]});
    roofKit.box([x,y+wh/2+.25,f+.02],[ww+.4,.06,.06],P.ridge,{kind:'tile'});
  }
  // A round window high on each end wall, and two lattice windows at the back.
  for(const s of [-1,1]){
    const x=s*(xw+t/2),r=.42,y=2.75;
    walls.turn([x,y,0],[[r,-.02],[r+.1,-.02],[r+.1,-.02],[r+.1,.06],[r+.1,.06],[r,.06],[r,.06],[r,-.02]],P.stain,{kind:'plaster',seg:20,rot:[0,0,s*-90]});
    paper.turn([x,y,0],[[r,.004],[0,.004]],P.paper,{seg:20,rot:[0,0,s*-90],material:lit});
    for(const k of [-2,-1,0,1,2]){
      const half=Math.sqrt(r*r-(k*.15)**2);
      lattice.box([x+s*.02,y+k*.15,0],[.02,.022,half*2],P.timber,{kind:'wood'});
      lattice.box([x+s*.02,y,k*.15],[.02,half*2,.022],P.timber,{kind:'wood'});
    }
  }
  for(const s of [-1,1])latticeWindow(lattice,paper,s*2.2,1.85,-f,1.1,1.1,{dir:-1,paper:lit});
  // Red silk lanterns from the hood's corners.
  const red=lampMaterial(P.lantern);root.lamps.push(red);
  for(const s of [-1,1]){
    silkLantern(lanterns,glowKit,s*1.3,3.42,f+.5,red,.9);
    root.addMark(s*1.3,f+.5,.24,.24,2.3,3.1,'lantern');
  }
  // Goods set out by the door on the square's side: a low timber bench of jars and fruit.
  const sale=new Kit(models.painted),saleLabels=new Kit(models.painted,{jitter:.03}),bx=-1.98,bz=f+.44;
  sale.box([bx,.21,bz],[1.3,.05,.42],P.timber,{kind:'wood',bevel:.01});
  for(const s of [-1,1])for(const k of [-1,1])sale.box([bx+s*.58,.095,bz+k*.15],[.06,.19,.06],P.timber,{kind:'wood'});
  jar(sale,saleLabels,[bx-.42,.235,bz],.12,.38,GOODS.glaze,{label:GOODS.seal});
  basket(sale,[bx+.04,.235,bz],.15,.14,GOODS.bamboo);heap(sale,[bx+.04,.3,bz],.13,GOODS.persimmon,5);
  jar(sale,saleLabels,[bx+.43,.235,bz],.1,.3,GOODS.celadon,{band:true});
  root.addMark(bx,bz,.68,.24,0,.75,'goods',true);
  sale.build(root,'sale',{look:'goods'});saleLabels.build(root,'sale-labels',{look:'goods'});
  // The wing walls run out past the building's own box: solid, like the rest of it.
  for(const s of [-1,1])root.addMark(s*xw,f+wing/2+.1,t/2+.05,wing/2-.05,0,h+1.4,'wall',true);
  // Bluestone paving round it, just proud of the district's paving.
  const [left,right,front,back]=data.paving??[1.2,1.2,1.5,1.2],paving=new Kit(models.painted);
  paving.box([(right-left)/2,.024,(front-back)/2],[w+left+right,.008,d+front+back],P.bluestone,{kind:'stone'});
  // One entity per surface for each named cluster; the big pieces cast shadows.
  walls.build(root,'walls',{look:'wall',shadows:true});
  roofKit.build(root,'roof',{look:'roof',shadows:true});
  eaves.build(root,'eaves',{look:'eaves'});
  stone.build(root,'stone',{look:'stone'});
  door.build(root,'door',{look:'door'});
  lattice.build(root,'lattice',{look:'lattice'});
  paper.build(root,'window-paper',{look:'window'});
  paving.build(root,'paving');
  lanterns.build(root,'lanterns',{look:'lantern'});
  glowKit.build(root,'lantern-silk',{look:'lantern'});
  return plaque;
}

// ── The dressing kit: goods that make a shelf read as full ────────────────────────────────────────

const GOODS={celadon:'#9db8a6',porcelain:'#eceee9',cobalt:'#3d5a8a',glaze:'#6b4a33',ochre:'#c99a4a',lacquer:'#a5302a',
  ink:'#2f2a28',cream:'#efe7d2',bamboo:'#c8a66a',rattan:'#a8834f',label:'#efe3c6',seal:'#b8443a',persimmon:'#e07a2e',orange:'#e89a3a',
  garlic:'#efe8d8',chilli:'#b8322a',teal:'#5f8a86',brick:'#9b5a46'};
/** A glazed jar standing at `at` (radius r, height ht): a foot, a full belly, a short neck; a lid,
 *  a cobalt band on blue-and-white ware, and a paper label on the front (+z) if asked. */
export function jar(kit,labels,at,r,ht,colour,{lid=true,band=false,label=null}={}){
  kit.turn(at,[[0,0],[r*.6,0],[r*.6,0],[r*.62,ht*.06],[r*.95,ht*.32],[r,ht*.52],[r*.82,ht*.78],[r*.52,ht*.9],[r*.5,ht*.97],[r*.56,ht],[r*.56,ht],[r*.4,ht],[r*.4,ht],[r*.4,ht*.9]],colour,{seg:14});
  if(lid)kit.turn([at[0],at[1]+ht,at[2]],[[r*.6,0],[r*.6,.012],[r*.6,.012],[r*.35,.035],[r*.1,.05],[r*.1,.05],[r*.12,.07],[0,.075]],colour,{seg:14});
  if(band)kit.turn(at,[[r*1.005,ht*.66],[r*.985,ht*.74]],GOODS.cobalt,{seg:14});
  if(label){
    labels.turn(at,[[r*1.012,ht*.34],[r*1.012,ht*.62]],GOODS.label,{kind:'paper',seg:5,from:Math.PI/2-.55,to:Math.PI/2+.55});
    labels.turn(at,[[r*1.02,ht*.42],[r*1.02,ht*.54]],label,{kind:'paper',seg:3,from:Math.PI/2-.16,to:Math.PI/2+.16});
  }
}
/** A bottle: a body, shoulders, a long neck and a cork. */
export function bottle(kit,at,r,ht,colour){
  kit.turn(at,[[0,0],[r,0],[r,0],[r,ht*.55],[r*.9,ht*.66],[r*.36,ht*.78],[r*.32,ht*.95],[r*.38,ht*.97],[r*.38,ht*.97],[0,ht*.97]],colour,{seg:10});
  kit.turn([at[0],at[1]+ht*.95,at[2]],[[r*.3,0],[r*.3,ht*.07],[r*.3,ht*.07],[0,ht*.07]],GOODS.rattan,{seg:8});
}
/** A tea tin with a lid rim and a wrap-round paper label. */
export function tin(kit,labels,at,r,ht,colour,label=GOODS.label){
  kit.turn(at,[[0,0],[r,0],[r,0],[r,ht],[r,ht],[0,ht]],colour,{seg:14});
  kit.turn([at[0],at[1]+ht*.86,at[2]],[[r*1.04,0],[r*1.04,ht*.14],[r*1.04,ht*.14],[0,ht*.14]],colour,{seg:14,shade:.85});
  labels.turn(at,[[r*1.01,ht*.22],[r*1.01,ht*.7]],label,{kind:'paper',seg:14});
}
/** A box of goods with a paper label on its front, or a gift box tied with a ribbon. */
export function parcel(kit,labels,at,size,colour,{ribbon=null}={}){
  const [w,h,d]=size,[x,y,z]=at;
  kit.box([x,y+h/2,z],size,colour,{kind:'paper',bevel:.006});
  if(ribbon){kit.box([x,y+h/2,z],[w+.006,h+.006,.02],ribbon);kit.box([x,y+h/2,z],[.02,h+.006,d+.006],ribbon);}
  else labels.box([x,y+h*.55,z+d/2+.002],[w*.62,h*.42,.004],GOODS.label,{kind:'paper'});
}
/** A woven basket: open, its wall twice as thick at the rim, in split bamboo. */
export function basket(kit,at,r,ht,colour=GOODS.bamboo){
  kit.turn(at,[[0,.012],[r*.78,.012],[r*.78,0],[r*.78,0],[r,ht],[r,ht],[r*1.04,ht+.012],[r*.93,ht+.012],[r*.93,ht+.012],[r*.74,.03],[0,.03]],colour,{kind:'wood',seg:16});
}
/** A heap of round fruit in something `r` wide whose top is at `at`. */
export function heap(kit,at,r,colour,n=5){
  const f=r*.42;
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2+.4,ring=i?r*.42:0,y=i?0:f*.6;
    kit.turn([at[0]+Math.cos(a)*ring,at[1]+y,at[2]+Math.sin(a)*ring],[[0,0],[f*.7,f*.12],[f,f*.55],[f*.8,f*.95],[0,f*1.05]],colour,{seg:10});
  }
}
/** A stack of `n` bowls. */
export function bowls(kit,at,r,n,colour){
  for(let i=0;i<n;i++)kit.turn([at[0],at[1]+i*.022,at[2]],[[0,0],[r*.45,0],[r*.45,0],[r*.5,.012],[r*.92,.045],[r,.06],[r,.06],[r*.92,.06],[r*.86,.03],[0,.02]],colour,{seg:14});
}
/** A teapot: a round body, a lid with a knob, a spout and a handle. */
export function teapot(kit,at,r,colour){
  const [x,y,z]=at;
  kit.turn(at,[[0,0],[r*.6,0],[r*.6,0],[r*.95,r*.35],[r,r*.6],[r*.8,r*.95],[r*.5,r*1.05],[r*.5,r*1.05],[r*.3,r*1.15],[r*.1,r*1.2],[r*.12,r*1.3],[0,r*1.32]],colour,{seg:12});
  kit.box([x+r*1.05,y+r*.75,z],[r*.75,r*.16,r*.16],colour,{rot:[0,0,35]});
  kit.box([x-r*1.05,y+r*.6,z],[r*.14,r*.7,r*.1],colour);
}
/** A shelf unit `w` wide, `h` tall and `d` deep, its front edge's middle on the floor at `at` and its
 *  back against the wall behind: side posts, a back board, shelves at `rows` (heights of their tops)
 *  and a crown. */
export function shelfUnit(kit,at,w,h,d,rows,colour){
  const [x,y,z]=at,back=z-d;
  for(const s of [-1,1])kit.box([x+s*(w/2-.03),y+h/2,z-d/2],[.06,h,d],colour,{kind:'wood',bevel:.008});
  kit.box([x,y+h/2,back+.006],[w-.08,h,.012],colour,{kind:'wood',shade:.82});
  for(const top of rows)kit.box([x,y+top-.015,z-d/2],[w-.1,.03,d],colour,{kind:'wood',bevel:.004});
  kit.box([x,y+h+.03,z-d/2+.01],[w+.06,.06,d+.03],colour,{kind:'wood',bevel:.01});
  kit.box([x,y+.04,z-d/2],[w-.1,.08,d],colour,{kind:'wood',shade:.9});
}
/** An abacus lying on a counter at `at`: a frame, a beam, nine rods with two beads above and five below. */
export function abacus(kit,at,colour=GOODS.glaze,bead=GOODS.ink){
  const [x,y,z]=at,w=.42,d=.17,rods=9;
  for(const s of [-1,1]){kit.box([x,y+.017,z+s*(d/2-.01)],[w,.034,.02],colour,{kind:'wood'});kit.box([x+s*(w/2-.01),y+.017,z],[.02,.034,d],colour,{kind:'wood'});}
  kit.box([x,y+.02,z-.035],[w-.02,.026,.012],colour,{kind:'wood'});
  for(let k=0;k<rods;k++){
    const rx=x-w/2+.03+k*(w-.06)/(rods-1);
    kit.box([rx,y+.017,z],[.004,.004,d-.02],'#8a7a60');
    for(let b=0;b<7;b++){
      const bz=b<2?z-d/2+.03+b*.022:z-.01+(b-2)*.022+(k%3===0&&b===2?.012:0);
      kit.turn([rx,y+.008,bz],[[0,0],[.014,.009],[0,.018]],bead,{seg:6,rot:[90,0,0]});
    }
  }
}

/**
 * The showcase interior (rooms.json `look: "jiangnan"`, called at the end of interior.js buildRoom):
 * the room's own walls, ceiling and timber turned to painted plaster and wood, the fittings' timber
 * to wood and the rest to a soft painted finish; a goods wall behind the counter, full of jars,
 * tins, bottles, bowls, teapots, boxes and baskets with paper labels; lattice over the back windows,
 * rafters across the ceiling, red silk lanterns, steamers, baskets and strings of garlic and chilli
 * hanging from the beams; an abacus on the counter; big jars and a stack of baskets of fruit on the
 * floor. The fittings, their slots, the staff and the room's size stay as they are. Returns the lamps
 * (the lanterns) and the solid parts for the room's hitboxes.
 */
export function dressShop(models,root,data,fittings,wainscot){
  const [w,d]=data.size,h=data.height,back=-d/2,lamps=[],solids=[];
  skinRoom(root,data,fittings,wainscot);
  const kit=()=>new Kit(models.painted),labelsKit=()=>new Kit(models.painted,{jitter:.03});
  // The goods wall: shallow, so the shopkeeper still walks behind the counter in front of it.
  const sw=2.6,sd=.15,front=back+.1+sd,rows=[.08,.52,.96,1.4,1.84],unitTop=2.3;
  const shelf=kit();shelfUnit(shelf,[0,0,front],sw,unitTop,sd,rows,'#6e4a32');shelf.build(root,'goods-wall',{look:'goods-shelf'});
  solids.push({x:0,z:front-sd/2,hw:sw/2,hd:sd/2+.02,y0:0,y1:unitTop+.06,name:'goods-shelf'});
  let r=7;const rnd=()=>((r=(r*16807)%2147483647)/2147483647),pick=list=>list[Math.floor(rnd()*list.length)];
  const zc=front-sd/2+.005,jars=kit(),jarLabels=labelsKit(),goods=kit(),goodLabels=labelsKit(),crockery=kit(),baskets=kit();
  const along=(from,to,gap,place)=>{for(let x=from;x<to;){const used=place(x);x+=used+gap;}};
  // Bottom: big storage jars, lidded and labelled, between baskets.
  along(-1.2,1.1,.025,x=>{
    if(rnd()<.22){basket(baskets,[x+.07,rows[0],zc],.07,.15,pick([GOODS.bamboo,GOODS.rattan]));return .14;}
    const rr=.055+rnd()*.012;jar(jars,jarLabels,[x+rr,rows[0],zc],rr,.24+rnd()*.1,pick([GOODS.glaze,GOODS.celadon,GOODS.ochre,GOODS.porcelain,GOODS.ink]),
      {band:rnd()<.3,label:rnd()<.7?pick([GOODS.seal,GOODS.ink,GOODS.teal]):null});return rr*2;
  });
  // Tea tins, two high in places, and labelled boxes.
  along(-1.2,1.05,.02,x=>{
    if(rnd()<.35){const bw=.12+rnd()*.06;parcel(goods,goodLabels,[x+bw/2,rows[1],zc],[bw,.1+rnd()*.08,.12],pick([GOODS.lacquer,GOODS.cream,GOODS.teal,GOODS.ochre]),
      {ribbon:rnd()<.3?'#d9b45a':null});return bw;}
    const rr=.045,c=pick([GOODS.lacquer,GOODS.teal,GOODS.ochre,GOODS.ink,'#3f6a5a']);
    tin(goods,goodLabels,[x+rr,rows[1],zc],rr,.13,c);if(rnd()<.45)tin(goods,goodLabels,[x+rr,rows[1]+.13,zc],rr,.13,pick([GOODS.lacquer,GOODS.teal,GOODS.ochre]));return rr*2;
  });
  // Bottles in little groups, and small jars.
  along(-1.2,1.14,.012,x=>{
    if(rnd()<.3){const rr=.045;jar(jars,jarLabels,[x+rr,rows[2],zc],rr,.14,pick([GOODS.celadon,GOODS.porcelain,GOODS.glaze]),{band:rnd()<.5});return rr*2;}
    const rr=.03;bottle(goods,[x+rr,rows[2],zc],rr,.22+rnd()*.06,pick(['#5c7f6a','#8a5a3a','#3f5a6e','#b9a27a']));return rr*2;
  });
  // Bowls stacked, teapots and plates standing against the back.
  along(-1.2,1.05,.03,x=>{
    const k=rnd();
    if(k<.4){bowls(crockery,[x+.065,rows[3],zc],.065,3+Math.floor(rnd()*3),pick([GOODS.porcelain,GOODS.celadon,GOODS.cream]));return .13;}
    if(k<.7){teapot(crockery,[x+.075,rows[3],zc+.01],.05,pick([GOODS.brick,GOODS.ink,GOODS.celadon]));return .15;}
    const pr=.09;crockery.turn([x+pr,rows[3]+pr,front-sd+.03],[[0,0],[pr,.008],[pr,.008],[pr*.9,.016],[0,.012]],pick([GOODS.porcelain,GOODS.cream]),{seg:16,rot:[78,0,0]});return pr*2;
  });
  // The top shelf and the crown: boxes and baskets.
  along(-1.2,1.0,.04,x=>{
    if(rnd()<.5){basket(baskets,[x+.07,rows[4],zc],.07,.12,pick([GOODS.bamboo,GOODS.rattan]));return .14;}
    const bw=.14+rnd()*.08;parcel(goods,goodLabels,[x+bw/2,rows[4],zc],[bw,.12+rnd()*.12,.12],pick([GOODS.cream,GOODS.lacquer,GOODS.ochre]),{ribbon:rnd()<.25?'#b8443a':null});return bw;
  });
  for(const [x,bw,bh] of [[-.9,.32,.16],[-.45,.24,.22],[.55,.3,.14],[.95,.22,.2]])parcel(goods,goodLabels,[x,unitTop+.06,zc],[bw,bh,.13],pick([GOODS.cream,GOODS.bamboo,GOODS.ochre]));
  basket(baskets,[.1,unitTop+.06,zc],.08,.12);
  // Big jars either side of the goods wall, under the back windows.
  for(const s of [-1,1]){
    const x=s*1.72,z=back+.32;
    jar(jars,jarLabels,[x,0,z],.19,.62,s<0?GOODS.glaze:GOODS.celadon,{band:s>0,label:GOODS.seal});
    solids.push({x,z,hw:.2,hd:.2,y0:0,y1:.72,name:'jar'});
  }
  // Baskets of persimmons stacked in the front corner by the door.
  const bx=w/2-.5,bz=d/2-.48;
  basket(baskets,[bx,0,bz],.27,.3,GOODS.rattan);basket(baskets,[bx-.05,.33,bz+.02],.21,.22,GOODS.bamboo);
  heap(crockery,[bx-.05,.4,bz+.02],.2,GOODS.persimmon,6);
  basket(baskets,[bx-.44,0,bz+.08],.17,.2,GOODS.bamboo);heap(crockery,[bx-.44,.12,bz+.08],.14,GOODS.orange,5);
  solids.push({x:bx-.2,z:bz,hw:.5,hd:.3,y0:0,y1:.62,name:'basket'});
  jars.build(root,'jars',{look:'jar'});jarLabels.build(root,'jar-labels',{look:'jar'});
  goods.build(root,'goods',{look:'goods'});goodLabels.build(root,'goods-labels',{look:'goods'});
  crockery.build(root,'crockery',{look:'bowl'});baskets.build(root,'baskets',{look:'basket'});
  // The counter's abacus, in the free corner of the wrapping desk.
  const desk=fittings.find(f=>f.kind==='wrapdesk');
  if(desk){const a=kit();abacus(a,[desk.x+.55,.96,desk.z-.2]);a.build(root,'abacus',{look:'counter'});}
  // Lattice over the back windows, rafters across the ceiling.
  const frame=kit();
  for(const x of data.window??[]){
    for(let u=-.66;u<=.67;u+=.165)frame.box([x+u,1.85,back+.135],[.02,1.46,.02],'#6e4a32',{kind:'wood'});
    for(let v=-.66;v<=.67;v+=.165)frame.box([x,1.85+v,back+.135],[1.46,.02,.02],'#6e4a32',{kind:'wood'});
  }
  for(let x=-w/2+.35;x<w/2-.2;x+=.46)frame.box([x,h-.03,0],[.07,.04,d],'#7a5a3e',{kind:'wood'});
  frame.build(root,'woodwork',{look:'beam'});
  // From the beams: red lanterns, a stack of steamers, baskets, garlic and chilli.
  const beam=k=>back+1.4+k*((d-2.8)/3),hang=h-.14,hangers=kit(),silk=kit(),lit=lampMaterial(P.lantern);lamps.push(lit);
  for(const s of [-1,1])silkLantern(hangers,silk,s*1.55,hang,beam(2),lit,.8);
  const cord=(x,z,y)=>hangers.box([x,(hang+y)/2,z],[.012,hang-y,.012],'#3b2e26');
  cord(-.75,beam(1),2.72);for(let i=0;i<3;i++)hangers.turn([-.75,2.4+i*.1,beam(1)],[[0,0],[.17,0],[.17,0],[.17,.09],[.17,.09],[0,.09]],GOODS.bamboo,{kind:'wood',seg:16});
  hangers.turn([-.75,2.7,beam(1)],[[0,0],[.15,.03],[0,.05]],GOODS.bamboo,{kind:'wood',seg:12});
  for(const [x,z,rr] of [[.85,beam(3),.16],[-2.1,beam(3),.13]]){cord(x,z,2.62);basket(hangers,[x,2.36,z],rr,.22,GOODS.rattan);}
  for(const [x,kind] of [[2.35,'garlic'],[2.55,'chilli']]){
    cord(x,beam(0),2.3);
    for(let i=0;i<5;i++){const y=2.36+i*.13,c=kind==='garlic'?GOODS.garlic:GOODS.chilli;
      if(kind==='garlic')hangers.turn([x,y-.05,beam(0)],[[0,0],[.05,.03],[.045,.08],[0,.1]],c,{seg:8});
      else hangers.box([x,y,beam(0)],[.03,.12,.03],c,{rot:[0,i*40,15]});}
  }
  hangers.build(root,'hanging',{look:'basket'});silk.build(root,'hanging-lanterns',{look:'lantern'});
  return {lamps,solids};
}
/** Is a colour a timber brown: warm, middling, not pale. */
export function woodish(hex){
  const c=new pc.Color().fromString(hex),max=Math.max(c.r,c.g,c.b),min=Math.min(c.r,c.g,c.b),s=max?1-min/max:0;
  if(max===min)return false;
  const hue=((max===c.r?((c.g-c.b)/(max-min)+6)%6:max===c.g?(c.b-c.r)/(max-min)+2:(c.r-c.g)/(max-min)+4)*60);
  return hue>=12&&hue<=48&&s>=.22&&max>=.22&&max<=.86;
}
const skins=new Map();
/** A plain box or cylinder of the room on a painted surface: its own shape, UVs in metres for its
 *  size, its colour in its vertices. One draw call each, as before. */
function skin(e,kind){
  const r=e.render,mi=r?.meshInstances?.[0],m=mi?.material;
  if(!m||r.meshInstances.length!==1||!['box','cylinder'].includes(r.type)||m.diffuseMap||m.emissiveMap||m.opacity<1||m.diffuseVertexColor)return;
  const s=e.getWorldTransform().getScale(),hex=m.diffuse.toString(),key=[r.type,hex,kind,...[s.x,s.y,s.z].map(v=>v.toFixed(3))].join();
  if(!skins.has(key)){
    const g=r.type==='box'?bevelBox(.5,.5,.5,0):lathe([[0,-.5],[.5,-.5],[.5,-.5],[.5,.5],[.5,.5],[0,.5]],16);
    const metres=SURFACES[kind].metres,size=[s.x,s.y,s.z],c=new pc.Color().fromString(hex),uv=[];
    for(let v=0;v<g.p.length;v+=3){
      const q=[g.p[v]*s.x,g.p[v+1]*s.y,g.p[v+2]*s.z],n=[g.n[v],g.n[v+1],g.n[v+2]];
      const a=Math.abs(n[0])>=Math.abs(n[1])&&Math.abs(n[0])>=Math.abs(n[2])?0:Math.abs(n[1])>=Math.abs(n[2])?1:2;
      let [ua,va]=a===1?[0,2]:[a===0?2:0,1];
      if(SURFACES[kind].grain&&size[ua]>size[va])[ua,va]=[va,ua];
      if(r.type==='cylinder'&&a!==1){uv.push(g.uv[v/3*2]*s.x/metres,q[1]/metres);continue;}
      uv.push(q[ua]/metres,q[va]/metres);
    }
    const colors=Array.from({length:g.p.length/3},()=>[c.r,c.g,c.b].map(x=>Math.round(x*255)).concat(255)).flat();
    const mesh=pc.Mesh.fromGeometry(pc.AppBase.getApplication().graphicsDevice,Object.assign(new pc.Geometry(),{positions:g.p,normals:g.n,colors,uvs:uv,uvs1:uv,indices:g.i}));
    mesh.incRefCount();skins.set(key,mesh);
  }
  r.meshInstances=[new pc.MeshInstance(skins.get(key),surface(kind))];   // keeps the part's castShadows
}
/** The room's plaster and timber, and its fittings' timber, on painted surfaces; cloth on the beds and sofas. */
function skinRoom(root,data,fittings,wainscot){
  const key=hex=>hex&&new pc.Color().fromString(hex).toString();
  const plaster=key(data.wall),timber=new Set([data.trim,data.roofBeam,wainscot].filter(Boolean).map(key));
  const soft=new Set(fittings.filter(f=>['bedshow','sofa'].includes(f.kind)).map(f=>f.entity));
  const walk=(e,cloth)=>{
    if(e.noBatch)return;
    cloth||=soft.has(e);
    const hex=e.render?.meshInstances?.[0]?.material?.diffuse?.toString();
    if(hex&&!e.signText)skin(e,hex===plaster?'plaster':timber.has(hex)||woodish(hex)?'wood':cloth?'cloth':'soft');
    for(const child of e.children)walk(child,cloth);
  };
  for(const child of root.children)walk(child,false);
}
