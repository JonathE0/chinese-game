import {test,expect} from '@playwright/test';

/**
 * The first frame of a new game shows your home: the door and the 我的家 board are on screen and
 * nothing stands between you and them, and the kitchen's chimney is in view too.
 */
test('a fresh start opens looking at the front of your home',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.waitForTimeout(400);
  const view=await page.evaluate(()=>{
    const t=window.__qinghe.town,cam=t.camera,eye=cam.getPosition().clone(),V=eye.constructor;
    const canvas=t.app.graphicsDevice.canvas,w=canvas.clientWidth,h=canvas.clientHeight;
    const home=t.data.buildings.find(b=>b.id==='home'),front=home.z-(home.depth/2+.3);
    const part=name=>{const c=t.registry.boxes.find(b=>b.place==='town'&&b.name?.id===name&&b.group==='home');return [c.x,(c.y0+c.y1)/2,c.z];};
    const points={door:[home.x,1.1,front],sign:part('sign'),chimney:part('chimney'),balcony:part('balcony')};
    const out={spawn:[...t.data.spawn],eye:[eye.x,eye.y,eye.z],w,h};
    for(const [id,[x,y,z]] of Object.entries(points)){
      const s=cam.camera.worldToScreen(new V(x,y,z));
      const dir=new V(x-eye.x,y-eye.y,z-eye.z),dist=dir.length();dir.normalize();
      const hit=t.registry.look('town',eye,dir,40);
      out[id]={screen:[s.x,s.y,s.z],inside:s.z>0&&s.x>=0&&s.x<=w&&s.y>=0&&s.y<=h,dist,
        hit:hit?.box.name?.id??null,hitGroup:hit?.box.group??null,hitDist:hit?.distance??null};
    }
    return out;
  });
  for(const id of ['door','sign','balcony','chimney'])expect(view[id].inside,id+' on screen '+JSON.stringify(view[id].screen)).toBe(true);
  // Looking straight at the board, the first thing the ray meets is the board itself.
  expect(view.sign.hit).toBe('sign');
  expect(Math.abs(view.sign.hitDist-view.sign.dist)).toBeLessThan(.6);
  expect(view.door.hit).toBe('door');
  expect(view.chimney.hitGroup).toBe('home');
  // From the square west of the kitchen, at the game's own look range, the chimney names itself.
  const named=await page.evaluate(()=>{
    const t=window.__qinghe.town,c=t.registry.boxes.find(b=>b.place==='town'&&b.name?.id==='chimney'&&b.group==='home');
    const eye=t.camera.getPosition().clone(),V=eye.constructor;eye.set(c.x-6,1.62,c.z-4);
    const dir=new V(c.x-eye.x,(c.y0+c.y1)/2+.8-eye.y,c.z-eye.z).normalize();
    return t.registry.look('town',eye,dir)?.box.name?.id??null;
  });
  expect(named).toBe('chimney');
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
