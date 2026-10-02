import {test,expect} from '@playwright/test';
import {startGame} from './start.js';

/**
 * The first frame of a new game: you have just come in through the town gate of 莲池公园, looking up
 * the avenue over the lotus pond at 莲心亭, with Grandfather's house beside you on the right and
 * nothing standing between you and either.
 */
test('a fresh start opens inside the town gate, looking up the park at the pavilion with the house beside it',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await startGame(page);
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.waitForTimeout(400);
  const view=await page.evaluate(()=>{
    const t=window.__qinghe.town,cam=t.camera,eye=cam.getPosition().clone(),V=eye.constructor;
    const canvas=t.app.graphicsDevice.canvas,w=canvas.clientWidth,h=canvas.clientHeight;
    const home=t.data.buildings.find(b=>b.id==='home'),face=(home.rotation??0)===180?-1:1;
    // The pavilion's roof, and the house's first ground-floor window beside the study wing, clear
    // of the xiangqi players further along its front.
    const points={pavilion:[0,3.4,34],house:[home.x-face*(home.width/2-1.35),1.8,home.z+face*home.depth/2]};
    const out={place:t.place,spawn:[...t.data.spawn],eye:[eye.x,eye.y,eye.z],w,h,district:t.districtAt(eye.x,eye.z).id};
    for(const [id,[x,y,z]] of Object.entries(points)){
      const s=cam.camera.worldToScreen(new V(x,y,z));
      const dir=new V(x-eye.x,y-eye.y,z-eye.z),dist=dir.length();dir.normalize();
      const hit=t.registry.look('town',eye,dir,60);
      out[id]={screen:[s.x,s.y,s.z],inside:s.z>0&&s.x>=0&&s.x<=w&&s.y>=0&&s.y<=h,dist,
        hit:hit?.box.name?.id??null,hitDist:hit?.distance??null};
    }
    return out;
  });
  expect(view.place).toBe('town');
  expect(view.district).toBe('garden');
  for(const id of ['pavilion','house'])expect(view[id].inside,id+' on screen '+JSON.stringify(view[id].screen)).toBe(true);
  // The first thing a ray meets on the way to each is the thing itself.
  expect(['pavilion','sign:pavilion']).toContain(view.pavilion.hit);   // the roof, or the 莲心亭 plaque facing the gate
  expect(['home','window']).toContain(view.house.hit);
  // Keep a half-size picture of the first frame for review.
  const shot=(await page.screenshot()).toString('base64');
  const small=await page.evaluate(async src=>{
    const img=new Image();img.src='data:image/png;base64,'+src;await img.decode();
    const c=document.createElement('canvas');c.width=img.width/2;c.height=img.height/2;
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/png').split(',')[1];
  },shot);
  const {mkdirSync,writeFileSync}=await import('node:fs');
  mkdirSync('test-results',{recursive:true});writeFileSync('test-results/first-view.png',Buffer.from(small,'base64'));
  expect(errors).toEqual([]);
});
