import test from 'node:test';
import assert from 'node:assert/strict';
import tutorial from '../src/content/tutorial.json' with {type:'json'};
import {shouldAutoStart,startTutorial,skipTutorial,isSeen,markSeen,nextTip,tipEvent,fillText,normalizeTutorial,TIP_GAP,TIP_SECONDS} from '../src/core/tutorial.js';
import {cardCoins} from '../src/core/review.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';

const steps=tutorial.steps;
const ids=steps.map(s=>s.id);
const homeAt=(({x,z})=>({x,z}))(steps.find(s=>s.id==='home').when[0].at);
/** A brand-new save as the game has it by the time 开始旅行 is pressed. */
const newcomer=()=>{const p=freshProfile();p.completed.push('home:starter');return p;};
const runner=()=>{const p=newcomer();startTutorial(p);return p;};
const ctx=(o={})=>({time:0,lastAt:-Infinity,fired:new Set(),nearId:null,pos:null,place:'town',...o});
const tip=(p,o)=>nextTip(p,ctx(o))?.id??null;
const skipOpening=p=>{for(const id of['look','walk'])markSeen(p,id);return p;};

test('the tutorial starts on its own only for a brand-new save',()=>{
  assert.equal(shouldAutoStart(newcomer()),true);
  assert.equal(shouldAutoStart(freshProfile()),true);
  const flagged=newcomer();flagged.completed.push('practice:first');
  assert.equal(shouldAutoStart(flagged),false);
  const looked=newcomer();looked.discovered.push('bench');
  assert.equal(shouldAutoStart(looked),false);
  const met=newcomer();met.tutorial={seen:[]};
  assert.equal(shouldAutoStart(met),false);
});

test('starting empties the seen list; skipping marks every tip seen',()=>{
  const p=newcomer();startTutorial(p);
  assert.deepEqual(p.tutorial,{seen:[]});
  markSeen(p,'look');markSeen(p,'look');
  assert.deepEqual(p.tutorial.seen,['look']);
  assert.equal(isSeen(p,'look'),true);
  skipTutorial(p);
  assert.deepEqual(p.tutorial.seen,ids);
  startTutorial(p);                     // Settings replays it
  assert.deepEqual(p.tutorial,{seen:[]});
});

test('only look and walk are there at the start, one after the other',()=>{
  const p=runner();
  assert.equal(tip(p,{}),null);                                           // not before the game says it has started
  assert.equal(tip(p,{fired:new Set(['start'])}),'look');
  markSeen(p,'look');
  assert.equal(tip(p,{fired:new Set(['start']),time:2,lastAt:0}),'walk'); // no 60 s wait between the two
  markSeen(p,'walk');
  assert.equal(tip(p,{fired:new Set(['start']),time:3,lastAt:2}),null);
});

test('a save with no tutorial gets no tips, and a tip is shown once',()=>{
  assert.equal(nextTip(newcomer(),ctx({fired:new Set(['start'])})),null);
  const p=runner();markSeen(p,'look');
  assert.notEqual(tip(p,{fired:new Set(['start'])}),'look');
});

test('tips are at least a minute apart',()=>{
  assert.equal(TIP_GAP,60);
  assert.ok(TIP_SECONDS>=8&&TIP_SECONDS<=12);
  const p=skipOpening(runner());
  const fired=new Set(['look-object']);
  assert.equal(tip(p,{fired,time:100,lastAt:50}),null);
  assert.equal(tip(p,{fired,time:110,lastAt:50}),'word');
});

test('what triggers each tip',()=>{
  const p=skipOpening(runner());
  const at=o=>tip(p,o);
  assert.equal(at({fired:new Set(['look-object'])}),'word');
  markSeen(p,'word');
  assert.equal(at({fired:new Set(['collect'])}),'bank');
  markSeen(p,'bank');
  assert.equal(at({fired:new Set(['coins'])}),'coins');
  markSeen(p,'coins');
  assert.equal(at({}),null);
  assert.equal(at({time:119}),null);
  assert.equal(at({time:120}),'missions');                                // about 2 minutes in
  assert.equal(at({fired:new Set(['quests'])}),'missions');               // or when the quest card changes
  markSeen(p,'missions');
  assert.equal(at({time:239}),null);
  assert.equal(at({time:240}),'view');                                    // about 4 minutes in
  markSeen(p,'view');
  assert.equal(at({nearId:'lin'}),'talk');
  markSeen(p,'talk');
  assert.equal(at({fired:new Set(['talk'])}),'listen');
  markSeen(p,'listen');
  assert.equal(at({pos:homeAt}),'home');                                  // walking up to the house by the town gate
  markSeen(p,'home');
  assert.equal(at({fired:new Set(['enter:home'])}),'inside');
  markSeen(p,'inside');
  assert.equal(at({fired:new Set(['needs'])}),'needs');
  markSeen(p,'needs');
  assert.equal(at({nearId:'shop:fruit'}),'shops');
  markSeen(p,'shops');
  assert.equal(at({pos:{x:0,z:18}}),'park');
  markSeen(p,'park');
  assert.equal(at({nearId:'gate:market'}),'gates');
  markSeen(p,'gates');
});

