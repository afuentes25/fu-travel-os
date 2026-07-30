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
  travelers: Readonly<{
    status: TravelerDataStatus;
    adults: number;
    minors: number;
    drafts: readonly TravelerDraft[];
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
  travelers: {
    status: TravelerDataStatus;
    adults: number;
    minors: number;
    drafts: TravelerDraft[];
  };
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
      travelers: input.travelers,
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
