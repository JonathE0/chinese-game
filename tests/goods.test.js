import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GOOD,GARMENTS,HANG,HUNG,WALL_KINDS,bevelFor,drum,unitGeometry,surfaceOf,hangSpots} from '../src/world/jiangnan-rooms.js';

// Every interior's goods (task W5-rooms, src/content/goods.json, src/world/jiangnan-rooms.js): every
// name it uses exists, and the finished shapes keep their size and face out. A room goods.json does
// not name yet is still finished and gets the default goods on its fittings, just no ceiling or trade.
const json=f=>JSON.parse(readFileSync(new URL('../src/content/'+f,import.meta.url),'utf8'));
const GOODS=json('goods.json'),ROOMS=json('rooms.json'),OBJECTS=json('objects.json').objects;
const CEILINGS=new Set(['rafters','boards','coffers','panels']);

test('each interior goods.json names has its trade, and a ceiling only where it has a lid of its own', () => {
  for(const [id,room] of Object.entries(ROOMS)){
    const look=GOODS.rooms[id];
    if(room.outdoor||!look)continue;
    assert.ok(GOODS.trades[look.trade],`${id}: no trade ${look.trade}`);
    if(look.ceiling){
      assert.ok(CEILINGS.has(look.ceiling),`${id}: unknown ceiling ${look.ceiling}`);
      assert.ok(!room.open&&!room.levels&&!room.transit,`${id} builds its own ceiling, or has none`);
    }
    for(const zone of look.zones??[])assert.ok(GOODS.trades[zone.trade],`${id}: no trade ${zone.trade}`);
  }
  for(const id of Object.keys(GOODS.rooms))assert.ok(ROOMS[id],`goods.json names a room that does not exist: ${id}`);
});

test('every set a trade names exists, its goods can be drawn and it is looked at by a name the game has', () => {
  const signs=new Set(Object.values(ROOMS).flatMap(r=>(r.fittings??[]).map(f=>f.sign).filter(Boolean)));
  for(const [trade,kinds] of Object.entries(GOODS.trades))for(const [kind,want] of Object.entries(kinds)){
    const names=typeof want==='string'?[want]:Object.values(want);
    if(typeof want==='object')for(const sign of Object.keys(want))if(sign!=='*')assert.ok(signs.has(sign),`${trade}.${kind}: no fitting is signed ${sign}`);
    for(const name of names)assert.ok(GOODS.sets[name],`${trade}.${kind}: no set ${name}`);
  }
  for(const [name,set] of Object.entries(GOODS.sets)){
    assert.ok(OBJECTS[set.look],`set ${name}: look ${set.look} is not in objects.json`);
    assert.ok(set.goods.length,`set ${name} is empty`);
    for(const g of set.goods){
      assert.ok(GOOD[g.good]||GARMENTS.has(g.good),`set ${name}: no good ${g.good}`);
      if(g.look)assert.ok(OBJECTS[g.look],`set ${name}: look ${g.look} is not in objects.json`);
      for(const c of g.colours??[])assert.match(c,/^#[0-9a-f]{6}$/,`set ${name}: colour ${c}`);
    }
  }
  for(const look of Object.values(HUNG))assert.ok(OBJECTS[look],`hanging look ${look}`);
  for(const [id,room] of Object.entries(GOODS.rooms)){
    for(const [kind] of room.hang??[])assert.ok(HANG[kind]&&HUNG[kind],`${id}: no hanging ${kind}`);
    for(const piece of room.wall??[]){
      assert.ok(WALL_KINDS.has(piece.kind),`${id}: no wall piece ${piece.kind}`);
      if(piece.set)assert.ok(GOODS.sets[piece.set],`${id}: no set ${piece.set}`);
      if(piece.look)assert.ok(OBJECTS[piece.look],`${id}: look ${piece.look}`);
      assert.ok(!ROOMS[id].decoratable,`${id}: a room the player furnishes keeps its walls for them`);
    }
  }
});

test('goods carry no writing: the only Chinese in goods.json is the fitting signs it is keyed by', () => {
  const text=JSON.stringify({rooms:GOODS.rooms,sets:GOODS.sets});
  assert.ok(!/[一-鿿]/.test(text),'Chinese in goods.json outside the trades\' sign keys');
});

const tri=(g,k)=>[0,1,2].map(j=>g.p.slice(g.i[k+j]*3,g.i[k+j]*3+3));
const facing=g=>{
  for(let k=0;k<g.i.length;k+=3){
    const [a,b,c]=tri(g,k),u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],m=g.n.slice(g.i[k]*3,g.i[k]*3+3);
    if(Math.hypot(...n)>1e-9&&n[0]*m[0]+n[1]*m[1]+n[2]*m[2]<=0)return false;
  }
  return true;
};
const bounds=g=>[0,1,2].map(a=>{const v=g.p.filter((_,i)=>i%3===a);return [Math.min(...v),Math.max(...v)];});

test('a finished part keeps its size in its own unit space and faces outwards', () => {
  assert.equal(bevelFor([.02,.5,.5]),0,'a thin plate keeps square edges');
  assert.ok(bevelFor([.1,.8,.4])>0&&bevelFor([.1,.8,.4])<=.016);
  const s=[1.6,.08,.9],g=drum(s);
  assert.ok(facing(g),'a drum faces outwards');
  assert.deepEqual(bounds(g).map(([lo,hi])=>+(hi-lo).toFixed(4)),s,'a drum is the size it was asked to be');
  const u=unitGeometry(g,s,'wood');
  assert.deepEqual(bounds(u).map(([lo,hi])=>+(hi-lo).toFixed(4)),[1,1,1],'in unit space, for the entity to scale');
  for(let i=0;i<u.n.length;i+=3)assert.ok(Math.abs(Math.hypot(u.n[i],u.n[i+1],u.n[i+2])-1)<1e-9);
  assert.equal(u.uv.length,u.p.length/3*2);
});

test('two kinds of hanging thing never share a spot on the beams', () => {
  const pharmacy=ROOMS.pharmacy,taken=[];
  const fittings=pharmacy.fittings.map(f=>({...f,entity:true,top:2.5,hw:1,hd:.4}));
  const gourds=hangSpots(pharmacy,fittings,2,.95,taken),herbs=hangSpots(pharmacy,fittings,2,.8,taken);
  assert.equal(gourds.length+herbs.length,4,'room for both');
  for(const [x,z] of gourds)for(const [hx,hz] of herbs)assert.ok(Math.hypot(x-hx,z-hz)>=1.2,`gourds at ${x},${z} and herbs at ${hx},${hz}`);
});

test('a plain part is painted as what it is', () => {
  const timber=new Set(['#8d6b4d']);
  assert.equal(surfaceOf('#f0e4c8',{plaster:'#f0e4c8'}),'plaster');
  assert.equal(surfaceOf('#8d6b4d',{timber}),'wood');
  assert.equal(surfaceOf('#b39468',{}),'wood','a timber brown');
  assert.equal(surfaceOf('#efe4c8',{cloth:true}),'cloth','a mattress');
  assert.equal(surfaceOf('#bb7359',{stone:true}),'stone','bricks, whatever their colour');
  assert.equal(surfaceOf('#cfe0dd',{}),'soft');
});
