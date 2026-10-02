import * as pc from 'playcanvas';

/** Shared platform geometry and a bounded train cycle; each station owns its moving entities. */
export function buildMetroStation(town,room){
 const {box,label,cylinder}=town.m,root=room.root,w=room.data.size[0],h=room.data.height,grand=room.data.transit==='yunhai';
 const solid=(x,z,hw,hd,y1=3)=>town.registry.add({place:room.id,x:room.offsetX+x,z,hw,hd,y0:0,y1});
 const glass=new pc.StandardMaterial();glass.diffuse=new pc.Color(.53,.74,.82);glass.opacity=.26;glass.blendType=pc.BLEND_NORMAL;glass.depthWrite=false;glass.update();
 const pane=(parent,pos,size)=>{const e=box(parent,pos,size,'#9bbfce');e.render.meshInstances[0].material=glass;return e;};
 // Long tile seams, tactile strip and ceiling slats evoke the user's underground references.
 for(let x=-w/2+1;x<w/2;x+=2)box(root,[x,.013,0],[.025,.012,room.data.size[1]],'#8e9ea9');
 for(let z=-10;z<room.data.size[1]/2;z+=2)box(root,[0,.015,z],[w,.012,.025],'#8e9ea9');
 for(let z=-9;z<room.data.size[1]/2;z+=.9)box(root,[0,h-.15,z],[w-.3,.14,.13],'#f0f2ed');
 for(const x of [-w/2+3,w/2-3])for(const z of [-2,7]){box(root,[x,h/2,z],[.8,h,.8],'#ebeeee');solid(x,z,.4,.4,h);}
 for(const x of [-6,6]){box(root,[x,h-.35,-1],[.12,.08,12],'#faf6dc');}
 label(root,(grand?'云海中央车站 · YUNHAI CENTRAL':'青禾站 · QINGHE')+'  |  1号线',[0,3.5,-5.4],Math.min(w-2,16),.65,'#233b52','#ffffff');
 label(root,'青禾 QINGHE  ━━━━━━━━━  云海 YUNHAI',[0,2.8,-5.35],12,.4,'#f0f4ef','#267ca9');
 box(root,[0,.02,-4.65],[w-.5,.02,.18],'#e6be43');
 for(const side of [-1,1]){
  const width=w/2-1.2,x=side*(1.2+width/2);
  pane(root,[x,1.4,-5.5],[width,2.8,.09]);solid(x,-5.5,width/2,.08);
  box(root,[x,.9,-5.42],[width,.08,.06],'#287fac');
  box(root,[x,2.8,-5.5],[width,.15,.15],'#273745');
  pane(root,[side*(1.2+(w/2-1.2)/2),1.1,2],[w/2-1.2,2.2,.08]);solid(side*(1.2+(w/2-1.2)/2),2,(w/2-1.2)/2,.08);
  box(root,[side*1.35,.6,2],[.36,1.2,.9],'#627b84');
 }
 const gate=pane(root,[0,.7,2],[2.4,1.4,.1]),gateHit=solid(0,2,1.2,.1,2.6);
 label(root,'刷卡 TAP CARD  •  Exit / 出口',[0,3.1,2],7,.48,'#233b52','#fff');
 const platformDoors=[-1,1].map(side=>pane(root,[side*.6,1.35,-5.5],[1.18,2.7,.08]));
 const doorHit=solid(0,-5.5,1.2,.1);
 // Confine the carriage footprint behind platform barriers; no walkable track access.
 for(const x of [-10,10])solid(x,-7.3,.1,1.7);solid(0,-9,10,.1);
 const train=new pc.Entity('metro-train');train.noBatch=true;root.addChild(train);
 box(train,[0,.08,-7.25],[20,.16,3.3],'#677b86');box(train,[0,2.9,-7.25],[20,.18,3.3],'#e6eeef');
 box(train,[0,1.4,-8.9],[20,2.8,.1],'#c2d0d6');
 for(const side of [-1,1]){box(train,[side*5.6,1.4,-5.65],[8.8,2.8,.12],'#dce5e6');box(train,[side*5.6,1.2,-5.56],[8.7,.14,.03],'#258da4');}
 for(let x=-8;x<=8;x+=4){pane(train,[x,1.8,-5.54],[2,1,.03]);box(train,[x,.5,-8.4],[2,.5,.6],'#428d9b');cylinder(train,[x,1.5,-7.6],[.055,2.7,.055],'#ccd4d7');}
 const trainDoors=[-1,1].map(side=>box(train,[side*.6,1.4,-5.6],[1.18,2.8,.1],'#a9bcc5'));
 if(grand){
  for(const [x,colour,name] of [[-12,'#ad6793','2'],[12,'#ba944c','3']]){box(root,[x,1.7,9],[5,3.4,.22],'#405361');label(root,'LINE '+name+' · 建设中',[x,2.7,9.15],4,.5,colour,'#fff');label(root,'Coming later',[x,1.7,9.15],3,.4,'#405361','#fff');solid(x,9,2.5,.18,3.4);}
  for(const z of [5,11])for(let i=0;i<24;i++){const a=i*Math.PI/12;box(root,[Math.cos(a)*3.3,h-.5,z+Math.sin(a)*3.3],[.8,.09,.16],'#fff4ce',[0,-a*180/Math.PI,0]);}
  label(root,'云海中央 · CENTRAL CONCOURSE',[0,5.5,12],14,.85,'#233b52','#fff');
 }
 let time=0,arrival=false,aboard=false;
 const control={room,open:false,paid:false,dock(){time=4;},arrive(){arrival=true;aboard=false;time=4;control.paid=true;},update(dt){
  if(town.paused)return;
  const p=town.player.entity.getPosition(),x=p.x-room.offsetX,z=p.z;
  if(arrival&&z>3){arrival=false;control.paid=false;}
  const pending=town.transitJourney?.();control.paid=arrival||pending?.origin===room.data.transit;
  gate.enabled=!control.paid;gateHit.solid=!control.paid;
  if(arrival&&z<-5)time=4;
  time+=dt;let phase=time%24;
  const inDoor=Math.abs(x)<1.6&&z<-4.9&&z>-6.3;
  if(phase>=13&&phase<15&&inDoor){time-=dt;phase=time%24;}
  control.open=phase>=4&&phase<14;
  let offset=phase<4?(1-phase/4)*28:phase<14?0:phase<18?-(phase-14)/4*28:-28;
  train.setLocalPosition(offset,0,0);
  for(const [i,side] of [-1,1].entries()){const dx=side*(control.open?1.8:.6);platformDoors[i].setLocalPosition(dx,1.35,-5.5);trainDoors[i].setLocalPosition(dx,1.4,-5.6);}
  doorHit.solid=!control.open;
  if(!arrival&&control.paid&&control.open&&z<-6.35&&Math.abs(x)<9)aboard=true;
  if(z>-5)aboard=false;
  if(aboard&&phase>=14){aboard=false;town.onTransitBoard?.();}
 }};
 return control;
}
