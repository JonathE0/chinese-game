import introductions from '../content/lessons/introductions.json' with {type:'json'};
import cityDirections from '../content/lessons/city-directions.json' with {type:'json'};
import cityTaxi from '../content/lessons/city-taxi.json' with {type:'json'};
import cityNoodles from '../content/lessons/city-noodles.json' with {type:'json'};
import npcs from '../content/npcs.json' with {type:'json'};
import balance from '../content/balance.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';
import {evaluateNode,choicesFor,applyState,finishConversation} from '../core/conversation.js';
import {languageLine} from './shell.js';
import {icon} from './art.js';

// Every lesson the conversation engine knows how to open, keyed by id. A gameplay adapter opens
// one by id; it does not import the JSON itself.
const LESSONS=Object.fromEntries([introductions,cityDirections,cityTaxi,cityNoodles].map(l=>[l.id,l]));

/** Who a lesson's header and portrait speak for: the town NPC it belongs to (Auntie Lin, via her
 *  `npcs.json` `lesson`), or — for a conversation that is not tied to a square NPC, like a
 *  stranger met in Yunhai — the lesson's own `host`. */
function hostOf(lesson) {
  const npc=npcs.find(n=>n.lesson===lesson.id);
  return {npc,info:npc??lesson.host??{}};
}

/**
 * Open any lesson by id. Header and portrait come from the NPC this lesson belongs to, or from
 * the lesson's own `host` when it is not a town-square conversation. Completion grants
 * `lesson:<id>` once and remembers the lesson once, exactly as before, but these conversations are
 * repeatable: `onFinish(state)` runs every time the player finishes it, reward or not, carrying
 * whatever `option` nodes captured along the way (for example `{destination:'一号书店'}`).
 */
export function openDialogue(ctx,lessonId,{onFinish}={}) {
  const lesson=LESSONS[lessonId];
  if (!lesson) return;
  const {npc,info}=hostOf(lesson);
  const subtitle=npc ? `${npc.role} · ${npc.zh}` : `${info.zh} · ${info.en}`;
  const body=ctx.ui.open('dialogue',lesson.title,subtitle);
  let index=0,supported=false,state={};
  function render() {
    const node=lesson.nodes[index];ctx.hinted=false;
    const portraitStyle=npc ? '' : ` style="background:${esc(info.color)};color:#fff5da"`;
    const badge=npc?.role ? `<span>${esc(npc.role.slice(0,1))}</span>` : '';
    const name=node.speaker==='narrator' ? '你的第一句话' : esc(info.zh??'');
    const nextLabel=index===lesson.nodes.length-1 ? '完成对话' : '继续';
    const answerArea=node.intent==='none'
      ? `<button class="primary" id="next-line">${nextLabel} ${icon('arrow',17)}</button>`
      : `<form id="answer-form"><label for="answer">你说</label><div class="answer-row"><input id="answer" name="answer" autocomplete="off" maxlength="100" placeholder="输入中文…" aria-label="你的回答"><button type="button" id="microphone" class="mic-button" aria-label="麦克风回答">${icon('mic')}</button><button type="submit" class="primary compact" aria-label="提交回答">${icon('arrow')}</button></div></form><p id="speech-status" class="microcopy" aria-live="polite">${ctx.speech.supported?'语音识别可能使用浏览器的在线服务。文字可修改后提交。':'此浏览器语音不可用，可打字或选择回答。'}</p><details class="answer-options"><summary>需要一个例子？</summary><div>${choicesFor(node).map(c=>`<button class="choice" data-answer="${esc(c)}">${esc(c)}</button>`).join('')}</div><p class="microcopy">选择例句算作辅助练习。</p></details><div id="answer-feedback" aria-live="polite"></div>`;
    body.innerHTML=`<div class="dialogue-top"><div class="portrait"${portraitStyle}>${esc((info.zh??'').slice(0,1))}${badge}</div><div><b>${name}</b><small>${node.register==='casual'?'日常口语':esc(lesson.title)}</small></div><span class="step-label">${index+1} / ${lesson.nodes.length}</span></div><div class="step-track">${lesson.nodes.map((_,i)=>`<i class="${i<=index?'active':''}"></i>`).join('')}</div>${languageLine(node,ctx.profile.settings,{className:'dialogue-line'})}<div class="audio-row"><button class="subtle" id="replay">${icon('sound',16)} 重听</button><button class="subtle" id="slow">慢速</button><small class="audio-source">${ctx.voice.sourceLabel(node.audio)}</small></div>${answerArea}`;
    body.querySelector('#replay').onclick=()=>ctx.voice.play(node.audio);body.querySelector('#slow').onclick=()=>ctx.voice.play(node.audio,{slow:true});
    if (node.speaker!=='narrator'&&ctx.voice.available(node.audio)) ctx.voice.play(node.audio);
    if (node.intent==='none') { body.querySelector('#next-line').onclick=()=>advance(); return; }
    body.querySelector('#microphone').onclick=()=>ctx.speech.start({onTranscript:t=>body.querySelector('#answer').value=t,onStatus:t=>body.querySelector('#speech-status').textContent=t});
    body.querySelector('details').addEventListener('toggle',e=>{if(e.target.open){supported=true;ctx.hinted=true;}});
    body.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{body.querySelector('#answer').value=b.dataset.answer;supported=true;submit();});
    body.querySelector('#answer-form').onsubmit=e=>{e.preventDefault();if(e.isComposing)return;submit();};
    function submit() {
      const result=evaluateNode(node,body.querySelector('#answer').value);const feedback=body.querySelector('#answer-feedback');
      if (!result.ok) { feedback.className='feedback gentle';feedback.textContent='我还没明白。换个说法，或看看例子？';const help=document.createElement('p');help.className='microcopy';help.textContent='This prototype recognizes curated answers. An unrecognized response is not necessarily incorrect Chinese.';feedback.append(help);if(node.hint&&ctx.profile.settings.english){const hint=document.createElement('p');hint.className='usage';hint.textContent=node.hint;feedback.append(hint);ctx.hinted=true;}return; }
      ctx.speech.stop();supported ||=ctx.hinted;if(node.intent==='name')ctx.profile.playerName=result.value;
      state=applyState(state,node,result);
      body.querySelector('#answer-form').hidden=true;body.querySelector('.answer-options').hidden=true;feedback.className='feedback success';feedback.innerHTML=`<b>${node.intent==='name'?`很高兴认识你，${esc(result.value)}！`:'听懂了！'}</b><button id="next-line" class="primary">${nextLabel} ${icon('arrow',17)}</button>`;
      body.querySelector('#next-line').onclick=()=>advance();
    }
  }
  function advance() { index++;if(index<lesson.nodes.length)render();else finish(); }
  function finish() {
    // Pays and remembers the lesson now, and arms onFinish to run once when this panel closes —
    // by its button, Esc or × alike. Closing any earlier screen runs nothing.
    const {amount}=finishConversation(ctx.profile,lesson.id,supported?balance.supportedLessonCoins:balance.lessonCoins,{hook:ctx.ui.closeHook,state,onFinish});
    ctx.save();
    // Auntie Lin's first conversation keeps its own hand-written send-off; every other lesson
    // does not have bespoke flavor text, so it falls back to its own authored title and English
    // line rather than inventing new Chinese for the completion screen.
    const headline=lesson.id==='introductions' ? '认识新朋友了！' : esc(lesson.title);
    const send=lesson.id==='introductions' ? '一句你好，让旅程更近了一点。' : esc(lesson.en);
    body.innerHTML=`<div class="completion"><div class="completion-seal">好</div><div class="eyebrow">A LITTLE CONNECTION</div><h3>${headline}</h3><p>${send}</p><div class="reward">${icon('coin')} +${amount} 学习币</div><p class="microcopy">${amount?'奖励已存入你的钱包。':'你已经领取过这段对话的奖励。练习仍然有价值。'}</p><button class="primary" id="back-town">回到小镇 ${icon('arrow')}</button></div>`;
    body.querySelector('#back-town').onclick=()=>ctx.ui.close();
  }
  render();
}

