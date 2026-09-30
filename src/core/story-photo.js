import {applyRootsEvent} from './roots.js';
export const qualifiesMemory=(memory,shot)=>!!memory&&!memory.keepsake&&shot.place===memory.place&&Number.isFinite(shot.distance)&&shot.distance<=memory.radius&&shot.inView===true&&shot.occluded===false;
export async function commitCapture(shot,store,persistence){
 const profileId=shot.profileId??persistence.read().roots.id;let record=await store.get(shot.id);if(record?.done)return record;
 if(!record){if(![0,1].includes(shot.cost))throw Error('Invalid film cost');if((persistence.read().inventory.film??0)<shot.cost)throw Error('No film');record={...shot,done:false};await store.put(record);}
 const p=persistence.read();if(p.roots.id!==profileId)throw Error("Profile changed");if(!p.roots.captures.includes(record.id)){
  if((p.inventory.film??0)<record.cost)throw Error('No film');const next=structuredClone(p);next.inventory.film=(next.inventory.film??0)-record.cost;next.roots.captures.push(record.id);if(record.memoryId)applyRootsEvent(next,{type:'photo',id:record.memoryId});await persistence.write(next);
 }
 const done={...record,done:true};await store.put(done);return done;
}
