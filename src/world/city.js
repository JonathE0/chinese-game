import * as pc from 'playcanvas';
import city from '../content/city.json' with {type:'json'};
import drones from '../content/drones.json' with {type:'json'};
import {clockText} from './daylight.js';
import {createLeds,random} from './leds.js';
import {reflect} from './bay.js';
import {promenadeZ} from '../core/city.js';

/**
 * 云海市中心 — the city at the other end of the metro line, redone after a night walk round
 * Shenzhen Bay.
 *
 * The town is timber, tile and paint at the scale of a person. This is meant to read as the
 * opposite of that from the first glance: glass towers too tall to see the top of, a two-lane road
 * between wide pavements, signs that are lit rather than painted, and at the end of the avenue a
 * curving promenade along the bay with a dense skyline across the water. By day it is calm glass
 * and stone; after dark the façades come alive with light running along bands and up corners,
 * crowns washing through the colours and big lit characters (src/world/leds.js), every one of
 * them a lamp of the daylight system.
 *
 * Technically it is a *place*, the same kind of thing an interior is: built once, far from the
 * town's own coordinates, and swapped in wholesale when you arrive. It is built lazily, on the
 * first ride, so the opening scene stays as quick to load as it was. The bay, the hill to the west
 * and what happens on and over them are bay.js, hill.js, hotpot.js, drones.js and crowd.js, which
 * town.ensureCity calls once this has been built.
 */
export const CITY=city;
export const CITY_OFFSET=-4000;

/** A sign in a city is backlit: it reads at midnight as well as at noon. */
function backlight(entity,strength=.85){
  const material=entity.render.meshInstances[0].material;
  material.emissive.set(strength,strength,strength);
  material.update();
  return entity;
}

/**
 * A hitbox given in a prop's or tower's own frame, in city-local metres. Quarter turns only: the
 * registry's boxes are axis aligned, so a quarter turn swaps their sides. `face` is the way the
 * thing faces (a bench: the way you sit), for anyone who needs it.
 */
function turn(def,{x=0,z=0,hw,hd,y0=0,y1,name=def.name??null,solid}){
  const r=(def.rot??0)*Math.PI/180,c=Math.round(Math.cos(r)),s=Math.round(Math.sin(r));
  return {x:def.x+x*c+z*s,z:def.z-x*s+z*c,hw:s?hd:hw,hd:s?hw:hd,y0,y1,name,solid,face:def.rot??0};
}

/** The skyline's and the backdrop's colours: the same few as downtown's, so they share materials. */
const BODY=['#2c3d4b','#3a3342','#2d3340'],GLASS=['#7fa3b8','#9aabb8','#a597c4'];

/**
 * A glass tower with its front on local +z: a dark frame with lit floors behind the glass (warm,
 * cool, and about one floor in four dark) and whatever LEDs city.json asks for. A `street` tower is
 * one you walk up to: fins down its faces, a colonnade at its foot and its shop sign over that.
 */
