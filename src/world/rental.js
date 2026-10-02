import * as pc from 'playcanvas';
import data from '../content/rental.json' with {type:'json'};
import harbour from '../content/harbour.json' with {type:'json'};
import city from '../content/city.json' with {type:'json'};
import catalog from '../content/catalog.json' with {type:'json'};
import {addedGround} from '../core/city.js';

/**
 * 海景公寓 in 云海中心, the tower at the back of the far landing (src/content/rental.json): its
 * entrance on the landing, what the flats and amenities add to their rooms (rooms.json has their
 * walls and fittings), the lift car and its ride, and where each room's windows look out from
 * (src/world/views.js). Every placement number is in rental.json.
 */
// city.json's skyline tower that holds the flats; should its id or tiers ever go missing, the landmark
// as one block, so the game still loads (tests/rental.test.js fails loudly instead).
const TOWER=city.skyline.towers.find(t=>t.id===data.tower.id)??city.skyline.towers.find(t=>t.landmark);
const STOPS=new Map(data.stops.map(s=>[s.room,s]));
// The tower's tiers, bottom up, as city.json has them (src/world/city.js draws them): [width, y0, y1].
const TIERS=(()=>{let y=0;return (TOWER.tiers??[[1,TOWER.h]]).map(([share,tall])=>{const t=[TOWER.w*share,y,y+tall];y+=tall;return t;});})();
const FACE=TOWER.z+TOWER.w/2;   // the base's front, on the landing's back edge

/** Where a floor of the tower looks out: its front (the harbour side, +z) at the face of the tier it
 *  is in, in city-local metres, `y` its floor. Null for anything that is not a floor (the lift car). */
export function towerView(id){
  const stop=STOPS.get(id);if(!stop)return null;
  const y=data.tower.base+(stop.floor-1)*data.tower.storey,[w]=TIERS.find(([,y0,y1])=>y>=y0&&y<y1)??TIERS[0];
  return {x:TOWER.x,y,z:TOWER.z+w/2,face:1};
}

const BALCONY=data.balcony?.flats??{};
/** A flat's balcony out in 云海 (rental.json `balcony`), city-local: its floor `y`, the rectangle
 *  [x0, x1] by [z0, z1] standing out from the face of the tier at that height, and the flat's glass
 *  door onto it (`door`, room-local, on the flat's floor `floor`). Null for a flat without one. */
export function balconyOf(id){
  const b=BALCONY[id],stop=STOPS.get(id);if(!b||!stop)return null;
  const floor=b.y??0,y=data.tower.base+(stop.floor-1)*data.tower.storey+floor;
  const [w]=TIERS.find(([,y0,y1])=>y>=y0&&y<y1)??TIERS[0],x=TOWER.x+b.x,z0=TOWER.z+w/2+.08;   // clear of the window bands on the face
  return {id,y,x,x0:x-b.w/2,x1:x+b.w/2,z0,z1:z0+b.d,door:b.door,floor};
}

let glassMaterial=null;
function glass(){
  if(glassMaterial)return glassMaterial;
  const m=new pc.StandardMaterial();m.diffuse=new pc.Color(.66,.8,.84);m.opacity=.3;m.blendType=pc.BLEND_NORMAL;
  m.depthWrite=false;m.useMetalness=true;m.metalness=.2;m.gloss=.85;m.update();
  return glassMaterial=m;
}
/** A small lit display (a lift's floor number): its own little canvas, redrawn when the text changes. */
function display(app,text=''){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
  const tex=new pc.Texture(app.graphicsDevice,{width:128,height:64,mipmaps:false});
  const m=new pc.StandardMaterial();m.diffuse=new pc.Color(0,0,0);m.emissiveMap=tex;m.emissive=new pc.Color(1,1,1);m.update();
  const show=value=>{
    const c=canvas.getContext('2d');c.fillStyle='#0c1114';c.fillRect(0,0,128,64);
    c.fillStyle='#ffab4a';c.font='bold 46px "Microsoft YaHei", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(value,64,35,120);
    tex.setSource(canvas);
  };
  show(text);
  return {material:m,show};
}

