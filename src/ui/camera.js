import roots from '../content/roots.json' with {type:'json'};
import {qualifiesMemory,commitCapture,pickCamera,filmCost,ownCheckIn,framingHint,CAMERAS} from '../core/story-photo.js';
import {captureStore} from '../services/photos.js';
import {saveProfile} from '../core/profile.js';
import {CHECKINS,spotFor,checkIn} from '../core/checkins.js';
import {isKey,fillKeys} from '../core/keys.js';
import {isTyping} from '../core/input.js';
import {escapeHtml as esc} from '../core/language.js';
import {pinyinHtml} from './shell.js';
import {savePhoto} from './album.js';

/**
 * The cameras. Hold the right mouse button (town.js calls onCamera) or press the camera key to raise
 * one: a viewfinder, the view zoomed in (the wheel, the +/- keys or the slider set how far) and, in
 * your own camera, the name of whatever is centred shown large. A click (onShutter), Enter, Space or
 * the 拍照 button takes a 320×180 photo. Grandpa's camera photographs the album places only and never
 * uses film; your own (二手相机, from the resale shop) takes 打卡 check-ins and free photos for one film
 * each. Grandpa's comes up where an album photo is still being sought, otherwise your own if you have
 * one; the switch key or the camera's name swaps them. It comes down by itself under a panel, while
 * placing furniture, holding a toy or asleep, and with Esc.
 */