function glassTower(models,leds,parent,def,{street=false,shadows=true,seed=1}={}){
  const {box,label}=models,{w,d,h}=def,L=def.leds??{},next=random(seed);
  const root=new pc.Entity('tower');root.setLocalPosition(def.x,0,def.z);
  root.setLocalEulerAngles(0,def.rot??0,0);parent.addChild(root);
  box(root,[0,h/2,0],[w,h,d],def.color).render.castShadows=shadows;
  const [warm,cool]=leds.windows(def.glass);
  for(let y=street?7.4:2.6;y<h-1.8;y+=3.2){
    const roll=next();
    if(roll>.25)leds.piece(root,[0,y,0],[w+.06,2,d+.06],roll<.62?warm:cool);
  }
  if(street){
    // Fins down every face stop the glass reading as one flat sheet.
    for(const [len,deep,alongX] of [[w,d,true],[d,w,false]])
      for(let a=-len/2+1.4;a<len/2-1;a+=2.6)for(const side of [-1,1])
        box(root,alongX?[a,(h+6)/2,side*(deep/2+.1)]:[side*(deep/2+.1),(h+6)/2,a],[.16,h-6,.16],'#5d6670').render.castShadows=false;
    // The ground floor is set back behind a colonnade, which is what makes a street feel walkable.
    box(root,[0,2.4,d/2-.55],[w-1.2,4.8,.3],'#59616b');
    for(let x=-w/2+1.2;x<w/2-.8;x+=3.1)box(root,[x,2.5,d/2-.05],[.5,5,.5],'#8e949a').lookName='pillar';
    box(root,[0,5.3,d/2+.05],[w,.7,.6],'#6c737b');
  }
  if(def.sign){
    const wide=Math.min(w-1,7.4);
    const board=label(root,def.sign,[0,6.9,d/2+.3],wide,1.5,def.signColor,def.signInk);
    box(root,[0,6.9,d/2+.12],[wide+.5,1.9,.2],'#4f565f').signText=def.sign;
    board.setLocalPosition(0,6.9,d/2+.34);backlight(board);
    leds.piece(root,[0,5.85,d/2+.3],[wide,.16,.16],leds.light('#f3efe6'));
  }
  // Across the bay the lights are drawn heavier, so they still read from the far shore.
  const k=street?1:2.4;
  if(L.edges)for(const sx of [-1,1])for(const sz of [-1,1])
    leds.piece(root,[sx*(w/2+.07),street?(h+6)/2:h/2,sz*(d/2+.07)],[.26*k,street?h-6:h,.26*k],leds.climber);
  if(L.stripes)for(const at of [-w/4,w/4])leds.piece(root,[at,h*.5,d/2+.2],[.3*k,h*.84,.1],leds.climber);
  for(const y of L.bands??[])leds.piece(root,[0,y,0],[w+.16,.4*k,d+.16],leds.runner);
  if(L.crown!==undefined)leds.piece(root,[0,h+1.5,0],[w-1.4,3,d-1.4],leds.washes[L.crown]);
  else box(root,[0,h+.5,0],[w-1.4,1,d-1.4],def.color);            // plant room on the roof
  if(L.screen)leds.piece(root,[0,(L.screen.y0+L.screen.y1)/2,d/2+.22],[w-1.6,L.screen.y1-L.screen.y0,.1],leds.washes[L.screen.wash]);
  // Lit characters hang just clear of the tower's hitbox (0.3 m out), so a look from across the
  // street finds them rather than the tower behind them.
  if(L.text)leds.text(root,L.text.zh,[0,L.text.y,d/2+.36],L.text.cell,{color:L.text.color,vertical:L.text.vertical});
  return root;
}

/**
 * 云海中心, the tower the skyline is arranged round: five glass tiers stepping in as they rise,
 * each setback edged with running light and every corner lit, a colour-washed point, and a spire
 * with a blinking red beacon on top. Returns its hitboxes, one a tier.
 */
function landmark(models,leds,parent,def){
  const {box,shape,cylinder}=models,[warm,cool]=leds.windows(def.glass),text=def.leds.text,marks=[];
  const root=new pc.Entity('landmark');root.setLocalPosition(def.x,0,def.z);parent.addChild(root);
  let y=0;
  for(const [share,tall] of [[1,34],[.89,32],[.77,30],[.64,22],[.5,14]]){
    const w=def.w*share;
    marks.push({x:def.x,z:def.z,hw:w/2+.05,hd:w/2+.05,y0:y,y1:y+tall,name:'tower'});
    box(root,[0,y+tall/2,0],[w,tall,w],'#1b2836').render.castShadows=false;
    for(let fy=y+2.2;fy<y+tall-1.2;fy+=3.2)leds.piece(root,[0,fy,0],[w+.06,2,w+.06],Math.floor(fy*7)%3?warm:cool);
    for(const sx of [-1,1])for(const sz of [-1,1])leds.piece(root,[sx*(w/2+.1),y+tall/2,sz*(w/2+.1)],[.4,tall,.4],leds.climber);
    leds.piece(root,[0,y+tall-.3,0],[w+.3,.5,w+.3],leds.runner);
    if(text.y>y&&text.y<y+tall)leds.text(root,text.zh,[0,text.y,w/2+.14],text.cell,{color:text.color,vertical:text.vertical});
    y+=tall;
  }
  const point=shape(root,'cone',[0,y+7,0],[def.w*.66,14,def.w*.66],'#27313d');
  point.render.meshInstances[0].material=leds.washes[1];point.render.castShadows=false;
  cylinder(root,[0,y+14+(def.h-y-14)/2,0],[.6,def.h-y-14,.6],'#aab3bb').render.castShadows=false;
  leds.piece(root,[0,def.h+.3,0],[.7,.7,.7],leds.beacon);
  marks.push({x:def.x,z:def.z,hw:def.w*.33,hd:def.w*.33,y0:y,y1:def.h+1,name:'tower'});
  return marks;
}

/**
 * The land round the bay (city.json `land`): the city side, the two flanks and the far shore,
 * whose edges on the water are the sea walls; downtown's pavement and the back street to the hill;
 * the carriageway between its kerbs with a dashed centre line; and the station forecourt.
 */
