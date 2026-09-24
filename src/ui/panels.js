import catalog from '../content/catalog.json' with {type:'json'};
import ambient from '../content/ambient.json' with {type:'json'};
import curriculum from '../content/curriculum.json' with {type:'json'};
import objectNames from '../content/objects.json' with {type:'json'};
import {decodeProfile,isNewerSave,NEWER} from '../core/profile.js';
import {outfit,toggleWear,isWorn,wearable} from '../core/inventory.js';
import {escapeHtml as esc} from '../core/language.js';
import {languageLine,pinyinHtml} from './shell.js';
import {pinyinMode} from '../core/pinyin.js';
import {openBank as openWordBank} from './bank.js';
import {openCollection} from './collection.js';
import {icon,itemArt} from './art.js';
import {todaysTasks,claimTask,bump} from '../core/daily.js';
import {readStats,eat} from '../core/stats.js';
import {TUTORIAL_UI} from '../core/tutorial.js';
import {moreProgress} from '../core/backup.js';
import {syncCloud,keepLoser} from '../core/cloudsync.js';
import {SAVE_KEY} from '../core/profile.js';
import {user,signIn,signOut,deleteSave,cloudApi} from '../services/cloud.js';
import {folderSupported,folderStatus,chooseFolder,reconnectFolder,stopSync,readFolderSave,readLog,listBackups,syncSave,keepFolderCopy,keepCopy} from '../services/filesync.js';

