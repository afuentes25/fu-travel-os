"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { claimReservationForAuthenticatedCustomer } from "@/lib/customers/reservation-claim";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { parseCustomerReservationClaimNext, safeCustomerAuthReturnTo, safeCustomerNext, validateCustomerLoginCredentials } from "../customer-utils";
import {
  classifyCustomerSignup,
  customerRegistrationCallbackContext,
  customerRegistrationErrorMessage,
  resolveCustomerRegistrationContinuation,
  type CustomerRegistrationState,
} from "./registration-core";

function callbackUrl(input: Readonly<{
  origin: string | null;
  next: string;
  returnTo: string | null;
  claim: boolean;
}>) {
  if (!input.origin || !/^https?:\/\//.test(input.origin)) return undefined;
  return `${input.origin}/cuenta/auth/callback?${customerRegistrationCallbackContext(input)}`;
}

function registrationInput(formData: FormData) {
  const next = safeCustomerNext(formData.get("next")) ?? "/cuenta";
  const returnTo = safeCustomerAuthReturnTo(formData.get("returnTo"));
  const claim = formData.get("claim") === "1" ? parseCustomerReservationClaimNext(next) : null;
  return { next, returnTo, claim };
}

export async function registerCustomerAction(_previous: CustomerRegistrationState, formData: FormData): Promise<CustomerRegistrationState> {
  const credentials = validateCustomerLoginCredentials({ email: formData.get("email"), password: formData.get("password") });
  const { next, returnTo, claim } = registrationInput(formData);
  if (!credentials) return { status: "error", message: "Captura un correo válido y una contraseña de al menos 8 caracteres." };

  let authenticated = false;
  let claimError: string | null = null;
  try {
    const auth = await createSupabaseAuthServerClient();
    const callback = callbackUrl({
      origin: (await headers()).get("origin"),
      next,
      returnTo,
      claim: Boolean(claim),
    });
    const { data, error } = await auth.auth.signUp({ email: credentials.email, password: credentials.password, options: callback ? { emailRedirectTo: callback } : undefined });
    if (error) return { status: "error", message: "No fue posible crear la cuenta. Intenta nuevamente." };
    const outcome = classifyCustomerSignup(data);
    if (outcome === "verification_required") return { status: "verification_required" };
    if (outcome === "account_exists_or_login_required") return { status: "account_exists_or_login_required" };
    if (outcome === "signup_failed") return { status: "error", message: customerRegistrationErrorMessage(outcome) };
    authenticated = true;
    if (claim) {
      const claimed = await claimReservationForAuthenticatedCustomer({ requestedAgencySlug: claim.agencySlug, reservationId: claim.reservationId }, auth);
      if (claimed.status === "email_mismatch") claimError = "El correo de esta cuenta no coincide con el utilizado en la reservación.";
      else if (claimed.status !== "claimed" && claimed.status !== "existing") claimError = "No fue posible preparar el acceso a esta reservación.";
    }
  } catch {
    return { status: "error", message: "No fue posible crear la cuenta. Intenta nuevamente." };
  }

  if (!authenticated) return { status: "error", message: "No fue posible crear la cuenta. Intenta nuevamente." };
  if (claimError) return { status: "error", message: claimError };
  const continuation = resolveCustomerRegistrationContinuation({
    next,
    returnTo,
    inline: formData.get("inline") === "1",
    claimDestination: claim
      ? `/cuenta/${encodeURIComponent(claim.agencySlug)}/reservaciones/${encodeURIComponent(claim.reservationId)}`
      : null,
  });
  if (continuation.status === "authenticated") return continuation;
  redirect(continuation.destination);
}

/** Resends only Supabase's signup confirmation; it never grants customer access. */
export async function resendCustomerRegistrationConfirmationAction(input: Readonly<{
  email: unknown;
  next?: unknown;
  returnTo?: unknown;
  claim?: unknown;
}>): Promise<Readonly<{ status: "sent" | "rate_limited" | "error" }>> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return { status: "error" };
  const next = safeCustomerNext(input.next) ?? "/cuenta";
  const returnTo = safeCustomerAuthReturnTo(input.returnTo);
  const claim = input.claim === true && Boolean(parseCustomerReservationClaimNext(next));
  try {
    const auth = await createSupabaseAuthServerClient();
    const { error } = await auth.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: callbackUrl({
          origin: (await headers()).get("origin"),
          next,
          returnTo,
          claim,
        }),
      },
    });
    if (!error) return { status: "sent" };
    return (error as { status?: number }).status === 429
      ? { status: "rate_limited" }
      : { status: "error" };
  } catch {
    return { status: "error" };
  }
}
