import { agencies, domains } from "@/data/demo";
import type { Agency, TravelTheme } from "@/types";

export function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0].replace(/\.$/, "");
}
export function resolveTenant(hostname: string, demoTenant?: string | null): Agency {
  if (demoTenant) {
    const byDemo = agencies.find((a) => a.slug === demoTenant);
    if (byDemo) return byDemo;
  }
  const normalized = normalizeHostname(hostname);
  const domain = domains.find((d) => normalizeHostname(d.hostname) === normalized && d.status === "active");
  if (domain) return agencies.find((a) => a.id === domain.agencyId)!;
  const subdomain = normalized.endsWith(".travel.fu.land") ? normalized.replace(".travel.fu.land", "") : "";
  return agencies.find((a) => a.slug === subdomain) ?? agencies[0];
}
export function isValidTheme(value?: string | null): value is TravelTheme {
  return value === "explorer" || value === "lavella";
}
export function resolveTheme(agency: Agency, requested?: string | null): TravelTheme {
  void agency;
  return isValidTheme(requested) ? requested : "explorer";
}
