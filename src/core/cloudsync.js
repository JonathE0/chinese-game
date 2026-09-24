import {decodeProfile,isNewerSave,SAVE_VERSION} from './profile.js';
import {moreProgress} from './backup.js';

/**
 * The cloud save's decisions, with the same data-safety rules as the save folder. `api` is the
 * signed-in client (services/cloud.js, or a fake in tests):
 *   read() → {data,version,updated_at} or null;
 *   write(profile,seen) → the new updated_at: an insert when `seen` is null, otherwise an update that
 *   only lands while the row still carries `seen` (null when it no longer does).
 * `state.seen` is the row's updated_at as last read or written: undefined until the row has been
 * read, null when there is no row. `known` is the updated_at this device last wrote for this player
 * (kept across sessions by the caller): a row carrying anything else was written elsewhere, or
 * never seen here, and is never written over without the player choosing. Writes only ever land on
 * the row this client has seen, so a save another device made in between is read again first.
 *
 * Returns {action}: 'none' (not allowed to touch the cloud); 'choose' (the row was written
 * elsewhere) or 'offer' (the row this device wrote last now holds more progress), both with the
 * cloud `profile` and its `raw` text, uploading nothing until the player answers; 'readonly' (the
 * cloud save comes from a newer build); 'saved'; 'throttled' (retry quietly) or 'failed' (retry later).
 */
export async function syncCloud(api,state,{profile,readOnly,dev,hold,known}){
  if(readOnly||dev||hold)return {action:'none'};
  // Two rounds: a conflict re-reads the row once; a second conflict in a row waits for a retry.
  for(let round=0;round<2;round++){
    if(state.seen===undefined){
      let row;
      try{row=await api.read();}catch{return {action:'failed'};}
      state.seen=row?.updated_at??null;
      if(row){
        const raw=JSON.stringify(row.data);
        if(row.version>SAVE_VERSION||isNewerSave(raw))return {action:'readonly'};
        let cloud=null;try{cloud=decodeProfile(raw);}catch{}
        // Progress alone cannot say which save to trust (it leaves out coins, quests and furniture),
        // so a row written elsewhere always goes to the player; one that cannot be read is left alone.
        if(row.updated_at!==known){
          if(cloud)return {action:'choose',profile:cloud,raw};
          state.seen=undefined;return {action:'failed'};
        }
        if(cloud&&moreProgress(cloud,profile))return {action:'offer',profile:cloud,raw};
      }
    }
    try{
      const at=await api.write(profile,state.seen);
      if(at){state.seen=at;return {action:'saved'};}
    }catch(error){
      if(error?.code==='P0001'&&/too many saves/.test(error.message))return {action:'throttled'};
      if(error?.code!=='23505')return {action:'failed'};   // 23505: another device made the row first
    }
    state.seen=undefined;
  }
  return {action:'failed'};
}

/** The player picked `choice` ('cloud' or 'local'). The other copy is kept first through
 *  `keep(raw,label)` (the backup list), labelled 云端 or 本机; true when the choice may go ahead.
 *  If it cannot be kept, uploads stay held and nothing is replaced. */
export async function keepLoser(state,choice,{cloudRaw,localRaw},keep){
  const kept=await (choice==='cloud'?keep(localRaw,'本机'):keep(cloudRaw,'云端')).catch(()=>false);
  state.hold=!kept;
  return !!kept;
}

/** Hex SHA-256 of `text`, through the platform's Web Crypto (browsers and Node alike). */
export async function sha256Hex(text){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
/** A fresh sign-in nonce, as Supabase's Google docs describe: Google is given `hashed`, and
 *  signInWithIdToken the `raw` value, so a stolen ID token cannot be replayed into another sign-in. */
export async function newNonce(){
  const raw=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  return {raw,hashed:await sha256Hex(raw)};
}

/** What the arrival screen adds: nothing without the cloud (`cloudOn` false: not configured, ?dev,
 *  read-only), the signed-in address, or the choice between signing in and playing as a guest. */
export const arrivalChoice=(cloudOn,who)=>!cloudOn?'plain':who?'signed-in':'choose';
