"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createManualReservationPayment } from "@/lib/payments/manual-payment";
import type { ManualPaymentFormState } from "./manual-payment-form-core";

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
  return result.status === "created"
    ? { outcome: "created", success: "Pago registrado correctamente.", idempotencyKey }
    : { outcome: "already_exists", success: "El pago ya había sido registrado.", idempotencyKey };
}
