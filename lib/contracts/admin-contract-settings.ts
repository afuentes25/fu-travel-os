import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import {
  createAdminContractSettingsService,
  type LegalProfileInput,
  type TemplateInput,
  type UpdateTemplateInput,
} from "./admin-contract-settings-core";
import { createSupabaseAdminContractSettingsRepository } from "./admin-contract-settings-repository";

export * from "./admin-contract-settings-core";

function service() {
  return createAdminContractSettingsService({ resolveAccess: resolveAdminAgencyAccess, repository: () => createSupabaseAdminContractSettingsRepository() });
}

export async function getAdminContractSettings(input: Readonly<{ requestedAgencySlug?: string }>) { return service().get(input); }
export async function saveAgencyLegalProfile(input: LegalProfileInput) { return service().saveLegalProfile(input); }
export async function createContractTemplateDraft(input: TemplateInput) { return service().createDraft(input); }
export async function updateContractTemplateDraft(input: UpdateTemplateInput) { return service().updateDraft(input); }
