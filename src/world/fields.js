import * as pc from 'playcanvas';
import fields from '../content/fields.json' with {type:'json'};
import objects from '../content/objects.json' with {type:'json'};
import {detail,RENDER} from '../core/quality.js';
import {waterOf} from './water.js';
import {Kit,lathe,roofShape,latticeWindow,PALETTE as P,basket} from './jiangnan.js';
import {buildTree,buildBamboo,buildBoat,buildHills,blob,blade,tube,flag,join,seeded,DENSITY} from './jiangnan-nature.js';

/**
 * 青禾田园 — the countryside past the park's town gate (docs/superpowers/specs/2026-10-01-fields-design.md),
 * built from src/content/fields.json in the painted Jiangnan finish of the town: the dirt road on
 * from the gate to the river 青禾河, willows on both banks, 王爷爷's timber pier with two moored
 * boats, rice paddies flooded round rows of shoots, a scarecrow, a water wheel lifting water into a
 * flume, 刘奶奶's fenced vegetable plot, a white-walled farmhouse with stepped gables, its yard of
 * hens and haystacks, and hills closing the valley.
 *
 * Statics gather into Kits (src/world/jiangnan.js), so the town's static batch takes them in a few
 * draw calls; the hens and the wheel move (`noBatch`) and ride a dynamic batch of their own (town.js),
 * and the fishing float, line and rod are shown only while someone fishes. Shoots, crops and reeds
 * thin out on 中 and 低 (DENSITY). Returns the collision and name marks for the town registry, the
 * moving life, the E targets and the fishing gear the play (src/ui/fields.js) drives.
 */
const DEG=180/Math.PI,TAU=Math.PI*2;
const C={dirt:'#a8916f',yard:'#b39d7b',soil:'#6e5543',bed:'#5e4636',earth:'#8a7556',bank:'#7f9a5e',straw:'#d2b366',strawDark:'#b5944f',
  bamboo:'#b8a064',timber:'#7a5c42',timberDark:'#5a4231',shoot:'#7fae4f',shootLight:'#9cc463',reed:'#86a058',reedTop:'#b59a62',
  leaf:'#5d8a45',leafDark:'#4a7438',stone:'#9a988f',stoneDark:'#83827a',grass:'#93ab7c'};
const box=(s)=>({x:(s.x0+s.x1)/2,z:(s.z0+s.z1)/2,hw:(s.x1-s.x0)/2,hd:(s.z1-s.z0)/2});

