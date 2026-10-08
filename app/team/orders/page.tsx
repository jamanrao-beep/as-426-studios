import {requireChatGPTUser} from "@/app/chatgpt-auth";
import {orderAccess} from "@/db/store";
import WaiterWorkspace from "../waiter-workspace";
export const dynamic="force-dynamic";
export default async function Page(){await requireChatGPTUser("/team/orders");try{const a=await orderAccess();if(a.allowed)return <WaiterWorkspace email={a.email}/>;return <main className="access"><h1>Order access required</h1><p>Ask your restaurant manager to add your signed-in email as a waiter.</p><a href="/signout-with-chatgpt?return_to=%2Fteam%2Forders">Sign in with a different account</a></main>}catch{return <main className="access"><h1>Orders are unavailable</h1><p>Please refresh to retry.</p></main>}}
