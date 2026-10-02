import test from 'node:test';
import assert from 'node:assert/strict';
import city from '../src/content/city.json' with {type:'json'};

test('云海 ground: downtown, the promenade, the hill side and the districts round the station are walkable; the bay and past the edges are not',async()=>{
  const {onCityGround}=await import('../src/core/city.js');
  const walk=city.place.walk,edge=.42;
  // The boulevard, the plaza on the promenade, both ends of the promenade, the ground up to the hill,
  // 站前广场, 美食街, 中心广场, the way from it to the promenade, 城市公园 and the business district.
  for(const [x,z] of [[0,0],[0,24.5],[0,-41],[-38,-41],[68,-40],[-34,8],[-60,-40],[0,31],[-60,47],[40,5],[64,-25],[10,75],[60,60]])
    assert.equal(onCityGround(walk,x,z,edge),true,`(${x},${z}) should be walkable`);
  // Past the railing into the bay, in front of 海风大厦, past the east, south and west edges, behind the mall.
  for(const [x,z] of [[0,-48.5],[45,-31],[71,-40],[75,0],[0,113],[-100,45],[-50,85],[-121,0]])
    assert.equal(onCityGround(walk,x,z,edge),false,`(${x},${z}) should be off the ground`);
  // Where two stretches of ground meet there is no seam: the boulevard runs on into the promenade's
  // plaza, the promenade's west end to the foot of the hill, 站前广场 round the station into the park,
  // 美食街 into 站前广场's side, and downtown's back lane into 中心广场.
  for(let z=-30;z>=-47;z-=.1)assert.equal(onCityGround(walk,0,z,edge),true,`seam at z ${z.toFixed(1)}`);
  for(let x=-30;x>=-45;x-=.1)assert.equal(onCityGround(walk,x,-41,edge),true,`seam at x ${x.toFixed(1)}`);
  for(let z=20;z<=110;z+=.1)assert.equal(onCityGround(walk,-36,z,edge),true,`seam west of the station at z ${z.toFixed(1)}`);
  for(let x=-90;x<=60;x+=.1)assert.equal(onCityGround(walk,x,44,edge),true,`seam across the station's front at x ${x.toFixed(1)}`);
  for(let x=10;x<=66;x+=.1)assert.equal(onCityGround(walk,x,30,edge),true,`seam into 中心广场 at x ${x.toFixed(1)}`);
  for(let z=-10;z>=-40;z-=.1)assert.equal(onCityGround(walk,65,z,edge),true,`seam to the promenade at z ${z.toFixed(1)}`);
});

test('the station\'s exits lead out on four sides, each to its own place, from a spawn on open ground',async()=>{
  const {onCityGround}=await import('../src/core/city.js');
  const exits=city.metroStation.exits,S=city.metroStation.building;
  assert.deepEqual(exits.map(e=>e.id),['A','B','C','D']);
  assert.equal(new Set(exits.map(e=>e.to.zh)).size,4,'four different places');
  // Every exit faces away from the station's middle: town.facing() walks along (-sin yaw, -cos yaw).
  for(const e of exits){
    const [x,z,yaw]=e.spawn,a=yaw*Math.PI/180;
    assert.ok(onCityGround(city.place.walk,x,z,.42),`${e.id} spawns off the ground`);
    assert.ok(-Math.sin(a)*(x-S.x)-Math.cos(a)*(z-S.z)>0,`${e.id} faces back into the station`);
    assert.ok(e.zh===`${e.id}出口`&&e.to.pinyin&&e.to.en,`${e.id} is signed`);
  }
  const sides=exits.map(({spawn:[x,z]})=>Math.round(Math.atan2(x-S.x,z-S.z)/(Math.PI/2)));
  assert.equal(new Set(sides).size,4,'one exit to a side');
});

test('the promenade path curves inside the promenade and runs through the middle of its plaza',async()=>{
  const {promenadeZ}=await import('../src/core/city.js');
  const p=city.promenade,half=p.path.width/2;
  assert.equal(promenadeZ(p,p.plaza.x),p.plaza.z);
  let low=Infinity,high=-Infinity;
  for(let x=p.x[0];x<=p.x[1];x+=.5){const z=promenadeZ(p,x);low=Math.min(low,z);high=Math.max(high,z);}
  assert.ok(high-low>3,'the path should visibly curve');
  // At least two metres of paving on either side of it all the way along, for the benches, lamps and trees.
  assert.ok(low-half>=p.z[0]+2&&high+half<=p.z[1]-2,`path spans ${low-half}..${high+half}`);
});

