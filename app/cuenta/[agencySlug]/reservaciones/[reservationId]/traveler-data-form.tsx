"use client";

import { useActionState } from "react";

import {
  saveTravelerDataAction,
  type TravelerDataFormState,
} from "./traveler-actions";
import styles from "../../../cuenta.module.css";

const initialState: TravelerDataFormState = {};

export function TravelerDataForm({
  requestedAgencySlug,
  reservationId,
  position,
  firstName,
  lastName,
  birthDate,
  complete,
}: Readonly<{
  requestedAgencySlug: string;
  reservationId: string;
  position: number;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  complete: boolean;
}>) {
  const [state, formAction, pending] = useActionState(saveTravelerDataAction, initialState);
  const values = state.values;
  return (
    <form className={styles.travelerForm} action={formAction}>
      <input type="hidden" name="requestedAgencySlug" value={requestedAgencySlug} />
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="position" value={position} />
      <label>
        Nombre(s)
        <input name="firstName" required maxLength={100} defaultValue={values?.firstName ?? firstName ?? ""} aria-invalid={Boolean(state.errors?.firstName)} />
        {state.errors?.firstName && <span role="alert">{state.errors.firstName}</span>}
      </label>
      <label>
        Apellidos
        <input name="lastName" required maxLength={150} defaultValue={values?.lastName ?? lastName ?? ""} aria-invalid={Boolean(state.errors?.lastName)} />
        {state.errors?.lastName && <span role="alert">{state.errors.lastName}</span>}
      </label>
      <label>
        Fecha de nacimiento
        <input type="date" name="birthDate" required defaultValue={values?.birthDate ?? birthDate ?? ""} aria-invalid={Boolean(state.errors?.birthDate)} />
        {state.errors?.birthDate && <span role="alert">{state.errors.birthDate}</span>}
      </label>
      {state.error && <p className={styles.travelerFormError} role="alert">{state.error}</p>}
      {state.success && <p className={styles.travelerFormSuccess} role="status">{state.success}</p>}
      <button type="submit" disabled={pending}>{pending ? "Guardando…" : complete ? "Actualizar datos" : "Guardar datos"}</button>
    </form>
  );
}
