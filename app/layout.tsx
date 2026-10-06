import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"اسطورة الزيج العراقي | تحدّي أقوى عفطة",description:"سجّل زيجك، شوف سكورك، ونافس على الصدارة.",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
