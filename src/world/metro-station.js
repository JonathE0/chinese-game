import * as pc from 'playcanvas';
import metro from '../content/metro.json' with {type:'json'};
import signTexts from '../content/signs.json' with {type:'json'};
import floors from '../content/floors.json' with {type:'json'};
import city from '../content/city.json' with {type:'json'};
import {floorMaterial} from './paving.js';
import {ride as carry} from './mall.js';
import {initIdle,animateIdle} from './idle.js';
import {detail} from '../core/quality.js';
import {zh,scripted} from '../services/script.js';

/**
 * A metro station (a room with `transit`; its id in metro.json `stations`), its train, the people who
 * use it, and the ride to the other end.
 *
 * Every station has two levels (rooms.json `upper.y`, entered upstairs): the street side up top and
 * the platform down below, joined by a flight of stairs between two escalators (`flight`). At 青禾站
 * you come in on a landing at street level and go down to the concourse (站厅: card machines, the
 * service centre, the gates) and on to the platform (站台). At 云海市中心站 the train comes in down
 * below and you go up into the hall, where the gates are, and out by one of its exits (rooms.json
 * `exits`; town.js takes you out, and back in by the same one).
 *
 * The gates open for someone who has tapped in here and always let anyone on the platform out; walking
 * back out through them cancels the tap (town.onTransitLeave), walking out after a ride beeps
 * (town.onTransitGate). The train keeps a timetable (metro.json `timetable`, about a minute round)
 * set by the clock, so walking in finds it anywhere in its round: it pulls in, opens its doors with the
 * platform doors, waits, chimes, closes them and pulls out, and the boards count down to the next one.
 * The station says what is happening (town.onTransitAnnounce). Walking into the carriage through open
 * doors after tapping in is boarding: when the doors close with you aboard, the ride starts
 * (town.onTransitBoard) in a carriage of its own high over the station, with the tunnel streaming past
 * the windows (startRide), and ends at the other platform.
 *
 * Nobody is shut in. The doors stay open while anyone aboard is not travelling from here, and for
 * someone standing in a doorway for up to `hold` seconds, after which they are set down on whichever
 * side they belong (aboard only with a fare reserved). Anyone found in the carriage's space with no
 * train standing there is put back on the platform. The track itself is behind the platform doors.
 * Commuters never block anyone: they wait a moment for the tourist to pass, then walk on.
 *
 * Built the first time the station is entered (room.prepare), as the mall is, so a player who never
 * rides pays for none of it. The static pieces are batched with the room; the train, every door and
 * gate leaf and the escalator steps move in one dynamic batch, the people in another.
 */
const CAR={length:20,depth:3.3,height:2.7},DOORS=[-6,0,6],DOOR=.8,BODY=.34;   // DOOR: half a doorway
const T=metro.timetable,CYCLE=T.away+T.arriving+T.open+T.closing+T.departing,OPEN_AT=T.away+T.arriving;
const CHIME=1.5;   // the first seconds of closing, while the warning sounds: the doors are still open
const PASSAGES=[-1.5,0,1.5],CABINETS=[-2.25,-.75,.75,2.25];
const RIDE=40;     // the ride's own carriage and tunnel stand this high over the station, inside its walls
const ALCOVE=2.4;  // how far an exit's passage stands out from its wall into the hall
const PX=120,TEX_MAX=1024;   // canvas pixels a metre on a painted sign, and its longest side
const VOICED=new Set(Object.keys(signTexts.signs)),S=metro.signs,EXITS=city.metroStation?.exits??[];
const SANS='"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
let glassMaterial=null;

/** Where the train is `p` seconds into its cycle (the cycle starts as it leaves the station for good). */
export function timetableAt(p){
 let t=((p%CYCLE)+CYCLE)%CYCLE;
 for(const state of ['away','arriving','open','closing','departing']){if(t<T[state])return {state,t};t-=T[state];}
 return {state:'away',t:0};
}
/** What the countdown boards say at `p`: 列车进站 while a train comes in, 即将到站 under 30 s from the
 *  next one, otherwise 下一班 N 分钟 to the nearest minute. */
export function boardAt(p){
 const q=((p%CYCLE)+CYCLE)%CYCLE;
 if(timetableAt(q).state==='arriving')return {key:'arriving'};
 const wait=q<=T.away?T.away-q:CYCLE-q+T.away;
 return wait<30?{key:'soon'}:{key:'countdown',n:Math.max(1,Math.round(wait/60))};
}
const boardText=({key,n})=>({zh:S[key].zh.replace('{n}',n),en:S[key].en.replace('{n}',n)});

/**
 * A hall's exits (rooms.json `exits`: the wall each is on and how far along it), with their signs and
 * their spot out in the city from city.json `metroStation.exits`. `target` is where to press E to
 * leave by one, `inside` where you stand coming in by it, facing into the hall.
 */
export function stationExits(data){
 const [w,d]=data.size,y=data.upper?.y??0;
 return (data.exits??[]).map(def=>{
  const out=EXITS.find(e=>e.id===def.id)??null;
  const [x,z,yaw,nx,nz]={front:[def.at,d/2,0,0,-1],back:[def.at,-d/2,180,0,1],west:[-w/2,def.at,-90,1,0],east:[w/2,def.at,90,-1,0]}[def.wall];
  const at=k=>({x:x+nx*k,z:z+nz*k});
  return {...def,out,y,yaw,normal:[nx,nz],wallAt:{x,z},
   label:out?`${out.zh} · ${out.to.zh} · ${out.to.en}`:def.id,target:at(ALCOVE+.7),inside:{...at(ALCOVE+1.6),yaw}};
 });
}
/** The exit nearest a point: in the hall (room-local) by where you leave, or in the city by its spot there. */
export function nearestExit(exits,x,z,outside=false){
 let best=null,far=Infinity;
 for(const e of exits){
  const [ex,ez]=outside?e.out?.spawn??[Infinity,Infinity]:[e.target.x,e.target.z],dd=Math.hypot(ex-x,ez-z);
  if(dd<far){far=dd;best=e;}
 }
 return best;
}

function layout(room){
 const data=room.data,def=metro.stations[data.transit],[w,d]=data.size,up=data.upper?.y??0,f=def.flight;
 const n=Math.max(2,Math.round(up/.2));
 return {def,w,d,h:data.height,up,gy:def.gateLevel??0,gz:def.gate,dz:def.doors,carZ:def.doors-.15-CAR.depth/2,
  f,n,rise:up/n,tread:(f.top-f.foot)/n,hall:!!def.hall,ceiling:def.ceiling??null};
}
const otherEnd=station=>{const r=metro.network.routes.find(r=>r.from===station||r.to===station);return r&&(r.from===station?r.to:r.from);};

/**
 * The solid parts of a station's two levels, room-local, shared by the drawing, the hitboxes and
 * tests/stairs.test.js: the upper level (a block `upper.y` high from the flight's top to the front
 * wall), the flight's steps (each rise low enough to walk up), each escalator's steps a rise under
 * the moving ones you see, the balustrades up the flight and the railing along the upper level's
 * edge, both well above anything a jump can reach.
 */
export function levelParts(data){
 const def=metro.stations[data.transit],[w,d]=data.size,up=data.upper?.y??0,f=def.flight,n=Math.max(2,Math.round(up/.2));
 const rise=up/n,tread=(f.top-f.foot)/n,[sx0,sx1]=f.stairs,sx=(sx0+sx1)/2,fz=(f.foot+f.top)/2,half=(f.top-f.foot)/2,parts=[],rails=[],edges=[sx0,sx1];
 const add=(kind,x,z,hw,hd,y0,y1)=>parts.push({kind,x,z,hw,hd,y0,y1});
 add('level',0,(f.top+d/2)/2,w/2,(d/2-f.top)/2,0,up);
 for(let i=0;i<n;i++)add('step',sx,f.foot+(i+.5)*tread,(sx1-sx0)/2,tread/2,0,rise*(i+1));
 for(const [x0,x1] of f.escalators){
  const inner=Math.abs(x0-sx)<Math.abs(x1-sx)?x0:x1,outer=inner===x0?x1:x0,edge=inner<sx?sx0:sx1;
  edges.push(outer);
  for(let k=1;k<n;k++)add('escalator',(x0+x1)/2,f.foot+(k+.5)*tread,(x1-x0)/2,tread/2,0,rise*k);
  rails.push({x:(inner+edge)/2,thick:Math.abs(inner-edge)+.02},{x:outer+Math.sign(outer-sx)*.06,thick:.12});
 }
 for(const r of rails)add('balustrade',r.x,fz,r.thick/2,half,0,up+1.7);
 const reach=Math.max(...edges.map(Math.abs))+.12;
 for(const s of [-1,1])add('railing',s*(reach+w/2)/2,f.top+.06,(w/2-reach)/2,.06,up,up+1.7);
 return {parts,rails,reach,sx0,sx1,sx,fz};
}

