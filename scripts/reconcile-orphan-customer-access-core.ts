export const ORPHAN_CUSTOMER_ACCESS_CONFIRMATION =
  "RECONCILE-ORPHAN-CUSTOMER-ACCESS";

export type OrphanCustomerAccessMode = "dry-run" | "confirmed";

export type OrphanCustomerAccessCandidate = Readonly<{
  agencyId: string;
  agencySlug: string;
  reservationRowId: string;
  reservationCode: string;
  verifiedAuthUserId: string;
}>;

export function parseOrphanCustomerAccessArgs(
  args: readonly string[],
): OrphanCustomerAccessMode {
  const confirmation = args.find((arg) => arg.startsWith("--confirm="));
  if (!confirmation) return "dry-run";
  if (
    confirmation !==
    `--confirm=${ORPHAN_CUSTOMER_ACCESS_CONFIRMATION}`
  ) {
    throw new Error("La confirmación no coincide. No se modificó ningún acceso.");
  }
  return "confirmed";
}

export function normalizeMaintenanceEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}
