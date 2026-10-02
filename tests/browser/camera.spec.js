import {test,expect} from '@playwright/test';
import {startGame} from './start.js';

// The 打卡 camera (2026-09-27-development-wave-3.md, Task M-camera).
const SAVE_KEY='little-mandarin-town.v1';
const photoCount=page=>page.evaluate(()=>new Promise(resolve=>{
  const open=indexedDB.open('qinghe-photos',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('kv');
  open.onsuccess=()=>{const get=open.result.transaction('kv').objectStore('kv').get('photos');get.onsuccess=()=>{resolve(get.result?.length??0);open.result.close();};};
}));

// A traveller with the Qinghe album photos done and a secondhand camera with film, so their own camera comes up.
const ALBUM=['roots-fruit','roots-square','roots-home'];
async function arrive(page,save={}){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{'secondhand-camera':1,film:6},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    roots:{started:true,discovered:ALBUM,photos:ALBUM},
    settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人',...save,
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
  await expect(page.locator('#viewfinder .vf-which')).toHaveText('我的相机 · 胶卷 6');
  // A gentle zoom to start with; the wheel (or a two-finger scroll) zooms further in.
  const gentle=await page.evaluate(()=>window.__qinghe.town.camera.camera.fov);
  expect(gentle).toBeLessThan(fov);expect(gentle).toBeGreaterThan(fov/2);
  await page.mouse.wheel(0,-500);
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.camera.camera.fov)).toBeLessThan(fov/2);

  await page.mouse.down({button:'left'});   // a chord: arrives as a pointermove
  await page.mouse.up({button:'left'});
  await expect.poll(()=>photoCount(page),{timeout:4000}).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.profile.wallet)).toBe(5);
  expect(await page.evaluate(()=>window.__qinghe.profile.claims['checkin:fountain'])).toBe(true);
  await expect(page.locator('#toast')).toContainText('打卡成功！');
  // One film a photo, and the first check-in with your own camera finishes the my-camera mission.
  expect(await page.evaluate(()=>window.__qinghe.profile.inventory.film)).toBe(5);
  expect(await page.evaluate(()=>window.__qinghe.profile.completed)).toContain('camera:first');

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

