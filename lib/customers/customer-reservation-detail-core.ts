import type { Currency } from "@/types";
import {
  asSnapshotRecord,
  optionalSnapshotCount,
  optionalSnapshotText,
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";

import type { CustomerAgencyAccess, CustomerAgencyAccount } from "./customer-access-core";

export type CustomerReservationDetailInput = Readonly<{
  requestedAgencySlug?: string;
  reservationId: string;
}>;

export type CustomerReservationDetailRow = ReservationSnapshotProjectionSource;

export type CustomerReservationDetail = Readonly<{
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
  travelers: readonly Readonly<{
    category: string | null;
    fullName: string | null;
    age: number | null;
    status: string | null;
  }>[];
  primaryContact: Readonly<{
    fullName: string | null;
    email: string | null;
    phone: string | null;
  }> | null;
}>;

export type CustomerReservationDetailResult =
  | Readonly<{ status: "authorized"; account: CustomerAgencyAccount; reservation: CustomerReservationDetail }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "selection_required"; accounts: readonly CustomerAgencyAccount[] }>;

export interface CustomerReservationDetailRepositoryClient {
  find(input: Readonly<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
  }>): Promise<CustomerReservationDetailRow | null>;
}

export class CustomerReservationDetailError extends Error {
  readonly name = "CustomerReservationDetailError";

  constructor() {
    super("No fue posible cargar la reservación.");
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCustomerReservationUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function projectContact(snapshot: Record<string, unknown> | null) {
  const contact =
    asSnapshotRecord(snapshot?.primaryContact) ??
    asSnapshotRecord(snapshot?.contact) ??
    asSnapshotRecord(snapshot?.holder);
  if (!contact) return null;

  const firstName = optionalSnapshotText(contact.firstName);
  const lastName = optionalSnapshotText(contact.lastName);
  const names = [firstName, lastName].filter(Boolean).join(" ");
  const fullName = optionalSnapshotText(contact.fullName) ?? optionalSnapshotText(contact.name) ?? (names || null);
  const email = optionalSnapshotText(contact.email);
  const phone = optionalSnapshotText(contact.phone);
  return fullName || email || phone ? { fullName, email, phone } : null;
}

function projectTravelers(snapshot: Record<string, unknown> | null) {
  const travelers = asSnapshotRecord(snapshot?.travelers);
  const drafts = Array.isArray(travelers?.drafts) ? travelers.drafts : [];
  return drafts.flatMap((draft) => {
    const traveler = asSnapshotRecord(draft);
    return traveler
      ? [{
          category: optionalSnapshotText(traveler.category),
          fullName: optionalSnapshotText(traveler.fullName),
          age: optionalSnapshotCount(traveler.age),
          status: optionalSnapshotText(traveler.completionStatus),
        }]
      : [];
  });
}

/** Projects personal fields only after the linked customer account is authorized. */
export function projectCustomerReservationDetail(
  row: CustomerReservationDetailRow,
): CustomerReservationDetail {
  const operational = projectReservationSnapshotOperational(row);
  const snapshot = asSnapshotRecord(row.snapshot);
  return {
    ...operational,
    travelers: projectTravelers(snapshot),
    primaryContact: projectContact(snapshot),
  };
}

/** Pure orchestration: resolve active customer access before any snapshot lookup. */
export function createCustomerReservationDetail(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: CustomerReservationDetailRepositoryClient | (() => CustomerReservationDetailRepositoryClient);
}>) {
  return {
    async get(input: CustomerReservationDetailInput): Promise<CustomerReservationDetailResult> {
      if (!isCustomerReservationUuid(input.reservationId)) return { status: "not_found" };

      let access: CustomerAgencyAccess;
      try {
        access = await dependencies.resolveAccess({
          ...(input.requestedAgencySlug ? { requestedAgencySlug: input.requestedAgencySlug } : {}),
        });
      } catch {
        throw new CustomerReservationDetailError();
      }
      if (access.status !== "authorized") return access;

      try {
        const repository = typeof dependencies.repository === "function"
          ? dependencies.repository()
          : dependencies.repository;
        const row = await repository.find({
          customerAccountId: access.account.customerAccountId,
          agencyId: access.account.agencyId,
          reservationId: input.reservationId,
        });
        return row
          ? { status: "authorized", account: access.account, reservation: projectCustomerReservationDetail(row) }
          : { status: "not_found" };
      } catch {
        throw new CustomerReservationDetailError();
      }
    },
  };
}
