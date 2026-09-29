import {test,expect} from '@playwright/test';

// Every interior is sound and tidy: nothing stands in front of a way in or out, shelves and
// cabinets against a wall face into the room, and every sign or board can be seen from the middle
// of its room. The home's kitchen opens onto the house through its side wall.
const SAVE_KEY='little-mandarin-town.v1';
async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],discovered:[],
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
}

test('no fitting blocks a door, shelves face the room, and every sign can be seen',async({page})=>{
  test.setTimeout(120000);
  await start(page);
  const problems=await page.evaluate(()=>{
    const t=window.__qinghe.town,out=[];
    // Things with a back to them: they belong with that back to the wall.
    const ONE_SIDED=new Set(['bookcase','shelfunit','cupshelf','breadshelf','parcelshelf','medicineshelf','herbcabinet','hatshelf',
      'shoeshelf','toolwall','cratewall','fridge','keyrack','letterslot','carrel','booth','menuboard','wallsign','wallclock','noticeboard',
      'poster','scroll','ovenbank','fittingroom','mirror','atm','ticketmachine','sofa','kitchen','stampcase']);
    const BOARDS=new Set(['wallsign','noticeboard','menuboard','poster']);
    for(const room of t.rooms.values()){
      const {id,data,offsetX:ox}=room;if(data.outdoor)continue;
      const [w,d]=data.size,h=data.height;
      // Ways in and out: [x,z,inward normal,half width,floor height].
      const doors=[];
      const annex=(wall,x,z)=>wall==='west'?[-w/2,z,1,0]:wall==='east'?[w/2,z,-1,0]:[x,-d/2,0,1];
      if(!data.returnWall)doors.push({name:'front door',x:0,z:d/2,nx:0,nz:-1,hw:.85,y:data.upper?.entrance?data.upper.y:0});
      else{const [x,z,nx,nz]=annex(data.returnWall,...data.exit);doors.push({name:'way back',x,z,nx,nz,hw:.63,y:0});}
      for(const a of data.annexes??[]){const [x,z,nx,nz]=annex(a.wall,a.x,a.z);doors.push({name:'door to '+a.room,x,z,nx,nz,hw:.63,y:0});}
      for(const pane of data.frontWindows??[])if(pane.door)doors.push({name:pane.name,x:pane.x,z:d/2,nx:0,nz:-1,hw:.6,y:pane.y??0});
      // Everything that stands or hangs in the room: the fittings, the counter or 书案 with what flanks
      // it and the study desk (their hitboxes, as town.js marks them), and the ceiling lanterns.
      const things=room.fittings.map(f=>({label:`${f.kind} at ${f.x},${f.z}`,x:f.x,z:f.z,hw:f.hw,hd:f.hd,y0:(f.y??0)+(f.y0??0),y1:(f.y??0)+f.top}));
      for(const b of t.registry.boxes)if(b.place===id&&['writing-desk','lantern','counter','shelf','desk'].includes(b.name?.id))
        things.push({label:`${b.name.id} at ${(b.x-ox).toFixed(2)},${b.z.toFixed(2)}`,x:b.x-ox,z:b.z,hw:b.hw,hd:b.hd,y0:b.y0,y1:b.y1});
      for(const [x,z] of data.lanterns??[])things.push({label:`ceiling lantern at ${x},${z}`,x,z,hw:.2,hd:.2,y0:h-1.75,y1:h-1.25});
      for(const f of things)for(const door of doors){
        // The 1.2 m in front of the door, as wide as the door, from the floor to above head height.
        if(f.y1<door.y+.15||f.y0>door.y+2.2)continue;
        const [zx0,zx1]=door.nx?[Math.min(door.x,door.x+door.nx*1.2),Math.max(door.x,door.x+door.nx*1.2)]:[door.x-door.hw,door.x+door.hw];
        const [zz0,zz1]=door.nz?[Math.min(door.z,door.z+door.nz*1.2),Math.max(door.z,door.z+door.nz*1.2)]:[door.z-door.hw,door.z+door.hw];
        if(f.x+f.hw>zx0&&f.x-f.hw<zx1&&f.z+f.hd>zz0&&f.z-f.hd<zz1)out.push(`${id}: ${f.label} stands in front of the ${door.name}`);
      }
      for(const f of room.fittings){
        const label=`${id}: ${f.kind} at ${f.x},${f.z}`;
        // Into a wall: more than a few centimetres past its inner face.
        if(Math.abs(f.x)+f.hw>w/2+.08||Math.abs(f.z)+f.hd>d/2+.08)out.push(`${label} pokes into a wall`);
        if(ONE_SIDED.has(f.kind)){
          const r=(f.rot??0)*Math.PI/180,fx=Math.sin(r),fz=Math.cos(r);
          const walls=[[f.x+w/2,-1,0],[w/2-f.x,1,0],[f.z+d/2,0,-1],[d/2-f.z,0,1]].sort((a,b)=>a[0]-b[0]);
          const [gap,wx,wz]=walls[0];
          if(gap<1.2&&fx*wx+fz*wz>-.5)out.push(`${label} (rot ${f.rot??0}) turns its back to the room`);
        }
      }
      // Signs and boards, seen from the middle of the room at eye height, on the floor they are on.
      const boxes=t.registry.boxes.filter(b=>b.place===id&&!['wall','floor','window','door'].includes(b.name?.id));
      // A department sign hung from the ceiling over its fitting (interior.js) can hide a board too.
      for(const f of room.fittings)if(f.sign&&!f.signed&&f.kind!=='hardwarebay'){
        const y=Math.min((f.y??0)+(f.top??2)+.7,h-.45);
        boxes.push({x:ox+f.x,z:f.z,hw:.9,hd:.04,y0:y-.22,y1:y+.22,name:{id:'the hung sign '+f.sign}});
      }
      // So can a lantern hanging from the ceiling.
      for(const [x,z] of data.lanterns??[])boxes.push({x:ox+x,z,hw:.2,hd:.2,y0:h-1.75,y1:h-1.25,name:{id:'a lantern'}});
      const seen=(label,x,y,z,own)=>{
        const e=[0,(own?.y??(data.upper&&!own?data.upper.y:0))+1.6,0],len=Math.hypot(x-e[0],y-e[1],z-e[2]);
        const dir=[(x-e[0])/len,(y-e[1])/len,(z-e[2])/len],stop=len-.02;
        for(const b of boxes){
          if(b===own?.box||(Math.abs(b.x-ox-e[0])<b.hw&&Math.abs(b.z-e[2])<b.hd))continue;   // not what you stand in or under
          const lo=[b.x-ox-b.hw,b.y0,b.z-b.hd],hi=[b.x-ox+b.hw,b.y1,b.z+b.hd];
          let t0=0,t1=stop;
          for(let i=0;i<3;i++){
            if(Math.abs(dir[i])<1e-9){if(e[i]<lo[i]||e[i]>hi[i]){t0=1;t1=0;}continue;}
            const a=(lo[i]-e[i])/dir[i],c=(hi[i]-e[i])/dir[i];t0=Math.max(t0,Math.min(a,c));t1=Math.min(t1,Math.max(a,c));
          }
          if(t0<t1)return out.push(`${id}: ${label} is hidden behind ${b.name?.id??'something'} at ${(b.x-ox).toFixed(2)},${b.z.toFixed(2)}`);
        }
      };
      // The room's name board hangs on the back wall, under the ceiling of the top storey.
      const half=Math.min(3.2,w-2.4)/2-.3;
      for(const x of [-half,0,half])seen('the name board',x,h-.62,-d/2+.07,null);
      for(const f of room.fittings)if(BOARDS.has(f.kind)){
        const box=boxes.find(b=>Math.abs(b.x-ox-f.x)<1e-6&&Math.abs(b.z-f.z)<1e-6);
        const r=(f.rot??0)*Math.PI/180;   // aim a little in front of its face
        seen(`the ${f.kind} ${f.sign??''}`,f.x+Math.sin(r)*.1,(f.y??0)+(f.y0!==undefined?(f.y0+f.top)/2:f.top-.55),f.z+Math.cos(r)*.1,{box,y:f.y??0});
      }
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test('the kitchen opens onto the house through its side wall, and the way back lands in the living room',async({page})=>{
  await start(page);
  const kitchen=await page.evaluate(()=>{
    const t=window.__qinghe.town;t.enterRoom('home');t.enterRoom('kitchen');
    const room=t.rooms.get('kitchen'),p=t.player.entity.getPosition();
    const door=t.registry.boxes.find(b=>b.place==='kitchen'&&b.name?.id==='door'&&!b.solid&&b.y1>2);
    return {x:+(p.x-room.offsetX).toFixed(2),z:+p.z.toFixed(2),yaw:t.yaw,w:room.data.size[0],d:room.data.size[1],
      door:door&&{x:+(door.x-room.offsetX).toFixed(2),z:+door.z.toFixed(2)},
      frontShut:!t.canMove(room.offsetX,room.data.size[1]/2+.05,0)};
  });
  // The house is to the kitchen's west (the kitchen is through the house's east wall).
  expect(kitchen.door.x).toBeLessThan(-kitchen.w/2+.5);
  expect(Math.abs(kitchen.door.z)).toBeLessThan(kitchen.d/2-1);
  // Its front wall is shut: no walking out through where the old doorway was.
  expect(kitchen.frontShut).toBe(true);
  // Arriving, you stand just inside that door, facing into the kitchen (yaw -90 looks east).
  expect(kitchen.x).toBeLessThan(-kitchen.w/2+2);
  expect(Math.abs(kitchen.z-kitchen.door.z)).toBeLessThan(.6);
  expect(kitchen.yaw).toBe(-90);
  // At the side door, E leads back into the house beside its kitchen door.
  await page.evaluate(()=>{const t=window.__qinghe.town,r=t.rooms.get('kitchen');t.warp(r.offsetX+r.data.exit[0],r.data.exit[1],90);});
  await page.waitForTimeout(240);
  await expect(page.locator('#interact span')).toHaveText('回屋里 · BACK INSIDE');
  await page.keyboard.press('e');
  await page.waitForTimeout(320);
  const back=await page.evaluate(()=>{const t=window.__qinghe.town,p=t.player.entity.getPosition();
    return {place:t.place,x:+(p.x-t.rooms.get('home').offsetX).toFixed(2),z:+p.z.toFixed(2),yaw:t.yaw};});
  expect(back).toEqual({place:'home',x:3.5,z:2.5,yaw:90});
});

test('a desk lamp saved in the old living-room floor spot still shows, as a piece you can put away',async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({version:5,wallet:0,inventory:{'desk-lamp':1},equipped:{},claims:{},words:{},
    completed:['home:tutorial','home:starter'],phrases:[],saved:[],discovered:[],
    home:[{uid:'dl',item:'desk-lamp',kind:'desklamp',color:'#dcb87a',footprint:[.5,.5],x:-3.6,z:-2.4,rot:0,room:'home',slot:'desklamp'}],
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})),SAVE_KEY);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  const lamp=await page.evaluate(()=>{const q=window.__qinghe,prop=q.town.rooms.get('home').props.get('dl');
    return {shown:!!prop?.entity,x:prop?.x,z:prop?.z,slot:q.profile.home.find(r=>r.uid==='dl')?.slot??null};});
  expect(lamp).toEqual({shown:true,x:-3.6,z:-2.4,slot:null});
});

test('at the restaurant counter the order prompt wins over a waiter idling nearby',async({page})=>{
  await start(page);
  await page.evaluate(()=>{
    const t=window.__qinghe.town;t.enterRoom('restaurant');
    const room=t.rooms.get('restaurant');
    // Both waiters idle at the near corners of their loop, the closest they come to the counter.
    room.staff.forEach((s,i)=>{s.x=i?-.85:.85;s.z=-1.3;s.wait=999;s.entity.setLocalPosition(s.x,0,s.z);});
    t.warp(room.offsetX,-1.3,0);t.pitch=-25;
  });
  await page.waitForTimeout(300);
  await expect(page.locator('#interact span')).toHaveText('点菜 · 服务台');
});
