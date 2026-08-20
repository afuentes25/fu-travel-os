import type { CustomerReservationStatus } from "@/lib/customers/customer-reservations-core";

export function parseCustomerReservationPage(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function customerReservationHref(
  agencySlug: string,
  status: CustomerReservationStatus | undefined,
  page: number,
) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/cuenta/${encodeURIComponent(agencySlug)}/reservaciones${search ? `?${search}` : ""}`;
}

export function customerReservationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    partially_paid: "Anticipo pagado",
    paid: "Pagada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? `Estado: ${status.replace(/[_-]+/g, " ")}`;
}

export function customerReservationNextStep(status: string) {
  const messages: Record<string, string> = {
    pending: "Espera las instrucciones de la agencia para completar tu anticipo.",
    partially_paid: "Revisa tu saldo pendiente y próximos pagos.",
    confirmed: "Revisa que los datos de tus viajeros estén completos.",
    paid: "Tu reservación está pagada. Consulta próximamente tus documentos de viaje.",
    cancelled: "Contacta a la agencia para cualquier aclaración.",
  };
  return messages[status] ?? "Contacta a la agencia para conocer los próximos pasos.";
}
