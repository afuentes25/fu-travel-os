"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import {
  registerCustomerAction,
  resendCustomerRegistrationConfirmationAction,
} from "./registration-actions";
import { CUSTOMER_CONFIRMATION_RESEND_COOLDOWN_SECONDS } from "./registration-core";
import { initialCustomerRegistrationState } from "./registration-state";

function Submit() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending}>{pending ? "Creando cuenta…" : "Crear mi cuenta"}</button>; }
export function CustomerRegistrationForm({
  next,
  returnTo,
  claim,
  inline = false,
  onLogin,
  onAuthenticated,
}: Readonly<{
  next: string | null;
  returnTo: string | null;
  claim: boolean;
  inline?: boolean;
  onLogin?: () => void;
  onAuthenticated?: () => void;
}>) {
  const [state, action] = useActionState(registerCustomerAction, initialCustomerRegistrationState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sent" | "error">("idle");
  const [cooldown, setCooldown] = useState(0);
  const [resending, startResend] = useTransition();
  useEffect(() => {
    if (state.status === "authenticated") onAuthenticated?.();
  }, [onAuthenticated, state.status]);
  useEffect(() => {
    if (state.status !== "verification_required" && state.status !== "account_exists_or_login_required") return;
    setPassword("");
  }, [state.status]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const loginHref = `/cuenta/login?${new URLSearchParams({ ...(next ? { next } : {}), ...(returnTo ? { returnTo } : {}), ...(claim ? { claim: "1" } : {}) }).toString()}`;
  const awaitingVerification = state.status === "verification_required" || state.status === "account_exists_or_login_required";
  const switchToLogin = onLogin
    ? <button type="button" className="customer-auth-text-button" onClick={onLogin}>Iniciar sesión</button>
    : <Link href={loginHref}>Iniciar sesión</Link>;

  if (awaitingVerification) {
    const existingAccount = state.status === "account_exists_or_login_required";
    return (
      <section className="customer-login-form" aria-live="polite">
        <p className="customer-form-success" role="status">
          <strong>Revisa tu correo</strong><br />
          {existingAccount
            ? "Revisa tu correo para verificar la cuenta o inicia sesión si ya la habías creado."
            : "Te enviamos un enlace para verificar tu cuenta. Al abrirlo continuaremos automáticamente."}
        </p>
        <button
          type="button"
          disabled={resending || cooldown > 0 || !email}
          onClick={() => startResend(async () => {
            const result = await resendCustomerRegistrationConfirmationAction({ email, next, returnTo, claim });
            setResendStatus(result.status === "sent" ? "sent" : "error");
            if (result.status === "sent" || result.status === "rate_limited") {
              setCooldown(CUSTOMER_CONFIRMATION_RESEND_COOLDOWN_SECONDS);
            }
          })}
        >
          {cooldown > 0 ? `Reenviar correo (${cooldown}s)` : resending ? "Enviando…" : "Reenviar correo"}
        </button>
        {resendStatus === "sent" && <p className="customer-form-success" role="status">Si el correo puede verificarse, recibirás un nuevo enlace.</p>}
        {resendStatus === "error" && <p className="customer-form-error" role="alert">No fue posible reenviar el correo. Intenta nuevamente en unos minutos.</p>}
        <p className="customer-auth-switch">¿Ya tienes cuenta? {switchToLogin}</p>
      </section>
    );
  }

  return (
    <form action={action} className="customer-login-form">
      {next && <input type="hidden" name="next" value={next}/>}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo}/>}
      {claim && <input type="hidden" name="claim" value="1"/>}
      {inline && <input type="hidden" name="inline" value="1"/>}
      <label>Correo electrónico<input name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)}/></label>
      <label>
        Contraseña
        <div className="customer-password-field">
          <input name="password" type={passwordVisible ? "text" : "password"} autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)}/>
          <button type="button" className="customer-auth-text-button" onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? "Ocultar" : "Mostrar"}</button>
        </div>
      </label>
      {state.status === "error" && <p className="customer-form-error" role="alert">{state.message}</p>}
      <Submit/>
      <p className="customer-auth-switch">¿Ya tienes cuenta? {switchToLogin}</p>
    </form>
  );
}
