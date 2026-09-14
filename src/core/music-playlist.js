/** Pitches are semitones relative to middle C. A null melody slot is a rest.
 * Three eight-bar sections: introduction, fuller answer, quiet reprise. */
export function compileScore(track){
  const beat=60/track.bpm,events=[];
  for(let bar=0;bar<24;bar++){
    const phrase=bar%8,section=Math.floor(bar/8),at=bar*4*beat;
    const chord=track.chords[phrase],ambient=track.instrument==='air';
    events.push({at,kind:'pad',notes:chord,length:beat*(ambient?5:3.8),level:ambient?.7:.38});
    if(!ambient)events.push({at,kind:'bass',notes:[chord[0]-12],length:beat*1.7,level:.5});
    for(let eighth=0;eighth<8;eighth++){
      const when=at+(Math.floor(eighth/2)+(eighth%2?track.swing:0))*beat;
      const note=track.melody[phrase][eighth];
      if(note!==null){
        events.push({at:when,kind:track.instrument,notes:[note],length:ambient?beat*3.5:track.instrument==='pluck'?1.35:2.5,
          level:(section===1?.85:.62)*(eighth%2?.8:1)});
      }
      // A middle-section counterline changes the arrangement without a wall of notes.
      if(section===1&&!ambient&&eighth%2===1)
        events.push({at:when,kind:track.instrument,notes:[chord[Math.floor(eighth/2)]],length:1.1,level:.24});
      if(track.brush&&section!==0&&(eighth===2||eighth===6))
        events.push({at:when,kind:'brush',notes:[],length:.07,level:track.brush});
    }
  }
  events.sort((a,b)=>a.at-b.at);
  return {events,duration:Math.max(24*4*beat,...events.map(e=>e.at+e.length))+3};
}

/** Only audio-context time advances this clock, so suspending a tab pauses its song. */
export class Playlist {
  constructor(tracks,random=Math.random){
    if(!tracks.length)throw new Error('A playlist needs at least one track');
    this.tracks=tracks;this.random=random;this.bag=[];this.last=null;
    this.current=null;this.readyAt=0;
  }
  take(){
    if(!this.bag.length){
      this.bag=[...this.tracks];
      for(let i=this.bag.length-1;i>0;i--){
        const j=Math.floor(this.random()*(i+1));
        [this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];
      }
      if(this.bag.length>1&&this.bag[0].id===this.last)
        [this.bag[0],this.bag[1]]=[this.bag[1],this.bag[0]];
    }
    const track=this.bag.shift();this.last=track.id;return track;
  }
  update(now){
    if(this.current&&now>=this.current.end){
      this.current=null;this.readyAt=now+8+this.random()*10;
    }
    if(!this.current&&now>=this.readyAt){
      const track=this.take(),score=compileScore(track);
      this.current={track,score,start:now,end:now+score.duration};
    }
    return this.current;
  }
  skip(now){this.current=null;this.readyAt=now+1.6;}
}
