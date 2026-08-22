import "server-only";
import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { createReservationContractService } from "./reservation-contract-core";
import { createSupabaseReservationContractRepository } from "./reservation-contract-repository";
export * from "./reservation-contract-core";
export async function prepareReservationContract(input: { requestedAgencySlug: unknown; reservationId: unknown }) { return createReservationContractService({ resolveAccess: resolveAdminAgencyAccess, repository: () => createSupabaseReservationContractRepository() }).prepare(input); }
