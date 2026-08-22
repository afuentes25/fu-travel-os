import "server-only";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";

import {
  createCustomerTransferEvidenceService,
  type SubmitCustomerTransferInput,
  type SubmitCustomerTransferResult,
} from "./customer-transfer-core";
import { createSupabaseCustomerTransferRepository } from "./customer-transfer-repository";
import { createSupabaseCustomerTransferStorage } from "./customer-transfer-storage";

export {
  createCustomerTransferEvidenceService,
  CustomerTransferError,
  CUSTOMER_TRANSFER_MAX_FILE_BYTES,
  detectCustomerTransferFile,
  type SubmitCustomerTransferResult,
} from "./customer-transfer-core";

export async function submitCustomerTransferEvidence(
  input: SubmitCustomerTransferInput,
): Promise<SubmitCustomerTransferResult> {
  return createCustomerTransferEvidenceService({
    resolveAccess: resolveCustomerAgencyAccess,
    repository: () => createSupabaseCustomerTransferRepository(),
    storage: () => createSupabaseCustomerTransferStorage(),
  }).submit(input);
}
