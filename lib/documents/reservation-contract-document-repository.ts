import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  ReservationContractDocumentInsert,
  ReservationContractDocumentRepository,
  ReservationContractDocumentRow,
  ReservationContractInstanceRow,
} from "./reservation-contract-document-core";

function databaseFailure(error: unknown) {
  const failure = new Error("No fue posible generar el contrato.") as Error & { code?: string };
  if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string") failure.code = (error as { code: string }).code;
  return failure;
}

function documentRow(row: Record<string, unknown>): ReservationContractDocumentRow {
  return {
    status: String(row.status),
    version: Number(row.version),
    generatedAt: String(row.generated_at),
    storagePath: typeof row.storage_path === "string" ? row.storage_path : "",
    contentSha256: typeof row.content_sha256 === "string" ? row.content_sha256 : null,
  };
}

/** Service-role adapter, instantiated only after the domain command has authorized the admin. */
export function createSupabaseReservationContractDocumentRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): ReservationContractDocumentRepository {
  return {
    async findReservation({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_snapshots")
        .select("id, reservation_code, status, currency, created_at, snapshot")
        .eq("id", reservationId).eq("agency_id", agencyId).maybeSingle();
      if (error) throw databaseFailure(error);
      return data ? data as ReservationSnapshotProjectionSource : null;
    },
    async findLatestInstance({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_contract_instances")
        .select("id, status, contract_template_version, legal_profile_snapshot, contract_content_snapshot, prepared_at")
        .eq("reservation_id", reservationId).eq("agency_id", agencyId)
        .order("prepared_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw databaseFailure(error);
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return { id: String(row.id), status: String(row.status), contractTemplateVersion: Number(row.contract_template_version), legalProfileSnapshot: row.legal_profile_snapshot, contractContentSnapshot: row.contract_content_snapshot, preparedAt: String(row.prepared_at) } satisfies ReservationContractInstanceRow;
    },
    async findExistingDocument({ agencyId, reservationId, contractInstanceId }) {
      const { data, error } = await supabase.from("reservation_documents")
        .select("status, version, generated_at, storage_path, content_sha256")
        .eq("reservation_id", reservationId).eq("agency_id", agencyId)
        .eq("contract_instance_id", contractInstanceId).eq("document_type", "contract").eq("version", 1)
        .maybeSingle();
      if (error) throw databaseFailure(error);
      return data ? documentRow(data as Record<string, unknown>) : null;
    },
    async updateContentSha256({ agencyId, reservationId, contractInstanceId, contentSha256 }) {
      const { error } = await supabase.from("reservation_documents")
        .update({ content_sha256: contentSha256 })
        .eq("reservation_id", reservationId).eq("agency_id", agencyId)
        .eq("contract_instance_id", contractInstanceId).eq("document_type", "contract")
        .eq("version", 1).is("content_sha256", null);
      if (error) throw databaseFailure(error);
    },
    async insertDocument(document) {
      const { data, error } = await supabase.from("reservation_documents").insert({
        reservation_id: document.reservationId,
        agency_id: document.agencyId,
        document_type: document.documentType,
        status: document.status,
        storage_path: document.storagePath,
        mime_type: document.mimeType,
        file_size_bytes: document.fileSizeBytes,
        version: document.version,
        payment_id: document.paymentId,
        contract_instance_id: document.contractInstanceId,
        content_sha256: document.contentSha256,
        generated_at: document.generatedAt,
        created_by_user_id: document.createdByUserId,
      }).select("status, version, generated_at, storage_path, content_sha256").single();
      if (error) throw databaseFailure(error);
      return documentRow(data as Record<string, unknown>);
    },
  };
}
