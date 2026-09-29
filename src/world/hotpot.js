import * as pc from 'playcanvas';
import data from '../content/hotpot.json' with {type:'json'};
import objects from '../content/objects.json' with {type:'json'};
import {CITY_OFFSET as OX} from './city.js';
import {initIdle,animateIdle} from './idle.js';
import {BROTHS,menuOf} from '../core/hotpot.js';

/**
 * 山城老火锅, the open-air hotpot terrace on the hill (task J-hotpot,
 * docs/superpowers/plans/2026-09-26-development-wave-2.md): a deck at y 14 looking north over the
 * bay, six tables with a pot set into each, stools you sit on with the game's own sitting (they
 * are fittings of the city "room"), string lights and lanterns, the kitchen and cashier at the
 * back, the 蘸料台 sauce station, the noodle chef's board and a railing along the north edge.
 *
 * The waiter walks over when you sit down and opens the menu (ui/hotpot.js, through the same
 * `hotpot:` interaction ids the table offers). What moves — the two staff, the plates, the broth
 * bubbles and the noodle ribbon — is built once, marked noBatch and only ever repositioned.
 */
const L=data.layout,Y=L.deck.y,CX=(L.deck.x0+L.deck.x1)/2,CZ=(L.deck.z0+L.deck.z1)/2;
// The staff keep to three lanes: the aisle between the two rows of tables, the lane behind the
// back row and the gap between the middle and east columns that joins them.
const AISLE_Z=(L.tables[0][1]+L.tables[3][1])/2,BACK_Z=-35.2,LANE_X=-69;
const COLUMNS=[...new Set(L.tables.map(([x])=>x))];
const WALK=2.4,SLOTS=8,BUBBLES=6,RIBBON=28,SHOW=6.4,STAND=1.65;   // STAND: staff stand this far from a table's centre
const BROTH=menuOf('broth')[0].color;   // the pot's broth before anything is ordered
const look=id=>({id,...objects.objects[id]});

