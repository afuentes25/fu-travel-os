import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";

export const CONTRACT_TEMPLATE_STATUSES = ["draft", "active", "retired"] as const;
export type ContractTemplateStatus = (typeof CONTRACT_TEMPLATE_STATUSES)[number];

export type AdminLegalProfile = Readonly<{
  legalName: string;
  taxId: string | null;
  legalAddress: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  jurisdiction: string | null;
}>;

export type AdminContractTemplate = Readonly<{
  templateKey: string;
  version: number;
  status: ContractTemplateStatus;
  title: string;
  introductoryText: string | null;
  termsText: string;
  paymentPolicyText: string | null;
  cancellationPolicyText: string | null;
  travelerResponsibilityText: string | null;
  jurisdictionText: string | null;
  effectiveFrom: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type AdminContractSettings = Readonly<{
  legalProfile: AdminLegalProfile | null;
  templates: readonly AdminContractTemplate[];
}>;

export type ContractSettingsResult =
  | Readonly<{ status: "authorized"; agency: AdminAgencyAccess & { status: "authorized" }; settings: AdminContractSettings }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>;

export type ContractSettingsMutationResult =
  | Readonly<{ status: "saved" }>
  | Readonly<{ status: "created"; version: number }>
  | Readonly<{ status: "updated" }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "selection_required" }>
  | Readonly<{ status: "forbidden" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "immutable_version" }>
  | Readonly<{ status: "version_conflict" }>
  | Readonly<{ status: "invalid_input"; fieldErrors: Readonly<Record<string, string>> }>;

export type LegalProfileInput = Readonly<{
  requestedAgencySlug: unknown;
  legalName: unknown;
  taxId: unknown;
  legalAddress: unknown;
  supportEmail: unknown;
  supportPhone: unknown;
  jurisdiction: unknown;
}>;

export type TemplateInput = Readonly<{
  requestedAgencySlug: unknown;
  title: unknown;
  introductoryText: unknown;
  termsText: unknown;
  paymentPolicyText: unknown;
  cancellationPolicyText: unknown;
  travelerResponsibilityText: unknown;
  jurisdictionText: unknown;
  effectiveFrom: unknown;
}>;

export type UpdateTemplateInput = TemplateInput & Readonly<{ templateKey: unknown }>;

export type ContractSettingsRepository = Readonly<{
  findLegalProfile(input: Readonly<{ agencyId: string }>): Promise<AdminLegalProfile | null>;
  listTemplates(input: Readonly<{ agencyId: string }>): Promise<readonly AdminContractTemplate[]>;
  upsertLegalProfile(input: Readonly<{ agencyId: string } & AdminLegalProfile>): Promise<void>;
  getMaxVersion(input: Readonly<{ agencyId: string }>): Promise<number>;
  insertDraft(input: Readonly<{ agencyId: string; createdByUserId: string; version: number } & TemplateValues>): Promise<void>;
  findTemplate(input: Readonly<{ agencyId: string; templateKey: string }>): Promise<AdminContractTemplate | null>;
  updateDraft(input: Readonly<{ agencyId: string; templateKey: string } & TemplateValues>): Promise<boolean>;
}>;

export type TemplateValues = Readonly<{
  title: string;
  introductoryText: string | null;
  termsText: string;
  paymentPolicyText: string | null;
  cancellationPolicyText: string | null;
  travelerResponsibilityText: string | null;
  jurisdictionText: string | null;
  effectiveFrom: string | null;
}>;

export class AdminContractSettingsError extends Error {
  readonly name = "AdminContractSettingsError";
  constructor() { super("No fue posible administrar la configuración contractual."); }
}

function denied(access: AdminAgencyAccess): Exclude<ContractSettingsMutationResult, Readonly<{ status: "saved" }> | Readonly<{ status: "created"; version: number }> | Readonly<{ status: "updated" }> | Readonly<{ status: "not_found" }> | Readonly<{ status: "immutable_version" }> | Readonly<{ status: "version_conflict" }> | Readonly<{ status: "invalid_input"; fieldErrors: Readonly<Record<string, string>> }>> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

function optionalText(value: unknown, max: number, field: string, errors: Record<string, string>) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") { errors[field] = "El valor no es válido."; return null; }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) errors[field] = "El texto es demasiado largo.";
  if (containsHtml(normalized)) errors[field] = "No se permite HTML en este campo.";
  return normalized || null;
}

function requiredText(value: unknown, max: number, field: string, message: string, errors: Record<string, string>) {
  if (typeof value !== "string" || !value.trim()) { errors[field] = message; return ""; }
  const normalized = value.trim();
  if (normalized.length > max) errors[field] = "El texto es demasiado largo.";
  if (containsHtml(normalized)) errors[field] = "No se permite HTML en este campo.";
  return normalized;
}

function containsHtml(value: string) { return /<\s*\/?[a-z][^>]*>/i.test(value); }
function isUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function isEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value); }
function isUniqueViolation(error: unknown) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505"; }

