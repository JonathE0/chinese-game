import test from 'node:test';import assert from 'node:assert/strict';import * as r from '../src/core/rental.js';
import data from '../src/content/rental.json' with {type:'json'};
import rooms from '../src/content/rooms.json' with {type:'json'};
import city from '../src/content/city.json' with {type:'json'};
import {freshProfile,loadProfile,saveProfile,decodeProfile,SAVE_KEY} from '../src/core/profile.js';
import {storeRoomFurniture} from '../src/ui/decorate.js';
import {evaluateNode} from '../src/core/conversation.js';
import {sayNumber} from '../src/core/order.js';

/**
 * 海景公寓, the flats to rent in 云海中心 across the bay (wave 4, W4-apartments): four tiers from a
 * studio to a penthouse, one lease at a time, paid in advance from coins earned studying.
 */
const unit=tier=>data.units.find(u=>u.tier===tier);
const [studio,oneBed,view,penthouse]=[1,2,3,4].map(unit);
const DAYS=data.days;

test('Codex\'s first lease is the studio: the same record, the price its lesson quotes',()=>{
  assert.equal(studio.id,'riverside-apartment');
  assert.deepEqual(r.normalizeRental({id:studio.id,until:9,revision:2}),{id:studio.id,until:9,revision:2});
  assert.equal(r.leaseStatus({dayIndex:3,rental:{id:studio.id,until:9,revision:2}}).unit.id,studio.id);
  // 三十五块 in the rental practice is what the studio costs (review finding 6).
  assert.ok(data.lesson.nodes.find(n=>n.id==='key').zh.startsWith(sayNumber(studio.price)+'块'));
});

test('the tiers climb: dearer, bigger, higher and better served',()=>{
  const area=u=>{const room=rooms[u.id];return room.size[0]*room.size[1]*(room.upper?2:1);};
  for(let i=1;i<data.units.length;i++){
    const [a,b]=[data.units[i-1],data.units[i]];
    assert.equal(b.tier,a.tier+1);
    assert.ok(b.price>a.price,`${b.id} costs more`);assert.ok(area(b)>area(a),`${b.id} is bigger`);
    assert.ok(r.floorOf(b.id)>r.floorOf(a.id),`${b.id} is higher up`);
    assert.ok(data.amenities.filter(x=>x.tier<=b.tier).length>data.amenities.filter(x=>x.tier<=a.tier).length,`${b.id} opens more`);
  }
  assert.equal(r.floorOf(data.amenities.find(a=>a.tier===4).id),Math.max(...data.stops.map(s=>s.floor)),'the rooftop restaurant is at the top');
});

test('renting charges once; the second half of a double click is refused by the rules, not only the button',()=>{
  const p={wallet:100,dayIndex:2};
  const q=r.quoteLease(p,studio.id);
  assert.equal(q.action,'rent');assert.equal(q.pay,studio.price);
  assert.equal(r.rentApartment(p,studio.id,q.revision).ok,true);
  assert.equal(p.wallet,100-studio.price);assert.equal(r.leaseStatus(p).days,DAYS);
  // The redrawn panel quotes afresh (a new revision), and its button is where the second click lands.
  const again=r.quoteLease(p,studio.id);
  assert.equal(again.ok,false);assert.equal(again.reason,'paid');
  assert.deepEqual(r.rentApartment(p,studio.id,again.revision),{ok:false,reason:'paid'});
  assert.equal(p.wallet,100-studio.price);
  // A quote from before the payment is stale.
  assert.deepEqual(r.rentApartment(p,oneBed.id,q.revision),{ok:false,reason:'changed'});
});

test('renewal opens once less than a term is left and runs on from the later of expiry and today',()=>{
  const active={wallet:500,dayIndex:3,rental:{id:studio.id,until:5,revision:1}};
  assert.equal(r.rentApartment(active,studio.id,1).until,5+DAYS);   // still paid up: added on to the end
  assert.equal(r.quoteLease(active,studio.id).reason,'paid');       // now a whole term ahead
  active.dayIndex=5+1;
  assert.equal(r.rentApartment(active,studio.id,2).until,5+2*DAYS);
  const lapsed={wallet:100,dayIndex:10,rental:{id:studio.id,until:5,revision:1}};
  const q=r.quoteLease(lapsed,studio.id);
  assert.equal(q.action,'renew');assert.equal(q.refund,0);
  assert.equal(r.rentApartment(lapsed,studio.id,1).until,10+DAYS);  // lapsed: counted from today, no back rent
  assert.equal(lapsed.wallet,100-studio.price);
});

