import "server-only";
import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";
import { createCustomerDocumentListService, type CustomerDocumentListResult } from "./customer-document-list-core";
import { createSupabaseCustomerDocumentListRepository } from "./customer-document-list-repository";
export { createCustomerDocumentListService, CustomerDocumentListError, type CustomerDocumentItem, type CustomerDocumentListResult } from "./customer-document-list-core";
export async function listCustomerReservationDocuments(input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>): Promise<CustomerDocumentListResult> { return createCustomerDocumentListService({ resolveAccess: resolveCustomerAgencyAccess, repository: () => createSupabaseCustomerDocumentListRepository() }).list(input); }
