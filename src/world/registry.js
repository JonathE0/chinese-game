// One shape list serves three jobs: what you bump into, what you can stand on, and what you
// can look at to learn its Chinese name. Everything in the world registers here.
//
// Most things are boxes. Round things — a fountain basin, a tree trunk, a bin, a café table —
// register a `radius` instead, so their hitbox follows the shape you can see rather than a
// square that sticks out past the stone.
const STEP=0.42;          // how high a ledge you can walk straight up
const PLAYER_HEIGHT=1.7;

export class Registry {
  // `looks` are name-only boxes built from tagged meshes: read by `look`, never walked into.
  constructor(){this.boxes=[];this.looks=[];}
  clear(place){this.boxes=place?this.boxes.filter(b=>b.place!==place):[];}
  /** `refine(origin,dir,limit)` may narrow a hit on the box to the shape inside it: [near,far] or null. */
  addLook({place='town',x,z,hw,hd,y0,y1,name,owner=null,entity=null,refine=null}){
    const box={place,x,z,hw,hd,radius:null,y0,y1,name,solid:false,owner,entity,refine};
    this.looks.push(box);
    return box;
  }
  /** Drop a place's look boxes, or only those one owner (a furniture uid, a moving thing) made. */
  clearLooks(place,owner){this.looks=this.looks.filter(b=>b.place!==place||(owner!==undefined&&b.owner!==owner));}

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

  // Something low enough to step onto from there is not in the way: on a flight of shallow steps
  // the body overlaps the next step up as well as the one it is stepping onto.
  headroom(place,x,z,feetY,radius=.34){
    return !this.boxes.some(b=>b.solid&&b.place===place&&b.y1>feetY+STEP&&
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

  /**
   * The named shape the crosshair is pointing at. A shape around the eye is ignored (you are
   * standing under the canopy, not looking at it). Otherwise the nearest entry wins, unless a
   * smaller shape is entered before the ray leaves the winner: the sink inside the kitchen
   * fitting, the cup on the table.
   */
  look(place,origin,dir,maxDistance=11){
    const hits=[],length=Math.hypot(dir.x,dir.y,dir.z);
    for(const list of [this.boxes,this.looks])for(const b of list){
      if(!b.name||b.place!==place||(b.entity&&!b.entity.enabled)||contains(b,origin))continue;
      const limit=b.reach??maxDistance;   // `reach`: something far off and big, like the drone show over the bay
      // Most of a place is further off than the ray reaches: a cheap test first, the same answer.
      if(further(b,origin,limit*length))continue;
      let span=b.radius?hitCylinder(origin,dir,b,limit):hitBox(origin,dir,b,limit);
      if(span&&b.refine)span=b.refine(origin,dir,limit);
      if(span)hits.push({box:b,near:span[0],far:span[1],size:volume(b)});
    }
    hits.sort((a,b)=>a.near-b.near);
    let best=hits[0];
    for(const hit of hits)if(hit.near<best.far&&hit.size<best.size)best=hit;
    // Seen past arm's length only through its `reach`: anything solid nearer along the ray, at
    // any distance, stands in the way (a tower between you and the drones over the bay).
    if(best&&best.near>maxDistance)for(const b of this.boxes){
      if(!b.solid||!b.name||b.place!==place||(b.entity&&!b.entity.enabled)||contains(b,origin))continue;
      if(b.radius?hitCylinder(origin,dir,b,best.near):hitBox(origin,dir,b,best.near))return null;
    }
    return best?{box:best.box,distance:best.near}:null;
  }
}

function contains(b,p){
  if(p.y<b.y0||p.y>b.y1)return false;
  if(b.radius)return (p.x-b.x)**2+(p.z-b.z)**2<=b.radius*b.radius;
  return Math.abs(p.x-b.x)<=b.hw&&Math.abs(p.z-b.z)<=b.hd;
}
function volume(b){return (b.radius?Math.PI*b.radius*b.radius:4*b.hw*b.hd)*(b.y1-b.y0);}
/** Whether all of a shape's box (a round one's square) lies further than `reach` from p. */
function further(b,p,reach){
  const dx=Math.max(Math.abs(p.x-b.x)-b.hw,0),dz=Math.max(Math.abs(p.z-b.z)-b.hd,0),dy=Math.max(b.y0-p.y,p.y-b.y1,0);
  return dx*dx+dy*dy+dz*dz>reach*reach;
}

function overlaps(b,x,z,radius){
  if(b.radius!==null&&b.radius!==undefined){
    const dx=x-b.x,dz=z-b.z,reach=b.radius+radius;
    return dx*dx+dz*dz<reach*reach;
  }
  return Math.abs(x-b.x)<b.hw+radius&&Math.abs(z-b.z)<b.hd+radius;
}

/** Slab test: the ray's [entry, exit] distances through the box, or null if it misses. */
function hitBox(origin,dir,b,limit){
  return raySpan(origin,dir,{x:b.x-b.hw,y:b.y0,z:b.z-b.hd},{x:b.x+b.hw,y:b.y1,z:b.z+b.hd},limit);
}
/** The same slab test between two corners, for any box in any frame. */
export function raySpan(origin,dir,min,max,limit){
  let near=0,far=limit;
  const spans=[[origin.x,dir.x,min.x,max.x],[origin.y,dir.y,min.y,max.y],[origin.z,dir.z,min.z,max.z]];
  for(const [o,d,lo,hi] of spans){
    if(Math.abs(d)<1e-6){if(o<lo||o>hi)return null;continue;}
    let t1=(lo-o)/d,t2=(hi-o)/d;
    if(t1>t2){const swap=t1;t1=t2;t2=swap;}
    if(t1>near)near=t1;
    if(t2<far)far=t2;
    if(near>far)return null;
  }
  return [near,far];
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
  if(a<1e-9)return c<=0?[near,far]:null;       // straight up or down through the circle
  const disc=half*half-a*c;
  if(disc<0)return null;
  const root=Math.sqrt(disc);
  let t1=(-half-root)/a,t2=(-half+root)/a;
  if(t1>near)near=t1;
  if(t2<far)far=t2;
  return near>far?null:[near,far];
}
