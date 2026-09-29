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

/**
 * F on whatever the crosshair names. An object joins `discovered` (and the bank) once; a sign's
 * exact phrase only joins the bank, so reading signs never counts as naming objects. A name that
 * carries its own `audio` (a dish on the hotpot table: its catalog clip) keeps that clip.
 */
export function collectLook(profile,name){
  const clip=name.audio??(name.sign?'sign-'+name.id.replace(/^sign:/,''):'obj-'+name.id);
  if(knowsLook(profile,name))return {clip,isNew:false};
  if(!name.sign)profile.discovered.push(name.id);
  const added=addWord(profile,{zh:name.zh,pinyin:name.pinyin,en:name.en,audio:clip});
  return {clip,isNew:!name.sign||!!added};
}
/** A sign is known once its phrase is in the bank; an object once it has been named. */
export function knowsLook(profile,name){
  return name.sign?(profile.saved??[]).some(word=>word.zh===name.zh):profile.discovered.includes(name.id);
}
