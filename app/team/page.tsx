import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { access,orderAccess } from "@/db/store";
import WaiterWorkspace from "./waiter-workspace";
import Team from "./team";
export const dynamic="force-dynamic";
export default async function Page(){await requireChatGPTUser("/team");try{const a=await access();if(!a.allowed&&(await orderAccess()).allowed)return <WaiterWorkspace email={a.email}/>;if(!a.allowed)return <main className="access"><h1>Team access only</h1><p>Ask the owner to add your signed-in email to a restaurant.</p><a href="/">Back to menu</a></main>;return <Team owner={a.owner} studio={a.studio} email={a.email}/>;}catch{return <main className="access"><h1>The dashboard is unavailable</h1><p>Please refresh and try again.</p></main>;}}
