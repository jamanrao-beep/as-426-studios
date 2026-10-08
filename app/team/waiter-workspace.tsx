"use client";
import {useState} from "react";
import {Bell,Utensils} from "lucide-react";
import Orders from "./orders";
import OrderAlerts from "./order-alerts";
export default function WaiterWorkspace({email}:{email:string}){const [restaurant,setRestaurant]=useState<string|undefined>();return <div className="waiter-workspace"><header className="brandbar"><span className="brand"><span className="brandmark"><Utensils size={20}/></span>TABLE SECRET</span><a className="quiet-link" href="/signout-with-chatgpt?return_to=%2Fteam%2Forders">Sign out</a></header><main><p className="eyebrow">ORDERS-ONLY WORKSPACE</p><h1>Your tables, at a glance.</h1><p className="muted waiter-login">Signed in as {email}</p><OrderAlerts onOpen={setRestaurant}/>{restaurant&&<button className="secondary" onClick={()=>setRestaurant(undefined)}>Show all assigned orders</button>}<Orders key={restaurant||"all"} restaurant={restaurant}/></main></div>}
