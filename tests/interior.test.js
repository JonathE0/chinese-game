import test from 'node:test';
import assert from 'node:assert/strict';
import {annexDoor,annexApproach} from '../src/world/interior.js';

test('an east annex door sits flush with the east wall, turned to face into the room',()=>{
  const at=annexDoor('east',4.465,2.85,10,9);
  assert.equal(at.x,10/2-.035);
  assert.equal(at.z,2.85);
  assert.equal(at.rot,-90);
  assert.deepEqual([at.nx,at.nz],[-1,0]);
});

test('a west annex door mirrors the east one',()=>{
  const at=annexDoor('west',-4,1.2,10,9);
  assert.equal(at.x,-10/2+.035);
  assert.equal(at.z,1.2);
  assert.equal(at.rot,90);
  assert.deepEqual([at.nx,at.nz],[1,0]);
});

test('a back annex door sits flush with the wall opposite the front door, clear of the back trim',()=>{
  const at=annexDoor('back',1.5,-4,10,9);
  assert.equal(at.x,1.5);
  assert.equal(at.z,-9/2+.11);
  assert.equal(at.rot,0);
  assert.deepEqual([at.nx,at.nz],[0,1]);
});

// Regression for a bug where the hitbox/target were nudged off the annex's raw content
// coordinates instead of off the door as actually drawn — invisible on the east wall (where the
// two happen to be close) but a real gap on the west and back walls.
test('the approach point for a hitbox or target is measured from the drawn door, not the raw annex x/z',()=>{
  const west=annexDoor('west',-4,1.2,10,9),westNear=annexApproach('west',-4,1.2,10,9,.2);
  assert.equal(westNear.x,west.x+.2);
  assert.equal(westNear.z,west.z);
  assert.notEqual(westNear.x,-4-.2);   // the old bug: nudging the raw x, not the wall line

  const back=annexDoor('back',1.5,-4,10,9),backNear=annexApproach('back',1.5,-4,10,9,.2);
  assert.equal(backNear.z,back.z+.2);
  assert.equal(backNear.x,back.x);
  assert.notEqual(backNear.z,-4+.2);   // the old bug: nudging the raw z, not the wall line
});

import {wallBlockers,wallFits,wainscotRuns} from '../src/world/interior.js';

// A 10 x 8 shop: a back window at x 3, an annex door on the east wall at z 1, and a shelf
// standing against the west wall at z -2.
const shop={size:[10,8],height:3.5,window:[3],annexes:[{wall:'east',x:4.5,z:1}]};
const shelf={x:-4.6,z:-2,hw:.3,hd:.7};

test('a wall piece keeps clear of windows, doors, fittings, the doorway and the corners',()=>{
  const blocked=wallBlockers(shop,[shelf]);
  assert.equal(wallFits({kind:'painting',wall:'back',at:3},blocked,shop),false);     // over the window
  assert.equal(wallFits({kind:'painting',wall:'back',at:-1},blocked,shop),true);
  assert.equal(wallFits({kind:'scroll',wall:'east',at:1.2},blocked,shop),false);     // on the annex door
  assert.equal(wallFits({kind:'scroll',wall:'east',at:-2},blocked,shop),true);
  assert.equal(wallFits({kind:'painting',wall:'west',at:-2},blocked,shop),false);    // behind the shelf
  assert.equal(wallFits({kind:'painting',wall:'west',at:1.5},blocked,shop),true);
  assert.equal(wallFits({kind:'painting',wall:'front',at:0},blocked,shop),false);    // over the doorway
  assert.equal(wallFits({kind:'lamp',wall:'front',at:2.5},blocked,shop),true);
  assert.equal(wallFits({kind:'painting',wall:'back',at:4.6},blocked,shop),false);   // in the corner
});

test('wainscoting runs round the walls, broken only at doors',()=>{
  const blocked=wallBlockers(shop,[shelf]);
  const front=wainscotRuns(shop,blocked,'front');
  assert.equal(front.length,2);                                  // either side of the doorway
  assert.ok(front.every(([a0,a1])=>a1<=-.85||a0>=.85));
  assert.equal(wainscotRuns(shop,blocked,'west').length,1);      // a fitting does not break it
  assert.equal(wainscotRuns(shop,blocked,'east').length,2);      // the annex door does
  assert.equal(wainscotRuns(shop,blocked,'back').length,1);      // a window sits above it
});