export function buildMetroStation(town,room){
 const L=layout(room),{gz,dz,gy,carZ}=L,station=room.data.transit,ox=room.offsetX,far=L.w/2+CAR.length/2+1;
 const service=L.def.service;
 // The trains keep time with the clock, the two ends half a round apart.
 let p=(performance.now()/1000+(station==='yunhai'?CYCLE/2:0))%CYCLE,last=null,was=null,open=0,hold=0,side='out',parts=null,riding=null;
 const nearestDoor=x=>DOORS.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a);
 const say=moment=>town.onTransitAnnounce?.(station,moment);
 const control={station,room,layout:L,
  get state(){return timetableAt(p).state;},
  get open(){return open>=1;},
  get riding(){return !!riding;},
  get phase(){return p;},
  /** A train standing at the platform with its doors open (arrivals, and tests that need one now). */
  dock(){p=OPEN_AT;open=1;was='open';parts?.place(0,1);},
  /** The journey's end: the train in, doors open, and the traveller inside it where they stood on the
   *  ride (`spot`, carriage-local), facing the platform. */
  arrive(spot){
   control.dock();side='in';last=performance.now()/1000;   // arriving is not walking in: no welcome
   const x=Math.max(-CAR.length/2+.7,Math.min(CAR.length/2-.7,spot?.x??0)),z=carZ+Math.max(-1.1,Math.min(1.1,spot?.z??0));
   town.warp(ox+x,z,180);
  },
  targets(){
   if(!parts||riding)return [];
   const list=[{id:'metro',x:ox,z:gz+1.25,y:gy,radius:1.7,label:`${S.tap.zh} · ${S.tap.en}`,wide:true}];
   if(service?.check)list.push({id:'metro:service',x:ox+service.x,z:service.z+1.7,y:gy,radius:1.9,label:`${S.service.zh} · ${S.service.en}`,wide:true});
   return list;
  },
  /** What the gate's screen shows for a moment: 'short' (余额不足), or 'ok' with the card's balance. */
  display(kind,value){parts?.display(kind,value);},
  /** Up into the ride's own carriage (built the first time), where the tourist stood in the train. */
  startRide(){
   if(town.place!==room.id)return null;   // another save took over mid-way and is somewhere else now
   parts??=fitOut(town,room,L);
   parts.ride??=buildRide(town,room,L);
   const pos=town.player.entity.getPosition();
   riding=parts.ride;riding.begin();
   town.warp(pos.x,carZ+Math.max(-1.1,Math.min(1.1,pos.z-carZ)),town.yaw,RIDE+.1);
   return riding;
  },
  /** Where the tourist stands in the ride's carriage, carriage-local, to arrive at the same spot. */
  rideSpot(){const pos=town.player.entity.getPosition();return {x:pos.x-ox,z:pos.z-carZ};},
  /** The ride is over: anyone still up in its carriage is set down on this platform (nobody arrived). */
  endRide(){
   if(!riding)return;
   riding.stop();riding=null;
   if(town.place===room.id&&town.playerY>RIDE/2)town.warp(ox+nearestDoor(town.player.entity.getPosition().x-ox),dz+1,180);
  },
  update(dt,paused){
   if(!parts)return;
   const now=performance.now()/1000,back=last===null||now-last>1;
   if(last!==null&&now-last>1)p=(p+now-last)%CYCLE;   // the trains kept running while you were elsewhere
   last=now;
   parts.tick(dt,p);   // the escalators, the boards and the ride run under a panel or the ride's strip too
   if(paused)return;
   if(back&&!riding)say('enter');
   const pos=town.player.entity.getPosition(),x=pos.x-ox,z=pos.z,j=town.transitJourney?.(),paid=j?.phase==='reserved'&&j.origin===station;
   const {state,t}=timetableAt(p);
   let aboard=false,doorway=false;
   if(!riding){
    // Which side of the gates you are on changes only clear of them, so a gate never shuts on you.
    if(z<gz-.8)side='in';
    else if(z>gz+.8){
     if(side==='in'){if(paid)town.onTransitLeave?.(station);else town.onTransitGate?.(station,'out');}
     side='out';
    }
    aboard=z<dz-.25&&Math.abs(x)<CAR.length/2&&town.playerY<RIDE/2;
    doorway=Math.abs(z-dz)<.5&&DOORS.some(d=>Math.abs(x-d)<DOOR+BODY);
    if(aboard&&!['open','closing'].includes(state)){town.warp(ox+nearestDoor(x),dz+1);return;}
    parts.escalate(dt,x,z);
   }
   parts.gates(paid||side==='in',dt);
   let next=p+dt;
   if(state==='open'&&t+dt>=T.open){
    if(doorway){next=p;hold+=dt;if(hold>=T.hold){hold=0;town.warp(pos.x,paid&&z<dz?dz-1:dz+.9);}}
    else if(aboard&&!paid)next=p;   // someone aboard who is not travelling from here: the doors wait
    else hold=0;
   }
   // Shut: a traveller aboard is on their way; anyone else aboard gets the doors back.
   else if(state==='closing'&&t+dt>=T.closing&&aboard&&!(paid&&town.onTransitBoard?.(station)))next=OPEN_AT+T.open-1e-3;
   p=next%CYCLE;
   const at=timetableAt(p);
   if(at.state!==was){
    if(!riding&&was!==null){
     if(at.state==='arriving')say('approach');
     else if(at.state==='open')say('open');
     else if(at.state==='closing')say(aboard?'aboard':'closing');
    }
    was=at.state;
   }
   open=at.state==='open'?Math.min(1,open+dt*2):at.state==='closing'?Math.max(0,Math.min(1,(T.closing-at.t)/(T.closing-CHIME))):0;
   const u=at.state==='arriving'?at.t/T.arriving:at.t/T.departing;
   const offset=at.state==='away'?far:at.state==='arriving'?far*(1-u)*(1-u):at.state==='departing'?-far*u*u:0;
   parts.place(offset,open);
   parts.people(dt,at,offset);
  },
 };
 room.parts=[control];
 room.prepare=()=>{parts??=fitOut(town,room,L);};
 return control;
}

// -------------------------------------------------------------------------------------------------
// The station itself.

