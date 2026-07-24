import { headers } from "next/headers";
import { TravelApp } from "@/components/travel-app";
export default async function CatchAll({searchParams,params}:{searchParams:Promise<Record<string,string|string[]|undefined>>;params:Promise<{route:string[]}>}){const h=await headers();const query=await searchParams;const path=await params;return <TravelApp hostname={h.get("host")??"localhost"} initialTenant={typeof query.tenant==="string"?query.tenant:undefined} initialTheme={typeof query.theme==="string"?query.theme:undefined} initialPath={`/${path.route.join("/")}`}/>}
