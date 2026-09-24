import garden from '../content/garden.json' with {type:'json'};
import {isDisc,bridgeRails} from '../core/garden.js';

/** The park's shapes for the minimap — water, paths, bridges, the pavilion, the pines — as SVG
 *  strings in world coordinates (z down), drawn from the same src/content/garden.json the world
 *  is built from. The minimap draws these under the buildings. */
const COLOR={path:'#e3d6b6',water:'#90b5a9',island:'#d9cfb5',bridge:'#c2553a',timber:'#a9855f',
  pavilion:'#d6a843',pine:'#7f9a6a',blossom:'#e2b3c1',rock:'#a39c90',mill:'#b9ab8e'};
const shapeSvg=(s,fill)=>isDisc(s)
  ?`<circle cx="${s.x}" cy="${s.z}" r="${s.r}" fill="${fill}"/>`
  :`<rect x="${s.x0}" y="${s.z0}" width="${s.x1-s.x0}" height="${s.z1-s.z0}" fill="${fill}"/>`;

export function gardenMapParts(){
  const parts=[];
  for(const p of garden.paths)parts.push(shapeSvg(p,COLOR.path));
  for(const s of [...garden.pond,...garden.stream])parts.push(shapeSvg(s,COLOR.water));
  const is=garden.island;parts.push(shapeSvg(is,COLOR.island));
  for(const b of garden.bridges){
    const [r]=bridgeRails(b);
    parts.push(`<rect x="${b.x-b.width/2}" y="${r.z0}" width="${b.width}" height="${r.z1-r.z0}" fill="${b.flat?COLOR.timber:COLOR.bridge}"/>`);
  }
  const pv=garden.pavilion,R=pv.floor;
  const octagon=Array.from({length:8},(_,i)=>{const a=(22.5+45*i)*Math.PI/180;return `${(pv.x+Math.sin(a)*R).toFixed(2)},${(pv.z+Math.cos(a)*R).toFixed(2)}`;}).join(' ');
  parts.push(`<polygon points="${octagon}" fill="${COLOR.pavilion}"/>`);
  const {house}=garden.mill;
  parts.push(`<rect x="${house.x-house.width/2}" y="${house.z-house.depth/2}" width="${house.width}" height="${house.depth}" rx=".4" fill="${COLOR.mill}"/>`);
  for(const r of [...garden.rocks,...garden.waterfall.rocks])parts.push(shapeSvg(r,COLOR.rock));
  for(const t of garden.pines)parts.push(`<circle cx="${t.x}" cy="${t.z}" r="${(1.3*t.size).toFixed(2)}" fill="${COLOR.pine}"/>`);
  for(const t of garden.blossoms)parts.push(`<circle cx="${t.x}" cy="${t.z}" r="1.2" fill="${COLOR.blossom}"/>`);
  return parts;
}
