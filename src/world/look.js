import * as pc from 'playcanvas';

/**
 * The Jiangnan look (task W5-look, docs/superpowers/specs/2026-10-01-jiangnan-look-design.md, P0):
 * how the town is lit and finished, and the painted surfaces its pieces can wear.
 *
 * - Light: a hemisphere ambient (the scene's ambient colour, cooler and brighter on what faces the
 *   sky, warmer and darker on what faces the ground), softer sun shadows and a light mist the colour
 *   of the sky.
 * - The post pass (PlayCanvas CameraFrame on the player's camera): neutral tone mapping, bloom for
 *   lanterns and lit windows, ambient occlusion on 高, a warm, slightly faded grade, a soft vignette,
 *   and a painterly finish (a touch of softness and a fine animated grain), as in the game's album
 *   illustrations.
 * - Surfaces: a handful of hand-painted canvas textures drawn once at start, multiplied over the
 *   vertex colours so every existing colour keeps working (src/world/jiangnan.js builds with them).
 *
 * src/core/quality.js RENDER says what each 画质 level turns on (`post`, `ssao`, `textures`); 低 is
 * the look from before: flat colours, no post pass, flat ambient, no mist.
 */
export const LOOK={post:false,textures:false,glow:1};

/** Ambient multipliers for what faces straight up and straight down, and the mist's density. */
const HEMI={sky:new Float32Array([1.08,1.1,1.18]),ground:new Float32Array([.84,.78,.7])},FLAT=new Float32Array([1,1,1]);
const MIST=.0035;
/** How much brighter lamps burn with the post pass on: bloom needs light above white to glow. */
const GLOW=2.4;

/**
 * Swap the engine's flat ambient term for a hemisphere one. Must run before any material compiles
 * its shader (the town does it as it makes its camera). An engine without that exact line keeps its
 * flat ambient, with a warning.
 */
export const FLAT_AMBIENT='dDiffuseLight += light_globalAmbient;';
function hemisphere(device){
  const chunks=pc.ShaderChunks?.get(device,pc.SHADERLANGUAGE_GLSL),code=chunks?.get('ambientPS');
  if(typeof code!=='string'||!code.includes(FLAT_AMBIENT)){console.warn('Hemisphere ambient skipped: no "'+FLAT_AMBIENT+'" in the engine chunk');return false;}
  chunks.set('ambientPS','uniform vec3 hemiSky;\nuniform vec3 hemiGround;\n'+
    code.replace(FLAT_AMBIENT,'dDiffuseLight += light_globalAmbient * mix(hemiGround, hemiSky, worldNormal.y * 0.5 + 0.5);'));
  return true;
}

/**
 * The painterly finish, in the post pass's own hooks (after tone mapping, before gamma): the frame is
 * mixed a little towards a half-pixel blur of itself, finished the same way, and a fine grain that
 * moves with the game's clock is laid over it. `paintParams`: grain, softness, time.
 */
const FINISH_DECLARATIONS=`uniform vec4 paintParams;
float paintNoise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}`;
const FINISH_END=`{
  vec2 o=sceneTextureInvRes*.6;
  vec3 soft=.25*(texture2DLod(sceneTexture,uv+o,0.0).rgb+texture2DLod(sceneTexture,uv-o,0.0).rgb
    +texture2DLod(sceneTexture,uv+vec2(o.x,-o.y),0.0).rgb+texture2DLod(sceneTexture,uv+vec2(-o.x,o.y),0.0).rgb);
  #ifdef SSAO_TEXTURE
    soft=applySsao(soft,uv);
  #endif
  #ifdef BLOOM
    soft=applyBloom(soft,uv);
  #endif
  #ifdef COLOR_ENHANCE
    soft=applyColorEnhance(soft);
  #endif
  #ifdef GRADING
    soft=applyGrading(soft);
  #endif
  soft=toneMap(max(vec3(0.0),soft));
  #ifdef VIGNETTE
    soft=applyVignette(soft,uv);
  #endif
  result=mix(result,soft,paintParams.y);
  result*=1.0+(paintNoise(gl_FragCoord.xy+paintParams.z)-.5)*paintParams.x;
}`;

