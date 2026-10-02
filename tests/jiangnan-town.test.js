import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gableSlab,VARIANTS} from '../src/world/jiangnan-town.js';

// Qinghe in Jiangnan style (task W5-town, src/world/jiangnan-town.js).
const world=JSON.parse(readFileSync(new URL('../src/content/world.json',import.meta.url),'utf8'));

test('a plain gable wall faces outwards, keeps its thickness and span, and follows the roof', () => {
  const top=z=>5+1.2*(1-Math.min(1,Math.abs(z)/3)),g=gableSlab(top,-3.1,3.6,4,.3,12);
  for(let k=0;k<g.i.length;k+=3){
    const [a,b,c]=[0,1,2].map(j=>g.p.slice(g.i[k+j]*3,g.i[k+j]*3+3)),n=g.n.slice(g.i[k]*3,g.i[k]*3+3);
    const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]),cr=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(Math.hypot(...cr)<1e-9||cr[0]*n[0]+cr[1]*n[1]+cr[2]*n[2]>0,'every triangle faces the way its normal does');
  }
  const xs=g.p.filter((_,i)=>i%3===0),ys=g.p.filter((_,i)=>i%3===1),zs=g.p.filter((_,i)=>i%3===2);
  assert.deepEqual([Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs),Math.min(...ys)],[-.15,.15,-3.1,3.6,4]);
  assert.ok(Math.abs(Math.max(...ys)-6.2)<1e-9,'it peaks under the ridge');
  for(let k=0;k<g.p.length;k+=3)assert.ok(g.p[k+1]<=top(g.p[k+2])+1e-9,'never above the roof line');
});

test('every Qinghe shop and house is built in Jiangnan style, from a known variant', () => {
  // Landmarks keep their own build: the word hall and the metro entrance (bespoke), the stone bank.
  for(const b of world.buildings.filter(b=>!b.bespoke&&b.style!=='bank')){
    assert.equal(b.style,'jiangnan',b.id);
    if(b.id==='homeware')continue;   // P0's showcase (src/world/jiangnan.js jiangnanFront)
    const j=b.jiangnan;
    assert.ok(j,`${b.id} has a jiangnan variant`);
    for(const [key,value] of Object.entries(j))
      assert.ok(VARIANTS[key]?.(value),`${b.id}: jiangnan.${key} = ${JSON.stringify(value)}`);
    assert.ok(!(b.details??[]).includes('lanterns'),`${b.id} hangs its own lanterns`);
  }
});
