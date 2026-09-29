import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY_ACTIONS,label,sanitiseKeys,rebind,readKeysFrom,codeOf,isKey,keyLabel,fillKeys} from '../src/core/keys.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';

test('every action has its default key and the defaults never clash',()=>{
  const map=Object.fromEntries(KEY_ACTIONS.map(a=>[a.id,a.key]));
  assert.deepEqual(map,{forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',jump:'Space',interact:'KeyE',collect:'KeyF',view:'KeyV',labels:'KeyH',drop:'KeyG',rotate:'KeyR',cancel:'KeyX',journal:'Digit1',inventory:'Digit2',wordbank:'Digit3',status:'Digit4',settings:'Digit5'});
  assert.equal(new Set(Object.values(map)).size,KEY_ACTIONS.length);
});

test('labels are short and readable',()=>{
  assert.equal(label('KeyQ'),'Q');assert.equal(label('Digit7'),'7');assert.equal(label('Numpad3'),'3');
  assert.equal(label('Space'),'Space');assert.deepEqual(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].map(label),['↑','↓','←','→']);
  assert.equal(label('Semicolon'),'Semicolon');
});

test('events are read through the bindings, with numpad digits counting as digits',()=>{
  let keys;readKeysFrom(()=>keys);
  assert.equal(isKey({code:'KeyE'},'interact'),true);
  assert.equal(isKey({code:'Numpad4'},'status'),true);
  keys={interact:'KeyQ'};
  assert.equal(isKey({code:'KeyE'},'interact'),false);
  assert.equal(isKey({code:'KeyQ'},'interact'),true);
  assert.equal(codeOf('collect'),'KeyF');
  assert.equal(keyLabel('interact'),'Q');
  assert.equal(fillKeys('按 {interact} 进去，按 {collect} 记住。{desk}'),'按 Q 进去，按 F 记住。{desk}');
  readKeysFrom(()=>undefined);
});

test('the sanitiser keeps only sound, changed, non-clashing bindings',()=>{
  assert.deepEqual(sanitiseKeys(undefined),{});
  assert.deepEqual(sanitiseKeys([1]),{});
  assert.deepEqual(sanitiseKeys({interact:'KeyQ'}),{interact:'KeyQ'});
  assert.deepEqual(sanitiseKeys({fly:'KeyQ',interact:'KeyE'}),{},'unknown actions and defaults go');
  assert.deepEqual(sanitiseKeys({interact:'Key Q',collect:'<b>',view:7}),{},'only plain letters and digits');
  for(const code of ['Escape','Tab','MetaLeft','ContextMenu','ArrowUp'])assert.deepEqual(sanitiseKeys({interact:code}),{},code+' is reserved');
  assert.deepEqual(sanitiseKeys({collect:'KeyQ',interact:'KeyQ'}),{interact:'KeyQ'},'the later action (in panel order) goes');
  assert.deepEqual(sanitiseKeys({interact:'KeyF'}),{},'nor may it take a key another action still has');
  assert.deepEqual(sanitiseKeys({interact:'KeyF',collect:'KeyE'}),{interact:'KeyF',collect:'KeyE'},'a swap is fine');
  assert.deepEqual(sanitiseKeys({collect:'KeyE',interact:'KeyE'}),{},'dropping one may undo the other');
});

test('rebinding swaps a key another action had, and refuses reserved keys',()=>{
  assert.deepEqual(rebind({},'interact','KeyQ'),{keys:{interact:'KeyQ'},swapped:null});
  assert.deepEqual(rebind({},'interact','KeyF'),{keys:{interact:'KeyF',collect:'KeyE'},swapped:'collect'});
  assert.deepEqual(rebind({interact:'KeyF',collect:'KeyE'},'interact','KeyE'),{keys:{},swapped:'collect'},'back to defaults stores nothing');
  assert.deepEqual(rebind({},'status','Numpad9'),{keys:{status:'Digit9'},swapped:null});
  assert.deepEqual(rebind({},'interact','Escape'),{reserved:true});
  assert.deepEqual(rebind({},'interact',''),{reserved:true});
});

test('saves keep their key bindings, and old saves load unchanged',()=>{
  const p=freshProfile();p.settings.keys={interact:'KeyQ'};
  assert.deepEqual(decodeProfile(JSON.stringify(p)).settings.keys,{interact:'KeyQ'});
  p.settings.keys={interact:'Escape',fly:'KeyZ'};
  assert.equal(decodeProfile(JSON.stringify(p)).settings.keys,undefined);
  assert.equal('keys' in decodeProfile(JSON.stringify(freshProfile())).settings,false);
});

test('tutorial and mission text name keys by action, and every placeholder fills',async()=>{
  const {STEPS,fillText}=await import('../src/core/tutorial.js');
  const quests=(await import('../src/content/quests.json',{with:{type:'json'}})).default.quests;
  const text=[...STEPS.flatMap(s=>[s.zh,s.pinyin,s.en].map(fillText)),...quests.map(q=>fillKeys(q.en))];
  assert.deepEqual(text.filter(t=>/[{}]/.test(t)),[]);
  assert.ok(STEPS.some(s=>s.zh.includes('{interact}')));
  assert.ok(text.some(t=>t.includes('按 E ')),'defaults show when nothing is rebound');
});

test('modifier and browser keys cannot be bound; Shift stays the sprint key',()=>{
  for(const code of ['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','CapsLock','MetaRight','F1','F5','F12']){
    assert.deepEqual(rebind({},'interact',code),{reserved:true},code);
    assert.deepEqual(sanitiseKeys({interact:code}),{},code);
  }
  assert.deepEqual(rebind({},'interact','KeyF'),{keys:{interact:'KeyF',collect:'KeyE'},swapped:'collect'},'letters are still fine');
});

test('bindings saved out of list order are not taken for damage',()=>{
  const p=freshProfile();
  p.settings.keys=rebind(rebind({},'collect','KeyZ').keys,'interact','KeyQ').keys;
  assert.deepEqual(Object.keys(p.settings.keys),['collect','interact']);
  const repairs=[];
  const loaded=decodeProfile(JSON.stringify(p),repairs);
  assert.deepEqual(repairs,[]);
  assert.deepEqual(loaded.settings.keys,{interact:'KeyQ',collect:'KeyZ'});
});

test('mission Chinese can name a key too',async()=>{
  const quests=(await import('../src/content/quests.json',{with:{type:'json'}})).default.quests;
  assert.deepEqual(quests.flatMap(q=>[q.zh,q.pinyin,q.en]).map(fillKeys).filter(t=>/\{\w+\}/.test(t)),[]);
  // The mission card and its route notice fill the Chinese as well as the English.
  const shell=(await import('node:fs')).readFileSync(new URL('../src/ui/shell.js',import.meta.url),'utf8');
  assert.equal(shell.match(/\bquest\.zh\b/g).length,shell.match(/fillKeys\(quest\.zh\)/g)?.length);
});
