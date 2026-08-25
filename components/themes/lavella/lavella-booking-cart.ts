import {
  isDepartureBookable,
  priceLinePending,
  resolveDepositAmount,
  validateCartCurrencies,
  validateCartRoomCapacity,
  validateDemoFxOrderShape,
  validateFxGroupConsistency,
} from "@/lib/pricing";
import type { ReservationSnapshot } from "@/lib/reservations";
import type { ReservationCustomerLinkStatus } from "@/app/api/reservations/route";
import { getTripDisplayStartingPrice } from "@/lib/trip-sections";
import type {
  Agency,
  CartLine,
  Currency,
  TravelProduct,
  TravelPricingOption,
  TravelerDataStatus,
  TravelerDraft,
  BookingBoardingSnapshot,
  TravelTheme,
} from "@/types";

export type LavellaReservationRequest = Readonly<{
  tenantSlug: string;
  tripId: string;
  departureId: string;
  adults: number;
  minors: number;
  rooms: number;
  extraIds: string[];
  boardingPointId: string;
  depositPercent: number;
  primaryContact?: Readonly<{ firstName: string; lastName: string | null; email: string; phone: string | null }>;
  travelers: Readonly<{
    status: TravelerDataStatus;
    drafts: readonly TravelerDraft[];
  }>;
}>;

export type LavellaReservationApiSuccess = Readonly<{
  reservationId: string;
  reservationCode: string;
  status: ReservationSnapshot["status"];
  createdAt: string;
  customerLinkStatus?: ReservationCustomerLinkStatus;
  confirmation: Readonly<{
    tripCode: string;
    tripName: string;
    departureDate: string;
    boardingPointName: string;
    rooms: number;
    occupancy: Readonly<{
      adults: number;
      minors: number;
      totalTravelers: number;
    }>;
    currency: Currency;
    total: number;
    depositPercent: number;
    depositAmount: number;
    remainingAmount: number;
  }>;
}>;

/** Builds the allowlisted API payload: money and server-owned identifiers never leave checkout. */
export function createLavellaReservationRequest({
  tenantSlug,
  tripId,
  departureId,
  adults,
  minors,
  rooms,
  extraIds,
  boardingPointId,
  depositPercent,
  primaryContact,
  travelers,
}: LavellaReservationRequest): LavellaReservationRequest {
  return {
    tenantSlug,
    tripId,
    departureId,
    adults,
    minors,
    rooms,
    extraIds: [...new Set(extraIds)],
    boardingPointId,
    depositPercent,
    primaryContact,
    travelers: {
      status: travelers.status,
      drafts: [...travelers.drafts],
    },
  };
}

/**
 * Adapts the successful server response for the existing confirmation view.
 * Monetary and trip fields always come from the persisted snapshot projection.
 */
export function createLavellaReservationMirror({
  response,
  agency,
  theme,
  idempotencyKey,
  tripId,
  departureId,
  boarding,
  travelers,
  primaryContact,
}: {
  response: LavellaReservationApiSuccess;
  agency: Pick<Agency, "id" | "name" | "contact" | "slug">;
  theme: TravelTheme;
  idempotencyKey: string;
  tripId: string;
  departureId: string;
  boarding: BookingBoardingSnapshot;
  travelers: LavellaReservationRequest["travelers"];
  primaryContact?: LavellaReservationRequest["primaryContact"];
}): ReservationSnapshot {
  const { confirmation } = response;
  return {
    id: response.reservationId,
    idempotencyKey,
    reservationCode: response.reservationCode,
    agency: {
      id: agency.id,
      name: agency.name,
      whatsapp: agency.contact.whatsapp,
    },
    tenant: agency.slug,
    theme,
    tour: {
      id: tripId,
      code: confirmation.tripCode,
      title: confirmation.tripName,
    },
    departure: {
      id: departureId,
      startDate: confirmation.departureDate,
    },
    boarding: {
      ...boarding,
      pointName: confirmation.boardingPointName,
    },
    ...(primaryContact ? { primaryContact } : {}),
    travelers: {
      status: travelers.status,
      adults: confirmation.occupancy.adults,
      minors: confirmation.occupancy.minors,
      drafts: [...travelers.drafts],
    },
    rooms: confirmation.rooms,
    occupancy: confirmation.occupancy,
    currency: confirmation.currency,
    total: confirmation.total,
    depositPercent: confirmation.depositPercent,
    depositAmount: confirmation.depositAmount,
    remainingAmount: confirmation.remainingAmount,
    createdAt: response.createdAt,
    status: response.status,
  };
}

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

export type LavellaTravelerCounts = Readonly<{
  adults: number;
  minors: number;
}>;

export function updateLavellaTravelerCounts({
  current,
  category,
  direction,
  hotel,
}: {
  current: LavellaTravelerCounts;
  category: "adults" | "minors";
  direction: -1 | 1;
  hotel: boolean;
}): LavellaTravelerCounts {
  if (category === "adults") {
    return {
      ...current,
      adults: Math.min(hotel ? 5 : 8, Math.max(1, current.adults + direction)),
    };
  }
  return {
    ...current,
    minors: Math.min(4, Math.max(0, current.minors + direction)),
  };
}

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
