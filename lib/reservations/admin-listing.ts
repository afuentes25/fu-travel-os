import type { PersistedAgency } from "@/lib/agencies";
import type { BookingStatus, Currency } from "@/types";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export type AdminReservationListInput = Readonly<{
  agencySlug: string;
  status?: BookingStatus;
  limit?: number;
  offset?: number;
}>;

export type AdminReservationListItem = Readonly<{
  id: string;
  reservationCode: string;
  status: BookingStatus;
  createdAt: string;
  tripCode: string;
  tripName: string;
  departureDate: string;
  boardingPointName: string | null;
  rooms: number | null;
  occupancy: Readonly<{
    adults: number | null;
    minors: number | null;
    totalTravelers: number | null;
  }>;
  currency: Currency;
  total: number | null;
  depositPercent: number | null;
  depositAmount: number | null;
  remainingAmount: number | null;
}>;

export type AdminReservationListRow = Readonly<{
  id: string;
  reservation_code: string;
  status: BookingStatus;
  currency: Currency;
  created_at: string;
  /** JSONB persisted across snapshot schema versions; validate before projecting. */
  snapshot: unknown;
}>;

export interface AdminReservationListRepositoryClient {
  list(input: Readonly<{
    agencyId: string;
    status?: BookingStatus;
    limit: number;
    offset: number;
  }>): Promise<readonly AdminReservationListRow[]>;
}

export type PersistedAgencyResolver = Readonly<{
  findBySlug(slug: string): Promise<PersistedAgency | null>;
}>;

export class AdminReservationListError extends Error {
  readonly name = "AdminReservationListError";

  constructor(readonly kind: "not_found" | "internal") {
    super(
      kind === "not_found"
        ? "La agencia solicitada no existe."
        : "No fue posible listar las reservaciones.",
    );
  }
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit ?? DEFAULT_LIMIT)));
}

function normalizeOffset(offset: number | undefined) {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.floor(offset ?? 0));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalCount(value: unknown): number | null {
  const amount = optionalAmount(value);
  return amount !== null && Number.isInteger(amount) && amount >= 0 ? amount : null;
}

function projectReservation(row: AdminReservationListRow): AdminReservationListItem {
  const snapshot = asRecord(row.snapshot);
  const tour = asRecord(snapshot?.tour);
  const departure = asRecord(snapshot?.departure);
  const boarding = asRecord(snapshot?.boarding);
  const occupancy = asRecord(snapshot?.occupancy);
  const travelers = asRecord(snapshot?.travelers);
  const adults = optionalCount(occupancy?.adults) ?? optionalCount(travelers?.adults);
  const minors = optionalCount(occupancy?.minors) ?? optionalCount(travelers?.minors);
  const totalTravelers =
    optionalCount(occupancy?.totalTravelers) ??
    (adults !== null && minors !== null ? adults + minors : null);

  return {
    id: row.id,
    reservationCode: row.reservation_code,
    status: row.status,
    createdAt: row.created_at,
    tripCode: optionalText(tour?.code) ?? "No disponible",
    tripName: optionalText(tour?.title) ?? "No disponible",
    departureDate: optionalText(departure?.startDate) ?? "No disponible",
    boardingPointName: optionalText(boarding?.pointName),
    rooms: optionalCount(snapshot?.rooms),
    occupancy: {
      adults,
      minors,
      totalTravelers,
    },
    currency: row.currency,
    total: optionalAmount(snapshot?.total),
    depositPercent: optionalAmount(snapshot?.depositPercent),
    depositAmount: optionalAmount(snapshot?.depositAmount),
    remainingAmount: optionalAmount(snapshot?.remainingAmount),
  };
}

/** Pure listing orchestration; tests inject both trusted dependencies. */
export function createAdminReservationListing(dependencies: Readonly<{
  agencyResolver: PersistedAgencyResolver;
  reservationClient: AdminReservationListRepositoryClient;
}>) {
  return {
    async list(input: AdminReservationListInput) {
      let agency: PersistedAgency | null;
      try {
        agency = await dependencies.agencyResolver.findBySlug(
          input.agencySlug.trim(),
        );
      } catch {
        throw new AdminReservationListError("internal");
      }
      if (!agency) throw new AdminReservationListError("not_found");

      try {
        const rows = await dependencies.reservationClient.list({
          agencyId: agency.id,
          ...(input.status ? { status: input.status } : {}),
          limit: normalizeLimit(input.limit),
          offset: normalizeOffset(input.offset),
        });
        return [...rows]
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .map(projectReservation);
      } catch {
        throw new AdminReservationListError("internal");
      }
    },
  };
}
