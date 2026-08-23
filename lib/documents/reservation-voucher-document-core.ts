import { calculateContractDocumentSha256 } from "@/lib/documents/reservation-contract-document-core";
import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";
import { projectReservationSnapshotOperational, type ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import type { VoucherEligibilityBlocker } from "@/lib/travel-documents/document-eligibility-core";
import type { ReservationVoucherPdfData } from "./reservation-voucher-document-pdf";
import type { ReservationVoucherDocumentStorage } from "./reservation-voucher-document-storage";

export type EnsureReservationVoucherResult =
  | Readonly<{ status: "generated" | "existing"; voucher: Readonly<{ version: number; generatedAt: string }> }>
  | Readonly<{ status: "not_eligible"; blockers: readonly VoucherEligibilityBlocker[] }>
  | Readonly<{ status: "unauthenticated" | "selection_required" | "forbidden" | "not_found" | "invalid_structure" | "document_storage_error" }>;

export type VoucherDocumentRow = Readonly<{ status: string; version: number; generatedAt: string }>;
export type VoucherTravelerRow = Readonly<{ position: number; travelerType: string; status: string; firstName: string | null; lastName: string | null }>;

export interface ReservationVoucherRepository {
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<ReservationSnapshotProjectionSource | null>;
  listTravelers(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<readonly VoucherTravelerRow[]>;
  listVouchers(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<readonly VoucherDocumentRow[]>;
  insertVoucher(input: Readonly<{ agencyId: string; reservationId: string; version: number; storagePath: string; fileSizeBytes: number; contentSha256: string; generatedAt: string; createdByUserId: string }>): Promise<VoucherDocumentRow>;
}

export class ReservationVoucherDocumentError extends Error {
  readonly name = "ReservationVoucherDocumentError";
  constructor() { super("No fue posible generar el Voucher."); }
}

type VoucherEligibilityResult = Readonly<{ status?: string; eligibility?: Readonly<{ voucher: Readonly<{ eligible: boolean; blockers: readonly VoucherEligibilityBlocker[] }> }> }>;
const isPdf = (bytes: Uint8Array) => bytes.length > 4 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70;
const isUuid = (value: unknown): value is string => typeof value === "string" && isAdminReservationUuid(value);
const findAvailableVoucher = (rows: readonly VoucherDocumentRow[]) => rows.find((row) => row.status === "available") ?? null;
const safeVoucher = (row: VoucherDocumentRow) => row.status === "available" && Number.isInteger(row.version) && row.version > 0 && row.generatedAt ? { version: row.version, generatedAt: row.generatedAt } : null;

/** Generates a reservation-level Voucher only after the shared eligibility engine approves it. */
export function createReservationVoucherDocumentService(deps: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  eligibility: (input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>) => Promise<unknown>;
  repository: ReservationVoucherRepository | (() => ReservationVoucherRepository);
  storage: ReservationVoucherDocumentStorage | (() => ReservationVoucherDocumentStorage);
  renderPdf: (data: ReservationVoucherPdfData) => Promise<Uint8Array>;
  now?: () => Date;
  createDocumentId?: () => string;
}>) {
  const repository = () => typeof deps.repository === "function" ? deps.repository() : deps.repository;
  const storage = () => typeof deps.storage === "function" ? deps.storage() : deps.storage;
  return {
    async ensure(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown }>): Promise<EnsureReservationVoucherResult> {
      let access: AdminAgencyAccess;
      try { access = await deps.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
      catch { throw new ReservationVoucherDocumentError(); }
      if (access.status !== "authorized") return access;
      if (!isUuid(input.reservationId)) return { status: "not_found" };
      const reservationId = input.reservationId;
      const eligibility = await deps.eligibility({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined, reservationId }) as VoucherEligibilityResult;
      if (eligibility.status !== "authorized" || !eligibility.eligibility) return eligibility.status === "not_found" ? { status: "not_found" } : { status: "invalid_structure" };
      if (!eligibility.eligibility.voucher.eligible) return { status: "not_eligible", blockers: eligibility.eligibility.voucher.blockers };
      try {
        const data = repository();
        const scope = { agencyId: access.agency.agencyId, reservationId };
        const existingRows = await data.listVouchers(scope);
        const available = findAvailableVoucher(existingRows);
        if (available) { const voucher = safeVoucher(available); return voucher ? { status: "existing", voucher } : { status: "invalid_structure" }; }
        const reservation = await data.findReservation(scope);
        if (!reservation) return { status: "not_found" };
        const projected = projectReservationSnapshotOperational(reservation);
        if (!projected.trip.departureDate || projected.amounts.total === null || projected.amounts.depositAmount === null) return { status: "invalid_structure" };
        const travelers = Array.from(await data.listTravelers(scope)).sort((left, right) => left.position - right.position);
        if (!travelers.length || travelers.some((traveler) => traveler.status !== "complete" || !traveler.firstName || !traveler.lastName || (traveler.travelerType !== "adult" && traveler.travelerType !== "minor"))) return { status: "invalid_structure" };
        const version = Math.max(0, ...existingRows.map((row) => row.version)) + 1;
        const documentId = (deps.createDocumentId ?? crypto.randomUUID)();
        if (!isUuid(documentId)) return { status: "invalid_structure" };
        const generatedAt = (deps.now ?? (() => new Date()))().toISOString();
        const bytes = await deps.renderPdf({ agencyName: access.agency.agencyName, version, generatedAt, reservation: { code: projected.reservationCode, tripName: projected.trip.name, tripCode: projected.trip.code, departureDate: projected.trip.departureDate, boarding: projected.trip.boardingPointName, rooms: projected.occupancy.rooms, adults: projected.occupancy.adults, minors: projected.occupancy.minors, travelers: projected.occupancy.totalTravelers, total: projected.amounts.total, depositRequired: projected.amounts.depositAmount, currency: projected.amounts.currency }, travelers: travelers.map((traveler) => ({ firstName: traveler.firstName!, lastName: traveler.lastName!, travelerType: traveler.travelerType as "adult" | "minor" })) });
        if (!isPdf(bytes)) return { status: "invalid_structure" };
        const storagePath = `${scope.agencyId}/${scope.reservationId}/voucher/${documentId}/v${version}.pdf`;
        try { await storage().upload({ path: storagePath, bytes, mimeType: "application/pdf" }); }
        catch { return { status: "document_storage_error" }; }
        try {
          const row = await data.insertVoucher({ ...scope, version, storagePath, fileSizeBytes: bytes.length, contentSha256: calculateContractDocumentSha256(bytes), generatedAt, createdByUserId: access.identity.userId });
          const voucher = safeVoucher(row);
          return voucher ? { status: "generated", voucher } : { status: "invalid_structure" };
        } catch (error) {
          try { await storage().remove(storagePath); } catch { /* best-effort compensation */ }
          if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505") {
            const concurrent = findAvailableVoucher(await data.listVouchers(scope));
            const voucher = concurrent ? safeVoucher(concurrent) : null;
            if (voucher) return { status: "existing", voucher };
          }
          throw new ReservationVoucherDocumentError();
        }
      } catch (error) {
        if (error instanceof ReservationVoucherDocumentError) throw error;
        throw new ReservationVoucherDocumentError();
      }
    },
  };
}
