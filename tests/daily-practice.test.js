import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,decodeProfile} from '../src/core/profile.js';
import {dailyPractice,answerDailyWord,practicePool,localPracticeDate} from '../src/core/daily-practice.js';
import {pickReviewWords,reviewWord} from '../src/core/review.js';
const day=n=>new Date(2026,8,n,12).getTime();
test('first review retains four original words and persists the same set through reload',()=>{
 const p=freshProfile();const s=dailyPractice(p,day(13));
 assert.deepEqual(s.ids,['water','tea','apple','book']);
 assert.deepEqual(dailyPractice(decodeProfile(JSON.stringify(p)),day(13)),s);
});
test('new local day rotates all four words, stays fixed across modes, and incomplete first review stays first',()=>{
 const p=freshProfile();const first=dailyPractice(p,day(13));
 assert.deepEqual(dailyPractice(p,day(14)).ids,first.ids);
 p.completed.push('practice:first');
 const next=dailyPractice(p,day(15));
 assert.equal(next.ids.length,4);assert.equal(new Set(next.ids).size,4);
 assert.ok(next.ids.every(id=>!first.ids.includes(id)));
 assert.deepEqual(dailyPractice(p,day(15)),next);
 const later=dailyPractice(p,day(16));assert.ok(later.ids.every(id=>!next.ids.includes(id)));
});
test('each daily word pays ten once, including after a mistake, mode change and reload',()=>{
 let p=freshProfile();const s=dailyPractice(p,day(13));
 assert.equal(answerDailyWord(p,s,'water','recognition',{correct:false,now:day(13)}).coins,0);
 assert.equal(answerDailyWord(p,s,'water','recognition',{correct:true,hinted:true,now:day(13)+1}).coins,10);
 p=decodeProfile(JSON.stringify(p));
 assert.equal(answerDailyWord(p,s,'water','production',{correct:true,now:day(13)+2}).coins,0);
 assert.equal(answerDailyWord(p,s,'water','recognition',{correct:true,now:day(13)+86400000}).coins,0);
 assert.equal(answerDailyWord(p,s,'not-in-set','recognition',{correct:true,now:day(13)}).coins,0);
 assert.equal(p.wallet,10);
});
test('daily practice favors new and due words over familiar words not yet due',()=>{
 const p=freshProfile();p.completed.push('practice:first');
 const candidates=practicePool.slice(4);const available=new Set(candidates.slice(0,4).map(w=>w.id));
 for(const w of practicePool)if(!available.has(w.id))p.words[w.id]={recognition:{stage:6,due:day(30),last:day(12),reviews:6}};
 assert.deepEqual(new Set(dailyPractice(p,day(13)).ids),available);
});
test('review queues omit familiar cards until due and prioritize weaker due cards',()=>{
 const p=freshProfile();const pool=['mastered','weak','new'].map(id=>({id}));
 p.words.mastered={recognition:{stage:6,due:day(20)}};
 p.words.weak={recognition:{stage:1,due:day(12)}};
 assert.deepEqual(pickReviewWords(p,pool,'recognition',{now:day(13),limit:3}).map(w=>w.id),['weak','new']);
});
test('wrong early practice lowers familiarity without repeatedly lowering on the same retry',()=>{
 const p=freshProfile();p.words.water={recognition:{stage:5,due:day(20),last:day(12),reviews:5,learned:true}};
 reviewWord(p,'water','recognition',{correct:false,now:day(13)});
 assert.equal(p.words.water.recognition.stage,4);
 assert.equal(p.words.water.recognition.due,day(13)+120000);
 reviewWord(p,'water','recognition',{correct:false,now:day(13)+1});
 assert.equal(p.words.water.recognition.stage,4);
});
test('daily boundary uses local midnight and a stale set cannot collect rewards after rotation',()=>{
 const before=new Date(2026,8,13,23,59).getTime(),after=new Date(2026,8,14,0,1).getTime();
 assert.equal(localPracticeDate(before),'2026-09-13');assert.equal(localPracticeDate(after),'2026-09-14');
 const p=freshProfile();const first=dailyPractice(p,before);
 for(const id of first.ids)answerDailyWord(p,first,id,'recognition',{correct:true,now:before});
 assert.equal(p.wallet,40);p.completed.push('practice:first');
 const next=dailyPractice(p,after);assert.notDeepEqual(next.ids,first.ids);
 assert.equal(answerDailyWord(p,first,first.ids[0],'production',{correct:true,now:after}).coins,0);
 assert.deepEqual(dailyPractice(p,before),next);
});
test('invalid persisted sets are rejected while old profiles remain compatible',()=>{
 const p=freshProfile();assert.ok(decodeProfile(JSON.stringify(p)));
 p.dailyPractice={date:'2026-09-13',ids:['water','water','tea','book']};
 assert.throws(()=>decodeProfile(JSON.stringify(p)),/Invalid daily practice/);
});
