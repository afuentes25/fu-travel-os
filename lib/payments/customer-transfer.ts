import "server-only";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";

import {
  createCustomerTransferUploadService,
  type CustomerTransferCapacityResult,
  type FinalizeCustomerTransferUploadInput,
  type FinalizeCustomerTransferUploadResult,
  type PrepareCustomerTransferUploadInput,
  type PrepareCustomerTransferUploadResult,
} from "./customer-transfer-core";
import { createSupabaseCustomerTransferRepository } from "./customer-transfer-repository";
import { createSupabaseCustomerTransferStorage } from "./customer-transfer-storage";

export {
  createCustomerTransferUploadService,
  CustomerTransferError,
  CUSTOMER_TRANSFER_MAX_FILE_BYTES,
  detectCustomerTransferBytes,
  type FinalizeCustomerTransferUploadResult,
  type CustomerTransferCapacityResult,
  type PrepareCustomerTransferUploadResult,
} from "./customer-transfer-core";

function service() {
  return createCustomerTransferUploadService({
    resolveAccess: resolveCustomerAgencyAccess,
    repository: () => createSupabaseCustomerTransferRepository(),
    storage: () => createSupabaseCustomerTransferStorage(),
  });
}

/** Creates a short-lived, path-specific upload capability after customer authorization. */
export async function prepareCustomerTransferUpload(
  input: PrepareCustomerTransferUploadInput,
): Promise<PrepareCustomerTransferUploadResult> {
  return service().prepare(input);
}

/** Re-authorizes and validates staging bytes before a pending payment can be created. */
export async function finalizeCustomerTransferUpload(
  input: FinalizeCustomerTransferUploadInput,
): Promise<FinalizeCustomerTransferUploadResult> {
  return service().finalize(input);
}

/** Customer-safe, ledger-derived capacity for a new transfer report. */
export async function getCustomerTransferReportability(input: Readonly<{
  requestedAgencySlug: unknown;
  reservationId: unknown;
}>): Promise<CustomerTransferCapacityResult> {
  return service().reportability(input);
}
