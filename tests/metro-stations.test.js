import test from 'node:test';
import assert from 'node:assert/strict';
import metro from '../src/content/metro.json' with {type:'json'};
import rooms from '../src/content/rooms.json' with {type:'json'};
import city from '../src/content/city.json' with {type:'json'};
import signs from '../src/content/signs.json' with {type:'json'};
import {timetableAt,boardAt,stationExits,nearestExit} from '../src/world/metro-station.js';
import {say} from '../src/ui/order.js';

const T=metro.timetable,cycle=T.away+T.arriving+T.open+T.closing+T.departing;

test('a train comes round about once a minute: in, doors open, closing, out, then a gap',()=>{
  assert.ok(cycle>=60&&cycle<=80,`a ${cycle} s round`);
  const seen=[];
  for(let p=0;p<cycle;p+=.5){const {state}=timetableAt(p);if(seen.at(-1)!==state)seen.push(state);}
  assert.deepEqual(seen,['away','arriving','open','closing','departing']);
  assert.equal(timetableAt(T.away+.1).state,'arriving');
  assert.equal(timetableAt(T.away+T.arriving+T.open-.1).state,'open');
  assert.equal(timetableAt(cycle+1).state,timetableAt(1).state,'and round again');
});

test('the boards count down to the nearest minute, say 即将到站 under half a minute, and 列车进站 as it comes in',()=>{
  assert.deepEqual(boardAt(T.away+1),{key:'arriving'});
  assert.deepEqual(boardAt(T.away-10),{key:'soon'});
  assert.deepEqual(boardAt(T.away-31),{key:'countdown',n:1});
  // Just after one has gone, the next is more than a minute off.
  assert.deepEqual(boardAt(cycle-T.departing+1),{key:'countdown',n:Math.max(1,Math.round((T.departing-1+T.away)/60))});
  assert.equal(boardAt(T.away+T.arriving+1).key,'countdown','with a train standing there, the board is already on the next one');
  for(const key of ['countdown','soon','arriving'])assert.ok(metro.signs[key].zh&&metro.signs[key].en);
  assert.match(metro.signs.countdown.zh,/^下一班 \{n\} 分钟$/);
});

test('云海市中心站 has four exits, each signed from city.json and leading to its own spot there',()=>{
  const data=rooms['yunhai-central'],exits=stationExits(data);
  assert.deepEqual(exits.map(e=>e.id),['A','B','C','D']);
  for(const e of exits){
    assert.ok(e.out,`exit ${e.id} is in city.json metroStation.exits`);
    assert.equal(e.label,`${e.out.zh} · ${e.out.to.zh} · ${e.out.to.en}`);
    assert.ok(signs.signs[e.out.zh],`${e.out.zh} is a signs.json entry`);
    assert.equal(e.y,data.upper.y,'on the hall level');
    const [w,d]=data.size;
    for(const at of [e.target,e.inside])assert.ok(Math.abs(at.x)<w/2&&Math.abs(at.z)<d/2,`exit ${e.id} opens inside the hall`);
    // Leaving by an exit's mouth picks that exit; standing on its spot in the city picks it coming back.
    assert.equal(nearestExit(exits,e.target.x,e.target.z).id,e.id);
    assert.equal(nearestExit(exits,e.out.spawn[0],e.out.spawn[1],true).id,e.id);
  }
  assert.equal(new Set(city.metroStation.exits.map(e=>e.spawn.join())).size,4,'four different spots in the city');
});

test('every station sign and announcement line is vetted content: signs in signs.json, lines with a clip id',()=>{
  const S=metro.signs;
  for(const key of ['entry','exit','way-out','tap-in','tap-out','top-up','gap','yellow-line','next','soon','arriving','waiting','line','metro','concourse','platform','stairs','escalator','gates','doors','service','transfer','balance','short','card'])
    assert.ok(signs.signs[S[key].zh],`${S[key].zh} (${key}) is in signs.json`);
  for(const station of Object.values(metro.stations)){
    assert.ok(signs.signs[station.name],`${station.name} is in signs.json`);
    assert.ok(signs.signs[station.towards],`${station.towards} is in signs.json`);
  }
  assert.equal(metro.stations.yunhai.name,'云海市中心站');
  const A=metro.announcements,lines=Object.keys(metro.lines);
  const known=k=>['bound','next','arrive'].includes(k)?['city','town'].every(d=>lines.includes(`${k}-${d}`)):k==='tip'||lines.includes(k);
  for(const k of [...Object.values(A.platform).flat(),...A.ride,...A.tips])assert.ok(known(k),`announcement ${k} has its line(s)`);
});

// A clip on a stand-in player: `play` pauses whatever was playing, as the real one does.
class Clip extends EventTarget{
  constructor(){super();this.paused=true;}
  play(){this.paused=false;return Promise.resolve();}
  pause(){if(!this.paused){this.paused=true;this.dispatchEvent(new Event('pause'));}}
  end(){this.paused=true;this.dispatchEvent(new Event('ended'));}
}
test('say() tells a line heard to its end from one a newer line (a Replay) cut short',async()=>{
  const voice={foreground:null,available:()=>true,play(){this.foreground?.pause();this.foreground=new Clip();return this.foreground.play();}};
  const el={isConnected:true,closest:()=>null};
  const first=say({voice},el,['metro-next-city']);
  const replay=say({voice},el,['metro-next-city']);
  assert.equal(await first,false,'the first playing was cut short by the replay');
  voice.foreground.end();
  assert.equal(await replay,true,'the replay was heard out');
  assert.equal(await say({voice:{...voice,available:()=>false}},el,['metro-nothing']),true,'no clip: nothing to wait for');
});
