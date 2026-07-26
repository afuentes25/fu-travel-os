import type { TravelPricingOption, TravelProduct } from "@/types";

export const EXPLORER_SLIDER_LABELS = {
  previous: "Viaje anterior",
  next: "Viaje siguiente",
} as const;

export const EXPLORER_STICKY_METRICS = {
  desktopHeader: 88,
  mobileHeader: 68,
  detailNav: 58,
  anchorGap: 16,
} as const;

export const EXPLORER_BOOKING_COLORS = {
  background: "#111416",
  surface: "#1a1e21",
  text: "#ffffff",
  muted: "#c9cdd1",
  accent: "#b46f45",
} as const;

export const explorerSlideIndex = (current: number, direction: 1 | -1, total: number) =>
  (current + direction + total) % total;

export const explorerAdultRateOccupancy = (trip: TravelProduct, adults: number) => {
  if (trip.accommodationMode === "none") return "general";
  return ({ 1: "single", 2: "double", 3: "triple", 4: "quadruple" }[adults] as "single" | "double" | "triple" | "quadruple" | undefined);
};

export const explorerVisibleRateOccupancies = (trip: TravelProduct): readonly TravelPricingOption["occupancy"][] =>
  trip.accommodationMode === "none"
    ? ["general", "child", "infant"] as const
    : ["single", "double", "triple", "quadruple", "child"] as const;

export const explorerBookingOccupancy = (trip: TravelProduct, adults: number) =>
  trip.accommodationMode === "hotel_occupancy" ? explorerAdultRateOccupancy(trip, adults) : undefined;

export function explorerBookingMessage({
  agencyName,
  trip,
  departureLabel,
  adults,
  children,
  occupancyLabel,
  totalLabel,
  depositLabel,
  url,
}: {
  agencyName: string;
  trip: TravelProduct;
  departureLabel: string;
  adults: number;
  children: number;
  occupancyLabel?: string;
  totalLabel: string;
  depositLabel: string;
  url: string;
}) {
  const travelers = `Somos ${adults} ${adults === 1 ? "adulto" : "adultos"}${children ? ` y ${children} ${children === 1 ? "menor" : "menores"}` : ""}.`;
  const occupancy = trip.accommodationMode === "hotel_occupancy" && occupancyLabel ? `\nBase de ocupación: ${occupancyLabel}.` : "";
  return `Hola ${agencyName}, estoy interesado en el viaje “${trip.title}” para la salida del ${departureLabel}.\n\n${travelers}${occupancy}\n\n¿Me pueden compartir los puntos de ascenso disponibles?\n\nTotal estimado: ${totalLabel}\nAnticipo: ${depositLabel}\n\nEnlace:\n${url}`;
}
