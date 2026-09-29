import * as pc from 'playcanvas';
import {detail,RENDER} from '../core/quality.js';

/**
 * The street, seen from inside a shop. A room stands hundreds of metres from the town, so its
 * doorway and front windows would show nothing. Instead a second camera stands in the town where
 * the tourist's eyes would be if the room really were inside its building, and renders the street
 * into a texture; the doorway and front panes show that texture at their own screen position, so
 * the view lines up with the room (a portal).
 *
 * The camera's near plane is tilted onto the building front (an oblique projection), so the
 * building's own walls and door are never drawn, and its frustum is cropped to the openings' part
 * of the screen, so only what can be seen through them is drawn. It renders only while an opening
 * is on screen, at half resolution (a quarter on 低), and never in the town.
 */

const FRONT=.35;    // the view starts this far out from a building's front, past its door leaf, frame and pillars
const TO_ROOM=new pc.Quat().setFromEulerAngles(0,180,0);
const VP=new pc.Mat4(),FRUSTUM=new pc.Frustum(),CORNER=new pc.Vec4(),ROT=new pc.Quat();

// Camera-relative, as town.js's CAMERA_RELATIVE patches every engine material: a room stands up to
// 10 km out, where viewProjection * worldPosition in 32-bit floats rounds each corner differently
// every frame, and the view's edges wobbled against the doorway's frame.
export const VS=`attribute vec3 vertex_position;
uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;
void main(void){
  vec3 posW=(matrix_model*vec4(vertex_position,1.0)).xyz;
  gl_Position=matrix_projection*vec4(mat3(matrix_view)*(posW+matrix_view[3].xyz*mat3(matrix_view)),1.0);
}`;
// The texture holds the cropped part of the screen (`viewRect`: centre and half size in NDC).
const FS=`uniform sampler2D viewMap;
uniform vec4 viewRect;
uniform vec2 viewScreen;
void main(void){
  vec2 ndc=gl_FragCoord.xy*viewScreen*2.0-1.0;
  gl_FragColor=vec4(texture2D(viewMap,((ndc-viewRect.xy)/viewRect.zw)*0.5+0.5).rgb,1.0);
}`;

export class Views {
  constructor(town){
    this.town=town;this.views=new Map();this.frames=0;this.lights=[];
    this.rect=new Float32Array([0,0,1,1]);this.screen=new Float32Array([1,1]);
    this.clip=new Float32Array(4);this.clipped=false;
    const main=town.camera.camera;
    this.camera=new pc.Entity('street-view');
    this.camera.addComponent('camera',{priority:-1,farClip:main.farClip,clearColor:main.clearColor,
      toneMapping:main.toneMapping,gammaCorrection:main.gammaCorrection,enabled:false});
    this.camera.camera.calculateProjection=m=>this.project(m);
    town.app.root.addChild(this.camera);
    this.material=new pc.ShaderMaterial({uniqueName:'street-view',vertexGLSL:VS,fragmentGLSL:FS,
      attributes:{vertex_position:pc.SEMANTIC_POSITION}});
    // ponytail: PlayCanvas 2.22 has no public per-camera shadow switch, and the sun's shadow pass for
    // this camera cost about as many draw calls as the street itself. So it is dropped from the
    // engine's internal list of cameras needing a sun shadow map, and the sun's shadows are faded out
    // while the street draws (they would sample a map made for the player's camera). If a later
    // engine lacks that list, the street simply keeps its shadows. Upgrade: a public option, if one comes.
    const culler=town.app.renderer?.culler,sun=town.sun.light;
    this.shadowless=culler?.cameraDirShadowLights instanceof Map;
    if(this.shadowless)town.app.scene.on('precull',camera=>{if(camera===this.camera.camera)culler.cameraDirShadowLights.delete(camera.camera);});
    // A room's own directional fill would light the street too: it is off while the street renders.
    town.app.scene.on('prerender',camera=>{
      if(camera!==this.camera.camera)return;
      for(const l of this.lights){l.saved=l.intensity;l.intensity=0;}
      if(this.shadowless){this.sunShadow=sun.shadowIntensity;sun.shadowIntensity=0;}
    });
    town.app.scene.on('postrender',camera=>{
      if(camera!==this.camera.camera)return;
      for(const l of this.lights)l.intensity=l.saved;
      if(this.shadowless)sun.shadowIntensity=this.sunShadow;
    });
    this.target(town.app.graphicsDevice);
    this.material.setParameter('viewRect',this.rect);
    this.material.setParameter('viewScreen',this.screen);
  }

