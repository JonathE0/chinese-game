import * as pc from 'playcanvas';
import {openAt} from '../core/calendar.js';
import {initIdle,animateIdle,restIdle} from './idle.js';
import {rotatedHalf} from './navigation.js';

/**
 * The night market.
 *
 * Two things had to be true at once: the stalls should not exist during the day, and you should
 * never watch one blink into being. So a pitch is only ever *created* while nobody can see it —
 * the spot is off the side of the camera, or you are indoors — and once it exists the vendor
 * arrives the honest way, pushing the cart down the street along a set of waypoints. Closing
 * time works the same in reverse: they wheel it back out, and the cart is only deleted once the
 * street is out of view again.
 *
 * The result is that walking into the square at dusk you see a cart being pushed into place,
 * and walking in at midday you see an empty corner, with nothing popping in between.
 */
const WALK=1.35;               // metres per second, pushing a loaded cart
const ARRIVE=.001;

export class NightMarket{
  constructor({models,parent,pitches,schedule={from:18,to:2},registry=null,player=null}){
    this.models=models;this.parent=parent;this.schedule=schedule;
    this.registry=registry;this.player=player;
    this.pitches=pitches.map(pitch=>({...pitch,state:'away',cart:null,vendor:null,leg:0,t:0}));
  }

  /** Every pitch that is standing at its spot and trading right now. */
  get open(){return this.pitches.filter(pitch=>pitch.state==='open');}
  isOpen(hour){return openAt(this.schedule,hour);}

  update(dt,{hour,place,offCamera}){
    const trading=this.isOpen(hour);
    const indoors=place!=='town';
    for(const pitch of this.pitches){
      // Creation and deletion are the only moments that must be unseen.
      const unseen=indoors||offCamera(pitch.spawn[0],pitch.spawn[1]);
      if(trading&&pitch.state==='away'&&unseen&&this.clearPose(pitch,...pitch.spawn,pitch.yaw??0))this.raise(pitch);
      else if(!trading&&(pitch.state==='open'||pitch.state==='arriving'))pitch.state='leaving';
      if(pitch.state==='arriving'||pitch.state==='leaving')this.push(pitch,dt);
      if(pitch.state==='gone'&&(indoors||offCamera(pitch.x,pitch.z)))this.strike(pitch);
      if(pitch.vendor&&pitch.state==='open')animateIdle(pitch.vendor,dt);
    }
  }

  /** Build the cart out of sight and start it walking in. */
  raise(pitch){
    const made=this.models.streetProp(this.parent,'foodcart',pitch.tint);
    pitch.cart=made.entity;pitch.material=made.material;
    pitch.vendor=initIdle(this.models.person(this.parent,pitch.color??'#c98a6d',[pitch.spawn[0],0,pitch.spawn[1]]));
    pitch.x=pitch.spawn[0];pitch.z=pitch.spawn[1];pitch.leg=0;pitch.state='arriving';
    this.settle(pitch);
    return pitch;
  }
  /** Remove it, once nobody is looking at the spot it stood on. */
  strike(pitch){
    pitch.cart?.destroy();pitch.vendor?.entity?.destroy();
    pitch.cart=pitch.vendor=pitch.material=null;pitch.state='away';
  }

  /** Walk the cart along its waypoints, in or out. */
  push(pitch,dt){
    const route=pitch.state==='arriving'?pitch.path:[...pitch.path].reverse();
    const target=route[Math.min(pitch.leg,route.length-1)];
    const dx=target[0]-pitch.x,dz=target[1]-pitch.z,distance=Math.hypot(dx,dz);
    if(distance<ARRIVE){
      if(pitch.leg<route.length-1){pitch.leg++;return;}
      pitch.state=pitch.state==='arriving'?'open':'gone';
      pitch.leg=0;
      if(pitch.state==='open'){pitch.x=pitch.spot[0];pitch.z=pitch.spot[1];pitch.heading=pitch.yaw??0;}
      restIdle(pitch.vendor);
      this.settle(pitch);
      return;
    }
    const step=Math.min(distance,WALK*dt);
    const nx=pitch.x+dx/distance*step,nz=pitch.z+dz/distance*step;
    // The cart is pushed along its local -x, with the vendor at the handle on +x.
    // Keep that orientation on the return trip, when the vendor pulls it out backwards.
    const heading=pitch.yaw??0;
    const steps=Math.max(1,Math.ceil(step/.1));
    for(let i=1;i<=steps;i++)if(!this.clearPose(pitch,pitch.x+(nx-pitch.x)*i/steps,pitch.z+(nz-pitch.z)*i/steps,heading)){restIdle(pitch.vendor);return;}
    pitch.x=nx;pitch.z=nz;pitch.heading=heading;
    pitch.walk=(pitch.walk??0)+dt*6;
    pitch.vendor.legs.forEach((leg,i)=>leg.setLocalEulerAngles(Math.sin(pitch.walk+i*Math.PI)*20,0,0));
    // Both hands out in front, on the handle.
    pitch.vendor.arms.forEach(arm=>arm.setLocalEulerAngles(-62,0,0));
    this.settle(pitch);
  }

