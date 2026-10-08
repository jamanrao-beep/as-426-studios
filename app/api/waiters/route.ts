import {access,db,readMenu,sameOrigin,validSlug} from "@/db/store";
import {z} from "zod";

const OWNER_EMAIL = (process.env.OWNER_EMAIL || "admin@as426.com").trim().toLowerCase();
const change=z.object({restaurant:z.string().refine(validSlug),email:z.string().trim().toLowerCase().email().max(254),name:z.string().trim().max(80).default(""),action:z.enum(["add","remove"])});

export async function GET(req:Request){try{const id=new URL(req.url).searchParams.get("restaurant");if(!id||!validSlug(id))return Response.json({error:"Choose a restaurant."},{status:400});if(!(await access(id)).allowed)return Response.json({error:"Restaurant manager access required."},{status:403});if(!await readMenu(id))return Response.json({error:"Restaurant not found."},{status:404});const r=await db().prepare("SELECT email,name,created_at FROM waiters WHERE restaurant_id = ? ORDER BY name,email").bind(id).all();return Response.json({waiters:r.results},{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({error:"Couldn’t load waiters."},{status:503})}}

export async function POST(req:Request){try{if(!sameOrigin(req))return Response.json({error:"Request rejected."},{status:403});const p=change.safeParse(await req.json());if(!p.success)return Response.json({error:"Enter a valid name and sign-in email."},{status:400});const {restaurant,email,name,action}=p.data;if(!(await access(restaurant)).allowed)return Response.json({error:"Restaurant manager access required."},{status:403});if(!await readMenu(restaurant))return Response.json({error:"Restaurant not found."},{status:404});if(action==="add"){
 if(!name)return Response.json({error:"Enter the waiter’s name."},{status:400});
 const owner=OWNER_EMAIL;const staff=await db().prepare("SELECT email FROM members WHERE email = ?").bind(email).first();const manager=await db().prepare("SELECT email FROM restaurant_members WHERE restaurant_id = ? AND email = ?").bind(restaurant,email).first();
 if(email===owner||staff||manager)return Response.json({error:"This email already has manager or studio access. Use a separate waiter email; adding a waiter does not reduce existing permissions."},{status:409});
 await db().prepare("INSERT INTO waiters (restaurant_id,email,name,created_at) VALUES (?,?,?,?) ON CONFLICT(restaurant_id,email) DO UPDATE SET name = excluded.name").bind(restaurant,email,name,new Date().toISOString()).run();
 }else await db().prepare("DELETE FROM waiters WHERE restaurant_id = ? AND email = ?").bind(restaurant,email).run();return Response.json({ok:true})}catch{return Response.json({error:"Couldn’t update waiter access. Please retry."},{status:503})}}
