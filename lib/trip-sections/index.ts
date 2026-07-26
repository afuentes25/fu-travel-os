import type {
  Currency,
  ItineraryDisplayMode,
  ItineraryLeadCaptureService,
  ItineraryLeadInput,
  PublicDeparturePoint,
  ScheduledDeparturePricing,
  TravelDeparture,
  TravelItineraryDay,
  TravelProduct,
  TravelPricingOption,
  TravelTheme,
  TripMapSettings,
  TripRecommendationItem,
  TripSectionConfig,
  TripSectionType,
  TripVideoContent,
} from "../../types/index";

export const DEFAULT_TRIP_SECTIONS: TripSectionConfig[] = [
  ["summary", "Resumen"], ["video", "Video"], ["gallery", "Galería"],
  ["itinerary", "Itinerario"], ["included", "Incluye"], ["map", "Ruta"],
  ["departures", "Fechas"], ["rates", "Tarifas"], ["recommendations", "Recomendaciones"],
  ["departure_points", "Puntos de salida"], ["important_information", "Información importante"],
  ["faq", "Preguntas frecuentes"], ["related_trips", "Viajes relacionados"],
].map(([type, label], order) => ({
  id: `section-${type}`, type: type as TripSectionType, enabled: true,
  order: order + 1, anchorLabel: label, showInStickyNavigation: !["video", "gallery", "related_trips"].includes(type),
}));

const hasText = (value?: string) => Boolean(value?.trim());
const validItems = (value?: unknown[]) => Boolean(value?.length);

export function hasTripSectionContent(trip: TravelProduct, type: TripSectionType): boolean {
  switch (type) {
    case "summary": return hasText(trip.summaryContent?.shortDescription ?? trip.summary);
    case "video": return Boolean(trip.videoContent?.enabled && getSafeVideoPresentation(trip.videoContent));
    case "gallery": return validItems(trip.galleryImages ?? trip.gallery);
    case "itinerary": return validItems(trip.itinerary);
    case "included": return validItems(trip.inclusionsContent?.included ?? trip.includes) || validItems(trip.inclusionsContent?.excluded ?? trip.excludes);
    case "map": return Boolean(trip.mapSettings?.enabled && trip.mapSettings.mode !== "none" && (trip.mapSettings.mainDestination || trip.mapSettings.routeStops?.length));
    case "departures": return validItems(trip.departures);
    case "rates": return validItems(trip.pricingOptions);
    case "recommendations": return validItems(getRecommendationItems(trip));
    case "departure_points": return validItems(trip.publicDeparturePoints);
    case "important_information": return validItems(trip.importantInformation?.items);
    case "faq": return validItems(trip.faqContent?.items);
    case "related_trips": return true;
    case "custom": return false;
  }
}

export function resolveTripSections(trip: TravelProduct): TripSectionConfig[] {
  const configured = trip.pageConfiguration?.sections?.length ? trip.pageConfiguration.sections : DEFAULT_TRIP_SECTIONS;
  return configured.filter((section) => section.enabled && hasTripSectionContent(trip, section.type)).sort((a, b) => a.order - b.order);
}

export function getStickyTripSections(trip: TravelProduct): TripSectionConfig[] {
  return resolveTripSections(trip).filter((section) => section.showInStickyNavigation);
}

export function formatTripDuration(days: number, nights: number): string {
  const dayLabel = `${days} ${days === 1 ? "día" : "días"}`;
  return nights > 0 ? `${dayLabel} · ${nights} ${nights === 1 ? "noche" : "noches"}` : dayLabel;
}

export function getVisitedDestinations(days: TravelItineraryDay[], max?: number): string[] {
  const names: string[] = [];
  [...days].sort((a, b) => (a.order ?? a.day) - (b.order ?? b.day)).forEach((day) => {
    [...(day.stops ?? [])].sort((a, b) => a.order - b.order).forEach((stop) => {
      if (!names.includes(stop.name)) names.push(stop.name);
    });
  });
  return typeof max === "number" ? names.slice(0, max) : names;
}

export function resolveDeparturePricing(trip: TravelProduct, departure?: TravelDeparture): ScheduledDeparturePricing["pricingOverrides"] {
  return departure?.pricing?.mode === "custom" ? departure.pricing.pricingOverrides : undefined;
}

const pricingOverrideKey: Partial<Record<TravelPricingOption["occupancy"], keyof NonNullable<ScheduledDeparturePricing["pricingOverrides"]>>> = {
  general: "adultGeneral", single: "adultSingle", double: "adultDouble",
  triple: "adultTriple", quadruple: "adultQuadruple", child: "minor", infant: "infant",
};

export function getEffectiveRateAmount(input: {
  trip: TravelProduct; departure?: TravelDeparture; rate: TravelPricingOption;
}): number {
  const overrides = resolveDeparturePricing(input.trip, input.departure);
  const key = pricingOverrideKey[input.rate.occupancy];
  return key && overrides?.[key] !== undefined ? Number(overrides[key]) : input.rate.amount;
}

export function getEffectiveTaxesPerTraveler(input: {
  trip: TravelProduct; departure?: TravelDeparture; rate: TravelPricingOption;
}): number {
  if (input.trip.basePrice.taxesIncluded) return 0;
  const overrides = resolveDeparturePricing(input.trip, input.departure);
  return overrides?.taxes ?? input.rate.taxesAmount ?? input.trip.basePrice.taxesAmount ?? 0;
}

