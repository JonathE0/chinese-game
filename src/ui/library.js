import {escapeHtml as esc} from '../core/language.js';
import {icon} from './art.js';
import {languageLine} from './shell.js';
import {addWord,hasWord} from '../core/bank.js';
import {shelves,readiness,storyById,finishStory,hasRead,SHELVES,STATE_LABELS,OFFER} from '../core/reading.js';

/**
 * 青禾书馆.
 *
 * A shelf is a reading list, not a gate. Books you can read are marked as such, books that will
 * stretch you are marked as that, and a book that is still out of reach shows you the exact
 * words standing between you and it — with a button that puts a handful of them into your word
 * bank so the next visit goes better. Reading itself is quiet: one page at a time, pinyin and
 * meaning behind the same ? you use everywhere, and any sentence still highlightable.
 */
const GREETING={zh:'慢慢看，书不会跑。',pinyin:'Mànman kàn, shū bú huì pǎo.',
  en:'Take your time — the books are not going anywhere.',
  note:'不会跑 literally "will not run away"; a gentle way of saying there is no hurry.'};

const spineColours=['#8fa98d','#c47f6b','#d9b072','#7f9ab0','#9db08f','#b58fa4'];

export function openLibrary(ctx,shelfId=null){
  const body=ctx.ui.open('library','青禾书馆','书架 · THE SHELVES');
  renderShelves(ctx,body,shelfId);
}

function renderShelves(ctx,body,only=null){
  const grouped=shelves(ctx.profile,ctx.hskWords);
  const wanted=only&&grouped.has(only)?[only]:[...grouped.keys()];
  body.innerHTML=`${languageLine(GREETING,ctx.profile.settings,{className:'dialogue-line'})}
    <p class="panel-intro">书按难度分架。绿色的现在就能读，黄色的有点吃力，灰色的还差几个词。<br>
      Shelved by difficulty. Green you can read now, amber will stretch you, grey is still a few words away.</p>
    ${wanted.map(shelfId=>{
      const shelf=SHELVES[shelfId]??{zh:shelfId,en:''};
      return `<h3 class="section-title">${esc(shelf.zh)} <small>${esc(shelf.en)} · ${esc(shelf.note??'')}</small></h3>
      <div class="book-shelf">${grouped.get(shelfId).map(({story,state,known,total,ratio},index)=>`
        <button class="book ${state}" data-book="${esc(story.id)}" style="--spine:${spineColours[index%spineColours.length]}">
          <span class="book-spine"></span>
          <span class="book-face">
            <b>${esc(story.zh)}</b>
            <small>${esc(story.pinyin)} · ${esc(story.en)}</small>
            <span class="book-blurb">${esc(story.blurb)}</span>
            <span class="book-meter"><i style="width:${Math.round(ratio*100)}%"></i></span>
            <span class="book-state">${esc(STATE_LABELS[state].zh)} · 认识 ${known}/${total}${hasRead(ctx.profile,story.id)?' · 读过':''}</span>
          </span>
        </button>`).join('')}</div>`;
    }).join('')}
    <p class="microcopy">读不了的书会告诉你缺哪几个词，并且可以直接放进生词本。<br>
      A book you cannot read yet names the words you are missing, and can hand them straight to your word bank.</p>`;
  body.querySelectorAll('[data-book]').forEach(button=>button.onclick=()=>openBook(ctx,body,button.dataset.book));
}

function openBook(ctx,body,storyId){
  const story=storyById(storyId);
  if(!story)return;
  const ready=readiness(ctx.profile,story,ctx.hskWords);
  if(!ready.readable)return lockedBook(ctx,body,story,ready);
  read(ctx,body,story,ready,0);
}

