export type ContractActivationFormState = Readonly<{ success?: string; error?: string }>;
export const initialContractActivationFormState: ContractActivationFormState = {};

export function contractActivationValues(formData: FormData) {
  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return { requestedAgencySlug: read("requestedAgencySlug"), templateKey: read("templateKey"), expectedActiveTemplateKey: read("expectedActiveTemplateKey") || null };
}

export function contractActivationPath(slug: string) { return `/admin/${encodeURIComponent(slug)}/configuracion/contratos`; }