export function buildFields(models,parent,lamps,town){
  const root=new pc.Entity('fields');parent.addChild(root);
  const level=fields.level,lod=DENSITY[detail()]??1,painted=models.painted;
  const kit=(jitter=.06)=>new Kit(painted,{jitter});
  const marks=[],entities=[],looks=[];
  const mark=(m)=>{marks.push(m);return m;};
  const app=pc.AppBase.getApplication(),water=waterOf(app);
  const wet=(e,material)=>{e.render.meshInstances[0].material=material;e.render.castShadows=false;return e;};
  const sheet=(s,y,thick,material)=>{const b=box(s);return wet(models.box(root,[b.x,y,b.z],[b.hw*2,thick,b.hd*2],'#79aaa8'),material);};
  const ent=(name,x,y,z,yaw=0,look=null)=>{const e=new pc.Entity(name);e.setLocalPosition(x,y,z);e.setLocalEulerAngles(0,yaw,0);if(look)e.lookName=look;root.addChild(e);return e;};

  // The countryside's own grass under everything outside the district's lawn, so the far bank and
  // the land along the river are the same green as the near side.
  models.box(root,[0,-.02,118],[264,.04,105],C.grass);

  // ── The road on from the gate, and the paths ───────────────────────────────────────────────────
  // One shade throughout and no jitter, so where two paths cross they never flicker.
  const R=fields.road,dirt=(s,top,colour=C.dirt)=>{const b=box(s);return kit(0).box([b.x,top/2,b.z],[b.hw*2,top,b.hd*2],colour,{kind:'soft',bevel:.02});};
  {
    const k=dirt(R,.05),b=box(R);
    for(const s of [-1,1])k.box([s*.8,.051,b.z],[.42,.002,b.hd*2],'#97805f',{kind:'soft'});   // the wheel ruts
    k.build(root,'path',{look:'path'});
  }
  for(const p of fields.paths)dirt(p,.05).build(root,'path',{look:'path'});
  dirt(fields.yard,.04,C.yard).build(root,'path',{look:'path'});
  // Stepping stones across the yard to the farmhouse door.
  {
    const H=fields.farmhouse,from=fields.yard.z1-.5,to=H.z+H.depth/2+.7,n=Math.round((from-to)/.75),k=kit(.1);
    for(let i=0;i<=n;i++){const r=seeded(i+5),z=from-(from-to)*i/n;k.add(flag(.34+r()*.06,.27+r()*.05,.07,i+40),[H.x+(r()-.5)*.25,.035,z],[0,r()*60,0],C.stone,'stone');}
    k.build(root,'path',{look:'path'});
  }

  // ── The river 青禾河, its banks and the willows ──────────────────────────────────────────────
  const RV=fields.river,riverMat=water.surface({flow:RV.flow,tile:3.2,ripple:.14,shallow:'#7fa9a0',deep:'#3f6b6a',depth:[0,0,.55,0]});
  sheet(RV,level,.04,riverMat);
  const pier=fields.pier,onPier=(x,z)=>(Math.abs(x)<=pier.walk.x1&&z>=pier.walk.z0&&z<=pier.walk.z1)||(Math.abs(x)<=pier.platform.x1&&z>=pier.platform.z0&&z<=pier.platform.z1);
  // A grassy lip along each bank, stones bedded in it and reeds in clumps.
  for(const [z,face] of [[RV.z0,-1],[RV.z1,1]]){
    const k=kit(.08),reeds=[],tops=[],r=seeded(z);
    k.box([0,.07,z+face*.05],[RV.x1-RV.x0,.14,.6],C.bank,{kind:'soft',bevel:.05});
    for(let x=-60;x<60;x+=2.3/Math.max(.5,lod)){
      const px=x+r()*1.2,pz=z+face*(r()*.25);
      if(face<0&&Math.abs(px)<pier.walk.x1+.4)continue;
      k.add(blob([.22+r()*.12,.1+r()*.05,.16],px*7+z,{seg:6,rings:4,lump:.25,flat:.6}),[px,.08,pz],[0,r()*180,0],r()<.5?C.stone:C.stoneDark,'stone');
      if(r()>.55*lod)continue;
      // A clump of reeds: tall blades leaning out over the water, a few with a brown head.
      for(let b=0;b<5;b++){
        const a=r()*TAU,dir=[Math.cos(a)*.25,1,Math.sin(a)*.25+face*.2],l=Math.hypot(...dir),d=dir.map(v=>v/l),len=.8+r()*.5;
        reeds.push(blade([px+.4,.1,pz],d,[-Math.sin(a),0,Math.cos(a)],len,.05,.9+r()*.2));
        if(b===0)tops.push(tube([px+.4+d[0]*len*.9,.1+d[1]*len*.9,pz+d[2]*len*.9],[px+.4+d[0]*len*1.05,.1+d[1]*len*1.05,pz+d[2]*len*1.05],.022,.018,5));
      }
    }
    if(reeds.length)k.add(join(reeds),[0,0,0],null,C.reed,'soft');
    if(tops.length)k.add(join(tops),[0,0,0],null,C.reedTop,'soft');
    k.build(root,'bank',{look:'grass'});
  }
  water.body('town',[RV,...fields.paddies],level+.02,onPier);
  // On the water: tall guards no one jumps over, round the pier (one structure with it: its corner
  // bollards stand over their edges), and the river's name just above it.
  {
    const G=RV.guard,w=pier.walk,p=pier.platform,east=40;
    for(const s of [{x0:-east,x1:w.x0,z0:RV.z0,z1:p.z0},{x0:w.x1,x1:east,z0:RV.z0,z1:p.z0},{x0:-east,x1:p.x0,z0:p.z0,z1:RV.z1},
      {x0:p.x1,x1:east,z0:p.z0,z1:RV.z1},{x0:p.x0,x1:p.x1,z0:p.z1,z1:RV.z1}])mark({...box(s),y0:-.5,y1:G,name:null,group:'pier'});
    mark({x:0,z:(RV.z0+RV.z1)/2,hw:east,hd:(RV.z1-RV.z0)/2,y0:-.2,y1:level+.12,name:'river',solid:false});
  }
  fields.willows.forEach(([x,z],i)=>{
    buildTree(painted,ent('willow',x,0,z,i*67,'willow'),'willow',x*3+z);
    mark({x,z,radius:.22,y0:0,y1:2.4,name:'willow'});
    mark({x,z,radius:1.5,y0:2.8,y1:4.3,name:'willow'});
  });
  fields.farWillows.forEach(([x,z],i)=>buildTree(painted,ent('willow',x,0,z,i*53,'willow'),'willow',x*5+z));
  fields.trees.forEach(([x,z,kind],i)=>{
    buildTree(painted,ent(kind,x,0,z,i*41,kind),kind,x*7+z);
    mark({x,z,radius:.22,y0:0,y1:2.4,name:kind});
    mark({x,z,radius:1.5,y0:1.55,y1:4.3,name:kind});
  });
  fields.bamboo.forEach(([x,z,r],i)=>{
    buildBamboo(painted,ent('bamboo',x,0,z,0,'bamboo'),r,i+31,7);
    mark({x,z,radius:r*.8,y0:0,y1:4,name:'bamboo'});
  });
  // Wildflowers along the verges of the road out of the gate.
  {
    const k=kit(.08),r=seeded(77),colours=['#f2c94c','#f4f0e6','#e98bb0','#b58ad6'];
    for(let i=0;i<Math.round(26*lod);i++){
      const side=i%2?1:-1,x=side*(2.6+r()*3.5),z=67+r()*9;
      k.add(blob([.05,.04,.05],i,{seg:5,rings:3,lump:.25,flat:.5,under:.85}),[x,.14+r()*.12,z],null,colours[i%colours.length],'soft');
      k.add(blob([.12,.07,.1],i+90,{seg:5,rings:3,lump:.3}),[x,.06,z],null,'#6f9a55','soft');
    }
    k.build(root,'flowers',{look:'flower'});
  }

  // ── 王爷爷's pier, his rods, his basket, the net and the boats ──────────────────────────────────
  {
    const k=kit(.08),top=pier.top,w=pier.walk,p=pier.platform;
    for(let z=w.z0+.15;z<w.z1-.05;z+=.3)k.box([0,top-.03,z],[w.x1-w.x0,.06,.26],C.timber,{kind:'wood',bevel:.01});
    for(let z=p.z0+.15;z<p.z1-.05;z+=.3)k.box([0,top-.03,z],[p.x1-p.x0,.06,.26],C.timber,{kind:'wood',bevel:.01});
    for(const x of [w.x0+.12,w.x1-.12])k.box([x,top-.14,(w.z0+p.z1)/2],[.16,.14,p.z1-w.z0],C.timberDark,{kind:'wood'});   // the stringers
    const post=(x,z,up=0)=>k.box([x,(top+up-.7)/2,z],[.16,top+up+.7,.16],C.timberDark,{kind:'wood',bevel:.02});
    for(let z=RV.z0+.4;z<p.z0;z+=1.3)for(const x of [w.x0,w.x1])post(x,z);
    for(const [x,z] of [[p.x0,p.z0],[p.x1,p.z0],[p.x0,p.z1],[p.x1,p.z1],[0,p.z1]])post(x,z,(x&&z===p.z1)?.45:0);   // the corner posts stand up as bollards
    k.build(root,'pier',{look:'pier',shadows:true});
    mark({...box(w),y0:-.6,y1:top,name:'pier',group:'pier'});
    mark({...box(p),y0:-.6,y1:top,name:'pier',group:'pier'});
    for(const x of [p.x0,p.x1])mark({x,z:p.z1,radius:.12,y0:top,y1:top+.45,name:'pier',group:'pier'});
  }
  // A rod, propped in a forked stick, its line running down to a float; `hook`: hanging at that height instead.
  const rod=(look,[bx,bz],[tx,ty,tz],{hook=null}={})=>{
    const k=kit(.05),y=pier.top,end=hook?[tx,hook,tz]:[tx,level+.03,tz];
    k.add(tube([bx,y+.02,bz],[tx,ty,tz],.024,.008,6),[0,0,0],null,'#6b4f33','wood');
    k.add(tube([tx,ty,tz],end,.004,.004,4),[0,0,0],null,'#e8e2d4');
    if(hook){
      k.add(lathe([[.03,0],[.035,.02],[.03,.04]],8,0,Math.PI*1.4),[tx,hook-.03,tz],[90,0,0],'#a8aeb3');
      k.add(tube([tx+.03,hook-.02,tz],[tx+.03,hook+.06,tz],.006,.006,4),[0,0,0],null,'#a8aeb3');
    } else {
      k.turn([tx,level+.02,tz],[[0,0],[.04,.03],[.035,.06],[0,.07]],'#e8e2d4',{seg:8});
      k.turn([tx,level+.08,tz],[[.035,0],[.02,.05],[0,.06]],'#c8402f',{seg:8});
      k.add(tube([bx+.1,y,bz+.15],[bx+.1,y+.55,bz+.15],.02,.02,5),[0,0,0],null,C.timberDark,'wood');   // the forked stick
    }
    return k.build(root,'rod',{look});
  };
  rod('fishing-rod',fields.wangRod.base,fields.wangRod.tip);
  rod('fishing-rod',fields.spareRod.base,fields.spareRod.tip,{hook:fields.spareRod.hook});
  {
    const [tx,,tz]=fields.spareRod.tip;
    mark({x:tx,z:tz,radius:.12,y0:fields.spareRod.hook-.15,y1:fields.spareRod.hook+.12,name:'fish-hook',solid:false});
  }
  {
    const B=fields.basket,k=kit(.06),y=pier.top;
    basket(k,[B.x,y,B.z],.28,.3,'#c8a66a');
    for(let i=0;i<2;i++)k.add(blob([.06,.05,.17],i+3,{seg:6,rings:4,lump:.05}),[B.x+(i?.07:-.06),y+.27,B.z+(i?.03:-.02)],[0,i*40,12],i?'#c98a4a':'#a9a48c','soft');
    k.build(root,'basket',{look:'basket'});
    mark({x:B.x,z:B.z,radius:.3,y0:y,y1:y+.32,name:'basket',group:'pier'});
  }
  {
    // The net hung out to dry between two bamboo poles, sagging, corks along its foot.
    const N=fields.net,k=kit(.04),strands=[],H=N.height,sag=x=>.35*Math.sin((x-N.x0)/(N.x1-N.x0)*Math.PI);
    for(const x of [N.x0,N.x1])k.add(tube([x,0,N.z],[x,H,N.z],.045,.035,6),[0,0,0],null,C.bamboo,'wood');
    for(let x=N.x0+.1;x<N.x1-.05;x+=.14)strands.push(tube([x,H-.04-sag(x)*.25,N.z],[x,.35-sag(x)*.4,N.z+.02],.006,.006,3));
    for(let y=.4;y<H-.1;y+=.14)for(let x=N.x0;x<N.x1-.01;x+=.3){const a=x,b=Math.min(N.x1,x+.3),f=(y-.35)/(H-.4),ya=y-sag(a)*(.4-.15*f),yb=y-sag(b)*(.4-.15*f);strands.push(tube([a,ya,N.z+.01],[b,yb,N.z+.01],.005,.005,3));}
    k.add(join(strands),[0,0,0],null,'#5b5a4f');
    for(let x=N.x0+.25;x<N.x1;x+=.35)k.add(blob([.05,.035,.035],x*9,{seg:5,rings:3}),[x,.36-sag(x)*.4,N.z+.03],null,'#d9b56a','soft');
    k.add(tube([N.x0,H-.02,N.z],[N.x1,H-.02,N.z],.012,.012,4),[0,0,0],null,'#b9a57a');
    k.build(root,'net',{look:'fishing-net'});
    for(const x of [N.x0,N.x1])mark({x,z:N.z,radius:.1,y0:0,y1:H,name:'fishing-net'});
  }
  for(const b of fields.boats){
    const boat=buildBoat(painted,root,{x:b.x,z:b.z,level,len:b.len,width:b.width,rot:b.rot});
    boat.lookName='small-boat';
  }

  // ── The rice paddies, the scarecrow and the water wheel ──────────────────────────────────────
  const paddyMat=water.surface({flow:[.01,.015],tile:2.2,ripple:.05,shallow:'#93a874',deep:'#5c7046',depth:[0,0,.3,0]});
  const paddy=(s,i,{shoots=true}={})=>{
    const b=box(s),k=kit(.06),r=seeded(i*13+1),rim=.35;
    sheet({x0:s.x0+rim*.6,x1:s.x1-rim*.6,z0:s.z0+rim*.6,z1:s.z1-rim*.6},.05,.03,paddyMat);
    // The bund round it: banked earth with a grassy top.
    for(const [x,z,w,d] of [[b.x,s.z0+rim/2,b.hw*2,rim],[b.x,s.z1-rim/2,b.hw*2,rim],[s.x0+rim/2,b.z,rim,b.hd*2-rim*2],[s.x1-rim/2,b.z,rim,b.hd*2-rim*2]]){
      k.box([x,.09,z],[w,.18,d],C.earth,{kind:'soft',bevel:.05});
      k.box([x,.185,z],[Math.max(.1,w-.08),.02,Math.max(.1,d-.08)],'#86a165',{kind:'soft'});
    }
    if(shoots){
      // Rows of young rice: tufts of two blades, crossed, standing out of the water.
      const rows=[[],[]];
      for(let z=s.z0+.65,row=0;z<s.z1-.55;z+=.55,row++)for(let x=s.x0+.6;x<s.x1-.5;x+=.5){
        if(r()>lod)continue;
        const a=r()*Math.PI,px=x+(r()-.5)*.08,len=.36+r()*.16;
        for(const t of [a,a+Math.PI/2]){
          const lean=[Math.cos(t)*.18,1,Math.sin(t)*.18],l=Math.hypot(...lean);
          rows[row%2].push(blade([px,.06,z],lean.map(v=>v/l),[-Math.sin(t),0,Math.cos(t)],len,.05,.88+r()*.2));
        }
      }
      rows.forEach((list,j)=>list.length&&k.add(join(list),[0,0,0],null,j?C.shootLight:C.shoot,'soft'));
    } else {
      // Far off: the rows as low green stripes.
      for(let z=s.z0+.8,n=0;z<s.z1-.6;z+=.9,n++)k.box([b.x,.1,z],[b.hw*2-1,.07,.16],n%2?C.shoot:C.shootLight,{kind:'soft'});
    }
    return k.build(root,'paddy',{look:'paddy'});
  };
  fields.paddies.forEach((s,i)=>{
    paddy(s,i);
    mark({...box({x0:s.x0+.1,x1:s.x1-.1,z0:s.z0+.1,z1:s.z1-.1}),y0:0,y1:fields.paddyGuard,name:null,group:'paddy'});
  });
  fields.farPaddies.forEach((s,i)=>paddy(s,i+20,{shoots:false}));
  buildScarecrow(painted,ent('scarecrow',fields.scarecrow.x,0,fields.scarecrow.z,fields.scarecrow.rot,'scarecrow'));
  const wheelRoot=buildWheel(painted,root,fields.wheel,level,water,mark);
  entities.push(wheelRoot);

  /** A bamboo fence from (x0, z0) to (x1, z1) along x or z, F metres high, posts every 1.1 m and two
   *  rails; its hitbox is `tall` high. */
  function fence(k,x0,z0,x1,z1,F,tall,group){
    const len=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.round(len/1.1)),along=x1!==x0;
    for(let i=0;i<=n;i++){const u=i/n;k.box([x0+(x1-x0)*u,F/2,z0+(z1-z0)*u],[.06,F,.06],C.bamboo,{kind:'wood',bevel:.01});}
    for(const y of [F*.4,F*.82])k.box([(x0+x1)/2,y,(z0+z1)/2],along?[len,.04,.04]:[.04,.04,len],C.bamboo,{kind:'wood'});
    mark({x:(x0+x1)/2,z:(z0+z1)/2,hw:along?len/2:.06,hd:along?.06:len/2,y0:0,y1:tall,name:null,group});
  }
  // The countryside's east and west edges: a bamboo fence from the park wall down to the river.
  {
    const k=kit(.08);
    for(const e of fields.edges)fence(k,e.x,e.z0,e.x,e.z1,1.1,RV.guard,'edge');
    k.build(root,'edge-fence',{look:'wood'});
  }

  // ── 刘奶奶's vegetable plot ────────────────────────────────────────────────────────────────────
  const plot=fields.plot;
  {
    const b=box(plot);
    kit(0).box([b.x,.0225,b.z],[b.hw*2,.045,b.hd*2],C.soil,{kind:'soft'}).build(root,'plot',{look:'veg-plot'});
    // A low bamboo fence round it, open on the road side.
    const k=kit(.08),G=plot.gate,F=plot.fence,run=(x0,z0,x1,z1)=>fence(k,x0,z0,x1,z1,F,F,'plot');
    run(plot.x0,plot.z0,plot.x1,plot.z0);run(plot.x0,plot.z1,plot.x1,plot.z1);run(plot.x1,plot.z0,plot.x1,plot.z1);
    run(plot.x0,plot.z0,plot.x0,G.z0);run(plot.x0,G.z1,plot.x0,plot.z1);
    k.build(root,'fence',{look:'veg-plot'});
  }
  for(const row of plot.rows){
    const k=buildRow(painted,row,plot,lod);
    k.build(root,row.veg,{look:row.veg,shadows:row.veg==='tomato'||row.veg==='cucumber'});
    mark({x:(plot.bed.x0+plot.bed.x1)/2,z:row.z,hw:(plot.bed.x1-plot.bed.x0)/2,hd:plot.bed.half+.02,y0:0,y1:fields.paddyGuard,name:null,group:'plot'});
  }

  // ── The farmhouse 农舍, its yard, the haystacks and the hens ─────────────────────────────────
  buildFarmhouse(models,root,fields.farmhouse,lamps,mark);
  for(const h of fields.haystacks){
    const k=kit(.08);
    k.add(blob([h.r,h.h*.42,h.r],h.x*3+h.z,{lump:.12,flat:.85,under:.75}),[h.x,h.h*.32,h.z],null,C.straw,'soft');
    k.turn([h.x,h.h*.5,h.z],[[h.r*.82,0],[h.r*.62,h.h*.18],[h.r*.3,h.h*.36],[0,h.h*.46]],C.strawDark,{kind:'soft',seg:12});
    k.add(tube([h.x,h.h*.85,h.z],[h.x+.05,h.h*1.12,h.z],.035,.025,5),[0,0,0],null,C.timberDark,'wood');
    k.build(root,'haystack',{look:'haystack',shadows:true});
    mark({x:h.x,z:h.z,radius:h.r*.95,y0:0,y1:h.h,name:'haystack'});
  }
  {
    const W=fields.woodpile,k=kit(.1);
    k.box([W.x,.06,W.z],[.8,.12,2.8],C.timberDark,{kind:'wood'});
    for(let row=0;row<4;row++)for(let i=0;i<9;i++){const z=W.z-1.2+i*.3+(row%2)*.15;if(z>W.z+1.3)continue;k.add(tube([W.x-.38,.2+row*.2,z],[W.x+.38,.2+row*.2,z],.09,.09,6),[0,0,0],null,i%3?'#8a6a4c':'#a07a55','wood');}
    k.build(root,'woodpile',{look:'wood'});
    mark({x:W.x,z:W.z,hw:.42,hd:1.45,y0:0,y1:1,name:null,group:'farmhouse'});
  }
  {
    const B=fields.bench,k=kit(.06);
    k.box([B.x,.45,B.z],[1.6,.08,.42],C.timber,{kind:'wood',bevel:.015});
    for(const x of [-.6,.6])k.box([B.x+x,.21,B.z],[.1,.42,.36],C.timberDark,{kind:'wood',bevel:.015});
    k.build(root,'bench',{look:'bench'});
    mark({x:B.x,z:B.z,hw:.8,hd:.24,y0:0,y1:.5,name:'bench'});
  }
  const hens=buildHens(painted,root,fields.chickens,fields.haystacks);
  for(const hen of hens){entities.push(hen.e);looks.push({entity:hen.e,name:'chicken',...box(fields.chickens.area),y0:0,y1:.6});}

  // ── The 青禾田园 sign where the road meets the fields ──────────────────────────────────────────
  {
    const S=fields.sign,k=kit(.06);
    for(const s of [-1,1])k.box([S.x+s*1.15,1.1,S.z],[.12,2.2,.12],C.timberDark,{kind:'wood',bevel:.02});
    k.box([S.x,1.62,S.z],[2.46,.78,.05],C.timber,{kind:'wood',bevel:.012});
    k.box([S.x,2.28,S.z],[2.7,.1,.42],P.tile,{kind:'tile',bevel:.02});
    k.box([S.x,2.36,S.z],[2.5,.08,.2],P.ridge,{kind:'tile',bevel:.02});
    k.build(root,'sign-board',{look:'wood',shadows:true});
    models.label(root,S.text,[S.x,1.62,S.z],2.2,.6,'#efe3c4','#4a3a2a');
    for(const s of [-1,1])mark({x:S.x+s*1.15,z:S.z,radius:.1,y0:0,y1:2.2,name:null,group:'sign'});
  }

  buildHills(painted,root,fields.hills);

  // ── Fishing: the float, the line and the rod, shown while someone fishes ─────────────────────
  const gear=new pc.Entity('fishing');gear.noBatch=true;gear.enabled=false;root.addChild(gear);
  const floatE=new pc.Entity('float');gear.addChild(floatE);
  kit(0).turn([0,-.03,0],[[0,0],[.045,.035],[.04,.07],[0,.08]],'#f2ede2',{seg:10}).turn([0,.04,0],[[.04,0],[.024,.06],[0,.075]],'#c8402f',{seg:10}).build(floatE,'float');
  const lineE=new pc.Entity('line');gear.addChild(lineE);
  models.box(lineE,[0,0,-.5],[.008,.008,1],'#efe9dc');   // along −z, which lookAt turns towards the float
  const rodE=new pc.Entity('rod');gear.addChild(rodE);
  models.box(rodE,[0,0,-1.3],[.022,.022,2.6],'#6b4f33');   // along −z from the hand
  const tip=new pc.Vec3(),bob=new pc.Vec3(),up=new pc.Vec3(0,1,0),spot={x:0,z:0,dipped:false};
  const fishing={
    /** Show the gear: the rod from in front of (x, y, z), the float out at fields.json `float`. */
    cast(x,y,z){
      const [fx,fz]=fields.fishingSpot.float;spot.x=fx;spot.z=fz;spot.dipped=false;
      // Held in the right hand: from just ahead and to the right, up and out towards the float.
      const d=Math.hypot(fx-x,fz-z)||1,ax=(fx-x)/d,az=(fz-z)/d,rx=-az,rz=ax;
      rodE.setLocalPosition(x+ax*.7+rx*.32,y+1.0,z+az*.7+rz*.32);
      tip.set(x+ax*3+rx*.15,y+2.15,z+az*3+rz*.15);rodE.lookAt(tip,up);
      gear.enabled=true;water.ripple(fx,fz,1.1);
    },
    dip(){spot.dipped=true;water.ripple(spot.x,spot.z,1.4);},
    clear(){gear.enabled=false;spot.dipped=false;},
  };

  let clock=0;
  app.on('update',dt=>{
    if(!root.enabled||town?.place!=='town')return;
    dt=Math.min(dt,.05);clock+=dt;
    wheelRoot.rotateLocal(0,0,fields.wheel.spin*dt);
    if(gear.enabled){
      // The float rides the ripples, and goes under when a fish takes the bait.
      const y=spot.dipped?level-.06+Math.sin(clock*16)*.012:level+.025+Math.sin(clock*2.3)*.012;
      floatE.setLocalPosition(spot.x,y,spot.z);
      rodE.getWorldTransform().transformPoint(bob.set(0,0,-2.6),tip);
      lineE.setPosition(tip);lineE.lookAt(floatE.getPosition(),up);lineE.setLocalScale(1,1,tip.distance(floatE.getPosition()));
    }
    // The hens only scratch about while someone is near enough to see (RENDER[level].animate).
    const eye=town?.player?.entity.getPosition(),A=box(fields.chickens.area),reach=RENDER[detail()].animate;
    if(eye&&Math.abs(eye.x-A.x)+Math.abs(eye.z-A.z)>reach+A.hw+A.hd)return;
    for(const hen of hens)hen.step(dt,clock);
  });

  const state={picking:false};
  const NAMES=fields.ui,FS=fields.fishingSpot;
  /** What E does out here: fish off the end of the pier, and pick from a row while 刘奶奶 waits. */
  function targets(){
    const list=[{id:'fish',x:FS.x,z:FS.z,radius:FS.radius,label:NAMES.fish.zh,wide:true}];
    if(!state.picking)return list;
    const seen=town?.looking?.id;
    for(const row of plot.rows)for(const x of plot.picks)
      list.push({id:'veg:'+row.veg,x,z:row.z,radius:plot.pickRadius,label:NAMES.pick.zh+' · '+objects.objects[row.veg].zh,wide:true,aimed:seen===row.veg});
    return list;
  }
  return {root,marks,life:{entities,looks},targets,fishing,state};
}

