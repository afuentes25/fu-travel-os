import type { PersistedAgency } from "@/lib/agencies";
import type { BookingStatus, Currency } from "@/types";

import type { ReservationSnapshot } from "./index";

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

export type AdminReservationListRow = Readonly<{
  id: string;
  reservation_code: string;
  status: BookingStatus;
  currency: Currency;
  created_at: string;
  snapshot: ReservationSnapshot;
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

function projectReservation(row: AdminReservationListRow): AdminReservationListItem {
  const { snapshot } = row;
  return {
    id: row.id,
    reservationCode: row.reservation_code,
    status: row.status,
    createdAt: row.created_at,
    tripCode: snapshot.tour.code,
    tripName: snapshot.tour.title,
    departureDate: snapshot.departure.startDate,
    boardingPointName: snapshot.boarding.pointName,
    rooms: snapshot.rooms,
    occupancy: {
      adults: snapshot.occupancy.adults,
      minors: snapshot.occupancy.minors,
      totalTravelers: snapshot.occupancy.totalTravelers,
    },
    currency: snapshot.currency,
    total: snapshot.total,
    depositPercent: snapshot.depositPercent,
    depositAmount: snapshot.depositAmount,
    remainingAmount: snapshot.remainingAmount,
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
