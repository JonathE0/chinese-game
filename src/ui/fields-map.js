import fields from '../content/fields.json' with {type:'json'};

/** 青禾田园's shapes for the minimap — the river, the paddies, the plot, the farmhouse, the pier, the
 *  paths and the willows — as SVG strings in world coordinates (z down), drawn from the same
 *  src/content/fields.json the world is built from (src/world/fields.js). */
const COLOR={path:'#e3d6b6',water:'#90b5a9',paddy:'#b9cf9a',plot:'#b49a7c',roof:'#6d7471',timber:'#a9855f',tree:'#9db98a',straw:'#dcc27e'};
const rect=(s,fill,rx=0)=>`<rect x="${s.x0}" y="${s.z0}" width="${s.x1-s.x0}" height="${s.z1-s.z0}"${rx?` rx="${rx}"`:''} fill="${fill}"/>`;

export function fieldsMapParts(){
  const R=fields.river,H=fields.farmhouse,P=fields.pier;
  const parts=[rect({...R,x0:-40,x1:40},COLOR.water)];
  for(const p of [fields.road,...fields.paths,fields.yard])parts.push(rect(p,COLOR.path));
  for(const p of [...fields.paddies,...fields.farPaddies])parts.push(rect(p,COLOR.paddy,.4));
  parts.push(rect(fields.plot,COLOR.plot,.4));
  parts.push(rect(P.walk,COLOR.timber),rect(P.platform,COLOR.timber));
  parts.push(rect({x0:H.x-H.width/2,x1:H.x+H.width/2,z0:H.z-H.depth/2,z1:H.z+H.depth/2},COLOR.roof,.6));
  for(const h of fields.haystacks)parts.push(`<circle cx="${h.x}" cy="${h.z}" r="${h.r}" fill="${COLOR.straw}"/>`);
  for(const [x,z] of [...fields.willows,...fields.farWillows,...fields.trees])parts.push(`<circle cx="${x}" cy="${z}" r="1.3" fill="${COLOR.tree}"/>`);
  return parts;
}
