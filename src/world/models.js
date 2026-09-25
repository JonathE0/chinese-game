import * as pc from 'playcanvas';
import {bridgeRails,shoreline,walkwayLayout,walkwayMarks,latticeWindows,latticeWallMarks,verandaLayout,verandaMarks,canalMarks} from '../core/garden.js';
export function createModels(app) {
  const cache=new Map();
  function material(hex) {
    if(cache.has(hex))return cache.get(hex);
    const m=new pc.StandardMaterial();m.diffuse=new pc.Color().fromString(hex);m.useMetalness=true;m.metalness=0;m.gloss=0.1;m.update();cache.set(hex,m);return m;
  }
  /** A piece smaller than this in every direction casts no shadow: window bars, lattice, roof
   *  ribs, railings and ornaments each cost a shadow draw call for a shadow nobody can see. */
  const SHADOW_MIN=1.2;
  function shape(parent,type,xyz,scale,color,rotation=[0,0,0]) {
    const e=new pc.Entity(type);e.addComponent('render',{type,material:material(color),castShadows:Math.max(...scale)>=SHADOW_MIN,receiveShadows:true});e.setLocalPosition(...xyz);e.setLocalScale(...scale);e.setLocalEulerAngles(...rotation);parent.addChild(e);return e;
  }
  const box=(p,xyz,s,c,r)=>shape(p,'box',xyz,s,c,r);
  /** Names an entity as one thing to look at (an objects.json key); the town turns every tagged
   *  entity into a look box from the bounds of its meshes. `group` makes an empty tagged node, at
   *  the parent's origin, to draw a many-piece item (or a cluster of small ones) into. */
  const tag=(e,key)=>{e.lookName=key;return e;};
  function group(parent,key) {const g=new pc.Entity(key);parent.addChild(g);return tag(g,key);}
  /** A strut drawn between two joints of a side profile (x,y at a fixed z) — frames, forks, chains. */
  function tube(parent,[ax,ay],[bx,by],thick,color,z=0) {
    const dx=bx-ax,dy=by-ay;
    return box(parent,[(ax+bx)/2,(ay+by)/2,z],[Math.hypot(dx,dy),thick,thick],color,[0,0,Math.atan2(dy,dx)*180/Math.PI]);
  }
  /** A fresh (uncached) emissive material, so each lamp can be dimmed on its own. */
  function glow(hex) {
    const m=new pc.StandardMaterial(),c=new pc.Color().fromString(hex);
    m.diffuse=c;m.emissive=c;m.emissiveIntensity=.55;m.useMetalness=true;m.metalness=0;m.gloss=.15;m.update();return m;
  }
  const ball=(p,xyz,s,c)=>shape(p,'sphere',xyz,s,c);
  /** A piece of display stock: it sits in its container until someone lifts it out. The slot it
   *  leaves behind is what the shop refills a little later. */
  function pickable(parent,xyz,size,color,kind,type='sphere') {
    const entity=shape(parent,type,xyz,size,color);
    entity.noBatch=true;   // it is switched off when lifted out, so it can never be batched away
    return {entity,filled:true,back:0,kind,color,size,shape:type,local:xyz};
  }
  const cylinder=(p,xyz,s,c,r)=>shape(p,'cylinder',xyz,s,c,r);
  function label(parent,text,pos,width=3,height=.65,bg='#f4e3b9',fg='#425d54') {
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;
    const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,768,160);ctx.strokeStyle=fg;ctx.lineWidth=6;ctx.strokeRect(12,12,744,136);ctx.fillStyle=fg;ctx.font='bold 84px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,84);
    const tex=new pc.Texture(app.graphicsDevice,{width:768,height:160,mipmaps:true});tex.setSource(canvas);
    const m=new pc.StandardMaterial();m.diffuseMap=tex;m.emissiveMap=tex;m.emissive=new pc.Color(.3,.3,.3);m.update();
    const e=box(parent,pos,[width,height,.08],bg);e.render.meshInstances[0].material=m;e.signText=text;return e;
  }
  function person(parent,color,pos,hat=false) {
    const e=new pc.Entity('person');e.noBatch=true;e.setLocalPosition(...pos);parent.addChild(e);
    // The chest, shoulders and arms live under one node so a first-person camera can drop the
    // whole bulk of the body and leave you looking down at your own legs.
    const upper=new pc.Entity('upper');e.addChild(upper);
    const torso=box(upper,[0,1.0,0],[.58,.66,.36],color);
    const collar=cylinder(upper,[0,.81,0],[.58,.3,.42],color);
    // The head is its own entity so a first-person camera can hide it without losing the body;
    // everything on the face hangs off a neck pivot, so turning to look is a rotation of one node.
    const head=new pc.Entity('head');e.addChild(head);
    const neck=new pc.Entity('neck');neck.setLocalPosition(0,1.33,0);head.addChild(neck);
    const face=box(neck,[0,.27,0],[.49,.5,.44],'#e9ba8d');
    box(neck,[0,.50,-.03],[.52,.17,.45],'#3e3930');
    box(neck,[-.255,.34,-.05],[.06,.25,.4],'#3e3930');
    box(neck,[.255,.34,-.05],[.06,.25,.4],'#3e3930');
    const eyes=[-.12,.12].map(x=>ball(neck,[x,.31,.23],[.05,.055,.025],'#333d38'));
    const brows=[-.12,.12].map(x=>box(neck,[x,.39,.225],[.13,.022,.02],'#4a4238'));
    // A mouth in three pieces: level for neutral, corners lifted for a smile. Nothing more.
    const mouth=new pc.Entity('mouth');neck.addChild(mouth);
    box(mouth,[0,.17,.235],[.08,.025,.012],'#b87a62');
    const lips=[-.055,.055].map(x=>box(mouth,[x,.17,.235],[.045,.024,.012],'#b87a62'));
    // Limbs hang from a pivot at the hip and the shoulder, so a swing reads as a stride.
    const legs=[-.17,.17].map(x=>{
      const pivot=new pc.Entity('leg');pivot.setLocalPosition(x,.69,0);e.addChild(pivot);
      pivot.limb=box(pivot,[0,-.29,0],[.23,.58,.26],'#435653');
      pivot.shoe=box(pivot,[0,-.57,.06],[.26,.17,.4],'#eee0c2');
      return pivot;
    });
    const arms=[-.39,.39].map(x=>{
      const pivot=new pc.Entity('arm');pivot.setLocalPosition(x,1.33,0);upper.addChild(pivot);
      pivot.limb=box(pivot,[0,-.295,0],[.18,.59,.22],color);
      ball(pivot,[0,-.63,0],[.19,.2,.2],'#e9ba8d');
      return pivot;
    });
    const hatRoot=new pc.Entity('hat');neck.addChild(hatRoot);cylinder(hatRoot,[0,.58,0],[.86,.08,.75],'#deb975');cylinder(hatRoot,[0,.71,0],[.55,.22,.51],'#deb975');cylinder(hatRoot,[0,.63,0],[.56,.05,.52],'#a7794f');hatRoot.enabled=hat;
    // Every part is under SHADOW_MIN, but a person should still throw a shadow: the body and head
    // are enough, and keep a crowd within the shadow draw-call budget.
    for(const part of [torso,face])part.render.castShadows=true;
    return {entity:e,torso,collar,upper,legs,arms,hat:hatRoot,head,neck,eyes,brows,mouth,lips,
      hatBrim:hatRoot.children.filter(c=>c.render)};
  }
  function tree(parent,x,z,size=1) {
    const root=new pc.Entity('tree');root.setLocalPosition(x,0,z);root.setLocalScale(size,size,size);parent.addChild(root);
    cylinder(root,[0,1,0],[.34,2,.34],'#967658');
    for(const [p,s,c] of [[[0,2.6,0],[2.2,2.4,2.1],'#91a779'],[[-.65,2.2,.25],[1.4,1.7,1.4],'#809a6a'],[[.6,2.8,.15],[1.4,1.8,1.5],'#a5b786']])shape(root,'cone',p,s,c);
    cylinder(root,[0,.15,0],[1.7,.3,1.7],'#c7bb9e');
  }
  /**
   * A shop front comes in three builds. They share a footprint and a doorway — the collision
   * registry and the door prompts depend on that — but nothing else, so a street reads as a
   * street of different businesses rather than one template painted six colours.
   *
   *   tiled      the old town: layered eaves, lattice windows, a painted board
   *   shophouse  plastered two-tone frontage, arched upper windows, a cloth awning
   *   modern     glass and steel shopfront, flat parapet, a lit sign strip
   *
   * A building can also ask for signature `details` from the DETAILS table further down.
   */
  function building(parent,data) {
    const root=new pc.Entity(data.id);root.setLocalPosition(data.x,0,data.z);root.setLocalEulerAngles(0,data.rotation||0,0);parent.addChild(root);
    const w=data.width,d=data.depth,h=data.height,style=data.style??'tiled';
    box(root,[0,h/2,0],[w,h,d],data.color);
    if(style!=='tiled'||data.storeys===2)tag(box(root,[0,.2,0],[w+.2,.4,d+.2],'#c7b798'),'stone');   // tiled fronts have a plinth
    // Extra named parts (a balcony, a chimney) and lit windows are handed back on the entity, in
    // world coordinates, for the town to register and for the daylight to dim.
    const face=(data.rotation??0)===180?-1:1;
    root.marks=[];root.lamps=[];
    root.addMark=(lx,lz,hw,hd,y0,y1,name,solid=false,round=false)=>root.marks.push({x:data.x+face*lx,z:data.z+face*lz,
      ...(round?{radius:hw}:{hw,hd}),y0,y1,name,solid});
    if(style==='modern')modernFront(root,data,w,d,h);
    else if(style==='shophouse')shophouseFront(root,data,w,d,h);
    else if(data.storeys===2)houseFront(root,data,w,d,h);
    else tiledFront(root,data,w,d,h);
    for(const wing of data.wings??[])buildWing(root,data,wing);
    for(const name of data.details??[])DETAILS[name](root,data,w,d,h);
    return root;
  }
  /** Layered tiles with a ridge and turned-up eaves, over any block of a building. `hidden` is a
   *  side (-1 or 1) that butts against a bigger wall, whose eave and ornaments would not show. */
  function tiledRoof(parent,x,z,w,d,h,color,layers=5,hidden=0) {
    // Each piece is its own roof box: one box round the whole roof would fill the air above the
    // eaves and hide a chimney standing on it.
    const piece=(...a)=>tag(box(parent,...a),'roof');
    for(let i=0;i<layers;i++)piece([x,h+.12+i*.22,z],[w+1.3-i*.35,.25,d+1.5-i*(d+1.5)/(layers+1.4)],color);
    piece([x,h+.12+layers*.22-.05,z],[w+.05,.18,.23],color);
    const dark=shade(color,.72),step=(d+1.5)/(layers+1.4),ridge=h+.12+layers*.22-.05;
    for(const side of [-1,1]){
      if(side===hidden)continue;
      piece([x+side*(w/2+.48),h+.28,z],[.22,.35,d+1.6],color,[0,0,side*18]);
      // Upturned eave corners, front and back.
      for(const end of [-1,1])piece([x+side*(w/2+.42),h+.36,z+end*((d+1.5)/2-.15)],[.6,.12,.3],color,[0,0,side*28]);
      // A curled ornament at each end of the ridge.
      piece([x+side*(w/2-.05),ridge+.24,z],[.22,.44,.28],dark);
      piece([x+side*(w/2+.05),ridge+.48,z],[.4,.13,.28],dark,[0,0,side*32]);
    }
    // Tile ribs running down the front slope, over the steps of the layers.
    const low=(d+1.5)/2,high=(d+1.5-(layers-1)*step)/2,y0=h+.25,y1=h+.25+(layers-1)*.22;
    const len=Math.hypot(low-high,y1-y0),tilt=Math.atan2(y1-y0,low-high)*180/Math.PI,ribs=Math.max(2,Math.round(w/2));
    for(let k=0;k<ribs;k++)
      piece([x-w/2+(k+.5)*w/ribs,(y0+y1)/2+.06,z+(low+high)/2],[.12,.1,len],dark,[tilt,0,0]);
  }
  /** A darker (k<1) version of a colour, for trim that follows its base colour. */
  function shade(hex,k) {
    const c=new pc.Color().fromString(hex);
    return new pc.Color(c.r*k,c.g*k,c.b*k).toString(false);
  }
  /** A lattice window: a dark pane in a timber surround, crossed by two glazing bars. */
  function latticeWindow(parent,x,y,z,w=1.3,h=1.3,pane='#637b70') {
    const root=group(parent,'window');
    box(root,[x,y,z-.02],[w+.2,h+.2,.1],'#7d6349');   // the timber surround
    box(root,[x,y,z],[w,h,.12],pane);
    box(root,[x,y,z+.09],[.07,h-.05,.07],'#d9c6a1');
    box(root,[x,y,z+.11],[w,.07,.06],'#d9c6a1');
    return root;
  }
  /** A red silk lantern hanging on a cord, lit after dark. A pair can share one lit material. */
  function redLantern(root,x,y,z,lit=null) {
    const g=group(root,'lantern');
    cylinder(g,[x,y+.42,z],[.03,.5,.03],'#715945');
    const globe=ball(g,[x,y,z],[.42,.48,.42],'#c8453a');
    if(!lit){lit=glow('#d4483a');root.lamps.push(lit);}
    globe.render.meshInstances[0].material=lit;
    for(const off of [-.2,.2])cylinder(g,[x,y+off*1.15,z],[.3,.05,.3],'#e0b86a');
    cylinder(g,[x,y-.4,z],[.05,.26,.05],'#e0b86a');
    return lit;
  }
  /**
   * A two-storey family house: a front door with the name board above the balcony, a balcony
   * across the first floor, lattice windows on both floors and red lanterns by the door.
   */
  function houseFront(root,data,w,d,h) {
    const f=d/2,floor=3.05;
    for(const x of [-w/2+.2,w/2-.2])tag(box(root,[x,h/2,f+.025],[.23,h,.2],'#8e6952'),'pillar');
    box(root,[0,floor,f+.03],[w,.18,.15],'#9c7558');
    // Ground floor: the door and a window either side.
    box(root,[0,1.15,f+.1],[1.15,2.1,.16],'#6c7661');
    for(const x of [-.28,.28])box(root,[x,1.2,f+.22],[.045,1.9,.03],'#cdb486');
    box(root,[0,2.28,f+.12],[1.45,.14,.2],'#8e6952');
    for(const x of [-2.25,2.25])latticeWindow(root,x,1.6,f+.06);
    // First floor: a glazed balcony door between two windows, and the balcony across the front.
    latticeWindow(root,0,4.1,f+.06,1.1,1.85);
    for(const x of [-2.25,2.25])latticeWindow(root,x,4.25,f+.06,1.3,1.3);
    box(root,[0,h-.55,f+.04],[w,.16,.14],'#9c7558');
    for(let x=-w/2+.7;x<w/2-.5;x+=.9)box(root,[x,h-.3,f+.06],[.12,.34,.16],'#8e6952');
    const bw=w-.6,reach=1.1,rail='#9a4f42';
    box(root,[0,floor,f+reach/2],[bw,.16,reach],'#9c7558');
    for(const x of [-bw/2+.3,-1.1,1.1,bw/2-.3])box(root,[x,floor-.3,f+.4],[.14,.45,.7],'#8e6952');
    box(root,[0,floor+.9,f+reach-.05],[bw,.1,.1],rail);
    box(root,[0,floor+.2,f+reach-.05],[bw,.08,.08],rail);
    for(const side of [-1,1]){
      box(root,[side*(bw/2-.05),floor+.9,f+reach/2],[.1,.1,reach],rail);
      box(root,[side*(bw/2-.05),floor+.45,f+reach-.05],[.1,.9,.1],rail);
    }
    box(root,[0,floor+.55,f+reach-.05],[bw-.2,.62,.03],'#b5705f');   // railing infill, one panel
    for(const x of [-2.4,2.4])cylinder(root,[x,floor+.3,f+.45],[.36,.34,.36],'#b0654f');
    for(const x of [-2.4,2.4])ball(root,[x,floor+.62,f+.45],[.5,.44,.5],'#87996b');
    root.addMark(0,f+reach/2,bw/2,reach/2,floor-.1,floor+1,'balcony');
    // The name board hangs over the door, under the balcony, with a red lantern either side.
    box(root,[0,2.63,f+.12],[1.72,.6,.1],'#7d6349');
    label(root,data.sign,[0,2.63,f+.19],1.56,.48,'#a4564a','#f2e2c6');
    root.addMark(0,f+.38,.86,.06,2.33,2.93,'sign');
    let lit=null;
    for(const x of [-1.22,1.22]){lit=redLantern(root,x,floor-.62,f+.38,lit);root.addMark(x,f+.38,.23,.23,floor-.9,floor-.3,'lantern');}
    // Potted plants either side of the step, leaving the way to the door open.
    for(const x of [-1.6,1.6]){
      cylinder(root,[x,.3,f+.5],[.55,.6,.55],'#b0654f');
      cylinder(root,[x,.62,f+.5],[.6,.06,.6],'#9a5646');
      ball(root,[x,1.0,f+.5],[.8,.8,.8],'#809a6a');ball(root,[x+.12,1.25,f+.42],[.5,.5,.5],'#91a779');
      root.addMark(x,f+.5,.32,.32,0,1.35,'plant',true,true);
    }
    tiledRoof(root,0,0,w,d,h,data.roof);
  }
  /**
   * A one-storey wing beside a house, in the building's own coordinates. The kitchen gets a
   * chimney, a lit window onto the stove, strings of garlic and chillies and its name over a side
   * door; the study gets a window onto a bookshelf.
   */
  function buildWing(root,data,wing) {
    const {x,z,width:w,depth:d,height:h}=wing,f=z+d/2,outer=x+Math.sign(x)*w/2;
    box(root,[x,h/2,z],[w,h,d],wing.color??data.color);
    tag(box(root,[x,.2,z],[w+.2,.4,d+.2],'#c7b798'),'stone');
    for(const px of [x-w/2+.15,x+w/2-.15])tag(box(root,[px,h/2,f+.025],[.2,h,.18],'#8e6952'),'pillar');
    box(root,[x,h-.3,f+.03],[w,.14,.12],'#9c7558');
    tiledRoof(root,x,z,w,d,h,wing.roof??data.roof,3,-Math.sign(x));
    if(wing.object==='kitchen'){
      // The side door, with its name board over it.
      const dx=x-Math.sign(x)*.62;
      tag(box(root,[dx,1.05,f+.08],[.9,2.0,.12],'#7a5f45'),'door');
      box(root,[dx+Math.sign(x)*.28,1.05,f+.16],[.06,.06,.05],'#d8c07e');
      if(wing.sign){box(root,[dx,2.47,f+.1],[1.08,.5,.08],'#7d6349');label(root,wing.sign,[dx,2.47,f+.16],.92,.38,'#a4564a','#f2e2c6');}
      root.addMark(dx,f+.3,.45,.16,0,2.1,'door');
      // A window lit from inside: the stove, a pot on the flame and a ladle on the wall.
      const wx=x+Math.sign(x)*.72,wy=1.55,lit=glow('#f2c27a');
      const pane=tag(box(root,[wx,wy,f+.04],[1.0,1.0,.06],'#f2c27a'),'window');pane.render.meshInstances[0].material=lit;root.lamps.push(lit);
      tag(box(root,[wx,wy-.34,f+.08],[.92,.3,.04],'#5d5048'),'stove');
      tag(box(root,[wx-.12,wy-.14,f+.09],[.16,.08,.03],'#e0803c'),'stove');
      tag(cylinder(root,[wx-.12,wy+.04,f+.1],[.4,.26,.04],'#3f4644'),'pot');
      box(root,[wx-.12,wy+.2,f+.1],[.44,.05,.04],'#59605e');
      tag(box(root,[wx,wy,f+.02],[1.2,1.2,.05],'#8e6952'),'window');   // frame, behind the pane
      root.addMark(wx,f+.42,.55,.06,wy-.55,wy+.55,'window');
      // Garlic and dried chillies hang on the outer wall, by the front corner.
      for(const [i,oz] of [[0,f-.45],[1,f-.95]]){
        const ox=outer+Math.sign(x)*.1,string=group(root,i===0?'chilli':'garlic');
        box(string,[ox,2.3,oz],[.02,1.1,.02],'#b6a07a');
        for(let k=0;k<3;k++){
          if(i===0)ball(string,[ox+Math.sign(x)*.05,2.6-k*.3,oz],[.13,.34,.13],'#b8322a');
          else ball(string,[ox+Math.sign(x)*.06,2.6-k*.3,oz],[.2,.22,.2],'#efe8d8');
        }
      }
      // A brick chimney at the back of the roof, and a little steam.
      const cx=x+Math.sign(x)*.55,cz=z-1.2,top=h+2.2;
      box(root,[cx,h+1.0,cz],[.55,2.4,.55],'#9b6a55');
      box(root,[cx,top,cz],[.75,.14,.75],'#7d5446');
      root.addMark(cx,cz,.3,.3,h-.2,top+.1,'chimney',true);
      steam(root,cx,top+.1,cz);
    } else if(wing.object==='study'){
      // A window onto a full bookshelf.
      const wx=x,wy=1.6;
      tag(box(root,[wx,wy,f+.04],[1.3,1.2,.06],'#3f4c47'),'window');
      tag(box(root,[wx,wy,f+.06],[1.16,1.08,.02],'#7a5a40'),'shelf');
      const colours=['#a4564a','#5f7a72','#d8c07e','#6d7d8c','#c98568','#e8dcc4','#7f9a76'];
      for(const [row,sy] of [[0,wy-.36],[1,wy],[2,wy+.36]]){
        tag(box(root,[wx,sy-.14,f+.08],[1.1,.04,.03],'#5d4432'),'shelf');
        // Books in blocks of colour rather than one spine at a time.
        const books=group(root,'book');
        for(let k=0;k<3;k++){const tall=.2+((k+row)%3)*.03;
          box(books,[wx-.36+k*.36,sy-.12+tall/2,f+.085],[.33,tall,.025],colours[(k*2+row*3)%colours.length]);}
      }
      tag(box(root,[wx,wy,f+.02],[1.5,1.4,.05],'#8e6952'),'window');   // frame, behind the pane
      tag(box(root,[wx,wy,f+.1],[.05,1.2,.04],'#d9c6a1'),'window');tag(box(root,[wx,wy,f+.1],[1.3,.05,.04],'#d9c6a1'),'window');
      root.addMark(wx,f+.42,.7,.06,wy-.65,wy+.65,'shelf');
    }
  }
  /** Three soft puffs that rise from a chimney, spread out and fade, then start again. */
  function steam(root,x,y,z) {
    const puffs=[0,1,2].map(i=>{
      const m=new pc.StandardMaterial();m.diffuse=new pc.Color(.95,.94,.92);m.emissive=new pc.Color(.35,.35,.34);
      m.opacity=.5;m.blendType=pc.BLEND_NORMAL;m.depthWrite=false;m.update();
      const e=shape(root,'sphere',[x,y,z],[.3,.3,.3],'#f2f0ea');e.name='steam';e.noBatch=true;e.render.meshInstances[0].material=m;e.render.castShadows=false;
      return {e,m,phase:i/3};
    });
    app.on('update',dt=>{
      if(!root.enabled)return;
      for(const p of puffs){
        p.phase=(p.phase+dt*.16)%1;
        const s=.3+p.phase*.6;
        p.e.setLocalPosition(x+p.phase*.35,y+p.phase*1.7,z-p.phase*.15);p.e.setLocalScale(s,s*.85,s);
        p.m.opacity=.5*(1-p.phase);p.m.update();
      }
    });
  }
  /** Timber posts, lattice glazing, layered tiles on a stone plinth. The oldest buildings in town. */
  function tiledFront(root,data,w,d,h) {
    const f=d/2;
    tag(box(root,[0,.22,0],[w+.5,.45,d+.3],'#a39d8f'),'stone');   // stone plinth
    for(const x of [-w/2+.2,w/2-.2])tag(box(root,[x,h/2,f+.025],[.23,h,.2],'#8e6952'),'pillar');
    for(const y of [1,h-1])tag(box(root,[0,y,f+.03],[w,.16,.15],'#9c7558'),'beam');
    for(const x of [-w*.3,w*.3])latticeWindow(root,x,1.85,f+.06,1.3,1.5);
    box(root,[0,1.15,f+.1],[1.15,2.1,.16],'#6c7661');
    for(const x of [-.28,.28])box(root,[x,1.2,f+.22],[.045,1.9,.03],'#cdb486');
    // The door frame: two posts and a lintel board across the top.
    for(const x of [-.68,.68])tag(box(root,[x,1.2,f+.14],[.16,2.4,.22],'#7d6349'),'door');
    tag(box(root,[0,2.44,f+.16],[1.8,.26,.26],'#7d6349'),'door');
    tiledRoof(root,0,0,w,d,h,data.roof);
    label(root,data.sign,[0,h-.55,f+.22],Math.min(3.5,w-1),.67);
  }
  /** Plaster over a rendered base, arched upper windows, an arcade under a striped awning. */
  function shophouseFront(root,data,w,d,h) {
    const trim=data.trim??'#e6dcc4',f=d/2;
    box(root,[0,h*.62,f+.04],[w+.06,h*.76,.1],trim);           // upper storey plaster
    box(root,[0,1.2,f+.05],[w+.08,.16,.16],'#b09572');         // string course
    box(root,[0,h-.12,f+.05],[w+.1,.22,.22],'#b09572');        // cornice
    // Upper windows, each with a little railing; on a low shophouse it sits clear of the awning.
    const rail=Math.max(h*.66-.55,2.5);
    for(const x of [-w*.28,w*.28]){
      const win=group(root,'window'),railing=group(root,'railing');
      box(win,[x,h*.66,f+.09],[1.1,1.25,.08],'#5f7a72');
      cylinder(win,[x,h*.66+.62,f+.09],[1.1,.08,1.1],'#5f7a72',[90,0,0]);   // arched head
      for(const off of [-.3,.3])box(win,[x+off,h*.66,f+.13],[.07,1.2,.05],trim);
      box(railing,[x,rail-.04,f+.2],[1.45,.08,.34],'#b09572');
      box(railing,[x,rail+.17,f+.34],[1.35,.34,.03],'#6f5a47');
      box(railing,[x,rail+.37,f+.35],[1.45,.06,.07],'#5b4a3a');
    }
    const shopWindow=group(root,'window');
    box(shopWindow,[0,.6,f+.1],[w-1.2,1.2,.1],'#dfe6e2');            // shop window
    for(const x of [-(w-1.2)/2+.06,(w-1.2)/2-.06])box(shopWindow,[x,.6,f+.14],[.1,1.24,.06],'#8e6952');
    box(root,[0,1.15,f+.12],[1.2,2.1,.14],'#7a5f45');          // door
    for(const x of [-.3,.3])box(root,[x,1.2,f+.2],[.05,1.9,.03],'#d9c6a1');
    // A striped awning over an arcade of columns set against the wall (the pavement in front
    // belongs to café chairs and crates), leaving the doorway clear.
    // One awning in the roof colour; the cream stripes are a little thicker and centred on it, so
    // they show above and below.
    const stripes=(n=>n%2?n:n+1)(Math.round((w-.3)/1.1)),sw=(w-.3)/stripes;
    const awning=group(root,'awning');
    box(awning,[0,2.45,f+.62],[w-.3,.12,1.25],data.roof,[-16,0,0]);
    for(let i=1;i<stripes;i+=2)box(awning,[-(w-.3)/2+(i+.5)*sw,2.45,f+.62],[sw,.14,1.26],'#f1e8d4',[-16,0,0]);
    // No column where the hanging sign (x 1.05) comes off the wall.
    const span=w/2-.4,gaps=Math.max(2,Math.round(span));
    for(let i=0;i<=gaps;i++){const x=-span+i*2*span/gaps;if(Math.abs(x)>.75&&Math.abs(x-1.05)>.3)tag(box(root,[x,1.25,f+.2],[.22,2.5,.22],'#b09572'),'pillar');}
    box(root,[0,2.52,f+.2],[w-.5,.18,.22],'#9c7558');
    const roof=group(root,'roof');
    for(let i=0;i<3;i++)box(roof,[0,h+.1+i*.2,0],[w+.5-i*.2,.22,d+.6-i*.3],data.roof);
    const board=label(root,data.sign,[0,h-.62,f+.12],Math.min(3.4,w-1),.6);
    // A hanging sign beside the door, on a bracket from the wall, painted like the name board.
    box(root,[1.05,2.1,f+.45],[.06,.06,.9],'#5b4a3a').signText=data.sign;
    const hanging=box(root,[1.05,1.95,f+.5],[.96,.2,.08],'#f4e3b9',[0,90,0]);
    hanging.render.meshInstances[0].material=board.render.meshInstances[0].material;
    hanging.signText=data.sign;
  }
  /** Framed glass and steel mullions, a canopy over the door and a sign strip lit after dark. */
  function modernFront(root,data,w,d,h) {
    const f=d/2,glass=new pc.StandardMaterial();
    glass.diffuse=new pc.Color().fromString('#b8d2d6');
    glass.emissive=new pc.Color().fromString('#33484c');glass.emissiveIntensity=.3;
    glass.opacity=.55;glass.blendType=pc.BLEND_NORMAL;glass.gloss=.92;
    glass.useMetalness=true;glass.metalness=.35;glass.update();
    const win=group(root,'window');
    const pane=box(win,[0,1.55,f+.06],[w-.5,2.9,.08],'#b8d2d6');
    pane.render.meshInstances[0].material=glass;
    for(let i=-2;i<=2;i++)box(win,[i*(w-.6)/5,1.55,f+.11],[.09,2.95,.06],'#8f9694');   // mullions
    for(const x of [-(w-.4)/2,(w-.4)/2])box(win,[x,1.55,f+.11],[.14,2.95,.12],'#6f7775');   // frame sides
    box(win,[0,2.45,f+.12],[w-.5,.07,.06],'#8f9694');           // transom
    box(root,[0,.08,f+.16],[w-.4,.16,.5],'#9aa3a0');
    box(root,[0,3.06,f+.1],[w+.04,.14,.14],'#8f9694');
    box(root,[0,1.15,f+.14],[1.25,2.2,.06],'#5f6a6c');          // sliding door
    box(root,[0,1.15,f+.17],[.05,2.2,.04],'#c9d3d6');
    // A canopy over the entrance, hung from the wall on two ties, high enough to clear an awning.
    const canopy=group(root,'awning');
    box(canopy,[0,2.97,f+.52],[2.3,.1,1.0],'#8f9694');
    box(canopy,[0,2.97,f+1.02],[2.3,.2,.06],'#c9d3d6');
    for(const x of [-1,1])box(canopy,[x,3.25,f+.5],[.05,.05,1.12],'#6f7775',[26.6,0,0]);
    box(root,[0,h*.72,f+.05],[w+.06,h*.5,.1],data.color);       // upper cladding
    for(let i=0;i<4;i++)box(root,[0,h*.55+i*.42,f+.11],[w-.2,.05,.03],'#9aa3a0');
    // The sign strip is emissive, so it reads at night as well as at noon.
    box(root,[0,h-.5,f+.1],[w-.1,.82,.06],'#3d4749');            // dark backing
    const strip=box(root,[0,h-.5,f+.14],[w-.4,.62,.1],'#f4efe0');
    strip.render.meshInstances[0].material=glow('#f6ead0');
    label(root,data.sign,[0,h-.5,f+.2],Math.min(3.6,w-1.1),.56,'#f7f2e4','#3f5a52');
    const roof=group(root,'roof');
    box(roof,[0,h+.28,0],[w+.5,.5,d+.5],data.roof);               // parapet
    box(roof,[0,h+.56,0],[w+.1,.12,d+.1],'#8f9694');
    for(const x of [-w*.25,w*.25])box(roof,[x,h+.8,-d*.2],[.5,.5,.5],'#9aa3a0');   // roof plant
  }
  /** A shelf in front of the window either side of the door, and what the shop sets out on it. */
  function windowDisplay(root,data,w,d,name,put) {
    const f=d/2,style=data.style??'tiled';
    const x=style==='shophouse'?w/4:w*.3,y=style==='tiled'?1.12:style==='modern'?.8:.75;
    for(const s of [-1,1]){
      const shelf=group(root,name);
      box(shelf,[s*x,y,f+.26],[1.3,.08,.32],'#8e6952');
      put(shelf,s*x,y+.04,f+.26);
      root.addMark(s*x,f+.42,.65,.1,y-.1,y+.5,name);
    }
  }
  /**
   * Signature details, asked for by name in a building's `details` list (world.json). Each draws
   * in the building's own coordinates, with the front face at z = depth/2, and names what the
   * player can point at through addMark. Anything standing out on the pavement is solid.
   */
  const DETAILS={
    // Two stone lions guard the door, each with a ball under one paw.
    'lions'(root,data,w,d) {
      const z=d/2+.5;
      for(const x of [-1.35,1.35]){
        box(root,[x,.25,z],[.62,.5,.62],'#a39d8f');
        box(root,[x,.78,z-.06],[.44,.56,.5],'#bdb7a9');
        box(root,[x,1.22,z+.08],[.46,.42,.4],'#bdb7a9');
        ball(root,[x-Math.sign(x)*.12,.62,z+.24],[.2,.2,.2],'#bdb7a9');
        root.addMark(x,z,.31,.31,0,1.45,'lion',true);
      }
    },
    // A gold frame round the name board (the tiled board: centred at h-.55, .67 high).
    'gold-sign'(root,data,w,d,h) {box(root,[0,h-.55,d/2+.17],[Math.min(3.5,w-1)+.3,.97,.06],'#c9a13b');},
    'postbox'(root,data,w,d) {
      // Near the corner, clear of a counter standing in front of the door.
      const x=-w/2+.4,z=d/2+.55;
      box(root,[x,.08,z],[.3,.16,.3],'#27583a');
      box(root,[x,.62,z],[.5,.92,.42],'#2f6b45');
      box(root,[x,1.12,z],[.58,.12,.5],'#27583a');
      box(root,[x,.88,z+.22],[.3,.04,.02],'#1d2b24');
      root.addMark(x,z,.29,.25,0,1.2,'postbox',true);
    },
    // A green cross on a bracket by the corner, lit after dark.
    'green-cross'(root,data,w,d) {
      const x=w/2-.6,y=3.1,lit=glow('#4fb06a'),cross=group(root,'sign');
      box(cross,[x,y,d/2+.25],[.07,.07,.5],'#5b4a3a');
      for(const s of [[.26,.8,.26],[.8,.26,.26]])box(cross,[x,y,d/2+.5],s,'#4fb06a').render.meshInstances[0].material=lit;
      root.lamps.push(lit);
    },
    'bread-window'(root,data,w,d) {
      windowDisplay(root,data,w,d,'bread',(shelf,x,y,z)=>{
        for(const k of [-.4,0,.4])ball(shelf,[x+k,y+.1,z],[.36,.2,.22],k?'#c98a4a':'#e0b070');
      });
    },
    'book-window'(root,data,w,d) {
      windowDisplay(root,data,w,d,'book',(shelf,x,y,z)=>{
        for(const [k,c] of [[-.38,'#a4564a'],[0,'#5f7a72'],[.38,'#d8c07e']])box(shelf,[x+k,y+.17,z],[.3,.34,.2],c);
      });
    },
    'tea-window'(root,data,w,d) {
      windowDisplay(root,data,w,d,'cup',(shelf,x,y,z)=>{
        for(const [k,c] of [[-.38,'#6f8f6a'],[0,'#b8453a'],[.38,'#e8dcc4']])cylinder(shelf,[x+k,y+.16,z],[.26,.32,.26],c);
      });
    },
    // A chalk menu board, folded open on the pavement.
    'menu-board'(root,data,w,d) {
      const x=-1.5,z=d/2+.5;
      for(const s of [-1,1])box(root,[x,.45,z+s*.12],[.6,.88,.04],'#3b4540',[-s*12,0,0]);
      box(root,[x,.9,z],[.64,.06,.12],'#8e6952');
      root.addMark(x,z,.32,.18,0,1,'menu',true);
    },
    // Pendant lamps on a rail in front of each window.
    'lamp-window'(root,data,w,d) {
      const z=d/2+.3,lit=glow('#f6d98a');root.lamps.push(lit);
      for(const s of [-1,1]){
        const x=s*w*.3;
        box(root,[x,2.7,z],[2.2,.05,.05],'#6f7775');
        for(const k of [-.7,0,.7]){
          const drop=k?.55:.8;
          cylinder(root,[x+k,2.7-drop/2,z],[.02,drop,.02],'#3d4749');
          cylinder(root,[x+k,2.64-drop,z],[.34,.18,.34],'#f6d98a').render.meshInstances[0].material=lit;
        }
        root.addMark(x,z+.12,1.1,.1,1.7,2.75,'lamp');
      }
    },
    'mannequins'(root,data,w,d) {
      const z=d/2+.4;
      for(const [x,c] of [[-1.9,'#b45b52'],[1.9,'#5f7a9a']]){
        cylinder(root,[x,.03,z],[.4,.06,.4],'#6f7775');
        cylinder(root,[x,.4,z],[.05,.7,.05],'#6f7775');
        box(root,[x,1.05,z],[.46,.62,.26],c);
        ball(root,[x,1.52,z],[.24,.28,.24],'#e8dccb');
        root.addMark(x,z,.26,.26,0,1.7,'clothes',true,true);
      }
    },
    // A cabinet with a chair set on top, waiting outside the door.
    'stacked-furniture'(root,data,w,d) {
      const x=-1.75,z=d/2+.6;
      tag(box(root,[x,.35,z],[.9,.7,.6],'#b98d62'),'dresser');
      const chair=group(root,'chair');
      box(chair,[x,.94,z+.04],[.5,.08,.5],'#a97d55');
      box(chair,[x,1.24,z-.18],[.5,.55,.07],'#a97d55');
      root.addMark(x,z,.45,.31,0,1.5,'dresser',true);
    },
    // Three trolleys nested together by the entrance.
    'trolleys'(root,data,w,d) {
      const x=-1.8,z=d/2+.9;
      box(root,[x,.1,z],[1.3,.06,.06],'#6f7775');
      for(const k of [-.36,0,.36]){
        box(root,[x+k,.75,z],[.5,.42,.75],'#aeb7ba');
        box(root,[x+k,1.05,z-.42],[.52,.05,.05],'#c8453a');
      }
      root.addMark(x,z,.63,.42,0,1.1,'trolley',true);
    },
    // A red lantern either side of the door: under the awning, or hung from the eaves.
    'lanterns'(root,data,w,d,h) {
      const shop=data.style==='shophouse',f=d/2;
      const x=shop?1.45:Math.min(3.5,w-1)/2+.4,y=shop?2.0:h-.75,z=shop?f+.95:f+.5;
      let lit=null;
      for(const s of [-1,1]){lit=redLantern(root,s*x,y,z,lit);root.addMark(s*x,z,.23,.23,y-.3,y+.3,'lantern');}
    },
  };
  /** Returns the glowing material so the day/night cycle can dim it. */
  function lantern(parent,x,y,z) {
    const g=group(parent,'lantern');
    cylinder(g,[x,y+.35,z],[.035,.6,.035],'#715945');
    const globe=ball(g,[x,y,z],[.4,.5,.4],'#d48a66');
    const lit=glow('#e8a071');
    globe.render.meshInstances[0].material=lit;
    cylinder(g,[x,y-.31,z],[.045,.25,.045],'#e0b86a');
    return {entity:globe,material:lit};
  }
  /**
   * A carved fretwork panel, w by h metres: a lattice drawn on a canvas inside a solid frame, cut
   * out with alpha test so a whole panel is one flat box. `hole` [x,y,r] (metres from the centre)
   * clears a round opening with a rim. Panels of the same size share one material.
   */
  const frets=new Map();
  function fretwork(w,h,hole,color,rim) {
    const key=[w,h,hole,color,rim].join();
    if(frets.has(key))return frets.get(key);
    const ppm=200,cw=Math.round(w*ppm),ch=Math.round(h*ppm);
    const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
    const c=canvas.getContext('2d');
    // A square grid with a diamond in every cell touching the middle of each side (菱花 lattice).
    const nx=Math.max(1,Math.round(w/.15)),ny=Math.max(1,Math.round(h/.15)),sx=cw/nx,sy=ch/ny;
    c.strokeStyle=color;c.lineWidth=.02*ppm;c.beginPath();
    for(let i=0;i<=nx;i++){c.moveTo(i*sx,0);c.lineTo(i*sx,ch);}
    for(let j=0;j<=ny;j++){c.moveTo(0,j*sy);c.lineTo(cw,j*sy);}
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
      const x=i*sx,y=j*sy;
      c.moveTo(x+sx/2,y);c.lineTo(x+sx,y+sy/2);c.lineTo(x+sx/2,y+sy);c.lineTo(x,y+sy/2);c.closePath();
    }
    c.stroke();
    c.strokeStyle=rim;c.lineWidth=.09*ppm;c.strokeRect(0,0,cw,ch);   // half of it lands on the canvas
    if(hole){
      const [x,y,r]=hole.map(v=>v*ppm);
      c.globalCompositeOperation='destination-out';c.beginPath();c.arc(cw/2+x,ch/2-y,r,0,Math.PI*2);c.fill();
      c.globalCompositeOperation='source-over';c.lineWidth=.03*ppm;c.beginPath();c.arc(cw/2+x,ch/2-y,r+.015*ppm,0,Math.PI*2);c.stroke();
    }
    const tex=new pc.Texture(app.graphicsDevice,{width:cw,height:ch,mipmaps:true,anisotropy:4,
      minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR});
    tex.setSource(canvas);
    const m=new pc.StandardMaterial();
    m.diffuseMap=tex;m.opacityMap=tex;m.opacityMapChannel='a';m.alphaTest=.5;
    m.useMetalness=true;m.metalness=0;m.gloss=.1;m.update();
    frets.set(key,m);return m;
  }
  /** A round rim of n short bars of radius r, standing in the xy plane of a node at xyz turned by yaw. */
  function hoop(parent,xyz,yaw,r,n,color) {
    const e=new pc.Entity('hoop');e.setLocalPosition(...xyz);e.setLocalEulerAngles(0,yaw,0);parent.addChild(e);
    const len=2*r*Math.tan(Math.PI/n)+.012;
    for(let i=0;i<n;i++){const a=(i+.5)/n*Math.PI*2;box(e,[r*Math.cos(a),r*Math.sin(a),0],[len,.05,.06],color,[0,0,a*180/Math.PI+90]);}
  }
  // Home furnishings, built from the same blocky vocabulary as the town itself.
  function furniture(parent,kind,color='#b98d62') {
    const e=new pc.Entity('furniture-'+kind);parent.addChild(e);
    if(kind==='table') {
      box(e,[0,.42,0],[1.5,.09,1.0],color);
      for(const x of [-.62,.62])for(const z of [-.38,.38])box(e,[x,.2,z],[.11,.42,.11],'#8f6a48');
      box(e,[0,.24,0],[1.2,.06,.7],'#a97d55');
    } else if(kind==='bed') {
      // A moon-gate canopy bed (月洞门架子床) in reddish rosewood. Its long side stands against the
      // wall (-z) and you climb in at the front (+z), through a round opening nearly the height of
      // the canopy; the sleeper's head is at the -x end. Each end has a round window in its fretwork,
      // the back is lattice, a low lattice rail runs round the back and ends, and a lattice frieze
      // runs round the canopy. The platform stands on an apron and short horse-hoof legs. Every
      // fretwork panel is one flat box with a cut-out texture (see fretwork()).
      const wood='#8a3f26',fret='#6a2c1b',dark='#5a2616';
      const base=.44,rail=.78,frieze=2.0,top=2.22,span=1.95,deep=1.25;   // heights; panel widths
      const frame=group(e,'bed');
      const panel=(xyz,size,hole)=>{
        const w=size[0]>size[2]?size[0]:size[2],b=box(frame,xyz,size,fret);
        b.render.meshInstances[0].material=fretwork(w,size[1],hole,fret,wood);
      };
      for(const x of [-.98,.98])for(const z of [-.62,.62]){
        box(frame,[x,.15,z],[.09,.22,.09],dark,[z>0?-8:8,0,x>0?8:-8]);                  // a leg curving out
        box(frame,[x*1.03,.025,z*1.04],[.13,.05,.13],dark);                             // to a hoof foot
      }
      box(frame,[0,.29,0],[2.02,.12,1.32],wood);                                       // apron
      box(frame,[0,.235,.665],[1.7,.03,.02],dark);                                     // its carved bead
      box(frame,[0,.4,0],[2.1,.08,1.4],wood);                                          // platform
      for(const x of [-1.01,1.01])for(const z of [-.66,.66])box(frame,[x,(base+top)/2,z],[.07,top-base,.07],wood);   // posts
      box(frame,[0,top+.02,0],[2.12,.05,1.42],wood);                                   // canopy
      for(const z of [-.66,.66])panel([0,(frieze+top)/2,z],[span,top-frieze,.025]);    // frieze
      for(const x of [-1.01,1.01])panel([x,(frieze+top)/2,0],[.025,top-frieze,deep]);
      const gate=(frieze-base)/2-.06,gy=(base+frieze)/2;                               // the moon gate
      panel([0,gy,.66],[span,frieze-base,.025],[0,0,gate]);
      hoop(frame,[0,gy,.66],0,gate+.02,16,wood);
      panel([0,(base+rail)/2,-.66],[span,rail-base,.025]);                             // back rail
      panel([0,(rail+frieze)/2,-.66],[span,frieze-rail,.025]);                         // back
      const round=Math.min(deep,frieze-rail)/2-.08,ry=(rail+frieze)/2;                 // round windows
      for(const x of [-1.01,1.01]){
        panel([x,(base+rail)/2,0],[.025,rail-base,deep]);
        panel([x,ry,0],[.025,frieze-rail,deep],[0,0,round]);
        hoop(frame,[x,ry,0],90,round+.02,12,wood);
      }
      box(frame,[0,.5,0],[1.96,.12,1.26],'#efe4c8');                                   // mattress
      const quilt=group(e,'quilt');
      box(quilt,[.25,.595,0],[1.4,.07,1.22],color);                                    // spread to the foot
      box(quilt,[-.5,.61,0],[.14,.09,1.22],'#ead6a8');                                 // folded back at the head
      for(const z of [-.27,.27])tag(box(e,[-.72,.62,z],[.28,.13,.46],'#f6efdc'),'pillow');   // pillows at the head
      tag(cylinder(e,[-.915,.63,0],[.14,1.1,.14],'#e9dcc0',[90,0,0]),'pillow');         // and a bolster
      const blanket=group(e,'blanket');                                                  // folded at the foot
      box(blanket,[.78,.68,0],[.3,.1,.95],'#d9b36a');
      box(blanket,[.78,.68,0],[.312,.104,.18],'#a8453a');
    } else if(kind==='shelf') {
      box(e,[0,.85,0],[1.4,1.7,.55],color);
      box(e,[0,.85,.06],[1.24,1.54,.5],'#eadcbb');
      for(const y of [.5,1.0,1.5])box(e,[0,y,.06],[1.24,.07,.5],'#b08a60');
      const spines=['#8fa98d','#c47f6b','#d9b072','#7f9ab0','#9db08f'];
      const low=group(e,'book'),high=group(e,'book');
      for(let i=0;i<5;i++)box(low,[-.45+i*.19,.68,.1],[.12,.3,.36],spines[i]);
      for(let i=0;i<4;i++)box(high,[-.38+i*.2,1.18,.1],[.13,.28,.36],spines[(i+2)%5]);
    } else if(kind==='lamp') {
      cylinder(e,[0,.05,0],[.4,.1,.4],'#7d6349');
      cylinder(e,[0,.5,0],[.07,.9,.07],'#8f7355');
      const shade=cylinder(e,[0,1.1,0],[.52,.44,.52],'#f7e7bb');
      e.lampMaterial=glow('#f7e7bb');
      shade.render.meshInstances[0].material=e.lampMaterial;
      cylinder(e,[0,.88,0],[.44,.05,.44],'#c79a5f');
    } else if(kind==='plant') {
      cylinder(e,[0,.17,0],[.44,.34,.44],'#c58b6e');
      cylinder(e,[0,.35,0],[.5,.06,.5],'#d99f7d');
      cylinder(e,[0,.62,0],[.06,.5,.06],'#7d9269');
      for(const [pos,scale] of [[[-.2,.72,.06],[.5,.3,.42]],[[.22,.86,-.05],[.46,.28,.4]],[[0,1.02,.1],[.42,.3,.38]]])ball(e,pos,scale,'#8fab74');
    } else if(kind==='rug') {
      box(e,[0,.012,0],[2.2,.024,1.6],color);
      box(e,[0,.02,0],[1.7,.024,1.15],'#eec6ad');
      box(e,[0,.026,0],[1.0,.024,.62],'#c98a76');
    } else if(kind==='ceilinglamp') {
      cylinder(e,[0,2.55,0],[.06,.7,.06],'#7d6349');
      const shade=shape(e,'cone',[0,2.02,0],[.95,.5,.95],'#f2e0b4',[180,0,0]);
      e.lampMaterial=glow('#f7e7bb');
      shade.render.meshInstances[0].material=e.lampMaterial;
      cylinder(e,[0,1.82,0],[.34,.06,.34],'#c79a5f');
    } else if(kind==='desklamp') {
      cylinder(e,[0,.03,0],[.34,.06,.34],'#6f6a58');
      box(e,[0,.3,0],[.05,.55,.05],'#8f7355',[0,0,-12]);
      box(e,[.16,.58,0],[.34,.05,.05],'#8f7355',[0,0,-38]);
      const head=shape(e,'cone',[.3,.62,0],[.34,.28,.34],'#f2e0b4',[150,0,0]);
      e.lampMaterial=glow('#f7e7bb');
      head.render.meshInstances[0].material=e.lampMaterial;
    } else if(kind==='dresser') {
      box(e,[0,.55,0],[1.5,1.1,.6],color);
      box(e,[0,1.13,0],[1.58,.08,.66],'#a97d55');
      for(let i=0;i<3;i++){
        box(e,[0,.25+i*.34,.31],[1.34,.28,.04],'#e0c69c');
        for(const x of [-.34,.34])ball(e,[x,.25+i*.34,.35],[.11,.09,.09],'#8a7350');
      }
      for(const x of [-.66,.66])for(const z of [-.24,.24])box(e,[x,.05,z],[.12,.1,.12],'#7d6349');
    } else if(kind==='nightstand') {
      box(e,[0,.3,0],[.62,.6,.5],color);
      box(e,[0,.62,0],[.68,.06,.56],'#a97d55');
      box(e,[0,.36,.26],[.5,.22,.04],'#e0c69c');
      ball(e,[0,.36,.3],[.1,.08,.08],'#8a7350');
      for(const x of [-.24,.24])for(const z of [-.18,.18])box(e,[x,.05,z],[.08,.1,.08],'#7d6349');
    } else if(kind==='desk') {
      box(e,[0,.73,0],[1.7,.08,.78],color);
      box(e,[-.6,.5,0],[.42,.38,.66],'#a97d55');
      box(e,[-.6,.5,.34],[.34,.24,.04],'#e0c69c');
      for(const x of [-.78,.78])for(const z of [-.32,.32])box(e,[x,.36,z],[.08,.72,.08],'#8a6c49');
      const book=group(e,'book'),pens=group(e,'pen');
      box(book,[0,.86,-.3],[.9,.02,.6],'#f2ead6');            // an open book
      box(book,[0,.88,-.3],[.02,.03,.6],'#c9a97a');
      cylinder(pens,[.62,.94,-.26],[.14,.34,.14],'#9db08f');  // a pen pot
      for(const [dx,c] of [[-.03,'#c47f6b'],[.03,'#7f9ab0']])cylinder(pens,[.62+dx,1.14,-.26],[.03,.3,.03],c);
    } else if(kind==='teaset') {
      box(e,[0,.03,0],[.62,.06,.42],'#8d6b4d');
      box(e,[0,.07,0],[.56,.03,.36],'#c9a97a');
      const pot=group(e,'teapot'),cups=group(e,'cup');
      cylinder(pot,[-.14,.16,0],[.26,.2,.26],color??'#9db08f');      // the pot
      cylinder(pot,[-.14,.27,0],[.16,.05,.16],'#7f9a86');
      box(pot,[-.02,.18,0],[.12,.04,.04],'#7f9a86');
      cylinder(pot,[-.29,.19,0],[.05,.09,.05],'#7f9a86',[0,0,90]);
      for(const [x,z] of [[.14,-.1],[.14,.1],[.24,0]])cylinder(cups,[x,.12,z],[.13,.09,.13],'#efe7d2');
    } else if(kind==='chair') {
      box(e,[0,.44,0],[.52,.08,.52],color);
      box(e,[0,.75,-.22],[.52,.54,.07],color);
      for(const x of [-.2,.2])for(const z of [-.2,.2])box(e,[x,.21,z],[.07,.44,.07],'#8a6c49');
    } else if(kind==='wardrobe') {
      box(e,[0,1.0,0],[1.3,2.0,.62],color);
      box(e,[0,2.05,0],[1.4,.12,.7],'#a97d55');
      for(const x of [-.32,.32])box(e,[x,1.0,.33],[.6,1.86,.04],'#e0c69c');
      for(const x of [-.06,.06])ball(e,[x,1.0,.37],[.09,.16,.08],'#8a7350');
    } else if(kind==='certificate') {
      // Hangs on a wall: the origin is the wall face and the frame stands a finger's width off it,
      // facing +z. `color` is the seal.
      box(e,[0,1.55,.025],[.72,.54,.03],'#6f5236');
      box(e,[0,1.55,.043],[.62,.44,.008],'#f6ecd2');
      box(e,[0,1.7,.048],[.36,.05,.004],'#b08b60');
      for(let i=0;i<3;i++)box(e,[-.06,1.6-i*.07,.048],[.4,.025,.004],'#c2b79c');
      cylinder(e,[.2,1.42,.05],[.1,.01,.1],color,[90,0,0]);
    } else {box(e,[0,.3,0],[.8,.6,.8],color);return e;}
    // Every drawn kind is also an objects.json key, so the whole piece is one look box
    // (full height, and for a ceiling lamp up where it hangs).
    return tag(e,kind);
  }
  // Street furniture. Each kind returns {entity, half:[hw,hd], top} so the world can give it
  // a hitbox and a Chinese name without repeating the numbers.
  function streetProp(parent,kind,tint) {
    const e=new pc.Entity('prop-'+kind);parent.addChild(e);
    if(kind==='bench') {
      box(e,[0,.44,0],[2.0,.14,.62],tint??'#a8875f');
      box(e,[0,.82,-.26],[2.0,.5,.11],tint??'#b8975f',[12,0,0]);
      for(const x of [-.78,.78])box(e,[x,.22,0],[.16,.44,.56],'#6c7f6b');
      return {entity:e,half:[1.05,.42],top:.52};
    }
    if(kind==='bin') {
      cylinder(e,[0,.42,0],[.52,.84,.52],'#7f8a72');
      cylinder(e,[0,.87,0],[.58,.08,.58],'#5f6c58');
      return {entity:e,half:[.3,.3],top:.9};
    }
    if(kind==='streetlight') {
      cylinder(e,[0,.12,0],[.42,.24,.42],'#6f6a58');
      cylinder(e,[0,2.3,0],[.16,4.4,.16],'#7d7563');
      box(e,[0,4.5,.42],[.16,.16,1.0],'#7d7563');
      const head=tag(box(e,[0,4.36,.86],[.5,.34,.5],'#f2e2b4'),'lamp');
      const lit=glow('#f7e9c2');
      head.render.meshInstances[0].material=lit;
      return {entity:e,half:[.24,.24],top:4.6,material:lit};
    }
    if(kind==='bicycle') {
      // Drawn in side profile: the bike runs along x, the wheels stand in the xy plane, and every
      // frame member is a tube between two named joints so the triangles actually meet.
      const frame=tint??'#7f9689',steel='#5d635f';
      const F=[-.62,.36],R=[.62,.36];                    // hubs
      const BB=[.16,.28],ST=[.30,.90];                   // bottom bracket, seat-tube top
      const HB=[-.44,.58],HT=[-.53,.93];                 // head tube, bottom and top
      for(const [x] of [F,R]){
        cylinder(e,[x,.36,0],[.74,.07,.74],'#33383a',[90,0,0]);          // tyre
        cylinder(e,[x,.36,0],[.58,.075,.58],'#c9c6ba',[90,0,0]);         // rim
        for(let i=0;i<7;i++)box(e,[x,.36,0],[.024,.55,.024],'#b6b3a6',[0,0,i*180/7]);
        cylinder(e,[x,.36,0],[.13,.1,.13],'#6b6f6c',[90,0,0]);           // hub
      }
      tube(e,HT,ST,.055,frame);                                          // top tube
      tube(e,HB,BB,.06,frame);                                           // down tube
      tube(e,BB,ST,.055,frame);                                          // seat tube
      tube(e,HB,HT,.07,frame);                                           // head tube
      for(const z of [-.05,.05]){
        tube(e,HB,F,.04,steel,z);                                        // fork legs
        tube(e,BB,R,.04,frame,z);                                        // chain stays
        tube(e,ST,R,.04,frame,z);                                        // seat stays
      }
      tube(e,HT,[-.60,1.02],.05,steel);                                  // stem
      box(e,[-.60,1.03,0],[.05,.05,.54],'#3f4442');                      // handlebar
      for(const z of [-.25,.25])box(e,[-.60,1.03,z],[.07,.07,.11],'#2f3331');
      box(e,[.32,.98,0],[.36,.07,.15],'#43403a',[0,0,-5]);               // saddle
      box(e,[.30,.94,0],[.05,.09,.05],steel);
      cylinder(e,[.16,.28,.06],[.24,.045,.24],'#4c5450',[90,0,0]);       // chainring
      cylinder(e,[.62,.36,.06],[.15,.04,.15],'#4c5450',[90,0,0]);        // sprocket
      for(const z of [.09,-.09])box(e,[.16,.28,z],[.05,.32,.05],'#3f4442',[0,0,z>0?18:-18]);
      for(const [px,pz] of [[.10,.15],[.22,-.15]])box(e,[px,.16,pz],[.15,.04,.08],'#2f3331');
      tube(e,[.16,.24],[.62,.32],.035,'#43403a',.06);                    // chain, lower run
      const basket=group(e,'basket');
      box(basket,[-.62,.80,0],[.3,.26,.28],'#a98a66');                   // front basket
      box(basket,[-.62,.92,0],[.32,.03,.3],'#8d7154');
      box(e,[-.62,.62,0],[.38,.05,.13],'#6b6f6c',[0,0,6]);               // front mudguard
      box(e,[.62,.62,0],[.4,.05,.13],'#6b6f6c',[0,0,-6]);
      return {entity:e,half:[.72,.22],top:1.05};
    }
    if(kind==='planter') {
      box(e,[0,.3,0],[1.5,.6,1.0],tint??'#c2ad8b');
      box(e,[0,.64,0],[1.36,.14,.88],'#87996b');
      const flowers=group(e,'flower');
      for(let i=0;i<4;i++)ball(flowers,[-.45+i*.3,.86,0],[.3,.28,.32],i%2?'#e5ba77':'#d38e84');
      return {entity:e,half:[.78,.53],top:.9};
    }
    if(kind==='crate') {
      box(e,[0,.28,0],[.9,.56,.7],tint??'#b8935f');
      box(e,[0,.58,0],[.94,.06,.74],'#9c7a4d');
      return {entity:e,half:[.47,.37],top:.62};
    }
    if(kind==='fruitstand') {
      box(e,[0,.4,0],[1.9,.8,1.0],tint??'#b88b63');
      box(e,[0,.85,0],[2.1,.12,1.15],'#e6cf9e');
      const colors=['#d8735f','#e2a955','#8fae6a','#c9707f','#e0c05e'];
      const stock=[];
      for(let i=0;i<5;i++)stock.push(pickable(e,[-.72+i*.36,1.0,-.18],[.28,.26,.28],colors[i],'fruit'));
      for(let i=0;i<4;i++)stock.push(pickable(e,[-.54+i*.36,1.0,.2],[.26,.24,.26],colors[(i+2)%5],'fruit'));
      return {entity:e,half:[1.05,.6],top:1.05,stock};
    }
    if(kind==='cafetable') {
      cylinder(e,[0,.36,0],[.12,.72,.12],'#6f6a58');
      cylinder(e,[0,.05,0],[.5,.1,.5],'#6f6a58');
      cylinder(e,[0,.74,0],[1.0,.07,1.0],tint??'#d8c49a');
      tag(cylinder(e,[0,.8,0],[.26,.12,.26],'#c9dce0'),'cup');
      return {entity:e,half:[.5,.5],top:.82};
    }
    if(kind==='chair') {
      box(e,[0,.42,0],[.5,.08,.5],tint??'#c0a274');
      box(e,[0,.68,-.21],[.5,.44,.07],tint??'#c0a274');
      for(const x of [-.19,.19])for(const z of [-.19,.19])box(e,[x,.2,z],[.07,.42,.07],'#6f6a58');
      return {entity:e,half:[.28,.28],top:.5};
    }
    if(kind==='parasol') {
      cylinder(e,[0,1.1,0],[.09,2.2,.09],'#7d7563');
      tag(shape(e,'cone',[0,2.35,0],[3.0,.7,3.0],tint??'#c98d76'),'umbrella');
      cylinder(e,[0,.06,0],[.7,.12,.7],'#6f6a58');
      return {entity:e,half:[.4,.4],top:2.7};
    }
    if(kind==='bollard') {
      cylinder(e,[0,.36,0],[.2,.72,.2],'#8a8271');
      ball(e,[0,.74,0],[.22,.18,.22],'#9d947f');
      return {entity:e,half:[.14,.14],top:.8};
    }
    if(kind==='awning') {
      box(e,[0,2.6,.55],[3.6,.14,1.4],tint??'#b8765f',[-14,0,0]);
      for(const x of [-1.6,1.6])cylinder(e,[x,1.35,1.1],[.09,2.7,.09],'#7d7563');
      return {entity:e,half:[1.85,1.2],top:2.9,soft:true};
    }
    // A night-market handcart: the stall and the vehicle are the same object, so a vendor can
    // simply push their shop through the streets and park it.
    if(kind==='foodcart') {
      const wood=tint??'#a9764c';
      box(e,[0,.62,0],[1.9,.62,.95],wood);
      box(e,[0,.96,0],[2.05,.1,1.06],'#c9a97a');
      box(e,[0,.3,0],[1.7,.3,.8],'#8a6242');
      for(const z of [-.42,.42]){
        cylinder(e,[-.62,.26,z],[.5,.09,.5],'#3a3d3a',[90,0,0]);
        cylinder(e,[-.62,.26,z],[.3,.1,.3],'#b9b3a0',[90,0,0]);
      }
      box(e,[1.02,.5,0],[.34,.07,.07],wood,[0,0,26]);            // push handles
      box(e,[1.02,.5,0],[.07,.07,.7],'#7d5c3d');
      // A griddle at one end, a pot of syrup at the other.
      box(e,[-.5,1.04,0],[.72,.09,.66],'#4a4f52');
      const skewers=group(e,'skewer');
      for(let i=0;i<4;i++)box(skewers,[-.68+i*.12,1.11,(i%2?.14:-.14)],[.06,.05,.44],'#b5713f',[0,0,0]);
      const pot=group(e,'pot');
      cylinder(pot,[.55,1.14,0],[.46,.28,.46],'#8f9694');
      cylinder(pot,[.55,1.28,0],[.48,.04,.48],'#c9c6ba');
      // Skewers of candied hawthorn stood upright in a straw bundle.
      const hawthorn=group(e,'hawthorn');
      cylinder(hawthorn,[.05,1.2,-.28],[.3,.4,.3],'#c9a97a');
      for(let i=0;i<7;i++){
        const x=-.06+((i%3)-1)*.09,z=-.28+(Math.floor(i/3)-.5)*.1;
        box(hawthorn,[x,1.5,z],[.03,.62,.03],'#c9b083');
        for(let b=0;b<3;b++)ball(hawthorn,[x,1.62+b*.13,z],[.14,.14,.14],'#c9463f');
      }
      for(const x of [-.9,.9])cylinder(e,[x,1.72,0],[.07,1.5,.07],'#7d6349');
      const awning=group(e,'awning');
      const canopy=box(awning,[0,2.5,0],[2.3,.12,1.3],tint??'#b8765f');
      canopy.setLocalEulerAngles(0,0,0);
      box(awning,[0,2.62,0],[2.4,.14,.5],'#9c5f4c');
      const lit=glow('#f6d79a'),bulbs=group(e,'lantern-string');
      for(let i=0;i<5;i++){
        const bulb=ball(bulbs,[-.86+i*.43,2.3,.62],[.16,.18,.16],'#f6d79a');
        bulb.render.meshInstances[0].material=lit;
      }
      box(bulbs,[0,2.34,.62],[1.9,.02,.02],'#7d6349');
      return {entity:e,half:[1.15,.65],top:2.6,material:lit};
    }
    if(kind==='sign') {
      cylinder(e,[0,1.1,0],[.14,2.2,.14],'#7d7563');
      box(e,[0,2.1,0],[1.5,.9,.12],tint??'#e6d3a4');
      return {entity:e,half:[.75,.16],top:2.6};
    }
    box(e,[0,.4,0],[.8,.8,.8],tint??'#b0a98f');
    return {entity:e,half:[.4,.4],top:.8};
  }
  // Patches of ground: a raised timber terrace, a gravel path, grass, and a still pond.
  function groundPatch(parent,def) {
    const e=new pc.Entity('ground-'+def.kind);e.setLocalPosition(def.x,0,def.z);parent.addChild(e);
    const {w,d}=def,marks=[];
    if(def.kind==='patio'){
      box(e,[0,.09,0],[w,.18,d],'#b98f63');
      for(let x=-w/2+.55;x<w/2-.2;x+=1.1)box(e,[x,.19,0],[.9,.03,d-.3],'#c99f70');
      for(const side of [-1,1])box(e,[0,.24,side*(d/2-.12)],[w,.1,.24],'#9d7550');
      marks.push({x:def.x,z:def.z,hw:w/2,hd:d/2,y0:0,y1:.2,name:'patio',solid:false});
      return {entity:e,marks};
    }
    if(def.kind==='gravel'){
      box(e,[0,.03,0],[w,.06,d],'#cfc6ae');
      for(let i=0;i<Math.round(w*d*.9);i++){
        const x=(Math.random()-.5)*(w-.5),z=(Math.random()-.5)*(d-.5);
        ball(e,[x,.06,z],[.14+Math.random()*.14,.07,.14+Math.random()*.14],i%3?'#b8ad93':'#c6bda3');
      }
      marks.push({x:def.x,z:def.z,hw:w/2,hd:d/2,y0:0,y1:.07,name:'path',solid:false});
      return {entity:e,marks};
    }
    if(def.kind==='grass'){
      box(e,[0,.02,0],[w,.05,d],'#93ab7c');
      const tufts=group(e,'grass');
      for(let i=0;i<Math.round(w*d*.35);i++){
        const x=(Math.random()-.5)*(w-.8),z=(Math.random()-.5)*(d-.8);
        shape(tufts,'cone',[x,.2,z],[.3,.42,.3],i%4?'#87a273':'#9db98a');
        if(i%7===0)tag(ball(e,[x+.2,.16,z+.15],[.18,.18,.18],['#d38e84','#e5ba77','#c9a0c4'][i%3]),'flower');
      }
      marks.push({x:def.x,z:def.z,hw:w/2,hd:d/2,y0:0,y1:.06,name:'grass',solid:false});
      return {entity:e,marks};
    }
    // A pond: sunken water, a stone rim, lilies, a rockery and a couple of fish.
    box(e,[0,-.08,0],[w-.6,.3,d-.6],'#5c7f80');
    const water=tag(box(e,[0,.06,0],[w-.7,.06,d-.7],'#6f9ea0'),'water');
    const surface=new pc.StandardMaterial();
    surface.diffuse=new pc.Color().fromString('#79aaa8');
    surface.emissive=new pc.Color().fromString('#3f6668');
    surface.emissiveIntensity=.35;surface.gloss=.85;surface.useMetalness=true;surface.metalness=.15;
    surface.opacity=.88;surface.blendType=pc.BLEND_NORMAL;surface.update();
    water.render.meshInstances[0].material=surface;
    // Each rim stone is tagged on its own: one box round the ring would swallow the water inside it.
    for(let i=0;i<Math.round((w+d)*1.4);i++){
      const angle=i/Math.round((w+d)*1.4)*Math.PI*2;
      const x=Math.cos(angle)*(w/2-.2),z=Math.sin(angle)*(d/2-.2);
      tag(ball(e,[x,.13,z],[.5+Math.random()*.3,.34,.46],i%2?'#b0a78e':'#c0b79c'),'stone');
    }
    for(const [lx,lz] of [[-w*.22,d*.16],[w*.18,-d*.2],[w*.3,d*.22],[-w*.3,-d*.12]]){
      const lotus=group(e,'lotus');
      cylinder(lotus,[lx,.11,lz],[.85,.04,.85],'#7f9e6a');
      if((lx+lz)>0)ball(lotus,[lx+.15,.2,lz+.1],[.28,.34,.28],'#dba0b4');
    }
    for(const [rx,rz] of [[-w*.36,-d*.3],[w*.38,d*.3]]){
      const rock=group(e,'rock');
      ball(rock,[rx,.24,rz],[1.1,.9,.9],'#9d968a');ball(rock,[rx+.4,.16,rz+.3],[.7,.5,.6],'#aaa397');
    }
    for(const [fx,fz,c] of [[w*.08,d*.05,'#d98a5f'],[-w*.14,-d*.08,'#e0b06a']]){
      const fish=tag(ball(e,[fx,.1,fz],[.42,.14,.2],c),'fish');fish.setLocalEulerAngles(0,25,0);
    }
    marks.push({x:def.x,z:def.z,hw:w/2,hd:d/2,y0:0,y1:.2,name:'pond',solid:false});
    return {entity:e,marks};
  }
  // Shop fittings. Each returns {entity, half, top, name} so the room can give it a hitbox
  // and a Chinese label, the same way street furniture works outdoors.
  function fitting(parent,kind,tint,text,h=3) {
    const e=new pc.Entity('fitting-'+kind);parent.addChild(e);
    const jar=['#d8735f','#e2a955','#8fae6a','#c9707f','#e0c05e','#7f9ab0'];
    if(kind==='kitchen') {
      box(e,[0,.46,0],[5,.92,1.05],'#739487');
      box(e,[0,.96,0],[5.12,.12,1.15],'#f0e7d5');
      for(const x of [-1.9,-.95,0,.95,1.9]){
        const door=group(e,'cupboard');
        box(door,[x,.5,.535],[.85,.73,.035],'#84a293');
        box(door,[x,.74,.57],[.25,.04,.055],'#ceb283');
      }
      tag(box(e,[1.55,1.035,0],[1.1,.025,.76],'#6f8e96'),'sink');
      const tap=group(e,'tap');
      cylinder(tap,[1.55,1.2,-.36],[.07,.4,.07],'#a1b1ae');
      box(tap,[1.55,1.4,-.22],[.07,.07,.34],'#a1b1ae');
      const hob=group(e,'stove');
      box(hob,[-.8,1.035,0],[1.4,.035,.86],'#3c4747');
      for(const x of [-1.18,-.43])cylinder(hob,[x,1.07,0],[.45,.03,.45],'#8b9c9d');
      const pot=group(e,'pot');
      cylinder(pot,[-.8,1.23,0],[.57,.3,.57],'#c17658');
      cylinder(pot,[-.8,1.4,0],[.62,.055,.62],'#e6d4ac');
      tag(box(e,[-.8,2.35,-.25],[1.7,.2,.85],'#c0cbc3'),'rangehood');
      for(const x of [-1.9,1.65])tag(box(e,[x,2.12,-.38],[1,.7,.35],'#e2d6bd'),'cupboard');
      label(e,'厨房',[0,1.8,-.5],1.1,.3,'#f7f0dc','#4a7364');
      return {entity:e,half:[2.56,.58],top:2.45,name:'stove'};
    }
    if(kind==='hardwarebay') {
      for(const x of [-1.8,1.8])box(e,[x,1.25,0],[.12,2.5,1.05],'#54776e');
      for(const y of [.18,1.15,2.15])box(e,[0,y,0],[3.7,.13,1.15],'#82918c');
      const wood=group(e,'wood'),stone=group(e,'stone');
      for(let i=0;i<7;i++)box(wood,[-1.45+i*.47,.63,.05],[.32,.72,.75],i%2?'#be9569':'#d2ad7e');
      for(let i=0;i<5;i++)for(let j=0;j<2;j++)box(stone,[-1.38+i*.65,1.34+j*.23,.06],[.59,.2,.65],'#bb7359');
      label(e,text??'五金建材',[0,2.55,.05],3.5,.5,'#e7d7ac','#36594f');
      return {entity:e,half:[1.9,.62],top:2.85,name:'hardware-rack'};
    }
    // Open-fronted shelving: a back panel and two sides, so what is on the shelves shows.
    if(kind==='shelfunit') {
      box(e,[0,1.0,-.22],[2.2,2.0,.06],tint??'#b39468');
      for(const x of [-1.07,1.07])box(e,[x,1.0,0],[.06,2.0,.5],tint??'#b39468');
      for(let i=0;i<4;i++){
        box(e,[0,.36+i*.5,0],[2.1,.07,.46],'#d5bb92');
        const jars=group(e,'jar');
        for(let j=0;j<5;j++)box(jars,[-.8+j*.4,.52+i*.5,.02],[.28,.26,.34],jar[(i*3+j)%6]);
      }
      return {entity:e,half:[1.1,.28],top:2.1,name:'goods-shelf'};   // a shop's shelf is 货架, not 书架
    }
    if(kind==='producerack') {
      box(e,[0,.34,0],[2.0,.68,.9],tint??'#a9855c');
      const stock=[];
      for(let row=0;row<2;row++){
        box(e,[0,.72+row*.34,-.12+row*.12],[1.94,.09,.82],'#c2a077',[row?-14:-8,0,0]);
        for(let i=0;i<6;i++)stock.push(pickable(e,[-.75+i*.3,.86+row*.34,-.1+row*.1],[.26,.24,.26],jar[(i+row*2)%6],'fruit'));
      }
      return {entity:e,half:[1.0,.5],top:1.3,name:'fruit',stock};
    }
    if(kind==='fridge') {
      tag(box(e,[0,1.05,0],[1.6,2.1,.7],'#cdd6d4'),'fridge');
      box(e,[0,1.1,.37],[1.4,1.8,.06],'#a8c6cc');
      box(e,[0,2.14,0],[1.7,.1,.78],'#9db0ad');
      for(let i=0;i<3;i++)box(e,[0,.6+i*.55,.3],[1.3,.06,.5],'#e2ebe8');
      const milk=group(e,'milk');
      for(let i=0;i<4;i++)box(milk,[-.5+i*.34,.78,.28],[.22,.3,.24],i%2?'#e6e2d4':'#dfe8ea');
      return {entity:e,half:[.8,.38],top:2.2,name:'fridge'};
    }
    if(kind==='coffeebar') {
      box(e,[0,.52,0],[2.6,1.04,.8],tint??'#8d6f52');
      box(e,[0,1.08,0],[2.8,.1,.94],'#c9a97a');
      const machine=group(e,'coffee-machine'),cups=group(e,'cup');
      box(machine,[-.7,1.34,-.1],[.6,.42,.4],'#9aa3a0');     // espresso machine
      cylinder(machine,[-.7,1.14,.16],[.16,.1,.16],'#6f7a77');
      for(let i=0;i<4;i++)cylinder(cups,[.1+i*.24,1.2,.1],[.16,.14,.16],'#efe7d2');
      tag(box(e,[.95,1.28,-.1],[.4,.3,.3],'#c98d76'),'cake');   // cake dome
      return {entity:e,half:[1.35,.44],top:1.5,name:'counter'};
    }
    if(kind==='cakecase') {
      box(e,[0,.44,0],[1.5,.88,.66],tint??'#a9855c');
      box(e,[0,1.18,0],[1.5,.6,.66],'#cfe0dd');
      for(let i=0;i<3;i++)box(e,[-.44+i*.44,1.02,0],[.3,.2,.36],['#e0b9a0','#d9a267','#c9707f'][i]);
      box(e,[0,1.52,0],[1.56,.08,.72],'#b08a60');
      return {entity:e,half:[.75,.35],top:1.6,name:'cake'};
    }
    // A bakery case is glass on three sides, so what is inside is the point.
    if(kind==='pastrycase') {
      box(e,[0,.45,0],[2.2,.9,.8],tint??'#b08a60');
      box(e,[0,.93,0],[2.3,.08,.88],'#e0cba4');
      const glass=new pc.StandardMaterial();
      glass.diffuse=new pc.Color().fromString('#dceaea');glass.opacity=.34;
      glass.blendType=pc.BLEND_NORMAL;glass.gloss=.9;glass.useMetalness=true;glass.metalness=.1;glass.update();
      const hood=box(e,[0,1.3,0],[2.24,.66,.82],'#dceaea');
      hood.render.meshInstances[0].material=glass;
      for(const x of [-1.1,1.1])box(e,[x,1.3,0],[.06,.7,.86],'#b08a60');
      const stock=[];
      // Three trays: egg tarts, red bean buns, a glazed strawberry donut on top.
      const tarts=group(e,'eggtart'),buns=group(e,'bread'),donuts=group(e,'donut');
      for(let i=0;i<4;i++)stock.push(pickable(tarts,[-.78+i*.52,1.06,-.2],[.3,.14,.3],'#e8c169','eggtart','cylinder'));
      for(let i=0;i<4;i++)stock.push(pickable(buns,[-.78+i*.52,1.08,.18],[.3,.26,.3],'#e2c9a0','bun'));
      for(let i=0;i<3;i++)stock.push(pickable(donuts,[-.5+i*.5,1.44,-.02],[.28,.16,.28],'#e88fa6','donut','cylinder'));
      box(e,[0,1.02,-.36],[2.1,.03,.16],'#c9b083');
      return {entity:e,half:[1.15,.42],top:1.7,name:'cake',stock};
    }
    if(kind==='breadshelf') {
      box(e,[0,1.05,-.22],[2.2,2.1,.06],tint??'#a9855c');
      for(const x of [-1.07,1.07])box(e,[x,1.05,0],[.06,2.1,.5],tint??'#a9855c');
      for(let row=0;row<4;row++){
        box(e,[0,.42+row*.5,.02],[2.06,.07,.46],'#cdae82');
        for(let i=0;i<5;i++){
          const loaf=box(e,[-.8+i*.4,.58+row*.5,.04],[.32,.24,.34],row%2?'#d9a468':'#e5b87f');
          loaf.setLocalEulerAngles(0,(i*17)%23-10,0);
        }
      }
      box(e,[0,2.16,0],[2.32,.12,.6],'#8d6b4d');
      return {entity:e,half:[1.1,.28],top:2.2,name:'bread'};
    }
    if(kind==='ovenbank') {
      box(e,[0,.9,0],[1.8,1.8,.8],tint??'#8f9694');
      for(let i=0;i<3;i++){
        box(e,[0,.42+i*.6,.41],[1.5,.44,.05],'#3a4245');
        box(e,[0,.42+i*.6,.44],[1.34,.3,.03],'#c98d5f');
        box(e,[0,.66+i*.6,.44],[1.4,.06,.06],'#c9c6ba');
      }
      box(e,[0,1.86,0],[1.9,.14,.9],'#7f8a86');
      cylinder(e,[.66,1.98,0],[.24,.1,.24],'#b9b3a0');
      return {entity:e,half:[.9,.42],top:1.95,name:'oven'};
    }
    if(kind==='clothesrail') {
      for(const x of [-.9,.9])cylinder(e,[x,.9,0],[.08,1.8,.08],'#8f9694');
      cylinder(e,[0,1.72,0],[.06,1.9,.06],'#8f9694',[0,0,90]);
      for(let i=0;i<7;i++)box(e,[-.75+i*.25,1.2,0],[.14,.86,.4],['#8fa9b8','#c4896f','#9d92b5','#b0a07a'][i%4]);
      return {entity:e,half:[1.0,.28],top:1.8,name:'clothes'};
    }
    if(kind==='displaytable') {
      box(e,[0,.42,0],[1.6,.84,1.0],tint??'#c2a077');
      box(e,[0,.88,0],[1.7,.08,1.1],'#dcc49c');
      const goods=group(e,'goods');
      for(let i=0;i<3;i++)box(goods,[-.45+i*.45,1.0,0],[.34,.16,.5],['#e6dcc4','#c9c1a8','#dcd2b8'][i]);
      box(goods,[.5,1.06,-.2],[.2,.28,.16],'#9db08f');
      return {entity:e,half:[.85,.55],top:1.1,name:'table'};
    }
    if(kind==='lampdisplay') {
      box(e,[0,.4,0],[1.8,.8,.8],tint??'#a89a86');
      box(e,[0,.84,0],[1.9,.09,.9],'#c8bda6');
      const lit=glow('#f7e7bb');
      for(let i=0;i<3;i++){
        cylinder(e,[-.55+i*.55,1.0,0],[.08,.24,.08],'#8f7355');
        const shade=shape(e,'cone',[-.55+i*.55,1.28,0],[.44,.36,.44],'#f2e0b4',[180,0,0]);
        shade.render.meshInstances[0].material=lit;
      }
      return {entity:e,half:[.9,.42],top:1.5,name:'lamp',material:lit};
    }
    if(kind==='menuboard') {
      for(const x of [-.7,.7])cylinder(e,[x,1.0,0],[.08,2.0,.08],'#7d6349');
      box(e,[0,1.5,0],[1.7,1.1,.08],'#5f7160');
      for(let i=0;i<4;i++)box(e,[-.3,1.85-i*.24,.06],[.9,.05,.03],'#e8e2cd');
      return {entity:e,half:[.85,.16],top:2.1,name:'menu'};
    }
    if(kind==='diningtable') {
      cylinder(e,[0,.36,0],[.16,.72,.16],'#7d6349');
      cylinder(e,[0,.05,0],[.62,.1,.62],'#6f6a58');
      cylinder(e,[0,.76,0],[1.3,.08,1.3],tint??'#c2a077');
      tag(box(e,[0,.83,-.3],[.34,.06,.24],'#efe7d2'),'plate');
      tag(cylinder(e,[.3,.86,.2],[.16,.14,.16],'#e8e2cd'),'cup');
      return {entity:e,half:[.68,.68],top:.86,name:'table'};
    }
    // The same round table, laid with a tea set.
    if(kind==='teatable') {
      cylinder(e,[0,.36,0],[.16,.72,.16],'#7d6349');
      cylinder(e,[0,.05,0],[.62,.1,.62],'#6f6a58');
      cylinder(e,[0,.76,0],[1.3,.08,1.3],tint??'#c2a077');
      furniture(e,'teaset').setLocalPosition(0,.8,0);
      return {entity:e,half:[.68,.68],top:1.08,name:'table'};
    }
    if(kind==='tablet') {
      cylinder(e,[0,.04,0],[.3,.08,.3],'#6f6a58');
      box(e,[0,.34,0],[.05,.5,.05],'#8f9694');
      const screen=box(e,[0,.66,.03],[.46,.34,.03],'#2f3a3d',[-16,0,0]);
      const lit=glow('#8fc0c4');
      screen.render.meshInstances[0].material=lit;
      box(e,[0,.66,-.01],[.52,.4,.04],'#4a5457',[-16,0,0]);
      return {entity:e,half:[.24,.24],top:.9,name:'menu',material:lit};
    }
    // A chair you can actually sit on. `seat` is where the sitter ends up, in the fitting's own space.
    if(kind==='diningchair') {
      box(e,[0,.45,0],[.5,.08,.5],tint??'#b98b62');
      box(e,[0,.78,-.21],[.5,.58,.08],tint??'#b98b62');
      box(e,[0,.86,-.17],[.4,.1,.05],'#8d6b4d');
      for(const x of [-.19,.19])for(const z of [-.19,.19])box(e,[x,.22,z],[.07,.45,.07],'#8a6c49');
      return {entity:e,half:[.28,.28],top:.5,name:'chair',seat:.49};
    }
    if(kind==='stool') {
      cylinder(e,[0,.44,0],[.44,.08,.44],tint??'#c0a274');
      for(const [x,z] of [[-.15,-.15],[.15,-.15],[-.15,.15],[.15,.15]])box(e,[x,.21,z],[.06,.44,.06],'#7d6349');
      cylinder(e,[0,.24,0],[.42,.05,.42],'#8a7350');
      return {entity:e,half:[.24,.24],top:.48,name:'stool',seat:.47};
    }
    if(kind==='sofa') {
      box(e,[0,.32,0],[2.0,.52,.85],tint??'#8fa094');
      box(e,[0,.62,0],[1.86,.16,.72],'#a8b8a8');
      box(e,[0,.76,-.36],[2.0,.72,.18],tint??'#8fa094');
      for(const x of [-.94,.94])box(e,[x,.62,0],[.14,.5,.85],'#7f9186');
      for(const x of [-.5,.5])tag(box(e,[x,.78,-.24],[.42,.4,.14],'#c6cfc0',[-14,0,0]),'cushion');
      return {entity:e,half:[1.0,.45],top:.7,name:'sofa',seat:.68};
    }
    // A wall poster. `note` picks the printed heading; the room gives it an action to open.
    if(kind==='poster') {
      box(e,[0,1.55,0],[1.5,1.1,.05],'#8d6b4d');
      const face=box(e,[0,1.55,.04],[1.36,.97,.03],'#f6ecd2');
      for(let i=0;i<5;i++)box(e,[-.3,1.36-i*.16,.06],[.62,.045,.02],'#c2b79c');
      for(const [x,y] of [[.42,1.72],[.42,1.44],[.42,1.16]])box(e,[x,y,.06],[.34,.24,.02],['#a8c0ae','#e0c69c','#c9a0a0'][Math.round(y*3)%3]);
      box(e,[0,1.94,.06],[.9,.12,.02],'#7f9a86');
      return {entity:e,half:[.75,.08],top:2.1,name:'poster',face};
    }
    if(kind==='bookcase') {
      box(e,[0,1.25,0],[2.0,2.5,.42],tint??'#9c7a54');
      box(e,[0,1.25,.05],[1.84,2.34,.36],'#e6d8b8');
      const spines=['#8fa98d','#c47f6b','#d9b072','#7f9ab0','#9db08f','#b58fa4'];
      for(let row=0;row<5;row++){
        box(e,[0,.34+row*.5,.06],[1.84,.07,.36],'#b08a60');
        const books=group(e,'book');
        for(let i=0;i<9;i++)box(books,[-.8+i*.2,.53+row*.5,.1],[.13,.31,.28],spines[(row*4+i)%6]);
      }
      box(e,[0,2.54,0],[2.12,.1,.5],'#8d6b4d');
      return {entity:e,half:[1.0,.24],top:2.6,name:'shelf'};
    }
    if(kind==='readingdesk') {
      box(e,[0,.74,0],[1.7,.08,.9],tint??'#b08b60');
      for(const x of [-.76,.76])for(const z of [-.36,.36])box(e,[x,.37,z],[.09,.74,.09],'#8a6c49');
      box(e,[0,.5,0],[1.5,.05,.7],'#a97d55');
      const book=group(e,'book');
      box(book,[-.4,.79,.05],[.62,.03,.44],'#f4ecd8');
      box(book,[-.4,.81,.05],[.03,.04,.44],'#c9a97a');
      tag(cylinder(e,[.5,.86,-.2],[.15,.2,.15],'#9db08f'),'pen');
      tag(box(e,[.62,.8,.2],[.34,.06,.24],'#d9c9a8'),'notebook');
      return {entity:e,half:[.85,.45],top:.82,name:'desk'};
    }
    if(kind==='scroll') {
      box(e,[0,1.8,0],[.7,1.5,.03],'#f2e8d0');
      for(const y of [1.06,2.54])cylinder(e,[0,y,0],[.05,.86,.05],'#8d6b4d',[0,0,90]);
      const ink=group(e,'calligraphy');
      for(let i=0;i<4;i++)box(ink,[0,2.24-i*.3,.03],[.22,.2,.02],'#5f7160');
      box(ink,[0,1.2,.03],[.2,.2,.02],'#a4564a');
      return {entity:e,half:[.35,.04],top:2.6,name:'paper'};
    }
    if(kind==='plantpot') {
      cylinder(e,[0,.24,0],[.56,.48,.56],tint??'#c58b6e');
      cylinder(e,[0,.48,0],[.62,.07,.62],'#d99f7d');
      cylinder(e,[0,.86,0],[.08,.76,.08],'#7d9269');
      for(const [p,s] of [[[-.28,1.02,.08],[.62,.4,.5]],[[.3,1.2,-.06],[.56,.36,.48]],[[0,1.42,.12],[.5,.36,.44]],[[.06,1.26,.2],[.42,.3,.36]]])
        ball(e,p,s,'#8fab74');
      return {entity:e,half:[.32,.32],radius:.32,top:1.6,name:'plant'};
    }
    if(kind==='checkout') {
      box(e,[0,.5,0],[2.2,1.0,.8],tint??'#c8c2ae');
      box(e,[0,1.04,0],[2.36,.09,.94],'#e2ded0');
      const till=group(e,'till');
      box(till,[-.7,1.2,-.05],[.42,.24,.34],'#5f6a6c');
      box(till,[-.7,1.35,-.05],[.34,.1,.28],'#8fc0c4',[-22,0,0]);
      cylinder(e,[.66,1.14,0],[.5,.12,.5],'#b9b3a0');       // belt roller
      box(e,[.66,1.1,0],[.9,.05,.6],'#5f6a6c');
      return {entity:e,half:[1.2,.44],top:1.4,name:'counter'};
    }
    if(kind==='basketstack') {
      for(let i=0;i<5;i++)box(e,[0,.14+i*.16,0],[.62,.18,.46],i%2?'#c9584f':'#d97a5f');
      return {entity:e,half:[.32,.24],top:.95,name:'basket'};
    }
    if(kind==='mannequin') {
      cylinder(e,[0,.05,0],[.56,.1,.56],'#8a8271');
      cylinder(e,[0,.5,0],[.08,.9,.08],'#a89a86');
      box(e,[0,1.28,0],[.52,.72,.3],tint??'#8fa9b8');
      cylinder(e,[0,.94,0],[.5,.3,.3],tint??'#8fa9b8');
      for(const x of [-.33,.33])box(e,[x,1.24,0],[.14,.6,.18],tint??'#8fa9b8');
      ball(e,[0,1.78,0],[.28,.36,.28],'#d9cfba');
      return {entity:e,half:[.3,.22],radius:.3,top:1.95,name:'clothes'};
    }
    if(kind==='bankcounter') {
      box(e,[0,.55,0],[3.0,1.1,.75],tint??'#8d7a5f');
      box(e,[0,1.14,0],[3.2,.1,.9],'#c9b58c');
      for(const x of [-1.0,0,1.0]){
        tag(box(e,[x,1.7,-.06],[.9,1.0,.04],'#cfe0dd'),'window');   // screens between the windows
        box(e,[x,1.24,.12],[.6,.1,.3],'#e8e2cd');
      }
      box(e,[0,2.24,0],[3.2,.12,.9],'#8d7a5f');
      for(const x of [-1.55,1.55])box(e,[x,1.7,0],[.12,1.1,.8],'#7f6d55');
      // `text` is a list: one small sign over each window, left to right as the customer sees them.
      [].concat(text??[]).slice(0,3).forEach((t,i)=>label(e,t,[i-1,2.06,.02],.86,.19,'#f4ead2','#36594f'));
      return {entity:e,half:[1.6,.4],top:2.3,name:'counter',signed:!!text};
    }
    if(kind==='atm') {
      box(e,[0,.9,0],[1.0,1.8,.55],tint??'#7f8a86');
      box(e,[0,1.34,.29],[.72,.5,.04],'#2f3a3d',[-12,0,0]);
      const lit=glow('#8fc0c4');
      const screen=box(e,[0,1.34,.32],[.62,.4,.03],'#8fc0c4',[-12,0,0]);
      screen.render.meshInstances[0].material=lit;
      for(let i=0;i<3;i++)for(let j=0;j<4;j++)box(e,[-.2+j*.13,1.02-i*.11,.3],[.1,.08,.03],'#d9d3c2');
      box(e,[0,.68,.3],[.5,.05,.03],'#c9a97a');
      box(e,[0,1.86,0],[1.06,.12,.62],'#5f6a6c');
      return {entity:e,half:[.5,.3],top:1.95,name:'atm',material:lit};
    }
    if(kind==='bedshow') {
      box(e,[0,.09,0],[2.6,.18,1.9],tint??'#c9b89a');
      box(e,[0,.44,0],[2.1,.34,1.4],'#a2764f');
      box(e,[0,.66,.06],[2.0,.14,1.28],'#efe3c4');
      tag(box(e,[0,.7,-.42],[2.0,.2,.46],'#fdf6e2'),'pillow');
      tag(box(e,[0,.72,.34],[1.98,.12,.62],'#a8bfa5'),'quilt');
      box(e,[-1.02,.82,0],[.12,.75,1.4],'#8f6a48');
      return {entity:e,half:[1.3,.95],top:.85,name:'bed'};
    }
    if(kind==='cratewall') {
      const tints=['#b8935f','#a9855c','#c2a077','#9c7a4d'];
      for(let i=0;i<7;i++){
        const col=i%3,row=Math.floor(i/3);
        box(e,[-.7+col*.7,.3+row*.62,0],[.66,.58,.62],tints[i%4]);
        box(e,[-.7+col*.7,.6+row*.62,0],[.7,.05,.66],'#8d6b4d');
      }
      box(e,[.7,.24,.1],[.5,.46,.4],'#c9a0a0');
      return {entity:e,half:[1.1,.34],top:1.3,name:'box'};
    }
    if(kind==='fishtank') {
      box(e,[0,.42,0],[1.8,.84,.7],tint??'#8d6b4d');
      const water=box(e,[0,1.24,0],[1.7,.8,.62],'#79aaa8');
      const glass=new pc.StandardMaterial();
      glass.diffuse=new pc.Color().fromString('#79aaa8');glass.emissive=new pc.Color().fromString('#3f6668');
      glass.emissiveIntensity=.4;glass.opacity=.62;glass.blendType=pc.BLEND_NORMAL;glass.gloss=.9;glass.update();
      water.render.meshInstances[0].material=glass;tag(water,'water');
      const fish=group(e,'fish'),weed=group(e,'plant');
      for(const [x,z,c] of [[-.4,.1,'#d98a5f'],[.3,-.08,'#e0b06a'],[.05,.14,'#c9707f']])ball(fish,[x,1.2,z],[.26,.11,.14],c);
      for(const x of [-.6,.2,.6])cylinder(weed,[x,1.0,-.1],[.09,.42,.09],'#7f9e6a');
      box(e,[0,1.68,0],[1.86,.1,.72],'#5f6a6c');
      return {entity:e,half:[.9,.36],top:1.75,name:'fish'};
    }
    if(kind==='cupshelf') {
      box(e,[0,1.3,0],[1.8,.06,.34],tint??'#a97d55');
      box(e,[0,.9,0],[1.8,.06,.34],tint??'#a97d55');
      for(const x of [-.85,.85])box(e,[x,1.1,0],[.08,.5,.32],'#8a6c49');
      const cups=group(e,'cup'),bowls=group(e,'bowl');
      for(let i=0;i<5;i++)cylinder(cups,[-.6+i*.3,1.4,0],[.2,.16,.2],['#efe7d2','#c9dce0','#e0c69c'][i%3]);
      for(let i=0;i<4;i++)cylinder(bowls,[-.45+i*.3,1.0,0],[.22,.14,.22],'#f2e8d2');
      return {entity:e,half:[.9,.18],top:1.5,name:'cup'};
    }
    // The word hall's rooms. A red lacquered column runs floor to ceiling (`h`, the room height).
    if(kind==='column') {
      cylinder(e,[0,.12,0],[.62,.24,.62],'#b9ad96');
      cylinder(e,[0,h/2,0],[.5,h,.5],'#a8392e');
      cylinder(e,[0,h-.35,0],[.56,.16,.56],'#d4b067');
      return {entity:e,half:[.31,.31],radius:.31,top:h,name:'pillar'};
    }
    // A study carrel: a desk between screens, a desk lamp, and a chair tucked in at the front.
    if(kind==='carrel') {
      box(e,[0,.74,-.42],[1.36,.07,.72],'#b08b60');
      for(const x of [-.71,.71])box(e,[x,.65,-.42],[.06,1.3,.76],'#8f7a5c');
      box(e,[0,.65,-.78],[1.48,1.3,.05],'#9c8766');
      tag(box(e,[-.2,.79,-.36],[.52,.02,.36],'#f4ecd8'),'paper');
      const lamp=furniture(e,'lamp');lamp.setLocalPosition(.42,.78,-.58);lamp.setLocalScale(.5,.5,.5);
      const chair=group(e,'chair');
      box(chair,[0,.45,.42],[.46,.07,.46],'#b98b62');
      box(chair,[0,.76,.64],[.46,.56,.06],'#b98b62');
      for(const x of [-.19,.19])for(const z of [.23,.61])box(chair,[x,.22,z],[.07,.45,.07],'#8a6c49');
      return {entity:e,half:[.8,.8],top:1.3,name:'desk',material:lamp.lampMaterial};
    }
    // A listening booth: padded screens, a shelf with headphones on a stand, and a stool.
    if(kind==='booth') {
      for(const x of [-.72,.72])box(e,[x,1.05,-.05],[.06,2.1,1.1],'#8fa39a');
      box(e,[0,1.05,-.57],[1.5,2.1,.06],'#7f948a');
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)box(e,[-.45+j*.45,.6+i*.6,-.53],[.38,.5,.03],'#9fb3a9');
      box(e,[0,.76,-.32],[1.36,.06,.46],'#b08b60');
      tag(box(e,[-.3,.96,-.5],[.46,.32,.03],'#2e3a36'),'monitor');
      cylinder(e,[.3,.81,-.34],[.14,.04,.14],'#4a4f4c');
      cylinder(e,[.3,.94,-.34],[.03,.24,.03],'#6b716d');
      box(e,[.3,1.12,-.34],[.3,.04,.06],'#3d4441');
      for(const x of [-.15,.15])box(e,[.3+x,1.0,-.34],[.07,.18,.16],'#2f3533');
      const stool=group(e,'stool');
      cylinder(stool,[0,.44,.25],[.4,.06,.4],'#c0a274');
      cylinder(stool,[0,.22,.25],[.06,.44,.06],'#7d6349');
      return {entity:e,half:[.75,.6],top:2.1,name:'headphones'};
    }
    if(kind==='floorlamp') {
      const lamp=furniture(e,'lamp');
      return {entity:e,half:[.26,.26],radius:.26,top:1.35,name:'lamp',material:lamp.lampMaterial};
    }
    // The courtyard garden, from the park's own pieces. The pond's hitbox stands higher than a
    // step so nobody walks across the water; the path is low enough to walk on.
    if(kind==='pond') {
      groundPatch(e,{kind:'pond',x:0,z:0,w:2.8,d:2.0});
      return {entity:e,half:[1.4,1.0],top:.45,name:'pond'};
    }
    if(kind==='path') {
      groundPatch(e,{kind:'gravel',x:0,z:0,w:1.0,d:3.0});
      return {entity:e,half:[.5,1.5],top:.04,name:'path'};
    }
    if(kind==='pine') {
      tree(e,0,0,.8);
      return {entity:e,half:[.68,.68],radius:.68,top:4.2,name:'pine'};
    }
    if(kind==='rock') {
      ball(e,[0,.4,0],[1.0,.8,.8],'#9d968a');ball(e,[.3,.3,.2],[.6,.5,.5],'#aaa397');
      return {entity:e,half:[.5,.4],top:.8,name:'rock'};
    }
    // The metro platform: a waist-high ticket machine with a lit screen, and the platform edge,
    // a dark track bed behind a painted safety line. The edge is solid to waist height, so you
    // wait behind the line; its strips lie flat on the floor and need no name.
    if(kind==='ticketmachine') {
      box(e,[0,.55,0],[.8,1.1,.55],tint??'#6d7880');
      box(e,[0,1.12,.02],[.72,.08,.5],'#4a5358',[-18,0,0]);
      const lit=glow('#8fc0c4');
      const screen=box(e,[0,1.17,.04],[.5,.02,.34],'#8fc0c4',[-18,0,0]);
      screen.render.meshInstances[0].material=lit;
      box(e,[0,.95,.28],[.8,.06,.02],'#4f7fae');
      box(e,[.22,.8,.28],[.14,.05,.03],'#c9a97a');
      return {entity:e,half:[.4,.3],top:1.2,name:'ticket-machine',material:lit};
    }
    if(kind==='platformedge') {
      box(e,[0,.005,-.1],[6.6,.01,.7],'#2a2f33');
      for(const z of [-.32,.12])box(e,[0,.02,z],[6.6,.02,.05],'#8f979d');
      box(e,[0,.012,.38],[6.6,.012,.1],'#e6c34a');
      return {entity:e,half:[3.3,.45],top:.9};
    }
    if(kind==='bench') {
      streetProp(e,'bench',tint);
      return {entity:e,half:[1.05,.42],top:.52,name:'bench',seat:.5};
    }
    // Wall pieces hang like the certificate: the origin is the wall face and the piece faces +z.
    // Their hitbox is a thin slab on the wall, lifted off the floor by `y0`, so the wall below
    // still reads as wall and nothing on the floor underneath collides with it.
    if(kind==='wallclock') {
      const y=Math.min(2.6,h-.8);
      cylinder(e,[0,y,.04],[.62,.06,.62],'#6f5236',[90,0,0]);
      cylinder(e,[0,y,.075],[.52,.02,.52],'#f6ecd2',[90,0,0]);
      box(e,[0,y+.1,.09],[.03,.2,.01],'#3b2e25');
      box(e,[.07,y,.09],[.15,.03,.01],'#3b2e25');
      return {entity:e,half:[.31,.04],y0:y-.31,top:y+.31,name:'wallclock'};
    }
    if(kind==='noticeboard') {
      box(e,[0,1.6,.03],[1.4,1.0,.05],'#8d6b4d');
      box(e,[0,1.6,.06],[1.28,.88,.02],'#c9a77a');
      for(const [x,y,c,r] of [[-.36,1.78,'#f6ecd2',-4],[.2,1.8,'#e0c69c',3],[-.3,1.38,'#cfe0dd',2],[.34,1.4,'#f6ecd2',-6]])
        box(e,[x,y,.075],[.42,.32,.01],c,[0,0,r]);
      return {entity:e,half:[.7,.04],y0:1.1,top:2.1,name:'noticeboard'};
    }
    // A sign on its own: `text` on the wall, or on a stand on the floor.
    if(kind==='wallsign') {
      const y=Math.min(2.5,h-.7);
      label(e,text,[0,y,.05],1.8,.44,'#f4ead2','#36594f');
      return {entity:e,half:[.9,.04],y0:y-.22,top:y+.22,signed:true};
    }
    if(kind==='floorsign') {
      const stand=group(e,'sign');
      cylinder(stand,[0,.03,0],[.5,.06,.5],'#6f6a58');
      box(stand,[0,.45,0],[.05,.8,.05],'#8f9694');
      box(stand,[0,1.0,0],[1.3,.36,.06],tint??'#36594f');
      label(e,text,[0,1.0,0],1.24,.28,'#f4ead2','#36594f');
      return {entity:e,half:[.65,.25],top:1.18,signed:true};
    }
    // Posts and a belt, for a queue at a counter.
    if(kind==='queuerail') {
      for(const x of [-1,0,1]){
        cylinder(e,[x,.03,0],[.3,.06,.3],'#6f6a58');
        cylinder(e,[x,.48,0],[.06,.9,.06],'#a1b1ae');
      }
      box(e,[0,.86,0],[2,.06,.02],tint??'#36594f');
      return {entity:e,half:[1.05,.15],top:.95,name:'railing'};
    }
    // A pegboard of hand tools behind a low cabinet of boxed goods, with its own sign (`text`).
    if(kind==='toolwall') {
      box(e,[0,1.55,-.17],[3.0,1.3,.05],tint??'#c9b58c');
      box(e,[0,.45,0],[3.0,.9,.4],'#82918c');
      const goods=group(e,'goods');
      for(let i=0;i<6;i++){
        const x=-1.2+i*.48;
        box(goods,[x,1.95,-.12],[.05,.42,.04],'#8d6b4d');
        box(goods,[x,2.14,-.12],[.22,.08,.05],'#7f8a86');
        box(goods,[x,1.3,-.12],[.06,.4,.03],'#9aa3a0');
      }
      for(let i=0;i<5;i++)box(goods,[-1.1+i*.55,.99,0],[.4,.18,.3],jar[i]);
      if(text)label(e,text,[0,2.48,-.15],1.8,.44,'#f4ead2','#36594f');
      return {entity:e,half:[1.5,.22],top:2.7,name:'goods',signed:!!text};
    }
    if(kind==='rug') {
      furniture(e,'rug',tint??'#a8453a');
      return {entity:e,half:[1.1,.8],top:.03,name:'rug'};
    }
    // ---- Fittings for the post office, pharmacy, guesthouse and clothes shop. A fitting against
    // a wall paints its own sign from `text` and says so (`signed`), so the room does not hang a
    // second one from the ceiling in front of it.
    // A post office counter, open so the clerk can be seen, with a parcel scale at one end.
    if(kind==='postcounter') {
      box(e,[0,.55,0],[3.2,1.1,.8],tint??'#4f7a5e');
      box(e,[0,1.14,0],[3.36,.1,.94],'#e2ded0');
      const scales=group(e,'scales');
      box(scales,[1.15,1.24,.1],[.5,.1,.4],'#a1b1ae');
      box(scales,[1.15,1.31,.1],[.44,.03,.34],'#d9dedb');
      box(scales,[1.15,1.25,.31],[.18,.06,.02],'#5f6a6c');
      return {entity:e,half:[1.6,.42],top:1.35,name:'counter'};
    }
    // Open shelves of parcels waiting to go out.
    if(kind==='parcelshelf') {
      for(const x of [-.97,.97])box(e,[x,1.0,0],[.06,2.0,.56],'#8a8271');
      const parcels=group(e,'parcel');
      for(let i=0;i<3;i++){
        box(e,[0,.3+i*.7,0],[1.96,.05,.56],'#b9b3a0');
        for(let j=0;j<4;j++){const s=.26+((i+j)%3)*.08;box(parcels,[-.68+j*.45,.33+i*.7+s/2,.02],[.36,s,.38],['#c9a77a','#b88f5e','#d8bf95'][(i+j)%3]);}
      }
      if(text)label(e,text,[0,2.18,.05],1.0,.3,'#f4ead2','#36594f');
      return {entity:e,half:[1.0,.3],top:2.35,name:'parcel',signed:!!text};
    }
    // A glass-topped case with stamps laid out on it.
    if(kind==='stampcase') {
      box(e,[0,.45,0],[1.5,.9,.7],tint??'#8d6b4d');
      box(e,[0,.95,0],[1.5,.1,.7],'#cfe0dd');
      const stamps=group(e,'stamp');
      for(let i=0;i<5;i++)for(let j=0;j<2;j++)box(stamps,[-.56+i*.28,1.01,-.14+j*.28],[.18,.02,.22],jar[(i+j*2)%6]);
      // A low case gets a card on a post, not a board hung at head height from the ceiling.
      if(text){box(e,[0,1.12,-.3],[.04,.24,.04],'#7d7563').signText=text;label(e,text,[0,1.36,-.3],.7,.26,'#f4ead2','#36594f');}
      return {entity:e,half:[.75,.35],top:1.5,name:'stamp',signed:!!text};
    }
    // A letter slot in the wall: a brass plate with a dark slot, and its sign above.
    if(kind==='letterslot') {
      const plate=box(e,[0,1.2,.03],[.7,.5,.05],'#c9a13b'),slot=box(e,[0,1.24,.06],[.46,.06,.02],'#2b2622');
      if(text){plate.signText=slot.signText=text;label(e,text,[0,1.7,.05],.8,.3,'#f4ead2','#36594f');}
      return {entity:e,half:[.4,.06],top:1.9,signed:!!text};
    }
    // A wall of small herb drawers, the way a Chinese pharmacy keeps them.
    if(kind==='herbcabinet') {
      box(e,[0,1.1,0],[2.8,2.2,.5],tint??'#7a5237');
      for(let r=0;r<5;r++)for(let c=0;c<6;c++)box(e,[-1.1+c*.44,.4+r*.38,.26],[.4,.34,.03],'#9c6a45');
      if(text)label(e,text,[0,2.36,.05],1.0,.3,'#f4ead2','#36594f');
      return {entity:e,half:[1.4,.28],top:2.5,name:'medicine-cabinet',signed:!!text};
    }
    // Open shelves of boxed medicines.
    if(kind==='medicineshelf') {
      box(e,[0,1.0,-.2],[2.4,2.0,.06],tint??'#e8e4d4');
      for(const x of [-1.17,1.17])box(e,[x,1.0,0],[.06,2.0,.46],tint??'#e8e4d4');
      for(let r=0;r<4;r++){
        box(e,[0,.3+r*.48,0],[2.3,.04,.42],'#c8c2ae');
        for(let i=0;i<5;i++)box(e,[-.9+i*.45,.43+r*.48,.04],[.3,.22,.2],['#f2f0e8','#cfe0dd','#e7c9c1','#dfe6c8'][(r+i)%4]);
      }
      if(text)label(e,text,[0,2.16,.05],1.0,.3,'#f4ead2','#36594f');
      return {entity:e,half:[1.2,.25],top:2.3,name:'medicine-cabinet',signed:!!text};
    }
    // A guesthouse front desk.
    if(kind==='reception') {
      box(e,[0,.55,0],[2.6,1.1,.8],tint??'#8d6b4d');
      box(e,[0,1.14,0],[2.76,.08,.94],'#c9a97a');
      box(e,[0,.6,.41],[2.3,.7,.02],'#a8825d');
      return {entity:e,half:[1.38,.47],top:1.18,name:'reception'};
    }
    // A board of room keys on hooks.
    if(kind==='keyrack') {
      box(e,[0,1.65,.03],[1.2,.7,.05],'#6f5236');
      const keys=group(e,'key');
      for(let r=0;r<2;r++)for(let i=0;i<5;i++)box(keys,[-.44+i*.22,1.8-r*.32,.07],[.06,.16,.02],'#d4b67c');
      return {entity:e,half:[.6,.06],y0:1.3,top:2.0,name:'key'};
    }
    // A flight of stairs up to the guest rooms, roped off at the foot.
    if(kind==='stairflight') {
      const n=12,rise=(h-.02)/n,tread=3.2/n,flight=group(e,'stairs');
      for(let i=0;i<n;i++)box(flight,[0,rise*(i+1)/2,1.6-tread*(i+.5)],[1.2,rise*(i+1),tread],tint??'#8d6b4d');
      const rope=group(e,'railing');
      for(const x of [-.5,.5])cylinder(rope,[x,.45,1.9],[.07,.9,.07],'#d4b67c');
      box(rope,[0,.82,1.9],[1.0,.04,.04],'#a4564a');
      if(text)label(e,text,[0,.62,1.93],.6,.26,'#f4ead2','#36594f');
      return {entity:e,half:[.65,1.95],top:h,name:'stairs',signed:!!text};
    }
    // Wall shelves of hats.
    if(kind==='hatshelf') {
      box(e,[0,1.3,-.17],[2.0,1.8,.06],tint??'#d8c9b0');
      const hats=group(e,'hat');
      for(let r=0;r<3;r++){
        const y=.7+r*.55;
        box(e,[0,y,0],[2.0,.05,.36],'#b39468');
        for(let i=0;i<4;i++){
          const x=-.72+i*.48,c=jar[(r+i)%6];
          cylinder(hats,[x,y+.12,0],[.28,.2,.28],c);
          cylinder(hats,[x,y+.04,0],[.42,.03,.42],c);
        }
      }
      if(text)label(e,text,[0,2.36,-.12],1.0,.3,'#f4ead2','#36594f');
      return {entity:e,half:[1.0,.2],top:2.55,name:'hat',signed:!!text};
    }
    // A low stepped rack of shoes.
    if(kind==='shoeshelf') {
      box(e,[0,.7,-.26],[2.0,1.4,.04],tint??'#b39468');
      for(const x of [-1,1])box(e,[x,.55,0],[.05,1.1,.56],tint??'#b39468');
      const shoes=group(e,'shoes');
      for(let r=0;r<3;r++){
        const y=.2+r*.35,z=.12-r*.14;
        box(e,[0,y,z],[1.96,.05,.3],'#d5bb92');
        for(let i=0;i<3;i++)for(const dx of [-.07,.07])box(shoes,[-.6+i*.6+dx,y+.075,z],[.12,.1,.26],jar[(r*2+i)%6]);
      }
      if(text)label(e,text,[0,1.24,-.22],.8,.26,'#f4ead2','#36594f');
      return {entity:e,half:[1.03,.28],top:1.4,name:'shoes',signed:!!text};
    }
    // A tall standing mirror.
    if(kind==='mirror') {
      box(e,[0,1.0,0],[.8,1.9,.06],tint??'#8d6b4d');
      box(e,[0,1.0,.04],[.68,1.78,.02],'#dfe9ec');
      box(e,[0,.03,-.1],[.7,.06,.3],tint??'#8d6b4d');
      return {entity:e,half:[.4,.15],top:1.95,name:'mirror'};
    }
    // A curtained fitting room: two side panels, a back, a roof and a curtain across the front.
    if(kind==='fittingroom') {
      for(const x of [-.88,.88])box(e,[x,1.1,0],[.05,2.2,1.6],'#e8dccb');
      box(e,[0,1.1,-.78],[1.8,2.2,.05],'#e8dccb');
      box(e,[0,2.22,0],[1.82,.05,1.62],'#d8c9b0');
      cylinder(e,[0,2.1,.8],[.04,1.76,.04],'#8f9694',[0,0,90]);
      for(let i=0;i<5;i++)box(e,[-.68+i*.34,1.15,.78+(i%2)*.03],[.36,1.9,.03],tint??'#b45b52');
      if(text)label(e,text,[0,2.42,.8],1.0,.3,'#f4ead2','#36594f');
      return {entity:e,half:[.9,.82],top:2.6,name:'fitting-room',signed:!!text};
    }
    box(e,[0,.5,0],[1,1,.6],tint??'#b0a98f');
    return {entity:e,half:[.5,.3],top:1};
  }
  // ---- Classical garden pieces: a covered walkway, a lattice wall, a veranda front, and a canal
  // edged with stones and rockery and crossed by arched stone bridges. Layouts and collision marks
  // come from src/core/garden.js; these only draw. Flat colours only (the palette the park already
  // uses), so every piece batches into the draw calls that are already there.
  const GC={plaster:'#efe9dc',coping:'#6d7471',ridge:'#565c5a',timber:'#8a6a4c',timberDark:'#6e533b',
    stone:'#c9c0a8',stoneDark:'#a9a08a',rock:'#9d968a',rockLight:'#b0a899',pad:'#7f9e6a',lotus:'#e3a1b8'};
  /** One opaque water material for every pond, stream and canal, so they share a draw call. */
  let waterMat=null;
  function waterMaterial() {
    if(waterMat)return waterMat;
    waterMat=new pc.StandardMaterial();
    waterMat.diffuse=new pc.Color().fromString('#79aaa8');waterMat.emissive=new pc.Color().fromString('#3f6668');
    waterMat.emissiveIntensity=.35;waterMat.gloss=.85;waterMat.useMetalness=true;waterMat.metalness=.15;waterMat.update();
    return waterMat;
  }
  /** Every scenery lantern shares one lit material; the first builder to hang one hands it to `lamps`. */
  let sceneryLit=null;
  function sceneryLantern(parent,x,y,z,lamps) {
    if(!sceneryLit){sceneryLit=glow('#d4483a');lamps.push(sceneryLit);}
    return redLantern(parent,x,y,z,sceneryLit);
  }
  /** A rockery 假山: a heap of three weathered stones. `r` is {x,z,r,h}. */
  function rockery(parent,r) {
    const g=group(parent,'rock');
    ball(g,[r.x,r.h*.42,r.z],[r.r*2,r.h,r.r*1.7],GC.rock);
    ball(g,[r.x+r.r*.4,r.h*.25,r.z+r.r*.3],[r.r,r.h*.55,r.r],GC.rockLight);
    ball(g,[r.x-r.r*.3,r.h*.85,r.z-r.r*.2],[r.r*.6,r.h*.55,r.r*.5],GC.rock);
    return g;
  }
  /** A bridge along z: stepped slabs, a pier under an arched crest, and hand-rails that follow the steps. */
  function stoneBridge(parent,b,color=GC.stone,railColor=GC.stoneDark) {
    const g=group(parent,'bridge');
    for(const [z0,z1,y] of b.steps)box(g,[b.x,y-.14,(z0+z1)/2],[b.width,.28,z1-z0],color);
    const crest=b.steps.reduce((a,s)=>s[2]>a[2]?s:a);
    if(!b.flat)box(g,[b.x,crest[2]/2,(crest[0]+crest[1])/2],[b.width-.5,crest[2]-.2,.5],GC.stoneDark);
    for(const r of bridgeRails(b)){
      b.steps.forEach(([z0,z1,y],i)=>{
        box(g,[r.x,y+.72,(z0+z1)/2],[.08,.08,z1-z0+.02],railColor);
        if(i%2===0||i===b.steps.length-1)box(g,[r.x,y+.38,i%2===0?z0+.05:z1-.05],[.12,.76,.12],railColor);
      });
    }
    return g;
  }
  /** A low railing between two points on a run: a top rail, a foot rail and a post in the middle. */
  function railing(parent,x,z,hw,hd,y) {
    const g=group(parent,'railing'),alongX=hw>hd,len=2*Math.max(hw,hd);
    for(const [h,t] of [[.85,.1],[.2,.08]])box(g,[x,y+h,z],alongX?[len,t,.1]:[.1,t,len],GC.timber);
    box(g,[x,y+.5,z],[.08,.7,.08],GC.timberDark);
    return g;
  }
  /** Poles along a straight run: a pivot at its middle, turned so the run lies along local x. */
  function runPivot(parent,x,z,alongX) {
    const e=new pc.Entity('run');e.setLocalPosition(x,0,z);e.setLocalEulerAngles(0,alongX?0:90,0);parent.addChild(e);return e;
  }
  /** A covered walkway 走廊 (see walkwayLayout): timber posts on stone bases, beams, a grey tiled
   *  roof with upturned ends and eave boards, a railing on its open side, lanterns every other bay. */
  function walkway(parent,w,lamps) {
    const L=walkwayLayout(w),y=L.y,H=L.height,len=L.a1-L.a0,mid=(L.a0+L.a1)/2;
    const root=group(parent,'walkway');
    const [cx,cz]=L.ax?[mid,L.c]:[L.c,mid];
    for(const p of L.posts){
      cylinder(root,[p.x,y+.08,p.z],[.36,.16,.36],GC.stoneDark);
      tag(cylinder(root,[p.x,y+H/2,p.z],[.22,H,.22],GC.timberDark),'pillar');
    }
    for(const r of L.rails)railing(root,r.x,r.z,r.hw,r.hd,y);
    for(const p of L.lanterns)sceneryLantern(root,p.x,y+H-.75,p.z,lamps);
    // A shop board hung crosswise under the eaves, as arcade shops hang theirs: read along the run.
    if(w.sign){
      const [sx,sz]=L.ax?[w.sign.at,L.c]:[L.c,w.sign.at];
      label(root,w.sign.text,[sx,y+H-.22,sz],L.width-.3,.3).setLocalEulerAngles(0,L.ax?90:0,0);
    }
    const run=runPivot(root,cx,cz,L.ax);
    for(const side of [-1,1])box(run,[0,y+H-.1,side*L.width/2],[len+.3,.2,.2],GC.timber);   // the beams
    for(let a=-len/2;a<=len/2+1e-6;a+=L.bay)box(run,[a,y+H-.05,0],[.14,.14,L.width],GC.timber);  // the tie beams
    tiledRoof(run,0,0,len,L.width,y+H,GC.coping,3);
    for(const side of [-1,1])tag(box(run,[0,y+H+.08,side*(L.width/2+.72)],[len+1.25,.14,.08],GC.timberDark),'eaves');
    box(root,[cx,y+.015,cz],L.ax?[len,.03,L.width]:[L.width,.03,len],GC.stone);   // stone floor
    return {entity:root,marks:walkwayMarks(w,w.group??'scenery')};
  }
  /** One lattice window 花窗 in a wall built along local x: the plaster round the opening in
   *  thin slices, a grey frame, and a grid of bars. `inner(dy)` is the opening's half-width at a
   *  height and `tall(dx)` its half-height at an offset; round and hexagonal openings alternate. */
  function latticeOpening(parent,c,cy,R,T,B,hex) {
    const g=group(parent,'lattice'),s3=Math.sqrt(3);
    const inner=dy=>hex?(Math.abs(dy)<=R*s3/2?R-Math.abs(dy)/s3:0):(Math.abs(dy)<R?Math.sqrt(R*R-dy*dy):0);
    const tall=dx=>hex?(Math.abs(dx)<=R/2?R*s3/2:(R-Math.abs(dx))*s3):Math.sqrt(Math.max(0,R*R-dx*dx));
    const slice=.2;
    for(let y=cy-R;y<cy+R-1e-6;y+=slice){
      const open=inner(y+slice/2-cy),width=B-open;
      for(const side of [-1,1])box(g,[c+side*(open+width/2),y+slice/2,0],[width,slice,T],GC.plaster);
    }
    if(hex)for(let i=0;i<6;i++){
      const a=i*Math.PI/3+Math.PI/6,mx=Math.cos(a)*R*s3/2,my=Math.sin(a)*R*s3/2;
      box(g,[c+mx,cy+my,0],[R+.04,.1,T+.06],GC.coping,[0,0,a*180/Math.PI+90]);
    }else for(let i=0;i<14;i++){
      const a=i/14*Math.PI*2;
      box(g,[c+Math.cos(a)*R,cy+Math.sin(a)*R,0],[2*Math.PI*R/14+.04,.1,T+.06],GC.coping,[0,0,a*180/Math.PI+90]);
    }
    for(const k of [-.5,0,.5]){
      const across=inner(k*R),up=tall(k*R);
      if(across>0)box(g,[c,cy+k*R,0],[2*across,.05,.06],GC.ridge);
      if(up>0)box(g,[c+k*R,cy,0],[.05,2*up,.06],GC.ridge);
    }
  }
  /** A white plaster wall {x0,x1,z0,z1} with grey tile coping and lattice windows you can see through. */
  function latticeWall(parent,w) {
    const H=w.height??3,alongX=w.x1-w.x0>=w.z1-w.z0,len=alongX?w.x1-w.x0:w.z1-w.z0,T=alongX?w.z1-w.z0:w.x1-w.x0;
    const run=runPivot(parent,(w.x0+w.x1)/2,(w.z0+w.z1)/2,alongX);
    const root=group(run,'wall'),R=w.window??.62,cy=1.6,B=R+.3;
    const plaster=(a,b,y0,y1)=>{if(b-a>.01&&y1-y0>.01)box(root,[(a+b)/2,(y0+y1)/2,0],[b-a,y1-y0,T],GC.plaster);};
    let from=-len/2;
    latticeWindows(w).forEach((c,i)=>{
      plaster(from,c-B,0,H);
      plaster(c-B,c+B,0,cy-R);plaster(c-B,c+B,cy+R,H);
      latticeOpening(root,c,cy,R,T,B,i%2===1);
      from=c+B;
    });
    plaster(from,len/2,0,H);
    box(root,[0,H+.08,0],[len+.3,.16,T+.35],GC.coping);
    box(root,[0,H+.22,0],[len,.12,.16],GC.ridge);
    return {entity:run,marks:latticeWallMarks(w,w.group??'scenery')};
  }
  /** A veranda 檐廊 across a building's front (see verandaLayout): columns, a railing either side
   *  of the doorway, and a lean-to tiled eave back to the wall, in the building's own colours. */
  function veranda(parent,v,b) {
    const L=verandaLayout(v,b),H=L.height,e=new pc.Entity('veranda-'+b.id);
    e.setLocalPosition(b.x,0,b.z);e.setLocalEulerAngles(0,b.rotation||0,0);parent.addChild(e);
    const front=L.f+L.depth,span=L.cols.at(-1)-L.cols[0],mid=(L.cols.at(-1)+L.cols[0])/2;
    for(const x of L.cols){
      cylinder(e,[x,.1,front],[.44,.2,.44],GC.stoneDark);
      tag(cylinder(e,[x,H/2,front],[.3,H,.3],GC.timberDark),'pillar');
    }
    for(const r of L.rails)railing(e,(r.lo+r.hi)/2,front,(r.hi-r.lo)/2,.08,0);
    tag(box(e,[mid,H-.1,front],[span+.4,.24,.24],GC.timber),'eaves');
    const eaves=group(e,'eaves'),reach=L.depth+.55,drop=.55,slope=Math.hypot(reach,drop),tilt=Math.atan2(drop,reach)*180/Math.PI;
    box(eaves,[mid,H+.1+drop/2,L.f+reach/2],[span+1.1,.14,slope],b.roof,[tilt,0,0]);
    const ribs=Math.max(3,Math.round(span/.9));
    for(let i=0;i<ribs;i++)box(eaves,[mid-span/2-.35+(i+.5)*(span+.7)/ribs,H+.19+drop/2,L.f+reach/2],[.1,.08,slope],shade(b.roof,.72),[tilt,0,0]);
    box(eaves,[mid,H+.62,L.f+.1],[span+1.1,.14,.22],shade(b.roof,.72));
    box(eaves,[mid,H+.1,L.f+reach],[span+1.1,.12,.08],GC.timberDark);
    for(const side of [-1,1])box(eaves,[mid+side*(span/2+.6),H+.2,L.f+reach-.1],[.5,.1,.28],b.roof,[0,0,side*26]);
    return {entity:e,marks:verandaMarks(v,b)};
  }
  /** A canal along z (see canalMarks): water, stones along its banks, lotus, rockeries by the
   *  water and arched stone bridges crossing it along x. */
  function waterEdge(parent,c) {
    const e=new pc.Entity('canal');parent.addChild(e);
    const level=c.water.level,DEG=180/Math.PI;
    for(const s of c.channel){
      const sheet=tag(box(e,[(s.x0+s.x1)/2,level,(s.z0+s.z1)/2],[s.x1-s.x0,.04,s.z1-s.z0],'#79aaa8'),'water');
      sheet.render.meshInstances[0].material=waterMaterial();sheet.render.castShadows=false;
    }
    const landing=(x,z)=>c.bridges.some(b=>Math.abs(z-b.z)<b.width/2+.3&&x>b.steps[0][0]-.3&&x<b.steps.at(-1)[1]+.3);
    shoreline(c.channel,1.3,landing).forEach((p,i)=>
      tag(shape(e,'sphere',[p.x,.12,p.z],[1.0,.3,.7],i%2?GC.stone:GC.stoneDark,[0,-p.angle*DEG,0]),'stone'));
    for(const l of c.lotus??[]){
      const g=group(e,'lotus');
      cylinder(g,[l.x,level+.04,l.z],[.9,.03,.9],GC.pad);
      if(l.flower)ball(g,[l.x+.12,level+.2,l.z+.08],[.32,.3,.32],GC.lotus);
    }
    for(const r of c.rocks??[])rockery(e,r);
    // The bridges are drawn along local z in a frame turned a quarter: local (x,z) is world (z,-x).
    const turned=new pc.Entity('bridges');turned.setLocalEulerAngles(0,90,0);e.addChild(turned);
    for(const b of c.bridges)stoneBridge(turned,{...b,x:-b.z});
    return {entity:e,marks:canalMarks(c,c.group??'scenery')};
  }
  return {material,shape,box,ball,cylinder,tube,glow,label,pickable,person,tree,building,lantern,furniture,streetProp,groundPatch,fitting,tiledRoof,latticeWindow,redLantern,waterMaterial,sceneryLantern,rockery,stoneBridge,walkway,latticeWall,veranda,waterEdge};
}