  /** Called once a frame, after the player's camera is placed. */
  update(){
    const t=this.town,room=t.place==='town'?null:t.rooms.get(t.place),view=room&&this.viewOf(room);
    const on=!!view&&this.aim(view);
    if(this.camera.camera.enabled!==on)this.camera.camera.enabled=on;
    if(on)this.frames++;
  }

  /** How a room maps onto its building front in the town, made the first time it is entered. */
  viewOf(room){
    if(this.views.has(room.id))return this.views.get(room.id);
    const {data,openings:o}=room,b=this.town.data.buildings.find(b=>b.id===data.building);
    let view=null;
    // A back room or the city's store has no front on a street: its openings stay as they are.
    if(b&&data.door&&o&&!data.interiorOnly&&!data.outdoor&&(o.door||o.panes.length)){
      // The building's front, or the door spot when that is further in: the word hall's door is
      // at the back of its colonnade.
      const face=(b.rotation??0)===180?-1:1,front=b.z+face*b.depth/2,x=data.door.x;
      const z=(face*(data.door.z-front)<0?data.door.z:front)+face*FRONT;
      view={face,boxes:[],
        room:new pc.Vec3(room.offsetX,o.sill,o.face),
        // At the height of the ground in front of the door: the word hall's is up on its terrace. The
        // lowest of a few spots, as the door spot can graze the building's own box or a crate.
        town:new pc.Vec3(x,Math.min(...[0,.3,.6].map(k=>this.town.registry.groundAt('town',x,data.door.z+face*k,2,.05))),z),
        lights:room.root.findComponents('light').filter(l=>l.type==='directional')};
      if(o.door){
        const d=o.door;
        view.boxes.push(new pc.BoundingBox(new pc.Vec3(room.offsetX,d.y,d.z),new pc.Vec3(d.hw,d.hh,d.hd)));
        view.inner=d.z-d.hd;   // an eye past the wall's inner face is in the doorway itself
        // A wide backdrop just outside the doorway (past where you can step), so the view fills
        // the gap from any angle; the front wall hides the rest of it.
        const sky=new pc.Entity('sky');
        sky.addComponent('render',{type:'box',material:this.material,castShadows:false,receiveShadows:false});
        sky.setLocalPosition(0,d.y,o.face+1.1);sky.setLocalScale(24,16,.02);
        room.root.addChild(sky);
      }
      for(const pane of o.panes){
        pane.render.castShadows=false;
        const mi=pane.render.meshInstances[0];mi.material=this.material;
        view.boxes.push(mi.aabb.clone());
      }
    }
    this.views.set(room.id,view);
    return view;
  }

