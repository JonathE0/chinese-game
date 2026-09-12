// One shape list serves three jobs: what you bump into, what you can stand on, and what you
// can look at to learn its Chinese name. Everything in the world registers here.
//
// Most things are boxes. Round things — a fountain basin, a tree trunk, a bin, a café table —
// register a `radius` instead, so their hitbox follows the shape you can see rather than a
// square that sticks out past the stone.
const STEP=0.42;          // how high a ledge you can walk straight up
const PLAYER_HEIGHT=1.7;

export class Registry {
  constructor(){this.boxes=[];}
  clear(place){this.boxes=place?this.boxes.filter(b=>b.place!==place):[];}

  /** hw/hd are half extents on x/z (or pass `radius` for a round one); y0..y1 is the vertical span. */
  add({place='town',x,z,hw,hd,radius=null,y0=0,y1=1,name=null,solid=true,entity=null}){
    const box={place,x,z,hw:radius??hw,hd:radius??hd,radius,y0,y1,name,solid,entity};
    this.boxes.push(box);
    return box;
  }

  /** True when a body of this radius standing at (x,z) would be inside something solid. */
  blocks(place,x,z,feetY,radius=.34){
    for(const b of this.boxes){
      if(!b.solid||b.place!==place||!overlaps(b,x,z,radius))continue;
      if(b.y1<=feetY+1e-6)continue;
      if(b.y1<=feetY+STEP&&this.headroom(place,x,z,b.y1,radius))continue;
      if(b.y0>=feetY+PLAYER_HEIGHT)continue;     // high enough to walk under
      if(overlaps(b,x,z,radius))return true;
    }
    return false;
  }

  headroom(place,x,z,feetY,radius=.34){
    return !this.boxes.some(b=>b.solid&&b.place===place&&b.y1>feetY+1e-6&&
      b.y0<feetY+PLAYER_HEIGHT-1e-6&&overlaps(b,x,z,radius));
  }

  /** Highest surface the player can be standing on at this spot. */
  groundAt(place,x,z,feetY,radius=.34){
    let ground=0;
    for(const b of this.boxes){
      if(!b.solid||b.place!==place)continue;
      if(b.y1>feetY+STEP||b.y1<=ground)continue;
      if(overlaps(b,x,z,radius))ground=b.y1;
    }
    return ground;
  }

  /** Sweep the whole body vertically; thin shelves and lintels cannot be skipped by a frame. */
  moveVertical(place,x,z,from,to,radius=.34){
    let y=to,ceiling=false,grounded=false;
    if(to>from){
      for(const b of this.boxes){
        if(!b.solid||b.place!==place||!overlaps(b,x,z,radius))continue;
        const limit=b.y0-PLAYER_HEIGHT;
        if(limit>=from-1e-6&&limit<y){y=limit;ceiling=true;}
      }
    }else{
      let floor=0;
      for(const b of this.boxes){
        if(!b.solid||b.place!==place||!overlaps(b,x,z,radius))continue;
        if(b.y1<=from+STEP&&b.y1>floor&&this.headroom(place,x,z,b.y1,radius))floor=b.y1;
      }
      if(y<=floor){y=floor;grounded=true;}
    }
    return {y,ceiling,grounded};
  }

  /** Nearest named shape along a ray — what the crosshair is pointing at. */
  look(place,origin,dir,maxDistance=11){
    let best=null,bestT=maxDistance;
    for(const b of this.boxes){
      if(!b.name||b.place!==place)continue;
      const t=b.radius?hitCylinder(origin,dir,b,bestT):hitBox(origin,dir,b,bestT);
      if(t!==null&&t<bestT){bestT=t;best=b;}
    }
    return best?{box:best,distance:bestT}:null;
  }
}

function overlaps(b,x,z,radius){
  if(b.radius!==null&&b.radius!==undefined){
    const dx=x-b.x,dz=z-b.z,reach=b.radius+radius;
    return dx*dx+dz*dz<reach*reach;
  }
  return Math.abs(x-b.x)<b.hw+radius&&Math.abs(z-b.z)<b.hd+radius;
}

/** Slab test: the ray's entry distance into the box, or null if it misses. */
function hitBox(origin,dir,b,limit){
  let near=0,far=limit;
  const spans=[[origin.x,dir.x,b.x-b.hw,b.x+b.hw],[origin.y,dir.y,b.y0,b.y1],[origin.z,dir.z,b.z-b.hd,b.z+b.hd]];
  for(const [o,d,lo,hi] of spans){
    if(Math.abs(d)<1e-6){if(o<lo||o>hi)return null;continue;}
    let t1=(lo-o)/d,t2=(hi-o)/d;
    if(t1>t2){const swap=t1;t1=t2;t2=swap;}
    if(t1>near)near=t1;
    if(t2<far)far=t2;
    if(near>far)return null;
  }
  return near;
}

/** The same, for an upright cylinder: a circle in xz clipped by the y span. */
function hitCylinder(origin,dir,b,limit){
  let near=0,far=limit;
  if(Math.abs(dir.y)<1e-6){if(origin.y<b.y0||origin.y>b.y1)return null;}
  else{
    let t1=(b.y0-origin.y)/dir.y,t2=(b.y1-origin.y)/dir.y;
    if(t1>t2){const swap=t1;t1=t2;t2=swap;}
    if(t1>near)near=t1;
    if(t2<far)far=t2;
    if(near>far)return null;
  }
  const ox=origin.x-b.x,oz=origin.z-b.z;
  const a=dir.x*dir.x+dir.z*dir.z,half=ox*dir.x+oz*dir.z,c=ox*ox+oz*oz-b.radius*b.radius;
  if(a<1e-9)return c<=0?near:null;              // straight up or down through the circle
  const disc=half*half-a*c;
  if(disc<0)return null;
  const root=Math.sqrt(disc);
  let t1=(-half-root)/a,t2=(-half+root)/a;
  if(t1>near)near=t1;
  if(t2<far)far=t2;
  return near>far?null:near;
}
