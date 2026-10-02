import * as pc from 'playcanvas';
import data from '../content/people.json' with {type:'json'};
import {lathe} from './jiangnan.js';
import {detail} from '../core/quality.js';

/**
 * Everybody, as the reference sheets draw them (task W5-people): the tourist from
 * docs/references/wave4/character-turnaround.webp, Yunhai's people from character-lineup.webp and
 * Qinghe's from character-village-lineup.webp. src/content/people.json holds the builds measured off
 * the sheets, the archetypes with their clothes, hair, hats, extras, props and colour variants, and
 * who you meet where (`mixes`); this module knows how each of those is shaped.
 *
 * A person is eight merged meshes (models.js `blocks`), each one draw call, all in one shared
 * vertex-colour material so a crowd batches: the body with its clothes, collar, belt or sash and
 * anything carried on it (`upper`, which a first-person camera hides); each arm with its sleeve, hand
 * and anything held; each leg with its trousers and shoe; the head with its hair, ears, nose, brows,
 * hat and glasses; the eyes, which blink by squashing; and the mouth, which smiles by opening. The
 * pivots and names are the ones idle.js, the walk, sitting and Town.equip have always used.
 */

const HEAD=data.head;
const hash=seed=>typeof seed==='string'?[...seed].reduce((a,c)=>Math.imul(a^c.codePointAt(0),16777619),2166136261):seed|0;
/** The k-th of n choices from a seed's hash; seed 0 always takes the first. */
function pick(h,k,n){
  if(!h)return 0;
  let x=h+Math.imul(k+1,0x9e3779b9);x^=x>>>16;x=Math.imul(x,0x85ebca6b);x^=x>>>13;x=Math.imul(x,0xc2b2ae35);x^=x>>>16;
  return (x>>>0)%n;
}

/**
 * Hair, in a grown-up's head's metres on the neck pivot (the chin): [position, size, shade, turn].
 * The head box is .44 wide, .45 high and .42 deep, its face at z .21; a smaller head scales it all.
 */
// The sides: above the ears, and on down behind them to the jaw.
const sides=(y=.35,z=-.085,h=.2,d=.3)=>[[[-.234,y,z],[.052,h,d]],[[.234,y,z],[.052,h,d]],[[-.234,.18,-.17],[.052,.15,.13]],[[.234,.18,-.17],[.052,.15,.13]]];
const burns=(y=.225)=>[[[-.222,y,.035],[.024,.1,.04]],[[.222,y,.035],[.024,.1,.04]]];
const back=(y=.285,h=.33)=>[[0,y,-.225],[.5,h,.05]];
export const HAIR={
  // The tourist: a raised top over a straight fringe, the sides cut short, sideburns.
  quiff:[[[0,.475,-.005],[.412,.07,.4]],[[0,.49,.13],[.4,.055,.16],1.06],back(),...sides(),[[0,.41,.22],[.42,.08,.04]],...burns()],
  // Full and swept up off the forehead in big grey chunks, past the head at the temples (grandpa).
  swept:[[[0,.42,-.02],[.5,.14,.47],1,0,.065],[[0,.465,.12],[.44,.12,.18],1.06,[-20,0,0],.04],[[-.13,.49,-.02],[.24,.08,.32],.97,[0,0,12],.035],
    [[.13,.485,-.04],[.24,.08,.32],1.03,[0,0,-10],.035],[[0,.47,-.15],[.42,.09,.18],.94,[14,0,0],.035],[[0,.28,-.235],[.5,.36,.06]],
    [[-.258,.33,-.05],[.07,.22,.36],.93,0,.03],[[.258,.33,-.05],[.07,.22,.36],.93,0,.03],[[-.24,.18,-.17],[.05,.15,.13]],[[.24,.18,-.17],[.05,.15,.13]],
    [[0,.405,.205],[.4,.05,.05]],...burns(.25)],
  // Full grey hair with a fringe swept across and a bun high on one side at the back (grandma, auntie).
  bun:[[[0,.42,-.02],[.5,.14,.48],1,0,.065],[[-.03,.42,.19],[.44,.1,.1],1,[0,0,6],.035],[[.12,.46,.04],[.24,.08,.3],1.04,[0,0,-10],.035],
    [[-.26,.3,-.04],[.07,.28,.4],1,0,.03],[[.26,.3,-.04],[.07,.28,.4],1,0,.03],[[0,.27,-.24],[.5,.38,.06]],
    [[-.2,.47,-.06],[.21,.19,.21],1.04,[0,0,-18],.065],[[-.15,.42,-.07],[.1,.05,.13],.88,[0,0,-18]]],
  // A bob below the chin, a fringe swept across, one ear tucked behind (young woman).
  bob:[[[0,.44,-.01],[.47,.15,.46],1,0,.065],[[.25,.2,-.02],[.07,.52,.42],1,[0,0,10]],[[.275,.02,-.02],[.08,.12,.42],.96,[0,0,14]],
    [[-.25,.2,-.18],[.07,.52,.14],1,[0,0,-10]],[[-.275,.02,-.18],[.08,.12,.14],.96,[0,0,-14]],[[-.245,.27,.15],[.06,.36,.12],1,[0,0,-6]],
    [[0,.2,-.235],[.52,.5,.06]],[[-.07,.4,.215],[.32,.12,.04],1,[0,0,-10]],[[.13,.43,.21],[.17,.06,.04]]],
  // A thick mop in chunks swept up and across, a lock over the forehead, short at the back (young man).
  spiky:[[[0,.43,-.01],[.5,.13,.48],1,0,.045],[[-.09,.46,.19],[.3,.12,.1],1.03,[0,0,14],.035],[[.1,.49,.02],[.3,.09,.32],1.06,[0,0,-12],.035],
    [[-.05,.48,-.12],[.32,.09,.24],.95,[12,0,8],.035],[[.21,.45,-.02],[.12,.12,.3],.97,[0,0,-25],.035],
    [[-.255,.34,-.06],[.07,.2,.34],1,0,.03],[[.255,.34,-.06],[.07,.2,.34],1,0,.03],[[-.24,.18,-.17],[.05,.15,.13]],[[.24,.18,-.17],[.05,.15,.13]],
    back(.28,.34),...burns()],
  // A straight fringe down to the brows and two big bunches tied high at the sides (girl). The ties are `tie`.
  pigtails:[[[0,.44,-.01],[.49,.13,.47],1,0,.045],...sides(.33,-.05,.25,.34),back(.28,.34),
    [[0,.385,.215],[.44,.13,.045]],[[-.33,.4,-.04],[.17,.23,.16],1,[0,0,-38],.04],[[.33,.4,-.04],[.17,.23,.16],1,[0,0,38],.04],
    [[-.38,.29,-.04],[.14,.14,.14],.94,[0,0,-22],.04],[[.38,.29,-.04],[.14,.14,.14],.94,[0,0,22],.04],
    [[-.25,.46,-.04],[.07,.1,.1],'tie'],[[.25,.46,-.04],[.07,.1,.1],'tie']],
  // Tufts sticking up every way over a short back and sides (boy).
  tufts:[[[0,.43,-.01],[.49,.12,.47],1,0,.04],[[-.16,.475,.05],[.14,.1,.18],1,[0,0,26],.03],[[-.03,.495,.08],[.15,.1,.19],1.06,[0,0,8],.03],
    [[.1,.49,.03],[.14,.1,.18],1,[0,0,-18],.03],[[.21,.46,0],[.12,.1,.16],.95,[0,0,-40],.03],[[0,.475,-.13],[.24,.09,.2],.95,[18,0,0],.03],
    [[-.1,.42,.21],[.2,.08,.06],1,[0,0,15]],[[.1,.42,.21],[.18,.08,.06],1,[0,0,-12]],...sides(.35,-.07,.2,.32).map(([at,size])=>[at,[.06,...size.slice(1)]]),back(.28,.34),...burns()],
  // Parted on the left and combed across (陈叔叔).
  side:[[[0,.475,-.01],[.46,.07,.44]],[[-.15,.505,0],[.14,.05,.42],.96],[[.07,.515,0],[.3,.07,.42],1.04,[0,0,-3]],
    [[.04,.42,.215],[.38,.07,.04],1,[0,0,-5]],[[-.17,.43,.21],[.08,.05,.035]],...sides(),back(),...burns()],
  // Short all over (周叔叔, and under a straw hat).
  short:[[[0,.47,-.01],[.45,.06,.43]],...sides(.36,-.07,.18,.3),[[0,.29,-.224],[.49,.32,.05]],[[0,.42,.21],[.42,.06,.035]],...burns()],
};

