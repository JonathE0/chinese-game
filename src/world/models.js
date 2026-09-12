import * as pc from 'playcanvas';
export function createModels(app) {
  const cache=new Map();
  function material(hex) {
    if(cache.has(hex))return cache.get(hex);
    const m=new pc.StandardMaterial();m.diffuse=new pc.Color().fromString(hex);m.useMetalness=true;m.metalness=0;m.gloss=0.1;m.update();cache.set(hex,m);return m;
  }
  function shape(parent,type,xyz,scale,color,rotation=[0,0,0]) {
    const e=new pc.Entity(type);e.addComponent('render',{type,material:material(color),castShadows:true,receiveShadows:true});e.setLocalPosition(...xyz);e.setLocalScale(...scale);e.setLocalEulerAngles(...rotation);parent.addChild(e);return e;
  }
  const box=(p,xyz,s,c,r)=>shape(p,'box',xyz,s,c,r);
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
    return {entity,filled:true,back:0,kind,color,size,shape:type,local:xyz};
  }
  const cylinder=(p,xyz,s,c,r)=>shape(p,'cylinder',xyz,s,c,r);
  function label(parent,text,pos,width=3,height=.65,bg='#f4e3b9',fg='#425d54') {
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;
    const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,768,160);ctx.strokeStyle=fg;ctx.lineWidth=6;ctx.strokeRect(12,12,744,136);ctx.fillStyle=fg;ctx.font='bold 84px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,84);
    const tex=new pc.Texture(app.graphicsDevice,{width:768,height:160,mipmaps:true});tex.setSource(canvas);
    const m=new pc.StandardMaterial();m.diffuseMap=tex;m.emissiveMap=tex;m.emissive=new pc.Color(.3,.3,.3);m.update();
    const e=box(parent,pos,[width,height,.08],bg);e.render.meshInstances[0].material=m;return e;
  }
  function person(parent,color,pos,hat=false) {
    const e=new pc.Entity('person');e.setLocalPosition(...pos);parent.addChild(e);
    // The chest, shoulders and arms live under one node so a first-person camera can drop the
    // whole bulk of the body and leave you looking down at your own legs.
    const upper=new pc.Entity('upper');e.addChild(upper);
    const torso=box(upper,[0,1.0,0],[.58,.66,.36],color);
    const collar=cylinder(upper,[0,.81,0],[.58,.3,.42],color);
    // The head is its own entity so a first-person camera can hide it without losing the body;
    // everything on the face hangs off a neck pivot, so turning to look is a rotation of one node.
    const head=new pc.Entity('head');e.addChild(head);
    const neck=new pc.Entity('neck');neck.setLocalPosition(0,1.33,0);head.addChild(neck);
    box(neck,[0,.27,0],[.49,.5,.44],'#e9ba8d');
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
   */
  function building(parent,data) {
    const root=new pc.Entity(data.id);root.setLocalPosition(data.x,0,data.z);root.setLocalEulerAngles(0,data.rotation||0,0);parent.addChild(root);
    const w=data.width,d=data.depth,h=data.height,style=data.style??'tiled';
    box(root,[0,h/2,0],[w,h,d],data.color);
    box(root,[0,.2,0],[w+.2,.4,d+.2],'#c7b798');
    if(style==='modern')modernFront(root,data,w,d,h);
    else if(style==='shophouse')shophouseFront(root,data,w,d,h);
    else tiledFront(root,data,w,d,h);
    return root;
  }
  /** Timber posts, lattice glazing, layered tiles. The oldest buildings in town. */
  function tiledFront(root,data,w,d,h) {
    for(const x of [-w/2+.2,w/2-.2])box(root,[x,h/2,d/2+.025],[.23,h,.2],'#8e6952');
    for(const y of [1,h-1])box(root,[0,y,d/2+.03],[w,.16,.15],'#9c7558');
    for(const x of [-w*.3,w*.3]) {
      box(root,[x,1.85,d/2+.06],[1.3,1.5,.12],'#637b70');
      for(const off of [-.4,0,.4])box(root,[x+off,1.85,d/2+.15],[.07,1.45,.07],'#d9c6a1');
      box(root,[x,1.85,d/2+.17],[1.3,.07,.06],'#d9c6a1');
    }
    box(root,[0,1.15,d/2+.1],[1.15,2.1,.16],'#6c7661');
    for(const x of [-.28,.28])box(root,[x,1.2,d/2+.22],[.045,1.9,.03],'#cdb486');
    for(let i=0;i<5;i++)box(root,[0,h+.12+i*.22,0],[w+1.3-i*.35,.25,d+1.5-i*.64],data.roof);
    box(root,[0,h+1.27,0],[w+.05,.18,.23],data.roof);
    for(const x of [-w/2-.48,w/2+.48])box(root,[x,h+.28,0],[.22,.35,d+1.6],data.roof,[0,0,x<0?-18:18]);
    label(root,data.sign,[0,h-.55,d/2+.22],Math.min(3.5,w-1),.67);
  }
  /** Plaster over a rendered base, arched upper windows, a cloth awning across the front. */
  function shophouseFront(root,data,w,d,h) {
    const trim=data.trim??'#e6dcc4';
    box(root,[0,h*.62,d/2+.04],[w+.06,h*.76,.1],trim);           // upper storey plaster
    box(root,[0,1.2,d/2+.05],[w+.08,.16,.16],'#b09572');         // string course
    box(root,[0,h-.12,d/2+.05],[w+.1,.22,.22],'#b09572');        // cornice
    for(const x of [-w*.28,w*.28]){
      box(root,[x,h*.66,d/2+.09],[1.1,1.25,.08],'#5f7a72');
      cylinder(root,[x,h*.66+.62,d/2+.09],[1.1,.08,1.1],'#5f7a72',[90,0,0]);   // arched head
      for(const off of [-.3,.3])box(root,[x+off,h*.66,d/2+.13],[.07,1.2,.05],trim);
    }
    box(root,[0,.6,d/2+.1],[w-1.2,1.2,.1],'#dfe6e2');            // shop window
    for(const x of [-(w-1.2)/2+.06,(w-1.2)/2-.06])box(root,[x,.6,d/2+.14],[.1,1.24,.06],'#8e6952');
    box(root,[0,1.15,d/2+.12],[1.2,2.1,.14],'#7a5f45');          // door
    for(const x of [-.3,.3])box(root,[x,1.2,d/2+.2],[.05,1.9,.03],'#d9c6a1');
    box(root,[0,2.45,d/2+.62],[w-.3,.12,1.25],data.roof,[-16,0,0]);   // awning
    for(const x of [-(w/2-.5),w/2-.5])cylinder(root,[x,1.7,d/2+1.15],[.08,1.5,.08],'#8e6952');
    for(let i=0;i<3;i++)box(root,[0,h+.1+i*.2,0],[w+.5-i*.2,.22,d+.6-i*.3],data.roof);
    label(root,data.sign,[0,h-.62,d/2+.12],Math.min(3.4,w-1),.6);
  }
  /** Glass, steel mullions, a flat parapet and a sign strip that lights up after dark. */
  function modernFront(root,data,w,d,h) {
    const glass=new pc.StandardMaterial();
    glass.diffuse=new pc.Color().fromString('#b8d2d6');
    glass.emissive=new pc.Color().fromString('#33484c');glass.emissiveIntensity=.3;
    glass.opacity=.55;glass.blendType=pc.BLEND_NORMAL;glass.gloss=.92;
    glass.useMetalness=true;glass.metalness=.35;glass.update();
    const pane=box(root,[0,1.55,d/2+.06],[w-.5,2.9,.08],'#b8d2d6');
    pane.render.meshInstances[0].material=glass;
    for(let i=-2;i<=2;i++)box(root,[i*(w-.6)/5,1.55,d/2+.11],[.09,2.95,.06],'#8f9694');   // mullions
    box(root,[0,.08,d/2+.16],[w-.4,.16,.5],'#9aa3a0');
    box(root,[0,3.06,d/2+.1],[w+.04,.14,.14],'#8f9694');
    box(root,[0,1.15,d/2+.14],[1.25,2.2,.06],'#5f6a6c');          // sliding door
    box(root,[0,1.15,d/2+.17],[.05,2.2,.04],'#c9d3d6');
    box(root,[0,h*.72,d/2+.05],[w+.06,h*.5,.1],data.color);       // upper cladding
    for(let i=0;i<4;i++)box(root,[0,h*.55+i*.42,d/2+.11],[w-.2,.05,.03],'#9aa3a0');
    // The sign strip is emissive, so it reads at night as well as at noon.
    const strip=box(root,[0,h-.5,d/2+.14],[w-.4,.62,.1],'#f4efe0');
    strip.render.meshInstances[0].material=glow('#f6ead0');
    label(root,data.sign,[0,h-.5,d/2+.2],Math.min(3.6,w-1.1),.56,'#f7f2e4','#3f5a52');
    box(root,[0,h+.28,0],[w+.5,.5,d+.5],data.roof);               // parapet
    box(root,[0,h+.56,0],[w+.1,.12,d+.1],'#8f9694');
    for(const x of [-w*.25,w*.25])box(root,[x,h+.8,-d*.2],[.5,.5,.5],'#9aa3a0');   // roof plant
  }
  /** Returns the glowing material so the day/night cycle can dim it. */
  function lantern(parent,x,y,z) {
    cylinder(parent,[x,y+.35,z],[.035,.6,.035],'#715945');
    const globe=ball(parent,[x,y,z],[.4,.5,.4],'#d48a66');
    const lit=glow('#e8a071');
    globe.render.meshInstances[0].material=lit;
    cylinder(parent,[x,y-.31,z],[.045,.25,.045],'#e0b86a');
    return {entity:globe,material:lit};
  }
  // Home furnishings, built from the same blocky vocabulary as the town itself.
  function furniture(parent,kind,color='#b98d62') {
    const e=new pc.Entity('furniture-'+kind);parent.addChild(e);
    if(kind==='table') {
      box(e,[0,.42,0],[1.5,.09,1.0],color);
      for(const x of [-.62,.62])for(const z of [-.38,.38])box(e,[x,.2,z],[.11,.42,.11],'#8f6a48');
      box(e,[0,.24,0],[1.2,.06,.7],'#a97d55');
    } else if(kind==='bed') {
      // A low wooden frame, a mattress that sits inside it, a folded quilt and two pillows.
      box(e,[0,.15,0],[2.16,.3,1.46],'#8f6a48');
      for(const x of [-1.0,1.0])for(const z of [-.62,.62])box(e,[x,.07,z],[.14,.14,.14],'#6f5236');
      box(e,[0,.34,0],[1.98,.24,1.32],'#f4ecd8');                 // mattress
      box(e,[0,.46,0],[1.96,.05,1.3],'#fdf7e6');
      box(e,[0,.5,.2],[1.9,.14,.86],color??'#a8bfa5');            // turned-down quilt
      box(e,[0,.56,.5],[1.9,.1,.3],'#c3d3bd');
      for(const x of [-.48,.48])box(e,[x,.53,-.44],[.78,.16,.4],'#fdf6e2',[0,x<0?4:-4,0]);   // pillows
      box(e,[-1.13,.66,0],[.1,1.02,1.46],'#8f6a48');              // headboard
      box(e,[-1.13,1.14,0],[.16,.12,1.5],'#a2764f');
      for(let i=0;i<4;i++)box(e,[-1.09,.62+i*.14,0],[.03,.06,1.3],'#7d5c3d');
      box(e,[1.13,.42,0],[.1,.54,1.46],'#8f6a48');                // footboard
      box(e,[1.13,.68,0],[.16,.1,1.5],'#a2764f');
    } else if(kind==='shelf') {
      box(e,[0,.85,0],[1.4,1.7,.55],color);
      box(e,[0,.85,.06],[1.24,1.54,.5],'#eadcbb');
      for(const y of [.5,1.0,1.5])box(e,[0,y,.06],[1.24,.07,.5],'#b08a60');
      const spines=['#8fa98d','#c47f6b','#d9b072','#7f9ab0','#9db08f'];
      for(let i=0;i<5;i++)box(e,[-.45+i*.19,.68,.1],[.12,.3,.36],spines[i]);
      for(let i=0;i<4;i++)box(e,[-.38+i*.2,1.18,.1],[.13,.28,.36],spines[(i+2)%5]);
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
      box(e,[0,.86,-.3],[.9,.02,.6],'#f2ead6');            // an open book
      box(e,[0,.88,-.3],[.02,.03,.6],'#c9a97a');
      cylinder(e,[.62,.94,-.26],[.14,.34,.14],'#9db08f');  // a pen pot
      for(const [dx,c] of [[-.03,'#c47f6b'],[.03,'#7f9ab0']])cylinder(e,[.62+dx,1.14,-.26],[.03,.3,.03],c);
    } else if(kind==='teaset') {
      box(e,[0,.03,0],[.62,.06,.42],'#8d6b4d');
      box(e,[0,.07,0],[.56,.03,.36],'#c9a97a');
      cylinder(e,[-.14,.16,0],[.26,.2,.26],color??'#9db08f');      // the pot
      cylinder(e,[-.14,.27,0],[.16,.05,.16],'#7f9a86');
      box(e,[-.02,.18,0],[.12,.04,.04],'#7f9a86');
      cylinder(e,[-.29,.19,0],[.05,.09,.05],'#7f9a86',[0,0,90]);
      for(const [x,z] of [[.14,-.1],[.14,.1],[.24,0]])cylinder(e,[x,.12,z],[.13,.09,.13],'#efe7d2');
    } else if(kind==='chair') {
      box(e,[0,.44,0],[.52,.08,.52],color);
      box(e,[0,.75,-.22],[.52,.54,.07],color);
      for(const x of [-.2,.2])for(const z of [-.2,.2])box(e,[x,.21,z],[.07,.44,.07],'#8a6c49');
    } else if(kind==='wardrobe') {
      box(e,[0,1.0,0],[1.3,2.0,.62],color);
      box(e,[0,2.05,0],[1.4,.12,.7],'#a97d55');
      for(const x of [-.32,.32])box(e,[x,1.0,.33],[.6,1.86,.04],'#e0c69c');
      for(const x of [-.06,.06])ball(e,[x,1.0,.37],[.09,.16,.08],'#8a7350');
    } else box(e,[0,.3,0],[.8,.6,.8],color);
    return e;
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
      const head=box(e,[0,4.36,.86],[.5,.34,.5],'#f2e2b4');
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
      box(e,[-.62,.80,0],[.3,.26,.28],'#a98a66');                        // front basket
      box(e,[-.62,.92,0],[.32,.03,.3],'#8d7154');
      box(e,[-.62,.62,0],[.38,.05,.13],'#6b6f6c',[0,0,6]);               // front mudguard
      box(e,[.62,.62,0],[.4,.05,.13],'#6b6f6c',[0,0,-6]);
      return {entity:e,half:[.72,.22],top:1.05};
    }
    if(kind==='planter') {
      box(e,[0,.3,0],[1.5,.6,1.0],tint??'#c2ad8b');
      box(e,[0,.64,0],[1.36,.14,.88],'#87996b');
      for(let i=0;i<4;i++)ball(e,[-.45+i*.3,.86,0],[.3,.28,.32],i%2?'#e5ba77':'#d38e84');
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
      cylinder(e,[0,.8,0],[.26,.12,.26],'#c9dce0');
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
      shape(e,'cone',[0,2.35,0],[3.0,.7,3.0],tint??'#c98d76');
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
      for(let i=0;i<4;i++)box(e,[-.68+i*.12,1.11,(i%2?.14:-.14)],[.06,.05,.44],'#b5713f',[0,0,0]);
      cylinder(e,[.55,1.14,0],[.46,.28,.46],'#8f9694');
      cylinder(e,[.55,1.28,0],[.48,.04,.48],'#c9c6ba');
      // Skewers of candied hawthorn stood upright in a straw bundle.
      cylinder(e,[.05,1.2,-.28],[.3,.4,.3],'#c9a97a');
      for(let i=0;i<7;i++){
        const x=-.06+((i%3)-1)*.09,z=-.28+(Math.floor(i/3)-.5)*.1;
        box(e,[x,1.5,z],[.03,.62,.03],'#c9b083');
        for(let b=0;b<3;b++)ball(e,[x,1.62+b*.13,z],[.14,.14,.14],'#c9463f');
      }
      for(const x of [-.9,.9])cylinder(e,[x,1.72,0],[.07,1.5,.07],'#7d6349');
      const canopy=box(e,[0,2.5,0],[2.3,.12,1.3],tint??'#b8765f');
      canopy.setLocalEulerAngles(0,0,0);
      box(e,[0,2.62,0],[2.4,.14,.5],'#9c5f4c');
      const lit=glow('#f6d79a');
      for(let i=0;i<5;i++){
        const bulb=ball(e,[-.86+i*.43,2.3,.62],[.16,.18,.16],'#f6d79a');
        bulb.render.meshInstances[0].material=lit;
      }
      box(e,[0,2.34,.62],[1.9,.02,.02],'#7d6349');
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
      for(let i=0;i<Math.round(w*d*.35);i++){
        const x=(Math.random()-.5)*(w-.8),z=(Math.random()-.5)*(d-.8);
        shape(e,'cone',[x,.2,z],[.3,.42,.3],i%4?'#87a273':'#9db98a');
        if(i%7===0)ball(e,[x+.2,.16,z+.15],[.18,.18,.18],['#d38e84','#e5ba77','#c9a0c4'][i%3]);
      }
      marks.push({x:def.x,z:def.z,hw:w/2,hd:d/2,y0:0,y1:.06,name:'grass',solid:false});
      return {entity:e,marks};
    }
    // A pond: sunken water, a stone rim, lilies, a rockery and a couple of fish.
    box(e,[0,-.08,0],[w-.6,.3,d-.6],'#5c7f80');
    const water=box(e,[0,.06,0],[w-.7,.06,d-.7],'#6f9ea0');
    const surface=new pc.StandardMaterial();
    surface.diffuse=new pc.Color().fromString('#79aaa8');
    surface.emissive=new pc.Color().fromString('#3f6668');
    surface.emissiveIntensity=.35;surface.gloss=.85;surface.useMetalness=true;surface.metalness=.15;
    surface.opacity=.88;surface.blendType=pc.BLEND_NORMAL;surface.update();
    water.render.meshInstances[0].material=surface;
    for(let i=0;i<Math.round((w+d)*1.4);i++){
      const angle=i/Math.round((w+d)*1.4)*Math.PI*2;
      const x=Math.cos(angle)*(w/2-.2),z=Math.sin(angle)*(d/2-.2);
      ball(e,[x,.13,z],[.5+Math.random()*.3,.34,.46],i%2?'#b0a78e':'#c0b79c');
    }
    for(const [lx,lz] of [[-w*.22,d*.16],[w*.18,-d*.2],[w*.3,d*.22],[-w*.3,-d*.12]]){
      cylinder(e,[lx,.11,lz],[.85,.04,.85],'#7f9e6a');
      if((lx+lz)>0)ball(e,[lx+.15,.2,lz+.1],[.28,.34,.28],'#dba0b4');
    }
    for(const [rx,rz] of [[-w*.36,-d*.3],[w*.38,d*.3]]){
      ball(e,[rx,.24,rz],[1.1,.9,.9],'#9d968a');ball(e,[rx+.4,.16,rz+.3],[.7,.5,.6],'#aaa397');
    }
    for(const [fx,fz,c] of [[w*.08,d*.05,'#d98a5f'],[-w*.14,-d*.08,'#e0b06a']]){
      const fish=ball(e,[fx,.1,fz],[.42,.14,.2],c);fish.setLocalEulerAngles(0,25,0);
    }
    marks.push({x:def.x,z:def.z,hw:w/2,hd:d/2,y0:0,y1:.2,name:'pond',solid:false});
    return {entity:e,marks};
  }
  // Shop fittings. Each returns {entity, half, top, name} so the room can give it a hitbox
  // and a Chinese label, the same way street furniture works outdoors.
  function fitting(parent,kind,tint,text) {
    const e=new pc.Entity('fitting-'+kind);parent.addChild(e);
    const jar=['#d8735f','#e2a955','#8fae6a','#c9707f','#e0c05e','#7f9ab0'];
    if(kind==='kitchen') {
      box(e,[0,.46,0],[5,.92,1.05],'#739487');
      box(e,[0,.96,0],[5.12,.12,1.15],'#f0e7d5');
      for(const x of [-1.9,-.95,0,.95,1.9]){
        box(e,[x,.5,.535],[.85,.73,.035],'#84a293');
        box(e,[x,.74,.57],[.25,.04,.055],'#ceb283');
      }
      box(e,[1.55,1.035,0],[1.1,.025,.76],'#6f8e96');
      cylinder(e,[1.55,1.2,-.36],[.07,.4,.07],'#a1b1ae');
      box(e,[1.55,1.4,-.22],[.07,.07,.34],'#a1b1ae');
      box(e,[-.8,1.035,0],[1.4,.035,.86],'#3c4747');
      for(const x of [-1.18,-.43])cylinder(e,[x,1.07,0],[.45,.03,.45],'#8b9c9d');
      cylinder(e,[-.8,1.23,0],[.57,.3,.57],'#c17658');
      cylinder(e,[-.8,1.4,0],[.62,.055,.62],'#e6d4ac');
      box(e,[-.8,2.35,-.25],[1.7,.2,.85],'#c0cbc3');
      for(const x of [-1.9,1.65])box(e,[x,2.12,-.38],[1,.7,.35],'#e2d6bd');
      label(e,'厨房',[0,1.8,-.5],1.1,.3,'#f7f0dc','#4a7364');
      return {entity:e,half:[2.56,.58],top:2.45,name:'stove'};
    }
    if(kind==='hardwarebay') {
      for(const x of [-1.8,1.8])box(e,[x,1.25,0],[.12,2.5,1.05],'#54776e');
      for(const y of [.18,1.15,2.15])box(e,[0,y,0],[3.7,.13,1.15],'#82918c');
      for(let i=0;i<7;i++)box(e,[-1.45+i*.47,.63,.05],[.32,.72,.75],i%2?'#be9569':'#d2ad7e');
      for(let i=0;i<5;i++)for(let j=0;j<2;j++)box(e,[-1.38+i*.65,1.34+j*.23,.06],[.59,.2,.65],'#bb7359');
      label(e,text??'五金建材',[0,2.55,.05],3.5,.5,'#e7d7ac','#36594f');
      return {entity:e,half:[1.9,.62],top:2.85,name:'hardware-rack'};
    }
    if(kind==='shelfunit') {
      box(e,[0,1.0,0],[2.2,2.0,.5],tint??'#b39468');
      for(let i=0;i<4;i++){
        box(e,[0,.36+i*.5,0],[2.1,.07,.46],'#d5bb92');
        for(let j=0;j<5;j++)box(e,[-.8+j*.4,.52+i*.5,.02],[.28,.26,.34],jar[(i*3+j)%6]);
      }
      return {entity:e,half:[1.1,.28],top:2.1,name:'shelf'};
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
      box(e,[0,1.05,0],[1.6,2.1,.7],'#cdd6d4');
      box(e,[0,1.1,.37],[1.4,1.8,.06],'#a8c6cc');
      box(e,[0,2.14,0],[1.7,.1,.78],'#9db0ad');
      for(let i=0;i<3;i++)box(e,[0,.6+i*.55,.3],[1.3,.06,.5],'#e2ebe8');
      for(let i=0;i<4;i++)box(e,[-.5+i*.34,.78,.28],[.22,.3,.24],i%2?'#e6e2d4':'#dfe8ea');
      return {entity:e,half:[.8,.38],top:2.2,name:'box'};
    }
    if(kind==='coffeebar') {
      box(e,[0,.52,0],[2.6,1.04,.8],tint??'#8d6f52');
      box(e,[0,1.08,0],[2.8,.1,.94],'#c9a97a');
      box(e,[-.7,1.34,-.1],[.6,.42,.4],'#9aa3a0');           // espresso machine
      cylinder(e,[-.7,1.14,.16],[.16,.1,.16],'#6f7a77');
      for(let i=0;i<4;i++)cylinder(e,[.1+i*.24,1.2,.1],[.16,.14,.16],'#efe7d2');
      box(e,[.95,1.28,-.1],[.4,.3,.3],'#c98d76');            // cake dome
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
      for(let i=0;i<4;i++)stock.push(pickable(e,[-.78+i*.52,1.06,-.2],[.3,.14,.3],'#e8c169','eggtart','cylinder'));
      for(let i=0;i<4;i++)stock.push(pickable(e,[-.78+i*.52,1.08,.18],[.3,.26,.3],'#e2c9a0','bun'));
      for(let i=0;i<3;i++)stock.push(pickable(e,[-.5+i*.5,1.44,-.02],[.28,.16,.28],'#e88fa6','donut','cylinder'));
      box(e,[0,1.02,-.36],[2.1,.03,.16],'#c9b083');
      return {entity:e,half:[1.15,.42],top:1.7,name:'cake',stock};
    }
    if(kind==='breadshelf') {
      box(e,[0,1.05,0],[2.2,2.1,.5],tint??'#a9855c');
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
      return {entity:e,half:[.9,.42],top:1.95,name:'box'};
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
      for(let i=0;i<3;i++)box(e,[-.45+i*.45,1.0,0],[.34,.16,.5],['#e6dcc4','#c9c1a8','#dcd2b8'][i]);
      box(e,[.5,1.06,-.2],[.2,.28,.16],'#9db08f');
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
      box(e,[0,.83,-.3],[.34,.06,.24],'#efe7d2');
      cylinder(e,[.3,.86,.2],[.16,.14,.16],'#e8e2cd');
      return {entity:e,half:[.68,.68],top:.86,name:'table'};
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
      for(const x of [-.5,.5])box(e,[x,.78,-.24],[.42,.4,.14],'#c6cfc0',[-14,0,0]);
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
        for(let i=0;i<9;i++)box(e,[-.8+i*.2,.53+row*.5,.1],[.13,.31,.28],spines[(row*4+i)%6]);
      }
      box(e,[0,2.54,0],[2.12,.1,.5],'#8d6b4d');
      return {entity:e,half:[1.0,.24],top:2.6,name:'shelf'};
    }
    if(kind==='readingdesk') {
      box(e,[0,.74,0],[1.7,.08,.9],tint??'#b08b60');
      for(const x of [-.76,.76])for(const z of [-.36,.36])box(e,[x,.37,z],[.09,.74,.09],'#8a6c49');
      box(e,[0,.5,0],[1.5,.05,.7],'#a97d55');
      box(e,[-.4,.79,.05],[.62,.03,.44],'#f4ecd8');
      box(e,[-.4,.81,.05],[.03,.04,.44],'#c9a97a');
      cylinder(e,[.5,.86,-.2],[.15,.2,.15],'#9db08f');
      box(e,[.62,.8,.2],[.34,.06,.24],'#d9c9a8');
      return {entity:e,half:[.85,.45],top:.82,name:'desk'};
    }
    if(kind==='scroll') {
      box(e,[0,1.8,0],[.7,1.5,.03],'#f2e8d0');
      for(const y of [1.06,2.54])cylinder(e,[0,y,0],[.05,.86,.05],'#8d6b4d',[0,0,90]);
      for(let i=0;i<4;i++)box(e,[0,2.24-i*.3,.03],[.22,.2,.02],'#5f7160');
      box(e,[0,1.2,.03],[.2,.2,.02],'#a4564a');
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
      box(e,[-.7,1.2,-.05],[.42,.24,.34],'#5f6a6c');       // till
      box(e,[-.7,1.35,-.05],[.34,.1,.28],'#8fc0c4',[-22,0,0]);
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
        box(e,[x,1.7,-.06],[.9,1.0,.04],'#cfe0dd');          // screens between the windows
        box(e,[x,1.24,.12],[.6,.1,.3],'#e8e2cd');
      }
      box(e,[0,2.24,0],[3.2,.12,.9],'#8d7a5f');
      for(const x of [-1.55,1.55])box(e,[x,1.7,0],[.12,1.1,.8],'#7f6d55');
      return {entity:e,half:[1.6,.4],top:2.3,name:'counter'};
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
      box(e,[0,.7,-.42],[2.0,.2,.46],'#fdf6e2');
      box(e,[0,.72,.34],[1.98,.12,.62],'#a8bfa5');
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
      water.render.meshInstances[0].material=glass;
      for(const [x,z,c] of [[-.4,.1,'#d98a5f'],[.3,-.08,'#e0b06a'],[.05,.14,'#c9707f']])ball(e,[x,1.2,z],[.26,.11,.14],c);
      for(const x of [-.6,.2,.6])cylinder(e,[x,1.0,-.1],[.09,.42,.09],'#7f9e6a');
      box(e,[0,1.68,0],[1.86,.1,.72],'#5f6a6c');
      return {entity:e,half:[.9,.36],top:1.75,name:'fish'};
    }
    if(kind==='cupshelf') {
      box(e,[0,1.3,0],[1.8,.06,.34],tint??'#a97d55');
      box(e,[0,.9,0],[1.8,.06,.34],tint??'#a97d55');
      for(const x of [-.85,.85])box(e,[x,1.1,0],[.08,.5,.32],'#8a6c49');
      for(let i=0;i<5;i++)cylinder(e,[-.6+i*.3,1.4,0],[.2,.16,.2],['#efe7d2','#c9dce0','#e0c69c'][i%3]);
      for(let i=0;i<4;i++)cylinder(e,[-.45+i*.3,1.0,0],[.22,.14,.22],'#f2e8d2');
      return {entity:e,half:[.9,.18],top:1.5,name:'cup'};
    }
    box(e,[0,.5,0],[1,1,.6],tint??'#b0a98f');
    return {entity:e,half:[.5,.3],top:1};
  }
  return {material,shape,box,ball,cylinder,tube,glow,label,pickable,person,tree,building,lantern,furniture,streetProp,groundPatch,fitting};
}
