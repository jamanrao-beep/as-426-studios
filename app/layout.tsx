import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Table Secret | Discover something delicious",description:"Explore the menu and unlock the chef’s secret. Restaurant menu and team workspace.",icons:{icon:"/logo.jpg",apple:"/logo.jpg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&family=Michroma&display=swap"/></head><body>{children}</body></html>;}