/**
 * Who someone is, from a seed (a number or a name) and what the caller chose: their archetype (the
 * caller's, or a weighted pick from a mix, Qinghe's townsfolk unless told otherwise), a colour variant
 * of it, their skin, hair style and whether they carry their things. The same seed is always the same
 * person; seed 0 is the first of everything. `chosen` (npcs.json `look` and the like): {archetype,
 * mix, style, hair, top, hat:false, props}; a style or archetype that does not exist is ignored.
 */
export function personLook(seed=0,chosen={}){
  const h=hash(seed),mix=data.mixes[chosen.mix]??data.mixes.village;
  let id=chosen.archetype;
  if(!data.archetypes[id]){
    const weights=Object.entries(mix.weights);let r=pick(h,0,weights.reduce((n,[,w])=>n+w,0));
    id=weights.find(([,w])=>(r-=w)<0)[0];
  }
  const a=data.archetypes[id],colours={...data.colours,skin:data.skins[pick(h,2,data.skins.length)],...a.colours[pick(h,1,a.colours.length)]};
  if(chosen.hair)colours.hair=chosen.hair;
  if(chosen.top)colours.top=chosen.top;
  colours.brows??=colours.hair;
  return {archetype:id,build:a.build,style:HAIR[chosen.style]?chosen.style:a.hair,hair:colours.hair,skin:colours.skin,colours,
    hat:chosen.hat===false?null:a.hat??null,props:(chosen.props??mix.props)?a.props??[]:[]};
}

/**
 * Build someone (models.js `person` calls this): `kit` is the models' {blocks, reblock, box}.
 * `hatOn` puts the straw hat a tourist can buy on them. Returns the pivots and parts the animations
 * use, `look`, `seatDrop` (how far the body sinks so the hips land on a seat), `top` (the top of the
 * hair above the neck pivot) and `front` (the front of the body), and `dress(colours)`, which repaints
 * the clothes (Town.equip): {top, bottom, shoes}, a colour left out going back to the archetype's own;
 * and `sit(height, {table})` and `stand()` for a natural seated pose.
 */
