import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateNode,choicesFor,applyState,completeLesson} from '../src/core/conversation.js';
import {freshProfile} from '../src/core/profile.js';

test('option nodes match through the same normaliser as curated variants, punctuation included',()=>{
  const node={intent:'option',store:'dish',options:[
    {value:'beef',choice:'我要一碗牛肉面。',accepted:['我要一碗牛肉面','牛肉面']},
    {value:'egg',choice:'我要一碗鸡蛋面。',accepted:['我要一碗鸡蛋面','鸡蛋面']},
  ]};
  assert.deepEqual(evaluateNode(node,'牛肉面！'),{ok:true,value:'beef',choice:'我要一碗牛肉面。'});
  assert.deepEqual(evaluateNode(node,'我要一碗鸡蛋面。'),{ok:true,value:'egg',choice:'我要一碗鸡蛋面。'});
  assert.equal(evaluateNode(node,'我要米饭').ok,false);
});
test('none nodes take no input and always advance',()=>{
  const node={intent:'none'};
  assert.equal(evaluateNode(node).ok,true);
  assert.equal(evaluateNode(node,'anything at all').ok,true);
});
test('name and variants intents still match exactly as before, unaffected by the new intents',()=>{
  assert.equal(evaluateNode({intent:'name'},'我叫安娜。').ok,true);
  assert.equal(evaluateNode({intent:'name'},'我不叫安娜').ok,false);
  const node={intent:'variants',accepted:['你好','您好']};
  assert.equal(evaluateNode(node,'您好！').ok,true);
  assert.equal(evaluateNode(node,'不好').ok,false);
});
test('choicesFor reads each option\'s own choice when a node has no flat choices list',()=>{
  const node={intent:'option',options:[{value:'a',choice:'A'},{value:'b',choice:'B'}]};
  assert.deepEqual(choicesFor(node),['A','B']);
  assert.deepEqual(choicesFor({intent:'variants',choices:['x','y']}),['x','y']);
  assert.deepEqual(choicesFor({intent:'none'}),[]);
});
test('a matched option is saved under its store key; every other intent leaves state untouched',()=>{
  const node={intent:'option',store:'size',options:[]};
  assert.deepEqual(applyState({},node,{ok:true,value:'large'}),{size:'large'});
  assert.deepEqual(applyState({size:'large'},{intent:'none'},{ok:true}),{size:'large'});
  assert.deepEqual(applyState({size:'large'},{intent:'option',store:undefined},{ok:true,value:'x'}),{size:'large'});
});
test('completing a lesson pays out once; repeat completions call in but earn nothing further',()=>{
  const p=freshProfile();
  const first=completeLesson(p,'city-noodles',10);
  assert.equal(first.amount,10);
  assert.equal(first.firstTime,true);
  assert.equal(p.wallet,10);
  assert.deepEqual(p.completed,['city-noodles']);
  const second=completeLesson(p,'city-noodles',10);
  assert.equal(second.amount,0);
  assert.equal(second.firstTime,false);
  assert.equal(p.wallet,10);
  assert.deepEqual(p.completed,['city-noodles']);
});

test('a close hook runs once however the panel closes, and closing before it is armed runs nothing',async()=>{
  const {closeHook}=await import('../src/core/conversation.js');
  const hook=closeHook();let runs=0;
  hook.run();                                         // closed before the conversation completed
  assert.equal(runs,0);
  hook.arm(()=>runs++);
  assert.equal(hook.armed,true);
  hook.run();hook.run();                              // Esc and then a stray button, say
  assert.equal(runs,1);
  assert.equal(hook.armed,false);
  hook.arm(()=>runs++);hook.arm(undefined);           // a new panel with no hook replaces the old one
  hook.run();
  assert.equal(runs,1);
});

test('finishing a conversation pays and saves first, then runs onFinish once when the panel closes',async()=>{
  const {closeHook,finishConversation}=await import('../src/core/conversation.js');
  const p=freshProfile();const hook=closeHook();const seen=[];
  const onFinish=state=>seen.push(state);
  const first=finishConversation(p,'city-noodles',5,{hook,state:{dish:'beef'},onFinish});
  assert.equal(first.amount,5);
  assert.ok(p.completed.includes('city-noodles'));
  assert.deepEqual(seen,[]);                          // nothing runs until the panel closes
  hook.run();hook.run();
  assert.deepEqual(seen,[{dish:'beef'}]);

  // A repeat completion runs onFinish again, once, with no second reward.
  const again=finishConversation(p,'city-noodles',5,{hook,state:{dish:'egg'},onFinish});
  assert.equal(again.amount,0);
  hook.run();
  assert.deepEqual(seen,[{dish:'beef'},{dish:'egg'}]);
  assert.equal(p.completed.filter(f=>f==='city-noodles').length,1);
});