export class Look {
  /** Made with the town's camera and sun, before anything is drawn. */
  constructor(town){
    const app=town.app,device=app.graphicsDevice,main=town.camera.camera;
    this.app=app;this.camera=main;this.sun=town.sun.light;this.frame=null;this.time=0;
    hemisphere(device);
    const chunks=pc.ShaderChunks?.get(device,pc.SHADERLANGUAGE_GLSL);
    chunks?.set('composeDeclarationsPS',FINISH_DECLARATIONS);chunks?.set('composeMainEndPS',FINISH_END);
    const scope=device.scope;
    this.sky=scope.resolve('hemiSky');this.ground=scope.resolve('hemiGround');this.finish=scope.resolve('paintParams');
    this.params=new Float32Array([.07,.25,0,0]);
    this.sky.setValue(FLAT);this.ground.setValue(FLAT);
    // The grain moves with the game's clock, so it holds still when the game does.
    app.on('update',dt=>{this.time=(this.time+dt)%1000;});
    app.on('prerender',()=>{this.params[2]=Math.floor(this.time*24)%97;this.finish.setValue(this.params);});
    // A camera that draws into a texture the player's view then shows (a street through a doorway,
    // src/world/views.js; a mirror, src/world/mirror.js; the bay, src/world/bay.js) hands its picture
    // over linear while the post pass is on, as the main view's own scene pass draws, so the post pass
    // tone-maps and grades it once with everything else and a portal looks like the world around it.
    // With the post pass off each keeps the tone mapping and gamma it was made with.
    const own=new WeakMap();
    app.scene.on('prerender',camera=>{
      if(camera===main||!camera.renderTarget)return;
      if(!own.has(camera))own.set(camera,[camera.toneMapping,camera.gammaCorrection]);
      const [tone,gamma]=LOOK.post?[pc.TONEMAP_NONE,pc.GAMMA_NONE]:own.get(camera);
      if(camera.toneMapping!==tone)camera.toneMapping=tone;
      if(camera.gammaCorrection!==gamma)camera.gammaCorrection=gamma;
    });
  }

  /** A graphics level's row of RENDER (src/core/quality.js): at start and whenever the level changes. */
  apply(r){
    const post=!!r.post,app=this.app,main=this.camera,fog=app.scene.fog;
    LOOK.post=post;LOOK.glow=post?GLOW:1;
    this.sky.setValue(post?HEMI.sky:FLAT);this.ground.setValue(post?HEMI.ground:FLAT);
    // The mist is the sky's own colour (the daylight keeps that Color up to date); 云海's camera has a haze of its own.
    fog.color=main.clearColor;fog.density=MIST;fog.type=post?pc.FOG_EXP2:pc.FOG_NONE;
    this.sun.shadowIntensity=post?.82:1;
    if(post){
      const f=this.frame??=new pc.CameraFrame(app,main),device=app.graphicsDevice;
      f.enabled=true;
      f.rendering.toneMapping=pc.TONEMAP_NEUTRAL;
      // The scene draws into the frame's own target, so that is where the edges are smoothed.
      f.rendering.samples=r.msaa?Math.min(4,device.maxSamples||1):1;
      f.bloom.intensity=.02;f.bloom.blurLevel=16;
      Object.assign(f.grading,{enabled:true,brightness:1.04,contrast:1,saturation:1});f.grading.tint.set(1.02,1,.97);
      Object.assign(f.colorEnhance,{enabled:true,shadows:.12,highlights:0,vibrance:.12,midtones:0,dehaze:0});
      Object.assign(f.vignette,{intensity:.22,inner:.45,outer:1.25,curvature:.6});
      Object.assign(f.ssao,r.ssao?{type:pc.SSAOTYPE_LIGHTING,radius:1.1,intensity:.7,power:1.4,samples:12,minAngle:12,scale:.5,blurEnabled:true}
        :{type:pc.SSAOTYPE_NONE});
      f.update();
    } else if(this.frame)this.frame.enabled=false;
    textured(!!r.textures);
  }
}

/**
 * The painted surfaces: what each looks like, how many metres one repeat of its texture covers, how
 * glossy it is, and whether its grain runs along a piece's length (wood). Eight textures in all.
 */
