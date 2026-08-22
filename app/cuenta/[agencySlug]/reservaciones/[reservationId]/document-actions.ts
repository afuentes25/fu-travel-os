"use server";
import { getCustomerDocumentAccess } from "@/lib/documents/customer-document-access";
export async function requestCustomerDocumentAction(input: Readonly<{ requestedAgencySlug: string; reservationId: string; documentKey: string }>) { return getCustomerDocumentAccess(input); }
