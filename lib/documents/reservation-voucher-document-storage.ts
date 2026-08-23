import "server-only";

import { createSupabaseReservationContractDocumentStorage, type ReservationContractDocumentStorage } from "./reservation-contract-document-storage";

export type ReservationVoucherDocumentStorage = ReservationContractDocumentStorage;
export const createSupabaseReservationVoucherDocumentStorage = createSupabaseReservationContractDocumentStorage;
