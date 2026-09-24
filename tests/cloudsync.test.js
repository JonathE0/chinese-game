import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,SAVE_VERSION} from '../src/core/profile.js';
import {syncCloud,keepLoser,sha256Hex,newNonce} from '../src/core/cloudsync.js';
import {addCopy,rotateBackups,BACKUP_LIMIT} from '../src/core/backup.js';

// An in-memory stand-in for the saves row, behaving like the migration: updated_at is the server's,
// an update only lands on the updated_at it names, and a second write within 5 s is refused.
function fakeCloud(row=null){
  const calls=[];let clock=0;
  const api={
    row,calls,
    async read(){calls.push('read');return api.row&&structuredClone(api.row);},
    async write(p,seen){
      calls.push(seen===null?'insert':'update');
      api.beforeWrite?.();api.beforeWrite=null;
      if(seen===null&&api.row)throw {code:'23505'};
      if(api.throttle)throw {code:'P0001',message:'too many saves'};
      if(api.broken)throw {code:'500',message:'down'};
      if(seen!==null&&api.row?.updated_at!==seen)return null;
      api.row={data:p,version:p.version,updated_at:`t${++clock}`};return api.row.updated_at;
    },
  };
  return api;
}
const withWords=n=>{const p=freshProfile();for(let i=0;i<n;i++)p.words['w'+i]={recognition:{stage:1,due:0,last:0,reviews:1}};return p;};
const run=(api,state,profile,flags={})=>syncCloud(api,state,{profile,...flags});

test('a fuller cloud save this device wrote last is offered and nothing is uploaded',async()=>{
  const api=fakeCloud({data:withWords(5),version:SAVE_VERSION,updated_at:'t0'}),state={};
  const r=await run(api,state,withWords(1),{known:'t0'});
  assert.equal(r.action,'offer');
  assert.equal(Object.keys(r.profile.words).length,5);
  assert.deepEqual(api.calls,['read']);
});

test('a fuller local save is uploaded, as an insert when the cloud is empty and an update after',async()=>{
  const api=fakeCloud(),state={},p=withWords(3);
  assert.equal((await run(api,state,p)).action,'saved');
  assert.deepEqual(api.calls,['read','insert']);
  assert.equal((await run(api,state,withWords(4))).action,'saved');
  assert.deepEqual(api.calls,['read','insert','update']);
  assert.equal(Object.keys(api.row.data.words).length,4);
});

test('a write another device made in between is re-read and the player asked, never overwritten',async()=>{
  const api=fakeCloud(),state={};
  await run(api,state,withWords(1));
  api.row={data:withWords(9),version:SAVE_VERSION,updated_at:'other'};   // another device saved
  const r=await run(api,state,withWords(2),{known:'t1'});
  assert.equal(r.action,'choose');
  assert.equal(Object.keys(api.row.data.words).length,9);
  assert.deepEqual(api.calls.slice(2),['update','read']);
});

test('a throttled write is retried quietly and keeps its place',async()=>{
  const api=fakeCloud(),state={};
  await run(api,state,withWords(1));
  api.throttle=true;
  assert.equal((await run(api,state,withWords(2))).action,'throttled');
  api.throttle=false;
  assert.equal((await run(api,state,withWords(2))).action,'saved');
  assert.equal(Object.keys(api.row.data.words).length,2);
});

test('other errors report a failure and change nothing',async()=>{
  const api=fakeCloud(),state={};
  await run(api,state,withWords(1));
  api.broken=true;
  assert.equal((await run(api,state,withWords(2))).action,'failed');
  assert.equal(Object.keys(api.row.data.words).length,1);
  const down={async read(){throw Error('offline');}};
  assert.equal((await run(down,{},withWords(1))).action,'failed');
});

test('a cloud save from a newer build makes the session read-only',async()=>{
  const newer={...freshProfile(),version:SAVE_VERSION+1};
  const api=fakeCloud({data:newer,version:SAVE_VERSION+1,updated_at:'t0'});
  assert.equal((await run(api,{},withWords(9))).action,'readonly');
  assert.deepEqual(api.calls,['read']);
});

test('read-only, dev and held sessions never touch the cloud',async()=>{
  const api=fakeCloud({data:withWords(1),version:SAVE_VERSION,updated_at:'t0'});
  for(const flags of [{readOnly:true},{dev:true},{hold:true}])
    assert.equal((await run(api,{},withWords(5),flags)).action,'none');
  assert.deepEqual(api.calls,[]);
});

