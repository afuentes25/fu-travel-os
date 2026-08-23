import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  BoardingCredentialRow,
  BoardingScanRepository,
  BoardingStateRow,
  BoardingTicketRow,
  BoardingTransitionStatus,
  BoardingTravelerRow,
} from "./boarding-scan-core";

function failure() {
  return new Error("No fue posible procesar el control de abordaje.");
}

function state(row: Record<string, unknown>): BoardingStateRow {
  return {
    status: String(row.status),
    checkedInAt: typeof row.checked_in_at === "string" ? row.checked_in_at : null,
    boardedAt: typeof row.boarded_at === "string" ? row.boarded_at : null,
  };
}

function transition(data: unknown): Readonly<{ status: BoardingTransitionStatus; checkedInAt: string | null; boardedAt: string | null }> {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const allowed: readonly BoardingTransitionStatus[] = ["checked_in", "already_checked_in", "already_boarded", "boarded", "check_in_required", "credential_unavailable", "invalid_structure"];
  if (!row || typeof row.result_status !== "string" || !allowed.includes(row.result_status as BoardingTransitionStatus)) throw failure();
  return { status: row.result_status as BoardingTransitionStatus, checkedInAt: typeof row.checked_in_at === "string" ? row.checked_in_at : null, boardedAt: typeof row.boarded_at === "string" ? row.boarded_at : null };
}

export function createSupabaseBoardingScanRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): BoardingScanRepository {
  return {
    async findCredential({ agencyId, tokenSha256 }) {
      const { data, error } = await supabase.from("traveler_boarding_credentials")
        .select("id,reservation_id,reservation_traveler_id,ticket_document_id,status")
        .eq("agency_id", agencyId).eq("token_sha256", tokenSha256).maybeSingle();
      if (error) throw failure();
      return data ? { id: String(data.id), reservationId: String(data.reservation_id), travelerId: String(data.reservation_traveler_id), ticketDocumentId: String(data.ticket_document_id), status: String(data.status) } satisfies BoardingCredentialRow : null;
    },
    async findTicket({ agencyId, ticketDocumentId, reservationId, travelerId }) {
      const { data, error } = await supabase.from("reservation_documents")
        .select("id,document_type,status,reservation_id,reservation_traveler_id")
        .eq("id", ticketDocumentId).eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("reservation_traveler_id", travelerId).maybeSingle();
      if (error) throw failure();
      return data ? { id: String(data.id), documentType: String(data.document_type), status: String(data.status), reservationId: String(data.reservation_id), travelerId: String(data.reservation_traveler_id) } satisfies BoardingTicketRow : null;
    },
    async findTraveler({ agencyId, reservationId, travelerId }) {
      const { data, error } = await supabase.from("reservation_travelers")
        .select("id,reservation_id,position,traveler_type,status,first_name,last_name")
        .eq("id", travelerId).eq("reservation_id", reservationId).eq("agency_id", agencyId).maybeSingle();
      if (error) throw failure();
      return data ? { id: String(data.id), reservationId: String(data.reservation_id), position: Number(data.position), travelerType: String(data.traveler_type), status: String(data.status), firstName: typeof data.first_name === "string" ? data.first_name : null, lastName: typeof data.last_name === "string" ? data.last_name : null } satisfies BoardingTravelerRow : null;
    },
    async findReservation({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_snapshots")
        .select("id,reservation_code,status,currency,created_at,snapshot")
        .eq("id", reservationId).eq("agency_id", agencyId).maybeSingle();
      if (error) throw failure();
      return data ?? null;
    },
    async findBoardingState({ agencyId, reservationId, travelerId }) {
      const { data, error } = await supabase.from("traveler_boarding_state")
        .select("status,checked_in_at,boarded_at")
        .eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("reservation_traveler_id", travelerId).maybeSingle();
      if (error) throw failure();
      return data ? state(data as Record<string, unknown>) : null;
    },
    async checkIn({ agencyId, tokenSha256, actorUserId }) {
      const { data, error } = await supabase.rpc("check_in_traveler_atomic", {
        target_agency_id: agencyId, target_token_sha256: tokenSha256, target_actor_user_id: actorUserId,
      });
      if (error) throw failure();
      return transition(data);
    },
    async board({ agencyId, tokenSha256, actorUserId }) {
      const { data, error } = await supabase.rpc("board_traveler_atomic", {
        target_agency_id: agencyId, target_token_sha256: tokenSha256, target_actor_user_id: actorUserId,
      });
      if (error) throw failure();
      return transition(data);
    },
    async listBoardingStates({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("traveler_boarding_state")
        .select("status,checked_in_at,boarded_at")
        .eq("agency_id", agencyId).eq("reservation_id", reservationId);
      if (error) throw failure();
      return (data ?? []).map((row) => state(row as Record<string, unknown>));
    },
  };
}
