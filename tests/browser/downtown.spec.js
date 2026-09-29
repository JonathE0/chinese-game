import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {towerTiers} from '../../src/core/city.js';

// The near side of 云海 (wave 3, E-downtown): an entrance on every building of the doors table,
// its lights after dark, no flush faces anywhere in the city, and the draw calls at each detail level.
const SAVE_KEY='little-mandarin-town.v1';
const CITY=JSON.parse(readFileSync('src/content/city.json','utf8'));
/** What city.js builds (the parts in bay.js, hill.js, hotpot.js, … are their owners' to check). */
const MINE='^(box|tower|metro-hall|city-.+|promenade|skyline|block|hill|searchlight)$';

async function enterCity(page,level=null){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:60,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],
    home:[],discovered:[],clock:14,dayIndex:0,vendors:{},metro:{rides:1,trips:0},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  // The city is built the first time you go, at the detail level in force then.
  if(level)await page.evaluate(async level=>(await import('/src/core/quality.js')).setQuality(level),level);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
}
const frames=(page,n=2)=>page.evaluate(n=>new Promise(done=>{const step=()=>--n?requestAnimationFrame(step):done();requestAnimationFrame(step);}),n);

test('every door of the doors table has a real entrance on its building, and leads inside',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await enterCity(page);
  for(const door of CITY.doors){
    // The door itself (look box 门) stands at the door point, not somewhere else on the front.
    const entrance=await page.evaluate(({x,z})=>{
      const t=window.__qinghe.town,x0=t.rooms.get('city').offsetX;
      const near=t.registry.looks.filter(b=>b.place==='city'&&b.name?.id==='door')
        .map(b=>Math.hypot(b.x-x0-x,b.z-z)).sort((a,b)=>a-b)[0];
      return {near,open:t.canMove(x0+x,z,0)};
    },door);
    if(door.room!=='mall')expect(entrance.open,`${door.room}: the door point is open ground`).toBe(true);
    // The mall's entrance is its own building's (src/world/mall.js, task Y-mall).
    if(door.room!=='mall')expect(entrance.near,`${door.room}: a door within reach of its point`).toBeLessThan(2.2);
    await page.evaluate(({x,z})=>{const t=window.__qinghe.town;t.warp(t.rooms.get('city').offsetX+x,z);},door);
    await expect(page.locator('#interact span'),door.room).toHaveText(door.label);
    await page.keyboard.press('e');
    await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place),{message:door.room}).toBe(door.room);
    await page.evaluate(()=>{window.__qinghe.town.onInteract('door:city');window.__qinghe.syncPlace();});
    await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('city');
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});

test('a stacked tower stands on itself: every piece of a sky garden rests on the tier below and under the tier above',async({page})=>{
  await enterCity(page,'high');
  const stacked=CITY.towers.filter(t=>t.form?.tiers.some(one=>one.skin==='garden'));
  expect(stacked.length).toBeGreaterThan(0);
  for(const def of stacked){
    const tiers=towerTiers(def);
    const pieces=await page.evaluate(({x,z,levels})=>{
      const t=window.__qinghe.town,room=t.rooms.get('city');
      const root=room.root.children.find(c=>c.name==='tower'&&Math.hypot(c.getLocalPosition().x-x,c.getLocalPosition().z-z)<.01);
      const inv=root.getWorldTransform().clone().invert(),p=root.getPosition().clone();
      const out=[];
      for(const render of root.findComponents('render'))for(const mi of render.meshInstances){
        const lo=mi.aabb.getMin(),hi=mi.aabb.getMax();
        const level=levels.findIndex(([y0,y1])=>lo.y>=y0-.01&&hi.y<=y1+.01);
        if(level<0)continue;
        // The piece's footprint in the tower's own frame.
        let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
        for(const cx of [lo.x,hi.x])for(const cz of [lo.z,hi.z]){
          inv.transformPoint(p.set(cx,lo.y,cz),p);
          x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);
        }
        out.push({level,x0,x1,z0,z1,name:render.entity.name});
      }
      return out;
    },{x:def.x,z:def.z,levels:tiers.map(v=>v.skin==='garden'?[v.y0,v.y1]:[-1,-1])});
    expect(pieces.length,def.sign).toBeGreaterThan(0);
    const outside=(p,v)=>p.x0<v.cx-v.w/2-.01||p.x1>v.cx+v.w/2+.01||p.z0<v.cz-v.d/2-.01||p.z1>v.cz+v.d/2+.01;
    for(const piece of pieces){
      const below=tiers[piece.level-1],above=tiers.slice(piece.level+1).find(v=>v.skin!=='garden');
      const at=[piece.x0,piece.x1,piece.z0,piece.z1].map(n=>n.toFixed(2)).join(',');
      expect(outside(piece,below),`${def.sign}: ${piece.name} (${at}) off the tier below`).toBe(false);
      if(above)expect(outside(piece,above),`${def.sign}: ${piece.name} (${at}) out from under the tier above`).toBe(false);
    }
  }
});

