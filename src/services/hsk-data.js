import meta from '../content/hsk.json' with {type:'json'};
import {sanitizeDictionaryEntry} from '../content/dictionary-policy.js';
import {assetUrl} from './asset-url.js';

// One copy of the word list, shared by the study hall and by district gating.
let words=null,pending=null;

export {meta};
export function loadedWords(){return words;}

export function loadWords(){
  if(words)return Promise.resolve(words);
  pending??=fetch(assetUrl(meta.wordsFile))
    .then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json();})
    .then(data=>{words=data.words.map(sanitizeDictionaryEntry).filter(Boolean);return words;})
    .catch(error=>{pending=null;throw error;});
  return pending;
}
