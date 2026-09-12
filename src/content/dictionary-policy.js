import policy from './dictionary-policy.json' with {type:'json'};

const blocked=policy.blockedSensePatterns.map(pattern=>new RegExp(pattern,'iu'));
const senses=en=>(en??'').split(/\s*;\s*/).map(s=>s.trim()).filter(Boolean);

export function sanitizeDictionaryEntry(entry){
  if(!entry?.zh)return null;
  const override=policy.wordOverrides[entry.zh];
  const listed=override?.senses??senses(entry.en);
  const kept=listed.filter(sense=>!blocked.some(pattern=>pattern.test(sense)));
  // A word with no gloss at all is kept: not knowing what something means is usually the
  // reason it is being saved. A word whose every listed sense was blocked is dropped.
  if(listed.length&&!kept.length)return null;
  return {...entry,pinyin:override?.pinyin??entry.pinyin??'',en:kept.join('; ')};
}

export const dictionaryPolicy=policy;
