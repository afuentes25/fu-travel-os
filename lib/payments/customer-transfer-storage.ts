import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { CustomerTransferStorageClient, DetectedCustomerTransferFile } from "./customer-transfer-core";

export const CUSTOMER_TRANSFER_EVIDENCE_BUCKET = "payment-evidence";

function storageFailure() {
  return new Error("No fue posible almacenar el comprobante de transferencia.");
}

/** Private-bucket adapter. It never creates public or signed URLs. */
export function createSupabaseCustomerTransferStorage(
  supabase: SupabaseClient = getSupabaseServerClient(),
): CustomerTransferStorageClient {
  return {
    async upload({ path, bytes, mimeType }) {
      const { error } = await supabase.storage
        .from(CUSTOMER_TRANSFER_EVIDENCE_BUCKET)
        .upload(path, bytes, { contentType: mimeType, upsert: false });
      if (error) throw storageFailure();
    },
    async remove(path) {
      const { error } = await supabase.storage
        .from(CUSTOMER_TRANSFER_EVIDENCE_BUCKET)
        .remove([path]);
      if (error) throw storageFailure();
    },
  };
}
