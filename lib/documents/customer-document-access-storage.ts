import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerDocumentAccessStorageClient } from "./customer-document-access-core";
export const CUSTOMER_DOCUMENTS_BUCKET = "reservation-documents";
export function createSupabaseCustomerDocumentAccessStorage(supabase: SupabaseClient = getSupabaseServerClient()): CustomerDocumentAccessStorageClient { return { async createSignedReadUrl({ path, expiresInSeconds }) { const { data, error } = await supabase.storage.from(CUSTOMER_DOCUMENTS_BUCKET).createSignedUrl(path, expiresInSeconds); if (error || !data?.signedUrl) throw new Error("No fue posible abrir el documento."); return data.signedUrl; } }; }