/** A scarecrow 稻草人 in its own frame: a pole and crossbar dressed in an old shirt stuffed with
 *  straw, a sacking head, a red scarf and a 斗笠 (its own name) on top. */
function buildScarecrow(painted,e){
  const k=new Kit(painted,{jitter:.08}),hat=new Kit(painted,{jitter:.05});
  k.add(tube([0,0,0],[0,2.0,0],.05,.04,6),[0,0,0],null,'#7a5c42','wood');
  k.add(tube([-.85,1.45,0],[.85,1.45,0],.035,.035,6),[0,0,0],null,'#7a5c42','wood');
  k.add(blob([.3,.4,.2],5,{lump:.18}),[0,1.2,0],null,C.straw,'soft');
  k.box([0,1.28,0],[.6,.56,.32],'#5d6f86',{kind:'cloth',bevel:.05});
  for(const s of [-1,1]){
    k.box([s*.5,1.45,0],[.52,.2,.22],'#5d6f86',{kind:'cloth',bevel:.04});
    k.add(blob([.12,.1,.1],s+9,{seg:6,rings:4,lump:.35}),[s*.86,1.43,0],null,C.straw,'soft');
    k.box([s*.62,1.2,.02],[.05,.3,.02],'#c8402f',{kind:'cloth',rot:[0,0,s*8]});   // a rag fluttering from the sleeve
  }
  k.add(blob([.08,.12,.08],7,{seg:6,rings:4,lump:.3}),[0,.88,0],null,C.straw,'soft');
  k.add(blob([.2,.22,.19],3,{lump:.08}),[0,1.94,0],null,'#d8c49a','cloth');
  k.box([0,1.74,.02],[.32,.08,.27],'#b8322a',{kind:'cloth',bevel:.03});
  k.build(e,'scarecrow',{shadows:true});
  hat.turn([0,2.05,0],[[0,-.01],[.5,-.01],[.5,-.01],[.48,.02],[.22,.13],[0,.25]],'#c9a861',{kind:'soft',seg:16});
  hat.turn([0,2.1,0],[[.2,0],[.2,.04]],'#7a5c42',{seg:14});
  hat.build(e,'hat',{look:'conical-hat',shadows:true});
}

