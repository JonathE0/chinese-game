import businesses from '../content/businesses.json' with {type:'json'};
import {readyToOpen,applyRootsEvent} from '../core/roots.js';
/** Admin preview only. Never imported by a production build; never writes production rows. */
export function installTestBusinesses(ctx){
 if(!import.meta.env.DEV)throw Error('Test ledger unavailable');
 ctx.testBusinesses=true;const config=businesses['fruit-stand'];
 ctx.businessCommand=async action=>{
  const p=ctx.profile,key='qinghe.test-business.'+p.roots.id,now=Date.now();let ledger;
  try{ledger=JSON.parse(localStorage.getItem(key));}catch{}
  if(!ledger){if(action!=='activate'||!readyToOpen(p))return {status:'requirements',message:'测试：请先完成练习和照片。'};if(p.wallet<config.activation)return {status:'funds',message:'测试：学习币不足。'};p.wallet-=config.activation;ledger={automatic:false,at:now,remainder:0};}
  else{
   if(action==='activate')return {status:'already-active',message:'测试：水果摊已经开张。'};
   if(action==='automate'&&(ledger.automatic||!p.roots.bankMastered||p.wallet<config.automation))return {status:'requirements',message:'测试：请先完成银行练习，准备足够的学习币。'};
   const hours=ledger.automatic?config.automaticHours:config.manualHours,earned=Math.min(Math.max(now-ledger.at,0),hours*3600000)*config.daily/86400000+ledger.remainder;
   const paid=Math.floor(earned);p.wallet+=paid;ledger.at=now;ledger.remainder=earned-paid;
   if(action==='automate'){p.wallet-=config.automation;ledger.automatic=true;}
  }
  localStorage.setItem(key,JSON.stringify(ledger));p.businesses={'fruit-stand':{active:true,automatic:ledger.automatic,settledAt:new Date(now).toISOString()}};applyRootsEvent(p,{type:'activated'});ctx.save();return {status:'settled',message:'测试收入已保存；不会影响线上存档。'};
 };
}
