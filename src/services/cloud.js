/**
 * A thin wrapper over supabase-js for the cloud save (see docs/CLOUD_SETUP.md). Unless both
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at build time, supabase-js is never loaded
 * and no request is ever made. Sign-in is Google only. With VITE_GOOGLE_CLIENT_ID set, Google's own
 * button (Google Identity Services, served on this page's origin) hands over an ID token that
 * signInWithIdToken exchanges; otherwise, or when that script cannot load, the redirect (PKCE) flow,
 * where supabase-js exchanges the returned ?code= itself when the page loads again. Either way
 * supabase-js keeps the session in its own storage.
 */
import {newNonce} from '../core/cloudsync.js';

const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY,googleId=import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const cloudConfigured=!!(url&&key);

let client=null;
const sb=()=>client??=import('@supabase/supabase-js').then(({createClient})=>
  createClient(url,key,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}));
const ok=({data,error})=>{if(error)throw error;return data;};

/** The signed-in user ({id,email,...}), or null. */
export async function user(){return ok(await (await sb()).auth.getSession()).session?.user??null;}
/** Leaves for Google and comes back to this page. Must run from a click. */
export async function signIn(){ok(await (await sb()).auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}}));}
/** Signs out on this device only; other devices stay signed in. */
let gis=null;
/** Google Identity Services, loaded once and only on demand; rejects when unset, blocked or offline. */
function loadGis(){
  return gis??=new Promise((resolve,reject)=>{
    if(!googleId)return reject(Error('No Google client id'));
    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=()=>window.google?.accounts?.id?resolve(window.google.accounts.id):reject(Error('No GIS'));
    script.onerror=()=>{script.remove();reject(Error('GIS did not load'));};
    document.head.append(script);
  }).catch(error=>{gis=null;throw error;});
}
/**
 * Draws Google's sign-in button into `el`. `done(error)` runs after each sign-in attempt, with null
 * on success. Rejects when Google's script is unavailable, so the caller can fall back to signIn().
 */
export async function renderGoogleButton(el,done){
  const id=await loadGis(),{raw,hashed}=await newNonce();
  id.initialize({client_id:googleId,nonce:hashed,use_fedcm_for_prompt:true,callback:async({credential})=>{
    try{ok(await (await sb()).auth.signInWithIdToken({provider:'google',token:credential,nonce:raw}));done(null);}
    catch(error){done(error);}
  }});
  id.renderButton(el,{type:'standard',theme:'outline',size:'large',shape:'pill',text:'signin_with',locale:'zh-CN'});
}
export async function signOut(){ok(await (await sb()).auth.signOut({scope:'local'}));}

const saves=async()=>(await sb()).from('saves');
const me=async()=>{const u=await user();if(!u)throw Error('Not signed in');return u.id;};
/** The player's row {data,version,updated_at}, or null when there is none. */
export async function readSave(){return ok(await (await saves()).select('data,version,updated_at').eq('user_id',await me()).maybeSingle());}
/**
 * Creates the row when `seen` is null (error 23505 if another device made it first); otherwise
 * overwrites it only if it still carries `seen`. Returns the new updated_at, or null when the row
 * had moved on.
 */
export async function writeSave(profile,seen){
  const table=await saves(),row={data:profile,version:profile.version},id=await me();
  const rows=ok(seen===null?await table.insert({user_id:id,...row}).select('updated_at,data')
    :await table.update(row).eq('user_id',id).eq('updated_at',seen).select('updated_at'));
  if(seen===null&&rows[0]?.data){delete profile.businesses;delete profile.businessRevision;if(rows[0].data.businesses)profile.businesses=rows[0].data.businesses;if(rows[0].data.businessRevision)profile.businessRevision=rows[0].data.businessRevision;}
  return rows[0]?.updated_at??null;
}
export async function deleteSave(){ok(await (await saves()).delete().eq('user_id',await me()));}
/** The shape core/cloudsync.js expects. */
export const cloudApi={read:readSave,write:writeSave};
export async function businessRpc(action,request,seen){return ok(await (await sb()).rpc('roots_business_command',{p_business:'fruit-stand',p_action:action,p_request:request,p_seen:seen}));}
export async function businessStatus(){return ok(await (await sb()).rpc('roots_business_status'));}
