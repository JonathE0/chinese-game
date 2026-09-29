import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile,decodeProfile} from '../src/core/profile.js';
import {openAt,sessionDay,claimPeriod,periodClaimed,periodsSince,calendarOf} from '../src/core/calendar.js';
import {newCart,addToCart,setQuantity,cartLines,cartTotal,cartCount,cartProblem,checkout,clearCart} from '../src/core/cart.js';
import {surfaceHeight,offersSurface,canStack,fitsOn,decorOn,isAssembly,placementProblem,hangsOnWall} from '../src/core/surfaces.js';
import {Toybox,Container} from '../src/world/physics.js';
import {deposit,withdraw,savingsOf,interestOn,balanceForCap,INTEREST_CAP,
  permitById,permitTotal,buyPermit,holdsPermit,permitPlan,settleWeeks} from '../src/core/finance.js';
import {readiness,shelves,allStories,finishStory,hasRead} from '../src/core/reading.js';
import {addWord,collectLook,knowsLook} from '../src/core/bank.js';
import {sanitizeDictionaryEntry} from '../src/content/dictionary-policy.js';
import {siteById,siteState,completion,contribute,raise,isBuilt,progressOf,builtSites,collectIncome} from '../src/core/construction.js';

// A stand-in for the collision registry: one solid slab of floor and one wall.
const flatWorld=()=>({
  groundAt:()=>0,
  blocks:(place,x)=>x>4,
});
const fakeModels=()=>({shape:()=>({destroy(){},setLocalPosition(){},setLocalEulerAngles(){}})});

test('a schedule that runs past midnight is open on both sides of it', () => {
  const night={from:18,to:2};
  for(const hour of [18,20,23.9,0,1.9]) assert.equal(openAt(night,hour),true,String(hour));
  for(const hour of [2,3,12,17.9]) assert.equal(openAt(night,hour),false,String(hour));
  // A daytime schedule does not wrap.
  assert.equal(openAt({from:9,to:17},12),true);
  assert.equal(openAt({from:9,to:17},2),false);
  // One in the morning still belongs to the night before, so a session is one session.
  assert.equal(sessionDay(night,{day:5,hour:23}),5);
  assert.equal(sessionDay(night,{day:6,hour:1}),5);
});

test('a period pays out once however many frames ask for it', () => {
  const p=freshProfile();
  assert.equal(claimPeriod(p,'interest',3),true);
  for(let i=0;i<50;i++) assert.equal(claimPeriod(p,'interest',3),false);
  assert.equal(periodClaimed(p,'interest',3),true);
  assert.equal(periodClaimed(p,'interest',4),false);
  assert.equal(claimPeriod(p,'rent',3),true);          // different kinds are independent
  // Time away is capped, so a save left for a month cannot pay a month at once.
  assert.equal(periodsSince(2,5),3);
  assert.equal(periodsSince(2,900),14);
  assert.equal(periodsSince(9,4),0);
  assert.deepEqual(calendarOf({dayIndex:9,clock:8}),{day:9,hour:8,week:1,dayOfWeek:2});
});

test('a cart prices a whole basket and pays for it in one transaction', () => {
  const p=freshProfile(); p.wallet=40;
  const cart=newCart('bakery');
  addToCart(cart,'egg-tart');addToCart(cart,'egg-tart');addToCart(cart,'red-bean-bun');
  assert.equal(cartCount(cart),3);
  assert.equal(cartTotal(cart),6*2+5);
  // Rows follow catalog order, so the list does not reshuffle as you add things.
  assert.deepEqual(cartLines(cart).map(l=>[l.item.id,l.quantity]),[['egg-tart',2],['red-bean-bun',1]]);

  setQuantity(cart,'egg-tart',0);
  assert.equal(cartCount(cart),1);
  addToCart(cart,'egg-tart',3);
  assert.equal(cartTotal(cart),5+18);

  const paid=checkout(p,cart);
  assert.equal(paid.ok,true);
  assert.equal(paid.total,23);
  assert.equal(p.wallet,17);
  assert.equal(p.inventory['egg-tart'],3);
  assert.equal(cartCount(cart),0);                     // the basket empties on the way out
});

