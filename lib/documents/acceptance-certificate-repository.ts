import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  AcceptanceCertificateContractDocumentRow,
  AcceptanceCertificateExistingRow,
  AcceptanceCertificateRepository,
} from "./acceptance-certificate-core";

const fail = () => new Error("No fue posible generar la constancia.");
const certificate = (row: Record<string, unknown>): AcceptanceCertificateExistingRow => ({
  status: String(row.status), version: Number(row.version), generatedAt: String(row.generated_at),
  storagePath: typeof row.storage_path === "string" ? row.storage_path : "",
  contentSha256: typeof row.content_sha256 === "string" ? row.content_sha256 : null,
});

/** Service-role persistence adapter, created only after customer authorization. */
export function createSupabaseAcceptanceCertificateRepository(
  supabase: SupabaseClient = getSupabaseServerClient(),
): AcceptanceCertificateRepository {
  return {
    async findPrimaryLink({ customerAccountId, agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_customer_access").select("id")
        .eq("customer_account_id", customerAccountId).eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("role", "primary").maybeSingle();
      if (error) throw fail();
      return Boolean(data);
    },
    async findReservation({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_snapshots")
        .select("id, reservation_code, status, currency, created_at, snapshot")
        .eq("id", reservationId).eq("agency_id", agencyId).maybeSingle();
      if (error) throw fail();
      return data ? data as ReservationSnapshotProjectionSource : null;
    },
    async findInstance({ agencyId, reservationId }) {
      const { data, error } = await supabase.from("reservation_contract_instances")
        .select("id, status, contract_template_version, legal_profile_snapshot, contract_content_snapshot")
        .eq("agency_id", agencyId).eq("reservation_id", reservationId).maybeSingle();
      if (error) throw fail();
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return { id: String(row.id), status: String(row.status), contractTemplateVersion: Number(row.contract_template_version), legalProfileSnapshot: row.legal_profile_snapshot, contractContentSnapshot: row.contract_content_snapshot };
    },
    async findAcceptance({ agencyId, reservationId, contractInstanceId }) {
      const { data, error } = await supabase.from("reservation_contract_acceptances")
        .select("id, contract_document_id, document_content_sha256, accepted_at, acceptance_statement_version, acceptance_statement")
        .eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("contract_instance_id", contractInstanceId).maybeSingle();
      if (error) throw fail();
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return { id: String(row.id), contractDocumentId: String(row.contract_document_id), documentContentSha256: String(row.document_content_sha256), acceptedAt: String(row.accepted_at), statementVersion: String(row.acceptance_statement_version), statement: String(row.acceptance_statement) };
    },
    async findContractDocument({ agencyId, reservationId, contractInstanceId, documentId }) {
      const { data, error } = await supabase.from("reservation_documents")
        .select("id, status, version, generated_at, storage_path, content_sha256")
        .eq("id", documentId).eq("agency_id", agencyId).eq("reservation_id", reservationId)
        .eq("contract_instance_id", contractInstanceId).eq("document_type", "contract").maybeSingle();
      if (error) throw fail();
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return { id: String(row.id), ...certificate(row) } satisfies AcceptanceCertificateContractDocumentRow;
    },
    async findExistingCertificate({ agencyId, reservationId, contractAcceptanceId }) {
      const { data, error } = await supabase.from("reservation_documents")
        .select("status, version, generated_at, storage_path, content_sha256")
        .eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("contract_acceptance_id", contractAcceptanceId)
        .eq("document_type", "acceptance_certificate").eq("version", 1).maybeSingle();
      if (error) throw fail();
      return data ? certificate(data as Record<string, unknown>) : null;
    },
    async updateExistingHash({ agencyId, reservationId, contractAcceptanceId, contentSha256 }) {
      const { error } = await supabase.from("reservation_documents").update({ content_sha256: contentSha256 })
        .eq("agency_id", agencyId).eq("reservation_id", reservationId).eq("contract_acceptance_id", contractAcceptanceId)
        .eq("document_type", "acceptance_certificate").eq("version", 1).is("content_sha256", null);
      if (error) throw fail();
    },
    async insertCertificate(document) {
      const { data, error } = await supabase.from("reservation_documents").insert({
        reservation_id: document.reservationId, agency_id: document.agencyId, document_type: "acceptance_certificate", status: "available",
        storage_path: document.storagePath, mime_type: "application/pdf", file_size_bytes: document.fileSizeBytes, version: 1,
        payment_id: document.paymentId, contract_instance_id: document.contractInstanceId, contract_acceptance_id: document.contractAcceptanceId,
        content_sha256: document.contentSha256, generated_at: document.generatedAt, created_by_user_id: document.createdByUserId,
      }).select("status, version, generated_at, storage_path, content_sha256").single();
      if (error) { const failure = fail() as Error & { code?: string }; if (typeof error.code === "string") failure.code = error.code; throw failure; }
      return certificate(data as Record<string, unknown>);
    },
  };
}
