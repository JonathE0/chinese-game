import * as pc from 'playcanvas';
/**
 * The town's paving in the Jiangnan look (task W5-nature): 青石板 bluestone slabs in staggered
 * courses (`slabs`, the squares and the market street) or rounded cobbles (`cobbles`, the lanes of
 * the river street), hand-painted on a canvas drawn once: each stone its own tone, its middle worn
 * lighter, its edges darker, dark joints with moss growing in some of them, cracks and speckle.
 * The UVs are world metres, so every district and piece of one line up; `metres` is one repeat.
 */
const PAVING={
  slabs:{metres:4,gloss:.22,joint:'#5d625c',tones:['#a9aaa2','#9fa39e','#b3b1a6','#a4a69d','#979d9a','#aeaa9f','#a0a49f']},
  cobbles:{metres:3,gloss:.26,joint:'#565b55',tones:['#8f9692','#858d8a','#9a9c94','#7f8784','#949189','#8a918b']},
};
const pavings=new Map();
export function pavingMaterial(app,kind='slabs'){
  if(pavings.has(kind))return pavings.get(kind);
  const style=PAVING[kind]??PAVING.slabs,S=512,canvas=document.createElement('canvas');canvas.width=canvas.height=S;
  const c=canvas.getContext('2d');
  let seed=[...kind].reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0,11);
  const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),tone=()=>style.tones[Math.floor(rnd()*style.tones.length)];
  // Every shape is drawn with its copies one repeat over, so the texture tiles without a seam.
  const wrapped=draw=>{for(const dx of [-S,0,S])for(const dy of [-S,0,S])draw(dx,dy);};
  c.fillStyle=style.joint;c.fillRect(0,0,S,S);
  // One stone: its own tone, a worn lighter middle, a darker rim, speckle, now and then a crack.
  const stone=(x,y,w,h,round)=>{
    const t=tone(),cx=x+w/2,cy=y+h/2;
    wrapped((dx,dy)=>{
      c.save();c.beginPath();c.roundRect(x+dx,y+dy,w,h,round);c.clip();
      c.fillStyle=t;c.fillRect(x+dx,y+dy,w,h);
      const g=c.createRadialGradient(cx+dx,cy+dy,0,cx+dx,cy+dy,Math.max(w,h)*.6);
      g.addColorStop(0,`rgba(255,250,238,${.08+rnd()*.08})`);g.addColorStop(.7,'rgba(255,250,238,0)');g.addColorStop(1,'rgba(30,34,32,.22)');
      c.fillStyle=g;c.fillRect(x+dx,y+dy,w,h);
      c.restore();
    });
    for(let i=0;i<w*h/90;i++){const px=x+rnd()*w,py=y+rnd()*h;c.fillStyle=rnd()<.5?'rgba(255,255,255,.07)':'rgba(0,0,0,.08)';wrapped((dx,dy)=>c.fillRect(px+dx,py+dy,1+rnd()*2,1+rnd()*2));}
    // Brush strokes across the stone, as the album's surfaces are painted.
    for(let i=0;i<w*h/1400;i++){
      const px=x+rnd()*w,py=y+rnd()*h,l=6+rnd()*14,a=(rnd()-.5)*.6;c.lineWidth=2+rnd()*3;c.lineCap='round';
      c.strokeStyle=rnd()<.5?`rgba(255,248,236,${.05*rnd()})`:`rgba(40,40,36,${.06*rnd()})`;
      wrapped((dx,dy)=>{c.beginPath();c.moveTo(px+dx,py+dy);c.lineTo(px+dx+Math.cos(a)*l,py+dy+Math.sin(a)*l);c.stroke();});
    }
    if(!round&&rnd()<.18){
      let px=x+rnd()*w,py=y+2;c.strokeStyle='rgba(40,42,40,.35)';c.lineWidth=1;
      const pts=[[px,py]];for(let k=0;k<4;k++){px+=(rnd()-.5)*w*.3;py+=h/4.4;pts.push([px,py]);}
      wrapped((dx,dy)=>{c.beginPath();pts.forEach(([u,v],k)=>k?c.lineTo(u+dx,v+dy):c.moveTo(u+dx,v+dy));c.stroke();});
    }
  };
  if(kind==='cobbles'){
    // Rows of rounded setts, each a little different in size, offset row on row.
    const rows=16,rh=S/rows;
    for(let r=0;r<rows;r++){
      let x=rnd()*rh;const end=x+S;
      while(x<end-1){let w=rh*(.8+rnd()*.6);if(end-x-w<rh*.6)w=end-x;stone(x+1.5,r*rh+1.5,w-3,rh-3,rh*.42);x+=w;}
    }
  } else {
    // Courses of long slabs, the joints staggered from one course to the next.
    const rows=6,rh=S/rows;
    for(let r=0;r<rows;r++){
      let x=rnd()*S;const end=x+S;
      while(x<end-1){let w=S*(.2+rnd()*.18);if(end-x-w<S*.12)w=end-x;stone(x+2,r*rh+2,w-4,rh-4,3);x+=w;}
    }
  }
  // Moss creeping along some of the joints.
  for(let i=0;i<(kind==='cobbles'?90:40);i++){
    const x=rnd()*S,y=rnd()*S,l=10+rnd()*40,across=rnd()<.5;
    c.strokeStyle=`rgba(102,122,74,${.25+rnd()*.3})`;c.lineWidth=2+rnd()*3;c.lineCap='round';
    wrapped((dx,dy)=>{c.beginPath();c.moveTo(x+dx,y+dy);c.lineTo(x+dx+(across?l:0),y+dy+(across?0:l));c.stroke();});
  }
  const img=c.getImageData(0,0,S,S),d=img.data;
  for(let i=0;i<d.length;i+=4){const k=(rnd()-.5)*10;d[i]+=k;d[i+1]+=k;d[i+2]+=k;}
  c.putImageData(img,0,0);
  const texture=new pc.Texture(app.graphicsDevice,{name:'paving-'+kind,mipmaps:true,anisotropy:8,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT});
  texture.setSource(canvas);
  const material=new pc.StandardMaterial();material.name='paving-'+kind;material.diffuseMap=texture;
  material.useMetalness=true;material.metalness=0;material.gloss=style.gloss;material.update();
  pavings.set(kind,material);
  return material;
}

