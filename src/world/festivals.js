import * as pc from 'playcanvas';
import catalog from '../content/catalog.json' with {type:'json'};
import objectNames from '../content/objects.json' with {type:'json'};
import festivals from '../content/festivals.json' with {type:'json'};
import {festivalOf,RIDDLES} from '../core/festivals.js';
import {syncDay,bump} from '../core/daily.js';

/**
 * Festival decorations, the festival stall and the noticeboard (see src/core/festivals.js).
 *
 * They exist only on a festival day, so they are built at run time under the town root, after
 * the static batching, and torn down when the day ends: nothing here is ever batched. Every mesh
 * is tagged for the naming engine and casts no shadow, and each festival stays within about 60
 * draw calls wherever you stand (the lanterns share three glowing materials).
 */
const NAMES=objectNames.objects;
const STALL={x:4.8,z:11.2},BOARD={x:-2.4,z:-2.7,yaw:30},FOUNTAIN={x:0,z:1.8};
const POND={x:0,z:34,r:4.9,level:.08};             // the boat's loop round the island, under both bridges
const MOON_DIR=new pc.Vec3(.2,.62,1).normalize();  // south and high, above the park's back hills
const own=(e,name)=>{e.lookName=name;return e;};

class FestivalDecor {
  constructor(town){
    this.town=town;this.id=null;this.root=null;this.boxes=[];this.list=[];this.boat=null;this.moon=null;
    // Three lantern colours, made once and dimmed with the daylight like every other lamp.
    this.lit=['#d9483b','#e8b04a','#e27a98'].map(hex=>{const m=town.m.glow(hex);town.daylight.addLamp(m);return m;});
  }
  targets(){return this.list;}
  show(festival){
    const id=festival?.id??null;
    if(id===this.id)return;
    this.clear();this.id=id;
    if(!festival)return;
    this.root=new pc.Entity('festival-'+id);this.town.root.addChild(this.root);
    this[id]();
    this.stall(festival);this.board();
    for(const r of this.root.findComponents('render'))r.castShadows=false;
    this.town.registerLooks('town',this.root,{owner:'festival',skip:new Set([this.boat,this.moon].filter(Boolean))});
  }
  clear(){
    const reg=this.town.registry;
    this.root?.destroy();this.root=this.boat=this.moon=null;this.list=[];
    for(const owner of ['festival','festival-moving','festival-moon'])reg.clearLooks('town',owner);
    reg.boxes=reg.boxes.filter(b=>!this.boxes.includes(b));this.boxes=[];
  }
  solid(x,z,hw,hd,y1){this.boxes.push(this.town.registry.add({place:'town',x,z,hw,hd,y0:0,y1}));}
  lantern(x,y,z,colour=0,name='lantern'){
    const e=own(this.town.m.ball(this.root,[x,y,z],[.42,.5,.42],'#d9483b'),name);
    e.render.meshInstances[0].material=this.lit[colour%this.lit.length];
    return e;
  }
  post(x,z,height){own(this.town.m.cylinder(this.root,[x,height/2,z],[.12,height,.12],'#8b5a3c'),'pillar');this.solid(x,z,.1,.1,height);}

