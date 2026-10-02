import test from 'node:test';
import assert from 'node:assert/strict';
import {bevelBox,lathe,roofShape,roofAt,woodish} from '../src/world/jiangnan.js';

// The Jiangnan geometry helpers (task W5-look, src/world/jiangnan.js): every triangle faces the way
// its normals say (so nothing is culled inside out), and the shapes keep the sizes they are given.
const tri=(g,k)=>[0,1,2].map(j=>g.p.slice(g.i[k+j]*3,g.i[k+j]*3+3));
const facing=g=>{
  for(let k=0;k<g.i.length;k+=3){
    const [a,b,c]=tri(g,k),u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],m=g.n.slice(g.i[k]*3,g.i[k]*3+3);
    if(Math.hypot(...n)>1e-9&&n[0]*m[0]+n[1]*m[1]+n[2]*m[2]<=0)return false;
  }
  return true;
};
const bounds=g=>[0,1,2].map(a=>{const v=g.p.filter((_,i)=>i%3===a);return [Math.min(...v),Math.max(...v)];});

test('a bevelled box keeps its size, chamfers every edge and faces outwards', () => {
  const g=bevelBox(.5,.25,1,.05);
  assert.deepEqual(bounds(g).map(([lo,hi])=>[+lo.toFixed(6),+hi.toFixed(6)]),[[-.5,.5],[-.25,.25],[-1,1]]);
  assert.equal(g.p.length/3,6*4+12*4+8*3);
  assert.equal(bevelBox(.5,.5,.5,0).p.length/3,24,'no bevel, a plain box');
  assert.ok(facing(g)&&facing(bevelBox(1,1,1,0)));
  for(let i=0;i<g.n.length;i+=3)assert.ok(Math.abs(Math.hypot(g.n[i],g.n[i+1],g.n[i+2])-1)<1e-9);
  assert.ok(bevelBox(.01,1,1,.5).p.every(Number.isFinite),'a bevel wider than the box is clamped');
});

test('a turned shape faces outwards on its sides and its caps', () => {
  const g=lathe([[0,0],[.3,0],[.3,0],[.3,1],[.3,1],[0,1]],12);
  assert.ok(facing(g));
  const [x,y,z]=bounds(g);
  assert.ok(Math.abs(x[1]-.3)<1e-9&&Math.abs(z[0]+.3)<1e-9&&y[0]===0&&y[1]===1);
});

test('a roof sags from ridge to eave, and its eave turns up towards the ends', () => {
  const R={w:6,reach:3.6,top:6,eave:4.2,lift:.2,flare:.1};
  const {tiles,under}=roofShape(R);
  assert.ok(facing(tiles)&&facing(under));
  for(let i=1;i<tiles.n.length;i+=3)assert.ok(tiles.n[i]>0,'the tiles face the sky');
  assert.equal(roofAt(R,0).y,6);assert.equal(roofAt(R,1).y,4.2);
  // Concave: halfway down the slope it is already well below the straight line from ridge to eave.
  assert.ok(roofAt(R,.5).y<(6+4.2)/2-.2);
  const eaveAt=x=>Math.max(...tiles.p.filter((_,i)=>i%3===1).filter((_,k)=>Math.abs(tiles.p[k*3]-x)<1e-6&&Math.abs(Math.abs(tiles.p[k*3+2])-R.reach)<.2));
  assert.ok(eaveAt(3)>eaveAt(0)+.15,'the corners lift');
});

test('timber browns are told from plaster, cloth and paint', () => {
  for(const hex of ['#8e6952','#a97d55','#c2a077','#6f5236','#7d6349'])assert.equal(woodish(hex),true,hex);
  for(const hex of ['#f4ecdc','#efe3c4','#8fa094','#cfe0dd','#3c4045','#ffffff'])assert.equal(woodish(hex),false,hex);
});
