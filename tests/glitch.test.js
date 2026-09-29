import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as pc from 'playcanvas';
import {Daylight,SUN_TURNS_WITHIN,SUN_STEP_HOURS} from '../src/world/daylight.js';
import {VIEWS,nearReach,cameraRelative,ENGINE_PROJECTION,CAMERA_RELATIVE} from '../src/world/town.js';

// Shadow texels are snapped to a grid through the world origin, so a sun that turns every frame
// makes shadow edges flicker in places kilometres out (rooms, 云海). There it turns in steps.
test('the sun follows the clock in town, and turns in half-hour steps far from the origin', () => {
  const eye=new pc.Vec3(10,1.6,5);
  const sun={light:{},setEulerAngles(...angles){this.angles=angles;}};
  const day=new Daylight({scene:{}},sun,{camera:{},getPosition:()=>eye});
  day.setHour(10);
  const morning=sun.angles;
  day.advance(1);   // one game minute
  assert.notDeepEqual(sun.angles,morning,'in town the sun follows the clock');

  eye.set(-4000,1.6,24);
  assert.ok(eye.length()>SUN_TURNS_WITHIN);
  day.setHour(10);
  const held=sun.angles;
  day.advance(20);   // 10:20, still in the 10:00 step
  assert.deepEqual(sun.angles,held,'between steps the sun keeps its angle');
  assert.equal(day.hour.toFixed(3),(10+20/60).toFixed(3),'the clock itself still runs');
  day.advance(15);   // 10:35, into the next step
  assert.notDeepEqual(sun.angles,held,'at each step the sun catches up with the clock');
  assert.equal(SUN_STEP_HOURS,.5);

  const stepped=sun.angles;
  day.setHour(20);
  assert.notDeepEqual(sun.angles,stepped,'setting the clock turns it anywhere');
});

// The near plane's corners must stay inside the tourist's collision radius, or a wall the tourist
// stands against is cut open at the screen corners.
test('the near plane never reaches past the collision radius, even on a wide screen', () => {
  const RADIUS=.34;
  for(const [name,view] of Object.entries(VIEWS))for(const aspect of [16/9,2.13]){
    const reach=nearReach(view.fov,aspect,view.near);
    assert.ok(reach<RADIUS,`${name} view at ${aspect.toFixed(2)}:1 reaches ${reach.toFixed(3)} m`);
  }
  assert.ok(Math.abs(nearReach(70,16/9,.2)-.349)<.001,'the corner reach this guards against (fov 70, near .2)');
  assert.ok(VIEWS.first.near>=.15&&VIEWS.third.near>=.2,'and depth precision stays well above the old .1');
});

// The camera-relative projection replaces one exact line of the engine's vertex chunk. An engine
// that words it differently would leave far rooms flickering again, so npm test catches it here.
test('the engine still has the projection line the camera-relative patch replaces', () => {
  const root=new URL('../node_modules/playcanvas/build/',import.meta.url);
  for(const file of ['playcanvas.mjs','playcanvas/src/scene/shader-lib/glsl/chunks/common/vert/transform.js',
    'playcanvas.dbg/src/scene/shader-lib/glsl/chunks/common/vert/transform.js']){
    assert.ok(fs.readFileSync(new URL(file,root),'utf8').includes(ENGINE_PROJECTION),`${file} has "${ENGINE_PROJECTION}"`);
  }
});

test('the camera-relative patch replaces that line, and without it warns instead of throwing', async () => {
  const {default:engineChunk}=await import('../node_modules/playcanvas/build/playcanvas/src/scene/shader-lib/glsl/chunks/common/vert/transform.js');
  const device={on(){}};   // all the chunk cache needs of a device
  const chunks=pc.ShaderChunks.get(device,pc.SHADERLANGUAGE_GLSL);
  chunks.set('transformVS',engineChunk);
  assert.equal(cameraRelative(device),true);
  assert.ok(chunks.get('transformVS').includes(CAMERA_RELATIVE));
  assert.ok(!chunks.get('transformVS').includes(ENGINE_PROJECTION));

  const bare={on(){}},warn=console.warn,warned=[];
  console.warn=(...args)=>warned.push(args.join(' '));
  try{assert.equal(cameraRelative(bare),false);}finally{console.warn=warn;}
  assert.equal(warned.length,1,'one warning, no exception');
  assert.equal(pc.ShaderChunks.get(bare,pc.SHADERLANGUAGE_GLSL).get('transformVS'),undefined,'and nothing set');
});