/** The water wheel 水车 turning in the river: timber frame posts on the bank and in the stream, the
 *  axle, and a flume from the wheel's crown over the bank path, pouring into a paddy. Returns the
 *  wheel (it turns, so it is `noBatch`). */
function buildWheel(painted,root,W,level,water,mark){
  const k=new Kit(painted,{jitter:.08}),{x,y,z,radius:Rw,thickness:T}=W,top=y+Rw+.15;
  for(const pz of [z-T/2-.3,z+T/2+.3]){
    for(const s of [-1,1])k.add(tube([x+s*.55,-.5,pz],[x+s*.08,y+.12,pz],.07,.06,6),[0,0,0],null,'#5a4231','wood');
    k.box([x,y+.1,pz],[.4,.14,.14],'#5a4231',{kind:'wood',bevel:.02});
  }
  k.add(tube([x,y,z-T/2-.42],[x,y,z+T/2+.42],.07,.07,8),[0,0,0],null,'#4e3a2a','wood');
  // The flume: a timber trough on two posts, falling gently from the wheel to the paddy.
  const F=W.flume,a=[x,top,F.z1],b=[x,top-.65,F.z0],len=F.z1-F.z0,tilt=Math.atan2(a[1]-b[1],len)*DEG;
  k.box([x,(a[1]+b[1])/2,(F.z0+F.z1)/2],[.38,.05,len],'#7a5c42',{kind:'wood',rot:[-tilt,0,0]});
  for(const s of [-1,1])k.box([x+s*.18,(a[1]+b[1])/2+.1,(F.z0+F.z1)/2],[.05,.22,len],'#6b4f33',{kind:'wood',rot:[-tilt,0,0]});
  const yAt=pz=>b[1]+(a[1]-b[1])*(pz-F.z0)/len;
  for(const pz of [99.3,96.35]){
    k.box([x,yAt(pz)/2,pz],[.14,yAt(pz),.14],'#5a4231',{kind:'wood',bevel:.02});
    mark({x,z:pz,radius:.12,y0:0,y1:yAt(pz),name:'watermill',group:'watermill'});
  }
  k.build(root,'watermill',{look:'watermill',shadows:true});
  // Water pouring from the flume's end into the paddy below.
  const fall=new pc.Entity('flume-fall');fall.lookName='water';fall.addComponent('render',{type:'box',castShadows:false});
  fall.setLocalPosition(x,(b[1]-.05+level)/2,F.z0-.04);fall.setLocalScale(.24,b[1]-.05-level,.05);root.addChild(fall);
  fall.render.meshInstances[0].material=water.surface({flow:[0,1.3],tile:1.4,fall:true});
  // The wheel itself, in the x–y plane, turning about its axle along z as the current pushes its paddles.
  const wheel=new pc.Entity('water-wheel');wheel.noBatch=true;wheel.lookName='watermill';wheel.setLocalPosition(x,y,z);root.addChild(wheel);
  const w=new Kit(painted,{jitter:.08}),n=12;
  for(let i=0;i<n;i++){
    const t=i/n*TAU,mid=t+Math.PI/n;
    for(const s of [-1,1])w.box([Math.cos(mid)*Rw,Math.sin(mid)*Rw,s*T/2],[2*Rw*Math.sin(Math.PI/n)+.05,.09,.07],'#6b4f33',{kind:'wood',rot:[0,0,mid*DEG+90]});
    w.box([Math.cos(t)*(Rw+.12),Math.sin(t)*(Rw+.12),0],[.34,.05,T+.06],'#7a5c42',{kind:'wood',rot:[0,0,t*DEG]});
  }
  for(let i=0;i<4;i++)for(const s of [-1,1])w.box([0,0,s*(T/2-.02)],[Rw*2,.07,.07],'#5a4231',{kind:'wood',rot:[0,0,i*45]});
  w.turn([0,0,-T/2-.05],[[0,0],[.16,0],[.16,T+.1],[0,T+.1]],'#4e3a2a',{kind:'wood',seg:10,rot:[90,0,0]});
  w.build(wheel,'wheel',{shadows:true});
  mark({x,z,hw:Rw+.2,hd:T/2+.1,y0:y-Rw,y1:y+Rw+.2,name:'watermill',solid:false});
  return wheel;
}

