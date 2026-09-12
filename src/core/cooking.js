import recipes from '../content/recipes.json' with {type:'json'};
import catalog from '../content/catalog.json' with {type:'json'};
import {bump} from './daily.js';
export const RECIPES=recipes;
const itemById=id=>catalog.find(item=>item.id===id);
export const recipeById=id=>recipes.find(recipe=>recipe.id===id);
export const recipeCost=recipe=>Object.entries(recipe.ingredients).reduce((total,[id,count])=>total+itemById(id).price*count,0);
// Cheapest complete-hunger purchase using any combination of prepared meals (whole portions).
export function preparedMealCost(){
  const foods=catalog.filter(item=>item.nutrition&&[].concat(item.shop).some(shop=>['restaurant','bakery','cafe','nightstall'].includes(shop)));
  const cost=Array(101).fill(Infinity);cost[0]=0;
  for(let hunger=1;hunger<=100;hunger++)for(const food of foods)cost[hunger]=Math.min(cost[hunger],food.price+cost[Math.max(0,hunger-food.nutrition)]);
  return cost[100];
}
export function cookingProblem(profile,recipe){
  if(!recipe)return 'unknown';
  // A recipe someone has to teach you first (the noodle cook, for tomato-egg noodles) stays
  // locked until its flag lands in `completed`, however many groceries you are carrying — and
  // it is checked before the pot, so a locked card stays locked while something else simmers.
  if(recipe.learnedBy&&!profile.completed.includes(recipe.learnedBy))return 'locked';
  if(profile.cooking)return 'busy';
  if((profile.inventory[recipe.output]??0)>=999)return 'full';
  if(Object.entries(recipe.ingredients).some(([id,count])=>(profile.inventory[id]??0)<count))return 'ingredients';
  return null;
}
export function startCooking(profile,id){
  const recipe=recipeById(id),reason=cookingProblem(profile,recipe);
  if(reason)return {ok:false,reason};
  for(const [item,count] of Object.entries(recipe.ingredients)){
    profile.inventory[item]-=count;if(profile.inventory[item]===0)delete profile.inventory[item];
  }
  profile.cooking={recipe:id,remaining:recipe.seconds};return {ok:true};
}
export function tickCooking(profile,seconds){
  if(!profile.cooking||!Number.isFinite(seconds)||seconds<=0)return false;
  const before=profile.cooking.remaining;
  profile.cooking.remaining=Math.max(0,before-seconds);
  return before>0&&profile.cooking.remaining===0;
}
export function collectMeal(profile){
  const job=profile.cooking,recipe=recipeById(job?.recipe);
  if(!recipe||job.remaining>0||(profile.inventory[recipe.output]??0)>=999)return {ok:false};
  profile.inventory[recipe.output]=(profile.inventory[recipe.output]??0)+1;
  delete profile.cooking;
  bump(profile,'cooked');   // the errand credit belongs to the meal, not to whichever panel served it
  const cookedFlag='cooked:'+recipe.id;
  if(!profile.completed.includes(cookedFlag))profile.completed.push(cookedFlag);
  return {ok:true,item:recipe.output};
}
export function normalizeCooking(job){
  if(job===undefined||job===null)return undefined;
  const recipe=recipeById(job.recipe);
  if(!recipe||!Number.isFinite(job.remaining)||job.remaining<0||job.remaining>recipe.seconds)throw Error('Invalid cooking');
  return {recipe:recipe.id,remaining:job.remaining};
}
