import {test,expect} from '@playwright/test';

/**
 * Nothing in the world stands inside anything else.
 *
 * Collision boxes are deliberately smaller than the meshes they belong to, and soft props are not
 * solid at all, so a clean collision registry says nothing about whether a crate is poking through
 * a tree. This measures what is actually drawn — the union of every mesh's world bounds under each
 * placed object — and compares those. Trees are compared as discs, because the bounding square of a
 * round canopy would flag anything standing near one of its corners.
 */
const SAVE_KEY='little-mandarin-town.v1';

async function start(page){
  await page.addInitScript(([key,value])=>{localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],
    phrases:[],saved:[],home:[],discovered:[],clock:14,dayIndex:0,vendors:{},
    settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForTimeout(400);
}

// Runs in the page: measure every placed object in a place and return the pairs that intersect.
// Each object is kept as its separate parts, so a lamp's arm overhanging a bench, or an awning
// above a chair, is compared at the height it actually is. Round parts — trunks, canopies, poles,
// table tops — are compared as discs, because their bounding squares stick out at the corners.
function overlapsIn(place){
  const t=window.__qinghe.town;
  const partsOf=entity=>{
    const parts=[];
    const visit=node=>{
      if(node.enabled===false)return;
      for(const mesh of node.render?.meshInstances??[]){
        const {center:c,halfExtents:h}=mesh.aabb;
        // A trumpet column of 云海站 is one mesh flaring from a slim stem to a 4.2 m crown under the
        // canopy (src/world/city.js station, its profile): compared in bands, not as one wide drum.
        if(node.name==='shaft'&&node.parent?.name==='column'){
          for(const [y0,y1,r] of [[0,6,.8],[6,10,2],[10,c.y+h.y,h.x]])parts.push({x:c.x,z:c.z,hw:r,hd:r,y0,y1,round:true});
          continue;
        }
        parts.push({x:c.x,z:c.z,hw:h.x,hd:h.z,y0:c.y-h.y,y1:c.y+h.y,round:node.render.type!=='box'});
      }
      for(const child of node.children)visit(child);
    };
    visit(entity);
    return parts;
  };
  const items=[];
  const add=(label,entity,kind)=>{
    if(!entity||entity.enabled===false)return;
    const parts=partsOf(entity);
    if(parts.length)items.push({label,kind,parts});
  };
  if(place==='town'){
    t.props.forEach(prop=>add(`${prop.kind}@${prop.x},${prop.z}`,prop.entity,prop.kind));
    t.root.children.filter(e=>e.name==='tree').forEach(e=>{const p=e.getPosition();add(`tree@${p.x.toFixed(1)},${p.z.toFixed(1)}`,e,'tree');});
    for(const [id,entity] of t.buildings)add('building:'+id,entity,'building');
    for(const [id,entity] of t.hoardings??[])add('site:'+id,entity,'site');
    for(const pitch of t.market.pitches){
      if(pitch.cart)add('cart:'+pitch.id,pitch.cart,'cart');
      if(pitch.vendor)add('vendor:'+pitch.id,pitch.vendor.entity,'vendor');
    }
  }else{
    const city=t.rooms.get('city');
    city.root.children.forEach(e=>{
      if(!/^(tower|metro-hall|city-)/.test(e.name))return;
      const p=e.getPosition();add(`${e.name}@${(p.x-city.offsetX).toFixed(1)},${p.z.toFixed(1)}`,e,e.name);
    });
  }

  // Things built to touch: a parasol through its own table, a vendor at the handle of their own cart.
  const intended=(a,b)=>{
    const pair=[a.kind,b.kind].sort().join('+');
    const ca=a.label.split('@')[1],cb=b.label.split('@')[1];
    if(pair==='cafetable+parasol'&&ca===cb)return true;
    if(pair==='cart+vendor'&&a.label.split(':')[1]===b.label.split(':')[1])return true;
    return false;
  };
  const SLACK=.03;
  const meet=(p,q)=>{
    if(p.y0>=q.y1-SLACK||q.y0>=p.y1-SLACK)return false;
    if(p.round&&q.round)return Math.hypot(p.x-q.x,p.z-q.z)<Math.min(p.hw,p.hd)+Math.min(q.hw,q.hd)-SLACK;
    if(p.round||q.round){
      const [d,s]=p.round?[p,q]:[q,p];
      const dx=Math.max(Math.abs(d.x-s.x)-s.hw,0),dz=Math.max(Math.abs(d.z-s.z)-s.hd,0);
      return Math.hypot(dx,dz)<Math.min(d.hw,d.hd)-SLACK;
    }
    return Math.abs(p.x-q.x)<p.hw+q.hw-SLACK&&Math.abs(p.z-q.z)<p.hd+q.hd-SLACK;
  };
  const hits=[];
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=items[i],b=items[j];
    if(intended(a,b))continue;
    if(a.parts.some(p=>b.parts.some(q=>meet(p,q))))hits.push(`${a.label} ⟷ ${b.label}`);
  }
  return hits;
}

test('nothing in the town stands inside anything else, by day',async({page})=>{
  await start(page);
  const hits=await page.evaluate(overlapsIn,'town');
  expect(hits).toEqual([]);
});

test('the night market arrives, trades and leaves without passing through anything',async({page})=>{
  await start(page);
  // Drive the market the way the frame loop does, but from out of sight so it is allowed to
  // appear, and sample the whole journey rather than only the parked position.
  const seen=new Set();
  const drive=async(hour,frames)=>{
    for(let k=0;k<frames;k+=20){
      const hits=await page.evaluate(([hour,count,fn])=>{
        const t=window.__qinghe.town;
        t.daylight.setHour(hour);             // the frame loop must agree, or it sends the carts home
        const measure=new Function('return '+fn)();
        for(let i=0;i<count;i++){
          t.market.update(1/30,{hour,place:'town',offCamera:()=>true});
          t.market.syncHitboxes(t.registry,id=>({id}));
        }
        t.app.render();
        return measure('town');
      },[hour,20,overlapsIn.toString()]);
      hits.forEach(h=>seen.add(h));
    }
  };
  await drive(20,600);                                   // arriving, then open
  const states=await page.evaluate(()=>window.__qinghe.town.market.pitches.map(p=>`${p.id}:${p.state}@${p.x?.toFixed?.(2)},${p.z?.toFixed?.(2)}`));
  expect(states.join(' ')).toMatch(/hawthorn:open.*skewers:open/);
  await drive(3,600);                                    // packing up and leaving
  expect([...seen]).toEqual([]);
});

test('nothing in 云海 stands inside anything else',async({page})=>{
  await start(page);
  await page.evaluate(()=>{window.__qinghe.town.enterCity();});
  await page.waitForTimeout(300);
  const hits=await page.evaluate(overlapsIn,'city');
  expect(hits).toEqual([]);
});
