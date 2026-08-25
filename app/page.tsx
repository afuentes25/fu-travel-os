import { headers } from "next/headers";
import { TravelApp } from "@/components/travel-app";
import { resolvePublicCustomerEmail } from "@/lib/customers/public-customer-identity";
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const [h,query,customerEmail]=await Promise.all([headers(),searchParams,resolvePublicCustomerEmail()]);return <TravelApp hostname={h.get("host")??"localhost"} initialTenant={typeof query.tenant==="string"?query.tenant:undefined} initialTheme={typeof query.theme==="string"?query.theme:undefined} customerEmail={customerEmail}/>}
