import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,decodeProfile} from '../src/core/profile.js';

// The learning features keep their progress under one `learning` key in the save
// (docs/superpowers/plans/2026-09-24-learning-features.md). A bad entry drops only itself.
test('learning progress survives a save round trip, and a bad entry drops only itself',()=>{
  const p=freshProfile();
  p.learning={
    sources:{'水池':{place:'kitchen',x:1.5,z:-2,line:'这是水池。'},'bad':{place:'town',x:'far',z:0}},
    misses:{'买':3,'卖':0,'大':'x'},
    levels:{placement:{level:2,day:3},passed:{'1':4,'9':1,'2':'no'}},
  };
  const back=decodeProfile(JSON.stringify(p)).learning;
  assert.deepEqual(back.sources,{'水池':{place:'kitchen',x:1.5,z:-2,line:'这是水池。'}});
  assert.deepEqual(back.misses,{'买':3});
  assert.deepEqual(back.levels,{placement:{level:2,day:3},passed:{'1':4}});
});

test('a save without learning progress stays without it, and junk is dropped',()=>{
  assert.equal(decodeProfile(JSON.stringify(freshProfile())).learning,undefined);
  const p=freshProfile();p.learning='lots';
  const repairs=[];
  assert.equal(decodeProfile(JSON.stringify(p),repairs).learning,undefined);
});

// Task E-review: wrong answers per word, the confusables deck and where each word was first met.
import {reviewWord,confusableDeck} from '../src/core/review.js';
import {noteSource} from '../src/core/learning.js';
import confusables from '../src/content/confusables.json' with {type:'json'};

test('each wrong review answer adds exactly one miss for its word; right answers add none',()=>{
  const p=freshProfile();
  p.saved=[{id:'bank-sink',zh:'水池',pinyin:'shuǐchí',en:'sink'}];
  reviewWord(p,'bank-sink','recognition',{correct:false,hinted:false,now:1000});
  assert.deepEqual(p.learning.misses,{'水池':1});
  // A second wrong guess inside the retry window still counts once, as its own wrong answer.
  reviewWord(p,'bank-sink','recognition',{correct:false,hinted:false,now:2000});
  reviewWord(p,'bank-sink','recognition',{correct:true,hinted:false,now:9e9});
  assert.deepEqual(p.learning.misses,{'水池':2});
  // A word outside the bank names its own characters.
  reviewWord(p,'hsk-x','listening',{correct:false,hinted:false,now:1000,zh:'卖'});
  assert.equal(p.learning.misses['卖'],1);
});

test('the confusables deck keeps groups with a met member, most-missed first',()=>{
  const p=freshProfile();
  const groups=[
    {kind:'look',members:[{zh:'买'},{zh:'卖'}]},
    {kind:'look',members:[{zh:'大'},{zh:'太'}]},
    {kind:'sound',members:[{zh:'书'},{zh:'树'}]},
    {kind:'look',members:[{zh:'刀'},{zh:'力'}]},
  ];
  p.saved=[{id:'bank-a',zh:'买',pinyin:'mǎi',en:'buy'}];
  p.learning={misses:{'树':2,'太':1},sources:{'刀':{place:'town',x:0,z:0}}};
  assert.deepEqual(confusableDeck(p,groups).map(g=>g.members[0].zh),['书','大','买','刀']);
  // Nothing met, nothing shown; an HSK record counts as met through idOf.
  const q=freshProfile();q.words['hsk-mai']={recognition:{stage:1,due:0,last:0,reviews:1}};
  assert.deepEqual(confusableDeck(q,groups,zh=>zh==='卖'?'hsk-mai':null).map(g=>g.members[0].zh),['买']);
});

test('where a word was met is recorded the first time only',()=>{
  const p=freshProfile();
  assert.equal(noteSource(p,'水池',{place:'kitchen',x:1,z:2}),true);
  assert.equal(noteSource(p,'水池',{place:'town',x:5,z:5}),false);
  assert.deepEqual(p.learning.sources['水池'],{place:'kitchen',x:1,z:2});
});

test('every confusables group has two or more members with a meaning, and the prompts have clips',()=>{
  for(const kind of ['look','sound'])assert.equal(confusables.prompts[kind].audio,'conf-'+kind);
  for(const g of confusables.groups){
    assert.ok(['look','sound'].includes(g.kind));
    assert.ok(g.members.length>=2&&g.members.every(m=>m.zh&&m.pinyin&&m.en));
  }
});

// Task F-friends: friendship with the three townspeople, and the postcards sent them.
test('friendships and postcards survive a save round trip, and a bad entry drops only itself',()=>{
  const p=freshProfile();
  p.learning={
    friends:{lin:{points:12,day:3,gift:2,seen:['shuren','shuren',7],missions:['greet'],pinned:'yes'},mei:{points:-1},chen:{points:4,post:'x',seen:'hao',pinned:true}},
    visited:['garden','hall','garden',3],
    postcards:[{to:'lin',day:2,lines:['to-lin','went-hall','learned','happy','bye'],replied:false},{to:'mei',day:'no',lines:[],replied:true},{to:'chen',day:1,lines:['to-chen'],replied:true,extra:1}],
  };
  const back=decodeProfile(JSON.stringify(p)).learning;
  assert.deepEqual(back.friends,{lin:{points:12,day:3,gift:2,seen:['shuren'],missions:['greet']},chen:{points:4,seen:[],missions:[],pinned:true}});
  assert.deepEqual(back.visited,['garden','hall']);
  assert.deepEqual(back.postcards,[p.learning.postcards[0],{to:'chen',day:1,lines:['to-chen'],replied:true}]);
  // Only the newest 50 cards are kept.
  p.learning.postcards=Array.from({length:60},(_,day)=>({to:'lin',day,lines:['to-lin'],replied:true}));
  const kept=decodeProfile(JSON.stringify(p)).learning.postcards;
  assert.deepEqual([kept.length,kept[0].day],[50,10]);
});
