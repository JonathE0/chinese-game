/**
 * Keeps the save safe outside this browser tab: rolling daily backups in IndexedDB, a daily HSK
 * progress log, and (Chrome/Edge) a folder on the computer holding `qinghe-save.json` and
 * `qinghe-hsk-log.csv`. Nothing here may block or break the game: every failure is swallowed.
 */
import {SAVE_KEY} from '../core/profile.js';
import {rotateBackups,addCopy,logRow,addLogRow,parseLog,csvLine,realDay,LOG_HEADER} from '../core/backup.js';

const SAVE_FILE='qinghe-save.json',LOG_FILE='qinghe-hsk-log.csv',LOG_KEY=SAVE_KEY+'.log',MAX_FILE=2000000;

function idb(mode,run){
  return new Promise((resolve,reject)=>{
    const open=indexedDB.open('little-mandarin-town',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('kv');
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
      const db=open.result;
      try{
        const tx=db.transaction('kv',mode),request=run(tx.objectStore('kv'));
        tx.oncomplete=()=>{db.close();resolve(request.result);};
        tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};
      }catch(error){db.close();reject(error);}   // e.g. a value that cannot be stored
    };
  });
}
const get=key=>idb('readonly',store=>store.get(key));
const put=(key,value)=>idb('readwrite',store=>store.put(value,key));
const remove=key=>idb('readwrite',store=>store.delete(key));

export const folderSupported=()=>typeof window.showDirectoryPicker==='function';
let folder,lastSaved=null;   // the handle is cached: IndexedDB is only for the next visit
async function currentFolder(){
  if(folder===undefined)folder=await get('folder').catch(()=>null)??null;
  return folder;
}
const granted=async handle=>{try{return await handle.queryPermission({mode:'readwrite'})==='granted';}catch{return false;}};

/** Null when no folder is chosen; otherwise its name, whether we may write to it, and the last write. */
export async function folderStatus(){
  const handle=await currentFolder();
  return handle&&{name:handle.name,granted:await granted(handle),lastSaved};
}
/** Asks the player for a folder. Must run from a click. */
export async function chooseFolder(){
  folder=await window.showDirectoryPicker({id:'qinghe',mode:'readwrite'});
  await put('folder',folder).catch(()=>{});
}
/** Asks again for permission a stored folder has lost. Must run from a click. */
export async function reconnectFolder(){
  const handle=await currentFolder();
  return !!handle&&await handle.requestPermission({mode:'readwrite'})==='granted';
}
export async function stopSync(){
  folder=null;lastSaved=null;
  await remove('folder').catch(()=>{});
}
/** The folder's save text, or null when there is none or it cannot be read without asking. */
export async function readFolderSave(){
  const handle=await currentFolder();
  if(!handle||!await granted(handle))return null;
  try{
    const file=await (await handle.getFileHandle(SAVE_FILE)).getFile();
    return file.size>MAX_FILE?null:await file.text();
  }catch{return null;}
}
async function writeFile(handle,name,text){
  const out=await (await handle.getFileHandle(name,{create:true})).createWritable();
  await out.write(text);await out.close();
}

/** The folder's current save, kept as a dated copy before this browser's save goes over it. */
export async function keepFolderCopy(raw){
  const handle=await currentFolder();
  if(!raw||!handle||!await granted(handle))return false;
  try{await writeFile(handle,`qinghe-save-${realDay()}.json`,raw);return true;}catch{return false;}
}
/** Keeps the text of a damaged save that did not fit beside it in localStorage (newest only). */
export const keepUnreadable=raw=>put('unreadable',raw);

export const readLog=()=>{try{return parseLog(localStorage.getItem(LOG_KEY));}catch{return [];}};
/** Keeps the copy that lost a cloud choice in the backup list, labelled 云端 or 本机. The list is
 *  read without a fallback, so a failed read cannot replace the whole list with this one copy. */
export async function keepCopy(raw,label){
  try{const list=await get('backups');await put('backups',addCopy(Array.isArray(list)?list:[],raw,label));return true;}catch{return false;}
}
export const listBackups=()=>get('backups').then(list=>Array.isArray(list)?list:[]).catch(()=>[]);

/** Runs after saves (debounced by the caller): backup, log row, then the folder. */
export async function syncSave(profile,words,now=Date.now()){
  try{
    const list=await listBackups(),next=rotateBackups(list,profile,now);
    if(next!==list)await put('backups',next);
  }catch{}
  // The log counts HSK words, so it waits until the word list has loaded.
  const row=words?.length?logRow(profile,words,now):null;
  if(row){
    const log=readLog(),next=addLogRow(log,row);
    if(next!==log)try{localStorage.setItem(LOG_KEY,JSON.stringify(next));}catch{}
  }
  const handle=await currentFolder();
  if(!handle||!await granted(handle))return false;
  try{
    await writeFile(handle,SAVE_FILE,JSON.stringify(profile,null,2));
    if(row){
      const csv=await (await (await handle.getFileHandle(LOG_FILE,{create:true})).getFile()).text();
      if(!csv.split(/\r?\n/).some(line=>line.startsWith(row.date+',')))
        await writeFile(handle,LOG_FILE,(csv.trim()?csv.replace(/\s*$/,'\n'):LOG_HEADER+'\n')+csvLine(row)+'\n');
    }
    lastSaved=now;return true;
  }catch{return false;}
}
