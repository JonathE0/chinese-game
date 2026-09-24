import * as pc from 'playcanvas';
import city from '../content/city.json' with {type:'json'};

/**
 * 云海市中心 — the city at the other end of the metro line.
 *
 * The town is timber, tile and paint at the scale of a person. This is meant to read as the
 * opposite of that from the first glance: concrete and glass, buildings too tall to see the top
 * of, signs that are lit rather than painted, and a straight avenue instead of a square you
 * wander around. Nothing here is a copy of a town prop with a different colour — the benches,
 * lamps, planters and shelters are drawn again in the city's own vocabulary.
 *
 * Technically it is a *place*, the same kind of thing an interior is: built once, far from the
 * town's own coordinates, and swapped in wholesale when you arrive. It is built lazily, on the
 * first ride, so the opening scene stays as quick to load as it was.
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

/** Rows of windows across a face, drawn as one thin lit slab per floor rather than per pane. */
function windows(models,root,w,d,h,glassColor){
  const {box}=models;
  const floors=Math.max(4,Math.floor((h-3)/3.1));
  for(let i=0;i<floors;i++){
    const y=3.2+i*3.1;
    if(y>h-1.6)break;
    box(root,[0,y,d/2+.04],[w-1.6,1.7,.1],glassColor);
    box(root,[0,y,-d/2-.04],[w-1.6,1.7,.1],glassColor);
    box(root,[w/2+.04,y,0],[.1,1.7,d-1.6],glassColor);
    box(root,[-w/2-.04,y,0],[.1,1.7,d-1.6],glassColor);
    // A mullion every few metres stops the glass reading as one flat sheet.
    for(let x=-w/2+2.2;x<w/2-1;x+=2.6){
      box(root,[x,y,d/2+.07],[.16,1.8,.06],'#5d6670').lookName='window';
      box(root,[x,y,-d/2-.07],[.16,1.8,.06],'#5d6670').lookName='window';
    }
  }
}

function tower(models,parent,def,lamps){
  const {box,label,glow}=models;
  const root=new pc.Entity('tower');root.setLocalPosition(def.x,0,def.z);
  root.setLocalEulerAngles(0,def.rot??0,0);parent.addChild(root);
  const {w,d,h}=def;
  box(root,[0,h/2,0],[w,h,d],def.color);
  box(root,[0,h+.5,0],[w-1.4,1,d-1.4],def.color);              // plant room on the roof
  box(root,[0,.3,0],[w+.5,.6,d+.5],'#9aa0a4');                 // podium
  windows(models,root,w,d,h,def.glass);
  // The ground floor is set back behind a colonnade, which is what makes a street feel walkable.
  box(root,[0,2.4,d/2-.55],[w-1.2,4.8,.3],'#59616b');
  for(let x=-w/2+1.2;x<w/2-.8;x+=3.1)box(root,[x,2.5,d/2-.05],[.5,5,.5],'#8e949a').lookName='pillar';
  box(root,[0,5.3,d/2+.05],[w,.7,.6],'#6c737b');
  if(def.sign){
    const lit=glow(def.signColor);
    const board=label(root,def.sign,[0,6.9,d/2+.3],Math.min(w-1,7.4),1.5,def.signColor,def.signInk);
    box(root,[0,6.9,d/2+.12],[Math.min(w-1,7.4)+.5,1.9,.2],'#4f565f').signText=def.sign;
    board.setLocalPosition(0,6.9,d/2+.34);backlight(board);
    const halo=box(root,[0,5.85,d/2+.3],[Math.min(w-1,7.4),.16,.16],def.signColor);
    halo.render.meshInstances[0].material=lit;
    lamps.push(lit);
  }
  // The hitbox is axis aligned, so a quarter turn swaps its sides.
  const turned=Math.abs(((def.rot??0)/90)%2)===1;
  return {x:def.x,z:def.z,hw:(turned?d:w)/2+.3,hd:(turned?w:d)/2+.3,y0:0,y1:h+2,name:def.name??'tower'};
}

/**
 * The headhouse you arrive in and leave through.
 *
 * It is open to the street on the avenue side, because a station you cannot see into is just a
 * wall: the concourse, the sign and the stair down to the platform all have to be visible from
 * out on the pavement, or nobody would guess that is how you get home.
 */