function fitOut(town,room,L){
 const {box,cylinder,glow}=town.m,{w,d,h,def,gz,dz,gy,up,carZ,f,n,rise,tread,hall}=L,ox=room.offsetX,id=room.id;
 const line=metro.line.colour,wallColour=room.data.wall;
 const root=new pc.Entity('metro-station');room.root.addChild(root);
 const moving=new pc.Entity('metro-moving');moving.noBatch=true;room.root.addChild(moving);
 const glass=glassMaterial??=makeGlass(),lit=glow('#fff6de');lit.emissiveIntensity=.9;lit.update();
 const pane=(parent,pos,size,rot)=>{const e=box(parent,pos,size,'#a9cbd6',rot);e.render.meshInstances[0].material=glass;e.render.castShadows=false;return e;};
 const light=(parent,pos,size,rot)=>{const e=box(parent,pos,size,'#fff6de',rot);e.render.meshInstances[0].material=lit;e.render.castShadows=false;e.lookName='lamp';return e;};
 const solid=(x,z,hw,hd,y1,name=null,y0=0)=>town.mark(id,ox+x,z,hw,hd,y0,y1,name);
 const sign=(parent,text,pos,size,colours,turn)=>paintSign(town.m,parent,text,pos,size,colours,turn).entity;
 const towards={zh:def.towards,en:def.towardsEn},deep=['#1d2b35','#ffffff'],blue=[line,'#ffffff'],pale=['#f4f7f6','#233b52'];
 const tile=(pos,size,style='marble-tiles')=>{const e=box(root,pos,size,'#d9d6cb');e.render.meshInstances[0].material=floorMaterial(town.app,floors.styles[style],size[0],size[2]);e.lookName='floor';return e;};

 // A floor of its own where floors.json has none for this room (it would otherwise get plank seams).
 const fy=floors.rooms[id]?0:.02;
 if(fy)tile([0,fy/2,0],[w-.05,fy,d-.05]);

 // --- the upper level (the street side), and the stairs and escalators down --------------------
 const lv=levelParts(room.data),{sx0,sx1,sx,fz,reach}=lv,pd=d/2-f.top,pz=(f.top+d/2)/2;
 for(const q of lv.parts)solid(q.x,q.z,q.hw,q.hd,q.y1,q.kind==='balustrade'||q.kind==='railing'?'railing':null,q.y0);
 box(root,[0,(up-.02)/2,pz],[w,up-.02,pd],wallColour).lookName='wall';
 tile([0,up-.01,pz],[w,.02,pd]);
 for(let i=0;i<n;i++){
  const z0=f.foot+i*tread,y=rise*(i+1);
  box(root,[sx,y/2,z0+tread/2],[sx1-sx0,y,tread],'#c9ccc6').lookName='stairs';
  box(root,[sx,y+.004,z0+.05],[sx1-sx0-.04,.008,.08],'#e3b93c').lookName='stairs';
 }
 const slope=Math.atan2(up,f.top-f.foot),along=Math.hypot(up,f.top-f.foot),tilt=[-slope*180/Math.PI,0,0];
 // A balustrade up the flight: glass over a skirt and a dark handrail on top.
 for(const {x,thick} of lv.rails){
  box(root,[x,up/2+.2,fz],[thick,.5,along],'#5d6d76',tilt);
  pane(root,[x,up/2+.75,fz],[.04,.7,along],tilt);
  box(root,[x,up/2+1.12,fz],[thick+.04,.07,along],'#2b3339',tilt).lookName='railing';
 }
 // The escalators: steps you see, one ribbon per flight shifted along the slope as they move.
 const flights=[];
 for(const [x0,x1,dir] of f.escalators){
  const cx=(x0+x1)/2,steps=new pc.Entity('escalator-steps');moving.addChild(steps);
  for(let k=1;k<n-1;k++){
   const zc=f.foot+(k+.5)*tread;
   box(steps,[cx,rise*k-.04,zc],[x1-x0-.08,.08,tread-.02],'#8d959b').lookName='escalator';
   box(steps,[cx,rise*k-rise/2,f.foot+k*tread+.01],[x1-x0-.1,rise-.02,.02],'#6f777c').lookName='escalator';
   box(steps,[cx,rise*k+.002,zc-tread/2+.04],[x1-x0-.1,.006,.05],'#e3b93c');
  }
  flights.push({x0:f.foot,rises:1,z:cx,hw:(x1-x0)/2,moves:dir==='up'?1:-1,steps:n,tread,rise,y0:0,y1:up,speed:.55,phase:0,ribbon:steps});
  for(const [z,y] of [[f.foot-.35,fy],[f.top+.35,up]])box(root,[cx,y+.01,z],[x1-x0,.02,.7],'#a3aaaf').lookName='escalator';
 }
 // The edge of the upper level, beside the flight: a glass balustrade.
 for(const s of [-1,1]){
  const a=reach,b=w/2,mid=s*(a+b)/2;
  box(root,[mid,up+.06,f.top+.06],[b-a,.12,.12],'#7f8b92');
  pane(root,[mid,up+.6,f.top+.06],[b-a-.04,.95,.04]);
  box(root,[mid,up+1.1,f.top+.06],[b-a,.07,.1],'#2b3339').lookName='railing';
  for(let x=a;x<=b+1e-6;x+=(b-a)/Math.ceil((b-a)/2.4))box(root,[s*x,up+.55,f.top+.06],[.06,1.1,.06],'#7f8b92').lookName='railing';
  box(root,[mid,up-.25,f.top-.01],[b-a,.14,.02],line);
 }

 // --- the track, behind the platform doors --------------------------------------------------------
 const trackDepth=dz-.1+d/2,trackZ=(dz-.1-d/2)/2;
 box(root,[0,fy+.006,trackZ],[w,.012,trackDepth],'#3a4146');
 for(const dzr of [-.72,.72])box(root,[0,fy+.037,carZ+dzr],[w,.05,.07],'#8e959b');
 for(const s of [-1,1])box(root,[s*(w/2-.03),1.65,trackZ],[.04,3.3,trackDepth-.2],'#151b1f');   // the tunnel mouths
 box(root,[0,3.05,-d/2+.02],[w,.14,.04],line);
 sign(root,{zh:def.name,en:def.en},[0,hall?6.5:1.95,-d/2+.06],hall?[12,2]:[6,1],blue);

 // --- the platform doors ---------------------------------------------------------------------------
 box(root,[0,2.81,dz],[w,.42,.3],'#2c4250');
 box(root,[0,2.66,dz+.16],[w-.02,.1,.02],line);
 const runs=[];let from=-w/2;
 for(const x of DOORS){runs.push([from,x-DOOR]);from=x+DOOR;}runs.push([from,w/2]);
 for(const [a,b] of runs){
  pane(root,[(a+b)/2,1.35,dz],[b-a-.12,2.5,.05]);
  box(root,[(a+b)/2,.05,dz],[b-a,.1,.16],'#7f8b92');
  for(let x=a;x<=b+1e-6;x+=Math.max(1,(b-a)/Math.ceil((b-a)/2.4)))box(root,[x,1.31,dz],[.12,2.62,.16],'#7f8b92');
  solid((a+b)/2,dz,(b-a)/2,.08,3.02);
 }
 const doorHits=DOORS.map(x=>solid(x,dz,DOOR,.08,3.02,'door'));
 const leaf=(parent,x,y,z,width,height,edge)=>{
  const e=new pc.Entity('door-leaf');e.setLocalPosition(x,y,z);parent.addChild(e);
  pane(e,[0,0,0],[width,height,.04]);box(e,[edge*width/2,0,0],[.05,height+.02,.07],'#8d989e');return e;
 };
 const psd=DOORS.flatMap(x=>[-1,1].map(s=>({x,s,e:leaf(moving,x+s*DOOR/2,1.33,dz+.07,DOOR-.02,2.45,-s)})));
 const boards=[];
 const live=(pos,size,turn)=>{const b=paintSign(town.m,root,boardText(boardAt(0)),pos,size,['#1d2b35','#f2c14e'],turn,true);b.entity.noBatch=true;b.entity.signText=S.next.zh;boards.push(b);return b;};
 live([0,2.81,dz+.2],[3.2,.4]);
 sign(root,{zh:S.gap.zh,en:S.gap.en},[-9,2.81,dz+.2],[3,.4],['#f2c14e','#1d2b35']);
 sign(root,towards,[9,2.81,dz+.2],[3.4,.4],blue);
 for(const x of [-3,3])sign(root,{zh:S.doors.zh,en:S.doors.en},[x,2.81,dz+.2],[1.6,.36],['#2c4250','#ffffff']);

 // --- the platform -------------------------------------------------------------------------------
 const front=gy?f.foot:gz,colZ=(front+dz)/2,colTop=L.ceiling??h,cols=hall?[-15,-9,9,15]:[-9.5,-4.5,4.5,9.5];
 box(root,[0,fy+.003,dz+.55],[w,.006,.12],'#e3b93c');
 for(const x of DOORS)for(const s of [-1,1])box(root,[x+s*1.1,fy+.003,dz+1.45],[.1,.006,1.4],'#3f9a6a');
 for(const x of cols){
  box(root,[x,colTop/2,colZ],[.7,colTop,.7],'#eef0ed').lookName='pillar';
  box(root,[x,2.3,colZ],[.72,.14,.72],line);box(root,[x,.06,colZ],[.74,.12,.74],'#56636b');
  solid(x,colZ,.35,.35,colTop,'pillar');
 }
 sign(root,{zh:def.map},[cols[1],1.72,colZ+.37],[1.9,.36],['#f4f7f6',line]);
 sign(root,{zh:S.waiting.zh,en:S.waiting.en},[cols[2],1.72,colZ+.37],[1.3,.42],pale);
 sign(root,{zh:S.platform.zh,en:S.platform.en},[cols[3],1.72,colZ+.37],[1.3,.42],pale);
 sign(root,{zh:S['yellow-line'].zh,en:S['yellow-line'].en},[cols[0],1.72,colZ-.37],[1.6,.42],['#f2c14e','#1d2b35'],180);
 for(const x of hall?[-12,12,-18,18]:[-7,7]){
  const bench=town.m.fitting(root,'bench','#8fa4ae');bench.entity.setLocalPosition(x,0,colZ);bench.entity.setLocalEulerAngles(0,180,0);
  solid(x,colZ,1.05,.42,.52,'bench');
 }

 // --- the gates, across the room on their own level ------------------------------------------------
 const band=gy+2.95;
 box(root,[0,band,gz],[hall?7.4:w,1.1,.3],'#dfe5e6');
 box(root,[0,band-.51,gz],[(hall?7.4:w)-.02,.14,.34],line);
 if(hall)for(const s of [-1,1]){box(root,[s*3.55,gy+1.725,gz],[.2,3.45,.26],'#c9d1d4');solid(s*3.55,gz,.1,.15,gy+3.5,'pillar',gy);}
 else{pane(root,[0,(3.5+L.ceiling)/2,gz],[w-.02,L.ceiling-3.5,.05]);for(let x=-w/2+3;x<w/2-1;x+=3)box(root,[x,(3.5+L.ceiling)/2,gz],[.1,L.ceiling-3.48,.12],'#7f8b92');solid(0,gz,w/2,.15,h,'wall',2.4);}
 for(const s of [-1,1]){
  const a=2.4,b=w/2,mid=s*(a+b)/2;
  pane(root,[mid,gy+1.25,gz],[b-a,2.3,.05]);box(root,[mid,gy+.05,gz],[b-a,.1,.14],'#7f8b92');
  for(let x=a;x<=b+1e-6;x+=(b-a)/Math.ceil((b-a)/2.4))box(root,[s*x,gy+1.21,gz],[.1,2.42,.14],'#7f8b92');
  solid(mid,gz,(b-a)/2,.07,gy+2.4,'wall',gy);
 }
 for(const x of CABINETS){
  box(root,[x,gy+.525,gz],[.3,1.05,1.5],'#dde3e5');box(root,[x,gy+1.08,gz],[.34,.06,1.54],'#5d6d76');
  box(root,[x,gy+1.125,gz+.5],[.24,.03,.24],'#e3b93c');
  solid(x,gz,.17,.77,gy+1.11,null,gy);
  if(Math.abs(x)>2)sign(root,{zh:S.gates.zh,en:S.gates.en},[x,gy+.75,gz+.77],[.26,.24],pale);
 }
 const flaps=PASSAGES.map(x=>({x,open:0,hit:solid(x,gz,.6,.06,gy+1.9,'door',gy),leaves:[-1,1].map(s=>{
  const e=new pc.Entity('gate-flap');e.setLocalPosition(x+s*.3,gy+1,gz);moving.addChild(e);pane(e,[0,0,0],[.58,1.5,.04]);return {e,s};
 })}));
 sign(root,{zh:S.entry.zh,en:S.entry.en},[hall?-2.2:-4,band,gz+.19],[2.4,.62],deep);
 sign(root,{zh:S.exit.zh,en:S.exit.en},[0,band,gz-.19],[3,.62],['#233b52','#f2c14e'],180);
 const screen=paintSign(town.m,root,{zh:S['tap-in'].zh,en:S['tap-in'].en},[hall?1.3:0,band,gz+.19],[3,.62],['#12202a','#9fe0b4'],0,true);
 screen.entity.noBatch=true;screen.entity.signText=S['tap-in'].zh;
 // On the platform side only: a board behind it, so the concourse does not read it through the glass.
 box(root,[hall?0:-4,gy+2.2,gz-.07],[2.26,.42,.03],'#2c4250');
 sign(root,{zh:S['tap-out'].zh,en:S['tap-out'].en},[hall?0:-4,gy+2.2,gz-.12],[2.2,.36],['#12202a','#9fe0b4'],180);
 if(!hall)sign(root,{zh:S.line.zh,en:S.line.en},[-8.5,band,gz+.19],[3.4,.62],pale);
 const machines=(room.data.fittings??[]).filter(f=>f.kind==='ticketmachine');
 if(machines.length){
  const mx=machines.reduce((sum,f)=>sum+f.x,0)/machines.length;
  if(hall){box(root,[mx,gy+1.35,gz+.3],[.08,2.7,.08],'#7f8b92');sign(root,{zh:S['top-up'].zh,en:S['top-up'].en},[mx,gy+2.95,gz+.3],[2.4,.62],['#3f9a6a','#ffffff']);}
  else sign(root,{zh:S['top-up'].zh,en:S['top-up'].en},[mx,band,gz+.19],[2.4,.62],['#3f9a6a','#ffffff']);
 }
 live([0,hall?gy+3.78:3.72,gz+.19],[3.4,.44]);

 // --- the service centre: a counter on the gate line, and someone behind it ------------------------
 let attendant=null;
 if(def.service){
  const {x:bx,z:bz}=def.service,g=new pc.Entity('service-centre');g.setLocalPosition(bx,gy,bz);root.addChild(g);
  box(g,[0,.55,.6],[3,1.1,.5],'#dfe5e6').lookName='counter';box(g,[0,1.13,.62],[3.1,.06,.6],'#5d6d76').lookName='counter';
  box(g,[0,1.4,-.72],[3,2.8,.12],'#e8ecec');
  for(const s of [-1,1]){box(g,[s*1.5,1.4,-.06],[.12,2.8,1.44],'#e8ecec');solid(bx+s*1.5,bz-.06,.06,.72,gy+2.8,'wall',gy);}
  pane(g,[0,1.78,.62],[2.9,1.1,.04]);
  box(g,[0,2.97,-.05],[3.3,.38,1.62],line);
  sign(g,{zh:S.service.zh,en:S.service.en},[0,2.97,.78],[2.6,.36],blue);
  solid(bx,bz+.6,1.5,.3,gy+1.16,'counter',gy);solid(bx,bz-.72,1.5,.06,gy+2.8,'wall',gy);
  attendant=initIdle(town.m.person(room.root,'#2f5f8f',[bx,gy,bz-.12],true,77,{mix:'city',top:'#2f5f8f'}));   // in uniform blue
  solid(bx,bz-.12,.3,.3,gy+1.9,'person',gy);
 }

 // --- the lower ceiling over the concourse and platform, or the hall's rings of light ---------------
 const ring=(x,y,z,r,bar,floorY=null)=>{
  const k=Math.max(16,Math.round(r*5));
  for(let i=0;i<k;i++){
   const a=(i+.5)*Math.PI*2/k,rot=[0,-a*180/Math.PI,0],len=2*r*Math.sin(Math.PI/k)+.03;
   light(root,[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[bar,.1,len],rot);
   if(floorY!==null)box(root,[x+Math.cos(a)*r,floorY+.003,z+Math.sin(a)*r],[.12,.006,len],'#f4f4ee',rot);
  }
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;cylinder(root,[x+Math.cos(a)*r,(y+h)/2,z+Math.sin(a)*r],[.03,h-y,.03],'#8d989e');}
 };
 if(L.ceiling){
  const c=L.ceiling,cd=f.foot-.15+d/2,cz=(f.foot-.15-d/2)/2;   // up to the bulkhead's face
  box(root,[0,c+.1,cz],[w,.2,cd],'#c9d1d4').lookName='ceiling';
  for(let z=-d/2+.3;z<f.foot-.2;z+=.6)box(root,[0,c-.4,z],[w-.2,.1,.08],'#eef0ec').lookName='ceiling';
  for(const z of [dz+1.2,colZ+1.4,gz-1.2,gz+2.4,(gz+f.foot)/2+1.2])light(root,[0,c-.48,z],[w-1.5,.05,.2]);
  // Where the low ceiling meets the stairwell: the station's name, read from the landing.
  box(root,[0,(c+h)/2,f.foot],[w,h-c,.3],wallColour).lookName='wall';
  box(root,[0,c+.1,f.foot+.16],[w-.02,.16,.04],line);
  sign(root,{zh:def.name,en:def.en},[0,c+2.05,f.foot+.18],[7.2,1.5],blue);
  sign(root,{zh:S.line.zh,en:S.line.en},[-7,c+1.1,f.foot+.18],[3.6,.7],pale);
  sign(root,{zh:S.concourse.zh,en:S.concourse.en},[7,c+1.1,f.foot+.18],[3,.7],pale);
  // Over the landing, the glass of the entrance canopy lets the day in.
  const sky=glow('#e8f3f7');sky.emissiveIntensity=.8;sky.update();
  const roof=box(root,[0,h-.03,(f.top+d/2)/2],[w-.4,.04,pd-.4],'#e8f3f7');roof.render.meshInstances[0].material=sky;roof.lookName='ceiling';
  for(const z of [f.top+1,d/2-1])light(root,[0,h-.3,z],[w-2,.06,.2]);
 }
 if(hall){
  const hz=(gz+d/2)/2;
  ring(0,h-1,hz,6.5,.3,up);ring(0,h-2.2,hz,4,.24,up);ring(0,9.5,colZ,4.5,.22);
  for(const x of [-12,12])for(const z of [hz-4,hz+4]){cylinder(root,[x,(up+h)/2,z],[1,h-up,1],'#eef0ed').lookName='pillar';cylinder(root,[x,up+2.3,z],[1.04,.16,1.04],line);town.markDisc(id,ox+x,z,.5,up,h,'pillar');}
  sign(root,{zh:def.name,en:def.en},[0,h-3.6,d/2-.05],[14,2.2],['#233b52','#ffffff'],180);
  for(const x of [-17.3,17.3])light(root,[x,up+3.2,d/2-.08],[4.4,.1,.06]);
  // Round the hall: a stone dado, the line's colour higher up, lit panels, and slats under its roof
  // with a skylight in the middle of the rings.
  const z0=gz+.2,span=d/2-z0;
  for(const s of [-1,1]){
   box(root,[s*(w/2-.04),up+.6,(z0+d/2)/2],[.04,1.2,span],'#8b8f94').lookName='wall';
   box(root,[s*(w/2-.04),up+3.6,(z0+d/2)/2],[.04,.16,span],line);
   const ad=box(root,[s*(w/2-.07),up+2.4,12.5],[.04,2.4,1.8],'#f3efe3');ad.render.meshInstances[0].material=glow(s<0?'#f4d9a8':'#b9ddf0');ad.lookName='poster';
  }
  box(root,[0,up+.6,d/2-.04],[w,1.2,.04],'#8b8f94').lookName='wall';
  box(root,[0,up+3.6,d/2-.04],[w,.16,.04],line);
  for(let z=z0+.8;z<d/2-.4;z+=1.2)box(root,[0,h-.35,z],[w-.4,.12,.1],'#dfe3e4').lookName='ceiling';
  const sky=glow('#eef6f8');sky.emissiveIntensity=.7;sky.update();
  const skylight=box(root,[0,h-.2,hz],[9,.04,9],'#eef6f8');skylight.render.meshInstances[0].material=sky;skylight.lookName='ceiling';
  // Across the platform, the track wall rises the full height of the hall: tall lit panels on it.
  for(const x of [-15,-9,-3,3,9,15]){const panel=box(root,[x,11,-d/2+.06],[1.2,6,.06],'#eef6f8');panel.render.meshInstances[0].material=sky;panel.lookName='lamp';}
  box(root,[0,14.6,-d/2+.03],[w-.02,.2,.04],line);
  // The upper level's face over the platform: the line's colour and where the trains go.
  for(const s of [-1,1]){
   const x=s*(reach+(w/2-reach)/2);
   box(root,[x,up-1.2,f.top-.02],[w/2-reach-.4,.18,.04],line);
   sign(root,s<0?{zh:S['way-out'].zh,en:S['way-out'].en}:towards,[x,2.6,f.top-.03],[4,.7],s<0?['#233b52','#f2c14e']:blue,180);
  }
  for(const f2 of def.future??[])futureLine(town,root,room,f2,up);
  for(const e of stationExits(room.data))exitPortal(town,root,room,e,sign,light);
 }
 else{
  // Hung over the way onto the platform: where the trains go, and on its back the way out.
  const hang=2.9,hz=gz-2.6;
  for(const x of [-1.4,1.4])cylinder(root,[x,(hang+.27+L.ceiling)/2,hz],[.04,L.ceiling-hang-.27,.04],'#7f8b92');
  box(root,[0,hang,hz],[3.64,.62,.04],'#1d2b35');
  sign(root,towards,[0,hang,hz+.06],[3.6,.58],blue);
  sign(root,{zh:S['way-out'].zh,en:S['way-out'].en},[0,hang,hz-.06],[3.6,.58],['#1d2b35','#f2c14e'],180);
  // Up top by the street door: the way out.
  sign(root,{zh:S['way-out'].zh,en:S['way-out'].en},[0,room.data.doorHeight+.45,d/2-.06],[2.6,.56],['#1d2b35','#f2c14e'],180);
 }
 // Over each end of the flight, on a beam across it: stairs in the middle, an escalator either side.
 for(const [y,z,turn] of [[up,f.top+.3,0],[0,f.foot-.4,180]]){
  if(!hall&&!y)continue;   // at 青禾站 the foot is under the lower ceiling, and its signs
  for(const s of [-1,1])box(root,[s*reach,y+1.4,z],[.1,2.8,.1],'#7f8b92');
  box(root,[0,y+2.75,z],[2*reach+.1,.1,.1],'#7f8b92');
  sign(root,{zh:S.stairs.zh,en:S.stairs.en},[sx,y+2.42,z],[1.5,.5],pale,turn);
  for(const [x0,x1] of f.escalators)sign(root,{zh:S.escalator.zh,en:S.escalator.en},[(x0+x1)/2,y+2.42,z],[1.3,.5],pale,turn);
  for(const s of [-1,1])solid(s*reach,z,.05,.05,y+2.8,null,y);
 }
 town.registerLooks(id,root);
 town.batchStatics('metro-'+id,room.root);

 // --- the train ----------------------------------------------------------------------------------
 const train=new pc.Entity('metro-train');moving.addChild(train);
 const trainDoors=trainBody(town,train,line,pane,light);
 sign(train,{zh:metro.line.name},[-CAR.length/2-.72,1.23,0],[.9,.28],blue,90);
 // The carriage's space stays solid where the train stands; with it gone the platform doors are shut.
 const Lh=CAR.length/2,D=CAR.depth/2;
 solid(0,carZ,Lh,D,.1);solid(0,carZ-D,Lh,.06,2.9);for(const s of [-1,1])solid(s*Lh,carZ,.06,D,2.9);
 for(const [a,b] of [[-Lh,-6-DOOR],[-6+DOOR,-DOOR],[DOOR,6-DOOR],[6+DOOR,Lh]]){
  solid((a+b)/2,carZ+D-.04,(b-a)/2,.05,2.9);
  for(const s of [-1,1])solid((a+b)/2,carZ+s*1.36,(b-a)/2-.1,.25,.55);
 }
 for(const x of [-9,-3,3,9])town.markDisc(id,ox+x,carZ,.05,0,2.7,null);
 town.batchMoving(town.app.batcher.addGroup('metro-moving-'+id,true),[moving]);

 const crowd=commuters(town,room,L,machines,attendant);
 let gateOpen=0,shown=null,until=0,clock=0;
 const player=town.player.entity;
 return {
  ride:null,
  place(offset,open){
   train.setLocalPosition(offset,0,carZ);
   for(const {x,s,e} of psd)e.setLocalPosition(x+s*DOOR*(.5+.95*open),1.33,dz+.07);
   for(const {x,s,e} of trainDoors)e.setLocalPosition(x+s*DOOR*(.5+.95*open),1.15,D+.06);
   for(const hit of doorHits)hit.solid=open<1;
  },
  /** `pass` opens every passage to the tourist; a passage also opens for a commuter walking through. */
  gates(pass,dt){
   gateOpen=Math.max(0,Math.min(1,gateOpen+(pass?dt:-dt)*3));
   for(const [i,flap] of flaps.entries()){
    flap.hit.solid=!pass;
    flap.open=Math.max(0,Math.min(1,flap.open+(crowd.through(flap.x)?dt:-dt)*4));
    const o=Math.max(gateOpen,flap.open);
    for(const {e,s} of flap.leaves){e.setLocalScale(1-.85*o,1,1);e.setLocalPosition(flap.x+s*(.3+.25*o),gy+1,gz);}
   }
  },
  display(kind,value){
   const text=kind==='short'?{zh:S.short.zh,en:S.short.en,fg:'#ff8a7a'}:{zh:`${S.balance.zh} ${value}`,en:`${S.balance.en} ${value}`,fg:'#9fe0b4'};
   screen.set(text);shown=kind;until=clock+4;
  },
  /** Carried along an escalator, and up or down with the step under your feet. */
  escalate(dt,x,z){
   if(town.velocityY>.5)return;
   const on=carry(flights,z,x,town.playerY,dt,(nz,feet)=>town.canMove(ox+x,nz,feet));
   if(on){player.setPosition(ox+x,on.y,on.x);town.playerY=on.y;town.velocityY=0;town.grounded=true;}
  },
  tick(dt,p){
   clock+=dt;
   for(const fl of flights){
    fl.phase=((clock*fl.speed/fl.tread*fl.moves)%1+1)%1;
    fl.ribbon.setLocalPosition(0,fl.phase*fl.rise,fl.phase*fl.tread);
   }
   const text=boardText(boardAt(p));
   for(const b of boards)b.set(text);
   if(shown&&clock>until){shown=null;screen.set({zh:S['tap-in'].zh,en:S['tap-in'].en,fg:'#9fe0b4'});}
   this.ride?.update(dt);
  },
  people(dt,at,offset){crowd.update(dt,at,offset);},
 };
}

