import type { Currency } from "@/types";
import { deriveTravelerSlotStructure } from "@/lib/travelers/traveler-slots-core";

export type AdminReservationDetailInput = Readonly<{
  agencyId: string;
  reservationId: string;
}>;

export type AdminReservationDetailRow = Readonly<{
  id: string;
  reservation_code: string;
  status: string;
  currency: Currency;
  created_at: string;
  /** JSONB is validated before any operational or personal data is projected. */
  snapshot: unknown;
}>;

export type AdminReservationDetail = Readonly<{
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
  primaryContact: Readonly<{
    fullName: string | null;
    email: string | null;
    phone: string | null;
  }> | null;
  customerAccountLinked: boolean;
  travelers: readonly Readonly<{
    position: number;
    travelerType: "adult" | "minor";
    firstName: string | null;
    lastName: string | null;
    status: "pending" | "complete";
  }>[];
  travelerDataStatus: "pending" | "complete" | "invalid_structure" | null;
}>;

export type AdminReservationTravelerRow = Readonly<{
  position: number;
  traveler_type: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
}>;

export interface AdminReservationDetailRepositoryClient {
  find(input: AdminReservationDetailInput): Promise<AdminReservationDetailRow | null>;
  listTravelers(input: AdminReservationDetailInput): Promise<readonly AdminReservationTravelerRow[]>;
  findPrimaryAccess?(input: AdminReservationDetailInput): Promise<boolean>;
}

export class AdminReservationDetailError extends Error {
  readonly name = "AdminReservationDetailError";

  constructor(readonly kind: "invalid" | "not_found" | "internal") {
    super(
      kind === "invalid" || kind === "not_found"
        ? "La reservación solicitada no está disponible."
        : "No fue posible cargar la reservación.",
    );
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAdminReservationUuid(value: string) {
  return UUID_PATTERN.test(value);
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

function projectContact(snapshot: Record<string, unknown> | null) {
  const contact =
    asRecord(snapshot?.primaryContact) ??
    asRecord(snapshot?.contact) ??
    asRecord(snapshot?.holder);
  if (!contact) return null;

  const firstName = optionalText(contact.firstName);
  const lastName = optionalText(contact.lastName);
  const names = [firstName, lastName].filter(Boolean).join(" ");
  const fullName = optionalText(contact.fullName) ?? optionalText(contact.name) ?? (names || null);
  const email = optionalText(contact.email);
  const phone = optionalText(contact.phone);
  return fullName || email || phone ? { fullName, email, phone } : null;
}

function projectTraveler(row: AdminReservationTravelerRow) {
  if (!Number.isInteger(row.position) || row.position <= 0) return null;
  if (row.traveler_type !== "adult" && row.traveler_type !== "minor") return null;
  if (row.status !== "pending" && row.status !== "complete") return null;
  return {
    position: row.position,
    travelerType: row.traveler_type as "adult" | "minor",
    firstName: optionalText(row.first_name),
    lastName: optionalText(row.last_name),
    status: row.status as "pending" | "complete",
  };
}

function projectTravelers(
  row: AdminReservationDetailRow,
  rows: readonly AdminReservationTravelerRow[],
) {
  const travelers = rows
    .map(projectTraveler)
    .filter((traveler): traveler is NonNullable<ReturnType<typeof projectTraveler>> => traveler !== null)
    .sort((left, right) => left.position - right.position);
  const expected = deriveTravelerSlotStructure(row);
  if (travelers.length !== rows.length) return { travelers, status: "invalid_structure" as const };
  if (!expected) {
    return {
      travelers,
      status: travelers.length
        ? travelers.every((traveler) => traveler.status === "complete") ? "complete" as const : "pending" as const
        : null,
    };
  }
  const byPosition = new Map(travelers.map((traveler) => [traveler.position, traveler]));
  const matchesExpected = travelers.length === expected.length && expected.every((slot) => {
    const traveler = byPosition.get(slot.position);
    return traveler?.travelerType === slot.travelerType;
  });
  if (!matchesExpected) return { travelers, status: "invalid_structure" as const };
  return {
    travelers,
    status: travelers.every((traveler) => traveler.status === "complete") ? "complete" as const : "pending" as const,
  };
}

export function projectAdminReservationDetail(
  row: AdminReservationDetailRow,
  travelerRows: readonly AdminReservationTravelerRow[] = [],
  customerAccountLinked = false,
): AdminReservationDetail {
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
  const projectedTravelers = projectTravelers(row, travelerRows);

  return {
    id: row.id,
    reservationCode: row.reservation_code,
    status: row.status,
    createdAt: row.created_at,
    trip: {
      code: optionalText(tour?.code),
      name: optionalText(tour?.title) ?? optionalText(tour?.name),
      departureDate: optionalText(departure?.startDate),
      boardingPointName: optionalText(boarding?.pointName),
    },
    occupancy: {
      rooms: optionalCount(snapshot?.rooms),
      adults,
      minors,
      totalTravelers,
    },
    amounts: {
      currency: row.currency,
      total: optionalAmount(snapshot?.total),
      depositPercent: optionalAmount(snapshot?.depositPercent),
      depositAmount: optionalAmount(snapshot?.depositAmount),
      remainingAmount: optionalAmount(snapshot?.remainingAmount),
    },
    primaryContact: projectContact(snapshot),
    customerAccountLinked,
    travelers: projectedTravelers.travelers,
    travelerDataStatus: projectedTravelers.status,
  };
}

/** Pure detail orchestration. The injected client is always given both UUIDs. */
export function createAdminReservationDetail(dependencies: Readonly<{
  reservationClient: AdminReservationDetailRepositoryClient;
}>) {
  return {
    async find(input: AdminReservationDetailInput): Promise<AdminReservationDetail> {
      if (!isAdminReservationUuid(input.reservationId)) {
        throw new AdminReservationDetailError("invalid");
      }
      try {
        const row = await dependencies.reservationClient.find(input);
        if (!row) throw new AdminReservationDetailError("not_found");
        const travelers = await dependencies.reservationClient.listTravelers(input);
        const customerAccountLinked = dependencies.reservationClient.findPrimaryAccess ? await dependencies.reservationClient.findPrimaryAccess(input) : false;
        return projectAdminReservationDetail(row, travelers, customerAccountLinked);
      } catch (error) {
        if (error instanceof AdminReservationDetailError) throw error;
        throw new AdminReservationDetailError("internal");
      }
    },
  };
}