/** A tower's footprint on the ground, city-local: quarter turns swap its width and depth. */
function footprint(t){
  const turned=Math.abs(Math.round(Math.sin((t.rot??0)*Math.PI/180)))===1;
  return {x:t.x,z:t.z,hw:(turned?t.d:t.w)/2,hd:(turned?t.w:t.d)/2};
}
test('every city door (the doors table) stands on open pavement just outside the front of its building',async()=>{
  const {onCityGround}=await import('../src/core/city.js');
  const rooms={'city-bank':'进银行','city-bookshop':'进书店','city-hospital':'进医院','city-noodles':'进面馆',
    'city-cinema':'进电影院','city-store':'进便利店','city-cafe':'进咖啡馆',mall:'进商场'};
  assert.deepEqual(Object.fromEntries(city.doors.map(d=>[d.room,d.label])),rooms);
  const PLAYER=.34;
  for(const door of city.doors){
    assert.ok(onCityGround(city.place.walk,door.x,door.z,PLAYER),`${door.room} is off the ground`);
    const gaps=city.towers.map(footprint).map(b=>Math.hypot(Math.max(0,Math.abs(door.x-b.x)-b.hw),Math.max(0,Math.abs(door.z-b.z)-b.hd)));
    // Clear of every tower's hitbox (0.3 m past its walls) by a body's width, so someone can stand on
    // it, and within a stride of one front.
    assert.ok(Math.min(...gaps)>.3+PLAYER,`${door.room} is inside a tower`);
    assert.ok(Math.min(...gaps)<1.5,`${door.room} is not at a building`);
    for(const prop of city.props.filter(p=>!['citycrossing','citylamp'].includes(p.kind)))
      assert.ok(Math.hypot(prop.x-door.x,prop.z-door.z)>2,`${door.room} is on top of a ${prop.kind}`);
  }
  // The noodle lesson moved indoors: no counter left out on the pavement.
  assert.equal(city.noodles,undefined);
});
test('the rooms of the city light up in the evening and go dark through the night',async()=>{
  const {litShare}=await import('../src/world/leds.js');
  for(let h=0;h<24;h+=.25){const v=litShare(h);assert.ok(v>0&&v<1,`${h}: ${v}`);}
  assert.ok(litShare(20)>litShare(17.5)&&litShare(20)>litShare(23.5),'most rooms lit at eight in the evening');
  assert.ok(litShare(23.5)>litShare(3),'fewer as the night goes on');
  assert.ok(Math.abs(litShare(23.999)-litShare(0))<.01,'midnight joins up');
});

test('the tiers of a tower stand on each other, and a sky garden takes the ground its neighbours share',async()=>{
  const {towerTiers}=await import('../src/core/city.js');
  const within=(a,b)=>Math.abs(a.cx-b.cx)+a.w/2<=b.w/2+1e-9&&Math.abs(a.cz-b.cz)+a.d/2<=b.d/2+1e-9;
  const footing=(a,b)=>Math.min(a.cx+a.w/2,b.cx+b.w/2)-Math.max(a.cx-a.w/2,b.cx-b.w/2)>1&&Math.min(a.cz+a.d/2,b.cz+b.d/2)-Math.max(a.cz-a.d/2,b.cz-b.d/2)>1;
  // Staggered either side of a garden: the garden is exactly the overlap.
  const [low,garden,high]=towerTiers({w:10,d:6,form:{podium:{h:5},tiers:[{to:10,dx:-1},{to:13,skin:'garden'},{to:20,dx:1.5}]}});
  assert.deepEqual([garden.cx,garden.w,garden.y0,garden.y1],[.25,7.5,10,13]);
  assert.ok(within(garden,low)&&within(garden,high));
  for(const t of city.towers.filter(one=>one.form)){
    const tiers=towerTiers(t);
    tiers.forEach((v,i)=>{
      const below=i?tiers[i-1]:{cx:0,cz:0,w:t.w,d:t.d,y1:t.form.podium.h},above=tiers.slice(i+1).find(one=>one.skin!=='garden');
      assert.equal(v.y0,below.y1,`${t.sign??t.x}: tier ${i} starts where the one below ends`);
      assert.ok(footing(v,below),`${t.sign??t.x}: tier ${i} has a metre of footing on the one below`);
      if(v.skin==='garden')assert.ok(within(v,below)&&(!above||within(v,above)),`${t.sign}: garden ${i} is not under its neighbours`);
    });
  }
});
test('every near-side tower is built from a form, or drawn by a city part of its own',()=>{
  for(const t of city.towers)assert.ok(t.form||t.drawnBy,`tower at ${t.x},${t.z}`);
});
