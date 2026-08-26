"use client";

import { useActionState, useEffect, useState } from "react";

import { updateCustomerProfileAction } from "./customer-profile-actions";
import { initialCustomerProfileFormState } from "./customer-profile-state";
import styles from "./cuenta.module.css";

export function CustomerProfileForm({ agencySlug, email, firstName, lastName, phone }: Readonly<{
  agencySlug: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}>) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateCustomerProfileAction, initialCustomerProfileFormState);
  useEffect(() => { if (state.success) setEditing(false); }, [state.success]);
  return (
    <section className={styles.customerProfileCard} aria-labelledby="customer-profile-title">
      <div className={styles.customerProfileHeading}>
        <div><span className={styles.kicker}>MI CUENTA</span><h2 id="customer-profile-title">Mis datos</h2><p>Estos datos se usarán para facilitar tus próximas reservaciones.</p></div>
        {!editing && <button type="button" onClick={() => setEditing(true)}>Editar datos</button>}
      </div>
      {editing ? (
        <form action={action} className={styles.customerProfileForm}>
          <input type="hidden" name="requestedAgencySlug" value={agencySlug} />
          <label>Nombre<input name="firstName" defaultValue={firstName ?? ""} autoComplete="given-name" required maxLength={120} /></label>
          <label>Apellidos<input name="lastName" defaultValue={lastName ?? ""} autoComplete="family-name" maxLength={120} /></label>
          <label>Correo de acceso<input value={email ?? "No disponible"} readOnly aria-readonly="true" /></label>
          <label>WhatsApp<input name="phone" defaultValue={phone ?? ""} autoComplete="tel" maxLength={60} /></label>
          {state.error && <p className={styles.customerProfileError} role="alert">{state.error}</p>}
          <div className={styles.customerProfileActions}><button type="submit">Guardar cambios</button><button type="button" onClick={() => setEditing(false)}>Cancelar</button></div>
        </form>
      ) : (
        <>
          {state.success && <p className={styles.customerProfileSuccess} role="status">{state.success}</p>}
          <dl className={styles.customerProfileValues}>
            <div><dt>Nombre</dt><dd>{firstName ?? "Pendiente"}</dd></div><div><dt>Apellidos</dt><dd>{lastName ?? "Pendiente"}</dd></div><div><dt>Correo</dt><dd>{email ?? "No disponible"}</dd></div><div><dt>WhatsApp</dt><dd>{phone ?? "Pendiente"}</dd></div>
          </dl>
        </>
      )}
    </section>
  );
}
