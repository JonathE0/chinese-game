import soundtrack from '../content/music.json' with {type:'json'};
import {escapeHtml as esc} from '../core/language.js';

export function mountPlaylist(body,music){
  const ui=soundtrack.ui,section=document.createElement('section');
  section.className='music-playlist';section.setAttribute('aria-label',ui.title);
  section.innerHTML=`<h3>${esc(ui.title)} <small>${esc(ui.subtitle)}</small></h3>
    <p class="music-now" aria-live="polite"></p>
    <button type="button" class="secondary music-next">${esc(ui.next)} <small>${esc(ui.nextHelp)}</small></button>
    <ol>${soundtrack.tracks.map(t=>`<li data-track="${esc(t.id)}"><span>${esc(t.title)}<small>${esc(t.en)}</small></span><span>${esc(t.genre)}<small>${esc(t.genreEn)}</small></span></li>`).join('')}</ol>
    <p class="microcopy">${esc(ui.note)}<br>${esc(ui.noteHelp)}</p>`;
  body.querySelector('#music-volume').closest('label').after(section);
  const next=section.querySelector('.music-next');next.onclick=()=>music.skip();
  const refresh=()=>{
    const t=music.currentTrack,available=!!music.ctx;
    section.querySelector('.music-now').textContent=t?`${t.title} · ${t.en}`:available?`${ui.quiet} · ${ui.quietHelp}`:`${ui.unavailable} · ${ui.unavailableHelp}`;
    next.disabled=!t||!available;
    for(const row of section.querySelectorAll('[data-track]')){
      if(row.dataset.track===t?.id)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');
    }
  };
  const unsubscribe=music.subscribe(refresh);
  // Settings can close or be replaced directly by another panel, such as the editor.
  const observer=new MutationObserver(()=>{if(!section.isConnected)dispose();});
  const dispose=()=>{unsubscribe();observer.disconnect();};
  observer.observe(body.parentElement,{childList:true});refresh();return dispose;
}