export function getTripDisplayStartingPrice(input: { trip: TravelProduct; departure?: TravelDeparture }): {
  amount: number; currency: Currency; label: string; basis: "adult_double" | "adult_general" | "package" | "custom";
} {
  const { trip, departure } = input;
  const overrides = resolveDeparturePricing(trip, departure);
  const hotel = trip.accommodationMode === "hotel_occupancy";
  const occupancy = hotel ? "double" : "general";
  const option = trip.pricingOptions.find((item) => item.occupancy === occupancy);
  const override = hotel ? overrides?.adultDouble : overrides?.adultGeneral;
  const amount = override ?? departure?.priceOverride?.amount ?? (option ? getEffectiveRateAmount({ trip, departure, rate: option }) : trip.basePrice.amount);
  return {
    amount,
    currency: option?.currency ?? trip.basePrice.currency,
    label: hotel ? "por persona en habitación doble" : "por adulto",
    basis: override !== undefined || departure?.priceOverride ? "custom" : hotel ? "adult_double" : "adult_general",
  };
}

export function getInitialItineraryOpenDays(mode: ItineraryDisplayMode, count: number): number[] {
  if (mode === "all_open") return Array.from({ length: count }, (_, index) => index);
  return mode === "first_open" && count ? [0] : [];
}

export function parseBulletedRecommendations(text = ""): TripRecommendationItem[] {
  return text.split(/\r?\n/).map((line) => line.replace(/^\s*[-*•·]\s*/, "").trim()).filter(Boolean)
    .map((item, index) => ({ id: `recommendation-${index + 1}`, text: item, order: index + 1 }));
}

export function getRecommendationItems(trip: TravelProduct): TripRecommendationItem[] {
  const content = trip.recommendationsContent;
  if (!content) return trip.recommendations.map((text, index) => ({ id: `legacy-${index}`, text, order: index + 1 }));
  return content.mode === "bulleted_text" ? parseBulletedRecommendations(content.bulletedText) : [...(content.items ?? [])].sort((a, b) => a.order - b.order);
}

export function isSafePublicUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value, "https://travel.fu.land");
    return ["http:", "https:"].includes(url.protocol) && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname);
  } catch { return value.startsWith("/") && !value.startsWith("//"); }
}

export function isSafeDownloadUrl(value?: string): boolean {
  return isSafePublicUrl(value) && !/\.(exe|dmg|sh|bat|cmd|js|msi)(?:$|\?)/i.test(value ?? "");
}

export function isSafeCustomIconUrl(value?: string): boolean {
  return isSafePublicUrl(value) && /\.(png|jpe?g|webp|avif)(?:$|\?)/i.test(value ?? "");
}

export function getSafeVideoPresentation(video?: TripVideoContent): { mode: "iframe" | "html5" | "link"; url: string } | null {
  if (!video?.enabled || !isSafePublicUrl(video.url)) return null;
  try {
    const url = new URL(video.url, "https://travel.fu.land");
    if (video.provider === "html5") return /\.(mp4|webm|ogg)(?:$|\?)/i.test(url.pathname + url.search) ? { mode: "html5", url: url.toString() } : null;
    if (video.provider === "youtube" && /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname)) {
      const id = url.hostname.includes("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v") ?? url.pathname.split("/").pop();
      return id && /^[\w-]{6,}$/.test(id) ? { mode: "iframe", url: `https://www.youtube-nocookie.com/embed/${id}` } : null;
    }
    if (video.provider === "vimeo" && /(^|\.)vimeo\.com$/.test(url.hostname)) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      return id && /^\d+$/.test(id) ? { mode: "iframe", url: `https://player.vimeo.com/video/${id}` } : null;
    }
    if (video.provider === "tiktok" && /(^|\.)tiktok\.com$/.test(url.hostname)) return { mode: "link", url: url.toString() };
    if (video.provider === "instagram" && /(^|\.)instagram\.com$/.test(url.hostname)) return { mode: "link", url: url.toString() };
  } catch { return null; }
  return null;
}

export function getOrderedRouteStops(settings?: TripMapSettings) {
  return [...(settings?.routeStops ?? [])].sort((a, b) => a.dayNumber - b.dayNumber || a.order - b.order);
}

export function getPublicDeparturePoints(points?: PublicDeparturePoint[]): PublicDeparturePoint[] {
  return [...(points ?? [])].filter((point) => point.enabled).sort((a, b) => a.order - b.order);
}

export function validateLead(input: { name: string; whatsapp: string; consent: boolean }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.name.trim().length < 2) errors.name = "Escribe tu nombre.";
  if (input.whatsapp.replace(/\D/g, "").length < 10) errors.whatsapp = "Escribe un WhatsApp válido.";
  if (!input.consent) errors.consent = "Acepta el aviso de privacidad para continuar.";
  return errors;
}

export const localItineraryLeadCaptureService: ItineraryLeadCaptureService = {
  async capture(input: ItineraryLeadInput) {
    if (typeof window === "undefined") return;
    const stored = JSON.parse(localStorage.getItem("fu-travel-itinerary-leads") ?? "[]") as ItineraryLeadInput[];
    localStorage.setItem("fu-travel-itinerary-leads", JSON.stringify([...stored, input]));
  },
};

export const TRIP_SECTION_RENDERERS = {
  explorer: { id: "explorer-cinematic" },
  boutique: { id: "boutique-editorial" },
  marketplace: { id: "marketplace-operational" },
  lavella: { id: "lavella-native" },
} as const satisfies Record<TravelTheme, { id: string }>;

export const TRIP_SECTION_RENDERER_KEYS = {
  explorer: TRIP_SECTION_RENDERERS.explorer.id,
  boutique: TRIP_SECTION_RENDERERS.boutique.id,
  marketplace: TRIP_SECTION_RENDERERS.marketplace.id,
  lavella: TRIP_SECTION_RENDERERS.lavella.id,
} as const;
