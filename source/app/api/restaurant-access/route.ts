import {access,db,readMenu,sameOrigin,validSlug} from "@/db/store";
import {z} from "zod";
const changeSchema=z.object({restaurant:z.string().refine(validSlug),email:z.string().trim().toLowerCase().email().max(254),action:z.enum(["add","remove"])});
export async function GET(req:Request){try{
 if(!(await access()).studio)return Response.json({error:"Studio team access required"},{status:403});
 const restaurant=new URL(req.url).searchParams.get("restaurant");
 if(!restaurant||!validSlug(restaurant))return Response.json({error:"Choose a restaurant"},{status:400});
 if(!await readMenu(restaurant))return Response.json({error:"Restaurant not found"},{status:404});
 const result=await db().prepare("SELECT email FROM restaurant_members WHERE restaurant_id = ? ORDER BY email").bind(restaurant).all();
 return Response.json({members:result.results},{headers:{"Cache-Control":"no-store"}});
}catch{return Response.json({error:"Couldn’t load restaurant access. Please retry."},{status:503})}}
export async function POST(req:Request){try{
 if(!sameOrigin(req)||!(await access()).studio)return Response.json({error:"Studio team access required"},{status:403});
 const parsed=changeSchema.safeParse(await req.json());
 if(!parsed.success)return Response.json({error:"Choose a restaurant and enter a valid email address."},{status:400});
 const {restaurant,email,action}=parsed.data;
 if(!await readMenu(restaurant))return Response.json({error:"Restaurant not found"},{status:404});
 if(action==="add")await db().prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id,email) VALUES (?,?)").bind(restaurant,email).run();
 else await db().prepare("DELETE FROM restaurant_members WHERE restaurant_id = ? AND email = ?").bind(restaurant,email).run();
 return Response.json({ok:true});
}catch{return Response.json({error:"Couldn’t update access. Please retry."},{status:503})}}
