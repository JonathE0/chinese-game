import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {promenadeZ} from '../../src/core/city.js';

// 云海 after Shenzhen Bay (task C-city): the LED characters, the walkways and the signs.
const SAVE_KEY='little-mandarin-town.v1';
const CITY=JSON.parse(readFileSync('src/content/city.json','utf8'));
const SIGNS=JSON.parse(readFileSync('src/content/signs.json','utf8')).signs;
const LED_TEXTS=['我爱云海','欢迎来到云海','云海中心','好好学习','天天向上','万家灯火','一路平安','你好','晚安','学中文',
  '城市之光','海风大厦','云海湾','滨海步道','无人机表演'];

async function enterCity(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:60,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],
    home:[],discovered:[],clock:14,dayIndex:0,vendors:{},metro:{rides:1,trips:0},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人',
  })]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  const farBefore=await page.evaluate(()=>window.__qinghe.town.camera.camera.farClip);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();window.__qinghe.syncPlace();});
  await page.waitForTimeout(300);
  return farBefore;
}

/**
 * Every sign city.js draws (or only those reading one of `texts`), looked at from the three nearest
 * places someone would stand to read it: on open ground, at eye height, in front of it (a board
 * reads from both faces, lit characters on a façade only from the front), with the crosshair's own
 * look, so past arm's length only a sign with a `reach` is found, and only when nothing solid stands
 * in the way. Returns the ones that none of those finds first, with what was found instead. People
 * walking about are left out: they come and go.
 */
function unseen(page,texts=null){
  return page.evaluate(texts=>{
    const t=window.__qinghe.town,room=t.rooms.get('city'),x0=room.offsetX,out=[];
    const mine=/^(tower|metro-hall|department-door|city-.+|promenade|skyline)$/;
    const topOf=e=>{while(e.parent&&e.parent!==room.root)e=e.parent;return e;};
    const spots=[];
    for(let z=-28;z<=24;z+=4)for(const x of [-9.6,-6,-2,2,6,9.6])spots.push([x0+x,z]);
    for(let x=-36;x<=68;x+=4)for(const z of [-45,-41,-37])spots.push([x0+x,z]);
    for(let z=-30;z<=30;z+=6)spots.push([x0-33,z]);
    const all=t.registry.looks;
    t.registry.looks=all.filter(b=>b.owner!=='crowd');
    try{
      for(const box of t.registry.looks){
        const zh=box.name?.zh;
        if(box.place!=='city'||!box.name?.sign||!box.entity?.render||!mine.test(topOf(box.entity).name))continue;
        if(texts&&!texts.includes(zh))continue;
        const c=box.entity.render.meshInstances[0].aabb.center,n=box.entity.getWorldTransform().getZ().normalize();
        const near=spots.map(([x,z])=>{
          const dx=x-c.x,dz=z-c.z,len=Math.hypot(dx,dz)||1,cos=(dx*n.x+dz*n.z)/len;
          return {x,z,len,front:box.entity.lookReach?cos>.5:Math.abs(cos)>.5};
        }).filter(s=>s.front&&t.canMove(s.x,s.z,0)).sort((a,b)=>a.len-b.len).slice(0,3);
        const seen=near.map(s=>{
          const dir={x:c.x-s.x,y:c.y-1.62,z:c.z-s.z},len=Math.hypot(dir.x,dir.y,dir.z);
          return t.registry.look('city',{x:s.x,y:1.62,z:s.z},{x:dir.x/len,y:dir.y/len,z:dir.z/len})?.box.name?.zh??'nothing';
        });
        if(!seen.includes(zh))out.push(`${zh}: ${seen.length?'sees '+seen.join(' / '):'no open ground in front'}`);
      }
    }finally{t.registry.looks=all;}
    return [...new Set(out)];
  },texts);
}

