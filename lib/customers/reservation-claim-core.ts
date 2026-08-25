import { normalizeCustomerEmail } from "./customer-email";

export type ReservationClaimIdentity = Readonly<{ userId: string; email: string | null }>;
export type ClaimReservationRow = Readonly<{ agencyId: string; bookingEmail: string | null }>;

export interface ReservationClaimRepository {
  findReservation(input: Readonly<{ requestedAgencySlug: string; reservationId: string }>): Promise<ClaimReservationRow | null>;
  findOrCreateActiveAccount(input: Readonly<{ agencyId: string; userId: string }>): Promise<string | null>;
  findPrimaryAccountId(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<string | null>;
  upsertPrimaryAccess(input: Readonly<{ agencyId: string; reservationId: string; customerAccountId: string }>): Promise<void>;
}

export type ClaimReservationResult =
  | Readonly<{ status: "claimed" | "existing" }>
  | Readonly<{ status: "unauthenticated" | "not_found" | "email_mismatch" | "reservation_already_claimed" | "account_unavailable" | "claim_error" }>;

export class ReservationClaimError extends Error {
  readonly name = "ReservationClaimError";
  constructor() { super("No fue posible vincular la reservación a esta cuenta."); }
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
}

export function createReservationClaimService(dependencies: Readonly<{
  getIdentity: () => Promise<ReservationClaimIdentity | null>;
  repository: ReservationClaimRepository;
}>) {
  return {
    async claim(input: Readonly<{ requestedAgencySlug: string; reservationId: string }>): Promise<ClaimReservationResult> {
      if (!input.requestedAgencySlug.trim() || !input.reservationId.trim()) return { status: "not_found" };
      try {
        const identity = await dependencies.getIdentity();
        if (!identity) return { status: "unauthenticated" };
        const reservation = await dependencies.repository.findReservation(input);
        if (!reservation) return { status: "not_found" };
        const bookingEmail = normalizeCustomerEmail(reservation.bookingEmail);
        const authenticatedEmail = normalizeCustomerEmail(identity.email);
        if (!bookingEmail || !authenticatedEmail || bookingEmail !== authenticatedEmail) return { status: "email_mismatch" };
        const accountId = await dependencies.repository.findOrCreateActiveAccount({ agencyId: reservation.agencyId, userId: identity.userId });
        if (!accountId) return { status: "account_unavailable" };
        const primaryAccountId = await dependencies.repository.findPrimaryAccountId({ agencyId: reservation.agencyId, reservationId: input.reservationId });
        if (primaryAccountId === accountId) return { status: "existing" };
        if (primaryAccountId) return { status: "reservation_already_claimed" };
        try {
          await dependencies.repository.upsertPrimaryAccess({ agencyId: reservation.agencyId, reservationId: input.reservationId, customerAccountId: accountId });
          return { status: "claimed" };
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          const concurrentPrimary = await dependencies.repository.findPrimaryAccountId({ agencyId: reservation.agencyId, reservationId: input.reservationId });
          return concurrentPrimary === accountId ? { status: "existing" } : { status: "reservation_already_claimed" };
        }
      } catch (error) {
        if (error instanceof ReservationClaimError) return { status: "claim_error" };
        return { status: "claim_error" };
      }
    },
  };
}
