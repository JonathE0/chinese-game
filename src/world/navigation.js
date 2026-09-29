/** Sweep a walking body between frames against static and moving obstacles, on the floor at `feetY`. */
export function walkClear(registry,place,from,to,others=[],radius=.52,feetY=0){
 const distance=Math.hypot(to.x-from.x,to.z-from.z),steps=Math.max(1,Math.ceil(distance/.15));
 for(let i=1;i<=steps;i++){
  const x=from.x+(to.x-from.x)*i/steps,z=from.z+(to.z-from.z)*i/steps;
  if(registry.blocks(place,x,z,feetY,radius))return false;
  if(others.some(p=>Math.hypot(x-p.x,z-p.z)<radius+(p.radius??.52)))return false;
 }
 return true;
}
export function rotatedHalf([hw,hd],degrees=0){
 const a=degrees*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
 return [hw*c+hd*s,hw*s+hd*c];
}
