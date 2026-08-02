import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TravelApp } from "@/components/travel-app";
import { isReservedInternalPath } from "@/lib/routing/public-route-guard";

export default async function CatchAll({searchParams,params}:{searchParams:Promise<Record<string,string|string[]|undefined>>;params:Promise<{route:string[]}>}){const h=await headers();const query=await searchParams;const path=await params;const pathname=`/${path.route.join("/")}`;if(isReservedInternalPath(pathname))notFound();return <TravelApp hostname={h.get("host")??"localhost"} initialTenant={typeof query.tenant==="string"?query.tenant:undefined} initialTheme={typeof query.theme==="string"?query.theme:undefined} initialPath={pathname}/>}