/** The carriage, drawn round its own centre: walls with windows, seats, poles, lights and its door leaves. */
function trainBody(town,train,line,pane,light){
 const {box,cylinder}=town.m,L=CAR.length,D=CAR.depth,H=CAR.height,t=.08,white='#e9eef0',grey='#9aa6ab';
 box(train,[0,.08,0],[L-.02,.04,D-.02],'#76858c');
 box(train,[0,H+.08,0],[L+.1,.16,D+.1],'#f3f5f3');
 // The far side: a band of windows along its whole length, looking out at the track wall.
 box(train,[0,.575,-D/2],[L,.95,t],white);pane(train,[0,1.55,-D/2],[L-.2,1,.04]);box(train,[0,2.375,-D/2],[L,.65,t],white);
 for(const x of [-7.5,-2.5,2.5,7.5])box(train,[x,1.55,-D/2],[.1,1.02,.1],white);
 // The platform side, between its three doorways, with the line's colour along it.
 for(const [a,b] of [[-L/2,-6-DOOR],[-6+DOOR,-DOOR],[DOOR,6-DOOR],[6+DOOR,L/2]]){
  const x=(a+b)/2,len=b-a;
  box(train,[x,.575,D/2],[len,.95,t],white);pane(train,[x,1.55,D/2],[len-.2,1,.04]);box(train,[x,2.375,D/2],[len,.65,t],white);
  box(train,[x,.95,D/2+.05],[len,.12,.02],line);
  for(const s of [-1,1]){
   box(train,[x,.275,s*(D/2-.43)],[len-.2,.35,.45],grey);
   box(train,[x,.49,s*(D/2-.29)],[len-.2,.08,.5],line);
   box(train,[x,.8,s*(D/2-.09)],[len-.2,.5,.08],line);
  }
 }
 for(const x of DOORS)box(train,[x,2.45,D/2],[2*DOOR,.5,t],white);
 for(const s of [-1,1])box(train,[s*(L/2-t/2),H/2+.05,0],[t,H,D],white);
 // The cab at the leading (-x) end, and a plain end at the back.
 box(train,[-L/2-.35,1.2,0],[.7,2.2,D-.2],white);
 box(train,[-L/2-.37,.95,0],[.7,.2,D-.18],line);
 box(train,[-L/2-.72,1.84,0],[.08,.86,D-.6],'#1f2b33');
 for(const z of [-1.1,1.1])light(train,[-L/2-.73,.62,z],[.06,.12,.3]);
 box(train,[L/2+.15,1.2,0],[.3,2.2,D-.2],white);
 box(train,[L/2+.17,.95,0],[.3,.2,D-.18],line);
 for(const x of [-9,-3,3,9])cylinder(train,[x,(.1+H)/2,0],[.07,H-.1,.07],'#c9d1d4');
 for(const z of [-.6,.6])cylinder(train,[0,2.15,z],[.05,L-1,.05],'#c9d1d4',[0,0,90]);
 for(const z of [-.75,.75])light(train,[0,H-.03,z],[L-2,.03,.14]);
 return DOORS.flatMap(x=>[-1,1].map(s=>{
  const e=new pc.Entity('train-door');e.setLocalPosition(x+s*DOOR/2,1.15,D/2+.06);train.addChild(e);
  box(e,[0,.01,0],[DOOR-.02,2.08,.05],'#dfe6e9');pane(e,[0,.4,0],[DOOR-.32,.9,.06]);
  return {x,s,e};
 }));
}