function station(models,parent,lamps){
  const {box,cylinder,label,glow}=models;
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
  const lit=glow('#5b93c8');
  const bar=box(root,[0,2.6,-3.64],[6.4,.18,.14],'#5b93c8');
  bar.render.meshInstances[0].material=lit;lamps.push(lit);
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

/** City street furniture. Steel, concrete and light — deliberately not the town's timber. */
function cityProp(models,parent,def,lamps){
  const {box,cylinder,ball,label,glow}=models;
  const e=new pc.Entity('city-'+def.kind);
  e.setLocalPosition(def.x,0,def.z);e.setLocalEulerAngles(0,def.rot??0,0);parent.addChild(e);
  const k=def.kind;
  if(k==='citylamp'){
    cylinder(e,[0,.1,0],[.5,.2,.5],'#6d7278');
    cylinder(e,[0,2.9,0],[.18,5.6,.18],'#8d939a');
    for(const side of [-1,1]){
      box(e,[side*.9,5.5,0],[1.8,.14,.14],'#8d939a').lookName='streetlight';
      const head=box(e,[side*1.7,5.35,0],[.9,.22,.5],'#e9f0f6');
      head.lookName='streetlight';
      const lit=glow('#e8f1ff');head.render.meshInstances[0].material=lit;lamps.push(lit);
    }
    return {hw:.3,hd:.3,y1:5.7};
  }
  if(k==='cityplanter'){
    box(e,[0,.34,0],[2.6,.68,1.5],'#9c9a94');
    box(e,[0,.7,0],[2.3,.12,1.2],'#5d6b52');
    for(const x of [-.7,0,.7]){
      cylinder(e,[x,1.35,0],[.14,1.4,.14],'#6b6250').lookName='tree';
      ball(e,[x,2.15,0],[1.3,1.1,1.1],'#6d8a5c').lookName='tree';
    }
    return {hw:1.35,hd:.8,y1:1.1};
  }
  if(k==='citybench'){
    for(const x of [-1.1,1.1])box(e,[x,.24,0],[.18,.48,.7],'#7d848b');
    for(let i=0;i<5;i++)box(e,[0,.48,-.28+i*.14],[2.5,.09,.11],'#98a0a7');
    box(e,[0,.86,-.36],[2.5,.5,.1],'#98a0a7',[14,0,0]);
    return {hw:1.3,hd:.5,y1:.95};
  }
  if(k==='bin'){
    box(e,[0,.5,0],[.56,1,.56],'#7c838a');
    box(e,[0,1.04,0],[.66,.1,.66],'#5f666c');
    box(e,[0,.86,.29],[.3,.22,.06],'#464c52');
    return {hw:.34,hd:.34,y1:1.1};
  }
  if(k==='citycrossing'){
    for(let i=-3;i<=3;i++)box(e,[i*1.3,.02,0],[.75,.04,4.4],'#e2e4e2');
    e.lookName='crossing';
    return null;                                    // paint, not an obstacle
  }
  if(k==='trafficlight'){
    cylinder(e,[0,.1,0],[.44,.2,.44],'#5f656b');
    cylinder(e,[0,1.9,0],[.16,3.6,.16],'#71777d');
    box(e,[0,3.5,.2],[.42,1.15,.42],'#3a4046');
    const colors=['#d4574f','#e0b652','#6fb072'];
    for(let i=0;i<3;i++){
      const bulb=ball(e,[0,3.9-i*.36,.42],[.24,.24,.12],colors[i]);bulb.lookName='traffic-light';
      if(i===2){const lit=glow(colors[i]);bulb.render.meshInstances[0].material=lit;lamps.push(lit);}
    }
    return {hw:.3,hd:.3,y1:4.2};
  }
  if(k==='cityshelter'){
    for(const x of [-2.4,2.4])cylinder(e,[x,1.3,0],[.16,2.6,.16],'#868d94');
    box(e,[0,2.7,0],[5.4,.16,2.2],'#b8c8d0');
    box(e,[0,1.4,-1.0],[5.2,2.6,.1],'#c3d3da');
    for(let i=0;i<4;i++)box(e,[-1.6+i*1.05,.6,-.7],[.9,.1,.5],'#98a0a7');
    backlight(label(e,'公交站',[1.9,1.9,.98],1.7,.6,'#26333f','#e2ecf3'),.7);
    return {hw:2.8,hd:1.2,y1:2.9};
  }
  if(k==='citykiosk'){
    box(e,[0,1.35,0],[3.4,2.7,2.4],'#8b9299');
    box(e,[0,2.85,0],[3.8,.3,2.8],'#6e757c');
    const glass=box(e,[0,1.5,1.24],[2.6,1.5,.08],'#cfe0e6');
    const lit=glow('#f3ead0');glass.render.meshInstances[0].material=lit;lamps.push(lit);
    box(e,[0,.62,1.3],[2.8,.18,.5],'#a9b0b6');
    backlight(label(e,'便利店',[0,2.5,1.45],2.4,.66,'#2f4436','#ecf3e4'),.8);
    return {hw:1.9,hd:1.5,y1:3};
  }
  if(k==='bigscreen'){
    for(const x of [-6.5,6.5])box(e,[x,3.2,0],[.7,6.4,.7],'#767c83');
    box(e,[0,8.4,0],[15.4,7.6,.9],'#2a3138');
    const face=box(e,[0,8.4,.5],[14.2,6.4,.14],'#7fa7c4');
    const lit=glow('#7fa7c4');face.render.meshInstances[0].material=lit;lamps.push(lit);
    backlight(label(e,'欢迎来到云海',[0,8.4,.62],9.6,2.1,'#20313f','#ffe9b8'),.95);
    return {hw:7.6,hd:.7,y1:12};
  }
  if(k==='taxi'){
    box(e,[0,.62,0],[1.9,.72,4.3],'#d8c06a');
    box(e,[0,1.25,-.25],[1.7,.66,2.3],'#e3ddd2');
    box(e,[0,1.66,-.3],[.7,.2,.5],'#3d4650');
    for(const [x,z] of [[-.95,1.4],[.95,1.4],[-.95,-1.4],[.95,-1.4]])
      cylinder(e,[x,.34,z],[.68,.26,.68],'#3a3f45',[0,0,90]);
    return {hw:1.1,hd:2.3,y1:1.9};
  }
  return null;
}

/** Blocks on the horizon. No detail, no windows, no collision — depth, and nothing else. */
function backdrop(models,root,w,d){
  const {box}=models;
  let seed=20260910;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const shades=['#7c848d','#848b92','#767e88','#8b9198','#707880'];
  const occupied=[];root.skylineBounds=occupied;
  const block=(position,size,color)=>{
    const [x,,z]=position,[width,,depth]=size,shape={x,z,hw:width/2,hd:depth/2};
    if(occupied.some(b=>Math.abs(x-b.x)<shape.hw+b.hw+.8&&Math.abs(z-b.z)<shape.hd+b.hd+.8))return;
    occupied.push(shape);box(root,position,size,color);
  };
  for(let ring=0;ring<3;ring++){
    const out=w/2+16+ring*17;
    for(let i=0;i<14;i++){
      const along=(i/13-.5)*(d+70);
      for(const side of [-1,1]){
        const h=16+next()*44+ring*8;
        const bw=9+next()*9,bd=9+next()*9;
        block([side*(out+next()*9),h/2-1,along+next()*8],[bw,h,bd],shades[Math.floor(next()*shades.length)]);
      }
    }
  }
  for(let i=0;i<10;i++){
    const h=18+next()*40;
    block([(next()-.5)*(w+40),h/2-1,-d/2-22-next()*40],[10+next()*10,h,10+next()*10],shades[Math.floor(next()*shades.length)]);
    block([(next()-.5)*(w+40),h/2-1, d/2+26+next()*40],[10+next()*10,h,10+next()*10],shades[Math.floor(next()*shades.length)]);
  }
}

export function buildCity(models,parent){
  const {box}=models;
  const data=city.place,[w,d]=data.size;
  const root=new pc.Entity('city');root.setLocalPosition(CITY_OFFSET,0,0);parent.addChild(root);
  const lamps=[],marks=[];

  // The ground runs well past the part you can walk on, and a ring of hazy blocks stands beyond
  // it, so the city never ends in a visible edge with sky underneath.
  box(root,[0,-.3,0],[w*3.2,.4,d*2.6],'#7f858b');
  backdrop(models,root,w,d);
  box(root,[0,-.12,0],[w,.24,d],data.ground);                          // roadway
  box(root,[0,-.06,0],[16,.16,d-2],data.pave);                         // the avenue itself
  for(const side of [-1,1])box(root,[side*7.6,.02,0],[.9,.1,d-4],'#c6c8c4');  // kerbs
  for(let z=-30;z<24;z+=4)box(root,[0,.03,z],[.28,.06,2.2],'#dfe1dd');  // centre line
  box(root,[0,.02,26],[30,.1,10],data.pave);                            // the station forecourt

  marks.push(...station(models,root,lamps));
  for(const def of city.towers)marks.push(tower(models,root,def,lamps));
  if(city.department){
    const door=new pc.Entity('department-door');root.addChild(door);
    door.setLocalPosition(city.department.x-.28,0,city.department.z);door.setLocalEulerAngles(0,90,0);
    box(door,[0,1.6,0],[3.3,3.2,.18],'#526e69').lookName='door';
    box(door,[0,1.55,.11],[2.8,2.9,.08],'#bdd4cf').lookName='door';
    for(const x of [-.22,.22])box(door,[x,1.2,.2],[.05,.55,.06],'#eee6c9').lookName='door';
    backlight(models.label(door,'五金 · 家居 · 灯具',[0,3.75,.15],5.5,.8,'#23493e','#f1e6c8'));
    models.label(door,'营业中  OPEN',[0,2.55,.2],2.2,.45,'#dce9d6','#385e4e');
  }
  for(const def of city.props){
    const hit=cityProp(models,root,def,lamps);
    // A quarter turn swaps the sides of an axis-aligned hitbox, the same as it does for a tower.
    const turned=Math.abs(((def.rot??0)/90)%2)===1;
    if(hit)marks.push({x:def.x,z:def.z,hw:turned?hit.hd:hit.hw,hd:turned?hit.hw:hit.hd,
      y0:0,y1:hit.y1,name:def.name??null});
  }
  const people=city.people.map(def=>{
    const made=models.person(root,def.color,[def.x,0,def.z]);
    made.entity.setLocalEulerAngles(0,def.rot??0,0);
    return {...def,...made,leg:0};
  });
  return {root,marks,people,lamps,data};
}

/**
 * The way in, back in 青禾广场: a stair going down under a steel-and-glass canopy, its mouth
 * facing the square.
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
  // The deck round the stairwell, open where the stair drops away (x ±1.7, z -1.72 to 1.45).
  for(const side of [-1,1])box(root,[side*2.25,.08,0],[1.1,.16,4.4],'#a8a9a4');
  box(root,[0,.08,-1.96],[3.4,.16,.48],'#a8a9a4');
  box(root,[0,.08,1.83],[3.4,.16,.74],'#a8a9a4');
  // The top step, then the dark of the stairwell going down.
  box(root,[0,-.06,-1.5],[3.4,.28,.44],'#9ba09f').lookName='stairs';
  box(root,[0,.03,.09],[3.4,.02,2.72],'#1d2226').lookName='stairs';
  box(root,[0,-.6,1.6],[3.8,2,.3],'#3c4247');
  for(const side of [-1,1]){
    box(root,[side*1.9,.5,0],[.14,1,4.2],'#8f979d');
    for(let i=0;i<5;i++)cylinder(root,[side*1.9,.5,-1.6+i*.9],[.1,1,.1],'#8f979d');
    cylinder(root,[side*1.9,1.02,0],[.11,4.2,.11],'#c2c8cb',[90,0,0]);
    cylinder(root,[side*1.55,2.4,-1.9],[.16,4.8,.16],'#8f979d');
  }
  box(root,[0,2.9,-1.9],[4.2,.18,2.6],'#b9cbd2');
  box(root,[0,3.05,-1.9],[4.4,.12,2.8],'#7f8a91');
  const sign=label(root,'地铁',[0,2.2,-3.1],1.9,.8,'#20303f','#e6f0f8');
  sign.setLocalPosition(0,2.2,-3.12);
  cylinder(root,[0,1.2,-3.1],[.12,2,.12],'#8f979d');
  const lit=glow('#5b93c8');
  const halo=box(root,[0,1.68,-3.1],[1.9,.12,.1],'#5b93c8');
  halo.render.meshInstances[0].material=lit;
  lamps?.push(lit);
  // The registry is axis aligned and knows nothing about the entity's rotation, so the hitboxes
  // are turned by hand here. Getting this wrong leaves a solid canopy floating on the wrong side
  // of the stair, which is invisible until you walk into it.
  const turn=(def.rotation??0)*Math.PI/180,cos=Math.cos(turn),sin=Math.sin(turn);
  const at=(lx,lz,hw,hd)=>({
    x:def.x+lx*cos+lz*sin, z:def.z-lx*sin+lz*cos,
    hw:Math.abs(cos)>.5?hw:hd, hd:Math.abs(cos)>.5?hd:hw,
  });
  // The canopy roof and the balustrades are solid, and so is the stairwell past the top step:
  // you go down by pressing E, not by walking off the edge. None of them is named, so a look
  // lands on the step or the stairwell (楼梯) or, anywhere else, on the entrance (地铁站).
  return {root,marks:[
    {...at(0,-1.9,2.3,1.5),y0:2.8,y1:3.2,name:null},
    {...at(-1.9,0,.3,2.2),y0:0,y1:1.1,name:null},
    {...at(1.9,0,.3,2.2),y0:0,y1:1.1,name:null},
    {...at(0,.24,1.6,1.52),y0:0,y1:1.1,name:null},
  ]};
}
