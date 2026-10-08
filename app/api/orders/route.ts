import {indiaDate,dayRange} from "@/lib/order-time";
import {access,orderAccess,db,readMenu,sameOrigin,validSlug} from "@/db/store";
import {orderInput,priceOrder,transitions,type OrderStatus} from "@/lib/orders";
import {z} from "zod";
async function hash(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,"0")).join("")}
function receipt(row:any){return {id:row.id,code:row.id.slice(0,8).toUpperCase(),status:row.status,total:row.total,table:row.table_label,created_at:row.created_at};}
export async function POST(req:Request){try{
 if(!sameOrigin(req))return Response.json({error:"Please order from the restaurant menu."},{status:403});
 const raw=await req.text();if(raw.length>20000)return Response.json({error:"Order is too large."},{status:413});let value:unknown;try{value=JSON.parse(raw)}catch{return Response.json({error:"Invalid order."},{status:400})}
 const parsed=orderInput.safeParse(value);if(!parsed.success)return Response.json({error:"Check your table number and selected quantities."},{status:400});const b=parsed.data;
 const requestHash=await hash(JSON.stringify({...b,items:[...b.items].sort((a,b)=>a.id.localeCompare(b.id))}));
 const prior=await db().prepare("SELECT id,request_hash,status,total,table_label,created_at FROM orders WHERE id = ?").bind(b.id).first<any>();
 if(prior){if(prior.request_hash!==requestHash)return Response.json({error:"This order was already submitted with different details."},{status:409});return Response.json({order:receipt(prior)});}
 const current=await readMenu(b.restaurant);if(!current)return Response.json({error:"Restaurant unavailable."},{status:404});let priced;try{priced=priceOrder(current.menu,b.items)}catch(e){return Response.json({error:e instanceof Error?e.message:"Please refresh your menu."},{status:409})}
 const now=new Date().toISOString();
 const result=await db().prepare("INSERT OR IGNORE INTO orders (id,restaurant_id,restaurant_name,table_label,customer_name,notes,items,total,status,request_hash,created_at,updated_at,tracking_hash) SELECT ?,?,?,?,?,?,?,?,'new',?,?,?,? WHERE EXISTS (SELECT 1 FROM menu WHERE id = ? AND revision = ?) OR (? = 'ember-spice' AND ? = 0 AND NOT EXISTS (SELECT 1 FROM menu WHERE id = 'ember-spice'))").bind(b.id,b.restaurant,current.menu.name,b.table,b.name,b.notes,JSON.stringify(priced.lines),priced.total,requestHash,now,now,b.trackingToken?await hash(b.trackingToken):null,b.restaurant,current.revision,b.restaurant,current.revision).run();
 if(!result.meta.changes){const concurrent=await db().prepare("SELECT id,request_hash,status,total,table_label,created_at FROM orders WHERE id = ?").bind(b.id).first<any>();if(concurrent?.request_hash===requestHash)return Response.json({order:receipt(concurrent)});return Response.json({error:"The menu changed while you ordered. Refresh it and review your cart."},{status:409});}
 return Response.json({order:receipt({id:b.id,status:"new",total:priced.total,table_label:b.table,created_at:now})},{status:201,headers:{"Cache-Control":"no-store"}});
}catch{return Response.json({error:"We couldn’t confirm your order. Retry without changing your cart, or ask your server; retrying the same order will not duplicate it."},{status:503})}}
export async function GET(req:Request){try{
 const u=new URL(req.url),id=u.searchParams.get("restaurant")||undefined,managerOnly=u.searchParams.get("scope")==="manage",alerts=u.searchParams.get("alerts")==="1",offset=Number(u.searchParams.get("offset")||0);
 if((id&&!validSlug(id))||!Number.isSafeInteger(offset)||offset<0)return Response.json({error:"Invalid request."},{status:400});
 const a=await orderAccess(id,managerOnly);if(!a.allowed)return Response.json({error:"Order access required."},{status:403});
 const params:unknown[]=[];let where="COALESCE(json_extract(m.data, '$.deleted'),0) = 0";
 if(id){where+=" AND o.restaurant_id = ?";params.push(id)}else if(!a.studio){where+=` AND o.restaurant_id IN (${a.restaurantIds.map(()=>"?").join(",")})`;params.push(...a.restaurantIds)}
 const view=u.searchParams.get("view")||"today";
 if(!alerts){if(view==="unfinished"){where+=" AND o.status IN ('new','accepted','preparing') AND o.created_at < ?";params.push(dayRange(indiaDate()).start)}else{let range;try{range=dayRange(view==="history"?(u.searchParams.get("date")||indiaDate()):indiaDate())}catch{return Response.json({error:"Invalid date."},{status:400})}where+=" AND o.created_at >= ? AND o.created_at < ?";params.push(range.start,range.end)}}
 if(alerts)where+=" AND o.status = 'new'";
 const result=await db().prepare(`SELECT o.id,o.restaurant_id,o.restaurant_name,o.table_label,o.customer_name,o.notes,o.items,o.total,o.status,o.created_at,o.updated_at,o.completed_at,o.completed_by FROM orders o LEFT JOIN menu m ON m.id = o.restaurant_id WHERE ${where} ORDER BY o.created_at DESC,o.id DESC LIMIT 51 OFFSET ?`).bind(...params,offset).all<any>();
 return Response.json({orders:result.results.slice(0,50).map(r=>({...r,items:JSON.parse(r.items)})),hasMore:result.results.length>50},{headers:{"Cache-Control":"no-store"}});
}catch{return Response.json({error:"Order feed unavailable. Please retry."},{status:503})}}
export async function PATCH(req:Request){try{
 if(!sameOrigin(req))return Response.json({error:"Request rejected."},{status:403});
 const p=z.object({restaurant:z.string().refine(validSlug),id:z.string().uuid(),from:z.enum(["new","accepted","preparing","served","cancelled"]),status:z.enum(["new","accepted","preparing","served","cancelled"])}).safeParse(await req.json());
 if(!p.success)return Response.json({error:"Invalid order update."},{status:400});const b=p.data;
 const manager=await access(b.restaurant),actor=manager.allowed?manager:await orderAccess(b.restaurant);
 if(!actor.allowed||(!manager.allowed&&(b.status!=="served"||!["accepted","preparing"].includes(b.from))))return Response.json({error:"Only managers can change this status. Waiters may confirm delivery of accepted orders."},{status:403});
 if(!await readMenu(b.restaurant))return Response.json({error:"Restaurant not found."},{status:404});
 if(!transitions[b.from as OrderStatus].includes(b.status))return Response.json({error:"That status change is not allowed."},{status:400});
 const result=await db().prepare("UPDATE orders SET status = ?,updated_at = ?,completed_at = ?,completed_by = ? WHERE id = ? AND restaurant_id = ? AND status = ?").bind(b.status,new Date().toISOString(),b.status==="served"?new Date().toISOString():null,b.status==="served"?actor.email:null,b.id,b.restaurant,b.from).run();
 if(!result.meta.changes)return Response.json({error:"This order changed or is unavailable. Refresh the orders list."},{status:409});return Response.json({ok:true});
}catch{return Response.json({error:"Couldn’t update this order."},{status:503})}}
