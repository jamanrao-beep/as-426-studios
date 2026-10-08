import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Table Secret | Discover something delicious",description:"Explore the menu and unlock the chef’s secret. Restaurant menu and team workspace.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
