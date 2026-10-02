import test from 'node:test';
import assert from 'node:assert/strict';
import {blob,tube,ribbon,blade,join,hillRadius,PINE_TIERS,seeded} from '../src/world/jiangnan-nature.js';

// The plant and stone geometry of the Jiangnan look (task W5-nature, src/world/jiangnan-nature.js).

/** Every triangle faces the way its corners' normals say: drawn from outside, culled from inside. */
function facesOut(g){
  for(let t=0;t<g.i.length;t+=3){
    const [a,b,c]=[0,1,2].map(k=>g.i[t+k]),P=k=>[g.p[k*3],g.p[k*3+1],g.p[k*3+2]];
    const u=P(b).map((v,k)=>v-P(a)[k]),w=P(c).map((v,k)=>v-P(a)[k]);
    const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    if(Math.hypot(...n)<1e-9)continue;   // a pole's collapsed triangle
    const avg=[0,1,2].map(k=>(g.n[a*3+k]+g.n[b*3+k]+g.n[c*3+k])/3);
    if(n[0]*avg[0]+n[1]*avg[1]+n[2]*avg[2]<=0)return false;
  }
  return true;
}

test('a leaf clump is a closed lumpy ellipsoid, darker underneath than on top, the same every time',()=>{
  const g=blob([1,.6,.8],42);
  assert.ok(facesOut(g));
  assert.equal(g.shade.length,g.p.length/3);
  const ys=g.p.filter((_,i)=>i%3===1),top=Math.max(...ys),bottom=Math.min(...ys);
  assert.ok(top>.5&&top<.75,`top ${top}`);
  assert.ok(-bottom<top,'the underside is flattened');
  const shadeAt=y=>g.shade[ys.indexOf(y)];
  assert.ok(shadeAt(bottom)<shadeAt(top));
  assert.deepEqual(blob([1,.6,.8],42).p,g.p);
});

test('limbs, strands and blades face outwards; strands and blades are seen from both sides',()=>{
  assert.ok(facesOut(tube([0,0,0],[.3,2,.1],.2,.1)));
  assert.ok(facesOut(tube([0,1,0],[1,1,0],.1,.05)),'a level limb too');
  const strand=ribbon([[0,3,0],[.1,2,0],[.2,1,0]],[.2,.15,.1],[0,0,1]);
  assert.ok(facesOut(strand));
  assert.equal(strand.i.length,2*2*2*3,'two segments, two triangles each, both faces');
  const leaf=blade([0,0,0],[1,0,0],[0,0,1],.3,.06);
  assert.ok(facesOut(leaf));
  const both=join([strand,leaf]);
  assert.equal(both.p.length,strand.p.length+leaf.p.length);
  assert.ok(facesOut(both));
});

test('a pine reads as a conifer: at least three tiers of pads, climbing and narrowing',()=>{
  assert.ok(PINE_TIERS.length>=3);
  for(let k=1;k<PINE_TIERS.length;k++){
    assert.ok(PINE_TIERS[k].y>PINE_TIERS[k-1].y);
    assert.ok(PINE_TIERS[k].reach+PINE_TIERS[k].pad[0]<=PINE_TIERS[k-1].reach+PINE_TIERS[k-1].pad[0]);
  }
  // Within the old pine's footprint, so it stands clear of whatever stood clear of that.
  for(const t of PINE_TIERS)assert.ok(t.reach+t.pad[0]<=1.35);
});

test('a hill keeps the old cone\'s footprint at the town\'s ground, with a rounder crown',()=>{
  // The cones stood half a height below the ground: at the ground, a fraction a little over half up.
  for(const h of [10,14]){const t=(h/2+.5)/h;assert.ok(Math.abs(hillRadius(t)-(1-t))<.03,`height ${h}`);}
  assert.ok(hillRadius(.85)>1-.85,'fuller near the top than a cone');
  assert.equal(hillRadius(1),0);
});

test('the seeded random repeats',()=>{
  const a=seeded(3.7),b=seeded(3.7);
  for(let k=0;k<5;k++)assert.equal(a(),b());
});
