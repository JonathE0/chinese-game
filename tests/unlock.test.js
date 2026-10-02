import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProfile} from '../src/core/profile.js';
import {townSteps,townQuestsLeft,metroOpen,metroPanel,cardDue,giveCard,passCheck,CARD_FLAG,CHECK_FLAG} from '../src/core/unlock.js';
import quests from '../src/content/quests.json' with {type:'json'};
import roots from '../src/content/roots.json' with {type:'json'};
import unlock from '../src/content/unlock.json' with {type:'json'};
import catalog from '../src/content/catalog.json' with {type:'json'};
import rooms from '../src/content/rooms.json' with {type:'json'};

const LISTED=['greet','four-words','name-things','souvenir','furnish','market','order','furnish-shop','daily','teahouse-permit','teahouse-build','my-camera','fishing','vegetables'];
// my-camera (W4-camera) counts once quests.json has it.
const TOWN=LISTED.filter(id=>quests.quests.some(q=>q.id===id));
const gates=[{id:'market',unlocked:true}];

/** A save that has done every town step there is. */
function finished(){
  const p=freshProfile();
  p.completed.push('introductions','practice:first','purchase:first','homeware:first','daily:first','permit:shop','built:teahouse','fish:first','veg:first');
  p.discovered=Array.from({length:10},(_,i)=>'thing-'+i);
  p.home=Array.from({length:4},(_,i)=>({uid:'h'+i,item:'chair'}));
  p.claims['order:noodles']=true;
  // my-camera's own rule is W4-camera's; mark it done by its flag when it has one.
  const camera=quests.quests.find(q=>q.id==='my-camera');if(camera?.done?.flag)p.completed.push(camera.done.flag);
  p.roots={met:true,photos:roots.memories.filter(m=>m.place==='town').map(m=>m.id),
    mastery:Object.fromEntries(roots.skills.map(s=>[s.id,s.variants.slice(0,2).map(v=>v.id)]))};
  return p;
}

test('the town steps are the fourteen town quests and the offline Roots steps', () => {
  assert.deepEqual(unlock.townQuests,LISTED);
  // The countryside's two errands (fishing with 王爷爷, picking with 刘奶奶) count too.
  assert.equal(TOWN.length,14);
  const ids=townSteps(freshProfile(),gates).map(s=>s.id);
  assert.deepEqual(ids,[...TOWN,'roots:met','roots:roots-fruit','roots:roots-square','roots:roots-home','roots:practice']);
  // Nothing the city teaches or the cloud settles: the home noodles need Yunhai's cook, the stand needs a server.
  assert.ok(!ids.includes('home-noodles')&&!ids.includes('metro-first')&&!ids.some(id=>id.startsWith('city')));
});

test('townQuestsLeft counts down to nothing as the town is finished', () => {
  const p=freshProfile();
  assert.equal(townQuestsLeft(p,[{id:'market',unlocked:false}]).length,TOWN.length+5);
  p.completed.push('introductions');
  assert.ok(!townQuestsLeft(p,gates).includes('greet'));
  assert.deepEqual(townQuestsLeft(finished(),gates),[]);
  // The shopping street counts once its gate is open, or once the player has walked in.
  const q=finished();
  assert.deepEqual(townQuestsLeft(q,[{id:'market',unlocked:false}]),['market']);
  q.learning={visited:['market']};
  assert.deepEqual(townQuestsLeft(q,[{id:'market',unlocked:false}]),[]);
  // Practice counts only once every Roots skill is mastered.
  const r=finished();r.roots.mastery[roots.skills[0].id]=[];
  assert.deepEqual(townQuestsLeft(r,gates),['roots:practice']);
});

test('the metro stays shut for a new save and opens after the check', () => {
  const p=finished();
  assert.equal(metroOpen(p,false),false);
  assert.equal(cardDue(p,gates),true);
  assert.equal(cardDue(freshProfile(),gates),false);
  assert.equal(passCheck(p),false,'no check before the card');
  assert.equal(giveCard(p),true);
  assert.equal(giveCard(p),false,'the card is given once');
  assert.ok(p.completed.includes(CARD_FLAG));
  assert.equal(p.inventory[unlock.card],1);
  assert.ok(p.roots.discovered.includes(unlock.photo));
  assert.equal(cardDue(p,gates),false);
  assert.equal(metroOpen(p,false),false);
  const wallet=p.wallet;
  assert.equal(passCheck(p),true);
  assert.equal(p.wallet,wallet,'no coins change hands');
  assert.ok(p.completed.includes(CHECK_FLAG));
  assert.equal(metroOpen(p,false),true);
  assert.equal(cardDue(p,gates),false);
});

test('saves that already travelled keep the metro, and admin opens it', () => {
  assert.equal(metroOpen(freshProfile(),true),true);
  const rode=freshProfile();rode.metro={trips:2,balance:0};
  assert.equal(metroOpen(rode,false),true);
  const flag=freshProfile();flag.completed.push('metro:first');
  assert.equal(metroOpen(flag,false),true);
  for(const f of ['city:line','city-noodles','city:found-bookstore']){
    const city=freshProfile();city.completed.push(f);
    assert.equal(metroOpen(city,false),true,f);
  }
  // A grandfathered save is never asked to collect the card.
  const old=finished();old.completed.push('metro:first');
  assert.equal(cardDue(old,gates),false);
});

test('the card and the Yunhai page exist as content', () => {
  const card=catalog.find(i=>i.id===unlock.card);
  assert.equal(card?.zh,'爷爷的交通卡');
  assert.equal(card.sellable,false);
  const page=roots.memories.find(m=>m.id===unlock.photo);
  assert.equal(page?.clue.zh,'云海的海风，很舒服。');
  assert.ok(!roots.memories.slice(0,3).includes(page),'not handed out at the start');
});

test('the card machines always open; the gates at Qinghe send a locked save to the attendant', () => {
  const locked=freshProfile(),open=finished();open.completed.push(CARD_FLAG,CHECK_FLAG);
  // Every station's machines are metro:machine and nothing else in a station is.
  const stations=Object.values(rooms).filter(r=>r.transit);
  assert.equal(stations.length,2);
  for(const room of stations)for(const f of room.fittings??[])assert.equal(f.kind==='ticketmachine',f.action==='metro:machine',`${room.transit} ${f.kind}`);
  assert.equal(metroPanel('metro:machine',locked,'qinghe',false),'card','top up before the unlock');
  assert.equal(metroPanel('metro',locked,'qinghe',false),'locked');
  assert.equal(metroPanel('metro',open,'qinghe',false),'card');
  assert.equal(metroPanel('metro',locked,'qinghe',true),'card','admin');
});

test('a locked save in Yunhai can always ride home', () => {
  // An unlocked player in Yunhai who imports or signs into a save that has not unlocked.
  const locked=freshProfile();
  assert.equal(metroPanel('metro',locked,'yunhai',false),'card');
  assert.equal(metroPanel('metro:machine',locked,'yunhai',false),'card');
  assert.equal(unlock.station,'qinghe','only journeys from Qinghe wait for the unlock');
});
