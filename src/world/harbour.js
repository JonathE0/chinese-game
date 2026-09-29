import * as pc from 'playcanvas';
import {HARBOUR,DAY,clockSeconds,ferryAt,boardingProblem,stillHolds,wheelTurn,wheelRide,loopAt,curve} from '../core/harbour.js';
import {addedGround} from '../core/city.js';
import {detail} from '../core/quality.js';
import {raySpan} from './registry.js';
import {reflect,BAY} from './bay.js';
import objects from '../content/objects.json' with {type:'json'};

/**
 * The harbour: ferry, piers, boats, the far-side landing and the Ferris wheel (task B-harbour,
 * docs/superpowers/plans/2026-09-27-development-wave-3.md; data in src/content/harbour.json, rules in
 * src/core/harbour.js, tickets and rides in src/ui/harbour.js).
 *
 * The piers, the landing and the wheel's frame stand still and are batched with the rest of 云海.
 * What moves is cheap to draw: each boat, the wheel's turning rim and a wheel cabin are baked into
 * one mesh, coloured in its vertices, whose alpha says what glows after dark (one shared material,
 * one of the daylight's lamps); the cabins are instances of that mesh, one draw call a colour; the
 * wheel's lights are one mesh whose patterns a small shader works out from the clock. Every frame
 * moves a handful of transforms and writes a few uniforms; nothing is allocated.
 *
 * Riding: aboard the ferry you stand on its deck, which is 云海 ground only while you ride
 * (core/city.js `addedGround`), and every frame the ferry's move and turn are added to yours, so
 * you can walk about and look round but never fall in. The wheel is a seat: town.sit() on a
 * fitting that follows your cabin round.
 */
const H=HARBOUR,F=H.ferry,W=H.wheel,LAND=H.landing;
const SEA=BAY.level;
const SEAT_DROP=.66;          // as town.js: how far a body sinks so the hips land on the seat
const NAME=id=>({id,...objects.objects[id]});
// The ferry's deck in its own frame (x across, z along; its +z end is the near-pier end): where you
// may stand, the cabin in the middle (and the benches on its ends) that you walk round, and the
// gangway through the end rails onto a pier while it is docked.
const DECK={x:3,z:7.5,cabinX:1.85,cabinZ:3.95,gangX:1.25,gangZ:8.9};

// Unit primitives, as the render component's own: box 1 m, cylinder and cone 0.5 m radius by 1 m, ball 0.5 m.
const SHAPES={
  box:new pc.BoxGeometry(),
  cylinder:new pc.CylinderGeometry({heightSegments:1,capSegments:12}),
  cone:new pc.ConeGeometry({heightSegments:1,capSegments:12}),
  sphere:new pc.SphereGeometry({latitudeBands:6,longitudeBands:8}),
};

/**
 * Every primitive under `from` as one mesh in `from`'s own frame, each in its material's colour,
 * with `glow` (0..1, set on the piece) as the vertex alpha: how much it lights up after dark.
 * `tris` adds flat triangles [[a, b, c], colour], seen from both sides (a sail).
 */
function bake(device,from,tris=[]){
  const pos=[],nor=[],col=[],idx=[],inv=new pc.Mat4().copy(from.getWorldTransform()).invert();
  const m=new pc.Mat4(),n=new pc.Mat4(),p=new pc.Vec3(),q=new pc.Vec3();
  const bytes=(c,glow)=>[c.r*255,c.g*255,c.b*255,glow*255].map(Math.round);
  from.forEach(e=>{
    const r=e.render,geo=r?SHAPES[r.type]:null;
    if(!geo)return;
    m.mul2(inv,e.getWorldTransform());n.copy(m).invert().transpose();
    // A piece models.js has repainted in vertex colours still names its colour as `render.material`.
    const c=bytes((r.material??r.meshInstances[0].material).diffuse,e.glow??0),base=pos.length/3;
    for(let i=0;i<geo.positions.length;i+=3){
      m.transformPoint(p.set(geo.positions[i],geo.positions[i+1],geo.positions[i+2]),q);pos.push(q.x,q.y,q.z);
      n.transformVector(p.set(geo.normals[i],geo.normals[i+1],geo.normals[i+2]),q).normalize();nor.push(q.x,q.y,q.z);
      col.push(...c);
    }
    for(const i of geo.indices)idx.push(base+i);
  });
  for(const [[a,b,c],hex] of tris){
    const ab=new pc.Vec3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),ac=new pc.Vec3(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
    const normal=new pc.Vec3().cross(ab,ac).normalize(),rgba=bytes(new pc.Color().fromString(hex),0);
    for(const side of [1,-1]){
      const base=pos.length/3;
      for(const v of [a,b,c]){pos.push(...v);nor.push(normal.x*side,normal.y*side,normal.z*side);col.push(...rgba);}
      idx.push(...(side>0?[base,base+1,base+2]:[base,base+2,base+1]));
    }
  }
  return pc.Mesh.fromGeometry(device,Object.assign(new pc.Geometry(),{positions:pos,normals:nor,colors:col,indices:idx}));
}

/** An entity drawing `meshes` with one material, kept out of the city's static batches. */
function drawn(name,parent,meshes,material){
  const e=new pc.Entity(name);e.noBatch=true;
  e.addComponent('render',{castShadows:false,receiveShadows:true});
  e.render.meshInstances=meshes.map(mesh=>new pc.MeshInstance(mesh,material));e.render.castShadows=false;
  parent.addChild(e);
  return e;
}

/** The wheel's lights: each bulb's colour worked out per vertex from its place (uv: round the
 *  wheel, out from the hub) and the clock, so every pattern is one draw call and a few uniforms. */
const LIGHTS_VS=`attribute vec3 vertex_position;
attribute vec2 vertex_texCoord0;
uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;
uniform vec3 light_globalAmbient;
uniform vec4 wheelShow;   // this pattern, the next, how far into changing over, how dark it is (0 day, 1 night)
uniform float wheelTime;
varying vec3 vColor;
vec3 hue(float h){return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);}
vec3 pattern(float p,float a,float r){
  if(p<.5)return hue(a+wheelTime*.04);                                                  // a rainbow turning round
  if(p<1.5){float c=fract(a*8.0-wheelTime*.5);return mix(vec3(1.0,.72,.28),vec3(1.0,.3,.62),r)*(pow(c,5.0)*1.6+.05);}  // comets chasing round
  if(p<2.5){float w=fract(r*1.6-wheelTime*.45);return hue(wheelTime*.02+r*.35)*(smoothstep(0.0,.25,w)*smoothstep(1.0,.55,w)*1.3+.05);}  // rings out from the hub
  if(p<3.5)return mix(vec3(.25,.6,1.0),vec3(1.0,.82,.35),mod(floor(a*12.0)+floor(wheelTime*1.4),2.0));  // sectors flashing
  if(p<4.5)return hue(a*2.0+r*.8-wheelTime*.07);                                        // a spiral
  return vec3(1.0,.8,.5);                                                                // steady warm white
}
void main(void){
  vec4 world=matrix_model*vec4(vertex_position,1.0);
  // Relative to the camera first, as town.js has every lit shader do: 云海 is 4 km out.
  gl_Position=matrix_projection*vec4(mat3(matrix_view)*(world.xyz+matrix_view[3].xyz*mat3(matrix_view)),1.0);
  float a=vertex_texCoord0.x,r=vertex_texCoord0.y;
  vec3 lit=mix(pattern(wheelShow.x,a,r),pattern(wheelShow.y,a,r),wheelShow.z)*2.2;
  vColor=mix(vec3(.82,.8,.74)*(light_globalAmbient+.25),lit,wheelShow.w);
}`;
const LIGHTS_FS=`#include "gammaPS"
#include "tonemappingPS"
#include "fogPS"
varying vec3 vColor;
void main(void){gl_FragColor=vec4(gammaCorrectOutput(toneMap(addFog(vColor))),1.0);}`;
const PATTERNS=5,PATTERN_SECONDS=16,STEADY=5;

