import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { CustomerTransferStorageClient } from "./customer-transfer-core";

export const CUSTOMER_TRANSFER_EVIDENCE_BUCKET = "payment-evidence";

function storageFailure() {
  return new Error("No fue posible almacenar el comprobante de transferencia.");
}

/** Private-bucket adapter. Browser access is limited to a short-lived upload token. */
export function createSupabaseCustomerTransferStorage(
  supabase: SupabaseClient = getSupabaseServerClient(),
): CustomerTransferStorageClient {
  return {
    async createSignedUpload({ path }) {
      const { data, error } = await supabase.storage
        .from(CUSTOMER_TRANSFER_EVIDENCE_BUCKET)
        .createSignedUploadUrl(path, { upsert: false });
      if (error || !data?.token || !data.path) throw storageFailure();
      return { path: data.path, token: data.token };
    },
    async download(path) {
      const { data, error } = await supabase.storage
        .from(CUSTOMER_TRANSFER_EVIDENCE_BUCKET)
        .download(path);
      if (error || !data) throw storageFailure();
      return new Uint8Array(await data.arrayBuffer());
    },
    async move({ fromPath, toPath }) {
      const { error } = await supabase.storage
        .from(CUSTOMER_TRANSFER_EVIDENCE_BUCKET)
        .move(fromPath, toPath);
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
