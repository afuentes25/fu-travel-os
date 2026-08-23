import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentEligibilityRepository } from "./document-eligibility-core";

const fail = () => new Error("No fue posible calcular la elegibilidad documental.");

/** Service-role reads are all constrained by reservation_id + agency_id after admin authorization. */
export function createSupabaseDocumentEligibilityRepository(supabase: SupabaseClient = getSupabaseServerClient()): DocumentEligibilityRepository {
  return {
    async findReservation({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_snapshots").select("id, reservation_code, status, currency, created_at, snapshot").eq("id", reservationId).eq("agency_id", agencyId).maybeSingle();
      if (error) throw fail(); return data ?? null;
    },
    async findPayments({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_payments").select("amount, currency, status").eq("reservation_id", reservationId).eq("agency_id", agencyId);
      if (error) throw fail(); return data ?? [];
    },
    async findTravelerSlots({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_travelers").select("id, position, traveler_type, status").eq("reservation_id", reservationId).eq("agency_id", agencyId);
      if (error) throw fail(); return data ?? [];
    },
    async hasAcceptedContract({ agencyId, reservationId }) {
      const { data: instance, error: instanceError } = await supabase.from("reservation_contract_instances").select("id").eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("status", "accepted").maybeSingle();
      if (instanceError) throw fail(); if (!instance) return false;
      const { data: acceptance, error: acceptanceError } = await supabase.from("reservation_contract_acceptances").select("contract_document_id, document_content_sha256").eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("contract_instance_id", instance.id).maybeSingle();
      if (acceptanceError) throw fail(); if (!acceptance) return false;
      const { data: document, error: documentError } = await supabase.from("reservation_documents").select("id").eq("id", acceptance.contract_document_id).eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("contract_instance_id", instance.id).eq("document_type", "contract").eq("status", "available").eq("version", 1).eq("content_sha256", acceptance.document_content_sha256).maybeSingle();
      if (documentError) throw fail(); return Boolean(document);
    },
  };
}