export const SURFACES={
  plaster:{metres:2.4,gloss:.06,size:256},
  wood:{metres:1.1,gloss:.24,size:256,grain:true},
  tile:{metres:1,gloss:.3,size:256},
  stone:{metres:2,gloss:.16,size:256},
  cloth:{metres:.45,gloss:.05,size:128},
  paper:{metres:.6,gloss:.04,size:128},
  soft:{metres:.5,gloss:.12,size:128},
  print:{metres:.36,gloss:.06,size:128},
};
/** Where a piece that should wear none of a pattern samples a surface: the print's plain corner. */
export const PLAIN_UV=[3/128,3/128];
const textures=new Map(),dressed=new Map();
/** A surface's texture, drawn the first time it is wanted. */
export function surfaceTexture(device,kind){
  if(!textures.has(kind)){
    const S=SURFACES[kind].size,canvas=document.createElement('canvas');canvas.width=canvas.height=S;
    let seed=[...kind].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
    const r=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
    PAINT[kind](canvas.getContext('2d'),S,r);
    const texture=new pc.Texture(device,{name:'surface-'+kind,mipmaps:true,anisotropy:8,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT});
    texture.setSource(canvas);textures.set(kind,texture);
  }
  return textures.get(kind);
}
/** Let a material wear a surface's texture whenever textures are on (中 and 高); off, it is exactly as it was made. */
export function paint(material,kind){
  if(!dressed.has(material))dressed.set(material,{kind,gloss:material.gloss});
  wear(material,dressed.get(material));
  return material;
}
const shared=new Map();
/** The one vertex-colour material that wears `kind`: parts drawn with it batch together. */
export function surface(kind){
  if(!shared.has(kind)){
    const m=new pc.StandardMaterial();m.name='surface-'+kind;
    Object.assign(m,{diffuseVertexColor:true,vertexColorGamma:true,useMetalness:true,metalness:0,gloss:.1});
    shared.set(kind,paint(m,kind));
  }
  return shared.get(kind);
}
function wear(m,{kind,gloss}){
  const on=LOOK.textures;
  m.diffuseMap=on?surfaceTexture(pc.AppBase.getApplication().graphicsDevice,kind):null;
  m.gloss=on?SURFACES[kind].gloss:gloss;
  m.update();
}
function textured(on){
  if(LOOK.textures===on)return;
  LOOK.textures=on;
  for(const [m,how] of dressed)wear(m,how);
}

