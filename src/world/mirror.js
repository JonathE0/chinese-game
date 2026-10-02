import * as pc from 'playcanvas';
import {detail,RENDER} from '../core/quality.js';
import {VS} from './views.js';

/**
 * Mirrors (task W4-glass, docs/superpowers/plans/2026-09-30-development-wave-4.md): the `mirror`
 * fittings in rooms.json reflect the room and the tourist in it.
 *
 * A planar reflection, as the bay's water is (src/world/bay.js): a second camera draws the world
 * from the player's camera reflected in the mirror's plane (its faces drawn flipped), its near
 * plane tilted onto the glass so nothing behind the wall is drawn, and its frustum cropped to the
 * glass's part of the screen as the street view's is (src/world/views.js); the glass then shows
 * that texture at its own screen position, lightly tinted. One mirror at a time draws: the nearest
 * one on screen within REACH metres that you stand in front of. As sharp as the screen on 高, half
 * that on 中, and on 低 (`mirrorScale` 0, src/core/quality.js) mirrors stay plain glass. From your
 * own eyes the head and upper body are hidden (town.js applyView); the mirror's pass shows them, so
 * you see all of you.
 */
const REACH=8;
// The glass's part of the screen is drawn into the bottom-left corner of the texture, as big as it is
// on screen (task W6-perf: drawn over the whole texture, a mirror a third of the screen wide cost
// nine times the pixels it shows): `viewRect` is that part's centre and half size in NDC.
const FS=`uniform sampler2D viewMap;
uniform vec4 viewRect;
uniform vec2 viewScreen;
void main(void){
  vec2 ndc=gl_FragCoord.xy*viewScreen*2.0-1.0;
  vec3 seen=texture2D(viewMap,(ndc-viewRect.xy+viewRect.zw)*0.5).rgb;
  gl_FragColor=vec4(seen*vec3(.9,.93,.94)+vec3(.015,.02,.025),1.0);
}`;
const VP=new pc.Mat4(),M=new pc.Mat4(),CORNER=new pc.Vec4(),EYE=new pc.Vec3(),TO=new pc.Vec3(),CORNER_RECT=new pc.Vec4();

/** The reflection in the plane through `p` with unit normal `n`, into `out` (a pc.Mat4). */
export function mirrorMatrix(n,p,out){
  const d=out.data,v=[n.x,n.y,n.z],k=2*n.dot(p);
  for(let c=0;c<3;c++){for(let r=0;r<3;r++)d[c*4+r]=(r===c?1:0)-2*v[r]*v[c];d[c*4+3]=0;}
  for(let r=0;r<3;r++)d[12+r]=k*v[r];
  d[15]=1;
  return out;
}

export class Mirrors {
  constructor(town){
    this.town=town;this.frames=0;this.active=null;this.lists=new Map();this.hidden=[];
    this.rect=new Float32Array([0,0,1,1]);this.screen=new Float32Array([1,1]);this.clip=[0,0,0,0];this.clipped=false;
    this.flip=new pc.Mat4();
    const app=town.app,eye=town.camera,main=eye.camera;
    this.camera=new pc.Entity('mirror');
    this.camera.addComponent('camera',{layers:[pc.LAYERID_WORLD],priority:-1,enabled:false,clearColor:main.clearColor,
      toneMapping:main.toneMapping,gammaCorrection:main.gammaCorrection});
    const own=this.camera.camera;
    own.camera.flipFaces=true;
    own.calculateTransform=m=>m.mul2(this.flip,eye.getWorldTransform());
    own.calculateProjection=m=>this.project(m);
    app.root.addChild(this.camera);
    this.material=new pc.ShaderMaterial({uniqueName:'mirror',vertexGLSL:VS,fragmentGLSL:FS,
      attributes:{vertex_position:pc.SEMANTIC_POSITION}});
    // ponytail: as in views.js — no public per-camera shadow switch in PlayCanvas 2.22, so this camera
    // is dropped from the engine's list of cameras needing a sun shadow map (the sun is off while it
    // draws, below). Without that list it simply renders a shadow map it does not use.
    const culler=app.renderer?.culler,sun=town.sun.light,shadowless=culler?.cameraDirShadowLights instanceof Map;
    // The head and upper body hidden from your own eyes are switched on just while this camera picks
    // what it draws (they draw from that list), and off again before anything else does.
    app.scene.on('precull',camera=>{
      if(camera!==own)return;
      if(shadowless)culler.cameraDirShadowLights.delete(own.camera);
      const p=town.player;
      // Only a part switched off itself: one merely under a switched-off parent keeps its own setting.
      for(const e of [p.head,p.upper,p.pack])if(e&&!e.enabled&&e.parent?.enabled){e.enabled=true;e.syncHierarchy();this.hidden.push(e);}
    });
    app.scene.on('postcull',camera=>{
      if(camera!==own)return;
      for(const e of this.hidden)e.enabled=false;
      this.hidden.length=0;
    });
    // Indoors the sun reaches the floor only through the windows, and the mirror has no shadows to
    // say where: it is left out of the mirror's pass altogether, or the reflection glares.
    app.scene.on('prerender',camera=>{
      if(camera!==own)return;
      this.frames++;
      this.sunLevel=sun.intensity;sun.intensity=0;
    });
    app.scene.on('postrender',camera=>{if(camera===own)sun.intensity=this.sunLevel;});
    this.material.setParameter('viewRect',this.rect);
    this.material.setParameter('viewScreen',this.screen);
  }

