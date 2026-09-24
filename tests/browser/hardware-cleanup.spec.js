import {test,expect} from '@playwright/test';
async function start(page){
 await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
 await page.waitForFunction(()=>window.__qinghe?.hskWords?.length>0);
 await page.evaluate(()=>{const c=window.__qinghe;c.profile.wallet=200;c.profile.completed.push('home:tutorial','home:starter');c.save();});
}
test('enter the department store, buy a mixed basket, and walk back to the city',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await page.evaluate(()=>{const t=window.__qinghe.town;t.enterCity();t.warp(-4008.8,0,90);});
 await expect(page.locator('#interact span')).toHaveText('进星光五金百货');await page.keyboard.press('e');
 await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('hardware');
 await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(t.rooms.get('hardware').offsetX,-3.3,0);});
 await expect(page.locator('#interact span')).toContainText('五金建材');await page.keyboard.press('e');
 await page.locator('[data-shop-item="timber"]').click();await page.locator('#item-more').click();await page.locator('#item-more').click();await page.locator('#item-add').click();
 await page.locator('[data-shop-item="brick"]').click();await page.locator('#item-add').click();
 await page.locator('#cart-open').click();await expect(page.locator('.cart-table tbody tr')).toHaveCount(2);await page.locator('#cart-pay').click();
 const inventory=await page.evaluate(()=>window.__qinghe.profile.inventory);expect(inventory.timber).toBe(3);expect(inventory.brick).toBe(1);
 await page.locator('.close-button').click();
 await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(t.rooms.get('hardware').offsetX,6.6,180);});
 await expect(page.locator('#interact span')).toHaveText('回到步行街');await page.keyboard.press('e');
 await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.place)).toBe('city');
 expect(await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return t.canMove(p.x,p.z,0);})).toBe(true);
 expect(errors).toEqual([]);
});
test('HSK cards display distinct bilingual definitions and preserve them in bookmarks',async({page})=>{
 await start(page);await page.evaluate(async()=>{const {openHsk}=await import('/src/ui/hsk.js');await openHsk(window.__qinghe);});
 await page.locator('#hsk-search').fill('说');
 const card=page.locator('.hsk-row').filter({has:page.locator('[data-save="hsk-be305869"]')});
 await card.locator('.word-definitions > summary').click();
 await expect(card.locator('.definition-zh')).not.toBeEmpty();await expect(card.locator('.definition-en')).toContainText('to speak');
 await card.locator('[data-save]').click();
 await page.locator('[data-level="2"]').click();await page.locator('#hsk-search').fill('黄');
 const yellow=page.locator('[data-word="hsk-7720f8ea"]');await yellow.locator('.word-definitions > summary').click();
 await expect(yellow.locator('.definition-en')).toHaveText('yellow');await expect(yellow.locator('.definition-zh')).toContainText('颜色');
 await page.reload();await page.getByRole('button',{name:'开始旅行'}).click();
 const saved=await page.evaluate(()=>window.__qinghe.profile.saved.find(w=>w.zh==='说'));expect(saved.definitionZh.length).toBeGreaterThan(3);expect(saved.en).toContain('to scold');
});
test('independent world objects and full tree canopies have clear footprints',async({page})=>{
 await start(page);
 const conflicts=await page.evaluate(()=>{
  const t=window.__qinghe.town;t.ensureCity();const conflicts=[];
  for(const place of ['town','city']){
   const boxes=t.registry.boxes.filter(b=>b.place===place&&b.solid);
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j],an=a.name?.id,bn=b.name?.id;
    // Connected structural parts and deliberate assemblies share a footprint.
    if(an==='metro-station'&&bn===an||[an,bn].sort().join() === 'door,hedge')continue;
    if(a.group&&a.group===b.group)continue;   // a building and its own wings
    if(a.x===b.x&&a.z===b.z&&(an===bn||[an,bn].sort().join()==='table,umbrella'||[an,bn].sort().join()==='teahouse,wall'))continue;
    if(a.y0<b.y1&&b.y0<a.y1&&Math.abs(a.x-b.x)<a.hw+b.hw-.02&&Math.abs(a.z-b.z)<a.hd+b.hd-.02)conflicts.push([place,an,a.x,a.z,bn,b.x,b.z]);
   }
  }
  return conflicts;
 });
 expect(conflicts).toEqual([]);
});
test('staff and moving night vendors remain clear of scenery for a full route',async({page})=>{
 await start(page);
 const result=await page.evaluate(()=>{
  const t=window.__qinghe.town;t.enterRoom('restaurant');t.warp(t.rooms.get('restaurant').offsetX,3.8,0);
  const room=t.rooms.get('restaurant'),initial=room.staff.map(s=>[s.x,s.z]),hits=[];
  for(let i=0;i<900;i++){
   t.walkStaff(1/30);
   for(const s of room.staff)if(t.registry.blocks('restaurant',room.offsetX+s.x,s.z,0,.52))hits.push(s.id);
  }
  for(let i=0;i<300;i++){t.market.update(1/30,{hour:19,place:'restaurant',offCamera:()=>true});t.market.syncHitboxes(t.registry,id=>({id}));}
  const open=t.market.pitches.map(p=>p.state);
  const safe=t.market.pitches.every(p=>p.cart&&t.market.clearPose(p,p.x,p.z,p.heading));
  for(let i=0;i<300;i++){t.market.update(1/30,{hour:12,place:'restaurant',offCamera:()=>true});t.market.syncHitboxes(t.registry,id=>({id}));}
  return {hits,initial,after:room.staff.map(s=>[s.x,s.z]),open,safe,closed:t.market.pitches.map(p=>p.state)};
 });
 expect(result.hits).toEqual([]);expect(result.after).not.toEqual(result.initial);
 expect(result.open).toEqual(['open','open']);expect(result.safe).toBe(true);expect(result.closed).toEqual(['away','away']);
});