export function buildHotpot(town,root){
  const m=town.m,{box,cylinder,ball,label,tube}=m;
  const lamp=hex=>town.daylight.addLamp(m.glow(hex));
  const node=(parent,name,lookName)=>{const e=new pc.Entity(name);parent.addChild(e);if(lookName)e.lookName=lookName;return e;};
  const mark=(x,z,hw,hd,y0,y1,name)=>town.mark('city',OX+x,z,hw,hd,y0,y1,name);
  const red=lamp('#d4483a'),bulb=lamp('#ffd98a'),kitchenLight=lamp('#ffb46a');
  const lantern=(x,y,z)=>m.redLantern(root,x,y,z,red);

  // The deck, a paler inset of tiles, and one solid block under it for K-hill's hill to wrap.
  const W=L.deck.x1-L.deck.x0,D=L.deck.z1-L.deck.z0;
  const deck=node(root,'hotpot-deck','floor');
  box(deck,[CX,Y-.175,CZ],[W,.4,D],'#6f675e');       // a hair above the hill's own terrace slab, so the two never fight
  box(deck,[CX,Y-.17,CZ],[W-.8,.4,D-.8],'#8d8274');
  mark(CX,CZ,W/2,D/2,0,Y,null);

  // A railing along the open north edge: the whole bay and the lit skyline are the view.
  const rail=node(root,'hotpot-railing','railing'),railZ=L.deck.z0+.25;
  for(let x=L.deck.x0+.1;x<=L.deck.x1;x+=2)cylinder(rail,[x,Y+.55,railZ],[.09,1.1,.09],'#6e2a20');
  box(rail,[CX,Y+1.1,railZ],[W,.08,.12],'#8e3a2a');
  box(rail,[CX,Y+.55,railZ],[W,.05,.05],'#6e2a20');
  mark(CX,railZ,W/2,.12,Y,Y+1.6,'railing');   // taller than a jump can clear: it is a 14 m drop

  // The kitchen and cashier at the back, under a dark eave hung with lanterns.
  const k=L.kitchen,front=k.z-k.d/2;
  const kitchen=node(root,'hotpot-kitchen','kitchen'),hatch=node(root,'hotpot-hatch','window');
  box(kitchen,[k.x,Y+k.h/2,k.z],[k.w,k.h,k.d],'#d8ccb2');
  box(kitchen,[k.x,Y+k.h+.12,k.z-.3],[k.w+.8,.24,k.d+1],'#4b4640');
  box(kitchen,[k.x,Y+k.h+.3,k.z],[k.w+.2,.14,k.d-.6],'#3b3833');
  box(kitchen,[k.x+3.6,Y+1.05,front-.03],[1.1,2.1,.06],'#6b3a26');
  box(hatch,[k.x-2,Y+1.45,front-.03],[3.2,1.1,.06],'#ffb46a').render.meshInstances[0].material=kitchenLight;
  box(hatch,[k.x-2,Y+.88,front-.2],[3.4,.08,.4],'#6b4a33');
  const board=node(root,'hotpot-board');board.setLocalPosition(k.x,Y+k.h-.45,front-.08);board.setLocalEulerAngles(0,180,0);
  label(board,'山城老火锅',[0,0,0],4.6,.78,'#8e1f16','#f6d98a');
  for(const dx of [-5,-2.6,.6,3.2,5.4])lantern(k.x+dx,Y+2.55,front-.55);
  mark(k.x,k.z,k.w/2,k.d/2,Y,Y+k.h+.4,'kitchen');
  const c=L.counter,till=node(root,'hotpot-counter','counter');
  box(till,[c.x,Y+.52,c.z],[2.4,1.04,.6],'#7a4a30');
  box(till,[c.x,Y+1.07,c.z],[2.6,.07,.72],'#d8cfbd');
  box(till,[c.x+.6,Y+1.2,c.z],[.35,.2,.3],'#3a3a3a');
  mark(c.x,c.z,1.3,.36,Y,Y+1.1,'counter');

  // The noodle chef's floured board, beside the kitchen door.
  const cb=L.chefBoard;
  const chefBoard=node(root,'hotpot-chef-board','table');
  box(chefBoard,[cb.x,Y+.45,cb.z],[1.8,.9,.8],'#7a5a3e');
  box(chefBoard,[cb.x,Y+.92,cb.z],[1.7,.04,.7],'#f2ecdc');
  ball(chefBoard,[cb.x-.4,Y+1,cb.z],[.3,.14,.24],'#f0e2b4');
  mark(cb.x,cb.z,.9,.4,Y,Y+.95,'table');

  // 蘸料台: a long counter of little bowls under its own sign, facing the tables.
  const s=L.sauce,station=node(root,'hotpot-sauce','counter');
  box(station,[s.x,Y+.47,s.z],[.9,.94,4],'#6e4a33');
  box(station,[s.x,Y+.96,s.z],[1,.06,4.1],'#d8cfbd');
  const sauces=['#c9a040','#a8773f','#efe8d0','#5c9a48','#7cb850','#d8321e'];
  const bowls=node(root,'hotpot-sauce-bowls','bowl'),posts=node(root,'hotpot-sauce-posts','pillar');
  for(let i=0;i<12;i++)cylinder(bowls,[s.x+(i%2?.2:-.2),Y+1.02,s.z-1.65+Math.floor(i/2)*.66],[.22,.07,.22],sauces[i%sauces.length]);
  for(const dz of [-1.9,1.9])cylinder(posts,[s.x-.3,Y+1.3,s.z+dz],[.08,2.6,.08],'#6e2a20');
  const sauceSign=node(root,'hotpot-sauce-sign');sauceSign.setLocalPosition(s.x-.3,Y+2.35,s.z);sauceSign.setLocalEulerAngles(0,90,0);
  label(sauceSign,'蘸料台',[0,0,0],2.4,.6,'#8e1f16','#f6d98a');
  mark(s.x,s.z,.5,2.05,Y,Y+1,'counter');

  // A gateway where the stairway arrives on the east edge, its name board facing the climb.
  const g=L.gate,gate=node(root,'hotpot-gate','paifang');
  for(const dz of [-5,5]){cylinder(gate,[g.x,Y+1.7,g.z+dz],[.26,3.4,.26],'#7a2e22');mark(g.x,g.z+dz,.15,.15,Y,Y+3.4,'pillar');}
  box(gate,[g.x,Y+3.45,g.z],[.34,.3,10.8],'#4b4640');
  const gateSign=node(root,'hotpot-gate-sign');gateSign.setLocalPosition(g.x+.2,Y+3,g.z);gateSign.setLocalEulerAngles(0,90,0);
  label(gateSign,'山城老火锅',[0,0,0],3.6,.62,'#8e1f16','#f6d98a');
  for(const dz of [-3.6,3.6])lantern(g.x,Y+2.7,g.z+dz);

  // String lights sagging over the two rows of tables, and a lantern over each table.
  const lights=node(root,'hotpot-lights','lantern-string'),lx0=L.deck.x0+.4,lx1=L.deck.x1-.4;
  for(const z of [L.tables[0][1],L.tables[3][1]]){
    for(const x of [lx0,lx1]){cylinder(node(root,'hotpot-light-pole','pillar'),[x,Y+1.8,z],[.1,3.6,.1],'#3b3833');mark(x,z,.08,.08,Y,Y+3.6,null);}
    let px=lx0,py=Y+3.5;
    for(let i=1;i<=12;i++){
      const t=i/12,x=lx0+(lx1-lx0)*t,y=Y+3.5-1.4*t*(1-t);
      tube(lights,[px,py],[x,y],.02,'#2a2826',z);
      if(i<12)ball(lights,[x,y-.08,z],[.13,.16,.13],'#ffd98a').render.meshInstances[0].material=bulb;
      px=x;py=y;
    }
  }
  for(const [tx,tz] of L.tables)lantern(tx,Y+2.72,tz);
  // After dark the string lights actually light the tables: two warm lamps, dimmed with the day.
  const glowLights=[L.tables[0][1],L.tables[3][1]].map(z=>{
    const e=node(root,'hotpot-light');e.setLocalPosition(CX,Y+3.2,z);
    e.addComponent('light',{type:'omni',color:new pc.Color(1,.72,.45),intensity:0,range:12,castShadows:false});
    return e;
  });
  let glowLevel=-1;

  // Tables: a pot set into each and four low stools. The stools are fittings, so town.sit works.
  const room=town.rooms.get('city'),seats=[],brothDiscs=[];
  L.tables.forEach(([tx,tz],n)=>{
    const table=node(root,'hotpot-table-'+n,'table');
    box(table,[tx,Y+.36,tz],[1.2,.72,1.2],'#5a3a2a');
    box(table,[tx,Y+.74,tz],[1.4,.06,1.4],'#3d2a20');
    const pot=node(root,'hotpot-pot-'+n,'hotpot');
    cylinder(pot,[tx,Y+.8,tz],[.7,.12,.7],'#2e2e30');
    const disc=cylinder(pot,[tx,Y+.83,tz],[.6,.07,.6],BROTH);
    disc.noBatch=true;brothDiscs.push(disc);
    mark(tx,tz,.7,.7,Y,Y+.86,'table');
    room.fittings.push({x:tx,z:tz,action:'hotpot:table:'+n,label:data.ui.order.zh,hotpot:n});
    for(const [dx,dz,rot] of [[0,-.98,0],[0,.98,180],[-.98,0,90],[.98,0,270]]){
      const stool=node(root,'hotpot-stool','stool'),x=tx+dx,z=tz+dz;
      cylinder(stool,[x,Y+.2,z],[.3,.4,.3],'#9a2c22');
      cylinder(stool,[x,Y+.43,z],[.44,.07,.44],'#c23a2b');
      mark(x,z,.22,.22,Y,Y+.47,'stool');
      const index=room.fittings.push({x,z,seat:Y+.47,rot,hotpot:n})-1;
      seats.push({id:'sit:'+index,x:OX+x,z,radius:1.1,label:'坐下',wide:true});
    }
  });

  // --- what moves --------------------------------------------------------------------------
  const service=node(root,'hotpot-service');service.noBatch=true;
  const slots=Array.from({length:SLOTS},(_,i)=>{
    const a=i/SLOTS*Math.PI*2,plate=cylinder(service,[0,0,0],[.24,.03,.24],'#f4f1ea');
    const food=box(service,[0,0,0],[.17,.07,.13],'#c8645e');
    plate.enabled=food.enabled=false;
    return {plate,food,dx:Math.cos(a)*.52,dz:Math.sin(a)*.52,item:null,pot:false,t:0,owner:'hotpot-food-'+i};
  });
  const bubbles=Array.from({length:BUBBLES},(_,i)=>{
    const b=ball(service,[0,0,0],[.04,.04,.04],'#f6e4c4');b.enabled=false;
    return {b,dx:Math.cos(i*2.4)*.07*(1+i%3),dz:Math.sin(i*2.4)*.07*(1+i%3),phase:i/BUBBLES};
  });
  const ribbon=Array.from({length:RIBBON},()=>{const r=box(service,[0,0,0],[.045,.03,.16],'#f3e6c0');r.enabled=false;return r;});

  const staff=(color,[x,z],chefHat)=>{
    const p=initIdle(m.person(root,color,[x,Y,z]));
    p.entity.setLocalEulerAngles(0,180,0);
    if(chefHat){cylinder(p.neck,[0,.72,0],[.4,.34,.4],'#f7f5ee');ball(p.neck,[0,.92,0],[.5,.2,.5],'#f7f5ee');}
    else box(p.upper,[0,.9,.19],[.5,.5,.02],'#2a2320');           // the waiter's apron
    return Object.assign(p,{x,z,path:[],then:null,walk:0});
  };
  const waiter=staff('#8e1f16',L.waiter,false),chef=staff('#f2f0e8',L.chef,true);
  const lookAs=(who,name,owner)=>{town.registry.clearLooks('city',owner);if(name)town.addLookBox('city',who.entity,look(name),owner);};
  lookAs(waiter,'waiter','hotpot-waiter');lookAs(chef,'noodle-chef','hotpot-chef');

  /**
   * Along the lanes from where they stand to (x,z): out of the back by the back lane, or out from
   * beside a table by the gap between it and its neighbour; along the aisle; then in the same way.
   */
  const inBack=z=>z>BACK_Z-.3;
  const gap=x=>{const tx=COLUMNS.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a);return x>=tx?tx+3:tx-3;};
  function go(who,[x,z],then=null){
    const path=who.path;path.length=0;
    if(inBack(who.z))path.push([who.x,BACK_Z],[LANE_X,BACK_Z],[LANE_X,AISLE_Z]);
    else path.push([gap(who.x),who.z],[gap(who.x),AISLE_Z]);
    if(inBack(z))path.push([LANE_X,AISLE_Z],[LANE_X,BACK_Z],[x,BACK_Z],[x,z]);
    else path.push([gap(x),AISLE_Z],[gap(x),z],[x,z]);
    who.then=then;
    if(who===waiter)lookAs(waiter,null,'hotpot-waiter');
    if(who===chef)lookAs(chef,null,'hotpot-chef');
  }
  const face=(who,x,z)=>who.entity.setLocalEulerAngles(0,Math.atan2(x-who.x,z-who.z)*180/Math.PI,0);
  function step(who,dt){
    if(!who.path.length){animateIdle(who,dt);return;}
    const [x,z]=who.path[0],dx=x-who.x,dz=z-who.z,d=Math.hypot(dx,dz),move=Math.min(d,WALK*dt);
    if(d>1e-3){face(who,x,z);who.x+=dx/d*move;who.z+=dz/d*move;}
    who.walk+=dt*9;
    const swing=Math.sin(who.walk)*28;
    who.legs[0].setLocalEulerAngles(swing,0,0);who.legs[1].setLocalEulerAngles(-swing,0,0);
    who.arms[0].setLocalEulerAngles(-swing*.6,0,0);who.arms[1].setLocalEulerAngles(swing*.6,0,0);
    who.entity.setLocalPosition(who.x,Y,who.z);
    if(d>move+1e-3)return;
    who.path.shift();
    if(who.path.length)return;
    for(const limb of who.legs)limb.setLocalEulerAngles(0,0,0);
    for(const limb of who.arms)limb.setLocalEulerAngles(0,0,0);
    if(who===waiter)lookAs(waiter,'waiter','hotpot-waiter');
    const then=who.then;who.then=null;then?.();
  }

  const hooks={say:null,unpaid:null,leave:null};
  let sitting=null,served=-1,serving=false,showAt=-1,showTable=0,onDeck=false,clock=0;
  // Rounds ordered while the waiter is already on the way ride along with him: every line waiting
  // for the next arrival, the noodle shows still owed, and a paid bill's table to clear once it lands.
  const pending=[];let showsDue=0,chefComing=false,clearWhenDone=false;
  // Which side of the table you sit on, as a unit step from its centre: the chef performs facing
  // you from the far side and the waiter stands at your side.
  let sx=0,sz=1;
  const seatedTable=()=>{const f=town.seated&&room.fittings[town.seated.index];return f?.hotpot??null;};
  const potted=new Set(data.categories.filter(c=>c.pot).flatMap(c=>c.items).filter(id=>!data.stayOnTable.includes(id)));

  function placeFood(n,lines){
    const [tx,tz]=L.tables[n];
    service.setLocalPosition(tx,Y,tz);
    served=n;
    for(const {item} of lines){
      if(BROTHS.includes(item.id)){brothDiscs[n].render.meshInstances[0].material=m.material(item.color);continue;}
      const slot=slots.find(one=>!one.item);
      if(!slot)continue;                 // ponytail: eight plates at most; a ninth dish is eaten but not drawn
      slot.item=item;slot.pot=potted.has(item.id);slot.t=-1.6-slots.indexOf(slot)*.35;
      slot.plate.setLocalPosition(slot.dx,.79,slot.dz);slot.food.setLocalPosition(slot.dx,.84,slot.dz);
      slot.food.render.meshInstances[0].material=m.material(item.color??'#c8645e');
      slot.plate.enabled=slot.food.enabled=true;
      // While it waits on its plate the dish names itself (F saves it, with its menu clip).
      town.registry.addLook({place:'city',x:OX+tx+slot.dx,z:tz+slot.dz,hw:.15,hd:.15,y0:Y+.76,y1:Y+.92,
        name:{id:'food:'+item.id,zh:item.zh,pinyin:item.pinyin,en:item.en,sign:true,audio:item.audio},owner:slot.owner,entity:slot.plate});
    }
    for(const b of bubbles)b.b.enabled=true;
  }
  function empty(slot){
    slot.item=null;slot.plate.enabled=slot.food.enabled=false;
    town.registry.clearLooks('city',slot.owner);
  }
  function animateFood(dt){
    for(const slot of slots){
      if(!slot.item||!slot.pot)continue;
      slot.t+=dt;
      if(slot.t<0)continue;
      // Lifted off the plate, over the rim and down into the broth.
      const t=Math.min(1,slot.t/.6),k=1-t;
      slot.food.setLocalPosition(slot.dx*k,.84+Math.sin(t*Math.PI)*.25-t*.06,slot.dz*k);
      if(t>=1)empty(slot);
    }
    for(const b of bubbles){
      if(!b.b.enabled)continue;
      const f=(clock*.9+b.phase)%1,size=.015+f*.035;
      b.b.setLocalPosition(b.dx,.855+f*.03,b.dz);b.b.setLocalScale(size,size*.8,size);
    }
  }

  /**
   * The noodle dance, SHOW seconds long: the dough is stretched between the hands, whipped round
   * in a spinning ribbon of loops over the table, then laid in a line from the hands into the pot
   * and slides in. Positions are in the service group's frame, which sits on the table.
   */
  const loop=(s,t)=>{const r=.15+s*1.05,a=(t-.8)*7-s*5;return [r*Math.cos(a),.55+r*Math.sin(a),.12*Math.sin(3*a)];};
  function animateShow(t){
    const [tx,tz]=L.tables[showTable],fx=(tx-chef.x)/STAND,fz=(tz-chef.z)/STAND,rx=-fz,rz=fx;
    const hx=chef.x+fx*.35-tx,hz=chef.z+fz*.35-tz,hy=1.35,reach=STAND-.35;
    const swing=Math.sin(t*7)*20;
    chef.arms[0].setLocalEulerAngles(-150+swing,0,0);chef.arms[1].setLocalEulerAngles(-150-swing,0,0);
    for(let i=0;i<RIBBON;i++){
      const s=i/(RIBBON-1);let px,py,pz;
      if(t<.8){px=(s*2-1)*(.1+t*.8);py=.25;pz=0;}
      else if(t<4.8)[px,py,pz]=loop(s,t);
      else{
        const k=Math.min(1,(t-4.8)/.9),[lx,ly,lz]=loop(s,4.8);
        px=lx*(1-k);py=ly*(1-k)-.48*s*k;pz=lz*(1-k)+reach*s*k;
      }
      const e=ribbon[i];
      e.enabled=t<5.7||s<1-(t-5.7)/.7;
      e.setLocalPosition(hx+rx*px+fx*pz,hy+py,hz+rz*px+fz*pz);
    }
    // Each piece lies along the ribbon: aim it at the next one.
    for(let i=0;i<RIBBON-1;i++){
      const a=ribbon[i].getPosition(),p=ribbon[i+1].getPosition();
      ribbon[i].setLocalScale(.05,.035,Math.hypot(p.x-a.x,p.y-a.y,p.z-a.z)+.03);ribbon[i].lookAt(p.x,p.y,p.z);
    }
  }
  const perform=()=>{
    showsDue--;showAt=0;lookAs(chef,'noodle-show','hotpot-chef');hooks.say?.('chef','start');
    // The ribbon's air over the table reads 扯面表演 while it flies.
    const [tx,tz]=L.tables[showTable];
    town.registry.clearLooks('city','hotpot-show');
    town.registry.addLook({place:'city',x:OX+(tx+chef.x)/2,z:(tz+chef.z)/2,hw:1.1,hd:1.1,y0:Y+.95,y1:Y+2.9,name:look('noodle-show'),owner:'hotpot-show',entity:service});
  };
  /** Call the chef over for the next show owed, unless he is already coming or performing. */
  function nextShow(n){
    if(!showsDue||showAt>=0||chefComing)return;
    showTable=n;chefComing=true;
    const [tx,tz]=L.tables[n];
    go(chef,[tx-sx*STAND,tz-sz*STAND],()=>{chefComing=false;face(chef,tx,tz);perform();});
  }
  function endShow(){
    showAt=-1;for(const r of ribbon)r.enabled=false;
    town.registry.clearLooks('city','hotpot-show');
    for(const arm of chef.arms)arm.setLocalEulerAngles(0,0,0);
    hooks.say?.('chef','done');
    if(showsDue)return perform();          // another 扯面 came while he was pulling this one
    go(chef,L.chef,()=>{chef.entity.setLocalEulerAngles(0,180,0);lookAs(chef,'noodle-chef','hotpot-chef');});
  }
  function clearTable(){
    for(const slot of slots)if(slot.item)empty(slot);
    for(const b of bubbles)b.b.enabled=false;
    if(served>=0)brothDiscs[served].render.meshInstances[0].material=m.material(BROTH);
    served=-1;clearWhenDone=false;
  }
  const busy=()=>serving||pending.length||showsDue||chefComing||showAt>=0||slots.some(s=>s.item&&s.pot);
  const toTable=(n,then)=>{const [tx,tz]=L.tables[n];go(waiter,[tx+sz*STAND,tz-sx*STAND],()=>{face(waiter,tx,tz);then?.();});};

  const part={
    hooks,
    /** A round of the order is on its way: the waiter fetches it from the hatch, then the plates arrive. */
    serve(lines,{noodles=false}={}){
      pending.push(...lines);
      if(noodles)showsDue++;
      clearWhenDone=false;
      if(serving)return;                  // he is already on his way: this round comes with the last
      const n=seatedTable()??sitting??0;
      serving=true;
      go(waiter,L.waiter,()=>toTable(n,()=>{
        serving=false;placeFood(n,pending);pending.length=0;
        hooks.say?.('waiter','served');
        nextShow(n);
      }));
    },
    /** The bill is paid: clear the table and let the pot go quiet, once everything ordered has landed. */
    clear(){if(busy())clearWhenDone=true;else clearTable();},
    get showing(){return showAt>=0;},
    targets(){return town.place==='city'&&!town.seated&&town.playerY>Y-1?seats:[];},
    update(dt,paused){
      if(paused||town.place!=='city')return;
      clock+=dt;
      const level=town.daylight.state?.lamps??0;
      if(Math.abs(level-glowLevel)>.02){glowLevel=level;for(const e of glowLights)e.light.intensity=level*1.6;}
      const n=seatedTable();
      if(n!==null&&sitting===null){
        // You sat down: the waiter comes over with the menu.
        sitting=n;
        const f=room.fittings[town.seated.index];sx=Math.round((f.x-L.tables[n][0])/.98);sz=Math.round((f.z-L.tables[n][1])/.98);
        if(!serving)toTable(n,()=>{if(seatedTable()===n&&!town.paused)town.onInteract('hotpot:table:'+n);});
      } else if(n===null&&sitting!==null){
        sitting=null;
        if(!serving&&!hooks.unpaid?.())go(waiter,L.waiter,()=>waiter.entity.setLocalEulerAngles(0,180,0));
      }
      // Walking off the terrace with the bill unpaid pays it.
      const p=town.player.entity.getPosition(),x=p.x-OX;
      const here=town.playerY>Y-1&&x>L.deck.x0-.5&&x<L.deck.x1+.5&&p.z>L.deck.z0-.5&&p.z<L.deck.z1+.5;
      if(onDeck&&!here&&hooks.unpaid?.())hooks.leave?.();
      onDeck=here;
      step(waiter,dt);
      if(showAt<0)step(chef,dt);
      else{showAt+=dt;animateShow(showAt);if(showAt>=SHOW)endShow();}
      animateFood(dt);
      if(clearWhenDone&&!busy())clearTable();
    },
  };
  town.hotpot=part;
  return part;
}
