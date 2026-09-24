import radicals from '../content/radicals.json' with {type:'json'};
import balance from '../content/balance.json' with {type:'json'};
import {grant} from './economy.js';

export const HUNTS=radicals.hunts;
/** People are never in the collection book or a hunt target, whatever characters they contain. */
export const PEOPLE=new Set(['person','waiter','vendor']);
const hasAny=(zh,chars)=>[...chars].some(ch=>zh.includes(ch));

/** A hunt's targets: the ids among `names` ({id,zh}) whose zh contains any of its characters. */
export const huntTargets=(hunt,names)=>names.filter(n=>!PEOPLE.has(n.id)&&hasAny(n.zh,hunt.chars)).map(n=>n.id);

/** The hunts worth showing, each with its targets: a hunt with fewer than three is dropped. */
export const activeHunts=names=>HUNTS.map(hunt=>({...hunt,targets:huntTargets(hunt,names)})).filter(hunt=>hunt.targets.length>=3);

/** Whether a named object ({id,zh}) counts towards any hunt, for the daily `hunt-found` count. */
export const inAnyHunt=name=>!PEOPLE.has(name.id)&&HUNTS.some(hunt=>hasAny(name.zh,hunt.chars));

/** Pays huntCoins once, when every target has been named. Returns the coins paid (0 if not). */
export function claimHunt(profile,hunt,targets){
  if(!targets.length||!targets.every(id=>profile.discovered.includes(id)))return 0;
  return grant(profile,'hunt:'+hunt.id,balance.huntCoins);
}