/** One crop row of 刘奶奶's plot as a Kit: its raised bed and the plants on it, by vegetable. */
function buildRow(painted,row,plot,lod){
  const k=new Kit(painted,{jitter:.1}),b=plot.bed,z=row.z,half=b.half,r=seeded(z*31);
  k.box([(b.x0+b.x1)/2,.1,z],[b.x1-b.x0,.2,half*2],C.bed,{kind:'soft',bevel:.06});
  const along=(step)=>{const xs=[];for(let x=b.x0+step/2;x<b.x1;x+=step/Math.min(1,lod+.25))xs.push(x);return xs;};
  const leaf=(at,size,c=C.leaf,seed=1)=>k.add(blob(size,seed,{seg:7,rings:4,lump:.22}),at,[0,r()*180,0],c,'soft');
  const fruit=(at,size,c,rot=null)=>k.add(blob(size,r()*1e3,{seg:6,rings:4,lump:.06,flat:.2,under:.8}),at,rot,c,'soft');
  if(row.veg==='tomato')for(const x of along(.6)){
    k.box([x,.82,z],[.03,1.25,.03],C.bamboo,{kind:'wood'});
    leaf([x,.5,z],[.22,.26,.2],C.leaf,x);leaf([x+.04,.86,z-.02],[.17,.22,.16],C.leafDark,x+1);
    for(let i=0;i<4;i++){const a=r()*TAU;fruit([x+Math.cos(a)*.17,.35+r()*.6,z+Math.sin(a)*.15],[.055,.05,.055],i%3?'#d0452f':'#e07a35');}
  } else if(row.veg==='cucumber'){
    // An A-frame of bamboo canes along the row with the vines climbing it.
    for(const x of along(.9)){
      for(const s of [-1,1])k.add(tube([x,.18,z+s*(half-.05)],[x,1.55,z],.015,.012,4),[0,0,0],null,C.bamboo,'wood');
      for(let i=0;i<3;i++)leaf([x+(r()-.5)*.4,.45+i*.35,z+(r()-.5)*.4],[.17,.12,.16],i%2?C.leaf:'#4f7f3d',x*3+i);
      for(let i=0;i<2;i++){const cx=x+(r()-.5)*.5,cz=z+(r()-.5)*.3,cy=.6+r()*.5;k.add(tube([cx,cy,cz],[cx+.02,cy-.28,cz+.01],.032,.026,6),[0,0,0],null,'#3f6b2f','soft');}
      fruit([x+.1,1.1,z+.1],[.03,.025,.03],'#e8c83a');
    }
    k.add(tube([b.x0,1.55,z],[b.x1,1.55,z],.015,.015,4),[0,0,0],null,C.bamboo,'wood');
  } else if(row.veg==='cabbage')for(const x of along(.55)){
    leaf([x,.24,z],[.25,.13,.24],'#6d9a4b',x);
    k.add(blob([.15,.27,.15],x*5,{seg:7,rings:5,lump:.08,flat:.3,under:.85}),[x,.42,z],[0,r()*90,0],'#c3d99a','soft');
  } else if(row.veg==='carrot')for(const x of along(.3)){
    k.turn([x,.19,z+(r()-.5)*.2],[[.035,0],[.03,.04],[0,.05]],'#e0782f',{seg:6});
    const tops=[];
    for(let i=0;i<3;i++){const a=r()*TAU,d=[Math.cos(a)*.35,1,Math.sin(a)*.35],l=Math.hypot(...d);tops.push(blade([x,.22,z],d.map(v=>v/l),[-Math.sin(a),0,Math.cos(a)],.3+r()*.08,.07,.9+r()*.2));}
    k.add(join(tops),[0,0,0],null,'#5f9a45','soft');
  } else if(row.veg==='aubergine')for(const x of along(.6)){
    leaf([x,.48,z],[.26,.3,.22],'#4f7a3f',x);
    for(let i=0;i<3;i++){const a=r()*TAU;fruit([x+Math.cos(a)*.2,.3+r()*.25,z+Math.sin(a)*.17],[.05,.13,.05],'#4b2d5c',[r()*20,0,r()*30-15]);}
  } else if(row.veg==='spring-onion')for(const x of along(.3)){
    const stalks=[],bases=[];
    for(let i=0;i<4;i++){
      const dx=(r()-.5)*.12,dz=(r()-.5)*.25,h=.4+r()*.2,lean=(r()-.5)*.12;
      bases.push(tube([x+dx,.18,z+dz],[x+dx,.3,z+dz],.016,.015,5));
      stalks.push(tube([x+dx,.3,z+dz],[x+dx+lean,.3+h,z+dz+lean],.014,.006,5));
    }
    k.add(join(bases),[0,0,0],null,'#e8ead8','soft');k.add(join(stalks),[0,0,0],null,'#6fa84a','soft');
  }
  return k;
}

