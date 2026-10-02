import {test,expect} from '@playwright/test';
import {startGame} from './start.js';

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
  await page.goto('/');await startGame(page);
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
    const town=window.__qinghe.town,sun=town.sun,cam=town.camera.camera,turn=()=>sun.getRotation().clone();
    // How far the near plane's corners reach from the eye, in each view, on this screen.
    const reach=()=>{const h=Math.tan(cam.fov*Math.PI/360);return cam.nearClip*Math.hypot(1,h,h*cam.aspectRatio);};
    const out={shadowType:sun.light.shadowType,first:{near:cam.nearClip,reach:reach()}};
    town.setView('third');out.third={near:cam.nearClip,reach:reach()};town.setView('first');
    town.daylight.setHour(10);
    let before=turn();town.daylight.advance(1);out.turnsInTown=!turn().equals(before);
    town.enterRoom('kitchen');town.daylight.setHour(10);
    before=turn();town.daylight.advance(5);out.turnsWithinStep=!turn().equals(before);
    town.daylight.advance(30);out.turnsAtStep=!turn().equals(before);
    town.leaveRoom();return out;
  });
  expect(seen.shadowType,'5x5 soft shadow filtering (pc.SHADOW_PCF5_32F)').toBe(4);
  for(const view of ['first','third']){
    expect(seen[view].near,`${view} person: depth precision grows with the near plane`).toBeGreaterThanOrEqual(.15);
    expect(seen[view].reach,`${view} person: near-plane corners inside the .34 m collision radius`).toBeLessThan(.34);
  }
  expect(seen.turnsInTown,'in town the sun follows the clock').toBe(true);
  expect(seen.turnsWithinStep,'kilometres out the sun holds its angle between steps').toBe(false);
  expect(seen.turnsAtStep,'and turns at each half-hour step').toBe(true);
});

