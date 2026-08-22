import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { AdminPaymentEvidenceStorageClient } from "./admin-payment-evidence-core";

export const ADMIN_PAYMENT_EVIDENCE_BUCKET = "payment-evidence";

function storageFailure() {
  return new Error("No fue posible abrir el comprobante de pago.");
}

/** Creates a short-lived read capability; it never streams private files through Vercel. */
export function createSupabaseAdminPaymentEvidenceStorage(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AdminPaymentEvidenceStorageClient {
  return {
    async createSignedReadUrl({ path, expiresInSeconds }) {
      const { data, error } = await supabase.storage
        .from(ADMIN_PAYMENT_EVIDENCE_BUCKET)
        .createSignedUrl(path, expiresInSeconds);
      if (error || !data?.signedUrl) throw storageFailure();
      return data.signedUrl;
    },
  };
}
