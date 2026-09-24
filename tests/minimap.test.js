import test from 'node:test';
import assert from 'node:assert/strict';
import {Shell} from '../src/ui/shell.js';
import world from '../src/content/world.json' with {type:'json'};

// drawMap only touches two elements; a stand-in document is enough to read what it drew.
function draw(buildings){
 const els={'#map-svg':{setAttribute(){}},'#map-content':{innerHTML:''}};
 globalThis.document={querySelector:sel=>els[sel]};
 const district={id:'square',bounds:{x:[-22,21],z:[-31,19]}};
 Shell.prototype.drawMap.call({},{buildings,trees:[],npcs:[],districts:[district]},district);
 return els['#map-content'].innerHTML;
}
const box={x:0,z:-22,width:18,depth:11,roof:'#d4a441',district:'square'};

test('a building with a map label is named on the minimap, one without is not',()=>{
 assert.match(draw([{...box,id:'hall',label:'词语馆'}]),/<text[^>]*>词语馆<\/text>/);
 assert.doesNotMatch(draw([{...box,id:'shop'}]),/<text/);
});
test('the word hall carries its name as a map label',()=>{
 assert.equal(world.buildings.find(b=>b.id==='practice-house').label,'词语馆');
});
