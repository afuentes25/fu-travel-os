"use client";

import { useActionState, useState } from "react";

import type { AdminContractTemplate, AdminLegalProfile } from "@/lib/contracts/admin-contract-settings";

import { createContractTemplateDraftAction, saveAgencyLegalProfileAction, updateContractTemplateDraftAction } from "./contract-actions";
import { ContractActivationControl } from "./contract-activation-control";
import { initialContractSettingsFormState } from "./contract-settings-form-core";
import styles from "./contract-settings.module.css";

function Feedback({ state }: Readonly<{ state: { success?: string; error?: string; fieldErrors?: Readonly<Record<string, string>> } }>) {
  return <>{state.error && <p className={styles.formError} role="alert">{state.error}</p>}{state.success && <p className={styles.formSuccess} role="status">{state.success}</p>}</>;
}

export function LegalProfileForm({ agencySlug, profile }: Readonly<{ agencySlug: string; profile: AdminLegalProfile | null }>) {
  const [state, action, pending] = useActionState(saveAgencyLegalProfileAction, initialContractSettingsFormState);
  return <form className={styles.form} action={action}>
    <input type="hidden" name="requestedAgencySlug" value={agencySlug} />
    <label>Nombre o razón social<input name="legalName" required maxLength={200} defaultValue={profile?.legalName ?? ""} aria-invalid={Boolean(state.fieldErrors?.legalName)} />{state.fieldErrors?.legalName && <span role="alert">{state.fieldErrors.legalName}</span>}</label>
    <label>Identificador fiscal<input name="taxId" maxLength={100} defaultValue={profile?.taxId ?? ""} aria-invalid={Boolean(state.fieldErrors?.taxId)} />{state.fieldErrors?.taxId && <span role="alert">{state.fieldErrors.taxId}</span>}</label>
    <label>Domicilio legal<textarea name="legalAddress" maxLength={1000} defaultValue={profile?.legalAddress ?? ""} aria-invalid={Boolean(state.fieldErrors?.legalAddress)} />{state.fieldErrors?.legalAddress && <span role="alert">{state.fieldErrors.legalAddress}</span>}</label>
    <div className={styles.fieldGrid}><label>Correo de atención<input name="supportEmail" type="email" maxLength={254} defaultValue={profile?.supportEmail ?? ""} aria-invalid={Boolean(state.fieldErrors?.supportEmail)} />{state.fieldErrors?.supportEmail && <span role="alert">{state.fieldErrors.supportEmail}</span>}</label><label>Teléfono de atención<input name="supportPhone" maxLength={80} defaultValue={profile?.supportPhone ?? ""} aria-invalid={Boolean(state.fieldErrors?.supportPhone)} />{state.fieldErrors?.supportPhone && <span role="alert">{state.fieldErrors.supportPhone}</span>}</label></div>
    <label>Jurisdicción<input name="jurisdiction" maxLength={300} defaultValue={profile?.jurisdiction ?? ""} aria-invalid={Boolean(state.fieldErrors?.jurisdiction)} />{state.fieldErrors?.jurisdiction && <span role="alert">{state.fieldErrors.jurisdiction}</span>}</label>
    <Feedback state={state} /><button className={styles.primaryButton} disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar datos legales"}</button>
  </form>;
}

function TemplateFields({ template, fieldErrors }: Readonly<{ template?: AdminContractTemplate; fieldErrors?: Readonly<Record<string, string>> }>) {
  return <><label>Título<input name="title" required maxLength={200} defaultValue={template?.title ?? ""} aria-invalid={Boolean(fieldErrors?.title)} />{fieldErrors?.title && <span role="alert">{fieldErrors.title}</span>}</label><label>Texto introductorio<textarea name="introductoryText" defaultValue={template?.introductoryText ?? ""} /></label><label>Términos y condiciones<textarea name="termsText" required defaultValue={template?.termsText ?? ""} aria-invalid={Boolean(fieldErrors?.termsText)} />{fieldErrors?.termsText && <span role="alert">{fieldErrors.termsText}</span>}</label><label>Política de pagos<textarea name="paymentPolicyText" defaultValue={template?.paymentPolicyText ?? ""} /></label><label>Política de cancelaciones<textarea name="cancellationPolicyText" defaultValue={template?.cancellationPolicyText ?? ""} /></label><label>Responsabilidades del viajero<textarea name="travelerResponsibilityText" defaultValue={template?.travelerResponsibilityText ?? ""} /></label><label>Jurisdicción contractual<textarea name="jurisdictionText" defaultValue={template?.jurisdictionText ?? ""} /></label><label>Vigente a partir de<input name="effectiveFrom" type="date" defaultValue={template?.effectiveFrom?.slice(0, 10) ?? ""} aria-invalid={Boolean(fieldErrors?.effectiveFrom)} />{fieldErrors?.effectiveFrom && <span role="alert">{fieldErrors.effectiveFrom}</span>}</label></>;
}

export function ContractTemplateForm({ agencySlug, template, onClose }: Readonly<{ agencySlug: string; template?: AdminContractTemplate; onClose: () => void }>) {
  const editing = Boolean(template);
  const [state, action, pending] = useActionState(editing ? updateContractTemplateDraftAction : createContractTemplateDraftAction, initialContractSettingsFormState);
  return <form className={styles.form} action={action}>
    <input type="hidden" name="requestedAgencySlug" value={agencySlug} />{template && <input type="hidden" name="templateKey" value={template.templateKey} />}
    <TemplateFields template={template} fieldErrors={state.fieldErrors} />
    <Feedback state={state} /><div className={styles.formActions}><button type="button" onClick={onClose}>Cancelar</button><button className={styles.primaryButton} disabled={pending} type="submit">{pending ? "Guardando…" : editing ? "Guardar borrador" : "Crear borrador"}</button></div>
  </form>;
}

export function ContractTemplateManager({ agencySlug, templates }: Readonly<{ agencySlug: string; templates: readonly AdminContractTemplate[] }>) {
  const [editing, setEditing] = useState<AdminContractTemplate | "new" | null>(null);
  const labels = { draft: "Borrador", active: "Activa", retired: "Retirada" } as const;
  const expectedActiveTemplateKey = templates.find((template) => template.status === "active")?.templateKey ?? null;
  return <div className={styles.templateManager}>
    {templates.length === 0 && <div className={styles.empty}><p>Aún no hay plantillas contractuales.</p><span>Crear primera versión</span></div>}
    <div className={styles.templateList}>{templates.map((template) => <article className={styles.templateCard} key={template.templateKey}><div><strong>Versión {template.version}</strong><span className={styles[`status${template.status}`]}>{labels[template.status]}</span></div><h3>{template.title}</h3>{template.status === "draft" ? <div className={styles.formActions}><button type="button" onClick={() => setEditing(template)}>Editar</button><ContractActivationControl agencySlug={agencySlug} templateKey={template.templateKey} version={template.version} title={template.title} effectiveFrom={template.effectiveFrom} expectedActiveTemplateKey={expectedActiveTemplateKey} /></div> : <p>{template.status === "active" ? "Esta versión está activa y no puede modificarse." : "Esta versión se conserva como histórico y no puede modificarse."}</p>}</article>)}</div>
    {editing ? <section className={styles.editor} aria-labelledby="contract-template-editor-title"><h3 id="contract-template-editor-title">{editing === "new" ? "Crear nueva versión" : `Editar borrador versión ${editing.version}`}</h3><ContractTemplateForm agencySlug={agencySlug} template={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /></section> : <button className={styles.primaryButton} type="button" onClick={() => setEditing("new")}>Crear nueva versión</button>}
  </div>;
}
