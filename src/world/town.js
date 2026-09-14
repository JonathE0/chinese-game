import * as pc from 'playcanvas';
import {createModels} from './models.js';
import worldData from '../content/world.json' with {type:'json'};
import npcs from '../content/npcs.json' with {type:'json'};
import rooms from '../content/rooms.json' with {type:'json'};
import {buildRoom,ROOM_OFFSET} from './interior.js';
import {Registry} from './registry.js';
import {walkClear,rotatedHalf} from './navigation.js';
import {pavingMaterial} from './paving.js';
import {Daylight} from './daylight.js';
import {initIdle,animateIdle,restIdle} from './idle.js';
import objectNames from '../content/objects.json' with {type:'json'};
import {isTyping,queueLook,drainLook} from '../core/input.js';
import {Toybox,Container} from './physics.js';
import {NightMarket,NIGHT_PITCHES} from './stalls.js';
import {surfaceHeight,offersSurface,canStack,fitsOn,decorOn,placementProblem} from '../core/surfaces.js';
import sites from '../content/sites.json' with {type:'json'};
import {buildCity,buildStationEntrance,CITY,CITY_OFFSET} from './city.js';

const NAMES=objectNames.objects;
const GRAVITY=19;
const JUMP=6.4;   // enough to clear a bench or a planter, not a boundary wall
const SEAT_DROP=.66;    // how far the body sinks so the hips land on the seat

