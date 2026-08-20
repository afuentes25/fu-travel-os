import { isCustomerReservationUuid } from "@/lib/customers/customer-reservation-detail-core";
import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";
import {
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";
import { fromMinorUnits, toMinorUnits } from "@/lib/fx";
import type { Currency } from "@/types";

export type ReservationPaymentFinancialRow = Readonly<{
  amount: number;
  currency: string;
  status: string;
}>;

export type ReservationFinancialSummary = Readonly<{
  currency: Currency;
  contract: Readonly<{
    total: number;
    depositPercent: number | null;
    depositRequired: number | null;
  }>;
  payments: Readonly<{
    confirmedTotal: number;
    pendingTotal: number;
    cancelledTotal: number;
    confirmedCount: number;
  }>;
  balance: Readonly<{
    remaining: number;
    paidPercent: number;
    depositCovered: boolean | null;
    fullyPaid: boolean;
  }>;
}>;

export type GetReservationFinancialSummaryInput = Readonly<{
  requestedAgencySlug?: string;
  reservationId: string;
}>;

export type GetReservationFinancialSummaryResult =
  | Readonly<{ status: "authorized"; summary: ReservationFinancialSummary }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "invalid_structure" }>;

export interface ReservationFinancialRepositoryClient {
  findAuthorized(input: Readonly<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
  }>): Promise<Readonly<{
    snapshot: ReservationSnapshotProjectionSource;
    payments: readonly ReservationPaymentFinancialRow[];
  }> | null>;
}

export class ReservationFinancialError extends Error {
  readonly name = "ReservationFinancialError";

  constructor() {
    super("No fue posible calcular el resumen financiero de la reservación.");
  }
}

function isCurrency(value: unknown): value is Currency {
  return value === "MXN" || value === "USD";
}

function amountMinor(value: number, currency: Currency) {
  return Number.isFinite(value) && value >= 0
    ? toMinorUnits(value, currency)
    : null;
}

function publicAccessStatus(access: CustomerAgencyAccess): Exclude<
  GetReservationFinancialSummaryResult,
  Readonly<{ status: "authorized"; summary: ReservationFinancialSummary }>
> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

/** Pure cent-based aggregation. Pending and cancelled amounts never affect balance. */
export function calculateReservationFinancialSummary(input: Readonly<{
  snapshot: ReservationSnapshotProjectionSource;
  payments: readonly ReservationPaymentFinancialRow[];
}>): ReservationFinancialSummary | null {
  const projected = projectReservationSnapshotOperational(input.snapshot);
  const currency = projected.amounts.currency;
  if (!isCurrency(currency)) return null;
  const contractTotalMinor = projected.amounts.total === null
    ? null
    : amountMinor(projected.amounts.total, currency);
  if (contractTotalMinor === null || contractTotalMinor <= 0) return null;
  const depositRequiredMinor = projected.amounts.depositAmount === null
    ? null
    : amountMinor(projected.amounts.depositAmount, currency);
  if (depositRequiredMinor !== null && depositRequiredMinor < 0) return null;

  const totals = { confirmed: 0, pending: 0, cancelled: 0, confirmedCount: 0 };
  for (const payment of input.payments) {
    if (payment.currency !== currency) return null;
    const minor = amountMinor(payment.amount, currency);
    if (minor === null || minor <= 0) return null;
    if (payment.status === "confirmed") {
      totals.confirmed += minor;
      totals.confirmedCount += 1;
    } else if (payment.status === "pending") {
      totals.pending += minor;
    } else if (payment.status === "cancelled") {
      totals.cancelled += minor;
    } else {
      return null;
    }
  }

  const remainingMinor = Math.max(contractTotalMinor - totals.confirmed, 0);
  return {
    currency,
    contract: {
      total: fromMinorUnits(contractTotalMinor, currency),
      depositPercent: projected.amounts.depositPercent,
      depositRequired: depositRequiredMinor === null ? null : fromMinorUnits(depositRequiredMinor, currency),
    },
    payments: {
      confirmedTotal: fromMinorUnits(totals.confirmed, currency),
      pendingTotal: fromMinorUnits(totals.pending, currency),
      cancelledTotal: fromMinorUnits(totals.cancelled, currency),
      confirmedCount: totals.confirmedCount,
    },
    balance: {
      remaining: fromMinorUnits(remainingMinor, currency),
      paidPercent: Math.round((totals.confirmed * 10000) / contractTotalMinor) / 100,
      depositCovered: depositRequiredMinor === null ? null : totals.confirmed >= depositRequiredMinor,
      fullyPaid: totals.confirmed >= contractTotalMinor,
    },
  };
}

/** Customer-only orchestration; authorization completes before payment access. */
export function createReservationFinancialSummaryService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: ReservationFinancialRepositoryClient | (() => ReservationFinancialRepositoryClient);
}>) {
  return {
    async get(input: GetReservationFinancialSummaryInput): Promise<GetReservationFinancialSummaryResult> {
      if (!isCustomerReservationUuid(input.reservationId)) return { status: "not_found" };
      let access: CustomerAgencyAccess;
      try {
        access = await dependencies.resolveAccess({
          ...(input.requestedAgencySlug ? { requestedAgencySlug: input.requestedAgencySlug } : {}),
        });
      } catch {
        throw new ReservationFinancialError();
      }
      const denied = publicAccessStatus(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };

      try {
        const repository = typeof dependencies.repository === "function"
          ? dependencies.repository()
          : dependencies.repository;
        const record = await repository.findAuthorized({
          customerAccountId: access.account.customerAccountId,
          agencyId: access.account.agencyId,
          reservationId: input.reservationId,
        });
        if (!record) return { status: "not_found" };
        const summary = calculateReservationFinancialSummary(record);
        return summary ? { status: "authorized", summary } : { status: "invalid_structure" };
      } catch {
        throw new ReservationFinancialError();
      }
    },
  };
}
