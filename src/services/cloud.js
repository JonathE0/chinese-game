/**
 * A thin wrapper over supabase-js for the cloud save (see docs/CLOUD_SETUP.md). Unless both
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set at build time, supabase-js is never loaded
 * and no request is ever made. Sign-in is Google only, through the PKCE flow; supabase-js keeps the
 * session in its own storage and exchanges the returned ?code= itself when the page loads again.
 */
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
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
  const rows=ok(seen===null?await table.insert({user_id:id,...row}).select('updated_at')
    :await table.update(row).eq('user_id',id).eq('updated_at',seen).select('updated_at'));
  return rows[0]?.updated_at??null;
}
export async function deleteSave(){ok(await (await saves()).delete().eq('user_id',await me()));}
/** The shape core/cloudsync.js expects. */
export const cloudApi={read:readSave,write:writeSave};
