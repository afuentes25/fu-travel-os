import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";

export type LegalSnapshot = Readonly<{ legalName: string; taxId: string | null; legalAddress: string | null; supportEmail: string | null; supportPhone: string | null; jurisdiction: string | null }>;
export type ContentSnapshot = Readonly<{ templateVersion: number; title: string; introductoryText: string | null; termsText: string; paymentPolicyText: string | null; cancellationPolicyText: string | null; travelerResponsibilityText: string | null; jurisdictionText: string | null; effectiveFrom: string | null }>;
export type CurrentContract = Readonly<{ status: "prepared" | "accepted"; templateVersion: number; preparedAt: string }>;
export type ContractTemplateSource = Readonly<{ id: string; version: number; status: string; title: string; introductoryText: string | null; termsText: string; paymentPolicyText: string | null; cancellationPolicyText: string | null; travelerResponsibilityText: string | null; jurisdictionText: string | null; effectiveFrom: string | null }>;
export interface ReservationContractRepository { findReservation(input: { agencyId: string; reservationId: string }): Promise<boolean>; findCurrent(input: { agencyId: string; reservationId: string }): Promise<CurrentContract | null>; findLegalProfile(input: { agencyId: string }): Promise<LegalSnapshot | null>; findActiveTemplate(input: { agencyId: string }): Promise<ContractTemplateSource | null>; insert(input: { agencyId: string; reservationId: string; template: ContractTemplateSource; legal: LegalSnapshot; actorId: string }): Promise<CurrentContract>; }
export type PrepareReservationContractResult = Readonly<{ status: "prepared" | "existing"; contract: CurrentContract }> | Readonly<{ status: "unauthenticated" | "selection_required" | "forbidden" | "not_found" | "legal_profile_required" | "active_template_required" | "invalid_structure" }>;
export type ReservationContractPreparationStatus = Readonly<{ status: "ready" }> | Readonly<{ status: "existing"; contract: CurrentContract }> | Readonly<{ status: "unauthenticated" | "selection_required" | "forbidden" | "not_found" | "legal_profile_required" | "active_template_required" | "invalid_structure" }>;
export class ReservationContractError extends Error { readonly name = "ReservationContractError"; constructor() { super("No fue posible preparar el contrato."); } }
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function blocked(access: AdminAgencyAccess): Exclude<PrepareReservationContractResult, Readonly<{ status: "prepared" | "existing"; contract: CurrentContract }> | Readonly<{ status: "not_found" }> | Readonly<{ status: "legal_profile_required" }> | Readonly<{ status: "active_template_required" }> | Readonly<{ status: "invalid_structure" }>> | null { if (access.status === "unauthenticated") return { status: "unauthenticated" }; if (access.status === "selection_required") return { status: "selection_required" }; if (access.status === "forbidden") return { status: "forbidden" }; return null; }
export function createReservationContractService(deps: { resolveAccess: (input: { requestedAgencySlug?: string }) => Promise<AdminAgencyAccess>; repository: ReservationContractRepository | (() => ReservationContractRepository) }) {
  const repo = () => typeof deps.repository === "function" ? deps.repository() : deps.repository;
  async function check(input: { requestedAgencySlug: unknown; reservationId: unknown }) {
    let access: AdminAgencyAccess;
    try { access = await deps.resolveAccess({ requestedAgencySlug: typeof input.requestedAgencySlug === "string" ? input.requestedAgencySlug : undefined }); }
    catch { throw new ReservationContractError(); }
    const denied = blocked(access);
    if (denied) return { status: denied } as const;
    if (access.status !== "authorized") return { status: { status: "forbidden" } } as const;
    if (!uuid(input.reservationId)) return { status: { status: "not_found" } } as const;
    const scope = { agencyId: access.agency.agencyId, reservationId: input.reservationId };
    const data = repo();
    if (!await data.findReservation(scope)) return { status: { status: "not_found" } } as const;
    const existing = await data.findCurrent(scope);
    if (existing) return { status: { status: "existing", contract: existing } } as const;
    const legal = await data.findLegalProfile({ agencyId: scope.agencyId });
    if (!legal || !legal.legalName.trim()) return { status: { status: "legal_profile_required" } } as const;
    const template = await data.findActiveTemplate({ agencyId: scope.agencyId });
    if (!template) return { status: { status: "active_template_required" } } as const;
    if (template.status !== "active" || template.version < 1 || !template.title.trim() || !template.termsText.trim()) return { status: { status: "invalid_structure" } } as const;
    return { status: { status: "ready" } as const, scope, actorId: access.identity.userId, legal, template };
  }
  return {
    async inspect(input: { requestedAgencySlug: unknown; reservationId: unknown }): Promise<ReservationContractPreparationStatus> {
      try { return (await check(input)).status; }
      catch (error) { if (error instanceof ReservationContractError) throw error; throw new ReservationContractError(); }
    },
    async prepare(input: { requestedAgencySlug: unknown; reservationId: unknown }): Promise<PrepareReservationContractResult> {
      try {
        const checked = await check(input);
        if (checked.status.status !== "ready" || !("scope" in checked) || !("actorId" in checked) || !("template" in checked) || !("legal" in checked)) return checked.status as PrepareReservationContractResult;
        const ready = checked as Readonly<{ scope: { agencyId: string; reservationId: string }; actorId: string; template: ContractTemplateSource; legal: LegalSnapshot }>;
        try { return { status: "prepared", contract: await repo().insert({ ...ready.scope, template: ready.template, legal: ready.legal, actorId: ready.actorId }) }; }
        catch (error) { const retry = await repo().findCurrent(ready.scope); if (retry) return { status: "existing", contract: retry }; throw error; }
      } catch (error) { if (error instanceof ReservationContractError) throw error; throw new ReservationContractError(); }
    },
  };
}
