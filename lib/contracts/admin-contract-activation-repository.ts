import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type { ActivationRpcResult, ActivationTemplate, AdminContractActivationRepository } from "./admin-contract-activation-core";

function failure() { return new Error("No fue posible activar la versión contractual."); }

/** Service-role adapter. Authorization and all agency scoping happen before RPC. */
export function createSupabaseAdminContractActivationRepository(supabase: SupabaseClient = getSupabaseServerClient()): AdminContractActivationRepository {
  return {
    async findTemplate({ agencyId, templateKey }) {
      const { data, error } = await supabase.from("agency_contract_templates").select("id, status").eq("agency_id", agencyId).eq("id", templateKey).maybeSingle();
      if (error) throw failure(); return data ? { templateKey: data.id, status: data.status as ActivationTemplate["status"] } : null;
    },
    async hasLegalProfile({ agencyId }) {
      const { data, error } = await supabase.from("agency_legal_profiles").select("legal_name").eq("agency_id", agencyId).maybeSingle();
      if (error) throw failure(); return typeof data?.legal_name === "string" && data.legal_name.trim().length > 0;
    },
    async activate({ agencyId, templateKey, expectedActiveTemplateKey }) {
      const { data, error } = await supabase.rpc("activate_agency_contract_template", { target_agency_id: agencyId, target_template_id: templateKey, expected_active_template_id: expectedActiveTemplateKey });
      if (error) throw failure();
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row.result_status !== "string") throw failure();
      return { resultStatus: row.result_status, activatedVersion: typeof row.activated_version === "number" ? row.activated_version : null } satisfies ActivationRpcResult;
    },
  };
}
