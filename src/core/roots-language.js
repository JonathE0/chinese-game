import data from '../content/roots.json' with {type:'json'};
import {readyToOpen} from './roots.js';
import {mastered} from './mastery.js';
/** Familiar language appears after an independent skill milestone, not merely elapsed time. */
export const rootsBilingual=p=>data.skills.some(s=>mastered(p.roots?.mastery??{},s.id,data.skills));
export function rootsLabel(p,key){const english=data.onboarding.ui[key]??key;return rootsBilingual(p)&&data.ui[key]?english+' · '+data.ui[key]:english;}
export function rootsObjectiveEnglish(p){const o=data.onboarding.objectives;if(!p.roots?.started)return o.album;if(!p.roots.met)return o.meet;if(!p.roots.photos.includes('roots-fruit'))return o.photo;if(!readyToOpen(p))return o.practice;return p.businesses?.['fruit-stand']?.active?o.collect:o.open;}
