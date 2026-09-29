import * as pc from 'playcanvas';

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
export function createLeds(models){
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

  // What moves goes straight into the uniforms, from arrays made here once: update() on a
  // StandardMaterial rebuilds every uniform it has, and allocates doing it. A map transform is the
  // engine's own pair of rows, [tiling.x, 0, offset.x] and [0, tiling.y, 1 - tiling.y - offset.y];
  // colours are linear. The daylight's own update() (when a lamp dims) is overwritten each frame.
  const runRows=[new Float32Array([2,0,0]),new Float32Array([0,1,0])];
  const climbRows=[new Float32Array([1,0,0]),new Float32Array([0,6,-5])];
  const washColours=washes.map(()=>new Float32Array(3));
  const beaconColours=[new Float32Array([.002,0,0]),new Float32Array([1,.023,.006])];   // off, on
  let clock=0,run=0,climb=0;
  function update(dt){
    if(!(runner.emissiveIntensity>0))return;                 // by day the LEDs are off: nothing to move
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
  return {lamps,runner,climber,washes,beacon,light,windows,text,piece,update};
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