export function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function openJournal(ctx){
 const body=ctx.ui.open('journal','旅行手册','你的中文，慢慢生长');
 const tasks=todaysTasks(ctx.profile,ctx.profile.dayIndex??0);
 body.innerHTML=`<h3 class="section-title">今天的小事 <small>TODAY'S ERRANDS</small></h3>
 <p class="microcopy">三件小事，每天换。做完了回到这里领学习币。<br>Three errands a day, refreshed every in-game day. Collect the coins here.</p>
 <div class="daily-list">${tasks.map(task=>`
   <article class="daily-row ${task.done?'done':''} ${task.claimed?'claimed':''}">
     <span class="daily-mark">${task.claimed?'✓':task.done?icon('check',15):`${task.have}/${task.goal}`}</span>
     <div class="daily-text">
       <div class="quest-line"><b>${esc(task.zh)}</b>
         <button class="help-toggle quest-help" data-help aria-label="显示拼音">?</button>
         <div class="help-content" hidden><div class="pinyin">${pinyinHtml(task.pinyin,task.zh,{always:true})}</div></div></div>
       <small>${esc(task.en)}</small>
       <div class="gate-bar daily-bar"><i style="width:${Math.round(task.have/task.goal*100)}%"></i></div></div>
     ${task.claimed?'<span class="daily-reward done">已领</span>'
       :task.done?`<button class="primary daily-claim" data-claim="${esc(task.id)}">领 ${task.reward}</button>`
       :`<span class="daily-reward">${icon('coin',13)} ${task.reward}</span>`}
   </article>`).join('')}</div><button class="primary wide" id="journal-practice">${icon('leaf',15)} 复习你遇到的词 ${icon('arrow')}</button>
 <p class="microcopy">复习的是你在城里遇到的词，不是固定的几张卡片。<br>You review the words you have actually met, not a fixed set of cards.</p>
 <h3 class="section-title">收藏的闲聊</h3><div class="saved-phrases">${ctx.profile.phrases.length?ctx.profile.phrases.map(id=>ambient.find(a=>a.id===id)).filter(Boolean).map(a=>languageLine(a,ctx.profile.settings)).join(''):'<p class="microcopy">听见有趣的话？点击小镇上的聊天气泡，收藏一句。</p>'}</div><h3 class="section-title">认出的东西 <small>THINGS YOU HAVE NAMED</small></h3>
 <div class="discovery">
  <div class="discovery-count"><b>${ctx.profile.discovered.length}</b><span>/ ${Object.keys(objectNames.objects).length}</span></div>
  <div><div class="gate-bar"><i style="width:${Math.round(ctx.profile.discovered.length/Object.keys(objectNames.objects).length*100)}%"></i></div>
  <p class="microcopy">看着城里的东西，按 <kbd>F</kbd> 记住它的名字。<br>Look at anything in the city and press F to learn its name.</p></div>
 </div>
 <div class="discovered-list">${ctx.profile.discovered.map(id=>objectNames.objects[id]).filter(Boolean).map(o=>`<span class="discovered-chip">${esc(o.zh)}${pinyinHtml(o.pinyin,o.zh)?`<small>${pinyinHtml(o.pinyin,o.zh)}</small>`:''}</span>`).join('')||'<p class="microcopy">还没有认出任何东西。</p>'}</div>
 <button class="secondary wide" id="journal-collection">图鉴 <small>COLLECTION</small></button>
 <h3 class="section-title">生词本 <small>HIGHLIGHTED WORDS</small></h3><div class="saved-words" id="saved-words">${ctx.profile.saved.length?ctx.profile.saved.map((w,i)=>`<article class="saved-word"><div class="lookup-zh">${esc(w.zh)}</div><div class="lookup-body"><div class="lookup-pinyin">${pinyinHtml(w.pinyin,w.zh,{always:true})}</div><div class="lookup-en">${esc(w.en)}</div></div><button class="lookup-save" data-forget="${i}" aria-label="移除${esc(w.zh)}">移除</button></article>`).join(''):'<p class="microcopy">在任何中文上划选，即可查看拼音和释义，并收藏到这里。<br>Highlight any Chinese in the interface for pinyin and a gloss.</p>'}</div><h3 class="section-title">进度记录 <small>PROGRESS LOG</small></h3><div style="overflow-x:auto"><table class="progress-log"><thead><tr><th>日期</th>${[1,2,3,4,5,6].map(level=>`<th>HSK ${level}</th>`).join('')}<th>认识的东西</th><th>学习币</th></tr></thead><tbody>${readLog().reverse().map(r=>`<tr><td>${esc(r.date)}</td>${[...r.hsk,r.objects,r.coins].map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div><h3 class="section-title">下一段旅程</h3><div class="roadmap">${curriculum.roadmap.map((r,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span><b>${r.zh}</b><small>${r.status==='playable'?'现在可探索':'规划中'}</small></div>`).join('')}</div><p class="microcopy">初级学习原型 · 正式 HSK 对应关系待核对。熟悉度按认读和表达分别记录，非考试成绩。</p>`;
 body.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>{
  const result=claimTask(ctx.profile,b.dataset.claim);
  if(!result.ok)return;
  if(!ctx.profile.completed.includes('daily:first'))ctx.profile.completed.push('daily:first');
  ctx.music?.cue('reward');ctx.save();ctx.ui.notice(`+${result.reward} 学习币。 / Errand done.`);openJournal(ctx);
 });
 body.querySelector('#journal-practice').onclick=()=>openWordBank(ctx);
 body.querySelector('#journal-collection').onclick=()=>openCollection(ctx);
 body.querySelectorAll('[data-forget]').forEach(b=>b.onclick=()=>{ctx.profile.saved.splice(Number(b.dataset.forget),1);ctx.save();openJournal(ctx);});
}
export function openInventory(ctx){
 const body=ctx.ui.open('inventory','背包','旅途中的小收藏');
 const owned=catalog.filter(i=>ctx.profile.inventory[i.id]);
 body.innerHTML=owned.length?`<div class="inventory-grid">${owned.map(i=>`<article class="inventory-card">${itemArt(i.visual)}${languageLine(i,ctx.profile.settings)}<p>数量：${ctx.profile.inventory[i.id]}</p>${wearable(i.id)?`<button class="secondary" data-equip="${i.id}">${isWorn(ctx.profile,i.id)?'取下':'穿上'}</button>`:i.nutrition?`<button class="secondary" data-eat="${i.id}">吃掉 · +${i.nutrition} 饱</button>`:`<span class="microcopy">${i.category==='furniture'?'回家布置':'旅行纪念品'}</span>`}</article>`).join('')}</div>`:`<div class="empty-state">${icon('bag',45)}<h3>轻装出发。</h3><p>去认识新朋友，赚取学习币，<br>再挑一份喜欢的纪念品。</p></div>`;
 body.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{ctx.town.equip(toggleWear(ctx.profile,b.dataset.equip));ctx.save();openInventory(ctx);});
 body.querySelectorAll('[data-eat]').forEach(b=>b.onclick=()=>{
  const item=catalog.find(i=>i.id===b.dataset.eat);
  if((ctx.profile.inventory[item.id]??0)<1)return;
  ctx.profile.inventory[item.id]--;
  if(ctx.profile.inventory[item.id]<=0)delete ctx.profile.inventory[item.id];
  eat(ctx.profile,item);bump(ctx.profile,'meals');bump(ctx.profile,'ate-'+item.id);ctx.save();
  ctx.ui.notice(`吃了${item.zh}。肚子：${Math.round(readStats(ctx.profile).hunger)}。 / Ate the ${item.en}.`);
  ctx.music?.cue('eat');
  openInventory(ctx);
 });
}
export function openAmbient(ctx){
 const body=ctx.ui.open('ambient','小镇上的闲聊','日常口语 · 只听听也很好');
 body.innerHTML=ambient.map((a,i)=>`<article class="ambient-line"><span class="speaker-avatar ${i%2?'sage':'clay'}">${i%2?'乙':'甲'}</span><div>${languageLine(a,ctx.profile.settings)}<div class="audio-row"><button class="subtle" data-ambient-audio="${a.audio}" aria-label="重听第${i+1}句">${icon('sound',15)} 重听</button><button class="subtle" data-save-phrase="${a.id}">${ctx.profile.phrases.includes(a.id)?'已收藏':'收藏这句'}</button></div></div></article>`).join('')+'<p class="microcopy">配音由 AI 合成，未经真人审听。旁听不会直接增加词汇熟悉度。</p>';
 body.querySelectorAll('[data-ambient-audio]').forEach(b=>b.onclick=()=>ctx.voice.play(b.dataset.ambientAudio));body.querySelectorAll('[data-save-phrase]').forEach(b=>b.onclick=()=>{if(!ctx.profile.phrases.includes(b.dataset.savePhrase))ctx.profile.phrases.push(b.dataset.savePhrase);ctx.save();b.textContent='已收藏';});
}
import {mountPlaylist} from './music-playlist.js';

export function openSettings(ctx){
 const body=ctx.ui.open('settings','按你的节奏','设置 · SETTINGS');const s=ctx.profile.settings;
 body.innerHTML=`<h3>帮助内容 <small>WHEN YOU TAP ?</small></h3><p class="microcopy">默认只显示汉字。点击 ? 时，显示你选择的帮助。<br>Chinese stays visible. Choose what the Help button reveals.</p><label class="setting-row"><span>拼音 <small>Pinyin</small></span><select id="setting-pinyin">${[['always','总是显示','Always'],['known','学会的就不显示','Hide for words I know'],['never','不显示','Never']].map(([v,zh,en])=>`<option value="${v}" ${pinyinMode(s)===v?'selected':''}>${zh} · ${en}</option>`).join('')}</select></label><label class="setting-row"><span>声调颜色 <small>Tone colours</small></span><input type="checkbox" id="setting-tones" ${s.toneColors?'checked':''}></label><label class="setting-row"><span>英文 <small>English</small></span><input type="checkbox" id="setting-english" ${s.english?'checked':''}></label><button class="secondary wide replay-tutorial" id="replay-tutorial">${esc(TUTORIAL_UI.replay.zh)} <small>${esc(TUTORIAL_UI.replay.en)}</small></button><h3 class="section-title">视角 <small>LOOKING AROUND</small></h3><p class="microcopy">鼠标转身的快慢。太快了会觉得画面在跳。<br>How far the view turns per unit of mouse movement. Too high feels like the view is jumping.</p><label class="setting-row"><span>鼠标灵敏度 <small>Mouse sensitivity</small></span><input type="range" id="look-sensitivity" min="0.04" max="0.3" step="0.01" value="${s.sensitivity??0.12}"></label><h3 class="section-title">声音 <small>AUDIO</small></h3><label class="setting-row"><span>对话音量 <small>Dialogue</small></span><input type="range" id="dialogue-volume" min="0" max="1" step="0.05" value="${s.dialogueVolume}"></label><label class="setting-row"><span>环境音量 <small>Ambience</small></span><input type="range" id="ambient-volume" min="0" max="1" step="0.05" value="${s.ambientVolume}"></label><label class="setting-row"><span>背景音乐 <small>Music</small></span><input type="range" id="music-volume" min="0" max="1" step="0.05" value="${s.musicVolume}"></label><div class="gentle-note">NPC voices are AI generated Mandarin (edge-tts), not native-speaker recordings, and have not passed a listening review. Background music is synthesised in your browser. Microphone transcription depends on your browser and may use its online speech service.</div><h3 class="section-title">旅行存档 <small>YOUR PROGRESS</small></h3><p class="microcopy">Saved in this browser. Export a backup to keep your progress.</p><div class="button-row"><button class="secondary" id="export-save">导出存档</button><button class="secondary" id="import-save">导入存档</button><input type="file" id="save-file" accept=".json,application/json" hidden></div><div id="import-preview"></div><p class="microcopy">每个网址都有自己的存档：localhost 和 127.0.0.1 不共用。<br>Each web address keeps its own save: localhost and 127.0.0.1 don't share one.</p><h3 class="section-title">电脑上的存档 <small>SAVE TO YOUR COMPUTER</small></h3><div id="folder-sync"></div>${ctx.cloud&&!ctx.readOnly?'<h3 class="section-title">云端存档 <small>CLOUD SAVE</small></h3><div id="cloud-sync"></div>':''}<h3 class="section-title">自动备份 <small>AUTOMATIC BACKUPS</small></h3><div id="backup-list"></div><h3 class="section-title">创作工具 <small>MAKE IT YOURS</small></h3><button class="secondary wide" id="edit-world">编辑小镇布局 ${icon('map')}</button><p class="microcopy">Preview NPC and building positions, then export world.json. Lesson text, accepted answers and prices are separate editable files.</p>`;
 ctx.ui.armClose(mountPlaylist(body,ctx.music));
 body.querySelector('#setting-pinyin').onchange=e=>{s.pinyin=e.target.value;ctx.save();};body.querySelector('#setting-tones').onchange=e=>{s.toneColors=e.target.checked;ctx.save();};body.querySelector('#setting-english').onchange=e=>{s.english=e.target.checked;ctx.save();};
 for(const [id,key]of [['dialogue-volume','dialogueVolume'],['ambient-volume','ambientVolume'],['music-volume','musicVolume']])body.querySelector('#'+id).oninput=e=>{s[key]=Number(e.target.value);ctx.voice.settings=s;ctx.music.settings=s;ctx.music.setVolume();ctx.save();};
 body.querySelector('#look-sensitivity').oninput=e=>{s.sensitivity=Number(e.target.value);ctx.town.sensitivity=s.sensitivity;ctx.save();};
 body.querySelector('#export-save').onclick=()=>download('qinghe-save.json',ctx.profile);
 body.querySelector('#import-save').onclick=()=>body.querySelector('#save-file').click();
 body.querySelector('#save-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>2000000)throw Error('Large file');const p=decodeProfile(await file.text());const preview=body.querySelector('#import-preview');preview.innerHTML=`<div class="purchase-confirm"><p>替换当前进度？ / Replace current progress?</p><p>${p.wallet} 学习币 · ${p.completed.length} 项完成</p><button class="primary" id="confirm-import">确认导入</button><button class="secondary" id="cancel-import">取消</button></div>`;preview.querySelector('#cancel-import').onclick=()=>preview.innerHTML='';preview.querySelector('#confirm-import').onclick=()=>{replaceProfile(ctx,p);ctx.ui.notice('存档已导入。');};}catch{ctx.ui.notice('存档格式不正确，原有进度未改变。 / Invalid save; your progress is unchanged.');}
 };
 body.querySelector('#edit-world').onclick=()=>openEditor(ctx);
 body.querySelector('#replay-tutorial').onclick=()=>{ctx.ui.close();ctx.tutorial?.start();};
 renderFolder(ctx,body.querySelector('#folder-sync'));
 if(body.querySelector('#cloud-sync'))renderCloud(ctx,body.querySelector('#cloud-sync'));
 renderBackups(ctx,body.querySelector('#backup-list'));
}
/** Swaps in another save (an import, a backup, the folder's copy) and saves it at once. */
function replaceProfile(ctx,p){ctx.tutorial?.leaveStep();if(ctx.tutorial)ctx.tutorial.shown=null;ctx.profile=p;ctx.voice.settings=p.settings;ctx.town.equip(outfit(p));ctx.save();ctx.ui.close();}
/** Offers the folder's save when it holds more progress than this browser's. True if offered. */
export async function offerFolderRestore(ctx){
 if(ctx.readOnly)return false;
 const raw=await readFolderSave();
 // A save from a newer build must never be written over by this one: the whole session stops saving.
 if(raw&&isNewerSave(raw)){ctx.readOnly=true;ctx.ui.notice(NEWER);return false;}
 let p=null;try{p=raw&&decodeProfile(raw);}catch{}
 if(!p||!moreProgress(p,ctx.profile))return false;
 // Until the player answers, the folder's fuller save must not be overwritten by this one.
 ctx.holdSync=true;
 const body=ctx.ui.open('restore','电脑上的存档','SAVE TO YOUR COMPUTER',{onClose:()=>{keepFolderCopy(raw).finally(()=>{ctx.holdSync=false;cloudSync(ctx);});}});
 body.innerHTML=`<p>在文件夹里找到了进度更多的存档，要恢复吗？<br><small>The folder holds a save with more progress. Restore it?</small></p><p class="microcopy">${p.wallet} 学习币 · ${p.completed.length} 项完成</p><div class="button-row"><button class="primary" id="restore-folder">恢复 <small>Restore</small></button><button class="secondary" id="skip-restore">不用了 <small>No thanks</small></button></div>`;
 body.querySelector('#restore-folder').onclick=()=>replaceProfile(ctx,p);
 body.querySelector('#skip-restore').onclick=()=>ctx.ui.close();
 return true;
}
async function renderFolder(ctx,el){
 if(!folderSupported()){el.innerHTML=`<p class="microcopy">这个浏览器不能直接存到文件夹，请用导出存档。<br>This browser can't save to a folder; use Export instead.</p>`;return;}
 const status=await folderStatus();
 if(!el.isConnected)return;
 const time=status?.lastSaved&&new Date(status.lastSaved).toLocaleTimeString();
 const stop=`<button class="secondary" id="stop-sync">停止同步 <small>Stop syncing</small></button>`;
 el.innerHTML=!status?`<button class="secondary wide" id="choose-folder">选择文件夹 <small>Choose a folder</small></button>`
  :status.granted?`<p class="microcopy">已同步到：${esc(status.name)}<br>Syncing to: ${esc(status.name)}</p>${time?`<p class="microcopy">上次保存：${esc(time)}<br>Last saved: ${esc(time)}</p>`:''}<div class="button-row">${stop}</div>`
  :`<div class="button-row"><button class="secondary" id="reconnect-folder">重新连接 <small>Reconnect</small></button>${stop}</div>`;
 // A newly connected folder is checked for a fuller save before this one is written over it.
 const connected=async()=>{if(!await offerFolderRestore(ctx)){if(!ctx.holdSync&&!ctx.readOnly)await syncSave(ctx.profile,ctx.hskWords);renderFolder(ctx,el);}};
 el.querySelector('#choose-folder')?.addEventListener('click',async()=>{try{await chooseFolder();}catch{return;}await connected();});
 el.querySelector('#reconnect-folder')?.addEventListener('click',async()=>{if(await reconnectFolder().catch(()=>false))await connected();else renderFolder(ctx,el);});
 el.querySelector('#stop-sync')?.addEventListener('click',async()=>{await stopSync();renderFolder(ctx,el);});
}
/**
 * The cloud save, only when services/cloud.js is configured and never in ?dev (main.js leaves
 * ctx.cloud null then). ctx.cloud holds the core/cloudsync.js state plus: hold (a cloud restore
 * offer is waiting for an answer), busy, failed, and at (the last successful upload).
 */
let cloudTimer=null;
/** Uploads about 10 s after a save, or retries after `ms`; one timer at a time, like syncSoon. */
export function cloudSoon(ctx,ms=10000){if(ctx.cloud)cloudTimer??=setTimeout(()=>{cloudTimer=null;cloudSync(ctx);},ms);}
/** Checks or uploads the cloud save when signed in. `asked`: the player pressed 立即同步. */
export async function cloudSync(ctx,{asked=false}={}){
 const c=ctx.cloud;
 if(!c||ctx.readOnly)return;
 if(c.busy)return cloudSoon(ctx);
 c.busy=true;
 try{
  const who=await user().catch(()=>null);
  if(!who)return;
  // The row's updated_at this device last wrote, per player, so a save made elsewhere is recognised.
  const key=`${SAVE_KEY}.cloud-seen.${who.id}`;
  let known=null;try{known=localStorage.getItem(key);}catch{}
  const r=await syncCloud(cloudApi,c,{profile:ctx.profile,readOnly:ctx.readOnly,hold:ctx.holdSync||c.hold,known});
  c.failed=r.action==='failed';
  if(r.action==='saved'){c.at=Date.now();try{localStorage.setItem(key,c.seen);}catch{}}
  else if(r.action==='readonly'){ctx.readOnly=true;ctx.ui.notice(NEWER);}
  else if(r.action==='throttled')cloudSoon(ctx);
  else if(r.action==='failed')cloudSoon(ctx,30000);
  // The offer waits for the player to be free rather than cutting into a conversation or a shop.
  else if(ctx.ui.panelId&&!asked){c.seen=undefined;cloudSoon(ctx,30000);}   // 'offer' or 'choose'
  else if(r.action==='offer'||r.action==='choose')offerCloudRestore(ctx,r);
 }finally{c.busy=false;}
}
/** Like offerFolderRestore: nothing is uploaded until the player answers. 'choose' (the cloud
 *  save changed on another device) asks which to use; 'offer' (it now holds more progress) offers
 *  it. Whichever copy loses goes into the backup list first; if it cannot, nothing changes and
 *  uploads stay held. Closing without an answer leaves the cloud alone too; 立即同步 asks again. */
function offerCloudRestore(ctx,{action,profile:p,raw}){
 const c=ctx.cloud,stats=q=>`${q.wallet} 学习币 · ${q.completed.length} 项完成`;let answered=false;
 c.hold=true;
 const body=ctx.ui.open('restore','云端存档','CLOUD SAVE',{onClose:()=>{if(!answered)c.seen=undefined;}});
 body.innerHTML=action==='choose'
  ?`<p>云端存档在另一台设备上更新过。要用哪一个？<br><small>The cloud save was updated on another device. Which one do you want to use?</small></p><p class="microcopy">云端：${stats(p)}<br>本机：${stats(ctx.profile)}</p><div class="button-row"><button class="primary" data-pick="cloud">用云端的 <small>Use the cloud one</small></button><button class="secondary" data-pick="local">用这台设备的 <small>Use this device's</small></button></div>`
  :`<p>云端有进度更多的存档，要恢复吗？<br><small>The cloud holds a save with more progress. Restore it?</small></p><p class="microcopy">${stats(p)}</p><div class="button-row"><button class="primary" data-pick="cloud">恢复 <small>Restore</small></button><button class="secondary" data-pick="local">不用了 <small>No thanks</small></button></div>`;
 body.querySelectorAll('[data-pick]').forEach(button=>button.onclick=async()=>{
  answered=true;body.querySelectorAll('[data-pick]').forEach(b=>b.disabled=true);
  const pick=button.dataset.pick;
  if(!await keepLoser(c,pick,{cloudRaw:raw,localRaw:JSON.stringify(ctx.profile)},keepCopy)){c.failed=true;c.seen=undefined;ctx.ui.close();return;}
  if(pick==='cloud')replaceProfile(ctx,p);   // saved at once, so it goes up at the next upload
  else{ctx.ui.close();cloudSync(ctx);}
 });
}
async function renderCloud(ctx,el){
 const c=ctx.cloud,who=await user().catch(()=>null);
 if(!el.isConnected)return;
 const again=()=>renderCloud(ctx,el);
 const privacy='<p class="microcopy">只保存你的游戏进度，不会公开。<br>Only your game progress is stored, and it\'s never shown to anyone.</p>';
 const failed=c.failed?'<p class="microcopy">同步失败，稍后会再试。<br>Sync failed; will try again later.</p>':'';
 if(!who){
  el.innerHTML=`<button class="secondary wide" id="cloud-sign-in">用 Google 登录 <small>Sign in with Google</small></button>${failed}${privacy}`;
  el.querySelector('#cloud-sign-in').onclick=()=>signIn().catch(()=>{c.failed=true;again();});
  return;
 }
 const email=esc(who.email??''),time=c.at&&esc(new Date(c.at).toLocaleTimeString());
 el.innerHTML=`<p class="microcopy">已登录：${email}<br>Signed in as ${email}</p>${time?`<p class="microcopy">上次同步：${time}<br>Last synced: ${time}</p>`:''}${failed}<div class="button-row"><button class="secondary" id="cloud-now">立即同步 <small>Sync now</small></button><button class="secondary" id="cloud-sign-out">退出登录 <small>Sign out</small></button><button class="secondary" id="cloud-delete">删除云端存档 <small>Delete cloud save</small></button></div><div id="cloud-confirm"></div>${privacy}`;
 // Sync now reads the cloud first, so a save another device made is offered rather than overwritten.
 el.querySelector('#cloud-now').onclick=async()=>{c.hold=false;c.seen=undefined;await cloudSync(ctx,{asked:true});if(el.isConnected)again();};
 const forget=()=>{c.seen=undefined;c.at=null;c.failed=false;};
 el.querySelector('#cloud-sign-out').onclick=async()=>{await signOut().catch(()=>{});forget();again();};
 el.querySelector('#cloud-delete').onclick=()=>{
  const box=el.querySelector('#cloud-confirm');
  box.innerHTML=`<div class="purchase-confirm"><p>确定要删除云端存档吗？这台设备上的进度不会受影响。<br><small>Delete your cloud save? Progress on this device isn't affected.</small></p><button class="primary" id="cloud-delete-yes">删除 <small>Delete</small></button><button class="secondary" id="cloud-delete-no">取消 <small>Cancel</small></button></div>`;
  box.querySelector('#cloud-delete-no').onclick=()=>box.innerHTML='';
  // Signing out as well stops the next upload from putting the save straight back.
  // Uploads stay held afterwards, and an upload already under way finishes first, so nothing puts it back.
  box.querySelector('#cloud-delete-yes').onclick=async()=>{
   c.hold=true;
   while(c.busy)await new Promise(done=>setTimeout(done,200));
   try{await deleteSave();await signOut();forget();}catch{c.failed=true;c.hold=false;}
   again();
  };
 };
}
async function renderBackups(ctx,el){
 const list=(await listBackups()).reverse();
 if(!el.isConnected)return;
 el.innerHTML=list.map((b,i)=>`<div class="setting-row"><span>${esc(String(b.day))} <small>${Number(b.coins)||0} 学习币</small></span><button class="secondary" data-backup="${i}">恢复这个备份 <small>Restore this backup</small></button></div>`).join('')+'<div id="backup-confirm"></div>';
 const confirm=el.querySelector('#backup-confirm');
 el.querySelectorAll('[data-backup]').forEach(b=>b.onclick=()=>{
  let p;try{p=decodeProfile(list[Number(b.dataset.backup)].raw);}catch{ctx.ui.notice('存档格式不正确，原有进度未改变。 / Invalid save; your progress is unchanged.');return;}
  confirm.innerHTML=`<div class="purchase-confirm"><p>替换当前进度？ / Replace current progress?</p><p>${p.wallet} 学习币 · ${p.completed.length} 项完成</p><button class="primary" id="confirm-backup">恢复 <small>Restore</small></button><button class="secondary" id="cancel-backup">取消</button></div>`;
  confirm.querySelector('#cancel-backup').onclick=()=>confirm.innerHTML='';
  confirm.querySelector('#confirm-backup').onclick=()=>replaceProfile(ctx,p);
 });
}
function openEditor(ctx){
 const snapshot=structuredClone(ctx.town.data);const body=ctx.ui.open('editor','编辑小镇','LOCAL LAYOUT PREVIEW');
 const entries=[...ctx.town.data.npcs.map(n=>({kind:'npc',...n})),...ctx.town.data.buildings.map(b=>({kind:'building',...b}))];
 body.innerHTML=`<p class="microcopy">Choose an object, then move it in the town. Export to keep edits; replace src/content/world.json with the downloaded file. Layout changes are temporary until exported.</p><label class="editor-field">物体 / Object<select id="layout-object">${entries.map(e=>`<option value="${e.kind}:${e.id}">${e.kind} · ${e.id}</option>`).join('')}</select></label><label class="editor-field">东西 / X<input id="layout-x" type="range" min="-20" max="20" step="0.5"></label><label class="editor-field">南北 / Z<input id="layout-z" type="range" min="-20" max="20" step="0.5"></label><p id="layout-position" class="microcopy"></p><button class="primary wide" id="export-layout">导出 world.json ${icon('arrow')}</button><button class="secondary wide" id="revert-layout">撤销本次布局修改</button><p class="microcopy">Avoid placing buildings over paths or the player. Changes to collision boxes follow building positions. This is a standalone layout helper, not a hosted PlayCanvas Editor connection.</p>`;
 const select=body.querySelector('#layout-object'),x=body.querySelector('#layout-x'),z=body.querySelector('#layout-z');
 const load=()=>{const [kind,id]=select.value.split(':');const def=(kind==='npc'?ctx.town.data.npcs:ctx.town.data.buildings).find(d=>d.id===id);x.value=def.x;z.value=def.z;body.querySelector('#layout-position').textContent=`x: ${def.x} · z: ${def.z}`;};
 const update=()=>{const [kind,id]=select.value.split(':');ctx.town.moveLayout(kind,id,Number(x.value),Number(z.value));body.querySelector('#layout-position').textContent=`x: ${x.value} · z: ${z.value}`;};select.onchange=load;x.oninput=update;z.oninput=update;load();
 body.querySelector('#export-layout').onclick=()=>download('world.json',ctx.town.data);body.querySelector('#revert-layout').onclick=()=>{for(const n of snapshot.npcs)ctx.town.moveLayout('npc',n.id,n.x,n.z);for(const b of snapshot.buildings)ctx.town.moveLayout('building',b.id,b.x,b.z);load();};
}
