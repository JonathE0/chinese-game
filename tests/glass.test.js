import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {RENDER} from '../src/core/quality.js';
import {mirrorMatrix} from '../src/world/mirror.js';
import {balconyOf} from '../src/world/rental.js';
import data from '../src/content/rental.json' with {type:'json'};
import rooms from '../src/content/rooms.json' with {type:'json'};
import city from '../src/content/city.json' with {type:'json'};

// W4-glass (docs/superpowers/plans/2026-09-30-development-wave-4.md): mirrors, the tower's clearer
// windows and the balconies out in 云海.

test('the tower windows draw sharper than a street door, and mirrors are off on 低', () => {
  const {high,medium,low}=RENDER;
  assert.deepEqual([high.towerScale,medium.towerScale,low.towerScale],[1,1.5,2]);
  // Full size on 高, half on 中; 0 is off.
  assert.deepEqual([high.mirrorScale,medium.mirrorScale,low.mirrorScale],[1,2,0]);
});

test('a mirror keeps points on its plane, sends the room behind it and turns the picture inside out', () => {
  const n=new pc.Vec3(1,0,0),p=new pc.Vec3(-6.85,1,2000),m=mirrorMatrix(n,p,new pc.Mat4());
  const at=v=>m.transformPoint(v,new pc.Vec3());
  assert.ok(at(new pc.Vec3(-6.85,1.7,1999)).distance(new pc.Vec3(-6.85,1.7,1999))<1e-6);
  assert.ok(at(new pc.Vec3(-4.85,1.6,2001)).distance(new pc.Vec3(-8.85,1.6,2001))<1e-6);
  // A turned mirror (the gym's walls, a rot 90 fitting) works the same way along its own normal.
  const s=Math.SQRT1_2,k=mirrorMatrix(new pc.Vec3(s,0,s),new pc.Vec3(0,0,0),new pc.Mat4());
  assert.ok(k.transformPoint(new pc.Vec3(1,0,1),new pc.Vec3()).distance(new pc.Vec3(-1,0,-1))<1e-6);
  const d=m.data,det=d[0]*(d[5]*d[10]-d[6]*d[9])-d[4]*(d[1]*d[10]-d[2]*d[9])+d[8]*(d[1]*d[6]-d[2]*d[5]);
  assert.ok(Math.abs(det+1)<1e-9,'a reflection flips handedness, so faces are drawn flipped');
});

test('each flat with a balcony or terrace has one out in 云海, on the tier\'s face at that floor and clear of the tower\'s sign', () => {
  const tower=city.skyline.towers.find(t=>t.id===data.tower.id),text=tower.leds.text;
  let y0=0;const tiers=tower.tiers.map(([share,tall])=>{const t={w:tower.w*share,y0,y1:y0+tall};y0+=tall;return t;});
  const flats=Object.keys(data.balcony.flats);
  assert.deepEqual(flats.sort(),['harbour-one-bed','harbour-penthouse','harbour-view']);
  for(const id of flats){
    const b=balconyOf(id),room=rooms[id],stop=data.stops.find(s=>s.room===id),def=data.balcony.flats[id];
    assert.ok(b,id);
    assert.equal(b.y,data.tower.base+(stop.floor-1)*data.tower.storey+(def.y??0),id);
    const tier=tiers.find(t=>b.y>=t.y0&&b.y<t.y1);
    assert.ok(b.z0>tower.z+tier.w/2&&b.z0<tower.z+tier.w/2+.2,`${id}: out from the tier's face`);
    assert.ok(b.z1-b.z0>=1.9,`${id}: deep enough to stand on`);
    assert.ok(b.x0>tower.x-tier.w/2+.3&&b.x1<tower.x+tier.w/2-.3,`${id}: within the tier's face`);
    // The vertical 云海中心 sign runs down the middle of its tier's face.
    const rows=[...text.zh].length*text.cell;
    if(b.y+2.6>text.y-rows/2&&b.y<text.y+rows/2)assert.ok(b.x0>tower.x+text.cell/2||b.x1<tower.x-text.cell/2,`${id}: clear of the sign`);
    // The glass door is in the flat, on the floor the balcony is on, and the 阳台 or 露台 sign is over it.
    const [w,d]=room.size;
    assert.ok(Math.abs(def.door.x)<w/2&&Math.abs(def.door.z)<d/2,id);
    const sign=data.rooms[id].pieces.find(p=>p.kind==='sign'&&['阳台','露台'].includes(p.text));
    assert.ok(sign&&Math.abs(sign.x-def.door.x)<.3&&Math.abs(sign.z-def.door.z)<.2&&(sign.y??0)>(def.y??0),`${id}: under its sign`);
  }
  assert.equal(balconyOf('riverside-apartment'),null);   // the studio has none
  for(const k of ['out','back'])assert.ok(data.balcony[k].zh&&data.balcony[k].en,k);
});
