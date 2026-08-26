import type {
  Agency,
  BookingBoardingSnapshot,
  BookingStatus,
  Currency,
  FxConsent,
  FxSnapshot,
  PaymentAllocation,
  TravelerDataStatus,
  TravelerDraft,
  TravelTheme,
} from "@/types";

export const RESERVATION_STORAGE_KEY = "fu-travel-reservations";

export type ReservationSnapshot = Readonly<{
  id: string;
  idempotencyKey: string;
  reservationCode: string;
  agency: Readonly<{ id: string; name: string; whatsapp: string }>;
  tenant: string;
  theme: TravelTheme;
  tour: Readonly<{ id: string; code: string; title: string }>;
  departure: Readonly<{ id: string; startDate: string }>;
  boarding: BookingBoardingSnapshot;
  primaryContact?: Readonly<{
    firstName: string;
    lastName: string | null;
    email: string;
    phone: string | null;
  }>;
  travelers: Readonly<{
    status: TravelerDataStatus;
    adults: number;
    minors: number;
    drafts: readonly TravelerDraft[];
  }>;
  rooms: number;
  occupancy: Readonly<{
    adults: number;
    minors: number;
    totalTravelers: number;
  }>;
  currency: Currency;
  fx?: Readonly<{
    snapshot?: FxSnapshot;
    allocation?: PaymentAllocation;
    consent?: FxConsent;
  }>;
  total: number;
  depositPercent: number;
  depositAmount: number;
  remainingAmount: number;
  createdAt: string;
  status: BookingStatus;
}>;

export type ReservationSnapshotInput = {
  idempotencyKey: string;
  agency: Agency;
  theme: TravelTheme;
  tour: { id: string; code: string; title: string };
  departure: { id: string; startDate: string };
  boarding: BookingBoardingSnapshot;
  primaryContact?: {
    firstName: string;
    lastName: string | null;
    email: string;
    phone: string | null;
  };
  travelers: {
    status: TravelerDataStatus;
    adults: number;
    minors: number;
    drafts: TravelerDraft[];
  };
  rooms?: number;
  currency: Currency;
  fx?: {
    snapshot?: FxSnapshot;
    allocation?: PaymentAllocation;
    consent?: FxConsent;
  };
  total: number;
  depositPercent: number;
  depositAmount: number;
  remainingAmount: number;
};

export type ReservationSnapshotPersistenceInput = Readonly<{
  agencyId: string;
  idempotencyKey: string;
  snapshot: ReservationSnapshot;
}>;

export type PersistedReservationSnapshot = Readonly<{
  agencyId: string;
  idempotencyKey: string;
  reservationCode: string;
  status: BookingStatus;
  currency: Currency;
  snapshot: ReservationSnapshot;
}>;

/** A deliberately small port so persistence can be tested without Supabase. */
export interface ReservationSnapshotRepositoryClient {
  findByIdempotency(input: Readonly<{
    agencyId: string;
    idempotencyKey: string;
  }>): Promise<PersistedReservationSnapshot | null>;
  findByReservationCode(input: Readonly<{
    agencyId: string;
    reservationCode: string;
  }>): Promise<PersistedReservationSnapshot | null>;
  insert(
    snapshot: PersistedReservationSnapshot,
  ): Promise<PersistedReservationSnapshot>;
}

export type ReservationSnapshotConflictKind =
  | "idempotency"
  | "reservation_code";

export class ReservationSnapshotConflictError extends Error {
  readonly name = "ReservationSnapshotConflictError";

  constructor(readonly kind: ReservationSnapshotConflictKind) {
    super(
      kind === "idempotency"
        ? "La solicitud de reservación no coincide con el intento anterior."
        : "El folio de reservación ya existe.",
    );
  }
}

export class ReservationSnapshotRepositoryError extends Error {
  readonly name = "ReservationSnapshotRepositoryError";

  constructor() {
    super("No fue posible guardar la reservación. Intenta nuevamente.");
  }
}

function canonicalReservationValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalReservationValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalReservationValue(child)]),
    );
  }
  return value;
}