test('a basket you cannot afford moves nothing at all', () => {
  const p=freshProfile(); p.wallet=5;
  const cart=newCart('bakery');
  addToCart(cart,'strawberry-donut',3);
  assert.equal(cartProblem(p,cart),'funds');
  assert.equal(checkout(p,cart).ok,false);
  assert.equal(p.wallet,5);
  assert.deepEqual(p.inventory,{});
  assert.equal(cartCount(cart),3);                     // and the basket is still there to edit
  assert.equal(cartProblem(p,clearCart(cart)),'empty');
  // A haggled item is never a cart line: that price belongs to the conversation.
  addToCart(cart,'travel-hat');
  assert.equal(cartCount(cart),0);
});

test('small decor stands on tables and shelves, and never on the bed', () => {
  assert.equal(offersSurface('table'),true);
  assert.equal(offersSurface('desk'),true);
  assert.equal(offersSurface('bed'),false);
  assert.equal(surfaceHeight('dresser'),1.17);
  assert.equal(canStack('teaset'),true);
  assert.equal(canStack('wardrobe'),false);

  assert.equal(placementProblem('teaset',null),null);                      // the floor is fine
  assert.equal(placementProblem('teaset',{kind:'bed'}).zh,'不能放在床上');
  assert.equal(placementProblem('teaset',{kind:'wardrobe'}).zh,'这上面放不了');
  assert.equal(placementProblem('bed',{kind:'table'}).zh,'这里已经有东西了');

  const table={kind:'table',footprint:[1.5,1.0],rot:0,uid:'t1'};
  assert.equal(fitsOn(table,{footprint:[.65,.45],x:0,z:0}),true);
  assert.equal(fitsOn(table,{footprint:[1.6,.45],x:0,z:0}),false);          // too big for the top
  assert.equal(fitsOn({kind:'bed',footprint:[2,1.4],rot:0},{footprint:[.3,.3],x:0,z:0}),false);
  // Two things share a table only if they are not in the same spot.
  const lamp={uid:'a',footprint:[.5,.5],x:.4,z:0};
  assert.equal(fitsOn(table,{uid:'b',footprint:[.5,.5],x:-.5,z:0},[lamp]),true);
  assert.equal(fitsOn(table,{uid:'b',footprint:[.5,.5],x:.45,z:0},[lamp]),false);
});

test('decor records point at the furniture they stand on', () => {
  const home=[{uid:'t1',item:'low-table',kind:'table'},
              {uid:'l1',item:'desk-lamp',kind:'desklamp',on:'t1'},
              {uid:'s1',item:'tea-set',kind:'teaset',on:'t1'},
              {uid:'b1',item:'wooden-bed',kind:'bed'}];
  assert.deepEqual(decorOn(home,'t1').map(r=>r.uid),['l1','s1']);
  assert.equal(isAssembly(home,'t1'),true);
  assert.equal(isAssembly(home,'b1'),false);
  // The link survives a save round trip.
  const p=freshProfile();
  p.home=[{uid:'t1',item:'low-table',kind:'table',color:'#c2a883',footprint:[1.5,1],x:0,z:0,rot:0},
          {uid:'l1',item:'desk-lamp',kind:'desklamp',color:'#f7e7bb',footprint:[.5,.5],x:0,z:0,rot:0,on:'t1'}];
  assert.equal(decodeProfile(JSON.stringify(p)).home[1].on,'t1');
});

test('a thrown object falls, bounces off a wall and finally settles', () => {
  const toys=new Toybox({registry:flatWorld(),models:fakeModels()});
  const body=toys.spawn({parent:null,place:'town',size:[.3,.3,.3],x:0,y:1.5,z:0});
  toys.take(body);
  assert.equal(toys.held,body);
  toys.hurl({fx:1,fy:0,fz:0},9);
  assert.equal(toys.held,null);
  assert.ok(body.vx>0&&body.vy>0);                     // thrown flat still arcs upward

  for(let i=0;i<60;i++)toys.update(1/60,'town');
  assert.ok(body.x>0,'it travelled');
  assert.ok(body.x<=4.4,'the wall turned it back');
  for(let i=0;i<600;i++)toys.update(1/60,'town');
  assert.ok(body.rest>0,'it came to rest');
  assert.ok(Math.abs(body.y-body.radius)<.05,'resting on the floor');
});

