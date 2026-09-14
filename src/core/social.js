import vocabulary from '../content/vocabulary.json' with {type:'json'};

/** A conversation is a pair, followed by 45–90 seconds of silence. */
export class AmbientConversations {
 constructor(lines,random=Math.random){
  this.groups=[...new Set(lines.map(l=>l.exchange))].map(id=>lines.filter(l=>l.exchange===id));
  this.random=random;this.bag=[];this.last=null;this.pair=null;this.index=0;this.next=null;this.eligible=false;
 }
 update(now,eligible){
  if(this.next===null)this.next=now+20;
  if(!eligible){
   if(this.eligible){this.pair=null;this.next=now+45+this.random()*45;}
   this.eligible=false;return null;
  }
  this.eligible=true;if(now<this.next)return null;
  if(!this.pair){
   if(!this.bag.length){
    this.bag=[...this.groups];
    for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
    if(this.bag.length>1&&this.bag[0]===this.last)[this.bag[0],this.bag[1]]=[this.bag[1],this.bag[0]];
   }
   this.pair=this.bag.shift();this.last=this.pair;this.index=0;
  }
  const line=this.pair[this.index++];
  if(this.index===this.pair.length){this.pair=null;this.next=now+45+this.random()*45;}
  else this.next=now+8+this.random()*3;
  return line;
 }
}

/** Optional stretch practice uses topics the player has already answered successfully. */
export function chooseSmalltalk(profile,topics,state,now,random=Math.random){
 if(now<(state.next??0)||random()>=.3)return null;
 const known=new Set([...vocabulary,...(profile.saved??[])].filter(w=>Object.values(profile.words?.[w.id]??{}).some(r=>r.stage>=1)).map(w=>w.zh));
 let eligible=topics.filter(t=>t.requires.every(w=>known.has(w)));
 if(eligible.length>1)eligible=eligible.filter(t=>t.id!==state.last);
 if(!eligible.length)return null;
 const topic=eligible[Math.floor(random()*eligible.length)];state.last=topic.id;state.next=now+180;return topic;
}
