import "server-only";
import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { getReservationDocumentEligibility } from "@/lib/travel-documents/document-eligibility";
import { createReservationVoucherDocumentService, type EnsureReservationVoucherResult } from "./reservation-voucher-document-core";
import { renderReservationVoucherPdf } from "./reservation-voucher-document-pdf";
import { createSupabaseReservationVoucherRepository } from "./reservation-voucher-document-repository";
import { createSupabaseReservationVoucherDocumentStorage } from "./reservation-voucher-document-storage";
export * from "./reservation-voucher-document-core";
export async function ensureReservationVoucherDocument(input:Readonly<{requestedAgencySlug?:unknown;reservationId:unknown}>):Promise<EnsureReservationVoucherResult>{return createReservationVoucherDocumentService({resolveAccess:resolveAdminAgencyAccess,eligibility:getReservationDocumentEligibility,repository:()=>createSupabaseReservationVoucherRepository(),storage:()=>createSupabaseReservationVoucherDocumentStorage(),renderPdf:renderReservationVoucherPdf}).ensure(input);}
