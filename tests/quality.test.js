import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY,RENDER,LADDER,detail,pixelRatio,setQuality,setGpu,levelForGpu,frameTime} from '../src/core/quality.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';

// 画质 (docs/superpowers/plans/2026-09-27-development-wave-3.md, Q-quality): 自动 by default, or
// 高 / 中 / 低 chosen by the player. Everything heavy asks detail() which version to build or run.
// 自动 (task W6-perf) starts on 中 and walks a ladder of levels and pixel ratios as frames allow.
const IRIS='ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const SWIFT='ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';
/** `frames` frames of `ms` each (and the GPU's and CPU's share of them); how many moved 自动. */
const run=(ms,frames,gpu=0,cpu=0)=>{let moved=0;for(let i=0;i<frames;i++)if(frameTime(ms,true,gpu,cpu))moved++;return moved;};
const where=()=>[detail(),pixelRatio(2)];

test('the setting picks the level; 自动 starts on 中 on any GPU that draws in hardware, 低 on a software one', () => {
  assert.deepEqual(QUALITY,['auto','high','medium','low']);
  for(const level of ['high','medium','low']){setQuality(level);setGpu(SWIFT);assert.equal(detail(),level);}
  setQuality('auto');
  for(const gpu of [IRIS,'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)','Mali-G57','']){
    setGpu(gpu);assert.equal(detail(),'medium',gpu||'a browser that hides its GPU');
  }
  setGpu(SWIFT);
  assert.equal(detail(),'low');
  setQuality('nonsense');
  assert.equal(detail(),'low','anything unknown is 自动, which keeps the GPU it was told about');
  assert.equal(levelForGpu('Microsoft Basic Render Driver'),'low');
  assert.equal(levelForGpu(IRIS),'medium');
});

test('the pixel ratio: a chosen level\'s cap, 自动\'s rung, never more than the screen has', () => {
  setGpu(IRIS);
  for(const level of ['high','medium','low']){setQuality(level);assert.equal(pixelRatio(3),RENDER[level].pixelRatio);assert.equal(pixelRatio(1),1);}
  setQuality('auto');
  assert.deepEqual(where(),['medium',RENDER.medium.pixelRatio],'自动 starts at 中\'s own ratio');
  assert.equal(pixelRatio(1),1);
  // The ladder runs from cheapest to dearest: by level, then by pixel ratio.
  const order=['low','medium','high'];
  for(let i=1;i<LADDER.length;i++){
    const [a,ra]=LADDER[i-1],[b,rb]=LADDER[i];
    assert.ok(order.indexOf(b)>order.indexOf(a)||b===a&&rb>ra,`${a} ${ra} before ${b} ${rb}`);
    assert.ok(rb<=RENDER[b].pixelRatio,'no rung draws finer than its level chosen outright');
  }
});

test('自动 drops a rung at a time while frames run long: the pixel ratio first, then the level', () => {
  setGpu(IRIS);setQuality('auto');pixelRatio(2);
  assert.equal(run(16.7,600),0,'60 fps holds');
  assert.equal(run(1000,600),0,'a hidden tab (seconds between frames) is not a slow frame');
  // A verdict takes a few seconds: the frames just after a change settle first (shaders, resizes).
  assert.equal(run(40,40),0,'no verdict from the first second and a half');
  assert.equal(run(40,60),1,'25 fps for a few seconds drops one rung');
  assert.deepEqual(where(),['medium',1],'a lower pixel ratio, still 中');
  assert.equal(run(40,100),1);assert.deepEqual(where(),['medium',.85]);
  assert.equal(run(40,100),1);assert.deepEqual(where(),['low',1],'then 低');
  assert.equal(run(40,100),1);assert.deepEqual(where(),['low',.75]);
  assert.equal(run(80,600),0,'nothing below the bottom rung');
  // A frame in five at 33 ms is a stutter worth acting on; one in twenty is not.
  setQuality('auto');pixelRatio(2);
  let moved=0;for(let i=0;i<300;i++)if(frameTime(i%20===0?33:16.7))moved++;
  assert.equal(moved,0);
  for(let i=0;i<300;i++)if(frameTime(i%4===0?33:16.7))moved++;
  assert.equal(moved,1);
  // Short stalls (a room being built, a shader compiling) don't count against the level.
  setQuality('auto');pixelRatio(2);moved=0;
  for(let i=0;i<600;i++)if(frameTime(i%10===0?400:16.7))moved++;
  assert.equal(moved,0);
  // On a screen with one pixel per point, rungs that differ only above that are one rung.
  setQuality('auto');pixelRatio(1);
  assert.equal(run(40,160),1);assert.deepEqual([detail(),pixelRatio(1)],['medium',.85]);
  // A level the player chose is kept however slow it runs.
  setQuality('high');
  assert.equal(run(80,600),0);
  assert.equal(detail(),'high');
});

