import test from 'node:test';import assert from 'node:assert/strict';import {qualifiesMemory,commitCapture} from '../src/core/story-photo.js';import {freshProfile} from '../src/core/profile.js';import {applyRootsEvent} from '../src/core/roots.js';
test('framing may vary but place, visibility and distance matter',()=>{const m={place:'town',radius:14},s={place:'town',distance:10,inView:true,occluded:false};assert.equal(qualifiesMemory(m,s),true);for(const change of [{place:'city'},{distance:15},{inView:false},{occluded:true}])assert.equal(qualifiesMemory(m,{...s,...change}),false);});
test('capture charges once and recovers after final storage failure',async()=>{let p=freshProfile();applyRootsEvent(p,{type:'begin'});p.inventory.film=6;const records=new Map();let fail=true;const store={put:async r=>{if(r.done&&fail)throw Error('disk');records.set(r.id,structuredClone(r));},get:async id=>records.get(id)};const persistence={read:()=>p,write:n=>{p=n;}};const shot={id:'capture-a',memoryId:'roots-fruit',src:'image',cost:1};await assert.rejects(commitCapture(shot,store,persistence));assert.equal(p.inventory.film,5);fail=false;await commitCapture(shot,store,persistence);assert.equal(p.inventory.film,5);assert.deepEqual(p.roots.photos,['roots-fruit']);assert.equal(records.get('capture-a').done,true);});
test('image write failure never charges film',async()=>{let p=freshProfile();applyRootsEvent(p,{type:'begin'});p.inventory.film=6;await assert.rejects(commitCapture({id:'a',src:'image',cost:1},{get:async()=>null,put:async()=>{throw Error('full');}},{read:()=>p,write:n=>{p=n;}}));assert.equal(p.inventory.film,6);});

test('capture cannot charge a different profile after image storage awaits',async()=>{let p=freshProfile();applyRootsEvent(p,{type:'begin'});p.inventory.film=6;const original=p.roots.id;const other=freshProfile();applyRootsEvent(other,{type:'begin'});other.inventory.film=6;await assert.rejects(commitCapture({id:'switch',profileId:original,cost:1,src:'image'},{get:async()=>null,put:async()=>{p=other;}},{read:()=>p,write:n=>{p=n;}}));assert.equal(other.inventory.film,6);});

test('failed profile write leaves an unpaid image pending and recovery charges only once',async()=>{
 let p=freshProfile();applyRootsEvent(p,{type:'begin'});p.inventory.film=6;const records=new Map();let fail=true;
 const store={get:async id=>records.get(id),put:async r=>records.set(r.id,structuredClone(r))};
 const persistence={read:()=>p,write:async next=>{if(fail)throw Error('profile quota');p=next;}};
 const shot={id:'profile-write-failure',profileId:p.roots.id,memoryId:'roots-fruit',src:'retained image',cost:1};
 await assert.rejects(commitCapture(shot,store,persistence),/profile quota/);assert.equal(p.inventory.film,6);assert.deepEqual(p.roots.photos,[]);assert.equal(records.get(shot.id).done,false);
 fail=false;await commitCapture(shot,store,persistence);await commitCapture(shot,store,persistence);assert.equal(p.inventory.film,5);assert.deepEqual(p.roots.photos,['roots-fruit']);assert.equal(records.get(shot.id).src,'retained image');assert.equal(records.get(shot.id).done,true);
});

// Two cameras (W4-camera): Grandpa's photographs the album places for free; your own uses film.
import {pickCamera,filmCost,ownCheckIn,framingHint,CAMERAS,CAMERA_FLAG} from '../src/core/story-photo.js';
import quests from '../src/content/quests.json' with {type:'json'};
import unlock from '../src/content/unlock.json' with {type:'json'};
import catalog from '../src/content/catalog.json' with {type:'json'};
import roots from '../src/content/roots.json' with {type:'json'};
test('Grandpa\'s camera comes up where an album photo is sought, otherwise your own if you have one',()=>{
 const p=freshProfile();
 assert.equal(pickCamera(p,false),'grandpa','nothing of your own yet');
 p.inventory[CAMERAS.mine]=1;
 assert.equal(pickCamera(p,false),'mine');
 assert.equal(pickCamera(p,true),'grandpa','an album spot while its photo is sought');
 assert.equal(filmCost('grandpa'),0);assert.equal(filmCost('mine'),1);
 for(const id of Object.values(CAMERAS))assert.ok(catalog.some(i=>i.id===id),id+' is a catalog item');
 const mine=catalog.find(i=>i.id===CAMERAS.mine);
 assert.ok([].concat(mine.shop).includes('resale')&&mine.price>=30&&mine.price<=50,'sold at the resale shop for about 40');
 assert.equal(catalog.find(i=>i.id===CAMERAS.grandpa).sellable,false);
});
test('the opening gives Grandpa\'s camera instead of film, once, also to a save that already began',()=>{
 const p=freshProfile();applyRootsEvent(p,{type:'begin'});applyRootsEvent(p,{type:'begin'});
 assert.equal(p.inventory[CAMERAS.grandpa],1);assert.equal(p.inventory.film??0,0);
 const old=freshProfile();old.roots={started:true};old.inventory.film=4;old.claims['roots:film']=true;
 applyRootsEvent(old,{type:'begin'});
 assert.equal(old.inventory[CAMERAS.grandpa],1);assert.equal(old.inventory.film,4,'film already owned stays');
});
test('a check-in photo with your own camera finishes my-camera, which the metro unlock counts',()=>{
 const p=freshProfile(),spot={id:'fountain'};
 assert.equal(ownCheckIn(p,'grandpa',spot),false);assert.equal(ownCheckIn(p,'mine',null),false);
 assert.equal(ownCheckIn(p,'mine',spot),true);assert.equal(ownCheckIn(p,'mine',spot),false);
 assert.deepEqual(p.completed.filter(f=>f===CAMERA_FLAG),[CAMERA_FLAG]);
 const quest=quests.quests.find(q=>q.id==='my-camera');
 assert.equal(quest?.done?.flag,CAMERA_FLAG);assert.ok(unlock.townQuests.includes('my-camera'));
});
test('framing hints say what is missing, and the square is shot at the fountain itself',()=>{
 const m={place:'town',radius:18},ok={place:'town',distance:8,inView:true,occluded:false};
 assert.equal(framingHint(m,ok),null);
 assert.equal(framingHint(m,{...ok,distance:25}),'far');assert.equal(framingHint(m,{...ok,place:'city'}),'far');
 assert.equal(framingHint(m,{...ok,inView:false}),'turn');assert.equal(framingHint(m,{...ok,occluded:true}),'blocked');
 const square=roots.memories.find(m=>m.id==='roots-square');
 // The fountain's solid drum (src/world/fountain.js) is 2.12 m round the centre: the aim point must clear it.
 assert.deepEqual([square.x,square.z],[0,1.8]);assert.ok(square.clearance>2.12);
});
