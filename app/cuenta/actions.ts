"use server";

import { redirect } from "next/navigation";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";
import { claimReservationForAuthenticatedCustomer } from "@/lib/customers/reservation-claim";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { runCustomerLoginFlow } from "./customer-login-core";
import { parseCustomerReservationClaimNext, safeCustomerAuthReturnTo, safeCustomerNext, validateCustomerLoginCredentials } from "./customer-utils";
import type { CustomerLoginState } from "./login/login-state";

function loginError(): CustomerLoginState {
  return { error: "No fue posible iniciar sesión. Verifica tus datos e inténtalo nuevamente." };
}

export async function loginCustomerAction(
  _previous: CustomerLoginState,
  formData: FormData,
): Promise<CustomerLoginState> {
  const credentials = validateCustomerLoginCredentials({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const next = safeCustomerNext(formData.get("next"));
  const returnTo = safeCustomerAuthReturnTo(formData.get("returnTo"));
  const claim = formData.get("claim") === "1" ? parseCustomerReservationClaimNext(next) : null;
  if (!credentials) return loginError();

  let result: Awaited<ReturnType<typeof runCustomerLoginFlow>>;
  let authenticatedAuth: Awaited<ReturnType<typeof createSupabaseAuthServerClient>>;
  try {
    const auth = await createSupabaseAuthServerClient();
    authenticatedAuth = auth;
    result = await runCustomerLoginFlow({
      signInWithPassword: (input) => auth.auth.signInWithPassword(input),
      // Reuse the client that has just written the response cookies; a second
      // SSR client could otherwise observe the pre-login request cookies.
      resolveAccess: () => resolveCustomerAgencyAccess({}, auth),
    }, credentials);
  } catch {
    return loginError();
  }

  if (claim) {
    const claimed = await claimReservationForAuthenticatedCustomer({ requestedAgencySlug: claim.agencySlug, reservationId: claim.reservationId }, authenticatedAuth!);
    if (claimed.status === "claimed" || claimed.status === "existing") redirect(`/cuenta/${encodeURIComponent(claim.agencySlug)}/reservaciones/${encodeURIComponent(claim.reservationId)}`);
    if (claimed.status === "email_mismatch") return { error: "El correo de esta cuenta no coincide con el utilizado en la reservación." };
    if (claimed.status === "reservation_already_claimed") return { error: "Esta reservación ya está vinculada a otra cuenta." };
    return { error: "No fue posible vincular la reservación a esta cuenta." };
  }

  // A guest who pauses checkout may not have a customer account yet. A
  // successful Auth session is enough to return safely to the public cart;
  // the eventual reservation is still linked only after its booking email
  // matches this verified identity.
  if (returnTo && result.status !== "auth_failed" && result.status !== "unexpected_error") {
    if (formData.get("inline") === "1") return { authenticated: true };
    redirect(returnTo);
  }

  if (result.status === "authorized") {
    const agencyPath = `/cuenta/${encodeURIComponent(result.access.account.agencySlug)}/reservaciones`;
    if (!next || next === "/cuenta") redirect("/cuenta");
    redirect(next?.startsWith(`${agencyPath}/`) || next === agencyPath ? next : agencyPath);
  }
  if (result.status === "selection_required") redirect("/cuenta");
  if (result.status === "auth_failed" || result.status === "unexpected_error") return loginError();
  return { error: "No tienes acceso activo como cliente." };
}

export async function logoutCustomerAction() {
  const auth = await createSupabaseAuthServerClient();
  await auth.auth.signOut();
  redirect("/");
}
