import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY,RENDER,detail,setQuality,setGpu,levelForGpu,frameTime} from '../src/core/quality.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';

// 画质 (docs/superpowers/plans/2026-09-27-development-wave-3.md, Q-quality): 自动 by default, or
// 高 / 中 / 低 chosen by the player. Everything heavy asks detail() which version to build or run.
test('the setting picks the level, and 自动 starts from what the GPU is', () => {
  assert.deepEqual(QUALITY,['auto','high','medium','low']);
  for(const level of ['high','medium','low']){setQuality(level);setGpu('Google SwiftShader');assert.equal(detail(),level);}
  setQuality('auto');
  setGpu('ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11 vs_5_0 ps_5_0, D3D11)');
  assert.equal(detail(),'high');
  setGpu('ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)');
  assert.equal(detail(),'medium');
  setGpu('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)');
  assert.equal(detail(),'low');
  setQuality('nonsense');
  assert.equal(detail(),'low','anything unknown is 自动, which keeps the GPU it was told about');
  assert.equal(levelForGpu(''),'high','a browser that hides its GPU starts high and is measured');
  assert.equal(levelForGpu('ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)'),'high');
  assert.equal(levelForGpu('Mali-G57'),'medium');
  assert.equal(levelForGpu('Microsoft Basic Render Driver'),'low');
});

test('自动 steps down while frames stay slow, and never below 低 or on a chosen level', () => {
  const run=(ms,frames)=>{let stepped=0;for(let i=0;i<frames;i++)if(frameTime(ms))stepped++;return stepped;};
  setGpu('');setQuality('auto');
  assert.equal(run(16.7,600),0,'60 fps holds the level');
  assert.equal(detail(),'high');
  assert.equal(run(1000,600),0,'a hidden tab (seconds between frames) is not a slow frame');
  // A verdict takes a few seconds: the frames just after a change settle first (shaders, resizes).
  setQuality('auto');
  assert.equal(run(40,30),0,'no verdict from the first second');
  assert.equal(run(40,130),1,'25 fps for a few seconds steps down once');
  assert.equal(detail(),'medium');
  assert.equal(run(40,130),1,'and again if it stays slow');
  assert.equal(detail(),'low');
  assert.equal(run(80,600),0,'nothing below 低');
  setQuality('high');
  assert.equal(run(80,600),0,'a level the player chose is kept however slow it runs');
  assert.equal(detail(),'high');
  // Short stalls (a room being built, a shader compiling) don't count against the level.
  setQuality('auto');
  let stepped=0;
  for(let i=0;i<600;i++)if(frameTime(i%10===0?120:16.7))stepped++;
  assert.equal(stepped,0);
  assert.equal(detail(),'high');
});

test('each level is lighter than the one above it', () => {
  const {high,medium,low}=RENDER;
  // High is the look G-glitch settled (tests/glitch.test.js): PCF5 on a 2048 map out to 75 m.
  assert.equal(high.shadow,'pcf5');assert.equal(high.shadowSize,2048);assert.equal(high.shadowDistance,75);
  assert.ok(['pcf3','pcf1'].includes(low.shadow),'low filters with 4 taps or 1, not PCF5\'s 9');
  assert.equal(low.shadowSize,1024);
  assert.equal(low.msaa,false);assert.equal(low.pixelRatio,1);
  for(const [a,b] of [[high,medium],[medium,low]]){
    assert.ok(b.pixelRatio<=a.pixelRatio&&b.shadowSize<=a.shadowSize&&b.shadowDistance<=a.shadowDistance);
    assert.ok(b.crowd<=a.crowd&&b.animate<=a.animate&&b.viewScale>=a.viewScale);
    assert.ok(!b.msaa||a.msaa);
  }
});

test('the 画质 setting is kept in the save, and anything else there is dropped back to 自动', () => {
  const p=freshProfile();
  assert.equal(p.settings.quality,undefined,'absent means 自动');
  for(const quality of ['auto','high','medium','low']){
    p.settings.quality=quality;
    assert.equal(decodeProfile(JSON.stringify(p)).settings.quality,quality);
  }
  p.settings.quality='ultra';
  assert.equal('quality' in decodeProfile(JSON.stringify(p)).settings,false);
  p.settings.quality=3;
  assert.equal('quality' in decodeProfile(JSON.stringify(p)).settings,false);
});

// The door street views (src/world/views.js) draw on quads in rooms up to 10 km from the origin. As
// in town.js's camera-relative vertex chunk, the camera's position comes off before projecting, so
// the doorway's edges do not wobble against its frame by a millimetre each frame.
test('the door views project camera-relative, like every other material', async () => {
  const {VS}=await import('../src/world/views.js');
  assert.ok(!/matrix_viewProjection/.test(VS),'no world-space viewProjection * position');
  assert.match(VS.replace(/\s/g,''),/matrix_projection\*vec4\(mat3\(matrix_view\)\*\(\w+\+matrix_view\[3\]\.xyz\*mat3\(matrix_view\)\),1\.0\)/);
});

