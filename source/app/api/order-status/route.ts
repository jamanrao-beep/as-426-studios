import {db,sameOrigin,validSlug} from '@/db/store';
import {z} from 'zod';
export async function POST(req:Request){try{
 if(!sameOrigin(req))return Response.json({error:'Request rejected'},{status:403});
 const raw=await req.text();if(raw.length>20000)return Response.json({error:'Too many orders'},{status:413});
 const p=z.object({restaurant:z.string().refine(validSlug),orders:z.array(z.object({id:z.string().uuid(),token:z.string().uuid()})).max(40)}).safeParse(JSON.parse(raw));
 if(!p.success)return Response.json({error:'Invalid order lookup'},{status:400});
 const credentials=await Promise.all(p.data.orders.map(async o=>({id:o.id,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(o.token))),n=>n.toString(16).padStart(2,'0')).join('')})));
 if(!credentials.length)return Response.json({orders:[]});
 const r=await db().prepare(`SELECT id,restaurant_id,restaurant_name,table_label,customer_name,notes,items,total,status,created_at,updated_at,completed_at FROM orders WHERE restaurant_id=? AND (${credentials.map(()=>'(id=? AND tracking_hash=?)').join(' OR ')}) ORDER BY created_at DESC`).bind(p.data.restaurant,...credentials.flatMap(c=>[c.id,c.hash])).all<any>();
 return Response.json({orders:r.results.map(o=>({...o,items:JSON.parse(o.items)}))},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Could not refresh your orders. Please retry.'},{status:503})}}
