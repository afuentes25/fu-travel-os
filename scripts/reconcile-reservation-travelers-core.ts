import type { ReservationSnapshot } from "../lib/reservations";
import {
  projectReservationTravelerMaterialization,
  ReservationTravelerMaterializationError,
  type ReservationTravelerMaterializationRow,
} from "../lib/travelers/traveler-materialization-core";

export const RESERVATION_TRAVELER_RECONCILIATION_CONFIRMATION =
  "RECONCILE-RESERVATION-TRAVELERS";

export type ReservationTravelerReconciliationMode = "dry-run" | "confirmed";

export type HistoricalReservationTravelerRow = Readonly<{
  id: string;
  agency_id: string;
  reservation_id: string;
  position: number;
  traveler_type: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  status: string;
}>;

export type ReservationTravelerReconciliationReservation = Readonly<{
  reservationId: string;
  agencyId: string;
  reservationCode: string;
  snapshot: unknown;
}>;

export type ReservationTravelerReconciliationPlan = Readonly<{
  status: "candidate" | "no_action" | "no_drafts" | "invalid_structure";
  missingSlots: number;
  emptySlots: number;
  pendingWithoutSourceSlots: number;
  preservedSlots: number;
}>;

export function parseReservationTravelerReconciliationArgs(
  args: readonly string[],
): ReservationTravelerReconciliationMode {
  const confirmation = args.find((arg) => arg.startsWith("--confirm="));
  if (!confirmation) return "dry-run";
  if (
    confirmation !==
    `--confirm=${RESERVATION_TRAVELER_RECONCILIATION_CONFIRMATION}`
  ) {
    throw new Error(
      "La confirmación no coincide. No se modificó ningún viajero.",
    );
  }
  return "confirmed";
}

function asSnapshot(snapshot: unknown): ReservationSnapshot | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return null;
  return snapshot as ReservationSnapshot;
}

/** Draft ids are intentionally excluded; only category + sequence map to a slot. */
function draftPositions(snapshot: ReservationSnapshot): Set<number> {
  const positions = new Set<number>();
  for (const draft of snapshot.travelers.drafts) {
    if (
      (draft.category !== "adult" && draft.category !== "minor") ||
      !Number.isInteger(draft.sequence) ||
      draft.sequence < 1
    ) {
      throw new ReservationTravelerMaterializationError();
    }
    const position =
      draft.category === "adult"
        ? draft.sequence
        : snapshot.occupancy.adults + draft.sequence;
    const maximum =
      draft.category === "adult"
        ? snapshot.occupancy.adults
        : snapshot.occupancy.minors;
    if (draft.sequence > maximum || positions.has(position)) {
      throw new ReservationTravelerMaterializationError();
    }
    positions.add(position);
  }
  return positions;
}

function isClearlyEmptyPending(row: HistoricalReservationTravelerRow) {
  return (
    row.status === "pending" &&
    row.first_name === null &&
    row.last_name === null &&
    row.birth_date === null
  );
}

function hasCanonicalTravelerData(row: HistoricalReservationTravelerRow) {
  return (
    row.first_name !== null || row.last_name !== null || row.birth_date !== null
  );
}

/**
 * A pending canonical row is only worth updating when the shared projection
 * adds a real operational value. Empty historical drafts describe a valid
 * pending traveler, not a repair candidate.
 */
export function hasMaterializableTravelerData(
  traveler: ReservationTravelerMaterializationRow,
) {
  return Boolean(
    traveler.firstName?.trim() ||
    traveler.lastName?.trim() ||
    traveler.birthDate ||
    traveler.status !== "pending",
  );
}

/**
 * Read-only plan shared by the command and tests. The desired rows come from
 * the same pure projection used by new reservations; only positions that have
 * an actual historical draft may be repaired.
 */
export function planReservationTravelerReconciliation(
  input: Readonly<{
    reservation: ReservationTravelerReconciliationReservation;
    travelers: readonly HistoricalReservationTravelerRow[];
  }>,
): ReservationTravelerReconciliationPlan {
  const snapshot = asSnapshot(input.reservation.snapshot);
  if (!snapshot?.travelers?.drafts?.length) {
    return {
      status: "no_drafts",
      missingSlots: 0,
      emptySlots: 0,
      pendingWithoutSourceSlots: 0,
      preservedSlots: 0,
    };
  }

  let desired: readonly ReservationTravelerMaterializationRow[];
  let positions: Set<number>;
  try {
    desired = projectReservationTravelerMaterialization(snapshot);
    positions = draftPositions(snapshot);
  } catch {
    return {
      status: "invalid_structure",
      missingSlots: 0,
      emptySlots: 0,
      pendingWithoutSourceSlots: 0,
      preservedSlots: 0,
    };
  }

  const existing = new Map<number, HistoricalReservationTravelerRow>();
  for (const row of input.travelers) {
    if (
      row.agency_id !== input.reservation.agencyId ||
      row.reservation_id !== input.reservation.reservationId ||
      !Number.isInteger(row.position) ||
      existing.has(row.position)
    ) {
      return {
        status: "invalid_structure",
        missingSlots: 0,
        emptySlots: 0,
        pendingWithoutSourceSlots: 0,
        preservedSlots: 0,
      };
    }
    existing.set(row.position, row);
  }

  let missingSlots = 0;
  let emptySlots = 0;
  let pendingWithoutSourceSlots = 0;
  let preservedSlots = 0;
  for (const traveler of desired) {
    if (!positions.has(traveler.position)) continue;
    const row = existing.get(traveler.position);
    if (!row) {
      missingSlots += 1;
      continue;
    }
    if (hasCanonicalTravelerData(row)) {
      preservedSlots += 1;
      continue;
    }
    if (
      row.traveler_type === traveler.travelerType &&
      isClearlyEmptyPending(row)
    ) {
      if (hasMaterializableTravelerData(traveler)) emptySlots += 1;
      else pendingWithoutSourceSlots += 1;
      continue;
    }
    // A non-empty status or incompatible type is historical state we must not
    // reinterpret from the immutable checkout snapshot.
    preservedSlots += 1;
  }

  return {
    status: missingSlots || emptySlots ? "candidate" : "no_action",
    missingSlots,
    emptySlots,
    pendingWithoutSourceSlots,
    preservedSlots,
  };
}
