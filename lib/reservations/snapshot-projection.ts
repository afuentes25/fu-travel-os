import type { Currency } from "@/types";

export type ReservationSnapshotProjectionSource = Readonly<{
  id: string;
  reservation_code: string;
  status: string;
  currency: Currency;
  created_at: string;
  snapshot: unknown;
}>;

export type ReservationSnapshotOperationalProjection = Readonly<{
  id: string;
  reservationCode: string;
  status: string;
  createdAt: string;
  trip: Readonly<{
    code: string | null;
    name: string | null;
    departureDate: string | null;
    boardingPointName: string | null;
  }>;
  occupancy: Readonly<{
    rooms: number | null;
    adults: number | null;
    minors: number | null;
    totalTravelers: number | null;
  }>;
  amounts: Readonly<{
    currency: Currency;
    total: number | null;
    depositPercent: number | null;
    depositAmount: number | null;
    remainingAmount: number | null;
  }>;
  travelerDataStatus: string | null;
}>;

export function asSnapshotRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function optionalSnapshotText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function optionalSnapshotAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function optionalSnapshotCount(value: unknown): number | null {
  const amount = optionalSnapshotAmount(value);
  return amount !== null && Number.isInteger(amount) && amount >= 0 ? amount : null;
}

/** Validates historical JSONB and exposes only operational, non-PII fields. */
export function projectReservationSnapshotOperational(
  row: ReservationSnapshotProjectionSource,
): ReservationSnapshotOperationalProjection {
  const snapshot = asSnapshotRecord(row.snapshot);
  const tour = asSnapshotRecord(snapshot?.tour);
  const departure = asSnapshotRecord(snapshot?.departure);
  const boarding = asSnapshotRecord(snapshot?.boarding);
  const occupancy = asSnapshotRecord(snapshot?.occupancy);
  const travelers = asSnapshotRecord(snapshot?.travelers);
  const adults = optionalSnapshotCount(occupancy?.adults) ?? optionalSnapshotCount(travelers?.adults);
  const minors = optionalSnapshotCount(occupancy?.minors) ?? optionalSnapshotCount(travelers?.minors);
  const totalTravelers = optionalSnapshotCount(occupancy?.totalTravelers) ?? (adults !== null && minors !== null ? adults + minors : null);

  return {
    id: row.id,
    reservationCode: row.reservation_code,
    status: row.status,
    createdAt: row.created_at,
    trip: {
      code: optionalSnapshotText(tour?.code),
      name: optionalSnapshotText(tour?.title) ?? optionalSnapshotText(tour?.name),
      departureDate: optionalSnapshotText(departure?.startDate),
      boardingPointName: optionalSnapshotText(boarding?.pointName),
    },
    occupancy: { rooms: optionalSnapshotCount(snapshot?.rooms), adults, minors, totalTravelers },
    amounts: {
      currency: row.currency,
      total: optionalSnapshotAmount(snapshot?.total),
      depositPercent: optionalSnapshotAmount(snapshot?.depositPercent),
      depositAmount: optionalSnapshotAmount(snapshot?.depositAmount),
      remainingAmount: optionalSnapshotAmount(snapshot?.remainingAmount),
    },
    travelerDataStatus: optionalSnapshotText(travelers?.status),
  };
}