// Two cameras, adjustable zoom, keyboard/trackpad/touch controls (2026-09-30-development-wave-4.md, W4-camera).
const shots='.claude/checkpoints/W4-camera';
test('Grandpa’s camera takes the friends-in-the-square photo at the default zoom after walking there; your own takes the check-in',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // A new traveller (the Roots opening gives Grandpa's camera) who has bought a secondhand camera and some film.
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{'secondhand-camera':1,film:3},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    settings:{pinyin:true,english:true,dialogueVolume:0.9,ambientVolume:0.35,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await startGame(page);
  await page.waitForFunction(()=>!!window.__qinghe?.town&&!window.__qinghe.town.paused);
  expect(await page.evaluate(()=>window.__qinghe.profile.inventory['grandpa-camera'])).toBe(1);
  expect(await page.evaluate(()=>window.__qinghe.profile.inventory.film)).toBe(3);

  // Walk east across the south of the square (clear of Uncle Zhou's customers), then turn to face the fountain with the arrow keys.
  await page.evaluate(()=>{const t=window.__qinghe.town;t.daylight.setHour(11);t.warp(-7.5,9.5,-90);});
  await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__qinghe.town.player.entity.getPosition().x>=-.3,null,{timeout:10000});
  await page.keyboard.up('w');
  const where=()=>page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();return {x:p.x,z:p.z,yaw:t.yaw};});
  await page.waitForTimeout(300);   // let the walk settle
  const before=await where();
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(1000);await page.keyboard.up('ArrowLeft');
  const after=await where();
  expect(after.yaw-before.yaw).toBeGreaterThan(50);   // the arrows turn the view…
  expect(Math.hypot(after.x-before.x,after.z-before.z)).toBeLessThan(.3);   // …and no longer walk

  // At the album spot, with that photo still sought, the camera key brings up Grandpa's camera, ready at the default zoom.
  await page.keyboard.press('c');
  const finder=page.locator('#viewfinder');
  await expect(finder.locator('.vf-which')).toHaveText('爷爷的相机');
  await expect(finder.locator('.vf-zoom output')).toHaveText('1.5×');
  await expect(finder.locator('.vf-name')).toContainText('Ready to capture');
  await page.screenshot({path:shots+'/viewfinder-grandpa.png'});
  await page.mouse.click(700,400);   // a single click on the view takes it (a trackpad tap is the same)
  await expect.poll(()=>page.evaluate(()=>window.__qinghe.profile.roots.photos)).toContain('roots-square');
  await expect(page.locator('#toast')).toContainText('Memory captured');
  expect(await page.evaluate(()=>window.__qinghe.profile.inventory.film)).toBe(3);   // Grandpa's camera uses no film

  // Switch to your own: the name, the film left, and the zoom from the keys and the slider.
  await page.keyboard.press('b');
  await expect(finder.locator('.vf-which')).toHaveText('我的相机 · 胶卷 3');
  await page.evaluate(()=>{const t=window.__qinghe.town;t.yaw=0;t.pitch=-3;});
  await expect(finder.locator('.vf-name')).toContainText('喷泉');
  const fov=()=>page.evaluate(()=>window.__qinghe.town.camera.camera.fov);
  const wide=await fov();
  await page.keyboard.press('Equal');await page.keyboard.press('Equal');
  await expect(finder.locator('.vf-zoom output')).toHaveText('2.3×');
  expect(await fov()).toBeLessThan(wide);
  await page.keyboard.press('Minus');
  await expect(finder.locator('.vf-zoom output')).toHaveText('1.9×');
  await finder.locator('.vf-zoom input').fill('3');
  await expect(finder.locator('.vf-zoom output')).toHaveText('3.0×');
  const sens=await page.evaluate(()=>({now:window.__qinghe.town.sensitivity,set:window.__qinghe.profile.settings.sensitivity??.12}));
  expect(sens.now).toBeCloseTo(sens.set/3,4);   // the aim steadies with the zoom
  // A click on the slider that does not move it still hands the keys back (the shutter below needs them).
  await finder.locator('.vf-zoom input').fill('4');
  const slider=await finder.locator('.vf-zoom input').boundingBox();
  await page.mouse.click(slider.x+slider.width-2,slider.y+slider.height/2);
  expect(await page.evaluate(()=>document.activeElement?.type)).not.toBe('range');
  await page.screenshot({path:shots+'/viewfinder-mine.png'});
  await page.keyboard.press('Space');   // the shutter while the camera is up, not a jump
  await expect.poll(()=>photoCount(page),{timeout:4000}).toBe(1);
  expect(await page.evaluate(()=>window.__qinghe.profile.inventory.film)).toBe(2);
  expect(await page.evaluate(()=>window.__qinghe.profile.completed)).toContain('camera:first');
  await expect(finder.locator('.vf-which')).toHaveText('我的相机 · 胶卷 2');

  // Esc puts it down; the album page now holds the photo beside Grandpa's.
  await page.keyboard.press('Escape');
  await expect(finder).toBeHidden();
  await page.evaluate(async()=>{const {openRootsAlbum}=await import('/src/ui/roots.js');openRootsAlbum(window.__qinghe);});
  const card=page.locator('[data-memory="roots-square"]');
  await expect(card).toContainText('Now — your photo');
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({path:shots+'/square-photo.png'});
  expect(errors).toEqual([]);
});

test('the resale shop sells the secondhand camera once',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await arrive(page,{wallet:50,inventory:{},completed:['home:tutorial','home:starter','purchase:first']});
  await page.evaluate(async()=>{const {openResale}=await import('/src/ui/money.js');openResale(window.__qinghe);});
  const card=page.locator('[data-buy="secondhand-camera"]');
  await expect(card).toContainText('二手相机');await expect(card).toContainText('40');
  await page.screenshot({path:shots+'/resale-shop.png'});
  await card.click();
  await page.locator('#confirm-purchase').click();
  expect(await page.evaluate(()=>window.__qinghe.profile.inventory['secondhand-camera'])).toBe(1);
  expect(await page.evaluate(()=>window.__qinghe.profile.wallet)).toBe(10);
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('on a touch screen',()=>{
  test.use({hasTouch:true});
  test('the camera button raises it and a tap on the view takes the photo',async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await arrive(page);
    await page.evaluate(()=>{const t=window.__qinghe.town;t.daylight.setHour(12);t.warp(0,9,0);t.pitch=-4;});
    await page.touchscreen.tap(900,300);   // the first touch brings up the touch controls
    await page.locator('.touch-pad [data-action="camera"]').tap();
    await expect(page.locator('#viewfinder')).toBeVisible();
    await page.touchscreen.tap(900,300);
    await expect.poll(()=>photoCount(page),{timeout:4000}).toBe(1);
    expect(errors).toEqual([]);
  });
});