/**
 * A slab of paving .12 m thick over `rect` {x0,x1,z0,z1} with its top at `top`, open where `holes`
 * are (the canal sunk through the river street): the rect is cut on every hole's edges and each
 * piece outside the holes laid, its sides shown round the outside and into the holes. One mesh, UVs
 * in world metres. `material` lays something else the same way, in vertex `colour` if it is given (the
 * land round the town, in the models' shared painted material). Returns the entity.
 */
export function pavement(app,parent,rect,holes,top,kind='slabs',{material=null,colour=null,depth=.12}={}){
  const metres=(PAVING[kind]??PAVING.slabs).metres,xs=[rect.x0,rect.x1],zs=[rect.z0,rect.z1];
  for(const h of holes){xs.push(h.x0,h.x1);zs.push(h.z0,h.z1);}
  const X=[...new Set(xs)].filter(v=>v>=rect.x0&&v<=rect.x1).sort((a,b)=>a-b),Z=[...new Set(zs)].filter(v=>v>=rect.z0&&v<=rect.z1).sort((a,b)=>a-b);
  const open=(x,z)=>x<rect.x0||x>rect.x1||z<rect.z0||z>rect.z1||holes.some(h=>x>h.x0&&x<h.x1&&z>h.z0&&z<h.z1);
  const p=[],n=[],uv=[],ix=[],bottom=top-depth;
  const quad=(pts,normal,uvs)=>{const b=p.length/3;pts.forEach((q,k)=>{p.push(...q);n.push(...normal);uv.push(...uvs[k]);});ix.push(b,b+1,b+2,b,b+2,b+3);};
  for(let i=0;i+1<X.length;i++)for(let j=0;j+1<Z.length;j++){
    const [x0,x1,z0,z1]=[X[i],X[i+1],Z[j],Z[j+1]];
    if(open((x0+x1)/2,(z0+z1)/2))continue;
    // Wound counter-clockwise seen from outside (from above, the top; from beyond, each side).
    quad([[x0,top,z1],[x1,top,z1],[x1,top,z0],[x0,top,z0]],[0,1,0],[[x0,-z1],[x1,-z1],[x1,-z0],[x0,-z0]].map(([u,v])=>[u/metres,v/metres]));
    const side=(a,b,normal,along)=>quad([[...a],[...b],[b[0],top,b[2]],[a[0],top,a[2]]],normal,
      [[along(a)/metres,bottom/metres],[along(b)/metres,bottom/metres],[along(b)/metres,top/metres],[along(a)/metres,top/metres]]);
    if(open(x0-.01,(z0+z1)/2))side([x0,bottom,z0],[x0,bottom,z1],[-1,0,0],q=>q[2]);
    if(open(x1+.01,(z0+z1)/2))side([x1,bottom,z1],[x1,bottom,z0],[1,0,0],q=>q[2]);
    if(open((x0+x1)/2,z0-.01))side([x1,bottom,z0],[x0,bottom,z0],[0,0,-1],q=>q[0]);
    if(open((x0+x1)/2,z1+.01))side([x0,bottom,z1],[x1,bottom,z1],[0,0,1],q=>q[0]);
  }
  const geometry=Object.assign(new pc.Geometry(),{positions:p,normals:n,uvs:uv,indices:ix});
  if(colour){const c=new pc.Color().fromString(colour),rgba=[c.r,c.g,c.b,1].map(v=>Math.round(v*255));geometry.colors=p.filter((_,i)=>i%3===0).flatMap(()=>rgba);}
  const e=new pc.Entity('paving');e.addComponent('render',{castShadows:false,receiveShadows:true});
  e.render.meshInstances=[new pc.MeshInstance(pc.Mesh.fromGeometry(app.graphicsDevice,geometry),material??pavingMaterial(app,kind))];
  parent.addChild(e);
  return e;
}

