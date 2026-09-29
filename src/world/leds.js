import * as pc from 'playcanvas';
import {detail} from '../core/quality.js';

/**
 * 云海's LED façades (task C-city): light running along bands and up the corners of the towers,
 * crowns washing slowly through the colours, and big lit characters.
 *
 * Every material here is one of the daylight system's lamps (the `lamps` list), so the city lights
 * up at dusk and is calm by day. Each is shared by every piece that uses it, so once the city's
 * statics are batched the whole skyline costs a handful of draw calls; `update` animates them by
 * shifting a texture offset or turning a colour, written straight into the shader's uniforms from
 * arrays made once: nothing is rebuilt or allocated per frame.
 */
export function createLeds(models,{origin=0,hour=()=>21}={}){
  const device=pc.Application.getApplication().graphicsDevice,lamps=[];
  const texture=canvas=>{
    const t=new pc.Texture(device,{width:canvas.width,height:canvas.height,mipmaps:true,anisotropy:4,
      addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT});
    t.setSource(canvas);return t;
  };
  /** A lamp: `diffuse` is how it looks by day, `emissive` (times `map`) how it glows after dark. */
  const lamp=(diffuse,emissive,map=null,dayMap=null,gloss=.35)=>{
    const m=new pc.StandardMaterial();
    m.diffuse=new pc.Color().fromString(diffuse);m.emissive=new pc.Color().fromString(emissive);
    if(map)m.emissiveMap=map;
    if(dayMap)m.diffuseMap=dayMap;
    m.emissiveIntensity=0;m.useMetalness=true;m.metalness=0;m.gloss=gloss;m.update();
    lamps.push(m);return m;
  };

  /** Comets of colour on a dark strip, running along u (a band round a tower) or v (up a corner). */
  const chase=along=>{
    const c=document.createElement('canvas'),len=256;
    c.width=along==='u'?len:2;c.height=along==='u'?2:len;
    const g=c.getContext('2d');
    g.fillStyle='#0b1422';g.fillRect(0,0,c.width,c.height);
    const colors=['#3fe4ff','#ff58d6','#ffd452','#86ff9e'];
    colors.forEach((color,i)=>{
      // Along u the head leads to the right; up a corner it leads upwards (the top of the canvas).
      const a=i*len/colors.length,b=a+len/colors.length*.8;
      const grad=along==='u'?g.createLinearGradient(a,0,b,0):g.createLinearGradient(0,b,0,a);
      grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(.8,color);grad.addColorStop(1,'#ffffff');
      g.fillStyle=grad;
      if(along==='u')g.fillRect(a,0,b-a,2);else g.fillRect(0,a,2,b-a);
    });
    return texture(c);
  };
  const runner=lamp('#2a3038','#ffffff',chase('u'));
  runner.emissiveMapTiling=new pc.Vec2(2,1);runner.update();
  const climber=lamp('#2a3038','#ffffff',chase('v'));
  climber.emissiveMapTiling=new pc.Vec2(1,6);climber.update();
  // Three colour washes a third of the way round the colour wheel from each other.
  const washes=[0,1/3,2/3].map(phase=>Object.assign(lamp('#3a4350','#ffffff'),{phase}));
  const beacon=lamp('#4a2020','#ff2a1a');

  /** A plain light of one colour (a lamp head, a lit line), shared by everything that colour. */
  const lights=new Map();
  const light=hex=>{if(!lights.has(hex))lights.set(hex,lamp(hex,hex));return lights.get(hex);};

  /** One floor of windows seen from outside: some lit brighter, some dimmer, some dark, with a
   *  mullion between each; two different floors, so the lit ones never line up all the way up. */
  const floorOf=seed=>{
    const c=document.createElement('canvas');c.width=128;c.height=8;
    const g=c.getContext('2d'),next=random(seed);
    g.fillStyle='#000';g.fillRect(0,0,128,8);
    for(let i=0;i<32;i++){
      const r=next();
      if(r<.3)continue;
      const v=Math.round(70+185*r);g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(i*4,1,3,6);
    }
    return texture(c);
  };
  const floors=[floorOf(7),floorOf(19)];
  /** Lit floors, warm and cool, behind a tower's glass: two lamps per glass tint. */
  const windowSets=new Map();
  const windows=glass=>{
    if(!windowSets.has(glass))windowSets.set(glass,[lamp(glass,'#e0aa62',floors[0],null,.7),lamp(glass,'#a8c4e6',floors[1],null,.7)]);
    return windowSets.get(glass);
  };

  /** One canvas and one material per text, however many times and places it is shown. */
  const textSets=new Map();
  function textMaterial(zh,color,vertical,sub){
    const key=[zh,color,vertical,sub].join('|');
    if(textSets.has(key))return textSets.get(key);
    const chars=[...zh],cell=128,rows=vertical?chars.length:1;
    const c=document.createElement('canvas');
    c.width=vertical?cell:cell*chars.length;c.height=Math.round(cell*(rows+(sub?.55:0)));
    const g=c.getContext('2d');
    g.fillStyle='#05070b';g.fillRect(0,0,c.width,c.height);
    g.fillStyle='#141a24';                                   // the dots of the LED matrix
    for(let y=4;y<c.height;y+=8)for(let x=4;x<c.width;x+=8)g.fillRect(x-1.5,y-1.5,3,3);
    g.textAlign='center';g.textBaseline='middle';
    g.font=`900 ${cell*.8}px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif`;
    g.fillStyle=color;g.shadowColor=color;
    for(const blur of [cell*.16,0]){                         // a halo, then the characters sharp on top
      g.shadowBlur=blur;
      chars.forEach((ch,i)=>g.fillText(ch,vertical?cell/2:cell*(i+.5),vertical?cell*(i+.53):cell*.53));
    }
    if(sub){
      g.shadowBlur=0;g.fillStyle='#eef3ff';
      g.font=`700 ${cell*.36}px "Microsoft YaHei","PingFang SC",sans-serif`;
      g.fillText(sub,c.width/2,cell*(rows+.26));
    }
    const map=texture(c),material=lamp('#5a5a5a','#ffffff',map,map);
    textSets.set(key,material);
    return material;
  }

  /** A piece of LED hardware: no shadow of its own, lit with the given material. */
  function piece(parent,pos,size,material,rotation){
    const e=models.box(parent,pos,size,'#1b2027',rotation);
    e.render.meshInstances[0].material=material;e.render.castShadows=false;
    return e;
  }
  /**
   * Big lit characters on a panel `cell` metres a character, centred at `pos` on the parent's +z
   * face. It reads its exact text when looked at (signs.json), from as far off as `reach`.
   */
  function text(parent,zh,pos,cell,{color='#ffd36b',vertical=false,sub=null,reach=260,rot=0}={}){
    const n=[...zh].length,rows=(vertical?n:1)+(sub?.55:0);
    const e=piece(parent,pos,[vertical?cell:cell*n,cell*rows,.1],textMaterial(zh,color,vertical,sub),[0,rot,0]);
    e.signText=zh;e.lookReach=reach;
    return e;
  }

  // ---- The near side of the bay (task E-downtown) ----
  // Its lights are drawn by the lit shader itself: StandardMaterials whose emissive chunk (and for
  // glazing the diffuse chunk too) is replaced, so each kind of light is one material however many
  // buildings share it, and it moves by reading two global uniforms written once a frame (`update`).
  // Glazing, the uplights and the outline strips work out their pattern from where the pixel is in
  // the city, so one material fits a façade of any size.
  const custom=(kind,diffuse,emissive,chunks,{map=null,dayMap=null,gloss=.35,additive=false}={})=>{
    const m=lamp(diffuse,emissive,map,dayMap,gloss),code=m.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
    for(const [name,body] of Object.entries(chunks))code.set(name,body);
    m.shaderChunksVersion='2.22';m.setDefine('CITY_LED',String(kind));
    if(additive){
      // Light added to what is behind it: black by day, and it never casts or takes a shadow.
      m.blendType=pc.BLEND_ADDITIVE;m.depthWrite=false;m.useMetalness=false;
      m.diffuse=new pc.Color(0,0,0);m.specular=new pc.Color(0,0,0);
    }
    m.update();return m;
  };
  const cached=(map,key,make)=>{if(!map.has(key))map.set(key,make());return map.get(key);};

  /** Glass with rooms behind it (city.json `leds.windows`): panes and frames by day, and after dark
   *  lit rooms that come and go through the night; `frame` recolours the frames (a stone front). */
  const glazings=new Map();
  function glazing(kind='curtain',frame=null){
    return cached(glazings,kind+'|'+frame,()=>{
      const g=GLAZING[kind]??GLAZING.curtain;
      const m=custom(1,frame??g.frame,g.glow,{diffusePS:GLAZE_DIFFUSE,emissivePS:GLAZE_EMISSIVE},{gloss:g.gloss??.5});
      m.setParameter('window_grid',new Float32Array(g.grid));
      m.setParameter('window_glass',linear(g.glass));
      return m;
    });
  }

  /** An outline of light along an edge, a crown or a canopy: `steady` (it breathes, and joins the
   *  city's light show), `chase` (bulbs marching round a marquee) or `twinkle`. */
  const strips=new Map();
  function strip(color,mode='steady',{spacing=.45,speed=5,seed=0}={}){
    return cached(strips,[color,mode,spacing,speed,seed].join('|'),()=>{
      const m=custom(3,'#b4bac1',color,{emissivePS:STRIP});
      m.setParameter('strip_style',new Float32Array([STRIP_MODES[mode],spacing,speed,seed]));
      return m;
    });
  }

  /** A fan of light washing up a wall from a lamp at its foot, one fan to a pane however wide
   *  or tall (the pane's own texture coordinates shape it). */
  const uplights=new Map();
  let fanMap=null;
  function uplight(color){
    return cached(uplights,color,()=>{
      if(!fanMap){const c=document.createElement('canvas');c.width=c.height=2;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,2,2);fanMap=texture(c);}
      return custom(4,'#000000',color,{emissivePS:UPLIGHT},{map:fanMap,additive:true});
    });
  }
  /** The wash itself: a thin pane standing just clear of the wall it lights. */
  function wash(parent,pos,size,color){
    const e=piece(parent,pos,size,uplight(color));
    e.render.receiveShadows=false;return e;
  }

  /** A searchlight's beam: brightest along its middle and at its foot, fading into the sky. */
  const beams=new Map();
  function beam(color){
    return cached(beams,color,()=>{
      const c=document.createElement('canvas');c.width=4;c.height=128;
      const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,0,128);
      grad.addColorStop(0,'rgba(255,255,255,0)');grad.addColorStop(.7,'rgba(255,255,255,.35)');grad.addColorStop(1,'#ffffff');
      g.fillStyle='#000';g.fillRect(0,0,4,128);g.fillStyle=grad;g.fillRect(0,0,4,128);
      return custom(5,'#000000',color,{emissivePS:BEAM},{map:texture(c),additive:true});
    });
  }

  /** A media wall: an LED screen of `size` metres, `pitch` metres a pixel, showing `zh` through a
   *  round of animated programmes after dark and the words alone, dim and still, by day. It reads
   *  its text when looked at, from as far off as `reach`. */
  const screens=new Map();
  function screen(parent,zh,pos,[w,h,deep=.12],{vertical=false,pitch=.14,seed=0,reach=260,rot=0,ink=.72}={}){
    const m=cached(screens,[zh,w,h,vertical,pitch,seed].join('|'),()=>{
      const k=64,c=document.createElement('canvas');c.width=Math.round(w*k/4)*4;c.height=Math.round(h*k/4)*4;
      const g=c.getContext('2d'),chars=[...zh];
      g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);
      const size=vertical?Math.min(c.width*ink,c.height*ink/chars.length):Math.min(c.height*ink,c.width*.9/chars.length);
      g.font=`900 ${size}px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif`;
      g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';
      chars.forEach((ch,i)=>g.fillText(ch,vertical?c.width/2:c.width/2+(i-(chars.length-1)/2)*size,
        vertical?c.height/2+(i-(chars.length-1)/2)*size:c.height/2+size*.04));
      const map=texture(c);map.addressU=map.addressV=pc.ADDRESS_CLAMP_TO_EDGE;
      const mat=custom(2,'#14171d','#ffffff',{emissivePS:MEDIA},{map,gloss:.8});
      mat.setParameter('media_grid',new Float32Array([Math.round(w/pitch),Math.round(h/pitch),seed,0]));
      return mat;
    });
    const e=piece(parent,pos,[w,h,deep],m,[0,rot,0]);
    e.signText=zh;e.lookReach=reach;
    return e;
  }

  /** A sign in neon tubes: the name traced in glowing tubes on a dark board with a tube round its
   *  edge, a hum and now and then a stutter after dark; pale glass tubes by day. */
  const neons=new Map();
  function neon(parent,zh,pos,[w,h],{color='#ff6f9c',board='#16181e',reach=40,seed=0,bowl=false}={}){
    const m=cached(neons,[zh,w,h,color,board,bowl].join('|'),()=>{
      const k=160,c=document.createElement('canvas'),day=document.createElement('canvas');
      c.width=day.width=Math.round(w*k/4)*4;c.height=day.height=Math.round(h*k/4)*4;
      const W=c.width,H=c.height,chars=[...zh],pic=bowl?H*.9:0;
      const size=Math.min(H*.66,(W-pic-H*.5)/chars.length);
      const draw=(g,lit)=>{
        g.fillStyle=lit?'#000':board;g.fillRect(0,0,W,H);
        g.lineJoin=g.lineCap='round';
        const tube=(path,width)=>{
          for(const [blur,alpha,wide,ink] of lit?[[H*.12,.55,2.4,color],[H*.03,1,1,color],[0,1,.38,'#fff4f8']]:[[0,.85,1,'#cfd6dd']]){
            g.save();g.globalAlpha=alpha;g.shadowColor=color;g.shadowBlur=blur;g.strokeStyle=ink;g.lineWidth=width*wide;
            path(g);g.restore();
          }
        };
        const r=H*.14;
        tube(g=>{g.beginPath();g.roundRect(H*.08,H*.08,W-H*.16,H-H*.16,r);g.stroke();},H*.03);
        g.font=`700 ${size}px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif`;
        g.textAlign='center';g.textBaseline='middle';
        const x0=(W+pic-chars.length*size)/2+size/2;
        chars.forEach((ch,i)=>tube(g=>g.strokeText(ch,x0+i*size,H*.53),Math.max(2,size*.045)));
        // 海风面馆: a bowl of noodles with steam rising, in tubes, before the name.
        if(bowl)tube(g=>{
          const cx=H*.55+pic*.2,cy=H*.6,rr=H*.24;
          g.beginPath();g.moveTo(cx-rr,cy-rr*.1);g.lineTo(cx+rr,cy-rr*.1);g.arc(cx,cy-rr*.1,rr,0,Math.PI);g.stroke();
          for(const dx of [-.4,0,.4]){g.beginPath();g.moveTo(cx+dx*rr,cy-rr*.45);
            g.bezierCurveTo(cx+dx*rr+rr*.25,cy-rr*.8,cx+dx*rr-rr*.25,cy-rr*1.05,cx+dx*rr,cy-rr*1.4);g.stroke();}
        },Math.max(2,size*.045));
      };
      draw(c.getContext('2d'),true);draw(day.getContext('2d'),false);
      const mat=custom(6,'#ffffff','#ffffff',{emissivePS:NEON},{map:texture(c),dayMap:texture(day),gloss:.6});
      mat.setParameter('neon_style',new Float32Array([seed,0,0,0]));
      return mat;
    });
    const e=piece(parent,pos,[w,h,.1],m);
    e.signText=zh;e.lookReach=reach;
    return e;
  }

  /** A plain lamp of its own: `day` is how it looks by day, `night` how it glows (a lit lobby),
   *  at `strength` of the full glow, so a room of light never burns out to white. */
  const lits=new Map();
  const lit=(day,night,strength=.45)=>cached(lits,day+night+strength,()=>{
    const m=lamp(day,night,null,null,.6);m.emissive.mulScalar(strength);m.update();return m;
  });

  // What moves goes straight into the uniforms, from arrays made here once: update() on a
  // StandardMaterial rebuilds every uniform it has, and allocates doing it. A map transform is the
  // engine's own pair of rows, [tiling.x, 0, offset.x] and [0, tiling.y, 1 - tiling.y - offset.y];
  // colours are linear. The daylight's own update() (when a lamp dims) is overwritten each frame.
  const runRows=[new Float32Array([2,0,0]),new Float32Array([0,1,0])];
  const climbRows=[new Float32Array([1,0,0]),new Float32Array([0,6,-5])];
  const washColours=washes.map(()=>new Float32Array(3));
  const beaconColours=[new Float32Array([.002,0,0]),new Float32Array([1,.023,.006])];   // off, on
  // The near side's two global uniforms: `city_clock` (seconds, the share of windows lit at this
  // hour, the slow turnover of which rooms are lit, and where the light show's wave has got to) and
  // `city_origin` (the city's place in the world, so patterns work in small, exact numbers). On low
  // detail (asked every frame, so a step down by 自动 takes effect at once) nothing moves: the rooms
  // stay as they are and the screens hold one picture.
  const scope=device.scope,clockId=scope.resolve('city_clock'),originId=scope.resolve('city_origin');
  const cityClock=new Float32Array([0,.6,0,-1e4]),cityOrigin=new Float32Array([origin,0,0]);
  clockId.setValue(cityClock);originId.setValue(cityOrigin);
  let clock=0,run=0,climb=0,seconds=0,churn=0;
  function update(dt){
    const still=detail()==='low';
    // Eight hours before the clock wraps: long enough that nobody sees the patterns jump.
    if(!still){seconds=(seconds+dt)%28800;churn=(churn+dt/240)%1e4;}
    cityClock[0]=seconds;cityClock[1]=litShare(hour());cityClock[2]=churn;
    const show=seconds%SHOW.every;cityClock[3]=!still&&show<SHOW.length?show*SHOW.speed:-1e4;
    clockId.setValue(cityClock);originId.setValue(cityOrigin);
    if(!(runner.emissiveIntensity>0)||still)return;          // by day the LEDs are off: nothing to move
    clock=(clock+dt)%3600;
    run=(run-dt*.06)%1;climb=(climb-dt*.09)%1;
    runRows[0][2]=run;climbRows[1][2]=-5-climb;
    runner.setParameter('texture_emissiveMapTransform0',runRows[0]);
    runner.setParameter('texture_emissiveMapTransform1',runRows[1]);
    climber.setParameter('texture_emissiveMapTransform0',climbRows[0]);
    climber.setParameter('texture_emissiveMapTransform1',climbRows[1]);
    for(let i=0;i<washes.length;i++){
      rainbow(washColours[i],clock*.025+washes[i].phase);
      washes[i].setParameter('material_emissive',washColours[i]);
    }
    beacon.setParameter('material_emissive',beaconColours[clock%1.6<.25?1:0]);
  }
  return {lamps,runner,climber,washes,beacon,light,windows,text,piece,update,
    glazing,strip,wash,beam,screen,neon,lit};
}

