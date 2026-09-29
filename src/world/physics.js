import * as pc from 'playcanvas';

/**
 * The handful of things you can actually pick up and throw.
 *
 * This is a toybox, not a physics engine: a small number of round objects that fall, bounce,
 * roll and come to rest against the same boxes everything else in the town collides with. The
 * limits are the point. At most a dozen are ever live, each one clears itself away after a
 * while, and nothing here is inventory — an apple you lift out of a basket is a toy, not food
 * you can eat or sell, so a fruit rack can never become a money printer.
 */
const GRAVITY=17;
const MAX_BODIES=12;
const REST_SPEED=.35;          // below this, on the ground, it has stopped
const REST_TIME=1.1;           // and after this long at rest it starts its despawn clock
const DESPAWN=42;              // seconds a settled object stays before it is tidied away
const HOLD_REACH=.85;

export class Toybox{
  constructor({registry,models}){
    this.registry=registry;this.models=models;this.bodies=[];this.held=null;
  }

  get count(){return this.bodies.length;}
  /** Everything currently loose in one place — used by the tidy-up when you leave. */
  in(place){return this.bodies.filter(body=>body.place===place);}

  spawn({parent,place,shape='sphere',size=[.3,.3,.3],color='#d8735f',x,y,z,name=null,source=null,bounce=.42}){
    if(this.bodies.length>=MAX_BODIES)this.remove(this.bodies[0]);
    const entity=this.models.shape(parent,shape,[x,y,z],size,color);
    const body={entity,place,x,y,z,vx:0,vy:0,vz:0,spin:Math.random()*6.28,spinRate:0,
      radius:Math.max(size[0],size[2])/2,bounce,name,source,rest:0,age:0,held:false};
    this.bodies.push(body);
    return body;
  }

  remove(body){
    const index=this.bodies.indexOf(body);
    if(index<0)return false;
    if(this.held===body)this.held=null;
    body.entity.destroy();
    this.bodies.splice(index,1);
    body.source?.onGone?.(body);
    return true;
  }
  /** Clear a place wholesale — leaving a room tidies whatever was rolling around in it. */
  clear(place){for(const body of this.in(place))this.remove(body);}

  /** Nearest loose object within reach of a point, so E can pick something back up. */
  nearest(place,x,z,y,reach=1.6){
    let best=null,bestDistance=reach;
    for(const body of this.bodies){
      if(body.place!==place||body.held)continue;
      const distance=Math.hypot(body.x-x,body.z-z);
      if(distance<bestDistance&&Math.abs(body.y-y)<2){best=body;bestDistance=distance;}
    }
    return best;
  }

  take(body){
    if(!body)return null;
    if(this.held)this.drop();
    body.held=true;body.vx=body.vy=body.vz=0;body.rest=0;body.age=0;
    this.held=body;
    return body;
  }
  /** Let go where you stand: it falls from the hand rather than being thrown. */
  drop(){
    const body=this.held;
    if(!body)return null;
    body.held=false;this.held=null;body.vy=-.5;
    return body;
  }
  /** Throw along a direction with a little lift, so a flat aim still arcs. */
  hurl({fx,fy,fz},power=8.5){
    const body=this.held;
    if(!body)return null;
    body.held=false;this.held=null;
    body.vx=fx*power;body.vz=fz*power;body.vy=fy*power+2.2;
    body.spinRate=power*.9;
    return body;
  }

  /** Keep whatever is in hand floating just in front of the eyes. */
  carry(eye,{fx,fy,fz}){
    const body=this.held;
    if(!body)return;
    body.x=eye.x+fx*HOLD_REACH;
    body.y=eye.y+fy*HOLD_REACH-.16;
    body.z=eye.z+fz*HOLD_REACH;
    body.entity.setLocalPosition(body.x,body.y,body.z);
    body.spin+=.9*(1/60);
    body.entity.setLocalEulerAngles(0,body.spin*24,0);
  }

  update(dt,place){
    for(const body of [...this.bodies]){
      if(body.held||body.place!==place)continue;
      this.step(body,dt);
      if(body.rest>REST_TIME&&(body.age+=dt)>DESPAWN)this.remove(body);
    }
  }

  step(body,dt){
    body.vy-=GRAVITY*dt;
    // Over a pond, the canal, the fountain or the bay (`surfaceAt`, from the town) it floats at the
    // surface rather than resting on the water's taller collision box.
    const surface=this.surfaceAt?.(body.place,body.x,body.z)??null;
    const ground=surface!==null?surface+body.radius*.3:this.registry.groundAt(body.place,body.x,body.z,body.y,body.radius)+body.radius;

    // Move one axis at a time so a wall reflects the object instead of swallowing it.
    const nextX=body.x+body.vx*dt;
    if(this.free(body,nextX,body.z))body.x=nextX;
    else{body.vx*=-body.bounce;body.spinRate*=-.6;}
    const nextZ=body.z+body.vz*dt;
    if(this.free(body,body.x,nextZ))body.z=nextZ;
    else{body.vz*=-body.bounce;body.spinRate*=-.6;}

    body.y+=body.vy*dt;
    if(body.y<=ground){
      if(surface!==null&&!body.afloat)this.onSplash?.(body);     // it lands in the water
      body.afloat=surface!==null;
      body.y=ground;
      if(!body.afloat&&Math.abs(body.vy)>1.2)body.vy=-body.vy*body.bounce;      // a real bounce; water takes it
      else{body.vy=0;}
      // Rolling friction only applies once it is actually touching down.
      const drag=Math.max(0,1-2.6*dt);
      body.vx*=drag;body.vz*=drag;
      body.spinRate=Math.hypot(body.vx,body.vz)*2.4;
    } else body.afloat=false;

    const speed=Math.hypot(body.vx,body.vy,body.vz);
    body.rest=speed<REST_SPEED&&body.y<=ground+.02?body.rest+dt:0;
    if(body.rest>REST_TIME){body.vx=body.vz=0;body.spinRate*=.9;}

    body.spin+=body.spinRate*dt;
    body.entity.setLocalPosition(body.x,body.y,body.z);
    body.entity.setLocalEulerAngles(body.spin*40,body.spin*17,0);
  }

  free(body,x,z){
    if(this.registry.blocks(body.place,x,z,body.y-body.radius,body.radius*.85))return false;
    return !this.outOfBounds?.(body.place,x,z);
  }
}

/** A basket, rack or case that gives an object up and quietly restocks the gap it left. */
export class Container{
  constructor({place,slots,x=0,z=0,zh='东西',refill=26}){
    this.place=place;this.slots=slots;this.x=x;this.z=z;this.zh=zh;this.refill=refill;
  }
  /** The first slot still holding something. */
  ready(){return this.slots.find(slot=>slot.filled);}
  take(slot,now){
    if(!slot?.filled)return null;
    slot.filled=false;slot.back=now+this.refill;
    slot.entity.enabled=false;
    return slot;
  }
  /** Put back anything whose timer has run out. Safe to call every frame. */
  tick(now){
    for(const slot of this.slots){
      if(slot.filled||slot.back>now)continue;
      slot.filled=true;slot.entity.enabled=true;
    }
  }
  reset(){for(const slot of this.slots){slot.filled=true;slot.back=0;slot.entity.enabled=true;}}
}

export const worldPoint=entity=>{const p=entity.getPosition();return new pc.Vec3(p.x,p.y,p.z);};
