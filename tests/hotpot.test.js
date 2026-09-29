import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newTable,pickBroth,placeOrder,payBill,billLines,billTotal,brothAffordable,menuOf,orderLabel} from '../src/core/hotpot.js';
import {addToCart,cartTotal} from '../src/core/cart.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';
import {say} from '../src/ui/order.js';

const catalog=JSON.parse(readFileSync(new URL('../src/content/catalog.json',import.meta.url)));
const hotpot=JSON.parse(readFileSync(new URL('../src/content/hotpot.json',import.meta.url)));
const price=id=>catalog.find(i=>i.id===id).price;
const guest=(wallet=200)=>({wallet,inventory:{},completed:[],claims:{},stats:{hunger:40,energy:80,hour:19},dayIndex:0});
const byCatalog=(a,b)=>catalog.findIndex(i=>i.id===a[0])-catalog.findIndex(i=>i.id===b[0]);
const rows=p=>billLines(p).map(l=>[l.item.id,l.quantity]);

test('every menu id is a hotpot catalog row, and every hotpot row is on the menu once',()=>{
  const listed=hotpot.categories.flatMap(c=>c.items);
  assert.equal(new Set(listed).size,listed.length);
  const ids=catalog.filter(i=>i.shop==='hotpot').map(i=>i.id).sort();
  assert.deepEqual([...listed].sort(),ids);
  assert.ok(menuOf('meat').every(item=>item.id.startsWith('hotpot-')&&item.measure));
  assert.ok(menuOf('broth').every(item=>/^#[0-9a-f]{6}$/i.test(item.color)),'each broth has its colour in the catalog');
});

test('ordering puts the basket on the bill kept in the save, charges nothing yet and feeds you',()=>{
  const p=guest(),t=newTable();
  pickBroth(t,'hotpot-broth-clear');pickBroth(t,'hotpot-broth-tomato');   // a second pick replaces the first
  addToCart(t.cart,'hotpot-feiniu',2);addToCart(t.cart,'hotpot-chemian');
  const placed=placeOrder(p,t);
  assert.equal(placed.ok,true);
  assert.equal(p.wallet,200);
  assert.equal(cartTotal(t.cart),0);
  assert.deepEqual(rows(p),[['hotpot-broth-tomato',1],['hotpot-feiniu',2],['hotpot-chemian',1]].sort(byCatalog));
  assert.deepEqual(p.hotpot,{'hotpot-broth-tomato':1,'hotpot-feiniu':2,'hotpot-chemian':1});
  assert.equal(placed.noodles,true);
  assert.ok(p.stats.hunger>40);
  // The bill belongs to the save, not to the table.
  assert.equal(billTotal(p),price('hotpot-broth-tomato')+2*price('hotpot-feiniu')+price('hotpot-chemian'));
});

test('the first round needs a broth, and a broth you cannot afford is not offered',()=>{
  const p=guest(),t=newTable();
  addToCart(t.cart,'hotpot-feiniu');
  assert.deepEqual(placeOrder(p,t),{ok:false,reason:'broth'});
  const poor=guest(25),broth=id=>catalog.find(i=>i.id===id);
  assert.equal(brothAffordable(poor,broth('hotpot-broth-clear')),true);        // 20
  assert.equal(brothAffordable(poor,broth('hotpot-broth-beef-tallow')),false); // 28
  poor.hotpot={'hotpot-mifan':3};                                              // 6 already owed
  assert.equal(brothAffordable(poor,broth('hotpot-broth-clear')),false);
});

test('the bill counts each item once, however many rounds it was ordered in',()=>{
  const p=guest(),t=newTable();
  pickBroth(t,'hotpot-broth-clear');addToCart(t.cart,'hotpot-maodu');placeOrder(p,t);
  addToCart(t.cart,'hotpot-maodu');addToCart(t.cart,'hotpot-mifan');placeOrder(p,t);
  assert.deepEqual(rows(p),[['hotpot-broth-clear',1],['hotpot-maodu',2],['hotpot-mifan',1]].sort(byCatalog));
  const total=price('hotpot-broth-clear')+2*price('hotpot-maodu')+price('hotpot-mifan');
  assert.deepEqual(payBill(p),{ok:true,total});
  assert.equal(p.wallet,200-total);
  assert.equal(p.hotpot,undefined);
  assert.deepEqual(payBill(p),{ok:false,reason:'empty'});   // paying again charges nothing
  assert.equal(p.wallet,200-total);
  assert.deepEqual(p.inventory,{});                          // eaten at the table, not bagged
});

test('an order you cannot pay for is refused and nothing is lost',()=>{
  const p=guest(30),t=newTable();
  pickBroth(t,'hotpot-broth-clear');addToCart(t.cart,'hotpot-feiniu');   // 20 + 18 > 30
  const hunger=p.stats.hunger;
  assert.deepEqual(placeOrder(p,t),{ok:false,reason:'short'});
  assert.equal(cartTotal(t.cart),38);
  assert.equal(billLines(p).length,0);
  assert.equal(p.stats.hunger,hunger);
  assert.equal(p.wallet,30);
  // A bill that has grown past the wallet (a save edited by hand) cannot be paid, and stays.
  const q=guest(100),u=newTable();
  pickBroth(u,'hotpot-broth-clear');placeOrder(q,u);q.wallet=5;
  assert.deepEqual(payBill(q),{ok:false,reason:'short'});
  assert.equal(q.wallet,5);
  assert.equal(billLines(q).length,1);
  assert.deepEqual(placeOrder(q,newTable()),{ok:false,reason:'empty'});
});

test('an open bill survives a save round trip, and junk in it is dropped',()=>{
  const p=freshProfile();p.hotpot={'hotpot-feiniu':2,'hotpot-mifan':1};
  assert.deepEqual(decodeProfile(JSON.stringify(p)).hotpot,{'hotpot-feiniu':2,'hotpot-mifan':1});
  p.hotpot={'hotpot-feiniu':-1,'bad id!':2,'hotpot-mifan':1.5};
  assert.equal(decodeProfile(JSON.stringify(p)).hotpot,undefined);
  assert.equal(decodeProfile(JSON.stringify(freshProfile())).hotpot,undefined);
});

test('an order line says its number and measure word',()=>{
  assert.equal(orderLabel(catalog.find(i=>i.id==='hotpot-mifan'),1),'一碗米饭');
  assert.equal(orderLabel(catalog.find(i=>i.id==='hotpot-feiniu'),2),'两份肥牛');
});

test('a line sequence stops when its panel closes, and plays on outside a panel',async()=>{
  const played=[],panel={hidden:false};
  const ctx={voice:{available:()=>true,play:id=>{played.push(id);if(id==='a')panel.hidden=true;return Promise.resolve();},foreground:null}};
  await say(ctx,{isConnected:true,closest:()=>panel},['a','b']);
  assert.deepEqual(played,['a']);
  played.length=0;
  await say(ctx,{isConnected:true,closest:()=>null},['a','b']);   // the metro's announcements live outside the panel
  assert.deepEqual(played,['a','b']);
});

test('F on a dish at the table saves its name with the dish clip, like a sign phrase',async()=>{
  const {collectLook,knowsLook}=await import('../src/core/bank.js');
  const p=freshProfile(),item=catalog.find(i=>i.id==='hotpot-maodu');
  const name={id:'food:'+item.id,zh:item.zh,pinyin:item.pinyin,en:item.en,sign:true,audio:item.audio};
  assert.deepEqual(collectLook(p,name),{clip:'shop-hotpot-maodu',isNew:true});
  assert.equal(p.saved.find(w=>w.zh==='毛肚')?.audio,'shop-hotpot-maodu');
  assert.deepEqual(p.discovered,[]);                         // a dish is a word, not one more named object
  assert.equal(knowsLook(p,name),true);
});
