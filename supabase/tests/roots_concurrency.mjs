import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const toolsDir=path.resolve(process.env.ROOTS_DB_TOOLS??'.superpowers/sdd/2026-09-28-roots-chapter-one/dbtest');
const {initdb,pg_ctl}=await import(pathToFileURL(path.join(toolsDir,'node_modules/@embedded-postgres/windows-x64/dist/index.js')));
const {default:pg}=await import(pathToFileURL(path.join(toolsDir,'node_modules/pg/lib/index.js')));const {Client}=pg;
const scratch=fs.mkdtempSync(path.join(toolsDir,'concurrency-'));
const data=path.join(scratch,'data');
const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const run=(bin,args)=>{const fd=fs.openSync(path.join(scratch,'commands.log'),'a');try{return execFileSync(bin,args,{windowsHide:true,timeout:30000,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}};
const clients=[];let started=false;
const connect=async()=>{const c=new Client({host:'127.0.0.1',port,user:'roots_test',database:'postgres',statement_timeout:10000});await c.connect();clients.push(c);return c;};
try{
 run(initdb,['-D',data,'-U','roots_test','-A','trust','--encoding=UTF8','--no-locale']);
 run(pg_ctl,['-D',data,'-l',path.join(scratch,'postgres.log'),'-o','-h 127.0.0.1 -p '+port+' -F','-w','start']);started=true;
 const admin=await connect();
 await admin.query("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 for(const file of ['20260924000000_cloud_saves.sql','20260928000000_roots_businesses.sql'])await admin.query(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 const uid='00000000-0000-4000-8000-000000000001';await admin.query('insert into auth.users values($1)',[uid]);
 const profile={version:7,wallet:500,roots:{met:true,photos:['roots-fruit'],bankMastered:true,mastery:{'roots-greeting':['greet-a','greet-b'],'roots-fruit-request':['fruit-a','fruit-b'],'roots-quantity':['quantity-a','quantity-b']}}};
 await admin.query('insert into public.saves(user_id,data,version) values($1,$2,7)',[uid,profile]);
 const a=await connect(),b=await connect();for(const c of [a,b]){await c.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await c.query('set role authenticated');}
 const pids=await Promise.all([a,b].map(async c=>(await c.query('select pg_backend_pid() as pid')).rows[0].pid));assert.notEqual(...pids);
 // Hold the shared save row until both separate sessions are visibly waiting on its lock.
 const overlap=async tasks=>{
  await admin.query('begin');await admin.query('select user_id from public.saves where user_id=$1 for update',[uid]);
  const pending=Promise.allSettled(tasks.map(task=>task()));
  try{
   let waiting=0;for(let i=0;i<100;i++){waiting=(await admin.query("select count(*)::int as n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'",[pids])).rows[0].n;if(waiting===tasks.length)break;await new Promise(resolve=>setTimeout(resolve,10));}
   assert.equal(waiting,tasks.length,'both database sessions must overlap at the save lock');
  }finally{await admin.query('commit');}
  return pending;
 };
 const values=results=>results.map(r=>{assert.equal(r.status,'fulfilled',r.reason?.message);return r.value;});
 const snapshot=async()=> (await admin.query('select data,updated_at::text as seen from public.saves where user_id=$1',[uid])).rows[0];
 const unthrottle=()=>admin.query("update public.save_writes set at=clock_timestamp()-interval '1 minute'");
 const age=()=>admin.query("update public.roots_businesses set settled_at=clock_timestamp()-interval '12 hours',remainder=0");
 let sequence=0;const id=()=> '10000000-0000-4000-8000-'+String(++sequence).padStart(12,'0');
 const call=async(c,action,request,seen)=>(await c.query('select public.roots_business_command($1,$2,$3,$4) as r',['fruit-stand',action,request,seen])).rows[0].r;
 await unthrottle();await admin.query("update public.saves set data=jsonb_set(data,'{wallet}','19')");await unthrottle();
 const refused=id();assert.equal((await call(a,'activate',refused,(await snapshot()).seen)).status,'funds');assert.equal((await snapshot()).data.wallet,19);
 assert.equal((await admin.query('select count(*)::int as n from public.roots_businesses')).rows[0].n,0);assert.equal((await admin.query('select count(*)::int as n from public.roots_receipts')).rows[0].n,0);
 await assert.rejects(call(a,'invent-income',id(),(await snapshot()).seen),/Invalid business command/);
 await unthrottle();await admin.query("update public.saves set data=jsonb_set(data,'{wallet}','500')");await unthrottle();await call(a,'activate',id(),(await snapshot()).seen);
 console.log('PASS: insufficient funds and invalid actions cause no payment or ledger mutation');
 await age();await unthrottle();let before=await snapshot();const request=id();
 const duplicates=values(await overlap([()=>call(a,'collect',request,before.seen),()=>call(b,'collect',request,before.seen)]));
 assert.deepEqual(duplicates.map(r=>r.status),['settled','settled']);assert.equal(duplicates.filter(r=>r.duplicate).length,1);assert.equal((await snapshot()).data.wallet,before.data.wallet+15);
 console.log('PASS: simultaneous identical receipt pays exactly once');
 await age();await unthrottle();before=await snapshot();
 const competing=values(await overlap([()=>call(a,'collect',id(),before.seen),()=>call(b,'collect',id(),before.seen)]));
 assert.deepEqual(competing.map(r=>r.status).sort(),['conflict','settled']);assert.equal((await snapshot()).data.wallet,before.data.wallet+15);
 console.log('PASS: competing receipts cannot double-collect');
 await age();await unthrottle();before=await snapshot();const actions=['collect','automate'];
 const upgrades=values(await overlap(actions.map((action,i)=>()=>call([a,b][i],action,id(),before.seen))));
 assert.deepEqual(upgrades.map(r=>r.status).sort(),['conflict','settled']);
 await unthrottle();await call(a,actions[upgrades.findIndex(r=>r.status==='conflict')],id(),(await snapshot()).seen);
 const upgraded=await snapshot();assert.equal(upgraded.data.businesses['fruit-stand'].automatic,true);assert.equal(upgraded.data.wallet,before.data.wallet+15-90);
 console.log('PASS: collection racing an upgrade pays once and charges one upgrade');
 await age();await unthrottle();before=await snapshot();
 const local={...before.data,wallet:before.data.wallet-5,inventory:{apple:1}};
 const race=await overlap([()=>call(a,'collect',id(),before.seen),()=>b.query('update public.saves set data=$1 where user_id=$2 and updated_at=$3 returning updated_at',[local,uid,before.seen])]);
 const after=await snapshot();const payoutWon=race[0].status==='fulfilled'&&race[0].value.status==='settled';
 assert.equal(after.data.wallet,payoutWon?before.data.wallet+15:before.data.wallet-5);assert.equal(after.data.inventory?.apple,payoutWon?undefined:1);
 if(!payoutWon)assert.equal(race[0].value.status,'conflict');
 console.log('PASS: autosave racing payout preserves one coherent save');
 await admin.query("update public.roots_businesses set settled_at=clock_timestamp()-interval '40 minutes',remainder=0.5");await unthrottle();before=await snapshot();
 const fraction=await call(a,'collect',id(),before.seen);assert.equal(fraction.amount,1);
 const remainder=Number((await admin.query('select remainder from public.roots_businesses')).rows[0].remainder);assert.ok(remainder>.32&&remainder<.35);
 await unthrottle();assert.equal((await call(a,'collect',id(),(await snapshot()).seen)).amount,0);assert.equal((await snapshot()).data.wallet,before.data.wallet+1);
 console.log('PASS: fractional income survives a collection without rounding into duplicate coins');
 await unthrottle();before=await snapshot();const unpaid=id();
 // Write immediately before collecting: the five-second throttle must roll back every ledger change.
 await a.query('update public.saves set data=data where user_id=$1',[uid]);const ledgerBefore=(await admin.query('select settled_at::text,remainder from public.roots_businesses')).rows[0];
 await assert.rejects(call(a,'collect',unpaid,(await snapshot()).seen),/too many saves/);
 assert.deepEqual((await admin.query('select settled_at::text,remainder from public.roots_businesses')).rows[0],ledgerBefore);
 assert.equal((await admin.query('select count(*)::int as n from public.roots_receipts where request=$1',[unpaid])).rows[0].n,0);
 console.log('PASS: throttled payout leaves neither cursor changes nor a receipt');
 console.log('PASS: real PostgreSQL multi-connection suite; evidence '+scratch);
}finally{
 for(const c of clients)await c.end().catch(()=>{});
 if(started||fs.existsSync(path.join(data,'postmaster.pid')))run(pg_ctl,['-D',data,'-m','fast','-w','stop']);
}
