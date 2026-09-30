import {CHECKINS,checkedIn,addPhoto} from '../core/checkins.js';
import {escapeHtml as esc} from '../core/language.js';

/**
 * The 相册: photos from the 打卡 camera, kept in IndexedDB on this device only (never in the save
 * or the cloud), as one list under one key so adding a photo and dropping the oldest is a single
 * transaction. Failures are the caller's to report; nothing here throws into the game loop.
 */
const DB='qinghe-photos',KEY='photos';
function photos(change=null){
  return new Promise((resolve,reject)=>{
    const open=indexedDB.open(DB,1);
    open.onupgradeneeded=()=>open.result.createObjectStore('kv');
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
      const db=open.result;let out;
      try{
        const tx=db.transaction('kv',change?'readwrite':'readonly'),store=tx.objectStore('kv'),get=store.get(KEY);
        get.onsuccess=()=>{
          const list=Array.isArray(get.result)?get.result:[];
          out=change?change(list):list;
          if(change)store.put(out.list,KEY);
        };
        tx.oncomplete=()=>{db.close();resolve(out);};
        tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};
      }catch(error){db.close();reject(error);}
    };
  });
}
/** Adds a photo; resolves to how many old ones were dropped to stay within the cap. */
export const savePhoto=photo=>photos(list=>addPhoto(list.filter(p=>p.id!==photo.id),photo)).then(r=>r.dropped.length);
const deletePhoto=id=>photos(list=>({list:list.filter(p=>p.id!==id)}));

const JPEG=/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const text=v=>typeof v==='string'?v:'';
/** Fills the journal's 相册 section: the spots stamped so far, then the photos, newest first. */
export async function renderAlbum(ctx,el){
  if(!el)return;
  const {ui,spots}=CHECKINS,done=spots.filter(s=>checkedIn(ctx.profile,s.id)).length;
  let list=[];
  try{list=(await photos()).filter(p=>p&&typeof p.src==='string'&&JPEG.test(p.src)).reverse();}catch{}
  if(!el.isConnected)return;
  el.innerHTML=`<h3 class="section-title" tabindex="-1">${esc(ui.album.zh)} <small>${esc(ui.album.en.toUpperCase())}</small></h3>
  <p class="microcopy">${esc(ui.hint.zh)}${esc(ui.local.zh)}<br>${esc(ui.hint.en)} ${esc(ui.local.en)}</p>
  <p class="microcopy">${esc(ui.spot.zh)} · ${esc(ui.spot.en)} <b>${done} / ${spots.length}</b></p>
  <div class="checkin-stamps">${spots.map(s=>`<span class="checkin-stamp${checkedIn(ctx.profile,s.id)?' done':''}" title="${esc(s.en)}">${esc(s.zh)}</span>`).join('')}</div>
  ${list.length?`<div class="album-grid">${list.map(p=>`<figure class="album-photo">
    <img src="${p.src}" alt="${esc(text(p.name?.zh)||ui.picture.zh)}" width="320" height="180" loading="lazy">
    <figcaption>${p.spot?`<span class="album-stamp">${esc(ui.spot.zh)}</span>`:''}<b>${esc(text(p.name?.zh))}</b>
      <small>${esc(text(p.place?.zh))} · ${esc(new Date(Number(p.time)||0).toLocaleString())}</small></figcaption>
    <button class="album-delete" data-photo="${Number(p.id)}" aria-label="${esc(ui.delete.zh)}" title="${esc(ui.delete.zh)} · ${esc(ui.delete.en)}">✕</button></figure>`).join('')}</div>`
    :`<p class="microcopy album-empty">${esc(ui.empty.zh)}<br>${esc(ui.empty.en)}</p>`}`;
  // After a delete, focus stays in the album: on the delete button now in the same place, or the heading.
  el.querySelectorAll('[data-photo]').forEach((b,i)=>b.onclick=()=>deletePhoto(Number(b.dataset.photo))
    .then(()=>ctx.ui.notice(`${ui.deleted.zh} / ${ui.deleted.en}`),()=>ctx.ui.notice(`${ui.undeleted.zh} / ${ui.undeleted.en}`))
    .then(()=>renderAlbum(ctx,el)).then(()=>{const left=el.querySelectorAll('[data-photo]');(left[Math.min(i,left.length-1)]??el.querySelector('h3'))?.focus();}));
}
