import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import {
  createAdminPaymentHistoryService,
  type AdminPaymentHistoryResult,
} from "./admin-payment-list-core";
import { createSupabaseAdminPaymentHistoryRepository } from "./admin-payment-list-repository";

export {
  createAdminPaymentHistoryService,
  AdminPaymentHistoryError,
  type AdminPaymentHistoryItem,
  type AdminPaymentHistoryResult,
} from "./admin-payment-list-core";

export async function listAdminReservationPayments(input: Readonly<{
  requestedAgencySlug?: string;
  reservationId: string;
}>): Promise<AdminPaymentHistoryResult> {
  return createAdminPaymentHistoryService({
    resolveAccess: resolveAdminAgencyAccess,
    repository: () => createSupabaseAdminPaymentHistoryRepository(),
  }).list(input);
}
