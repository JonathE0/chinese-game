import soundtrack from '../content/music.json' with {type:'json'};
import {Playlist} from '../core/music-playlist.js';
import {playNote,songBus} from './music-instruments.js';

// Only the environmental bed changes at doorways; songs keep their tempo and key.
const PLACES={
  town:[800,.04],cafe:[1200,.012],restaurant:[1700,.025],home:[600,.008],
  hall:[700,.006],library:[620,.006],lifestyle:[950,.012],supermarket:[1400,.02],
  lights:[1100,.008],homeware:[850,.012],bakery:[1300,.016],bank:[650,.006],
  resale:[1000,.014],city:[1900,.05],
};
const CUES={collect:[0,4,7],purchase:[0,7,12],place:[7,4],eat:[4,7],reward:[0,4,7,12]};
const smooth=(parameter,value,now,duration=.2)=>{
  parameter.cancelScheduledValues(now);parameter.setTargetAtTime(value,now,duration);
};

export class Ambience {
  constructor(settings){
    this.settings=settings;this.ctx=null;this.master=null;this.timer=null;
    this.ducked=false;this.place='town';this.lastCue=-Infinity;
    this.playlist=new Playlist(soundtrack.tracks);this.active=null;this.retired=[];this.listeners=new Set();
  }
  get volume(){return this.settings.musicVolume??.5;}
  get scene(){const [air,airGain]=PLACES[this.place]??PLACES.town;return {air,airGain};}
  get currentTrack(){return this.playlist.current?.track??null;}
  subscribe(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
  notify(){for(const listener of this.listeners)listener();}
  async start(){
    if(this.ctx)return this.resume();
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return false;
    this.ctx=new Context();
    this.master=this.ctx.createGain();this.master.gain.value=1;this.master.connect(this.ctx.destination);
    this.highpass=this.ctx.createBiquadFilter();this.highpass.type='highpass';
    this.highpass.frequency.value=55;this.highpass.Q.value=.7;this.highpass.connect(this.master);
    // User volume/ducking sits outside each song's own fade envelope.
    this.music=this.ctx.createGain();this.music.gain.value=0;this.music.connect(this.highpass);
    this.effects=this.ctx.createGain();this.effects.gain.value=0;this.effects.connect(this.highpass);
    this.air=this.ctx.createGain();this.air.gain.value=0;this.air.connect(this.effects);
    this.breeze();this.timer=setInterval(()=>this.schedule(),100);
    const running=await this.resume();this.applyGain(.2);return running;
  }
  async resume(){
    try{await this.ctx?.resume();}catch{}
    this.schedule();this.notify();return this.ctx?.state==='running';
  }
  applyGain(seconds=.15){
    if(!this.ctx)return;
    const now=this.ctx.currentTime,duck=this.ducked?.22:1;
    smooth(this.music.gain,this.volume*.7*duck,now,seconds);
    smooth(this.effects.gain,(this.settings.ambientVolume??.35)*duck,now,seconds);
    smooth(this.air.gain,this.scene.airGain,now,.4);
  }
  setVolume(){this.applyGain();}
  duck(active){this.ducked=!!active;this.applyGain();}
  setPlace(place){
    if(this.place===place)return;
    this.place=place;
    if(this.ctx){smooth(this.airFilter.frequency,this.scene.air,this.ctx.currentTime,.45);this.applyGain();}
  }
  breeze(){
    const length=this.ctx.sampleRate*3,buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*.25;
    const source=this.ctx.createBufferSource();source.buffer=buffer;source.loop=true;
    this.airFilter=this.ctx.createBiquadFilter();this.airFilter.type='bandpass';
    this.airFilter.frequency.value=this.scene.air;this.airFilter.Q.value=.8;
    source.connect(this.airFilter);this.airFilter.connect(this.air);source.start();
  }
  skip(){
    if(!this.ctx||this.ctx.state!=='running'||!this.active)return false;
    const now=this.ctx.currentTime,old=this.active;
    old.bus.envelope.gain.cancelAndHoldAtTime(now);
    old.bus.envelope.gain.linearRampToValueAtTime(0,now+1.5);
    this.retired.push({bus:old.bus,until:now+1.6});this.active=null;
    this.playlist.skip(now);this.notify();return true;
  }
  schedule(){
    if(!this.ctx||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime;
    this.retired=this.retired.filter(entry=>{if(now<entry.until)return true;entry.bus.disconnect();return false;});
    const song=this.playlist.update(now);
    if(song!==(this.active?.song??null)){
      if(this.active){this.active.bus.disconnect();this.active=null;}
      if(song)this.active={song,bus:songBus(this.ctx,this.music,song),index:0};
      this.notify();
    }
    if(!this.active)return;
    const a=this.active,events=song.score.events;
    // Discard notes missed by a throttled timer; never flush them in a burst.
    while(a.index<events.length&&song.start+events[a.index].at<now-.1)a.index++;
    while(a.index<events.length&&song.start+events[a.index].at<now+.3){
      const event=events[a.index++];
      playNote(this.ctx,a.bus.input,event,Math.max(now,song.start+event.at));
    }
  }
  cue(kind){
    if(!this.ctx||this.ctx.state!=='running'||(this.settings.ambientVolume??.35)<=0)return false;
    const sequence=CUES[kind];if(!sequence)return false;
    const now=this.ctx.currentTime;if(now-this.lastCue<.18)return false;
    this.lastCue=now;
    for(const [i,n] of sequence.entries())
      playNote(this.ctx,this.effects,{kind:'mallet',notes:[n+12],length:.55,level:.6},now+i*.07);
    return true;
  }
  async suspend(){try{await this.ctx?.suspend();}catch{}}
  stop(){
    clearInterval(this.timer);this.timer=null;this.ctx?.close().catch(()=>{});
    this.active?.bus.disconnect();for(const entry of this.retired)entry.bus.disconnect();
    this.active=null;this.retired=[];this.playlist=new Playlist(soundtrack.tracks);
    this.ctx=null;this.master=null;this.lastCue=-Infinity;this.notify();
  }
}
