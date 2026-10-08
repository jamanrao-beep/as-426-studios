import {access,db,sameOrigin,validSlug,readMenu} from "@/db/store";
import {sample} from "@/lib/menu";
export async function GET(req:Request){try{
 const admin=new URL(req.url).searchParams.get("admin")==="1";
 if(!admin)return Response.json({error:"Restaurant directory is not available to customers."},{status:403,headers:{"Cache-Control":"no-store"}});
 const permissions=await access();
 if(!permissions.allowed)return Response.json({error:"Restaurant access required"},{status:403});
 const result=await db().prepare("SELECT id,data FROM menu ORDER BY id").all<{id:string,data:string}>();
 const rows=result.results.map(r=>({id:r.id,...JSON.parse(r.data)}));
 if(!rows.some(r=>r.id==="ember-spice"))rows.unshift({id:"ember-spice",...sample});
 const restaurants=rows.filter(r=>!r.deleted&&(permissions.studio||permissions.restaurantIds.includes(r.id))).map(r=>({id:r.id,name:r.name,tagline:r.tagline,active:r.active,count:r.dishes.length}));
 return Response.json({restaurants},{headers:{"Cache-Control":"no-store"}});
}catch{return Response.json({error:"Couldn’t load restaurants"},{status:503})}}
export async function POST(req:Request){try{if(!sameOrigin(req)||!(await access()).studio)return Response.json({error:"Studio team access required"},{status:403});const b=await req.json() as Record<string,string>;if(typeof b.name!=="string"||!b.name.trim()||b.name.length>70||typeof b.id!=="string"||!validSlug(b.id)||b.id==="ember-spice")return Response.json({error:"Use a restaurant name and a unique URL with lowercase letters, numbers and hyphens."},{status:400});const menu={name:b.name.trim(),active:true,tagline:"Welcome to our table.",note:"Please tell your server about any allergies.",dishes:[]};const r=await db().prepare("INSERT OR IGNORE INTO menu (id,data,revision) VALUES (?,?,1)").bind(b.id,JSON.stringify(menu)).run();if(!r.meta.changes)return Response.json({error:"That restaurant URL is already in use. Choose another."},{status:409});return Response.json({id:b.id,menu,revision:1});}catch{return Response.json({error:"Couldn’t create the restaurant. Please try again."},{status:503})}}

export async function DELETE(req:Request){
 try{
  if(!sameOrigin(req)||!(await access()).studio)return Response.json({error:"Studio team access required"},{status:403});
  const b=await req.json() as {id?:unknown,revision?:unknown,confirmation?:unknown};
  if(typeof b.id!=="string"||!validSlug(b.id)||typeof b.revision!=="number"||!Number.isInteger(b.revision)||b.revision<0||typeof b.confirmation!=="string")return Response.json({error:"Invalid deletion request"},{status:400});
  const current=await readMenu(b.id);
  if(!current)return Response.json({error:"This restaurant has already been deleted. Reload your restaurant list."},{status:404});
  if(b.revision!==current.revision)return Response.json({error:"This restaurant was updated by another teammate. Reload its details before deleting."},{status:409});
  if(b.confirmation!==current.menu.name)return Response.json({error:"Type the restaurant name exactly to confirm."},{status:400});
  // Retain only the retired URL marker so sample fallback and old QR codes cannot revive deleted menus.
  const marker=JSON.stringify({deleted:true});
  const result=b.id==="ember-spice"&&b.revision===0
   ?await db().prepare("INSERT OR IGNORE INTO menu (id,data,revision) VALUES (?,?,1)").bind(b.id,marker).run()
   :await db().prepare("UPDATE menu SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?").bind(marker,b.id,b.revision).run();
  if(!result.meta.changes)return Response.json({error:"This restaurant changed. Reload its details before deleting."},{status:409});
  return Response.json({ok:true});
 }catch{return Response.json({error:"Couldn’t delete the restaurant. Please try again."},{status:503})}
}
