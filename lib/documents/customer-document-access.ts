import "server-only";
import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";
import { createCustomerDocumentAccessService, type CustomerDocumentAccessResult } from "./customer-document-access-core";
import { createSupabaseCustomerDocumentAccessRepository } from "./customer-document-access-repository";
import { createSupabaseCustomerDocumentAccessStorage } from "./customer-document-access-storage";
export { createCustomerDocumentAccessService, CustomerDocumentAccessError, type CustomerDocumentAccessResult } from "./customer-document-access-core";
export async function getCustomerDocumentAccess(input: Readonly<{ requestedAgencySlug?: string; reservationId: string; documentKey: string }>): Promise<CustomerDocumentAccessResult> { return createCustomerDocumentAccessService({ resolveAccess: resolveCustomerAgencyAccess, repository: () => createSupabaseCustomerDocumentAccessRepository(), storage: () => createSupabaseCustomerDocumentAccessStorage() }).get(input); }
