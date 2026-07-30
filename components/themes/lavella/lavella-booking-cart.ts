import {
  isDepartureBookable,
  priceLinePending,
  resolveDepositAmount,
  validateCartCurrencies,
  validateCartRoomCapacity,
  validateDemoFxOrderShape,
  validateFxGroupConsistency,
} from "@/lib/pricing";
import { getTripDisplayStartingPrice } from "@/lib/trip-sections";
import type {
  Agency,
  CartLine,
  Currency,
  TravelProduct,
  TravelPricingOption,
} from "@/types";

export type LavellaBookingQuote = {
  subtotal: number;
  taxes: number;
  charges: number;
  total: number;
  deposit: number;
  currency: Currency;
};

export type LavellaBookingDraft = {
  travelId: string;
  travelCode: string;
  departureId: string;
  departureStartDate: string;
  adults: number;
  children: number;
  rooms?: number;
  occupancy?: TravelPricingOption["occupancy"];
  boardingOptionId: string | null;
  extraIds: string[];
  total: number;
  deposit: number;
  depositPercent?: number;
  depositAmount?: number;
  remainingAmount?: number;
  currency: Currency;
  tenant: string;
  theme: "lavella";
};

export function getLavellaBookingQuote({
  trip,
  departureId,
  lines,
}: {
  trip: TravelProduct;
  departureId: string;
  lines: CartLine[];
}): LavellaBookingQuote {
  if (!lines.length) throw new Error("La reserva no contiene viajeros.");
  const departure = trip.departures.find(
    (item) => item.id === departureId && isDepartureBookable(item),
  );
  if (!departure) throw new Error("Selecciona una salida vigente.");
  if (
    lines.some(
      (line) =>
        line.agencyId !== trip.agencyId ||
        line.travelId !== trip.id ||
        line.departureId !== departure.id ||
        line.travelers < 1,
    )
  )
    throw new Error("La selección no corresponde al viaje y salida elegidos.");

  const estimates = lines.map((line) => priceLinePending(line));
  const subtotal = estimates.reduce((sum, item) => sum + item.subtotal, 0);
  const taxes = estimates.reduce((sum, item) => sum + item.taxes, 0);
  const charges = estimates.reduce((sum, item) => sum + item.extrasTotal, 0);
  const total = estimates.reduce((sum, item) => sum + item.total, 0);
  const travelers = lines.reduce((sum, line) => sum + line.travelers, 0);
  const starting = getTripDisplayStartingPrice({ trip, departure });
  const deposit = resolveDepositAmount({
    policy:
      departure.depositPolicy ??
      departure.pricing?.pricingOverrides?.depositPolicy ??
      trip.depositPolicy,
    total,
    fallbackPerTraveler: trip.basePrice.depositAmount ?? starting.amount,
    travelers,
  });

  return {
    subtotal,
    taxes,
    charges,
    total,
    deposit,
    currency: trip.basePrice.currency,
  };
}

export function lavellaCartHref(search: string, tenant: string) {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  params.set("tenant", tenant);
  params.set("theme", "lavella");
  return `/carrito?${params.toString()}`;
}

export function createLavellaCartTransition({
  agency,
  trip,
  departureId,
  adults,
  minors,
  occupancy,
  incomingLines,
  existingCart,
  search,
}: {
  agency: Agency;
  trip: TravelProduct;
  departureId: string;
  adults: number;
  minors: number;
  occupancy?: TravelPricingOption["occupancy"];
  incomingLines: CartLine[];
  existingCart: CartLine[];
  search: string;
}) {
  if (agency.id !== trip.agencyId)
    throw new Error("El viaje no pertenece a la agencia activa.");
  if (existingCart.some((line) => line.agencyId !== agency.id))
    throw new Error("El carrito pertenece a otra agencia.");
  if (
    new Set(incomingLines.map((line) => line.id)).size !== incomingLines.length
  )
    throw new Error("La selección contiene líneas duplicadas.");

  const departure = trip.departures.find(
    (item) => item.id === departureId && isDepartureBookable(item),
  );
  if (!departure) throw new Error("Selecciona una salida vigente.");
  if (
    !departure.boardingOptions.some(
      (option) => !["sold_out", "disabled"].includes(option.status),
    )
  )
    throw new Error(
      "No hay puntos de abordaje disponibles para esta salida.",
    );

  const categoryFor = (line: CartLine) =>
    trip.pricingOptions.find((rate) => rate.id === line.pricingOptionId)
      ?.occupancy;
  const savedAdults = incomingLines
    .filter((line) => !["child", "infant"].includes(categoryFor(line) ?? ""))
    .reduce((sum, line) => sum + line.travelers, 0);
  const savedMinors = incomingLines
    .filter((line) => categoryFor(line) === "child")
    .reduce((sum, line) => sum + line.travelers, 0);
  if (savedAdults !== adults || savedMinors !== minors)
    throw new Error("Las cantidades del carrito no coinciden con el panel.");
  if (
    trip.accommodationMode === "hotel_occupancy" &&
    (!occupancy ||
      !incomingLines.some((line) => categoryFor(line) === occupancy))
  )
    throw new Error("La ocupación no coincide con la tarifa seleccionada.");

  const cart = [
    ...existingCart.filter(
      (line) =>
        line.agencyId !== agency.id ||
        line.travelId !== trip.id,
    ),
    ...incomingLines,
  ];
  validateCartCurrencies(cart);
  validateDemoFxOrderShape(cart);
  validateCartRoomCapacity(cart);
  if (
    cart.some((line) => line.fxSnapshot || line.paymentAllocation)
  )
    validateFxGroupConsistency(cart);

  const quote = getLavellaBookingQuote({
    trip,
    departureId,
    lines: incomingLines,
  });
  const extraIds = [...new Set(incomingLines.flatMap((line) => line.extraIds))];
  const boardingIds = [
    ...new Set(
      incomingLines.flatMap((line) =>
        line.boardingOptionId ? [line.boardingOptionId] : [],
      ),
    ),
  ];
  const draft: LavellaBookingDraft = {
    travelId: trip.id,
    travelCode: trip.code,
    departureId: departure.id,
    departureStartDate: departure.startDate,
    adults,
    children: minors,
    ...(trip.accommodationMode === "hotel_occupancy"
      ? { rooms: 1, occupancy }
      : {}),
    boardingOptionId: boardingIds.length === 1 ? boardingIds[0] : null,
    extraIds,
    total: quote.total,
    deposit: quote.deposit,
    currency: quote.currency,
    tenant: agency.slug,
    theme: "lavella",
  };

  return {
    cart,
    draft,
    href: lavellaCartHref(search, agency.slug),
    quote,
  };
}