// The painting, on a canvas S pixels square. Every shape is drawn at its own place and one repeat
// over in each direction, so the texture tiles without a seam. The values are multipliers of the
// vertex colour (a little under 1 on average): light, soft and brushy, never photographic.
const wrapped=(S,shape)=>{for(const dx of [-S,0,S])for(const dy of [-S,0,S])shape(dx,dy);};
const grey=t=>{const v=Math.round(Math.max(0,Math.min(1,t))*255);return `rgb(${v},${v},${v})`;};
/** Soft round patches a little lighter or darker, warm or cool. */
function blotches(c,S,r,n,min,max,spread){
  for(let i=0;i<n;i++){
    const x=r()*S,y=r()*S,rad=S*(min+r()*(max-min)),a=r()*spread;
    const tint=r()<.5?(r()<.5?'255,246,228':'236,244,255'):(r()<.5?'74,56,40':'50,58,68');
    wrapped(S,(dx,dy)=>{
      const g=c.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,rad);
      g.addColorStop(0,`rgba(${tint},${a})`);g.addColorStop(1,`rgba(${tint},0)`);
      c.fillStyle=g;c.fillRect(x+dx-rad,y+dy-rad,rad*2,rad*2);
    });
  }
}
/** Brush strokes of about `len` pixels, roughly at `angle`, lighter and darker. */
function strokes(c,S,r,n,len,width,alpha,angle,spread=.4){
  c.lineCap='round';
  for(let i=0;i<n;i++){
    const x=r()*S,y=r()*S,a=angle+(r()-.5)*spread,l=len*(.5+r()),ex=Math.cos(a)*l/2,ey=Math.sin(a)*l/2;
    c.strokeStyle=r()<.5?`rgba(255,250,240,${alpha*r()})`:`rgba(44,34,26,${alpha*r()})`;c.lineWidth=width*(.5+r());
    wrapped(S,(dx,dy)=>{c.beginPath();c.moveTo(x-ex+dx,y-ey+dy);c.lineTo(x+ex+dx,y+ey+dy);c.stroke();});
  }
}
/** A fine grain over every pixel. */
function grain(c,S,r,amount){
  const img=c.getImageData(0,0,S,S),d=img.data;
  for(let i=0;i<d.length;i+=4){const k=(r()-.5)*amount;d[i]+=k;d[i+1]+=k;d[i+2]+=k;}
  c.putImageData(img,0,0);
}
const PAINT={
  // Lime plaster: soft stains, faint streaks where rain ran down, trowel marks.
  plaster(c,S,r){
    c.fillStyle=grey(.96);c.fillRect(0,0,S,S);
    blotches(c,S,r,28,.08,.3,.09);
    for(let i=0;i<16;i++){
      const x=r()*S,y=r()*S,len=S*(.2+r()*.5),w=2+r()*6,a=.03+r()*.06;
      wrapped(S,(dx,dy)=>{const g=c.createLinearGradient(0,y+dy,0,y+dy+len);g.addColorStop(0,`rgba(72,68,60,${a})`);g.addColorStop(1,'rgba(72,68,60,0)');
        c.fillStyle=g;c.fillRect(x+dx-w/2,y+dy,w,len);});
    }
    strokes(c,S,r,70,S*.12,5,.022,0,.3);
    grain(c,S,r,6);
  },
  // Timber: broad bands and wavy grain lines along its length (v), a knot or two.
  wood(c,S,r){
    c.fillStyle=grey(.9);c.fillRect(0,0,S,S);
    for(let i=0;i<12;i++){
      const x=r()*S,w=S*(.03+r()*.12),a=.05+r()*.09,dark=r()<.6;
      wrapped(S,dx=>{c.fillStyle=dark?`rgba(64,42,24,${a*.6})`:`rgba(255,242,222,${a*.6})`;c.fillRect(x+dx,0,w,S);});
    }
    for(let i=0;i<60;i++){
      const x0=r()*S,amp=1+r()*3,f=(1+Math.floor(r()*3))*2*Math.PI/S,ph=r()*6.28;
      c.strokeStyle=`rgba(62,40,22,${.03+r()*.09})`;c.lineWidth=.5+r()*1.1;
      wrapped(S,dx=>{c.beginPath();for(let y=0;y<=S;y+=4){const x=x0+dx+Math.sin(y*f+ph)*amp;y?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();});
    }
    for(let i=0;i<2;i++){
      const x=r()*S,y=r()*S;
      for(let k=4;k>0;k--)wrapped(S,(dx,dy)=>{c.strokeStyle=`rgba(72,46,26,${.1+.04*k})`;c.lineWidth=1.2;c.beginPath();c.ellipse(x+dx,y+dy,k*2.2,k*5.5,0,0,Math.PI*2);c.stroke();});
    }
    grain(c,S,r,9);
  },
  // Roof tiles, one metre a repeat: four channels of hollow pan tiles, lighter where they dip, under
  // rounded cover tiles with a highlight down the crown; five courses, each lapped by the one above.
  tile(c,S,r){
    c.fillStyle=grey(.8);c.fillRect(0,0,S,S);
    const n=4,cw=S/n,ch=S/5,pan=cw*.64;
    for(let i=0;i<n;i++){
      const x=i*cw;
      for(let k=0;k<5;k++){
        const y=k*ch,t=.84+r()*.1,g=c.createLinearGradient(x,0,x+pan,0);
        g.addColorStop(0,grey(t-.16));g.addColorStop(.5,grey(t));g.addColorStop(1,grey(t-.12));
        c.fillStyle=g;c.fillRect(x,y,pan,ch);
        c.fillStyle='rgba(24,24,28,.4)';c.fillRect(x,y,pan,3);
        c.fillStyle='rgba(255,255,255,.14)';c.fillRect(x,y+3,pan,2);
      }
      const cx=x+pan,cwid=cw-pan,g=c.createLinearGradient(cx,0,cx+cwid,0);
      g.addColorStop(0,grey(.42));g.addColorStop(.45,grey(.82));g.addColorStop(1,grey(.38));
      c.fillStyle=g;c.fillRect(cx,0,cwid,S);
      for(let k=0;k<5;k++){c.fillStyle='rgba(24,24,28,.32)';c.fillRect(cx,k*ch+ch*.5,cwid,2);}
    }
    blotches(c,S,r,16,.05,.16,.1);
    grain(c,S,r,10);
  },
  // Bluestone slabs, two metres a repeat: staggered rows with dark joints, each slab its own tone,
  // its corners worn round, speckled and weathered.
  stone(c,S,r){
    c.fillStyle=grey(.44);c.fillRect(0,0,S,S);
    const rows=5,rh=S/rows;
    for(let k=0;k<rows;k++){
      let x=r()*S;const end=x+S;
      while(x<end-1){
        let len=S*(.22+r()*.2);if(end-x-len<S*.12)len=end-x;
        const t=.8+r()*.14,x0=x,y0=k*rh;
        wrapped(S,dx=>{
          c.fillStyle=grey(t);c.beginPath();c.roundRect(x0+dx+1.5,y0+1.5,len-3,rh-3,5);c.fill();
          c.fillStyle='rgba(255,255,255,.1)';c.fillRect(x0+dx+4,y0+2.5,len-8,2);
          c.fillStyle='rgba(30,30,34,.12)';c.fillRect(x0+dx+4,y0+rh-5,len-8,2);
        });
        x+=len;
      }
    }
    blotches(c,S,r,30,.03,.12,.14);
    for(let i=0;i<500;i++){const x=r()*S,y=r()*S;c.fillStyle=r()<.5?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)';c.fillRect(x,y,1+r()*2,1+r()*2);}
    grain(c,S,r,12);
  },
  // Woven cloth: a fine warp and weft, softly mottled.
  cloth(c,S,r){
    c.fillStyle=grey(.95);c.fillRect(0,0,S,S);
    for(let y=0;y<S;y+=2){c.fillStyle=`rgba(0,0,0,${.03+r()*.04})`;c.fillRect(0,y,S,1);}
    for(let x=0;x<S;x+=2){c.fillStyle=`rgba(255,255,255,${.03+r()*.05})`;c.fillRect(x,0,1,S);}
    blotches(c,S,r,10,.15,.4,.08);
    grain(c,S,r,8);
  },
  // Paper: short fibres every way, gently mottled.
  paper(c,S,r){
    c.fillStyle=grey(.96);c.fillRect(0,0,S,S);
    strokes(c,S,r,160,10,1,.14,0,Math.PI*2);
    blotches(c,S,r,10,.1,.35,.07);
    grain(c,S,r,6);
  },
  // A soft painted finish for skin, hair and small plain things: gentle patches and long strokes.
  soft(c,S,r){
    c.fillStyle=grey(.98);c.fillRect(0,0,S,S);
    blotches(c,S,r,24,.1,.35,.06);
    strokes(c,S,r,50,S*.12,6,.02,0,Math.PI*2);
    grain(c,S,r,5);
  },
  // Indigo-dyed print (蓝印花布) for Qinghe's clothes (src/world/people.js): a lattice of fine lighter
  // lines with a dot where they cross, on a slightly darker woven ground. The top-left corner is plain
  // white (PLAIN_UV): skin, hair and straw on the same mesh sample just there and wear no print.
  print(c,S,r){
    c.fillStyle=grey(.9);c.fillRect(0,0,S,S);
    for(let y=0;y<S;y+=2){c.fillStyle=`rgba(0,0,0,${.02+r()*.03})`;c.fillRect(0,y,S,1);}
    const n=4,step=S/n;
    c.strokeStyle='rgba(255,255,255,.24)';c.lineWidth=1.3;
    for(let i=-n;i<=n;i++)for(const [y0,y1] of [[0,S],[S,0]]){c.beginPath();c.moveTo(i*step,y0);c.lineTo(i*step+S,y1);c.stroke();}
    for(let a=0;a<=2*n;a++)for(let b=0;b<=2*n;b++)if((a+b)%2===0){
      c.fillStyle=`rgba(255,255,255,${.45+r()*.2})`;c.beginPath();c.arc(a*step/2,b*step/2,2.2,0,Math.PI*2);c.fill();
    }
    blotches(c,S,r,8,.15,.4,.06);
    grain(c,S,r,6);
    c.fillStyle=grey(1);c.fillRect(0,0,6,6);
  },
};