function ground(models,root){
  const {box}=models,data=city.place,{road:[rx0,rx1,rz0,rz1],asphalt,kerb}=city.street;
  for(const [x0,x1,z0,z1,top] of city.land)box(root,[(x0+x1)/2,top-.95,(z0+z1)/2],[x1-x0,1.9,z1-z0],data.ground);
  const [dx0,dx1,dz0,dz1]=city.street.pavement;
  box(root,[(dx0+dx1)/2,-.05,(dz0+dz1)/2],[dx1-dx0,.1,dz1-dz0],data.pave);
  const mid=(rz0+rz1)/2,long=rz1-rz0;
  box(root,[(rx0+rx1)/2,.015,mid],[rx1-rx0,.03,long],asphalt);
  // The kerbs, stepping out round each taxi lay-by.
  const kerbs=[[rx0,rz0,rz1]];
  let from=rz0;
  for(const [bx0,bx1,bz0,bz1] of city.street.bays){
    box(root,[(bx0+bx1)/2,.015,(bz0+bz1)/2],[bx1-bx0,.03,bz1-bz0],asphalt);
    box(root,[bx1,.04,(bz0+bz1)/2],[.22,.08,bz1-bz0+.2],kerb);
    box(root,[(bx0+bx1)/2,.04,bz0],[bx1-bx0,.08,.22],kerb);
    kerbs.push([rx1,from,bz0]);from=bz1;
  }
  kerbs.push([rx1,from,rz1]);
  for(const [x,z0,z1] of kerbs)if(z1>z0)box(root,[x,.04,(z0+z1)/2],[.22,.08,z1-z0+.2],kerb);
  for(let z=rz0+2;z<rz1-1;z+=4)box(root,[0,.04,z],[.2,.02,2.2],'#dfe1dd');
  box(root,[0,.01,26],[30,.02,10],'#b3b3ab');                            // the station forecourt
}

/**
 * The headhouse you arrive in and leave through.
 *
 * It is open to the street on the avenue side, because a station you cannot see into is just a
 * wall: the concourse, the sign and the stair down to the platform all have to be visible from
 * out on the pavement, or nobody would guess that is how you get home.
 */
function station(models,leds,parent){
  const {box,cylinder,label}=models;
  const root=new pc.Entity('metro-hall');root.lookName='metro-station';root.setLocalPosition(0,0,30.5);parent.addChild(root);
  box(root,[0,.15,0],[13,.3,7.4],'#b0b2ae');
  for(const side of [-1,1]){
    box(root,[side*6,2.4,0],[.7,4.8,7.2],'#9299a1');                 // side piers
    box(root,[side*4.4,2.4,-3.4],[2.6,4.8,.4],'#a9bcc6');            // glazing flanking the mouth
  }
  box(root,[0,4.5,-3.4],[9,.6,.5],'#8e959c');                        // the header over the way in
  box(root,[0,2.4,3.5],[12.4,4.8,.4],'#a9bcc6');                     // the back of the concourse
  for(let i=0;i<5;i++)cylinder(root,[0,4.9,-3+i*1.6],[.22,12.4,.22],'#8e959c',[0,0,90]);
  box(root,[0,5.15,0],[12.9,.4,7.4],'#c3d2d8');
  // The stair down to the platform: you never go down it, but it has to look like you could.
  for(let i=0;i<6;i++)box(root,[0,.14-i*.24,1.1+i*.5],[5.4,.26,.55],'#9fa4a6').lookName='stairs';
  for(const side of [-1,1])box(root,[side*2.9,.75,2.1],[.14,1.2,3],'#c2c8cb');
  const sign=label(root,'地铁 1 号线',[0,3.5,-3.62],6.4,1.3,'#20303f','#dfe9f2');
  sign.setLocalPosition(0,3.5,-3.66);backlight(sign);
  leds.piece(root,[0,2.6,-3.64],[6.4,.18,.14],leds.light('#5b93c8'));
  return [
    {x:-6,z:30.5,hw:.5,hd:3.7,y0:0,y1:5.2,name:'metro-station'},
    {x: 6,z:30.5,hw:.5,hd:3.7,y0:0,y1:5.2,name:'metro-station'},
    {x:-4.4,z:27.1,hw:1.4,hd:.3,y0:0,y1:5.2,name:'metro-station'},
    {x: 4.4,z:27.1,hw:1.4,hd:.3,y0:0,y1:5.2,name:'metro-station'},
    {x:0,z:34,hw:6.3,hd:.3,y0:0,y1:5.2,name:'metro-station'},
    // The stair mouth is a hole in the floor; the balustrade round it is what stops you.
    {x:0,z:32,hw:3.1,hd:2.2,y0:0,y1:1.3,name:'metro-station'},
  ];
}

