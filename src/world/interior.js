import * as pc from 'playcanvas';

// Interiors are built far from the square and swapped in wholesale, so the town keeps its own
// coordinates and nothing has to be unloaded when the tourist steps through a door.
export const ROOM_OFFSET=400;

/** Where an annex door sits flush with its wall, and which way it opens into the room.
 *  `wall` is 'east', 'west' or 'back' (the wall opposite the front door); x/z are the annex's own
 *  room-local coordinates, matching the wall's own line on one axis. `nx,nz` is the unit normal
 *  pointing from the wall into the room, used to nudge hitboxes clear of the door leaf. */
export function annexDoor(wall,x,z,w,d){
  if(wall==='west')return {x:-w/2+.035,z,rot:90,nx:1,nz:0};
  // Nudged further off the back wall than the door itself needs, so it clears the trim strip and
  // window frames drawn along that same inner face.
  if(wall==='back')return {x,z:-d/2+.11,rot:0,nx:0,nz:1};
  return {x:w/2-.035,z,rot:-90,nx:-1,nz:0};
}
/** A point near an annex door, nudged inward off its wall by `offset`. Hitboxes and interaction
 *  targets are measured from here, not from the annex's raw content coordinates, so they always
 *  line up with the door as drawn (whichever wall it is on). */
export function annexApproach(wall,x,z,w,d,offset){
  const at=annexDoor(wall,x,z,w,d);
  return {...at,x:at.x+at.nx*offset,z:at.z+at.nz*offset};
}

/**
 * The solid parts of a room's upper floor (`upper`), in room-local coordinates, shared by the
 * drawing and the hitboxes: the slab round its stairwell (`well`: x0,z0,x1,z1), one box per step
 * (a straight flight climbing towards the back, each rise low enough to walk up), and a railing
 * up the open side of the flight and along the stairwell's edge upstairs.
 */
export function upperParts(data){
  const u=data.upper;if(!u)return [];
  const [w,d]=data.size,s=u.stairs,[wx0,wz0,wx1,wz1]=u.well,parts=[];
  const add=(kind,x0,z0,x1,z1,y0,y1)=>{if(x1>x0&&z1>z0)parts.push({kind,x:(x0+x1)/2,z:(z0+z1)/2,hw:(x1-x0)/2,hd:(z1-z0)/2,y0,y1});};
  for(const [x0,z0,x1,z1] of [[-w/2,-d/2,wx0,d/2],[wx1,-d/2,w/2,d/2],[wx0,-d/2,wx1,wz0],[wx0,wz1,wx1,d/2]])add('slab',x0,z0,x1,z1,u.y-.2,u.y);
  for(let i=0;i<s.steps;i++)add('step',s.x-s.width/2,s.z-(i+1)*s.tread,s.x+s.width/2,s.z-i*s.tread,0,u.y*(i+1)/s.steps);
  // The first two steps are open to the side, so the flight can be walked onto from the room.
  // The rail hitboxes stand well above the drawn handrails: a jump (1.08) plus a step-up (0.42)
  // from the landing must not reach their tops, or they become a ledge to stand on.
  const edge=s.x+s.width/2;
  add('rail',edge-.03,wz0,edge+.03,s.z-2*s.tread,0,u.y+1.6);
  add('rail',wx1-.03,wz0,wx1+.03,wz1,u.y,u.y+1.6);
  return parts;
}