// Where each cause showed worst, with the flicker measured before the fix at 1280x720. The counts
// and the 150-pixel ceiling were calibrated on one GPU (Intel Iris Xe through ANGLE/Direct3D 11,
// 4x MSAA, 24-bit depth): another GPU rounds depth ties differently, so re-check the ceiling there.
const VIEWS=[
  ['the lighting shop glass front (was 78,590)',{place:'town',x:60,z:-2,yaw:0}],
  // The house moved beside the park gate (x 16, z 48.7, facing south); its study wing's window is at x 8.1, z 49.9.
  ["home's study window (was 24,698)",{place:'town',x:8.1,z:51.9,yaw:0}],
  ['the lighting shop from the side (was 3,203)',{place:'town',x:60,z:-2,yaw:90,pitch:-12}],
  ['down the market street (was 684)',{place:'town',x:34,z:0,yaw:-90}],
  // The seam was measured from x 16 looking east; the market gate's new hedge stands in that view now.
  ['along the square-market paving seam (was 1,343)',{place:'town',x:20,z:3,yaw:0,pitch:-15}],
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

/**
 * Faces drawn flush with each other: every box face and cylinder cap in the town and in each room,
 * in the place's own coordinates (64-bit, so a room's distance from the origin plays no part). A
 * pair fails when the two lie within 1 mm of one plane, face the same way, overlap by more than a
 * square centimetre and differ in colour, and some of the overlap can be seen: not buried inside
 * another solid, and not facing into a gap under 35 cm that no camera fits into. People and 云海
 * (being rebuilt) are left out.
 */
function flushFaces(root){
  const mul=(a,b)=>{const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;};
  const local=e=>{const p=e.getLocalPosition(),q=e.getLocalRotation(),s=e.getLocalScale(),{x,y,z,w}=q;
    return [(1-2*(y*y+z*z))*s.x,2*(x*y+w*z)*s.x,2*(x*z-w*y)*s.x,0,2*(x*y-w*z)*s.y,(1-2*(x*x+z*z))*s.y,2*(y*z+w*x)*s.y,0,
      2*(x*z+w*y)*s.z,2*(y*z-w*x)*s.z,(1-2*(x*x+y*y))*s.z,0,p.x,p.y,p.z,1];};
  const at=(m,[x,y,z])=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
  const invert=m=>{const [a,d,g,,b,e,h,,c,f,i]=m,A=e*i-f*h,B=f*g-d*i,C=d*h-e*g,det=a*A+b*B+c*C;
    const r=[A/det,B/det,C/det,0,(c*h-b*i)/det,(a*i-c*g)/det,(b*g-a*h)/det,0,(b*f-c*e)/det,(c*d-a*f)/det,(a*e-b*d)/det,0,0,0,0,1];
    const t=at(r,[m[12],m[13],m[14]]);r[12]=-t[0];r[13]=-t[1];r[14]=-t[2];return r;};
  const ring=[...Array(16)].map((_,i)=>[Math.cos(i*Math.PI/8)/2,Math.sin(i*Math.PI/8)/2]);
  const faces=[],solids=[];
  const walk=(e,m)=>{
    if(e!==root&&(!e._enabled||e.name==='person'))return;
    const w=e===root?[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]:mul(m,local(e)),r=e.render;
    if(r?.enabled&&(r.type==='box'||r.type==='cylinder')&&r.meshInstances?.length){
      // A repainted piece (models.repaint) draws with the one shared vertex-colour material; its own
      // colour material stays on its render component.
      const drawn=r.meshInstances[0].material,mat=drawn===window.__qinghe.town.m.painted?r.material:drawn,mid=at(w,[0,0,0]),corners=[];
      for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])corners.push(at(w,[x,y,z]));
      solids.push({e,box:r.type==='box',inv:invert(w),lo:[0,1,2].map(k=>Math.min(...corners.map(c=>c[k]))),hi:[0,1,2].map(k=>Math.max(...corners.map(c=>c[k])))});
      const add=pts=>{const c=pts.reduce((s,p)=>s.map((v,k)=>v+p[k]/pts.length),[0,0,0]);let n=unit(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])));
        if(dot(n,sub(c,mid))<0)n=n.map(v=>-v);faces.push({e,mat,n,d:dot(n,pts[0]),pts});};
      if(r.type==='box')for(let a=0;a<3;a++)for(const s of [-.5,.5])add([[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([u,v])=>{const p=[0,0,0];p[a]=s;p[(a+1)%3]=u;p[(a+2)%3]=v;return at(w,p);}));
      else for(const s of [-.5,.5])add(ring.map(([u,v])=>at(w,[u,s,v])));
    }
    for(const c of e.children)walk(c,w);
  };
  walk(root,null);
  const inside=(p,skip)=>solids.some(s=>{
    if(p[0]<s.lo[0]||p[0]>s.hi[0]||p[1]<s.lo[1]||p[1]>s.hi[1]||p[2]<s.lo[2]||p[2]>s.hi[2]||skip.includes(s.e))return false;
    const q=at(s.inv,p);return s.box?Math.max(...q.map(Math.abs))<.4999:q[0]*q[0]+q[2]*q[2]<.2499&&Math.abs(q[1])<.4999;});
  // The overlap of two convex faces in (nearly) one plane, as a polygon in that plane.
  const overlap=(A,B,n,d)=>{
    const u=unit(Math.abs(n[0])<.9?cross(n,[1,0,0]):cross(n,[0,1,0])),v=cross(n,u),flat=P=>P.map(p=>[dot(p,u),dot(p,v)]);
    const area=P=>P.reduce((s,a,i)=>{const b=P[(i+1)%P.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
    let out=flat(A);if(area(out)<0)out.reverse();const clip=flat(B);if(area(clip)<0)clip.reverse();
    clip.forEach((p,i)=>{const q=clip[(i+1)%clip.length],side=r=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]),src=out;out=[];
      src.forEach((cur,j)=>{const prev=src[(j+src.length-1)%src.length],a=side(prev),b=side(cur);
        if((a>=0)!==(b>=0)){const t=a/(a-b);out.push([prev[0]+(cur[0]-prev[0])*t,prev[1]+(cur[1]-prev[1])*t]);}if(b>=0)out.push(cur);});});
    return out.length>2?{area:Math.abs(area(out)),pts:out.map(([x,y])=>[0,1,2].map(k=>u[k]*x+v[k]*y+n[k]*d))}:{area:0};
  };
  const colour=m=>m?.diffuse?[m.diffuse.r,m.diffuse.g,m.diffuse.b]:[0,0,0];
  const name=e=>{const parts=[];for(let n=e;n&&n!==root;n=n.parent)parts.push(n.lookName||n.name);return parts.reverse().join('/');};
  const groups=new Map(),bad=[];
  for(const f of faces){const k=f.n.map(v=>Math.round(v*200)).join();(groups.get(k)??groups.set(k,[]).get(k)).push(f);}
  for(const list of groups.values()){
    list.sort((a,b)=>a.d-b.d);
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length&&list[j].d-list[i].d<=.001;j++){
      const A=list[i],B=list[j];
      if(A.e===B.e||A.mat===B.mat||dot(A.n,B.n)<.99999||(A.n[1]<-.99&&-A.d<.06))continue;   // not a floor's underside
      const differ=A.mat?.diffuseMap||B.mat?.diffuseMap?1:Math.max(...colour(A.mat).map((c,k)=>Math.abs(c-colour(B.mat)[k])));
      if(differ<.04)continue;
      const o=overlap(A.pts,B.pts,A.n,A.d);if(o.area<1e-4)continue;
      const c=o.pts.reduce((s,p)=>s.map((v,k)=>v+p[k]/o.pts.length),[0,0,0]),toward=(p,t)=>p.map((v,k)=>c[k]+(v-c[k])*t);
      const spots=[c];o.pts.forEach((p,k)=>{const q=o.pts[(k+1)%o.pts.length],m=p.map((v,x)=>(v+q[x])/2);for(const t of [.3,.6,.9])spots.push(toward(p,t),toward(m,t));});
      const open=spots.filter(s=>[.003,.05,.1,.2,.35].every(t=>!inside(s.map((v,k)=>v+A.n[k]*t),[A.e,B.e]))).length;
      if(open>=2)bad.push(`${name(A.e)} ${A.mat?.diffuse?.toString()} | ${name(B.e)} ${B.mat?.diffuse?.toString()} at ${c.map(v=>v.toFixed(2))} facing ${A.n.map(v=>Math.round(v*100)/100)}`);
    }
  }
  return bad;
}

test('no two faces of different colours lie flush in the town or any room',async({page})=>{
  test.setTimeout(120000);
  await start(page);
  const found=await page.evaluate(`(()=>{
    const flushFaces=${flushFaces.toString()};
    const t=window.__qinghe.town,out={town:flushFaces(t.root)};
    for(const [id,room] of t.rooms)if(id!=='city')out[id]=flushFaces(room.root);
    return out;
  })()`);
  expect(Object.fromEntries(Object.entries(found).filter(([,pairs])=>pairs.length)),'faces drawn flush, by place').toEqual({});
});