/** The same stream of numbers every time, so the lit windows and the skyline never rearrange themselves. */
export function random(seed){
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}

/** A soft, fully saturated hue (0..1 round the colour wheel), written into `out` as linear rgb. */
function rainbow(out,h){
  out[0]=channel(5,h)**2.2;out[1]=channel(3,h)**2.2;out[2]=channel(1,h)**2.2;
}
function channel(n,h){
  const k=(n+h*6)%6;
  return .15+.85*(1-Math.max(0,Math.min(k,4-k,1)));
}

/** A colour as linear rgb, the way the shader wants it. */
function linear(hex){const c=new pc.Color().fromString(hex).linear();return new Float32Array([c.r,c.g,c.b]);}

/**
 * The near side's glazing (city.json `leds.windows`): the frame colour by day, the panes' own
 * colour, the colour lit rooms glow, and the window grid [width, storey, frame across, frame up]
 * in metres and fractions of a window. A wide frame reads as windows punched through a wall.
 */
export const GLAZING={
  curtain:{frame:'#7c8893',glass:'#2e4453',glow:'#e4eeff',grid:[1.5,3.6,.05,.1],gloss:.6},
  ribbon:{frame:'#dedbd2',glass:'#34495a',glow:'#eef4ff',grid:[1.5,3.6,.02,.34]},
  punched:{frame:'#c9bca4',glass:'#3a4650',glow:'#ffe2bd',grid:[2.1,3.4,.24,.26],gloss:.3},
  home:{frame:'#d6cab8',glass:'#48545e',glow:'#ffd4a2',grid:[2.6,3,.18,.22],gloss:.35},
  hotel:{frame:'#9d8a73',glass:'#3a444c',glow:'#ffe4c2',grid:[1.8,3.2,.1,.16]},
  dark:{frame:'#2b2f39',glass:'#1a232d',glow:'#d6e2ff',grid:[1.2,3.6,.04,.08],gloss:.7},
};
const STRIP_MODES={steady:0,chase:1,twinkle:2};
/** The city's light show: every `every` seconds a wave of colour runs through every outline, in
 *  from the bay at `speed` metres a second for `length` seconds. */