/** The way in: a white canopy on two posts over a lit glass front, and the name across it. */
export function buildRentalExterior(town,parent){
  const {box,cylinder,label,glow}=town.m,e=data.entrance,top=harbour.landing.top,room=town.rooms.get('city'),ox=room.offsetX;
  const [cw,cd,ch]=e.canopy,[gw,gh]=e.glass,steel='#3b4650';
  const root=new pc.Entity('residences');root.setLocalPosition(TOWER.x,top,FACE);parent.addChild(root);
  const lit=glow('#ffd79a');lit.emissiveIntensity=1;lit.update();
  box(root,[0,ch,cd/2],[cw,.28,cd],'#f3f1ec').lookName='roof';
  box(root,[0,ch-.16,cd/2],[cw-.4,.04,cd-.4],'#b98d62').lookName='roof';       // a warm wood soffit
  const strip=box(root,[0,ch-.19,cd-.45],[cw-.8,.03,.14],'#ffe2ad');strip.render.meshInstances[0].material=lit;strip.lookName='lamp';
  for(const sx of [-1,1]){
    cylinder(root,[sx*(cw/2-.5),ch/2,cd-.5],[.28,ch,.28],'#d9dcdf').lookName='pillar';
    town.mark('city',ox+TOWER.x+sx*(cw/2-.5),FACE+cd-.5,.16,.16,top,top+ch,'pillar');
  }
  // The lobby glowing through the glass: a lit panel in front of the tower's own window bands, the
  // strip of its ceiling lights along the top, and the dark shapes of its pillars.
  const warm=glow('#c99a62');warm.emissiveIntensity=.7;warm.update();
  box(root,[0,gh/2,.09],[gw,gh,.02],'#c99a62').render.meshInstances[0].material=warm;
  box(root,[0,gh-.35,.105],[gw,.12,.01],'#ffd79a').render.meshInstances[0].material=lit;
  for(const x of [-gw/2+1.2,gw/2-1.2])box(root,[x,(gh-.45)/2,.105],[.5,gh-.45,.01],'#8e7458');
  const pane=box(root,[0,(gh+.04)/2,.14],[gw,gh-.16,.02],'#a9cbd6');pane.render.meshInstances[0].material=glass();pane.lookName='window';
  for(const x of [-gw/2,-gw/4,-.62,.62,gw/4,gw/2])box(root,[x,gh/2,.17],[.1,gh,.06],steel);
  for(const y of [.05,2.9,gh])box(root,[0,y,.17],[gw+.1,.1,.06],steel);
  for(const x of [-.12,.12])box(root,[x,1.1,.24],[.04,.9,.04],'#c9ced2').lookName='door';
  box(root,[0,.02,.7],[gw+1,.03,1.3],'#d8d3c8');                                // a stone threshold, clear of the glass's foot
  const sign=label(root,`${e.sign} · ${e.en}`,[0,ch+.42,cd-.12],cw-1.2,.62,'#233b52','#ffffff');sign.signText=e.sign;
  box(root,[0,ch+.42,cd-.2],[cw-1,.7,.06],steel);
  // Clipped shrubs in stone planters either side of the door.
  for(const [x,z,w,d] of e.planters??[]){
    box(root,[x,.3,z],[w,.6,d],'#c9c3b6').lookName='planter';
    for(let i=0;i<3;i++)town.m.ball(root,[x+(i-1)*w/3,.85,z],[w/3+.1,.6,d-.1],'#5f7d52').lookName='planter';
    town.mark('city',ox+TOWER.x+x,FACE+z,w/2,d/2,top,top+.9,'planter');
  }

  // The tower's rooms are fitted out the first time each is entered, as the mall and the stations are.
  for(const id of [data.lobby,data.lift,...data.stops.map(s=>s.room)]){
    const r=town.rooms.get(id);if(!r)continue;
    let done=false;r.prepare=()=>{if(!done){done=true;fitOut(town,r,car);}};
  }
  const car=liftCar(town);
  town.rentalLift=car;

  // The flats' balconies out on the tower's face (balconyOf), and the way between each and its flat.
  const balconies=Object.keys(BALCONY).map(balconyOf).filter(Boolean);
  for(const b of balconies)buildBalcony(town,parent,b,ox);
  const up=b=>Math.abs(town.playerY-b.y)<1.5;   // standing on it, not on the landing far below
  addedGround.push((x,z)=>balconies.some(b=>up(b)&&x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1));
  const back=data.balcony.back;
  town.rentalBalcony=id=>{
    const b=balconies.find(b=>b.id===id),flat=town.rooms.get(id),cityRoom=town.rooms.get('city');
    if(!b||!flat)return false;
    if(town.place===id){town.enterRoom('city');return town.warp(cityRoom.offsetX+b.x,b.z0+.9,180,b.y);}
    // Back in whatever the lease says: a lapsed one never leaves you outside.
    if(town.place==='city'&&up(b)){town.enterRoom(id);return town.warp(flat.offsetX+b.door.x,b.door.z-.9,0,b.floor);}
    return false;
  };
  return {targets:()=>town.playerY>10?balconies.filter(up).map(b=>({id:'rental:balcony:'+b.id,x:ox+b.x,z:b.z0+.6,radius:1.6,label:`${back.zh} · ${back.en}`,wide:true}))
    :[{id:'door:'+data.lobby,x:ox+TOWER.x,z:FACE+e.door,radius:2.2,label:e.prompt,wide:true}]};
}

