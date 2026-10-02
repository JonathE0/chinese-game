import {test,expect} from '@playwright/test';

// 星光百货 (docs/superpowers/plans/2026-09-27-development-wave-3.md, Y-mall; on 美食街 since wave 4): in from the street, up
// and down its four floors by escalator and by lift, something bought in every shop, the hardware
// store off the ground floor, what each floor costs to draw, and lighter builds on lower settings.
const SAVE_KEY='little-mandarin-town.v1';
async function start(page,quality){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:1000,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0,...(quality?{quality}:{})},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
}
/** Stand somewhere in the mall (room-local x, z, on floor height y) looking along yaw. */
const stand=(page,x,z,yaw,y=0)=>page.evaluate(([x,z,yaw,y])=>{
  const t=window.__qinghe.town,room=t.rooms.get('mall');t.setPaused(false);t.warp(room.offsetX+x,z,yaw,y);
},[x,z,yaw,y]);
const floor=page=>page.evaluate(()=>window.__qinghe.town.floorY());
const place=page=>page.evaluate(()=>window.__qinghe.town.place);
const prompt=page=>page.locator('#interact span');
/** E, once the town has settled on what E is for. */
const press=async(page,id)=>{await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.nearest?.id)).toBe(id);await page.keyboard.press('e');};

test('in from 美食街, up every floor by escalator and down again, and the lift to the top',async({page})=>{
  test.setTimeout(120000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  // Its door (city.json `doors`) is on 美食街, the mall's front facing north over the street.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.setPaused(false);t.warp(-4000-76.5,49.6,180);});
  await expect(prompt(page)).toHaveText('进商场');
  await press(page,'door:mall');
  await expect.poll(()=>place(page)).toBe('mall');
  // Standing still on the first step, the escalator carries you up.
  await stand(page,-5.7,-2.1,-90);
  await page.waitForTimeout(2500);
  const carried=await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return {x:p.x-t.rooms.get('mall').offsetX,y:t.playerY};});
  expect(carried.x).toBeGreaterThan(-4.5);
  expect(carried.y).toBeGreaterThan(.5);
  // Up: walking up each scissor flight in turn, from the landing where the last one left you.
  for(const [x,z,yaw,from,to] of [[-6.7,-2.1,-90,0,6],[6.7,.7,90,6,12],[-6.7,-2.1,-90,12,18],
    // ...and down the other three.
    [6.7,-.7,90,18,12],[-6.7,2.1,-90,12,6],[6.7,-.7,90,6,0]]){
    await stand(page,x,z,yaw,from);
    await page.keyboard.down('w');
    await expect.poll(()=>floor(page),{timeout:15000,message:`from ${from} to ${to}`}).toBe(to);
    await page.waitForTimeout(700);
    await page.keyboard.up('w');
  }
  // The lift: its call point on the ground floor, a floor chosen, and out on the fourth.
  await stand(page,0,-10.9,180);
  await expect(prompt(page)).toHaveText('电梯');
  await page.keyboard.press('e');
  await expect(page.locator('[data-floor]')).toHaveCount(4);
  await expect(page.locator('[data-floor="0"]')).toBeDisabled();
  await page.locator('[data-floor="3"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.rooms.get('mall').lift.riding),{timeout:3000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>{const t=window.__qinghe.town;return !t.rooms.get('mall').lift.riding&&t.floorY();}),{timeout:20000}).toBe(18);
  const out=await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return {z:p.z,free:t.canMove(p.x,p.z)};});
  expect(out.z).toBeLessThan(-10);
  expect(out.free).toBe(true);
  // And the way out, from the ground floor, back onto 美食街 facing it.
  await stand(page,0,16.8,180);
  await expect(prompt(page)).toHaveText('出口');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('city');
  expect(errors).toEqual([]);
});

