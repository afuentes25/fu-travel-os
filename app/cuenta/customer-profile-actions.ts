"use server";

import { updateAuthenticatedCustomerProfile } from "@/lib/customers/customer-profile";

export type CustomerProfileFormState = Readonly<{ success?: string; error?: string }>;
export const initialCustomerProfileFormState: CustomerProfileFormState = {};

export async function updateCustomerProfileAction(
  _previous: CustomerProfileFormState,
  formData: FormData,
): Promise<CustomerProfileFormState> {
  const requestedAgencySlug = typeof formData.get("requestedAgencySlug") === "string"
    ? String(formData.get("requestedAgencySlug"))
    : "";
  const result = await updateAuthenticatedCustomerProfile({
    requestedAgencySlug,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
  });
  if (result.status === "updated") return { success: "Tus datos se actualizaron correctamente." };
  if (result.status === "invalid") return { error: "Revisa tu nombre, apellidos y WhatsApp antes de guardar." };
  if (result.status === "unauthenticated") return { error: "Tu sesión ya no está disponible. Inicia sesión nuevamente." };
  if (result.status === "forbidden" || result.status === "selection_required") return { error: "No tienes permiso para actualizar estos datos." };
  return { error: "No fue posible guardar tus datos. Intenta nuevamente." };
}
