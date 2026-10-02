import * as pc from 'playcanvas';
import data from '../content/rental.json' with {type:'json'};
export function buildRentalExterior(town,parent){
 const {box,label}=town.m,b=data.building,root=new pc.Entity('riverside-apartments');root.setLocalPosition(b.x,.36,b.z);parent.addChild(root);
 box(root,[0,b.height/2,0],[b.width,b.height,b.depth],'#e6d6be');box(root,[0,b.height+.12,0],[b.width+.6,.24,b.depth+.6],'#668c85');
 for(let floor=0;floor<4;floor++)for(const x of [-3.5,0,3.5]){if(!floor&&x===0)continue;box(root,[x,1.5+floor*2.8,b.depth/2+.03],[1.6,1.6,.08],'#6596a4');box(root,[x,.65+floor*2.8,b.depth/2+.35],[2,.14,.9],'#faf0dc');for(const dx of [-.8,0,.8])box(root,[x+dx,1+floor*2.8,b.depth/2+.75],[.06,.65,.06],'#587b74');}
 box(root,[0,1.3,b.depth/2+.04],[2.2,2.6,.12],'#496863');label(root,'河畔公寓 · RIVERSIDE',[0,3.1,b.depth/2+.15],6,.65,'#315a54','#fff');label(root,'租房 RENT / RENEW',[0,1.8,b.depth/2+.18],2,.4,'#f2e6cc','#365b55');
 const room=town.rooms.get('city');town.mark('city',room.offsetX+b.x,b.z,b.width/2,b.depth/2,.36,b.height+.36,'wall');label(parent,'← 河畔公寓 · Apartments',[37,2,-175],6,.5,'#365b55','#fff');
 return {targets:()=>[{id:'door:'+data.lobby,x:room.offsetX+data.entrance.x,z:data.entrance.z,radius:2.2,label:'Rental apartments · 河畔公寓',wide:true}]};
}
