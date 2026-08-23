import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import { PAYMENT_RECEIPT_DOCUMENTS_BUCKET } from "./payment-receipt-storage";

export const RESERVATION_CONTRACT_DOCUMENTS_BUCKET = PAYMENT_RECEIPT_DOCUMENTS_BUCKET;

export interface ReservationContractDocumentStorage {
  upload(input: Readonly<{ path: string; bytes: Uint8Array; mimeType: "application/pdf" }>): Promise<void>;
  download(path: string): Promise<Uint8Array>;
  remove(path: string): Promise<void>;
}

/** Private Storage adapter; no signed URLs or object paths leave this module. */
export function createSupabaseReservationContractDocumentStorage(
  supabase: SupabaseClient = getSupabaseServerClient(),
): ReservationContractDocumentStorage {
  return {
    async upload({ path, bytes, mimeType }) {
      const { error } = await supabase.storage.from(RESERVATION_CONTRACT_DOCUMENTS_BUCKET)
        .upload(path, bytes, { contentType: mimeType, upsert: false });
      if (error) throw new Error("No fue posible guardar el contrato.");
    },
    async download(path) {
      const { data, error } = await supabase.storage.from(RESERVATION_CONTRACT_DOCUMENTS_BUCKET)
        .download(path);
      if (error || !data) throw new Error("No fue posible leer el contrato.");
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(path) {
      const { error } = await supabase.storage.from(RESERVATION_CONTRACT_DOCUMENTS_BUCKET)
        .remove([path]);
      if (error) throw new Error("No fue posible limpiar el contrato.");
    },
  };
}
