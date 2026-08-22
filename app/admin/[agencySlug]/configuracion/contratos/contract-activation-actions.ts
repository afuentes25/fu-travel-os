"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { activateContractTemplate } from "@/lib/contracts/admin-contract-activation";
import { contractActivationPath, contractActivationValues, type ContractActivationFormState } from "./contract-activation-form-core";

export async function activateContractTemplateAction(_previous: ContractActivationFormState, formData: FormData): Promise<ContractActivationFormState> {
  const values = contractActivationValues(formData);
  const result = await activateContractTemplate(values);
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "selection_required") redirect("/admin");
  if (result.status === "activated") { revalidatePath(contractActivationPath(values.requestedAgencySlug)); return { success: `Versión ${result.version} activada correctamente.` }; }
  if (result.status === "conflict") return { error: "La configuración contractual cambió mientras realizabas esta acción. Recarga la página antes de continuar." };
  if (result.status === "legal_profile_required") return { error: "Completa los datos legales de la agencia antes de activar una plantilla contractual." };
  if (result.status === "immutable_version") return { error: "Esta versión ya no puede activarse." };
  return { error: result.status === "forbidden" || result.status === "not_found" ? "No tienes permiso para activar esta versión." : "No fue posible activar la versión. Intenta nuevamente." };
}
