"use client";
import { useActionState } from "react";
import { generateReservationVoucherAction } from "./voucher-actions";
import { initialVoucherFormState } from "./voucher-form-core";
export function VoucherControl({agencySlug,reservationId,revoked,nextVersion}:{agencySlug:string;reservationId:string;revoked:boolean;nextVersion:number}){const[state,action,pending]=useActionState(generateReservationVoucherAction,initialVoucherFormState);return <form action={action}><input type="hidden" name="requestedAgencySlug" value={agencySlug}/><input type="hidden" name="reservationId" value={reservationId}/>{revoked&&<p>La versión anterior ya no está vigente.</p>}<button type="submit" disabled={pending}>{pending?"Generando Voucher…":revoked?`Generar Voucher V${nextVersion}`:"Generar Voucher"}</button>{state.success&&<p role="status">{state.success}</p>}{state.error&&<p role="alert">{state.error}</p>}</form>;}
