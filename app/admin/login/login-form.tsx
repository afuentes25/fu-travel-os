"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  loginAdminAction,
} from "../actions";
import { initialAdminLoginState } from "./login-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Iniciando sesión…" : "Iniciar sesión"}
    </button>
  );
}

export function AdminLoginForm({ next }: { next: string | null }) {
  const [state, action] = useActionState(loginAdminAction, initialAdminLoginState);
  return (
    <form action={action} className="admin-login-form">
      {next && <input type="hidden" name="next" value={next} />}
      <label htmlFor="admin-email">
        Correo electrónico
        <input id="admin-email" name="email" type="email" autoComplete="email" required />
      </label>
      <label htmlFor="admin-password">
        Contraseña
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </label>
      {state.error && <p className="admin-form-error" role="alert">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
