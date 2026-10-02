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

/** The two cameras (catalog ids). Grandpa's photographs the album places only and never uses film;
 *  your own, bought at the resale shop, takes 打卡 check-ins and free photos for one film each. */
export const CAMERAS={grandpa:'grandpa-camera',mine:'secondhand-camera'};
/** quests.json `my-camera`: the first check-in photo taken with your own camera. */
export const CAMERA_FLAG='camera:first';
/** Grandpa's where an album photo is being sought (`seeking`), otherwise your own if you have one. */
export const pickCamera=(p,seeking)=>!seeking&&(p.inventory?.[CAMERAS.mine]??0)>0?'mine':'grandpa';
export const filmCost=camera=>camera==='mine'?1:0;
export function ownCheckIn(p,camera,spot){
 if(camera!=='mine'||!spot||p.completed.includes(CAMERA_FLAG))return false;
 p.completed.push(CAMERA_FLAG);return true;
}
/** What keeps an album shot from counting: 'far' (or the wrong place), 'turn', 'blocked'; null when it counts. */
export function framingHint(memory,shot){
 if(qualifiesMemory(memory,shot))return null;
 if(shot.place!==memory.place||!(shot.distance<=memory.radius))return 'far';
 return shot.inView?'blocked':'turn';
}
