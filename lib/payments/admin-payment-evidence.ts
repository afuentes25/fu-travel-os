import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import {
  createAdminPaymentEvidenceService,
  type AdminPaymentEvidenceInput,
  type AdminPaymentEvidenceResult,
} from "./admin-payment-evidence-core";
import { createSupabaseAdminPaymentEvidenceRepository } from "./admin-payment-evidence-repository";
import { createSupabaseAdminPaymentEvidenceStorage } from "./admin-payment-evidence-storage";

export {
  createAdminPaymentEvidenceService,
  AdminPaymentEvidenceError,
  type AdminPaymentEvidenceResult,
} from "./admin-payment-evidence-core";

export async function getAdminPaymentEvidenceAccess(
  input: AdminPaymentEvidenceInput,
): Promise<AdminPaymentEvidenceResult> {
  return createAdminPaymentEvidenceService({
    resolveAccess: resolveAdminAgencyAccess,
    repository: () => createSupabaseAdminPaymentEvidenceRepository(),
    storage: () => createSupabaseAdminPaymentEvidenceStorage(),
  }).request(input);
}