function sameReservationSnapshot(
  left: PersistedReservationSnapshot,
  right: PersistedReservationSnapshot,
) {
  // The JSON snapshot keeps its legacy human code in `id`, whereas database
  // reads project the persisted UUID into that field for server-side routing.
  // It is not booking content and must not turn an idempotent retry into a
  // conflict merely because the source changed from JSON to the DB row.
  const { id: _leftSnapshotId, ...leftSnapshot } = left.snapshot;
  const { id: _rightSnapshotId, ...rightSnapshot } = right.snapshot;
  return (
    JSON.stringify(canonicalReservationValue({ ...left, snapshot: leftSnapshot })) ===
    JSON.stringify(canonicalReservationValue({ ...right, snapshot: rightSnapshot }))
  );
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function asPersistedReservationSnapshot(
  input: ReservationSnapshotPersistenceInput,
): PersistedReservationSnapshot {
  return {
    agencyId: input.agencyId,
    idempotencyKey: input.idempotencyKey,
    reservationCode: input.snapshot.reservationCode,
    status: input.snapshot.status,
    currency: input.snapshot.currency,
    snapshot: input.snapshot,
  };
}

/**
 * Idempotent persistence orchestration shared by the server adapter and unit
 * tests. It neither mutates nor recalculates the immutable checkout snapshot.
 */
export function createReservationSnapshotRepository(
  client: ReservationSnapshotRepositoryClient,
) {
  return {
    async insert(input: ReservationSnapshotPersistenceInput): Promise<{
      reservation: ReservationSnapshot;
      created: boolean;
    }> {
      const candidate = asPersistedReservationSnapshot(input);

      try {
        const existing = await client.findByIdempotency({
          agencyId: input.agencyId,
          idempotencyKey: input.idempotencyKey,
        });
        if (existing) {
          if (!sameReservationSnapshot(existing, candidate)) {
            throw new ReservationSnapshotConflictError("idempotency");
          }
          return { reservation: existing.snapshot, created: false };
        }

        const existingCode = await client.findByReservationCode({
          agencyId: input.agencyId,
          reservationCode: input.snapshot.reservationCode,
        });
        if (existingCode) {
          throw new ReservationSnapshotConflictError("reservation_code");
        }

        const inserted = await client.insert(candidate);
        return { reservation: inserted.snapshot, created: true };
      } catch (error) {
        if (error instanceof ReservationSnapshotConflictError) throw error;

        if (isUniqueViolation(error)) {
          try {
            const existing = await client.findByIdempotency({
              agencyId: input.agencyId,
              idempotencyKey: input.idempotencyKey,
            });
            if (existing) {
              if (!sameReservationSnapshot(existing, candidate)) {
                throw new ReservationSnapshotConflictError("idempotency");
              }
              return { reservation: existing.snapshot, created: false };
            }

            const existingCode = await client.findByReservationCode({
              agencyId: input.agencyId,
              reservationCode: input.snapshot.reservationCode,
            });
            if (existingCode) {
              throw new ReservationSnapshotConflictError("reservation_code");
            }
          } catch (reconciliationError) {
            if (reconciliationError instanceof ReservationSnapshotConflictError) {
              throw reconciliationError;
            }
          }
        }

        throw new ReservationSnapshotRepositoryError();
      }
    },
  };
}

export function formatReservationTravelerSummary(
  travelers: Pick<
    ReservationSnapshot["travelers"],
    "adults" | "minors"
  >,
) {
  const total = travelers.adults + travelers.minors;
  return [
    `${total} ${total === 1 ? "viajero" : "viajeros"}`,
    travelers.adults
      ? `${travelers.adults} ${
          travelers.adults === 1 ? "adulto" : "adultos"
        }`
      : "",
    travelers.minors
      ? `${travelers.minors} ${
          travelers.minors === 1 ? "menor" : "menores"
        }`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

type ReservationStorage = Pick<Storage, "getItem" | "setItem">;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((child) => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStoredReservations(storage: ReservationStorage) {
  try {
    const parsed = JSON.parse(
      storage.getItem(RESERVATION_STORAGE_KEY) ?? "[]",
    ) as ReservationSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function defaultSuffix() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return (uuid ?? `${Date.now()}-${Math.random()}`)
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase()
    .padStart(6, "0");
}

export function reservationCodeDate(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime()))
    throw new Error("La fecha de creación de la reservación no es válida.");
  return `${String(date.getUTCFullYear()).slice(-2)}${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function finalizeReservation({
  storage,
  input,
  now = () => new Date().toISOString(),
  suffix = defaultSuffix,
}: {
  storage: ReservationStorage;
  input: ReservationSnapshotInput;
  now?: () => string;
  suffix?: () => string;
}): { reservation: ReservationSnapshot; created: boolean } {
  const stored = readStoredReservations(storage);
  const existing = stored.find(
    (reservation) => reservation.idempotencyKey === input.idempotencyKey,
  );
  if (existing)
    return {
      reservation: deepFreeze(cloneSnapshot(existing)),
      created: false,
    };

  if (!input.tour.code.trim())
    throw new Error("La clave del tour es obligatoria para reservar.");
  if (input.depositAmount + input.remainingAmount !== input.total)
    throw new Error("El anticipo y el saldo no coinciden con el total.");

  const createdAt = now();
  const datePart = reservationCodeDate(createdAt);
  let reservationCode = "";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${input.tour.code}-${datePart}-${suffix()}`;
    if (!stored.some((reservation) => reservation.reservationCode === candidate)) {
      reservationCode = candidate;
      break;
    }
  }
  if (!reservationCode)
    throw new Error("No fue posible generar un folio único.");

  const reservation = deepFreeze(
    cloneSnapshot({
      id: reservationCode,
      idempotencyKey: input.idempotencyKey,
      reservationCode,
      agency: {
        id: input.agency.id,
        name: input.agency.name,
        whatsapp: input.agency.contact.whatsapp,
      },
      tenant: input.agency.slug,
      theme: input.theme,
      tour: input.tour,
      departure: input.departure,
      boarding: input.boarding,
      ...(input.primaryContact ? { primaryContact: input.primaryContact } : {}),
      travelers: input.travelers,
      rooms: input.rooms ?? 0,
      occupancy: {
        adults: input.travelers.adults,
        minors: input.travelers.minors,
        totalTravelers: input.travelers.adults + input.travelers.minors,
      },
      currency: input.currency,
      ...(input.fx ? { fx: input.fx } : {}),
      total: input.total,
      depositPercent: input.depositPercent,
      depositAmount: input.depositAmount,
      remainingAmount: input.remainingAmount,
      createdAt,
      status: "pending" as const,
    }),
  );

  storage.setItem(
    RESERVATION_STORAGE_KEY,
    JSON.stringify([...stored, reservation]),
  );
  return { reservation, created: true };
}

export function readReservations(
  storage: ReservationStorage,
): readonly ReservationSnapshot[] {
  return deepFreeze(cloneSnapshot(readStoredReservations(storage)));
}
