import "server-only";
import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { getReservationDocumentEligibility } from "./document-eligibility";
import { createVoucherLifecycleService, type VoucherLifecycleStatus } from "./voucher-lifecycle-core";
import { createSupabaseVoucherLifecycleRepository } from "./voucher-lifecycle-repository";
export async function reconcileReservationVoucherLifecycle(input:Readonly<{requestedAgencySlug?:unknown;reservationId:unknown}>):Promise<VoucherLifecycleStatus>{return createVoucherLifecycleService({resolveAccess:resolveAdminAgencyAccess,eligibility:getReservationDocumentEligibility,repository:()=>createSupabaseVoucherLifecycleRepository()}).reconcile(input);}
