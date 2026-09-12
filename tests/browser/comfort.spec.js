import {test,expect} from '@playwright/test';

async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await expect.poll(()=>page.evaluate(()=>!!window.__qinghe?.town)).toBe(true);
}

test('jumping from shop furniture cannot push the player head through the ceiling',async({page})=>{
  await start(page);
  const result=await page.evaluate(()=>{
    const town=window.__qinghe.town;
    town.enterRoom('cafe');
    const room=town.rooms.get('cafe');
    town.warp(room.offsetX,1,0);
    town.playerY=room.data.height-1.72;
    town.player.entity.setPosition(room.offsetX,town.playerY,1);
    town.velocityY=6.4;town.grounded=false;town.paused=false;
    let maxHead=0;
    for(let i=0;i<30;i++){
      town.update(1/60);
      maxHead=Math.max(maxHead,town.playerY+1.7);
    }
    return {maxHead,ceiling:room.data.height};
  });
  expect(result.maxHead).toBeLessThanOrEqual(result.ceiling+.001);
});

test('a room warp and focus loss discard pending camera movement',async({page})=>{
  await start(page);
  const result=await page.evaluate(()=>{
    const t=window.__qinghe.town;
    t.lookPending.x=500;t.lookPending.y=200;
    t.warp(0,7,0);t.drainLook(1/60);
    const afterWarp=t.yaw;
    t.lookPending.x=500;t.keys.add('KeyW');
    dispatchEvent(new Event('blur'));t.drainLook(1/60);
    return {afterWarp,afterBlur:t.yaw,keys:t.keys.size};
  });
  expect(result).toEqual({afterWarp:0,afterBlur:0,keys:0});
});

test('numeric shortcuts switch utility panels but never interrupt typing or shopping',async({page})=>{
  await start(page);
  await page.keyboard.press('1');
  await expect(page.locator('#panel-title')).toHaveText('旅行手册');
  await page.keyboard.press('2');
  await expect(page.locator('#panel-title')).toHaveText('背包');
  await page.keyboard.press('3');
  await expect(page.locator('#panel-title')).toHaveText('生词本');
  await page.keyboard.press('4');
  await expect(page.locator('#panel-title')).toHaveText('身体状况');
  await page.keyboard.press('5');
  await expect(page.locator('#panel-title')).toHaveText('按你的节奏');
  await page.evaluate(()=>{
    const input=document.createElement('div');input.contentEditable='true';input.id='typing-fixture';
    document.querySelector('#panel-body').append(input);input.focus();
  });
  await page.keyboard.press('1');
  await expect(page.locator('#panel-title')).toHaveText('按你的节奏');
  await expect(page.locator('#typing-fixture')).toHaveText('1');
  await page.evaluate(()=>{window.__qinghe.ui.open('shop','商店','');});
  await page.keyboard.press('2');
  await expect(page.locator('#panel-title')).toHaveText('商店');
  await page.evaluate(async()=>{
    const {openBank}=await import('/src/ui/money.js');openBank(window.__qinghe);
  });
  await page.locator('[data-tab="loan"]').click();
  await page.locator('[data-loan="small"]').click();
  await page.keyboard.press('3');
  await expect(page.getByRole('button',{name:'确认借款'})).toBeVisible();
});

