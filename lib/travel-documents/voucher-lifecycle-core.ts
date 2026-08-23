import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";

export type VoucherLifecycleStatus = "revoked" | "not_applicable" | "document_error";
export interface VoucherLifecycleRepository {
  hasAvailableVoucher(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<boolean>;
  revokeAvailableVoucher(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<void>;
}

/** Revokes an available Voucher only when the shared eligibility engine reports it is no longer eligible. */
export function createVoucherLifecycleService(deps: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  eligibility: (input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>) => Promise<unknown>;
  repository: VoucherLifecycleRepository | (() => VoucherLifecycleRepository);
}>) {
  const repository = () => typeof deps.repository === "function" ? deps.repository() : deps.repository;
  return {
    async reconcile(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown }>): Promise<VoucherLifecycleStatus> {
      let access: AdminAgencyAccess;
      try { access = await deps.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
      catch { return "document_error"; }
      if (access.status !== "authorized" || typeof input.reservationId !== "string" || !isAdminReservationUuid(input.reservationId)) return "document_error";
      const reservationId = input.reservationId;
      try {
        const result = await deps.eligibility({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined, reservationId }) as { status?: string; eligibility?: { voucher: { eligible: boolean } } };
        if (result.status !== "authorized" || !result.eligibility) return "document_error";
        const scope = { agencyId: access.agency.agencyId, reservationId };
        if (!await repository().hasAvailableVoucher(scope) || result.eligibility.voucher.eligible) return "not_applicable";
        await repository().revokeAvailableVoucher(scope);
        return "revoked";
      } catch { return "document_error"; }
    },
  };
}
