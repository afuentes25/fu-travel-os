"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { activateContractTemplateAction } from "./contract-activation-actions";
import { initialContractActivationFormState } from "./contract-activation-form-core";
import styles from "./contract-settings.module.css";
import activationStyles from "./contract-activation.module.css";

export function ContractActivationControl({ agencySlug, templateKey, version, title, effectiveFrom, expectedActiveTemplateKey }: Readonly<{ agencySlug: string; templateKey: string; version: number; title: string; effectiveFrom: string | null; expectedActiveTemplateKey: string | null }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(activateContractTemplateAction, initialContractActivationFormState);
  useEffect(() => { const dialog = dialogRef.current; if (!dialog) return; if (open && !dialog.open) dialog.showModal(); if (!open && dialog.open) dialog.close(); }, [open]);
  useEffect(() => { if (state.success) setOpen(false); }, [state.success]);
  const close = () => setOpen(false);
  return <><button type="button" className={activationStyles.activateButton} onClick={() => setOpen(true)}>Activar versión</button><dialog className={activationStyles.dialog} ref={dialogRef} onCancel={close} onClose={() => setOpen(false)} aria-labelledby={`activate-template-${version}`}><div className={activationStyles.header}><h3 id={`activate-template-${version}`}>Activar versión {version}</h3><button type="button" onClick={close} aria-label="Cerrar confirmación">×</button></div><p><strong>{title}</strong></p>{effectiveFrom && <p>Vigente a partir de: {new Date(effectiveFrom).toLocaleDateString("es-MX")}</p>}<p>{expectedActiveTemplateKey ? `Activar la versión ${version} hará que sea utilizada como plantilla contractual vigente para nuevos contratos. La versión activa actual se conservará como histórica.` : `Activar la versión ${version} la establecerá como plantilla contractual vigente.`}</p><form className={activationStyles.form} action={action}><input type="hidden" name="requestedAgencySlug" value={agencySlug} /><input type="hidden" name="templateKey" value={templateKey} /><input type="hidden" name="expectedActiveTemplateKey" value={expectedActiveTemplateKey ?? ""} />{state.error && <p className={styles.formError} role="alert">{state.error}</p>}{state.success && <p className={styles.formSuccess} role="status">{state.success}</p>}<div className={styles.formActions}><button type="button" onClick={close}>Cancelar</button><button className={styles.primaryButton} type="submit" disabled={pending}>{pending ? "Activando…" : "Activar versión"}</button></div></form></dialog></>;
}