test('after dark every LED text is lit and reads its name; by day they are calm; the city sees further',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const farBefore=await enterCity(page);
  // Everything the table lists is drawn somewhere, and every one is a sign with its reading.
  const drawn=new Set([...CITY.towers,...CITY.skyline.towers].map(t=>t.leds?.text?.zh).concat(
    CITY.props.flatMap(p=>[p.text,p.back,...(p.couplet??[])])).filter(Boolean));
  expect([...drawn].sort()).toEqual([...LED_TEXTS].sort());
  for(const text of LED_TEXTS)expect(SIGNS[text]?.pinyin,text).toBeTruthy();

  const glow=hour=>page.evaluate(([hour,texts])=>{
    const t=window.__qinghe.town;t.daylight.setHour(hour);
    const found={};
    const visit=e=>{
      if(texts.includes(e.signText)){
        const m=e.render.meshInstances[0].material;
        found[e.signText]=Math.min(found[e.signText]??Infinity,m.emissiveIntensity);
      }
      for(const child of e.children)visit(child);
    };
    visit(t.rooms.get('city').root);
    return found;
  },[hour,LED_TEXTS]);
  const night=await glow(2);                 // deep night, with no drone show in the way
  for(const text of LED_TEXTS)expect(night[text],`${text} lit at night`).toBeGreaterThan(1);
  // Looking at each one names it, from open ground in front of it, however far off it stands.
  expect(await unseen(page,LED_TEXTS)).toEqual([]);
  const day=await glow(13);
  for(const text of LED_TEXTS)expect(day[text],`${text} dark by day`).toBe(0);

  // The far clip and the haze are the city's own, and go when you leave.
  const inCity=await page.evaluate(()=>{const c=window.__qinghe.town.camera.camera;return {far:c.farClip,fog:c.fog?.type};});
  expect(inCity).toEqual({far:CITY.place.farClip,fog:'linear'});
  await page.evaluate(()=>{window.__qinghe.town.leaveCity();window.__qinghe.syncPlace();});
  const after=await page.evaluate(()=>{const c=window.__qinghe.town.camera.camera;return {far:c.farClip,fog:c.fog??null};});
  expect(after).toEqual({far:farBefore,fog:null});
  expect(errors).toEqual([]);
});

test('the walkways are clear: both pavements, the way from the metro to the bay, the lit path and the lane to the hill',async({page})=>{
  await enterCity(page);
  const p=CITY.promenade,half=p.path.width/2-.4,lines=[];
  for(let z=-26;z<=22;z+=.5)lines.push(['west pavement',-9.6,z],['east pavement',9.6,z]);
  for(let z=24;z>=-46;z-=.5)lines.push(['metro to the bay',0,z]);
  // The last couple of metres at the west end are the foot of the hill's stairway (hill.js).
  for(let x=p.x[0]+2.5;x<=p.x[1]-.5;x+=.5)for(const side of [-half,0,half])lines.push(['lit path',x,promenadeZ(p,x)+side]);
  for(let x=-11;x>=-37.5;x-=.5)lines.push(['lane to the hill',x,8]);
  // The pavement between the road and the planters, past the kiosk, and where each crossing lands.
  for(let z=-13.5;z<=-7.5;z+=.5)lines.push(['inner pavement by the kiosk',-4.6,z]);
  for(const c of CITY.props.filter(one=>one.kind==='citycrossing'))
    for(let z=c.z-1.8;z<=c.z+1.8;z+=.4)for(const x of [-4.6,4.6])lines.push(['crossing landing',x,z]);
  for(let z=-33;z<=33;z+=.5)lines.push(['back street',-33,z]);
  const blocked=await page.evaluate(lines=>{
    const t=window.__qinghe.town,x0=t.rooms.get('city').offsetX;
    return lines.filter(([,x,z])=>!t.canMove(x0+x,z,0)).map(([name,x,z])=>`${name} at ${x.toFixed(1)},${z.toFixed(1)}`);
  },lines);
  expect(blocked).toEqual([]);
});

test('no sign in the city is hidden behind anything, and the towers across the bay hide what is behind them',async({page})=>{
  await enterCity(page);
  expect(await unseen(page)).toEqual([]);
  const skyline=await page.evaluate(()=>{
    const t=window.__qinghe.town,group=t.rooms.get('city').root.findByName('skyline');
    return {towers:group.children.filter(c=>c.name==='tower'||c.name==='landmark').length,
      solid:t.registry.boxes.filter(b=>b.place==='city'&&b.solid&&b.name?.id==='tower'&&b.z<-170).length};
  });
  expect(skyline.towers).toBeGreaterThan(30);
  expect(skyline.solid).toBeGreaterThanOrEqual(skyline.towers);
});

