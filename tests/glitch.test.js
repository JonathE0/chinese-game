import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {Daylight,SUN_TURNS_WITHIN} from '../src/world/daylight.js';

// Shadow texels are snapped to a grid through the world origin, so a sun that turns every frame
// makes shadow edges flicker in places kilometres out (rooms, 云海). There it holds its angle.
test('the sun turns with the hour in town and holds its angle far from the origin', () => {
  const eye=new pc.Vec3(10,1.6,5);
  const sun={light:{},setEulerAngles(...angles){this.angles=angles;}};
  const day=new Daylight({scene:{}},sun,{camera:{},getPosition:()=>eye});
  day.setHour(10);
  const morning=sun.angles;
  day.advance(30);   // half an hour of game time
  assert.notDeepEqual(sun.angles,morning,'in town the sun follows the clock');

  eye.set(-4000,1.6,24);
  assert.ok(eye.length()>SUN_TURNS_WITHIN);
  const held=sun.angles;
  day.advance(30);
  assert.deepEqual(sun.angles,held,'far from the origin the sun keeps its angle');
  assert.equal(day.hour,11,'the clock itself still runs');

  day.setHour(20);
  assert.notDeepEqual(sun.angles,held,'setting the clock turns it anywhere');
});
