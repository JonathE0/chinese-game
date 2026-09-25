import {test,expect} from '@playwright/test';

// A room's front doorway opens onto nothing: the room is a box floating 400 m out. You leave with E,
// so walking into the doorway must stop at the wall line instead of stepping out into the void.
for(const id of ['cafe','restaurant','home']){
  test(`walking into the doorway of ${id} stops at the wall`,async({page})=>{
    await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
    await page.waitForFunction(()=>!!window.__qinghe?.town);
    const front=await page.evaluate(id=>{const t=window.__qinghe.town,r=t.rooms.get(id);t.enterRoom(id);
      const d=r.data.size[1];t.warp(r.offsetX,d/2-1.2,180);return d/2;},id);   // facing the doorway
    await page.keyboard.down('w');await page.waitForTimeout(1600);await page.keyboard.up('w');
    const z=await page.evaluate(()=>window.__qinghe.town.player.entity.getPosition().z);
    expect(z).toBeLessThan(front);
    expect(await page.evaluate(()=>window.__qinghe.town.place)).toBe(id);
  });
}
