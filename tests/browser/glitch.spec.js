import {test,expect} from '@playwright/test';

/**
 * "Weird glitchy lines whenever I walk" (G-glitch, 2026-09-26). The causes, each checked here:
 * - Float precision: rooms stand up to 10 km from the origin and 云海 4 km, and projecting such
 *   large world positions in 32-bit floats made layered pieces flicker through each other. The
 *   vertex transform is camera-relative now (town.js, cameraRelative).
 * - Pieces drawn flush with each other (a glass pane on its cladding, a shelf backing on its window
 *   box, milk cartons on the fridge door) that swapped pixel by pixel as the camera moved.
 * - Shadow edges: 3x3 filtering showed the texel steps as a sawtooth, and a sun turned every frame
 *   re-snapped them every frame; kilometres out, a texel or more each frame.
 *
 * Flicker is measured without moving the image: the far plane shifts by a hair, which re-rolls
 * every depth tie in the frame and changes nothing else, so the pixels that change are pieces
 * fighting for the same pixel. Shadows are off while measuring (they are not what is tested there).
 */
async function start(page){
  await page.setViewportSize({width:1280,height:720});
  await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.evaluate(()=>{
    const town=window.__qinghe.town,app=town.app,gl=app.graphicsDevice.gl;
    app.timeScale=0;   // people, stalls and the clock hold still, so only the depth ties can change
    const frames=n=>new Promise(done=>{let k=0;const f=()=>{if(++k>=n){app.off('frameend',f);done();}};app.on('frameend',f);});
    const grab=()=>new Promise(done=>app.once('frameend',()=>{
      const px=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
      const read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);
      gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,px);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);done(px);}));
    /** Pixels that change by more than 24/255 in any channel when only the far plane moves. */
    window.__flicker=async({place,x,z,yaw,pitch=-4})=>{
      if(place&&town.place!==place)place==='town'?town.leaveRoom():town.enterRoom(place);
      await frames(3);
      if(x!==undefined){const p=town.player.entity.getPosition();town.player.entity.setPosition(x,p.y,z);}
      if(yaw!==undefined)town.yaw=yaw;
      town.pitch=pitch;town.placeCamera(town.player.entity.getPosition());
      const cam=town.camera.camera,sun=town.sun.light,far=cam.farClip;
      sun.castShadows=false;await frames(3);
      const a=await grab(),hit=new Uint8Array(a.length/4);let n=0;
      for(let k=1;k<=6;k++){
        cam.farClip=far*(1+k*.003);await frames(2);const b=await grab();
        for(let i=0,j=0;i<a.length;i+=4,j++){
          if(!hit[j]&&Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>24){hit[j]=1;n++;}
        }
      }
      cam.farClip=far;sun.castShadows=true;await frames(2);
      return n;
    };
  });
}

test('the renderer, the shadows and the camera keep edges steady',async({page})=>{
  await start(page);
  const seen=await page.evaluate(async()=>{
    const town=window.__qinghe.town,sun=town.sun,turn=()=>sun.getRotation().clone();
    const out={shadowType:sun.light.shadowType,near:town.camera.camera.nearClip};
    let before=turn();town.daylight.advance(30);out.turnsInTown=!turn().equals(before);
    town.enterRoom('kitchen');before=turn();town.daylight.advance(30);out.turnsInRoom=!turn().equals(before);
    town.leaveRoom();return out;
  });
  expect(seen.shadowType,'5x5 soft shadow filtering (pc.SHADOW_PCF5_32F)').toBe(4);
  expect(seen.near,'near plane: depth precision grows with it').toBeGreaterThanOrEqual(.2);
  expect(seen.turnsInTown,'in town the sun follows the clock').toBe(true);
  expect(seen.turnsInRoom,'kilometres out the sun holds its angle').toBe(false);
});

// Where each cause showed worst, with the flicker measured before the fix at 1280x720.
const VIEWS=[
  ['the lighting shop glass front (was 78,590)',{place:'town',x:60,z:-2,yaw:0}],
  ["home's study window (was 24,698)",{place:'town',x:16,z:10,yaw:180}],
  ['the lighting shop from the side (was 3,203)',{place:'town',x:60,z:-2,yaw:90,pitch:-12}],
  ['down the market street (was 684)',{place:'town',x:34,z:0,yaw:-90}],
  ['the square-market paving seam (was 1,343)',{place:'town',x:16,z:4,yaw:-90,pitch:-12}],
  ['the kitchen, 7.6 km out (was 1,720)',{place:'kitchen'}],
  ['the kitchen wall, looking down (was 4,821)',{place:'kitchen',pitch:-28}],
  ['the study, 7.2 km out (was 2,983)',{place:'study',pitch:-28}],
];

test('pieces drawn flush, and rooms far from the origin, no longer flicker',async({page})=>{
  test.setTimeout(120000);
  await start(page);
  const counts={};
  for(const [name,view] of VIEWS)counts[name]=await page.evaluate(v=>window.__flicker(v),view);
  // The supermarket's fridge and baskets, the hardware shop's show bed, the library's wainscot and
  // calligraphy (1,703 / 1,271 / 352 at their worst single view): four turns from the spawn, each
  // at eye level and looking down, added up.
  for(const place of ['supermarket','hardware','library']){
    const spawn=await page.evaluate(p=>{const t=window.__qinghe.town;if(t.place!==p)t.enterRoom(p);return t.yaw;},place);
    let n=0;
    for(const turn of [0,90,180,270])for(const pitch of [-4,-25])n+=await page.evaluate(v=>window.__flicker(v),{place,yaw:spawn+turn,pitch});
    counts[`${place}, eight views`]=n;
  }
  console.log(counts);
  for(const [name,n] of Object.entries(counts))expect(n,name).toBeLessThanOrEqual(150);
});
