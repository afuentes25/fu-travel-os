"use client";
import { useActionState } from "react";
import { prepareReservationContractAction } from "./contract-actions";
export function ContractPreparationControl({ agencySlug, reservationId }: { agencySlug: string; reservationId: string }) { const [state, action, pending] = useActionState(prepareReservationContractAction, {}); return <form action={action}><input type="hidden" name="requestedAgencySlug" value={agencySlug}/><input type="hidden" name="reservationId" value={reservationId}/><p>Contrato aún no preparado.</p>{state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}<button type="submit" disabled={pending}>{pending ? "Preparando…" : "Preparar contrato"}</button></form>; }
