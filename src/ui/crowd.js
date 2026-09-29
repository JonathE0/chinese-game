import crowd from '../content/crowd.json' with {type:'json'};
import objects from '../content/objects.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {bump} from '../core/daily.js';
import {languageLine,pinyinText} from './shell.js';
import {icon} from './art.js';

/** Someone walking around 云海 says their one line (src/content/crowd.json), like the word hall's people. */
export function openCrowd(ctx,id){
  const person=ctx.town.crowd?.people[Number(id)];
  if(!person)return;
  bump(ctx.profile,'talks');
  const name=objects.objects.pedestrian,line=crowd.lines[person.line];
  const body=ctx.ui.open('dialogue',name.zh,[pinyinText(name.pinyin,name.zh),name.en].filter(Boolean).join(' · '));
  body.innerHTML=`<div class="dialogue-top"><div class="portrait" style="background:${esc(person.color)};color:#fff5da">${esc(name.zh.slice(0,1))}</div><div><b>${esc(name.zh)}</b></div></div>${languageLine(line,ctx.profile.settings,{className:'dialogue-line'})}<div class="audio-row"><button class="subtle" id="replay">${icon('sound',16)} 重听</button><button class="subtle" id="slow">慢速</button><small class="audio-source">${ctx.voice.sourceLabel(line.audio)}</small></div><button class="primary wide" id="line-continue">继续 ${icon('arrow',17)}</button>`;
  body.querySelector('#replay').onclick=()=>ctx.voice.play(line.audio);
  body.querySelector('#slow').onclick=()=>ctx.voice.play(line.audio,{slow:true});
  if(ctx.voice.available(line.audio))ctx.voice.play(line.audio);
  body.querySelector('#line-continue').onclick=()=>ctx.ui.close();
}
