import * as pc from 'playcanvas';

// Interiors are built far from the square and swapped in wholesale, so the town keeps its own
// coordinates and nothing has to be unloaded when the tourist steps through a door.
export const ROOM_OFFSET=400;

export function buildRoom(models,parent,data,index){
  const {box,cylinder,label}=models;
  const root=new pc.Entity('room-'+index);
  root.setLocalPosition(ROOM_OFFSET*(index+1),0,0);
  parent.addChild(root);
  const [w,d]=data.size,h=data.height,t=.22;
  const back=-d/2,front=d/2;

  // Floor, with seams a shade darker than the boards rather than drawn in ink.
  box(root,[0,-.1,0],[w,.2,d],data.floor);
  for(let x=-w/2+.75;x<w/2-.5;x+=1.5)box(root,[x,.004,0],[.05,.015,d-.1],data.trim);

  // Walls. The front wall carries a doorway gap the tourist walks through.
  box(root,[-w/2-t/2,h/2,0],[t,h,d],data.wall);
  box(root,[w/2+t/2,h/2,0],[t,h,d],data.wall);
  box(root,[0,h/2,back-t/2],[w+t*2,h,t],data.wall);
  const gap=1.7;
  for(const side of [-1,1])box(root,[side*(gap/2+(w-gap)/4),h/2,front+t/2],[(w-gap)/2,h,t],data.wall);
  box(root,[0,h-.55,front+t/2],[gap,1.1,t],data.wall);
  box(root,[0,.05,front+t/2],[gap+.5,.1,t+.5],data.trim);

  // Ceiling and exposed beams.
  box(root,[0,h+.1,0],[w+.4,.2,d+.4],data.wall);
  for(let i=0;i<4;i++)box(root,[0,h-.06,back+1.4+i*((d-2.8)/3)],[w,.16,.22],data.roofBeam);

  // Everything below sits on the INNER face of the back wall so it is visible from inside.
  const inner=back+.04;
  for(const y of [.62,h-.3])box(root,[0,y,inner],[w,.09,.05],data.trim);
  if(data.window)for(const x of data.window){
    box(root,[x,1.85,inner+.02],[1.5,1.5,.06],'#cfe0dd');
    for(const off of [-.45,.45])box(root,[x+off,1.85,inner+.06],[.07,1.45,.05],data.trim);
    box(root,[x,1.85,inner+.06],[1.55,.08,.05],data.trim);
    box(root,[x,1.05,inner+.09],[1.7,.1,.22],data.trim);
  }
  label(root,data.zh,[0,h-.62,inner+.06],Math.min(3.2,w-2.4),.58);
  // A room can have a back room of its own. The door is flush with the inner face of the side
  // wall, so from inside the living room it reads as a door and not as a painting.
  if(data.annex){
    const door=new pc.Entity('annex-door');door.setLocalPosition(w/2-.035,0,data.annex.z);door.setLocalEulerAngles(0,-90,0);root.addChild(door);
    box(door,[0,1.08,0],[1.25,2.16,.055],'#719485');
    box(door,[0,1.42,.04],[.83,.66,.03],'#cbded2');
    cylinder(door,[.42,1,.065],[.08,.08,.08],'#d4b67c');
    label(door,data.annex.zh,[0,1.92,.07],.8,.28,'#f5edda','#456d58');
  }
  for(const x of [-w/2+.35,w/2-.35])for(const z of [back+.35,front-.35])cylinder(root,[x,h/2,z],[.2,h,.2],data.trim);

  // A closed box gets no sun, so each room carries its own warm lamp plus a soft fill.
  const lamp=new pc.Entity('room-light');
  lamp.addComponent('light',{type:'omni',color:new pc.Color(1,.94,.82),intensity:.95,range:Math.max(w,d)*1.2,castShadows:false});
  lamp.setLocalPosition(0,h-.75,0);
  root.addChild(lamp);
  const fill=new pc.Entity('room-fill');
  fill.addComponent('light',{type:'directional',color:new pc.Color(.9,.94,1),intensity:.3,castShadows:false});
  fill.setLocalEulerAngles(58,-160,0);
  root.addChild(fill);

  // Shop fittings: the shelves, racks and counters that make a shop look like its trade.
  const fittings=[];
  for(const def of data.fittings??[]){
    const made=models.fitting(root,def.kind,def.tint,def.sign);
    made.entity.setLocalPosition(def.x,0,def.z);
    made.entity.setLocalEulerAngles(0,def.rot??0,0);
    // A department sign hangs from the ceiling above its counter, so a big shop can be read from
    // the door. Racks paint their own board, so they are not given a second one.
    if(def.sign&&def.kind!=='hardwarebay'){
      const y=Math.min((made.top??2)+.7,h-.45);
      for(const off of [-.62,.62])box(root,[def.x+off,(y+h)/2,def.z],[.03,h-y,.03],'#7d7563');
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
    box(desk,[.1,.88,-.3],[1.0,.03,.62],'#f4ecd8');
    box(desk,[.1,.9,-.3],[.03,.04,.62],'#c9a97a');
    cylinder(desk,[.72,.96,-.24],[.16,.36,.16],'#9db08f');
    for(const [dx,c] of [[-.04,'#c47f6b'],[.03,'#7f9ab0'],[.09,'#d9b072']])cylinder(desk,[.72+dx,1.16,-.24],[.03,.32,.03],c);
    box(desk,[-.2,.82,.1],[.42,.06,.3],'#e6d9bd');
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
  return {root,ceiling:lamp,fittings};
}
import {rotatedHalf} from './navigation.js';
