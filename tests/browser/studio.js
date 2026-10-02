// The test-only model studio (studio.html): each Blender model (right of a pair) beside the
// code-built version from src/world/jiangnan.js (left), on a neutral floor in the game's look at 高.
import * as pc from 'playcanvas';
import MODELS from '../../src/content/models.json' with {type:'json'};
import {Look} from '../../src/world/look.js';
import {RENDER} from '../../src/core/quality.js';
import {createModels} from '../../src/world/models.js';
import {Kit,silkLantern,jar,teapot,bowls,latticeWindow} from '../../src/world/jiangnan.js';
import {Assets} from '../../src/world/assets.js';
import {assetUrl} from '../../src/services/asset-url.js';

const app=new pc.Application(document.getElementById('studio'),{graphicsDeviceOptions:{antialias:true,alpha:false}});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.scene.ambientLight=new pc.Color(.59,.62,.58);
const sun=new pc.Entity('sun');sun.addComponent('light',{type:'directional',color:new pc.Color(1,.96,.88),intensity:1.05,castShadows:true,
  shadowDistance:20,shadowResolution:2048,shadowBias:.25,normalOffsetBias:.08,shadowType:pc.SHADOW_PCF5_32F});
sun.setEulerAngles(48,-25,0);app.root.addChild(sun);
const camera=new pc.Entity('camera');camera.addComponent('camera',{clearColor:new pc.Color(.77,.79,.78),fov:43,nearClip:.05,farClip:60});app.root.addChild(camera);
const look=new Look({app,camera,sun});look.apply(RENDER.high);
const models=createModels(app),assets=new Assets(app);
app.start();

// The backdrop: a floor and a wall, plain warm grey.
const backdrop=new pc.StandardMaterial();backdrop.diffuse=new pc.Color().fromString('#b9b3a8');backdrop.gloss=.1;backdrop.update();
for(const [pos,scale] of [[[0,-.05,0],[14,.1,8]],[[0,2,-1.6],[14,4,.1]]]){
  const e=new pc.Entity();e.addComponent('render',{type:'box',material:backdrop});e.setLocalPosition(...pos);e.setLocalScale(...scale);app.root.addChild(e);
}

// The pairs: [model, x of the code-built one, x of the Blender one, y of the Blender one, close-up centre y, distance].
const PAIRS={'lattice-window':[-3.15,-2.05,0,.6,2.6],lantern:[-1.35,-.65,.82,1.4,2],jars:[.15,.9,0,.25,1.5],steamer:[1.75,2.2,0,.16,1.1],teaset:[2.75,3.25,0,.08,.85]};
const code=new pc.Entity('code-built');app.root.addChild(code);
const lit=new pc.StandardMaterial();
Object.assign(lit,{diffuse:new pc.Color().fromString('#c8402f'),emissive:new pc.Color().fromString('#c8402f'),emissiveIntensity:.55,diffuseVertexColor:true,
  vertexColorGamma:true,emissiveVertexColor:true,useMetalness:true,metalness:0,gloss:.15});lit.update();
{
  const kit=()=>new Kit(models.painted),labels=kit();
  const win=kit(),paper=kit();latticeWindow(win,paper,PAIRS['lattice-window'][0],.6,0,.72,1.02);win.build(code,'window');paper.build(code,'window-paper');
  const lan=kit(),silk=kit();silkLantern(lan,silk,PAIRS.lantern[0],2,0,lit,1);lan.build(code,'lantern');silk.build(code,'lantern-silk');
  // The same three jars, sizes and colours as the Blender recipe (Blender y is the game's -z).
  const jars=kit(),x=PAIRS.jars[0];
  jar(jars,labels,[x-.12,0,-.06],.17,.42,'#6b4a33');jar(jars,labels,[x+.17,0,-.1],.13,.3,'#9db8a6');jar(jars,labels,[x+.06,0,.17],.1,.23,'#eceee9',{band:true});
  jars.build(code,'jars');
  // The steamer stack as the jiangnan shop hangs it.
  const st=kit(),sx=PAIRS.steamer[0];
  for(let i=0;i<3;i++)st.turn([sx,i*.1,0],[[0,0],[.17,0],[.17,0],[.17,.09],[.17,.09],[0,.09]],'#c8a66a',{kind:'wood',seg:16});
  st.turn([sx,.3,0],[[0,0],[.15,.03],[0,.05]],'#c8a66a',{kind:'wood',seg:12});st.build(code,'steamer');
  const tea=kit(),tx=PAIRS.teaset[0];teapot(tea,[tx-.08,0,-.02],.065,'#6e4234');
  for(const [dx,dz] of [[.07,.055],[.135,.055],[.07,-.055],[.135,-.055]])bowls(tea,[tx+dx,0,dz],.03,1,'#eceee9');
  tea.build(code,'teaset');labels.build(code,'labels');
}

