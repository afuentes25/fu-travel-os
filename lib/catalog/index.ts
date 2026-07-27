import type {
  AvailabilityDisplayMode,
  TravelDeparture,
  TravelProduct,
} from "@/types";
export type CatalogFilters={q?:string;scope?:string;region?:string;transport?:string;currency?:string;availability?:boolean;promotion?:boolean;sort?:string};

export function getAvailabilityLabel(
  mode: AvailabilityDisplayMode,
  departure: TravelDeparture,
): string | null {
  if (mode === "hidden") return null;
  if (departure.saleStatus === "cancelled") return "Cancelada";
  if (departure.saleStatus === "sold_out") return "Agotado";
  if (mode === "remaining_places")
    return `${departure.availableSpaces} lugares`;
  return departure.saleStatus === "limited" ? "Últimos lugares" : "Disponible";
}

export function getCatalogNextDeparture(
  trip: TravelProduct,
  now: Date = new Date(),
) {
  const today = now.toISOString().slice(0, 10);
  const ordered = [...trip.departures]
    .filter((departure) => departure.saleStatus !== "sold_out")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    ordered.find((departure) => departure.startDate.slice(0, 10) >= today) ??
    ordered.at(-1) ??
    trip.departures[0]
  );
}
export function filterCatalog(items:TravelProduct[],f:CatalogFilters){const q=f.q?.trim().toLowerCase();const out=items.filter(t=>(!q||[t.title,t.summary,...t.countries,...t.cities].join(" ").toLowerCase().includes(q))&&(!f.scope||t.scope===f.scope)&&(!f.region||t.region===f.region)&&(!f.transport||t.transportTypes.includes(f.transport as never))&&(!f.currency||t.basePrice.currency===f.currency)&&(!f.availability||t.departures.some(d=>d.availableSpaces>0&&d.saleStatus!=="sold_out"))&&(!f.promotion||!!t.promotion));return [...out].sort((a,b)=>f.sort==="price-asc"?a.basePrice.amount-b.basePrice.amount:f.sort==="price-desc"?b.basePrice.amount-a.basePrice.amount:f.sort==="duration"?a.durationDays-b.durationDays:new Date(getCatalogNextDeparture(a).startDate).getTime()-new Date(getCatalogNextDeparture(b).startDate).getTime())}
