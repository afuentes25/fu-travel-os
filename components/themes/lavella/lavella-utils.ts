import { getTripDisplayStartingPrice } from "@/lib/trip-sections";
import type { Agency, TravelProduct } from "@/types";
import type { MouseEvent } from "react";

export const lavellaDate = (value?: string, withYear = false) =>
  value
    ? new Date(value).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        ...(withYear ? { year: "numeric" } : {}),
      })
    : "Por confirmar";

export const lavellaDeparture = (
  trip: TravelProduct,
  now: Date = new Date(),
) => {
  const ordered = [...trip.departures]
    .filter((departure) => departure.saleStatus !== "sold_out")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const today = now.toISOString().slice(0, 10);
  return (
    ordered.find((departure) => departure.startDate.slice(0, 10) >= today) ??
    ordered.at(-1) ??
    trip.departures[0]
  );
};

export const lavellaStartingPrice = (
  trip: TravelProduct,
  departure = lavellaDeparture(trip),
) => getTripDisplayStartingPrice({ trip, departure });

export const lavellaWhatsApp = (
  agency: Agency,
  trip?: TravelProduct,
  message?: string,
) => {
  const text =
    message ??
    `Hola ${agency.name}, necesito ayuda para reservar${
      trip ? ` “${trip.title}”` : " un viaje"
    }.`;
  return `https://wa.me/${(
    agency.settings.whatsapp?.phone ?? agency.contact.whatsapp
  ).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
};

export const openLavellaWhatsApp = (
  event: MouseEvent<HTMLAnchorElement>,
  agency: Agency,
  trip?: TravelProduct,
  message?: string,
) => {
  event.preventDefault();
  const contextual = [
    message ??
      `Hola ${agency.name}, necesito ayuda para reservar${
        trip ? ` “${trip.title}”` : " un viaje"
      }.`,
    `Enlace: ${window.location.href}`,
  ].join("\n\n");
  window.open(
    lavellaWhatsApp(agency, trip, contextual),
    "_blank",
    "noopener,noreferrer",
  );
};

export const lavellaCategory = (trip: TravelProduct) =>
  (trip.categoryIds[0] ?? trip.productType).replaceAll("_", " ");

const transportLabels: Record<
  TravelProduct["transportTypes"][number],
  string
> = {
  air: "Aéreo",
  ground: "Terrestre",
  mixed: "Mixto",
  train: "Tren",
  cruise: "Crucero",
  not_included: "No incluido",
};

export const lavellaTransport = (
  values: TravelProduct["transportTypes"],
) => values.map((value) => transportLabels[value]).join(" · ");
