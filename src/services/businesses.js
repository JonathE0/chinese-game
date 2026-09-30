import {user,businessRpc} from './cloud.js';import {mergeBusinessResult} from '../core/business-sync.js';import {applyRootsEvent} from '../core/roots.js';import {SAVE_KEY,saveProfile} from '../core/profile.js';
const messages={settled:'Earnings and progress saved.',conflict:'Your cloud save has changed. Sync in Settings first.',funds:'You need more coins.',requirements:'Finish the practice and recreate the photo first.',inactive:'Reopen the fruit stand first.','already-active':'The fruit stand is already open.','already-automatic':'Automatic deposits are already active.'};
export function installBusinesses(ctx,flush,api={user,businessRpc}){
 let busy=false;
 ctx.businessCommand=async action=>{
  if(busy)return {message:'Please wait while this is processed.'};
  if(!ctx.cloud||ctx.readOnly||ctx.holdSync||ctx.cloud.hold)return {message:'Sign in online and finish syncing to open the stand or collect income.'};
  busy=true;let key,pending;
  try{
   const who=await api.user();if(!who)return {message:'Please sign in first.'};key=SAVE_KEY+'.business-request.'+who.id;
   try{pending=JSON.parse(localStorage.getItem(key));}catch{}
   if(pending&&pending.action!==action)return {message:'上次操作还未确认，请先重试'+pending.action+'。'};
   if(!pending){const before=JSON.stringify(ctx.profile);const saved=await flush();if(saved!=='saved'||JSON.stringify(ctx.profile)!==before||ctx.cloud.busy||ctx.cloud.hold||ctx.holdSync||!ctx.cloud.seen)return {message:'Finish cloud sync in Settings, then try again.'};pending={id:crypto.randomUUID(),action,seen:ctx.cloud.seen,base:structuredClone(ctx.profile)};localStorage.setItem(key,JSON.stringify(pending));}
   if((await api.user())?.id!==who.id)return {message:messages.conflict};
   const initial=ctx.profile;ctx.cloud.busy=true;ctx.businessPending=true;
   let result;
   for(let attempt=0;attempt<2;attempt++){try{result=await api.businessRpc(action,pending.id,pending.seen);break;}catch(error){if(attempt===0&&error.code==='P0001'&&/too many saves/.test(error.message)){await new Promise(r=>setTimeout(r,5200));continue;}throw error;}}
   const current=await api.user();if(current?.id!==who.id||ctx.profile!==initial)return {message:'Your account or save changed. Sync before trying again.'};
   if(result.status==='settled'){
    if(result.profile.businessRevision!==pending.id){ctx.cloud.seen=undefined;localStorage.removeItem(key);return {message:messages.conflict};}
    const next=mergeBusinessResult(ctx.profile,result,pending.base,who.id,current.id);applyRootsEvent(next,{type:'activated'});saveProfile(localStorage,next);ctx.profile=next;ctx.cloud.seen=result.seen;localStorage.setItem(SAVE_KEY+'.cloud-seen.'+who.id,result.seen);ctx.save();
   }else if(result.status==='conflict')ctx.cloud.seen=undefined;
   localStorage.removeItem(key);return {...result,message:messages[result.status]??'Sync your save, then try again.'};
  }catch(error){return {message:error?.code==='PGRST202'?'The income service is not configured for this build yet.':'Unable to connect. Your request is saved and can be safely retried.'};}
  finally{busy=false;ctx.businessPending=false;if(ctx.cloud)ctx.cloud.busy=false;}
 };
 const auto=()=>{if(ctx.profile.businesses?.['fruit-stand']?.automatic&&!ctx.ui.panelId&&!ctx.businessPending)ctx.businessCommand('collect');};
 addEventListener('online',auto);setInterval(auto,60000);
}