test('every shop sells, its assistant says its line, and 星光五金百货 is through the door on the ground floor',async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.enterRoom('mall');});
  // Each counter, from in front of it on its own floor: its label, its panel, and one thing bought.
  for(const [x,z,yaw,y,label,item] of [
    [14.3,-6.5,-90,0,'收银台 · 手机店','mall-erji'],[14.1,6.5,-90,0,'看看菜单','mall-zhenzhu-naicha'],
    [14.3,0,-90,6,'收银台 · 运动用品','mall-yundongxie'],[-14.3,0,90,6,'收银台 · 服装店','mall-txu'],
    [14.3,0,-90,12,'收银台 · 玩具店','mall-wanjuxiong'],[11.9,-8,-90,18,'炒饭 · 拉面','mall-lamian']]){
    await stand(page,x,z,yaw,y);
    await expect(prompt(page),`the counter at ${x},${z} on ${y}`).toHaveText(label);
    await page.keyboard.press('e');
    await page.locator(`[data-shop-item="${item}"]`).click();
    await page.locator('#item-add').click();
    await page.locator('#cart-open').click();
    await page.locator('#cart-pay').click();
    await expect.poll(()=>page.evaluate(id=>window.__qinghe.profile.inventory[id]??0,item)).toBe(1);
    await page.locator('.close-button').click();
  }
  // The tea bar's assistant, in their own words.
  await stand(page,14.4,6.5,-90);
  await page.evaluate(()=>window.__qinghe.town.onInteract('staff:mall-tea-clerk'));
  await expect(page.locator('#panel')).toContainText('欢迎光临');
  await page.locator('#assistant-next').click();
  await expect(page.locator('#panel')).toContainText('奶茶要少糖吗？');
  await expect(page.locator('#assistant-browse')).toBeVisible();
  await page.locator('#assistant-bye').click();
  // The information desk says where the food court is; the food court asks what you would like.
  await stand(page,-4.6,13,90);
  await page.evaluate(()=>window.__qinghe.town.onInteract('staff:mall-info-clerk'));
  await expect(page.locator('#panel')).toContainText('您好，需要帮忙吗？');
  await expect(page.locator('#panel')).toContainText('美食广场在四楼。');
  await page.locator('#assistant-bye').click();
  await stand(page,13.9,0,-90,18);
  await page.evaluate(()=>window.__qinghe.town.onInteract('staff:mall-food-clerk'));
  await page.locator('#assistant-next').click();
  await expect(page.locator('#panel')).toContainText('想吃点儿什么？');
  await page.locator('#assistant-bye').click();
  // 星光五金百货: in through its door on the ground floor, and back out into the mall.
  await stand(page,-17.1,0,90);
  await expect(prompt(page)).toHaveText('进五金百货');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('hardware');
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(t.rooms.get('hardware').offsetX,6.6,180);});
  await expect(prompt(page)).toHaveText('进商场');
  await page.keyboard.press('e');
  await expect.poll(()=>place(page)).toBe('mall');
  const back=await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return {x:p.x-t.rooms.get('mall').offsetX,yaw:t.yaw,free:t.canMove(p.x,p.z,0)};});
  expect(back.x).toBeCloseTo(-16.3,2);
  expect(back).toMatchObject({yaw:-90,free:true});
  expect(errors).toEqual([]);
});

/** Draw calls from a few places on each floor, two frames after getting there. */
async function drawCalls(page){
  const out={};
  for(const [name,x,z,yaw,y,pitch] of [['1F entrance',0,15.6,0,0,6],['1F atrium',0,8,0,0,50],['2F lift',0,-13.5,180,6,2],
    ['3F gallery',-9,6,40,12,-6],['4F atrium',-2,12.3,-20,18,-38],['4F food court',8,-3,-90,18,-4]]){
    await page.evaluate(([x,z,yaw,y,pitch])=>{const t=window.__qinghe.town,room=t.rooms.get('mall');t.warp(room.offsetX+x,z,yaw,y);t.pitch=pitch;},[x,z,yaw,y,pitch]);
    out[name]=await page.evaluate(()=>new Promise(done=>{const app=window.__qinghe.town.app;
      requestAnimationFrame(()=>requestAnimationFrame(()=>done(app.stats.drawCalls.total)));}));
  }
  return out;
}
test('every floor stays inside the draw-call budget, and lower settings build a lighter mall',async({page,browser})=>{
  test.setTimeout(90000);
  await start(page);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.enterRoom('mall');t.setPaused(false);});
  const count=p=>p.evaluate(()=>{const inside=window.__qinghe.town.rooms.get('mall').root.findByName('mall-inside');
    return {meshes:inside.find(e=>!!e.render).length,lights:inside.find(e=>!!e.light).length};});
  const high=await drawCalls(page),built=await count(page);
  console.log('high',JSON.stringify(high),JSON.stringify(built));
  for(const [spot,n] of Object.entries(high))expect(n,spot).toBeLessThanOrEqual(900);
  const other=await browser.newPage();
  await start(other,'low');
  await other.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.enterRoom('mall');t.setPaused(false);});
  const low=await drawCalls(other),lighter=await count(other);
  console.log('low',JSON.stringify(low),JSON.stringify(lighter));
  expect(lighter.meshes).toBeLessThan(built.meshes);
  expect(lighter.lights).toBe(0);
  for(const [spot,n] of Object.entries(low))expect(n,spot).toBeLessThanOrEqual(high[spot]);
  await other.close();
});

