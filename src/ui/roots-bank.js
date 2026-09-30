import data from '../content/roots.json' with {type:'json'};
import businesses from '../content/businesses.json' with {type:'json'};
import {openDialogue} from './dialogue.js';
export function mountRootsBank(ctx,body,reopen){
 if(!ctx.profile.businesses?.['fruit-stand']?.active)return;
 const button=document.createElement('button');button.id='roots-bank-automate';button.className='secondary';button.textContent='Arrange automatic deposits · '+businesses['fruit-stand'].automation+' coins';button.disabled=!!ctx.profile.businesses['fruit-stand'].automatic;body.append(button);
 button.onclick=async()=>{const p=ctx.profile;if(!p.roots.bankMastered){const successes=new Set();openDialogue(ctx,'roots-bank',{lessonData:data.bankLesson,reward:false,englishSupport:true,onAttempt:({node,result,assisted})=>{if(ctx.profile===p&&result.ok&&!assisted)successes.add(node.id);},onFinish:()=>{if(ctx.profile!==p)return;p.roots.bankMastered=successes.size===data.bankLesson.nodes.length;ctx.save();reopen();}});return;}button.disabled=true;try{const result=await ctx.businessCommand('automate');ctx.ui.notice(result.message);reopen();}finally{if(button.isConnected)button.disabled=false;}};
}