test('the toybox never grows without bound and tidies a place on the way out', () => {
  const toys=new Toybox({registry:flatWorld(),models:fakeModels()});
  for(let i=0;i<40;i++)toys.spawn({parent:null,place:'town',x:i,y:1,z:0});
  assert.equal(toys.count,12);
  toys.spawn({parent:null,place:'cafe',x:0,y:1,z:0});
  toys.clear('town');
  assert.equal(toys.count,1);
  assert.equal(toys.in('cafe').length,1);
});

test('a container gives one piece up and quietly puts it back later', () => {
  const slot=()=>({filled:true,back:0,entity:{enabled:true}});
  const container=new Container({place:'town',slots:[slot(),slot()],refill:10});
  const taken=container.take(container.ready(),100);
  assert.equal(taken.filled,false);
  assert.equal(taken.entity.enabled,false);
  assert.equal(container.slots.filter(s=>s.filled).length,1);

  container.tick(105);
  assert.equal(taken.filled,false,'not back before its time');
  container.tick(111);
  assert.equal(taken.filled,true);
  assert.equal(taken.entity.enabled,true);

  container.take(container.ready(),200);
  container.reset();
  assert.equal(container.slots.every(s=>s.filled&&s.entity.enabled),true);
});

test('savings pay a capped, non-compounding return that cannot outrun playing', () => {
  const p=freshProfile(); p.wallet=100;
  assert.equal(deposit(p,60).ok,true);
  assert.equal(p.wallet,40);
  assert.equal(savingsOf(p),60);
  assert.equal(deposit(p,9999).moved,40);              // never more than the wallet holds
  assert.equal(withdraw(p,25).moved,25);
  assert.equal(savingsOf(p),75);
  assert.equal(withdraw(p,9999).moved,75);
  assert.equal(withdraw(p,10).ok,false);

  // The curve: linear in the balance, then flat.
  assert.equal(interestOn(0),0);
  assert.equal(interestOn(19),0);                      // below the floor it rounds to nothing
  assert.equal(interestOn(100),2);
  assert.equal(interestOn(600),12);
  assert.equal(interestOn(balanceForCap()),INTEREST_CAP);
  assert.equal(interestOn(100000),INTEREST_CAP);       // no amount of money beats the cap

  // Even re-depositing every payout, thirty days does not run away.
  let balance=1000;
  for(let day=0;day<30;day++) balance+=interestOn(balance);
  assert.ok(balance<1800,`thirty days of compounding reached ${balance}`);
});

test('interest is paid once a day however many times the frame asks', () => {
  const p=freshProfile(); p.wallet=500; deposit(p,500);
  let paid=0;
  for(let frame=0;frame<200;frame++)
    if(claimPeriod(p,'interest',7)) paid+=interestOn(savingsOf(p));
  assert.equal(paid,10);
  assert.equal(claimPeriod(p,'interest',8),true);      // tomorrow is a new claim
});

test('a permit is either paid for at once or billed weekly, and only bought once', () => {
  const p=freshProfile(); p.wallet=300;
  const permit=permitById('shop');
  assert.equal(permitTotal(permit,'lump'),240);
  assert.equal(permitTotal(permit,'weekly'),288);      // the surcharge for spreading it

  assert.equal(buyPermit(p,permit,'lump',0).ok,true);
  assert.equal(p.wallet,60);
  assert.equal(holdsPermit(p,'shop'),true);
  assert.equal(buyPermit(p,permit,'lump',0).ok,false); // never twice

  const q=freshProfile(); q.wallet=100;
  assert.equal(buyPermit(q,permit,'weekly',0).ok,true);
  assert.equal(q.wallet,28);                           // first of four instalments taken now
  assert.equal(holdsPermit(q,'shop'),true);            // you get the permit immediately
  assert.equal(permitPlan(q,'shop').owed,216);

  q.wallet=500;
  settleWeeks(q,1);
  assert.equal(permitPlan(q,'shop').owed,144);
  settleWeeks(q,9);                                    // catch up everything still owed
  assert.equal(permitPlan(q,'shop'),null);
  assert.equal(q.wallet,500-216);

  // A week you cannot cover is missed, not silently forgiven.
  const r=freshProfile(); r.wallet=100;
  buyPermit(r,permit,'weekly',0);
  r.wallet=0;
  const events=settleWeeks(r,1);
  assert.equal(events[0].missed,true);
  assert.equal(permitPlan(r,'shop').owed,216);
});

