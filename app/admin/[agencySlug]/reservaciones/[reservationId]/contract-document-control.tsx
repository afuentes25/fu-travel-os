"use client";

import { useActionState } from "react";

import { generateReservationContractDocumentAction } from "./contract-actions";

export function ContractDocumentControl({ agencySlug, reservationId, templateVersion, contractStatus, hasDocument }: { agencySlug: string; reservationId: string; templateVersion: number; contractStatus: "prepared" | "accepted"; hasDocument: boolean }) {
  const [state, action, pending] = useActionState(generateReservationContractDocumentAction, {});
  if (hasDocument) return <><p>Contrato PDF generado.</p><p>Versión contractual v{templateVersion}</p>{contractStatus === "prepared" ? <p>Pendiente de aceptación</p> : <p>Contrato aceptado</p>}</>;
  return <form action={action}><p>Contrato preparado con versión contractual v{templateVersion}.</p>{state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}<input type="hidden" name="requestedAgencySlug" value={agencySlug}/><input type="hidden" name="reservationId" value={reservationId}/><button type="submit" disabled={pending}>{pending ? "Generando…" : "Generar contrato PDF"}</button></form>;
}