/** A balcony: a stone floor, a glass railing and side screens in steel, and a glass door in the
 *  tower's face; all of it solid, so nobody walks or falls off. */
function buildBalcony(town,parent,b,ox){
  const {box}=town.m,steel='#3b4650',w=b.x1-b.x0,d=b.z1-b.z0,zc=(b.z0+b.z1)/2;
  const e=new pc.Entity('balcony-'+b.id);e.setLocalPosition(b.x,b.y,zc);parent.addChild(e);
  const glassy=m=>{m.render.meshInstances[0].material=glass();m.render.castShadows=false;return m;};
  box(e,[0,-.15,0],[w,.3,d],'#a9a091').lookName='floor';
  glassy(box(e,[0,.55,d/2-.05],[w-.14,.95,.04],'#a9cbd6')).lookName='railing';
  box(e,[0,1.07,d/2-.05],[w+.04,.06,.08],steel).lookName='railing';
  for(const sx of [-1,1]){
    glassy(box(e,[sx*(w/2-.03),1.21,0],[.04,2.38,d-.02],'#a9cbd6')).lookName='window';
    box(e,[sx*(w/2-.03),.54,d/2-.05],[.07,1.06,.07],steel).lookName='railing';
  }
  glassy(box(e,[0,1.11,-d/2+.02],[1.16,2.18,.04],'#a9cbd6')).lookName='door';
  box(e,[0,2.26,-d/2+.03],[1.36,.08,.06],steel);
  for(const sx of [-1,1])box(e,[sx*.64,1.12,-d/2+.03],[.08,2.2,.06],steel);
  const X=ox+b.x;
  // One structure: the railing meets its side screens at the corners.
  const group='balcony-'+b.id;
  town.mark('city',X,zc,w/2,d/2,b.y-.3,b.y,'floor').group=group;
  town.mark('city',X,b.z1-.05,w/2,.06,b.y,b.y+1.1,'railing').group=group;
  for(const sx of [-1,1])town.mark('city',X+sx*(w/2-.03),zc,.05,d/2,b.y,b.y+2.4,'window').group=group;
}

