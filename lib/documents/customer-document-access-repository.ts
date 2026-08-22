import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerDocumentAccessRepositoryClient } from "./customer-document-access-core";
function failure() { return new Error("No fue posible abrir el documento."); }
export function createSupabaseCustomerDocumentAccessRepository(supabase: SupabaseClient = getSupabaseServerClient()): CustomerDocumentAccessRepositoryClient {
  return {
    async findLinkedReservation({ customerAccountId, agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_customer_access").select("reservation_snapshots!reservation_customer_access_reservation_agency_foreign_key(id)").eq("customer_account_id", customerAccountId).eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("reservation_snapshots.agency_id", agencyId).maybeSingle();
      if (error) throw failure(); const linked = data as { reservation_snapshots: { id: string } | { id: string }[] | null } | null; return Boolean(Array.isArray(linked?.reservation_snapshots) ? linked?.reservation_snapshots[0] : linked?.reservation_snapshots);
    },
    async findAvailableDocument({ agencyId, reservationId, documentKey }) {
      const { data, error } = await supabase.from("reservation_documents").select("storage_path").eq("id", documentKey).eq("reservation_id", reservationId).eq("agency_id", agencyId).eq("status", "available").maybeSingle();
      if (error) throw failure(); return data && typeof data.storage_path === "string" ? { storagePath: data.storage_path } : null;
    },
  };
}
