// The town's own little band. Everything is synthesised in the browser — no audio to download,
// no licence to clear — but the writing is deliberate: a lazy swung shuffle over jazz sevenths,
// a marimba carrying the tune, a soft walking bass and a shaker on the offbeat. It is meant to
// sound like a small town on a warm afternoon, and to survive being heard for an hour.
const SEMITONE=n=>261.626*2**(n/12);          // n is semitones from middle C

// | Fmaj7 | G7 | Em7 | Am7 | Dm7 | G7 | Cmaj7 | Cmaj7 :|
const PROGRESSION=[
  {bass:-7, chord:[5,9,12,16]},   // Fmaj7
  {bass:-5, chord:[7,11,14,17]},  // G7
  {bass:-8, chord:[4,7,11,14]},   // Em7
  {bass:-3, chord:[9,12,16,19]},  // Am7
  {bass:-10,chord:[2,5,9,12]},    // Dm7
  {bass:-5, chord:[7,11,14,17]},  // G7
  {bass:0,  chord:[0,4,7,11]},    // Cmaj7
  {bass:0,  chord:[0,4,7,11]},
];
// Eight bars of tune, one entry per swung eighth. null is a rest; numbers are scale steps
// above the bar's root, so the same line sits happily on every chord.
const TUNE=[
  [0,null,2,4,null,2,0,null], [4,null,2,0,null,-1,0,null],
  [2,4,null,7,null,4,2,null], [0,null,-1,0,2,null,null,null],
  [4,null,5,7,null,5,4,null], [7,null,5,4,null,2,4,null],
  [0,2,4,7,null,9,7,null],    [4,null,2,0,null,null,null,null],
];
const MAJOR=[0,2,4,5,7,9,11];
const step=n=>{const octave=Math.floor(n/7);return MAJOR[((n%7)+7)%7]+octave*12;};

const PLACES={
  town:       {beat:.44,swing:.62,tone:'triangle',shift:0, air:800, airGain:.04, brush:.5},
  cafe:       {beat:.52,swing:.66,tone:'sine',    shift:0, air:1200,airGain:.012,brush:.32},
  restaurant: {beat:.46,swing:.64,tone:'triangle',shift:2, air:1700,airGain:.025,brush:.4},
  home:       {beat:.6, swing:.58,tone:'sine',    shift:-5,air:600, airGain:.008,brush:.2},
  hall:       {beat:.62,swing:.56,tone:'sine',    shift:-3,air:700, airGain:.006,brush:.18},
  library:    {beat:.66,swing:.55,tone:'sine',    shift:-5,air:620, airGain:.006,brush:.14},
  lifestyle:  {beat:.48,swing:.63,tone:'sine',    shift:1, air:950, airGain:.012,brush:.3},
  supermarket:{beat:.4, swing:.6, tone:'triangle',shift:2, air:1400,airGain:.02, brush:.45},
  lights:     {beat:.5, swing:.62,tone:'sine',    shift:3, air:1100,airGain:.008,brush:.26},
  homeware:   {beat:.5, swing:.62,tone:'triangle',shift:0, air:850, airGain:.012,brush:.3},
  bakery:     {beat:.44,swing:.66,tone:'triangle',shift:4, air:1300,airGain:.016,brush:.42},
  bank:       {beat:.56,swing:.58,tone:'sine',    shift:1, air:650, airGain:.006,brush:.2},
  resale:     {beat:.5, swing:.6, tone:'triangle',shift:-1,air:1000,airGain:.014,brush:.28},
  // Downtown: faster, a fourth up, and more air — a city has traffic where a town has birds.
  city:       {beat:.34,swing:.56,tone:'triangle',shift:5, air:1900,airGain:.05, brush:.6},
};
const CUES={collect:[0,4,7],purchase:[0,7,12],place:[7,4],eat:[4,7],reward:[0,4,7,12]};
const smooth=(parameter,value,now,duration=.2)=>{
  parameter.cancelScheduledValues(now);parameter.setTargetAtTime(value,now,duration);
};

export class Ambience {
  constructor(settings){
    this.settings=settings;this.ctx=null;this.master=null;this.timer=null;this.next=0;
    this.beatIndex=0;this.ducked=false;this.place='town';this.lastCue=-Infinity;
  }
  get volume(){return this.settings.musicVolume??.5;}
  get scene(){return PLACES[this.place]??PLACES.town;}

  async start(){
    if(this.ctx)return this.resume();
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return false;
    this.ctx=new Context();
    this.master=this.ctx.createGain();this.master.gain.value=1;this.master.connect(this.ctx.destination);
    // Strip rumble without gutting the bass: 55 Hz is below the lowest note the band plays.
    this.highpass=this.ctx.createBiquadFilter();this.highpass.type='highpass';
    this.highpass.frequency.value=55;this.highpass.Q.value=.7;
    this.highpass.connect(this.master);
    this.music=this.ctx.createGain();this.music.gain.value=0;this.music.connect(this.highpass);
    this.effects=this.ctx.createGain();this.effects.gain.value=0;this.effects.connect(this.highpass);
    this.air=this.ctx.createGain();this.air.gain.value=0;this.air.connect(this.effects);
    this.breeze();
    this.next=this.ctx.currentTime+.08;this.beatIndex=0;
    this.timer=setInterval(()=>this.schedule(),100);
    const running=await this.resume();this.applyGain(.2);return running;
  }
  async resume(){
    try{await this.ctx?.resume();}catch{}
    return this.ctx?.state==='running';
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
    if(this.ctx){
      smooth(this.airFilter.frequency,this.scene.air,this.ctx.currentTime,.45);
      this.applyGain();
    }
  }
  breeze(){
    const length=this.ctx.sampleRate*3,buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*.25;
    const source=this.ctx.createBufferSource();source.buffer=buffer;source.loop=true;
    this.airFilter=this.ctx.createBiquadFilter();this.airFilter.type='bandpass';
    this.airFilter.frequency.value=this.scene.air;this.airFilter.Q.value=.8;
    source.connect(this.airFilter);this.airFilter.connect(this.air);source.start();
  }

