import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {promenadeZ} from '../../src/core/city.js';

// 云海 after Shenzhen Bay (task C-city), rebuilt round its station (wave 4, W4-yunhai): the LED
// characters, the walkways, the station's exits and the signs.
const SAVE_KEY='little-mandarin-town.v1';
const CITY=JSON.parse(readFileSync('src/content/city.json','utf8'));
const SIGNS=JSON.parse(readFileSync('src/content/signs.json','utf8')).signs;
const LED_TEXTS=['我爱云海','欢迎来到云海','云海中心','好好学习','天天向上','万家灯火','一路平安','你好','晚安','学中文',
  '城市之光','海风大厦','云海湾','滨海步道','无人机表演','云海市中心站','站前广场','美食街','中心广场','商务区','城市公园'];

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
    const mine=/^(tower|metro-hall|city-.+|promenade|skyline)$/;
    const topOf=e=>{while(e.parent&&e.parent!==room.root)e=e.parent;return e;};
    const spots=[];
    for(let z=-28;z<=24;z+=4)for(const x of [-9.6,-6,-2,2,6,9.6])spots.push([x0+x,z]);
    for(let x=-36;x<=68;x+=4)for(const z of [-45,-41,-37])spots.push([x0+x,z]);
    for(let z=-30;z<=30;z+=6)spots.push([x0-33,z]);
    // 站前广场, 美食街, round the station, 中心广场 and the business district, and 城市公园.
    for(let x=-26;x<=26;x+=4)for(const z of [24,28])spots.push([x0+x,z]);
    for(let x=-96;x<=-28;x+=4)for(const z of [47,51])spots.push([x0+x,z]);
    for(let z=38;z<=66;z+=4)for(const x of [-38,38])spots.push([x0+x,z]);
    for(let x=-40;x<=68;x+=4)spots.push([x0+x,70]);
    for(let x=30;x<=66;x+=4)for(let z=-10;z<=64;z+=6)spots.push([x0+x,z]);
    for(let x=-40;x<=68;x+=6)for(let z=76;z<=110;z+=6)spots.push([x0+x,z]);
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
    CITY.props.flatMap(p=>[p.text,p.back,...(p.couplet??[])]),CITY.metroStation.building.name).filter(Boolean));
  expect([...drawn].sort()).toEqual([...LED_TEXTS].sort());
  for(const text of LED_TEXTS)expect(SIGNS[text]?.pinyin,text).toBeTruthy();

  const glow=hour=>page.evaluate(([hour,texts])=>{
    const t=window.__qinghe.town;t.daylight.setHour(hour);
    const found={};
    const visit=e=>{
      if(e.name==='city-metro-exit')return;   // the exits' names are backlit boards, lit day and night
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

test('the walkways are clear: both pavements, exit A to the bay, the lit path, the lane to the hill and the ways round the station',async({page})=>{
  await enterCity(page);
  const p=CITY.promenade,half=p.path.width/2-.4,lines=[];
  for(let z=-26;z<=22;z+=.5)lines.push(['west pavement',-9.6,z],['east pavement',9.6,z]);
  // Down the boulevard beside its pools, from where exit A lets you out.
  for(let z=38;z>=-46;z-=.5)lines.push(['exit A to the bay',3,z]);
  // The last couple of metres at the west end are the foot of the hill's stairway (hill.js).
  for(let x=p.x[0]+2.5;x<=p.x[1]-.5;x+=.5)for(const side of [-half,0,half])lines.push(['lit path',x,promenadeZ(p,x)+side]);
  for(let x=-11;x>=-37.5;x-=.5)lines.push(['lane to the hill',x,8]);
  for(let z=-13.5;z<=-7.5;z+=.5)lines.push(['walk by the kiosk',-3,z]);
  for(let z=-33;z<=56;z+=.5)lines.push(['back street',-33,z]);
  // Both sides of 美食街, round the front, sides and back of the station, into the park, through
  // 中心广场 and round its fountain, and on from there to the promenade east of 海风大厦.
  for(let x=-96;x<=-32;x+=.5)lines.push(['美食街 north side',x,44],['美食街 south side',x,50]);
  for(let x=-40;x<=40;x+=.5)lines.push(['along the station front',x,39],['behind the station',x,66]);
  for(let z=39;z<=66;z+=.5)lines.push(['west of the station',-38,z],['east of the station',38,z]);
  for(let z=67.5;z<=80;z+=.5)lines.push(['exit D into the park',0,z]);
  for(let z=30;z>=-7;z-=.5)lines.push(['back lane to 中心广场',26.5,z]);
  for(let x=30;x<=50;x+=.5)lines.push(['round the fountain',x,-4]);
  for(let z=-12;z>=-44;z-=.5)lines.push(['to the promenade',62,z]);
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
  // Dense, though the far landing's strip (skyline.keepClear, src/world/harbour.js) stays clear.
  expect(skyline.towers).toBeGreaterThan(25);
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

test('the station has four exits, each a way down just behind its spawn, signed with its letter and where it leads',async({page})=>{
  await enterCity(page);
  const exits=await page.evaluate(exits=>{
    const t=window.__qinghe.town,room=t.rooms.get('city'),x0=room.offsetX;
    const portals=room.root.children.filter(c=>c.name==='city-metro-exit');
    return exits.map(({id,zh,to,spawn:[x,z]})=>{
      const near=portals.map(p=>({p,d:Math.hypot(p.getLocalPosition().x-x,p.getLocalPosition().z-z)})).sort((a,b)=>a.d-b.d)[0];
      const signs=near.p.find(e=>!!e.signText).map(e=>e.signText);
      return {id,count:portals.length,mouth:+near.d.toFixed(2),signed:signs.includes(zh)&&signs.includes(to.zh),open:t.canMove(x0+x,z,0)};
    });
  },CITY.metroStation.exits);
  for(const e of exits)expect(e,e.id).toEqual({id:e.id,count:4,mouth:2.2,signed:true,open:true});
});

test('where the ground ends over open land a wall says so',async({page})=>{
  await enterCity(page);
  // Just past each edge that is not the railing, the hill or a building, knee high: a wall or hedge.
  const points=[];
  // The east edge from the promenade's end to the park's far corner, the park's south and west
  // edges, 美食街's west end, the back of the promenade behind 海风大厦 and the promenade tower, the
  // way from 中心广场 down to the promenade, and the gap between the cinema's hall and 海风大厦.
  for(let z=-47;z<=110;z+=4)points.push([70.3,z]);
  for(let x=-40;x<=68;x+=4)points.push([x,112.3]);
  for(let z=82;z<=110;z+=4)points.push([-42.3,z]);
  for(let z=35;z<=51;z+=2)points.push([-98.3,z]);
  points.push([-96.5,52.3]);
  for(let x=30;x<=58;x+=4)points.push([x,-33.7]);
  for(let z=-33;z<=-30;z+=1)points.push([58.7,z]);
  for(const x of [37,38.5])points.push([x,-15.3]);
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
    const mine=/^(tower|metro-hall|city-.+|promenade|skyline|block|searchlight)$/,materials=new Set();
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
