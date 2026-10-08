import {access,db,readMenu,sameOrigin,validSlug} from "@/db/store";
import {z} from "zod";
const submission=z.object({restaurant:z.string().refine(validSlug),id:z.string().uuid(),rating:z.number().int().min(1).max(5),message:z.string().trim().min(3).max(2000),name:z.string().trim().max(80).default("")});
export async function POST(req:Request){try{
 if(!sameOrigin(req))return Response.json({error:"Please submit your review from the restaurant’s page."},{status:403});
 const raw=await req.text();if(raw.length>10000)return Response.json({error:"Your review is too long."},{status:413});
 let body:unknown;try{body=JSON.parse(raw)}catch{return Response.json({error:"Invalid review."},{status:400})}
 const parsed=submission.safeParse(body);if(!parsed.success)return Response.json({error:"Choose 1–5 stars and write a message of 3–2,000 characters."},{status:400});
 const {restaurant,id,rating,message,name}=parsed.data;
 const menu=await readMenu(restaurant);if(!menu?.menu.active)return Response.json({error:"This restaurant isn’t accepting reviews right now."},{status:404});
 const result=await db().prepare("INSERT OR IGNORE INTO reviews (id,restaurant_id,rating,message,name,created_at) VALUES (?,?,?,?,?,?)").bind(id,restaurant,rating,message,name,new Date().toISOString()).run();
 if(!result.meta.changes){const previous=await db().prepare("SELECT restaurant_id,rating,message,name FROM reviews WHERE id = ?").bind(id).first<{restaurant_id:string,rating:number,message:string,name:string}>();if(!previous||previous.restaurant_id!==restaurant||previous.rating!==rating||previous.message!==message||previous.name!==name)return Response.json({error:"This review changed after submission. Please refresh and try again."},{status:409});}
 return Response.json({ok:true},{status:201,headers:{"Cache-Control":"no-store"}});
}catch{return Response.json({error:"Couldn’t send your review. Your message is still here; please retry."},{status:503})}}
export async function GET(req:Request){try{
 const u=new URL(req.url),restaurant=u.searchParams.get("restaurant"),offset=Number(u.searchParams.get("offset")||0);
 if(!restaurant||!validSlug(restaurant)||!Number.isSafeInteger(offset)||offset<0)return Response.json({error:"Choose a restaurant."},{status:400});
 if(!(await access(restaurant)).allowed)return Response.json({error:"You don’t have access to these reviews."},{status:403});
 if(!await readMenu(restaurant))return Response.json({error:"Restaurant not found."},{status:404});
 const result=await db().prepare("SELECT id,rating,message,name,created_at,read_at FROM reviews WHERE restaurant_id = ? ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?").bind(restaurant,offset).all();
 return Response.json({reviews:result.results.slice(0,50),hasMore:result.results.length>50},{headers:{"Cache-Control":"no-store"}});
}catch{return Response.json({error:"Couldn’t load reviews. Please retry."},{status:503})}}
export async function PATCH(req:Request){try{
 if(!sameOrigin(req))return Response.json({error:"Request rejected."},{status:403});
 const b=await req.json() as {restaurant?:unknown,id?:unknown};
 if(typeof b.restaurant!=="string"||!validSlug(b.restaurant)||typeof b.id!=="string"||!z.string().uuid().safeParse(b.id).success)return Response.json({error:"Invalid review."},{status:400});
 if(!(await access(b.restaurant)).allowed)return Response.json({error:"You don’t have access to these reviews."},{status:403});
 if(!await readMenu(b.restaurant))return Response.json({error:"Restaurant not found."},{status:404});
 const readAt=new Date().toISOString();const result=await db().prepare("UPDATE reviews SET read_at = COALESCE(read_at, ?) WHERE id = ? AND restaurant_id = ?").bind(readAt,b.id,b.restaurant).run();
 if(!result.meta.changes)return Response.json({error:"Review not found."},{status:404});
 return Response.json({ok:true,readAt});
}catch{return Response.json({error:"Couldn’t mark this review as read."},{status:503})}}
