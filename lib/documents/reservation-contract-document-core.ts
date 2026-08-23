import { createHash } from "node:crypto";

import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";
import {
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";

import type { ReservationContractPdfData } from "./reservation-contract-document-pdf";
import type { ReservationContractDocumentStorage } from "./reservation-contract-document-storage";

export type EnsureReservationContractDocumentInput = Readonly<{
  requestedAgencySlug: unknown;
  reservationId: unknown;
}>;

export type ReservationContractDocument = Readonly<{
  documentType: "contract";
  documentVersion: 1;
  contractTemplateVersion: number;
  contractStatus: "prepared" | "accepted";
  generatedAt: string;
}>;

export type EnsureReservationContractDocumentResult =
  | Readonly<{ status: "generated" | "existing"; document: ReservationContractDocument }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "contract_not_prepared" }>
  | Readonly<{ status: "contract_unavailable" }>
  | Readonly<{ status: "invalid_structure" }>
  | Readonly<{ status: "document_storage_error" }>;

export type ReservationContractInstanceRow = Readonly<{
  id: string;
  status: string;
  contractTemplateVersion: number;
  legalProfileSnapshot: unknown;
  contractContentSnapshot: unknown;
  preparedAt: string;
}>;

export type ReservationContractDocumentRow = Readonly<{
  status: string;
  version: number;
  generatedAt: string;
  storagePath: string;
  contentSha256: string | null;
}>;

export type ReservationContractDocumentInsert = Readonly<{
  reservationId: string;
  agencyId: string;
  documentType: "contract";
  status: "available";
  storagePath: string;
  mimeType: "application/pdf";
  fileSizeBytes: number;
  version: 1;
  paymentId: null;
  contractInstanceId: string;
  contentSha256: string;
  generatedAt: string;
  createdByUserId: string;
}>;

export interface ReservationContractDocumentRepository {
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<ReservationSnapshotProjectionSource | null>;
  findLatestInstance(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<ReservationContractInstanceRow | null>;
  findExistingDocument(input: Readonly<{ agencyId: string; reservationId: string; contractInstanceId: string }>): Promise<ReservationContractDocumentRow | null>;
  updateContentSha256(input: Readonly<{ agencyId: string; reservationId: string; contractInstanceId: string; contentSha256: string }>): Promise<void>;
  insertDocument(input: ReservationContractDocumentInsert): Promise<ReservationContractDocumentRow>;
}

export type ReservationContractPdfRenderer = (data: ReservationContractPdfData) => Promise<Uint8Array>;

export class ReservationContractDocumentError extends Error {
  readonly name = "ReservationContractDocumentError";
  constructor() { super("No fue posible generar el contrato."); }
}

type LegalSnapshot = Readonly<{
  legalName: string;
  taxId: string | null;
  legalAddress: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  jurisdiction: string | null;
}>;

type ContentSnapshot = Readonly<{
  templateVersion: number;
  title: string;
  introductoryText: string | null;
  termsText: string;
  paymentPolicyText: string | null;
  cancellationPolicyText: string | null;
  travelerResponsibilityText: string | null;
  jurisdictionText: string | null;
  effectiveFrom: string | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, required = false): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || !required ? (normalized || null) : null;
}

function nullableText(record: Record<string, unknown>, key: string): string | null | undefined {
  const value = record[key];
  return value === null ? null : typeof value === "string" ? (value.trim() || null) : undefined;
}

function legalSnapshot(value: unknown): LegalSnapshot | null {
  if (!isRecord(value)) return null;
  const legalName = text(value.legalName, true);
  const taxId = nullableText(value, "taxId");
  const legalAddress = nullableText(value, "legalAddress");
  const supportEmail = nullableText(value, "supportEmail");
  const supportPhone = nullableText(value, "supportPhone");
  const jurisdiction = nullableText(value, "jurisdiction");
  if (!legalName || taxId === undefined || legalAddress === undefined || supportEmail === undefined || supportPhone === undefined || jurisdiction === undefined) return null;
  return { legalName, taxId, legalAddress, supportEmail, supportPhone, jurisdiction };
}

