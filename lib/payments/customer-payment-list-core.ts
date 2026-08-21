import { isCustomerReservationUuid } from "@/lib/customers/customer-reservation-detail-core";
import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";
import type { Currency } from "@/types";

export type CustomerPaymentHistoryItem = Readonly<{
  amount: number;
  currency: Currency;
  status: "pending" | "confirmed" | "cancelled";
  method: "transfer" | "cash" | "card" | "payment_link" | "other";
  paidAt: string | null;
  createdAt: string;
}>;

export type CustomerPaymentHistoryResult =
  | Readonly<{ status: "authorized"; payments: readonly CustomerPaymentHistoryItem[] }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>;

export type CustomerPaymentHistoryRow = Readonly<{
  amount: number;
  currency: string;
  status: string;
  method: string;
  paidAt: string | null;
  createdAt: string;
}>;

export interface CustomerPaymentHistoryRepositoryClient {
  findLinkedReservation(input: Readonly<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
  }>): Promise<boolean>;
  listPayments(input: Readonly<{
    agencyId: string;
    reservationId: string;
  }>): Promise<readonly CustomerPaymentHistoryRow[]>;
}

export class CustomerPaymentHistoryError extends Error {
  readonly name = "CustomerPaymentHistoryError";

  constructor() {
    super("No fue posible consultar los pagos de la reservación.");
  }
}

const statuses = ["pending", "confirmed", "cancelled"] as const;
const methods = ["transfer", "cash", "card", "payment_link", "other"] as const;

function isStatus(value: string): value is CustomerPaymentHistoryItem["status"] {
  return (statuses as readonly string[]).includes(value);
}

function isMethod(value: string): value is CustomerPaymentHistoryItem["method"] {
  return (methods as readonly string[]).includes(value);
}

function isCurrency(value: string): value is Currency {
  return value === "MXN" || value === "USD";
}

function sortPayments(rows: readonly CustomerPaymentHistoryRow[]) {
  return [...rows].sort((left, right) => {
    const leftPaidAt = left.paidAt ? new Date(left.paidAt).getTime() : Number.NaN;
    const rightPaidAt = right.paidAt ? new Date(right.paidAt).getTime() : Number.NaN;
    const leftTime = Number.isFinite(leftPaidAt) ? leftPaidAt : new Date(left.createdAt).getTime();
    const rightTime = Number.isFinite(rightPaidAt) ? rightPaidAt : new Date(right.createdAt).getTime();
    if (rightTime !== leftTime) return rightTime - leftTime;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

/** Customer payment history: customer access completes before the linked ledger is queried. */
export function createCustomerPaymentHistoryService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: CustomerPaymentHistoryRepositoryClient | (() => CustomerPaymentHistoryRepositoryClient);
}>) {
  return {
    async list(input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>): Promise<CustomerPaymentHistoryResult> {
      if (!isCustomerReservationUuid(input.reservationId)) return { status: "not_found" };
      let access: CustomerAgencyAccess;
      try {
        access = await dependencies.resolveAccess({ requestedAgencySlug: input.requestedAgencySlug });
      } catch {
        throw new CustomerPaymentHistoryError();
      }
      if (access.status !== "authorized") return access;

      try {
        const repository = typeof dependencies.repository === "function"
          ? dependencies.repository()
          : dependencies.repository;
        const linked = await repository.findLinkedReservation({
          customerAccountId: access.account.customerAccountId,
          agencyId: access.account.agencyId,
          reservationId: input.reservationId,
        });
        if (!linked) return { status: "not_found" };
        const payments = sortPayments(await repository.listPayments({
          agencyId: access.account.agencyId,
          reservationId: input.reservationId,
        })).flatMap((payment): CustomerPaymentHistoryItem[] =>
          Number.isFinite(payment.amount) && isCurrency(payment.currency) && isStatus(payment.status) && isMethod(payment.method)
            ? [{
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status,
                method: payment.method,
                paidAt: payment.paidAt,
                createdAt: payment.createdAt,
              }]
            : [],
        );
        return { status: "authorized", payments };
      } catch {
        throw new CustomerPaymentHistoryError();
      }
    },
  };
}
