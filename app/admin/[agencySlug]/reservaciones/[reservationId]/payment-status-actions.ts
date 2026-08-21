"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { changeManualPaymentStatus } from "@/lib/payments/admin-payment-status";
import type { PaymentStatusFormState } from "./payment-status-form-core";

function fieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function detailPath(agencySlug: string, reservationId: string) {
  return `/admin/${encodeURIComponent(agencySlug)}/reservaciones/${reservationId}`;
}

/** Delegates immutable-payment status transitions to the protected domain command. */
export async function changeManualPaymentStatusAction(
  _previous: PaymentStatusFormState,
  formData: FormData,
): Promise<PaymentStatusFormState> {
  const requestedAgencySlug = fieldValue(formData, "requestedAgencySlug");
  const reservationId = fieldValue(formData, "reservationId");
  let result: Awaited<ReturnType<typeof changeManualPaymentStatus>>;
  try {
    result = await changeManualPaymentStatus({
      requestedAgencySlug,
      reservationId,
      paymentId: fieldValue(formData, "paymentId"),
      nextStatus: fieldValue(formData, "nextStatus"),
    });
  } catch {
    return { error: "No fue posible actualizar el estado del pago. Inténtalo nuevamente." };
  }

  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "updated") {
    revalidatePath(detailPath(requestedAgencySlug, reservationId));
    revalidatePath(`/cuenta/${encodeURIComponent(requestedAgencySlug)}/reservaciones/${reservationId}`);
    return { success: result.nextStatus === "confirmed" ? "Pago confirmado correctamente." : "Pago cancelado correctamente." };
  }
  if (result.status === "conflict") return { error: "El estado del pago cambió. Recarga la reservación antes de intentarlo nuevamente." };
  if (result.status === "invalid_transition") return { error: "Esta transición de estado no está permitida." };
  if (result.status === "not_found") return { error: "El pago no está disponible para esta agencia." };
  if (result.status === "forbidden") return { error: "No tienes permiso para actualizar este pago." };
  return { error: "La solicitud de cambio de estado no es válida." };
}
