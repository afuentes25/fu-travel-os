import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  AdminContractTemplate,
  AdminLegalProfile,
  ContractSettingsRepository,
  TemplateValues,
} from "./admin-contract-settings-core";

type LegalRow = Readonly<{ legal_name: string; tax_id: string | null; legal_address: string | null; support_email: string | null; support_phone: string | null; jurisdiction: string | null }>;
type TemplateRow = Readonly<{ id: string; version: number; status: string; title: string; introductory_text: string | null; terms_text: string; payment_policy_text: string | null; cancellation_policy_text: string | null; traveler_responsibility_text: string | null; jurisdiction_text: string | null; effective_from: string | null; activated_at: string | null; created_at: string; updated_at: string }>;

function failure(error: unknown) {
  const safe = new Error("No fue posible administrar la configuración contractual.") as Error & { code?: string };
  if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string") safe.code = (error as { code: string }).code;
  return safe;
}

function profile(row: LegalRow): AdminLegalProfile {
  return { legalName: row.legal_name, taxId: row.tax_id, legalAddress: row.legal_address, supportEmail: row.support_email, supportPhone: row.support_phone, jurisdiction: row.jurisdiction };
}
function template(row: TemplateRow): AdminContractTemplate {
  return { templateKey: row.id, version: row.version, status: row.status as AdminContractTemplate["status"], title: row.title, introductoryText: row.introductory_text, termsText: row.terms_text, paymentPolicyText: row.payment_policy_text, cancellationPolicyText: row.cancellation_policy_text, travelerResponsibilityText: row.traveler_responsibility_text, jurisdictionText: row.jurisdiction_text, effectiveFrom: row.effective_from, activatedAt: row.activated_at, createdAt: row.created_at, updatedAt: row.updated_at };
}
function templateWrite(values: TemplateValues) { return { title: values.title, introductory_text: values.introductoryText, terms_text: values.termsText, payment_policy_text: values.paymentPolicyText, cancellation_policy_text: values.cancellationPolicyText, traveler_responsibility_text: values.travelerResponsibilityText, jurisdiction_text: values.jurisdictionText, effective_from: values.effectiveFrom }; }

/** Service-role adapter. Domain commands pass only a verified agency id and user id. */
export function createSupabaseAdminContractSettingsRepository(supabase: SupabaseClient = getSupabaseServerClient()): ContractSettingsRepository {
  return {
    async findLegalProfile({ agencyId }) {
      const { data, error } = await supabase.from("agency_legal_profiles").select("legal_name, tax_id, legal_address, support_email, support_phone, jurisdiction").eq("agency_id", agencyId).maybeSingle();
      if (error) throw failure(error); return data ? profile(data as LegalRow) : null;
    },
    async listTemplates({ agencyId }) {
      const { data, error } = await supabase.from("agency_contract_templates").select("id, version, status, title, introductory_text, terms_text, payment_policy_text, cancellation_policy_text, traveler_responsibility_text, jurisdiction_text, effective_from, activated_at, created_at, updated_at").eq("agency_id", agencyId).order("version", { ascending: false });
      if (error) throw failure(error); return (data ?? []).map((row) => template(row as TemplateRow));
    },
    async upsertLegalProfile(input) {
      const { error } = await supabase.from("agency_legal_profiles").upsert({ agency_id: input.agencyId, legal_name: input.legalName, tax_id: input.taxId, legal_address: input.legalAddress, support_email: input.supportEmail, support_phone: input.supportPhone, jurisdiction: input.jurisdiction }, { onConflict: "agency_id" });
      if (error) throw failure(error);
    },
    async getMaxVersion({ agencyId }) {
      const { data, error } = await supabase.from("agency_contract_templates").select("version").eq("agency_id", agencyId).order("version", { ascending: false }).limit(1).maybeSingle();
      if (error) throw failure(error); return typeof data?.version === "number" ? data.version : 0;
    },
    async insertDraft(input) {
      const { error } = await supabase.from("agency_contract_templates").insert({ agency_id: input.agencyId, version: input.version, status: "draft", created_by_user_id: input.createdByUserId, ...templateWrite(input) });
      if (error) throw failure(error);
    },
    async findTemplate({ agencyId, templateKey }) {
      const { data, error } = await supabase.from("agency_contract_templates").select("id, version, status, title, introductory_text, terms_text, payment_policy_text, cancellation_policy_text, traveler_responsibility_text, jurisdiction_text, effective_from, activated_at, created_at, updated_at").eq("agency_id", agencyId).eq("id", templateKey).maybeSingle();
      if (error) throw failure(error); return data ? template(data as TemplateRow) : null;
    },
    async updateDraft(input) {
      const { data, error } = await supabase.from("agency_contract_templates").update(templateWrite(input)).eq("agency_id", input.agencyId).eq("id", input.templateKey).eq("status", "draft").select("id").maybeSingle();
      if (error) throw failure(error); return Boolean(data);
    },
  };
}