/** What the tower adds to one of its rooms: its window glass, its lift doors, its pieces. */
function fitOut(town,room,car){
  const m=town.m,{box,cylinder,label}=m,spec=data.rooms[room.id]??{},[w,d]=room.data.size,h=room.data.height,ox=room.offsetX,id=room.id;
  const g=new pc.Entity('residence');room.root.addChild(g);
  const keep=new Set();
  const solid=(x,z,hw,hd,y0,y1,name=null)=>town.mark(id,ox+x,z,hw,hd,y0,y1,name);
  // The ceiling over a piece: under an upper floor it is the slab.
  const ceiling=y=>room.data.upper&&y<room.data.upper.y?room.data.upper.y-.2:h;
  const trim=room.data.trim,steel='#8e979c';

  // Window glass on the harbour side: the panes show 云海 (src/world/views.js), in slim frames.
  for(const [x,pw,y0,y1] of spec.glass??[]){
    const pane=box(g,[x,(y0+y1)/2,d/2-.03],[pw,y1-y0,.04],'#cfe0dd');
    pane.noBatch=true;pane.render.castShadows=false;pane.lookName='window';keep.add(pane);
    room.openings.panes.push(pane);
    const bars=Math.max(1,Math.round(pw/1.8));
    for(let i=0;i<=bars;i++)box(g,[x-pw/2+i*pw/bars,(y0+y1)/2,d/2-.08],[.07,y1-y0+.06,.05],trim);
    for(const y of [y0,y1])box(g,[x,y,d/2-.08],[pw+.07,.07,.05],trim);
    if(y0>.3)box(g,[x,y0-.05,d/2-.14],[pw+.2,.08,.2],trim);                   // a sill
  }

  // Lift doors: the lobby's bank, or the one on a floor's back wall (its way out, rooms.json `exit`),
  // each with its floor lit over it and the call button beside it, under the floor's name.
  const stop=STOPS.get(id);
  const doors=x=>{
    const z=-d/2+.2,f=new pc.Entity('lift-door');f.setLocalPosition(x,0,z);g.addChild(f);
    for(const sx of [-1,1])box(f,[sx*.95,1.3,0],[.14,2.6,.1],steel);
    box(f,[0,2.62,0],[2.04,.14,.1],steel);
    for(const sx of [-1,1])box(f,[sx*.44,1.2,.02],[.86,2.4,.05],'#b9c0c4').lookName='lift';
    const screen=box(f,[0,2.95,.03],[.5,.26,.04],'#101418');
    screen.render.meshInstances[0].material=numberPlate(town.app,String(stop.floor));
    box(f,[1.3,1.15,.02],[.12,.3,.04],'#cfd4d6');cylinder(f,[1.3,1.2,.05],[.06,.02,.06],'#ffb347',[90,0,0]);
    return f;
  };
  const plate=x=>{const sign=label(g,stop.zh,[x+1.3,1.8,-d/2+.13],.62,.3,'#233b52','#ffffff');sign.signText=stop.zh;};
  if(spec.liftBank){
    for(const dx of spec.liftBank.doors)doors(spec.liftBank.x+dx);
    const sign=label(g,'电梯',[spec.liftBank.x,3.45,-d/2+.12],1.2,.4,'#233b52','#ffffff');sign.signText='电梯';
    plate(spec.liftBank.x+Math.max(...spec.liftBank.doors));
  } else if(stop&&room.data.returnWall==='back'){doors(room.data.exit[0]);plate(room.data.exit[0]);}

  // The pieces rental.json lists.
  const glassy=m=>{m.render.meshInstances[0].material=glass();m.render.castShadows=false;return m;};
  for(const p of spec.pieces??[]){
    const y=p.y??0,e=new pc.Entity(p.kind);e.setLocalPosition(p.x,y,p.z);e.setLocalEulerAngles(0,p.rot??0,0);g.addChild(e);
    const turned=((p.rot??0)/90)%2!==0,hit=(hw,hd,y1,name=null,y0=0)=>solid(p.x,p.z,turned?hd:hw,turned?hw:hd,y+y0,y+y1,name);
    const k=p.kind;
    if(k==='chandelier'){
      // Rings of light on four cords: 吊灯.
      const lit=m.glow('#fff2d0');lit.emissiveIntensity=1;lit.update();
      const n=Math.max(8,Math.round(p.r*10));
      for(const [r,dy] of [[p.r,0],[p.r*.62,-.35]])for(let i=0;i<n;i++){
        const a=i/n*Math.PI*2,b=box(e,[Math.cos(a)*r,-y+p.y+dy,Math.sin(a)*r],[.16,.08,2*Math.PI*r/n],'#fff2d0',[0,-a*180/Math.PI,0]);
        b.render.meshInstances[0].material=lit;b.render.castShadows=false;b.lookName='ceilinglamp';
      }
      for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;cylinder(e,[Math.cos(a)*p.r,(ceiling(y)-y)/2+.02,Math.sin(a)*p.r],[.02,ceiling(y)-p.y,.02],'#8a8f93');}
      e.setLocalPosition(p.x,y,p.z);
    }else if(k==='mailboxes'){
      // A wall of small steel boxes, one a flat, and 信箱 over them.
      const cols=Math.round(p.w/.4);
      box(e,[0,.9,0],[p.w,1.8,.4],'#9aa3a8');
      for(let r=0;r<5;r++)for(let c=0;c<cols;c++)box(e,[-p.w/2+.2+c*.4,.25+r*.33,.21],[.34,.27,.02],'#c3c9cc');
      const sign=label(e,p.sign,[0,2.1,.12],1.2,.36,'#233b52','#ffffff');sign.signText=p.sign;
      hit(p.w/2,.2,1.8,'box');
    }else if(k==='sign'){
      const sign=label(e,p.en?`${p.text} · ${p.en}`:p.text,[0,0,0],p.w??1.0,p.h??.36,p.bg??'#f4ead2',p.fg??'#36594f');sign.signText=p.text;
    }else if(k==='pillar'){
      // A pale stone column floor to ceiling, a band of light near its top.
      const t=ceiling(y)-y,lit=m.glow('#ffe7bd');lit.emissiveIntensity=.9;lit.update();
      cylinder(e,[0,.15,0],[.9,.3,.9],'#cfc8bb');cylinder(e,[0,(t+.3)/2,0],[.7,t-.3,.7],'#ebe6dc').lookName='pillar';
      cylinder(e,[0,t-.9,0],[.74,.12,.74],'#ffe7bd').render.meshInstances[0].material=lit;
      solid(p.x,p.z,.4,.4,y,y+t,'pillar');
    }else if(k==='slats'){
      // A wood feature wall: a dark backing and slim battens standing proud of it.
      box(e,[0,p.h/2,0],[p.w,p.h,.01],'#5b4332');
      for(let x=-p.w/2+.08;x<p.w/2;x+=.16)box(e,[x,p.h/2,.02],[.07,p.h,.03],'#a97d55');
    }else if(k==='wall'){
      box(e,[0,(ceiling(y)-y)/2,0],[p.w,ceiling(y)-y,p.d],room.data.wall).lookName='wall';
      box(e,[0,.051,0],[p.w+.04,.098,p.d+.04],trim);   // a skirting just off the floor, so no two faces lie flush
      solid(p.x,p.z,p.w/2,p.d/2,y,ceiling(y),'wall');
    }else if(k==='glasswall'){
      const t=ceiling(y)-y;
      glassy(box(e,[0,t/2,0],[p.w-.1,t-.16,p.d],'#a9cbd6')).lookName='window';   // inside the frame
      for(const yy of [.04,t-.04])box(e,[0,yy,0],[p.w,.08,p.d+.04],steel);
      for(const sx of [-1,1])box(e,[sx*(p.w/2-.03),t/2,0],[.06,t,p.d+.04],steel);
      solid(p.x,p.z,p.w/2,Math.max(p.d/2,.06),y,ceiling(y),'window');
    }else if(k==='tiles'){
      box(e,[0,.011,0],[p.w-.04,.018,p.d],'#cfc8bc').lookName='floor';
      for(let x=-p.w/2+.6;x<p.w/2-.1;x+=.6)box(e,[x,.021,0],[.02,.004,p.d-.02],'#b3aa9b');
    }else if(k==='railing'){
      glassy(box(e,[0,.55,0],[p.w,.95,.04],'#a9cbd6')).lookName='railing';
      box(e,[0,1.06,0],[p.w,.06,.08],steel).lookName='railing';
      for(let x=-p.w/2;x<=p.w/2+.01;x+=p.w/Math.ceil(p.w/2))box(e,[x,.53,0],[.05,1.06,.05],steel).lookName='railing';
      solid(p.x,p.z,p.w/2,.08,y,y+1.1,'railing');
    }else if(k==='bathtub'){
      // A white tub with water in it (浴室).
      box(e,[0,.28,0],[1.7,.56,.8],'#f4f4f0');
      const water=box(e,[0,.47,0],[1.5,.02,.6],'#8ec3d0');water.render.meshInstances[0].material=m.waterMaterial();water.lookName='water';
      cylinder(e,[.72,.72,-.3],[.05,.3,.05],'#c9ced2');
      hit(.85,.4,.6);
    }else if(k==='pool'){
      // A raised pool: coping all round and the water inside, too deep to step into.
      const water=box(e,[0,.36,0],[p.w-.6,.04,p.d-.6],'#5fb3c9');water.render.meshInstances[0].material=m.waterMaterial();water.lookName='water';
      box(e,[0,.17,0],[p.w-.6,.3,p.d-.6],'#3f8fa6');
      for(const [x,z,bw,bd] of [[0,-p.d/2+.15,p.w,.3],[0,p.d/2-.15,p.w,.3],[-p.w/2+.15,0,.3,p.d-.6],[p.w/2-.15,0,.3,p.d-.6]])box(e,[x,.24,z],[bw,.48,bd],'#e8e4da');
      for(const sx of [-1,1])cylinder(e,[p.w/2-.9+sx*.3,.9,-p.d/2+.25],[.05,.9,.05],'#c9ced2');
      hit(p.w/2,p.d/2,.5,'water');
    }else if(k==='lounger'){
      box(e,[0,.25,.1],[.7,.1,1.5],'#e8e4da');box(e,[0,.34,.1],[.64,.08,1.4],'#f0c27a');
      box(e,[0,.55,-.72],[.64,.6,.12],'#f0c27a',[-30,0,0]);
      for(const sx of [-1,1])for(const sz of [-.55,.7])box(e,[sx*.3,.1,sz],[.05,.2,.05],'#9aa3a8');
      hit(.35,.85,.5);
    }else if(k==='treadmill'){
      box(e,[0,.12,0],[.8,.24,1.8],'#3a3f44');box(e,[0,.25,.05],[.6,.02,1.5],'#1f2326');
      for(const sx of [-1,1])box(e,[sx*.36,.7,.72],[.06,1.1,.06],'#6f7a7e');
      box(e,[0,1.25,.72],[.8,.08,.3],'#6f7a7e');box(e,[0,1.3,.8],[.46,.2,.04],'#20262a',[-25,0,0]);
      hit(.4,.9,1.4);
    }else if(k==='weights'){
      box(e,[0,.45,0],[.4,.1,1.3],'#3a3f44');box(e,[0,.22,0],[.1,.44,.9],'#6f7a7e');
      box(e,[-1.1,.7,0],[.12,1.4,1.2],'#6f7a7e');
      for(let i=0;i<4;i++)for(const sz of [-.4,.4])cylinder(e,[-1.1,.3+i*.32,sz],[.2,.3,.2],'#2b2f33',[0,0,90]);   // through the rack
      hit(.25,.65,.55);solid(p.x-1.1,p.z,.12,.62,y,y+1.4);
    }else if(k==='washer'){
      // A row of washing machines against the wall, each with its round glass door.
      for(let i=0;i<p.n;i++){
        const x=(i-(p.n-1)/2)*.72;
        box(e,[x,.43,0],[.66,.86,.62],'#f1f3f2');
        cylinder(e,[x,.45,.315],[.42,.02,.42],'#3c4a52',[90,0,0]);
        cylinder(e,[x,.45,.325],[.3,.02,.3],'#8fb8c8',[90,0,0]);
        box(e,[x,.8,.315],[.6,.08,.02],'#c9ced2');
      }
      hit(p.n*.36,.31,.86);
    }else if(k==='planter'){
      box(e,[0,.3,0],[p.w,.6,p.d],'#a07a58').lookName='planter';
      box(e,[0,.6,0],[p.w-.1,.04,p.d-.1],'#5a4a3a');
      const n=Math.max(2,Math.round(p.w*p.d*1.4));
      for(let i=0;i<n;i++){
        const u=((i*.618)%1-.5)*(p.w-.4),v=((i*.382+.21)%1-.5)*(p.d-.3),s=.35+((i*.29)%1)*.3;
        m.ball(e,[u,.62+s/2,v],[s,s*1.1,s],i%3?'#6f9a5c':'#86a96a').lookName='planter';
        if(i%2)m.ball(e,[u+.1,.72+s,v],[.12,.12,.12],['#e7a0b4','#f2d16b','#f4f0e8'][i%3]).lookName='flower';
      }
      hit(p.w/2,p.d/2,.62,'planter');
    }else if(k==='furniture'){
      const item=catalog.find(i=>i.kind===p.item),f=m.furniture(e,p.item,item?.color);f.lookName=p.item;
      const [fw,fd]=item?.footprint??[1,1];
      hit(fw/2*.9,fd/2*.9,p.item==='wardrobe'?2:.7,p.item);
    }
  }
  if(id===data.lift)car.build(g,keep);

  // A balcony door: glass in the gap of the glass wall under the 阳台 or 露台 sign, out onto the
  // balcony in 云海 (balconyOf, buildBalcony).
  const out=balconyOf(id),said=data.balcony?.out;
  if(out){
    const {x,z,w:dw}=out.door,y=out.floor,t=ceiling(y)-y,e=new pc.Entity('balcony-door');e.setLocalPosition(x,y,z);g.addChild(e);
    glassy(box(e,[0,1.12,0],[dw-.12,2.16,.04],'#a9cbd6')).lookName='door';   // clear of the balcony's tiles
    box(e,[0,2.26,0],[dw-.12,.08,.08],steel);
    glassy(box(e,[0,(2.31+t-.09)/2,0],[dw-.12,t-2.4,.04],'#a9cbd6')).lookName='window';
    for(const sz of [-1,1])box(e,[dw/2-.24,1.05,sz*.045],[.03,.5,.03],steel);   // a handle each side
    solid(x,z,dw/2,.06,y,ceiling(y),'door');
  }

  // A floor with a view keeps the harbour moving outside while you look at it: the ferry, the wheel
  // and the lights across the bay are what the window shows (their clock-driven parts, no people).
  const cityRoom=town.rooms.get('city');
  room.parts=[{
    update(dt){
      if(stop&&town.views?.camera.camera.enabled)for(const part of cityRoom?.parts??[])part.update?.(dt,true);
      if(id===data.lift)car.update(dt);
    },
    targets(){
      const list=spec.liftBank?[{id:'rental:lift',x:ox+spec.liftBank.x,z:-d/2+1.5,radius:2.2,label:'电梯 · Lift',wide:true}]:[];
      if(out)list.push({id:'rental:balcony:'+id,x:ox+out.door.x,z:out.door.z-.6,y:out.floor,radius:1.6,label:`${said.zh} · ${said.en}`,wide:true});
      return list;
    },
  }];
  town.registerLooks(id,g);
  town.batchStatics('tower-'+id,room.root,keep);
}