/** A V of foam spreading behind a boat and fading out along it: an opacity map, made once. */
function wakeTexture(device){
  const w=64,h=256,c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d'),img=g.createImageData(w,h);
  for(let y=0;y<h;y++){
    const v=y/(h-1),fade=(1-v)**1.4;
    for(let x=0;x<w;x++){
      const u=Math.abs(x/(w-1)*2-1),arm=u-(.62-.4*v);
      const churn=u<.3?(.5+.5*Math.sin(y*.9+x*1.7)*Math.sin(y*.37))*(1-u/.3):0;
      const a=Math.min(1,Math.exp(-arm*arm*260)*fade+churn*.55*(1-v)**2.2),k=(y*w+x)*4;
      img.data[k]=img.data[k+1]=img.data[k+2]=255;img.data[k+3]=Math.round(a*255);
    }
  }
  g.putImageData(img,0,0);
  const t=new pc.Texture(device,{width:w,height:h,mipmaps:true,addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE});
  t.setSource(c);return t;
}

export function buildHarbour(town,root){
  const level=detail(),high=level==='high',low=level==='low';
  const OX=root.getLocalPosition().x,device=town.app.graphicsDevice,m=town.m,{box,cylinder,label,tube}=m;
  const room=town.rooms.get('city');
  const g=new pc.Entity('harbour');root.addChild(g);   // what stands still: batched with the city
  const mark=(x,z,hw,hd,y0,y1,name,solid=true)=>town.mark('city',OX+x,z,hw,hd,y0,y1,name,solid);
  const lamp=m.glow('#ffe2a8');town.daylight.addLamp(lamp);
  const lit=e=>{e.render.meshInstances[0].material=lamp;e.render.castShadows=false;return e;};
  // Vertex colours, and alpha for what glows: every boat, the wheel's rim, its cabins and the people.
  const paint=new pc.StandardMaterial();
  Object.assign(paint,{diffuseVertexColor:true,vertexColorGamma:true,emissiveVertexColor:true,emissiveVertexColorChannel:'a',
    useMetalness:true,metalness:0,gloss:.25});
  paint.emissive=new pc.Color().fromString('#ffd9a0');paint.emissiveIntensity=0;paint.update();
  town.daylight.addLamp(paint);
  /** Parts built under a scratch entity, baked into one mesh, then thrown away. */
  const baked=(build,tris)=>{const scratch=new pc.Entity('scratch');build(scratch);const mesh=bake(device,scratch,tris);scratch.destroy();return mesh;};
  /** Someone who stands still (the ticket seller, the crew at the gangway, the wheel's attendant): one mesh, batched. */
  const figure=(x,y,z,turn,color,hat)=>{
    const mesh=baked(s=>{const made=m.person(s,color,[0,0,0],hat);if(!hat)made.hat.destroy();});
    const e=drawn('person',g,[mesh],paint);e.noBatch=false;e.setLocalPosition(x,y,z);e.setLocalEulerAngles(0,turn,0);
    e.lookName='person';mark(x,z,.3,.3,y,y+1.95,null);
    return e;
  };

  // ---- the piers ------------------------------------------------------------------------------
  const railing=(x0,z0,x1,z1,top)=>{
    const r=new pc.Entity('railing');r.lookName='railing';g.addChild(r);
    const len=Math.hypot(x1-x0,z1-z0),alongX=z0===z1,n=Math.max(1,Math.round(len/1.6)),cx=(x0+x1)/2,cz=(z0+z1)/2;
    box(r,[cx,top+1.02,cz],alongX?[len,.06,.08]:[.08,.06,len],'#b0b8be');
    box(r,[cx,top+.55,cz],alongX?[len,.04,.04]:[.04,.04,len],'#9aa3a9');
    for(let i=0;i<=n;i++)box(r,[x0+(x1-x0)*i/n,top+.5,z0+(z1-z0)*i/n],[.07,1,.07],'#8f979e');
  };
  const deck=([x0,x1,z0,z1],top)=>{
    box(g,[(x0+x1)/2,top-.15,(z0+z1)/2],[x1-x0,.3,z1-z0],'#9a7a58').lookName='pier';
    const piles=new pc.Entity('pier');piles.lookName='pier';g.addChild(piles);
    const nx=Math.max(1,Math.round((x1-x0)/3.5)),nz=Math.max(1,Math.round((z1-z0)/3.2));
    for(let i=0;i<=nx;i++)for(let k=0;k<=nz;k++)
      if(i===0||i===nx||k===0||k===nz)cylinder(piles,[x0+.3+(x1-x0-.6)*i/nx,top-1.5,z0+.3+(z1-z0-.6)*k/nz],[.32,2.4,.32],'#5d4b3b');
    mark((x0+x1)/2,(z0+z1)/2,(x1-x0)/2,(z1-z0)/2,-1,top,'pier');
  };
  /** The ticket booth: three walls, a hatch in the side facing +x, a red roof, 售票处 over the hatch. */
  const booth=([x0,x1,z0,z1],top)=>{
    const b=new pc.Entity('booth');b.signText='售票处';g.addChild(b);   // the whole booth reads as its sign
    const w=x1-x0,d=z1-z0,zc=(z0+z1)/2,wall='#e8e3d6';
    box(b,[x0+.06,top+1.35,zc],[.12,2.7,d],wall);
    for(const z of [z0+.06,z1-.06])box(b,[(x0+x1)/2,top+1.35,z],[w,2.7,.12],wall);
    box(b,[x1-.06,top+.525,zc],[.12,1.05,d-.24],wall);
    box(b,[x1-.06,top+2.4,zc],[.12,.6,d-.24],wall);
    for(const z of [z0+.37,z1-.37])box(b,[x1-.06,top+1.575,z],[.12,1.05,.5],wall);
    box(b,[x1-.255,top+1.08,zc],[.49,.06,d-1.26],'#8a6a4c');
    box(b,[(x0+x1)/2,top+2.78,zc],[w+.5,.16,d+.5],'#c9453b');
    const sign=new pc.Entity('sign');sign.setLocalPosition(x1+.06,0,zc);sign.setLocalEulerAngles(0,90,0);b.addChild(sign);
    label(sign,'售票处',[0,top+2.4,0],1.8,.5,'#fff4d6','#a4564a');
    figure(x1-.75,top,zc,90,'#2f4a6b',false);
    mark((x0+x1)/2,zc,w/2,d/2,top,top+2.86,null);
  };
  /** A roof on four posts over the pier head, two lamps under it. */
  const canopy=([x0,x1,z0,z1],top)=>{
    const c=new pc.Entity('canopy');c.lookName='pier';g.addChild(c);
    for(const x of [x0+.15,x1-.15])for(const z of [z0+.15,z1-.15]){cylinder(c,[x,top+1.56,z],[.16,3.12,.16],'#5c666c');mark(x,z,.12,.12,top,top+3.1,null);}
    box(c,[(x0+x1)/2,top+3.2,(z0+z1)/2],[x1-x0+.3,.16,z1-z0+.3],'#2f4a6b');
    for(const x of [x0+(x1-x0)*.3,x0+(x1-x0)*.7])lit(box(c,[x,top+3.08,(z0+z1)/2],[.5,.1,.5],'#fff0cc'));
  };
  /** Posts either side of a pier's walkway where it starts, a beam across, and 渡轮码头 on both faces. */
  const gateway=(x0,x1,z,top)=>{
    const x=(x0+x1)/2;
    const frame=new pc.Entity('gateway');frame.signText='渡轮码头';g.addChild(frame);
    for(const px of [x0+.15,x1-.15]){box(frame,[px,top+1.8,z],[.3,3.6,.3],'#4b5a5e');mark(px,z,.2,.2,top,top+3.6,null);}
    box(frame,[x,top+3.72,z],[x1-x0+.4,.3,.34],'#4b5a5e');
    for(const turn of [0,180]){
      const pivot=new pc.Entity('sign');pivot.setLocalPosition(x,0,z);pivot.setLocalEulerAngles(0,turn,0);g.addChild(pivot);
      label(pivot,'渡轮码头',[0,top+3.12,.25],3.2,.76,'#23493e','#f1e6c8');
    }
  };
  for(const id of ['near','far']){
    const p=H.piers[id],top=p.top,[wx0,wx1,wz0,wz1]=p.walkway,[hx0,hx1,hz0,hz1]=p.head,near=id==='near';
    deck(near?p.walkway:[wx0,wx1,LAND.area[3]+.05,wz1],top);deck(p.head,top);
    // Rails down both sides of the walkway, and round the head but for the walkway and the gangway.
    const [a,b]=near?[wz0,wz1-.3]:[wz0+.3,wz1];
    railing(wx0+.05,a,wx0+.05,b,top);railing(wx1-.05,a,wx1-.05,b,top);
    const out=near?hz0+.05:hz1-.05,back=near?hz1-.05:hz0+.05,gx=p.gate[0];
    railing(hx0,out,gx-1.4,out,top);railing(gx+1.4,out,hx1,out,top);
    railing(hx0,back,wx0,back,top);railing(wx1,back,hx1,back,top);
    railing(hx0+.05,hz0,hx0+.05,hz1,top);railing(hx1-.05,hz0,hx1-.05,hz1,top);
    booth(p.booth,top);canopy(p.canopy,top);gateway(wx0,wx1,p.root,top);
    figure(gx+2.3,top,p.gate[1],-90,'#2f4a6b',true);   // the crew member at the gangway
  }

  // ---- the far landing ------------------------------------------------------------------------
  const bench=(x,z,top,turn)=>{
    const e=new pc.Entity('bench');e.lookName='bench';e.setLocalPosition(x,top,z);e.setLocalEulerAngles(0,turn,0);g.addChild(e);
    box(e,[0,.45,0],[1.9,.07,.5],'#a0714a');box(e,[0,.78,-.24],[1.9,.4,.06],'#a0714a');
    for(const bx of [-.8,.8]){box(e,[bx,.22,0],[.08,.44,.42],'#4b5358');box(e,[bx,.64,-.24],[.08,.36,.04],'#4b5358');}
    const across=turn%180===0;mark(x,z,across?.95:.3,across?.3:.95,top,top+.98,'bench');
  };
  {
    const [x0,x1,z0,z1]=LAND.area,top=LAND.top,cx=(x0+x1)/2,cz=(z0+z1)/2;
    box(g,[cx,top-.03,cz+.025],[x1-x0,.06,z1-z0+.05],'#b9b5ab').lookName='path';
    const pier=H.piers.far.walkway;
    for(const [a,b] of [[x0+.05,pier[0]],[pier[1],x1-.05]])box(g,[(a+b)/2,top+.02,z1-.15],[b-a,.06,.3],'#d2cbbb').lookName='path';   // the coping along the sea wall
    mark(cx,cz,(x1-x0)/2,(z1-z0)/2,-1,top,'path');
    railing(x0+.1,LAND.railing,pier[0],LAND.railing,top);railing(pier[1],LAND.railing,x1-.1,LAND.railing,top);
    for(const [x,z] of LAND.lamps){
      const e=new pc.Entity('streetlight');e.lookName='streetlight';e.setLocalPosition(x,top,z);g.addChild(e);
      cylinder(e,[0,.15,0],[.36,.3,.36],'#4b5358');cylinder(e,[0,2.1,0],[.13,3.9,.13],'#5c666c');
      box(e,[0,4.05,0],[.55,.12,.55],'#4b5358');lit(box(e,[0,3.9,0],[.42,.22,.42],'#fff0cc'));
      mark(x,z,.2,.2,top,top+4.1,'streetlight');
    }
    for(const [x,z] of LAND.benches)bench(x,z,top,0);
    for(const [x,z] of LAND.trees){
      m.tree(g,x,z,1,'tree').setLocalPosition(x,top,z);
      town.markDisc('city',OX+x,z,.45,top,top+4,'tree');
    }
    for(const [a,b] of LAND.hedges){
      box(g,[(a+b)/2,top+.3,z0-.35],[b-a,.6,.7],'#8f8a80').lookName='wall';
      box(g,[(a+b)/2,top+.85,z0-.35],[b-a-.1,.5,.6],'#5f7d52').lookName='hedge';
      mark((a+b)/2,z0-.35,(b-a)/2,.35,top,top+1.1,'hedge');
    }
    for(const x of [x0-.35,x1+.35]){
      box(g,[x,top+.3,cz],[.7,.6,z1-z0],'#8f8a80').lookName='wall';
      box(g,[x,top+.85,cz],[.6,.5,z1-z0-.1],'#5f7d52').lookName='hedge';
    }
    // The plaza at the foot of 云海中心: a paved circle, a ring of lights set in it, a tree in a round bed.
    const {x:px,z:pz,radius}=LAND.plaza;
    cylinder(g,[px,top+.01,pz],[radius*2,.02,radius*2],'#d2cbbb').lookName='square';
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2;lit(box(g,[px+Math.cos(a)*(radius-.5),top+.025,pz+Math.sin(a)*(radius-.5)],[.3,.02,.3],'#fff0cc'));}
    cylinder(g,[px,top+.25,pz],[3,.5,3],'#8f8a80').lookName='planter';
    cylinder(g,[px,top+.51,pz],[2.7,.03,2.7],'#6b5a45').lookName='planter';
    m.tree(g,px,pz,1.2,'osmanthus').setLocalPosition(px,top+.52,pz);
    town.markDisc('city',OX+px,pz,1.5,top,top+.5,'planter');
    for(const turn of [90,-90])bench(px+(turn>0?-radius-1:radius+1),pz,top,turn);
  }

  // ---- the Ferris wheel: its frame (still), rim and lights (turning) and cabins (hanging) ----------
  const R=W.radius,n=W.cabins,wheelBase=new pc.Entity('ferris-wheel');
  wheelBase.lookName='ferris-wheel';wheelBase.lookReach=200;wheelBase.setLocalPosition(W.x,0,W.z);g.addChild(wheelBase);
  {
    const top=LAND.top,s=W.spread,steel='#e9ecef';
    for(const z of [-s,s]){
      for(const side of [-1,1]){
        tube(wheelBase,[side*W.legs,top],[0,W.hub],.8,steel,z);
        box(wheelBase,[side*W.legs,top+.35,z],[1.8,.7,1.8],'#9a958b');
        mark(W.x+side*W.legs,W.z+z,.9,.9,top,top+1.2,'ferris-wheel');
      }
      for(const [y,t] of [[9,.4],[17,.35]]){const half=W.legs*(1-(y-top)/(W.hub-top));box(wheelBase,[0,y,z],[half*2+.2,t,t],steel);}
    }
    cylinder(wheelBase,[0,W.hub,0],[1.2,2*s+.6,1.2],'#c3c8cc',[90,0,0]);
    // The boarding platform, railed but for its gate, 摩天轮 over the gate.
    const [x0,x1,z0,z1]=W.platform,deckTop=W.floor;
    const platform=new pc.Entity('platform');platform.lookName='ferris-wheel';g.addChild(platform);
    box(platform,[(x0+x1)/2,(top+deckTop)/2,(z0+z1)/2],[x1-x0,deckTop-top,z1-z0],'#c9c2b2');
    mark((x0+x1)/2,(z0+z1)/2,(x1-x0)/2,(z1-z0)/2,-1,deckTop,null);
    const [gx]=W.gate,railed=(ax,az,bx,bz)=>{
      railing(ax,az,bx,bz,deckTop);
      mark((ax+bx)/2,(az+bz)/2,Math.max(.06,Math.abs(bx-ax)/2),Math.max(.06,Math.abs(bz-az)/2),deckTop,deckTop+1.05,'railing');
    };
    railed(x0+.05,z0,x0+.05,z1);railed(x1-.05,z0,x1-.05,z1);railed(x0,z0+.05,x1,z0+.05);
    railed(x0,z1-.05,gx-1.6,z1-.05);railed(gx+1.6,z1-.05,x1,z1-.05);
    for(const x of [gx-1.4,gx+1.4]){box(platform,[x,deckTop+1.7,z1-.05],[.25,3.4,.25],'#c9453b');mark(x,z1-.05,.15,.15,deckTop,deckTop+3.4,null);}
    box(platform,[gx,deckTop+3.5,z1-.05],[3.2,.3,.3],'#c9453b');
    label(g,'摩天轮',[gx,deckTop+2.95,z1+.1],2.4,.7,'#fff4d6','#c9453b');
    figure(gx+2.4,top,z1+.6,0,'#c9453b',true);   // the attendant, by the gate
  }
  const rotor=drawn('ferris-wheel',root,[baked(s=>{
    const steel='#eef1f3',segments=high?48:32,step=Math.PI*2/segments,r2=R-3;
    for(const side of [-1,1]){
      const z=side*W.rims;
      for(let i=0;i<segments;i++){
        const a=(i+.5)*step;
        box(s,[Math.cos(a)*R,Math.sin(a)*R,z],[R*step+.12,.45,.3],steel,[0,0,a*180/Math.PI+90]);
        if(low)continue;
        box(s,[Math.cos(a)*r2,Math.sin(a)*r2,z],[r2*step+.1,.28,.22],steel,[0,0,a*180/Math.PI+90]);
        // A zigzag of struts between the two rings.
        if(high){const [ra,rb]=i%2?[R,r2]:[r2,R];tube(s,[Math.cos(i*step)*ra,Math.sin(i*step)*ra],[Math.cos((i+1)*step)*rb,Math.sin((i+1)*step)*rb],.14,steel,z);}
      }
      for(let k=0;k<n;k++){const a=(k/n-.25)*Math.PI*2;tube(s,[Math.cos(a)*1.4,Math.sin(a)*1.4],[Math.cos(a)*(R-.2),Math.sin(a)*(R-.2)],.16,steel,z);}
      cylinder(s,[0,0,z],[3.2,.5,3.2],'#c3c8cc',[90,0,0]);
    }
    for(let k=0;k<n;k++){const a=(k/n-.25)*Math.PI*2;box(s,[Math.cos(a)*R,Math.sin(a)*R,0],[.18,.18,2*W.rims+.3],'#c3c8cc');}
  })],paint);
  rotor.setLocalPosition(W.x,W.hub,W.z);
  // Looked at, the turning wheel is its rim and its hub: a ray meets the wheel's own plane there or
  // not at all. (Its mesh's box turns with it, and at an eighth of a turn stands out 32 m from the
  // hub, over the skyline behind.) Far off, like the drones and the LED characters, it has a reach.
  town.registry.addLook({place:'city',x:OX+W.x,z:W.z,hw:R+1.5,hd:W.rims+.5,y0:W.hub-R-1.5,y1:W.hub+R+1.5,
    name:NAME('ferris-wheel'),owner:'harbour',entity:rotor,refine:(origin,dir,limit)=>{
      if(Math.abs(dir.z)<1e-6)return null;
      const t=(W.z-origin.z)/dir.z;
      if(t<0||t>limit)return null;
      const r=Math.hypot(origin.x+dir.x*t-OX-W.x,origin.y+dir.y*t-W.hub);
      return Math.abs(r-R)<1.5||r<2.5?[t,t]:null;
    }}).reach=200;
  // The lights: strips of LEDs round both rims, out along the spokes and round the hub, each vertex
  // carrying (how far round the wheel, how far out from the hub) for the shader's patterns.
  const lights={show:new Float32Array([0,1,0,0]),material:null};
  {
    const pos=[],uv=[],idx=[],CUBE=[0,2,1,1,2,3,4,5,6,5,7,6,0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5];
    /** A strip from turn-share/radius (ua, ra) to (ub, rb), `t` thick in the wheel's plane and `d` deep, at z. */
    const strip=(ua,ra,ub,rb,z,t,d)=>{
      const ax=Math.cos(ua*Math.PI*2)*ra,ay=Math.sin(ua*Math.PI*2)*ra,bx=Math.cos(ub*Math.PI*2)*rb,by=Math.sin(ub*Math.PI*2)*rb;
      const len=Math.hypot(bx-ax,by-ay)||1,px=-(by-ay)/len*t/2,py=(bx-ax)/len*t/2,base=pos.length/3;
      for(let i=0;i<8;i++){
        const end=i&1,s=i&2?1:-1;
        pos.push((end?bx:ax)+s*px,(end?by:ay)+s*py,z+(i&4?d/2:-d/2));uv.push(end?ub:ua,(end?rb:ra)/R);
      }
      for(const i of CUBE)idx.push(base+i);
    };
    const rim=high?96:low?48:64,spokes=low?0:high?1:2;
    for(const side of [-1,1]){
      const z=side*W.rims;
      for(let i=0;i<rim;i++)strip(i/rim,R+.35,(i+1)/rim,R+.35,z,.3,.3);
      if(spokes)for(let k=0;k<n;k+=spokes){
        const a=k/n+.75;   // a spoke's turn share, measured like the rim's, from +x
        for(let j=0;j<8;j++)strip(a,2+j*(R-2.4)/8,a,2+(j+1)*(R-2.4)/8,z+side*.13,.16,.16);
      }
      if(!low)for(let i=0;i<24;i++)strip(i/24,2.2,(i+1)/24,2.2,z+side*.3,.18,.12);
    }
    const mesh=new pc.Mesh(device);mesh.setPositions(pos);mesh.setUvs(0,uv);mesh.setIndices(idx);mesh.update();
    lights.material=new pc.ShaderMaterial({uniqueName:'wheel-lights',vertexGLSL:LIGHTS_VS,fragmentGLSL:LIGHTS_FS,
      attributes:{vertex_position:pc.SEMANTIC_POSITION,vertex_texCoord0:pc.SEMANTIC_TEXCOORD0}});
    lights.material.setParameter('wheelShow',lights.show);lights.material.setParameter('wheelTime',0);
    drawn('wheel-lights',rotor,[mesh],lights.material);
  }
  // The cabins: one mesh a colour, each drawn as instances hung from the rim, their origin the pivot.
  const cabins=new pc.Entity('wheel-cabins');cabins.noBatch=true;cabins.setLocalPosition(W.x,0,W.z);root.addChild(cabins);
  cabins.addComponent('render',{castShadows:false,receiveShadows:true});
  const groups=W.colors.map((color,gi)=>{
    const mesh=baked(s=>{
      for(const x of [-.6,.6])box(s,[x,-.25,0],[.1,.5,.1],'#8f979e');
      box(s,[0,-.58,0],[2.2,.16,2.4],color);box(s,[0,-.42,0],[1.4,.18,1.6],color);
      box(s,[0,-2.84,0],[2.1,.12,2.3],'#7d8387');
      for(const z of [-1.12,1.12])box(s,[0,-2.425,z],[2.1,.95,.06],color);
      for(const x of [-1.02,1.02])box(s,[x,-2.425,0],[.06,.95,2.3],color);
      for(const x of [-1,1])for(const z of [-1.1,1.1])box(s,[x,-1.305,z],[.1,1.29,.1],color);
      box(s,[0,-1.305,0],[2.12,1.29,2.32],'#3a5561').glow=.35;   // glass all round: see-through from inside
      box(s,[0,-2.33,-.85],[1.8,.1,.45],'#a0714a');box(s,[0,-2.0,-1.05],[1.8,.5,.08],'#a0714a');
      box(s,[0,-.69,0],[1.8,.03,2],'#fff4d6').glow=.9;   // the light in its ceiling
    });
    const count=Math.ceil((n-gi)/W.colors.length),matrices=new Float32Array(count*16);
    for(let i=0;i<count;i++)matrices[i*16]=matrices[i*16+5]=matrices[i*16+10]=matrices[i*16+15]=1;
    const buffer=new pc.VertexBuffer(device,pc.VertexFormat.getDefaultInstancingFormat(device),count,{usage:pc.BUFFER_DYNAMIC,data:matrices.buffer});
    const instance=new pc.MeshInstance(mesh,paint);instance.setInstancing(buffer,true);
    return {matrices,buffer,instance};
  });
  cabins.render.meshInstances=groups.map(group=>group.instance);cabins.render.castShadows=false;
  cabins.render.customAabb=new pc.BoundingBox(new pc.Vec3(0,W.hub,0),new pc.Vec3(R+2,R+3,2));

  // ---- the boats --------------------------------------------------------------------------------
  const ferryMesh=baked(s=>{
    box(s,[0,-.15,0],[6.6,.9,15],'#2f5d58');box(s,[0,.5,0],[7,.4,16],'#f1efe6');
    box(s,[0,.3,0],[7.04,.07,16.04],'#c9453b');box(s,[0,.55,0],[7.16,.16,13],'#2c2c2c');
    box(s,[0,.72,0],[6.8,.06,15.8],'#9b7b58');
    for(const x of [-3.38,3.38]){
      for(let z=-7.5;z<=7.51;z+=1.25)box(s,[x,1.24,z],[.05,.98,.05],'#d9dcd8');
      box(s,[x,1.74,0],[.07,.06,15.1],'#e8eae6');box(s,[x,1.25,0],[.04,.04,15.1],'#d9dcd8');
      for(let z=-6.9;z<=6.91;z+=1.25)box(s,[x,1.83,z],[.12,.12,.12],'#fff1c9').glow=1;   // a string of lights along the rail
    }
    for(const z of [-7.85,7.85])for(const side of [-1,1]){
      box(s,[side*2.34,1.74,z],[2.08,.06,.07],'#e8eae6');box(s,[side*2.34,1.25,z],[2.08,.04,.04],'#d9dcd8');
      for(const x of [1.3,2.34])box(s,[side*x,1.24,z],[.05,.98,.05],'#d9dcd8');
    }
    box(s,[0,1.75,0],[3.6,2,6.6],'#f4f1e8');box(s,[0,2,0],[3.64,.8,6.64],'#35505a').glow=1;
    for(const z of [-3.33,3.33])box(s,[0,1.45,z],[1,1.4,.04],'#5b6b70');
    box(s,[0,2.82,0],[4.4,.14,7.6],'#e6e0d0');
    box(s,[0,3.94,0],[2.2,2.1,2.2],'#f4f1e8');box(s,[0,4.2,0],[2.24,.9,2.24],'#35505a').glow=1;
    box(s,[0,5.05,0],[2.6,.12,2.6],'#c9453b');
    cylinder(s,[0,6.1,0],[.12,2,.12],'#d9dcd8');box(s,[0,7.15,0],[.2,.14,.2],'#fff4d6').glow=1;
    box(s,[0,6.7,.45],[.03,.5,.8],'#c9453b');
    for(const side of [-1,1]){
      box(s,[0,1.2,side*3.62],[2.6,.08,.45],'#b5773f');box(s,[0,1.45,side*3.84],[2.6,.4,.06],'#b5773f');
      for(const x of [-1.1,1.1])box(s,[x,.97,side*3.62],[.06,.44,.4],'#6d6d6d');
    }
    for(const x of [-1.83,1.83])for(const z of [-2,2])cylinder(s,[x,1.6,z],[.55,.08,.55],'#ee6a2e',[0,0,90]);
  });
  const tourMesh=low?null:baked(s=>{
    box(s,[0,-.2,1.25],[5,1,19.5],'#23395b');box(s,[0,-.2,-8.5],[3.54,1,3.54],'#23395b',[0,45,0]);
    box(s,[0,.55,1.25],[5.4,.5,19.9],'#f3f1ea');box(s,[0,.55,-8.7],[3.82,.5,3.82],'#f3f1ea',[0,45,0]);
    box(s,[0,.83,1.25],[5.2,.05,19.6],'#9b7b58');
    box(s,[0,1.95,2.5],[4.4,2.2,13],'#f3f1ea');box(s,[0,2.1,2.5],[4.44,1,13.04],'#40515a').glow=1;
    box(s,[0,3.11,2.3],[5,.12,14.4],'#e6e0d0');
    for(const x of [-2.45,2.45]){
      for(let z=-4.8;z<=9.41;z+=1.2)box(s,[x,3.62,z],[.05,.9,.05],'#d9dcd8');
      box(s,[x,4.08,2.3],[.07,.06,14.3],'#e8eae6');
      for(let z=-4.8;z<=9.41;z+=.9)box(s,[x,4.2,z],[.13,.13,.13],'#fff1c9').glow=1;   // the festoon
    }
    box(s,[0,4.08,9.45],[4.9,.06,.07],'#e8eae6');box(s,[0,4.08,-4.85],[4.9,.06,.07],'#e8eae6');
    box(s,[0,3.82,-3],[2.2,1.3,2],'#f3f1ea');box(s,[0,3.95,-3],[2.24,.6,2.04],'#40515a').glow=1;box(s,[0,4.53,-3],[2.5,.1,2.3],'#c9453b');
    for(let z=-.8;z<=8.4;z+=1.6)box(s,[0,3.45,z],[3.6,.4,.5],'#b5773f');
    cylinder(s,[0,3.35,-7],[.1,5,.1],'#d9dcd8');
    for(let i=0;i<=10;i++){const t=i/10;box(s,[0,5.8-t*1.6,-7+t*2.1],[.13,.13,.13],'#fff1c9').glow=1;}
    box(s,[0,5.5,10.9],[.03,.45,.7],'#c9453b');cylinder(s,[0,4.3,11],[.06,2.2,.06],'#d9dcd8');
  });
  const sailMesh=high?baked(s=>{
    box(s,[0,.05,.5],[2.1,.8,5.4],'#f7f5ee');box(s,[0,.05,-2.2],[1.49,.8,1.49],'#f7f5ee',[0,45,0]);
    box(s,[0,.3,.5],[2.14,.12,5.44],'#2c5d8a');box(s,[0,.3,-2.2],[1.53,.12,1.53],'#2c5d8a',[0,45,0]);
    box(s,[0,.47,.5],[1.95,.04,5.3],'#9b7b58');box(s,[0,.64,.6],[1.3,.35,1.8],'#f7f5ee');
    cylinder(s,[0,4.65,-.8],[.1,8.4,.1],'#c3c8cc');box(s,[0,1.45,.75],[.08,.08,3.1],'#c3c8cc');
  },[[[[0,1.55,-.75],[0,8.7,-.75],[0,1.55,2.25]],'#fbfaf5'],[[[0,.95,-3.1],[0,7.6,-.85],[0,1.2,-1.1]],'#f3d9a4']]):null;
  const wakeMap=low?null:wakeTexture(device);
  const LO=new pc.Vec3(),LD=new pc.Vec3(),BMIN=new pc.Vec3(),BMAX=new pc.Vec3();
  /** One boat: its mesh, a V of foam behind it, and a look box that follows it round. */
  const boat=(id,mesh,[beam,length,height],wake)=>{
    const e=drawn(id,root,[mesh],paint);
    const b={entity:e,half:[beam/2,length/2],x:0,z:0,y:SEA,yaw:0,c:1,s:0,speed:0,dock:0,wake:null,foam:null};
    if(wakeMap){
      const [w0,w1,len]=wake,quad=new pc.Mesh(device);
      quad.setPositions([-w0/2,0,0,w0/2,0,0,-w1/2,0,len,w1/2,0,len]);quad.setUvs(0,[0,0,1,0,0,1,1,1]);
      quad.setNormals([0,1,0,0,1,0,0,1,0,0,1,0]);quad.setIndices([0,2,1,1,2,3]);quad.update();
      b.foam=new pc.StandardMaterial();
      Object.assign(b.foam,{opacityMap:wakeMap,opacityMapChannel:'a',blendType:pc.BLEND_NORMAL,depthWrite:false,cull:pc.CULLFACE_NONE,
        useMetalness:true,metalness:0,gloss:.3,opacity:1});
      b.foam.diffuse=new pc.Color(.93,.96,.97);b.foam.update();
      b.wake=drawn(id+'-wake',root,[quad],b.foam);b.wake.enabled=false;
    }
    b.look=town.registry.addLook({place:'city',x:0,z:0,hw:1,hd:1,y0:SEA,y1:SEA+height,name:NAME(id),owner:'harbour',entity:e,
      // The ray in the boat's own frame, against the box round its hull above the water: the bay's
      // own look box is flat, so it wins wherever the ray reaches the water inside a bigger box.
      refine:(origin,dir,limit)=>{
        const ox=origin.x-OX-b.x,oz=origin.z-b.z;
        LO.set(ox*b.c-oz*b.s,origin.y-b.y,ox*b.s+oz*b.c);LD.set(dir.x*b.c-dir.z*b.s,dir.y,dir.x*b.s+dir.z*b.c);
        BMIN.set(-b.half[0],.02,-b.half[1]);BMAX.set(b.half[0],height,b.half[1]);
        return raySpan(LO,LD,BMIN,BMAX,limit);
      }});
    b.look.reach=160;
    if(high)reflect(e);
    return b;
  };
  const ferry=boat('ferry',ferryMesh,[F.beam,F.length,7.3],[F.beam*.9,F.beam*3.2,F.length*1.9]);
  const tour=tourMesh?boat('tour-boat',tourMesh,[H.tour.beam,H.tour.length,6],[H.tour.beam*.9,H.tour.beam*3.4,H.tour.length*1.6]):null;
  const sail=sailMesh?boat('sailboat',sailMesh,[H.sail.beam,H.sail.length,9],[H.sail.beam,H.sail.beam*3.4,H.sail.length*1.8]):null;
  const boats=[ferry,tour,sail].filter(Boolean);
  const loops=[[tour,H.tour],[sail,H.sail]].filter(([b])=>b).map(([b,data])=>({b,data,route:curve(data.route,true),st:{}}));
  if(high){reflect(rotor);reflect(cabins);reflect(wheelBase);}
  const ferryRoute=curve(F.route);

  // ---- riding the ferry -------------------------------------------------------------------------
  const state={},spot={},prev={x:0,z:0,yaw:0,c:1,s:0,dock:0};
  let riding=null;   // the ride you are on: {paid, pier, crossed}
  let kept=null;     // stepped back ashore before it left: {ride, pier}, good while it is still there
  // The deck as 云海 ground while you ride, in the ferry's frame (`f`: where it is): the deck but
  // the cabin, and the gangway at whichever end is against a pier.
  const onFerry=(px,pz,f=ferry)=>{
    const wx=px-f.x,wz=pz-f.z,lx=wx*f.c-wz*f.s,lz=wx*f.s+wz*f.c;
    if(Math.abs(lx)<=DECK.x&&Math.abs(lz)<=DECK.z)return !(Math.abs(lx)<DECK.cabinX&&Math.abs(lz)<DECK.cabinZ);
    return f.dock!==0&&Math.abs(lx)<=DECK.gangX&&lz*f.dock>0&&Math.abs(lz)<=DECK.gangZ;
  };
  addedGround.push(...H.walk,(px,pz)=>!!riding&&onFerry(px,pz));
  // The deck is a floor that moves with the ferry: a solid box, resized as it turns.
  const floor=mark(0,0,1,1,-1,F.deck,null);
  const deckY=()=>ferry.y-SEA+F.deck;
  const pierEnd=at=>at==='near'?1:at==='far'?-1:0;   // which end of the ferry is against a pier

  function placeFerry(t){
    ferryAt(t,F,state);
    ferryRoute.at(state.u*ferryRoute.length,spot);
    ferry.x=spot.x;ferry.z=spot.z;ferry.yaw=Math.atan2(-spot.dx,-spot.dz);ferry.c=Math.cos(ferry.yaw);ferry.s=Math.sin(ferry.yaw);
    ferry.speed=state.speed*ferryRoute.length;ferry.dock=pierEnd(state.at);
    ferry.y=SEA+Math.sin(t*1.3)*.05;
    ferry.entity.setLocalPosition(ferry.x,ferry.y,ferry.z);
    ferry.entity.setLocalEulerAngles(Math.sin(t*1.1+1)*.5,ferry.yaw*180/Math.PI,Math.sin(t*.9)*.8);
    floor.x=OX+ferry.x;floor.z=ferry.z;floor.y1=deckY();
    floor.hw=Math.abs(ferry.c)*DECK.x+Math.abs(ferry.s)*DECK.z;floor.hd=Math.abs(ferry.s)*DECK.x+Math.abs(ferry.c)*DECK.z;
  }
  /** Off the ferry: a ride that has not left its pier yet still holds while the ferry is there. */
  function ashore(){if(!riding.crossed)kept={ride:riding,pier:riding.pier};riding=null;}
  /** Carry the tourist with the ferry: its move and its turn since the last frame, onto them. */
  function carry(){
    const body=town.player.entity,p=body.getPosition();
    // Walked off onto a pier (or put somewhere else entirely): the ride is over.
    if(!onFerry(p.x-OX,p.z,prev)){ashore();return;}
    const turn=ferry.yaw-prev.yaw,c=Math.cos(turn),s=Math.sin(turn),wx=p.x-OX-prev.x,wz=p.z-prev.z;
    let x=ferry.x+wx*c+wz*s,z=ferry.z-wx*s+wz*c;
    // Out at sea there is no gangway: anyone still on it steps back onto the deck.
    if(!ferry.dock&&!onFerry(x,z)){
      const lx=(x-ferry.x)*ferry.c-(z-ferry.z)*ferry.s,lz=Math.max(-DECK.z,Math.min(DECK.z,(x-ferry.x)*ferry.s+(z-ferry.z)*ferry.c));
      x=ferry.x+lx*ferry.c+lz*ferry.s;z=ferry.z-lx*ferry.s+lz*ferry.c;
    }
    const y=town.grounded?deckY():town.playerY;
    body.setPosition(OX+x,y,z);town.playerY=y;
    town.yaw+=turn*180/Math.PI;
  }

  // ---- riding the wheel -------------------------------------------------------------------------
  const seat={x:W.x,z:W.z-.85,seat:0,rot:0,wheel:true},seatIndex=room.fittings.push(seat)-1;
  let wheelRiding=null;   // {cabin, start, seconds}
  const cabinAngle=(k,turn)=>(k/n+turn-.25)*Math.PI*2;
  const placeSeat=turn=>{const a=cabinAngle(wheelRiding.cabin,turn);seat.x=W.x+Math.cos(a)*R;seat.seat=W.hub+Math.sin(a)*R-2.28;};

  const clock=()=>clockSeconds(town.daylight.hour);
  // The crew's call carries along their pier and a few metres round its gangway, not over the promenade.
  const heard=id=>{
    const pier=H.piers[id],p=town.player.entity.getPosition(),x=p.x-OX,[gx,gz]=pier.gate;
    return [pier.walkway,pier.head].some(([x0,x1,z0,z1])=>x>=x0&&x<=x1&&p.z>=z0&&p.z<=z1)||Math.hypot(x-gx,p.z-gz)<F.hear;
  };
  const boardLabel=`${H.ui.board.zh} · ${H.ui.ticket.zh} ${F.fare} 学习币`,offLabel=`${H.ui.off.zh} · ${H.ui.off.en}`,wheelLabel=`摩天轮 · ${W.fare} 学习币`;
  let lastAt=null,called=-1;
  const part={
    state,
    get riding(){return !!riding;},
    get onWheel(){return !!wheelRiding;},
    get ferry(){return ferry;},
    /** Why boarding at `pier` is not possible now, or null. */
    boardingProblem:pier=>boardingProblem(state,pier,!!riding||!!wheelRiding||!!town.seated),
    /** The ride boarding at `pier` would be: the one kept from stepping ashore there, or a new one to pay for. */
    rideFor:pier=>kept?.pier===pier?kept.ride:{paid:false},
    /** Step aboard at `pier`, `ride` being the ride its fare paid for: onto the deck by the gangway. */
    board(pier,ride){
      if(part.boardingProblem(pier)||!ride?.paid)return false;
      const lz=pierEnd(pier)*(DECK.z-1);
      town.warp(OX+ferry.x+lz*ferry.s,ferry.z+lz*ferry.c,town.yaw,deckY());
      riding=Object.assign(ride,{pier,crossed:false});kept=null;
      Object.assign(prev,{x:ferry.x,z:ferry.z,yaw:ferry.yaw,c:ferry.c,s:ferry.s,dock:ferry.dock});
      return true;
    },
    /** Off onto the pier the ferry is docked at, facing the way in. */
    getOff(){
      if(!riding||!ferry.dock)return false;
      const pier=H.piers[ferry.dock>0?'near':'far'];
      ashore();
      town.warp(OX+pier.gate[0],pier.gate[1]-pier.out,ferry.dock>0?180:0,pier.top);
      return true;
    },
    canRide:()=>!wheelRiding&&!riding&&!town.seated,
    /** Into the cabin at the bottom of the wheel, sitting facing the bay, for one turn. */
    rideWheel(){
      if(!part.canRide())return false;
      const t=clock(),{cabin,seconds}=wheelRide(t);
      wheelRiding={cabin,start:t,seconds};placeSeat(wheelTurn(t));
      if(!town.sit(seatIndex)){wheelRiding=null;return false;}
      seat.locked=true;   // no getting out halfway up (town.seatLocked)
      return true;
    },
    targets(){
      if(riding){
        if(!ferry.dock||!riding.crossed)return [];
        const p=town.player.entity.getPosition();
        return [{id:'harbour:off',x:p.x,z:p.z,radius:1,label:offLabel,wide:true}];
      }
      const list=[];
      for(const id of ['near','far']){
        const [x,z]=H.piers[id].gate;
        if(!part.boardingProblem(id))list.push({id:'harbour:board:'+id,x:OX+x,z,radius:3.2,label:boardLabel,wide:true});
      }
      if(part.canRide())list.push({id:'harbour:wheel',x:OX+W.gate[0],z:W.gate[1],radius:3,label:wheelLabel,wide:true});
      return list;
    },
    update(){
      const t=clock(),lv=detail();
      // The ferry, and you on it.
      prev.x=ferry.x;prev.z=ferry.z;prev.yaw=ferry.yaw;prev.c=ferry.c;prev.s=ferry.s;prev.dock=ferry.dock;
      placeFerry(t);
      kept=stillHolds(kept,state);
      if(riding){carry();if(riding&&!state.at)riding.crossed=true;}
      // The crew call all aboard before it leaves, to anyone near the pier or aboard; and the far side.
      if(state.at){
        const key=(state.at==='near'?0:1)+2*Math.floor(t/(2*(F.wait+F.crossing)));
        if(state.leaves<=F.announce&&called!==key&&(riding||heard(state.at))){called=key;town.onAnnounce?.(H.lines.board);}
        if(!lastAt&&riding?.crossed)town.onAnnounce?.(H.lines.arrive);
      }
      lastAt=state.at;
      pose(t,lv);
      // You in your cabin: the seat follows it round; once round, the attendant sees you off.
      if(wheelRiding){
        if(town.seated?.index!==seatIndex){wheelRiding=null;seat.locked=false;}   // put somewhere else (a warp, a door)
        else if(((t-wheelRiding.start)%DAY+DAY)%DAY>=wheelRiding.seconds){
          wheelRiding=null;seat.locked=false;town.stand();town.onAnnounce?.(H.lines['wheel-off']);
        }else{
          placeSeat(wheelTurn(t));
          const y=seat.seat-SEAT_DROP;
          town.player.entity.setPosition(OX+seat.x,y,seat.z);town.playerY=y;
        }
      }
    },
  };
  /** Everything else that moves, where the clock says: the boats and their foam, what they are
   *  called where they are, and the wheel with its cabins and lights. */
  function pose(t,lv){
    // The boats on their loops, bobbing at their moorings between trips; only the ferry on low.
    for(const {b,data,route,st} of loops){
      const run=lv==='high'||(lv==='medium'&&b===tour);
      loopAt(t,data,route.length,st);
      route.at(run?st.d:0,spot);
      b.x=spot.x;b.z=spot.z;b.yaw=Math.atan2(-spot.dx,-spot.dz);b.c=Math.cos(b.yaw);b.s=Math.sin(b.yaw);b.speed=run?st.speed:0;
      b.y=SEA+Math.sin(t*1.1+b.half[1])*.07;
      b.entity.setLocalPosition(b.x,b.y,b.z);
      b.entity.setLocalEulerAngles(Math.sin(t*.8+b.half[0])*.8,b.yaw*180/Math.PI,Math.sin(t*1.2)*1.2-(b===sail?b.speed*3:0));
    }
    for(let i=0;i<boats.length;i++){
      const b=boats[i],look=b.look,hx=b.half[0],hz=b.half[1];
      look.x=OX+b.x;look.z=b.z;look.hw=Math.abs(b.c)*hx+Math.abs(b.s)*hz;look.hd=Math.abs(b.s)*hx+Math.abs(b.c)*hz;
      if(!b.wake)continue;
      const speed=Math.abs(b.speed),on=speed>.2&&lv!=='low';
      if(b.wake.enabled!==on)b.wake.enabled=on;
      if(!on)continue;
      // The foam trails behind whichever end leads: the ferry runs both ways.
      const back=b.speed>=0?1:-1;
      b.wake.setLocalPosition(b.x+back*b.s*(hz-1),SEA+.06,b.z+back*b.c*(hz-1));
      b.wake.setLocalEulerAngles(0,b.yaw*180/Math.PI+(back>0?0:180),0);
      b.foam.setParameter('material_opacity',Math.min(1,speed/3)*.8);
    }
    // The wheel turns; its cabins hang from the rim and sway a little; its lights play after dark.
    const turn=wheelTurn(t);
    rotor.setLocalEulerAngles(0,0,turn*360);
    for(let gi=0;gi<groups.length;gi++){
      const {matrices,buffer}=groups[gi];
      for(let i=0,k=gi;k<n;i++,k+=groups.length){
        const a=cabinAngle(k,turn),sway=Math.sin(t*.9+k)*.015,o=i*16;
        matrices[o]=matrices[o+5]=Math.cos(sway);matrices[o+1]=Math.sin(sway);matrices[o+4]=-Math.sin(sway);
        matrices[o+12]=Math.cos(a)*R;matrices[o+13]=W.hub+Math.sin(a)*R;
      }
      buffer.unlock();
    }
    const show=lights.show,slot=Math.floor(t/PATTERN_SECONDS);
    if(lv==='low'){show[0]=show[1]=STEADY;show[2]=0;}
    else{show[0]=slot%PATTERNS;show[1]=(slot+1)%PATTERNS;show[2]=Math.max(0,t%PATTERN_SECONDS-(PATTERN_SECONDS-2))/2;}
    show[3]=town.daylight.state?.lamps??0;
    lights.material.setParameter('wheelTime',t%DAY);
  }
  town.harbour=part;
  placeFerry(clock());pose(clock(),level);   // in place before the city's look boxes are taken
  return part;
}
