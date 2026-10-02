import test from 'node:test';import assert from 'node:assert/strict';
import * as m from '../src/core/metro.js';
import {freshProfile,decodeProfile} from '../src/core/profile.js';
const player=(extra={})=>({wallet:30,dayIndex:0,...extra});
/** A current save that went through decodeProfile, the only way a profile reaches the game. */
const loaded=metro=>decodeProfile(JSON.stringify({...freshProfile(),metro}));

test('the card only moves wallet coins onto it, and invalid amounts are refused',()=>{
 const p=player();
 assert.equal(m.topUpCard(p,10).ok,true);assert.equal(p.wallet,20);assert.equal(m.cardBalance(p),10);
 for(const n of [-1,0,1.5,Infinity,NaN,'5',21])assert.equal(m.topUpCard(p,n).ok,false,String(n));
 assert.deepEqual([p.wallet,m.cardBalance(p)],[20,10]);
});

test('fares follow distance bands and only the operating route has a fare',()=>{
 assert.equal(m.quoteFare('qinghe','yunhai').cost,5);assert.equal(m.quoteFare('yunhai','qinghe').cost,5);
 for(const [a,b] of [['qinghe','airport'],['qinghe','qinghe'],['line-2','yunhai'],[undefined,'yunhai']])assert.equal(m.quoteFare(a,b).ok,false);
 assert.deepEqual([m.fareForDistance(3),m.fareForDistance(5),m.fareForDistance(12),m.fareForDistance(25)],[3,3,5,8]);
 assert.equal(m.fareForDistance(0),null);
});

test('a reservation cancels freely; arriving charges once, even after a reload or a second arrival',()=>{
 const p=player();m.topUpCard(p,10);
 assert.equal(m.enterJourney(p,'qinghe','yunhai').ok,true);assert.equal(m.cardBalance(p),10);
 assert.equal(m.enterJourney(p,'qinghe','yunhai').reason,'pending','a second tap cannot stack a fare');
 assert.equal(m.cancelJourney(p).ok,true);assert.equal(m.cardBalance(p),10);
 const next=m.enterJourney(p,'qinghe','yunhai');
 assert.equal(m.boardJourney(p,next.id).ok,true);
 assert.equal(m.cancelJourney(p).ok,false,'a journey under way cannot be refunded');
 const back={...p,metro:loaded(p.metro).metro};
 assert.equal(m.completeJourney(back,next.id).ok,true);
 assert.equal(m.completeJourney(back,next.id).ok,false);
 assert.deepEqual([m.cardBalance(back),back.metro.trips,back.metro.journey],[5,1,undefined]);
});

test('there is no free ride: both directions need the fare on the card, and the ticket and free-return paths are gone',()=>{
 const p=player();
 for(const [a,b] of [['yunhai','qinghe'],['qinghe','yunhai']])assert.deepEqual(m.enterJourney(p,a,b),{ok:false,reason:'balance',cost:5});
 m.topUpCard(p,4);assert.equal(m.enterJourney(p,'yunhai','qinghe').reason,'balance');
 for(const gone of ['buyTickets','buyPass','board','returnTrip','boardingProblem'])assert.equal(m[gone],undefined,gone);
});

test('an unexpired pass rides free until the day it runs out, and no new pass is sold',()=>{
 const p=player({metro:{trips:0,passUntil:7,balance:0}});
 assert.equal(m.enterJourney(p,'yunhai','qinghe').cost,0);m.cancelJourney(p);
 p.dayIndex=7;assert.equal(m.enterJourney(p,'yunhai','qinghe').reason,'balance');
});

test('a journey under way always arrives, so a short card never strands anyone',()=>{
 const p=player({metro:{balance:2,trips:0,sequence:1,journey:{id:1,origin:'qinghe',destination:'yunhai',cost:5,phase:'riding'}}});
 assert.equal(m.completeJourney(p,1).ok,true);
 assert.deepEqual([p.metro.balance,p.metro.trips,p.metro.journey],[0,1,undefined]);
});

test('boarding needs the reservation it was made for',()=>{
 const p=player();m.topUpCard(p,10);const {id}=m.enterJourney(p,'qinghe','yunhai');
 assert.equal(m.boardJourney(p,id+1).ok,false);assert.equal(m.boardJourney(p,id).ok,true);
 assert.equal(m.boardJourney(p,id).ok,false,'already aboard');assert.equal(p.metro.journey.phase,'riding');
});
