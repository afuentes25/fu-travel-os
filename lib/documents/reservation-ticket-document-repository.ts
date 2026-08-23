import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  ReservationTicketDocumentRow,
  ReservationTicketRepository,
  ReservationTicketTravelerRow,
} from "./reservation-ticket-document-core";

export type ReservationTicketAdminDocumentRow = ReservationTicketDocumentRow & Readonly<{ travelerId: string }>;
export interface SupabaseReservationTicketRepository extends ReservationTicketRepository {
  listTravelers(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<readonly ReservationTicketTravelerRow[]>;
  listReservationTickets(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<readonly ReservationTicketAdminDocumentRow[]>;
}

function failure(error?: unknown) {
  const output = new Error("No fue posible generar el boleto.") as Error & { code?: string };
  if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string") output.code = (error as { code: string }).code;
  return output;
}

export function createSupabaseReservationTicketRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): SupabaseReservationTicketRepository {
  const projectTraveler = (row: Record<string, unknown>): ReservationTicketTravelerRow => ({
    id: String(row.id),
    position: Number(row.position),
    travelerType: String(row.traveler_type),
    status: String(row.status),
    firstName: typeof row.first_name === "string" ? row.first_name : null,
    lastName: typeof row.last_name === "string" ? row.last_name : null,
  });
  return {
    async findReservation({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_snapshots")
        .select("id,reservation_code,status,currency,created_at,snapshot")
        .eq("id", reservationId).eq("agency_id", agencyId).maybeSingle();
      if (error) throw failure(error);
      return data ?? null;
    },
    async findTraveler({ agencyId, reservationId, travelerKey }) {
      const { data, error } = await supabase.from("reservation_travelers")
        .select("id,position,traveler_type,status,first_name,last_name")
        .eq("id", travelerKey).eq("reservation_id", reservationId).eq("agency_id", agencyId).maybeSingle();
      if (error) throw failure(error);
      return data ? projectTraveler(data as Record<string, unknown>) : null;
    },
    async listTravelers({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_travelers")
        .select("id,position,traveler_type,status,first_name,last_name")
        .eq("reservation_id", reservationId).eq("agency_id", agencyId).order("position", { ascending: true });
      if (error) throw failure(error);
      return (data ?? []).map((row) => projectTraveler(row as Record<string, unknown>));
    },
    async listTickets({ agencyId, reservationId, travelerId }) {
      const { data, error } = await supabase.from("reservation_documents")
        .select("id,status,version,generated_at")
        .eq("reservation_id", reservationId).eq("agency_id", agencyId).eq("document_type", "ticket").eq("reservation_traveler_id", travelerId).order("version", { ascending: false });
      if (error) throw failure(error);
      return (data ?? []).map((row) => ({ id: String(row.id), status: String(row.status), version: Number(row.version), generatedAt: String(row.generated_at) }));
    },
    async listReservationTickets({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_documents")
        .select("id,status,version,generated_at,reservation_traveler_id")
        .eq("reservation_id", reservationId).eq("agency_id", agencyId).eq("document_type", "ticket").order("version", { ascending: false });
      if (error) throw failure(error);
      return (data ?? []).flatMap((row) => typeof row.reservation_traveler_id === "string" ? [{ travelerId: row.reservation_traveler_id, id: String(row.id), status: String(row.status), version: Number(row.version), generatedAt: String(row.generated_at) }] : []);
    },
    async hasActiveBoardingCredential({ agencyId, reservationId, travelerId, ticketDocumentId }) {
      const { data, error } = await supabase.from("traveler_boarding_credentials").select("id")
        .eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("reservation_traveler_id", travelerId)
        .eq("ticket_document_id", ticketDocumentId).eq("status", "active").maybeSingle();
      if (error) throw failure(error);
      return Boolean(data);
    },
    async finalizeTicketWithCredential(input) {
      const { data, error } = await supabase.rpc("finalize_ticket_with_boarding_credential_atomic", {
        target_agency_id: input.agencyId, target_reservation_id: input.reservationId, target_traveler_id: input.travelerId,
        target_document_id: input.documentId, target_version: input.version, target_storage_path: input.storagePath,
        target_file_size_bytes: input.fileSizeBytes, target_content_sha256: input.contentSha256, target_token_sha256: input.tokenSha256,
        target_generated_at: input.generatedAt, target_issued_by_user_id: input.issuedByUserId,
      });
      if (error) throw failure(error);
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      if (!row || typeof row.result_status !== "string") throw failure();
      const status = row.result_status;
      if (!["created", "existing", "not_found", "traveler_incomplete", "invalid_structure", "conflict"].includes(status)) throw failure();
      return { status: status as "created" | "existing" | "not_found" | "traveler_incomplete" | "invalid_structure" | "conflict", version: typeof row.ticket_version === "number" ? row.ticket_version : null, generatedAt: typeof row.ticket_generated_at === "string" ? row.ticket_generated_at : null };
    },
  };
}
