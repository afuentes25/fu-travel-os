"use server";

import { redirect } from "next/navigation";

import { getAdminPaymentEvidenceAccess } from "@/lib/payments/admin-payment-evidence";

function fieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Returns only a short-lived URL after server-side administrative reauthorization. */
export async function requestPaymentEvidenceAccessAction(formData: FormData) {
  const result = await getAdminPaymentEvidenceAccess({
    requestedAgencySlug: fieldValue(formData, "requestedAgencySlug"),
    reservationId: fieldValue(formData, "reservationId"),
    paymentId: fieldValue(formData, "paymentId"),
  });
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  return result;
}
