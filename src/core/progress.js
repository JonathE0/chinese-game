import objectNames from '../content/objects.json' with {type:'json'};

const NAMES=objectNames.objects;

/**
 * Districts open on evidence of learning, not on time spent. A word counts once the player has
 * answered it correctly at least once, and a named object counts once they have collected it, so
 * both drilling and exploring move the same bar. The point is to keep a player in one level's
 * vocabulary long enough for it to stick.
 */
export function learnedAtLevel(profile,words,level){
  let count=0;
  for(const word of words??[]){
    if(word.level!==level)continue;
    if((profile.words[word.id]?.recognition?.stage??0)>=1)count++;
  }
  for(const id of profile.discovered??[]){
    if(NAMES[id]?.hsk===level)count++;
  }
  return count;
}

/** State of every district: whether it is open, and how far along its requirement is. */
export function districtStates(profile,districts,words){
  return districts.map(district=>{
    const need=district.gate?.requires;
    if(!need)return {id:district.id,district,unlocked:true,have:0,need:0,level:district.level};
    const have=learnedAtLevel(profile,words,need.level);
    return {id:district.id,district,unlocked:have>=need.words,have,need:need.words,level:need.level};
  });
}

export function gateMessage(state){
  if(state.unlocked)return `${state.district.zh} 已开放`;
  return `还需要认识 ${Math.max(0,state.need-state.have)} 个 HSK ${state.level} 词语（${state.have}/${state.need}）`;
}