  /** 春节: red lanterns on two strings across the square, the banner, and 福 upside down on the doors. */
  chunjie(){
    const {box,label}=this.town.m;
    for(const [z,span,xs] of [[8,9.4,[-7.5,-5,-2.5,2.5,5,7.5]],[-2.5,7.6,[-5,-2.5,0,2.5,5]]]){
      for(const x of [-span,span])this.post(x,z,4.4);
      own(box(this.root,[0,4.3,z],[span*2,.03,.03],'#8b7b62'),'lantern-string');
      for(const x of xs)this.lantern(x,3.95,z);
    }
    label(this.root,'新年快乐',[0,3.88,8],3.2,.7,'#b8322a','#f3d27a');
    const fu=this.fu();
    for(const b of this.town.data.buildings){
      if(b.district!=='square'||b.bespoke||b.site)continue;
      const face=(b.rotation??0)===180?-1:1;
      const e=own(box(this.root,[b.x,1.55,b.z+face*(b.depth/2+.08)],[.5,.5,.03],'#c0392b',[0,face<0?180:0,225]),'fuzi');
      e.render.meshInstances[0].material=fu;
    }
  }
  /** 元宵节: 花灯 on a square of strings round the fountain; ten of them carry a riddle. */
  yuanxiao(){
    const {box}=this.town.m,y=2.95,side=3.8;
    for(const sx of [-1,1])for(const sz of [-1,1])this.post(FOUNTAIN.x+sx*side,FOUNTAIN.z+sz*side,y+.05);
    for(const s of [-1,1]){
      own(box(this.root,[FOUNTAIN.x,y,FOUNTAIN.z+s*side],[side*2,.03,.03],'#8b7b62'),'lantern-string');
      own(box(this.root,[FOUNTAIN.x+s*side,y,FOUNTAIN.z],[.03,.03,side*2],'#8b7b62'),'lantern-string');
    }
    const spots=[-2.5,0,2.5].flatMap(t=>[[t,-side,0],[t,side,0],[-side,t,90],[side,t,90]]);
    spots.forEach(([dx,dz,rot],i)=>{
      const x=FOUNTAIN.x+dx,z=FOUNTAIN.z+dz,riddle=RIDDLES[i];
      this.lantern(x,y-.4,z,i,'huadeng');
      if(!riddle)return;
      const tag=own(box(this.root,[x,y-.85,z],[.14,.4,.02],'#f4e3b9',[0,rot,0]),'dengmi');
      tag.riddle=riddle.n;
      this.list.push({id:'fest:riddle:'+riddle.n,x,z,radius:1.8,label:festivals.ui.riddle.zh});
    });
  }
  /** 端午节: a dragon boat circling the lotus pond's island. */
  duanwu(){
    const {box,cylinder}=this.town.m;
    this.boat=own(new pc.Entity('longzhou'),'longzhou');this.root.addChild(this.boat);
    box(this.boat,[0,.07,0],[.5,.22,2.2],'#b8412f');
    box(this.boat,[0,.3,1.15],[.28,.34,.3],'#d9a441');
    box(this.boat,[0,.28,-1.15],[.12,.3,.2],'#d9a441');
    cylinder(this.boat,[0,.27,0],[.28,.2,.28],'#8b3a2a');
  }
  /** 中秋节: floor lanterns along the park paths, and at night a big full moon. */
  zhongqiu(){
    const spots=[[-13,24.4],[-9,24.4],[-5,24.4],[5,24.4],[9,24.4],[13,24.4],[-12.4,29],[-12.4,33],[-12.4,37],[12.8,29],[12.8,33],[12.8,37]];
    spots.forEach(([x,z],i)=>this.lantern(x,.28,z,i%2?1:0,'huadeng'));
    const m=new pc.StandardMaterial();m.emissive=new pc.Color(1,.95,.8);m.diffuse=new pc.Color(0,0,0);m.useLighting=false;m.useFog=false;m.update();
    this.moon=this.town.m.ball(this.root,[0,0,0],[10,10,10],'#fff4d6');this.moon.name='sky';
    this.moon.render.meshInstances[0].material=m;this.moon.enabled=false;
  }
  /** The festival food stall, sold through the order builder (market.json lists its shop). */
  stall(festival){
    const {box,cylinder}=this.town.m,{x,z}=STALL;
    own(box(this.root,[x,.5,z],[2.4,1,.9],'#a8453a'),'counter');
    own(box(this.root,[x,1.03,z],[2.6,.06,1.05],'#e6cf9e'),'counter');
    for(const s of [-1,1])own(cylinder(this.root,[x+s*1.25,1.25,z+.45],[.08,2.5,.08],'#8b5a3c'),'pillar');
    own(box(this.root,[x,2.52,z+.1],[2.9,.1,1.4],'#c0392b'),'awning');
    own(cylinder(this.root,[x-.6,1.12,z-.1],[.5,.14,.5],'#e8dcc0'),'goods');
    if(festival.id==='chunjie'){
      for(const s of [-1,1])own(box(this.root,[x+s*1.25,1.45,z+.36],[.2,1.2,.02],'#c0392b'),'chunlian');
      own(box(this.root,[x+.6,1.07,z-.15],[.3,.03,.18],'#d63b2f'),'hongbao');
    }
    this.solid(x,z,1.25,.5,1.06);
    const food=catalog.find(i=>i.id===festival.food);
    this.list.push({id:'shop:fest-'+festival.id,x,z:z-1.3,radius:2.6,label:'看看'+food.zh,wide:true});
  }
  /** The noticeboard by the fountain: E reads out what today is (the teacher's line). */
  board(){
    const {box,cylinder}=this.town.m,{x,z,yaw}=BOARD;
    const g=new pc.Entity('festival-board');g.setLocalPosition(x,0,z);g.setLocalEulerAngles(0,yaw,0);this.root.addChild(g);
    own(cylinder(g,[0,.7,0],[.1,1.4,.1],'#8b5a3c'),'pillar');
    own(box(g,[0,1.5,0],[1.1,.72,.06],'#c0392b'),'sign');
    this.solid(x,z,.12,.12,1.9);
    this.list.push({id:'fest:about',x,z,radius:2.4,label:'看看告示',wide:true});
  }
  /** One square texture shared by every 福 on the doors. */
  fu(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const c=canvas.getContext('2d');c.fillStyle='#c0392b';c.fillRect(0,0,128,128);
    c.fillStyle='#1d1a17';c.font='bold 96px "Microsoft YaHei", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('福',64,68);
    const tex=new pc.Texture(this.town.app.graphicsDevice,{width:128,height:128,mipmaps:true});tex.setSource(canvas);
    const m=new pc.StandardMaterial();m.diffuseMap=tex;m.emissiveMap=tex;m.emissive=new pc.Color(.3,.3,.3);m.update();
    return m;
  }
  /** Per frame: the boat rows, the moon keeps to the sky, and looking at it from the park counts. */
  update(ctx){
    const town=this.town,reg=town.registry;
    if(this.boat){
      const a=town.clock*.22,x=POND.x+POND.r*Math.cos(a),z=POND.z+POND.r*Math.sin(a);
      this.boat.setLocalPosition(x,POND.level,z);
      // Heading along the loop: the model's bow is its own +z.
      this.boat.setLocalEulerAngles(0,Math.atan2(-Math.sin(a),Math.cos(a))*180/Math.PI,0);
      reg.clearLooks('town','festival-moving');
      if(town.place==='town')town.registerLooks('town',this.boat,{owner:'festival-moving'});
    }
    if(!this.moon)return;
    const hour=town.daylight.hour,night=town.place==='town'&&(hour>=18||hour<5);
    this.moon.enabled=night;
    reg.clearLooks('town','festival-moon');
    if(!night)return;
    const eye=town.camera.getPosition();
    this.moon.setPosition(new pc.Vec3().copy(MOON_DIR).mulScalar(150).add(eye));
    // The moon is far past the look range, so a small box on the way to it carries its name.
    const near=new pc.Vec3().copy(MOON_DIR).mulScalar(9).add(eye);
    reg.addLook({place:'town',x:near.x,z:near.z,hw:.7,hd:.7,y0:near.y-.7,y1:near.y+.7,
      name:{id:'yueliang',...NAMES.yueliang},owner:'festival-moon',entity:this.moon});
    const daily=syncDay(ctx.profile,ctx.profile.dayIndex??0),pos=town.player.entity.getPosition();
    if(hour>=18&&!daily.counts.moon&&town.looking?.id==='yueliang'&&town.districtAt(pos.x,pos.z)?.id==='garden'){
      bump(ctx.profile,'moon');ctx.save();
    }
  }
}

/** main.js calls this every frame: decorations follow the calendar, and animate while they last. */
export function festivalFrame(ctx,town){
  town.festival??=new FestivalDecor(town);
  town.festival.show(festivalOf(ctx.profile));
  if(town.festival.id)town.festival.update(ctx);
}
