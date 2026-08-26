import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TravelApp } from "@/components/travel-app";
import { resolvePublicCustomerCheckoutProfile } from "@/lib/customers/public-customer-identity";
import { isReservedInternalPath } from "@/lib/routing/public-route-guard";
import { resolveTenant } from "@/lib/tenancy";

export default async function CatchAll({searchParams,params}:{searchParams:Promise<Record<string,string|string[]|undefined>>;params:Promise<{route:string[]}>}){const [h,query,path]=await Promise.all([headers(),searchParams,params]);const hostname=h.get("host")??"localhost";const tenant=typeof query.tenant==="string"?query.tenant:undefined;const pathname=`/${path.route.join("/")}`;if(isReservedInternalPath(pathname))notFound();const agency=resolveTenant(hostname,tenant);const customerProfile=await resolvePublicCustomerCheckoutProfile({requestedAgencySlug:agency.slug});return <TravelApp hostname={hostname} initialTenant={tenant} initialTheme={typeof query.theme==="string"?query.theme:undefined} initialPath={pathname} customerProfile={customerProfile}/>}
