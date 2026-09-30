import roots from '../content/roots.json' with {type:'json'};
import {qualifiesMemory,commitCapture} from '../core/story-photo.js';
import {captureStore} from '../services/photos.js';
import {saveProfile} from '../core/profile.js';
import {CHECKINS,spotFor,checkIn} from '../core/checkins.js';
import {isKey} from '../core/keys.js';
import {isTyping} from '../core/input.js';
import {escapeHtml as esc} from '../core/language.js';
import {pinyinHtml} from './shell.js';
import {savePhoto} from './album.js';

/**
 * The 打卡 camera. Hold the right mouse button (town.js calls onCamera) or press the camera key to
 * raise it: a viewfinder, the view zoomed in, and the name of whatever is centred shown large. A left
 * click (onShutter), Enter or the touch shutter button takes a 320×180 photo into the 相册, and a
 * check-in spot pays the first time. It comes down by itself under a panel, while placing furniture,
 * holding a toy or asleep.
 */
const {ui,zoom,reach,success,reward}=CHECKINS;
const W=320,H=180;
const zoomed=fov=>Math.atan(Math.tan(fov*Math.PI/360)/zoom)*360/Math.PI;   // degrees in, degrees out

/** Two short bursts of noise on the effects bus, at the ambience volume: the shutter's click. */
function shutterSound(music){
  const ac=music?.ctx;
  if(!ac||ac.state!=='running'||!music.effects)return;
  const n=Math.floor(ac.sampleRate*.05),buffer=ac.createBuffer(1,n,ac.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*(1-i/n)**3;
  for(const at of [0,.09]){const s=ac.createBufferSource();s.buffer=buffer;s.connect(music.effects);s.start(ac.currentTime+at);}
}
/** Plays clips one after another. A clip not recorded yet is skipped quietly (the notice already
 *  shows the words); an interrupted one ends the run. */
async function say(voice,ids){
  for(const id of ids.filter(id=>voice.clips?.[id]?.approved)){
    await voice.play(id);
    const a=voice.foreground;
    if(a&&!a.ended&&!a.paused)await new Promise(done=>{a.addEventListener('ended',done,{once:true});a.addEventListener('pause',done,{once:true});});
  }
}

export function installCamera(ctx){
  const town=ctx.town,cam=town.camera.camera;
  const finder=document.createElement('div');finder.id='viewfinder';finder.hidden=true;
  finder.innerHTML=`<i class="vf-corner tl"></i><i class="vf-corner tr"></i><i class="vf-corner bl"></i><i class="vf-corner br"></i>
    <div class="vf-name" aria-live="polite"></div><span class="vf-zoom">${esc(ui.zoom.zh)} ${zoom}×</span>
    <p class="vf-hint">${esc(ui.hint.zh)}<small>${esc(ui.hint.en)}</small></p>`;
  const flash=document.createElement('div');flash.className='camera-flash';
  document.body.append(finder,flash);
  const label=finder.querySelector('.vf-name');
  const memory=()=>roots.memories.find(m=>m.id===ctx.storyMemory);
  const qualifies=()=>{const m=memory();if(!m)return false;const origin=town.camera.getPosition(),target=origin.clone().set(m.x,1.5,m.z),delta=target.clone().sub(origin),distance=delta.length(),screen=cam.worldToScreen(target);return qualifiesMemory(m,{place:town.place,distance,inView:delta.dot(town.camera.forward)>0&&screen.x>=0&&screen.x<=town.app.graphicsDevice.width&&screen.y>=0&&screen.y<=town.app.graphicsDevice.height,occluded:!town.registry.visiblePoint(town.place,origin,target,m.id==='roots-home'?5:2)});};
  const persistence={read:()=>ctx.profile,write:next=>{saveProfile(localStorage,next);ctx.profile=next;ctx.save();}};
  const publish=async r=>{if(!r.memoryId){await savePhoto({...r,id:r.time});await captureStore.delete(r.id);}};
  let recovering=null;
  const recover=()=>recovering??=(async()=>{for(const r of await captureStore.all())if(r.profileId===ctx.profile.roots?.id){const done=await commitCapture(r,captureStore,persistence);await publish(done);}})().finally(()=>{recovering=null;});
  let up=false,base=cam.fov,view=null,where=null,sensitivity=town.sensitivity,seen=null,shown;

  const blocked=()=>town.paused||!!town.ghost||!!town.toys.held||!!town.sleeping;
  const raise=on=>{
    on=!!on&&!blocked();
    if(on===up)return;
    up=on;town.viewfinder=on;finder.hidden=!on;document.body.classList.toggle('camera-up',on);
    if(on){
      // Framing a shot from behind your own back would fill it with you: look through your own eyes.
      view=town.view;where=town.place;if(view==='third')town.setView('first');
      base=cam.fov;cam.fov=zoomed(base);
      sensitivity=town.sensitivity;town.sensitivity=sensitivity/zoom;   // the same hand movement, a steadier aim
      shown=undefined;
    } else {
      town.sensitivity=sensitivity;cam.fov=base;seen=null;
      // Back to third person only where it is allowed: a shop entered meanwhile has no room for it.
      if(view==='third'&&town.thirdPersonAllowed())town.setView('third');
    }
  };
  // Runs after town.js has placed the camera for this frame (its own prerender listener came first).
  town.app.on('prerender',()=>{
    if(!up)return;
    if(blocked()||town.place!==where){raise(false);return;}
    if(Math.abs(cam.fov-zoomed(base))>.01){base=cam.fov;cam.fov=zoomed(base);}   // a view switch reset it
    seen=town.registry.look(town.place,town.camera.getPosition(),town.camera.forward,reach);
    const name=seen?.box.name??null;
    if(ctx.storyMemory){label.textContent=(qualifies()?'Ready to capture — press Enter · '+roots.ui.ready:'Find the place and keep the landmark in view · '+roots.ui.notReady)+' · Film: '+(ctx.profile.inventory.film??0);return;}
    if(name===shown)return;
    shown=name;
    const pinyin=name&&pinyinHtml(name.pinyin,name.zh);
    label.innerHTML=name?`<b>${esc(name.zh)}</b>${pinyin?`<small>${pinyin}</small>`:''}`:'';
  });

  // A WebGL canvas can only be read straight after it is drawn, in the same frame.
  const capture=()=>new Promise((resolve,reject)=>town.app.once('frameend',()=>{
    try{
      const source=town.canvas,c=document.createElement('canvas');c.width=W;c.height=H;
      const scale=Math.max(W/source.width,H/source.height),w=W/scale,h=H/scale;
      c.getContext('2d').drawImage(source,(source.width-w)/2,(source.height-h)/2,w,h,0,0,W,H);
      resolve(c.toDataURL('image/jpeg',.82));
    }catch(error){reject(error);}
  }));
  const placeName=()=>{
    if(town.place==='town'){const p=town.player.entity.getPosition(),d=town.districtAt(p.x,p.z);return {zh:d?.zh??'',en:d?.en??''};}
    const data=town.rooms.get(town.place)?.data;
    return {zh:data?.zh??'',en:data?.en??''};
  };
  let busy=false;
  const shoot=async()=>{
    if(!up||busy)return;
    busy=true;
    try{
      await recover();const m=memory();if(ctx.storyMemory&&!qualifies()){ctx.ui.notice('Move closer and keep the landmark in view. No film was used.');return;}
      const profileId=ctx.profile.roots.id;const existing=m?(await captureStore.all()).some(r=>r.profileId===profileId&&r.memoryId===m.id&&r.done):false;const cost=m&&ctx.profile.roots.photos.includes(m.id)&&!existing?0:1;
      if((ctx.profile.inventory.film??0)<cost){ctx.ui.notice('胶卷用完了。请在相册中购买。 / Buy film in your story album.');return;}
      const name=seen?.box.name??null,spot=spotFor({place:town.place,name,owner:seen?.box.owner??null,distance:seen?.distance??Infinity,hour:town.daylight.hour});
      const src=await capture();if(ctx.profile.roots.id!==profileId)throw Error("Profile changed");if(m&&!qualifies()){ctx.ui.notice(roots.ui.notReady);return;}
      const record={id:crypto.randomUUID(),profileId:ctx.profile.roots.id,memoryId:m?.id,src,cost,time:Date.now(),place:placeName(),name:name&&{zh:name.zh,pinyin:name.pinyin??'',en:name.en??''},spot:spot?.id??null};
      await commitCapture(record,captureStore,persistence);
      flash.classList.remove('on');void flash.offsetWidth;flash.classList.add('on');shutterSound(ctx.music);
      await publish(record);
      if(spot&&checkIn(ctx.profile,spot)){ctx.save();ctx.music?.cue('reward');ctx.ui.notice(success.zh+' '+spot.line.zh+' +'+reward+' 学习币');say(ctx.voice,[success.audio,spot.line.audio]);}
      if(m){ctx.ui.notice('回忆已记录。 / Memory captured.');ctx.save();}
    }catch{ctx.ui.notice(ui.failed.zh+' / '+ui.failed.en);}finally{busy=false;}
    busy=false;
  };

  town.onCamera=raise;
  town.onShutter=shoot;
  // Alt-tab or a hidden tab with the right button held never delivers its pointerup, and a lost
  // pointer lock means the next click should take the mouse back, not a photo: the camera comes down.
  addEventListener('blur',()=>raise(false));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)raise(false);});
  document.addEventListener('pointerlockchange',()=>{if(!town.locked())raise(false);});
  addEventListener('keydown',e=>{
    if(town.paused||isTyping(e.target)||e.isComposing||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
    if(isKey(e,'camera')){raise(!up);return;}
    if(up&&(e.code==='Enter'||e.code==='NumpadEnter')){e.preventDefault();shoot();}
  });
}
