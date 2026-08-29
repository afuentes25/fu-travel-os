export type CustomerRegistrationOutcome =
  | "authenticated"
  | "verification_required"
  | "account_exists_or_login_required"
  | "signup_failed";

export type CustomerRegistrationState = Readonly<
  | { status: "idle" }
  | { status: "authenticated" }
  | { status: "verification_required" }
  | { status: "account_exists_or_login_required" }
  | { status: "error"; message: string }
>;

type SignupResponse = Readonly<{
  user: Readonly<{ identities?: readonly unknown[] | null }> | null;
  session: unknown | null;
}>;

/**
 * Supabase can return a user without a session when email confirmation is
 * enabled. A user with no identities is its privacy-preserving response for
 * an existing address; neither response proves an authenticated session.
 */
export function classifyCustomerSignup(response: SignupResponse): CustomerRegistrationOutcome {
  if (response.session) return "authenticated";
  if (response.user?.identities?.length === 0) {
    return "account_exists_or_login_required";
  }
  return response.user ? "verification_required" : "signup_failed";
}

export function customerRegistrationErrorMessage(outcome: CustomerRegistrationOutcome): string {
  switch (outcome) {
    case "account_exists_or_login_required":
      return "Revisa tu correo para verificar la cuenta o inicia sesión si ya la habías creado.";
    case "signup_failed":
      return "No fue posible crear la cuenta. Intenta nuevamente.";
    default:
      return "No fue posible crear la cuenta. Intenta nuevamente.";
  }
}

export function customerRegistrationCallbackContext(input: Readonly<{
  next: string;
  returnTo: string | null;
  claim: boolean;
}>) {
  const context = new URLSearchParams({ next: input.next });
  if (input.returnTo) context.set("returnTo", input.returnTo);
  if (input.claim) context.set("claim", "1");
  return context.toString();
}

export type CustomerRegistrationContinuation =
  | Readonly<{ status: "authenticated" }>
  | Readonly<{ status: "redirect"; destination: string }>;

/** Determines only post-auth navigation; it never authorizes a reservation. */
export function resolveCustomerRegistrationContinuation(input: Readonly<{
  next: string;
  returnTo: string | null;
  inline: boolean;
  claimDestination: string | null;
}>): CustomerRegistrationContinuation {
  if (input.claimDestination) {
    return { status: "redirect", destination: input.claimDestination };
  }
  if (input.returnTo) {
    return input.inline
      ? { status: "authenticated" }
      : { status: "redirect", destination: input.returnTo };
  }
  return { status: "redirect", destination: input.next };
}

export const CUSTOMER_CONFIRMATION_RESEND_COOLDOWN_SECONDS = 60;
