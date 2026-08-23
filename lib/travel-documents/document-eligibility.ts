import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { createReservationDocumentEligibilityService, type GetReservationDocumentEligibilityResult } from "./document-eligibility-core";
import { createSupabaseDocumentEligibilityRepository } from "./document-eligibility-repository";

export * from "./document-eligibility-core";

export async function getReservationDocumentEligibility(input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>): Promise<GetReservationDocumentEligibilityResult> {
  return createReservationDocumentEligibilityService({ resolveAccess: resolveAdminAgencyAccess, repository: () => createSupabaseDocumentEligibilityRepository() }).get(input);
}