/**
 * City street furniture: steel, concrete and light, deliberately not the town's timber. Returns
 * its hitboxes in its own frame (see `turn`); a lamp's glow is shared with every lamp of its colour.
 */
function cityProp(models,leds,parent,def){
  const {box,cylinder,ball,label}=models;
  const e=new pc.Entity('city-'+def.kind);
  e.setLocalPosition(def.x,0,def.z);e.setLocalEulerAngles(0,def.rot??0,0);parent.addChild(e);
  const k=def.kind;
  if(k==='citylamp'){
    // One arm, out over the road or the lane it lights, so the pole stays on the kerb line.
    cylinder(e,[0,.1,0],[.5,.2,.5],'#6d7278');
    cylinder(e,[0,2.9,0],[.18,5.6,.18],'#8d939a');
    box(e,[.8,5.5,0],[1.6,.14,.14],'#8d939a').lookName='streetlight';
    const head=box(e,[1.5,5.36,0],[.9,.2,.46],'#e9f0f6');head.lookName='streetlight';
    head.render.meshInstances[0].material=leds.light('#e8f1ff');
    return [{hw:.3,hd:.3,y1:5.7}];
  }
  if(k==='promenadelamp'){
    // Slim poles along the railing, their heads leaning in over the promenade.
    cylinder(e,[0,.08,0],[.36,.16,.36],'#6d7278');
    cylinder(e,[0,2.4,0],[.12,4.8,.12],'#9aa1a8');
    box(e,[0,4.82,.3],[.12,.08,.72],'#9aa1a8').lookName='streetlight';
    const head=box(e,[0,4.74,.62],[.34,.1,.34],'#eef4ff');head.lookName='streetlight';
    head.render.meshInstances[0].material=leds.light('#fff1d6');
    return [{hw:.2,hd:.2,y1:5}];
  }
  if(k==='citytree'){
    e.setLocalEulerAngles(0,Math.abs(def.x*37+def.z*53)%360,0);
    models.tree(e,0,0,1.05);
    return [{hw:.35,hd:.35,y1:3.6}];
  }
  if(k==='cityplanter'){
    box(e,[0,.34,0],[2.6,.68,1.5],'#9c9a94');
    box(e,[0,.7,0],[2.3,.12,1.2],'#5d6b52');
    for(const x of [-.7,0,.7]){
      cylinder(e,[x,1.35,0],[.14,1.4,.14],'#6b6250').lookName='tree';
      ball(e,[x,2.15,0],[1.3,1.1,1.1],'#6d8a5c').lookName='tree';
    }
    return [{hw:1.35,hd:.8,y1:1.1}];
  }
  if(k==='citybench'){
    for(const x of [-1.1,1.1])box(e,[x,.24,0],[.18,.48,.7],'#7d848b');
    for(let i=0;i<5;i++)box(e,[0,.48,-.28+i*.14],[2.5,.09,.11],'#98a0a7');
    box(e,[0,.86,-.36],[2.5,.5,.1],'#98a0a7',[14,0,0]);
    return [{hw:1.3,hd:.5,y1:.95}];
  }
  if(k==='bin'){
    box(e,[0,.5,0],[.56,1,.56],'#7c838a');
    box(e,[0,1.04,0],[.66,.1,.66],'#5f666c');
    box(e,[0,.86,.29],[.3,.22,.06],'#464c52');
    return [{hw:.34,hd:.34,y1:1.1}];
  }
  if(k==='citycrossing'){
    for(let i=-2;i<=2;i++)box(e,[i*1.3,.045,0],[.75,.02,4.4],'#e2e4e2');
    // Paint, not an obstacle: a named patch of road that says where to cross.
    return [{hw:3.6,hd:2.2,y0:-.2,y1:.05,solid:false}];
  }
  if(k==='trafficlight'){
    cylinder(e,[0,.1,0],[.44,.2,.44],'#5f656b');
    cylinder(e,[0,1.9,0],[.16,3.6,.16],'#71777d');
    box(e,[0,3.5,.2],[.42,1.15,.42],'#3a4046');
    const colors=['#d4574f','#e0b652','#6fb072'];
    for(let i=0;i<3;i++){
      const bulb=ball(e,[0,3.9-i*.36,.42],[.24,.24,.12],colors[i]);bulb.lookName='traffic-light';
      if(i===2)bulb.render.meshInstances[0].material=leds.light(colors[i]);
    }
    return [{hw:.3,hd:.3,y1:4.2}];
  }
  // The shelter and the kiosk are roofed well above head height, so standing under them (or
  // swinging the camera past them) never feels like ducking under a low shed.
  if(k==='cityshelter'){
    for(const x of [-2.4,2.4])cylinder(e,[x,1.6,0],[.16,3.2,.16],'#868d94');
    box(e,[0,3.25,0],[5.4,.16,2.2],'#b8c8d0');
    box(e,[0,1.6,-1.0],[5.2,3.0,.1],'#c3d3da');
    for(let i=0;i<4;i++)box(e,[-1.6+i*1.05,.6,-.7],[.9,.1,.5],'#98a0a7');
    backlight(label(e,'公交站',[1.9,2.3,.98],1.7,.6,'#26333f','#e2ecf3'),.7);
    return [{hw:2.8,hd:1.2,y1:3.45}];
  }
  if(k==='citykiosk'){
    box(e,[0,1.6,0],[3.4,3.2,2.4],'#8b9299');
    box(e,[0,3.35,0],[3.8,.3,2.8],'#6e757c');
    const glass=box(e,[0,1.6,1.24],[2.6,1.7,.08],'#cfe0e6');
    glass.render.meshInstances[0].material=leds.light('#f3ead0');
    box(e,[0,.62,1.3],[2.8,.18,.5],'#a9b0b6');
    backlight(label(e,'便利店',[0,2.9,1.45],2.4,.66,'#2f4436','#ecf3e4'),.8);
    return [{hw:1.9,hd:1.5,y1:3.5}];
  }
  if(k==='gate'){
    // The welcome gate across the end of the avenue: two steel posts beyond the pavements and a
    // screen high enough to walk under, welcoming you on the side you arrive from and wishing you
    // a safe journey on the side you leave by.
    e.lookName=def.name;
    for(const side of [-1,1]){
      box(e,[side*12.25,5.6,0],[1.7,11.2,.9],'#6f767d');
      // A couplet down the posts, the way one hangs either side of a gateway, reading left to right
      // like the words across the top: the first line on the left from whichever side you face it.
      const [south,north]=side<0?def.couplet:[...def.couplet].reverse();
      leds.text(e,south,[side*12.25,5,.5],1.3,{color:'#ff5a4a',vertical:true,reach:60});
      leds.text(e,north,[side*12.25,5,-.5],1.3,{color:'#ff5a4a',vertical:true,reach:60,rot:180});
    }
    box(e,[0,10.1,0],[25.8,4.6,.8],'#1c2129');
    for(const y of [7.75,12.45])leds.piece(e,[0,y,0],[25.9,.3,.9],leds.runner);
    leds.text(e,def.text,[0,10.1,.46],3.2,{color:'#ffe9b8',reach:80});
    leds.text(e,def.back,[0,10.1,-.46],3.2,{color:'#aee6ff',reach:80,rot:180});
    return [{x:-12.25,hw:.85,hd:.5,y1:11.3},{x:12.25,hw:.85,hd:.5,y1:11.3}];
  }
  if(k==='ledsign'){
    // A granite plinth with a dark slab set on it and the name lit into the slab.
    const w=[...def.text].length*def.cell+.8,h=def.cell+.5;
    box(e,[0,.25,0],[w+.4,.5,.9],'#8f8a80').lookName='sign';
    box(e,[0,.5+h/2,-.05],[w,h,.5],'#2a2f36').lookName='sign';
    leds.text(e,def.text,[0,.5+h/2,.22],def.cell,{color:def.color,reach:40});
    // The plinth, and the slab above it only as deep as the slab, so its lit name stands proud of it.
    return [{hw:(w+.4)/2,hd:.45,y1:.5},{z:-.05,hw:w/2,hd:.25,y0:.5,y1:.5+h}];
  }
  if(k==='droneboard'){
    // When the drones fly (drones.json `times`, so the board and the show never disagree): the
    // board by the plaza, lit after dark like everything else here.
    e.lookName=def.name;
    for(const x of [-1.5,1.5])box(e,[x,1.2,0],[.14,2.4,.14],'#6f767d');
    box(e,[0,2.35,-.04],[3.6,2.1,.16],'#1c2129');
    leds.text(e,def.text,[0,2.35,.09],.66,{color:'#ffd36b',sub:drones.times.map(show=>clockText(show.at)).join(' · '),reach:40});
    return [{z:-.04,hw:1.8,hd:.12,y1:3.4}];                 // the case: its lit face stands proud of it
  }
  if(k==='taxi'){
    box(e,[0,.62,0],[1.9,.72,4.3],'#d8c06a');
    box(e,[0,1.25,-.25],[1.7,.66,2.3],'#e3ddd2');
    box(e,[0,1.66,-.3],[.7,.2,.5],'#3d4650');
    for(const [x,z] of [[-.95,1.4],[.95,1.4],[-.95,-1.4],[.95,-1.4]])
      cylinder(e,[x,.34,z],[.68,.26,.68],'#3a3f45',[0,0,90]);
    return [{hw:1.1,hd:2.3,y1:1.9}];
  }
  return [];
}

