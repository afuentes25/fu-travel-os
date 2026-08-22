import { isCustomerReservationUuid } from "@/lib/customers/customer-reservation-detail-core";
import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";
export type CustomerDocumentAccessResult = Readonly<{ status: "ready"; signedUrl: string }> | Readonly<{ status: "unauthenticated" } | { status: "selection_required" } | { status: "forbidden" } | { status: "not_found" } | { status: "unavailable" } | { status: "storage_error" }>;
export interface CustomerDocumentAccessRepositoryClient { findLinkedReservation(input: Readonly<{ customerAccountId: string; agencyId: string; reservationId: string }>): Promise<boolean>; findAvailableDocument(input: Readonly<{ agencyId: string; reservationId: string; documentKey: string }>): Promise<Readonly<{ storagePath: string }> | null>; }
export interface CustomerDocumentAccessStorageClient { createSignedReadUrl(input: Readonly<{ path: string; expiresInSeconds: number }>): Promise<string>; }
export class CustomerDocumentAccessError extends Error { readonly name = "CustomerDocumentAccessError"; constructor() { super("No fue posible abrir el documento."); } }
/** Re-authorizes each open request; a document revoked after render cannot receive a new URL. */
export function createCustomerDocumentAccessService(dependencies: Readonly<{ resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>; repository: CustomerDocumentAccessRepositoryClient | (() => CustomerDocumentAccessRepositoryClient); storage: CustomerDocumentAccessStorageClient | (() => CustomerDocumentAccessStorageClient); }>) {
  return { async get(input: Readonly<{ requestedAgencySlug?: string; reservationId: string; documentKey: unknown }>): Promise<CustomerDocumentAccessResult> {
    if (!isCustomerReservationUuid(input.reservationId) || typeof input.documentKey !== "string" || !isCustomerReservationUuid(input.documentKey)) return { status: "not_found" };
    let access: CustomerAgencyAccess; try { access = await dependencies.resolveAccess({ requestedAgencySlug: input.requestedAgencySlug }); } catch { throw new CustomerDocumentAccessError(); }
    if (access.status !== "authorized") return access;
    const repository = typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
    try { const scope = { customerAccountId: access.account.customerAccountId, agencyId: access.account.agencyId, reservationId: input.reservationId }; if (!await repository.findLinkedReservation(scope)) return { status: "not_found" }; const document = await repository.findAvailableDocument({ agencyId: scope.agencyId, reservationId: scope.reservationId, documentKey: input.documentKey }); if (!document) return { status: "unavailable" }; try { const storage = typeof dependencies.storage === "function" ? dependencies.storage() : dependencies.storage; return { status: "ready", signedUrl: await storage.createSignedReadUrl({ path: document.storagePath, expiresInSeconds: 60 }) }; } catch { return { status: "storage_error" }; } } catch { throw new CustomerDocumentAccessError(); }
  } };
}