/** Not yet: say what is missing, and offer to start on it. */
function lockedBook(ctx,body,story,ready){
  const offered=ready.missing.slice(0,OFFER);
  body.innerHTML=`<button class="subtle" id="back-shelf">← 回到书架</button>
    <div class="book-head"><h3>${esc(story.zh)}</h3><small>${esc(story.pinyin)} · ${esc(story.en)}</small></div>
    <div class="gate-note"><b>还差 ${ready.missing.length} 个词。 / ${ready.missing.length} words short.</b>
      <div class="gate-bar"><i style="width:${Math.round(ready.ratio*100)}%"></i></div>
      <p class="microcopy">这本书里有 ${ready.total} 个关键词，你认识 ${ready.known} 个。认识 ${Math.ceil(ready.total*.6)} 个就可以试着读。<br>
        You know ${ready.known} of its ${ready.total} key words; ${Math.ceil(ready.total*.6)} is enough to attempt it.</p></div>
    <h3 class="section-title">先学这几个 <small>START WITH THESE</small></h3>
    <div class="missing-words">${offered.map(word=>
      `<span class="missing-word">${esc(word)}</span>`).join('')}</div>
    <button class="primary wide" id="take-words">${icon('leaf',15)} 放进生词本 · Add these to my word bank</button>
    <p class="microcopy">加进去以后，可以在家里的书桌上复习。复习过就算认识了。<br>
      Once they are in, review them at the study desk at home; a correct answer counts as knowing it.</p>`;
  body.querySelector('#back-shelf').onclick=()=>renderShelves(ctx,body);
  body.querySelector('#take-words').onclick=()=>{
    let added=0;
    for(const word of offered){
      if(hasWord(ctx.profile,word))continue;
      if(addWord(ctx.profile,{zh:word,pinyin:'',en:''}))added++;
    }
    ctx.music?.cue('collect');ctx.save();
    ctx.ui.notice(added
      ?`加了 ${added} 个词到生词本。 / Added ${added} words to your bank.`
      :'这些词已经在生词本里了。 / Those are already in your bank.');
    renderShelves(ctx,body);
  };
}

/** One page at a time. Chinese first; ? gives the reading and the meaning. */
function read(ctx,body,story,ready,page){
  const line=story.lines[page],last=page===story.lines.length-1;
  body.innerHTML=`<button class="subtle" id="back-shelf">← 回到书架</button>
    <div class="book-head"><h3>${esc(story.zh)}</h3>
      <small>${esc(story.pinyin)} · ${esc(story.en)} · HSK ${story.level}</small></div>
    ${ready.state==='stretch'?`<p class="microcopy stretch-note">这本对你来说有点难，慢慢读。缺 ${ready.missing.length} 个词。<br>
      A stretch at your level — ${ready.missing.length} of its key words are new. Take it slowly.</p>`:''}
    <div class="step-track">${story.lines.map((_,i)=>`<i class="${i<=page?'active':''}"></i>`).join('')}</div>
    <div class="book-page">${languageLine(line,ctx.profile.settings,{className:'book-line'})}</div>
    <p class="microcopy">在句子上划选，可以看整句的意思。<br>Highlight any sentence to see what the whole thing means.</p>
    <div class="button-row book-nav">
      ${page>0?'<button class="secondary" id="prev-page">上一页</button>':''}
      <button class="primary" id="next-page">${last?'读完了':'下一页'} ${icon('arrow',15)}</button>
    </div>
    <p class="microcopy">${page+1} / ${story.lines.length}</p>`;
  body.querySelector('#back-shelf').onclick=()=>renderShelves(ctx,body);
  body.querySelector('#prev-page')?.addEventListener('click',()=>read(ctx,body,story,ready,page-1));
  body.querySelector('#next-page').onclick=()=>{
    if(!last)return read(ctx,body,story,ready,page+1);
    const fresh=finishStory(ctx.profile,story.id);
    if(fresh)ctx.music?.cue('reward');
    ctx.save();
    body.innerHTML=`<div class="completion"><div class="completion-seal">读</div>
      <h3>读完了：${esc(story.zh)}</h3>
      <p>${esc(story.en)}</p>
      <p class="microcopy">${fresh?'第一次读完这本书。':'这本书你已经读过了。'}</p>
      <div class="completion-actions">
        <button class="primary" id="another">再挑一本</button>
        <button class="secondary" id="leave-library">回到书馆</button></div></div>`;
    body.querySelector('#another').onclick=()=>renderShelves(ctx,body);
    body.querySelector('#leave-library').onclick=()=>ctx.ui.close();
  };
}