/** A line that is not running yet: a closed, colour-framed entrance on the hall's wall. Scenery only. */
function futureLine(town,root,room,f,y){
 const {box}=town.m,[w]=room.data.size,s=f.wall==='west'?-1:1;
 const g=new pc.Entity('future-line');g.setLocalPosition(s*w/2,y,f.at);g.setLocalEulerAngles(0,-s*90,0);root.addChild(g);
 for(const x of [-3,3])box(g,[x,2.1,.15],[.5,4.2,.3],f.colour);
 box(g,[0,4.5,.15],[6.5,.6,.3],f.colour);
 box(g,[0,1.95,.07],[5.5,3.9,.12],'#8b959b');
 for(let k=.3;k<3.9;k+=.3)box(g,[0,k,.14],[5.4,.04,.02],'#737d83');
 paintSign(town.m,g,{zh:f.line},[-1.5,4.5,.34],[1.7,.5],[f.colour,'#ffffff']);
 paintSign(town.m,g,{zh:f.status,en:f.en},[1.2,4.5,.34],[2.8,.5],[f.colour,'#ffffff']);
 paintSign(town.m,g,{zh:S.transfer.zh,en:S.transfer.en},[0,2.4,.2],[2.2,.6],['#39434b','#ffffff']);
 for(const x of [-2.6,2.6])box(g,[x,.5,1],[.08,1,.08],'#565f65');
 box(g,[0,.9,1],[5.2,.1,.03],'#e3b93c');
 // Turned onto the wall: the barrier in front is solid, and too high to hop, so the shutter is only ever looked at.
 town.mark(room.id,room.offsetX+s*(w/2-1),f.at,.1,2.7,y,y+1.8,null);
}

/**
 * An exit from the hall (stationExits): a passage standing out from the wall with steps rising
 * towards daylight, framed and signed with its letter and where it goes. It is walked up to, not into:
 * E at its mouth takes you out into the city (town.js).
 */
function exitPortal(town,root,room,e,sign,light){
 const {box}=town.m,[nx,nz]=e.normal,g=new pc.Entity('exit-'+e.id);
 g.setLocalPosition(e.wallAt.x,e.y,e.wallAt.z);g.setLocalEulerAngles(0,Math.atan2(nx,nz)*180/Math.PI,0);root.addChild(g);
 const W=3.4,H=3.4,frame='#2d3a44',day=town.m.glow('#f3f7ee');day.emissiveIntensity=1;day.update();
 for(const s of [-1,1]){box(g,[s*(W/2+.15),H/2,ALCOVE/2],[.3,H,ALCOVE],frame);}
 box(g,[0,H+.35,ALCOVE/2],[W+.6,.7,ALCOVE],frame);
 const glow=box(g,[0,H/2+.6,.08],[W,H-1.2,.06],'#f3f7ee');glow.render.meshInstances[0].material=day;glow.lookName='window';
 // Steps rising away towards the daylight, and a handrail up each side.
 for(let k=0;k<6;k++){const t=.18*(k+1);box(g,[0,t/2,ALCOVE-.3-k*.36],[W,t,.36],'#c9ccc6').lookName='stairs';}
 for(const s of [-1,1])box(g,[s*(W/2-.08),1.5,ALCOVE/2],[.05,.05,ALCOVE+.2],'#2b3339',[Math.atan2(1.08,2.16)*180/Math.PI,0,0]).lookName='railing';
 light(g,[0,H-.1,ALCOVE/2],[W-.6,.05,.2]);
 box(g,[0,.01,ALCOVE+.35],[W,.02,.7],'#e3b93c');
 const zh0=e.out?e.out.zh:e.id,to=e.out?.to;
 sign(g,{zh:zh0,en:`Exit ${e.id}`},[-1,H+.35,ALCOVE+.02],[1.6,.62],['#f2c14e','#1d2b35']);
 if(to)sign(g,{zh:to.zh,en:to.en},[1,H+.35,ALCOVE+.02],[2.2,.62],['#1d2b35','#ffffff']);
 // Its mouth is shut to walking, like any room's doorway: you leave with E.
 const [cx,cz]=[e.wallAt.x+nx*ALCOVE/2,e.wallAt.z+nz*ALCOVE/2],[hw,hd]=nx?[ALCOVE/2,W/2+.3]:[W/2+.3,ALCOVE/2];
 town.mark(room.id,room.offsetX+cx,cz,hw,hd,e.y,e.y+H,null);
}

// -------------------------------------------------------------------------------------------------
// People.

/**
 * Commuters: `person()` walkers on fixed lanes (room-local [x, y, z] waypoints, rising and falling
 * along the stairs), who come in from the street, stop at a card machine now and then, go through the
 * gates, wait behind the yellow line, board when the doors open and leave with the train; and others
 * who get off each train and head out. Six to ten of them by the graphics setting. They never block the
 * tourist: someone in their way gets a moment's pause, then they walk on. Between trips they are parked
 * out of sight under the floor rather than switched off, which would remake their batch.
 */
