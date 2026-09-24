import * as pc from 'playcanvas';

/**
 * 词语馆 from outside: a temple-style academy at the north of the square, facing the fountain.
 * A paifang with the 学海无涯 plaque, a forecourt with two stone lions, a white terrace with a
 * wide staircase, and on it the main hall (red columns, lattice doors, a double-eaved golden
 * roof, the 词语馆 plaque under the upper eave) between two single-eaved side halls — reading
 * room west, study room east. Built from the `practice-house` entry in world.json: its footprint
 * is the main hall's, its `wings` are the side halls, `sign` and `paifang` the two plaques.
 * Returns the collision and name marks for the town registry, all sharing the building's group.
 */
const C={terrace:'#e6e1d6',terraceLip:'#d6d0c2',base:'#b9b09a',stone:'#c9c0a8',lion:'#bdb7a9',
  lionDark:'#a39d8f',red:'#a8392e',beam:'#b8472f',gold:'#d6a843',plaque:'#3d4f47',ink:'#e8c46a',
  paving:'#d8cdb2',door:'#6e2a20',pane:'#7a3a2c'};
const RISE=.3,TREAD=.45,TOP=1.2;          // four rises of 0.3 up to the terrace

export function buildWordHall(models,parent,b,lamps){
  const {box,cylinder,ball,label,redLantern,tiledRoof,latticeWindow,walkway}=models;
  // The complex stands at the entry's position (so the layout editor can move it like any
  // building); its parts are drawn in world coordinates inside a child that cancels that offset.
  const hall=new pc.Entity('wordhall');hall.setLocalPosition(b.x,0,b.z);parent.addChild(hall);
  const root=new pc.Entity('wordhall-parts');root.setLocalPosition(-b.x,0,-b.z);hall.addChild(root);
  root.lamps=lamps;          // redLantern lights its lanterns through the town's lamp list
  const marks=[],group=b.id;
  const mark=(x,z,hw,hd,y0,y1,name=null,solid=true)=>marks.push({x,z,hw,hd,y0,y1,name,solid,group});
  const disc=(x,z,radius,y0,y1,name)=>marks.push({x,z,radius,y0,y1,name,solid:true,group});

  // The main hall's footprint: columns along the front, walls set back behind them.
  const X=b.x,front=b.z+b.depth/2,back=b.z-b.depth/2,W=b.width;
  const colZ=front-.5,wallZ=front-2,H1=TOP+5.4;          // eave of the lower roof
  const T0=front+1.1,T1=back-.2,TX=W/2+4.5;              // the terrace: z T0..T1, x ±TX
  const stairsFront=T0+(TOP/RISE-1)*TREAD,SW=4;          // stairs x ±SW
  const PZ=stairsFront+3.55;                             // the paifang, about z -10.5

  // --- the paifang: three bays, the middle one taller, the plaque over the path ---
  for(const [x,top] of [[-4,4.9],[-1.6,6],[1.6,6],[4,4.9]]){
    box(root,[X+x,.3,PZ],[.8,.6,.8],C.stone);
    box(root,[X+x,top/2,PZ],[.42,top,.42],C.beam);
    mark(X+x,PZ,.4,.4,0,top,'paifang');
  }
  box(root,[X,4.3,PZ],[3.6,.3,.36],C.beam);box(root,[X,5.45,PZ],[3.8,.3,.4],C.beam);
  label(root,b.paifang,[X,4.87,PZ+.05],2.6,.72,C.plaque,C.ink);
  tiledRoof(root,X,PZ,3.8,.9,5.6,b.roof,3);
  for(const s of [-1,1]){
    box(root,[X+s*2.8,3.45,PZ],[2.6,.28,.34],C.beam);
    box(root,[X+s*2.8,3.1,PZ],[2.2,.36,.12],C.gold).lookName='paifang';
    tiledRoof(root,X+s*2.8,PZ,2.4,.8,3.9,b.roof,3);
  }
  mark(X,PZ,4.4,.8,3.1,6.5,'paifang');          // the beams and roofs, high enough to walk under

  // --- the forecourt and its two lions ---
  box(root,[X,.03,(PZ+stairsFront)/2],[10,.06,stairsFront-PZ+1],C.paving);
  const lionZ=stairsFront+1.15;
  for(const s of [-1,1]){
    const x=X+s*3.1;
    box(root,[x,.35,lionZ],[1.0,.7,1.3],C.lionDark);
    box(root,[x,1.0,lionZ-.2],[.7,.6,.8],C.lion);                 // haunches
    box(root,[x,1.25,lionZ+.2],[.62,1.1,.5],C.lion);              // chest and forelegs
    ball(root,[x,1.95,lionZ+.18],[.86,.8,.72],C.lionDark);        // the mane
    ball(root,[x,1.95,lionZ+.42],[.56,.52,.4],C.lion);            // the face
    ball(root,[x-s*.3,.88,lionZ+.5],[.34,.34,.34],C.lion);        // a ball under one paw
    mark(x,lionZ,.5,.65,0,2.35,'lion');
  }

  // --- the terrace, its staircase and balustrades ---
  const TZ=(T0+T1)/2,TD=T0-T1;
  box(root,[X,TOP/2,TZ],[TX*2,TOP,TD],C.terrace);
  box(root,[X,.13,TZ],[TX*2+.3,.26,TD+.3],C.base);
  box(root,[X,TOP-.05,TZ],[TX*2+.16,.12,TD+.16],C.terraceLip);
  mark(X,TZ,TX,TD/2,0,TOP);
  for(let k=1;k*RISE<TOP-1e-6;k++){
    const z0=T0+(TOP/RISE-k)*TREAD,top=k*RISE;
    box(root,[X,top/2,(z0+T0)/2],[SW*2,top,z0-T0],k%2?C.terraceLip:C.terrace);
    mark(X,(z0+T0)/2,SW,(z0-T0)/2,0,top,'step');
    for(const s of [-1,1]){                      // the stone cheeks either side of the stairs
      box(root,[X+s*(SW+.3),(top+.45)/2,z0-TREAD/2],[.6,top+.45,TREAD],C.terraceLip).lookName='stone';
      mark(X+s*(SW+.3),z0-TREAD/2,.3,TREAD/2,0,top+.45);
    }
  }
  const rail=(x0,z0,x1,z1)=>{
    const cx=(x0+x1)/2,cz=(z0+z1)/2,len=Math.hypot(x1-x0,z1-z0),alongX=Math.abs(x1-x0)>Math.abs(z1-z0);
    for(const y of [TOP+.15,TOP+.72])box(root,[cx,y,cz],alongX?[len,.12,.16]:[.16,.12,len],C.terraceLip).lookName='railing';
    const n=Math.max(1,Math.round(len/1.4));
    for(let i=0;i<=n;i++)box(root,[x0+(x1-x0)*i/n,TOP+.42,z0+(z1-z0)*i/n],[.2,.84,.2],C.terrace).lookName='railing';
    mark(cx,cz,alongX?len/2:.12,alongX?.12:len/2,TOP,TOP+.8);
  };
  const edge=TX-.12;
  for(const s of [-1,1]){
    rail(X+s*(SW+.6),T0-.12,X+s*edge,T0-.12);
    rail(X+s*edge,T0-.12,X+s*edge,T1+.12);
  }
  rail(X-edge,T1+.12,X+edge,T1+.12);

  // --- the main hall: walls, lattice doors, the colonnade ---
  const bodyZ=(wallZ+back)/2,bodyD=wallZ-back;
  box(root,[X,(TOP+H1)/2,bodyZ],[W,H1-TOP,bodyD],b.color);
  box(root,[X,TOP+.35,bodyZ],[W+.1,.7,bodyD+.1],C.stone);            // a stone dado
  mark(X,bodyZ,W/2,bodyD/2,0,H1,b.object);
  const bays=[0,-2.5,2.5,-5,5,-7.5,7.5];
  // The centre bay is the entrance door (already named by the legacy mark below); the rest are
  // plain lattice windows.
  for(const x of bays){
    const win=latticeWindow(root,X+x,TOP+1.85,wallZ+.06,x?2.0:2.2,3.3,x?C.pane:C.door);
    if(x)win.lookName='window';
  }
  mark(X,wallZ+.2,1.1,.16,TOP,TOP+3.5,'door',false);
  for(const x of [-8.75,-6.25,-3.75,-1.25,1.25,3.75,6.25,8.75]){
    cylinder(root,[X+x,TOP+.12,colZ],[.74,.24,.74],C.stone);
    cylinder(root,[X+x,(TOP+H1)/2,colZ],[.52,H1-TOP,.52],C.red);
    box(root,[X+x,H1-.25,colZ],[.72,.3,.72],C.gold);
    disc(X+x,colZ,.3,TOP,H1,'pillar');
  }
  box(root,[X,H1-.12,colZ],[W+.4,.36,.44],C.beam).lookName='beam';
  box(root,[X,H1-.42,colZ+.02],[W,.12,.42],C.gold).lookName='beam';
  let lit=null;              // one glow shared by all four lanterns
  for(const x of [-5,-2.5,2.5,5]){
    lit=redLantern(root,X+x,H1-1.2,colZ,lit);
    mark(X+x,colZ,.25,.25,H1-1.5,H1-.7,'lantern',false);
  }

  // --- the double-eaved golden roof and the 词语馆 plaque under the upper eave ---
  const roofZ=b.z,roofD=b.depth-.6;
  tiledRoof(root,X,roofZ,W+.6,roofD,H1,b.roof,3);
  mark(X,roofZ,(W+.6)/2+.65,roofD/2+.75,H1,H1+.25,'roof');   // the eave's full-depth bottom layer
  const UW=W-5,UD=8,H2=H1+4,upFront=roofZ+UD/2;
  box(root,[X,(H1+H2)/2,roofZ],[UW,H2-H1,UD],b.color);
  box(root,[X,H2-.2,upFront+.02],[UW+.1,.3,.1],C.gold);
  mark(X,roofZ,UW/2,UD/2,H1,H2,b.object);
  for(const x of [-4.9,-2.6,2.6,4.9])latticeWindow(root,X+x,H1+1.5,upFront+.06,1.3,1.1,C.pane).lookName='window';
  box(root,[X,H1+3,upFront+.04],[3.8,1.3,.08],C.gold);
  label(root,b.sign,[X,H1+3,upFront+.1],3.5,1.05,C.plaque,C.ink);
  mark(X,upFront+.1,1.9,.12,H1+2.3,H1+3.7,'plaque',false);
  tiledRoof(root,X,roofZ,UW,UD,H2,b.roof,13);
  mark(X,roofZ,UW/2+.65,UD/2+.75,H2,H2+3,'roof');

  // --- the side halls: reading room west, study room east ---
  for(const wg of b.wings??[]){
    const x=X+wg.x,z=b.z+wg.z,top=TOP+wg.height,f=z+wg.depth/2;
    box(root,[x,(TOP+top)/2,z],[wg.width,wg.height,wg.depth],b.color);
    latticeWindow(root,x,TOP+2,f+.06,1.6,1.6,C.pane).lookName='window';
    box(root,[x,TOP+.35,f+.04],[wg.width+.05,.7,.08],C.stone);
    tiledRoof(root,x,z,wg.width,wg.depth,top,b.roof,4);
    mark(x,z,wg.width/2,wg.depth/2,0,top+1,'wall');
  }

  // --- covered corridors on the terrace, linking each side hall's front to the colonnade ---
  for(const wg of b.wings??[]){
    const s=Math.sign(wg.x),z=b.z+wg.z+wg.depth/2+1.2,inner=X+s*(W/2+.4),outer=X+wg.x+s*(wg.width/2-.4);
    marks.push(...walkway(root,{x0:inner,x1:outer,z0:z,z1:z,width:2,y:TOP,group},lamps).marks);
  }

  return {root:hall,marks};
}
