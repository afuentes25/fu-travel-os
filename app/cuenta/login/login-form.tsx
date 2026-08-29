"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
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

export function CustomerLoginForm({
  next,
  returnTo,
  claim,
  inline = false,
  onRegister,
  onAuthenticated,
}: Readonly<{
  next: string | null;
  returnTo: string | null;
  claim: boolean;
  inline?: boolean;
  onRegister?: () => void;
  onAuthenticated?: () => void;
}>) {
  const [state, action] = useActionState(loginCustomerAction, initialCustomerLoginState);
  const [passwordVisible, setPasswordVisible] = useState(false);
  useEffect(() => {
    if (state.authenticated) onAuthenticated?.();
  }, [onAuthenticated, state.authenticated]);
  const registerHref = `/cuenta/registro?${new URLSearchParams({ ...(next ? { next } : {}), ...(returnTo ? { returnTo } : {}), ...(claim ? { claim: "1" } : {}) }).toString()}`;
  return (
    <form action={action} className="customer-login-form">
      {next && <input type="hidden" name="next" value={next} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {claim && <input type="hidden" name="claim" value="1" />}
      {inline && <input type="hidden" name="inline" value="1" />}
      <label htmlFor="customer-email">
        Correo electrónico
        <input id="customer-email" name="email" type="email" autoComplete="email" required />
      </label>
      <label htmlFor="customer-password">
        Contraseña
        <div className="customer-password-field">
          <input
            id="customer-password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            minLength={8}
            required
          />
          <button type="button" className="customer-auth-text-button" onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? "Ocultar" : "Mostrar"}</button>
        </div>
      </label>
      {state.error && <p className="customer-form-error" role="alert">{state.error}</p>}
      <SubmitButton />
      <p className="customer-auth-switch">
        ¿Aún no tienes cuenta? {onRegister ? <button type="button" className="customer-auth-text-button" onClick={onRegister}>Crear una cuenta</button> : <Link href={registerHref}>Crear una cuenta</Link>}
      </p>
    </form>
  );
}