export class Town {
  constructor(canvas,{onInteract,onNear,onFrame,onLook,onCollect}) {
    this.data=structuredClone(worldData);this.onInteract=onInteract;this.onNear=onNear;this.onFrame=onFrame;this.onLook=onLook;this.onCollect=onCollect;this.keys=new Set();this.paused=true;this.target=null;this.clock=0;
    this.app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,powerPreference:'high-performance'}});
    this.app.graphicsDevice.maxPixelRatio=Math.min(devicePixelRatio,1.8);
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientLight=new pc.Color(.59,.62,.58);
    this.app.scene.toneMapping=pc.TONEMAP_ACES;
    const sun=new pc.Entity('sun');sun.addComponent('light',{type:'directional',color:new pc.Color(1,.96,.88),intensity:1.05,castShadows:true,shadowDistance:75,shadowResolution:2048,shadowBias:.25,normalOffsetBias:.08});sun.setEulerAngles(48,-25,0);this.app.root.addChild(sun);this.sun=sun;
    this.camera=new pc.Entity('camera');this.camera.addComponent('camera',{clearColor:new pc.Color(.77,.84,.79),fov:43,nearClip:.1,farClip:200});this.app.root.addChild(this.camera);
    this.m=createModels(this.app);this.root=new pc.Entity('town');this.app.root.addChild(this.root);this.actors=new Map();this.buildings=new Map();
    this.registry=new Registry();this.playerY=0;this.velocityY=0;this.grounded=true;this.looking=null;
    this.build();this.registerTown();
    this.player=this.m.person(this.root,'#e9bb78',[...this.data.spawn.slice(0,1),0,this.data.spawn[1]],false);
    this.player.pack=this.m.box(this.player.upper,[0,1.05,-.25],[.38,.45,.2],'#91a69a');
    // The tourist is seen from behind their own eyes; third person stays available so worn items are visible.
    this.eyeHeight=1.62;this.view='first';this.yaw=0;this.pitch=-4;this.sensitivity=.12;
    this.drag={id:null,x:0,y:0};this.stick={id:null,ox:0,oy:0,dx:0,dz:0};
    this.lookPending={x:0,y:0};this.speedScale=1;this.seated=null;this.roomOpen=new Map();
    initIdle(this.player,.37);
    this.place='town';this.rooms=new Map();this.buildRooms();this.registerRooms();
    // Loose objects hang off their own node at the origin, so a body's coordinates are the same
    // numbers the collision registry uses whichever place it is rolling around in.
    this.toyRoot=new pc.Entity('loose');this.app.root.addChild(this.toyRoot);
    this.toys=new Toybox({registry:this.registry,models:this.m});
    this.toys.outOfBounds=(place,x,z)=>!this.withinPlace(place,x,z,.15);
    this.buildContainers();
    this.market=new NightMarket({models:this.m,parent:this.root,pitches:NIGHT_PITCHES,registry:this.registry,
      player:()=>this.place==='town'?this.player.entity.getPosition():null});
    this.daylight=new Daylight(this.app,sun,this.camera);
    for(const material of this.lampMaterials)this.daylight.addLamp(material);
    this.market.onLit=material=>this.daylight.addLamp(material);
    this.daylight.apply();
    this.applyView();this.placeCamera(this.player.entity.getPosition());
    this.bind(canvas);this.app.on('update',dt=>this.update(dt));
    // PlayCanvas fires postUpdate on app.systems, not on the app, so an app-level listener for it
    // never runs. `prerender` is the engine's real late hook: after every update, and before the
    // hierarchy is synced and drawn — so the camera we place here is the camera this frame uses.
    this.app.on('prerender',()=>this.lateUpdate());this.app.start();
    addEventListener('resize',()=>this.app.resizeCanvas());
  }
  build() {
    const {box,cylinder,ball,tree,building,lantern,label,person,streetProp}=this.m;const p=this.root;
    this.lampMaterials=[];
    this.stationMarks=buildStationEntrance(this.m,p,this.lampMaterials);
    const lamp=(...args)=>{const made=lantern(...args);this.lampMaterials.push(made.material);return made;};
    box(p,[0,-.35,-6],[150,.6,150],'#a9b78c');
    // Each district gets its own paving, so the city reads as separate places joined by streets.
    for(const d of this.data.districts){
      const [x0,x1]=d.bounds.x,[z0,z1]=d.bounds.z,cx=(x0+x1)/2,cz=(z0+z1)/2,w=x1-x0,h=z1-z0;
      const pavement=box(p,[cx,-.04,cz],[w-1,.12,h-1],'#d9cfb5');
      pavement.render.meshInstances[0].material=pavingMaterial(this.app,w-1,h-1);
    }
    // Ground dressing goes down before the buildings so paths run under their steps.
    this.groundMarks=[];
    for(const def of this.data.ground??[]){
      const made=this.m.groundPatch(p,def);
      this.groundMarks.push(...made.marks);
    }
    for(const b of this.data.buildings){
      const made=building(p,b);
      this.buildings.set(b.id,made);
      // A shop that has not been built yet is simply not in the world; the hoarding is.
      if(b.site)made.enabled=false;
    }
    this.hoardings=new Map();
    for(const site of sites.sites)this.hoardings.set(site.id,this.buildHoarding(site));
    for(const [x,z]of this.data.trees)tree(p,x,z,1.15);
    this.props=this.data.props.map(def=>{
      const made=streetProp(p,def.kind,def.tint);
      if(made.material)this.lampMaterials.push(made.material);
      made.entity.setLocalPosition(def.x,0,def.z);
      made.entity.setLocalEulerAngles(0,def.rot??0,0);
      return {...def,...made};
    });
    // A fountain and a lantern line keep the original square as the heart of the city.
    cylinder(p,[0,.2,1.8],[4.2,.45,4.2],'#b6b499');cylinder(p,[0,.45,1.8],[3.75,.2,3.75],'#719f99');
    cylinder(p,[0,.8,1.8],[.5,1,.5],'#c4bda2');cylinder(p,[0,1.25,1.8],[1.8,.18,1.8],'#d4c9ac');cylinder(p,[0,1.36,1.8],[1.55,.05,1.55],'#8cb5ad');ball(p,[0,1.56,1.8],[.28,.4,.28],'#c3cec1');
    for(const x of [-12,12]) {box(p,[x,2.25,0],[.18,4.5,.18],'#866b52');box(p,[x,4.4,0],[1.3,.13,.13],'#866b52');lamp(p,x-.47,4.05,0);lamp(p,x+.47,4.05,0);}
    for(let x=-11;x<=11;x+=2.2)lamp(p,x,5.9-Math.sin((x+11)/22*Math.PI)*.8,-5);
    box(p,[0,6.12,-5],[24,.025,.025],'#8b7b62');
    for(const x of [-10,10]){box(p,[x,.7,-4.1],[3.2,1.4,1.15],'#b88b63');box(p,[x,1.44,-4.1],[3.5,.13,1.3],'#e6cf9e');}
    for(let i=0;i<3;i++)cylinder(p,[-10.8+i*.7,1.65,-4.1],[.3,.28,.3],'#ede4ce');
    for(let i=0;i<3;i++)box(p,[9.2+i*.65,1.68,-4.1],[.42,.38,.38],['#d9ae68','#91a494','#c98568'][i]);
    for(const def of this.data.npcs) {const info=npcs.find(n=>n.id===def.id);this.actors.set(def.id,person(p,info.color,[def.x,0,def.z]));}
    // Townsfolk who are just going about their day. They are scenery, and a word to learn.
    this.people=(this.data.people??[]).map(def=>{
      const made=person(p,def.color,[def.x,0,def.z]);
      made.entity.setLocalEulerAngles(0,def.rot??0,0);
      return {...def,...made};
    });
    const [ax,az]=this.data.ambient;this.friends=[person(p,'#d1a075',[ax,0,az]),person(p,'#a2ad8d',[ax-1.3,0,az+.5])];this.friends[0].entity.setEulerAngles(0,-60,0);this.friends[1].entity.setEulerAngles(0,110,0);
    // A gateway on the way to your front door: the board hangs well above head height.
    label(p,'欢迎来到青禾',[0,3.3,17],4,.7);box(p,[0,3.72,17],[4.75,.14,.22],'#8b795b');
    for(const x of [-2.2,2.2])box(p,[x,1.9,17],[.17,3.8,.17],'#8b795b');
    this.buildGates();
    this.buildClosedSigns();
    for(let i=0;i<9;i++)this.m.shape(p,'cone',[-60+i*16,-.5,-58],[16,10+(i%3)*4,18],i%2?'#91a88d':'#9bb196');
    for(let i=0;i<7;i++)this.m.shape(p,'cone',[-70+i*22,-.5,34],[18,9+(i%3)*4,16],i%2?'#9bb196':'#91a88d');
  }
  /**
   * The city is built the first time somebody rides out to it, and then kept. Building it costs
   * a few hundred meshes, which is not something to spend on every player who never buys a
   * ticket — but rebuilding it on every journey would put a stutter in the middle of the ride.
   */
  ensureCity() {
    if(this.rooms.has('city'))return this.rooms.get('city');
    const built=buildCity(this.m,this.app.root);
    built.root.enabled=false;
    for(const material of built.lamps)this.daylight.addLamp(material);
    const room={id:'city',data:CITY.place,root:built.root,fittings:[],staff:[],
      index:-1,offsetX:CITY_OFFSET,props:new Map(),people:built.people};
    this.rooms.set('city',room);
    this.registry.clear('city');
    this.mark('city',CITY_OFFSET,0,CITY.place.size[0]/2,CITY.place.size[1]/2,-.2,.02,'path',false);
    for(const mark of built.marks)
      this.mark('city',CITY_OFFSET+mark.x,mark.z,mark.hw,mark.hd,mark.y0,mark.y1,mark.name);
    for(const person of built.people)
      this.mark('city',CITY_OFFSET+person.x,person.z,.52,.48,0,1.95,'person');
    return room;
  }
  /** Step out of the train and into 云海. */
  enterCity() {this.ensureCity();return this.enterRoom('city');}
  leaveCity() {return this.place==='city'?this.leaveRoom():false;}

  /** Boards, scaffold poles and a notice: what stands on a lot before the shop does. */
  buildHoarding(site) {
    const {box,cylinder,label}=this.m;
    const root=new pc.Entity('site-'+site.id);
    root.setLocalPosition(site.x,0,site.z);root.setLocalEulerAngles(0,site.rotation??0,0);
    this.root.addChild(root);
    for(const side of [-1,1]){
      box(root,[side*3.6,1.1,0],[.3,2.2,5.4],'#b08a60');
      for(let i=0;i<4;i++)box(root,[side*3.6,.5+i*.55,0],[.36,.1,5.6],'#8d6b4d');
    }
    box(root,[0,1.1,-2.6],[7.4,2.2,.3],'#b08a60');
    for(const x of [-2.4,0,2.4])cylinder(root,[x,1.3,-2.5],[.14,2.6,.14],'#8f9694');
    box(root,[0,2.35,-2.6],[7.6,.18,.5],'#8d6b4d');
    // A stack of what the job still needs, and the notice board on the front.
    for(let i=0;i<3;i++)box(root,[-2.2+i*.1,.28+i*.34,1.4],[1.4,.32,.9],i%2?'#a9784c':'#b0654f');
    box(root,[2.2,.4,1.2],[1.2,.8,1.0],'#8fa9b8');
    box(root,[0,1.5,2.55],[2.6,1.3,.14],'#7f6d55');
    label(root,'工地',[0,1.5,2.64],2.2,.9,'#f2e2c6','#a4564a');
    return root;
  }
  /** Once it is built the hoarding comes down and the shop is there. */
  revealSite(siteId) {
    const site=sites.sites.find(entry=>entry.id===siteId);
    if(!site)return false;
    const hoarding=this.hoardings?.get(siteId);
    if(hoarding)hoarding.enabled=false;
    for(const building of this.data.buildings)
      if(building.site===siteId)this.buildings.get(building.id).enabled=true;
    this.siteBuilt??=new Set();this.siteBuilt.add(siteId);
    for(const [id,sign] of this.closedSigns??[])
      if(sign.siteGate===siteId)sign.enabled=!this.roomOpen.get(id);
    return true;
  }
  /** A paifang arch marks each district edge. The low wall stays; only the door opens. */
  buildGates() {
    const {box,cylinder,ball,label}=this.m,p=this.root;
    this.gates=new Map();
    for(const d of this.data.districts){
      if(!d.gate)continue;
      const g=d.gate,span=g.span??5,rot=g.axis==='x'?90:0;
      const root=new pc.Entity('gate-'+d.id);root.setLocalPosition(g.x,0,g.z);root.setLocalEulerAngles(0,rot,0);p.addChild(root);
      // A boundary wall, low enough to see over and too high to jump.
      const wallBoxes=[];
      for(const side of [-1,1]){
        const from=span-.2,to=g.half;
        if(to<=from+.4)continue;
        const mid=(from+to)/2,length=to-from;
        box(root,[side*mid,.7,0],[length,1.4,.34],'#cbbb9a');
        box(root,[side*mid,1.46,0],[length+.15,.14,.5],'#a8967a');
        // Two rows of hedge, tall enough that the wall you can see is the wall you cannot jump.
        for(let x=from+.7;x<to-.25;x+=1.2)ball(root,[side*x,1.92,0],[1.34,1.04,.94],'#93a97e');
        for(let x=from+1.3;x<to-.25;x+=1.2)ball(root,[side*x,2.16,0],[1.08,.78,.8],'#87a074');
        const world=g.axis==='x'
          ? {x:g.x,z:g.z+side*mid,hw:.28,hd:length/2}
          : {x:g.x+side*mid,z:g.z,hw:length/2,hd:.28};
        wallBoxes.push(this.mark('town',world.x,world.z,world.hw,world.hd,0,2.5,'hedge',true));
      }
      for(const side of [-1,1]){
        cylinder(root,[side*span,2.4,0],[.62,4.8,.62],'#8d6b4d');
        box(root,[side*span,.3,0],[1.2,.6,1.2],'#b6a486');
        box(root,[side*span,4.05,0],[1.0,.22,1.0],'#6f8570');
      }
      box(root,[0,4.75,0],[span*2.5,.42,.72],'#8d6b4d');
      box(root,[0,5.16,0],[span*2.7,.3,1.15],'#6f8570');
      box(root,[0,5.42,0],[span*2.4,.22,.85],'#5d7360');
      label(root,d.zh,[0,3.9,.46],3.9,.78);
      // The door itself: two leaves that vanish once the district is earned.
      const door=new pc.Entity('gate-door');root.addChild(door);
      for(const side of [-1,1]){
        box(door,[side*span/2,1.35,0],[span-.25,2.7,.24],'#a3855f');
        for(let i=0;i<3;i++)box(door,[side*span/2+(i-1)*span*.3,1.35,.16],[.15,2.5,.1],'#8a6c49');
        ball(door,[side*.42,1.5,.2],[.24,.24,.16],'#d8c07e');
      }
      const doorBox=g.axis==='x'
        ? this.mark('town',g.x,g.z,.4,span,0,2.8,'door',true)
        : this.mark('town',g.x,g.z,span,.4,0,2.8,'door',true);
      this.gates.set(d.id,{district:d,root,door,box:doorBox,wallBoxes});
    }
  }
  /** Opening a gate removes its barrier and its hitbox. */
  setUnlocked(id,open) {
    const gate=this.gates?.get(id);if(!gate)return false;
    gate.door.enabled=!open;gate.box.solid=!open;
    return true;
  }
  inAnyDistrict(x,z) {
    for(const d of this.data.districts){
      const [x0,x1]=d.bounds.x,[z0,z1]=d.bounds.z;
      if(x>=x0&&x<=x1&&z>=z0&&z<=z1)return true;
    }
    return false;
  }
  districtAt(x,z) {
    for(const d of this.data.districts){
      const [x0,x1]=d.bounds.x,[z0,z1]=d.bounds.z;
      if(x>=x0&&x<=x1&&z>=z0&&z<=z1)return d;
    }
    return this.data.districts[0];
  }
  /** Register a box so it can be bumped into, stood on, and read. */
  mark(place,x,z,hw,hd,y0,y1,nameId,solid=true) {
    return this.registry.add({place,x,z,hw,hd,y0,y1,solid,name:nameId?{id:nameId,...NAMES[nameId]}:null});
  }
  /** The same, for something round: a basin, a trunk, a bin. The hitbox follows the stone. */
  markDisc(place,x,z,radius,y0,y1,nameId,solid=true) {
    return this.registry.add({place,x,z,radius,y0,y1,solid,name:nameId?{id:nameId,...NAMES[nameId]}:null});
  }
  /** Plaques that hang on the door of a shop that has not opened yet. */
  buildClosedSigns() {
    const {box,label}=this.m;
    this.closedSigns=new Map();
    for(const [id,data] of Object.entries(rooms)){
      if(!data.opens)continue;
      const building=this.data.buildings.find(b=>b.id===data.building);
      const face=(building?.rotation??0)===180?-1:1;
      const sign=new pc.Entity('closed-'+id);
      sign.setLocalPosition(data.door.x,0,data.door.z+face*.12);
      sign.setLocalEulerAngles(0,face<0?180:0,0);
      this.root.addChild(sign);
      for(const x of [-.5,.5])box(sign,[x,2.62,0],[.035,.42,.035],'#7d6349');
      box(sign,[0,2.28,0],[1.5,.62,.07],'#8d6b4d');
      label(sign,'暂停营业',[0,2.28,.05],1.32,.48,'#f0e2c6','#a4564a');
      // A shop that has not been built yet has no door to hang a sign on: the hoarding says it.
      sign.siteGate=building?.site??null;
      if(sign.siteGate)sign.enabled=false;
      this.closedSigns.set(id,sign);
    }
  }
  registerTown() {
    const d=this.data;
    for(const dist of d.districts){
      const [x0,x1]=dist.bounds.x,[z0,z1]=dist.bounds.z;
      this.mark('town',(x0+x1)/2,(z0+z1)/2,(x1-x0)/2,(z1-z0)/2,-.1,.05,'floor',false);
    }
    for(const b of d.buildings){
      // A rotated building has its door and sign on the other face.
      const face=(b.rotation??0)===180?-1:1,front=b.z+face*(b.depth/2+.3);
      this.mark('town',b.x,b.z,b.width/2+.35,b.depth/2+.35,0,b.height+1.4,b.object??'wall');
      this.mark('town',b.x,front,.7,.16,0,2.2,'door',false);
      this.mark('town',b.x,front+face*.02,1.8,.1,b.height-.9,b.height-.2,'sign',false);
    }
    for(const [x,z] of d.trees){
      this.markDisc('town',x,z,.98,0,.35,'tree');
      this.markDisc('town',x,z,.22,.35,2.4,'tree');
      this.markDisc('town',x,z,1.5,1.55,4.3,'tree');
    }
    // Street furniture is named from the same table the world data uses.
    const propName={bench:'bench',bin:'bin',streetlight:'streetlight',bicycle:'bicycle',planter:'planter',
      crate:'box',fruitstand:'fruit',cafetable:'table',chair:'chair',parasol:'umbrella',bollard:'stone',
      awning:'awning',sign:'sign'};
    const round=new Set(['bin','bollard','cafetable','parasol','streetlight']);
    for(const prop of this.props){
      const [hw,hd]=prop.half,[worldHW,worldHD]=rotatedHalf(prop.half,prop.rot??0);
      if(round.has(prop.kind))this.markDisc('town',prop.x,prop.z,hw,0,prop.top,propName[prop.kind]??null,!prop.soft);
      else this.mark('town',prop.x,prop.z,worldHW,worldHD,0,prop.top,propName[prop.kind]??null,!prop.soft);
    }
    // The fountain is round, so its hitbox is too: a square one stuck out well past the stone.
    for(const site of sites.sites)
      this.mark('town',site.x,site.z,3.8,2.9,0,2.4,'wall');
    for(const mark of this.stationMarks??[])
      this.mark('town',mark.x,mark.z,mark.hw,mark.hd,mark.y0,mark.y1,mark.name);
    this.markDisc('town',0,1.8,2.12,0,.46,'fountain');
    this.markDisc('town',0,1.8,.95,.46,1.75,'fountain',false);
    // Only the posts are in the way; the board is high enough to walk under.
    for(const x of [-2.2,2.2])this.mark('town',x,17,.14,.14,0,3.8,'sign');
    this.mark('town',0,17,2,.12,2.95,3.8,'sign');
    for(const x of [-10,10])this.mark('town',x,-4.1,1.75,.7,0,1.5,'counter');
    for(const x of [-12,12]){
      this.markDisc('town',x,0,.3,0,4.6,'streetlight');
      for(const off of [-.47,.47])this.mark('town',x+off,0,.25,.25,3.7,4.4,'lantern',false);
    }
    for(let x=-11;x<=11;x+=2.2)this.mark('town',x,-5,.3,.3,5.4-Math.sin((x+11)/22*Math.PI)*.8,6.2-Math.sin((x+11)/22*Math.PI)*.8,'lantern',false);
    for(const m of this.groundMarks??[])this.mark('town',m.x,m.z,m.hw,m.hd,m.y0,m.y1,m.name,m.solid);
    for(const one of this.people)this.mark('town',one.x,one.z,.52,.48,0,1.95,'person');
    for(const npc of d.npcs)this.mark('town',npc.x,npc.z,.52,.48,0,1.95,'person');
  }
  registerRooms() {
    for(const room of this.rooms.values()){
      const {data,offsetX}=room,[w,d]=data.size,h=data.height;
      this.registry.clear(room.id);
      this.mark(room.id,offsetX,0,w/2,d/2,-.1,.02,'floor',false);
      this.mark(room.id,offsetX-w/2-.15,0,.2,d/2,0,h,'wall');
      this.mark(room.id,offsetX+w/2+.15,0,.2,d/2,0,h,'wall');
      this.mark(room.id,offsetX,-d/2-.15,w/2+.2,.2,0,h,'wall');
      this.mark(room.id,offsetX,0,w/2+.2,d/2+.2,h,h+.2,'wall');
      this.mark(room.id,offsetX,d/2+.15,.85,.2,h-1.1,h,'wall');
      for(let i=0;i<4;i++)this.mark(room.id,offsetX,-d/2+1.4+i*((d-2.8)/3),w/2,.11,h-.14,h+.02,'wall');
      for(const side of [-1,1])this.mark(room.id,offsetX+side*(.85+(w-1.7)/4),d/2+.15,(w-1.7)/4,.2,0,h,'wall');
      this.mark(room.id,offsetX,d/2+.15,.85,.2,0,.6,'door',false);
      if(data.annex)this.mark(room.id,offsetX+data.annex.x-.13,data.annex.z,.1,.63,0,2.2,'door',false);
      if(data.window)for(const x of data.window)this.mark(room.id,offsetX+x,-d/2+.06,.78,.1,1.1,2.6,'window',false);
      for(const fitting of room.fittings??[])
        this.registry.add({place:room.id,x:offsetX+fitting.x,z:fitting.z,hw:fitting.hw,hd:fitting.hd,
          radius:fitting.radius??null,y0:0,y1:fitting.top,solid:true,
          name:fitting.name?{id:fitting.name,...NAMES[fitting.name]}:null});
      if(data.desk)this.mark(room.id,offsetX+data.desk.x,data.desk.z,.45,.95,0,1.2,'desk');
      if(data.lectern){
        this.mark(room.id,offsetX+data.lectern.x,data.lectern.z,1.15,.5,0,1.3,'counter');
        for(const dx of [-2.1,2.1])this.mark(room.id,offsetX+data.lectern.x+dx,data.lectern.z-.35,.2,.78,0,2.2,'shelf');
      }
    }
  }
  buildRooms() {
    Object.entries(rooms).forEach(([id,data],index)=>{
      const built=buildRoom(this.m,this.app.root,data,index);
      built.root.enabled=false;
      for(const fitting of built.fittings)if(fitting.material)this.lampMaterials.push(fitting.material);
      const staff=(data.staff??[]).map(def=>{
        const made=this.m.person(built.root,def.color,[def.path[0][0],0,def.path[0][1]]);
        return initIdle({...def,...made,leg:0,target:1,wait:Math.random()*2,x:def.path[0][0],z:def.path[0][1]});
      });
      this.rooms.set(id,{id,data,root:built.root,ceiling:built.ceiling,fittings:built.fittings,staff,index,offsetX:ROOM_OFFSET*(index+1),props:new Map()});
    });
  }
  /** Everything the tourist can press E on, in whichever place they are standing. */
  targets() {
    if(this.place==='town') {
      const list=[...this.actors].map(([id,actor])=>{const p=actor.entity.getPosition();return {id,x:p.x,z:p.z,radius:3.2,label:npcs.find(n=>n.id===id)?.zh??id};});
      // The two neighbors who provide background chatter can also be greeted, but only when the
      // player chooses to walk over and interact with them.
      const [ax,az]=this.data.ambient;
      list.push({id:'friend-a',x:ax,z:az,radius:2.8,label:'和邻居打招呼'});
      list.push({id:'friend-b',x:ax-1.3,z:az+.5,radius:2.8,label:'和邻居打招呼'});
      for(const room of this.rooms.values()){
        // A back room is reached from inside; the city is reached by train. Neither has a door
        // on the square, and asking for one is how you get an exception every frame.
        if(room.data.interiorOnly||room.data.outdoor)continue;
        const shut=room.data.opens&&!this.roomOpen.get(room.id);
        list.push({id:(shut?'closed:':'door:')+room.id,x:room.data.door.x,z:room.data.door.z,radius:2.4,
          label:shut?'看看告示 · 暂停营业':room.data.enterLabel,wide:true});
      }
      for(const [id,gate] of this.gates)if(gate.box.solid)
        list.push({id:'gate:'+id,x:gate.district.gate.x,z:gate.district.gate.z,radius:3.6,label:'看看告示',wide:true});
      for(const site of sites.sites){
        if(this.siteBuilt?.has(site.id))continue;
        list.push({id:'site:'+site.id,x:site.x,z:site.z+(site.rotation===180?-3.4:3.4),
          radius:3.0,label:'看看工地',wide:true});
      }
      // The stair down to the metro, on the far side of the square from your front door.
      list.push({id:'metro',x:CITY.station.x,z:CITY.station.z-3.0,radius:2.8,
        label:CITY.station.label,wide:true});
      for(const pitch of this.market.open)
        list.push({id:'shop:'+pitch.shop,x:pitch.spot[0],z:pitch.spot[1],radius:2.6,label:'看看'+pitch.zh,wide:true});
      this.addLooseTargets(list);
      return list;
    }
    const room=this.rooms.get(this.place),[,d]=room.data.size;
    // Sitting down narrows the world to the table you are at: stand up, or use what is on it.
    if(this.seated){
      const seat=room.fittings[this.seated.index];
      const list=[{id:'stand',x:room.offsetX+seat.x,z:seat.z,radius:2.4,label:'站起来',wide:true}];
      for(const [index,fitting] of (room.fittings??[]).entries())
        if(fitting.action&&Math.hypot(fitting.x-seat.x,fitting.z-seat.z)<2.4)
          list.push({id:fitting.action,x:room.offsetX+fitting.x,z:fitting.z,radius:2.4,label:fitting.label??'看看',wide:true,seatIndex:index});
      return list;
    }
    if(room.data.outdoor)return this.cityTargets(room);
    // A back room leads back into the house it belongs to, not out onto the street.
    const out=room.data.returnPlace?'door:'+room.data.returnPlace:'leave';
    const list=[{id:out,x:room.offsetX+room.data.exit[0],z:room.data.exit[1],radius:2.2,
      label:room.data.returnLabel??'出去',wide:true}];
    if(room.data.annex)list.push({id:'door:'+room.data.annex.room,x:room.offsetX+room.data.annex.x-.2,
      z:room.data.annex.z,radius:1.7,label:room.data.annex.label??'进去',wide:true});
    if(room.data.lectern){
      const counter=room.data.lectern;
      list.push({
        id:counter.shop?'shop:'+counter.shop:counter.panel?'panel:'+counter.panel:'lectern',
        x:room.offsetX+counter.x,z:counter.z+1.6,radius:2.6,label:counter.label,wide:true});
    }
    for(const [index,fitting] of (room.fittings??[]).entries()){
      if(fitting.action)list.push({id:fitting.action,x:room.offsetX+fitting.x,z:fitting.z,radius:1.9,label:fitting.label??'看看',wide:true});
      if(fitting.seat!==undefined)list.push({id:'sit:'+index,x:room.offsetX+fitting.x,z:fitting.z,radius:1.7,label:'坐下',wide:true});
    }
    for(const member of room.staff??[])
      list.push({id:'staff:'+member.id,x:room.offsetX+member.x,z:member.z,radius:2.6,label:'和'+member.zh+'说话',wide:false});
    if(room.data.desk)list.push({id:'studydesk',x:room.offsetX+room.data.desk.x+1.1,z:room.data.desk.z,radius:2.2,label:room.data.desk.label,wide:true});
    // A bed you own is somewhere to sleep, and sleeping is how you choose the time of day.
    for(const prop of room.props.values())if(prop.kind==='bed')
      list.push({id:'sleep',x:room.offsetX+prop.x,z:prop.z,radius:2.2,label:'睡觉 · 选时间',wide:true});
    if(room.data.decoratable)list.push({id:'decorate',x:room.offsetX,z:-d/2+1.6,radius:2.4,label:'布置房间',wide:true});
    this.addLooseTargets(list);
    return list;
  }
  /** Out in 云海: the way home, the people on the street, the shop window, the taxis and the noodle counter. */
  cityTargets(room) {
    const list=[{id:'metro:home',x:room.offsetX+room.data.exit[0],z:room.data.exit[1],
      radius:3.0,label:room.data.returnLabel,wide:true}];
    if(CITY.department)list.push({id:'door:'+CITY.department.room,x:room.offsetX+CITY.department.x,z:CITY.department.z,radius:2.6,label:CITY.department.label,wide:true});
    for(const person of room.people??[])
      list.push({id:'city:'+person.id,x:room.offsetX+person.x,z:person.z,radius:3.0,
        label:'和'+person.zh+'说话',wide:false});
    for(const prop of CITY.props)if(prop.kind==='citykiosk')
      list.push({id:'shop:kiosk',x:room.offsetX+prop.x+1.6,z:prop.z,radius:2.6,label:'看看便利店',wide:true});
    CITY.props.forEach((prop,i)=>{if(prop.kind==='taxi')
      list.push({id:'taxi:'+i,x:room.offsetX+prop.x,z:prop.z,radius:2.8,label:'打车 · TAXI',wide:true});});
    if(CITY.noodles)list.push({id:'noodles',x:room.offsetX+CITY.noodles.x,z:CITY.noodles.z,radius:2.6,label:CITY.noodles.label,wide:true});
    this.addLooseTargets(list);
    return list;
  }
  /** Containers you can take from, and whatever someone already dropped on the floor. */
  addLooseTargets(list) {
    if(this.toys.held)return;
    for(const [index,container] of this.containers.entries()){
      if(container.place!==this.place||!container.ready())continue;
      list.push({id:'take:'+index,x:container.x,z:container.z,radius:2.0,label:'拿一个'+container.zh,wide:true});
    }
    const pos=this.player.entity.getPosition();
    const loose=this.toys.nearest(this.place,pos.x,pos.z,this.playerY+1);
    if(loose)list.push({id:'grab',x:loose.x,z:loose.z,radius:1.6,label:'捡起来',wide:true});
  }
  /** Whether a shop has opened yet. Locked rooms keep their door shut and hang a sign. */
  setRoomOpen(id,open) {
    this.roomOpen.set(id,!!open);
    const sign=this.closedSigns?.get(id);
    if(sign)sign.enabled=!open&&(!sign.siteGate||!!this.siteBuilt?.has(sign.siteGate));
    return open;
  }
  // --- sitting ----------------------------------------------------------
  sit(index) {
    if(this.place==='town'||this.seated)return false;
    const room=this.rooms.get(this.place),seat=room.fittings?.[index];
    if(!seat||seat.seat===undefined)return false;
    const from=this.player.entity.getPosition().clone();
    const bodyYaw=(seat.rot??0)+180;
    this.seated={index,from:{x:from.x,z:from.z},bodyYaw};
    this.playerY=seat.seat-SEAT_DROP;this.velocityY=0;this.grounded=true;
    this.player.entity.setPosition(room.offsetX+seat.x,this.playerY,seat.z);
    this.yaw=bodyYaw;this.pitch=-8;
    restIdle(this.player);
    this.player.legs.forEach(leg=>leg.setLocalEulerAngles(78,0,0));
    this.player.arms.forEach((arm,i)=>arm.setLocalEulerAngles(14,0,i?-5:5));
    this.clearNearest();this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  stand() {
    if(!this.seated)return false;
    const {from}=this.seated;this.seated=null;
    const spot=this.canMove(from.x,from.z,0)?from:(this.nearestFreeSpot(from.x,from.z)??from);
    this.playerY=0;this.velocityY=0;this.grounded=true;
    this.player.entity.setPosition(spot.x,0,spot.z);
    this.player.legs.forEach(leg=>leg.setLocalEulerAngles(0,0,0));
    this.player.arms.forEach(arm=>arm.setLocalEulerAngles(0,0,0));
    this.clearNearest();this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  // --- furnishing -------------------------------------------------------
  /** Rebuild a room's furniture from saved records. Returns the records it could place. */
  furnish(id,records) {
    const room=this.rooms.get(id);if(!room)return [];
    for(const uid of [...room.props.keys()])this.removeProp(id,uid);
    const kept=[];
    for(const record of records??[]){if(this.addProp(id,record))kept.push(record);}
    return kept;
  }
  addProp(id,record) {
    const room=this.rooms.get(id);if(!room)return null;
    const entity=this.m.furniture(room.root,record.kind,record.color);
    // Anything that is a lamp actually lights the room, at roughly the height of its shade.
    const lampHeight={lamp:1.2,ceilinglamp:2.0,desklamp:.75}[record.kind];
    if(lampHeight!==undefined){
      const light=new pc.Entity('lamp-light');
      const reach=record.kind==='desklamp'?4:record.kind==='ceilinglamp'?9:7;
      light.addComponent('light',{type:'omni',color:new pc.Color(1,.9,.72),intensity:0,range:reach,castShadows:false});
      light.setLocalPosition(0,lampHeight,0);entity.addChild(light);
      entity.lampLight=light;entity.lampReach=record.kind==='desklamp'?1.4:record.kind==='ceilinglamp'?2.8:2.4;
      if(entity.lampMaterial)this.daylight?.addLamp(entity.lampMaterial);
    }
    // Anything standing on a table sits at the table top, and takes no hitbox of its own —
    // you already cannot walk through the thing holding it up.
    const base=record.on?room.props.get(record.on):null;
    const lift=base?surfaceHeight(base.kind)??0:0;
    entity.setLocalPosition(record.x,lift,record.z);
    entity.setLocalEulerAngles(0,record.rot??0,0);
    const [fw,fd]=record.footprint,turned=((record.rot??0)/90)%2!==0;
    const hw=(turned?fd:fw)/2,hd=(turned?fw:fd)/2;
    const height={rug:.03,table:.47,bed:.62,shelf:1.7,lamp:1.3,plant:1.1}[record.kind]??.8;
    const box=base?null
      :this.mark(id,room.offsetX+record.x,record.z,hw*.86,hd*.86,0,height,record.kind,record.kind!=='rug');
    const prop={...record,entity,box,lift};
    room.props.set(record.uid,prop);
    return prop;
  }
  removeProp(id,uid) {
    const room=this.rooms.get(id),prop=room?.props.get(uid);
    if(!prop)return false;
    // An assembly comes apart together: whatever was standing on this goes too.
    for(const child of [...room.props.values()])if(child.on===uid)this.removeProp(id,child.uid);
    prop.entity.destroy();
    if(prop.box)this.registry.boxes.splice(this.registry.boxes.indexOf(prop.box),1);
    room.props.delete(uid);
    return true;
  }
  /** The piece of furniture underneath a point, if there is one. */
  propUnder(room,x,z,skipUid=null) {
    for(const prop of room.props.values()){
      if(prop.uid===skipUid||prop.on||prop.kind==='rug')continue;
      const [pw,pd]=prop.footprint,turned=((prop.rot??0)/90)%2!==0;
      if(Math.abs(x-prop.x)<=(turned?pd:pw)/2&&Math.abs(z-prop.z)<=(turned?pw:pd)/2)return prop;
    }
    return null;
  }
  beginPlacement(item) {
    if(this.place==='town')return false;
    this.cancelPlacement();
    const room=this.rooms.get(this.place);
    this.ghost={item,rot:0,valid:false,x:0,z:0,
      entity:this.m.furniture(room.root,item.kind,item.color),
      pad:this.m.box(room.root,[0,.006,0],[item.footprint[0],.012,item.footprint[1]],'#7fa06f')};
    this.updatePlacement();
    return true;
  }
  cancelPlacement() {
    if(!this.ghost)return;
    this.ghost.entity.destroy();this.ghost.pad.destroy();this.ghost=null;
  }
  rotatePlacement() {if(this.ghost){this.ghost.rot=(this.ghost.rot+90)%360;this.updatePlacement();}}
  /** Where the ghost sits: a short reach ahead of the tourist, snapped to a quarter-metre grid. */
  updatePlacement() {
    if(!this.ghost||this.place==='town')return;
    const room=this.rooms.get(this.place),[w,d]=room.data.size;
    const pos=this.player.entity.getPosition(),{fx,fz}=this.facing();
    const snap=v=>Math.round(v*4)/4;
    const [fw,fd]=this.ghost.item.footprint,turned=(this.ghost.rot/90)%2!==0;
    const halfW=(turned?fd:fw)/2,halfD=(turned?fw:fd)/2;
    const x=Math.max(-w/2+halfW+.3,Math.min(w/2-halfW-.3,snap(pos.x-room.offsetX+fx*2)));
    const z=Math.max(-d/2+halfD+.3,Math.min(d/2-halfD-.5,snap(pos.z+fz*2)));
    this.ghost.x=x;this.ghost.z=z;
    // Hovering over a piece of furniture means one of two things: this small thing is going to
    // stand on it, or it is going nowhere. Open floor behaves exactly as it always did.
    const under=canStack(this.ghost.item.kind)?this.propUnder(room,x,z):null;
    const base=under&&offersSurface(under.kind)?under:null;
    const lift=base?surfaceHeight(base.kind):0;
    this.ghost.on=base?.uid??null;
    this.ghost.problem=placementProblem(this.ghost.item.kind,under);
    this.ghost.entity.setLocalPosition(x,lift,z);
    this.ghost.entity.setLocalEulerAngles(0,this.ghost.rot,0);
    this.ghost.pad.setLocalPosition(x,lift+.006,z);
    this.ghost.pad.setLocalScale(halfW*2,.012,halfD*2);
    this.ghost.valid=base
      ? !this.ghost.problem&&fitsOn(base,{...this.ghost.item,x,z},decorOn([...room.props.values()],base.uid))
      : !under&&this.freeSpot(room,x,z,halfW,halfD);
    this.ghost.pad.render.meshInstances[0].material=this.m.material(this.ghost.valid?'#7fa06f':'#c07f6f');
  }
  freeSpot(room,x,z,halfW,halfD) {
    const here=this.player.entity.getPosition();
    if(this.ghost?.item.kind!=='rug'){
      for(const f of room.fittings??[])if(Math.abs(x-f.x)<halfW+f.hw+.08&&Math.abs(z-f.z)<halfD+f.hd+.08)return false;
      if(room.data.desk&&Math.abs(x-room.data.desk.x)<halfW+.45&&Math.abs(z-room.data.desk.z)<halfD+.95)return false;
      if(Math.abs(x-room.data.exit[0])<halfW+.8&&Math.abs(z-room.data.exit[1])<halfD+1.1)return false;
      if(room.data.annex&&Math.abs(x-room.data.annex.x)<halfW+1&&Math.abs(z-room.data.annex.z)<halfD+.85)return false;
    }
    if(this.ghost?.item.kind!=='rug'&&Math.abs(x-(here.x-room.offsetX))<halfW+.45&&Math.abs(z-here.z)<halfD+.45)return false;
    if(room.data.lectern&&Math.abs(x-room.data.lectern.x)<halfW+1.4&&Math.abs(z-room.data.lectern.z)<halfD+.9)return false;
    for(const prop of room.props.values()){
      if(prop.kind==='rug'||this.ghost?.item.kind==='rug')continue;   // rugs layer under everything
      const [pw,pd]=prop.footprint,turned=((prop.rot??0)/90)%2!==0;
      if(Math.abs(x-prop.x)<halfW+(turned?pd:pw)/2&&Math.abs(z-prop.z)<halfD+(turned?pw:pd)/2)return false;
    }
    return true;
  }
  /** Placing on an occupied spot is a miss, not a cancel: keep the ghost so the player can move. */
  tryPlace() {
    if(!this.ghost)return;
    if(!this.ghost.valid){this.onPlace?.({status:'blocked',item:this.ghost.item,problem:this.ghost.problem});return;}
    const {item,rot,x,z,on}=this.ghost;
    this.cancelPlacement();
    const record={uid:`${item.id}-${Date.now().toString(36)}`,item:item.id,kind:item.kind,color:item.color,footprint:item.footprint,x,z,rot,...(on?{on}:{})};
    this.addProp(this.place,record);
    this.onPlace?.({status:'placed',item,record});
  }
  enterRoom(id) {
    const room=this.rooms.get(id);if(!room||this.place===id)return false;
    this.warps=(this.warps??0)+1;   // stepping through a door is a jump too, not a walk
    const leaving=this.rooms.get(this.place)?.data;
    this.tidyLoose();
    if(this.seated)this.stand();
    if(this.place==='town'){this.exitPoint=this.player.entity.getPosition().clone();this.exitYaw=this.yaw;}
    this.resetInput();
    if(this.place!=='town')this.rooms.get(this.place).root.enabled=false;
    this.root.enabled=false;room.root.enabled=true;this.place=id;
    // Coming back out of a back room, you step out of its doorway rather than teleporting to
    // the middle of the room you started in.
    const spot=(leaving?.returnPlace===id&&leaving.returnSpawn)||room.data.spawn;
    this.player.entity.setPosition(room.offsetX+spot[0],0,spot[1]);
    this.playerY=0;this.velocityY=0;this.grounded=true;
    this.yaw=spot[2]??0;this.pitch=-4;this.target=null;this.clearNearest();
    if(!this.thirdPersonAllowed()&&this.view==='third'){this.view='first';this.applyView();}
    this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  clearNearest() {this.nearest=null;this.onNear(null);}
  /** Anything left on the floor here is cleared away and its container restocked. */
  tidyLoose() {
    if(this.toys.held)this.toys.drop();
    this.toys.clear(this.place);
    for(const container of this.containers)if(container.place===this.place)container.reset();
  }
  /** Put the tourist somewhere specific. Used by the layout tools and by the browser tests,
   *  so they do not have to steer through a city whose streets keep changing. */
  warp(x,z,yaw=this.yaw) {
    this.warps=(this.warps??0)+1;   // anything that asks "did they walk here?" watches this count
    this.resetInput();
    this.seated=null;
    this.player.legs.forEach(leg=>leg.setLocalEulerAngles(0,0,0));
    this.player.entity.setPosition(x,0,z);
    this.playerY=0;this.velocityY=0;this.grounded=true;this.yaw=yaw;
    this.clearNearest();
    this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  leaveRoom() {
    if(this.place==='town')return false;
    this.tidyLoose();
    this.resetInput();
    if(this.seated)this.stand();
    this.rooms.get(this.place).root.enabled=false;this.root.enabled=true;this.place='town';
    if(this.exitPoint)this.player.entity.setPosition(this.exitPoint.x,0,this.exitPoint.z+.6);
    this.playerY=0;this.velocityY=0;this.grounded=true;
    this.yaw=this.exitYaw!==undefined?this.exitYaw+180:180;this.pitch=-4;this.clearNearest();
    this.placeCamera(this.player.entity.getPosition());
    return true;
  }
  bind(canvas) {
    this.canvas=canvas;
    addEventListener('keydown',e=>{
      if(this.paused||isTyping(e.target)||e.isComposing)return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
      this.keys.add(e.code);
      // Sitting down takes over the space bar, so you can always get up again.
      if(e.code==='Space'&&this.seated){this.stand();return;}
      if(e.code==='KeyG'&&this.toys.held){this.toys.drop();return;}
      if(e.code==='KeyE'&&this.nearest)this.onInteract(this.nearest.id);
      if(e.code==='KeyV')this.setView(this.view==='first'?'third':'first');
      if(e.code==='KeyF'&&this.looking)this.onCollect?.(this.looking);
      // Edge-triggered so a quick tap between frames still counts.
      if(e.code==='Space'&&this.grounded&&!this.ghost&&!this.seated){this.velocityY=JUMP;this.grounded=false;}
      if(this.ghost){
        if(e.code==='KeyR')this.rotatePlacement();
        if(e.code==='KeyX'){const item=this.ghost.item;this.cancelPlacement();this.onPlace?.({status:'cancelled',item});}
      }
    });
    addEventListener('keyup',e=>this.keys.delete(e.code));
    addEventListener('blur',()=>{this.resetInput();this.freshLock=true;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.resetInput();this.freshLock=true;}});
    document.addEventListener('focusin',e=>{if(isTyping(e.target))this.resetInput();});
    // Mouse look uses pointer lock; touch look is a drag, with a left-side thumbstick for walking.
    //
    // Two different things make a raw movementX feel like a jump. The browser hands you one
    // enormous delta as pointer lock engages, or after the window has been away — that one is an
    // artefact and is thrown out. Separately, when a frame runs long the browser coalesces
    // several real moves into a single event; that is genuine input, so it is kept but spent
    // over the next few frames instead of teleporting the view.
    addEventListener('mousemove',e=>{
      if(!this.locked()||this.paused||document.hidden)return;
      const dx=e.movementX||0,dy=e.movementY||0;
      const now=performance.now(),gap=now-(this.lastMove??now);
      this.lastMove=now;
      if(this.freshLock||gap>420){
        this.freshLock=false;
        if(Math.abs(dx)>360||Math.abs(dy)>360)return;
      }
      queueLook(this.lookPending,dx,dy);
    });
    document.addEventListener('pointerlockchange',()=>{
      this.freshLock=this.locked();
      this.resetInput();
      this.onLockChange?.(this.locked());
    });
    // Losing the pointer silently is what makes the view feel stuck: the cursor runs into the
    // edge of the screen and the world simply stops turning. Say so, and take it back.
    document.addEventListener('pointerlockerror',()=>{this.onLockChange?.(false);});
    canvas.addEventListener('pointerdown',e=>{
      if(this.paused)return;
      if(e.pointerType==='mouse'){
        if(this.ghost&&this.locked()){this.tryPlace();return;}
        if(this.toys.held&&this.locked()){this.throwHeld();return;}
        this.requestLook();return;
      }
      if(this.ghost){this.tryPlace();return;}
      if(this.toys.held){this.throwHeld();return;}
      if(e.clientX<innerWidth*.42&&e.clientY>innerHeight*.45){this.stick.id=e.pointerId;this.stick.ox=e.clientX;this.stick.oy=e.clientY;}
      else{this.drag.id=e.pointerId;this.drag.x=e.clientX;this.drag.y=e.clientY;}
      try{canvas.setPointerCapture?.(e.pointerId);}catch{}   // ignore ids the browser will not capture
    });
    canvas.addEventListener('pointermove',e=>{
      if(this.paused)return;
      if(e.pointerId===this.drag.id){this.lookBy((e.clientX-this.drag.x)*1.5,(e.clientY-this.drag.y)*1.5);this.drag.x=e.clientX;this.drag.y=e.clientY;}
      else if(e.pointerId===this.stick.id){
        const dx=e.clientX-this.stick.ox,dy=e.clientY-this.stick.oy,limit=58,len=Math.hypot(dx,dy)||1,scale=Math.min(len,limit)/limit/len;
        this.stick.dx=dx*scale;this.stick.dz=dy*scale;
      }
    });
    const release=e=>{
      if(e.pointerId===this.drag.id)this.drag.id=null;
      if(e.pointerId===this.stick.id){this.stick.id=null;this.stick.dx=this.stick.dz=0;}
    };
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  }
  locked() {return document.pointerLockElement===this.canvas;}
  requestLook() {
    if(this.paused||this.locked())return;
    // Browsers throttle a lock request made straight after an exit, so a refusal is not fatal.
    try{const p=this.canvas?.requestPointerLock?.();if(p&&p.catch)p.catch(()=>{});}catch{}
  }
  releaseLook() {if(this.locked())document.exitPointerLock?.();}
  lookBy(dx,dy) {
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
    this.yaw=(this.yaw-dx*this.sensitivity)%360;
    this.pitch=Math.max(-85,Math.min(85,this.pitch-dy*this.sensitivity));
  }
  /** Spend the accumulated mouse movement, so one coalesced burst reads as a turn, not a cut. */
  drainLook(dt) {
    const delta=drainLook(this.lookPending,dt);
    this.lookBy(delta.x,delta.y);
  }
  resetInput(){
    this.keys.clear();this.drag.id=null;this.stick.id=null;this.stick.dx=this.stick.dz=0;
    this.lookPending.x=this.lookPending.y=0;this.lastMove=null;
  }
  applyView() {
    const first=this.view==='first';
    // From your own eyes you see your legs, not your chest: a torso at this scale fills the
    // bottom of the screen the moment you look down.
    this.player.head.enabled=!first;
    this.player.upper.enabled=!first;
    if(this.player.pack)this.player.pack.enabled=!first;
    for(const leg of this.player.legs)leg.setLocalScale(first?.84:1,1,first?.84:1);
    this.camera.camera.fov=first?70:46;
  }
  /** Third person needs room to swing the camera; a shop floor has none, so it stays off. */
  thirdPersonAllowed() {
    const data=this.rooms.get(this.place)?.data;
    return this.place==='town'||!!data?.decoratable||!!data?.outdoor;
  }
  setView(mode) {
    const want=mode==='third'?'third':'first';
    if(want==='third'&&!this.thirdPersonAllowed()){
      this.onNotice?.('这里地方太小，第三人称视角不可用。 / Not enough room in here for third person.');
      return this.view;
    }
    this.view=want;this.applyView();return this.view;
  }
  facing() {const r=this.yaw*Math.PI/180;return {fx:-Math.sin(r),fz:-Math.cos(r),rx:Math.cos(r),rz:-Math.sin(r)};}
  placeCamera(pos) {
    this.camera.setEulerAngles(this.pitch,this.yaw,0);
    if(this.view==='first'){this.camera.setPosition(pos.x,pos.y+this.eyeHeight,pos.z);return;}
    const yr=this.yaw*Math.PI/180,pr=this.pitch*Math.PI/180,cos=Math.cos(pr);
    const dx=-Math.sin(yr)*cos,dy=Math.sin(pr),dz=-Math.cos(yr)*cos;
    // Pull the camera in until it stops sitting inside a building, sign or wall.
    let distance=1.2;
    for(let d=5.8;d>1.2;d-=.4){if(this.canMove(pos.x-dx*d,pos.z-dz*d)){distance=d;break;}}
    this.camera.setPosition(pos.x-dx*distance,Math.max(.7,pos.y+1.55-dy*distance),pos.z-dz*distance);
  }
  setPaused(value) {
    if(value)this.cancelPlacement();
    this.paused=value;this.resetInput();
    clearTimeout(this.relockTimer);
    // Opening a panel while in mouse-look should give the mouse back when the panel closes —
    // otherwise you are left looking at a world that will not turn until you click it again.
    // If the cursor was already free, it stays free, so the buttons stay clickable.
    if(value){this.relock=this.locked();this.releaseLook();}
    else if(this.relock){this.relock=false;this.relockTimer=setTimeout(()=>this.requestLook(),200);}
  }
  /** Closest spot within a few metres that is not inside anything. */
  nearestFreeSpot(x,z) {
    for(let radius=.5;radius<=5;radius+=.5){
      for(let i=0;i<16;i++){
        const angle=i/16*Math.PI*2;
        const px=x+Math.cos(angle)*radius,pz=z+Math.sin(angle)*radius;
        if(this.canMove(px,pz))return {x:px,z:pz};
      }
    }
    return null;
  }
  /** Inside the paving of a district, or the four walls of a room. Geometry only, no hitboxes. */
  withinPlace(place,x,z,edge=.42) {
    if(place==='town')return this.inAnyDistrict(x,z);
    const room=this.rooms.get(place);
    if(!room)return false;
    const [w,d]=room.data.size,lx=x-room.offsetX;
    if(Math.abs(lx)>w/2-edge)return false;
    // A district has an edge all the way round; a room has a doorway in one wall of it.
    if(room.data.outdoor)return Math.abs(z)<=d/2-edge;
    if(z<-d/2+edge)return false;
    // The doorway gap is the one place the front wall opens up.
    return !(z>d/2-edge&&!(Math.abs(lx)<.7&&z<d/2+.9));
  }
  canMove(x,z,feetY=this.playerY) {
    if(!this.withinPlace(this.place,x,z))return false;
    const room=this.rooms.get(this.place);
    if(feetY<1.9&&(room?.staff??[]).some(s=>Math.hypot(x-room.offsetX-s.x,z-s.z)<.86))return false;
    return !this.registry.blocks(this.place,x,z,feetY);
  }
  // --- things you can pick up -------------------------------------------
  /** Every basket, rack and case that has stock a player could lift out of it. */
  buildContainers() {
    this.containers=[];
    const add=(place,fitting,x,z,zh)=>{
      if(!fitting.stock?.length)return;
      this.containers.push(new Container({place,slots:fitting.stock,x,z,zh}));
    };
    for(const prop of this.props)add('town',prop,prop.x,prop.z,NAMES[prop.kind==='fruitstand'?'fruit':'box']?.zh??'东西');
    for(const room of this.rooms.values())
      for(const fitting of room.fittings??[])
        add(room.id,fitting,room.offsetX+fitting.x,fitting.z,NAMES[fitting.name??'box']?.zh??'东西');
  }
  /** Lift one piece of stock out of a container. It is a toy, never inventory. */
  takeFrom(index) {
    const container=this.containers[index];
    const slot=container&&container.take(container.ready(),this.clock);
    if(!slot)return null;
    const spot=slot.entity.getPosition();
    const body=this.toys.spawn({parent:this.toyRoot,place:container.place,shape:slot.shape,
      size:slot.size,color:slot.color,x:spot.x,y:spot.y,z:spot.z,name:slot.kind});
    this.toys.take(body);
    return body;
  }
  grabLoose() {
    const pos=this.player.entity.getPosition();
    return this.toys.take(this.toys.nearest(this.place,pos.x,pos.z,this.playerY+1));
  }
  throwHeld() {
    if(!this.toys.held)return null;
    const forward=this.camera.forward;
    const body=this.toys.hurl({fx:-forward.x,fy:-forward.y,fz:-forward.z},9.5);
    this.onThrow?.(body);
    return body;
  }
  update(dt) {
    if(document.hidden){this.resetInput();return;}
    dt=Math.min(dt,.05);this.clock+=dt;this.drainLook(dt);
    const pos=this.player.entity.getPosition();
    const {fx,fz,rx,rz}=this.facing();let dx=0,dz=0;
    if(!this.paused&&!this.seated) {
      // Walking is relative to where the tourist is looking, not to the world axes.
      const advance=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-this.stick.dz;
      const strafe=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.stick.dx;
      dx=fx*advance+rx*strafe;dz=fz*advance+rz*strafe;
      const len=Math.hypot(dx,dz);
      let x=pos.x,z=pos.z;
      const trapped=this.registry.blocks(this.place,x,z,this.playerY);
      if(trapped){
        // Already inside something: step towards open ground rather than freezing.
        const out=this.nearestFreeSpot(x,z);
        if(out){
          const ox=out.x-x,oz=out.z-z,distance=Math.hypot(ox,oz)||1,step=Math.min(distance,4*dt);
          x+=ox/distance*step;z+=oz/distance*step;dx=ox;dz=oz;
        }
      } else if(len>.02) {
        const push=Math.min(1,len),speed=(this.keys.has('ShiftLeft')?7:4.5)*push*this.speedScale;dx/=len;dz/=len;
        if(this.canMove(x+dx*dt*speed,z))x+=dx*dt*speed;
        if(this.canMove(x,z+dz*dt*speed))z+=dz*dt*speed;
      } else dx=dz=0;
      // Gravity, with a step up onto kerbs and benches and a jump to reach the rest.
      this.velocityY-=GRAVITY*dt;
      const vertical=this.registry.moveVertical(this.place,x,z,this.playerY,this.playerY+this.velocityY*dt);
      this.playerY=vertical.y;this.grounded=vertical.grounded;
      if(vertical.grounded||vertical.ceiling)this.velocityY=0;
      this.player.entity.setPosition(x,this.playerY,z);
    }
    this.player.entity.setEulerAngles(0,(this.seated?this.seated.bodyYaw:this.yaw)+180,0);
    const moving=!!(dx||dz);
    if(moving){
      restIdle(this.player);
      this.player.legs.forEach((leg,i)=>leg.setLocalEulerAngles(Math.sin(this.clock*12+i*Math.PI)*23,0,0));
      this.player.arms.forEach((arm,i)=>arm.setLocalEulerAngles(Math.sin(this.clock*12+i*Math.PI)*-18,0,0));
    } else if(!this.seated) animateIdle(this.player,dt);
    this.daylight.advance(dt);
    this.lightRoom();
    this.updatePlacement();
    if(this.place==='town'){
      for(const [,actor]of this.actors){const p=actor.entity.getPosition();actor.entity.setLocalPosition(p.x,Math.sin(this.clock*1.3+p.x)*.025,p.z);animateIdle(actor,dt);}
      for(const one of this.people){one.entity.setLocalPosition(one.x,Math.sin(this.clock*1.1+one.x)*.022,one.z);animateIdle(one,dt);}
    } else {
      for(const one of this.rooms.get(this.place)?.people??[]){
        one.entity.setLocalPosition(one.x,Math.sin(this.clock*1.1+one.x)*.022,one.z);animateIdle(one,dt);
      }
    }
    this.walkStaff(dt);
    for(const container of this.containers)if(container.place===this.place)container.tick(this.clock);
    this.market.update(dt,{hour:this.daylight.hour,place:this.place,offCamera:(x,z)=>this.offCamera(x,z)});
    this.market.syncHitboxes(this.registry,id=>({id,...NAMES[id]}));
    for(const material of this.market.claimLamps())this.market.onLit?.(material);
    this.toys.update(dt,this.place);
    if(this.toys.held){
      const forward=this.camera.forward,eye=this.camera.getPosition();
      this.toys.carry(eye,{fx:-forward.x,fy:-forward.y,fz:-forward.z});
    }
    // Prefer whatever the tourist is actually looking at; anything at arm's length still counts.
    const here=this.player.entity.getPosition();let nearest=null,best=Infinity;
    for(const t of this.targets()) {
      const d=Math.hypot(here.x-t.x,here.z-t.z);
      if(d>t.radius||d>=best)continue;
      const aim=d<1e-3?1:((t.x-here.x)/d)*fx+((t.z-here.z)/d)*fz;
      if(d>1.3&&aim<(t.wide?.1:.35))continue;
      nearest=t;best=d;
    }
    if(nearest?.id!==this.nearest?.id){this.nearest=nearest;this.onNear(nearest);}
  }
  /** Runs after movement and before the frame is drawn. */
  lateUpdate(){
    if(document.hidden)return;
    this.placeCamera(this.player.entity.getPosition());
    const eye=this.camera.getPosition(),forward=this.camera.forward;
    const seen=this.paused?null:this.registry.look(this.place,eye,forward);
    const name=seen?.box.name??null;
    if(name?.id!==this.looking?.id){this.looking=name;this.onLook?.(name);}
    this.onFrame?.(this);
  }
  /** Waiters pace a fixed loop, so the room feels staffed without needing pathfinding. */
  walkStaff(dt) {
    if(this.place==='town')return;
    const room=this.rooms.get(this.place);
    for(const member of room.staff??[]){
      if(member.wait>0){
        member.wait-=dt;
        animateIdle(member,dt);
        continue;
      }
      const [tx,tz]=member.path[member.target];
      const dx=tx-member.x,dz=tz-member.z,distance=Math.hypot(dx,dz);
      if(distance<.12){member.target=(member.target+1)%member.path.length;member.wait=1.4+Math.random()*2.6;restIdle(member);continue;}
      const step=Math.min(distance,member.speed*dt);
      const from={x:room.offsetX+member.x,z:member.z};
      const to={x:from.x+dx/distance*step,z:from.z+dz/distance*step};
      const others=(room.staff??[]).filter(s=>s!==member).map(s=>({x:room.offsetX+s.x,z:s.z}));
      const player=this.player.entity.getPosition();others.push({x:player.x,z:player.z,radius:.34});
      if(!walkClear(this.registry,this.place,from,to,others)){
        member.blocked=(member.blocked??0)+dt;
        if(member.blocked>2){member.target=(member.target+1)%member.path.length;member.blocked=0;}
        restIdle(member);animateIdle(member,dt);continue;
      }
      member.blocked=0;member.x=to.x-room.offsetX;member.z=to.z;
      member.leg+=dt*7;
      member.entity.setLocalPosition(member.x,0,member.z);
      // The model's face looks down its own +z, so the heading is atan2 with no half turn added.
      member.entity.setLocalEulerAngles(0,Math.atan2(dx,dz)*180/Math.PI,0);
      member.legs.forEach((leg,i)=>leg.setLocalEulerAngles(Math.sin(member.leg+i*Math.PI)*21,0,0));
      member.arms.forEach((arm,i)=>arm.setLocalEulerAngles(Math.sin(member.leg+i*Math.PI)*-16,0,0));
      animateIdle(member,dt,true);
    }
  }
  /** Indoors the daylight comes through the windows; after dark you need your own lamps. */
  lightRoom() {
    if(this.place==='town')return;
    const room=this.rooms.get(this.place),day=1-(this.daylight.state?.lamps??0);
    // A shop that is open keeps its lights on; only your own home waits for a lamp you bought.
    if(room.ceiling)room.ceiling.light.intensity=room.data.decoratable?.18+day*.85:1.03;
    for(const prop of room.props.values()){
      if(prop.entity.lampLight)prop.entity.lampLight.light.intensity=(1-day)*(prop.entity.lampReach??2.4);
    }
  }
  /** True when a spot is behind the camera or off the edges of the screen — safe to build there. */
  offCamera(x,z,margin=140) {
    const point=this.screen(x,1.4,z);
    return point.z<=0||point.x<-margin||point.x>innerWidth+margin||point.y<-margin||point.y>innerHeight+margin;
  }
  screen(x,y,z) {return this.camera.camera.worldToScreen(new pc.Vec3(x,y,z));}
  /** Apply worn clothing: a hat appears, a shirt or trousers recolour the model. */
  equip(worn) {
    const outfit=typeof worn==='string'?{hat:worn}:(worn??{});
    this.player.hat.enabled=!!outfit.hat;
    if(outfit.hatColor)for(const part of this.player.hatBrim)part.render.meshInstances[0].material=this.m.material(outfit.hatColor);
    const shirt=outfit.shirtColor??'#e9bb78',trousers=outfit.trousersColor??'#435653';
    this.player.torso.render.meshInstances[0].material=this.m.material(shirt);
    this.player.collar.render.meshInstances[0].material=this.m.material(shirt);
    for(const arm of this.player.arms)arm.limb.render.meshInstances[0].material=this.m.material(shirt);
    for(const leg of this.player.legs)leg.limb.render.meshInstances[0].material=this.m.material(trousers);
    const shoes=outfit.shoesColor??'#eee0c2';
    for(const leg of this.player.legs)leg.shoe.render.meshInstances[0].material=this.m.material(shoes);
  }
  moveLayout(kind,id,x,z) {
    const list=kind==='npc'?this.data.npcs:this.data.buildings;const def=list.find(x=>x.id===id);if(!def)return;
    def.x=x;def.z=z;const entity=kind==='npc'?this.actors.get(id).entity:this.buildings.get(id);entity.setPosition(x,0,z);
  }
}