const {ui,zoom:ZOOM,reach,success,reward}=CHECKINS;
const W=320,H=180;
const zoomed=(fov,level)=>Math.atan(Math.tan(fov*Math.PI/360)/level)*360/Math.PI;   // degrees in, degrees out

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
    <div class="vf-name" aria-live="polite"></div>
    <div class="vf-bar">
      <button type="button" class="vf-which"></button>
      <label class="vf-zoom"><span>${esc(ui.zoom.zh)} <small>${esc(ui.zoom.en)}</small></span>
        <input type="range" min="${ZOOM.min}" max="${ZOOM.max}" step="0.1" aria-label="${esc(ui.zoom.zh)} · ${esc(ui.zoom.en)}"><output></output></label>
      <button type="button" class="vf-shoot">${esc(ui.shoot.zh)} <small>${esc(ui.shoot.en)}</small></button>
      <button type="button" class="vf-down">${esc(ui.down.zh)} <small>${esc(ui.down.en)}</small></button>
    </div>
    <p class="vf-hint">${esc(ui.hint.zh)}<small class="vf-keys"></small></p>`;
  const flash=document.createElement('div');flash.className='camera-flash';
  document.body.append(finder,flash);
  const $=s=>finder.querySelector(s),label=$('.vf-name'),which=$('.vf-which'),range=$('.vf-zoom input'),readout=$('.vf-zoom output');

  const owns=id=>(ctx.profile.inventory[id]??0)>0;
  const film=()=>ctx.profile.inventory.film??0;
  // The album places found so far in this place, the one picked in the album first.
  const memories=()=>{
    const found=ctx.profile.roots?.discovered??[];
    const list=roots.memories.filter(m=>!m.keepsake&&m.place===town.place&&found.includes(m.id));
    const picked=list.find(m=>m.id===ctx.storyMemory);
    return picked?[picked,...list.filter(m=>m!==picked)]:list;
  };
  /** How this frame would do as the memory's photo; the look-through check only once it could count. */
  const shotOf=m=>{
    const origin=town.camera.getPosition(),point=origin.clone().set(m.x,1.5,m.z),delta=point.clone().sub(origin),distance=delta.length(),screen=cam.worldToScreen(point);
    const inView=delta.dot(town.camera.forward)>0&&screen.x>=0&&screen.x<=town.app.graphicsDevice.width&&screen.y>=0&&screen.y<=town.app.graphicsDevice.height;
    const occluded=distance<=m.radius&&inView?!town.registry.visiblePoint(town.place,origin,point,m.clearance??2):true;
    return {place:town.place,distance,inView,occluded};
  };
  /** The album photo in reach: the first that counts, or the one to give a framing hint for. */
  const aim=()=>{
    let near=null;
    for(const m of memories()){
      const shot=shotOf(m);
      if(qualifiesMemory(m,shot))return {memory:m,ready:true};
      if(!near&&(m.id===ctx.storyMemory||shot.distance<=m.radius))near={memory:m,hint:framingHint(m,shot)};
    }
    return near??{memory:null};
  };
  // Grandpa's camera first while an album photo is sought: picked in the album, or a place here not yet photographed.
  const seeking=()=>memories().some(m=>m.id===ctx.storyMemory||(!ctx.profile.roots?.photos?.includes(m.id)&&shotOf(m).distance<=m.radius));
  const persistence={read:()=>ctx.profile,write:next=>{saveProfile(localStorage,next);ctx.profile=next;ctx.save();}};
  const publish=async r=>{if(!r.memoryId){await savePhoto({...r,id:r.time});await captureStore.delete(r.id);}};
  let recovering=null;
  const recover=()=>recovering??=(async()=>{for(const r of await captureStore.all())if(r.profileId===ctx.profile.roots?.id){const done=await commitCapture(r,captureStore,persistence);await publish(done);}})().finally(()=>{recovering=null;});
  let up=false,base=cam.fov,view=null,where=null,sensitivity=town.sensitivity,seen=null,shown,level=ZOOM.default,camera='grandpa';

  const setZoom=z=>{
    level=Math.min(ZOOM.max,Math.max(ZOOM.min,Number(z)||ZOOM.default));
    range.value=level;readout.textContent=level.toFixed(1)+'×';
    // The same hand movement, a steadier aim: sensitivity follows the zoom.
    if(up){cam.fov=zoomed(base,level);town.sensitivity=sensitivity/level;}
  };
  // Compared with what was last written, not textContent, which 繁體字 converts (script.js).
  let painted=null;
  const paintWhich=()=>{
    const text=camera==='grandpa'?ui.grandpa.zh:ui.mine.zh.replace('{n}',film());
    if(painted!==text){painted=text;which.textContent=text;which.title=(camera==='grandpa'?ui.grandpa.en:ui.mine.en.replace('{n}',film()))+' · '+fillKeys('{switchCamera}');}
  };
  const swap=()=>{
    if(!up)return;
    if(camera==='grandpa'&&!owns(CAMERAS.mine)){ctx.ui.notice(ui.noCamera.en);return;}
    camera=camera==='grandpa'?'mine':'grandpa';shown=undefined;paintWhich();
  };
  const blocked=()=>town.paused||!!town.ghost||!!town.toys.held||!!town.sleeping;
  const raise=on=>{
    on=!!on&&!blocked();
    if(on===up)return;
    up=on;town.viewfinder=on;finder.hidden=!on;document.body.classList.toggle('camera-up',on);
    if(on){
      // Framing a shot from behind your own back would fill it with you: look through your own eyes.
      view=town.view;where=town.place;if(view==='third')town.setView('first');
      base=cam.fov;sensitivity=town.sensitivity;setZoom(level);
      camera=pickCamera(ctx.profile,seeking());
      shown=undefined;paintWhich();$('.vf-keys').textContent=fillKeys(ui.hint.keys);
    } else {
      town.sensitivity=sensitivity;cam.fov=base;seen=null;
      // Back to third person only where it is allowed: a shop entered meanwhile has no room for it.
      if(view==='third'&&town.thirdPersonAllowed())town.setView('third');
    }
  };
  const show=html=>{if(html!==shown){shown=html;label.innerHTML=html;}};
  // Runs after town.js has placed the camera for this frame (its own prerender listener came first).
  town.app.on('prerender',()=>{
    if(!up)return;
    if(blocked()||town.place!==where){raise(false);return;}
    if(Math.abs(cam.fov-zoomed(base,level))>.01){base=cam.fov;cam.fov=zoomed(base,level);}   // a view switch reset it
    paintWhich();
    if(camera==='grandpa'){
      seen=null;
      const a=aim();
      show(a.ready?`<small>Ready to capture — press Enter · ${esc(roots.ui.ready)}</small>`
        :a.memory?`<small>${esc(ui.hints[a.hint])} · ${esc(roots.ui.notReady)}</small>`
        :`<small>${esc(ui.albumOnly.zh)}</small><small>${esc(ui.albumOnly.en)}</small>`);
      return;
    }
    seen=town.registry.look(town.place,town.camera.getPosition(),town.camera.forward,reach);
    const name=seen?.box.name??null,pinyin=name&&pinyinHtml(name.pinyin,name.zh);
    show(name?`<b>${esc(name.zh)}</b>${pinyin?`<small>${pinyin}</small>`:''}`:'');
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
      await recover();
      const using=camera;let m=null;
      if(using==='grandpa'){
        const a=aim();
        if(!a.ready){ctx.ui.notice(a.memory?ui.hints[a.hint]+' '+roots.ui.notReady:ui.albumOnly.zh+' / '+ui.albumOnly.en);return;}
        m=a.memory;
      }
      const cost=filmCost(using),profileId=ctx.profile.roots.id;
      if(film()<cost){ctx.ui.notice('胶卷用完了。请在相册中购买。 / Buy film in your story album.');return;}
      const name=seen?.box.name??null,spot=using==='mine'?spotFor({place:town.place,name,owner:seen?.box.owner??null,distance:seen?.distance??Infinity,hour:town.daylight.hour}):null;
      const src=await capture();if(ctx.profile.roots.id!==profileId)throw Error('Profile changed');if(m&&!qualifiesMemory(m,shotOf(m))){ctx.ui.notice(roots.ui.notReady);return;}
      const record={id:crypto.randomUUID(),profileId,memoryId:m?.id,src,cost,time:Date.now(),place:placeName(),name:name&&{zh:name.zh,pinyin:name.pinyin??'',en:name.en??''},spot:spot?.id??null};
      await commitCapture(record,captureStore,persistence);
      flash.classList.remove('on');void flash.offsetWidth;flash.classList.add('on');shutterSound(ctx.music);
      await publish(record);
      const stamped=!!spot&&checkIn(ctx.profile,spot),quest=ownCheckIn(ctx.profile,using,spot);
      if(stamped||quest)ctx.save();
      if(stamped){ctx.music?.cue('reward');ctx.ui.notice(success.zh+' '+spot.line.zh+' +'+reward+' 学习币');say(ctx.voice,[success.audio,spot.line.audio]);}
      if(m){ctx.ui.notice('回忆已记录。 / Memory captured.');if(ctx.storyMemory===m.id)ctx.storyMemory=null;ctx.save();}
    }catch{ctx.ui.notice(ui.failed.zh+' / '+ui.failed.en);}finally{busy=false;}
  };

  town.onCamera=raise;
  town.onShutter=shoot;
  which.onclick=swap;
  $('.vf-shoot').onclick=shoot;
  $('.vf-down').onclick=()=>raise(false);
  range.oninput=()=>setZoom(range.value);
  // Keys go back to the game after a drag or a click on the slider (town.js ignores keys typed into
  // an input); a click without movement fires no change, so pointerup lets go too.
  for(const type of ['change','pointerup'])range.addEventListener(type,()=>range.blur());
  setZoom(level);
  // Alt-tab or a hidden tab with the right button held never delivers its pointerup, and a lost
  // pointer lock means the next click should take the mouse back, not a photo: the camera comes down.
  addEventListener('blur',()=>raise(false));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)raise(false);});
  document.addEventListener('pointerlockchange',()=>{if(!town.locked())raise(false);});
  // The wheel or a two-finger trackpad scroll zooms (a trackpad pinch arrives as a wheel with Ctrl held).
  addEventListener('wheel',e=>{
    if(!up)return;
    e.preventDefault();
    setZoom(level*Math.exp(-e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?400:1)*.0015));
  },{passive:false});
  addEventListener('keydown',e=>{
    if(town.paused||isTyping(e.target)||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
    if(isKey(e,'camera')){if(!e.repeat)raise(!up);return;}
    if(!up)return;
    if(e.code==='Escape'){raise(false);return;}
    if(isKey(e,'switchCamera')){if(!e.repeat)swap();return;}
    // Space is the shutter while the camera is up (town.js skips the jump).
    if(e.code==='Enter'||e.code==='NumpadEnter'||isKey(e,'jump')){e.preventDefault();if(!e.repeat)shoot();return;}
    if(e.key==='+'||e.key==='='||e.code==='NumpadAdd'){e.preventDefault();setZoom(level*1.25);}
    else if(e.key==='-'||e.key==='_'||e.code==='NumpadSubtract'){e.preventDefault();setZoom(level/1.25);}
  });
}
