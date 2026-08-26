import { headers } from "next/headers";
import { TravelApp } from "@/components/travel-app";
import { resolvePublicCustomerCheckoutProfile } from "@/lib/customers/public-customer-identity";
import { resolveTenant } from "@/lib/tenancy";
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const [h,query]=await Promise.all([headers(),searchParams]);const hostname=h.get("host")??"localhost";const tenant=typeof query.tenant==="string"?query.tenant:undefined;const agency=resolveTenant(hostname,tenant);const customerProfile=await resolvePublicCustomerCheckoutProfile({requestedAgencySlug:agency.slug});return <TravelApp hostname={hostname} initialTenant={tenant} initialTheme={typeof query.theme==="string"?query.theme:undefined} customerProfile={customerProfile}/>}