test('a cloud save changed elsewhere always asks, even when this device has more progress',async()=>{
  const cloud={...freshProfile(),wallet:900,completed:['a','b','c']};
  const api=fakeCloud({data:cloud,version:SAVE_VERSION,updated_at:'t0'});
  for(const [local,known] of [[freshProfile(),undefined],[withWords(5),undefined],[withWords(5),'t-old']]){
    const r=await run(api,{},local,{known});
    assert.equal(r.action,'choose');
    assert.equal(r.profile.wallet,900);
  }
  assert.deepEqual(api.calls,['read','read','read']);
});

test('the cloud save this device wrote last is uploaded over, and offered only when it holds more progress',async()=>{
  const api=fakeCloud({data:{...freshProfile(),wallet:900},version:SAVE_VERSION,updated_at:'t0'});
  assert.equal((await run(api,{},freshProfile(),{known:'t0'})).action,'saved');
  api.row={data:withWords(3),version:SAVE_VERSION,updated_at:'t7'};
  assert.equal((await run(api,{},withWords(1),{known:'t7'})).action,'offer');
});

test('an unreadable cloud save written elsewhere is left alone and read again next time',async()=>{
  const api=fakeCloud({data:{nonsense:true},version:SAVE_VERSION,updated_at:'t0'}),state={};
  assert.equal((await run(api,state,withWords(3))).action,'failed');
  assert.equal(state.seen,undefined);
  assert.deepEqual(api.calls,['read']);
});

test('a row another device created between the read and the insert is re-read and the player asked',async()=>{
  const api=fakeCloud(),state={};
  api.beforeWrite=()=>{api.row={data:{...freshProfile(),wallet:500},version:SAVE_VERSION,updated_at:'other'};};
  const r=await run(api,state,withWords(4));
  assert.equal(r.action,'choose');
  assert.deepEqual(api.calls,['read','insert','read']);
  assert.equal(api.row.data.wallet,500);
});

test('keeping this device’s save keeps the cloud copy first, then uploads over it',async()=>{
  const cloud={...freshProfile(),wallet:900};
  const api=fakeCloud({data:cloud,version:SAVE_VERSION,updated_at:'t0'}),state={},kept=[];
  const r=await run(api,state,withWords(5));
  assert.equal(r.action,'choose');
  state.hold=true;
  const keep=async(raw,label)=>{kept.push([JSON.parse(raw).wallet,label]);return true;};
  assert.equal(await keepLoser(state,'local',{cloudRaw:r.raw,localRaw:'{}'},keep),true);
  assert.deepEqual(kept,[[900,'云端']]);
  assert.equal(state.hold,false);
  assert.equal((await run(api,state,withWords(5))).action,'saved');   // no second read, no second ask
  assert.deepEqual(api.calls,['read','update']);
  assert.equal(Object.keys(api.row.data.words).length,5);
});

test('using the cloud save keeps this device’s copy first; with nowhere to keep it nothing changes',async()=>{
  const state={hold:true},kept=[],local=JSON.stringify({...freshProfile(),wallet:7});
  const keep=async(raw,label)=>{kept.push([JSON.parse(raw).wallet,label]);return true;};
  assert.equal(await keepLoser(state,'cloud',{cloudRaw:'{}',localRaw:local},keep),true);
  assert.deepEqual(kept,[[7,'本机']]);
  assert.equal(state.hold,false);
  state.hold=true;
  assert.equal(await keepLoser(state,'cloud',{cloudRaw:'{}',localRaw:local},async()=>{throw Error('idb');}),false);
  assert.equal(state.hold,true);
  assert.equal(await keepLoser(state,'local',{cloudRaw:'{}',localRaw:local},async()=>false),false);
  assert.equal(state.hold,true);
});

test('a kept copy is dated and labelled, capped, and does not take the place of the daily snapshot',()=>{
  const raw=JSON.stringify({...freshProfile(),wallet:42}),now=Date.UTC(2026,8,24,12);
  let list=Array.from({length:BACKUP_LIMIT},(_,i)=>({day:`2026-08-${String(i+1).padStart(2,'0')}`,at:i,coins:0,raw:'{}'}));
  list=addCopy(list,raw,'云端',now);
  assert.equal(list.length,BACKUP_LIMIT);
  assert.match(list.at(-1).day,/^2026-09-24（云端）$/);
  assert.equal(list.at(-1).coins,42);
  assert.equal(list.at(-1).raw,raw);
  assert.notEqual(rotateBackups(list,freshProfile(),now),list);   // today's own snapshot still happens
});

test('the sign-in nonce: Google gets the SHA-256 hex of a fresh random value, Supabase the value',async()=>{
  assert.equal(await sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const a=await newNonce(),b=await newNonce();
  assert.notEqual(a.raw,b.raw);
  assert.ok(a.raw.length>=40);
  assert.equal(a.hashed,await sha256Hex(a.raw));
  assert.match(a.hashed,/^[0-9a-f]{64}$/);
});
