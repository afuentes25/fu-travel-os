"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  finalizeCustomerTransferUpload,
  prepareCustomerTransferUpload,
} from "@/lib/payments/customer-transfer";

function fieldValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function customerDetailPath(agencySlug: string, reservationId: string) {
  return `/cuenta/${encodeURIComponent(agencySlug)}/reservaciones/${reservationId}`;
}

function metadata(formData: FormData) {
  return {
    requestedAgencySlug: fieldValue(formData, "requestedAgencySlug"),
    reservationId: fieldValue(formData, "reservationId"),
    amount: fieldValue(formData, "amount"),
    paidAt: fieldValue(formData, "paidAt"),
    reference: fieldValue(formData, "reference"),
    idempotencyKey: fieldValue(formData, "idempotencyKey"),
  };
}

function redirectForCustomerAccess(status: string, requestedAgencySlug: string, reservationId: string) {
  if (status === "unauthenticated") redirect(`/cuenta/login?next=${encodeURIComponent(customerDetailPath(requestedAgencySlug, reservationId))}`);
  if (status === "selection_required") redirect("/cuenta");
}

/** Receives only small metadata and returns a path-specific, temporary upload token. */
export async function prepareCustomerTransferUploadAction(formData: FormData) {
  const input = metadata(formData);
  const result = await prepareCustomerTransferUpload({ ...input, fileSize: fieldValue(formData, "fileSize") });
  redirectForCustomerAccess(result.status, input.requestedAgencySlug, input.reservationId);
  return result;
}

/** Receives no File; server re-authorizes and validates private staging bytes. */
export async function finalizeCustomerTransferUploadAction(formData: FormData) {
  const input = metadata(formData);
  const result = await finalizeCustomerTransferUpload(input);
  redirectForCustomerAccess(result.status, input.requestedAgencySlug, input.reservationId);
  if (
    result.status === "submitted"
    || result.status === "already_submitted"
    || result.status === "reservation_paid_in_full"
    || result.status === "pending_payments_cover_remaining"
    || result.status === "amount_exceeds_reportable_balance"
  ) {
    revalidatePath(customerDetailPath(input.requestedAgencySlug, input.reservationId));
    revalidatePath(`/admin/${encodeURIComponent(input.requestedAgencySlug)}/reservaciones/${input.reservationId}`);
  }
  return result;
}