export function buildPerson(kit,parent,pos,hatOn,look){
  const a=data.archetypes[look.archetype],B=data.builds[look.build],s=B.head??1,[hw,hh,hd]=HEAD.map(v=>v*s);
  const printed=new Set(a.print??[]),surface=printed.size?'print':'soft',base={...look.colours},colours={...base};
  const [tw,td]=B.torso,f=td/2,sh=B.shoulder,hip=B.hip,[lw,ld]=B.leg,[sw,shH,sl]=B.shoe,k=tw/.47,body=sh-hip;
  const at=t=>hip+body*t,hem=at(a.hem??.15),waist=at(a.waistline??.4),ff=hd/2;   // ff: the face's front
  const e=new pc.Entity('person');e.noBatch=true;e.setLocalPosition(...pos);parent.addChild(e);
  // Lists of blocks for each mesh, in its own frame: [position, size, colour, turn, bevel]. A colour is
  // a palette slot ('top', 'skin'...), [slot, shade] or a hex.
  const T=[],F=[],E=[],M=[],A=[[],[]],L=[[],[]];
  const DEG=180/Math.PI,line=(list,[x1,y1],[x2,y2],z,w,c,deep=.012)=>list.push([[(x1+x2)/2,(y1+y2)/2,z],[Math.hypot(x2-x1,y2-y1),w,deep],c,Math.atan2(y2-y1,x2-x1)*DEG]);
  const frog=(list,x,y,z,c='trim',turn=0)=>{list.push([[x,y,z],[.07*k,.016*k,.012],c,turn]);list.push([[x,y,z+.006],[.022*k,.022*k,.012],c]);};
  const hips=(from,wide=1)=>{const to=hip-.04*k;if(from>to)T.push([[0,(from+to)/2,0],[tw*wide,from-to,td*wide],'bottom']);};

  // --- the head (on the neck pivot at the chin) ------------------------------------------------
  F.push([[0,hh/2,0],[hw,hh,hd],'skin',0,.03*s]);
  for(const x of [-1,1])F.push([[x*(hw/2+.018*s),.179*s,-.059*s],[.04*s,.137*s,.106*s],['skin',.92]]);   // ears
  F.push([[0,.18*s,ff+.02*s],[.057*s,.08*s,.044*s],'skin']);                                          // the nose
  for(const x of [-1,1])F.push([[x*.1*s,.311*s,ff+.004],[.085*s,.031*s,.012],'brows']);
  E.push(...[-1,1].map(x=>[[x*.0875*s,0,0],[.036*s,.075*s,.012],'eyes']));
  // An open smile hung from its top edge: a row of teeth over a mouth that narrows to its foot.
  M.push([[0,-.016*s,0],[.19*s,.032*s,.012],'mouth'],[[0,-.044*s,0],[.155*s,.03*s,.012],'mouth'],[[0,-.066*s,0],[.1*s,.022*s,.012],'mouth'],[[0,-.013*s,.004],[.13*s,.026*s,.01],'teeth']);
  // Under a scarf only the hair at the front shows; under a 斗笠 it is cut short to fit the hat.
  const hair=look.hat==='scarf'?[[[0,.425,.21],[.42,.04,.03]],[[-.225,.35,.08],[.03,.1,.1]],[[.225,.35,.08],[.03,.1,.1]]]:HAIR[look.hat==='straw'?'short':look.style];
  let top=0;
  for(const [p,size,shade=1,turn=0,bevel] of hair){
    F.push([p.map(v=>v*s),size.map(v=>v*s),typeof shade==='string'?shade:['hair',shade],turn,bevel&&bevel*s]);
    top=Math.max(top,(p[1]+size[1]/2)*s);
  }
  if(look.hat==='straw'){
    // A conical 斗笠 in rings of weave, its underside darker, tied under the chin.
    const R=.48*s,H=.27*s,y=.36*s;
    for(let i=0;i<4;i++)F.push([[0,y,0],lathe([[R*(1-i/4),H*i/4],[R*(1-(i+1)/4),H*(i+1)/4]],14),['hat',i%2?.9:1]]);
    F.push([[0,y,0],lathe([[0,H*.8],[R,0]],14),['hat',.62]],[[0,y+H,0],[.05*s,.04*s,.05*s],['hat',.8]]);
    for(const x of [-1,1])F.push([[x*.19*s,.13*s,.05*s],[.008,.25*s,.008],'rope',x*-10,0]);
    top=y+H;
  } else if(look.hat==='scarf'){
    // A printed headscarf over the top and back, knotted low at the back on one side.
    F.push([[0,.5*s,-.03*s],[.5*s,.12*s,.47*s],'scarf',0,.05*s],[[-.255*s,.37*s,-.06*s],[.06*s,.2*s,.36*s],'scarf'],[[.255*s,.37*s,-.06*s],[.06*s,.2*s,.36*s],'scarf'],
      [[0,.33*s,-.245*s],[.52*s,.3*s,.06*s],'scarf'],[[0,.462*s,.205*s],[.48*s,.07*s,.06*s],'scarf'],[[-.18*s,.44*s,-.24*s],[.12*s,.1*s,.1*s],['scarf',.92],15],
      [[-.24*s,.34*s,-.26*s],[.07*s,.15*s,.04*s],'scarf',25],[[-.15*s,.32*s,-.27*s],[.06*s,.13*s,.04*s],['scarf',.95],-10]);
    top=.56*s;
  }
  for(const extra of a.extras??[]){
    if(extra==='glasses'){
      // Thin dark frames round each eye, a bridge over the nose and arms back to the ears.
      const y=.228*s,z=ff+.03*s,w=.13*s,h=.095*s,t=.012*s;
      for(const x of [-1,1].map(v=>v*.0875*s)){
        F.push([[x,y+h/2-t/2,z],[w,t,t],'frame',0,0],[[x,y-h/2+t/2,z],[w,t,t],'frame',0,0],[[x-w/2+t/2,y,z],[t,h,t],'frame',0,0],[[x+w/2-t/2,y,z],[t,h,t],'frame',0,0]);
        F.push([[Math.sign(x)*(hw/2+.004),y+.01*s,z-.12*s],[t,t,.24*s],'frame',0,0]);
      }
      F.push([[0,y+.012*s,ff+.046*s],[.05*s,t,t],'frame',0,0]);
    } else if(extra==='wrinkles'){
      const z=ff+.002,w=['skin',.8];
      F.push([[0,.36*s,z],[.16*s,.006,.004],w,0,0],[[0,.38*s,z],[.11*s,.006,.004],w,0,0]);
      for(const x of [-1,1])F.push([[x*.075*s,.135*s,z],[.006,.06*s,.004],w,x*18,0],[[x*.165*s,.24*s,z],[.025*s,.005,.004],w,x*20,0],
        [[x*.165*s,.215*s,z],[.025*s,.005,.004],w,-x*15,0],[[x*.0875*s,.176*s,z],[.04*s,.005,.004],w,0,0]);
    } else if(extra==='blush')for(const x of [-1,1])F.push([[x*.13*s,.145*s,ff+.002],[.065*s,.035*s,.004],'blush',0,0]);
  }

  // --- the clothes on the body (`upper`, in the person's own frame) ------------------------------
  T.push([[0,B.chin-.04*s,0],[.25*s,.12*s,.19*s],['skin',.9]]);                     // the neck
  const sleeve={};   // how each arm is dressed: the sleeve's length below the shoulder, its cuff
  const ax=tw/2+(B.armX??.055)*k,ay=sh-.03*k,L0=(ay-B.hand)/Math.cos(B.splay/DEG),H=.15*s,long=L0-H-.01;
  switch(a.top){
    case 'shirt':{
      // The tourist's button-up: a pointed collar open at the neck, a placket of four buttons, a
      // yoke seam front and back, short sleeves rolled once; tucked into the belt.
      const bt=waist+.034*k;
      T.push([[0,(sh+bt)/2,0],[tw,sh-bt,td],'top'],[[0,sh-.115*k,f],[tw-.02,.008,.006],['top',.9],0,0],[[0,sh-.11*k,-f],[tw-.02,.008,.006],['top',.9],0,0]);
      T.push([[0,(sh-.1*k+bt)/2,f+.003],[.045*k,sh-.1*k-bt,.008],['top',.97]]);
      for(let i=0;i<4;i++)T.push([[0,sh-.13*k-i*(sh-.18*k-bt)/3,f+.008],[.022,.022,.006],['top',.8],0,0]);
      T.push([[0,sh+.012,-.02],[.3*k,.045,.2*k],'top'],[[0,sh-.045*k,f+.002],[.09*k,.1*k,.006],'skin']);
      for(const x of [-1,1])T.push([[x*.09*k,sh-.055*k,f+.012],[.14*k,.15*k,.016],['top',.84],-x*26],[[x*.088*k,sh-.05*k,f+.02],[.13*k,.14*k,.012],'top',-x*26]);
      Object.assign(sleeve,{to:.24*k,cuff:.1*k,cuffC:['top',1.03],flare:17});
      break;
    }
    case 'tang-jacket':case 'tang-shirt':{
      // A 唐装: a stand collar, frog buttons down the middle; the jacket has pockets and long sleeves
      // with a pale lining turned back at the cuff, the shirt short sleeves.
      const jacket=a.top==='tang-jacket',F2=f+.015;
      T.push([[0,(sh+hem)/2,0],[tw+.03,sh-hem,td+.03],'top'],[[0,sh+.025*k,-.01],[.27*k,.06*k,.21*k],['top',.95]]);
      T.push([[0,sh-.02*k,F2+.002],[.05*k,.05*k,.006],'lining'],[[0,(sh+hem)/2,F2+.002],[.008,sh-hem-.02,.006],['top',.75],0,0]);
      const n=jacket?4:3;for(let i=0;i<n;i++)frog(T,0,sh-.07*k-i*(sh-.25*k-hem)/(n-1),F2+.008);
      if(jacket)for(const x of [-1,1])T.push([[x*.12*k,hem+.1*k,F2+.006],[.13*k,.12*k,.01],['top',.94]],[[x*.12*k,hem+.157*k,F2+.01],[.13*k,.014,.008],['top',.8],0,0]);
      Object.assign(sleeve,jacket?{to:long-.03,cuff:.035,cuffC:'lining',flare:3}:{to:.2*k,cuff:.02*k,cuffC:['top',.92]});
      hips(hem);break;
    }
    case 'cardigan':{
      // An open cardigan over a blouse: the blouse's pointed collar out over the neckline, its buttons
      // down the middle; the cardigan's edges, buttons on one side, two pockets; long sleeves with
      // the blouse's cuffs showing.
      const F2=f+.012;
      T.push([[0,(sh+hem)/2,0],[tw+.025,sh-hem,td+.024],'top'],[[0,(sh-.02+hem)/2,F2+.002],[.12*k,sh-.02-hem,.006],'under']);
      for(let i=0;i<4;i++)T.push([[0,sh-.1*k-i*(sh-.16*k-hem)/3,F2+.007],[.022,.022,.006],['under',.86]]);
      for(const x of [-1,1])T.push([[x*.068*k,(sh+hem)/2,F2+.004],[.022*k,sh-hem,.008],['top',.9]]);
      for(let i=0;i<3;i++)T.push([[.078*k,sh-.14*k-i*.1*k,F2+.009],[.022,.022,.006],'trim']);
      for(const x of [-1,1])T.push([[x*.06*k,sh-.03*k,F2+.012],[.12*k,.085*k,.014],'under',-x*22],[[x*.13*k,hem+.1*k,F2+.004],[.12*k,.11*k,.01],['top',.94]],
        [[x*.13*k,hem+.153*k,F2+.008],[.12*k,.012,.008],['top',.82],0,0]);
      T.push([[0,sh-.035*k,F2+.004],[.06*k,.06*k,.006],'skin']);
      Object.assign(sleeve,{to:long-.035,cuff:.04,cuffC:'under',flare:3});
      hips(hem);break;
    }
    case 'qipao':{
      // A qipao-cut top: stand collar, the opening running from the collar down to the left armpit
      // with two frog buttons along it, short sleeves with a band, slits at the sides of the hem.
      T.push([[0,(sh+hem)/2,0],[tw,sh-hem,td],'top'],[[0,sh+.025*k,-.005],[.24*k,.06*k,.2*k],['top',.92]]);
      const p1=[0,sh-.01],p2=[tw*.42,sh-.13*k];line(T,p1,p2,f+.002,.012,['top',.75]);
      for(const t of [.35,.72])frog(T,p1[0]+(p2[0]-p1[0])*t,p1[1]+(p2[1]-p1[1])*t,f+.008,'trim',Math.atan2(p2[1]-p1[1],p2[0]-p1[0])*DEG);
      for(const x of [-1,1])T.push([[x*tw/2,hem+.04*k,0],[.006,.08*k,td*.5],['top',.55],0,0]);
      Object.assign(sleeve,{to:.19*k,cuff:.045*k,cuffC:['top',1.08]});
      hips(hem,1.04);break;
    }
    case 'open-shirt':{
      // A short-sleeved shirt worn open over a T-shirt: the tee from the neck to the jeans, its round
      // neck; the shirt's collar spread, buttons down one edge, sleeves rolled.
      const jw=at(.25),F2=f+.005;
      T.push([[0,(sh+hem)/2,-.005],[tw+.02,sh-hem,td+.01],'top'],[[0,(sh-.03+jw)/2,F2+.002],[.15*k,sh-.03-jw,.006],'under'],
        [[0,(jw+hem)/2,F2+.002],[.15*k,jw-hem,.006],'bottom'],[[0,sh+.008,0],[.24*k,.03,.19*k],'under']);
      for(const x of [-1,1])T.push([[x*.08*k,(sh+hem)/2,F2+.004],[.022*k,sh-hem,.008],['top',.92]],[[x*.1*k,sh-.03*k,F2+.012],[.13*k,.09*k,.016],'top',-x*38]);
      for(let i=0;i<5;i++)T.push([[-.085*k,sh-.08*k-i*(sh-.12*k-hem)/4,F2+.009],[.022,.022,.006],['top',.7]]);
      T.push([[0,sh+.015,-.03],[.3*k,.05,.18*k],'top']);
      Object.assign(sleeve,{to:.2*k,cuff:.08*k,cuffC:['top',1.04]});
      hips(hem);break;
    }
    case 'girl-cardigan':{
      // A cardigan buttoned down the front with a ribbed hem, open at the top on a blouse whose round
      // collar lies over it; long sleeves with ribbed cuffs.
      T.push([[0,(sh+hem)/2,0],[tw,sh-hem,td],'top'],[[0,hem+.025*k,0],[tw+.008,.05*k,td+.008],['top',.9]],[[0,sh-.06*k,f+.002],[.08*k,.12*k,.006],'under']);
      for(const x of [-1,1])T.push([[x*.055*k,sh-.01,f+.014],[.11*k,.07*k,.014],'lining',0,.03*k]);
      T.push([[0,(sh-.12*k+hem)/2,f+.002],[.008,sh-.12*k-hem,.006],['top',.88],0,0]);
      for(let i=0;i<4;i++)T.push([[0,sh-.15*k-i*(sh-.21*k-hem-.04*k)/3,f+.006],[.024*k,.024*k,.008],['top',.8]]);
      Object.assign(sleeve,{to:long-.04*k,cuff:.04*k,cuffC:['top',.9],flare:3});
      hips(hem);break;
    }
    case 'cross':{
      // Qinghe's cross-collared 交领 top: the lining shows along the collar from the back of the
      // neck down across the chest; frog buttons to one side; sleeves to the elbow or so with the
      // lining turned back.
      const F2=f+.01;
      T.push([[0,(sh+hem)/2,0],[tw+.02,sh-hem,td+.02],'top'],[[0,sh+.018*k,-.02*k],[.27*k,.045*k,.2*k],'lining']);
      line(T,[-.075*k,sh-.005],[.13*k,sh-.2*k],F2+.004,.045*k,'lining',.01);
      T.push([[.06*k,sh-.035*k,F2+.002],[.07*k,.05*k,.008],'lining',-30]);
      for(let i=0;i<(a.frogs??2);i++)frog(T,-.035*k,sh-.13*k-i*.08*k,F2+.008);
      Object.assign(sleeve,{to:L0*(a.sleeve??.4),cuff:.07*k,cuffC:'lining',cuffW:.03,flare:8});
      hips(hem,1.03);break;
    }
    case 'frog-shirt':{
      // A cream shirt with a stand collar and frog buttons under an open waistcoat with two pockets.
      const vh=hem+.04*k,F2=f+.02*k;
      T.push([[0,(sh+hem)/2,0],[tw+.01,sh-hem,td+.01],'top'],[[0,sh+.02*k,-.01],[.25*k,.05*k,.2*k],['top',.95]]);
      T.push([[0,(sh-.01+vh)/2,-.005],[tw+.04*k,sh-.01-vh,td+.035*k],'vest'],[[0,(sh-.03+vh)/2,F2],[.15*k,sh-.03-vh,.008],'top']);
      for(let i=0;i<3;i++)frog(T,0,sh-.09*k-i*.08*k,F2+.006);
      for(const x of [-1,1])T.push([[x*.08*k,(sh+vh)/2,F2+.002],[.02*k,sh-vh-.02,.01],['vest',.88]],[[x*.12*k,vh+.07*k,F2+.002],[.1*k,.075*k,.008],['vest',.85]]);
      Object.assign(sleeve,{to:L0*(a.sleeve??.3),cuff:.07*k,cuffC:['top',1.04]});
      hips(hem,1.03);break;
    }
  }
  if(a.waist==='belt'){
    // A leather belt with loops and a pewter buckle; the trousers rise to it.
    T.push([[0,waist,0],[tw+.012,.067*k,td+.012],'waist'],[[0,waist,f+.012],[.082*k,.057*k,.01],'buckle']);
    for(const [x,z] of [[-.129,1],[.129,1],[-.12,-1],[0,-1],[.12,-1]])T.push([[x*k,waist,z*(f+.01)],[.026*k,.08*k,.008],'loop']);
    hips(waist-.034*k);
    T.push([[0,hip+.06*k,f+.002],[.006,.1*k,.004],['bottom',.85],0,0]);
  } else if(a.waist==='sash'){
    // A cloth sash round the waist, knotted in front with its two ends hanging.
    const x0=(a.knot??.1)*k;
    T.push([[0,waist,0],[tw+.035,.09*k,td+.035],'waist'],[[x0,waist,f+.03],[.1*k,.085*k,.05],['waist',1.05]]);
    T.push([[x0-.02*k,waist-.13*k,f+.035],[.055*k,.19*k,.02],'waist',6],[[x0+.03*k,waist-.115*k,f+.035],[.05*k,.16*k,.02],['waist',.95],-9]);
  } else if(a.waist==='apron'){
    // An apron tied at the waist, down to the thigh, its ties hanging at one side.
    const len=(waist-hip)+.12*k;
    T.push([[0,waist,0],[tw+.03,.055*k,td+.03],'waist'],[[0,waist-len/2,f+.022],[tw*.92,len,.02],'apron']);
    T.push([[tw*.36,waist,f+.035],[.07*k,.07*k,.04],['waist',1.05]],[[tw*.34,waist-.11*k,f+.04],[.04*k,.18*k,.015],'waist',4],[[tw*.4,waist-.1*k,f+.04],[.035*k,.15*k,.015],['waist',.92],-6]);
    if(a.pocket)T.push([[0,waist-len*.45,f+.034],[.16*k,.12*k,.008],['apron',.92]]);
  }

  // --- what they carry ---------------------------------------------------------------------------
  // Wicker and wood turned on a lathe in bands, alternately lighter and darker like the weave.
  const weave=(list,[x,y,z],profile,c,turn)=>{for(let i=0;i<profile.length-1;i++)list.push([[x,y,z],lathe([profile[i],profile[i+1]],10),[c,i%2?.82:1.04],turn]);};
  const scaled=(profile,u=k)=>profile.map(([r,y])=>[r*u,y*u]);
  for(const prop of look.props){
    if(prop==='basket'){
      // A round wicker creel on a rope over the right shoulder, hanging at the hip.
      const bx=-(tw/2+.07*k),by=hem-.1*k,bz=f*.5;
      line(T,[-.12*k,sh+.01],[bx+.02*k,by+.27*k],f+.02,.028*k,'rope',.028*k);
      weave(T,[bx,by,bz],scaled([[.06,0],[.11,.035],[.13,.1],[.13,.16],[.11,.22],[.085,.26],[.09,.285]]),'prop');
    } else if(prop==='satchel'){
      // A little basket on a strap across the body, at the hip, with a handle.
      const bx=-(tw/2+.06*k),by=hem-.06*k,bz=f*.6;
      line(T,[.1*k,sh],[bx+.03*k,by+.17*k],f+.016,.024*k,'rope',.016);
      weave(T,[bx,by,bz],scaled([[.06,0],[.09,.035],[.1,.09],[.1,.13],[.09,.15]]),'prop');
      line(T,[bx-.08*k,by+.15*k],[bx,by+.25*k],bz,.016*k,'prop',.016);line(T,[bx,by+.25*k],[bx+.08*k,by+.15*k],bz,.016*k,'prop',.016);
    } else if(prop==='hatback'){
      // His straw hat hung on his back by its cord, the cord across his chest.
      const at=[-.12*k,sh-.22*k,-(f+.06*k)],tilt=[-80,0,22];
      T.push([at,lathe([[.34*k,0],[0,.17*k]],14),'hat',tilt],[at,lathe([[0,.14*k],[.34*k,0]],14),['hat',.62],tilt]);
      line(T,[.12*k,sh],[-.1*k,sh-.25*k],f+.016,.02*k,'rope',.02);
    }
  }
  const held=(i,make)=>{const H=.15*s,y=-L0+H;make(A[i],y-H/2);};   // y: the middle of the hand
  for(const prop of look.props){
    // A round bamboo tray held by its rim at the hip, tipped towards you.
    if(prop==='tray')held(0,(l,y)=>l.push([[.14*k,y-.01,.13*k],lathe(scaled([[0,0],[.17,0],[.17,0],[.19,.05],[.19,.05],[.18,.05],[.18,.05],[.16,.006],[.16,.006],[0,.006]]),14),'prop',[42,0,-6]]));
    // A fishing net gathered in the hand, hanging to the knee in a long bag.
    else if(prop==='net')held(0,(l,y)=>{
      l.push([[0,y-.08*s,.02],[.05*s,.05*s,.05*s],'rope']);
      weave(l,[0,y-.56*s,.03],scaled([[.04,0],[.1,.06],[.1,.16],[.095,.26],[.07,.36],[.04,.43],[.025,.47]],s),'net');
    });
    // A coil of rope, three turns, hanging from the hand.
    else if(prop==='rope')held(1,(l,y)=>{
      const ring=lathe(Array.from({length:9},(_,j)=>[.13*k+.03*k*Math.cos(j/8*Math.PI*2),.03*k*Math.sin(j/8*Math.PI*2)]),14);
      for(const [dz,turn] of [[0,0],[.035,10],[.07,-8]])l.push([[0,y-.15*k,.02+dz*k],ring,['rope',1-dz*2],[90,0,turn]]);
    });
    // A wooden bucket with two dark hoops, carried by its rope handle.
    else if(prop==='bucket')held(1,(l,y)=>{
      const by=y-.3*k,r=.11*k,h=.22*k;
      l.push([[0,by,.03],lathe([[0,0],[r*.9,0],[r*.9,0],[r,h],[r,h],[r*.92,h],[r*.92,h],[r*.84,.012],[r*.84,.012],[0,.012]],12),'prop']);
      for(const v of [.22,.78])l.push([[0,by+h*v,.03],lathe([[r*(.92+.08*v)+.007,-.014],[r*(.92+.08*v)+.007,.014]],12),'hoop']);
      line(l,[-r,by+h],[0,y-.02],.03,.018,'rope',.018);line(l,[0,y-.02],[r,by+h],.03,.018,'rope',.018);
    });
  }

  // --- arms and legs -------------------------------------------------------------------------------
  // A sleeve hangs from the point of the shoulder and flares out from the body (`flare` degrees more
  // than the arm), turned about its top outer corner; a turned-back cuff follows its foot, and the
  // forearm comes out of that on the arm's own line.
  for(const i of [0,1]){
    const side=i?1:-1,list=A[i],{to,cuff=0,cuffC,cuffW=.025,flare=10}=sleeve,wrist=-L0+H,sw2=.17*k,sd=.22*td/.3,fw=.135*s;
    const t=side*flare/DEG,turn=(ox,oy)=>[Math.cos(t)*ox-Math.sin(t)*oy,Math.sin(t)*ox+Math.cos(t)*oy];
    const P=[side*.014*k,.018*k],[cx,cy]=turn(side*sw2/2,to/2),c=[P[0]-cx,P[1]-cy],[bx,by]=turn(0,-to/2),[dx,dy]=turn(0,-cuff/2+.012);
    list.push([[c[0],c[1],0],[sw2,to,sd],'top',side*flare]);
    if(cuff)list.push([[c[0]+bx+dx,c[1]+by+dy,0],[sw2+cuffW*k,cuff,sd+cuffW*k],cuffC,side*flare]);
    const fa=c[1]+by+2*dy-.012;
    if(fa>wrist+.01)list.push([[0,(fa+wrist)/2,0],[fw,fa-wrist+.02,fw*1.07],'skin']);
    list.push([[0,wrist-H/2,.004],[.155*s,H,.175*s],'skin'],[[-side*.05*s,wrist-H*.6,.09*s],[.05*s,.07*s,.05*s],['skin',.93]]);   // a fist and its thumb
  }
  // The legs hang from a hip joint half a thigh's depth above the crotch, so a sitter's thighs rest on
  // the seat with the hips on it; the knee is halfway down. A grown-up's shin hides an extension up
  // inside the thigh that slides out when they sit, so their feet reach the floor from an ordinary
  // seat (.45 to .5 m, within a few centimetres) although the sheets' legs are short; a child's feet swing.
  const P=hip-.04*k+ld/2,Th=.5*P,ext=s<.9?0:Math.max(0,.47+ld/2-(P-Th));
  const g=-P,shoeTop=g+shH,sz=.04*sl/.37;
  for(const i of [0,1]){
    const list=L[i],side=i?1:-1;
    const cuffed=(end,cuff,wide=1)=>{list.push([[0,(.04+end+cuff)/2,0],[lw*wide,.04-end-cuff,ld*wide],'bottom'],[[0,end+cuff/2,0],[lw*wide+.016,cuff,ld*wide+.016],'cuff']);};
    switch(a.bottom){
      case 'trousers':{const end=shoeTop-.005;list.push([[0,(.04+end)/2,0],[lw,.04-end,ld],'bottom'],[[0,(.04+end)/2-.02,ld/2+.001],[.006,(.04-end)*.85,.004],['bottom',.85],0,0]);break;}
      case 'wide':{const end=g+shH*.9,h=.04-end;list.push([[side*h*.06,(.04+end)/2,0],[lw*1.12,h,ld*1.1],'bottom',side*7]);break;}   // flared, the outer seam leaning out
      case 'jeans':cuffed(shoeTop-.005,.07*k);break;
      case 'cropped':{const end=shoeTop+.01;cuffed(end,.045*k,1.06);list.push([[0,(end+shoeTop)/2,0],[lw*.6,end-shoeTop+.03,ld*.6],'sock']);break;}
      case 'shorts':{const end=g+hip*.85;cuffed(end,.05*k,1.06);list.push([[0,(end+shoeTop)/2,0],[lw*.62,end-shoeTop+.02,ld*.62],'skin']);
        if(a.shoes!=='sandal')list.push([[0,shoeTop+.03*k,0],[lw*.66,.06*k,ld*.66],'sock']);break;}
      case 'baggy':{const end=g+hip*.4;cuffed(end,.055*k,1.14);list.push([[0,(end+shoeTop)/2,0],[lw*.55,end-shoeTop+.02,ld*.55],'skin']);break;}
    }
    const ox=side*.025*k;   // the feet stand a little apart, toes out
    switch(a.shoes){
      case 'plain':list.push([[ox,g+.016,sz],[sw+.008,.032,sl+.006],['shoes',1.18]],[[ox,g+.032+(shH-.032)/2,sz-sl*.17],[sw,shH-.032,sl*.66],'shoes'],
        [[ox,g+.032+(shH-.032)*.36,sz+sl*.24],[sw-.004,(shH-.032)*.72,sl*.5],'shoes']);break;
      case 'cloth':list.push([[ox,g+.02,sz],[sw+.006,.04,sl+.01],'sole'],[[ox,g+.075,sz],[sw,.07,sl],'shoes'],[[ox,g+.111,sz-sl*.06],[sw*.62,.006,sl*.42],'sock',0,0]);break;
      case 'flat':list.push([[ox,g+.012,sz],[sw+.006,.024,sl+.008],'sole'],[[ox,g+.056,sz],[sw,.064,sl],'shoes']);break;
      case 'sneaker':list.push([[ox,g+.026,sz],[sw+.012,.052,sl+.014],'sole'],[[ox,g+.052+(shH-.052)/2,sz-sl*.08],[sw,shH-.052,sl*.8],'shoes'],
        [[ox,g+.085,sz+sl*.36],[sw+.006,.066,sl*.3],'sole']);
        for(let j=0;j<3;j++)list.push([[ox,g+shH+.004-j*.012,sz+sl*(.02+j*.11)],[sw*.5,.012,.022],'sole',0,0]);break;
      case 'sandal':list.push([[ox,g+.016,sz],[sw,.032,sl],'straw'],[[ox,g+.062,sz-.01],[sw*.82,.06,sl*.86],'skin'],
        [[ox,g+.08,sz+sl*.2],[sw*.9,.026,.05],'straw'],[[ox,g+.09,sz-sl*.18],[sw*.9,.026,.05],['straw',.9]]);
        for(let j=-2;j<=2;j++)list.push([[ox+j*sw*.17,g+.05,sz+sl*.43],[sw*.15,.036,.04],['skin',.95]]);break;
    }
  }

  /** A leg's blocks cut at the knee (y = at, in the hip's frame): the thigh's, and the shin's in the
   *  knee's own frame. A block across the knee is cut in two along its own length. */
  function atKnee(list,at){
    const up=[],down=[];
    for(const [p,size,c,turn=0,bevel] of list){
      const [x,y,z]=p,h=size[1],t=(typeof turn==='number'?turn:turn[2])/DEG,cos=Math.cos(t),sin=Math.sin(t),cut=(at-y)/cos;
      if(size.p||cut>=h/2){down.push([[x,y-at,z],size,c,turn,bevel]);continue;}   // all below the knee
      if(cut<=-h/2){up.push([p,size,c,turn,bevel]);continue;}
      // Each piece runs on past the knee by more than its chamfer, the shin's a hair slimmer inside the
      // thigh's, so no groove shows at the joint, standing or bent; and each is shaded to meet the
      // other there (a block is lighter at its top than its foot).
      const [slot,shade=1]=Array.isArray(c)?c:[c],there=shade*(.94+.06*(cut+h/2)/h);
      for(const [from,to,into,dy,thin,k] of [[cut-.045,h/2,up,0,0,there/.94],[-h/2,cut+.045,down,-at,.004,there]]){
        const m=(from+to)/2;into.push([[x-sin*m,y+cos*m+dy,z],[size[0]-thin,to-from,size[2]-thin],[slot,k],turn,bevel]);
      }
    }
    return [up,down];
  }

  // --- the meshes ---------------------------------------------------------------------------------
  const paint=c=>{const [slot,shade=1]=Array.isArray(c)?c:[c];return [slot[0]==='#'?slot:colours[slot]??'#ff00ff',shade];};
  const plainOf=c=>surface==='print'&&!printed.has(Array.isArray(c)?c[0]:c);
  const flat=detail()==='low';   // on 低, square edges: a quarter of the triangles
  const resolve=list=>list.map(([p,size,c,turn=0,bevel])=>[p,size,paint(c),turn,flat?0:bevel,plainOf(c)]);
  const parts=[];
  const mesh=(parentEntity,name,list,shadow=false)=>{const m=kit.blocks(parentEntity,name,resolve(list),surface);m.render.castShadows=shadow;parts.push([m,list]);return m;};
  const upper=new pc.Entity('upper');e.addChild(upper);
  const torso=mesh(upper,'torso',T,true);
  const head=new pc.Entity('head');e.addChild(head);
  const neck=new pc.Entity('neck');neck.setLocalPosition(0,B.chin,0);head.addChild(neck);
  const face=mesh(neck,'face',F,true);
  const eyes=mesh(neck,'eyes',E);eyes.setLocalPosition(0,.225*s,ff+.002);
  const mouth=mesh(neck,'mouth',M);mouth.setLocalPosition(0,.11*s,ff+.002);
  // Limbs hang from a pivot at the hip and the shoulder, so a swing reads as a stride; an arm hangs
  // a little out from the body, as on the sheets, below its pivot.
  const legs=[-1,1].map((x,i)=>{
    const pivot=new pc.Entity('leg');pivot.setLocalPosition(x*B.legX,P,0);e.addChild(pivot);
    const [thigh,lower]=atKnee(L[i],-Th);
    if(ext)lower.push([[0,(ext+ld/2)/2,0],[lw*.9,ext+ld/2,ld*.9],'bottom']);   // the hidden extension
    const knee=new pc.Entity('knee');knee.setLocalPosition(0,-Th,0);pivot.addChild(knee);
    const shin=new pc.Entity('shin');knee.addChild(shin);
    return Object.assign(pivot,{limb:mesh(pivot,'thigh',thigh),shoe:mesh(shin,'shin',lower),knee,shin});
  });
  const arms=[-1,1].map((x,i)=>{
    const pivot=new pc.Entity('arm');pivot.setLocalPosition(x*ax,ay,0);upper.addChild(pivot);
    const hang=new pc.Entity('hang');hang.setLocalEulerAngles(0,0,x*B.splay);pivot.addChild(hang);
    const hand=new pc.Entity('hand');hand.setLocalPosition(0,-L0+H/2,0);hang.addChild(hand);   // where a line or a tool is held
    pivot.limb=mesh(hang,'arm',A[i]);return Object.assign(pivot,{hang,hand});
  });
  // The straw hat a tourist can buy (and a station attendant wears), off until worn.
  const hatRoot=new pc.Entity('hat');neck.addChild(hatRoot);
  kit.box(hatRoot,[0,top+.01,0],[.8*s,.045,.72*s],'#deb975');kit.box(hatRoot,[0,top+.11,0],[.5*s,.2,.48*s],'#deb975');kit.box(hatRoot,[0,top+.035,0],[.52*s,.045,.5*s],'#a7794f');
  hatRoot.enabled=hatOn;
  /**
   * Sit on a seat `height` above the floor the feet rest on: the thighs level on it with the hips on
   * it, the knees bent and the shins down to the floor (a little forward from a low seat; a child's
   * hang), back upright, and the hands on the knees or, given a `table` that many metres above the
   * floor, forward on it. Put the person's origin `seatDrop` below the seat first: given the seat's
   * `front` (how far its front edge is ahead of where they were put), they shift forward until their
   * shins clear it. Leaves `armRest`, how far forward the arms are (degrees), for anything that moves
   * them from there; `stand` puts the limbs back (the caller puts the person back on their feet).
   */
  const sit=(height=.48,{table,front}={})=>{
    if(front!==undefined)e.translateLocal(0,0,Math.max(0,front-(Th-ld/2)+.02));
    const hipW=height+ld/2,reach=P-Th+ext,tilt=reach-hipW>.04?Math.acos(hipW/reach)*DEG:0;   // a low seat: feet forward
    for(const leg of legs){leg.setLocalEulerAngles(-90,0,0);leg.knee.setLocalEulerAngles(90-tilt,0,0);leg.shin.setLocalPosition(0,-ext,0);}
    // A positive turn swings a limb back, so forward is negative.
    const drop=hipW+ay-P-(table??hipW+ld/2);
    person.armRest=Math.acos(Math.max(-1,Math.min(1,drop/L0)))*DEG;
    arms.forEach((arm,i)=>arm.setLocalEulerAngles(-person.armRest,0,(i?-1:1)*B.splay*.8));
  };
  const stand=()=>{
    for(const leg of legs){leg.setLocalEulerAngles(0,0,0);leg.knee.setLocalEulerAngles(0,0,0);leg.shin.setLocalPosition(0,0,0);}
    for(const arm of arms)arm.setLocalEulerAngles(0,0,0);
    person.armRest=0;
  };
  const dress=(worn={})=>{
    for(const slot of ['top','bottom','shoes'])colours[slot]=worn[slot]??base[slot];
    for(const [m,list] of parts)kit.reblock(m,resolve(list));
  };
  const person={entity:e,torso,upper,legs,arms,hat:hatRoot,head,neck,face,eyes:[eyes],brows:[],mouth,lips:[],look,dress,sit,stand,
    seatDrop:P-ld/2,armRest:0,top,front:f,hatBrim:hatRoot.children.filter(c=>c.render)};
  return person;
}
