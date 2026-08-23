import "server-only";
import { createSupabasePaymentReceiptStorage, PAYMENT_RECEIPT_DOCUMENTS_BUCKET } from "./payment-receipt-storage";
export const RESERVATION_CONTRACT_DOCUMENTS_BUCKET = PAYMENT_RECEIPT_DOCUMENTS_BUCKET;
export const createSupabaseReservationContractDocumentStorage = createSupabasePaymentReceiptStorage;
