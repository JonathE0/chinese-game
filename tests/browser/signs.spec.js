import {test,expect} from '@playwright/test';

// Signs in town that something else stood in front of (wave 2, Task X-exterior): 青禾银行 faced a
// ginkgo in a back corner, 词语馆's plaque sat up behind the lower roof, 荷风水榭's plaque behind the
// covered walkway's roof, 旧物铺's hanging sign behind a plaza tree, and market streetlights and
// spare awnings stood in front of the shop boards. The look ray is the judge: a sign is read when
// the ray aimed at it returns its own text, or a sign/plaque box right where the board is.
const SAVE_KEY='little-mandarin-town.v1';
async function start(page){
  await page.addInitScript(([key,value])=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},[SAVE_KEY,JSON.stringify({
    version:1,wallet:0,inventory:{},equipped:{},claims:{},words:{},completed:['home:tutorial','home:starter'],phrases:[],saved:[],home:[],
    discovered:[],clock:14,dayIndex:0,vendors:{},settings:{pinyin:true,english:true,dialogueVolume:0,ambientVolume:0,musicVolume:0},playerName:'旅人'})]);
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.waitForTimeout(300);
}
/** Installs `window.__readSign(sign,x,z)`: does the look ray from eye height at x,z read the sign? */
async function helpers(page){
  await page.evaluate(()=>{
    const t=window.__qinghe.town,reg=t.registry;
    window.__signs=()=>{
      const out=[];
      const walk=e=>{
        if(e.enabled===false)return;
        if(e.signText&&e.render&&e.getLocalScale().x>.3){const p=e.getPosition(),f=e.forward;out.push({text:e.signText,x:p.x,y:p.y,z:p.z,nx:-f.x,nz:-f.z});}
        for(const c of e.children)walk(c);
      };
      walk(t.root);return out;
    };
    window.__readSign=(s,x,z)=>{
      const eye={x,y:reg.groundAt('town',x,z,3)+1.62,z},dx=s.x-x,dy=s.y-eye.y,dz=s.z-z,l=Math.hypot(dx,dy,dz);
      const hit=reg.look('town',eye,{x:dx/l,y:dy/l,z:dz/l},20),name=hit?.box.name;
      if(!name)return '-';
      if(name.zh===s.text)return true;
      return ['sign','plaque'].includes(name.id)&&Math.abs(hit.distance-l)<.6?true:name.zh??name.id;
    };
  });
}

test('every sign in town reads from the ground in front of it',async({page})=>{
  await start(page);await helpers(page);
  const unread=await page.evaluate(()=>{
    const t=window.__qinghe.town,bad=[];
    for(const s of window.__signs()){
      let read=0;const seen={};
      // Both faces (hanging signs and gate boards read both ways), straight on and 25° either side.
      for(const side of [1,-1])for(const a of [-25,0,25])for(const d of [3,4.5,6,7.5,9]){
        const r=a*Math.PI/180,nx=s.nx*side,nz=s.nz*side;
        const x=s.x+(nx*Math.cos(r)-nz*Math.sin(r))*d,z=s.z+(nx*Math.sin(r)+nz*Math.cos(r))*d;
        if(!t.canMove(x,z)||!t.inAnyDistrict(x,z))continue;
        const got=window.__readSign(s,x,z);
        if(got===true)read++;else seen[got]=(seen[got]??0)+1;
      }
      if(read<2)bad.push(`${s.text} @${s.x.toFixed(1)},${s.z.toFixed(1)} read ${read}: ${JSON.stringify(seen)}`);
    }
    return bad;
  });
  expect(unread).toEqual([]);
});

test('the signs that used to hide read from where you would stand to see them',async({page})=>{
  await start(page);await helpers(page);
  // [text, where you stand]: the board read is the one with that text nearest to you.
  const spots=[
    ['青禾银行',-13,-1.5],['青禾银行',-18,-.2],['暂停营业',-18,-.6],   // from the west lane
    ['词语馆',0,-8],['词语馆',0,-12.5],                                  // from the square, through the paifang
    ['荷风水榭',14.2,33.8],['荷风水榭',14.9,33],                        // from under the covered walkway
    ['旧物铺',6,1.5],['旧物铺',6,0],                                      // the hanging sign, from the plaza
    ['麦香面包',39,0],['生活馆',39,0],['青禾书馆',48.5,0],['服装店',49,0],['青禾灯具',58,0],['青禾超市',28,0],
    ['商业街',16,0],['商业街',24,0],['河边文化街',-16,-1.5],
  ];
  const missed=await page.evaluate(spots=>{
    const signs=window.__signs(),bad=[];
    for(const [text,x,z] of spots){
      const s=signs.filter(s=>s.text===text).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
      const got=s?window.__readSign(s,x,z):'no such sign';
      if(got!==true)bad.push(`${text} from ${x},${z}: ${got}`);
    }
    return bad;
  },spots);
  expect(missed).toEqual([]);
});
