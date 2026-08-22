"use client";

import { useActionState } from "react";

import { retryPaymentReceiptAction } from "./payment-actions";
import { initialPaymentReceiptFormState } from "./payment-receipt-form-core";
import styles from "./payment-receipt-control.module.css";

/** A retry is available only for confirmed payments without a current receipt. */
export function PaymentReceiptControl({
  requestedAgencySlug,
  reservationId,
  paymentId,
}: Readonly<{
  requestedAgencySlug: string;
  reservationId: string;
  paymentId: string;
}>) {
  const [state, formAction, pending] = useActionState(
    retryPaymentReceiptAction,
    initialPaymentReceiptFormState,
  );
  return (
    <form className={styles.control} action={formAction}>
      <input type="hidden" name="requestedAgencySlug" value={requestedAgencySlug} />
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <button type="submit" disabled={pending}>{pending ? "Generando comprobante…" : "Generar comprobante"}</button>
      {state.success && <p role="status">{state.success}</p>}
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
