/** Safe, non-financial outcome of the receipt lifecycle after a payment mutation. */
export type PaymentReceiptLifecycleStatus =
  | "ready"
  | "existing"
  | "revoked"
  | "document_error"
  | "not_applicable";
