import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { getReservationDocumentEligibility } from "@/lib/travel-documents/document-eligibility";

import { createReservationTicketDocumentService, type EnsureReservationTravelerTicketResult } from "./reservation-ticket-document-core";
import { renderReservationTicketPdf } from "./reservation-ticket-document-pdf";
import { createSupabaseReservationTicketRepository } from "./reservation-ticket-document-repository";
import { createSupabaseReservationTicketDocumentStorage } from "./reservation-ticket-document-storage";

export * from "./reservation-ticket-document-core";

export async function ensureReservationTravelerTicket(
  input: Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown; travelerKey: unknown }>,
): Promise<EnsureReservationTravelerTicketResult> {
  return createReservationTicketDocumentService({
    resolveAccess: resolveAdminAgencyAccess,
    eligibility: getReservationDocumentEligibility,
    repository: () => createSupabaseReservationTicketRepository(),
    storage: () => createSupabaseReservationTicketDocumentStorage(),
    renderPdf: renderReservationTicketPdf,
  }).ensure(input);
}
