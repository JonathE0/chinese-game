import {test,expect} from '@playwright/test';

/**
 * 莲池公园: open from the first frame through the moon gate south of the square, a pond you
 * cannot step into, bridges that carry you over it to the pavilion island, and names on it all.
 */
async function start(page){
 await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
 await page.waitForFunction(()=>window.__qinghe?.hskWords?.length>0);
 await page.evaluate(()=>{const c=window.__qinghe;c.profile.completed.push('home:tutorial','home:starter');c.save();});
}

test('walking south from the square through the moon gate arrives in 莲池公园',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(0,15,180);t.keys.add('KeyW');});
 await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.player.entity.getPosition().z),{timeout:10000}).toBeGreaterThan(21.5);
 await page.evaluate(()=>window.__qinghe.town.keys.delete('KeyW'));
 await expect(page.locator('.location b')).toHaveText('莲池公园');
 // Open with no door: the garden never joins the gates you have to earn.
 expect(await page.evaluate(()=>window.__qinghe.town.gates.has('garden'))).toBe(false);
 expect(errors).toEqual([]);
});

test('the moon gate is open even when the word list never loads',async({page})=>{
 await page.route('**/hsk/**',route=>route.abort());
 await page.goto('/');await page.getByRole('button',{name:'开始旅行'}).click();
 await page.waitForFunction(()=>!!window.__qinghe?.town);
 expect(await page.evaluate(()=>window.__qinghe.hskWords?.length??0)).toBe(0);
 await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(0,15,180);t.keys.add('KeyW');});
 await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.player.entity.getPosition().z),{timeout:10000}).toBeGreaterThan(21.5);
 await page.evaluate(()=>window.__qinghe.town.keys.delete('KeyW'));
 await expect(page.locator('.location b')).toHaveText('莲池公园');
});

test('on foot from the gateway you reach the bank, the mill and the teahouse lot, not the water',async({page})=>{
 await start(page);
 const result=await page.evaluate(()=>{
  const t=window.__qinghe.town,step=.25,x0=-19,z0=15,W=Math.round(38/step)+1,H=Math.round(36/step)+1;
  const at=(i,j)=>j*W+i,seen=new Uint8Array(W*H),cell=(x,z)=>[Math.round((x-x0)/step),Math.round((z-z0)/step)];
  let frontier=[cell(0,17)];seen[at(...frontier[0])]=1;
  while(frontier.length){
   const next=[];
   for(const [i,j] of frontier)for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const a=i+di,b=j+dj;
    if(a<0||b<0||a>=W||b>=H||seen[at(a,b)]||!t.canMove(x0+a*step,z0+b*step,0))continue;
    seen[at(a,b)]=1;next.push([a,b]);
   }
   frontier=next;
  }
  const reach=(x,z)=>!!seen[at(...cell(x,z))];
  return {bank:reach(-6,25.2),mill:reach(-13.8,36.4),lot:reach(12.5,43),pond:t.canMove(-5,30,0),island:t.canMove(3.5,34,0)};
 });
 expect(result).toEqual({bank:true,mill:true,lot:true,pond:false,island:false});
});

test('walking at the pond from its bank stops at the water',async({page})=>{
 await start(page);
 const z=await page.evaluate(()=>{
  const t=window.__qinghe.town;t.warp(-5,25.2,180);t.keys.add('KeyW');
  for(let i=0;i<90;i++)t.update(1/30);
  t.keys.delete('KeyW');return t.player.entity.getPosition().z;
 });
 expect(z).toBeGreaterThan(25.8);   // it did walk to the edge
 expect(z).toBeLessThan(26.6-.3);
});

test('the north bridge carries you over its crest onto the pavilion island',async({page})=>{
 await start(page);
 const walk=await page.evaluate(()=>{
  const t=window.__qinghe.town;t.warp(0,25,180);t.keys.add('KeyW');const ys=[];
  for(let i=0;i<120&&t.player.entity.getPosition().z<32;i++){t.update(1/30);ys.push(t.playerY);}
  t.keys.delete('KeyW');const p=t.player.entity.getPosition();
  return {x:p.x,z:p.z,peak:Math.max(...ys),end:t.playerY};
 });
 expect(walk.peak).toBeGreaterThanOrEqual(1);
 expect(walk.end).toBeLessThan(walk.peak);
 expect(walk.end).toBeGreaterThanOrEqual(.55);
 expect(Math.abs(walk.x)).toBeLessThan(.5);
 expect(walk.z).toBeGreaterThanOrEqual(31);
});

test('looking up at the pavilion names it 亭子, and the park stays within its mesh budget',async({page})=>{
 await start(page);
 await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(0,24.5,180);t.pitch=22;});
 await expect.poll(()=>page.evaluate(()=>window.__qinghe.town.looking?.zh)).toBe('亭子');
 const meshes=await page.evaluate(()=>window.__qinghe.town.garden.root.find(e=>!!e.render).length);
 console.log('garden meshes',meshes);
 // The covered walkway and 荷风水榭 (Task S) added about 120 meshes; they batch into existing draw
 // calls (performance.spec.js holds the draw-call budget), so this caps runaway geometry only.
 expect(meshes).toBeLessThan(600);
});

test('screenshot: from the entrance court across the pond',async({page})=>{
 await page.setViewportSize({width:720,height:500});
 await start(page);
 const skip=page.getByText('跳过教程');if(await skip.isVisible())await skip.click();
 await page.evaluate(()=>{const t=window.__qinghe.town;t.warp(2.2,20.3,176);t.pitch=4;});
 await page.waitForTimeout(4000);   // let the tutorial toast fade
 await page.screenshot({path:'test-results/garden-entrance.png'});
});