export function buildRoom(models,parent,data,index,id){
  const {box,cylinder,label}=models;
  const root=new pc.Entity('room-'+index);
  root.setLocalPosition(ROOM_OFFSET*(index+1),0,0);
  parent.addChild(root);
  const [w,d]=data.size,h=data.height,t=.22;
  const back=-d/2,front=d/2;

  // Floor: the room's own pattern from floors.json, or plain boards with seams a shade darker.
  const style=floors.styles[floors.rooms[id]];
  // `x0,z1` is the part's west and front edge, so every part of a floor continues one pattern.
  const paint=(e,pw,pd,x0=-w/2,z1=d/2)=>{if(style)e.render.meshInstances[0].material=floorMaterial(pc.AppBase.getApplication(),style,pw,pd,x0+w/2,d/2-z1);return e;};
  paint(box(root,[0,-.1,0],[w,.2,d],data.floor),w,d).lookName='floor';
  if(!style)for(let x=-w/2+.75;x<w/2-.5;x+=1.5)box(root,[x,.004,0],[.05,.015,d-.1],data.trim);

  // Walls. The front wall carries a doorway gap the tourist walks through.
  box(root,[-w/2-t/2,h/2,0],[t,h,d],data.wall);
  box(root,[w/2+t/2,h/2,0],[t,h,d],data.wall);
  box(root,[0,h/2,back-t/2],[w+t*2,h,t],data.wall);
  // A room entered upstairs (`upper.entrance`, the metro platform) has its doorway up there too.
  const gap=1.7,top=data.doorHeight??h-1.1,sill=data.upper?.entrance?data.upper.y:0;
  // What the street view (views.js) shows through: the doorway gap, unless it is walled up, and
  // the front window panes. `face` is the outer face of the front wall, room-local.
  const openings={sill,face:front+t,panes:[],door:data.returnWall?null:{y:(sill+top)/2,z:front+t/2,hw:gap/2,hh:(top-sill)/2,hd:t/2}};
  for(const side of [-1,1])box(root,[side*(gap/2+(w-gap)/4),h/2,front+t/2],[(w-gap)/2,h,t],data.wall);
  box(root,[0,(top+h)/2,front+t/2],[gap,h-top,t],data.wall);
  if(sill)box(root,[0,sill/2,front+t/2],[gap,sill,t],data.wall);
  box(root,[0,sill+.05,front+t/2],[gap+.5,.1,t+.5],data.trim);

  // Ceiling and exposed beams, unless the room is a courtyard open to the sky.
  if(!data.open){
    const ceil=box(root,[0,h+.1,0],[w+.4,.2,d+.4],data.wall);
    ceil.name='room-ceiling';ceil.lookName='ceiling';
    for(let i=0;i<4;i++)box(root,[0,h-.06,back+1.4+i*((d-2.8)/3)],[w,.16,.22],data.roofBeam).lookName='beam';
  }
  // A second floor: its slab (boards on top, ceiling underneath), the stairs up to it, and railings.
  for(const {kind,x,z,hw,hd,y0,y1} of upperParts(data)){
    if(kind==='slab'){
      paint(box(root,[x,y1-.01,z],[hw*2,.02,hd*2],data.floor),hw*2,hd*2,x-hw,z+hd).lookName='floor';
      box(root,[x,(y0+y1-.02)/2,z],[hw*2,y1-y0-.02,hd*2],data.wall).lookName='ceiling';
    } else if(kind==='step')box(root,[x,y1/2,z],[hw*2,y1,hd*2],data.trim).lookName='stairs';
  }
  if(data.upper){
    const u=data.upper,s=u.stairs,[,wz0,wx1,wz1]=u.well,edge=s.x+s.width/2,rise=u.y/s.steps;
    // Up the flight: a sloping handrail from the third step to the landing, on posts.
    const z0=s.z-2*s.tread,y0=2*rise+.9,y1=u.y+.9,railAt=z=>y0+(z0-z)/(z0-wz0)*(y1-y0);
    box(root,[edge,(y0+y1)/2,(z0+wz0)/2],[.06,.06,Math.hypot(z0-wz0,y1-y0)],data.roofBeam,[Math.atan2(y1-y0,z0-wz0)*180/Math.PI,0,0]).lookName='railing';
    for(let i=2;i<s.steps;i+=3){
      const z=s.z-(i+.5)*s.tread,foot=u.y*(i+1)/s.steps;
      box(root,[edge,(foot+railAt(z))/2,z],[.05,railAt(z)-foot,.05],data.roofBeam).lookName='railing';
    }
    // Upstairs, round the open edge of the stairwell.
    for(const y of [u.y+.95,u.y+.45])box(root,[wx1,y,(wz0+wz1)/2],[.06,.06,wz1-wz0],data.roofBeam).lookName='railing';
    for(let z=wz0;z<=wz1-.05;z+=(wz1-wz0)/5)box(root,[wx1,u.y+.48,z+.03],[.05,.96,.05],data.roofBeam).lookName='railing';
  }
  // Lanterns hang from the ceiling on cords, `lanterns: [[x,z],...]`; the town dims them by day.
  const lamps=[];
  for(const [x,z] of data.lanterns??[]){
    const y=h-1.5;
    const lit=models.lantern(root,x,y,z);
    lit.entity.lookName='lantern';
    lamps.push(lit.material);
    cylinder(root,[x,(y+.65+h)/2,z],[.03,h-y-.65,.03],'#715945').lookName='lantern';
  }

  // Everything below sits on the INNER face of the back wall so it is visible from inside.
  const inner=back+.04;
  for(const y of [.62,h-.3])box(root,[0,y,inner],[w,.09,.05],data.trim);
  if(data.window)for(const x of data.window){
    box(root,[x,1.85,inner+.02],[1.5,1.5,.06],'#cfe0dd').lookName='window';
    for(const off of [-.45,.45])box(root,[x+off,1.85,inner+.06],[.07,1.45,.05],data.trim).lookName='window';
    box(root,[x,1.85,inner+.06],[1.55,.08,.05],data.trim).lookName='window';
    box(root,[x,1.05,inner+.09],[1.7,.1,.22],data.trim).lookName='window';
  }
  label(root,data.zh,[0,h-.62,inner+.06],Math.min(3.2,w-2.4),.58);
  // Windows (and glass doors, `door: true`) on the inner face of the front wall, beside the doorway.
  for(const pane of data.frontWindows??[]){
    const face=front-.04,[sill,pw,ph]=pane.door?[1.1,1.2,2.1]:[1.75,1.1,1.2],y=sill+(pane.y??0);
    openings.panes.push(box(root,[pane.x,y,face-.02],[pw,ph,.06],'#cfe0dd'));
    box(root,[pane.x,y,face-.06],[.07,ph-.05,.05],data.trim);
    for(const off of [-1,1])box(root,[pane.x+off*pw/2,y,face-.06],[.08,ph+.08,.06],data.trim);
    box(root,[pane.x,y+ph/2,face-.06],[pw+.08,.08,.06],data.trim);
    box(root,[pane.x,pane.door?(pane.y??0)+.03:y-ph/2,face-(pane.door?.06:.09)],[pw+.2,pane.door?.06:.1,pane.door?.06:.22],data.trim);
  }
  // A large hanging scroll with a line of calligraphy, centred on the back wall.
  if(data.motto){
    const y=h*.6;
    box(root,[0,y,inner+.03],[4.2,1.2,.04],'#f2e8d0').lookName='calligraphy';
    for(const dy of [-.66,.66])cylinder(root,[0,y+dy,inner+.07],[.07,4.5,.07],'#6b4a33',[0,0,90]).lookName='calligraphy';
    label(root,data.motto,[0,y,inner+.1],3.8,.8,'#f2e8d0','#3b2e25');
  }
  // A room can have back rooms of its own, each on the east, west or back wall. Each door sits
  // flush with the inner face of its wall, turned to face into the room, so it reads as a door
  // and not as a painting.
  // A back room whose way back is not its front wall (`returnWall`) has that wall closed up, and
  // its way back drawn like any annex door.
  if(data.returnWall)box(root,[0,top/2,front+t/2],[gap,top,t],data.wall);
  const way=data.returnWall?[{wall:data.returnWall,x:data.exit[0],z:data.exit[1]}]:[];
  for(const annex of [...(data.annexes??[]),...way]){
    const at=annexDoor(annex.wall,annex.x,annex.z,w,d);
    const door=new pc.Entity('annex-door');door.setLocalPosition(at.x,0,at.z);door.setLocalEulerAngles(0,at.rot,0);root.addChild(door);
    box(door,[0,1.08,0],[1.25,2.16,.055],'#719485');
    box(door,[0,1.42,.04],[.83,.66,.03],'#cbded2');
    cylinder(door,[.42,1,.065],[.08,.08,.08],'#d4b67c');
    if(annex.zh)label(door,annex.zh,[0,1.92,.07],.8,.28,'#f5edda','#456d58');
  }
  for(const x of [-w/2+.35,w/2-.35])for(const z of [back+.35,front-.35])cylinder(root,[x,h/2,z],[.2,h,.2],data.trim).lookName='pillar';

  // A closed box gets no sun, so each room carries its own warm lamp plus a soft fill.
  const lamp=new pc.Entity('room-light');
  lamp.addComponent('light',{type:'omni',color:new pc.Color(1,.94,.82),intensity:.95,range:Math.max(w,d)*1.2,castShadows:false});
  lamp.setLocalPosition(0,h-.75,0);
  root.addChild(lamp);
  // With a second floor, the slab would leave the ground floor dark: a second lamp hangs under it.
  const ceilings=[lamp];
  if(data.upper){
    const low=lamp.clone();low.name='room-light-low';low.setLocalPosition(0,data.upper.y-.75,0);root.addChild(low);ceilings.push(low);
  }
  const fill=new pc.Entity('room-fill');
  fill.addComponent('light',{type:'directional',color:new pc.Color(.9,.94,1),intensity:.3,castShadows:false});
  fill.setLocalEulerAngles(58,-160,0);
  root.addChild(fill);
  // Open to the sky, a courtyard gets daylight as well; the town dims it after dark.
  let sun=null;
  if(data.open){
    sun=new pc.Entity('room-sun');
    sun.addComponent('light',{type:'directional',color:new pc.Color(1,.96,.86),intensity:.9,castShadows:false});
    sun.setLocalEulerAngles(50,30,0);
    root.addChild(sun);
  }

  // Shop fittings: the shelves, racks and counters that make a shop look like its trade.
  const fittings=[];
  for(const def of data.fittings??[]){
    // Wall pieces hang below the ceiling of their own storey: under an upper floor that is its slab.
    const storey=data.upper?(def.y?h-def.y:data.upper.y-.2):h;
    const made=models.fitting(root,def.kind,def.tint,def.sign,storey);
    made.entity.setLocalPosition(def.x,def.y??0,def.z);   // `y`: it stands on the upper floor
    made.entity.setLocalEulerAngles(0,def.rot??0,0);
    // A department sign hangs from the ceiling above its counter, so a big shop can be read from
    // the door. Racks paint their own board, so they are not given a second one.
    if(def.sign&&!made.signed&&def.kind!=='hardwarebay'){
      const y=Math.min((def.y??0)+(made.top??2)+.7,h-.45);
      for(const off of [-.62,.62])box(root,[def.x+off,(y+h)/2,def.z],[.03,h-y,.03],'#7d7563').signText=def.sign;
      label(root,def.sign,[def.x,y,def.z],1.8,.44,'#f4ead2','#36594f');
    }
    const [hw,hd]=rotatedHalf(made.half,def.rot??0);
    fittings.push({...def,...made,hw,hd});
  }

  // Wall decor from walls.json: wainscoting round the walls, and pieces that go up only where
  // nothing else already is (a counter added later simply wins its stretch of wall).
  const decor=walls.rooms[id];
  if(decor){
    const blocked=wallBlockers(data,fittings);
    if(decor.wainscot)for(const wall of ['front','back','west','east'])for(const [a0,a1] of wainscotRuns(data,blocked,wall)){
      // Flush with the wall, and thick enough to take in the back wall's low trim strip.
      const face=onWall(root,wall,(a0+a1)/2,w,d,0);
      box(face,[0,WAINSCOT/2,.035],[a1-a0,WAINSCOT,.07],decor.wainscot).lookName='wall';
      box(face,[0,WAINSCOT,.045],[a1-a0+.01,.06,.09],data.trim).lookName='wall';
    }
    for(const piece of decor.pieces??[])if(wallFits(piece,blocked,data))lamps.push(...wallPiece(models,onWall(root,piece.wall,piece.at,w,d),piece));
  }

  // The study desk is part of the house, so the review spot always exists.
  if(data.desk){
    const d0=data.desk,desk=new pc.Entity('study-desk');
    desk.setLocalPosition(d0.x,0,d0.z);desk.setLocalEulerAngles(0,d0.rot??0,0);root.addChild(desk);
    box(desk,[0,.74,0],[1.8,.08,.8],'#b08b60');
    box(desk,[-.62,.5,0],[.44,.4,.68],'#a97d55');
    box(desk,[-.62,.5,.352],[.36,.24,.04],'#e0c69c');
    for(const x of [-.82,.82])for(const z of [-.33,.33])box(desk,[x,.37,z],[.08,.74,.08],'#8a6c49');
    box(desk,[.1,.88,-.3],[1.0,.03,.62],'#f4ecd8').lookName='notebook';
    box(desk,[.1,.9,-.3],[.03,.04,.63],'#c9a97a').lookName='notebook';
    cylinder(desk,[.72,.96,-.24],[.16,.36,.16],'#9db08f').lookName='pen';
    for(const [dx,c] of [[-.04,'#c47f6b'],[.03,'#7f9ab0'],[.09,'#d9b072']])cylinder(desk,[.72+dx,1.16,-.24],[.03,.32,.03],c).lookName='pen';
    box(desk,[-.2,.82,.1],[.42,.06,.3],'#e6d9bd').lookName='paper';
    label(desk,'生词本',[.1,1.02,-.44],.86,.24,'#f2e7c8','#5f7f5f');
  }
  // A counter drawn as a piece of its own (`look`, a fitting kind: the word hall's 书案), or a plain one.
  if(data.lectern?.look){
    const made=models.fitting(root,data.lectern.look);
    made.entity.setLocalPosition(data.lectern.x,0,data.lectern.z);
    if(made.material)lamps.push(made.material);
  } else if(data.lectern){
    const {x,z}=data.lectern;
    box(root,[x,.45,z],[1.9,.9,.75],'#8d6f52');
    box(root,[x,.94,z],[2.2,.12,.95],'#c9a97a');
    box(root,[x,1.18,z-.18],[1.7,.34,.1],'#6f8570',[-22,0,0]);
    for(const dx of [-2.1,2.1]){
      box(root,[x+dx,1.1,z-.35],[.3,2.2,1.5],'#a98a66');
      for(let i=0;i<4;i++)box(root,[x+dx,.42+i*.56,z-.35],[.36,.06,1.55],'#c7ab83');
    }
  }
  return {root,ceilings,fittings,sun,lamps,openings};
}
import {rotatedHalf} from './navigation.js';
import {floorMaterial} from './paving.js';
import floors from '../content/floors.json' with {type:'json'};
import walls from '../content/walls.json' with {type:'json'};