function contentSnapshot(value: unknown, expectedVersion: number): ContentSnapshot | null {
  if (!isRecord(value) || !Number.isInteger(value.templateVersion) || value.templateVersion !== expectedVersion) return null;
  const title = text(value.title, true);
  const termsText = text(value.termsText, true);
  const introductoryText = nullableText(value, "introductoryText");
  const paymentPolicyText = nullableText(value, "paymentPolicyText");
  const cancellationPolicyText = nullableText(value, "cancellationPolicyText");
  const travelerResponsibilityText = nullableText(value, "travelerResponsibilityText");
  const jurisdictionText = nullableText(value, "jurisdictionText");
  const effectiveFrom = nullableText(value, "effectiveFrom");
  if (!title || !termsText || introductoryText === undefined || paymentPolicyText === undefined || cancellationPolicyText === undefined || travelerResponsibilityText === undefined || jurisdictionText === undefined || effectiveFrom === undefined) return null;
  if (effectiveFrom !== null && Number.isNaN(new Date(effectiveFrom).getTime())) return null;
  return { templateVersion: expectedVersion, title, termsText, introductoryText, paymentPolicyText, cancellationPolicyText, travelerResponsibilityText, jurisdictionText, effectiveFrom };
}

function accessResult(access: AdminAgencyAccess): Exclude<EnsureReservationContractDocumentResult, Readonly<{ status: "generated" | "existing"; document: ReservationContractDocument }> | Readonly<{ status: "not_found" }> | Readonly<{ status: "contract_not_prepared" }> | Readonly<{ status: "contract_unavailable" }> | Readonly<{ status: "invalid_structure" }> | Readonly<{ status: "document_storage_error" }>> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
}

