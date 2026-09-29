/**
 * What can stand on what.
 *
 * A tea set can sit on a table, a desk lamp on a desk, a pot plant on either — or any of them
 * can simply go on the floor. What none of them can do is balance on the quilt of a made bed.
 * Rather than a special case per item, furniture declares whether it offers a usable top and how
 * high that top is, and small decor declares that it is allowed to use one.
 *
 * When a piece does land on another, the two are recorded as one assembly: the small thing
 * remembers the uid it is sitting on, so moving or putting away the base takes its decor too.
 */

/** Furniture that offers a flat top, and the height of that top. */
const TOPS={table:.47,desk:.81,nightstand:.65,dresser:1.17,shelf:1.74,chair:.5,'tea-table':.5};
/** Deliberately absent: bed, rug, wardrobe. A bed is not a shelf. */
export const surfaceHeight=kind=>TOPS[kind]??null;
export const offersSurface=kind=>surfaceHeight(kind)!==null;

/** Small decor that may stand on a surface as well as on the floor. */
const CAN_STACK=new Set(['desklamp','teaset','plant','lamp','vase','bonsai']);
export const canStack=kind=>CAN_STACK.has(kind);

/** Pieces that hang on a wall: they go in a wall slot, never on the floor, and have no footing. */
const WALL=new Set(['certificate','scroll-painting','landscape-painting']);
export const hangsOnWall=kind=>WALL.has(kind);

/** How much clear room a small piece needs on the top it is sitting on. */
const CLEARANCE=.1;

/** Is this base big enough to take that piece, and is that corner of it still free? */
export function fitsOn(base,item,siblings=[]){
  if(!base||!offersSurface(base.kind))return false;
  const [bw,bd]=base.footprint,turned=((base.rot??0)/90)%2!==0;
  const [iw,id]=item.footprint;
  if(iw>(turned?bd:bw)-CLEARANCE||id>(turned?bw:bd)-CLEARANCE)return false;
  return !siblings.some(other=>other.uid!==item.uid&&
    Math.abs(other.x-item.x)<(iw+other.footprint[0])/2*.9&&
    Math.abs(other.z-item.z)<(id+other.footprint[1])/2*.9);
}

/** Everything sitting on one base. */
export const decorOn=(records,uid)=>(records??[]).filter(record=>record.on===uid);
/** True once a base is carrying something, which is when it stops being one piece of furniture. */
export const isAssembly=(records,uid)=>decorOn(records,uid).length>0;

/**
 * Why a placement is refused, or null when it is fine. `base` is whatever the piece is currently
 * hovering over, and may be null for open floor.
 */
export function placementProblem(kind,base){
  if(!base)return null;                                   // open floor is always allowed
  if(!canStack(kind))return {zh:'这里已经有东西了',en:'Something is already here'};
  if(base.kind==='bed')return {zh:'不能放在床上',en:'Not on the bed'};
  if(!offersSurface(base.kind))return {zh:'这上面放不了',en:'That is not a surface you can use'};
  return null;
}
