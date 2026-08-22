import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import {
  createPaymentReceiptService,
  type EnsurePaymentReceiptInput,
  type EnsurePaymentReceiptResult,
} from "./payment-receipt-core";
import { renderPaymentReceiptPdf } from "./payment-receipt-pdf";
import { createSupabasePaymentReceiptRepository } from "./payment-receipt-repository";
import { createSupabasePaymentReceiptStorage } from "./payment-receipt-storage";

export {
  createPaymentReceiptService,
  PaymentReceiptError,
  type EnsurePaymentReceiptInput,
  type EnsurePaymentReceiptResult,
  type PaymentReceiptDocument,
} from "./payment-receipt-core";

/** Generates a private receipt only after verified administrative authorization. */
export async function ensurePaymentReceiptDocument(
  input: EnsurePaymentReceiptInput,
): Promise<EnsurePaymentReceiptResult> {
  return createPaymentReceiptService({
    resolveAccess: resolveAdminAgencyAccess,
    repository: () => createSupabasePaymentReceiptRepository(),
    storage: () => createSupabasePaymentReceiptStorage(),
    renderPdf: renderPaymentReceiptPdf,
  }).ensure(input);
}