/**
 * Room floors, each drawn once as a repeating canvas tile. `style` comes from floors.json:
 * `pattern` picks the drawing, `tones` its colours, `line` the seams or grout, and `tile` how many
 * metres one repeat covers. A small seeded random keeps the same room looking the same every visit.
 */
const floorTextures=new Map();
export function floorMaterial(app,style,width,depth,du=0,dv=0){
 if(!floorTextures.has(style)){
  const S=256,canvas=document.createElement('canvas');canvas.width=canvas.height=S;
  const c=canvas.getContext('2d');
  let seed=[...JSON.stringify(style)].reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0,7);
  const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const tones=style.tones,tone=()=>tones[Math.floor(rnd()*tones.length)];
  // Every shape is drawn with its copies one repeat over, so it wraps across the tile's edges.
  const put=(x,y,w,h)=>{for(const dx of [-S,0,S])for(const dy of [-S,0,S])c.fillRect(x+dx,y+dy,w,h);};
  c.fillStyle=style.line??tones[0];c.fillRect(0,0,S,S);
  const draw={
   planks(){
    const rows=style.rows??8,bh=S/rows;
    for(let r=0;r<rows;r++){
     let x=rnd()*S;const end=x+S;
     while(x<end-1){
      let len=S*(.3+rnd()*.35);if(end-x-len<S*.15)len=end-x;
      c.fillStyle=tone();put(x,r*bh,len-1.5,bh-1.5);
      c.fillStyle='rgba(60,40,20,.08)';for(let i=0;i<3;i++)put(x,r*bh+rnd()*bh,len-1.5,1);
      x+=len;
     }
    }
   },
   herringbone(){
    // Staggered k-by-1 blocks: in row y a flat block starts wherever (x - y) mod 2k is 0, and in
    // column x an upright one starts wherever it is 2k-1. The two families fill the plane exactly.
    const k=style.k??3,n=style.cells??18,s=S/n,m=v=>((v%(2*k))+2*k)%(2*k);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
     if(m(x-y)===0){c.fillStyle=tone();put(x*s,y*s,k*s-1.5,s-1.5);}
     else if(m(x-y)===2*k-1){c.fillStyle=tone();put(x*s,y*s,s-1.5,k*s-1.5);}
    }
   },
   tiles(){
    const n=style.count??2,s=S/n;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
     const ox=style.offset&&y%2?s/2:0;
     c.fillStyle=tone();put(x*s+ox+1,y*s+1,s-2,s-2);
     c.fillStyle='rgba(255,255,255,.12)';put(x*s+ox+1,y*s+1,s-2,1);
     for(let i=0;i<14;i++){c.fillStyle=`rgba(90,80,70,${.04+rnd()*.06})`;put(x*s+ox+rnd()*s,y*s+rnd()*s,2+rnd()*6,1+rnd()*3);}
    }
   },
   checker(){
    const n=style.count??4,s=S/n;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){c.fillStyle=tones[(x+y)%2];put(x*s+1,y*s+1,s-2,s-2);}
   },
   terrazzo(){
    c.fillStyle=tones[0];c.fillRect(0,0,S,S);
    for(let i=0;i<900;i++){c.fillStyle=tones[1+Math.floor(rnd()*(tones.length-1))];const r=1+rnd()*rnd()*5;put(rnd()*S,rnd()*S,r,r*(.6+rnd()*.6));}
    // Brass strips divide the poured floor into squares.
    const n=style.count??2;c.fillStyle=style.line??'#b39a6a';
    for(let i=0;i<n;i++){put(i*S/n,0,1.5,S);put(0,i*S/n,S,1.5);}
   },
   tatami(){
    // One repeat is four half-tiles: two mats lying one way beside two lying the other, each mat
    // woven along its length with a dark cloth border down both long edges.
    const H=S/2,mat=(x,y,w,h)=>{
     const long=w>h;c.fillStyle=tone();c.fillRect(x+1,y+1,w-2,h-2);
     c.fillStyle='rgba(90,80,40,.12)';
     if(long)for(let v=y+4;v<y+h-3;v+=3)c.fillRect(x+1,v,w-2,1);else for(let u=x+4;u<x+w-3;u+=3)c.fillRect(u,y+1,1,h-2);
     c.fillStyle=style.border??'#3f4a3c';
     if(long){c.fillRect(x+1,y+1,w-2,5);c.fillRect(x+1,y+h-6,w-2,5);}else{c.fillRect(x+1,y+1,5,h-2);c.fillRect(x+w-6,y+1,5,h-2);}
    };
    for(const [qx,qy,flat] of [[0,0,true],[H,0,false],[0,H,false],[H,H,true]])
     for(const i of [0,1])flat?mat(qx,qy+i*H/2,H,H/2):mat(qx+i*H/2,qy,H/2,H);
   },
   patterned(){
    // Encaustic tiles: a diamond in the middle and a quarter circle in each corner, so four tiles
    // together make a round flower where they meet.
    const n=style.count??4,s=S/n,[ground,diamond,corner]=tones;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
     const x0=x*s,y0=y*s;
     c.save();c.beginPath();c.rect(x0+1,y0+1,s-2,s-2);c.clip();
     c.fillStyle=ground;c.fillRect(x0,y0,s,s);
     c.fillStyle=diamond;c.beginPath();c.moveTo(x0+s/2,y0+s*.18);c.lineTo(x0+s*.82,y0+s/2);c.lineTo(x0+s/2,y0+s*.82);c.lineTo(x0+s*.18,y0+s/2);c.fill();
     c.fillStyle=corner;for(const [cx,cy] of [[x0,y0],[x0+s,y0],[x0,y0+s],[x0+s,y0+s]]){c.beginPath();c.arc(cx,cy,s*.28,0,Math.PI*2);c.fill();}
     c.fillStyle=ground;c.beginPath();c.arc(x0+s/2,y0+s/2,s*.1,0,Math.PI*2);c.fill();
     c.restore();
    }
   },
  };
  (draw[style.pattern]??draw.tiles)();
  const texture=new pc.Texture(app.graphicsDevice,{name:'floor-'+style.pattern,mipmaps:true,anisotropy:8,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT});
  texture.setSource(canvas);floorTextures.set(style,texture);
 }
 const material=new pc.StandardMaterial();material.diffuseMap=floorTextures.get(style);
 const tile=style.tile??2;material.diffuseMapTiling=new pc.Vec2(width/tile,depth/tile);
 // A piece of a larger floor starts its pattern `du,dv` metres in (a box's top face runs u towards +x, v towards -z).
 material.diffuseMapOffset=new pc.Vec2(du/tile,dv/tile);
 material.useMetalness=true;material.metalness=0;material.gloss=style.gloss??.2;material.update();
 return material;
}
