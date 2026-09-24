import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile} from '../src/core/profile.js';
import catalog from '../src/content/catalog.json' with {type:'json'};
import {levelOf,friendOf,chatted,giveGift,visit,heard,pinned,priced,sendPostcard,postcardRows,noteVisit} from '../src/core/friends.js';

// Talking plays every pending line, as the dialogue does when each one renders.
const talk=(p,npc)=>{const {said}=visit(p,npc);let present=null;for(const k of said)present=heard(p,npc,k)??present;return {said,present};};

const next=p=>{p.dayIndex=(p.dayIndex??0)+1;};

test('friendship levels follow the points thresholds',()=>{
  assert.deepEqual([0,9,10,24,25,49,50,999].map(n=>levelOf(n).zh),['认识','认识','熟人','熟人','朋友','朋友','好朋友','好朋友']);
});

test('a chat and a gift each pay once per person per game day',()=>{
  const p=freshProfile();p.inventory={'pot-tea':2,bread:1};
  assert.equal(chatted(p,'lin'),2);
  assert.equal(chatted(p,'lin'),0);
  assert.equal(chatted(p,'mei'),2);                  // another person has their own day
  assert.deepEqual(giveGift(p,'lin','pot-tea'),{line:'gift-liked',points:5});
  assert.deepEqual(giveGift(p,'lin','bread'),{line:'gift-again',points:0});
  assert.equal(p.inventory.bread,1);                 // a refused gift stays in the bag
  assert.equal(p.inventory['pot-tea'],1);
  next(p);
  assert.equal(chatted(p,'lin'),2);
  assert.deepEqual(giveGift(p,'lin','bread'),{line:'gift-plain',points:3});
  assert.equal(p.inventory.bread,undefined);
  assert.equal(friendOf(p,'lin').points,12);
  assert.equal(giveGift(p,'mei','tea-set'),null);    // not carried, not a small thing
});

test('missions count once, and each level’s lines play once, with the present at the top',()=>{
  const p=freshProfile();p.completed=['introductions'];
  assert.deepEqual(talk(p,'lin'),{said:[],present:null});
  assert.equal(friendOf(p,'lin').points,5);
  assert.deepEqual(talk(p,'lin').said,[]);
  assert.equal(friendOf(p,'lin').points,5);
  friendOf(p,'lin').points=10;
  assert.deepEqual(talk(p,'lin').said,['shuren-1','shuren-2']);
  assert.deepEqual(talk(p,'lin').said,[]);
  friendOf(p,'lin').points=60;
  assert.deepEqual(talk(p,'lin'),{said:['pengyou-1','pengyou-2','hao-1'],present:'tea-set'});
  assert.equal(p.inventory['tea-set'],1);
  assert.deepEqual(talk(p,'lin'),{said:[],present:null});
});

test('a line walked away from before it showed is still there next time, and nothing is given early',()=>{
  const p=freshProfile();
  friendOf(p,'chen').points=50;
  assert.deepEqual(visit(p,'chen').said,['shuren-1','shuren-2','pengyou-1','pengyou-2','hao-1']);
  heard(p,'chen','shuren-1');                       // Esc after the first line
  assert.deepEqual(friendOf(p,'chen').seen,[]);
  assert.deepEqual(visit(p,'chen').said,['shuren-1','shuren-2','pengyou-1','pengyou-2','hao-1']);
  heard(p,'chen','shuren-2');
  assert.deepEqual(visit(p,'chen').said,['pengyou-1','pengyou-2','hao-1']);
  const card=catalog.find(i=>i.id==='postcard');
  assert.equal(priced(p,'chen',card),card);          // no 九折 until he has said so
  heard(p,'chen','hao-1');heard(p,'chen','hao-1');
  assert.equal(priced(p,'chen',card).price,7);
  assert.deepEqual(friendOf(p,'chen').seen,['shuren','hao']);
});

test('陈叔叔 gives 九折 at his own shop once he is a good friend, and nowhere else',()=>{
  const p=freshProfile(),card=catalog.find(i=>i.id==='postcard');
  assert.equal(priced(p,'chen',card),card);
  friendOf(p,'chen').points=50;talk(p,'chen');
  assert.deepEqual([priced(p,'chen',card).price,priced(p,'chen',card).minPrice],[7,5]);
  assert.equal(priced(p,'homeware',card),card);
  friendOf(p,'lin').points=50;talk(p,'lin');
  assert.equal(priced(p,'lin',card),card);
});

test('a postcard needs one in the bag, one per person per day, and is answered the next day only',()=>{
  const p=freshProfile(),lines=['to-mei','went-hall','learned','happy','bye'];
  assert.equal(sendPostcard(p,'mei',lines),false);
  p.inventory.postcard=2;
  assert.equal(sendPostcard(p,'mei',lines),true);
  assert.equal(sendPostcard(p,'mei',lines),false);
  assert.equal(p.inventory.postcard,1);
  assert.deepEqual(talk(p,'mei').said,[]);           // same day: not delivered yet
  next(p);
  const before=friendOf(p,'mei').points;
  assert.deepEqual(visit(p,'mei').said,['post-reply']);
  assert.equal(friendOf(p,'mei').points,before);    // walked away before the reply showed
  assert.deepEqual(talk(p,'mei').said,['post-reply']);
  assert.equal(friendOf(p,'mei').points,before+4);
  assert.deepEqual(talk(p,'mei').said,[]);
  assert.deepEqual(p.learning.postcards,[{to:'mei',day:0,lines,replied:true}]);
  assert.equal(pinned(p,'mei'),false);
});

test('陈叔叔 keeps your card pinned up once he has answered, however many cards follow',()=>{
  const p=freshProfile();p.inventory.postcard=1;
  sendPostcard(p,'chen',['to-chen']);
  assert.equal(pinned(p,'chen'),false);
  next(p);talk(p,'chen');
  assert.equal(pinned(p,'chen'),true);
  p.learning.postcards=[];                          // his card aged out of the kept 50
  assert.equal(pinned(p,'chen'),true);
});

test('postcard tiles offer only places visited and things carried, and no drinks to eat',()=>{
  const p=freshProfile();p.inventory={'red-bean-bun':1,coffee:1,postcard:1,'hsk-cert-1':1};
  const rows=postcardRows(p);
  assert.equal(rows.length,5);
  assert.deepEqual(rows[1],[]);
  assert.deepEqual(rows[2].map(t=>t.zh),['我吃了豆沙包。','我学了新词。','我买了明信片。']);
  // Walking into a district or the word hall counts; the square and other rooms are not places here.
  assert.equal(noteVisit(p,'garden'),true);
  assert.equal(noteVisit(p,'garden'),false);
  assert.equal(noteVisit(p,'square'),false);
  assert.equal(noteVisit(p,'bakery'),false);
  noteVisit(p,'hall');
  p.completed.push('metro:first');                  // riding the metro is being in 云海
  assert.deepEqual(postcardRows(p).at(1).map(t=>t.zh),['我今天去了莲池公园。','我今天去了云海市中心。','我今天去了词语馆。']);
  assert.deepEqual(p.learning.visited,['garden','hall']);
});
