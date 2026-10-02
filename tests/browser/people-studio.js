// The test-only people studio (people-studio.html): the people of src/content/people.json as the
// reference sheets show them, on a neutral grey floor and backdrop in soft light, through the game's
// post pass at 高 (src/world/look.js). `studio.show(sheet)` lines up one sheet's people where the sheet
// has them; the camera is set so a sheet's figures land on its pixels when the page is the sheet's size.
import * as pc from 'playcanvas';
import {Look} from '../../src/world/look.js';
import {RENDER} from '../../src/core/quality.js';
import {createModels} from '../../src/world/models.js';

const app=new pc.Application(document.getElementById('studio'),{graphicsDeviceOptions:{antialias:true,alpha:false}});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);app.setCanvasResolution(pc.RESOLUTION_AUTO);
addEventListener('resize',()=>app.resizeCanvas());
app.scene.ambientLight=new pc.Color(.62,.63,.65);
const sun=new pc.Entity('sun');sun.addComponent('light',{type:'directional',color:new pc.Color(1,.98,.94),intensity:.95,castShadows:true,
  shadowDistance:16,shadowResolution:2048,shadowBias:.25,normalOffsetBias:.06,shadowType:pc.SHADOW_PCF5_32F});
sun.setEulerAngles(58,-12,0);app.root.addChild(sun);   // high and from the front, as the sheets are lit
const camera=new pc.Entity('camera');camera.addComponent('camera',{clearColor:new pc.Color(.62,.63,.65),fov:12,nearClip:.5,farClip:60});app.root.addChild(camera);
const look=new Look({app,camera,sun});look.apply(RENDER.high);
const models=createModels(app);
app.start();

// The backdrop: a floor and a wall behind, plain neutral grey.
for(const [pos,scale,hex] of [[[0,-.05,0],[30,.1,14],'#b2b4b8'],[[0,6,-4],[30,12,.1],'#9b9da1']]){
  const grey=new pc.StandardMaterial();grey.diffuse=new pc.Color().fromString(hex);grey.gloss=.05;grey.update();
  const e=new pc.Entity();e.addComponent('render',{type:'box',material:grey,castShadows:false});e.setLocalPosition(...pos);e.setLocalScale(...scale);app.root.addChild(e);
}

/**
 * The sheets: their size in pixels, how many metres high they show at the figures, where the camera's
 * eye level falls (metres above the floor), and the people across them: [archetype, x in metres, turn].
 * Measured off the sheets: the tourist is 1.90 m (738 px), the city lineup's young man 1.895 m.
 */
const SHEETS={
  turnaround:{size:[1774,887],high:2.284,eye:.87,people:[['tourist',-1.568,0],['tourist',-.585,90],['tourist',.476,180],['tourist',1.566,32]]},
  lineup:{size:[1983,793],high:2.197,eye:.951,people:[['grandpa',-2.165,18],['grandma',-1.215,18],['young-woman',-.392,18],['young-man',.514,18],['girl',1.464,18],['boy',2.281,18]]},
  village:{size:[1983,793],high:2.197,eye:.951,people:[['v-grandpa',-2.17,18],['v-grandma',-1.22,18],['v-young-woman',-.38,18],['v-young-man',.52,18],['v-girl',1.46,18],['v-boy',2.33,18]]},
  // Sitting on the game's own seats (models.js fittings), from the front and from the side.
  'seated-front':{size:[1600,700],high:2.1,eye:.75,people:[['tourist',-2.1,0,'diningchair'],['v-grandpa',-.7,0,'stool'],['young-woman',.7,0,'bench'],['v-girl',2.1,0,'sofa']]},
  'seated-side':{size:[1600,700],high:2.1,eye:.75,people:[['tourist',-2.1,90,'diningchair'],['v-grandpa',-.7,90,'stool'],['young-woman',.7,90,'bench'],['v-girl',2.1,90,'sofa']]},
};
const stage=new pc.Entity('stage');app.root.addChild(stage);
const frames=async(k=3)=>{for(let i=0;i<k;i++)await new Promise(r=>requestAnimationFrame(r));};
/** What a person costs: draw calls (mesh instances drawn), triangles and shadow casters. */
function cost(e){
  let calls=0,triangles=0,shadows=0;
  e.forEach(n=>{if(!n.enabled||!n.render)return;for(const mi of n.render.meshInstances){calls++;triangles+=mi.mesh.primitive[0].count/3;if(n.render.castShadows)shadows++;}});
  return {calls,triangles,shadows};
}
/** Put a sheet's people on the stage and the camera where the sheet's was; `distance` how far back it stands. */
async function show(name,{distance=40,empty=false}={}){
  const sheet=SHEETS[name];
  for(const child of [...stage.children])child.destroy();
  const built=(empty?[]:sheet.people).map(([archetype,x,turn,seat])=>{
    const p=models.person(stage,null,[x,0,0],false,0,{archetype,props:!seat});p.entity.setLocalEulerAngles(0,turn,0);
    if(seat){
      const f=models.fitting(stage,seat);f.entity.setLocalPosition(x,0,0);f.entity.setLocalEulerAngles(0,turn,0);
      p.entity.setLocalPosition(x,f.seat-p.seatDrop,0);p.sit(f.seat,{front:f.front});
    }
    return {archetype,...cost(p.entity)};
  });
  camera.camera.fov=2*Math.atan(sheet.high/2/distance)*180/Math.PI;
  camera.setPosition(0,sheet.eye,distance);camera.lookAt(0,sheet.eye,0);
  await frames(24);   // the post pass and the sun's shadow map settle over a few frames
  return built;
}
window.studio={ready:true,show,SHEETS,stage,models,pc};   // stage, models and pc for a spec's own poses