/**
 * The promenade along the bay: granite paving whose face on the water side is the sea wall, a
 * path curving either side of the plaza with a line of light set into each edge, the plaza with a
 * ring of lights in its floor, and a glass railing along the water with a light under its rail.
 */
function promenade(models,leds,root){
  const {box,cylinder}=models,p=city.promenade,[x0,x1]=p.x,[z0,z1]=p.z,mid=(x0+x1)/2,half=p.path.width/2;
  const g=new pc.Entity('promenade');root.addChild(g);
  box(g,[mid,-.99,(z0+z1)/2],[x1-x0,2.02,z1-z0],'#b9b5ab').lookName='path';
  const {x:px,z:pz,radius}=p.plaza;
  cylinder(g,[px,.03,pz],[radius*2,.02,radius*2],'#d2cbbb').lookName='square';
  for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2,x=px+Math.cos(a)*(radius-.6),z=pz+Math.sin(a)*(radius-.6);
    if(Math.abs(z-promenadeZ(p,x))>half+.3)leds.piece(g,[x,.045,z],[.34,.02,.34],leds.washes[2],[0,-a*180/Math.PI,0]);
  }
  const path=new pc.Entity('path');path.lookName='path';g.addChild(path);
  const edge=leds.light('#86d6ff');
  for(let x=x0;x<x1-.01;x+=1.25){
    const xb=Math.min(x+1.25,x1),za=promenadeZ(p,x),zb=promenadeZ(p,xb);
    const seg=new pc.Entity('path');seg.setLocalPosition((x+xb)/2,0,(za+zb)/2);
    seg.setLocalEulerAngles(0,-Math.atan2(zb-za,xb-x)*180/Math.PI,0);path.addChild(seg);
    const len=Math.hypot(xb-x,zb-za)+.05;
    box(seg,[0,.05,0],[len,.02,p.path.width],'#8e9aa4');
    for(const side of [-1,1])leds.piece(seg,[0,.07,side*(half-.1)],[len,.02,.1],edge);
  }
  const rail=new pc.Entity('railing');rail.lookName='railing';g.addChild(rail);
  for(let x=x0+.3;x<x1;x+=2.5)box(rail,[x,.56,p.railing],[.09,1.12,.09],'#8f979e');
  box(rail,[mid,1.14,p.railing],[x1-x0,.06,.14],'#b0b8be');
  leds.piece(rail,[mid,1.08,p.railing+.02],[x1-x0,.035,.05],edge);
  const glass=new pc.StandardMaterial();
  glass.diffuse=new pc.Color().fromString('#cfe3ea');glass.opacity=.22;glass.blendType=pc.BLEND_NORMAL;
  glass.depthWrite=false;glass.gloss=.9;glass.useMetalness=true;glass.metalness=.2;glass.update();
  const pane=box(rail,[mid,.6,p.railing],[x1-x0,.9,.025],'#cfe3ea');
  pane.render.meshInstances[0].material=glass;pane.render.castShadows=false;
}

