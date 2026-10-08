import type { Dish } from './menu';
export function recommend(dishes:Dish[],p:{diet:string,spice:string,taste:string,budget:string}){
 const score=(d:Dish)=>(d.taste===p.taste?4:0)+(d.spice===p.spice?2:0);
 return dishes.filter(d=>d.available&&!d.secret&&(p.diet!=="veg"||d.veg)&&(p.budget==="any"||d.price<=Number(p.budget))).sort((a,b)=>score(b)-score(a)).slice(0,3);
}
