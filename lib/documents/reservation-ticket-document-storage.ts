import "server-only";

import {
  createSupabaseReservationContractDocumentStorage,
  type ReservationContractDocumentStorage,
} from "./reservation-contract-document-storage";

export type ReservationTicketDocumentStorage = ReservationContractDocumentStorage;
export const createSupabaseReservationTicketDocumentStorage = createSupabaseReservationContractDocumentStorage;
