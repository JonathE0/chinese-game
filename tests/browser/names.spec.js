import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

// Every item with its own look has a name, and every sign reads its exact text.
const SAVE_KEY='little-mandarin-town.v1';
const OBJECTS=JSON.parse(readFileSync('src/content/objects.json','utf8')).objects;
const SIGNS=JSON.parse(readFileSync('src/content/signs.json','utf8')).signs;

async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:[],phrases:[],saved:[],home:[],discovered:[],
    settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.waitForTimeout(300);
}
const plate=async page=>await page.locator('#nameplate').isVisible()
  ? (await page.locator('#nameplate').innerText()).replace(/\n/g,' ') : null;

test('every visible mesh in town, every room and the city is covered by a named box',async({page})=>{
  test.setTimeout(120000);
  await start(page);
  const report=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.ensureCity();
    const places=[['town',t.root],...[...t.rooms.values()].map(room=>[room.id,room.root])];
    // Waiters and the word hall's visitors walk, and are boxed only in the room you stand in.
    const walking=new Set([...t.rooms.values()].flatMap(room=>room.staff.map(one=>one.entity)).concat(t.visitors.people.map(one=>one.entity)));
    const uncovered=[],signTexts=new Set(),names=new Set();
    // Only true backdrop is skipped, by exact name, and its children are still walked. The base
    // slab of a ground patch (its first child) is ground too; what stands on it is checked.
    const backdrop=/^(hill|steam|sky|terrain)$/;
    const lookOf=new Map(t.registry.looks.map(b=>[b.entity,b]));
    const path=e=>{const out=[];for(let n=e;n&&n!==t.app.root;n=n.parent)out.unshift(n.name);return out.join('/');};
    const inside=(b,c)=>{
      const pad=.05;
      if(c.y<b.y0-pad||c.y>b.y1+pad)return false;
      if(b.radius)return (c.x-b.x)**2+(c.z-b.z)**2<=(b.radius+pad)**2;
      return Math.abs(c.x-b.x)<=b.hw+pad&&Math.abs(c.z-b.z)<=b.hd+pad;
    };
    // An untagged mesh is covered only if the look ray aimed at it, from just outside it along an
    // axis or from above, returns a box round it: a mark it merely sits inside (a building's)
    // does not count when a nearer or smaller box would win the look.
    const dirs=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,-1,0]];
    const looked=(place,c,h)=>dirs.some(([dx,dy,dz])=>{
      const back=Math.abs(dx)*h.x+Math.abs(dy)*h.y+Math.abs(dz)*h.z+1.2;
      const hit=t.registry.look(place,{x:c.x-dx*back,y:c.y-dy*back,z:c.z-dz*back},{x:dx,y:dy,z:dz},back+1);
      return hit&&inside(hit.box,c);
    });
    for(const [place,root] of places){
      for(const b of [...t.registry.boxes,...t.registry.looks])if(b.place===place&&b.name)names.add(b.name.id);
      // look() ignores boxes of disabled entities, and every room but the one you are in is off.
      const was=root.enabled;root.enabled=true;
      const visit=(e,own)=>{
        if(e!==root&&!e._enabled)return;
        if(e===t.player?.entity||walking.has(e))return;
        own=lookOf.get(e)??own;                            // the nearest tagged entity at or above
        const sky=root.skylineBounds,at=root.getPosition();
        if(e.signText)signTexts.add(e.signText);
        const skip=backdrop.test(e.name)||(e.parent?.name.startsWith('ground-')&&e.parent.children[0]===e);
        if(!skip)for(const mi of e.render?.meshInstances??[]){
          const c=mi.aabb.center,h=mi.aabb.halfExtents;
          if(h.y<.06&&c.y<.12)continue;                     // flat on the ground: paving
          if(h.x>30||h.z>30)continue;                       // the land itself
          if(sky?.some(k=>Math.abs(c.x-at.x-k.x)<=k.hw+.1&&Math.abs(c.z-at.z-k.z)<=k.hd+.1))continue;   // the city skyline
          if(own?inside(own,c):looked(place,c,h))continue;
          uncovered.push(`${place} ${path(e)} @${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)} ~${h.x.toFixed(1)},${h.y.toFixed(1)},${h.z.toFixed(1)}`);
        }
        for(const child of e.children)visit(child,own);
      };
      visit(root,null);
      root.enabled=was;
    }
    return {uncovered,signTexts:[...signTexts],names:[...names],looks:t.registry.looks.length,boxes:t.registry.boxes.length};
  });
  console.log(`looks ${report.looks}, boxes ${report.boxes}, uncovered ${report.uncovered.length}`);
  expect(report.signTexts.filter(text=>!SIGNS[text]),'sign texts missing from signs.json').toEqual([]);
  expect(report.names.filter(id=>!id.startsWith('sign:')&&!OBJECTS[id]),'names missing from objects.json').toEqual([]);
  expect(report.uncovered,'meshes with no name').toEqual([]);
});