test('the gate is a 牌坊 whose couplet reads left to right from either side',async({page})=>{
  await enterCity(page);
  const gate=await page.evaluate(()=>{
    const t=window.__qinghe.town,x0=t.rooms.get('city').offsetX,out={panels:{}};
    // Aim at the foot of the west post, below its couplet, from the pavement in front of the gate.
    const eye={x:x0-9.6,y:1.62,z:-27},at={x:x0-12.25,y:1.2,z:-31},d={x:at.x-eye.x,y:at.y-eye.y,z:at.z-eye.z},n=Math.hypot(d.x,d.y,d.z);
    out.post=t.registry.look('city',eye,{x:d.x/n,y:d.y/n,z:d.z/n})?.box.name?.id??null;
    const visit=e=>{
      if(e.signText&&e.render&&Math.abs(e.getPosition().z+31.5)<1&&e.getPosition().y<8){
        const facing=e.getWorldTransform().getZ().z>0?'south':'north';
        (out.panels[facing]??=[]).push({zh:e.signText,x:e.getPosition().x-x0});
      }
      for(const child of e.children)visit(child);
    };
    visit(t.rooms.get('city').root);
    return out;
  });
  expect(gate.post).toBe('paifang');
  // Seen from the avenue (facing north) the left post is the west one; from the promenade, the east.
  const leftToRight=(panels,facing)=>panels.sort((a,b)=>facing==='south'?a.x-b.x:b.x-a.x).map(p=>p.zh);
  expect(leftToRight(gate.panels.south,'south')).toEqual(['好好学习','天天向上']);
  expect(leftToRight(gate.panels.north,'north')).toEqual(['好好学习','天天向上']);
});

test('where the ground ends over open land a wall says so',async({page})=>{
  await enterCity(page);
  // Just past each edge that is not the railing, the hill or a building, knee high: a wall or hedge.
  const points=[];
  for(let z=-47;z<=-35;z+=2)points.push([70.3,z]);
  for(let x=30;x<=68;x+=4)points.push([x,-33.7]);
  for(let z=-30;z<=30;z+=6)points.push([28.3,z]);
  for(let x=-38;x<=26;x+=8)points.push([x,34.3]);
  const bare=await page.evaluate(points=>{
    const t=window.__qinghe.town,x0=t.rooms.get('city').offsetX;
    const named=(x,z)=>[...t.registry.boxes,...t.registry.looks].some(b=>b.place==='city'&&['wall','hedge','metro-station'].includes(b.name?.id)&&
      Math.abs(x-b.x)<=b.hw&&Math.abs(z-b.z)<=b.hd&&b.y0<=.5&&b.y1>=.5);
    return points.filter(([x,z])=>!named(x0+x,z)).map(p=>p.join(','));
  },points);
  expect(bare).toEqual([]);
});

test('after dark the LEDs move without rebuilding a material every frame',async({page})=>{
  await enterCity(page);
  const updates=await page.evaluate(async()=>{
    const t=window.__qinghe.town,room=t.rooms.get('city');
    t.daylight.setHour(2);t.daylight.paused=true;
    const frame=()=>new Promise(done=>requestAnimationFrame(()=>done()));
    for(let i=0;i<3;i++)await frame();
    // Every material city.js draws with, the lit ones among them.
    const mine=/^(tower|metro-hall|department-door|city-.+|promenade|skyline)$/,materials=new Set();
    for(const top of room.root.children)if(mine.test(top.name))
      for(const render of top.findComponents('render'))for(const mi of render.meshInstances)materials.add(mi.material);
    const proto=Object.getPrototypeOf([...materials][0]),update=proto.update;
    let count=0;
    proto.update=function(...args){if(materials.has(this))count++;return update.apply(this,args);};
    try{for(let i=0;i<30;i++)await frame();}finally{proto.update=update;}
    return count;
  });
  expect(updates).toBe(0);
});