test('自动 climbs only when the GPU timer shows room to spare, and never back into a level it fell from', () => {
  /** Frames of `ms` until 自动 moves, ten seconds' worth at most: how many it took (0: it did not). */
  const once=(ms,gpu=0,cpu=0)=>{for(let i=0;i<10000/ms;i++)if(frameTime(ms,true,gpu,cpu))return i+1;return 0;};
  setGpu(IRIS);setQuality('auto');pixelRatio(2);
  assert.equal(once(16.7),0,'smooth, but with no GPU time to go by it stays put');
  assert.equal(once(16.7,9,6),0,'a GPU 9 ms busy has no room for 高');
  assert.equal(once(16.7,3,12),0,'nor has a CPU 12 ms busy');
  assert.deepEqual(where(),['medium',1.25]);
  assert.ok(once(16.7,3,4),'3 ms of GPU work: up to 高');
  assert.deepEqual(where(),['high',1.25]);
  assert.ok(once(16.7,3,4));assert.deepEqual(where(),['high',1.5]);
  assert.equal(once(16.7,3,4),0,'the top rung');
  // Down at once when it gets heavy; up again only within the level it fell to, and only after three
  // smooth windows in a row, so a heavy street after a light room costs a rung a while, not a see-saw.
  assert.ok(once(40));assert.deepEqual(where(),['high',1.25]);
  assert.ok(once(40)<=100,'a drop takes one verdict');assert.deepEqual(where(),['medium',1.25]);
  assert.equal(once(16.7,2,3),0,'not back to 高 this session');
  assert.ok(once(40));assert.deepEqual(where(),['medium',1]);
  assert.ok(once(16.7,2,3)>=(2000+3*2000)/16.7,'back up to 中\'s own ratio, after a while');
  assert.deepEqual(where(),['medium',1.25]);
  setQuality('auto');pixelRatio(2);
  assert.ok(once(16.7,3,4),'choosing 自动 again starts afresh');
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
  setGpu('');setQuality('auto');pixelRatio(2);
  let stepped=0;
  for(let i=0;i<600;i++)if(frameTime(40,false))stepped++;
  assert.equal(stepped,0,'slow frames under a panel never count');
  assert.deepEqual(where(),['medium',1.25]);
  for(let i=0;i<90;i++)if(frameTime(40))stepped++;    // most of the four seconds a verdict takes
  frameTime(40,false);                                  // a panel opens
  for(let i=0;i<90;i++)if(frameTime(40))stepped++;    // closed again: settling starts over
  assert.equal(stepped,0);
  for(let i=0;i<20;i++)if(frameTime(40))stepped++;
  assert.equal(stepped,1,'and slow play still steps down');
  assert.deepEqual(where(),['medium',1]);
});

// The Jiangnan look (task W5-look, src/world/look.js): 高 has the post pass with ambient occlusion and
// the painted surfaces, 中 the same without ambient occlusion, 低 the plain look from before.
test('the look follows the level: 高 everything, 中 no ambient occlusion, 低 the plain look', () => {
  const {high,medium,low}=RENDER,row=r=>[r.post,r.ssao,r.textures];
  assert.deepEqual(row(high),[true,true,true]);
  assert.deepEqual(row(medium),[true,false,true]);
  assert.deepEqual(row(low),[false,false,false]);
});