test('each entrance fits its front: the door clear of the columns, the sign and the canopy on the façade',async({page})=>{
  await enterCity(page,'high');
  const problems=await page.evaluate(towers=>{
    const t=window.__qinghe.town,room=t.rooms.get('city'),out=[];
    for(const def of towers){
      const root=room.root.children.find(c=>c.name==='tower'&&Math.hypot(c.getLocalPosition().x-def.x,c.getLocalPosition().z-def.z)<.01);
      const inv=root.getWorldTransform().clone().invert(),p=root.getPosition().clone();
      /** An entity's box in the tower's own frame: [x0, x1, y0, y1, z0, z1]. */
      const local=e=>{
        const b=[Infinity,-Infinity,Infinity,-Infinity,Infinity,-Infinity];
        for(const r of e.findComponents('render'))for(const mi of r.meshInstances){
          const lo=mi.aabb.getMin(),hi=mi.aabb.getMax();
          for(const x of [lo.x,hi.x])for(const y of [lo.y,hi.y])for(const z of [lo.z,hi.z]){
            inv.transformPoint(p.set(x,y,z),p);
            b[0]=Math.min(b[0],p.x);b[1]=Math.max(b[1],p.x);b[2]=Math.min(b[2],p.y);b[3]=Math.max(b[3],p.y);b[4]=Math.min(b[4],p.z);b[5]=Math.max(b[5],p.z);
          }
        }
        return b;
      };
      const edge=def.w/2-.2+.005,name=def.sign??`${def.x},${def.z}`;
      const canopy=root.children.find(c=>c.name==='canopy'),door=root.children.find(c=>c.name==='door');
      // The canopy and the neon sign (the media walls are the tiers' own, further up).
      for(const [what,e] of [['canopy',canopy],...root.find(e=>!!e.signText&&e.lookReach<=40).map(e=>['sign',e])]){
        if(!e?.findComponents('render').length)continue;
        const b=local(e);
        if(b[0]<-edge||b[1]>edge)out.push(`${name}: ${what} ${b[0].toFixed(2)}..${b[1].toFixed(2)} past ±${(def.w/2-.2).toFixed(2)}`);
      }
      if(door)for(const pillar of root.find(e=>e.lookName==='pillar')){
        const a=local(door),b=local(pillar);
        if(a[0]<b[1]&&b[0]<a[1]&&a[2]<b[3]&&b[2]<a[3]&&a[4]<b[5]&&b[4]<a[5])out.push(`${name}: the door runs into a column`);
      }
    }
    return out;
  },CITY.towers.filter(t=>t.form));
  expect(problems).toEqual([]);
});

test('after dark the near side lights up — rooms, outlines, uplights, neon and screens — and by day it rests',async({page})=>{
  await enterCity(page,'high');
  const lights=hour=>page.evaluate(async([hour,mine])=>{
    const t=window.__qinghe.town,room=t.rooms.get('city');
    t.daylight.setHour(hour);t.daylight.paused=true;
    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
    const kinds={};
    for(const top of room.root.children)if(new RegExp(mine).test(top.name))
      for(const render of top.findComponents('render'))for(const mi of render.meshInstances){
        const kind=mi.material.defines?.get('CITY_LED');
        if(kind)kinds[kind]=Math.max(kinds[kind]??0,mi.material.emissiveIntensity);
      }
    const clock=t.app.graphicsDevice.scope.resolve('city_clock').value;
    return {kinds,lit:clock[1]};
  },[hour,MINE]);
  const night=await lights(22),late=await lights(3),day=await lights(13);
  // Glazing, screens, outlines, uplights, searchlights and neon (city_led 1-6), each lit at night.
  expect(Object.keys(night.kinds).sort()).toEqual(['1','2','3','4','5','6']);
  for(const [kind,glow] of Object.entries(night.kinds))expect(glow,`kind ${kind} at night`).toBeGreaterThan(1);
  for(const [kind,glow] of Object.entries(day.kinds))expect(glow,`kind ${kind} by day`).toBe(0);
  // Fewer rooms are lit at three in the morning than at ten at night.
  expect(late.lit).toBeLessThan(night.lit-.3);
});