function legalValues(input: LegalProfileInput) {
  const errors: Record<string, string> = {};
  const legalName = requiredText(input.legalName, 200, "legalName", "Captura el nombre o razón social.", errors);
  const supportEmail = optionalText(input.supportEmail, 254, "supportEmail", errors);
  if (supportEmail && !isEmail(supportEmail)) errors.supportEmail = "Captura un correo de atención válido.";
  return { errors, values: { legalName, taxId: optionalText(input.taxId, 100, "taxId", errors), legalAddress: optionalText(input.legalAddress, 1_000, "legalAddress", errors), supportEmail, supportPhone: optionalText(input.supportPhone, 80, "supportPhone", errors), jurisdiction: optionalText(input.jurisdiction, 300, "jurisdiction", errors) } satisfies AdminLegalProfile };
}

function templateValues(input: TemplateInput) {
  const errors: Record<string, string> = {};
  const title = requiredText(input.title, 200, "title", "Captura el título de la plantilla.", errors);
  const termsText = requiredText(input.termsText, 60_000, "termsText", "Captura los términos y condiciones.", errors);
  const date = optionalText(input.effectiveFrom, 30, "effectiveFrom", errors);
  let effectiveFrom: string | null = null;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime())) errors.effectiveFrom = "La fecha de vigencia no es válida.";
    else effectiveFrom = `${date}T00:00:00.000Z`;
  }
  return { errors, values: { title, termsText, introductoryText: optionalText(input.introductoryText, 20_000, "introductoryText", errors), paymentPolicyText: optionalText(input.paymentPolicyText, 20_000, "paymentPolicyText", errors), cancellationPolicyText: optionalText(input.cancellationPolicyText, 20_000, "cancellationPolicyText", errors), travelerResponsibilityText: optionalText(input.travelerResponsibilityText, 20_000, "travelerResponsibilityText", errors), jurisdictionText: optionalText(input.jurisdictionText, 20_000, "jurisdictionText", errors), effectiveFrom } satisfies TemplateValues };
}

/** Pure, injected service: all reads and writes occur only after membership resolution. */
export function createAdminContractSettingsService(dependencies: Readonly<{ resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>; repository: ContractSettingsRepository | (() => ContractSettingsRepository) }>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  async function accessFor(slug: unknown) {
    try { return await dependencies.resolveAccess({ requestedAgencySlug: typeof slug === "string" ? slug : undefined }); }
    catch { throw new AdminContractSettingsError(); }
  }
  return {
    async get(input: Readonly<{ requestedAgencySlug?: string }>): Promise<ContractSettingsResult> {
      const access = await accessFor(input.requestedAgencySlug);
      if (access.status !== "authorized") return access;
      try {
        const data = repository();
        const [legalProfile, templates] = await Promise.all([data.findLegalProfile({ agencyId: access.agency.agencyId }), data.listTemplates({ agencyId: access.agency.agencyId })]);
        return { status: "authorized", agency: access, settings: { legalProfile, templates: [...templates].sort((a, b) => b.version - a.version) } };
      } catch { throw new AdminContractSettingsError(); }
    },
    async saveLegalProfile(input: LegalProfileInput): Promise<ContractSettingsMutationResult> {
      const access = await accessFor(input.requestedAgencySlug); const blocked = denied(access); if (blocked) return blocked;
      if (access.status !== "authorized") return { status: "forbidden" };
      const { errors, values } = legalValues(input); if (Object.keys(errors).length) return { status: "invalid_input", fieldErrors: errors };
      try { await repository().upsertLegalProfile({ agencyId: access.agency.agencyId, ...values }); return { status: "saved" }; } catch { throw new AdminContractSettingsError(); }
    },
    async createDraft(input: TemplateInput): Promise<ContractSettingsMutationResult> {
      const access = await accessFor(input.requestedAgencySlug); const blocked = denied(access); if (blocked) return blocked;
      if (access.status !== "authorized") return { status: "forbidden" };
      const { errors, values } = templateValues(input); if (Object.keys(errors).length) return { status: "invalid_input", fieldErrors: errors };
      const data = repository();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try { const version = (await data.getMaxVersion({ agencyId: access.agency.agencyId })) + 1; await data.insertDraft({ agencyId: access.agency.agencyId, createdByUserId: access.identity.userId, version, ...values }); return { status: "created", version }; }
        catch (error) { if (!isUniqueViolation(error) || attempt === 2) { if (isUniqueViolation(error)) return { status: "version_conflict" }; throw new AdminContractSettingsError(); } }
      }
      return { status: "version_conflict" };
    },
    async updateDraft(input: UpdateTemplateInput): Promise<ContractSettingsMutationResult> {
      const access = await accessFor(input.requestedAgencySlug); const blocked = denied(access); if (blocked) return blocked;
      if (access.status !== "authorized") return { status: "forbidden" };
      if (!isUuid(input.templateKey)) return { status: "not_found" };
      const { errors, values } = templateValues(input); if (Object.keys(errors).length) return { status: "invalid_input", fieldErrors: errors };
      try {
        const data = repository(); const template = await data.findTemplate({ agencyId: access.agency.agencyId, templateKey: input.templateKey });
        if (!template) return { status: "not_found" }; if (template.status !== "draft") return { status: "immutable_version" };
        return await data.updateDraft({ agencyId: access.agency.agencyId, templateKey: input.templateKey, ...values }) ? { status: "updated" } : { status: "immutable_version" };
      } catch { throw new AdminContractSettingsError(); }
    },
  };
}
