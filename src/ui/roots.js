import businesses from '../content/businesses.json' with {type:'json'};
import {rootsBilingual,rootsLabel,rootsObjectiveEnglish} from '../core/roots-language.js';
import {storyPhotos} from '../services/photos.js';
import data from '../content/roots.json' with {type:'json'};
import {applyRootsEvent,currentRootsObjective,readyToOpen} from '../core/roots.js';
import {recordAttempt,mastered} from '../core/mastery.js';
import {openDialogue} from './dialogue.js';
import {languageLine} from './shell.js';
import {escapeHtml as esc} from '../core/language.js';
const venture=businesses['fruit-stand'];
const words=(ctx,line)=>{const english='<p class="roots-english">'+esc(line.en)+'</p>',chinese=languageLine(line,ctx.profile.settings);return rootsBilingual(ctx.profile)?chinese+english:english+'<details class="roots-mandarin"><summary>Read in Mandarin</summary>'+chinese+'</details>';};
const label=(ctx,key)=>rootsLabel(ctx.profile,key);
const objective=ctx=>'<p class="roots-goal">'+esc(rootsObjectiveEnglish(ctx.profile))+(rootsBilingual(ctx.profile)?'<small>'+esc(currentRootsObjective(ctx.profile))+'</small>':'')+'</p>';
const photoGuide=()=>'<section id="roots-photo-guide"><h3>'+esc(data.onboarding.photoTitle)+'</h3><ol>'+data.onboarding.photoSteps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol><p>'+esc(data.onboarding.filmGuide)+'</p></section>';
const button=(id,text)=>'<button class="primary" id="'+id+'">'+esc(text)+'</button>';
export function showRootsOpening(ctx){if(ctx.readOnly)return;const first=!ctx.profile.roots?.started;applyRootsEvent(ctx.profile,{type:'begin'});ctx.save();if(first)ctx.ui.notice('Your grandfather has passed away. His final gift, a photo album, is in your journal.');}
export function openRootsAlbum(ctx){
 showRootsOpening(ctx);const p=ctx.profile,r=p.roots,body=ctx.ui.open('roots',label(ctx,'title'),'寻根 · Roots');
 body.innerHTML=objective(ctx)+photoGuide()+'<details id="roots-opening"><summary>Read Grandfather’s letter</summary>'+words(ctx,data.opening)+words(ctx,data.letter)+'</details>'+'<p>Film remaining: '+(p.inventory.film??0)+'</p><div class="roots-grid">'+data.memories.filter(m=>r.discovered.includes(m.id)).map(m=>'<article class="roots-photo" data-memory="'+m.id+'"><p class="microcopy">Then — Grandfather’s photo</p><img src="'+m.image+'" alt="'+esc(m.en)+'" /><h3>'+esc(rootsBilingual(p)?m.en+' · '+m.zh:m.en)+(r.photos.includes(m.id)?' ✓':'')+'</h3>'+words(ctx,m.clue)+(m.keepsake?'':button('photo-'+m.id,label(ctx,'photo')))+'</article>').join('')+'</div>'+button('roots-personal',label(ctx,'personal'))+button('roots-film',label(ctx,'film')+' · '+data.film.price+' coins / '+data.film.pack+' shots')+button('roots-journal',label(ctx,'journal'))+(r.journal?'<p>'+esc(data.onboarding.journalEntry)+'</p>':'');
 storyPhotos(r.id).then(list=>{if(!body.isConnected||ctx.ui.panelId!=='roots')return;for(const m of data.memories){const host=body.querySelector('[data-memory="'+m.id+'"]');if(!host)continue;const shot=list.filter(p=>p.memoryId===m.id).at(-1);if(shot){const img=document.createElement('img');img.src=shot.src;img.alt='Today: '+m.en;const caption=document.createElement('p');caption.className='microcopy';caption.textContent='Now — your photo';host.append(caption,img);}else if(r.photos.includes(m.id)){const p=document.createElement('p');p.textContent='This photo is not saved on this device. Recreate it here for free; your progress is safe.';host.append(p);}}}).catch(()=>{});
 for(const m of data.memories)body.querySelector('#photo-'+m.id)?.addEventListener('click',()=>{ctx.storyMemory=m.id;ctx.ui.close();ctx.town.onCamera?.(true);});
 body.querySelector('#roots-personal').onclick=()=>{ctx.storyMemory=null;ctx.ui.close();ctx.town.onCamera?.(true);};
 body.querySelector('#roots-film').onclick=()=>{if(p.wallet<data.film.price||(p.inventory.film??0)>994){ctx.ui.notice('You need more coins, or your film inventory is full.');return;}p.wallet-=data.film.price;p.inventory.film=(p.inventory.film??0)+data.film.pack;ctx.save();openRootsAlbum(ctx);};
 body.querySelector('#roots-journal').onclick=()=>{applyRootsEvent(p,{type:'journal'});ctx.save();openRootsAlbum(ctx);};
}
export function openRootsPractice(ctx){
 const r=ctx.profile.roots,skill=data.skills.find(s=>!mastered(r.mastery,s.id,data.skills));
 if(!skill)return openRootsCaretaker(ctx);
 const used=r.mastery[skill.id]??[],last=ctx.rootsLastVariant;
 const node=skill.variants.find(v=>!used.includes(v.id)&&v.id!==last)??skill.variants.find(v=>!used.includes(v.id));ctx.rootsLastVariant=node.id;
 openDialogue(ctx,'roots-practice',{reward:false,englishSupport:true,lessonData:{id:'roots-practice',title:label(ctx,'practice'),en:'Practice, then try another question independently.',host:{zh:data.caretaker.zh,en:data.caretaker.en,color:'#83996f'},nodes:[node]},onAttempt:({result,assisted})=>{r.mastery=recordAttempt(r.mastery,{skillId:skill.id,variantId:node.id,ok:result.ok,assisted},data.skills);ctx.save();},onFinish:()=>openRootsPractice(ctx)});
}
export function openRootsCaretaker(ctx){
 showRootsOpening(ctx);const p=ctx.profile,r=p.roots,body=ctx.ui.open('roots-caretaker',data.caretaker.en,'Fruit stand · 水果摊');
 body.innerHTML=words(ctx,r.met?data.caretaker.memory:data.caretaker.greeting)+button('roots-show',label(ctx,'show'))+(r.met?'<p>'+venture.daily+' coins per real day · '+(p.businesses?.['fruit-stand']?.automatic?'Automatic deposits':'Collect here in person')+'</p>'+objective(ctx)+button('roots-practice',label(ctx,'practice'))+button('roots-album',label(ctx,'title'))+button('roots-activate',label(ctx,'open')+' · '+venture.activation+' coins')+button('roots-collect',label(ctx,'collect'))+button('roots-automate',label(ctx,'automate')+' · '+venture.automation+' coins')+'<p id="business-status" aria-live="polite">'+esc(document.body.classList.contains('admin')?'Admin preview: test income only.':'Sign in online to open the stand and collect earnings. Progress is saved while offline.')+'</p>':'');
 if(!r.met)ctx.voice.play('roots-caretaker-greeting');
 body.querySelector('#roots-show').onclick=()=>{applyRootsEvent(p,{type:'meet'});ctx.save();openRootsCaretaker(ctx);ctx.voice.play('roots-caretaker-memory');};
 body.querySelector('#roots-practice')?.addEventListener('click',()=>openRootsPractice(ctx));body.querySelector('#roots-album')?.addEventListener('click',()=>openRootsAlbum(ctx));
 for(const [id,action]of [['activate','activate'],['collect','collect'],['automate','automate']]){const b=body.querySelector('#roots-'+id);if(!b)continue;b.disabled=action==='activate'&&!readyToOpen(p);b.onclick=async()=>{b.disabled=true;try{if(action==='automate'){ctx.ui.notice('请到青禾银行办理自动存款。 / Visit Qinghe Bank to arrange automatic deposits.');return;}const result=await ctx.businessCommand?.(action);const status=body.querySelector('#business-status');if(status)status.textContent=result?.message??data.ui.pending;
 if(result?.status==='settled'){refreshRootsWorld(ctx);openRootsCaretaker(ctx);}}finally{if(b.isConnected)b.disabled=false;}};}
}

export function refreshRootsWorld(ctx){if(!ctx.town)return;if(!ctx.profile.businesses?.['fruit-stand']?.active){ctx.rootsSign?.destroy();ctx.rootsSign=null;return;}if(ctx.rootsSign)return;if(ctx.profile.businesses?.['fruit-stand']?.active){ctx.rootsSign=ctx.town.m.box(ctx.town.root,[-6.4,1.1,-.8],[1.1,.35,.1],'#e8bd55');ctx.rootsSign.name='roots-open-sign';}}

export function openRootsWelcome(ctx,onClose){const body=ctx.ui.open('roots-welcome',label(ctx,'title'),'寻根 · Roots',{onClose});body.innerHTML=words(ctx,data.opening)+'<p>'+esc(data.onboarding.welcome)+'</p>'+words(ctx,data.letter)+'<p class="roots-goal">'+esc(data.onboarding.firstStep)+'</p>'+button('roots-welcome-close','Start exploring');body.querySelector('#roots-welcome-close').onclick=()=>ctx.ui.close();}