/** Wall pieces from walls.json: how wide each is along its wall, and the band of wall it covers. */
const WALL_PIECES={scroll:{w:.7,y0:1.0,y1:2.5},painting:{w:1.2,y0:1.3,y1:2.2},shelf:{w:1.4,y0:1.3,y1:2.0},lattice:{w:1.4,y0:1.05,y1:2.35},lamp:{w:.4,y0:1.85,y1:2.45}};
const WAINSCOT=.9;
const wallLength=(data,wall)=>wall==='front'||wall==='back'?data.size[0]:data.size[1];

/**
 * What already takes up a room's walls, as spans a wall piece must keep clear of: `a0..a1` along
 * the wall (x on the front and back walls, z on the east and west ones) and `y0..y1` up it. Doors
 * break the wainscoting too; anything that `stands` in front of a wall (fittings, the counter, the
 * desk, the stairs) only keeps pieces off it.
 */
export function wallBlockers(data,fittings=[]){
  const [w,d]=data.size,h=data.height,out=[];
  const add=(wall,a,half,y0,y1,stands=false)=>out.push({wall,a0:a-half,a1:a+half,y0,y1,stands});
  const top=data.doorHeight??h-1.1,sill=data.upper?.entrance?data.upper.y:0;
  if(!data.returnWall)add('front',0,1.2,sill,top+.1);                    // the doorway and its sill board
  for(const pane of data.frontWindows??[]){
    const lift=pane.y??0;
    if(pane.door)add('front',pane.x,.75,lift,lift+2.25);else add('front',pane.x,.7,lift+1.05,lift+2.45);
  }
  for(const x of data.window??[])add('back',x,.9,.95,2.7);
  add('back',0,Math.min(3.2,w-2.4)/2+.1,h-.95,h);                        // the room's name board
  if(data.motto)add('back',0,2.3,h*.6-.75,h*.6+.75);
  const way=data.returnWall?[{wall:data.returnWall,x:data.exit[0],z:data.exit[1]}]:[];
  for(const annex of [...(data.annexes??[]),...way])add(annex.wall,annex.wall==='back'?annex.x:annex.z,.75,0,2.35);
  // Anything standing within half a metre of a wall takes that stretch of it, floor to ceiling.
  const rects=fittings.map(({x,z,hw,hd})=>({x,z,hw,hd}));
  if(data.lectern){const {x,z}=data.lectern;rects.push({x,z,hw:1.15,hd:.5});for(const dx of [-2.1,2.1])rects.push({x:x+dx,z:z-.35,hw:.2,hd:.78});}
  if(data.desk)rects.push({x:data.desk.x,z:data.desk.z,hw:.95,hd:.95});   // whichever way it is turned
  if(data.upper){const s=data.upper.stairs,run=s.steps*s.tread/2;rects.push({x:s.x,z:s.z-run,hw:s.width/2,hd:run});}
  for(const r of rects){
    if(r.x-r.hw<-w/2+.5)add('west',r.z,r.hd,0,h,true);
    if(r.x+r.hw>w/2-.5)add('east',r.z,r.hd,0,h,true);
    if(r.z-r.hd<-d/2+.5)add('back',r.x,r.hw,0,h,true);
    if(r.z+r.hd>d/2-.5)add('front',r.x,r.hw,0,h,true);
  }
  return out;
}
/** Does a wall piece fit where walls.json puts it: clear of the corners, the ceiling (or the upper
 *  floor's slab) and everything in `blockers`, with a hand's width to spare. */