function commuters(town,room,L,machines,attendant){
 const {w,d,gz,gy,dz,up,f,carZ}=L,count={high:10,medium:8,low:6}[detail()]??8;
 const COLOURS=['#5b7fa6','#a65b5b','#6f9a6a','#c49a4a','#7a6aa6','#4f8f94','#b87a9a','#8a8f5a','#d08a5a','#5a6f8f'];
 const rand=(a,b)=>a+Math.random()*(b-a),pick=list=>list[Math.floor(Math.random()*list.length)];
 const people=Array.from({length:count},(_,i)=>{
  const made=town.m.person(room.root,COLOURS[i%COLOURS.length],[0,-30,0],false,40+i*7,{mix:'city'});
  return initIdle({...made,mode:'parked',x:0,y:-30,z:0,path:null,i:0,speed:1.2,leg:0,wait:0,still:0,spot:null});
 });
 town.batchMoving(town.app.batcher.addGroup('metro-people-'+room.id,true),[...people,...attendant?[attendant]:[]].map(p=>p.entity));
 const spots=DOORS.flatMap(x=>[-1,1].flatMap(s=>[0,1,2].map(k=>({x:x+s*1.25,z:dz+1.05+k*.55,door:x,taken:null}))));
 const lanes=dir=>[...f.escalators.filter(e=>e[2]===dir).map(e=>(e[0]+e[1])/2),f.stairs[0]+.5,f.stairs[1]-.5];
 // The way in from the street: its far end (the street door, or halfway up an exit's steps) and the
 // spot just inside it.
 const streets=gy?stationExits(room.data).map(e=>{
  const [nx,nz]=e.normal;return {far:[e.wallAt.x+nx*ALCOVE*.45,up+1,e.wallAt.z+nz*ALCOVE*.45],near:[e.inside.x,up,e.inside.z]};
 }):[{far:[0,up,d/2-.3],near:[0,up,d/2-1.8]}];
 const flightDown=x=>[[x,up,f.top+.7],[x,up,f.top],[x,0,f.foot],[x,0,f.foot-.7]];
 const through=(x,inward)=>inward?[[x,gy,gz+1.3],[x,gy,gz-1.2]]:[[x,gy,gz-1.3],[x,gy,gz+1.2]];
 const street=()=>{const s=pick(streets);return {far:s.far,near:[s.near[0]+rand(-.6,.6),up,s.near[2]]};};
 const machine=()=>machines.length&&Math.random()<.35?pick(machines):null;
 const ON=.1;   // the carriage's floor
 function inbound(p){
  const s=street(),m=machine(),gate=pick(PASSAGES)+rand(-.15,.15),lane=pick(lanes('down'))+rand(-.15,.15);
  const stop=m?[[m.x+rand(-.1,.1),m.y??gy,m.z+.75,{pause:rand(2,4),yaw:180}]]:[];
  const spot=spots.filter(o=>!o.taken).sort(()=>Math.random()-.5)[0];
  if(!spot)return false;
  spot.taken=p;p.spot=spot;
  const down=flightDown(lane),gates=through(gate,true);
  const route=gy?[...stop,...gates,...down]:[...down,...stop,...gates];
  go(p,[s.far,s.near,...route,[spot.x,0,spot.z,{yaw:180}]],'in');
  return true;
 }
 function outbound(p,door){
  const s=street(),gate=pick(PASSAGES)+rand(-.15,.15),lane=pick(lanes('up'))+rand(-.15,.15);
  const up2=flightDown(lane).reverse(),gates=through(gate,false);
  const route=gy?[...up2,...gates]:[...gates,...up2];
  go(p,[[door+rand(-.3,.3),ON,dz-.8],[door+rand(-.3,.3),0,dz+1.1],...route,s.near,s.far],'out');
 }
 function go(p,path,mode){
  p.path=path;p.i=0;p.mode=mode;p.wait=0;p.still=0;
  if(p.y<-10)[p.x,p.y,p.z]=path[0];
  p.from=[p.x,p.y,p.z];p.speed=rand(1.05,1.45);
 }
 function park(p){
  if(p.spot?.taken===p)p.spot.taken=null;
  p.spot=null;p.mode='parked';p.x=0;p.y=-30;p.z=0;p.entity.setLocalPosition(0,-30,0);
 }
 const rest=p=>{for(let i=0;i<2;i++){p.legs[i].setLocalEulerAngles(0,0,0);p.arms[i].setLocalEulerAngles(0,0,0);}};
 function step(p,dt){
  const [tx,ty,tz,opt]=p.path[p.i],dx=tx-p.x,dz2=tz-p.z,dist=Math.hypot(dx,dz2);
  if(p.wait>0){p.wait-=dt;animateIdle(p,dt);return;}
  if(dist<.05){
   p.y=ty;p.from=[tx,ty,tz];
   if(opt?.yaw!==undefined)p.entity.setLocalEulerAngles(0,opt.yaw,0);
   if(opt?.pause){p.wait=opt.pause;rest(p);}
   // At the end of the way: gone out into the street, aboard (update() hands them to the train), or waiting.
   if(++p.i>=p.path.length){p.path=null;rest(p);if(p.mode==='out')park(p);else if(p.mode!=='board')p.mode='wait';}
   p.entity.setLocalPosition(p.x,p.y,p.z);
   return;
  }
  // Somebody in the way (the tourist, on the same level): wait a moment, then walk on regardless.
  const me=town.player.entity.getPosition(),px=me.x-room.offsetX,pz=me.z;
  const ahead=(px-p.x)*dx+(pz-p.z)*dz2>0&&Math.hypot(px-p.x,pz-p.z)<.8&&Math.abs(town.playerY-p.y)<1.2;
  if(ahead&&p.still<1){p.still+=dt;rest(p);animateIdle(p,dt);return;}
  if(!ahead)p.still=0;
  const move=Math.min(dist,p.speed*dt),[fx,fy,fz]=p.from,run=Math.hypot(tx-fx,tz-fz)||1;
  p.x+=dx/dist*move;p.z+=dz2/dist*move;
  p.y=fy+(ty-fy)*Math.min(1,Math.hypot(p.x-fx,p.z-fz)/run);
  p.entity.setLocalPosition(p.x,p.y,p.z);
  p.entity.setLocalEulerAngles(0,Math.atan2(dx,dz2)*180/Math.PI,0);
  p.leg+=dt*6.5;
  for(let i=0;i<2;i++){p.legs[i].setLocalEulerAngles(Math.sin(p.leg+i*Math.PI)*21,0,0);p.arms[i].setLocalEulerAngles(Math.sin(p.leg+i*Math.PI)*-16,0,0);}
  animateIdle(p,dt,true);
 }
 let was=null,spawn=rand(1,3);
 return {
  /** Is someone walking through the passage at `x` (its flaps open for them)? */
  through:x=>people.some(p=>p.path&&Math.abs(p.x-x)<.5&&Math.abs(p.z-gz)<1.3&&Math.abs(p.y-gy)<1),
  update(dt,at,offset){
   const {state,t}=at;
   if(state!==was){
    // A train in: a few get off it. The doors shut: whoever got on goes with it.
    if(state==='arriving')for(const p of people.filter(q=>q.mode==='parked').slice(0,1+Math.floor(Math.random()*3))){
     p.mode='riding';p.rel=[pick(DOORS)+rand(-1.6,1.6),carZ+rand(-.5,.5)];p.y=ON;p.entity.setLocalEulerAngles(0,90,0);
    }
    if(state==='away')for(const p of people)if(p.mode==='aboard'||p.mode==='riding')park(p);
    was=state;
   }
   if((spawn-=dt)<=0){
    spawn=rand(4,9);
    const idle=people.filter(p=>p.mode==='parked');
    if(idle.length>2)inbound(idle[0]);
   }
   for(const p of people){
    if(p.mode==='parked')continue;
    if(p.mode==='riding'||p.mode==='aboard'){
     p.x=p.rel[0]+offset;p.z=p.rel[1];p.entity.setLocalPosition(p.x,ON,p.z);
     if(p.mode==='riding'&&state==='open'&&t>.4+Math.random()*2){p.mode='out';outbound(p,DOORS.reduce((a,b)=>Math.abs(b-p.rel[0])<Math.abs(a-p.rel[0])?b:a));}
     continue;
    }
    if(p.mode==='wait'){
     animateIdle(p,dt);
     if(state==='open'&&t>3&&t<T.open-4&&Math.random()<dt*.8&&p.spot){
      const x=p.spot.door+rand(-.35,.35);
      p.spot.taken=null;p.spot=null;
      go(p,[[x,0,dz+.7],[x,ON,dz-.9],[x+rand(-1.2,1.2),ON,carZ+rand(-.5,.5)]],'board');
     }
     continue;
    }
    if(p.mode==='board'){
     // Not through the doors yet when they start to close: back to wait for the next one.
     if(state!=='open'&&p.z>dz-.3){const spot=spots.find(o=>!o.taken);if(spot){spot.taken=p;p.spot=spot;go(p,[[spot.x,0,spot.z,{yaw:180}]],'in');}else park(p);continue;}
     if(!p.path){p.mode='aboard';p.rel=[p.x-offset,p.z];rest(p);continue;}
    }
    step(p,dt);
   }
   if(attendant)animateIdle(attendant,dt);
  },
 };
}

// -------------------------------------------------------------------------------------------------
// The ride: a carriage of its own, high over the station, with the tunnel streaming past.

/**
 * The same carriage in a tunnel `RIDE` metres up (inside the station's walls, so the room's own rules
 * hold): solid round the tourist with its doors shut, lit from inside, a second track and the tunnel
 * wall on the platform side, lamps, cross passages and signals flowing past, and two platforms: the
 * one it leaves, sliding away as it pulls out, and the one it stops at. It speeds up, runs, and on
 * `approach()` brakes to a stand exactly alongside the far platform; `open()` opens its doors.
 */
