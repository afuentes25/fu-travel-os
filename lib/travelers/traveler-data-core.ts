import { isCustomerReservationUuid } from "@/lib/customers/customer-reservation-detail-core";
import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";

export type ReservationTravelerData = Readonly<{
  position: number;
  travelerType: "adult" | "minor";
  status: "pending" | "complete";
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
}>;

export type ReservationTravelerDataRow = Readonly<{
  position: number;
  traveler_type: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
}>;

export type GetReservationTravelerDataInput = Readonly<{
  requestedAgencySlug?: string;
  reservationId: string;
}>;

export type GetReservationTravelerDataResult =
  | Readonly<{ status: "authorized"; travelers: readonly ReservationTravelerData[] }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>;

export type SaveReservationTravelerDataInput = Readonly<{
  requestedAgencySlug?: string;
  reservationId: string;
  position: number;
  firstName: unknown;
  lastName: unknown;
  birthDate: unknown;
}>;

export type TravelerDataValidationErrors = Readonly<{
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  position?: string;
}>;

export type SaveReservationTravelerDataResult =
  | Readonly<{ status: "saved"; traveler: ReservationTravelerData }>
  | Readonly<{ status: "invalid"; errors: TravelerDataValidationErrors }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>;

export interface TravelerDataRepositoryClient {
  listAuthorized(input: Readonly<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
  }>): Promise<readonly ReservationTravelerDataRow[] | null>;
  updateAuthorized(input: Readonly<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
    position: number;
    firstName: string;
    lastName: string;
    birthDate: string;
  }>): Promise<ReservationTravelerDataRow | null>;
}

export class TravelerDataError extends Error {
  readonly name = "TravelerDataError";

  constructor() {
    super("No fue posible guardar los datos del viajero.");
  }
}

function projectTraveler(row: ReservationTravelerDataRow): ReservationTravelerData | null {
  if (!Number.isInteger(row.position) || row.position <= 0) return null;
  if (row.traveler_type !== "adult" && row.traveler_type !== "minor") return null;
  if (row.status !== "pending" && row.status !== "complete") return null;
  return {
    position: row.position,
    travelerType: row.traveler_type,
    status: row.status,
    firstName: typeof row.first_name === "string" && row.first_name.trim() ? row.first_name : null,
    lastName: typeof row.last_name === "string" && row.last_name.trim() ? row.last_name : null,
    birthDate: typeof row.birth_date === "string" && row.birth_date ? row.birth_date : null,
  };
}

function publicAccessStatus(access: CustomerAgencyAccess): Exclude<
  GetReservationTravelerDataResult,
  Readonly<{ status: "authorized"; travelers: readonly ReservationTravelerData[] }>
> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

function normalizeRequiredText(
  value: unknown,
  maximum: number,
  message: string,
) {
  if (typeof value !== "string") return { value: null, error: message };
  const normalized = value.trim();
  return normalized.length >= 1 && normalized.length <= maximum
    ? { value: normalized, error: undefined }
    : { value: null, error: message };
}

function normalizeBirthDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { value: null, error: "Ingresa una fecha de nacimiento válida." };
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { value: null, error: "Ingresa una fecha de nacimiento válida." };
  }
  const today = new Date();
  const todayIso = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  )).toISOString().slice(0, 10);
  const earliestIso = new Date(Date.UTC(
    today.getUTCFullYear() - 125,
    today.getUTCMonth(),
    today.getUTCDate(),
  )).toISOString().slice(0, 10);
  if (value > todayIso || value < earliestIso) {
    return { value: null, error: "Ingresa una fecha de nacimiento plausible." };
  }
  return { value, error: undefined };
}

export function validateReservationTravelerData(input: Pick<
  SaveReservationTravelerDataInput,
  "position" | "firstName" | "lastName" | "birthDate"
>) {
  const firstName = normalizeRequiredText(input.firstName, 100, "Ingresa el nombre o los nombres.");
  const lastName = normalizeRequiredText(input.lastName, 150, "Ingresa los apellidos.");
  const birthDate = normalizeBirthDate(input.birthDate);
  const errors: TravelerDataValidationErrors = {
    ...(firstName.error ? { firstName: firstName.error } : {}),
    ...(lastName.error ? { lastName: lastName.error } : {}),
    ...(birthDate.error ? { birthDate: birthDate.error } : {}),
    ...(!Number.isInteger(input.position) || input.position <= 0
      ? { position: "El viajero solicitado no es válido." }
      : {}),
  };
  return Object.keys(errors).length
    ? { errors }
    : {
        value: {
          position: input.position,
          firstName: firstName.value as string,
          lastName: lastName.value as string,
          birthDate: birthDate.value as string,
        },
      };
}

function scopeFrom(access: Extract<CustomerAgencyAccess, { status: "authorized" }>, reservationId: string) {
  return {
    customerAccountId: access.account.customerAccountId,
    agencyId: access.account.agencyId,
    reservationId,
  };
}

/** Resolves customer access before either reading or exposing operational PII. */
export function createReservationTravelerDataService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: TravelerDataRepositoryClient | (() => TravelerDataRepositoryClient);
}>) {
  const resolve = async (requestedAgencySlug?: string) => {
    try {
      return await dependencies.resolveAccess({
        ...(requestedAgencySlug ? { requestedAgencySlug } : {}),
      });
    } catch {
      throw new TravelerDataError();
    }
  };

  const repository = () => typeof dependencies.repository === "function"
    ? dependencies.repository()
    : dependencies.repository;

  return {
    async get(input: GetReservationTravelerDataInput): Promise<GetReservationTravelerDataResult> {
      if (!isCustomerReservationUuid(input.reservationId)) return { status: "not_found" };
      const access = await resolve(input.requestedAgencySlug);
      const denied = publicAccessStatus(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };

      try {
        const rows = await repository().listAuthorized(scopeFrom(access, input.reservationId));
        if (rows === null) return { status: "not_found" };
        const travelers = rows
          .map(projectTraveler)
          .filter((traveler): traveler is ReservationTravelerData => traveler !== null)
          .sort((left, right) => left.position - right.position);
        return travelers.length === rows.length
          ? { status: "authorized", travelers }
          : { status: "not_found" };
      } catch {
        throw new TravelerDataError();
      }
    },

    async save(input: SaveReservationTravelerDataInput): Promise<SaveReservationTravelerDataResult> {
      const validated = validateReservationTravelerData(input);
      if ("errors" in validated) return { status: "invalid", errors: validated.errors ?? {} };
      if (!isCustomerReservationUuid(input.reservationId)) return { status: "not_found" };
      const access = await resolve(input.requestedAgencySlug);
      const denied = publicAccessStatus(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };

      try {
        const row = await repository().updateAuthorized({
          ...scopeFrom(access, input.reservationId),
          ...validated.value,
        });
        const traveler = row ? projectTraveler(row) : null;
        return traveler ? { status: "saved", traveler } : { status: "not_found" };
      } catch {
        throw new TravelerDataError();
      }
    },
  };
}