const SHOW={every:150,length:24,speed:9};
/** How many rooms are lit, by the hour: people home in the evening, fewer as the night goes on. */
const LIT=[[0,.36],[3,.13],[5,.1],[6.5,.3],[17,.34],[19,.84],[22,.64],[24,.36]];
export function litShare(hour){
  const h=((hour%24)+24)%24;
  for(let i=1;i<LIT.length;i++)if(h<=LIT[i][0]){
    const from=LIT[i-1],to=LIT[i];return from[1]+(to[1]-from[1])*(h-from[0])/(to[0]-from[0]);
  }
  return LIT[0][1];
}

// The shader chunks. Every one of them starts with the same helpers, defined once per shader.
const HELPERS=`
#ifndef CITY_HELPERS
#define CITY_HELPERS
uniform vec4 city_clock;
uniform vec3 city_origin;
float cityHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec3 cityHue(float h){return clamp(abs(fract(h+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0)-1.0,0.0,1.0);}
vec3 cityNormal(){
#ifdef LIT_NEEDS_NORMAL
  return normalize(vNormalW);
#else
  return vec3(0.0,0.0,1.0);
#endif
}
#if CITY_LED == 1
uniform vec4 window_grid;
vec3 cityCell;vec2 cityIn;float cityPane;
// Which window of which facade this pixel is in: along the face and up by storeys, and which face
// (half a metre inside it, so a face never sits on the line between two).
void cityWindow(){
  vec3 p=vPositionW-city_origin,n=cityNormal();
  bool x=abs(n.x)>abs(n.z);
  float along=x?p.z:p.x,across=x?p.x-n.x*.5:p.z-n.z*.5;
  vec2 c=vec2(along/window_grid.x,p.y/window_grid.y);
  cityCell=vec3(floor(c),floor(across*.3183));cityIn=fract(c);
  vec2 m=step(window_grid.zw,cityIn)*step(cityIn,1.0-window_grid.zw);
  cityPane=m.x*m.y*step(abs(n.y),.5);
}
#endif
#endif
`;
const EMISSION='uniform vec3 material_emissive;\nuniform float material_emissiveIntensity;\n';
const GLAZE_DIFFUSE=HELPERS+`
uniform vec3 material_diffuse;
uniform vec3 window_glass;
void getAlbedo(){
  cityWindow();
  float r=cityHash(cityCell.xy+cityCell.z*7.13);
  dAlbedo=mix(material_diffuse,window_glass*(.75+.5*r),cityPane);
}
`;
const GLAZE_EMISSIVE=HELPERS+EMISSION+`
void getEmission(){
  cityWindow();
  float r=cityHash(cityCell.xy+cityCell.z*7.13),r2=cityHash(cityCell.yx*1.37+cityCell.z*3.1+11.0);
  // Each room is lit or not by its own roll of the dice, rolled again now and then.
  float roll=floor(city_clock.z+r2*9.0);
  float lit=step(cityHash(vec2(r*97.0+roll,roll*.37+cityCell.z)),city_clock.y);
  vec3 tint=r2<.5?vec3(1.0,.72,.42):(r2<.86?vec3(1.0,.9,.74):vec3(.66,.8,1.0));
  // A television: a few rooms flicker blue.
  float tv=step(.95,r);
  tint=mix(tint,vec3(.45,.6,1.0)*(.65+.35*sin(city_clock.x*7.0+r2*40.0)*sin(city_clock.x*3.1+r*25.0)),tv);
  // Brighter in the middle of the room and under its ceiling light than at the frame.
  vec2 q=(cityIn-window_grid.zw)/max(1.0-2.0*window_grid.zw,vec2(.01));
  float glow=(.45+.55*r2)*(.55+.45*smoothstep(0.0,.4,min(q.x,1.0-q.x)))*(.7+.3*q.y);
  dEmission=material_emissive*material_emissiveIntensity*tint*(lit*cityPane*glow*.62);
}
`;
const STRIP=HELPERS+EMISSION+`
uniform vec4 strip_style;
void getEmission(){
  vec3 p=vPositionW-city_origin;
  float along=p.x+p.y+p.z,b;
  vec3 tint=vec3(1.0);
  if(strip_style.x<.5){
    // Steady, breathing a little; and when the light show's wave passes, a band of colour.
    b=.82+.18*sin(along*.6-city_clock.x*1.2+strip_style.w*6.3);
    float wave=exp(-pow((p.z+80.0-city_clock.w)/7.0,2.0));
    tint=mix(tint,cityHue(fract(city_clock.w*.004+p.y*.012))*1.8,wave);
    b+=wave;
  }else if(strip_style.x<1.5){
    // Bulbs, every third one lit, marching along.
    float c=along/strip_style.y,k=floor(c);
    float on=1.0-step(.2,fract((k-floor(city_clock.x*strip_style.z))/3.0));
    b=(1.0-smoothstep(.15,.45,abs(fract(c)-.5)))*(.3+1.2*on);
  }else{
    float k=floor(along/strip_style.y);
    b=.3+1.1*step(.85,cityHash(vec2(k,floor(city_clock.x*strip_style.z+cityHash(vec2(k,strip_style.w))*9.0))));
  }
  dEmission=material_emissive*material_emissiveIntensity*tint*b;
}
`;
const UPLIGHT=HELPERS+EMISSION+`
void getEmission(){
  dBlendModeFogFactor=0.0;
  dEmission=vec3(0.0);
#ifdef STD_EMISSIVE_TEXTURE
  vec2 uv={STD_EMISSIVE_TEXTURE_UV};
  // Narrow and bright at the lamp, spreading and fading as it climbs.
  float u=uv.x-.5,v=clamp(uv.y,0.0,1.0);
  float fan=exp(-u*u/(.004+.09*v))*pow(1.0-v,1.5)*step(abs(cityNormal().y),.5);
  dEmission=material_emissive*material_emissiveIntensity*fan*.8;
#endif
}
`;
const BEAM=HELPERS+EMISSION+`
void getEmission(){
  vec3 n=cityNormal(),v=normalize(view_position-vPositionW);
  float fall=1.0;
#ifdef STD_EMISSIVE_TEXTURE
  fall=texture2DBias({STD_EMISSIVE_TEXTURE_NAME},{STD_EMISSIVE_TEXTURE_UV},textureBias).r;
#endif
  dBlendModeFogFactor=0.0;
  dEmission=material_emissive*material_emissiveIntensity*pow(abs(dot(n,v)),3.0)*fall*.28;
}
`;
const MEDIA=HELPERS+EMISSION+`
uniform vec4 media_grid;
void getEmission(){
  dEmission=vec3(0.0);
#ifdef STD_EMISSIVE_TEXTURE
  vec2 uv={STD_EMISSIVE_TEXTURE_UV};
  vec2 g=uv*media_grid.xy,cell=floor(g),gf=fract(g)-.5;
  // Round LEDs up close; far off, where a pixel covers several, their average.
  float px=max(fwidth(g.x),fwidth(g.y));
  float led=mix(1.0-smoothstep(.2,.5,length(gf)),.6,clamp(px*2.0-.5,0.0,1.0));
  float ch=texture2DBias({STD_EMISSIVE_TEXTURE_NAME},(cell+.5)/media_grid.xy,textureBias).r;
  float t=city_clock.x+media_grid.z*43.0,ph=fract(t/10.0),prog=mod(floor(t/10.0),4.0);
  vec3 col;
  if(prog<.5){
    // A tide of colour; the words in white.
    col=mix(cityHue(fract(uv.x*.5+uv.y*.35-t*.07))*.5,vec3(1.0),ch);
  }else if(prog<1.5){
    // Stars over a night sea; the words in gold.
    float star=step(.955,cityHash(cell+floor(t*2.5)));
    col=vec3(.02,.04,.1)+star*vec3(.8,.9,1.0)+ch*vec3(1.0,.72,.28)*(.8+.2*sin(t*3.0));
  }else if(prog<2.5){
    // Rings spreading from the middle; the words cut out of them.
    float d=length((uv-.5)*vec2(media_grid.x/media_grid.y,1.0));
    col=cityHue(fract(.55+d*.25+t*.04))*(.35+.65*(.5+.5*sin(d*16.0-t*4.0)))*(1.0-ch*.9);
  }else{
    // The words set pixel by pixel, then a sweep of light across them.
    float on=step(cityHash(cell*.73),ph*1.8);
    float sweep=1.0-smoothstep(0.0,.1,abs(uv.x-fract(t*.3)));
    col=vec3(.01,.03,.06)+ch*on*mix(vec3(.25,.85,1.0),vec3(1.0),sweep);
  }
  float fade=smoothstep(0.0,.05,ph)*(1.0-smoothstep(.95,1.0,ph));
  // By day: the words alone, dim and still.
  float day=step(material_emissiveIntensity,.05);
  col=mix(col*mix(.15,1.0,fade),vec3(ch)*.8,day);
  dEmission=col*led*material_emissive*max(material_emissiveIntensity,.4);
#endif
}
`;
const NEON=HELPERS+EMISSION+`
uniform vec4 neon_style;
void getEmission(){
  dEmission=vec3(0.0);
#ifdef STD_EMISSIVE_TEXTURE
  vec3 e=texture2DBias({STD_EMISSIVE_TEXTURE_NAME},{STD_EMISSIVE_TEXTURE_UV},textureBias).rgb;
  float t=city_clock.x+neon_style.x*13.0;
  // A hum, and every so often a stutter for half a second.
  float stutter=fract(t/23.0)>.975?step(.45,cityHash(vec2(floor(t*14.0),neon_style.x))):1.0;
  dEmission=material_emissive*material_emissiveIntensity*e*e*stutter*(.94+.06*sin(t*5.0+neon_style.x*3.0));
#endif
}
`;
