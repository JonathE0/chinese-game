import catalog from '../content/catalog.json' with {type:'json'};

export const SLOTS=['hat','shirt','trousers','shoes'];
export const wearable=id=>catalog.find(item=>item.id===id)?.wear??null;

/** What the tourist is currently wearing, resolved to the colours the model needs. */
export function outfit(profile){
  const worn={};
  for(const [slot,id] of Object.entries(profile.equipped??{})){
    const wear=wearable(id);
    if(!wear||wear.slot!==slot)continue;
    worn[slot]=id;
    worn[slot+'Color']=wear.color;
  }
  return worn;
}

/** Put an item on, or take it off if it is already worn. Returns the new outfit. */
export function toggleWear(profile,itemId){
  const wear=wearable(itemId);
  if(!wear)return outfit(profile);
  profile.equipped??={};
  if(profile.equipped[wear.slot]===itemId)delete profile.equipped[wear.slot];
  else profile.equipped[wear.slot]=itemId;
  return outfit(profile);
}

export const isWorn=(profile,itemId)=>Object.values(profile.equipped??{}).includes(itemId);
