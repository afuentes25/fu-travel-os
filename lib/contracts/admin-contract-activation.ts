import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import { createAdminContractActivationService, type ActivateContractTemplateInput } from "./admin-contract-activation-core";
import { createSupabaseAdminContractActivationRepository } from "./admin-contract-activation-repository";

export * from "./admin-contract-activation-core";

export async function activateContractTemplate(input: ActivateContractTemplateInput) {
  return createAdminContractActivationService({ resolveAccess: resolveAdminAgencyAccess, repository: () => createSupabaseAdminContractActivationRepository() }).activate(input);
}
