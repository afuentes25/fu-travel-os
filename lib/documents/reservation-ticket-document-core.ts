import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { calculateContractDocumentSha256 } from "@/lib/documents/reservation-contract-document-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";
import { projectReservationSnapshotOperational, type ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import type { TicketEligibilityBlocker } from "@/lib/travel-documents/document-eligibility-core";

import type { ReservationTicketPdfData } from "./reservation-ticket-document-pdf";
import type { ReservationTicketDocumentStorage } from "./reservation-ticket-document-storage";

export type EnsureReservationTravelerTicketResult =
  | Readonly<{ status: "generated" | "existing"; ticket: Readonly<{ travelerPosition: number; travelerName: string; travelerType: "adult" | "minor"; version: number; generatedAt: string }> }>
  | Readonly<{ status: "not_eligible"; blockers: readonly TicketEligibilityBlocker[] }>
  | Readonly<{ status: "traveler_incomplete" }>
  | Readonly<{ status: "unauthenticated" | "selection_required" | "forbidden" | "not_found" | "invalid_structure" | "document_storage_error" }>;

export type ReservationTicketTravelerRow = Readonly<{
  id: string;
  position: number;
  travelerType: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
}>;
export type ReservationTicketDocumentRow = Readonly<{ status: string; version: number; generatedAt: string }>;

export interface ReservationTicketRepository {
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<ReservationSnapshotProjectionSource | null>;
  findTraveler(input: Readonly<{ agencyId: string; reservationId: string; travelerKey: string }>): Promise<ReservationTicketTravelerRow | null>;
  listTickets(input: Readonly<{ agencyId: string; reservationId: string; travelerId: string }>): Promise<readonly ReservationTicketDocumentRow[]>;
  insertTicket(input: Readonly<{ agencyId: string; reservationId: string; travelerId: string; version: number; storagePath: string; fileSizeBytes: number; contentSha256: string; generatedAt: string; createdByUserId: string }>): Promise<ReservationTicketDocumentRow>;
}

export class ReservationTicketDocumentError extends Error {
  readonly name = "ReservationTicketDocumentError";
  constructor() { super("No fue posible generar el boleto."); }
}

type TicketEligibilityResult = Readonly<{ status?: string; eligibility?: Readonly<{ ticket: Readonly<{ eligible: boolean; blockers: readonly TicketEligibilityBlocker[] }> }> }>;
const isUuid = (value: unknown): value is string => typeof value === "string" && isAdminReservationUuid(value);
const isPdf = (bytes: Uint8Array) => bytes.length > 4 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70;
const available = (rows: readonly ReservationTicketDocumentRow[]) => rows.find((row) => row.status === "available") ?? null;

function ticketResult(traveler: ReservationTicketTravelerRow, row: ReservationTicketDocumentRow, status: "generated" | "existing") {
  if (!Number.isInteger(traveler.position) || traveler.position <= 0 || !traveler.firstName || !traveler.lastName || (traveler.travelerType !== "adult" && traveler.travelerType !== "minor") || !Number.isInteger(row.version) || row.version <= 0 || !row.generatedAt) return null;
  return { status, ticket: { travelerPosition: traveler.position, travelerName: `${traveler.firstName} ${traveler.lastName}`, travelerType: traveler.travelerType, version: row.version, generatedAt: row.generatedAt } } as const;
}

/** Admin-only issuer for one traveler ticket; all reservation gates remain in the shared eligibility engine. */
export function createReservationTicketDocumentService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  eligibility: (input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>) => Promise<unknown>;
  repository: ReservationTicketRepository | (() => ReservationTicketRepository);
  storage: ReservationTicketDocumentStorage | (() => ReservationTicketDocumentStorage);
  renderPdf: (data: ReservationTicketPdfData) => Promise<Uint8Array>;
  now?: () => Date;
  createDocumentId?: () => string;
}>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  const storage = () => typeof dependencies.storage === "function" ? dependencies.storage() : dependencies.storage;
  return {
    async ensure(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown; travelerKey: unknown }>): Promise<EnsureReservationTravelerTicketResult> {
      let access: AdminAgencyAccess;
      try { access = await dependencies.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
      catch { throw new ReservationTicketDocumentError(); }
      if (access.status !== "authorized") return access;
      if (!isUuid(input.reservationId) || !isUuid(input.travelerKey)) return { status: "not_found" };
      const reservationId = input.reservationId;
      const eligibility = await dependencies.eligibility({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined, reservationId }) as TicketEligibilityResult;
      if (eligibility.status !== "authorized" || !eligibility.eligibility) return eligibility.status === "not_found" ? { status: "not_found" } : { status: "invalid_structure" };
      if (!eligibility.eligibility.ticket.eligible) return { status: "not_eligible", blockers: eligibility.eligibility.ticket.blockers };
      try {
        const data = repository();
        const scope = { agencyId: access.agency.agencyId, reservationId };
        const traveler = await data.findTraveler({ ...scope, travelerKey: input.travelerKey });
        if (!traveler) return { status: "not_found" };
        if (traveler.status !== "complete") return { status: "traveler_incomplete" };
        if (!traveler.firstName || !traveler.lastName || (traveler.travelerType !== "adult" && traveler.travelerType !== "minor")) return { status: "invalid_structure" };
        const ticketRows = await data.listTickets({ ...scope, travelerId: traveler.id });
        const current = available(ticketRows);
        if (current) return ticketResult(traveler, current, "existing") ?? { status: "invalid_structure" };
        const reservation = await data.findReservation(scope);
        if (!reservation) return { status: "not_found" };
        const projected = projectReservationSnapshotOperational(reservation);
        if (!projected.trip.departureDate || !projected.trip.boardingPointName) return { status: "invalid_structure" };
        const version = Math.max(0, ...ticketRows.map((row) => row.version)) + 1;
        const documentId = (dependencies.createDocumentId ?? crypto.randomUUID)();
        if (!isUuid(documentId)) return { status: "invalid_structure" };
        const generatedAt = (dependencies.now ?? (() => new Date()))().toISOString();
        const bytes = await dependencies.renderPdf({ agencyName: access.agency.agencyName, version, generatedAt, traveler: { position: traveler.position, firstName: traveler.firstName, lastName: traveler.lastName, travelerType: traveler.travelerType }, reservation: { code: projected.reservationCode, tripName: projected.trip.name, tripCode: projected.trip.code, departureDate: projected.trip.departureDate, boarding: projected.trip.boardingPointName, currency: projected.amounts.currency } });
        if (!isPdf(bytes)) return { status: "invalid_structure" };
        const storagePath = `${scope.agencyId}/${scope.reservationId}/ticket/${traveler.id}/${documentId}/v${version}.pdf`;
        try { await storage().upload({ path: storagePath, bytes, mimeType: "application/pdf" }); }
        catch { return { status: "document_storage_error" };
        }
        try {
          const row = await data.insertTicket({ ...scope, travelerId: traveler.id, version, storagePath, fileSizeBytes: bytes.length, contentSha256: calculateContractDocumentSha256(bytes), generatedAt, createdByUserId: access.identity.userId });
          return ticketResult(traveler, row, "generated") ?? { status: "invalid_structure" };
        } catch (error) {
          try { await storage().remove(storagePath); } catch { /* best-effort compensation */ }
          if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505") {
            const concurrent = available(await data.listTickets({ ...scope, travelerId: traveler.id }));
            if (concurrent) return ticketResult(traveler, concurrent, "existing") ?? { status: "invalid_structure" };
          }
          throw new ReservationTicketDocumentError();
        }
      } catch (error) {
        if (error instanceof ReservationTicketDocumentError) throw error;
        throw new ReservationTicketDocumentError();
      }
    },
  };
}
