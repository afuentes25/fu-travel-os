import { parseCustomerReservationClaimNext, safeCustomerAuthReturnTo, safeCustomerNext } from "./customer-utils";

export type CustomerOtpContinuation = Readonly<{
  next: string;
  returnTo: string | null;
  claim: Readonly<{ agencySlug: string; reservationId: string }> | null;
  inline: boolean;
}>;

export function parseCustomerOtpContinuation(input: Readonly<{
  next?: unknown;
  returnTo?: unknown;
  claim?: unknown;
  inline?: unknown;
}>): CustomerOtpContinuation {
  const next = safeCustomerNext(input.next) ?? "/cuenta";
  const returnTo = safeCustomerAuthReturnTo(input.returnTo);
  return {
    next,
    returnTo,
    claim: input.claim === true ? parseCustomerReservationClaimNext(next) : null,
    inline: input.inline === true,
  };
}

export function customerOtpAuthenticatedDestination(input: CustomerOtpContinuation, claimDestination: string | null) {
  if (claimDestination) return claimDestination;
  if (input.inline || input.returnTo) return null;
  return input.next;
}