test('no two faces of different materials lie flush in the city, and its façades stand in layers 5 cm apart',async({page})=>{
  test.setTimeout(120000);
  await enterCity(page,'high');
  const found=await page.evaluate(mine=>{
    const t=window.__qinghe.town,room=t.rooms.get('city');
    // The checker of coplanar.spec.js (X-exterior's), for the city: every axis-aligned box face and
    // cylinder cap, same-facing, overlapping by more than a millimetre each way.
    const faces=root=>{
      const out=[];
      for(const e of root.find(n=>!!n.render&&n.enabled)){
        const type=e.render.type;if(type!=='box'&&type!=='cylinder')continue;
        const m=e.getWorldTransform().data,axes=[0,1,2].map(c=>[m[c*4],m[c*4+1],m[c*4+2]]);
        const along=axes.map(a=>{const l=Math.hypot(...a);return a.findIndex(v=>Math.abs(Math.abs(v)/l-1)<1e-4);});
        if(along.includes(-1))continue;
        const mi=e.render.meshInstances[0],b=mi.aabb,c=b.center,h=b.halfExtents,lo=[c.x-h.x,c.y-h.y,c.z-h.z],hi=[c.x+h.x,c.y+h.y,c.z+h.z];
        const caps=type==='box'?[0,1,2]:[along[1]];
        for(const a of caps)for(const s of [-1,1]){
          const plane=s<0?lo[a]:hi[a];
          if(a===1&&s<0&&plane<.05)continue;            // standing on the ground
          // A repainted piece (models.repaint) shares one vertex-colour material; its colour is on the component.
          out.push({e,mat:mi.material===t.m.painted?e.render.material:mi.material,a,s,plane,lo,hi});
        }
      }
      return out;
    };
    const top=e=>{while(e.parent&&e.parent!==room.root)e=e.parent;return e.name;};
    const pairs=(list,gap)=>{
      const bad=[],byPlane=new Map();
      // Bucket by facing and plane so the search stays near-linear over tens of thousands of faces.
      for(const p of list){const k=p.a*2+(p.s>0);if(!byPlane.has(k))byPlane.set(k,[]);byPlane.get(k).push(p);}
      for(const group of byPlane.values()){
        group.sort((p,q)=>p.plane-q.plane);
        for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length&&group[j].plane-group[i].plane<=gap;j++){
          const p=group[i],q=group[j];
          if(p.e===q.e||p.mat===q.mat)continue;
          const [u,v]=[0,1,2].filter(k=>k!==p.a);
          const du=Math.min(p.hi[u],q.hi[u])-Math.max(p.lo[u],q.lo[u]),dv=Math.min(p.hi[v],q.hi[v])-Math.max(p.lo[v],q.lo[v]);
          if(du>1e-3&&dv>1e-3)bad.push(`${top(p.e)} ${'xyz'[p.a]}${p.s>0?'+':'-'} ${(p.plane-room.offsetX*(p.a===0)).toFixed(3)}/${(q.plane-p.plane).toFixed(3)}: ${p.e.name}/${q.e.name} @${((p.lo[u]+p.hi[u])/2).toFixed(1)},${((p.lo[v]+p.hi[v])/2).toFixed(1)}`);
        }
      }
      return bad;
    };
    const scratch=new room.root.constructor('coplanar-probe');room.root.addChild(scratch);
    t.m.box(scratch,[0,1,40],[1,1,1],'#123456');t.m.box(scratch,[0,1.25,40],[1,.5,1.2],'#654321');
    for(const e of scratch.children)t.m.repaint(e);   // as batchStatics does: both end up on the one `painted` material
    const planted=pairs(faces(scratch),1e-3).length;scratch.destroy();
    const re=new RegExp(mine),all=[],facades=[];
    for(const child of room.root.children)if(re.test(child.name)){
      const list=faces(child);all.push(...list);
      if(/^(tower|skyline|block)$/.test(child.name))facades.push(...list);
    }
    const flush=pairs(all,1e-3);
    // Layers of a façade seen from far: parallel faces of different materials 1 mm..5 cm apart.
    const thin=pairs(facades,.049).filter(line=>!flush.includes(line));
    return {planted,faces:all.length,flush:flush.slice(0,30),flushCount:flush.length,thin:thin.slice(0,30),thinCount:thin.length};
  },MINE);
  console.log(`city faces ${found.faces}, flush ${found.flushCount}, thin ${found.thinCount}`);
  expect(found.planted,'the check finds a planted pair').toBeGreaterThan(0);
  expect(found.flush).toEqual([]);
  expect(found.thin).toEqual([]);
});

test('the city stays inside its draw-call budget at every detail level, and costs less as the level drops',async({browser})=>{
  test.setTimeout(240000);
  const SPOTS=[['avenue',0,21,0,0,2],['plaza',0,-43,160,0,8],['hill',-98,-26,-100,26,-6],['promenade east',40,-44,120,0,10]];
  const calls={};
  for(const level of ['high','medium','low']){
    const page=await browser.newPage();
    await enterCity(page,level);
    calls[level]={};
    for(const [name,x,z,yaw,y,pitch] of SPOTS){
      calls[level][name]=await page.evaluate(async([x,z,yaw,y,pitch])=>{
        const t=window.__qinghe.town;t.daylight.setHour(22);t.daylight.paused=true;
        t.warp(t.rooms.get('city').offsetX+x,z,yaw,y);t.pitch=pitch;
        for(let i=0;i<4;i++)await new Promise(done=>requestAnimationFrame(done));
        return t.app.stats.drawCalls.total;
      },[x,z,yaw,y,pitch]);
    }
    await page.close();
  }
  console.log('draw calls at 22:00',JSON.stringify(calls));
  for(const [name] of SPOTS){
    expect(calls.high[name],`${name} on high`).toBeLessThanOrEqual(900);
    expect(calls.low[name],`${name}: low costs less than high`).toBeLessThan(calls.high[name]);
  }
});
