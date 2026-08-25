"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { claimReservationForAuthenticatedCustomer } from "@/lib/customers/reservation-claim";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { parseCustomerReservationClaimNext, safeCustomerAuthReturnTo, safeCustomerNext, validateCustomerLoginCredentials } from "../customer-utils";
import type { CustomerRegistrationState } from "./registration-state";

export async function registerCustomerAction(_previous: CustomerRegistrationState, formData: FormData): Promise<CustomerRegistrationState> {
  const credentials = validateCustomerLoginCredentials({ email: formData.get("email"), password: formData.get("password") });
  const next = safeCustomerNext(formData.get("next"));
  const returnTo = safeCustomerAuthReturnTo(formData.get("returnTo"));
  const claim = formData.get("claim") === "1" ? parseCustomerReservationClaimNext(next) : null;
  if (!credentials) return { error: "Captura un correo válido y una contraseña de al menos 8 caracteres." };
  try {
    const auth = await createSupabaseAuthServerClient();
    const requestOrigin = (await headers()).get("origin");
    const callbackContext = new URLSearchParams();
    if (claim && next) {
      callbackContext.set("next", next);
      callbackContext.set("claim", "1");
    } else if (returnTo) {
      callbackContext.set("returnTo", returnTo);
    }
    const callback = requestOrigin && /^https?:\/\//.test(requestOrigin) && callbackContext.size
      ? `${requestOrigin}/cuenta/auth/callback?${callbackContext.toString()}`
      : undefined;
    const { data, error } = await auth.auth.signUp({ email: credentials.email, password: credentials.password, options: callback ? { emailRedirectTo: callback } : undefined });
    if (error) return { error: "No fue posible crear la cuenta. Si ya existe, inicia sesión con este correo." };
    if (data.user?.identities?.length === 0) return { error: "Ya puedes iniciar sesión con este correo." };
    if (data.session && claim) {
      const claimed = await claimReservationForAuthenticatedCustomer({ requestedAgencySlug: claim.agencySlug, reservationId: claim.reservationId }, auth);
      if (claimed.status === "claimed" || claimed.status === "existing") redirect(`/cuenta/${encodeURIComponent(claim.agencySlug)}/reservaciones/${encodeURIComponent(claim.reservationId)}`);
      if (claimed.status === "email_mismatch") return { error: "El correo de esta cuenta no coincide con el utilizado en la reservación." };
    }
    if (data.session && returnTo) {
      if (formData.get("inline") === "1") return { authenticated: true };
      redirect(returnTo);
    }
    if (data.session && next === "/cuenta") redirect("/cuenta");
    return { success: "Revisa tu correo para confirmar la cuenta y continuar con tu reservación." };
  } catch { return { error: "No fue posible crear la cuenta. Intenta nuevamente." }; }
}
