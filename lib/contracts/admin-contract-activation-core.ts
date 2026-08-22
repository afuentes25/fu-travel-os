import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";

export type ActivateContractTemplateInput = Readonly<{
  requestedAgencySlug: unknown;
  templateKey: unknown;
  expectedActiveTemplateKey: unknown;
}>;

export type ActivationTemplate = Readonly<{ templateKey: string; status: "draft" | "active" | "retired" }>;
export type ActivationRpcResult = Readonly<{ resultStatus: string; activatedVersion: number | null }>;
export type AdminContractActivationRepository = Readonly<{
  findTemplate(input: Readonly<{ agencyId: string; templateKey: string }>): Promise<ActivationTemplate | null>;
  hasLegalProfile(input: Readonly<{ agencyId: string }>): Promise<boolean>;
  activate(input: Readonly<{ agencyId: string; templateKey: string; expectedActiveTemplateKey: string | null }>): Promise<ActivationRpcResult>;
}>;

export type ActivateContractTemplateResult =
  | Readonly<{ status: "activated"; version: number }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "immutable_version" }>
  | Readonly<{ status: "legal_profile_required" }>
  | Readonly<{ status: "conflict" }>
  | Readonly<{ status: "activation_error" }>;

export class AdminContractActivationError extends Error {
  readonly name = "AdminContractActivationError";
  constructor() { super("No fue posible activar la versión contractual."); }
}

function isUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function accessStatus(access: AdminAgencyAccess): Extract<ActivateContractTemplateResult, Readonly<{ status: "unauthenticated" }> | Readonly<{ status: "selection_required" }> | Readonly<{ status: "forbidden" }>> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

/** Calls the SQL transaction only after verified agency-scoped authorization. */
export function createAdminContractActivationService(dependencies: Readonly<{ resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>; repository: AdminContractActivationRepository | (() => AdminContractActivationRepository) }>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  return {
    async activate(input: ActivateContractTemplateInput): Promise<ActivateContractTemplateResult> {
      let access: AdminAgencyAccess;
      try { access = await dependencies.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
      catch { throw new AdminContractActivationError(); }
      const blocked = accessStatus(access); if (blocked) return blocked;
      if (access.status !== "authorized") return { status: "forbidden" };
      if (!isUuid(input.templateKey)) return { status: "not_found" };
      const expectedActiveTemplateKey = input.expectedActiveTemplateKey === null || input.expectedActiveTemplateKey === "" || input.expectedActiveTemplateKey === undefined
        ? null
        : isUuid(input.expectedActiveTemplateKey) ? input.expectedActiveTemplateKey : null;
      // A malformed non-empty expected key is stale/untrusted, never a bypass.
      if (input.expectedActiveTemplateKey !== null && input.expectedActiveTemplateKey !== "" && input.expectedActiveTemplateKey !== undefined && expectedActiveTemplateKey === null) return { status: "conflict" };
      const data = repository();
      try {
        const template = await data.findTemplate({ agencyId: access.agency.agencyId, templateKey: input.templateKey });
        if (!template) return { status: "not_found" };
        if (template.status !== "draft") return { status: "immutable_version" };
        if (!await data.hasLegalProfile({ agencyId: access.agency.agencyId })) return { status: "legal_profile_required" };
        const result = await data.activate({ agencyId: access.agency.agencyId, templateKey: input.templateKey, expectedActiveTemplateKey });
        if (result.resultStatus === "activated" && typeof result.activatedVersion === "number") return { status: "activated", version: result.activatedVersion };
        if (result.resultStatus === "not_found") return { status: "not_found" };
        if (result.resultStatus === "immutable_version") return { status: "immutable_version" };
        if (result.resultStatus === "legal_profile_required") return { status: "legal_profile_required" };
        if (result.resultStatus === "conflict") return { status: "conflict" };
        return { status: "activation_error" };
      } catch { throw new AdminContractActivationError(); }
    },
  };
}
