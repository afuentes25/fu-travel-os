/**
 * Pure safeguards shared by the reservation reset command and its tests.
 * The command itself is server-only and never exposes Service Role credentials.
 */

export const DEMO_RESERVATIONS_RESET_CONFIRMATION = "DELETE-DEMO-RESERVATIONS";

export const RESERVATION_SCOPED_TABLES = [
  "reservation_customer_access",
  "reservation_travelers",
  "reservation_payments",
  "payment_evidence",
  "reservation_contract_instances",
  "reservation_contract_acceptances",
  "reservation_documents",
  "traveler_boarding_credentials",
  "traveler_boarding_state",
  "traveler_boarding_events",
] as const;

export type ReservationScopedTable = (typeof RESERVATION_SCOPED_TABLES)[number];

/**
 * `reservation_snapshots` is intentionally not listed: it is the root and is
 * deleted only after every dependent row has been removed.
 */
export const RESERVATION_RESET_DELETE_ORDER = [
  "traveler_boarding_events",
  "traveler_boarding_credentials",
  "traveler_boarding_state",
  "acceptance_certificate_documents",
  "reservation_contract_acceptances",
  "remaining_reservation_documents",
  "reservation_contract_instances",
  "payment_evidence",
  "reservation_payments",
  "reservation_travelers",
  "reservation_customer_access",
  "reservation_snapshots",
] as const;

export type ReservationResetTarget = Readonly<{
  agencyId: string;
  reservationId: string;
  reservationCode: string;
}>;

export type ResetCommandMode = "dry-run" | "confirmed";

export function parseDemoReservationResetArgs(args: readonly string[]): ResetCommandMode {
  const confirmation = args.find((arg) => arg.startsWith("--confirm="));
  if (confirmation === undefined) return "dry-run";
  if (confirmation !== `--confirm=${DEMO_RESERVATIONS_RESET_CONFIRMATION}`) {
    throw new Error("La confirmación no coincide. No se eliminó ningún dato.");
  }
  return "confirmed";
}

/** A storage object belongs to a reservation only under its exact two-part prefix. */
export function storagePrefixForReservation(target: ReservationResetTarget): string {
  if (!isSafePathSegment(target.agencyId) || !isSafePathSegment(target.reservationId)) {
    throw new Error("La reservación objetivo no tiene un identificador válido para Storage.");
  }
  return `${target.agencyId}/${target.reservationId}`;
}

export function isStoragePathOwnedByReservation(
  path: string,
  target: ReservationResetTarget,
): boolean {
  if (!path || path.startsWith("/") || path.includes("\\")) return false;
  return path.startsWith(`${storagePrefixForReservation(target)}/`);
}

export function getSupabaseProjectRef(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const match = /^([a-z0-9-]+)\.supabase\.co$/.exec(hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function isSafePathSegment(value: string): boolean {
  return Boolean(value) && !value.includes("/") && !value.includes("\\") && value !== "." && value !== "..";
}