test('the mall, inside and out, has no coplanar faces of different materials',async({page})=>{
  await start(page);
  const found=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.ensureCity();
    const inPerson=e=>{for(let n=e;n;n=n.parent)if(n.name==='person')return true;return false;};
    // As tests/browser/coplanar.spec.js: axis-aligned box faces and cylinder caps, same plane, same way, overlapping.
    const faces=root=>{
      const out=[];
      for(const e of root.find(n=>!!n.render&&n.enabled)){
        const type=e.render.type;if((type!=='box'&&type!=='cylinder')||inPerson(e))continue;
        const m=e.getWorldTransform().data,axes=[0,1,2].map(c=>[m[c*4],m[c*4+1],m[c*4+2]]);
        const along=axes.map(a=>{const l=Math.hypot(...a);return a.findIndex(v=>Math.abs(Math.abs(v)/l-1)<1e-4);});
        if(along.includes(-1))continue;
        const mi=e.render.meshInstances[0],b=mi.aabb,c=b.center,h=b.halfExtents,lo=[c.x-h.x,c.y-h.y,c.z-h.z],hi=[c.x+h.x,c.y+h.y,c.z+h.z];
        // A repainted piece (models.repaint) shares one vertex-colour material; its colour is on the component.
        const mat=mi.material===t.m.painted?e.render.material:mi.material;
        for(const a of type==='box'?[0,1,2]:[along[1]])for(const s of [-1,1])out.push({e,mat,a,s,plane:s<0?lo[a]:hi[a],lo,hi});
      }
      return out;
    };
    const pairs=list=>{
      const bad=[];
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const p=list[i],q=list[j];
        if(p.a!==q.a||p.s!==q.s||p.e===q.e||p.mat===q.mat||Math.abs(p.plane-q.plane)>1e-3)continue;
        const [u,v]=[0,1,2].filter(k=>k!==p.a);
        if(Math.min(p.hi[u],q.hi[u])-Math.max(p.lo[u],q.lo[u])>1e-3&&Math.min(p.hi[v],q.hi[v])-Math.max(p.lo[v],q.lo[v])>1e-3)
          bad.push(`${'xyz'[p.a]}${p.s>0?'+':'-'} ${p.plane.toFixed(3)}: ${p.e.parent?.lookName??p.e.parent?.name} / ${q.e.parent?.lookName??q.e.parent?.name}`);
      }
      return bad;
    };
    // The auditor must see a planted pair, repainted as batched pieces are, or a clean result means nothing.
    const scratch=new t.root.constructor('coplanar-probe');t.root.addChild(scratch);
    t.m.box(scratch,[0,1,40],[1,1,1],'#123456');t.m.box(scratch,[0,1.25,40],[1,.5,1.2],'#654321');
    for(const e of scratch.children)t.m.repaint(e);
    const planted=pairs(faces(scratch)).length;scratch.destroy();
    const room=t.rooms.get('mall'),was=room.root.enabled;room.prepare?.();room.root.enabled=true;
    const out={planted,inside:pairs(faces(room.root.findByName('mall-inside'))),outside:pairs(faces(t.rooms.get('city').root.findByName('mall-building')))};
    room.root.enabled=was;
    return out;
  });
  expect(found.planted,'the check finds a planted pair').toBeGreaterThan(0);
  expect(found.inside).toEqual([]);
  expect(found.outside).toEqual([]);
});

test('the seats on every floor are offered and sat on from that floor, at their own height',async({page})=>{
  await start(page);
  const seen=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.enterCity();t.enterRoom('mall');t.setPaused(false);
    const room=t.rooms.get('mall'),levels=room.data.levels,out=[];
    const seats=[...room.fittings.entries()].filter(([,f])=>f.seat!==undefined);
    for(const y of levels){
      const [index,f]=seats.find(([,f])=>(f.y??0)===y)??[];
      if(index===undefined){out.push({y,missing:true});continue;}
      // Offered on its own floor only: never a phantom 坐下 over the same spot on another floor.
      const offered=levels.filter(at=>{t.playerY=at;return t.targets().some(one=>one.id==='sit:'+index);});
      t.warp(room.offsetX+f.x+.9,f.z,0,y);
      const sat=t.sit(index),seated=t.playerY;
      t.stand();
      out.push({y,offered,sat,seated,stood:t.playerY});
    }
    return out;
  });
  for(const one of seen){
    expect(one.missing,`a seat on the floor at ${one.y}`).toBeUndefined();
    expect(one.offered,`where the seat on ${one.y} is offered`).toEqual([one.y]);
    expect(one.sat).toBe(true);
    expect(one.seated,`sitting on ${one.y}`).toBeGreaterThan(one.y-.5);
    expect(one.seated).toBeLessThan(one.y+.5);
    expect(one.stood,`standing up on ${one.y}`).toBe(one.y);
  }
});

test('the mall is fitted out the first time it is entered, not when the game loads',async({page})=>{
  await start(page);
  const before=await page.evaluate(()=>{const t=window.__qinghe.town,room=t.rooms.get('mall');
    return {fitted:!!room.root.findByName('mall-inside'),meshes:room.root.find(e=>!!e.render).length,solid:t.registry.boxes.filter(b=>b.place==='mall').length};});
  expect(before.fitted).toBe(false);
  expect(before.solid,'its floors, steps and railings are solid all the same').toBeGreaterThan(300);
  const after=await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.enterRoom('mall');const room=t.rooms.get('mall');
    return {fitted:!!room.root.findByName('mall-inside'),meshes:room.root.find(e=>!!e.render).length,lift:!!room.lift};});
  expect(after.fitted).toBe(true);
  expect(after.lift).toBe(true);
  expect(after.meshes).toBeGreaterThan(before.meshes+500);
});