// A stick's shadow (a lamp post, a pole, a beam) is a texel or two of the sun's shadow map wide, so
// it crawls as the sun turns: at 8:30 on the market street it was 60% of what flickered each frame.
test('sticks cast no shadow; walls, trunks, columns and porch pillars still do', async () => {
  const {castsShadow}=await import('../src/world/models.js');
  assert.equal(castsShadow([.17,3.8,.17]),false,'a street-lamp post');
  assert.equal(castsShadow([.18,4.5,.18]),false,'a lantern post on the square');
  assert.equal(castsShadow([4.4,.16,.15]),false,'a beam across a shop front');
  assert.equal(castsShadow([.58,.66,.36]),false,'anything under 1.2 m every way, as before');
  // The pillars models.js builds: a porch's (.23 x .2 and .2 x .18), an arcade's, the west walkway's.
  assert.equal(castsShadow([.23,3.2,.2]),true,'a porch pillar');
  assert.equal(castsShadow([.2,3.2,.18]),true,'a narrow porch pillar');
  assert.equal(castsShadow([.225,2.5,.22]),true,'an arcade column');
  assert.equal(castsShadow([.22,3,.22]),true,'a walkway pillar');
  assert.equal(castsShadow([.3,4,.3]),true,'a trunk');
  assert.equal(castsShadow([5,3,.2]),true,'a wall');
  assert.equal(castsShadow([3.6,.07,2.7]),true,'an awning');
});

// models.repaint hands every piece of one shape and colour the same mesh. A cart struck at closing
// time destroys its pieces; the shared mesh must outlive them, or the next cart batches a mesh with
// no geometry and the batcher throws on every frame after.
test('repainted pieces share one mesh per shape and colour, and it outlives any of them', async () => {
  const pc=await import('playcanvas');
  const {createModels}=await import('../src/world/models.js');
  const device=new pc.NullGraphicsDevice({width:1,height:1,addEventListener(){},removeEventListener(){},style:{}});
  const m=createModels({graphicsDevice:device});
  // A stand-in render component: repaint reads its type, material and mesh instances, and sets them.
  const piece=()=>{const material=m.material('#8a7458');
    return {render:{type:'box',material,meshInstances:[new pc.MeshInstance(pc.Mesh.fromGeometry(device,new pc.BoxGeometry()),material)]}};};
  const a=piece(),b=piece();
  m.repaint(a);m.repaint(b);
  const mesh=a.render.meshInstances[0].mesh;
  assert.equal(b.render.meshInstances[0].mesh,mesh,'one mesh per shape and colour');
  assert.equal(a.render.meshInstances[0].material,m.painted);
  a.render.meshInstances[0].destroy();b.render.meshInstances[0].destroy();
  const c=piece();m.repaint(c);
  assert.ok(c.render.meshInstances[0].mesh.vertexBuffer,'the next piece still gets a mesh with its geometry');
});

// The crosshair's look ray runs every frame over every shape in the registry (about 6,000). Shapes
// further off than the ray reaches are skipped before the slab test; what it finds must not change.
test('the look ray finds the same shapes when it skips those out of reach', async () => {
  const {Registry}=await import('../src/world/registry.js');
  const r=new Registry(),eye={x:0,y:1.6,z:0},east={x:1,y:0,z:0};
  for(let i=0;i<2000;i++)r.add({x:20+i%40,z:-20+Math.floor(i/40),hw:.4,hd:.4,y0:0,y1:2,name:{id:'far'}});
  const at=x=>r.addLook({x,z:0,hw:.05,hd:.5,y0:0,y1:3,name:{id:'post'+x}});
  at(10.9);
  assert.equal(r.look('town',eye,east)?.box.name.id,'post10.9','inside the 11 m reach');
  r.clearLooks('town');at(11.2);
  assert.equal(r.look('town',eye,east),null,'just past it');
  assert.equal(r.look('town',eye,{x:2,y:0,z:0})?.box.name.id,'post11.2','a longer direction reaches further, as before');
  const round=r.add({x:0,z:-10.8,radius:.3,y0:0,y1:2,name:{id:'bin'}});
  assert.equal(r.look('town',eye,{x:0,y:0,z:-1})?.box,round,'round shapes too');
});

// A menu, the arrival card or a ride pauses the game: those frames say nothing about how the town
// runs (a blurred scrim can be slow), so they are not judged, and a pause starts the verdict over.
test('自动 does not judge frames while the game is paused', () => {
  setGpu('');setQuality('auto');
  let stepped=0;
  for(let i=0;i<600;i++)if(frameTime(40,false))stepped++;
  assert.equal(stepped,0,'slow frames under a panel never count');
  assert.equal(detail(),'high');
  for(let i=0;i<100;i++)if(frameTime(40))stepped++;   // four of the five seconds a verdict takes
  frameTime(40,false);                                   // a panel opens
  for(let i=0;i<100;i++)if(frameTime(40))stepped++;   // closed again: settling starts over
  assert.equal(stepped,0);
  for(let i=0;i<30;i++)if(frameTime(40))stepped++;
  assert.equal(stepped,1,'and slow play still steps down');
  assert.equal(detail(),'medium');
});
