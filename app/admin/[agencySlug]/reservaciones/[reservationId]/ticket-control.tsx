"use client";

import { useActionState } from "react";
import { generateReservationTravelerTicketAction } from "./ticket-actions";
import { initialTicketFormState } from "./ticket-form-core";

export function TicketControl({ agencySlug, reservationId, travelerKey, reissueVersion }: Readonly<{ agencySlug: string; reservationId: string; travelerKey: string; reissueVersion: number | null }>) {
  const [state, action, pending] = useActionState(generateReservationTravelerTicketAction, initialTicketFormState);
  return <form action={action}>
    <input type="hidden" name="requestedAgencySlug" value={agencySlug} />
    <input type="hidden" name="reservationId" value={reservationId} />
    <input type="hidden" name="travelerKey" value={travelerKey} />
    {reissueVersion !== null && <p>La versión anterior ya no está vigente.</p>}
    <button type="submit" disabled={pending}>{pending ? "Generando boleto…" : reissueVersion === null ? "Generar boleto" : `Generar boleto V${reissueVersion}`}</button>
    {state.success && <p role="status">{state.success}</p>}
    {state.error && <p role="alert">{state.error}</p>}
  </form>;
}
