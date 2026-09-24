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

export function buildRoom(models,parent,data,index){
  const {box,cylinder,label}=models;
  const root=new pc.Entity('room-'+index);
  root.setLocalPosition(ROOM_OFFSET*(index+1),0,0);
  parent.addChild(root);
  const [w,d]=data.size,h=data.height,t=.22;
  const back=-d/2,front=d/2;

  // Floor, with seams a shade darker than the boards rather than drawn in ink.
  box(root,[0,-.1,0],[w,.2,d],data.floor).lookName='floor';
  for(let x=-w/2+.75;x<w/2-.5;x+=1.5)box(root,[x,.004,0],[.05,.015,d-.1],data.trim);

  // Walls. The front wall carries a doorway gap the tourist walks through.
  box(root,[-w/2-t/2,h/2,0],[t,h,d],data.wall);
  box(root,[w/2+t/2,h/2,0],[t,h,d],data.wall);
  box(root,[0,h/2,back-t/2],[w+t*2,h,t],data.wall);
  // A room entered upstairs (`upper.entrance`, the metro platform) has its doorway up there too.
  const gap=1.7,top=data.doorHeight??h-1.1,sill=data.upper?.entrance?data.upper.y:0;
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
      box(root,[x,y1-.01,z],[hw*2,.02,hd*2],data.floor).lookName='floor';
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
    box(root,[pane.x,y,face-.02],[pw,ph,.06],'#cfe0dd');
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

  // The study desk is part of the house, so the review spot always exists.
  if(data.desk){
    const d0=data.desk,desk=new pc.Entity('study-desk');
    desk.setLocalPosition(d0.x,0,d0.z);desk.setLocalEulerAngles(0,d0.rot??0,0);root.addChild(desk);
    box(desk,[0,.74,0],[1.8,.08,.8],'#b08b60');
    box(desk,[-.62,.5,0],[.44,.4,.68],'#a97d55');
    box(desk,[-.62,.5,.35],[.36,.24,.04],'#e0c69c');
    for(const x of [-.82,.82])for(const z of [-.33,.33])box(desk,[x,.37,z],[.08,.74,.08],'#8a6c49');
    box(desk,[.1,.88,-.3],[1.0,.03,.62],'#f4ecd8').lookName='notebook';
    box(desk,[.1,.9,-.3],[.03,.04,.62],'#c9a97a').lookName='notebook';
    cylinder(desk,[.72,.96,-.24],[.16,.36,.16],'#9db08f').lookName='pen';
    for(const [dx,c] of [[-.04,'#c47f6b'],[.03,'#7f9ab0'],[.09,'#d9b072']])cylinder(desk,[.72+dx,1.16,-.24],[.03,.32,.03],c).lookName='pen';
    box(desk,[-.2,.82,.1],[.42,.06,.3],'#e6d9bd').lookName='paper';
    label(desk,'生词本',[.1,1.02,-.44],.86,.24,'#f2e7c8','#5f7f5f');
  }
  if(data.lectern){
    const {x,z}=data.lectern;
    box(root,[x,.45,z],[1.9,.9,.75],'#8d6f52');
    box(root,[x,.94,z],[2.2,.12,.95],'#c9a97a');
    box(root,[x,1.18,z-.18],[1.7,.34,.1],'#6f8570',[-22,0,0]);
    for(const dx of [-2.1,2.1]){
      box(root,[x+dx,1.1,z-.35],[.3,2.2,1.5],'#a98a66');
      for(let i=0;i<4;i++)box(root,[x+dx,.42+i*.56,z-.35],[.36,.06,1.55],'#c7ab83');
    }
  }
  return {root,ceilings,fittings,sun,lamps};
}
import {rotatedHalf} from './navigation.js';