test('the sink, a café cup and a waiter name themselves',async({page})=>{
  await start(page);
  // Aim from a standing eye in front of a look box, the way the crosshair would.
  const lookAt=async(place,id)=>{
    await page.evaluate(place=>window.__qinghe.town.enterRoom(place),place);
    await page.waitForTimeout(150);        // waiters are boxed each frame, from the next one on
    return page.evaluate(([place,id])=>{
    const t=window.__qinghe.town,room=t.rooms.get(place),box=t.registry.looks.find(b=>b.place===place&&b.name?.id===id);
    if(!box)return 'no '+id+' box';
    // A cluster (three cups) has gaps between its meshes: aim at one of them.
    const mesh=box.entity.findComponents('render')[0].meshInstances[0].aabb.center,c={x:mesh.x,y:mesh.y,z:mesh.z};
    let ax=room.offsetX-c.x,az=-c.z;const len=Math.hypot(ax,az)||1;ax/=len;az/=len;
    const eye={x:c.x+ax*1.2,y:Math.max(c.y+.5,1.2),z:c.z+az*1.2};
    const d={x:c.x-eye.x,y:c.y-eye.y,z:c.z-eye.z},n=Math.hypot(d.x,d.y,d.z);
    return t.registry.look(place,eye,{x:d.x/n,y:d.y/n,z:d.z/n})?.box.name?.zh??null;
  },[place,id]);};
  expect(await lookAt('kitchen','sink')).toBe(OBJECTS.sink.zh);
  expect(await lookAt('cafe','cup')).toBe('杯子');
  expect(await lookAt('restaurant','waiter')).toBe('服务员');
});

test('the park pavilion reads 亭子 from the path, and a room ceiling reads 天花板 straight up',async({page})=>{
  await start(page);
  const looking=()=>page.evaluate(()=>window.__qinghe.town.looking?.zh??null);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(0,24.5,180);t.pitch=22;});
  await expect.poll(looking,{timeout:6000}).toBe(OBJECTS.pavilion.zh);
  // The middle of the café, between two beams, with no lantern overhead.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterRoom('cafe');t.warp(t.rooms.get('cafe').offsetX,0,180);t.pitch=85;});
  await expect.poll(looking,{timeout:6000}).toBe(OBJECTS.ceiling.zh);
});

test('the welcome board reads its exact text, and F saves the phrase without naming an object',async({page})=>{
  await start(page);
  await page.mouse.click(700,500);
  await page.evaluate(()=>window.__qinghe.town.warp(0,7,180));
  await page.waitForTimeout(120);
  await page.evaluate(()=>{window.__qinghe.town.pitch=9;});
  await expect.poll(()=>plate(page),{timeout:6000}).toContain('欢迎来到青禾');
  await page.keyboard.press('f');
  await expect.poll(()=>plate(page),{timeout:4000}).toContain('已记住');
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),SAVE_KEY);
  expect(saved.discovered).toEqual([]);
  expect(saved.saved.find(w=>w.zh==='欢迎来到青禾')?.audio).toBe('sign-'+SIGNS['欢迎来到青禾'].id);
});
