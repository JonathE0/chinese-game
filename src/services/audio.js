import {assetUrl} from './asset-url.js';

export class VoicePlayer {
  constructor(settings,onNotice){this.settings=settings;this.onNotice=onNotice;this.clips={};this.foreground=null;this.ambient=null;this.ready=false;}
  async load(){try{const r=await fetch(assetUrl('/audio/manifest.json'));if(r.ok)this.clips=(await r.json()).clips??{};}catch{}this.ready=true;}
  available(id){return !!this.clips[id]?.approved;}
  info(id){return this.clips[id]??null;}
  // Say plainly where a voice came from: generated speech is not a native-speaker recording.
  sourceLabel(id){
    const clip=this.clips[id];
    if(!clip?.approved)return '录音准备中';
    if(clip.source==='generated')return clip.review==='reviewed'?'普通话 · AI 配音（已审听）':'普通话 · AI 配音';
    return '普通话 · 真人录音';
  }
  async play(id,{slow=false,ambient=false}={}){
    const clip=this.clips[id];
    if(!clip?.approved){if(!ambient)this.onNotice('录音准备中 · Natural voice recording not available yet.');return;}
    const lane=ambient?'ambient':'foreground';this[lane]?.pause();
    const a=new Audio(assetUrl(clip.src));a.preservesPitch=true;a.playbackRate=slow?.78:1;a.volume=ambient?this.settings.ambientVolume:this.settings.dialogueVolume;this[lane]=a;
    if(!ambient&&this.ambient)this.ambient.volume=this.settings.ambientVolume*.18;
    a.onended=()=>{if(!ambient&&this.ambient)this.ambient.volume=this.settings.ambientVolume;};
    // A clip cut short by the next one rejects with AbortError; that is not a failure to report.
    try{await a.play();}catch(error){if(!ambient&&error?.name!=='AbortError')this.onNotice('录音暂时无法播放 · Recording could not be played.');}
  }
  stop(){this.foreground?.pause();this.foreground=null;}
  duck(active){if(this.ambient)this.ambient.volume=this.settings.ambientVolume*(active?.18:1);}
}

/**
 * A ticket gate's reader, synthesized: 'ok' is its short bright 嘀, 'error' a low double buzz.
 * `volume` 0..1 (the dialogue volume); nothing plays at 0 or where WebAudio is missing.
 */
let tones=null;
export function gateTone(kind,volume=1){
  const Context=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!(volume>0)||!Context)return;
  tones??=new Context();tones.resume?.().catch(()=>{});
  const now=tones.currentTime,gain=tones.createGain();gain.connect(tones.destination);
  const blip=(freq,at,length,type,level)=>{
    const o=tones.createOscillator();o.type=type;o.frequency.value=freq;o.connect(gain);
    gain.gain.setValueAtTime(0,now+at);gain.gain.linearRampToValueAtTime(level*volume,now+at+.01);
    gain.gain.setValueAtTime(level*volume,now+at+length-.03);gain.gain.linearRampToValueAtTime(0,now+at+length);
    o.start(now+at);o.stop(now+at+length);
  };
  if(kind==='error'){blip(196,0,.17,'square',.12);blip(196,.23,.22,'square',.12);}
  else blip(1760,0,.13,'sine',.25);
}