export function wallFits(piece,blockers,data){
  const size=WALL_PIECES[piece.kind];if(!size)return false;
  const half=size.w/2,mid=piece.y??(size.y0+size.y1)/2,y0=mid-(size.y1-size.y0)/2,y1=mid+(size.y1-size.y0)/2;
  if(Math.abs(piece.at)+half>wallLength(data,piece.wall)/2-.5||y1>(data.upper?.y??data.height)-.25)return false;
  return !blockers.some(b=>b.wall===piece.wall&&piece.at+half>b.a0-.1&&piece.at-half<b.a1+.1&&y1>b.y0&&y0<b.y1);
}
/** The stretches of a wall the wainscoting runs along: corner to corner, broken only at doors. */
export function wainscotRuns(data,blockers,wall){
  const end=wallLength(data,wall)/2-.45,runs=[];let from=-end;
  for(const b of blockers.filter(b=>b.wall===wall&&!b.stands&&b.y0<WAINSCOT).sort((a,b)=>a.a0-b.a0)){
    if(b.a0>from)runs.push([from,Math.min(b.a0,end)]);
    from=Math.max(from,b.a1);
  }
  if(end>from)runs.push([from,end]);
  return runs.filter(([a0,a1])=>a1-a0>.3);
}
/** A frame on a wall's inner face, `at` along it, turned so its +z faces into the room. Pieces on
 *  the back wall stand a little further off it, clear of the trim strips running along it. */
