import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import {
  createManualReservationPaymentService,
  type CreateManualReservationPaymentInput,
  type CreateManualPaymentResult,
} from "./manual-payment-core";
import { createSupabaseManualPaymentRepository } from "./manual-payment-repository";

export {
  createManualReservationPaymentService,
  ManualPaymentError,
  type CreateManualReservationPaymentInput,
  type CreateManualPaymentResult,
  type ManualPaymentReceipt,
} from "./manual-payment-core";

/** Creates manual payments only after verified administrative authorization. */
export async function createManualReservationPayment(
  input: CreateManualReservationPaymentInput,
): Promise<CreateManualPaymentResult> {
  return createManualReservationPaymentService({
    resolveAccess: resolveAdminAgencyAccess,
    repository: () => createSupabaseManualPaymentRepository(),
  }).create(input);
}
