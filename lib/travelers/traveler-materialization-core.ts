import type { ReservationSnapshot } from "@/lib/reservations";

export type ReservationTravelerMaterializationRow = Readonly<{
  position: number;
  travelerType: "adult" | "minor";
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  status: "pending" | "complete";
}>;

export type MaterializeReservationTravelersInput = Readonly<{
  agencyId: string;
  reservationId: string;
  snapshot: ReservationSnapshot;
}>;

export interface ReservationTravelerMaterializationRepository {
  insertMissing(input: Readonly<{
    agencyId: string;
    reservationId: string;
    travelers: readonly ReservationTravelerMaterializationRow[];
  }>): Promise<void>;
}

export class ReservationTravelerMaterializationError extends Error {
  readonly name = "ReservationTravelerMaterializationError";

  constructor() {
    super("No fue posible preparar los viajeros de la reservación.");
  }
}

function normalizeBirthDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value;
}

/**
 * The checkout currently stores one historical full-name string. Splitting on
 * the final whitespace preserves every character while producing the two
 * operational columns used by reservation_travelers. A single-token name is
 * preserved in first_name without inventing a surname.
 */
export function splitHistoricalTravelerName(value: unknown) {
  if (typeof value !== "string") return { firstName: null, lastName: null };
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? null,
  };
}

/**
 * Converts only the drafts frozen inside this reservation's snapshot. Draft
 * ids are deliberately ignored: they are checkout-local labels, not identity.
 */
export function projectReservationTravelerMaterialization(
  snapshot: ReservationSnapshot,
): readonly ReservationTravelerMaterializationRow[] {
  const adults = snapshot.occupancy.adults;
  const minors = snapshot.occupancy.minors;
  if (
    !Number.isInteger(adults) || adults < 1 ||
    !Number.isInteger(minors) || minors < 0 ||
    snapshot.occupancy.totalTravelers !== adults + minors ||
    snapshot.travelers.adults !== adults ||
    snapshot.travelers.minors !== minors
  ) {
    throw new ReservationTravelerMaterializationError();
  }

  const drafts = new Map<string, ReservationSnapshot["travelers"]["drafts"][number]>();
  for (const draft of snapshot.travelers.drafts) {
    const key = `${draft.category}:${draft.sequence}`;
    if (
      !Number.isInteger(draft.sequence) || draft.sequence < 1 ||
      drafts.has(key)
    ) {
      throw new ReservationTravelerMaterializationError();
    }
    drafts.set(key, draft);
  }

  return Array.from({ length: adults + minors }, (_, index) => {
    const position = index + 1;
    const travelerType = position <= adults ? "adult" as const : "minor" as const;
    const sequence = travelerType === "adult" ? position : position - adults;
    const draft = drafts.get(`${travelerType}:${sequence}`);
    const name = splitHistoricalTravelerName(draft?.fullName);
    const birthDate = normalizeBirthDate(draft?.birthDate);
    const complete =
      snapshot.travelers.status === "complete" &&
      draft?.completionStatus === "complete" &&
      Boolean(name.firstName);
    return {
      position,
      travelerType,
      firstName: name.firstName,
      lastName: name.lastName,
      birthDate,
      status: complete ? "complete" as const : "pending" as const,
    };
  });
}

export function createReservationTravelerMaterializer(dependencies: Readonly<{
  repository: ReservationTravelerMaterializationRepository | (() => ReservationTravelerMaterializationRepository);
}>) {
  return {
    async materialize(input: MaterializeReservationTravelersInput) {
      if (input.snapshot.id !== input.reservationId) {
        throw new ReservationTravelerMaterializationError();
      }
      const travelers = projectReservationTravelerMaterialization(input.snapshot);
      const repository = typeof dependencies.repository === "function"
        ? dependencies.repository()
        : dependencies.repository;
      try {
        await repository.insertMissing({
          agencyId: input.agencyId,
          reservationId: input.reservationId,
          travelers,
        });
      } catch {
        throw new ReservationTravelerMaterializationError();
      }
      return travelers;
    },
  };
}
