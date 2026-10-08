import {access,db,validSlug} from '@/db/store';
import {indiaDate,monthRange} from '@/lib/order-time';
export async function GET(req:Request){try{
 const u=new URL(req.url),restaurant=u.searchParams.get('restaurant')||'',month=u.searchParams.get('month')||indiaDate().slice(0,7);
 if(!validSlug(restaurant))return Response.json({error:'Choose a restaurant'},{status:400});
 if(!(await access(restaurant)).allowed)return Response.json({error:'Manager access required'},{status:403});
 let range;try{range=monthRange(month)}catch{return Response.json({error:'Invalid month'},{status:400})}
 const r=await db().prepare("SELECT substr(datetime(COALESCE(completed_at,updated_at), '+330 minutes'),1,10) day,COUNT(*) orders,SUM(total) revenue FROM orders WHERE restaurant_id=? AND status='served' AND COALESCE(completed_at,updated_at)>=? AND COALESCE(completed_at,updated_at)<? GROUP BY day ORDER BY day").bind(restaurant,range.start,range.end).all<{day:string,orders:number,revenue:number}>();
 const days=Array.from({length:range.days},(_,i)=>{const day=month+'-'+String(i+1).padStart(2,'0');return r.results.find(r=>r.day===day)||{day,orders:0,revenue:0}});
 return Response.json({month,days,orders:days.reduce((s,d)=>s+d.orders,0),revenue:days.reduce((s,d)=>s+d.revenue,0)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Sales report unavailable'},{status:503})}}
