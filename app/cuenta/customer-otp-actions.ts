"use server";

import { revalidatePath } from "next/cache";

import { completeVerifiedCustomerAccount, inspectVerifiedCustomerAccount } from "@/lib/customers/customer-account-onboarding";
import { claimReservationForAuthenticatedCustomer } from "@/lib/customers/reservation-claim";
import {
  normalizeVerifiedCustomerProfile,
  validateCustomerOtpEmail,
  validateCustomerOtpToken,
  type CustomerOtpProfileResult,
  type CustomerOtpSendResult,
  type CustomerOtpVerificationResult,
} from "@/lib/customers/customer-otp-core";
import { createSupabaseAuthServerClient } from "@/lib/supabase/auth-server";

import { customerOtpAuthenticatedDestination, parseCustomerOtpContinuation } from "./customer-otp-actions-core";

function isRateLimited(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 429;
}

function validAgencySlug(value: unknown) {
  return typeof value === "string" && /^[a-z0-9-]{1,80}$/i.test(value) ? value : null;
}

function safeClaimError(status: string) {
  switch (status) {
    case "email_mismatch": return "El correo de esta cuenta no coincide con el utilizado en la reservación.";
    case "reservation_already_claimed": return "Esta reservación ya está vinculada a otra cuenta.";
    default: return "No fue posible preparar el acceso a esta reservación.";
  }
}

async function continueVerifiedCustomer(input: Readonly<{
  auth: Awaited<ReturnType<typeof createSupabaseAuthServerClient>>;
  continuation: ReturnType<typeof parseCustomerOtpContinuation>;
}>) {
  if (input.continuation.claim) {
    const claimed = await claimReservationForAuthenticatedCustomer({
      requestedAgencySlug: input.continuation.claim.agencySlug,
      reservationId: input.continuation.claim.reservationId,
    }, input.auth);
    if (claimed.status !== "claimed" && claimed.status !== "existing") {
      return { error: safeClaimError(claimed.status) } as const;
    }
    return {
      destination: customerOtpAuthenticatedDestination(
        input.continuation,
        `/cuenta/${encodeURIComponent(input.continuation.claim.agencySlug)}/reservaciones/${encodeURIComponent(input.continuation.claim.reservationId)}`,
      ),
    } as const;
  }
  return { destination: customerOtpAuthenticatedDestination(input.continuation, null) } as const;
}

export async function sendCustomerEmailOtpAction(input: Readonly<{
  email: unknown;
}>): Promise<CustomerOtpSendResult> {
  const email = validateCustomerOtpEmail(input.email);
  if (!email) return { status: "invalid_email" };
  try {
    const auth = await createSupabaseAuthServerClient();
    // The same neutral request works for both a returning customer and a new
    // one. Auth identity and the agency account are resolved only after OTP.
    const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (!error) return { status: "code_sent" };
    return isRateLimited(error) ? { status: "rate_limited" } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

export async function verifyCustomerEmailOtpAction(input: Readonly<{
  email: unknown;
  token: unknown;
  requestedAgencySlug: unknown;
  next?: unknown;
  returnTo?: unknown;
  claim?: unknown;
  inline?: unknown;
}>): Promise<CustomerOtpVerificationResult> {
  const email = validateCustomerOtpEmail(input.email);
  const token = validateCustomerOtpToken(input.token);
  const agencySlug = validAgencySlug(input.requestedAgencySlug);
  if (!email || !token || !agencySlug) return { status: "invalid_code" };
  try {
    const auth = await createSupabaseAuthServerClient();
    const { error } = await auth.auth.verifyOtp({ email, token, type: "email" });
    if (error) return isRateLimited(error) ? { status: "rate_limited" } : { status: "invalid_code" };
    const account = await inspectVerifiedCustomerAccount({ requestedAgencySlug: agencySlug, authenticatedClient: auth });
    if (account.status === "profile_required") return { status: "profile_required", email: account.email };
    if (account.status !== "existing") return { status: "error" };
    const continuation = await continueVerifiedCustomer({
      auth,
      continuation: parseCustomerOtpContinuation(input),
    });
    return "error" in continuation ? { status: "error" } : { status: "authenticated", destination: continuation.destination };
  } catch {
    return { status: "error" };
  }
}

export async function completeCustomerEmailOtpProfileAction(input: Readonly<{
  requestedAgencySlug: unknown;
  firstName: unknown;
  lastName: unknown;
  phone: unknown;
  next?: unknown;
  returnTo?: unknown;
  claim?: unknown;
  inline?: unknown;
}>): Promise<CustomerOtpProfileResult> {
  const agencySlug = validAgencySlug(input.requestedAgencySlug);
  const profile = normalizeVerifiedCustomerProfile(input);
  if (!agencySlug || !profile) return { status: "invalid_profile" };
  try {
    const auth = await createSupabaseAuthServerClient();
    const account = await completeVerifiedCustomerAccount({ requestedAgencySlug: agencySlug, authenticatedClient: auth, profile });
    if (account.status === "account_unavailable") return { status: "account_unavailable" };
    if (account.status !== "created" && account.status !== "existing") return { status: "error" };
    const continuation = await continueVerifiedCustomer({ auth, continuation: parseCustomerOtpContinuation(input) });
    if ("error" in continuation) return { status: "error" };
    const slug = encodeURIComponent(agencySlug);
    revalidatePath("/cuenta", "layout");
    revalidatePath(`/cuenta/${slug}/reservaciones`, "layout");
    return { status: "authenticated", destination: continuation.destination };
  } catch {
    return { status: "error" };
  }
}