test('moving flats refunds the unused days, so no round trip ever makes coins',()=>{
  const p={wallet:1000,dayIndex:0};
  r.rentApartment(p,oneBed.id,0);
  p.dayIndex=3;   // four of seven days left
  const up=r.quoteLease(p,penthouse.id);
  assert.equal(up.action,'move');assert.equal(up.from,oneBed.id);
  assert.equal(up.refund,Math.floor(oneBed.price*4/DAYS));assert.equal(up.pay,penthouse.price-up.refund);
  const before=p.wallet;
  assert.equal(r.rentApartment(p,penthouse.id,up.revision).ok,true);assert.equal(p.wallet,before-up.pay);
  assert.deepEqual(p.rental,{id:penthouse.id,until:3+DAYS,revision:2});
  // Straight back down the same day: the penthouse's whole term comes back, less the studio's rent.
  const down=r.quoteLease(p,studio.id);
  assert.equal(down.pay,studio.price-penthouse.price);
  assert.equal(r.rentApartment(p,studio.id,down.revision).ok,true);
  assert.ok(p.wallet<=1000,'never more than we started with');
  const settled=p.wallet;
  for(let i=0;i<5;i++)for(const u of [view,oneBed,penthouse,studio]){const q=r.quoteLease(p,u.id);assert.equal(r.rentApartment(p,u.id,q.revision).ok,true,u.id);}
  assert.equal(p.wallet,settled);assert.equal(p.rental.id,studio.id);
});

test('too few coins, an unknown flat or a bad record takes nothing and opens nothing',()=>{
  const p={wallet:5,dayIndex:0};
  assert.deepEqual(r.rentApartment(p,studio.id,0),{ok:false,reason:'money'});
  assert.deepEqual(r.rentApartment(p,'elsewhere',0),{ok:false,reason:'unit'});
  assert.equal(p.wallet,5);assert.equal(p.rental,undefined);
  for(const bad of [{until:-1},{id:'elsewhere',until:9,revision:1},{id:studio.id,until:1.5,revision:1},{id:studio.id,until:9,revision:0},'lease'])
    assert.equal(r.normalizeRental(bad),undefined,JSON.stringify(bad));
  assert.equal(r.leaseStatus(p).active,false);
});

test('a flat needs its own lease, an amenity a tier, and the lobby, the lift and home need nothing',()=>{
  const p={wallet:0,dayIndex:0};
  for(const place of ['home','bedroom','town','city',data.lobby,data.lift])assert.equal(r.rentalAccess(p,place),true,place);
  for(const place of [...data.units.map(u=>u.id),...data.amenities.map(a=>a.id)])assert.equal(r.rentalAccess(p,place),false,place);
  p.rental={id:oneBed.id,until:1,revision:1};
  assert.equal(r.rentalAccess(p,oneBed.id),true);assert.equal(r.rentalAccess(p,studio.id),false);
  for(const a of data.amenities)assert.equal(r.rentalAccess(p,a.id),a.tier<=oneBed.tier,a.id);
  p.dayIndex=1;   // expires at the start of day `until`
  assert.equal(r.rentalAccess(p,oneBed.id),false);
  for(const a of data.amenities)assert.equal(r.rentalAccess(p,a.id),false,a.id);
});

test('the reminder shows in the last warningDays of a lease',()=>{
  const p={dayIndex:0,rental:{id:studio.id,until:data.warningDays+1,revision:1}};
  assert.equal(r.leaseStatus(p).soon,false);p.dayIndex=1;assert.equal(r.leaseStatus(p).soon,true);
});

const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i],get length(){return m.size;}};};
test('a lease survives save and load and expires only as in-game days pass',()=>{
  const storage=store(),p=freshProfile();p.wallet=100;p.dayIndex=4;
  r.rentApartment(p,studio.id,0);saveProfile(storage,p);
  const back=loadProfile(storage).profile;
  assert.deepEqual(back.rental,{id:studio.id,until:4+DAYS,revision:1});
  assert.equal(r.leaseStatus(back).days,DAYS);   // no rent accrues while the game is closed
  back.dayIndex=4+DAYS;saveProfile(storage,back);
  const lapsed=loadProfile(storage).profile;
  assert.equal(r.leaseStatus(lapsed).active,false);assert.equal(r.leaseStatus(lapsed).held,true);
  assert.equal(r.rentApartment(lapsed,studio.id,r.quoteLease(lapsed,studio.id).revision).ok,true);
});

test('a bad lease record is repaired like any damaged field: noted, dropped and the original kept (finding 2)',()=>{
  const p=freshProfile();p.rental={id:'elsewhere',until:9,revision:1};
  const repairs=[],back=decodeProfile(JSON.stringify(p),repairs);
  assert.equal(back.rental,undefined);assert.deepEqual(repairs,['rental']);
  const clean=[];decodeProfile(JSON.stringify({...p,rental:{id:studio.id,until:9,revision:1}}),clean);
  assert.deepEqual(clean,[]);
  const storage=store();storage.setItem(SAVE_KEY,JSON.stringify(p));
  const loaded=loadProfile(storage,1234);
  assert.deepEqual(loaded.repairs,['rental']);assert.ok(loaded.warning);
  assert.equal(storage.getItem(SAVE_KEY+'.unreadable-1234'),JSON.stringify(p));
});

