import hall from '../content/hall-visitors.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {languageLine,pinyinText} from './shell.js';
import {icon} from './art.js';

/** Someone in the word hall says their one line (src/content/hall-visitors.json). */
export function openHallVisitor(ctx,person){
  if(!person)return;
  const role=hall.roles[person.role],line=hall.lines[person.line];
  const body=ctx.ui.open('dialogue',role.zh,[pinyinText(role.pinyin,role.zh),role.en].filter(Boolean).join(' · '));
  body.innerHTML=`<div class="dialogue-top"><div class="portrait" style="background:${esc(person.color)};color:#fff5da">${esc(role.zh.slice(0,1))}</div><div><b>${esc(role.zh)}</b></div></div>${languageLine(line,ctx.profile.settings,{className:'dialogue-line'})}<div class="audio-row"><button class="subtle" id="replay">${icon('sound',16)} 重听</button><button class="subtle" id="slow">慢速</button><small class="audio-source">${ctx.voice.sourceLabel(line.audio)}</small></div><button class="primary wide" id="line-continue">继续 ${icon('arrow',17)}</button>`;
  body.querySelector('#replay').onclick=()=>ctx.voice.play(line.audio);
  body.querySelector('#slow').onclick=()=>ctx.voice.play(line.audio,{slow:true});
  if(ctx.voice.available(line.audio))ctx.voice.play(line.audio);
  body.querySelector('#line-continue').onclick=()=>ctx.ui.close();
}