test('an instalment falls back to savings when the wallet is short', () => {
  const p=freshProfile(); p.wallet=100;
  buyPermit(p,permitById('shop'),'weekly',0);
  p.wallet=10; deposit(p,10); p.wallet=0;
  p.savings={balance:200};
  settleWeeks(p,1);
  assert.equal(savingsOf(p),200-72);
  assert.equal(p.wallet,0);
});

test('the reading gate counts words you have shown you know, from anywhere', () => {
  const p=freshProfile();
  const story=allStories().find(s=>s.id==='morning');
  const cold=readiness(p,story);
  assert.equal(cold.known,0);
  assert.equal(cold.state,'locked');
  assert.equal(cold.readable,false);
  assert.equal(cold.missing.length,story.words.length);

  // Words arrive from the bank, from naming things in the town, and from the word hall.
  for(const zh of story.words.slice(0,6)) addWord(p,{zh,pinyin:'',en:''});
  const some=readiness(p,story);
  assert.equal(some.known,6);
  assert.equal(some.state,'stretch');
  assert.equal(some.readable,true);

  for(const zh of story.words.slice(6)) addWord(p,{zh,pinyin:'',en:''});
  assert.equal(readiness(p,story).state,'comfortable');

  // An HSK word answered correctly counts too.
  const q=freshProfile();
  const hsk=story.words.map((zh,i)=>({id:'w'+i,zh}));
  for(const word of hsk) q.words[word.id]={recognition:{stage:1,due:0,last:0,reviews:1}};
  assert.equal(readiness(q,story,hsk).state,'comfortable');
});

test('the shelves sort every book, and finishing one is recorded once', () => {
  const p=freshProfile();
  const grouped=shelves(p);
  assert.deepEqual([...grouped.keys()].sort(),['beginner','everyday','stories']);
  assert.equal([...grouped.values()].flat().length,allStories().length);
  for(const row of [...grouped.values()].flat()) assert.equal(row.state,'locked');

  assert.equal(hasRead(p,'morning'),false);
  assert.equal(finishStory(p,'morning'),true);
  assert.equal(finishStory(p,'morning'),false);
  assert.equal(hasRead(p,'morning'),true);
  assert.deepEqual(decodeProfile(JSON.stringify(p)).read,['morning']);
});

test('a word with no gloss is still worth saving; only yellow has a restricted meaning', () => {
  // Not knowing what something means is usually why you are saving it.
  assert.deepEqual(sanitizeDictionaryEntry({zh:'很',pinyin:'',en:''}),{zh:'很',pinyin:'',en:''});
  assert.equal(sanitizeDictionaryEntry({zh:'水',pinyin:'shuǐ',en:'water'}).en,'water');
  // A curated word keeps only its family-friendly sense.
  assert.equal(sanitizeDictionaryEntry({zh:'黄',pinyin:'huáng',en:'yellow; pornographic'}).en,'yellow');
  // A word whose every listed sense is blocked is dropped entirely.
  assert.equal(sanitizeDictionaryEntry({zh:'x',pinyin:'',en:'pornographic'}).en,'pornographic');
  assert.equal(sanitizeDictionaryEntry({zh:'',pinyin:'',en:'water'}),null);

  const p=freshProfile();
  assert.ok(addWord(p,{zh:'很',pinyin:'',en:''}),'a bare word goes into the bank');
  assert.equal(p.saved.length,1);
});

