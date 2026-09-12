import catalog from '../content/catalog.json' with {type:'json'};
import rooms from '../content/rooms.json' with {type:'json'};
import world from '../content/world.json' with {type:'json'};
import npcs from '../content/npcs.json' with {type:'json'};
import city from '../content/city.json' with {type:'json'};

/**
 * Where to buy: point queries for the where-to-buy map guide, sourced straight from the
 * content data rather than any hard-coded list. A "seller" is a place a catalog item can be
 * bought that has a door you can route to — a shop room, or an NPC stall placed in the world.
 * Moving market stalls and city kiosks have no fixed spot, so they never turn up here.
 */

const buildingById=id=>world.buildings.find(b=>b.id===id);

/** Which of the town's three districts a point falls inside, straight from their bounds. */
function districtAt(x,z){
  return world.districts.find(d=>x>=d.bounds.x[0]&&x<=d.bounds.x[1]&&z>=d.bounds.z[0]&&z<=d.bounds.z[1]);
}

/** Every seller of a catalog item. */
export function sellersOf(itemId){
  const item=catalog.find(i=>i.id===itemId);
  if(!item)return [];
  const shopIds=Array.isArray(item.shop)?item.shop:(item.shop?[item.shop]:[]);
  const sellers=[];
  for(const shopId of shopIds){
    const room=rooms[shopId];
    if(room){
      // A room whose building is a city department store points at the town's own metro stair
      // — the same spot `metro` targets in src/world/town.js — not anywhere inside the city.
      if(typeof room.building==='string'&&room.building.startsWith('city:')){
        const x=city.station.x,z=city.station.z-3;
        const district=districtAt(x,z);
        sellers.push({shop:shopId,zh:room.zh,en:room.en,city:true,district:district?.id,x,z});
        continue;
      }
      const building=buildingById(room.building);
      if(building&&room.door){
        const entry={shop:shopId,zh:room.zh,en:room.en,district:building.district,x:room.door.x,z:room.door.z};
        if(room.opens)entry.opens=room.opens;
        sellers.push(entry);
      }
      continue;
    }
    const npc=npcs.find(n=>n.id===shopId);
    const placed=npc&&world.npcs.find(n=>n.id===shopId);
    if(npc&&placed){
      const district=districtAt(placed.x,placed.z);
      sellers.push({shop:shopId,zh:`${npc.zh} · ${npc.role}`,en:npc.en,district:district?.id,x:placed.x,z:placed.z});
    }
    // Anything else (a moving market stall, a city kiosk) has no fixed door and is left out.
  }
  return sellers;
}

/**
 * Group sellers for a shopping list of `{id,short}`, with what each sells from the list.
 * Town sellers come before city sellers; anything nobody sells is collected separately.
 */
export function whereToBuy(needs){
  const groups=new Map();
  const unsold=[];
  for(const {id,short} of needs){
    const item=catalog.find(i=>i.id===id);
    const sellers=sellersOf(id);
    const row={id,zh:item?.zh,pinyin:item?.pinyin,en:item?.en,price:item?.price,short};
    if(!sellers.length){unsold.push(row);continue;}
    for(const seller of sellers){
      if(!groups.has(seller.shop))groups.set(seller.shop,{seller,items:[]});
      groups.get(seller.shop).items.push(row);
    }
  }
  const sellers=[...groups.values()].sort((a,b)=>(a.seller.city?1:0)-(b.seller.city?1:0));
  return {sellers,unsold};
}