/**
 * The skyline across the bay (a backdrop, never walked on): the towers city.json names, 云海中心
 * among them, and rows of others filled in round them, lower in front and taller behind, each with
 * a seeded choice of LEDs. The whole of it shows in the bay (bay.js `reflect`). Nobody reaches it,
 * but each tower is solid, so what stands behind it is hidden from a look across the water too.
 */
function skyline(models,leds,root){
  const s=city.skyline,next=random(s.seed),g=new pc.Entity('skyline'),marks=[];root.addChild(g);
  const solid=({x,z,w,d,h})=>marks.push({x,z,hw:w/2+.05,hd:d/2+.05,y0:0,y1:h+3.5,name:'tower'});
  const placed=[],fits=(x,z,w,d)=>!placed.some(o=>Math.abs(x-o.x)<(w+o.w)/2+3&&Math.abs(z-o.z)<(d+o.d)/2+3);
  const bound=({x,z,w,d})=>root.skylineBounds.push({x,z,hw:w/2+.6,hd:d/2+.6});
  for(const def of s.towers){
    placed.push(def);bound(def);
    if(def.landmark)marks.push(...landmark(models,leds,g,def));
    else{glassTower(models,leds,g,{color:BODY[placed.length%BODY.length],...def},{shadows:false,seed:placed.length});solid(def);}
  }
  const body=BODY,glass=GLASS;
  const rows=[[-182,30,58],[-202,44,86],[-222,58,110]];                 // front to back: z, lowest, tallest
  for(let i=0,tries=0;i<s.fill&&tries<s.fill*30;tries++){
    const [row,low,high]=rows[tries%3],w=12+next()*10,d=10+next()*5;   // a full row never stalls the others
    const x=s.x[0]+w/2+next()*(s.x[1]-s.x[0]-w),z=row+(next()-.5)*4;
    if(!fits(x,z,w,d))continue;
    const h=low+next()*(high-low),L={};
    if(next()<.45)L.bands=[Math.round(h*.35),Math.round(h*.7)].slice(0,1+Math.floor(next()*2));
    if(next()<.35)L.edges=true;
    if(next()<.4)L.crown=Math.floor(next()*3);
    if(next()<.3)L.screen={y0:Math.round(h*.3),y1:Math.round(h*.72),wash:Math.floor(next()*3)};
    else if(next()<.45)L.stripes=true;
    const def={x,z,w,d,h,color:body[i%body.length],glass:glass[i%glass.length],leds:L};
    placed.push(def);bound(def);solid(def);i++;
    glassTower(models,leds,g,def,{shadows:false,seed:tries+7});
  }
  // The far shore's own waterfront: a line of lamps along its sea wall.
  leds.piece(g,[(s.x[0]+s.x[1])/2,.42,s.shore-.6],[s.x[1]-s.x[0]+20,.1,.1],leds.light('#ffe2a8'));
  reflect(g);
  return marks;
}

