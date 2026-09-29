import {test,expect} from '@playwright/test';

// The 打卡 camera (2026-09-27-development-wave-3.md, Task M-camera).
const SAVE_KEY='little-mandarin-town.v1';
const photoCount=page=>page.evaluate(()=>new Promise(resolve=>{
  const open=indexedDB.open('qinghe-photos',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('kv');
  open.onsuccess=()=>{const get=open.result.transaction('kv').objectStore('kv').get('photos');get.onsuccess=()=>{resolve(get.result?.length??0);open.result.close();};};
}));

async function arrive(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.mouse.click(700,500);
}

test('hold right to frame the fountain, click left to photograph it; the spot pays once',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await arrive(page);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.daylight.setHour(12);t.warp(0,9,0);t.pitch=-4;});   // facing the fountain
  const fov=await page.evaluate(()=>window.__qinghe.town.camera.camera.fov);

  // The context menu never opens over the game.
  const prevented=await page.evaluate(()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.querySelector('#world').dispatchEvent(e);return e.defaultPrevented;});
  expect(prevented).toBe(true);

  await page.mouse.move(700,500);
  await page.mouse.down({button:'right'});
  await expect(page.locator('#viewfinder')).toBeVisible();
  await expect(page.locator('#viewfinder .vf-name')).toContainText('喷泉');
  expect(await page.evaluate(()=>window.__qinghe.town.camera.camera.fov)).toBeLessThan(fov/2);

  await page.mouse.down({button:'left'});   // a chord: arrives as a pointermove
  await page.mouse.up({button:'left'});
  await expect.poll(()=>photoCount(page),{timeout:4000}).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.profile.wallet)).toBe(5);
  expect(await page.evaluate(()=>window.__qinghe.profile.claims['checkin:fountain'])).toBe(true);
  await expect(page.locator('#toast')).toContainText('打卡成功！');

  await page.keyboard.press('Enter');   // a second shot of the same spot pays nothing
  await expect.poll(()=>photoCount(page),{timeout:4000}).toBe(2);
  expect(await page.evaluate(()=>window.__qinghe.profile.wallet)).toBe(5);

  await page.mouse.up({button:'right'});
  await expect(page.locator('#viewfinder')).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.town.camera.camera.fov)).toBeCloseTo(fov,3);

  // The camera key toggles it too.
  await page.keyboard.press('c');
  await expect(page.locator('#viewfinder')).toBeVisible();
  await page.keyboard.press('c');
  await expect(page.locator('#viewfinder')).toBeHidden();

  // The journal's 相册 shows both photos and stamps the fountain; one can be deleted.
  await page.keyboard.press('1');
  const album=page.locator('#journal-album');
  await expect(album.locator('.album-photo')).toHaveCount(2);
  await expect(album.locator('.checkin-stamp.done')).toHaveText('喷泉');
  await expect(album.locator('.album-photo').first()).toContainText('喷泉');
  expect(await album.locator('img').first().getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/);
  // A real picture of the town, not an empty buffer: 320×180 with more than one colour in it.
  const picture=await album.locator('img').first().evaluate(async img=>{
    await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
    const g=c.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,c.width,c.height).data;
    let lo=255,hi=0;for(let i=0;i<d.length;i+=4){const v=d[i]+d[i+1]+d[i+2];lo=Math.min(lo,v);hi=Math.max(hi,v);}
    return {w:c.width,h:c.height,range:hi-lo};
  });
  expect(picture.w).toBe(320);expect(picture.h).toBe(180);expect(picture.range).toBeGreaterThan(60);
  await album.locator('.album-delete').first().click();
  await expect(album.locator('.album-photo')).toHaveCount(1);
  expect(await photoCount(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('placing furniture and a held toy keep both mouse buttons',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await arrive(page);
  // Pointer lock is what these clicks ask for; headless browsers may not grant it.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.locked=()=>true;t.warp(0,9,0);});

  // A held toy: the right button throws it, the camera stays down.
  await page.evaluate(()=>{const t=window.__qinghe.town,c=t.containers.findIndex(c=>c.place==='town');t.takeFrom(c);});
  expect(await page.evaluate(()=>!!window.__qinghe.town.toys.held)).toBe(true);
  await page.mouse.move(700,500);
  await page.mouse.down({button:'right'});
  await page.mouse.up({button:'right'});
  expect(await page.evaluate(()=>!!window.__qinghe.town.toys.held)).toBe(false);
  await expect(page.locator('#viewfinder')).toBeHidden();

  // Placing: either button puts the piece down (tryPlace), never the camera.
  const placed=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.enterRoom('home');t.placed=0;const real=t.tryPlace.bind(t);t.tryPlace=()=>{t.placed++;return real();};
    return t.beginPlacement({id:'wooden-bed',kind:'bed',color:'#b98b5f',footprint:[2.1,1.4]});
  });
  expect(placed).toBe(true);
  await page.mouse.down({button:'right'});
  await page.mouse.up({button:'right'});
  await expect(page.locator('#viewfinder')).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.town.placed)).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('the camera comes down when the window loses focus, the tab hides or the room changes, and ignores Ctrl+C',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await arrive(page);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(0,9,0);t.pitch=-4;});
  const finder=page.locator('#viewfinder');
  const fov=await page.evaluate(()=>window.__qinghe.town.camera.camera.fov);

  // Alt-tab with the right button held: no pointerup ever arrives.
  await page.mouse.move(700,500);
  await page.mouse.down({button:'right'});
  await expect(finder).toBeVisible();
  await page.evaluate(()=>dispatchEvent(new Event('blur')));
  await expect(finder).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.town.camera.camera.fov)).toBeCloseTo(fov,3);
  await page.mouse.up({button:'right'});

  // A hidden tab.
  await page.keyboard.press('c');
  await expect(finder).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
  await expect(finder).toBeHidden();

  // Modified presses are not the camera key.
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Alt+c');
  await expect(finder).toBeHidden();

  // Raised in third person, then through a door into a shop: down, first person, no complaint.
  await page.evaluate(()=>window.__qinghe.town.setView('third'));
  await page.keyboard.press('c');
  await expect(finder).toBeVisible();
  await page.evaluate(()=>{const t=window.__qinghe.town;t.enterRoom('cafe');});
  await expect(finder).toBeHidden();
  expect(await page.evaluate(()=>window.__qinghe.town.view)).toBe('first');
  await expect(page.locator('#toast')).not.toContainText('地方太小');
  expect(errors).toEqual([]);
});

test('a photo that cannot be drawn says so, and the next one still works; deleting keeps focus in the album',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await arrive(page);
  await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(0,9,0);t.pitch=-4;});
  await page.keyboard.press('c');
  await page.evaluate(()=>{const real=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(){HTMLCanvasElement.prototype.toDataURL=real;throw new Error('tainted');};});
  await page.keyboard.press('Enter');
  await expect(page.locator('#toast')).toContainText('照片没有保存成功。');
  await page.keyboard.press('Enter');
  await expect.poll(()=>photoCount(page),{timeout:4000}).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(()=>photoCount(page),{timeout:4000}).toBe(2);
  await page.keyboard.press('c');

  await page.keyboard.press('1');
  const album=page.locator('#journal-album');
  await expect(album.locator('.album-delete')).toHaveCount(2);
  await album.locator('.album-delete').first().click();
  await expect(album.locator('.album-delete')).toHaveCount(1);
  await expect(album.locator('.album-delete')).toBeFocused();
  await album.locator('.album-delete').click();
  await expect(album.locator('.album-photo')).toHaveCount(0);
  await expect(album.locator('h3')).toBeFocused();
  expect(errors.filter(e=>!e.includes('tainted'))).toEqual([]);
});
