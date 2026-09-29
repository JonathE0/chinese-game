import {test,expect} from '@playwright/test';

// Two faces in one plane with different materials flicker as you walk ("weird lines"). This checks
// the exterior pieces rebuilt in wave 2 (Task X-exterior): the bank, the gate hedges and paifangs,
// the kitchen wing's window, the two stalls, the notice boards and the two moved plaques. It reads
// every axis-aligned box face and cylinder cap and reports same-facing coplanar pairs that overlap.
async function start(page){
  await page.goto('/');
  await page.getByRole('button',{name:'开始旅行'}).click();
  await page.waitForFunction(()=>!!window.__qinghe?.town);
  await page.waitForTimeout(300);
}

test('the rebuilt exterior pieces have no coplanar faces of different materials',async({page})=>{
  await start(page);
  const found=await page.evaluate(()=>{
    const t=window.__qinghe.town;
    const inPerson=e=>{for(let n=e;n;n=n.parent)if(n.name==='person')return true;return false;};
    /** Faces of the meshes under `root` whose world box meets `region` (x0,x1,y0,y1,z0,z1), if given. */
    const faces=(root,region)=>{
      const out=[];
      for(const e of root.find(n=>!!n.render&&n.enabled)){
        const type=e.render.type;if((type!=='box'&&type!=='cylinder')||inPerson(e))continue;
        const m=e.getWorldTransform().data,axes=[0,1,2].map(c=>[m[c*4],m[c*4+1],m[c*4+2]]);
        // Axis-aligned only: every local axis lies along a world axis.
        const along=axes.map(a=>{const l=Math.hypot(...a),i=a.findIndex(v=>Math.abs(Math.abs(v)/l-1)<1e-4);return i;});
        if(along.includes(-1))continue;
        const mi=e.render.meshInstances[0],b=mi.aabb,c=b.center,h=b.halfExtents,lo=[c.x-h.x,c.y-h.y,c.z-h.z],hi=[c.x+h.x,c.y+h.y,c.z+h.z];
        if(region&&(hi[0]<region[0]||lo[0]>region[1]||hi[1]<region[2]||lo[1]>region[3]||hi[2]<region[4]||lo[2]>region[5]))continue;
        const caps=type==='box'?[0,1,2]:[along[1]];     // a cylinder's flat faces are its two caps
        for(const a of caps)for(const s of [-1,1]){
          const plane=s<0?lo[a]:hi[a];
          if(a===1&&s<0&&plane<.05)continue;            // standing on the ground
          out.push({e,mat:mi.material,a,s,plane,lo,hi});
        }
      }
      return out;
    };
    const pairs=list=>{
      const bad=[];
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const p=list[i],q=list[j];
        if(p.a!==q.a||p.s!==q.s||p.e===q.e||p.mat===q.mat||Math.abs(p.plane-q.plane)>1e-3)continue;
        const [u,v]=[0,1,2].filter(k=>k!==p.a);
        const du=Math.min(p.hi[u],q.hi[u])-Math.max(p.lo[u],q.lo[u]),dv=Math.min(p.hi[v],q.hi[v])-Math.max(p.lo[v],q.lo[v]);
        if(du>1e-3&&dv>1e-3)bad.push(`${'xyz'[p.a]}${p.s>0?'+':'-'} ${p.plane.toFixed(3)}: ${p.e.lookName??p.e.parent?.lookName??p.e.name} / ${q.e.lookName??q.e.parent?.lookName??q.e.name} @${((p.lo[u]+p.hi[u])/2).toFixed(2)},${((p.lo[v]+p.hi[v])/2).toFixed(2)}`);
      }
      return bad;
    };
    // The auditor must see a planted pair, or a clean result means nothing.
    const scratch=new window.__qinghe.town.root.constructor('coplanar-probe');t.root.addChild(scratch);
    t.m.box(scratch,[0,1,40],[1,1,1],'#123456');t.m.box(scratch,[0,1.25,40],[1,.5,1.2],'#654321');
    const planted=pairs(faces(scratch)).length;scratch.destroy();

    const home=t.buildings.get('home'),hall=t.wordhall.root,garden=t.garden?.root??t.root;
    const scopes={
      bank:faces(t.buildings.get('bank-branch')),
      'gate-market':faces(t.root.findByName('gate-market')),
      'gate-riverside':faces(t.root.findByName('gate-riverside')),
      kitchen:faces(home,[3,7.55,0,6,11,18]),
      stalls:t.stalls.flatMap(([x,z])=>faces(t.root,[x-1.95,x+1.95,.01,3,z-1.9,z+1])),
      notices:t.props.filter(p=>p.kind==='sign').flatMap(p=>faces(p.entity)),
      'wordhall plaque':faces(hall,[-1.3,1.3,4.8,6.1,-18.7,-18.2]),
      'waterside plaque':faces(garden,[10.2,12.2,2.4,3.25,32.8,34.8]),
    };
    const out={planted};
    for(const [name,list] of Object.entries(scopes))out[name]=pairs(list);
    return out;
  });
  expect(found.planted,'the check finds a planted coplanar pair').toBeGreaterThan(0);
  for(const [name,bad] of Object.entries(found))if(name!=='planted')expect(bad,name).toEqual([]);
});
