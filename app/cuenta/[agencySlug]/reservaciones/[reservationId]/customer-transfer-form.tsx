"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

import {
  createCustomerTransferIdempotencyKey,
  localTransferDateTimeToIso,
  localTransferDateTimeValue,
} from "./customer-transfer-form-core";
import {
  finalizeCustomerTransferUploadAction,
  prepareCustomerTransferUploadAction,
} from "./transfer-actions";
import styles from "../../../cuenta.module.css";

type FieldErrors = Readonly<Record<string, string>>;

function customerTransferMetadata(form: HTMLFormElement, paidAt: string, idempotencyKey: string, fileSize?: number) {
  const data = new FormData();
  data.set("requestedAgencySlug", String(new FormData(form).get("requestedAgencySlug") ?? ""));
  data.set("reservationId", String(new FormData(form).get("reservationId") ?? ""));
  data.set("amount", String(new FormData(form).get("amount") ?? ""));
  data.set("paidAt", paidAt);
  data.set("reference", String(new FormData(form).get("reference") ?? ""));
  data.set("idempotencyKey", idempotencyKey);
  if (fileSize !== undefined) data.set("fileSize", String(fileSize));
  return data;
}

export function CustomerTransferForm({
  requestedAgencySlug,
  reservationId,
  currency,
  reportableRemaining,
}: Readonly<{
  requestedAgencySlug: string;
  reservationId: string;
  currency: string;
  reportableRemaining: number;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const localDateRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [clientError, setClientError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasIdempotencyConflict, setHasIdempotencyConflict] = useState(false);
  const [phase, setPhase] = useState<"idle" | "preparing" | "uploading" | "validating">("idle");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function openDialog() {
    setIdempotencyKey((current) => current ?? createCustomerTransferIdempotencyKey());
    setClientError(null);
    setFieldErrors({});
    setNotice(null);
    setHasIdempotencyConflict(false);
    setIsOpen(true);
    requestAnimationFrame(() => {
      if (localDateRef.current && !localDateRef.current.value) localDateRef.current.value = localTransferDateTimeValue(new Date());
    });
  }

  function closeDialog() {
    if (phase !== "idle") return;
    setIsOpen(false);
    if (hasIdempotencyConflict) {
      setIdempotencyKey(createCustomerTransferIdempotencyKey());
      setHasIdempotencyConflict(false);
    }
  }

  function showResult(result: Awaited<ReturnType<typeof finalizeCustomerTransferUploadAction>>) {
    if (result.status === "invalid_input") {
      setFieldErrors(result.fieldErrors);
      return;
    }
    if (result.status === "invalid_file") {
      setFieldErrors({ file: "El comprobante debe ser PDF, JPG, PNG o WebP y no superar 10 MB." });
      return;
    }
    if (result.status === "reservation_paid_in_full") {
      setClientError("Tu reservación ya está cubierta al 100%. No es necesario reportar más pagos.");
      return;
    }
    if (result.status === "pending_payments_cover_remaining") {
      setClientError("Los pagos en validación cubren actualmente el saldo pendiente. Intenta nuevamente si alguno es rechazado o cancelado.");
      return;
    }
    if (result.status === "amount_exceeds_reportable_balance") {
      setFieldErrors({ amount: "El importe supera el saldo disponible para nuevos pagos." });
      return;
    }
    if (result.status === "forbidden" || result.status === "not_found") {
      setClientError("No fue posible reportar esta transferencia para tu reservación.");
      return;
    }
    if (result.status === "invalid_structure") {
      setClientError("No fue posible reportar esta transferencia. Contacta a la agencia para recibir asistencia.");
      return;
    }
    if (result.status === "idempotency_conflict") {
      setHasIdempotencyConflict(true);
      setClientError("Este intento ya fue utilizado con datos diferentes. Cierra el formulario y vuelve a reportar la transferencia.");
      return;
    }
    if (result.status === "storage_error") {
      setClientError("No pudimos subir el comprobante. Intenta nuevamente.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== "idle") return;
    const form = event.currentTarget;
    const file = fileRef.current?.files?.[0];
    const key = idempotencyKey;
    const paidAt = localTransferDateTimeToIso(localDateRef.current?.value ?? "");
    if (!key || !file || !paidAt) {
      setClientError(!file ? "Selecciona un comprobante para continuar." : "Ingresa una fecha y hora de transferencia válidas.");
      return;
    }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setFieldErrors({ file: "El comprobante debe tener un tamaño máximo de 10 MB." });
      return;
    }
    setClientError(null);
    setFieldErrors({});
    const metadata = customerTransferMetadata(form, paidAt, key, file.size);
    setPhase("preparing");
    let prepared: Awaited<ReturnType<typeof prepareCustomerTransferUploadAction>>;
    try {
      prepared = await prepareCustomerTransferUploadAction(metadata);
    } catch {
      setClientError("No pudimos preparar la carga del comprobante. Intenta nuevamente.");
      setPhase("idle");
      return;
    }
    if (prepared.status === "already_submitted") {
      form.reset();
      setSelectedFileName(null);
      setNotice("Este comprobante ya había sido enviado. Tu pago está en validación. Todavía no se descuenta de tu saldo pendiente.");
      setIdempotencyKey(createCustomerTransferIdempotencyKey());
      setPhase("idle");
      setIsOpen(false);
      return;
    }
    if (prepared.status !== "ready") {
      showResult(prepared);
      setPhase("idle");
      return;
    }
    setPhase("uploading");
    let upload: Readonly<{ error: unknown | null }>;
    try {
      upload = await getSupabaseBrowserClient().storage
        .from("payment-evidence")
        .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
    } catch {
      setClientError("No pudimos subir el comprobante. Intenta nuevamente.");
      setPhase("idle");
      return;
    }
    setPhase("validating");
    // A transport error may still have stored the object; finalization safely reconciles it.
    let finalized: Awaited<ReturnType<typeof finalizeCustomerTransferUploadAction>>;
    try {
      finalized = await finalizeCustomerTransferUploadAction(customerTransferMetadata(form, paidAt, key));
    } catch {
      setClientError(upload.error ? "No pudimos subir el comprobante. Intenta nuevamente." : "No pudimos completar la carga del comprobante. Intenta nuevamente.");
      setPhase("idle");
      return;
    }
    if (finalized.status === "submitted" || finalized.status === "already_submitted") {
      form.reset();
      setSelectedFileName(null);
      setNotice(`${finalized.status === "submitted" ? "Comprobante enviado correctamente." : "Este comprobante ya había sido enviado."} Tu pago está en validación. Todavía no se descuenta de tu saldo pendiente.`);
      setIdempotencyKey(createCustomerTransferIdempotencyKey());
      setPhase("idle");
      setIsOpen(false);
      return;
    }
    showResult(finalized);
    setPhase("idle");
  }

  const submitting = phase !== "idle";
  const submitLabel = phase === "preparing" ? "Preparando carga…" : phase === "uploading" ? "Subiendo comprobante…" : phase === "validating" ? "Validando comprobante…" : "Enviar comprobante";
  return (
    <div className={styles.customerTransferArea}>
      <button className={styles.customerTransferButton} type="button" onClick={openDialog}>Reportar transferencia</button>
      {notice && <p className={styles.customerTransferSuccess} role="status">{notice}</p>}
      <dialog className={styles.customerTransferDialog} ref={dialogRef} onCancel={closeDialog} onClose={() => setIsOpen(false)} aria-labelledby="customer-transfer-title">
        <div className={styles.customerTransferDialogHeader}>
          <div><span className={styles.kicker}>Pago por transferencia</span><h2 id="customer-transfer-title">Reportar transferencia</h2></div>
          <button className={styles.customerTransferCloseButton} type="button" onClick={closeDialog} aria-label="Cerrar reporte de transferencia" disabled={submitting}>×</button>
        </div>
        <form ref={formRef} className={styles.customerTransferForm} onSubmit={submit}>
          <p>Envía los datos y el comprobante de tu transferencia. La agencia deberá validarla antes de que el pago se refleje en tu saldo.</p>
          <input type="hidden" name="requestedAgencySlug" value={requestedAgencySlug} />
          <input type="hidden" name="reservationId" value={reservationId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey ?? ""} />
          <label>Importe transferido <small>{currency}</small>
            <input name="amount" inputMode="decimal" min="0.01" max={reportableRemaining.toFixed(2)} placeholder="1000.00" required aria-invalid={Boolean(fieldErrors.amount)} />
            <small>Máximo disponible para reportar: {new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(reportableRemaining)} {currency}</small>
            {fieldErrors.amount && <span role="alert">{fieldErrors.amount}</span>}
          </label>
          <label>Fecha y hora de la transferencia
            <input ref={localDateRef} name="paidAtLocal" type="datetime-local" required aria-invalid={Boolean(fieldErrors.paidAt)} />
            {fieldErrors.paidAt && <span role="alert">{fieldErrors.paidAt}</span>}
          </label>
          <label>Referencia o folio <small>Opcional</small>
            <input name="reference" maxLength={120} placeholder="Referencia de la transferencia" aria-invalid={Boolean(fieldErrors.reference)} />
            {fieldErrors.reference && <span role="alert">{fieldErrors.reference}</span>}
          </label>
          <label>Comprobante
            <input ref={fileRef} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required aria-invalid={Boolean(fieldErrors.file)} onChange={(event) => setSelectedFileName(event.currentTarget.files?.[0]?.name ?? null)} />
            <small>PDF, JPG, PNG o WebP. Máximo 10 MB.</small>
            {selectedFileName && <em className={styles.customerTransferSelectedFile}>Archivo seleccionado: {selectedFileName}</em>}
            {fieldErrors.file && <span role="alert">{fieldErrors.file}</span>}
          </label>
          {clientError && <p className={styles.customerTransferError} role="alert">{clientError}</p>}
          <div className={styles.customerTransferActions}>
            <button type="button" onClick={closeDialog} disabled={submitting}>Cancelar</button>
            <button type="submit" disabled={submitting}>{submitLabel}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
