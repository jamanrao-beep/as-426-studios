import MenuView from "@/app/menu-view";
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <MenuView restaurant={slug}/>;}
