import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { AdminPaymentEvidenceRepositoryClient } from "./admin-payment-evidence-core";

function databaseFailure() {
  return new Error("No fue posible consultar el comprobante de pago.");
}

/** Service-role adapter reached only after verified membership authorization. */
export function createSupabaseAdminPaymentEvidenceRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AdminPaymentEvidenceRepositoryClient {
  return {
    async findReservation({ agencyId, reservationId }) {
      const { data, error } = await supabase
        .from("reservation_snapshots")
        .select("id")
        .eq("id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure();
      return Boolean(data);
    },
    async findPayment({ agencyId, reservationId, paymentId }) {
      const { data, error } = await supabase
        .from("reservation_payments")
        .select("id")
        .eq("id", paymentId)
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure();
      return Boolean(data);
    },
    async findEvidence({ agencyId, reservationId, paymentId }) {
      const { data, error } = await supabase
        .from("payment_evidence")
        .select("storage_path, mime_type")
        .eq("payment_id", paymentId)
        .eq("reservation_id", reservationId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (error) throw databaseFailure();
      if (!data || typeof data.storage_path !== "string" || typeof data.mime_type !== "string") return null;
      return { storagePath: data.storage_path, mimeType: data.mime_type };
    },
  };
}
