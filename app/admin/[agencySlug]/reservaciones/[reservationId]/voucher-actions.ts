"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureReservationVoucherDocument } from "@/lib/documents/reservation-voucher-document";
import type { VoucherFormState } from "./voucher-form-core";

export async function generateReservationVoucherAction(_previous: VoucherFormState, formData: FormData): Promise<VoucherFormState> {
  const requestedAgencySlug = String(formData.get("requestedAgencySlug") ?? "");
  const reservationId = String(formData.get("reservationId") ?? "");
  let result: Awaited<ReturnType<typeof ensureReservationVoucherDocument>>;
  try { result = await ensureReservationVoucherDocument({ requestedAgencySlug, reservationId }); }
  catch { return { error: "No fue posible generar el Voucher. Inténtalo nuevamente." }; }
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "forbidden" || result.status === "not_found") return { error: "La reservación no está disponible para esta agencia." };
  if (result.status === "not_eligible") return { error: "La reservación aún no cumple los requisitos para emitir el Voucher." };
  if (result.status !== "generated" && result.status !== "existing") return { error: "No fue posible generar el Voucher. Inténtalo nuevamente." };
  revalidatePath(`/admin/${encodeURIComponent(requestedAgencySlug)}/reservaciones/${reservationId}`);
  revalidatePath(`/cuenta/${encodeURIComponent(requestedAgencySlug)}/reservaciones/${reservationId}`);
  return { success: result.status === "generated" ? `Voucher V${result.voucher.version} generado.` : `El Voucher V${result.voucher.version} ya estaba disponible.` };
}
