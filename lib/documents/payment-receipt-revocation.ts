import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import {
  createPaymentReceiptRevocationService,
  type RevokePaymentReceiptInput,
  type RevokePaymentReceiptResult,
} from "./payment-receipt-revocation-core";
import { createSupabasePaymentReceiptRevocationRepository } from "./payment-receipt-revocation-repository";

export {
  createPaymentReceiptRevocationService,
  PaymentReceiptRevocationError,
  type RevokePaymentReceiptInput,
  type RevokePaymentReceiptResult,
} from "./payment-receipt-revocation-core";

/** Marks available receipt metadata as revoked; it never deletes the private PDF. */
export async function revokePaymentReceiptDocument(
  input: RevokePaymentReceiptInput,
): Promise<RevokePaymentReceiptResult> {
  return createPaymentReceiptRevocationService({
    resolveAccess: resolveAdminAgencyAccess,
    repository: () => createSupabasePaymentReceiptRevocationRepository(),
  }).revoke(input);
}