// Load times are taken once the first frames (and their shaders) are done, so they are the loads alone.
const frames=async(k=3)=>{for(let i=0;i<k;i++)await new Promise(r=>requestAnimationFrame(r));};
await frames(10);
const stats={},blender=new pc.Entity('blender');app.root.addChild(blender);
const triangles=e=>e.findComponents('render').reduce((n,r)=>n+r.meshInstances.reduce((m,mi)=>m+mi.mesh.primitive[0].count/3,0),0);
for(const [name,[,x,y]] of Object.entries(PAIRS)){
  const t0=performance.now(),loaded=await assets.load(name),loadMs=performance.now()-t0;
  const e=await assets.spawn(name,blender,{at:[x,y,0]});
  const url=new URL(assetUrl('models/'+MODELS.models[name].file),location.href).href;
  stats[name]={loadMs:Math.round(loadMs),bytes:performance.getEntriesByName(url)[0]?.decodedBodySize??null,triangles:triangles(e),
    materials:e.findComponents('render').flatMap(r=>r.meshInstances.map(mi=>mi.material.name)),container:!!loaded};
}

const OVERVIEW={centre:[.05,.7,0],distance:7.2};
/** Point the camera: at the whole studio, or at one pair. */
function view(name='overview'){
  const [cx,cy,d]=name==='overview'?[OVERVIEW.centre[0],OVERVIEW.centre[1],OVERVIEW.distance]:[(PAIRS[name][0]+PAIRS[name][1])/2,PAIRS[name][3],PAIRS[name][4]];
  camera.setPosition(cx,cy+d*.32,d);camera.lookAt(cx,cy,0);
}
/**
 * Draw calls for `n` copies of a model (no shadows, so only the copies count): one alone, n spawned
 * apart, n in a static batch group, n hardware-instanced. Each is over the studio's own baseline.
 */
async function measure(name,n=12){
  view('overview');const spot=new pc.Entity('measure');app.root.addChild(spot);spot.setPosition(0,0,1.6);
  const calls=()=>app.stats.drawCalls.total,place=i=>({at:[(i%6-2.5)*.6,0,Math.floor(i/6)*.6],rot:[0,i*37,0],shadows:false});
  await frames();const base=calls(),out={};
  const run=async(key,make)=>{const made=await make();await frames();out[key]=calls()-base;for(const e of [made].flat())e.destroy();await frames();};
  await run('single',()=>assets.spawn(name,spot,place(0)));
  await run('separate',()=>Promise.all([...Array(n)].map((_,i)=>assets.spawn(name,spot,place(i)))));
  const group=app.batcher.addGroup('measure-'+name,false,100);
  await run('batched',()=>Promise.all([...Array(n)].map((_,i)=>assets.spawn(name,spot,{...place(i),batch:group.id}))));
  app.batcher.removeGroup(group.id);
  await run('instanced',()=>assets.instances(name,spot,[...Array(n)].map((_,i)=>place(i)),{shadows:false}));
  spot.destroy();
  return out;
}
view();await frames(10);
window.studio={app,assets,MODELS,stats,view,measure,frames,ready:true};
