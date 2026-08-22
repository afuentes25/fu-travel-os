import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { PaymentReceiptStorageClient } from "./payment-receipt-core";

export const PAYMENT_RECEIPT_DOCUMENTS_BUCKET = "reservation-documents";

/** Private-bucket adapter. It never creates or persists a signed URL. */
export function createSupabasePaymentReceiptStorage(
  supabase: SupabaseClient = getSupabaseServerClient(),
): PaymentReceiptStorageClient {
  return {
    async upload({ path, bytes, mimeType }) {
      const { error } = await supabase.storage
        .from(PAYMENT_RECEIPT_DOCUMENTS_BUCKET)
        .upload(path, bytes, { contentType: mimeType, upsert: false });
      if (error) throw new Error("No fue posible guardar el comprobante.");
    },

    async remove(path) {
      const { error } = await supabase.storage
        .from(PAYMENT_RECEIPT_DOCUMENTS_BUCKET)
        .remove([path]);
      if (error) throw new Error("No fue posible limpiar el comprobante.");
    },
  };
}