test('near and at count only on the square, and door:home is not a shop',()=>{
  const p=skipOpening(runner());
  assert.equal(tip(p,{nearId:'lin',place:'home'}),null);
  assert.equal(tip(p,{pos:homeAt,place:'home'}),null);
  assert.equal(tip(p,{nearId:'door:homeware'}),null);
  assert.equal(tip(p,{nearId:'door:home'}),null);
});

test('doing a thing early marks its tip seen without showing it',()=>{
  const p=runner();
  assert.deepEqual(tipEvent(p,{},{type:'view'}),['view']);
  assert.equal(isSeen(p,'view'),true);
  assert.deepEqual(tipEvent(p,{},{type:'view'}),[]);
  assert.deepEqual(tipEvent(p,{},{type:'panel',id:'journal'}),[]);
  assert.deepEqual(tipEvent(p,{},{type:'panel',id:'wordbank'}),['bank']);
  assert.deepEqual(tipEvent(p,{},{type:'talk',id:'chen'}),[]);            // the talk tip is about 林阿姨
  assert.deepEqual(tipEvent(p,{},{type:'talk',id:'lin'}),['talk']);
  assert.deepEqual(tipEvent(p,{},{type:'enter',id:'home'}),['home']);
});

test('looking and walking add up until their amount',()=>{
  const p=runner(),progress={};
  assert.deepEqual(tipEvent(p,progress,{type:'look',amount:40}),[]);
  assert.deepEqual(tipEvent(p,progress,{type:'look',amount:50}),['look']);
  assert.deepEqual(tipEvent(p,progress,{type:'walk',amount:1}),[]);
  assert.deepEqual(tipEvent(p,progress,{type:'walk',amount:5}),['walk']);
  assert.deepEqual(tipEvent(newcomer(),{},{type:'view'}),[]);             // no tutorial, nothing to finish
});

test('every tip names when it shows; the ids are unique and there are 16',()=>{
  assert.equal(steps.length,16);
  assert.equal(new Set(ids).size,steps.length);
  for(const s of steps){
    assert.ok(Array.isArray(s.when)&&s.when.length,s.id);
    for(const w of s.when)assert.ok(['event','time','after','nearId','at'].some(k=>k in w),s.id);
  }
});

test('fillText uses the same coin rates as the review',()=>{
  assert.equal(fillText('+{anywhere} / +{desk} / +{hallNew}'),
    `+${cardCoins(null,false)} / +${cardCoins('desk',false)} / +${cardCoins('hall',true)}`);
  const coins=fillText(steps.find(s=>s.id==='coins').zh);
  assert.doesNotMatch(coins,/[{}]/);
  assert.equal(fillText('没有占位'),'没有占位');
});

test('an old saved tutorial is migrated; a malformed one is dropped quietly',()=>{
  const keep=t=>{const p=newcomer();p.tutorial=t;return decodeProfile(JSON.stringify(p)).tutorial;};
  assert.deepEqual(keep({seen:['look','walk']}),{seen:['look','walk']});
  assert.deepEqual(keep({seen:['look','nonsense','look']}),{seen:['look']});
  assert.deepEqual(keep({step:0,progress:0}),{seen:[]});
  assert.deepEqual(keep({step:3,progress:12}),{seen:ids.slice(0,3)});
  assert.deepEqual(keep({done:true}),{seen:ids});
  assert.equal(keep(undefined),undefined);
  for(const bad of [{step:-1,progress:0},{step:steps.length,progress:0},{step:1.5,progress:0},{step:'2',progress:0},
    {step:2,progress:-1},{step:2},{done:false},{done:'yes'},{seen:'look'},'look',7,[],null])
    assert.equal(keep(bad),undefined,JSON.stringify(bad));
  assert.equal(normalizeTutorial({seen:['look']}).seen.length,1);
  const old=newcomer();delete old.tutorial;
  assert.equal(decodeProfile(JSON.stringify(old)).wallet,0);
});

test('settings.tips and settings.mouse survive decoding; a bad value goes back to the default',()=>{
  const keep=(key,value)=>{const p=newcomer();p.settings[key]=value;return decodeProfile(JSON.stringify(p));};
  for(const mouse of['drag','lock'])assert.equal(keep('mouse',mouse).settings.mouse,mouse);
  assert.equal(keep('tips',false).settings.tips,false);
  assert.equal(keep('mouse','grab').settings.mouse,undefined);
  assert.equal(keep('tips','no').settings.tips,undefined);
  assert.equal(decodeProfile(JSON.stringify(newcomer())).settings.mouse,undefined);   // absent is the default, not damage
});