  /** Place the street camera for this frame; false when no opening is on screen. */
  aim(view){
    const main=this.town.camera,cam=main.camera,g=this.town.app.graphicsDevice;
    VP.copy(main.getWorldTransform()).invert();VP.mul2(cam.projectionMatrix,VP);
    FRUSTUM.setFromMat4(VP);
    // The part of the screen the openings cover, in NDC; the whole screen if one reaches behind the eye.
    const e=main.getPosition();
    let x0=1,y0=1,x1=-1,y1=-1,seen=e.z>view.inner;
    if(seen)x0=y0=-1,x1=y1=1;
    else for(const box of view.boxes){
      if(!FRUSTUM.containsAabb(box))continue;
      seen=true;
      const lo=box.getMin(),hi=box.getMax();
      for(let i=0;i<8;i++){
        CORNER.set(i&1?hi.x:lo.x,i&2?hi.y:lo.y,i&4?hi.z:lo.z,1);VP.transformVec4(CORNER,CORNER);
        if(CORNER.w<cam.nearClip){x0=y0=-1;x1=y1=1;break;}
        const x=CORNER.x/CORNER.w,y=CORNER.y/CORNER.w;
        x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      }
    }
    if(!seen)return false;
    const px=4/g.width,py=4/g.height;   // a pixel or two of margin
    x0=Math.max(-1,x0-px);x1=Math.min(1,x1+px);y0=Math.max(-1,y0-py);y1=Math.min(1,y1+py);
    if(x1<=x0||y1<=y0)return false;
    const rect=this.rect;rect[0]=(x0+x1)/2;rect[1]=(y0+y1)/2;rect[2]=(x1-x0)/2;rect[3]=(y1-y0)/2;

    // Mirror the eye's offset from the doorway onto the building front, turned with the building.
    const {face:f,room:a,town:b}=view;
    this.camera.setPosition(b.x+f*(e.x-a.x),b.y+e.y-a.y,b.z+f*(e.z-a.z));
    ROT.copy(main.getRotation());if(f<0)ROT.mul2(TO_ROOM,ROT);
    this.camera.setRotation(ROT);
    // The building front as a clip plane in camera space, facing the street. An eye already out in
    // the doorway needs no clipping, and one right on the plane would crush the depth range.
    const s=f*(this.camera.getPosition().z-b.z),r=this.camera.right,u=this.camera.up,fw=this.camera.forward;
    const c=this.clip;this.clipped=s<-.05;c[0]=f*r.z;c[1]=f*u.z;c[2]=-f*fw.z;c[3]=s;

    const cam2=this.camera.camera;
    cam2.clearColor=cam.clearColor;   // day and night follow the town's sky
    // Should the street keep its shadows (see the constructor), the sun's map is fitted to this field of view.
    cam2.fov=cam.fov;cam2.nearClip=cam.nearClip;cam2.farClip=cam.farClip;
    this.target(g);
    this.material.setParameter('viewRect',this.rect);
    this.screen[0]=1/g.width;this.screen[1]=1/g.height;
    this.material.setParameter('viewScreen',this.screen);
    this.lights=view.lights;
    return true;
  }

  /** Half the canvas size (a quarter on 低, src/core/quality.js), remade when that changes. */
  target(g){
    const k=RENDER[detail()].viewScale,w=Math.max(1,Math.floor(g.width/k)),h=Math.max(1,Math.floor(g.height/k)),old=this.rt;
    if(old?.width===w&&old.height===h)return;
    const texture=new pc.Texture(g,{name:'street-view',width:w,height:h,format:pc.PIXELFORMAT_RGBA8,mipmaps:false,
      minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_CLAMP_TO_EDGE,addressV:pc.ADDRESS_CLAMP_TO_EDGE});
    this.rt=new pc.RenderTarget({colorBuffer:texture,depth:true});
    this.camera.camera.renderTarget=this.rt;
    this.material.setParameter('viewMap',texture);
    if(old){old.destroyTextureBuffers();old.destroy();}
  }

  /** The player's projection, its near plane tilted onto the building front, cropped to the openings.
   *  The engine hands in the same matrix more than once a frame, so it is rebuilt from scratch. */
  project(m){
    const cam=this.town.camera.camera,d=m.data,c=this.clip;
    m.setPerspective(cam.fov,cam.aspectRatio,cam.nearClip,cam.farClip);
    if(this.clipped){
      // Lengyel's oblique near plane: the far corner opposite the plane stays put.
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
