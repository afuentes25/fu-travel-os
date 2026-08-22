export type ContractSettingsFormState = Readonly<{
  success?: string;
  error?: string;
  fieldErrors?: Readonly<Record<string, string>>;
}>;

export const initialContractSettingsFormState: ContractSettingsFormState = {};

export function contractSettingsFormValues(formData: FormData) {
  const value = (key: string) => {
    const result = formData.get(key);
    return typeof result === "string" ? result : "";
  };
  return {
    requestedAgencySlug: value("requestedAgencySlug"), legalName: value("legalName"), taxId: value("taxId"), legalAddress: value("legalAddress"), supportEmail: value("supportEmail"), supportPhone: value("supportPhone"), jurisdiction: value("jurisdiction"), templateKey: value("templateKey"), title: value("title"), introductoryText: value("introductoryText"), termsText: value("termsText"), paymentPolicyText: value("paymentPolicyText"), cancellationPolicyText: value("cancellationPolicyText"), travelerResponsibilityText: value("travelerResponsibilityText"), jurisdictionText: value("jurisdictionText"), effectiveFrom: value("effectiveFrom"),
  };
}

export function contractSettingsPath(slug: string) {
  return `/admin/${encodeURIComponent(slug)}/configuracion/contratos`;
}

export function contractSettingsResultMessage(result: { status: string; fieldErrors?: Readonly<Record<string, string>> }): ContractSettingsFormState {
  if (result.status === "invalid_input") return { fieldErrors: result.fieldErrors };
  if (result.status === "forbidden" || result.status === "not_found") return { error: "No tienes permiso para administrar esta configuración." };
  if (result.status === "immutable_version") return { error: "Esta versión contractual ya no puede modificarse." };
  if (result.status === "version_conflict") return { error: "No fue posible crear la nueva versión. Intenta nuevamente." };
  return { error: "No fue posible guardar la configuración. Inténtalo nuevamente." };
}