  /** Put the cart and the person where the pitch says they are this frame. */
  settle(pitch){
    const heading=pitch.heading??pitch.yaw??0;
    pitch.cart.setLocalPosition(pitch.x,0,pitch.z);
    pitch.cart.setLocalEulerAngles(0,heading,0);
    const radians=heading*Math.PI/180;
    // The vendor stands at the handle end, which is the cart's own +x.
    const behind=pitch.state==='open'?1.55:1.5;
    pitch.vendor.entity.setLocalPosition(pitch.x+Math.cos(radians)*behind,0,pitch.z-Math.sin(radians)*behind);
    pitch.vendor.entity.setLocalEulerAngles(0,heading-90,0);
  }

  poseBoxes(pitch,x=pitch.x,z=pitch.z,heading=pitch.heading??pitch.yaw??0){
    const [hw,hd]=rotatedHalf([1.22,.7],heading),a=heading*Math.PI/180;
    return [{x,z,hw,hd,y0:0,y1:2.7},{x:x+Math.cos(a)*1.55,z:z-Math.sin(a)*1.55,hw:.52,hd:.48,y0:0,y1:1.95}];
  }
  clearPose(pitch,x,z,heading){
    if(!this.registry)return true;
    const own=[pitch.box,pitch.vendorBox];
    const obstacles=this.registry.boxes.filter(b=>b.place==='town'&&b.solid&&!own.includes(b));
    for(const other of this.pitches)if(other!==pitch&&other.cart)obstacles.push(...this.poseBoxes(other));
    const player=this.player?.();if(player)obstacles.push({...player,hw:.34,hd:.34,y0:player.y??0,y1:(player.y??0)+1.7});
    return !this.poseBoxes(pitch,x,z,heading).some(a=>obstacles.some(b=>
      a.y0<b.y1&&b.y0<a.y1&&Math.abs(a.x-b.x)<a.hw+b.hw+.04&&Math.abs(a.z-b.z)<a.hd+b.hd+.04));
  }

  /** Hitboxes are only meaningful while a cart is parked, so they are registered on the fly.
   *  Cheap enough to call every frame, which is what keeps it honest when two pitches change
   *  state in the same tick. */
  syncHitboxes(registry,resolveName,place='town'){
    for(const pitch of this.pitches){
      const wanted=!!pitch.cart;
      for(const [i,key] of ['box','vendorBox'].entries()){
        if(wanted){
          const shape=this.poseBoxes(pitch)[i];
          if(pitch[key])Object.assign(pitch[key],shape);
          else pitch[key]=registry.add({...shape,place,solid:true,name:resolveName(i?'person':pitch.name??'cart')});
        }else if(pitch[key]){
          const index=registry.boxes.indexOf(pitch[key]);if(index>=0)registry.boxes.splice(index,1);pitch[key]=null;
        }
      }
    }
  }
  /** Dim the fairy lights with the rest of the town — each string is handed over exactly once. */
  claimLamps(){
    const fresh=[];
    for(const pitch of this.pitches){
      if(!pitch.material||pitch.lit===pitch.material)continue;
      pitch.lit=pitch.material;fresh.push(pitch.material);
    }
    return fresh;
  }
}

export const NIGHT_PITCHES=[
  {id:'hawthorn',zh:'糖葫芦摊',shop:'nightstall',tint:'#b8765f',color:'#c98a6d',
   spawn:[-8.6,5.4],path:[[-8.6,5.4],[-5.6,5.4]],spot:[-5.6,5.4],yaw:180,name:'cart'},
  {id:'skewers',zh:'烤串摊',shop:'nightstall',tint:'#8f6a48',color:'#9aa8b5',
   spawn:[8.8,5.4],path:[[8.8,5.4],[5.8,5.4]],spot:[5.8,5.4],yaw:0,name:'cart'},
];