/** Where the ground ends over open land rather than at the railing, the hill or a building, a low
 *  granite wall with a clipped hedge along it says so (city.json `edges`). */
function edges(models,root){
  for(const [x0,x1,z0,z1] of city.edges){
    const x=(x0+x1)/2,z=(z0+z1)/2;
    models.box(root,[x,.3,z],[x1-x0,.6,z1-z0],'#8f8a80').lookName='wall';
    models.box(root,[x,.85,z],[x1-x0-.1,.5,z1-z0-.1],'#5f7d52').lookName='hedge';
  }
}

/**
 * Blocks round the edge (city.json `backdrop`): lit floors and now and then a band of light, no
 * detail, no collision, clear of everywhere you can walk; and hills beyond the bay's west end.
 */
function backdrop(models,leds,root){
  const b=city.backdrop,next=random(b.seed),placed=[...city.towers];
  const fits=(x,z,w,d)=>!placed.some(o=>Math.abs(x-o.x)<(w+(o.w??0))/2+4&&Math.abs(z-o.z)<(d+(o.d??0))/2+4);
  const body=BODY,glass=GLASS;
  for(const [x0,x1,z0,z1,count] of b.zones)
    for(let i=0,tries=0;i<count&&tries<count*30;tries++){
      const w=10+next()*12,d=10+next()*12,x=x0+w/2+next()*(x1-x0-w),z=z0+d/2+next()*(z1-z0-d);
      if(!fits(x,z,w,d))continue;
      const h=18+next()*46,def={x,z,w,d,h,color:body[i%body.length],glass:glass[i%glass.length],
        leds:next()<.3?{bands:[Math.round(h*.8)]}:{}};
      placed.push(def);i++;
      glassTower(models,leds,root,def,{shadows:false,seed:tries+101});
      root.skylineBounds.push({x,z,hw:w/2+.6,hd:d/2+.6});
    }
  for(const [x,z,r,h] of b.hills)models.shape(root,'cone',[x,-.5,z],[r*2,h,r*2],'#5e7162').name='hill';
}

