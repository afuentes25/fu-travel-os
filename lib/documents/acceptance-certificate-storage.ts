import "server-only";

import {
  createSupabaseReservationContractDocumentStorage,
  type ReservationContractDocumentStorage,
} from "./reservation-contract-document-storage";

/** Acceptance certificates live in the same private documents bucket as contracts. */
export type AcceptanceCertificateStorage = ReservationContractDocumentStorage;

export const createSupabaseAcceptanceCertificateStorage =
  createSupabaseReservationContractDocumentStorage;
