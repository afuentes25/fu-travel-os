import {
  asSnapshotRecord,
  optionalSnapshotCount,
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";
import { isCustomerReservationUuid } from "@/lib/customers/customer-reservation-detail-core";
import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";

export type TravelerSlotType = "adult" | "minor";
export type TravelerSlotStatus = "pending" | "complete";

export type TravelerSlotStructure = Readonly<{
  position: number;
  travelerType: TravelerSlotType;
}>;

export type TravelerSlot = Readonly<{
  id: string;
  position: number;
  travelerType: TravelerSlotType;
  status: TravelerSlotStatus;
}>;

export type ReservationTravelerSlotRow = Readonly<{
  id: string;
  position: number;
  traveler_type: string;
  status: string;
}>;

export type EnsureTravelerSlotsInput = Readonly<{
  requestedAgencySlug?: string;
  reservationId: string;
}>;

export type EnsureTravelerSlotsResult =
  | Readonly<{ status: "ready"; slots: readonly TravelerSlot[] }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "invalid_structure" }>;

export interface TravelerSlotsRepositoryClient {
  findAuthorizedReservation(input: Readonly<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
  }>): Promise<Readonly<{
    snapshot: ReservationSnapshotProjectionSource;
    slots: readonly ReservationTravelerSlotRow[];
  }> | null>;
  insertMissing(input: Readonly<{
    agencyId: string;
    reservationId: string;
    slots: readonly TravelerSlotStructure[];
  }>): Promise<void>;
}

export class TravelerSlotsError extends Error {
  readonly name = "TravelerSlotsError";

  constructor() {
    super("No fue posible preparar los viajeros de la reservación.");
  }
}

/** Produces stable, contractual slots: adults first, then minors. */
export function buildTravelerSlotStructure(input: Readonly<{
  adults: number;
  minors: number;
}>): readonly TravelerSlotStructure[] {
  return [
    ...Array.from({ length: input.adults }, (_, index) => ({
      position: index + 1,
      travelerType: "adult" as const,
    })),
    ...Array.from({ length: input.minors }, (_, index) => ({
      position: input.adults + index + 1,
      travelerType: "minor" as const,
    })),
  ];
}

function explicitSnapshotTotal(snapshot: unknown) {
  const record = asSnapshotRecord(snapshot);
  const occupancy = asSnapshotRecord(record?.occupancy);
  const travelers = asSnapshotRecord(record?.travelers);
  return optionalSnapshotCount(occupancy?.totalTravelers) ??
    optionalSnapshotCount(travelers?.totalTravelers);
}

/** Returns null when the immutable snapshot cannot prove the booked occupancy. */
export function deriveTravelerSlotStructure(
  snapshot: ReservationSnapshotProjectionSource,
): readonly TravelerSlotStructure[] | null {
  const occupancy = projectReservationSnapshotOperational(snapshot).occupancy;
  const { adults, minors, totalTravelers } = occupancy;
  if (adults === null || minors === null || adults < 0 || minors < 0) return null;

  const total = adults + minors;
  if (total <= 0 || (totalTravelers !== null && totalTravelers !== total)) return null;

  const explicitTotal = explicitSnapshotTotal(snapshot.snapshot);
  if (explicitTotal !== null && explicitTotal !== total) return null;

  return buildTravelerSlotStructure({ adults, minors });
}

function projectSlot(row: ReservationTravelerSlotRow): TravelerSlot | null {
  if (!Number.isInteger(row.position) || row.position <= 0) return null;
  if (row.traveler_type !== "adult" && row.traveler_type !== "minor") return null;
  if (row.status !== "pending" && row.status !== "complete") return null;
  return {
    id: row.id,
    position: row.position,
    travelerType: row.traveler_type,
    status: row.status,
  };
}

function matchesStructure(
  rows: readonly ReservationTravelerSlotRow[],
  expected: readonly TravelerSlotStructure[],
) {
  if (rows.length !== expected.length) return false;
  const byPosition = new Map<number, ReservationTravelerSlotRow>();
  for (const row of rows) {
    if (byPosition.has(row.position)) return false;
    byPosition.set(row.position, row);
  }
  return expected.every((slot) => {
    const row = byPosition.get(slot.position);
    return row?.traveler_type === slot.travelerType &&
      (row.status === "pending" || row.status === "complete");
  });
}

function hasIncompatibleExistingSlots(
  rows: readonly ReservationTravelerSlotRow[],
  expected: readonly TravelerSlotStructure[],
) {
  const expectedByPosition = new Map(expected.map((slot) => [slot.position, slot]));
  const seen = new Set<number>();
  return rows.some((row) => {
    const structure = expectedByPosition.get(row.position);
    if (!structure || seen.has(row.position)) return true;
    seen.add(row.position);
    return row.traveler_type !== structure.travelerType ||
      (row.status !== "pending" && row.status !== "complete");
  });
}

function missingSlots(
  rows: readonly ReservationTravelerSlotRow[],
  expected: readonly TravelerSlotStructure[],
) {
  const positions = new Set(rows.map((row) => row.position));
  return expected.filter((slot) => !positions.has(slot.position));
}

/**
 * Authorizes a linked customer before every repository call, derives structure
 * solely from the immutable snapshot and never mutates existing slot fields.
 */
export function createReservationTravelerSlotEnsurer(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: TravelerSlotsRepositoryClient | (() => TravelerSlotsRepositoryClient);
}>) {
  return {
    async ensure(input: EnsureTravelerSlotsInput): Promise<EnsureTravelerSlotsResult> {
      if (!isCustomerReservationUuid(input.reservationId)) return { status: "not_found" };

      let access: CustomerAgencyAccess;
      try {
        access = await dependencies.resolveAccess({
          ...(input.requestedAgencySlug ? { requestedAgencySlug: input.requestedAgencySlug } : {}),
        });
      } catch {
        throw new TravelerSlotsError();
      }

      if (access.status === "unauthenticated") return { status: "unauthenticated" };
      if (access.status === "selection_required") return { status: "selection_required" };
      if (access.status === "forbidden") return { status: "forbidden" };

      const repository = typeof dependencies.repository === "function"
        ? dependencies.repository()
        : dependencies.repository;
      const scope = {
        customerAccountId: access.account.customerAccountId,
        agencyId: access.account.agencyId,
        reservationId: input.reservationId,
      };

      try {
        const existing = await repository.findAuthorizedReservation(scope);
        if (!existing) return { status: "not_found" };

        const expected = deriveTravelerSlotStructure(existing.snapshot);
        if (!expected || hasIncompatibleExistingSlots(existing.slots, expected)) {
          return { status: "invalid_structure" };
        }

        const missing = missingSlots(existing.slots, expected);
        if (missing.length) {
          await repository.insertMissing({
            agencyId: scope.agencyId,
            reservationId: scope.reservationId,
            slots: missing,
          });
        }

        const final = await repository.findAuthorizedReservation(scope);
        if (!final) return { status: "not_found" };
        if (!matchesStructure(final.slots, expected)) return { status: "invalid_structure" };

        const slots = final.slots
          .map(projectSlot)
          .filter((slot): slot is TravelerSlot => slot !== null)
          .sort((left, right) => left.position - right.position);
        return slots.length === expected.length
          ? { status: "ready", slots }
          : { status: "invalid_structure" };
      } catch {
        throw new TravelerSlotsError();
      }
    },
  };
}
