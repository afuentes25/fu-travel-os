import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";

export type RevokePaymentReceiptInput = Readonly<{
  requestedAgencySlug: unknown;
  reservationId: unknown;
  paymentId: unknown;
}>;

export type RevokePaymentReceiptResult =
  | Readonly<{ status: "revoked" }>
  | Readonly<{ status: "already_revoked" | "no_receipt" }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "payment_not_cancelled" }>;

export interface PaymentReceiptRevocationRepositoryClient {
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<boolean>;
  findPayment(input: Readonly<{
    agencyId: string;
    reservationId: string;
    paymentId: string;
  }>): Promise<Readonly<{ status: string }> | null>;
  revokeAvailableReceipts(input: Readonly<{
    agencyId: string;
    reservationId: string;
    paymentId: string;
  }>): Promise<number>;
  hasReceipt(input: Readonly<{
    agencyId: string;
    reservationId: string;
    paymentId: string;
  }>): Promise<boolean>;
}

export class PaymentReceiptRevocationError extends Error {
  readonly name = "PaymentReceiptRevocationError";

  constructor() {
    super("No fue posible actualizar el comprobante de pago.");
  }
}

function accessStatus(access: AdminAgencyAccess): Exclude<
  RevokePaymentReceiptResult,
  Readonly<{ status: "revoked" }>
  | Readonly<{ status: "already_revoked" | "no_receipt" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "payment_not_cancelled" }>
> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

/** Revokes metadata only; the private PDF remains immutable in Storage for audit history. */
export function createPaymentReceiptRevocationService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: PaymentReceiptRevocationRepositoryClient | (() => PaymentReceiptRevocationRepositoryClient);
}>) {
  return {
    async revoke(input: RevokePaymentReceiptInput): Promise<RevokePaymentReceiptResult> {
      let access: AdminAgencyAccess;
      try {
        access = await dependencies.resolveAccess({
          requestedAgencySlug: typeof input.requestedAgencySlug === "string"
            ? input.requestedAgencySlug
            : undefined,
        });
      } catch {
        throw new PaymentReceiptRevocationError();
      }
      const denied = accessStatus(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };
      if (typeof input.reservationId !== "string" || !isAdminReservationUuid(input.reservationId)
        || typeof input.paymentId !== "string" || !isAdminReservationUuid(input.paymentId)) {
        return { status: "not_found" };
      }

      const repository = typeof dependencies.repository === "function"
        ? dependencies.repository()
        : dependencies.repository;
      const scope = {
        agencyId: access.agency.agencyId,
        reservationId: input.reservationId,
        paymentId: input.paymentId,
      };
      try {
        if (!await repository.findReservation(scope)) return { status: "not_found" };
        const payment = await repository.findPayment(scope);
        if (!payment) return { status: "not_found" };
        if (payment.status !== "cancelled") return { status: "payment_not_cancelled" };
        const count = await repository.revokeAvailableReceipts(scope);
        if (count > 0) return { status: "revoked" };
        return await repository.hasReceipt(scope)
          ? { status: "already_revoked" }
          : { status: "no_receipt" };
      } catch {
        throw new PaymentReceiptRevocationError();
      }
    },
  };
}