function onWall(root,wall,at,w,d,off=.07){
  const [x,z,rot]={back:[at,-d/2+off,0],front:[at,d/2,180],west:[-w/2,at,90],east:[w/2,at,-90]}[wall];
  const e=new pc.Entity('wall-'+wall);e.setLocalPosition(x,0,z);e.setLocalEulerAngles(0,rot,0);root.addChild(e);
  return e;
}
/** Draws one wall piece into its frame; returns any glowing material for the town to dim by day. */
function wallPiece({box,cylinder,shape,glow,latticeWindow},e,piece){
  const {kind,tint}=piece,size=WALL_PIECES[kind],y=piece.y??(size.y0+size.y1)/2;
  const named=key=>{const g=new pc.Entity(key);g.lookName=key;e.addChild(g);return g;};
  if(kind==='scroll'){
    // A hanging scroll: silk mounting, a paper painting of ink hills with a line of writing and a
    // red seal, and a roller top and bottom.
    const g=named('scroll-painting');
    box(g,[0,y,.012],[.6,1.36,.02],tint??'#b9a37a');
    box(g,[0,y-.04,.026],[.46,1.0,.01],'#f3ead3');
    shape(g,'cone',[-.07,y-.12,.034],[.3,.4,.004],'#6f7a74');
    shape(g,'cone',[.1,y-.2,.036],[.24,.26,.004],'#a3aba4');
    box(g,[.15,y+.28,.034],[.03,.36,.004],'#3b3a36');
    box(g,[-.15,y-.44,.034],[.05,.05,.004],'#b8463a');
    cylinder(g,[0,y+.7,.03],[.035,.66,.035],'#6b4a33',[0,0,90]);
    cylinder(g,[0,y-.7,.03],[.045,.7,.045],'#6b4a33',[0,0,90]);
  } else if(kind==='painting'){
    // A framed landscape: sky, two hills, a meadow and a low sun.
    const g=named('painting');
    box(g,[0,y,.02],[1.2,.9,.04],tint??'#6f5236');
    box(g,[0,y,.042],[1.06,.76,.01],'#dfe7e0');
    shape(g,'cone',[-.2,y-.1,.049],[.62,.44,.004],'#8aa391');
    shape(g,'cone',[.22,y-.14,.051],[.52,.34,.004],'#5f7d6c');
    box(g,[0,y-.29,.05],[1.06,.18,.004],'#a9bd8f');
    cylinder(g,[.34,y+.2,.047],[.1,.004,.1],'#e3a869',[90,0,0]);
  } else if(kind==='shelf'){
    // A wall shelf on two brackets with books, a vase and a cup on it.
    const shelf=named('shelf');
    box(shelf,[0,y-.2,.13],[1.4,.05,.26],tint??'#a97d55');
    for(const x of [-.55,.55])box(shelf,[x,y-.3,.05],[.05,.2,.1],'#7d6349');
    const books=named('book');
    ['#8fa98d','#c47f6b','#d9b072','#7f9ab0'].forEach((c,i)=>box(books,[-.52+i*.09,y-.03,.13],[.07,.3,.2],c));
    const vase=named('vase');
    shape(vase,'sphere',[.24,y-.08,.13],[.17,.2,.17],'#5a7fae');
    cylinder(vase,[.24,y+.05,.13],[.07,.1,.07],'#5a7fae');
    cylinder(named('cup'),[.5,y-.12,.13],[.12,.11,.12],'#efe7d2');
  } else if(kind==='lattice'){
    latticeWindow(e,0,y,.07,1.2,1.2,tint??'#637b70');
  } else if(kind==='lamp'){
    // A wall lamp: a plate, a short arm and a glowing shade, lit after dark with the lanterns.
    const g=named('lamp'),lit=glow('#f7e7bb');
    box(g,[0,y-.15,.02],[.14,.22,.04],'#7d6349');
    box(g,[0,y-.1,.11],[.04,.04,.18],'#7d6349');
    cylinder(g,[0,y+.02,.22],[.22,.26,.22],'#f7e7bb').render.meshInstances[0].material=lit;
    return [lit];
  }
  return [];
}
