import {test,expect} from '@playwright/test';
import {startGame} from './start.js';

/**
 * settings.mouse (W4-ux item 2): the default 'drag' never grabs the pointer, so nobody is stuck in
 * a small window; 'lock' keeps the old pointer-lock look, but lets go when the window does and does
 * not take the mouse back after a panel.
 */
const yaw=page=>page.evaluate(()=>window.__qinghe.town.yaw);
const locked=page=>page.evaluate(()=>document.pointerLockElement?.id??null);
const turn=(a,b)=>Math.abs(((b-a)%360+540)%360-180);
async function drag(page,dx,{steps=8}={}){
  await page.mouse.move(700,500);
  await page.mouse.down();
  await page.mouse.move(700+dx/2,500,{steps});
  await page.mouse.move(700+dx,500,{steps});
  await page.mouse.up();
}
async function arrive(page){
  await page.goto('/');await startGame(page);
  await page.evaluate(()=>window.__qinghe.town.warp(0,9,0));
  await page.waitForTimeout(150);
}

test('the default mouse never locks: a click does nothing to the view, a drag turns it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await arrive(page);
  expect(await page.evaluate(()=>window.__qinghe.town.mouseMode)).toBe('drag');
  await expect(page.locator('#look-hint [data-mouse=drag]')).toBeVisible();     // told how, until the first drag
  await expect(page.locator('#look-hint [data-mouse=lock]')).toBeHidden();
  const before=await yaw(page);
  await page.mouse.click(700,500);
  await page.mouse.click(800,400);
  await page.waitForTimeout(250);
  expect(await locked(page)).toBeNull();
  expect(turn(before,await yaw(page))).toBeLessThan(.5);
  await drag(page,200);
  await expect.poll(async()=>turn(before,await yaw(page)),{timeout:5000}).toBeGreaterThan(10);
  expect(await locked(page)).toBeNull();
  await expect(page.locator('#look-hint')).toBeHidden();                        // it has been learned
  // Moving the mouse with nothing held down does not look.
  await page.waitForTimeout(600);                                               // the drag's last turn has settled
  const after=await yaw(page);
  await page.mouse.move(300,300,{steps:5});
  await page.mouse.move(900,300,{steps:5});
  await page.waitForTimeout(250);
  expect(turn(after,await yaw(page))).toBeLessThan(.5);
  expect(errors).toEqual([]);
});

test('only a click acts on what you hold: a drag turns, and the toy stays in hand',async({page})=>{
  await arrive(page);
  const take=()=>page.evaluate(()=>{const t=window.__qinghe.town,c=t.containers.findIndex(c=>c.place==='town');t.takeFrom(c);return !!t.toys.held;});
  const held=()=>page.evaluate(()=>!!window.__qinghe.town.toys.held);
  expect(await take()).toBe(true);
  await drag(page,120);
  expect(await held(page)).toBe(true);                                          // 120 px is a drag, not a click
  await page.mouse.click(700,500);
  expect(await held(page)).toBe(false);                                         // a click throws it
  // A press that lingers is not a click either.
  expect(await take()).toBe(true);
  await page.mouse.move(700,500);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.up();
  expect(await held(page)).toBe(true);
});

test('holding the right button still raises the camera, without locking',async({page})=>{
  await arrive(page);
  await page.mouse.move(700,500);
  await page.mouse.down({button:'right'});
  await expect.poll(()=>page.evaluate(()=>!!window.__qinghe.town.viewfinder)).toBe(true);
  expect(await locked(page)).toBeNull();
  await page.mouse.up({button:'right'});
  await expect.poll(()=>page.evaluate(()=>!!window.__qinghe.town.viewfinder)).toBe(false);
});

test('Settings switch to the locked mouse: a click locks, leaving the window and panels let go',async({page})=>{
  await arrive(page);
  await page.keyboard.press('Digit5');
  await page.locator('#setting-mouse').selectOption('lock');
  expect(await page.evaluate(()=>window.__qinghe.profile.settings.mouse)).toBe('lock');
  expect(await page.evaluate(()=>window.__qinghe.town.mouseMode)).toBe('lock');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  expect(await locked(page)).toBeNull();                                        // closing the panel did not lock
  await expect(page.locator('#look-hint [data-mouse=lock]')).toBeVisible();
  await page.mouse.click(700,500);
  await expect.poll(()=>locked(page)).toBe('world');
  const before=await yaw(page);
  await page.mouse.move(1000,500);
  await expect.poll(async()=>turn(before,await yaw(page)),{timeout:5000}).toBeGreaterThan(5);
  // The window loses focus: the mouse is given back.
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect.poll(()=>locked(page)).toBeNull();
  await page.mouse.click(700,500);
  await expect.poll(()=>locked(page)).toBe('world');
  // A panel takes it, and closing the panel does not give it back.
  await page.keyboard.press('Digit1');
  await expect(page.locator('#panel')).toBeVisible();
  await expect.poll(()=>locked(page)).toBeNull();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  expect(await locked(page)).toBeNull();
  // And back to dragging in Settings.
  await page.keyboard.press('Digit5');
  await page.locator('#setting-mouse').selectOption('drag');
  await page.keyboard.press('Escape');
  await page.mouse.click(700,500);
  await page.waitForTimeout(250);
  expect(await locked(page)).toBeNull();
});

test('a saved lock mouse is used from the first frame, and a bad value falls back to drag',async({page})=>{
  const save=mouse=>({version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],
    phrases:[],saved:[],home:[],discovered:[],clock:14,dayIndex:0,vendors:{},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0,mouse},playerName:'旅人'});
  const key='little-mandarin-town.v1';
  await page.addInitScript(([k,v])=>{if(!localStorage.getItem(k))localStorage.setItem(k,v);},[key,JSON.stringify(save('lock'))]);
  await page.goto('/');await startGame(page);
  expect(await page.evaluate(()=>window.__qinghe.town.mouseMode)).toBe('lock');
  await page.mouse.click(700,500);
  await expect.poll(()=>locked(page)).toBe('world');
  const other=await page.context().newPage();
  await other.addInitScript(([k,v])=>{localStorage.setItem(k,v);},[key,JSON.stringify(save('grab'))]);
  await other.goto('/');await startGame(other);
  expect(await other.evaluate(()=>window.__qinghe.town.mouseMode)).toBe('drag');
});

test('with the camera up a left click takes the photo and a left drag aims without taking it',async({page})=>{
  await arrive(page);
  await page.evaluate(()=>{window.__shots=0;window.__qinghe.town.onShutter=()=>{window.__shots++;};});
  const shots=()=>page.evaluate(()=>window.__shots);
  await page.mouse.move(700,500);
  await page.mouse.down({button:'right'});
  await expect.poll(()=>page.evaluate(()=>!!window.__qinghe.town.viewfinder)).toBe(true);
  await page.mouse.down({button:'left'});                       // a chord: arrives as a pointermove
  await page.mouse.up({button:'left'});
  await expect.poll(shots).toBe(1);
  const before=await yaw(page);
  await page.mouse.down({button:'left'});
  await page.mouse.move(820,500,{steps:8});
  await page.mouse.up({button:'left'});
  await expect.poll(async()=>turn(before,await yaw(page)),{timeout:5000}).toBeGreaterThan(3);
  expect(await shots()).toBe(1);
  expect(await page.evaluate(()=>!!window.__qinghe.town.viewfinder)).toBe(true);   // still framing
  await page.mouse.up({button:'right'});
  await expect.poll(()=>page.evaluate(()=>!!window.__qinghe.town.viewfinder)).toBe(false);
  expect(await locked(page)).toBeNull();
});
