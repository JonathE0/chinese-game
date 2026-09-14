import test from 'node:test';
import assert from 'node:assert/strict';
import {AmbientConversations,chooseSmalltalk} from '../src/core/social.js';

const lines=[{id:'a',exchange:'walk'},{id:'b',exchange:'walk'},{id:'c',exchange:'tea'},{id:'d',exchange:'tea'},{id:'e',exchange:'book'},{id:'f',exchange:'book'}];
test('ambient pairs stay together with long pauses and no repeated exchange in a cycle',()=>{
 const a=new AmbientConversations(lines,()=>0),heard=[];
 assert.equal(a.update(0,true),null);
 for(let t=0;t<400;t++) {const line=a.update(t,true);if(line)heard.push({id:line.id,t});}
 assert.ok(heard.length>=6);
 assert.equal(new Set(heard.slice(0,6).map(x=>x.id)).size,6);
 for(let i=0;i<6;i+=2){assert.equal(lines.find(l=>l.id===heard[i].id).exchange,lines.find(l=>l.id===heard[i+1].id).exchange);if(i>0)assert.ok(heard[i].t-heard[i-1].t>=45);}
});
test('leaving the square or opening a panel cancels the reply and delays new speech',()=>{
 const a=new AmbientConversations(lines,()=>0);
 a.update(0,true);assert.ok(a.update(20,true));
 assert.equal(a.update(21,false),null);
 assert.equal(a.update(22,true),null);
 assert.equal(a.update(30,true),null);
 assert.ok(a.update(67,true));
});
test('longer conversations use learned topic words, have a cooldown, and vary',()=>{
 const topics=[{id:'tea',requires:['茶']},{id:'book',requires:['书']}];
 const p={saved:[{id:'b',zh:'茶'}],words:{b:{recognition:{stage:3}}}};
 const state={};
 assert.equal(chooseSmalltalk(p,topics,state,0,()=>.9),null);
 assert.equal(chooseSmalltalk(p,topics,state,0,()=>0).id,'tea');
 assert.equal(chooseSmalltalk(p,topics,state,10,()=>0),null);
 assert.equal(chooseSmalltalk({words:{},saved:[]},topics,{},0,()=>0),null);
});