/** The farmhouse 农舍 (fields.json `farmhouse`, its front to +z): white plaster on a bluestone plinth,
 *  a curved dark tile roof between stepped gable walls (马头墙), a timber door with red couplet
 *  paper (no characters) and lattice windows that glow after dark, a 斗笠 and dried chillies
 *  hanging under the eave, and a chimney. Built in town coordinates. */
function buildFarmhouse(models,root,H,lamps,mark){
  const {x:cx,z:cz,width:W,depth:D,height:Ht}=H,f=cz+D/2,b=cz-D/2,t=.3,plinth=.3;
  const kit=(j=.06)=>new Kit(models.painted,{jitter:j}),walls=kit(.03),stone=kit(.08),roof=kit(.05),door=kit(.05),frames=kit(.05),paper=kit(0),deco=kit(.08);
  const plaster='#eee9de',lit=models.glow('#f3dcae');lamps.push(lit);
  walls.box([cx,(plinth+Ht)/2,cz],[W-2*t,Ht-plinth,D],plaster,{kind:'plaster',bevel:.03,ground:.12});
  stone.box([cx,plinth/2,cz],[W+.12,plinth,D+.12],P.bluestone,{kind:'stone',bevel:.025});
  // The end walls run past front and back and step up above the roof in three tiers, each capped in tile.
  const reach=D/2+.6,top=Ht+.44*reach,ends=[[D/2+.45,Ht+.6],[D/2-.7,Ht+1.15],[D/2-1.85,Ht+1.9]];
  for(const s of [-1,1]){
    const x=cx+s*(W/2-t/2);
    walls.box([x,(plinth+Ht)/2,cz],[t,Ht-plinth,D+.9],plaster,{kind:'plaster',bevel:.03,ground:.12});
    stone.box([x,plinth/2,cz],[t+.1,plinth,D+1],P.bluestone,{kind:'stone',bevel:.02});
    for(const [ext,y] of ends){
      walls.box([x,(Ht+y)/2,cz],[t,y-Ht,ext*2],plaster,{kind:'plaster',bevel:.02});
      roof.box([x,y+.07,cz],[t+.22,.14,ext*2+.18],P.tile,{kind:'tile',bevel:.02});
      for(const e of [-1,1])roof.box([x,y+.17,cz+e*(ext+.02)],[t+.16,.08,.26],P.ridge,{kind:'tile',bevel:.02,rot:[e*-18,0,0]});
    }
  }
  const rs=roofShape({w:W-2*t+.06,reach,top,eave:Ht+.06,thick:.14});
  roof.add(rs.tiles,[cx,0,cz],null,P.tile,'tile');roof.add(rs.under,[cx,0,cz],null,P.timber,'wood');roof.add(rs.edges,[cx,0,cz],null,P.ridge);
  roof.box([cx,top+.07,cz],[W-2*t,.16,.24],P.ridge,{kind:'tile',bevel:.03});
  for(const s of [-1,1])roof.box([cx+s*(W/2-t-.25),top+.16,cz],[.4,.1,.2],P.ridge,{kind:'tile',bevel:.02,rot:[0,0,s*-22]});
  // The door: two timber leaves in a granite frame, a sill and a step; couplet paper either side.
  const dw=1.5,dh=2.15;
  for(const s of [-1,1]){
    door.box([cx+s*dw/4,(plinth+dh)/2,f+.02],[dw/2-.03,dh-plinth,.06],P.timber,{kind:'wood',bevel:.01});
    door.box([cx+s*dw/4,(plinth+dh)/2,f+.06],[dw/2-.2,dh-plinth-.3,.02],P.redwood,{kind:'wood'});
    stone.box([cx+s*(dw/2+.09),(plinth+dh+.18)/2,f+.05],[.18,dh+.18-plinth,.12],P.granite,{kind:'stone',bevel:.02});
    deco.box([cx+s*(dw/2+.36),1.4,f+.015],[.26,1.45,.02],'#b8322a',{kind:'paper'});
  }
  stone.box([cx,dh+.09,f+.06],[dw+.36,.18,.14],P.granite,{kind:'stone',bevel:.02});
  deco.box([cx,dh+.38,f+.015],[1.2,.26,.02],'#b8322a',{kind:'paper'});
  stone.box([cx,.11,f+.32],[dw+.6,.22,.5],P.granite,{kind:'stone',bevel:.02});
  // Lattice windows either side, on granite sills under little tiled ledges, and one at the back.
  for(const s of [-1,1]){
    const x=cx+s*(W/2-2.1);
    latticeWindow(frames,paper,x,1.7,f,1.1,1.0,{paper:lit});
    stone.box([x,1.12,f+.06],[1.4,.08,.14],P.granite,{kind:'stone',bevel:.015});
    roof.box([x,2.42,f+.12],[1.5,.05,.28],P.tile,{kind:'tile',rot:[22,0,0]});
  }
  latticeWindow(frames,paper,cx-1.6,1.8,b,.9,.8,{paper:lit,dir:-1});
  // Dried chillies hanging from the eave, and the chimney on the back slope.
  {
    const x=cx-(dw/2+.95);
    deco.box([x,Ht-.15,f+.35],[.03,.3,.03],'#6b4f33');
    for(let i=0;i<14;i++){const a=i*2.4,y=Ht-.38-i*.075;deco.turn([x+Math.cos(a)*.07,y,f+.35+Math.sin(a)*.07],[[.025,0],[.02,.06],[0,.12]],'#b8322a',{seg:5,rot:[180,0,0]});}
  }
  walls.box([cx+W/2-1.4,top-.25,cz-1.1],[.5,1.5,.5],plaster,{kind:'plaster',bevel:.02});
  roof.box([cx+W/2-1.4,top+.55,cz-1.1],[.66,.1,.66],P.tile,{kind:'tile',bevel:.02});
  walls.build(root,'farmhouse',{look:'farmhouse',shadows:true});stone.build(root,'farmhouse-stone',{look:'farmhouse',shadows:true});
  roof.build(root,'farmhouse-roof',{look:'roof',shadows:true});door.build(root,'farmhouse-door',{look:'door'});
  frames.build(root,'farmhouse-windows',{look:'window'});paper.build(root,'farmhouse-paper',{look:'window'});deco.build(root,'farmhouse-dressing');
  // A 斗笠 hung on the wall by the door.
  const hat=kit(.05);
  hat.turn([cx+dw/2+1.0,1.9,f+.02],[[0,0],[.36,0],[.36,0],[.34,.02],[.16,.1],[0,.18]],'#c9a861',{kind:'soft',seg:14,rot:[90,0,0]});
  hat.build(root,'hat',{look:'conical-hat'});
  mark({x:cx,z:cz,hw:W/2+.06,hd:D/2+.5,y0:0,y1:top+.3,name:'farmhouse',group:'farmhouse'});
  mark({x:cx+W/2-1.4,z:cz-1.1,hw:.3,hd:.3,y0:top-.6,y1:top+.6,name:'chimney',solid:false});
}