export function buildCity(models,parent){
  const root=new pc.Entity('city');root.setLocalPosition(CITY_OFFSET,0,0);parent.addChild(root);
  root.skylineBounds=[];                     // backdrop, never looked at up close (names.spec.js)
  const leds=createLeds(models),marks=[];

  ground(models,root);
  // The carriageway and its lay-bys are named ground that people walking about keep off (crowd.js).
  for(const [x0,x1,z0,z1] of [city.street.road,...city.street.bays])
    marks.push({x:(x0+x1)/2,z:(z0+z1)/2,hw:(x1-x0)/2,hd:(z1-z0)/2,y0:-.2,y1:.05,name:'road',solid:false});
  marks.push(...station(models,leds,root));
  for(const [i,def] of city.towers.entries()){
    const tower=glassTower(models,leds,root,def,{street:def.street??true,seed:i+1});
    tower.lookName='tower';                  // its fins and lights read as the tower they are on
    reflect(tower);
    marks.push(turn(def,{hw:def.w/2+.3,hd:def.d/2+.3,y1:def.h+3.5,name:def.name??'tower'}));
  }
  if(city.department){
    const door=new pc.Entity('department-door');root.addChild(door);
    door.setLocalPosition(city.department.x-.28,0,city.department.z);door.setLocalEulerAngles(0,90,0);
    models.box(door,[0,1.6,0],[3.3,3.2,.18],'#526e69').lookName='door';
    models.box(door,[0,1.55,.11],[2.8,2.9,.08],'#bdd4cf').lookName='door';
    for(const x of [-.22,.22])models.box(door,[x,1.2,.2],[.05,.55,.06],'#eee6c9').lookName='door';
    backlight(models.label(door,'五金 · 家居 · 灯具',[0,3.75,.15],5.5,.8,'#23493e','#f1e6c8'));
    models.label(door,'营业中  OPEN',[0,2.55,.2],2.2,.45,'#dce9d6','#385e4e');
  }
  for(const def of city.props)for(const hit of cityProp(models,leds,root,def))marks.push(turn(def,hit));
  promenade(models,leds,root);
  edges(models,root);
  marks.push(...skyline(models,leds,root));
  backdrop(models,leds,root);
  const people=city.people.map(def=>{
    const made=models.person(root,def.color,[def.x,0,def.z]);
    made.entity.setLocalEulerAngles(0,def.rot??0,0);
    return {...def,...made,leg:0};
  });
  return {root,marks,people,lamps:leds.lamps,data:city.place,update:dt=>leds.update(dt)};
}

/**
 * The way in, back in 青禾广场: a modern metro entrance, a glass pavilion under a rounded steel
 * canopy over a stair going down, its open front facing the square. A sign band across the front
 * carries the metro roundel, the station's name 青禾站 and the exit letter A出入口, and a pair of
 * granite steps lead up to it.
 *
 * Built with the town, not with the city, because it has to be standing on the square from the
 * first minute — it is how you find out the city exists at all. The town's ground is one solid
 * slab, so the stairwell below the top step is drawn as a dark opening rather than cut into it;
 * pressing E on the top step takes you down to the platform (rooms.json `metro-platform`).
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
  // The top step, then the dark of the stairwell going down.
  box(root,[0,-.06,-1.5],[3.4,.28,.44],'#9ba09f').lookName='stairs';
  box(root,[0,.03,.09],[3.4,.02,2.72],'#1d2226').lookName='stairs';
  box(root,[0,-.6,1.6],[3.8,2,.3],'#3c4247');
  // Clear glass on three sides, in a slim steel frame. The glass casts no shadow.
  const glass=new pc.StandardMaterial();
  glass.diffuse=new pc.Color().fromString('#cfe3ea');glass.opacity=.3;glass.blendType=pc.BLEND_NORMAL;
  glass.depthWrite=false;glass.gloss=.9;glass.useMetalness=true;glass.metalness=.2;glass.update();
  const pane=(pos,size)=>{const e=box(root,pos,size,'#cfe3ea');e.render.meshInstances[0].material=glass;e.render.castShadows=false;};
  for(const side of [-1,1]){
    pane([side*2.3,1.48,.35],[.05,2.56,4.9]);
    for(const z of [-2.1,-.55,1.05,2.8])box(root,[side*2.3,1.48,z],[.12,2.56,.12],steel);
    box(root,[side*2.3,.28,.35],[.14,.12,5.02],steel);
    box(root,[side*2.3,2.8,.35],[.18,.16,5.1],steel);
  }
  pane([0,1.48,2.8],[4.5,2.56,.05]);
  box(root,[0,2.8,2.8],[4.7,.16,.18],steel);
  box(root,[0,2.8,-2.1],[4.7,.16,.18],steel);
  // The rounded canopy: a shallow barrel vault of steel panels, rising 0.7 m over the 5.2 m span
  // and reaching out over the steps, with darker ribs at its ends and in the middle.
  const half=2.6,rise=.7,spring=2.9,R=(half*half+rise*rise)/(2*rise),top=Math.asin(half/R),n=8;
  for(let i=0;i<n;i++){
    const a=-top+(i+.5)*2*top/n,x=R*Math.sin(a),y=spring+rise-R+R*Math.cos(a),wide=2*R*Math.sin(top/n)+.03;
    box(root,[x,y,.2],[wide,.08,5.9],'#aab3b9',[0,0,-a*180/Math.PI]);
    for(const z of [-2.72,.2,3.12])box(root,[x,y-.07,z],[wide,.1,.12],dark,[0,0,-a*180/Math.PI]);
  }
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
  ]};
}
