"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureReservationTravelerTicket } from "@/lib/documents/reservation-ticket-document";
import type { TicketFormState } from "./ticket-form-core";

export async function generateReservationTravelerTicketAction(_previous: TicketFormState, formData: FormData): Promise<TicketFormState> {
  const requestedAgencySlug = String(formData.get("requestedAgencySlug") ?? "");
  const reservationId = String(formData.get("reservationId") ?? "");
  const travelerKey = String(formData.get("travelerKey") ?? "");
  let result: Awaited<ReturnType<typeof ensureReservationTravelerTicket>>;
  try { result = await ensureReservationTravelerTicket({ requestedAgencySlug, reservationId, travelerKey }); }
  catch { return { error: "No fue posible generar el boleto. Inténtalo nuevamente." }; }
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "forbidden" || result.status === "not_found") return { error: "El viajero no está disponible para esta agencia." };
  if (result.status === "traveler_incomplete") return { error: "Faltan datos del viajero para emitir el boleto." };
  if (result.status === "not_eligible") return { error: "La reservación aún no cumple los requisitos para emitir el boleto." };
  if (result.status !== "generated" && result.status !== "existing") return { error: "No fue posible generar el boleto. Inténtalo nuevamente." };
  revalidatePath(`/admin/${encodeURIComponent(requestedAgencySlug)}/reservaciones/${reservationId}`);
  revalidatePath(`/cuenta/${encodeURIComponent(requestedAgencySlug)}/reservaciones/${reservationId}`);
  revalidatePath(`/admin/${encodeURIComponent(requestedAgencySlug)}/salidas`, "layout");
  return { success: result.status === "generated" ? `Boleto V${result.ticket.version} generado.` : `El boleto V${result.ticket.version} ya estaba disponible.` };
}
