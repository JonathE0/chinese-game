import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Every other 云海 building opens inside (docs/superpowers/plans/2026-09-27-development-wave-3.md,
// N-interiors): seven rooms with the doors table's ids, each returning to the city at its door.
const load=f=>JSON.parse(readFileSync(new URL(`../src/content/${f}.json`,import.meta.url),'utf8'));
const rooms=load('rooms'),assistants=load('assistants'),catalog=load('catalog'),city=load('city');
const DOORS={'city-bank':'进银行','city-bookshop':'进书店','city-hospital':'进医院','city-noodles':'进面馆',
  'city-cinema':'进电影院','city-store':'进便利店','city-cafe':'进咖啡馆'};
const sells=shop=>catalog.filter(i=>[].concat(i.shop??[]).includes(shop)).map(i=>i.id);

test('each city room returns to the city at its own door, like the hardware store',()=>{
  for(const [id,enter] of Object.entries(DOORS)){
    const room=rooms[id];
    assert.ok(room,`${id} missing`);
    assert.equal(room.enterLabel,enter,`${id} enterLabel`);
    assert.equal(room.interiorOnly,true,`${id} interiorOnly`);
    assert.equal(room.returnPlace,'city',`${id} returnPlace`);
    assert.ok(room.building.startsWith('city:'),`${id} building`);
    assert.equal(room.returnSpawn.length,3,`${id} returnSpawn`);
    // Once the city lists its doors, you step out a little in front of the one you went in by.
    const door=(city.doors??[]).find(d=>d.room===id);
    if(!door)continue;
    const [x,z,yaw]=room.returnSpawn;
    assert.ok(Math.hypot(x-door.x,z-door.z)<2.5,`${id} comes out away from its door`);
    // ...facing away from it, out into the street: town.facing() walks along (-sin yaw, -cos yaw).
    const r=yaw*Math.PI/180;
    assert.ok(-Math.sin(r)*(x-door.x)-Math.cos(r)*(z-door.z)>0,`${id} comes out facing its own door`);
  }
});

test('each has one talking assistant with a line of its own',()=>{
  for(const id of Object.keys(DOORS)){
    const helpers=rooms[id].staff.filter(s=>s.look&&s.talk!==false);
    assert.equal(helpers.length,1,`${id} assistants`);
    assert.ok(assistants.lines['shop-'+id]?.zh,`${id} line`);
  }
});

test('the counters open the right shops, and the shops stock what the plan lists',()=>{
  const counter=id=>rooms[id].fittings.filter(f=>f.action).map(f=>f.action);
  assert.ok(counter('city-bank').includes('panel:bank'));
  assert.ok(counter('city-noodles').includes('noodles'));
  for(const id of ['city-bookshop','city-cinema','city-store','city-cafe'])assert.ok(counter(id).includes('shop:'+id),id);
  assert.deepEqual(sells('city-bookshop'),['city-novel','city-dictionary','city-comic']);
  assert.deepEqual(sells('city-cinema'),['city-film-ticket','city-popcorn','city-cola']);
  for(const id of [...sells('kiosk'),'city-rice-ball','city-yoghurt'])assert.ok(sells('city-store').includes(id),`store lacks ${id}`);
  assert.deepEqual(sells('city-cafe'),sells('cafe'));
});

test('the hospital\'s 药房 window and 青禾药店 both sell the pharmacy list',()=>{
  const meds=['med-cold-medicine','med-plasters','med-face-masks','med-vitamins','med-throat-lozenges'];
  assert.deepEqual(sells('pharmacy'),meds);
  assert.deepEqual(sells('city-hospital'),meds);
  for(const id of meds){const item=catalog.find(i=>i.id===id);assert.ok(item.description&&!item.nutrition,id);}
  assert.equal(rooms.pharmacy.fittings.find(f=>f.kind==='checkout').action,'shop:pharmacy');
  assert.equal(rooms['city-hospital'].fittings.find(f=>f.sign==='药房').action,'shop:city-hospital');
});

test('the screening room is behind the cinema and takes a film ticket',()=>{
  const hall=rooms['city-cinema-hall'];
  assert.equal(hall.returnPlace,'city-cinema');
  assert.ok(rooms['city-cinema'].annexes.some(a=>a.room==='city-cinema-hall'));
  assert.ok(sells('city-cinema').includes(hall.ticket));
  assert.ok(hall.fittings.some(f=>f.kind==='cinemascreen'));
});

test('the cinema snacks, the ticket and the medicines have drawings of their own',async()=>{
  const {itemArt}=await import('../src/ui/art.js');
  const ids=['city-popcorn','city-cola','city-film-ticket','med-cold-medicine','med-plasters','med-face-masks','med-vitamins','med-throat-lozenges'];
  const art=ids.map(id=>itemArt(catalog.find(i=>i.id===id).visual));
  for(const [i,id] of ids.entries())assert.notEqual(art[i],itemArt('unknown'),`${id} has no drawing`);
  assert.equal(new Set(art).size,ids.length,'two of them share a drawing');
});
