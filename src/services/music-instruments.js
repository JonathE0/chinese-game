const frequency=n=>261.626*2**(n/12);
// Deliberately soft approximations of acoustic/electric instruments, not samples.
const VOICES={
  piano:{attack:.012,peak:.16,harmonics:[[1,1],[2,.22],[3,.07],[4,.025]]},
  pluck:{attack:.006,peak:.14,harmonics:[[1,1],[2,.38],[3,.13],[4,.04]]},
  mallet:{attack:.009,peak:.14,harmonics:[[1,1],[2,.12],[3.01,.08]]},
  air:{attack:.7,peak:.09,harmonics:[[1,1],[2,.06]]},
  keys:{attack:.035,peak:.14,harmonics:[[1,1],[2,.12],[3,.12]]},
  bass:{attack:.04,peak:.13,harmonics:[[1,1],[2,.08]]},
  pad:{attack:.6,peak:.045,harmonics:[[1,1],[2,.04]]},
};

/** All disposal follows audio time: wall timers would cut notes off in suspended tabs. */
export function playNote(ctx,bus,event,at){
  const {kind,length,level}=event;
  if(kind==='brush'){
    const buffer=ctx.createBuffer(1,Math.ceil(length*ctx.sampleRate),ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length)**2;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=buffer;filter.type='bandpass';filter.frequency.value=2800;filter.Q.value=.5;
    gain.gain.value=level*.06;
    source.connect(filter);filter.connect(gain);gain.connect(bus);source.start(at);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};return;
  }
  const voice=VOICES[kind],gain=ctx.createGain(),pan=ctx.createStereoPanner();
  const peak=voice.peak*level,attack=Math.min(voice.attack,length*.3);
  gain.gain.setValueAtTime(0,at);
  gain.gain.linearRampToValueAtTime(peak,at+attack);
  if(kind==='pad'||kind==='air')gain.gain.setValueAtTime(peak,at+length*.55);
  gain.gain.exponentialRampToValueAtTime(.00001,at+length);
  pan.pan.value=kind==='bass'?0:Math.sin(event.notes[0])*.25;
  gain.connect(pan);pan.connect(bus);
  let remaining=event.notes.length*voice.harmonics.length;
  for(const n of event.notes)for(const [ratio,mix] of voice.harmonics){
    const osc=ctx.createOscillator(),partial=ctx.createGain();
    osc.type='sine';osc.frequency.value=frequency(n)*ratio;
    partial.gain.value=mix;osc.connect(partial);partial.connect(gain);
    osc.start(at);osc.stop(at+length+.02);
    osc.onended=()=>{osc.disconnect();partial.disconnect();if(--remaining===0){gain.disconnect();pan.disconnect();}};
  }
}

export function songBus(ctx,destination,song){
  const input=ctx.createGain(),envelope=ctx.createGain(),delay=ctx.createDelay(1),echo=ctx.createGain();
  // A single quiet reflection adds space without an endless feedback tail.
  delay.delayTime.value=.31;echo.gain.value=.16;
  input.connect(envelope);input.connect(delay);delay.connect(echo);echo.connect(envelope);envelope.connect(destination);
  const {start,end,track}=song;
  envelope.gain.setValueAtTime(0,start);
  envelope.gain.linearRampToValueAtTime(track.level,start+3);
  envelope.gain.setValueAtTime(track.level,end-5);
  envelope.gain.linearRampToValueAtTime(0,end);
  return {input,envelope,disconnect(){input.disconnect();envelope.disconnect();delay.disconnect();echo.disconnect();}};
}