test('recovering a flat\'s furniture keeps every piece owned and leaves the Qinghe home alone',()=>{
  const removed=[];let saves=0;
  const ctx={profile:{inventory:{'furniture-rug':2,'furniture-lamp':1},home:[
    {uid:'a',item:'furniture-rug',room:studio.id},{uid:'b',item:'furniture-lamp',room:studio.id},
    {uid:'c',item:'furniture-rug',room:'home'},{uid:'d',item:'furniture-bed'}]},
    town:{removeProp:(room,uid)=>removed.push(room+':'+uid)},save:()=>saves++};
  storeRoomFurniture(ctx,studio.id);
  assert.deepEqual(ctx.profile.inventory,{'furniture-rug':2,'furniture-lamp':1});
  assert.deepEqual(ctx.profile.home.map(x=>x.uid),['c','d']);
  assert.deepEqual(removed,[studio.id+':a',studio.id+':b']);assert.ok(saves>0);
});

// 云海中心 steps in as it rises (city.json skyline `tiers`): every room sits inside the tier its
// floor is in, a storey high (the lobby and the penthouse two), and the lift names its floors.
test('every room of the tower fits the tier and the storeys it stands in',()=>{
  const tower=city.skyline.towers.find(t=>t.id===data.tower.id),{storey,base}=data.tower;
  let y0=0;const tiers=tower.tiers.map(([share,tall])=>{const t={w:tower.w*share,y0,y1:y0+tall};y0+=tall;return t;});
  const floors=data.stops.map(s=>s.floor),top=Math.max(...floors);
  assert.equal(new Set(floors).size,floors.length,'one room a floor');
  for(const stop of data.stops){
    const room=rooms[stop.room];
    assert.ok(room,stop.room);assert.equal(room.building,'city:'+data.tower.id,stop.room);
    const y=base+(stop.floor-1)*storey,tier=tiers.find(t=>y>=t.y0&&y<t.y1),span=Math.ceil(room.height/storey-1e-9);
    assert.ok(tier&&y+room.height<=tier.y1,`${stop.room} on floor ${stop.floor} runs out of its tier`);
    assert.ok(room.size[0]<=tier.w-.4&&room.size[1]<=tier.w-.4,`${stop.room} is ${room.size} in a ${tier.w.toFixed(2)} tier`);
    for(const h of room.upper?[room.upper.y,room.height-room.upper.y]:[room.height/span])assert.ok(h<=storey,`${stop.room} has a ${h} high storey`);
    assert.ok(floors.every(f=>f===stop.floor||f<stop.floor||f>=stop.floor+span),`${stop.room} runs into the floor above`);
    // 一楼 … 二十八楼 in numerals as spoken (二 not 两), and the top stop 顶楼.
    assert.equal(stop.zh,stop.floor===top?'顶楼':(stop.floor===2?'二':sayNumber(stop.floor))+'楼',stop.room);
  }
  assert.ok(rooms[data.lift]&&!data.stops.some(s=>s.room===data.lift),'the lift car is not a floor');
});

test('each flat is decoratable with a bed; flats, amenities and the lobby all have windows',()=>{
  for(const u of data.units){
    assert.equal(rooms[u.id].decoratable,true,u.id);
    assert.ok(rooms[u.id].fittings.some(f=>f.action==='sleep'),`${u.id} has a bed`);
  }
  for(const id of [...data.units.map(u=>u.id),...data.amenities.map(a=>a.id),data.lobby])
    assert.ok((data.rooms[id]?.glass??[]).length>0,`${id} has a window`);
});

test('the rental practice accepts natural variants and its own buttons, and refuses the wrong term',()=>{
  const node=id=>data.lesson.nodes.find(n=>n.id===id);
  for(const n of data.lesson.nodes)for(const choice of n.choices)assert.ok(evaluateNode(n,choice).ok,n.id+' '+choice);
  for(const [id,reply] of [['rent-room','请问我想租一间房谢谢'],['rent-room','我想租一个房间。'],['stay-days','我要住一个星期可以吗'],['ask-price','请问房租是多少钱'],['key','太好了，谢谢您！']])
    assert.ok(evaluateNode(node(id),reply).ok,id+' '+reply);
  for(const [id,reply] of [['stay-days','我想住三天'],['stay-days','三天'],['ask-price','房租三十五块'],['rent-room','我想买房间'],['key','不要']])
    assert.equal(evaluateNode(node(id),reply).ok,false,id+' '+reply);
});