/** The hens pecking about the yard (fields.json `chickens`): each strolls to a spot, stops, pecks
 *  and moves on, keeping clear of the haystacks. Each is `noBatch`; town.js batches them together. */
function buildHens(painted,root,H,stacks){
  const r=seeded(91),A=H.area,colours=[['#f2ede2','#e6dccb'],['#a8693e','#8a5432'],['#c9a77a','#b08d60']];
  const free=(x,z)=>stacks.every(s=>Math.hypot(x-s.x,z-s.z)>s.r+.4);
  const spotIn=()=>{for(let i=0;i<20;i++){const x=A.x0+r()*(A.x1-A.x0),z=A.z0+r()*(A.z1-A.z0);if(free(x,z))return [x,z];}return [(A.x0+A.x1)/2,(A.z0+A.z1)/2];};
  return Array.from({length:H.count},(_,i)=>{
    const [body,wing]=colours[i%colours.length],e=new pc.Entity('chicken');e.noBatch=true;root.addChild(e);
    const k=new Kit(painted,{jitter:.05});
    k.add(blob([.15,.13,.2],i+1,{lump:.08,flat:.3}),[0,.24,0],null,body,'soft');
    k.add(blob([.06,.08,.14],i+7,{seg:6,rings:4,lump:.1}),[0,.26,0],[0,0,0],wing,'soft');
    k.box([0,.34,-.17],[.09,.16,.07],wing,{kind:'soft',bevel:.03,rot:[-28,0,0]});
    for(const s of [-1,1])k.box([s*.05,.07,.01],[.022,.15,.022],'#d9a53a');
    k.build(e,'hen');
    const head=new pc.Entity('head');head.setLocalPosition(0,.32,.14);e.addChild(head);
    const h=new Kit(painted,{jitter:.04});
    h.add(blob([.06,.075,.065],i+3,{seg:6,rings:4,lump:.05}),[0,.06,.03],null,body,'soft');
    h.box([0,.14,.03],[.02,.05,.07],'#c8302a');h.box([0,.06,.1],[.025,.022,.05],'#e0a23a');h.box([0,.02,.08],[.018,.04,.02],'#c8302a');
    h.build(head,'hen-head');
    const [x,z]=spotIn(),hen={e,head,x,z,to:spotIn(),wait:r()*3,heading:r()*TAU,phase:r()*10};
    e.setLocalPosition(x,0,z);
    hen.step=(dt,clock)=>{
      if(hen.wait>0){
        hen.wait-=dt;
        // Peck, peck: the head dips to the ground now and then while she stands.
        const p=Math.max(0,Math.sin((clock+hen.phase)*5));
        head.setLocalEulerAngles(p>.6?55:0,0,0);
        if(hen.wait<=0)hen.to=spotIn();
        return;
      }
      const dx=hen.to[0]-hen.x,dz=hen.to[1]-hen.z,d=Math.hypot(dx,dz);
      if(d<.1){hen.wait=1.5+r()*4;return;}
      const s=Math.min(d,H.speed*dt);hen.x+=dx/d*s;hen.z+=dz/d*s;hen.heading=Math.atan2(dx,dz);
      e.setLocalPosition(hen.x,Math.abs(Math.sin((clock+hen.phase)*14))*.02,hen.z);
      e.setLocalEulerAngles(0,hen.heading*DEG,0);head.setLocalEulerAngles(Math.sin(clock*14)*8,0,0);
    };
    return hen;
  });
}
