"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { loginCustomerAction } from "../actions";
import { initialCustomerLoginState } from "./login-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Iniciando sesión…" : "Iniciar sesión"}
    </button>
  );
}

export function CustomerLoginForm({ next }: Readonly<{ next: string | null }>) {
  const [state, action] = useActionState(loginCustomerAction, initialCustomerLoginState);
  return (
    <form action={action} className="customer-login-form">
      {next && <input type="hidden" name="next" value={next} />}
      <label htmlFor="customer-email">
        Correo electrónico
        <input id="customer-email" name="email" type="email" autoComplete="email" required />
      </label>
      <label htmlFor="customer-password">
        Contraseña
        <input
          id="customer-password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </label>
      {state.error && <p className="customer-form-error" role="alert">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