function buildRide(town,room,L){
 const {box,glow}=town.m,{carZ}=L,id=room.id,ox=room.offsetX,line=metro.line.colour,D=CAR.depth/2,Lh=CAR.length/2;
 const from=metro.stations[room.data.transit],to=metro.stations[otherEnd(room.data.transit)];
 const root=new pc.Entity('metro-ride');root.setLocalPosition(0,RIDE,0);room.root.addChild(root);
 const still=new pc.Entity('ride-tunnel');root.addChild(still);
 const flow=new pc.Entity('ride-flow');flow.noBatch=true;root.addChild(flow);
 const glass=glassMaterial??=makeGlass(),lit=glow('#fff6de');lit.emissiveIntensity=.9;lit.update();
 const green=glow('#7ee0a1'),red=glow('#ff6a5a');
 const pane=(parent,pos,size,rot)=>{const e=box(parent,pos,size,'#a9cbd6',rot);e.render.meshInstances[0].material=glass;e.render.castShadows=false;return e;};
 const light=(parent,pos,size,rot,m=lit)=>{const e=box(parent,pos,size,'#fff6de',rot);e.render.meshInstances[0].material=m;e.render.castShadows=false;return e;};
 const car=new pc.Entity('ride-carriage');car.setLocalPosition(0,0,carZ);flow.addChild(car);
 const doors=trainBody(town,car,line,pane,light);
 // Three fellow passengers: two sitting, one standing by a pole.
 for(const [x,side,colour] of [[-3.4,-1,'#6f9a6a'],[8.2,1,'#b87a9a'],[-8.4,0,'#5b7fa6']]){
  const one=town.m.person(car,colour,[0,0,0],false,90+Math.round(x*10),{mix:'city'});
  one.entity.setLocalPosition(x,side?.45-one.seatDrop:.1,side?side*(D-.45):.45);   // hips on the seat, its top .45 up
  if(side){one.entity.setLocalEulerAngles(0,side<0?0:180,0);one.sit(.35);}   // .35 above the carriage floor (src/world/people.js)
  else one.entity.setLocalEulerAngles(0,90,0);
 }
 // The tunnel: floor, the wall beyond the far windows, the far wall past a second track, a roof and ends.
 const near=carZ-D-1.1,wall=carZ+D+7.2,len=92,mid=(near+wall)/2;
 box(still,[0,-.05,mid],[len,.1,wall-near],'#23282c');
 box(still,[0,2.7,near-.1],[len,5.6,.2],'#30363a');box(still,[0,2.7,wall+.1],[len,5.6,.2],'#2b3034');
 box(still,[0,5.55,mid],[len,.2,wall-near],'#1d2124');
 for(const s of [-1,1])box(still,[s*len/2,2.7,mid],[.2,5.6,wall-near],'#1a1d20');
 for(const z of [carZ-.72,carZ+.72,carZ+D+3.2,carZ+D+4.6])box(still,[0,.03,z],[len,.06,.07],'#6d7479');
 for(const y of [.9,2.3,3.4])box(still,[0,y,near+.04],[len,.08,.06],'#1a1e21');
 town.batchStatics('metro-ride-'+id,still);
 // Flowing past: lamps on both walls, two cross passages, a signal, and the platforms.
 const bits=[];
 const add=(e,base,period)=>bits.push({e,base,period,y:e.getLocalPosition().y,z:e.getLocalPosition().z});
 for(let k=0;k<14;k++)add(light(flow,[0,1.62,near+.06],[.9,.14,.05]),k*6.5,91);
 for(let k=0;k<7;k++)add(light(flow,[0,1.75,wall-.06],[1.1,.16,.05]),k*13,91);
 for(const base of [20,65]){
  const g=new pc.Entity('cross-passage');g.setLocalPosition(0,0,near+.02);flow.addChild(g);
  box(g,[0,1.3,.02],[1.6,2.6,.04],'#121517');light(g,[0,2.8,.06],[.3,.12,.05],[0,0,0],green);add(g,base,91);
 }
 const signal=new pc.Entity('signal');signal.setLocalPosition(0,0,near+.25);flow.addChild(signal);
 box(signal,[0,.8,0],[.12,1.6,.12],'#3a3f43');box(signal,[0,1.6,.02],[.3,.6,.14],'#1a1d20');
 light(signal,[0,1.75,.1],[.14,.14,.04],[0,0,0],red);light(signal,[0,1.45,.1],[.14,.14,.04],[0,0,0],green);add(signal,44,91);
 const platform=def=>{
  const g=new pc.Entity('ride-platform');flow.addChild(g);
  const z0=carZ+D+.15,depth=wall-.3-z0,zc=z0+depth/2,W=40;
  box(g,[0,.01,zc],[W,.02,depth],'#cfd3cf');box(g,[0,.025,z0+.55],[W,.01,.12],'#e3b93c');
  for(let x=-W/2;x<=W/2;x+=2.5){box(g,[x,1.31,z0],[.12,2.62,.14],'#7f8b92');if(x<W/2)pane(g,[x+1.25,1.35,z0],[2.3,2.5,.04]);}
  box(g,[0,2.81,z0],[W,.42,.3],'#2c4250');box(g,[0,2.66,z0-.16],[W,.1,.02],line);
  box(g,[0,1.9,wall-.35],[W,3.8,.1],'#eef0ed');box(g,[0,3.05,wall-.42],[W,.14,.04],line);
  box(g,[0,3.9,zc],[W,.1,depth],'#dfe3e4');
  for(const z of [z0+1.2,wall-1.4])light(g,[0,3.82,z],[W-2,.05,.2]);
  for(const x of [-12,0,12])box(g,[x,1.95,zc+.8],[.6,3.9,.6],'#f4f6f4');
  for(const x of [-7,7])paintSign(town.m,g,{zh:def.name,en:def.en},[x,2.1,wall-.42],[5,1],[line,'#ffffff'],180);
  return g;
 };
 const leaving=platform(from),coming=platform(to);
 // The passengers, the lamps and the platforms move with the train: one dynamic batch, one lamp inside.
 town.batchMoving(town.app.batcher.addGroup('metro-ride-flow-'+id,true),[flow]);
 const bulb=new pc.Entity('ride-light');bulb.addComponent('light',{type:'omni',color:new pc.Color(1,.97,.9),intensity:.95,range:15,castShadows:false});
 bulb.setLocalPosition(0,2.3,carZ);root.addChild(bulb);
 // Solid round the tourist, doors shut: the floor, the sides, the ends, the roof, the seats and poles.
 const solid=(x,z,hw,hd,y0,y1)=>town.mark(id,ox+x,z,hw,hd,RIDE+y0,RIDE+y1,null);
 solid(0,carZ,Lh,D,0,.1);solid(0,carZ-D,Lh,.06,0,2.9);solid(0,carZ+D-.04,Lh,.06,0,2.9);
 for(const s of [-1,1])solid(s*Lh,carZ,.06,D,0,2.9);
 solid(0,carZ,Lh,D,2.75,2.95);
 for(const [a,b] of [[-Lh,-6-DOOR],[-6+DOOR,-DOOR],[DOOR,6-DOOR],[6+DOOR,Lh]])for(const s of [-1,1])solid((a+b)/2,carZ+s*1.36,(b-a)/2-.1,.25,0,.55);
 for(const x of [-9,-3,3,9])town.markDisc(id,ox+x,carZ,.05,RIDE,RIDE+2.7,null);
 root.enabled=false;

 const VMAX=16,ACCEL=2.4,BRAKE=5;   // m/s, m/s², and the seconds it takes to stop from full speed
 let s=0,v=0,mode='idle',stop=0,b=0,done=null,doorOpen=0,opening=null;
 const place=()=>{
  for(const bit of bits){const x=((bit.base+s)%bit.period+bit.period)%bit.period-bit.period/2;bit.e.setLocalPosition(x,bit.y,bit.z);}
  leaving.setLocalPosition(Math.min(s,200),0,0);
  coming.setLocalPosition(mode==='brake'||mode==='stopped'?s-stop:-300,0,0);
  for(const {x,s:side,e} of doors)e.setLocalPosition(x+side*DOOR*(.5+.95*doorOpen),1.15,D+.06);
 };
 return {
  begin(){root.enabled=true;s=0;v=0;mode='go';doorOpen=0;done=null;opening=null;place();},
  stop(){root.enabled=false;mode='idle';done?.();opening?.();},
  get moving(){return mode==='go'||mode==='brake';},
  /** Brake to a stand alongside the platform ahead: resolves when stopped. */
  approach(){
   if(mode==='stopped')return Promise.resolve();
   b=Math.max(v,6)/BRAKE;v=Math.max(v,6);stop=s+v*v/(2*b);mode='brake';
   return new Promise(resolve=>{done=resolve;});
  },
  /** The doors open onto the platform: resolves when they have. */
  open(){return new Promise(resolve=>{opening=resolve;});},
  update(dt){
   if(mode==='idle')return;
   if(mode==='go')v=Math.min(VMAX,v+ACCEL*dt);
   else if(mode==='brake'){
    const left=stop-s;v=Math.sqrt(2*b*Math.max(0,left));
    if(left<.02){s=stop;v=0;mode='stopped';const d=done;done=null;d?.();}
   }
   s+=v*dt;
   if(opening&&mode==='stopped'){doorOpen=Math.min(1,doorOpen+dt*1.6);if(doorOpen>=1){const o=opening;opening=null;o();}}
   place();
  },
 };
}

// -------------------------------------------------------------------------------------------------
// Signs and glass.

/**
 * A station sign: the Chinese large, the English under it, painted at the board's own proportions so
 * nothing is stretched, and lit so it reads in the dim. Only Chinese that is a signs.json entry can be
 * looked at and learned. `live` boards can change: set({zh, en, fg}) repaints them (and 繁體字 does).
 * Fixed signs painted alike (same words, colours and size) share one texture and material, so the
 * material is not to be changed afterwards (backlight() is used only on a sign painted once).
 */
