import { headers } from "next/headers";
import { TravelApp } from "@/components/travel-app";
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const h=await headers();const query=await searchParams;return <TravelApp hostname={h.get("host")??"localhost"} initialTenant={typeof query.tenant==="string"?query.tenant:undefined} initialTheme={typeof query.theme==="string"?query.theme:undefined}/>}
