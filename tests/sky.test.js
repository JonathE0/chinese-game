import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import {Daylight,sunDirection,moonDirection,SUN_TURNS_WITHIN} from '../src/world/daylight.js';
import {moonPhase,starsAt} from '../src/world/sky.js';
import {festivalOn} from '../src/core/festivals.js';

const near=(a,b,what)=>assert.ok(a.distance(b)<1e-4,`${what}: ${a} vs ${b}`);
function daylight(eye=new pc.Vec3()){
  const sun=new pc.Entity('sun');sun.light={};
  return {sun,day:new Daylight({scene:{}},sun,{camera:{},getPosition:()=>eye})};
}

test('the drawn sun sits exactly where the light comes from, and sets in the evening', () => {
  const {sun,day}=daylight();
  for(const hour of [7,9,12.5,15,18]){
    day.setHour(hour);
    near(sun.up,sunDirection(hour),`light at ${hour}:00`);
    near(day.sunUp,sun.up,`drawn sun at ${hour}:00`);
  }
  assert.ok(sunDirection(7).x>0&&sunDirection(18).x<0,'up in the east, down in the west');
  assert.ok(sunDirection(12.5).z>0&&sunDirection(12.5).y>.8,'high in the south at midday');
  for(const hour of [20,23,2,5])assert.ok(sunDirection(hour).y<0,`below the horizon at ${hour}:00`);
  assert.ok(sunDirection(18.5).z<0&&sunDirection(18.5).y>0,'in 云海 it sets over the bay, to the north-west');
});

test('at night the light is moonlight, from the moon', () => {
  const {sun,day}=daylight();
  for(const hour of [21,0.5,3]){
    day.setHour(hour);
    near(sun.up,moonDirection(hour),`moonlight at ${hour}:00`);
    assert.ok(moonDirection(hour).y>0,`the moon is up at ${hour}:00`);
  }
  assert.ok(moonDirection(.5).z<-.5,'high over the bay, to the north, at midnight');
  for(const hour of [9,12.5,16,17.5,18.5])assert.ok(moonDirection(hour).y<0,`no moon at ${hour}:00`);
  // Where the sun meets the horizon the direct light is low, so the swap hardly shows, but never out.
  for(const hour of [6,19]){day.setHour(hour);const i=sun.light.intensity;assert.ok(i>.03&&i<.2,`dim, not dark, at ${hour}:00: ${i}`);}
});

test('far from town the light intensity changes minute by minute, not in half-hour jumps', () => {
  const eye=new pc.Vec3(-4000,2,0),{sun,day}=daylight(eye);
  for(const from of [5,18]){
    day.setHour(from);let last=sun.light.intensity;
    for(let minute=0;minute<120;minute++){
      day.advance(1);   // one game minute
      const now=sun.light.intensity;
      assert.ok(Math.abs(now-last)<.04,`smooth at ${day.hour.toFixed(2)}: ${last} -> ${now}`);
      last=now;
    }
  }
});

test('the sky moves smoothly through the night: stars fade out at dawn as they fade in at dusk', () => {
  for(let minute=1;minute<24*60;minute++){
    const a=sunDirection((minute-1)/60).y,b=sunDirection(minute/60).y,c=moonDirection((minute-1)/60).y,d=moonDirection(minute/60).y;
    assert.ok(Math.abs(a-b)<.01&&Math.abs(c-d)<.01,`no jump at minute ${minute}`);
  }
  let last=starsAt(5.5);
  assert.equal(last,1,'all out before dawn');
  for(let minute=1;minute<=60;minute++){
    const now=starsAt(5.5+minute/60);
    assert.ok(now<=last&&last-now<.1,`fading at ${(5.5+minute/60).toFixed(2)}`);
    last=now;
  }
  assert.equal(last,0,'gone by 6:30');
  assert.ok(starsAt(19.2)>0&&starsAt(19.2)<1,'coming out after sunset');
});

test('far from town the drawn sun holds its angle with the light', () => {
  const eye=new pc.Vec3(-4000,2,0),{sun,day}=daylight(eye);
  assert.ok(eye.length()>SUN_TURNS_WITHIN);
  day.setHour(10);const set=sun.up.clone();
  day.advance(5);   // five game minutes, inside the same half-hour step
  near(sun.up,set,'the light holds inside a step');
  near(day.sunUp,sunDirection(10),'the drawn sun holds with it');
  day.advance(30);  // past the next step
  assert.ok(sun.up.distance(set)>.01,'the light turns once a step is crossed');
  near(day.sunUp,sun.up,'the drawn sun turns with it');
  near(day.sunUp,sunDirection(day.hour),'to the hour it turned at');
});

test('the moon runs a fourteen-day cycle, full on every 中秋节 without forcing', () => {
  const zhongqiu=[...Array(200).keys()].filter(d=>festivalOn(d)?.id==='zhongqiu');
  assert.ok(zhongqiu.length>=3);
  for(const day of zhongqiu)assert.equal(moonPhase(day),.5,`full on day ${day}`);
  const first=zhongqiu[0];
  assert.equal(moonPhase(first+7),0,'new a week later');
  assert.equal(moonPhase(first+14),.5,'full again a fortnight later');
  // Every day moves the same step, festival or not: no jump into the full moon.
  for(let day=1;day<120;day++){
    const step=((moonPhase(day)-moonPhase(day-1))%1+1)%1;
    assert.ok(Math.abs(step-1/14)<1e-9,`one step from day ${day-1} to ${day}`);
  }
});

test('moonlight is as strong as the moon is full', () => {
  const {sun,day}=daylight();
  day.setHour(23);const full=sun.light.intensity;
  day.moonLit=0;day.setHour(23);const dark=sun.light.intensity;
  assert.ok(dark<full*.15&&dark>0,'a new moon gives almost no light');
  day.setHour(12.5);assert.ok(sun.light.intensity>1,'sunlight is untouched');
});