const plates=new Map();
/** A lift's floor number over its doors: one small lit plate per number, shared. */
function numberPlate(app,text){
  if(!plates.has(text))plates.set(text,display(app,text).material);
  return plates.get(text);
}

/**
 * The lift car (rooms.json `harbour-lift`): its sliding doors, the floor display over them and the
 * ride. `ride(from, to)` puts you in the car at `from`'s floor; the doors close, it runs a floor at a
 * time on the display, stops, the doors open and it lets you out. It tells `town.onLift(event, stop)`
 * as it goes: 'depart' ({up}), 'arrive' and 'out', for the voice, the chime and the way out.
 */
function liftCar(town){
  let leaves=[],screen=null,shown='',open=1,stage=null,t=0,from=null,to=null,span=0,dir='';
  const car={
    get riding(){return !!stage;},
    ride(fromRoom,toRoom){
      // From inside the car (a lease that lapsed on the way up leaves you there) it is where it last stopped.
      const inCar=fromRoom===data.lift,a=STOPS.get(fromRoom)??(inCar?to:null)??STOPS.get(data.lobby),b=STOPS.get(toRoom);
      if(stage||!b||(a===b&&!inCar))return false;
      // Already at that floor: the doors just open again.
      if(a===b){from=a;to=b;stage='open';t=0;open=0;town.enterRoom(data.lift);show(`${b.floor}`);place();return true;}
      from=a;to=b;stage='close';t=0;open=1;dir=b.floor>a.floor?'▲':'▼';
      span=Math.min(4.5,Math.max(2.4,1.6+.09*Math.abs(b.floor-a.floor)));
      town.enterRoom(data.lift);
      show(`${dir} ${a.floor}`);place();
      return true;
    },
    build(g,keep){
      const {box,glow}=town.m,[w,d]=town.rooms.get(data.lift).data.size,h=town.rooms.get(data.lift).data.height;
      const top=town.rooms.get(data.lift).data.doorHeight,moving=new pc.Entity('lift-moving');moving.noBatch=true;g.addChild(moving);keep.add(moving);
      leaves=[-1,1].map(side=>{const leaf=box(moving,[side*.43,top/2,d/2+.1],[.86,top,.05],'#b9c0c4');leaf.lookName='lift';return {leaf,side};});
      const plate=display(town.app,'');
      screen=plate;const s=box(moving,[0,top+.2,d/2-.03],[.6,.3,.04],'#101418');s.render.meshInstances[0].material=plate.material;
      const lit=glow('#fff6e4');lit.emissiveIntensity=.8;lit.update();
      box(g,[0,h-.1,0],[w-.1,.04,d-.1],'#fff6e4').render.meshInstances[0].material=lit;   // a lit ceiling
      box(g,[0,.95,-d/2+.06],[w-.6,.05,.05],'#c9ced2');                                  // the handrail
      box(g,[.95,1.15,d/2-.03],[.22,.5,.03],'#cfd4d6');
      for(let i=0;i<4;i++)box(g,[.95,.98+i*.11,d/2-.05],[.07,.07,.02],'#ffb347');
      // Beyond the doors, a floor's landing, seen while they stand open.
      box(g,[0,1.4,d/2+1.4],[3.2,2.8,.1],'#e9e2d4');box(g,[0,-.05,d/2+.8],[3.2,.1,1.3],'#cfc8bc');
      place();
    },
    update(dt){
      if(!stage)return;
      t+=dt;
      if(stage==='close'){open=Math.max(0,1-t/.8);if(t>=.8){stage='move';t=0;town.onLift?.('depart',{...from,up:to.floor>from.floor});}}
      else if(stage==='move'){
        const u=Math.min(1,t/span),e=u*u*(3-2*u),floor=Math.round(from.floor+(to.floor-from.floor)*e);
        show(`${u<1?dir+' ':''}${floor}`);
        if(u>=1){stage='open';t=0;town.onLift?.('arrive',to);}
      }
      else if(stage==='open'){open=Math.min(1,t/.8);if(t>=1.2){stage=null;town.onLift?.('out',to);}}
      place();
    },
  };
  function show(text){if(screen&&text!==shown){shown=text;screen.show(text);}}
  function place(){for(const {leaf,side} of leaves)leaf.setLocalPosition(side*(.43+.86*open),leaf.getLocalPosition().y,leaf.getLocalPosition().z);}
  return car;
}
