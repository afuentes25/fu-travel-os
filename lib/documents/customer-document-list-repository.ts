import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerDocumentListRepositoryClient } from "./customer-document-list-core";
function failure() { return new Error("No fue posible consultar los documentos."); }
export function createSupabaseCustomerDocumentListRepository(supabase: SupabaseClient = getSupabaseServerClient()): CustomerDocumentListRepositoryClient {
  return {
    async findLinkedReservation({ customerAccountId, agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_customer_access").select("reservation_snapshots!reservation_customer_access_reservation_agency_foreign_key(id)").eq("customer_account_id", customerAccountId).eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("reservation_snapshots.agency_id", agencyId).maybeSingle();
      if (error) throw failure(); const linked = data as { reservation_snapshots: { id: string } | { id: string }[] | null } | null; return Boolean(Array.isArray(linked?.reservation_snapshots) ? linked?.reservation_snapshots[0] : linked?.reservation_snapshots);
    },
    async listAvailableDocuments({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_documents").select("id, document_type, version, generated_at, payment_id, contract_acceptance_id").eq("reservation_id", reservationId).eq("agency_id", agencyId).eq("status", "available").order("generated_at", { ascending: false });
      if (error) throw failure(); return (data ?? []).map((row) => ({ id: String(row.id), documentType: String(row.document_type), version: Number(row.version), generatedAt: String(row.generated_at), paymentId: typeof row.payment_id === "string" ? row.payment_id : null, contractAcceptanceId: typeof row.contract_acceptance_id === "string" ? row.contract_acceptance_id : null }));
    },
    async findPaymentContexts({ agencyId, reservationId, paymentIds }) {
      if (!paymentIds.length) return new Map(); const { data, error } = await supabase.from("reservation_payments").select("id, amount, currency, paid_at").eq("reservation_id", reservationId).eq("agency_id", agencyId).in("id", [...paymentIds]);
      if (error) throw failure(); return new Map((data ?? []).map((row) => [String(row.id), { id: String(row.id), amount: Number(row.amount), currency: String(row.currency), paidAt: typeof row.paid_at === "string" ? row.paid_at : null }]));
    },
    async findAcceptanceContexts({ agencyId, reservationId, acceptanceIds }) {
      if (!acceptanceIds.length) return new Map(); const { data, error } = await supabase.from("reservation_contract_acceptances").select("id, accepted_at").eq("reservation_id", reservationId).eq("agency_id", agencyId).in("id", [...acceptanceIds]);
      if (error) throw failure(); return new Map((data ?? []).flatMap((row) => typeof row.accepted_at === "string" ? [[String(row.id), { acceptedAt: row.accepted_at }] as const] : []));
    },
  };
}
