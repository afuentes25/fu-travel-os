"use client";

import { useActionState, type MouseEvent } from "react";

import { changeManualPaymentStatusAction } from "./payment-status-actions";
import { initialPaymentStatusFormState } from "./payment-status-form-core";
import styles from "./admin-detail.module.css";

export function PaymentStatusControls({
  requestedAgencySlug,
  reservationId,
  paymentId,
  status,
  canConfirm,
}: Readonly<{
  requestedAgencySlug: string;
  reservationId: string;
  paymentId: string;
  status: "pending" | "confirmed" | "cancelled";
  canConfirm: boolean;
}>) {
  const [state, formAction, pending] = useActionState(
    changeManualPaymentStatusAction,
    initialPaymentStatusFormState,
  );

  function confirmCancellation(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm("Cancelar este movimiento hará que deje de contabilizarse dentro de los pagos confirmados.")) {
      event.preventDefault();
    }
  }

  if (status === "cancelled") return null;
  return (
    <form className={styles.paymentStatusControls} action={formAction}>
      <input type="hidden" name="requestedAgencySlug" value={requestedAgencySlug} />
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      {status === "pending" && canConfirm && <button className={styles.paymentConfirmButton} type="submit" name="nextStatus" value="confirmed" disabled={pending}>Confirmar</button>}
      <button className={styles.paymentCancelButton} type="submit" name="nextStatus" value="cancelled" disabled={pending} onClick={confirmCancellation}>Cancelar</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </form>
  );
}
