import test from 'node:test';
import assert from 'node:assert/strict';
import {CHECKINS,spotFor,checkIn,checkedIn,addPhoto,PHOTO_CAP} from '../src/core/checkins.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';

const shot=(name,extra={})=>({place:'town',distance:8,hour:15,owner:null,name,...extra});

test('a photo counts for the spot whose look is centred, close enough, in the right place and hour',()=>{
  assert.equal(spotFor(shot({id:'fountain',zh:'喷泉'}))?.id,'fountain');
  assert.equal(spotFor(shot({id:'fountain',zh:'喷泉'},{distance:40})),null,'too far off');
  assert.equal(spotFor(shot({id:'fountain',zh:'喷泉'},{place:'city'})),null,'not the town square');
  assert.equal(spotFor(shot({id:'sign:room-hall',zh:'词语馆',sign:true}))?.id,'wordhall','a sign matches by its text');
  assert.equal(spotFor(shot({id:'sign:x',zh:'云海中心'},{place:'city',distance:180}))?.id,'yunhai-centre','a landmark from across the bay');
  assert.equal(spotFor(shot({id:'bench',zh:'长椅'})),null);
  assert.equal(spotFor(shot(null)),null);
  const moon={id:'yueliang',zh:'月亮'};
  assert.equal(spotFor(shot(moon,{hour:21}))?.id,'moon');
  assert.equal(spotFor(shot(moon,{hour:2,place:'city'}))?.id,'moon','the moon is the moon anywhere');
  assert.equal(spotFor(shot(moon,{hour:12})),null,'not by day');
  assert.equal(spotFor(shot({id:'drone',zh:'无人机'},{place:'city',owner:'drones',distance:120}))?.id,'drones','the show, whatever it spells');
});

test('every spot pays once, and the save keeps which are done',()=>{
  const p=freshProfile(),fountain=CHECKINS.spots.find(s=>s.id==='fountain');
  assert.equal(checkIn(p,fountain),true);
  assert.equal(p.wallet,CHECKINS.reward);
  assert.equal(CHECKINS.reward,5);
  assert.equal(checkIn(p,fountain),false,'the second photo pays nothing');
  assert.equal(p.wallet,5);
  const back=decodeProfile(JSON.stringify(p));
  assert.equal(checkedIn(back,'fountain'),true);
  assert.equal(checkedIn(back,'moon'),false);
});

test('the album keeps the newest photos up to its cap',()=>{
  assert.equal(PHOTO_CAP,60);
  let list=[];
  for(let i=0;i<PHOTO_CAP;i++)({list}=addPhoto(list,{id:i}));
  assert.equal(list.length,60);
  const {list:next,dropped}=addPhoto(list,{id:60});
  assert.deepEqual(dropped.map(p=>p.id),[0]);
  assert.equal(next.length,60);
  assert.equal(next.at(-1).id,60);
  assert.equal(list.length,60,'the old list is left alone');
});

test('every spot has its table row and a clip id',()=>{
  assert.deepEqual(CHECKINS.spots.map(s=>s.id),['fountain','wordhall','lotus-park','bank','riverside','yunhai-centre','ferris-wheel','drones','hotpot','viewpoint','ferry','moon']);
  for(const s of CHECKINS.spots){
    for(const key of ['zh','pinyin','en'])assert.ok(s[key]&&s.line[key],s.id+' '+key);
    assert.equal(s.line.audio,'checkin-'+s.id);
    assert.ok(s.looks?.length||s.owner,s.id+' has something to match');
  }
  assert.equal(CHECKINS.success.audio,'checkin-success');
});