  /** Lay down the next quarter second of music, one swung eighth at a time. */
  schedule(){
    if(!this.ctx||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime;
    // A tab that was suspended must not flush a backlog of notes dated in the past.
    if(this.next<now-.2)this.next=now+.02;
    while(this.next<now+.3){
      const scene=this.scene,beat=scene.beat;
      const eighth=this.beatIndex%8,bar=Math.floor(this.beatIndex/8)%PROGRESSION.length;
      const {bass,chord}=PROGRESSION[bar];
      const at=this.next;

      if(eighth===0){
        this.pad(chord.map(n=>SEMITONE(n+scene.shift)),at,beat*3.4);
        this.bass(SEMITONE(bass+scene.shift-12),at,beat*.9);
      }
      if(eighth===4)this.bass(SEMITONE(bass+scene.shift-12+7),at,beat*.7);
      const tune=TUNE[bar][eighth];
      if(tune!==null&&tune!==undefined)
        this.marimba(SEMITONE(step(tune)+chord[0]+scene.shift),at,eighth%2?.62:1,scene.tone);
      if(eighth%2===1)this.brush(at,scene.brush);

      // Swing: the offbeat lands late, which is most of the feel.
      const swung=eighth%2===0?beat*scene.swing:beat*(1-scene.swing);
      this.next+=swung;this.beatIndex++;
    }
  }

  /** A struck bar: bright attack, quick decay, a touch of second harmonic for the wood. */
  marimba(frequency,at,level=1,type='triangle',bus=this.music){
    const gain=this.ctx.createGain();
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(.17*level,at+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,at+.55);
    gain.connect(bus);
    for(const [ratio,mix] of [[1,1],[2,.28],[3.01,.09]]){
      const osc=this.ctx.createOscillator(),voice=this.ctx.createGain();
      osc.type=ratio===1?type:'sine';osc.frequency.value=frequency*ratio;
      voice.gain.value=mix;osc.connect(voice);voice.connect(gain);
      osc.start(at);osc.stop(at+.6);
      osc.onended=()=>{osc.disconnect();voice.disconnect();};
    }
    setTimeout(()=>gain.disconnect(),700);
  }
  /** Round, short, and well under the melody. */
  bass(frequency,at,length){
    const gain=this.ctx.createGain(),osc=this.ctx.createOscillator();
    osc.type='triangle';osc.frequency.value=frequency;
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(.15,at+.02);
    gain.gain.exponentialRampToValueAtTime(.0001,at+length);
    osc.connect(gain);gain.connect(this.music);
    osc.start(at);osc.stop(at+length+.05);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  /** The chord, held quietly underneath so the harmony reads without crowding the tune. */
  pad(frequencies,at,length){
    const gain=this.ctx.createGain();
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(.028,at+.12);
    gain.gain.setValueAtTime(.028,at+length*.6);
    gain.gain.exponentialRampToValueAtTime(.0001,at+length);
    gain.connect(this.music);
    for(const frequency of frequencies){
      const osc=this.ctx.createOscillator();
      osc.type='sine';osc.frequency.value=frequency;
      osc.connect(gain);osc.start(at);osc.stop(at+length+.05);
      osc.onended=()=>osc.disconnect();
    }
    setTimeout(()=>gain.disconnect(),(length+.3)*1000);
  }
  /** A shaker on the offbeat. Filtered noise, very short, very quiet. */
  brush(at,level=.4){
    if(level<=0)return;
    const length=Math.floor(this.ctx.sampleRate*.05);
    const buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
    const source=this.ctx.createBufferSource();source.buffer=buffer;
    const filter=this.ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=4200;
    const gain=this.ctx.createGain();gain.gain.value=.05*level;
    source.connect(filter);filter.connect(gain);gain.connect(this.music);
    source.start(at);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }

  cue(kind){
    if(!this.ctx||this.ctx.state!=='running'||(this.settings.ambientVolume??.35)<=0)return false;
    const sequence=CUES[kind];if(!sequence)return false;
    const now=this.ctx.currentTime;if(now-this.lastCue<.18)return false;
    this.lastCue=now;
    for(const [i,n] of sequence.entries())
      this.marimba(SEMITONE(n+12),now+i*.07,.6,'sine',this.effects);
    return true;
  }
  async suspend(){try{await this.ctx?.suspend();}catch{}}
  stop(){
    clearInterval(this.timer);this.timer=null;this.ctx?.close().catch(()=>{});
    this.ctx=null;this.master=null;this.lastCue=-Infinity;
  }
}
