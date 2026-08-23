"use client";

import { useActionState } from "react";

import { acceptCustomerContractAction } from "./contract-acceptance-actions";

/** Reuses the idempotent acceptance command, which reconciles a missing certificate without altering acceptance. */
export function AcceptanceCertificateRetry({ agencySlug, reservationId }: Readonly<{ agencySlug: string; reservationId: string }>) {
  const [state, action, pending] = useActionState(acceptCustomerContractAction, {});
  return <form action={action}>
    <input type="hidden" name="requestedAgencySlug" value={agencySlug} />
    <input type="hidden" name="reservationId" value={reservationId} />
    <input type="hidden" name="accepted" value="true" />
    {state.error && <p role="alert">{state.error}</p>}
    {state.success && <p role="status">{state.success}</p>}
    <button type="submit" disabled={pending}>{pending ? "Generando constancia…" : "Reintentar constancia"}</button>
  </form>;
}
