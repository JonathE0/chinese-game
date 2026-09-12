import * as pc from 'playcanvas';
/** Repeating paving keeps the tile pattern without thousands of separate meshes and shadows. */
export function pavingMaterial(app,width,depth){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const c=canvas.getContext('2d');c.fillStyle='#c6bfa9';c.fillRect(0,0,256,256);
 const colors=['#e3d9c3','#ddd3bc','#e5dbc7','#e1d7c0'];
 for(let x=0;x<2;x++)for(let y=0;y<2;y++){
  c.fillStyle=colors[x+y*2];c.fillRect(x*128+2,y*128+2,124,124);
  c.fillStyle='rgba(255,255,255,.14)';c.fillRect(x*128+2,y*128+2,124,1);
 }
 const texture=new pc.Texture(app.graphicsDevice,{name:'paving',mipmaps:true,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR,addressU:pc.ADDRESS_REPEAT,addressV:pc.ADDRESS_REPEAT});
 texture.setSource(canvas);
 const material=new pc.StandardMaterial();material.diffuseMap=texture;material.diffuseMapTiling=new pc.Vec2(width/4,depth/4);material.shininess=0;material.update();
 return material;
}
