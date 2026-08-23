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
        .select("status,version,generated_at")
        .eq("reservation_id", reservationId).eq("agency_id", agencyId).eq("document_type", "ticket").eq("reservation_traveler_id", travelerId).order("version", { ascending: false });
      if (error) throw failure(error);
      return (data ?? []).map((row) => ({ status: String(row.status), version: Number(row.version), generatedAt: String(row.generated_at) }));
    },
    async listReservationTickets({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_documents")
        .select("status,version,generated_at,reservation_traveler_id")
        .eq("reservation_id", reservationId).eq("agency_id", agencyId).eq("document_type", "ticket").order("version", { ascending: false });
      if (error) throw failure(error);
      return (data ?? []).flatMap((row) => typeof row.reservation_traveler_id === "string" ? [{ travelerId: row.reservation_traveler_id, status: String(row.status), version: Number(row.version), generatedAt: String(row.generated_at) }] : []);
    },
    async insertTicket(input) {
      const { data, error } = await supabase.from("reservation_documents").insert({
        reservation_id: input.reservationId,
        agency_id: input.agencyId,
        document_type: "ticket",
        status: "available",
        storage_path: input.storagePath,
        mime_type: "application/pdf",
        file_size_bytes: input.fileSizeBytes,
        version: input.version,
        payment_id: null,
        contract_instance_id: null,
        contract_acceptance_id: null,
        reservation_traveler_id: input.travelerId,
        content_sha256: input.contentSha256,
        generated_at: input.generatedAt,
        created_by_user_id: input.createdByUserId,
      }).select("status,version,generated_at").single();
      if (error) throw failure(error);
      return { status: String(data.status), version: Number(data.version), generatedAt: String(data.generated_at) };
    },
  };
}
