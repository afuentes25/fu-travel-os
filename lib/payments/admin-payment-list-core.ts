import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";
import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";

import {
  calculateReservationFinancialSummary,
  type ReservationFinancialSummary,
  type ReservationPaymentFinancialRow,
} from "./reservation-financial-core";

export type AdminPaymentHistoryRow = Readonly<{
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
  statusChangedAt: string | null;
  source?: string | null;
  hasEvidence?: boolean;
  evidenceMimeType?: "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null;
}>;

export type AdminPaymentHistoryItem = Readonly<{
  /** Reserved for a server action; it is never displayed or placed in a URL. */
  paymentId: string;
  amount: number;
  currency: string;
  status: "pending" | "confirmed" | "cancelled";
  method: "transfer" | "cash" | "card" | "payment_link" | "other";
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
  createdBy: Readonly<{ displayName: string }> | null;
  statusChangedAt: string | null;
  /** Internal UI context; never rendered as a payment field. */
  source: string | null;
  hasEvidence: boolean;
  evidenceMimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null;
}>;

export type AdminPaymentHistoryResult =
  | Readonly<{
      status: "authorized";
      payments: readonly AdminPaymentHistoryItem[];
      financialSummary: ReservationFinancialSummary | null;
    }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>;

export interface AdminPaymentHistoryRepositoryClient {
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<ReservationSnapshotProjectionSource | null>;
  listPayments(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<readonly AdminPaymentHistoryRow[]>;
  findDisplayNames(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

export class AdminPaymentHistoryError extends Error {
  readonly name = "AdminPaymentHistoryError";

  constructor() {
    super("No fue posible consultar los pagos de la reservación.");
  }
}

const paymentStatuses = ["pending", "confirmed", "cancelled"] as const;
const paymentMethods = ["transfer", "cash", "card", "payment_link", "other"] as const;

function isPaymentStatus(value: string): value is AdminPaymentHistoryItem["status"] {
  return (paymentStatuses as readonly string[]).includes(value);
}

function isPaymentMethod(value: string): value is AdminPaymentHistoryItem["method"] {
  return (paymentMethods as readonly string[]).includes(value);
}

function paymentTimestamp(payment: AdminPaymentHistoryRow) {
  const paidAt = payment.paidAt ? new Date(payment.paidAt).getTime() : Number.NaN;
  return Number.isFinite(paidAt) ? paidAt : new Date(payment.createdAt).getTime();
}

function sortPayments(rows: readonly AdminPaymentHistoryRow[]) {
  return [...rows].sort((left, right) => {
    const paidDifference = paymentTimestamp(right) - paymentTimestamp(left);
    if (paidDifference !== 0) return paidDifference;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function accessStatus(access: AdminAgencyAccess): Exclude<AdminPaymentHistoryResult, Readonly<{
  status: "authorized";
  payments: readonly AdminPaymentHistoryItem[];
  financialSummary: ReservationFinancialSummary | null;
}>> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

/** Pure orchestration: membership authorization is completed before any payment query. */
export function createAdminPaymentHistoryService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: AdminPaymentHistoryRepositoryClient | (() => AdminPaymentHistoryRepositoryClient);
}>) {
  return {
    async list(input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>): Promise<AdminPaymentHistoryResult> {
      let access: AdminAgencyAccess;
      try {
        access = await dependencies.resolveAccess({ requestedAgencySlug: input.requestedAgencySlug });
      } catch {
        throw new AdminPaymentHistoryError();
      }
      const denied = accessStatus(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };
      if (!isAdminReservationUuid(input.reservationId)) return { status: "not_found" };

      try {
        const repository = typeof dependencies.repository === "function"
          ? dependencies.repository()
          : dependencies.repository;
        const reservation = await repository.findReservation({
          agencyId: access.agency.agencyId,
          reservationId: input.reservationId,
        });
        if (!reservation) return { status: "not_found" };
        const rows = sortPayments(await repository.listPayments({
          agencyId: access.agency.agencyId,
          reservationId: input.reservationId,
        }));
        const authorIds = [...new Set(rows.flatMap((row) => row.createdByUserId ? [row.createdByUserId] : []))];
        const displayNames = authorIds.length ? await repository.findDisplayNames(authorIds) : new Map<string, string>();
        const payments = rows.flatMap((row): AdminPaymentHistoryItem[] =>
          isPaymentStatus(row.status) && isPaymentMethod(row.method) && Number.isFinite(row.amount)
            ? [{
                paymentId: row.id,
                amount: row.amount,
                currency: row.currency,
                status: row.status,
                method: row.method,
                reference: row.reference,
                paidAt: row.paidAt,
                createdAt: row.createdAt,
                createdBy: row.createdByUserId && displayNames.get(row.createdByUserId)
                  ? { displayName: displayNames.get(row.createdByUserId)! }
                  : null,
                statusChangedAt: row.statusChangedAt,
                source: row.source ?? null,
                hasEvidence: row.hasEvidence === true,
                evidenceMimeType: row.evidenceMimeType ?? null,
              }]
            : [],
        );
        const financialSummary = calculateReservationFinancialSummary({
          snapshot: reservation,
          payments: rows.map(({ amount, currency, status }): ReservationPaymentFinancialRow => ({ amount, currency, status })),
        });
        return { status: "authorized", payments, financialSummary };
      } catch {
        throw new AdminPaymentHistoryError();
      }
    },
  };
}
