import type { ReservationSnapshot, ReservationSnapshotPersistenceInput } from ".";

export type ReservationCustomerLinkStatus =
  | "linked"
  | "already_linked"
  | "email_mismatch"
  | "not_authenticated";

export type AtomicReservationPersistenceInput =
  ReservationSnapshotPersistenceInput &
    Readonly<{ verifiedAuthUserId: string | null }>;

export type AtomicReservationPersistenceResult = Readonly<{
  reservation: ReservationSnapshot;
  created: boolean;
  customerLinkStatus: ReservationCustomerLinkStatus;
}>;

export type ReservationCreationFailureEvent =
  | "reservation_create_failed"
  | "auth_identity_failed"
  | "customer_account_failed"
  | "primary_access_failed"
  | "reservation_already_claimed";

export class AtomicReservationPersistenceError extends Error {
  readonly name = "AtomicReservationPersistenceError";

  constructor(readonly event: ReservationCreationFailureEvent) {
    super("No fue posible registrar la reservación.");
  }
}

export interface AtomicReservationPersistenceClient {
  persist(
    input: AtomicReservationPersistenceInput,
  ): Promise<AtomicReservationPersistenceResult>;
}
