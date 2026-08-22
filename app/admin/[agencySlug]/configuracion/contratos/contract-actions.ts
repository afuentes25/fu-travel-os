"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createContractTemplateDraft, saveAgencyLegalProfile, updateContractTemplateDraft } from "@/lib/contracts/admin-contract-settings";
import type { ContractSettingsFormState } from "./contract-settings-form-core";
import { contractSettingsFormValues, contractSettingsPath, contractSettingsResultMessage } from "./contract-settings-form-core";

export async function saveAgencyLegalProfileAction(_previous: ContractSettingsFormState, formData: FormData): Promise<ContractSettingsFormState> {
  const values = contractSettingsFormValues(formData);
  const result = await saveAgencyLegalProfile(values);
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "saved") { revalidatePath(contractSettingsPath(values.requestedAgencySlug)); return { success: "Datos legales guardados correctamente." }; }
  return contractSettingsResultMessage(result);
}

export async function createContractTemplateDraftAction(_previous: ContractSettingsFormState, formData: FormData): Promise<ContractSettingsFormState> {
  const values = contractSettingsFormValues(formData);
  const result = await createContractTemplateDraft(values);
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "created") { revalidatePath(contractSettingsPath(values.requestedAgencySlug)); return { success: `Borrador versión ${result.version} creado.` }; }
  return contractSettingsResultMessage(result);
}

export async function updateContractTemplateDraftAction(_previous: ContractSettingsFormState, formData: FormData): Promise<ContractSettingsFormState> {
  const values = contractSettingsFormValues(formData);
  const result = await updateContractTemplateDraft(values);
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "updated") { revalidatePath(contractSettingsPath(values.requestedAgencySlug)); return { success: "Borrador actualizado correctamente." }; }
  return contractSettingsResultMessage(result);
}
