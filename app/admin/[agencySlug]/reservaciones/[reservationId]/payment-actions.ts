"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createManualReservationPayment } from "@/lib/payments/manual-payment";
import type { ManualPaymentFormState } from "./manual-payment-form-core";
import { ensurePaymentReceiptDocument } from "@/lib/documents/payment-receipt";
import type { PaymentReceiptFormState } from "./payment-receipt-form-core";

function fieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData) {
  return {
    amount: fieldValue(formData, "amount"),
    method: fieldValue(formData, "method"),
    initialStatus: fieldValue(formData, "initialStatus"),
    reference: fieldValue(formData, "reference"),
    paidAtLocal: fieldValue(formData, "paidAtLocal"),
  };
}

function detailPath(agencySlug: string, reservationId: string) {
  return `/admin/${encodeURIComponent(agencySlug)}/reservaciones/${reservationId}`;
}

function paymentDocumentMessage(documentStatus: "ready" | "existing" | "document_error" | "revoked" | "not_applicable" | undefined) {
  if (documentStatus === "ready") return " Pago confirmado. Comprobante generado.";
  if (documentStatus === "existing") return " Pago confirmado. El comprobante ya estaba disponible.";
  if (documentStatus === "document_error") return " Pago confirmado. El comprobante no pudo generarse; intenta nuevamente desde la gestión documental.";
  return "";
}

/** Delegates all payment authorization and persistence to the server command. */
export async function registerManualPaymentAction(
  _previous: ManualPaymentFormState,
  formData: FormData,
): Promise<ManualPaymentFormState> {
  const requestedAgencySlug = fieldValue(formData, "requestedAgencySlug");
  const reservationId = fieldValue(formData, "reservationId");
  const idempotencyKey = fieldValue(formData, "idempotencyKey");
  const values = formValues(formData);

  let result: Awaited<ReturnType<typeof createManualReservationPayment>>;
  try {
    result = await createManualReservationPayment({
      requestedAgencySlug,
      reservationId,
      amount: values.amount,
      method: values.method,
      initialStatus: values.initialStatus,
      reference: values.reference,
      paidAt: fieldValue(formData, "paidAt"),
      idempotencyKey,
    });
  } catch {
    return { error: "No fue posible registrar el pago. Inténtalo nuevamente.", values, idempotencyKey };
  }

  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "forbidden") {
    return { error: "No tienes permiso para registrar pagos en esta reservación.", values, idempotencyKey };
  }
  if (result.status === "not_found") {
    return { error: "La reservación no está disponible para esta agencia.", values, idempotencyKey };
  }
  if (result.status === "invalid_structure") {
    return {
      error: "No fue posible registrar el pago. Verifica la reservación o contacta al administrador del sistema.",
      values,
      idempotencyKey,
    };
  }
  if (result.status === "reservation_paid_in_full") {
    return { error: "Reservación pagada. Los pagos confirmados ya cubren el total contratado.", values, idempotencyKey };
  }
  if (result.status === "historical_overpayment") {
    return { error: "La reservación ya registra un sobrepago histórico. No se pueden registrar pagos normales adicionales.", values, idempotencyKey };
  }
  if (result.status === "amount_exceeds_reportable_balance") {
    return { fieldErrors: { amount: "El importe supera la capacidad disponible para pagos en validación." }, values, idempotencyKey };
  }
  if (result.status === "amount_exceeds_confirmable_balance") {
    return { fieldErrors: { amount: "El importe supera el saldo pendiente de la reservación." }, values, idempotencyKey };
  }
  if (result.status === "invalid_input") {
    return { fieldErrors: result.fieldErrors, values, idempotencyKey };
  }
  if (result.status === "idempotency_conflict") {
    return {
      outcome: "idempotency_conflict",
      error: "Este intento de registro ya fue utilizado con datos diferentes. Cierra el formulario e intenta nuevamente.",
      values,
      idempotencyKey,
    };
  }

  revalidatePath(detailPath(requestedAgencySlug, reservationId));
  revalidatePath(`/cuenta/${encodeURIComponent(requestedAgencySlug)}/reservaciones/${reservationId}`);
  revalidatePath(`/admin/${encodeURIComponent(requestedAgencySlug)}/salidas`, "layout");
  return result.status === "created"
    ? { outcome: "created", success: `Pago registrado correctamente.${paymentDocumentMessage(result.documentStatus)}`, idempotencyKey }
    : { outcome: "already_exists", success: `El pago ya había sido registrado.${paymentDocumentMessage(result.documentStatus)}`, idempotencyKey };
}

/** Idempotent recovery path for a confirmed payment that has no available receipt. */
export async function retryPaymentReceiptAction(
  _previous: PaymentReceiptFormState,
  formData: FormData,
): Promise<PaymentReceiptFormState> {
  const requestedAgencySlug = fieldValue(formData, "requestedAgencySlug");
  const reservationId = fieldValue(formData, "reservationId");
  let result: Awaited<ReturnType<typeof ensurePaymentReceiptDocument>>;
  try {
    result = await ensurePaymentReceiptDocument({
      requestedAgencySlug,
      reservationId,
      paymentId: fieldValue(formData, "paymentId"),
    });
  } catch {
    return { error: "No fue posible generar el comprobante. Inténtalo nuevamente." };
  }
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "forbidden" || result.status === "not_found") {
    return { error: "El pago no está disponible para esta agencia." };
  }
  if (result.status === "payment_not_confirmed") {
    return { error: "El comprobante solo puede generarse para un pago confirmado." };
  }
  if (result.status === "invalid_structure" || result.status === "document_storage_error") {
    return { error: "No fue posible generar el comprobante. Inténtalo nuevamente." };
  }
  revalidatePath(detailPath(requestedAgencySlug, reservationId));
  return { success: result.status === "generated" ? "Comprobante generado." : "El comprobante ya estaba disponible." };
}
