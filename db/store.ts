import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { sample } from "@/lib/menu";
export function db(){const b=(env as unknown as {DB:D1Database}).DB;if(!b)throw Error("Menu storage unavailable");return b;}
export type Access = {allowed:boolean,owner:boolean,studio:boolean,email:string,restaurantIds:string[]};
export async function access(restaurantId?:string):Promise<Access>{
 const user=await getChatGPTUser();
 if(!user)return {allowed:false,owner:false,studio:false,email:"",restaurantIds:[]};
 const email=user.email.trim().toLowerCase();
 const owner=email===(env as unknown as {OWNER_EMAIL?:string}).OWNER_EMAIL?.trim().toLowerCase();
 const member=owner?null:await db().prepare("SELECT email FROM members WHERE email = ?").bind(email).first();
 const studio=owner||!!member;
 if(studio)return {allowed:true,owner,studio,email,restaurantIds:[]};
 const result=await db().prepare("SELECT rm.restaurant_id FROM restaurant_members rm LEFT JOIN menu m ON m.id = rm.restaurant_id WHERE rm.email = ? AND ((m.id IS NOT NULL AND COALESCE(json_extract(m.data, '$.deleted'), 0) = 0) OR (m.id IS NULL AND rm.restaurant_id = 'ember-spice'))").bind(email).all<{restaurant_id:string}>();
 const restaurantIds=result.results.map(r=>r.restaurant_id);
 return {allowed:restaurantId!==undefined?restaurantIds.includes(restaurantId):restaurantIds.length>0,owner:false,studio:false,email,restaurantIds};
}
export async function readMenu(id:string){const row=await db().prepare("SELECT data, revision FROM menu WHERE id = ?").bind(id).first<{data:string,revision:number}>();if(row){const menu=JSON.parse(row.data);return menu.deleted?null:{menu,revision:row.revision};}return id==="ember-spice"?{menu:sample,revision:0}:null;}
export function sameOrigin(req:Request){return req.headers.get("origin")===new URL(req.url).origin;}
export function validSlug(s:string){return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<=60;}

export async function orderAccess(restaurantId?:string,managerOnly=false):Promise<Access>{
 const manager=await access(restaurantId);if(manager.studio||managerOnly)return manager;
 if(!manager.email)return manager;
 const rows=await db().prepare("SELECT w.restaurant_id FROM waiters w LEFT JOIN menu m ON m.id = w.restaurant_id WHERE w.email = ? AND ((m.id IS NOT NULL AND COALESCE(json_extract(m.data, '$.deleted'),0) = 0) OR (m.id IS NULL AND w.restaurant_id = 'ember-spice'))").bind(manager.email).all<{restaurant_id:string}>();
 const ids=[...new Set([...manager.restaurantIds,...rows.results.map(r=>r.restaurant_id)])];
 return {...manager,restaurantIds:ids,allowed:restaurantId!==undefined?ids.includes(restaurantId):ids.length>0};
}
