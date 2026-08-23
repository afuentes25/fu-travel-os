import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";
import { isCustomerReservationUuid } from "@/lib/customers/customer-reservation-detail-core";
import { calculateContractDocumentSha256 } from "@/lib/documents/reservation-contract-document-core";
import type { ReservationContractDocumentStorage } from "@/lib/documents/reservation-contract-document-storage";
import { projectReservationSnapshotOperational, type ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";

import type { AcceptanceCertificatePdfData } from "./acceptance-certificate-pdf";

export type EnsureAcceptanceCertificateInput = Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown }>;
export type AcceptanceCertificate = Readonly<{ documentType: "acceptance_certificate"; version: 1; generatedAt: string }>;
export type EnsureAcceptanceCertificateResult =
  | Readonly<{ status: "generated" | "existing"; certificate: AcceptanceCertificate }>
  | Readonly<{ status: "unauthenticated" | "selection_required" | "forbidden" | "not_found" | "contract_not_accepted" | "acceptance_not_found" | "document_integrity_error" | "invalid_structure" | "certificate_storage_error" }>;

export type AcceptanceCertificateInstanceRow = Readonly<{
  id: string; status: string; contractTemplateVersion: number; legalProfileSnapshot: unknown; contractContentSnapshot: unknown;
}>;
export type AcceptanceCertificateAcceptanceRow = Readonly<{
  id: string; contractDocumentId: string; documentContentSha256: string; acceptedAt: string; statementVersion: string; statement: string;
}>;
export type AcceptanceCertificateContractDocumentRow = Readonly<{
  id: string; status: string; version: number; generatedAt: string; storagePath: string; contentSha256: string | null;
}>;
export type AcceptanceCertificateExistingRow = Readonly<{
  status: string; version: number; generatedAt: string; storagePath: string; contentSha256: string | null;
}>;
export type AcceptanceCertificateInsert = Readonly<{
  reservationId: string; agencyId: string; storagePath: string; fileSizeBytes: number; contractInstanceId: string;
  contractAcceptanceId: string; paymentId: null; contentSha256: string; generatedAt: string; createdByUserId: string;
}>;

