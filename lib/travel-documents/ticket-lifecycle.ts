import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";
import { getReservationDocumentEligibility } from "./document-eligibility";
import { createChangedTravelerTicketLifecycleService, createReservationTicketLifecycleService, type TicketLifecycleStatus } from "./ticket-lifecycle-core";
import { createSupabaseTicketLifecycleRepository } from "./ticket-lifecycle-repository";

export async function reconcileReservationTicketLifecycle(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown }>): Promise<TicketLifecycleStatus> {
  return createReservationTicketLifecycleService({ resolveAccess: resolveAdminAgencyAccess, eligibility: getReservationDocumentEligibility, repository: () => createSupabaseTicketLifecycleRepository() }).reconcile(input);
}

export async function revokeChangedTravelerTickets(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown; position: unknown }>): Promise<TicketLifecycleStatus> {
  return createChangedTravelerTicketLifecycleService({ resolveAccess: resolveCustomerAgencyAccess, repository: () => createSupabaseTicketLifecycleRepository() }).revokeForNameChange(input);
}
