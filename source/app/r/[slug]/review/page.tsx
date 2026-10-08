import {readMenu} from "@/db/store";
import ReviewForm from "@/app/review-form";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 try{const result=await readMenu(slug);if(result?.menu.active)return <ReviewForm restaurant={slug} name={result.menu.name}/>;}catch{}
 return <main className="access"><h1>Reviews are unavailable right now.</h1><p>Please ask the restaurant team for help.</p><a className="secondary" href={"/r/"+encodeURIComponent(slug)}>Back to this restaurant</a></main>;
}
