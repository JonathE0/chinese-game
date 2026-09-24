import test from 'node:test';
import assert from 'node:assert/strict';
import tutorial from '../src/content/tutorial.json' with {type:'json'};
import {shouldAutoStart,startTutorial,tutorialEvent,nextStep,skipTutorial,currentStep,fillText} from '../src/core/tutorial.js';
import {cardCoins} from '../src/core/review.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';

const steps=tutorial.steps;
const indexOf=id=>steps.findIndex(s=>s.id===id);
/** A brand-new save as the game has it by the time 开始旅行 is pressed. */
const newcomer=()=>{const p=freshProfile();p.completed.push('home:starter');return p;};
const at=(p,id)=>{p.tutorial={step:indexOf(id),progress:0};return p;};

test('the tutorial starts on its own only for a brand-new save',()=>{
  assert.equal(shouldAutoStart(newcomer()),true);
  assert.equal(shouldAutoStart(freshProfile()),true);
  const flagged=newcomer();flagged.completed.push('practice:first');
  assert.equal(shouldAutoStart(flagged),false);
  const seeded=newcomer();seeded.completed.push('home:tutorial');
  assert.equal(shouldAutoStart(seeded),false);
  const looked=newcomer();looked.discovered.push('bench');
  assert.equal(shouldAutoStart(looked),false);
  const studied=newcomer();studied.words.hello={recognition:{stage:1,due:0,last:0,reviews:1}};
  assert.equal(shouldAutoStart(studied),false);
  const finished=newcomer();finished.tutorial={done:true};
  assert.equal(shouldAutoStart(finished),false);
  const running=newcomer();running.tutorial={step:3,progress:0};
  assert.equal(shouldAutoStart(running),false);
});

test('starting puts the player on the first step',()=>{
  const p=newcomer();startTutorial(p);
  assert.deepEqual(p.tutorial,{step:0,progress:0});
  assert.equal(currentStep(p).id,'look');
  p.tutorial={done:true};startTutorial(p);            // Settings replays it
  assert.deepEqual(p.tutorial,{step:0,progress:0});
});

test('looking around accumulates until 90 degrees',()=>{
  const p=newcomer();startTutorial(p);
  assert.equal(tutorialEvent(p,{type:'look',amount:40}),'progress');
  assert.equal(p.tutorial.progress,40);
  assert.equal(tutorialEvent(p,{type:'walk',amount:40}),null);  // the wrong kind of event
  assert.equal(tutorialEvent(p,{type:'look',amount:45}),'progress');
  assert.equal(currentStep(p).id,'look');
  assert.equal(tutorialEvent(p,{type:'look',amount:5}),'advanced');
  assert.deepEqual(p.tutorial,{step:indexOf('walk'),progress:0});
});

test('an event without an amount counts once',()=>{
  const p=at(newcomer(),'view');
  assert.equal(tutorialEvent(p,{type:'view'}),'advanced');
  assert.equal(currentStep(p).id,'word');
});

test('a step for one person ignores everyone else',()=>{
  const p=at(newcomer(),'talk');
  assert.equal(tutorialEvent(p,{type:'talk',id:'chen'}),null);
  assert.equal(currentStep(p).id,'talk');
  assert.equal(p.tutorial.progress,0);
  assert.equal(tutorialEvent(p,{type:'talk',id:'lin'}),'advanced');
  assert.equal(currentStep(p).id,'home');
  const bank=at(newcomer(),'bank');
  assert.equal(tutorialEvent(bank,{type:'panel',id:'journal'}),null);
  assert.equal(tutorialEvent(bank,{type:'panel',id:'wordbank'}),'advanced');
});

test('an information step waits for 下一步 and ignores events',()=>{
  const p=at(newcomer(),'coins');
  for(const type of ['look','walk','view','collect','panel','route','talk','enter',undefined])
    assert.equal(tutorialEvent(p,{type,id:'lin',amount:999}),null);
  assert.deepEqual(p.tutorial,{step:indexOf('coins'),progress:0});
  nextStep(p);
  assert.equal(currentStep(p).id,'missions');
});

test('下一步 moves on even from a step that finishes itself, and the last one finishes',()=>{
  const p=newcomer();startTutorial(p);
  p.tutorial.progress=30;
  nextStep(p);
  assert.deepEqual(p.tutorial,{step:1,progress:0});
  at(p,'done');
  assert.equal(currentStep(p).id,'done');
  nextStep(p);
  assert.deepEqual(p.tutorial,{done:true});
  assert.equal(currentStep(p),null);
  assert.equal(tutorialEvent(p,{type:'look',amount:90}),null);
});

test('finishing the last self-finishing step still lands on the next one, and skipping ends it',()=>{
  const p=newcomer();startTutorial(p);
  for(let i=0;i<steps.length;i++)nextStep(p);
  assert.deepEqual(p.tutorial,{done:true});
  const q=at(newcomer(),'walk');q.tutorial.progress=3;
  skipTutorial(q);
  assert.deepEqual(q.tutorial,{done:true});
  assert.equal(currentStep(q),null);
  assert.equal(currentStep(freshProfile()),null);
});

test('fillText uses the same coin rates as the review',()=>{
  assert.equal(fillText('+{anywhere} / +{desk} / +{hallNew}'),
    `+${cardCoins(null,false)} / +${cardCoins('desk',false)} / +${cardCoins('hall',true)}`);
  const coins=fillText(steps[indexOf('coins')].zh);
  assert.doesNotMatch(coins,/[{}]/);
  assert.match(coins,new RegExp(`\\+${cardCoins('hall',true)}`));
  assert.equal(fillText('没有占位'),'没有占位');
});

test('every step that finishes itself names an event, and the ids are unique',()=>{
  const events=['look','walk','view','collect','panel','route','talk','enter'];
  assert.equal(steps.length,16);
  assert.equal(new Set(steps.map(s=>s.id)).size,steps.length);
  for(const s of steps)if(s.done)assert.ok(events.includes(s.done.event),s.id);
});

test('a saved tutorial survives decoding; a malformed one is dropped quietly',()=>{
  const keep=(tutorialState)=>{const p=newcomer();p.tutorial=tutorialState;return decodeProfile(JSON.stringify(p)).tutorial;};
  assert.deepEqual(keep({step:4,progress:2.5}),{step:4,progress:2.5});
  assert.deepEqual(keep({step:0,progress:0}),{step:0,progress:0});
  assert.deepEqual(keep({done:true}),{done:true});
  assert.equal(keep(undefined),undefined);
  for(const bad of [{step:-1,progress:0},{step:steps.length,progress:0},{step:1.5,progress:0},{step:'2',progress:0},
    {step:2,progress:-1},{step:2},{done:false},{done:'yes'},'look',7,[],null])
    assert.equal(keep(bad),undefined,JSON.stringify(bad));
  // Old saves have no tutorial at all and still load.
  const old=newcomer();delete old.tutorial;
  assert.equal(decodeProfile(JSON.stringify(old)).wallet,0);
});
