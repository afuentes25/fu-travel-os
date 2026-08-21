"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";

import {
  createManualPaymentIdempotencyKey,
  localDateTimeToIso,
  localDateTimeValue,
} from "./manual-payment-form-core";
import {
  initialManualPaymentFormState,
  registerManualPaymentAction,
} from "./payment-actions";
import styles from "./admin-detail.module.css";

export function ManualPaymentForm({
  requestedAgencySlug,
  reservationId,
  currency,
}: Readonly<{
  requestedAgencySlug: string;
  reservationId: string;
  currency: string;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isoFieldRef = useRef<HTMLInputElement>(null);
  const localDateFieldRef = useRef<HTMLInputElement>(null);
  const handledSuccessKeyRef = useRef<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    registerManualPaymentAction,
    initialManualPaymentFormState,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (
      (state.outcome !== "created" && state.outcome !== "already_exists")
      || !state.idempotencyKey
      || handledSuccessKeyRef.current === state.idempotencyKey
    ) return;
    handledSuccessKeyRef.current = state.idempotencyKey;
    setIdempotencyKey(createManualPaymentIdempotencyKey());
  }, [state.idempotencyKey, state.outcome]);

  function openDialog() {
    const key = idempotencyKey ?? createManualPaymentIdempotencyKey();
    if (!key) {
      setClientError("No fue posible preparar el registro de pago. Inténtalo nuevamente.");
      return;
    }
    setIdempotencyKey(key);
    setClientError(null);
    setIsOpen(true);
    requestAnimationFrame(() => {
      if (localDateFieldRef.current && !localDateFieldRef.current.value) {
        localDateFieldRef.current.value = localDateTimeValue(new Date());
      }
    });
  }

  function closeDialog() {
    setIsOpen(false);
    if (state.outcome === "idempotency_conflict") {
      setIdempotencyKey(createManualPaymentIdempotencyKey());
    }
  }

  function prepareSubmit(event: FormEvent<HTMLFormElement>) {
    const localValue = localDateFieldRef.current?.value ?? "";
    const paidAt = localDateTimeToIso(localValue);
    if (!paidAt || !idempotencyKey) {
      event.preventDefault();
      setClientError(!idempotencyKey
        ? "No fue posible preparar el registro de pago. Inténtalo nuevamente."
        : "Ingresa una fecha y hora de pago válidas.");
      return;
    }
    if (isoFieldRef.current) isoFieldRef.current.value = paidAt;
    setClientError(null);
  }

  const fieldErrors = state.fieldErrors;
  return (
    <>
      <button className={styles.registerPaymentButton} type="button" onClick={openDialog}>
        + Registrar pago
      </button>
      {clientError && !isOpen && <p className={styles.paymentFormError} role="alert">{clientError}</p>}
      <dialog
        className={styles.paymentDialog}
        ref={dialogRef}
        onCancel={closeDialog}
        onClose={() => setIsOpen(false)}
        aria-labelledby="manual-payment-title"
      >
        <div className={styles.paymentDialogHeader}>
          <div><span className={styles.paymentKicker}>Pago manual</span><h2 id="manual-payment-title">Registrar pago</h2></div>
          <button className={styles.paymentCloseButton} type="button" onClick={closeDialog} aria-label="Cerrar registro de pago">×</button>
        </div>
        <form className={styles.paymentForm} action={formAction} onSubmit={prepareSubmit}>
          <input type="hidden" name="requestedAgencySlug" value={requestedAgencySlug} />
          <input type="hidden" name="reservationId" value={reservationId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey ?? ""} />
          <input ref={isoFieldRef} type="hidden" name="paidAt" />
          <label>
            Importe <small>{currency}</small>
            <input name="amount" inputMode="decimal" placeholder="9563.40" required aria-invalid={Boolean(fieldErrors?.amount)} defaultValue={state.values?.amount ?? ""} />
            {fieldErrors?.amount && <span role="alert">{fieldErrors.amount}</span>}
          </label>
          <label>
            Método
            <select name="method" defaultValue={state.values?.method ?? "transfer"} aria-invalid={Boolean(fieldErrors?.method)}>
              <option value="transfer">Transferencia</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="payment_link">Enlace de pago</option><option value="other">Otro</option>
            </select>
            {fieldErrors?.method && <span role="alert">{fieldErrors.method}</span>}
          </label>
          <label>
            Fecha y hora del pago
            <input ref={localDateFieldRef} name="paidAtLocal" type="datetime-local" required aria-invalid={Boolean(fieldErrors?.paidAt)} defaultValue={state.values?.paidAtLocal ?? ""} />
            {fieldErrors?.paidAt && <span role="alert">{fieldErrors.paidAt}</span>}
          </label>
          <label>
            Referencia <small>Opcional</small>
            <input name="reference" maxLength={120} placeholder="Folio, autorización o referencia interna" defaultValue={state.values?.reference ?? ""} aria-invalid={Boolean(fieldErrors?.reference)} />
            {fieldErrors?.reference && <span role="alert">{fieldErrors.reference}</span>}
          </label>
          <fieldset>
            <legend>Estado inicial</legend>
            <label><input type="radio" name="initialStatus" value="confirmed" defaultChecked={(state.values?.initialStatus ?? "confirmed") === "confirmed"} /> Confirmado <small>Reduce inmediatamente el saldo pendiente.</small></label>
            <label><input type="radio" name="initialStatus" value="pending" defaultChecked={state.values?.initialStatus === "pending"} /> En validación <small>No modifica el saldo hasta ser confirmado.</small></label>
            {fieldErrors?.initialStatus && <span role="alert">{fieldErrors.initialStatus}</span>}
          </fieldset>
          {clientError && <p className={styles.paymentFormError} role="alert">{clientError}</p>}
          {state.error && <p className={styles.paymentFormError} role="alert">{state.error}</p>}
          {state.success && <p className={styles.paymentFormSuccess} role="status">{state.success}</p>}
          <div className={styles.paymentFormActions}>
            <button type="button" onClick={closeDialog}>Cancelar</button>
            <button type="submit" disabled={pending}>{pending ? "Registrando…" : "Registrar pago"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
