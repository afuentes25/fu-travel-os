"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { claimReservationForAuthenticatedCustomer } from "@/lib/customers/reservation-claim";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { parseCustomerReservationClaimNext, safeCustomerNext, validateCustomerLoginCredentials } from "../customer-utils";
import type { CustomerRegistrationState } from "./registration-state";

export async function registerCustomerAction(_previous: CustomerRegistrationState, formData: FormData): Promise<CustomerRegistrationState> {
  const credentials = validateCustomerLoginCredentials({ email: formData.get("email"), password: formData.get("password") });
  const next = safeCustomerNext(formData.get("next"));
  const claim = formData.get("claim") === "1" ? parseCustomerReservationClaimNext(next) : null;
  if (!credentials) return { error: "Captura un correo válido y una contraseña de al menos 8 caracteres." };
  try {
    const auth = await createSupabaseAuthServerClient();
    const requestOrigin = (await headers()).get("origin");
    const callback = requestOrigin && /^https?:\/\//.test(requestOrigin) && claim ? `${requestOrigin}/cuenta/auth/callback?next=${encodeURIComponent(next!)}&claim=1` : undefined;
    const { data, error } = await auth.auth.signUp({ email: credentials.email, password: credentials.password, options: callback ? { emailRedirectTo: callback } : undefined });
    if (error) return { error: "No fue posible crear la cuenta. Si ya existe, inicia sesión con este correo." };
    if (data.user?.identities?.length === 0) return { error: "Ya puedes iniciar sesión con este correo." };
    if (data.session && claim) {
      const claimed = await claimReservationForAuthenticatedCustomer({ requestedAgencySlug: claim.agencySlug, reservationId: claim.reservationId }, auth);
      if (claimed.status === "claimed" || claimed.status === "existing") redirect(`/cuenta/${encodeURIComponent(claim.agencySlug)}/reservaciones/${encodeURIComponent(claim.reservationId)}`);
      if (claimed.status === "email_mismatch") return { error: "El correo de esta cuenta no coincide con el utilizado en la reservación." };
    }
    return { success: "Revisa tu correo para confirmar la cuenta y continuar con tu reservación." };
  } catch { return { error: "No fue posible crear la cuenta. Intenta nuevamente." }; }
}
