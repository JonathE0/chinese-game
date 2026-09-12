import stories from '../content/stories.json' with {type:'json'};
import objectNames from '../content/objects.json' with {type:'json'};

/**
 * Which books you can read yet.
 *
 * A story lists the vocabulary it leans on. A word counts as yours if you have collected it in
 * the town, saved it from a lookup, or answered it correctly at least once in the word hall —
 * the same evidence the district gates accept, so nothing here asks you to learn twice.
 *
 * The point of the gate is not to lock you out. A book you cannot read yet tells you exactly
 * which words are missing and offers them, a few at a time, so the shelf is a reading list
 * rather than a wall.
 */
const NAMES=objectNames.objects;
export const COMFORTABLE=.85;      // read it now
export const STRETCH=.6;           // hard going, but allowed
export const OFFER=6;              // how many missing words to hand over at once

/** Every Chinese word this player has evidence of knowing. */
export function knownWords(profile,hskWords=null){
  const known=new Set();
  for(const id of profile.discovered??[])if(NAMES[id]?.zh)known.add(NAMES[id].zh);
  for(const word of profile.saved??[])if(word.zh)known.add(word.zh);
  for(const word of hskWords??[])
    if((profile.words?.[word.id]?.recognition?.stage??0)>=1&&word.zh)known.add(word.zh);
  return known;
}

/** How ready this reader is for one book. */
export function readiness(profile,story,hskWords=null,known=null){
  const vocabulary=story.words??[];
  const have=known??knownWords(profile,hskWords);
  const missing=vocabulary.filter(word=>!have.has(word));
  const total=vocabulary.length||1;
  const ratio=(total-missing.length)/total;
  const state=ratio>=COMFORTABLE?'comfortable':ratio>=STRETCH?'stretch':'locked';
  return {known:total-missing.length,total,ratio,missing,state,readable:state!=='locked'};
}

/** The shelves, each with its books and how each one sits with this reader. */
export function shelves(profile,hskWords=null){
  const have=knownWords(profile,hskWords);
  const grouped=new Map();
  for(const story of stories.stories){
    const list=grouped.get(story.shelf)??[];
    list.push({story,...readiness(profile,story,hskWords,have)});
    grouped.set(story.shelf,list);
  }
  return grouped;
}

export const storyById=id=>stories.stories.find(story=>story.id===id)??null;
export const allStories=()=>stories.stories;

export const SHELVES={
  beginner:{zh:'入门架',pinyin:'Rùmén jià',en:'First shelf',note:'HSK 1'},
  everyday:{zh:'日常架',pinyin:'Rìcháng jià',en:'Everyday shelf',note:'HSK 2'},
  stories:{zh:'故事架',pinyin:'Gùshi jià',en:'Story shelf',note:'HSK 3–4'},
};

export const STATE_LABELS={
  comfortable:{zh:'读得下来',en:'Comfortable'},
  stretch:{zh:'有点难',en:'A stretch'},
  locked:{zh:'还太难',en:'Too hard for now'},
};

/** Mark a book as read, once. */
export function finishStory(profile,storyId){
  profile.read??=[];
  if(profile.read.includes(storyId))return false;
  profile.read.push(storyId);
  return true;
}
export const hasRead=(profile,storyId)=>!!profile.read?.includes(storyId);