function isPdf(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

export function calculateContractDocumentSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

async function reconcileExistingContentHash(
  repository: ReservationContractDocumentRepository,
  storage: ReservationContractDocumentStorage,
  row: ReservationContractDocumentRow,
  scope: Readonly<{ agencyId: string; reservationId: string; contractInstanceId: string }>,
): Promise<"ready" | "invalid_structure" | "document_storage_error"> {
  if (!row.storagePath) return "invalid_structure";
  if (row.contentSha256 !== null) return isSha256(row.contentSha256) ? "ready" : "invalid_structure";
  let storedBytes: Uint8Array;
  try { storedBytes = await storage.download(row.storagePath); }
  catch { return "document_storage_error"; }
  if (!isPdf(storedBytes)) return "invalid_structure";
  try {
    await repository.updateContentSha256({ ...scope, contentSha256: calculateContractDocumentSha256(storedBytes) });
    return "ready";
  } catch {
    return "document_storage_error";
  }
}

function publicDocument(row: ReservationContractDocumentRow, instance: ReservationContractInstanceRow): ReservationContractDocument | null {
  if (row.status !== "available" || row.version !== 1 || !row.generatedAt || (instance.status !== "prepared" && instance.status !== "accepted")) return null;
  return { documentType: "contract", documentVersion: 1, contractTemplateVersion: instance.contractTemplateVersion, contractStatus: instance.status, generatedAt: row.generatedAt };
}

async function bestEffortRemove(storage: ReservationContractDocumentStorage, path: string) {
  try { await storage.remove(path); } catch { /* A retry uses a new document path. */ }
}

/** Admin-only command; all contract prose is read from immutable instance snapshots. */
export function createReservationContractDocumentService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: ReservationContractDocumentRepository | (() => ReservationContractDocumentRepository);
  storage: ReservationContractDocumentStorage | (() => ReservationContractDocumentStorage);
  renderPdf: ReservationContractPdfRenderer;
  now?: () => Date;
  createDocumentId?: () => string;
}>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  const storage = () => typeof dependencies.storage === "function" ? dependencies.storage() : dependencies.storage;
  return {
    async ensure(input: EnsureReservationContractDocumentInput): Promise<EnsureReservationContractDocumentResult> {
      let access: AdminAgencyAccess;
      try { access = await dependencies.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
      catch { throw new ReservationContractDocumentError(); }
      const denied = accessResult(access);
      if (denied) return denied;
      if (access.status !== "authorized") return { status: "forbidden" };
      if (typeof input.reservationId !== "string" || !isAdminReservationUuid(input.reservationId)) return { status: "not_found" };

      const agencyId = access.agency.agencyId;
      const reservationId = input.reservationId;
      try {
        const data = repository();
        const reservation = await data.findReservation({ agencyId, reservationId });
        if (!reservation) return { status: "not_found" };
        const instance = await data.findLatestInstance({ agencyId, reservationId });
        if (!instance) return { status: "contract_not_prepared" };
        if (instance.status === "superseded" || instance.status === "revoked") return { status: "contract_unavailable" };
        if (instance.status !== "prepared" && instance.status !== "accepted" || !isAdminReservationUuid(instance.id) || !Number.isInteger(instance.contractTemplateVersion) || instance.contractTemplateVersion < 1 || Number.isNaN(new Date(instance.preparedAt).getTime())) return { status: "invalid_structure" };
        const existing = await data.findExistingDocument({ agencyId, reservationId, contractInstanceId: instance.id });
        if (existing) {
          const document = publicDocument(existing, instance);
          if (!document) return { status: "invalid_structure" };
          const integrity = await reconcileExistingContentHash(data, storage(), existing, { agencyId, reservationId, contractInstanceId: instance.id });
          return integrity === "ready" ? { status: "existing", document } : { status: integrity };
        }
        const legal = legalSnapshot(instance.legalProfileSnapshot);
        const content = contentSnapshot(instance.contractContentSnapshot, instance.contractTemplateVersion);
        if (!legal || !content) return { status: "invalid_structure" };
        const projected = projectReservationSnapshotOperational(reservation);
        const documentId = (dependencies.createDocumentId ?? crypto.randomUUID)();
        if (!isAdminReservationUuid(documentId)) return { status: "invalid_structure" };
        const generatedAt = (dependencies.now ?? (() => new Date()))().toISOString();
        const path = `${agencyId}/${reservationId}/contract/${documentId}/v1.pdf`;
        const pdf = await dependencies.renderPdf({
          agency: legal,
          contract: { templateVersion: content.templateVersion, status: instance.status, preparedAt: instance.preparedAt, title: content.title, introductoryText: content.introductoryText, termsText: content.termsText, paymentPolicyText: content.paymentPolicyText, cancellationPolicyText: content.cancellationPolicyText, travelerResponsibilityText: content.travelerResponsibilityText, jurisdictionText: content.jurisdictionText, effectiveFrom: content.effectiveFrom },
          reservation: { code: projected.reservationCode, tripName: projected.trip.name, tripCode: projected.trip.code, departureDate: projected.trip.departureDate, boarding: projected.trip.boardingPointName, rooms: projected.occupancy.rooms, adults: projected.occupancy.adults, minors: projected.occupancy.minors, travelers: projected.occupancy.totalTravelers, currency: projected.amounts.currency, total: projected.amounts.total, depositAmount: projected.amounts.depositAmount, depositPercent: projected.amounts.depositPercent },
        });
        if (!isPdf(pdf)) return { status: "invalid_structure" };
        const contentSha256 = calculateContractDocumentSha256(pdf);
        try { await storage().upload({ path, bytes: pdf, mimeType: "application/pdf" }); }
        catch { return { status: "document_storage_error" }; }
        try {
          const row = await data.insertDocument({ reservationId, agencyId, documentType: "contract", status: "available", storagePath: path, mimeType: "application/pdf", fileSizeBytes: pdf.length, version: 1, paymentId: null, contractInstanceId: instance.id, contentSha256, generatedAt, createdByUserId: access.identity.userId });
          const document = publicDocument(row, instance);
          if (!document) { await bestEffortRemove(storage(), path); return { status: "invalid_structure" }; }
          return { status: "generated", document };
        } catch (error) {
          await bestEffortRemove(storage(), path);
          if (isUniqueViolation(error)) {
            const concurrent = await data.findExistingDocument({ agencyId, reservationId, contractInstanceId: instance.id });
            const document = concurrent ? publicDocument(concurrent, instance) : null;
            if (document && concurrent) {
              const integrity = await reconcileExistingContentHash(data, storage(), concurrent, { agencyId, reservationId, contractInstanceId: instance.id });
              if (integrity === "ready") return { status: "existing", document };
              return { status: integrity };
            }
          }
          throw new ReservationContractDocumentError();
        }
      } catch (error) {
        if (error instanceof ReservationContractDocumentError) throw error;
        throw new ReservationContractDocumentError();
      }
    },
  };
}
