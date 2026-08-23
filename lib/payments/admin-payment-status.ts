import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { ensurePaymentReceiptDocument } from "@/lib/documents/payment-receipt";
import { revokePaymentReceiptDocument } from "@/lib/documents/payment-receipt-revocation";
import { reconcileReservationVoucherLifecycle } from "@/lib/travel-documents/voucher-lifecycle";

import {
  createAdminPaymentStatusService,
  type ChangeManualPaymentStatusInput,
  type ChangeManualPaymentStatusResult,
} from "./admin-payment-status-core";
import { createSupabaseAdminPaymentStatusRepository } from "./admin-payment-status-repository";

export {
  canTransitionManualPaymentStatus,
  createAdminPaymentStatusService,
  AdminPaymentStatusError,
  type ChangeManualPaymentStatusResult,
} from "./admin-payment-status-core";

export async function changeManualPaymentStatus(
  input: ChangeManualPaymentStatusInput,
): Promise<ChangeManualPaymentStatusResult> {
  return createAdminPaymentStatusService({
    resolveAccess: resolveAdminAgencyAccess,
    repository: () => createSupabaseAdminPaymentStatusRepository(),
    async afterStatusChanged({ requestedAgencySlug, reservationId, paymentId, nextStatus }) {
      if (nextStatus === "pending") return "not_applicable";
      if (nextStatus === "confirmed") {
        const result = await ensurePaymentReceiptDocument({ requestedAgencySlug, reservationId, paymentId });
        return result.status === "generated" ? "ready"
          : result.status === "existing" ? "existing"
          : "document_error";
      }
      const result = await revokePaymentReceiptDocument({ requestedAgencySlug, reservationId, paymentId });
      const voucher = await reconcileReservationVoucherLifecycle({ requestedAgencySlug, reservationId });
      if (voucher === "document_error") return "document_error";
      return result.status === "revoked" ? "revoked"
        : result.status === "already_revoked" || result.status === "no_receipt" ? "not_applicable"
          : "document_error";
    },
  }).change(input);
}
