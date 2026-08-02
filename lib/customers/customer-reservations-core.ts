import type { CustomerAgencyAccess, CustomerAgencyAccount } from "./customer-access-core";
import {
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export const CUSTOMER_RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "partially_paid",
  "paid",
  "cancelled",
] as const;

export type CustomerReservationStatus = (typeof CUSTOMER_RESERVATION_STATUSES)[number];

export type CustomerReservationSummary = ReturnType<typeof projectReservationSnapshotOperational>;

export type CustomerReservationListInput = Readonly<{
  requestedAgencySlug?: string;
  status?: string;
  limit?: number;
  offset?: number;
}>;

export type CustomerReservationListResult =
  | Readonly<{
      status: "authorized";
      account: CustomerAgencyAccount;
      items: readonly CustomerReservationSummary[];
      total: number;
      limit: number;
      offset: number;
    }>
  | Readonly<{ status: "selection_required"; accounts: readonly CustomerAgencyAccount[] }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "forbidden" }>;

export interface CustomerReservationRepositoryClient {
  list(input: Readonly<{
    customerAccountId: string;
    agencyId: string;
    status?: CustomerReservationStatus;
    limit: number;
    offset: number;
  }>): Promise<Readonly<{
    rows: readonly ReservationSnapshotProjectionSource[];
    total: number;
  }>>;
}

export class CustomerReservationListError extends Error {
  readonly name = "CustomerReservationListError";

  constructor() {
    super("No fue posible listar las reservaciones.");
  }
}

export function normalizeCustomerReservationStatus(value: string | undefined) {
  return typeof value === "string" &&
    (CUSTOMER_RESERVATION_STATUSES as readonly string[]).includes(value)
    ? (value as CustomerReservationStatus)
    : undefined;
}

export function normalizeCustomerReservationLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value ?? DEFAULT_LIMIT)));
}

export function normalizeCustomerReservationOffset(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value ?? 0));
}

/** Pure customer listing orchestration; authorization always precedes lookup. */
export function createCustomerReservationLister(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  reservationRepository:
    | CustomerReservationRepositoryClient
    | (() => CustomerReservationRepositoryClient);
}>) {
  return {
    async list(input: CustomerReservationListInput = {}): Promise<CustomerReservationListResult> {
      let access: CustomerAgencyAccess;
      try {
        access = await dependencies.resolveAccess({
          ...(input.requestedAgencySlug ? { requestedAgencySlug: input.requestedAgencySlug } : {}),
        });
      } catch {
        throw new CustomerReservationListError();
      }

      if (access.status !== "authorized") return access;

      const status = normalizeCustomerReservationStatus(input.status);
      const limit = normalizeCustomerReservationLimit(input.limit);
      const offset = normalizeCustomerReservationOffset(input.offset);
      try {
        const repository =
          typeof dependencies.reservationRepository === "function"
            ? dependencies.reservationRepository()
            : dependencies.reservationRepository;
        const result = await repository.list({
          customerAccountId: access.account.customerAccountId,
          agencyId: access.account.agencyId,
          ...(status ? { status } : {}),
          limit,
          offset,
        });
        return {
          status: "authorized",
          account: access.account,
          items: [...result.rows]
            .sort((left, right) => right.created_at.localeCompare(left.created_at))
            .map(projectReservationSnapshotOperational),
          total: Math.max(0, result.total),
          limit,
          offset,
        };
      } catch {
        throw new CustomerReservationListError();
      }
    },
  };
}