/**
 * Show and voice one of a lesson's `extraLines` — a beat a gameplay adapter triggers outside the
 * conversation itself, after `onFinish` runs (arriving somewhere, being served, and so on).
 * `onDone` runs once when the line is closed, whether by 继续, Esc or ×.
 */
export function showLine(ctx,lessonId,key,{onDone}={}) {
  const lesson=LESSONS[lessonId];
  const line=lesson?.extraLines?.[key];
  if (!line) return;
  const {npc,info}=hostOf(lesson);
  const subtitle=npc ? `${npc.role} · ${npc.zh}` : `${info.zh} · ${info.en}`;
  // onDone runs once when this line's panel closes, however it closes.
  const body=ctx.ui.open('dialogue',lesson.title,subtitle,{onClose:onDone});
  // A narrator line (arriving somewhere, say) is nobody's speech: no portrait, and the lesson's
  // own title as its label rather than the host's name.
  const narrator=line.speaker==='narrator';
  const portraitStyle=npc ? '' : ` style="background:${esc(info.color)};color:#fff5da"`;
  const badge=npc?.role ? `<span>${esc(npc.role.slice(0,1))}</span>` : '';
  const portrait=narrator ? '' : `<div class="portrait"${portraitStyle}>${esc((info.zh??'').slice(0,1))}${badge}</div>`;
  const name=narrator ? esc(lesson.title) : esc(info.zh??'');
  body.innerHTML=`<div class="dialogue-top">${portrait}<div><b>${name}</b></div></div>${languageLine(line,ctx.profile.settings,{className:'dialogue-line'})}<div class="audio-row"><button class="subtle" id="replay">${icon('sound',16)} 重听</button><button class="subtle" id="slow">慢速</button><small class="audio-source">${ctx.voice.sourceLabel(line.audio)}</small></div><button class="primary wide" id="line-continue">继续 ${icon('arrow',17)}</button>`;
  body.querySelector('#replay').onclick=()=>ctx.voice.play(line.audio);body.querySelector('#slow').onclick=()=>ctx.voice.play(line.audio,{slow:true});
  if (ctx.voice.available(line.audio)) ctx.voice.play(line.audio);
  body.querySelector('#line-continue').onclick=()=>ctx.ui.close();
}