export interface AcceptanceCertificateRepository {
  findPrimaryLink(input: Readonly<{ customerAccountId: string; agencyId: string; reservationId: string }>): Promise<boolean>;
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<ReservationSnapshotProjectionSource | null>;
  findInstance(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<AcceptanceCertificateInstanceRow | null>;
  findAcceptance(input: Readonly<{ agencyId: string; reservationId: string; contractInstanceId: string }>): Promise<AcceptanceCertificateAcceptanceRow | null>;
  findContractDocument(input: Readonly<{ agencyId: string; reservationId: string; contractInstanceId: string; documentId: string }>): Promise<AcceptanceCertificateContractDocumentRow | null>;
  findExistingCertificate(input: Readonly<{ agencyId: string; reservationId: string; contractAcceptanceId: string }>): Promise<AcceptanceCertificateExistingRow | null>;
  updateExistingHash(input: Readonly<{ agencyId: string; reservationId: string; contractAcceptanceId: string; contentSha256: string }>): Promise<void>;
  insertCertificate(input: AcceptanceCertificateInsert): Promise<AcceptanceCertificateExistingRow>;
}

export type AcceptanceCertificatePdfRenderer = (data: AcceptanceCertificatePdfData) => Promise<Uint8Array>;
export class AcceptanceCertificateError extends Error { readonly name = "AcceptanceCertificateError"; constructor() { super("No fue posible generar la constancia."); } }

const sha256 = (value: string | null): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const uuid = (value: unknown): value is string => typeof value === "string" && isCustomerReservationUuid(value);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const required = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const optional = (value: unknown): string | null | undefined => value === null ? null : typeof value === "string" ? (value.trim() || null) : undefined;
const pdf = (bytes: Uint8Array) => bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

function immutableLegalName(value: unknown): string | null {
  if (!record(value)) return null;
  return required(value.legalName);
}

function immutableTaxId(value: unknown): string | null | undefined {
  return record(value) ? optional(value.taxId) : undefined;
}

function templateVersion(value: unknown, expected: number): boolean {
  return record(value) && value.templateVersion === expected && Boolean(required(value.title)) && Boolean(required(value.termsText));
}

function publicCertificate(row: AcceptanceCertificateExistingRow): AcceptanceCertificate | null {
  return row.status === "available" && row.version === 1 && Boolean(row.generatedAt)
    ? { documentType: "acceptance_certificate", version: 1, generatedAt: row.generatedAt } : null;
}

async function remove(storage: ReservationContractDocumentStorage, path: string) { try { await storage.remove(path); } catch { /* A retry stays safe due to the database uniqueness barrier. */ } }

/** Customer-primary-only document projection; it never changes the acceptance or original contract. */
export function createAcceptanceCertificateService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: AcceptanceCertificateRepository | (() => AcceptanceCertificateRepository);
  storage: ReservationContractDocumentStorage | (() => ReservationContractDocumentStorage);
  renderPdf: AcceptanceCertificatePdfRenderer;
  now?: () => Date;
  createDocumentId?: () => string;
}>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  const storage = () => typeof dependencies.storage === "function" ? dependencies.storage() : dependencies.storage;
  return { async ensure(input: EnsureAcceptanceCertificateInput): Promise<EnsureAcceptanceCertificateResult> {
    let access: CustomerAgencyAccess;
    try { access = await dependencies.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
    catch { throw new AcceptanceCertificateError(); }
    if (access.status !== "authorized") return access;
    if (!uuid(input.reservationId)) return { status: "not_found" };
    const agencyId = access.account.agencyId;
    const reservationId = input.reservationId;
    const data = repository();
    try {
      if (!await data.findPrimaryLink({ customerAccountId: access.account.customerAccountId, agencyId, reservationId })) return { status: "forbidden" };
      const reservation = await data.findReservation({ agencyId, reservationId });
      if (!reservation) return { status: "not_found" };
      const instance = await data.findInstance({ agencyId, reservationId });
      if (!instance) return { status: "contract_not_accepted" };
      if (instance.status !== "accepted") return { status: "contract_not_accepted" };
      if (!uuid(instance.id) || !Number.isInteger(instance.contractTemplateVersion) || instance.contractTemplateVersion < 1) return { status: "invalid_structure" };
      const acceptance = await data.findAcceptance({ agencyId, reservationId, contractInstanceId: instance.id });
      if (!acceptance) return { status: "acceptance_not_found" };
      if (!uuid(acceptance.id) || !uuid(acceptance.contractDocumentId) || !sha256(acceptance.documentContentSha256) || !required(acceptance.statement) || !required(acceptance.statementVersion) || Number.isNaN(new Date(acceptance.acceptedAt).getTime())) return { status: "invalid_structure" };
      const contract = await data.findContractDocument({ agencyId, reservationId, contractInstanceId: instance.id, documentId: acceptance.contractDocumentId });
      if (!contract) return { status: "invalid_structure" };
      if (contract.status !== "available" || contract.version !== 1 || !contract.storagePath || !sha256(contract.contentSha256) || contract.contentSha256 !== acceptance.documentContentSha256) return { status: "invalid_structure" };
      let contractBytes: Uint8Array;
      try { contractBytes = await storage().download(contract.storagePath); } catch { return { status: "document_integrity_error" }; }
      if (!pdf(contractBytes) || calculateContractDocumentSha256(contractBytes) !== contract.contentSha256) return { status: "document_integrity_error" };
      const existing = await data.findExistingCertificate({ agencyId, reservationId, contractAcceptanceId: acceptance.id });
      if (existing) {
        const certificate = publicCertificate(existing);
        if (!certificate || !existing.storagePath) return { status: "invalid_structure" };
        if (existing.contentSha256 === null) {
          let stored: Uint8Array;
          try { stored = await storage().download(existing.storagePath); if (!pdf(stored)) return { status: "invalid_structure" }; await data.updateExistingHash({ agencyId, reservationId, contractAcceptanceId: acceptance.id, contentSha256: calculateContractDocumentSha256(stored) }); }
          catch { return { status: "certificate_storage_error" }; }
        } else if (!sha256(existing.contentSha256)) return { status: "invalid_structure" };
        return { status: "existing", certificate };
      }
      const legalName = immutableLegalName(instance.legalProfileSnapshot);
      const taxId = immutableTaxId(instance.legalProfileSnapshot);
      if (!legalName || taxId === undefined || !templateVersion(instance.contractContentSnapshot, instance.contractTemplateVersion)) return { status: "invalid_structure" };
      const projected = projectReservationSnapshotOperational(reservation);
      const documentId = (dependencies.createDocumentId ?? crypto.randomUUID)();
      if (!uuid(documentId)) return { status: "invalid_structure" };
      const generatedAt = (dependencies.now ?? (() => new Date()))().toISOString();
      const path = `${agencyId}/${reservationId}/acceptance_certificate/${documentId}/v1.pdf`;
      const bytes = await dependencies.renderPdf({ legalName, taxId, reservationCode: projected.reservationCode, tripName: projected.trip.name, departureDate: projected.trip.departureDate, contractTemplateVersion: instance.contractTemplateVersion, contractDocumentVersion: 1, contractGeneratedAt: contract.generatedAt, contractSha256: acceptance.documentContentSha256, acceptedAt: acceptance.acceptedAt, statementVersion: acceptance.statementVersion, statement: acceptance.statement });
      if (!pdf(bytes)) return { status: "invalid_structure" };
      const contentSha256 = calculateContractDocumentSha256(bytes);
      try { await storage().upload({ path, bytes, mimeType: "application/pdf" }); } catch { return { status: "certificate_storage_error" }; }
      try {
        const row = await data.insertCertificate({ reservationId, agencyId, storagePath: path, fileSizeBytes: bytes.length, contractInstanceId: instance.id, contractAcceptanceId: acceptance.id, paymentId: null, contentSha256, generatedAt, createdByUserId: access.identity.userId });
        const certificate = publicCertificate(row);
        if (!certificate) { await remove(storage(), path); return { status: "invalid_structure" }; }
        return { status: "generated", certificate };
      } catch (error) {
        await remove(storage(), path);
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505") {
          const concurrent = await data.findExistingCertificate({ agencyId, reservationId, contractAcceptanceId: acceptance.id });
          const certificate = concurrent ? publicCertificate(concurrent) : null;
          if (certificate) return { status: "existing", certificate };
        }
        throw new AcceptanceCertificateError();
      }
    } catch (error) { if (error instanceof AcceptanceCertificateError) throw error; throw new AcceptanceCertificateError(); }
  } };
}
