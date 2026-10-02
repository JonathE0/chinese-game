import unlock from '../content/unlock.json' with {type:'json'};
import roots from '../content/roots.json' with {type:'json'};
import catalog from '../content/catalog.json' with {type:'json'};
import metro from '../content/metro.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {townSteps,metroOpen,cardDue,giveCard,passCheck,CARD_FLAG} from '../core/unlock.js';
import {openDialogue} from './dialogue.js';
import {openRootsAlbum} from './roots.js';
import {languageLine} from './shell.js';
import {icon} from './art.js';

/**
 * The metro unlock on screen (rules in src/core/unlock.js): the attendant at the shut gates, the
 * chat at the concourse service counter, Auntie Lin's card scene, her call once the town is done,
 * the blurred Yunhai page in Grandfather's album and the townsfolk's hints.
 */
const says=(ctx,line)=>ctx.profile.settings.english===false?line.zh:`${line.zh} / ${line.en}`;
const panelBody=()=>document.querySelector('#panel-body');
const host=unlock.checkLesson.host,photo=roots.memories.find(m=>m.id===unlock.photo);

/** How far the town is: {done, total} over every step src/core/unlock.js counts. */
export function townProgress(ctx){
  const steps=townSteps(ctx.profile,ctx.gateStates);
  return {done:steps.filter(s=>s.done).length,total:steps.length};
}

/** The attendant at the gates while the metro is shut: the locked lines and the town's progress (N / M). */
export function showMetroLocked(ctx){
  const p=ctx.profile,{done,total}=townProgress(ctx),card=p.completed.includes(CARD_FLAG);
  const body=ctx.ui.open('metro-locked',host.zh,`${host.en} · ${unlock.checkLesson.title}`);
  body.innerHTML=`<div class="dialogue-top"><div class="portrait" style="background:${esc(host.color)};color:#fff5da">${esc(host.zh.slice(0,1))}</div><div><b>${esc(host.zh)}</b></div></div>
    ${unlock.locked.map((line,i)=>languageLine(line,p.settings,{className:'dialogue-line'})+`<div class="audio-row"><button class="subtle" data-clip="${i}">${icon('sound',16)} 重听</button></div>`).join('')}
    <div class="gate-note"><b id="unlock-progress">${esc(unlock.questLocked.zh)}（${done} / ${total}）</b>
    <div class="gate-bar"><i style="width:${Math.round(done/total*100)}%"></i></div>
    ${cardDue(p,ctx.gateStates)?`<p><b>${esc(unlock.linCalls.zh)}</b> ${esc(unlock.linCalls.en)}</p>`:''}
    <p class="microcopy">${esc(unlock.questLocked.en)} (${done} / ${total})</p></div>
    ${card?`<button class="primary wide" id="unlock-service">${esc(unlock.checkLesson.title)} · Service centre ${icon('arrow',17)}</button>`:''}`;
  body.querySelectorAll('[data-clip]').forEach(b=>b.onclick=()=>ctx.voice.play(unlock.locked[Number(b.dataset.clip)].audio));
  body.querySelector('#unlock-service')?.addEventListener('click',()=>openMetroCheck(ctx));
  // Both lines, one after the other, unless the player has moved on by then.
  ctx.voice.play(unlock.locked[0].audio).then(()=>{
    const first=ctx.voice.foreground;
    first?.addEventListener('ended',()=>{if(ctx.ui.panelId==='metro-locked'&&ctx.voice.foreground===first)ctx.voice.play(unlock.locked[1].audio);});
  });
}

/** The concourse service counter (服务中心): the attendant's check, which activates Grandpa's card. */
export function openMetroCheck(ctx){
  const p=ctx.profile;
  if(metroOpen(p)){const line=unlock.checkLesson.nodes.at(-1);ctx.ui.notice(says(ctx,line));if(ctx.voice.available(line.audio))ctx.voice.play(line.audio);return;}
  if(!p.completed.includes(CARD_FLAG))return showMetroLocked(ctx);
  // A node that plays a station announcement (metro-<key>) shows that line when its clip is missing,
  // so the question about it can still be answered.
  const heard=n=>n.audio?.startsWith('metro-')&&!ctx.voice.available(n.audio)&&metro.lines[n.audio.slice(6)]?{...n,prompt:metro.lines[n.audio.slice(6)]}:n;
  const lessonData={...unlock.checkLesson,nodes:unlock.checkLesson.nodes.map(heard)};
  openDialogue(ctx,unlock.checkLesson.id,{lessonData,reward:false,onFinish:()=>{
    if(ctx.profile!==p||!passCheck(p))return;
    ctx.music?.cue('reward');ctx.save();
  }});
}

/** Talking to Auntie Lin once the town is done plays the card scene instead of her usual chat. */
export function openLinCard(ctx){
  const p=ctx.profile;
  if(!cardDue(p,ctx.gateStates))return false;
  openDialogue(ctx,unlock.linLesson.id,{lessonData:unlock.linLesson,reward:false,onFinish:()=>{
    if(ctx.profile!==p||!giveCard(p))return;
    const card=catalog.find(i=>i.id===unlock.card);
    ctx.music?.cue('reward');ctx.save();
    ctx.ui.notice(`${card.zh} +1 · ${card.en}`);
    // The new page, opened on the spot, with Grandfather's note read out.
    openRootsAlbum(ctx);
    panelBody()?.querySelector(`[data-memory="${unlock.photo}"]`)?.scrollIntoView({block:'center'});
    if(ctx.voice.available(unlock.photoNote.audio))ctx.voice.play(unlock.photoNote.audio);
  }});
  return true;
}

/** After every save: Lin calls once the town is done, and her label says so until she has given the card. */
export function refreshUnlock(ctx){
  const due=cardDue(ctx.profile,ctx.gateStates),label=document.querySelector('#label-lin');
  if(label){
    let call=label.querySelector('.label-call');
    if(due&&!call){call=document.createElement('em');call.className='label-call';call.style.cssText='display:block;font-style:normal;color:#b8463a';call.textContent=unlock.linCalls.zh;label.append(call);}
    if(!due)call?.remove();
  }
  // Once a session: saves swap the profile for a clone (camera.js, businesses.js); panels.js replaceProfile resets it.
  if(due&&ctx.tutorial?.started&&!ctx.linCalled){ctx.linCalled=true;ctx.ui.notice(says(ctx,unlock.linCalls));}
}

/** Grandfather's Yunhai page, blurred in the album until Lin hands it over. */
export function lockedAlbumPage(ctx){
  if(!photo||ctx.profile.roots?.discovered?.includes(photo.id))return '';
  return `<article class="roots-photo roots-locked" data-locked="${esc(photo.id)}"><div style="overflow:hidden;border-radius:6px"><img src="${esc(photo.image)}" alt="" aria-hidden="true" style="filter:blur(9px) grayscale(.5);transform:scale(1.08)"></div>
    <h3>${esc(photo.zh)}</h3><p>${esc(unlock.questLocked.zh)}</p><p class="roots-english">${esc(unlock.questLocked.en)}</p></article>`;
}

/** Townsfolk's lines about Yunhai join the square's chatter; they fall quiet once the metro is open. */
export const AMBIENT_HINTS=unlock.hints;
export const townHint=(ctx,line)=>line&&AMBIENT_HINTS.includes(line)&&metroOpen(ctx.profile)?null:line;