  /** The mirrors in a room: each glass, its plain material, and its plane (made on first visit). */
  listFor(room){
    if(!this.lists.has(room.id))this.lists.set(room.id,(room.fittings??[]).filter(f=>f.kind==='mirror'&&f.glass).map(f=>{
      const mi=f.glass.render.meshInstances[0],w=f.glass.getWorldTransform();
      const n=w.getZ(new pc.Vec3()).normalize(),p=f.glass.getPosition().clone().add(n.clone().mulScalar(.01));
      return {fitting:f,mi,plain:mi.material,n,p};
    }));
    return this.lists.get(room.id);
  }

  /** Called once a frame, after the player's camera is placed. */
  update(){
    const t=this.town,own=this.camera.camera,room=t.place==='town'?null:t.rooms.get(t.place);
    const pick=room&&RENDER[detail()].mirrorScale?this.pick(room):null;
    if(pick!==this.active){
      if(this.active)this.active.mi.material=this.active.plain;
      if(pick)pick.mi.material=this.material;
      this.active=pick;
    }
    const on=!!pick&&this.aim(pick);
    if(own.enabled!==on)own.enabled=on;
  }

  /** The nearest mirror on screen, within reach, that the eye is in front of. */
  pick(room){
    const eye=this.town.camera.getPosition(),frustum=this.town.camera.camera.frustum;
    let best=null,far=REACH;
    for(const m of this.listFor(room)){
      const d=eye.distance(m.p);
      if(d>=far||TO.sub2(eye,m.p).dot(m.n)<.1||!frustum.containsAabb(m.mi.aabb))continue;
      best=m;far=d;
    }
    return best;
  }

  /** Place the mirror's camera for this frame; false when its glass is off screen after all. */
  aim(m){
    const main=this.town.camera,cam=main.camera,g=this.town.app.graphicsDevice,w=main.getWorldTransform();
    VP.copy(w).invert();VP.mul2(cam.projectionMatrix,VP);
    let x0=1,y0=1,x1=-1,y1=-1;
    const lo=m.mi.aabb.getMin(),hi=m.mi.aabb.getMax();
    for(let i=0;i<8;i++){
      CORNER.set(i&1?hi.x:lo.x,i&2?hi.y:lo.y,i&4?hi.z:lo.z,1);VP.transformVec4(CORNER,CORNER);
      if(CORNER.w<cam.nearClip){x0=y0=-1;x1=y1=1;break;}
      const x=CORNER.x/CORNER.w,y=CORNER.y/CORNER.w;
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
    }
    const px=4/g.width,py=4/g.height;   // a pixel or two of margin
    x0=Math.max(-1,x0-px);x1=Math.min(1,x1+px);y0=Math.max(-1,y0-py);y1=Math.min(1,y1+py);
    if(x1<=x0||y1<=y0)return false;
    const rect=this.rect;rect[0]=(x0+x1)/2;rect[1]=(y0+y1)/2;rect[2]=(x1-x0)/2;rect[3]=(y1-y0)/2;

    // The eye reflected in the glass; the lighting's view direction works from where it stands.
    mirrorMatrix(m.n,m.p,this.flip);
    this.camera.setPosition(this.flip.transformPoint(main.getPosition(),EYE));
    // The glass's plane in the mirrored camera's space, kept on the room's side (Lengyel's oblique near plane).
    M.mul2(this.flip,w);
    const d=M.data,n=m.n,c=this.clip;
    for(let i=0;i<3;i++)c[i]=d[i*4]*n.x+d[i*4+1]*n.y+d[i*4+2]*n.z;
    c[3]=d[12]*n.x+d[13]*n.y+d[14]*n.z-n.dot(m.p);
    this.clipped=c[3]<-.05;

    const own=this.camera.camera;
    own.clearColor=cam.clearColor;own.fog=cam.fog;
    own.rect=CORNER_RECT.set(0,0,rect[2],rect[3]);   // the corner of the texture the glass's part of the screen fills
    this.target(g);
    this.screen[0]=1/g.width;this.screen[1]=1/g.height;
    this.material.setParameter('viewRect',this.rect);
    this.material.setParameter('viewScreen',this.screen);
    return true;
  }

  /** The canvas divided by `mirrorScale` (src/core/quality.js), remade when that changes. */
  target(g){
    const k=RENDER[detail()].mirrorScale,w=Math.max(1,Math.floor(g.width/k)),h=Math.max(1,Math.floor(g.height/k)),old=this.rt;
    if(old?.width===w&&old.height===h)return;
    const texture=new pc.Texture(g,{name:'mirror',width:w,height:h,format:pc.PIXELFORMAT_RGBA8,mipmaps:false,
      minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE});
    this.rt=new pc.RenderTarget({colorBuffer:texture,depth:true});
    this.camera.camera.renderTarget=this.rt;
    this.material.setParameter('viewMap',texture);
    if(old){old.destroyTextureBuffers();old.destroy();}
  }

  /** The player's projection, its near plane on the glass, cropped to the glass (as views.js does). */
  project(m){
    const cam=this.town.camera.camera,d=m.data,c=this.clip;
    m.setPerspective(cam.fov,cam.aspectRatio,cam.nearClip,cam.farClip);
    if(this.clipped){
      const qx=(Math.sign(c[0])+d[8])/d[0],qy=(Math.sign(c[1])+d[9])/d[5],qw=(1+d[10])/d[14];
      const k=2/(c[0]*qx+c[1]*qy-c[2]+c[3]*qw);
      d[2]=c[0]*k;d[6]=c[1]*k;d[10]=c[2]*k+1;d[14]=c[3]*k;
    }
    const [cx,cy,hx,hy]=this.rect;
    for(let col=0;col<4;col++){
      const w=d[col*4+3];
      d[col*4]=(d[col*4]-cx*w)/hx;
      d[col*4+1]=(d[col*4+1]-cy*w)/hy;
    }
  }
}
