import catalog from '../content/catalog.json' with {type:'json'};
import sites from '../content/sites.json' with {type:'json'};
import {holdsPermit} from './finance.js';
import {claimPeriod} from './calendar.js';

/**
 * Build sites.
 *
 * A site is deliberately slow. It wants a permit from the bank, then a pile of materials that
 * you cannot buy in one afternoon — some of it comes from the builders' merchant, some from
 * helping out on site as a daily errand — and it accepts them a few at a time, so the thing
 * gets built over days rather than in one transaction. What you get back is a shop that opens
 * for business and pays a small amount into your wallet every morning it is standing.
 *
 * Nothing here can be undone by accident: materials handed in are gone, and the panel says so
 * before it takes them.
 */
export const SITES=sites.sites;
export const siteById=id=>SITES.find(site=>site.id===id)??null;
const byId=id=>catalog.find(item=>item.id===id);

/** What has been handed in so far. */
export const progressOf=(profile,siteId)=>profile.builds?.[siteId]?.given??{};
export const isBuilt=(profile,siteId)=>!!profile.builds?.[siteId]?.done;

/** Everything a site still wants, with what you are carrying against it. */
export function requirements(profile,site){
  const given=progressOf(profile,site.id);
  return site.needs.map(need=>{
    const done=Math.min(need.count,given[need.item]??0);
    return {...need,item:byId(need.item),id:need.item,done,
      held:profile.inventory?.[need.item]??0,short:need.count-done};
  });
}

export function siteState(profile,site){
  if(isBuilt(profile,site.id))return 'built';
  if(site.permit&&!holdsPermit(profile,site.permit))return 'permit';
  return requirements(profile,site).every(row=>row.short<=0)?'ready':'gathering';
}

/** How far along the whole thing is, 0 to 1. */
export function completion(profile,site){
  const rows=requirements(profile,site);
  const wanted=rows.reduce((sum,row)=>sum+row.count,0)||1;
  return rows.reduce((sum,row)=>sum+row.done,0)/wanted;
}

/** Hand over everything you are carrying of one material. Returns how much was taken. */
export function contribute(profile,site,itemId){
  if(isBuilt(profile,site.id))return 0;
  const row=requirements(profile,site).find(entry=>entry.id===itemId);
  if(!row||row.short<=0)return 0;
  const moving=Math.min(row.short,profile.inventory?.[itemId]??0);
  if(moving<=0)return 0;
  profile.inventory[itemId]-=moving;
  if(profile.inventory[itemId]<=0)delete profile.inventory[itemId];
  profile.builds??={};
  const record=profile.builds[site.id]??={given:{},done:false};
  record.given[itemId]=(record.given[itemId]??0)+moving;
  return moving;
}

/** Raise it. Only possible once every requirement is met and the permit is in hand. */
export function raise(profile,site){
  if(siteState(profile,site)!=='ready')return {ok:false,reason:siteState(profile,site)};
  profile.builds??={};
  profile.builds[site.id]={...(profile.builds[site.id]??{given:{}}),done:true};
  if(site.unlocks&&!profile.completed.includes(site.unlocks))profile.completed.push(site.unlocks);
  return {ok:true,site};
}

/** Everything standing and trading. */
export const builtSites=profile=>SITES.filter(site=>isBuilt(profile,site.id));

/**
 * The morning takings, paid once per day per site. Small on purpose: a built shop is a reason
 * to build the next one, not a reason to stop playing.
 */
export function collectIncome(profile,day){
  let total=0;
  for(const site of builtSites(profile)){
    if(!claimPeriod(profile,'income:'+site.id,day))continue;
    total+=site.income??0;
  }
  if(total)profile.wallet+=total;
  return total;
}
