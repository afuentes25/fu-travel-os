import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";

export type TicketLifecycleStatus = "revoked" | "not_applicable" | "document_error";

export interface TicketLifecycleRepository {
  hasAvailableTickets(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<boolean>;
  revokeAvailableTickets(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<void>;
  findTravelerByPosition(input: Readonly<{ agencyId: string; reservationId: string; position: number }>): Promise<{ id: string } | null>;
  revokeAvailableTicketsForTraveler(input: Readonly<{ agencyId: string; reservationId: string; travelerId: string }>): Promise<void>;
}

type TicketEligibilityResult = { status?: string; eligibility?: { ticket: { eligible: boolean } } };

/** Admin reconciliation avoids showing tickets as current after a global gate is lost. */
export function createReservationTicketLifecycleService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  eligibility: (input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>) => Promise<unknown>;
  repository: TicketLifecycleRepository | (() => TicketLifecycleRepository);
}>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  return {
    async reconcile(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown }>): Promise<TicketLifecycleStatus> {
      let access: AdminAgencyAccess;
      try { access = await dependencies.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
      catch { return "document_error"; }
      if (access.status !== "authorized" || typeof input.reservationId !== "string" || !isAdminReservationUuid(input.reservationId)) return "document_error";
      try {
        const eligibility = await dependencies.eligibility({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined, reservationId: input.reservationId }) as TicketEligibilityResult;
        if (eligibility.status !== "authorized" || !eligibility.eligibility) return "document_error";
        const scope = { agencyId: access.agency.agencyId, reservationId: input.reservationId };
        if (!await repository().hasAvailableTickets(scope) || eligibility.eligibility.ticket.eligible) return "not_applicable";
        await repository().revokeAvailableTickets(scope);
        return "revoked";
      } catch { return "document_error"; }
    },
  };
}

/** Re-authorizes the customer before revoking only the ticket whose printed name changed. */
export function createChangedTravelerTicketLifecycleService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: TicketLifecycleRepository | (() => TicketLifecycleRepository);
}>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  return {
    async revokeForNameChange(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown; position: unknown }>): Promise<TicketLifecycleStatus> {
      if (typeof input.reservationId !== "string" || !isAdminReservationUuid(input.reservationId) || typeof input.position !== "number" || !Number.isInteger(input.position) || input.position <= 0) return "document_error";
      const position = input.position;
      let access: CustomerAgencyAccess;
      try { access = await dependencies.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
      catch { return "document_error"; }
      if (access.status !== "authorized") return "document_error";
      try {
        const scope = { agencyId: access.account.agencyId, reservationId: input.reservationId };
        const traveler = await repository().findTravelerByPosition({ ...scope, position });
        if (!traveler) return "not_applicable";
        await repository().revokeAvailableTicketsForTraveler({ ...scope, travelerId: traveler.id });
        return "revoked";
      } catch { return "document_error"; }
    },
  };
}
