import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";

export type ManualPaymentStatus = "pending" | "confirmed" | "cancelled";

export type ChangeManualPaymentStatusInput = Readonly<{
  requestedAgencySlug: unknown;
  reservationId: unknown;
  paymentId: unknown;
  nextStatus: unknown;
}>;

export type ChangeManualPaymentStatusResult =
  | Readonly<{ status: "updated"; nextStatus: ManualPaymentStatus }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "invalid_input" }>
  | Readonly<{ status: "invalid_transition" }>
  | Readonly<{ status: "evidence_required" }>
  | Readonly<{ status: "conflict" }>;

export type StoredPaymentStatusRow = Readonly<{
  id: string;
  status: ManualPaymentStatus;
  source?: string | null;
}>;

export interface AdminPaymentStatusRepositoryClient {
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<boolean>;
  findPayment(input: Readonly<{ agencyId: string; reservationId: string; paymentId: string }>): Promise<StoredPaymentStatusRow | null>;
  hasEvidence(input: Readonly<{ agencyId: string; reservationId: string; paymentId: string }>): Promise<boolean>;
  updateStatus(input: Readonly<{
    agencyId: string;
    reservationId: string;
    paymentId: string;
    expectedStatus: ManualPaymentStatus;
    nextStatus: ManualPaymentStatus;
    actorUserId: string;
    changedAt: string;
  }>): Promise<boolean>;
}

export class AdminPaymentStatusError extends Error {
  readonly name = "AdminPaymentStatusError";

  constructor() {
    super("No fue posible actualizar el estado del pago.");
  }
}

const paymentStatuses = ["pending", "confirmed", "cancelled"] as const;
const allowedTransitions: Readonly<Record<ManualPaymentStatus, readonly ManualPaymentStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
};

function isUuid(value: unknown): value is string {
  return typeof value === "string" && isAdminReservationUuid(value);
}

export function isManualPaymentStatus(value: unknown): value is ManualPaymentStatus {
  return typeof value === "string" && (paymentStatuses as readonly string[]).includes(value);
}

export function canTransitionManualPaymentStatus(
  currentStatus: ManualPaymentStatus,
  nextStatus: ManualPaymentStatus,
) {
  return (allowedTransitions[currentStatus] as readonly string[]).includes(nextStatus);
}

function accessStatus(access: AdminAgencyAccess): Exclude<ChangeManualPaymentStatusResult,
  Readonly<{ status: "updated"; nextStatus: ManualPaymentStatus }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "invalid_input" }>
  | Readonly<{ status: "invalid_transition" }>
  | Readonly<{ status: "evidence_required" }>
  | Readonly<{ status: "conflict" }>
> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

/** Status changes use a conditional update so another admin cannot be overwritten silently. */
export function createAdminPaymentStatusService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: AdminPaymentStatusRepositoryClient | (() => AdminPaymentStatusRepositoryClient);
  now?: () => Date;
}>) {
  return {
    async change(input: ChangeManualPaymentStatusInput): Promise<ChangeManualPaymentStatusResult> {
      let access: AdminAgencyAccess;
      try {
        access = await dependencies.resolveAccess({
          requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined,
        });
      } catch {
        throw new AdminPaymentStatusError();
      }
      const denied = accessStatus(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };
      if (!isUuid(input.reservationId) || !isUuid(input.paymentId) || !isManualPaymentStatus(input.nextStatus)) {
        return { status: "invalid_input" };
      }

      const repository = typeof dependencies.repository === "function"
        ? dependencies.repository()
        : dependencies.repository;
      try {
        const reservation = await repository.findReservation({
          agencyId: access.agency.agencyId,
          reservationId: input.reservationId,
        });
        if (!reservation) return { status: "not_found" };
        const payment = await repository.findPayment({
          agencyId: access.agency.agencyId,
          reservationId: input.reservationId,
          paymentId: input.paymentId,
        });
        if (!payment) return { status: "not_found" };
        if (!canTransitionManualPaymentStatus(payment.status, input.nextStatus)) {
          return { status: "invalid_transition" };
        }
        if (payment.source === "customer" && payment.status === "pending" && input.nextStatus === "confirmed") {
          const hasEvidence = await repository.hasEvidence({
            agencyId: access.agency.agencyId,
            reservationId: input.reservationId,
            paymentId: input.paymentId,
          });
          if (!hasEvidence) return { status: "evidence_required" };
        }
        const updated = await repository.updateStatus({
          agencyId: access.agency.agencyId,
          reservationId: input.reservationId,
          paymentId: input.paymentId,
          expectedStatus: payment.status,
          nextStatus: input.nextStatus,
          actorUserId: access.identity.userId,
          changedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
        });
        return updated ? { status: "updated", nextStatus: input.nextStatus } : { status: "conflict" };
      } catch {
        throw new AdminPaymentStatusError();
      }
    },
  };
}