test('a build site wants paperwork first, then materials a few at a time', () => {
  const p=freshProfile(); p.wallet=1000;
  const site=siteById('teahouse');
  assert.ok(site);
  assert.equal(siteState(p,site),'permit');            // the bank comes before the bricks
  assert.equal(completion(p,site),0);

  buyPermit(p,permitById('shop'),'lump',0);
  assert.equal(siteState(p,site),'gathering');

  // You hand over what you are carrying, and only what the site still wants.
  p.inventory={timber:5};
  assert.equal(contribute(p,site,'timber'),5);
  assert.equal(p.inventory.timber,undefined);
  assert.equal(progressOf(p,'teahouse').timber,5);
  p.inventory={timber:20};
  assert.equal(contribute(p,site,'timber'),3);         // capped at the eight it asked for
  assert.equal(p.inventory.timber,17);
  assert.equal(contribute(p,site,'timber'),0);
  assert.equal(siteState(p,site),'gathering');

  p.inventory={brick:6,'cloth-bolt':4};
  contribute(p,site,'brick');contribute(p,site,'cloth-bolt');
  assert.equal(siteState(p,site),'ready');
  assert.equal(completion(p,site),1);

  assert.equal(raise(p,site).ok,true);
  assert.equal(isBuilt(p,'teahouse'),true);
  assert.ok(p.completed.includes('built:teahouse'));   // which is what opens its door
  assert.deepEqual(builtSites(p).map(s=>s.id),['teahouse']);
  assert.equal(contribute(p,site,'timber'),0);         // a finished site takes nothing more
});

test('a built shop pays once each morning, and the ledger survives a save', () => {
  const p=freshProfile(); p.wallet=1000;
  buyPermit(p,permitById('shop'),'lump',0);
  const site=siteById('teahouse');
  p.inventory={timber:8,brick:6,'cloth-bolt':4};
  for(const id of ['timber','brick','cloth-bolt'])contribute(p,site,id);
  raise(p,site);

  const before=p.wallet;
  let paid=0;
  for(let frame=0;frame<50;frame++)paid+=collectIncome(p,3);
  assert.equal(paid,site.income);
  assert.equal(p.wallet,before+site.income);
  assert.equal(collectIncome(p,4),site.income);        // tomorrow pays again

  const back=decodeProfile(JSON.stringify(p));
  assert.equal(back.builds.teahouse.done,true);
  assert.equal(back.builds.teahouse.given.timber,8);
  const repairs=[];
  // One bad count goes; the site stays built, so its income keeps coming.
  assert.deepEqual(decodeProfile(JSON.stringify({...p,builds:{teahouse:{given:{timber:-1,stone:4},done:true}}}),repairs).builds,{teahouse:{given:{stone:4},done:true}});
  assert.deepEqual(repairs,['builds']);
});

test('F on a sign saves its phrase to the word bank without counting it as a named object', () => {
  const p=freshProfile();
  const sign={id:'sign:welcome-qinghe',zh:'欢迎来到青禾',pinyin:'huānyíng láidào Qīnghé',en:'Welcome to Qinghe',sign:true};
  assert.equal(knowsLook(p,sign),false);
  assert.deepEqual(collectLook(p,sign),{clip:'sign-welcome-qinghe',isNew:true});
  assert.equal(p.saved.at(-1).zh,'欢迎来到青禾');
  assert.equal(p.saved.at(-1).audio,'sign-welcome-qinghe');
  assert.deepEqual(p.discovered,[]);
  assert.equal(knowsLook(p,sign),true);
  assert.equal(collectLook(p,sign).isNew,false);
  // An object still joins the discovered list, once.
  const cup={id:'cup',zh:'杯子',pinyin:'bēizi',en:'cup'};
  assert.deepEqual(collectLook(p,cup),{clip:'obj-cup',isNew:true});
  assert.deepEqual(p.discovered,['cup']);
  assert.equal(collectLook(p,cup).isNew,false);
  assert.equal(knowsLook(p,cup),true);
});

test('a vase and a bonsai can stand on a tea table, and the paintings hang on the wall', () => {
  assert.equal(canStack('vase'),true);
  assert.equal(canStack('bonsai'),true);
  assert.equal(canStack('folding-screen'),false);
  assert.equal(offersSurface('tea-table'),true);
  const teaTable={kind:'tea-table',footprint:[1.0,.6],rot:0,uid:'tt'};
  assert.equal(fitsOn(teaTable,{footprint:[.65,.45],x:0,z:0}),true);          // a tea set on a tea table
  for(const kind of ['certificate','scroll-painting','landscape-painting'])assert.equal(hangsOnWall(kind),true,kind);
  for(const kind of ['vase','rug','tea-table'])assert.equal(hangsOnWall(kind),false,kind);
});