const painted=new Map();
function paintSign(models,parent,text,pos,[w,h],[bg,fg]=['#233b52','#ffffff'],turn=0,live=false){
 const px=Math.min(PX,TEX_MAX/Math.max(w,h)),W=Math.max(64,Math.round(w*px)),H=Math.max(40,Math.round(h*px));
 const key=live?null:[bg,fg,text.zh,text.en,W,H].join('|');
 let now={bg,fg,...text},paint=key&&painted.get(key);
 if(!paint){
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const g=canvas.getContext("2d"),tex=new pc.Texture(pc.AppBase.getApplication().graphicsDevice,{width:W,height:H,mipmaps:true});
  const draw=()=>{
   g.fillStyle=now.bg;g.fillRect(0,0,W,H);
   g.fillStyle=now.fg;g.textAlign='center';g.textBaseline='middle';
   const zhText=zh(now.zh);
   if(now.en){
    g.font=`bold ${Math.round(H*.5)}px ${SANS}`;g.fillText(zhText,W/2,H*.37,W*.92);
    g.font=`600 ${Math.round(H*.25)}px "Segoe UI",Arial,sans-serif`;g.fillText(now.en,W/2,H*.79,W*.92);
   }
   else{g.font=`bold ${Math.round(H*.62)}px ${SANS}`;g.fillText(zhText,W/2,H*.54,W*.94);}
  };
  draw();tex.setSource(canvas);
  const m=new pc.StandardMaterial();m.diffuseMap=tex;m.emissiveMap=tex;m.emissive=new pc.Color(.55,.55,.55);m.update();
  paint={m,redraw:()=>{draw();tex.upload();}};
  if(key){painted.set(key,paint);scripted(paint.redraw);}   // shared: lives as long as the page
 }
 const e=models.box(parent,pos,[w,h,.05],bg);e.render.meshInstances[0].material=paint.m;e.render.castShadows=false;
 if(turn)e.setLocalEulerAngles(0,turn,0);
 e.signText=VOICED.has(text.zh)?text.zh:undefined;
 if(!key)scripted(paint.redraw,e);
 return {entity:e,set(next){if(live&&(next.zh!==now.zh||next.en!==now.en||(next.fg&&next.fg!==now.fg))){now={...now,...next};paint.redraw();}}};
}

function makeGlass(){
 const m=new pc.StandardMaterial();m.diffuse=new pc.Color(.62,.8,.86);m.opacity=.28;m.blendType=pc.BLEND_NORMAL;
 m.depthWrite=false;m.useMetalness=true;m.metalness=.2;m.gloss=.85;m.update();return m;
}

// -------------------------------------------------------------------------------------------------
// The way down from 青禾广场.

/** A sign in the open is backlit: it reads at midnight as well as at noon. */
function backlight(entity,strength=.85){
 const material=entity.render.meshInstances[0].material;
 material.emissive.set(strength,strength,strength);material.update();
 return entity;
}

/**
 * The way in, on 青禾广场: a glass canopy on a slim steel frame over a stair going down, its open front
 * facing the square, with the metro's mark (地铁) on a pylon beside it and a lit band across the front
 * carrying the roundel, the station's name 青禾站 and the exit letter A出入口; a pair of granite steps
 * lead up to it. The town's ground is one solid slab, so the stairwell below the top step is drawn as
 * a dark opening rather than cut into it: pressing E on the top step takes you in, at street level at
 * the top of the station's own stairs (rooms.json `metro-platform`).
 */
export function buildStationEntrance(models,parent,lamps){
 const {box,cylinder,label,glow}=models;
 const def=city.station;
 const root=new pc.Entity('metro-entrance');root.lookName='metro-station';
 root.setLocalPosition(def.x,0,def.z);root.setLocalEulerAngles(0,def.rotation??0,0);
 parent.addChild(root);
 const granite='#a9aaa5',steel='#8f989f',dark='#65707a';
 // The granite deck round the stairwell, open where the stair drops away (x ±1.7, z -1.72 to
 // 1.45), and two granite steps up to it along the front.
 for(const side of [-1,1])box(root,[side*2.075,.1,.35],[.75,.2,5.06],granite);
 box(root,[0,.1,-1.95],[3.4,.2,.46],granite);
 box(root,[0,.1,2.17],[3.4,.2,1.42],granite);
 box(root,[0,.075,-2.33],[4.9,.15,.3],'#b3b4ae');
 box(root,[0,.04,-2.63],[4.9,.08,.3],'#b3b4ae');
 // The top step, the first steps going down, then the dark of the stairwell.
 box(root,[0,-.06,-1.5],[3.4,.28,.44],'#9ba09f').lookName='stairs';
 for(let k=0;k<4;k++)box(root,[0,-.14-k*.07,-1.1+k*.34],[3.3,.02,.34],k%2?'#5c6266':'#6c7276').lookName='stairs';
 box(root,[0,.03,.55],[3.4,.02,1.8],'#1d2226').lookName='stairs';
 box(root,[0,-.6,1.6],[3.8,2,.3],'#3c4247');
 // Clear glass on three sides, in a slim steel frame. The glass casts no shadow.
 const glass=new pc.StandardMaterial();
 glass.diffuse=new pc.Color().fromString('#cfe3ea');glass.opacity=.3;glass.blendType=pc.BLEND_NORMAL;
 glass.depthWrite=false;glass.gloss=.9;glass.useMetalness=true;glass.metalness=.2;glass.update();
 const pane=(pos,size,rot)=>{const e=box(root,pos,size,'#cfe3ea',rot);e.render.meshInstances[0].material=glass;e.render.castShadows=false;return e;};
 for(const side of [-1,1]){
  pane([side*2.3,1.48,.35],[.05,2.56,4.9]);
  for(const z of [-2.1,-.55,1.05,2.8])box(root,[side*2.3,1.475,z],[.12,2.55,.12],steel);   // tops just under the glass's
  box(root,[side*2.3,.28,.35],[.14,.12,5.02],steel);
  box(root,[side*2.3,2.8,.35],[.18,.16,5.1],steel);
 }
 pane([0,1.48,2.8],[4.5,2.56,.05]);
 box(root,[0,2.8,2.8],[4.7,.16,.18],steel);
 box(root,[0,2.8,-2.1],[4.7,.16,.18],steel);
 // The canopy: a shallow glass vault on steel ribs, rising 0.7 m over the 5.2 m span and reaching
 // out over the steps, so the stair below is in daylight.
 const half=2.6,rise=.7,spring=2.9,R=(half*half+rise*rise)/(2*rise),top=Math.asin(half/R),n=8;
 for(let i=0;i<n;i++){
  const a=-top+(i+.5)*2*top/n,x=R*Math.sin(a),y=spring+rise-R+R*Math.cos(a),wide=2*R*Math.sin(top/n)+.03,roll=[0,0,-a*180/Math.PI];
  pane([x,y,.2],[wide,.05,5.9],roll);
  for(const z of [-2.72,-1.3,.2,1.7,3.12])box(root,[x,y-.06,z],[wide,.08,.1],dark,roll);
 }
 // The ribs between the panes stop just short of the glass's ends, so neither end lies flush with the other.
 for(let i=1;i<n;i++){const a=-top+i*2*top/n;box(root,[R*Math.sin(a),spring+rise-R+R*Math.cos(a)-.04,.2],[.06,.06,5.86],steel);}
 // The sign band along the front, read from the square (local -x is on your right): roundel,
 // name and exit letter, lit from within after dark.
 box(root,[0,2.45,-2.2],[4.62,.62,.12],'#1f3552');
 cylinder(root,[1.95,2.45,-2.27],[.48,.03,.48],'#f2f5f7',[90,0,0]);
 cylinder(root,[1.95,2.45,-2.29],[.36,.03,.36],'#2c68b0',[90,0,0]);
 box(root,[1.95,2.45,-2.31],[.07,.26,.02],'#f2f5f7');
 backlight(label(root,'青禾站',[.45,2.45,-2.28],2.4,.5,'#1f3552','#f4f7fa'),.8);
 backlight(label(root,'A出入口',[-1.5,2.45,-2.28],1.44,.3,'#f0c43a','#1f3552'),.8);
 const lit=glow('#e6eef5');
 const strip=box(root,[0,2.11,-2.2],[4.4,.05,.1],'#e6eef5');
 strip.render.meshInstances[0].material=lit;
 lamps?.push(lit);
 // The metro's mark on a pylon at the front corner, seen from across the square: 地铁 over the roundel.
 const px=-2.95,pzz=-2.35;
 box(root,[px,1.5,pzz],[.5,3,.5],'#1f3552');
 backlight(paintSign(models,root,{zh:S.metro.zh},[px,2.5,pzz-.26],[.46,.3],['#2c68b0','#ffffff']).entity,.9);
 cylinder(root,[px,1.7,pzz-.26],[.36,.03,.36],'#f2f5f7',[90,0,0]);
 cylinder(root,[px,1.7,pzz-.28],[.26,.03,.26],'#2c68b0',[90,0,0]);
 // The registry is axis aligned and knows nothing about the entity's rotation, so the hitboxes
 // are turned by hand here. Getting this wrong leaves a solid canopy floating on the wrong side
 // of the stair, which is invisible until you walk into it.
 const turn=(def.rotation??0)*Math.PI/180,cos=Math.cos(turn),sin=Math.sin(turn);
 const at=(lx,lz,hw,hd)=>({
  x:def.x+lx*cos+lz*sin, z:def.z-lx*sin+lz*cos,
  hw:Math.abs(cos)>.5?hw:hd, hd:Math.abs(cos)>.5?hd:hw,
 });
 // The canopy and the glass walls are solid, and so is the stairwell past the top step: you go
 // down by pressing E, not by walking off the edge. None of them is named, so a look lands on
 // the step or the stairwell (楼梯), a sign, or anywhere else on the entrance (地铁站). The boxes
 // meet without overlapping: walls up to 2.1 m, the roof above, the back wall between the sides.
 return {root,marks:[
  {...at(0,.2,2.65,3),y0:2.1,y1:3.7,name:null},
  {...at(-2.3,.35,.14,2.55),y0:0,y1:2.1,name:null},
  {...at(2.3,.35,.14,2.55),y0:0,y1:2.1,name:null},
  {...at(0,2.8,2.12,.14),y0:0,y1:2.1,name:null},
  {...at(0,.24,1.6,1.52),y0:0,y1:1.1,name:null},
  {...at(px,pzz,.25,.25),y0:0,y1:3,name:'metro-station'},
 ]};
}
