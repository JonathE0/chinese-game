/**
 * The vocabulary bank: everything the player has picked up by looking at the world or by
 * highlighting text. Entries need a stable, storage-safe id so they can join the same spaced
 * review schedule as HSK words — Chinese characters cannot be used as ids directly.
 */
import {sanitizeDictionaryEntry} from '../content/dictionary-policy.js';

const MAX_WORDS=2000;

export function wordId(zh){
  let hash=2166136261;
  for(const ch of zh){hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619)>>>0;}
  return 'bank-'+hash.toString(36);
}

/** Add a word if it is new. Returns the entry, or null when it was already there. */
export function addWord(profile,{zh,pinyin,en,audio=null,definitionZh,definitionSource,definitionTitle,readings}){
  if(!zh)return null;
  const clean=sanitizeDictionaryEntry({zh,pinyin,en});
  if(!clean)return null;
  profile.saved??=[];
  if(profile.saved.some(w=>w.zh===zh))return null;
  if(profile.saved.length>=MAX_WORDS)return null;
  const entry={id:wordId(zh),...clean};
  if(definitionZh)Object.assign(entry,{definitionZh,definitionSource,...(definitionTitle?{definitionTitle}:{}),...(readings?{readings}:{})});
  if(audio)entry.audio=audio;
  profile.saved.push(entry);
  return entry;
}

export function hasWord(profile,zh){return (profile.saved??[]).some(w=>w.zh===zh);}

/** Older saves stored words without an id; fill it in on the way through. */
export function normaliseBank(saved){
  return (saved??[]).flatMap(w=>{
    const clean=sanitizeDictionaryEntry(w);
    return clean?[{id:w.id??wordId(w.zh),...clean,...(w.audio?{audio:w.audio}:{})}]:[];
  });
}

export const dueWords=(profile,now=Date.now())=>
  (profile.saved??[]).filter(w=>{const r=profile.words[w.id]?.recognition;return r&&r.due<=now;});
