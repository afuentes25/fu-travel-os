import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const sans=DM_Sans({subsets:["latin"],variable:"--font-sans"});
const serif=Cormorant_Garamond({subsets:["latin"],variable:"--font-serif",weight:["500","600","700"]});
export const metadata:Metadata={
  title:{default:"Fu Travel OS — Demo multiagencia",template:"%s | Fu Travel OS"},
  description:"Sistema operativo comercial multiagencia para publicar, vender y operar viajes.",
  robots:{index:false,follow:false},
  openGraph:{title:"Fu Travel OS",description:"Un solo sistema. Cada agencia, su propia forma de viajar.",type:"website"},
  twitter:{card:"summary_large_image",title:"Fu Travel OS"},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body className={`${sans.variable} ${serif.variable}`}>{children}</body></html>}
