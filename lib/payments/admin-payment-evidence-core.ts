import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";

export type AdminPaymentEvidenceMimeType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export type AdminPaymentEvidenceInput = Readonly<{
  requestedAgencySlug: unknown;
  reservationId: unknown;
  paymentId: unknown;
}>;

export type AdminPaymentEvidenceResult =
  | Readonly<{ status: "ready"; signedUrl: string; mimeType: AdminPaymentEvidenceMimeType }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "no_evidence" }>
  | Readonly<{ status: "storage_error" }>;

export interface AdminPaymentEvidenceRepositoryClient {
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<boolean>;
  findPayment(input: Readonly<{ agencyId: string; reservationId: string; paymentId: string }>): Promise<boolean>;
  findEvidence(input: Readonly<{ agencyId: string; reservationId: string; paymentId: string }>): Promise<Readonly<{
    storagePath: string;
    mimeType: string;
  }> | null>;
}

export interface AdminPaymentEvidenceStorageClient {
  createSignedReadUrl(input: Readonly<{ path: string; expiresInSeconds: number }>): Promise<string>;
}

export class AdminPaymentEvidenceError extends Error {
  readonly name = "AdminPaymentEvidenceError";

  constructor() {
    super("No fue posible abrir el comprobante.");
  }
}

const allowedMimeTypes = new Set<AdminPaymentEvidenceMimeType>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isUuid(value: unknown): value is string {
  return typeof value === "string" && isAdminReservationUuid(value);
}

function accessResult(access: AdminAgencyAccess): Exclude<AdminPaymentEvidenceResult, Readonly<{ status: "ready"; signedUrl: string; mimeType: AdminPaymentEvidenceMimeType }> | Readonly<{ status: "not_found" }> | Readonly<{ status: "no_evidence" }> | Readonly<{ status: "storage_error" }>> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

/** Re-authorizes before reading any evidence metadata or issuing a signed URL. */
export function createAdminPaymentEvidenceService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: AdminPaymentEvidenceRepositoryClient | (() => AdminPaymentEvidenceRepositoryClient);
  storage: AdminPaymentEvidenceStorageClient | (() => AdminPaymentEvidenceStorageClient);
}>) {
  return {
    async request(input: AdminPaymentEvidenceInput): Promise<AdminPaymentEvidenceResult> {
      let access: AdminAgencyAccess;
      try {
        access = await dependencies.resolveAccess({
          requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined,
        });
      } catch {
        throw new AdminPaymentEvidenceError();
      }
      const denied = accessResult(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };
      if (!isUuid(input.reservationId) || !isUuid(input.paymentId)) return { status: "not_found" };

      const repository = typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
      try {
        const reservation = await repository.findReservation({
          agencyId: access.agency.agencyId,
          reservationId: input.reservationId,
        });
        if (!reservation) return { status: "not_found" };
        const payment = await repository.findPayment({
          agencyId: access.agency.agencyId,
          reservationId: input.reservationId,
          paymentId: input.paymentId,
        });
        if (!payment) return { status: "not_found" };
        const evidence = await repository.findEvidence({
          agencyId: access.agency.agencyId,
          reservationId: input.reservationId,
          paymentId: input.paymentId,
        });
        if (!evidence) return { status: "no_evidence" };
        if (!allowedMimeTypes.has(evidence.mimeType as AdminPaymentEvidenceMimeType)) return { status: "no_evidence" };
        try {
          const storage = typeof dependencies.storage === "function" ? dependencies.storage() : dependencies.storage;
          const signedUrl = await storage.createSignedReadUrl({ path: evidence.storagePath, expiresInSeconds: 60 });
          return { status: "ready", signedUrl, mimeType: evidence.mimeType as AdminPaymentEvidenceMimeType };
        } catch {
          return { status: "storage_error" };
        }
      } catch {
        throw new AdminPaymentEvidenceError();
      }
    },
  };
}
