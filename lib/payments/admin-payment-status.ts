import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

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
  }).change(input);
}
