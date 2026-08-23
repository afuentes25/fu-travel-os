import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import {
  createReservationContractDocumentService,
  type EnsureReservationContractDocumentInput,
  type EnsureReservationContractDocumentResult,
} from "./reservation-contract-document-core";
import { renderReservationContractPdf } from "./reservation-contract-document-pdf";
import { createSupabaseReservationContractDocumentRepository } from "./reservation-contract-document-repository";
import { createSupabaseReservationContractDocumentStorage } from "./reservation-contract-document-storage";

export {
  createReservationContractDocumentService,
  ReservationContractDocumentError,
  type EnsureReservationContractDocumentInput,
  type EnsureReservationContractDocumentResult,
  type ReservationContractDocument,
} from "./reservation-contract-document-core";

export async function ensureReservationContractDocument(
  input: EnsureReservationContractDocumentInput,
): Promise<EnsureReservationContractDocumentResult> {
  return createReservationContractDocumentService({
    resolveAccess: resolveAdminAgencyAccess,
    repository: () => createSupabaseReservationContractDocumentRepository(),
    storage: () => createSupabaseReservationContractDocumentStorage(),
    renderPdf: renderReservationContractPdf,
  }).ensure(input);
}
