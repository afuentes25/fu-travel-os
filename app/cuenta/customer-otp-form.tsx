"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  completeCustomerEmailOtpProfileAction,
  sendCustomerEmailOtpAction,
  verifyCustomerEmailOtpAction,
} from "./customer-otp-actions";
import { CUSTOMER_OTP_RESEND_COOLDOWN_SECONDS, type CustomerOtpStep } from "@/lib/customers/customer-otp-core";

type AuthenticatedResult = Readonly<{ destination: string | null }>;

function maskedEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "tu correo";
  return `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export function CustomerOtpForm({
  agencySlug,
  next,
  returnTo,
  claim,
  inline = false,
  onAuthenticated,
  onPassword,
}: Readonly<{
  agencySlug: string;
  next: string | null;
  returnTo: string | null;
  claim: boolean;
  inline?: boolean;
  onAuthenticated: (result: AuthenticatedResult) => void;
  onPassword: () => void;
}>) {
  const [step, setStep] = useState<CustomerOtpStep>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (step !== "code_sent") return;
    const timer = window.setTimeout(() => tokenRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [step]);

  const continuation = { next, returnTo, claim, inline };
  const setError = (text: string) => {
    setStep("error");
    setMessage(text);
  };
  const sendCode = () => {
    setStep("sending_code");
    setMessage(null);
    startTransition(async () => {
      const result = await sendCustomerEmailOtpAction({ email });
      if (result.status === "code_sent") {
        setStep("code_sent");
        setCooldown(CUSTOMER_OTP_RESEND_COOLDOWN_SECONDS);
      } else if (result.status === "rate_limited") {
        setStep("rate_limited");
        setCooldown(CUSTOMER_OTP_RESEND_COOLDOWN_SECONDS);
        setMessage("Espera un minuto antes de solicitar otro código.");
      } else {
        setError(result.status === "invalid_email" ? "Captura un correo electrónico válido." : "No pudimos enviar el código. Intenta nuevamente.");
      }
    });
  };
  const verifyCode = () => {
    setStep("verifying");
    setMessage(null);
    startTransition(async () => {
      const result = await verifyCustomerEmailOtpAction({ email, token, requestedAgencySlug: agencySlug, ...continuation });
      if (result.status === "authenticated") onAuthenticated({ destination: result.destination });
      else if (result.status === "profile_required") {
        setEmail(result.email);
        setStep("profile_required");
      } else if (result.status === "rate_limited") {
        setStep("rate_limited");
        setMessage("Espera un minuto antes de intentar nuevamente.");
      } else if (result.status === "invalid_code") {
        setStep("code_sent");
        setMessage("El código no es válido o ya venció. Intenta nuevamente.");
      } else setError("No pudimos verificar el código. Intenta nuevamente.");
    });
  };
  const completeProfile = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await completeCustomerEmailOtpProfileAction({ requestedAgencySlug: agencySlug, firstName, lastName, phone, ...continuation });
      if (result.status === "authenticated") onAuthenticated({ destination: result.destination });
      else if (result.status === "invalid_profile") setMessage("Captura al menos tu nombre. Revisa los demás datos e inténtalo nuevamente.");
      else setMessage(result.status === "account_unavailable" ? "No pudimos preparar tu acceso. Contáctanos para recibir ayuda." : "No pudimos guardar tus datos. Intenta nuevamente.");
    });
  };
  const useAnotherEmail = () => {
    setEmail("");
    setToken("");
    setMessage(null);
    setCooldown(0);
    setStep("email");
  };

  if (step === "profile_required") {
    return <section className="customer-login-form" aria-live="polite">
      <p className="customer-form-success" role="status"><strong>Completa tus datos</strong><br />Usaremos estos datos para preparar tu cuenta.</p>
      <label>Correo electrónico<input type="email" value={email} readOnly aria-readonly="true" /></label>
      <label>Nombre<input value={firstName} autoComplete="given-name" onChange={(event) => setFirstName(event.target.value)} required /></label>
      <label>Apellidos <small>(opcional)</small><input value={lastName} autoComplete="family-name" onChange={(event) => setLastName(event.target.value)} /></label>
      <label>WhatsApp <small>(opcional)</small><input value={phone} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} /></label>
      {message && <p className="customer-form-error" role="alert">{message}</p>}
      <button type="button" onClick={completeProfile} disabled={pending}>{pending ? "Guardando…" : "Continuar"}</button>
    </section>;
  }

  if (step === "code_sent" || step === "verifying" || step === "rate_limited") {
    return <section className="customer-login-form" aria-live="polite">
      <p className="customer-form-success" role="status"><strong>Revisa tu correo</strong><br />Enviamos un código a {maskedEmail(email)}.</p>
      <label htmlFor="customer-otp-code">Código de verificación
        <input id="customer-otp-code" ref={tokenRef} value={token} onChange={(event) => setToken(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={12} required />
      </label>
      {message && <p className={step === "rate_limited" ? "customer-form-error" : "customer-form-error"} role="alert">{message}</p>}
      <button type="button" onClick={verifyCode} disabled={pending || step === "rate_limited"}>{pending || step === "verifying" ? "Verificando…" : "Continuar"}</button>
      <button type="button" className="customer-auth-text-button" onClick={sendCode} disabled={pending || cooldown > 0}>
        {cooldown > 0 ? `Reenviar código (${cooldown}s)` : "Reenviar código"}
      </button>
      <button type="button" className="customer-auth-text-button" onClick={useAnotherEmail} disabled={pending}>Usar otro correo</button>
    </section>;
  }

  return <form className="customer-login-form" onSubmit={(event) => { event.preventDefault(); sendCode(); }} aria-live="polite">
    <label htmlFor="customer-otp-email">Correo electrónico
      <input id="customer-otp-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required disabled={pending} />
    </label>
    {message && <p className="customer-form-error" role="alert">{message}</p>}
    <button type="submit" disabled={pending}>{pending || step === "sending_code" ? "Enviando…" : "Continuar"}</button>
    <p className="customer-auth-switch">Te enviaremos un código para continuar.</p>
    <button type="button" className="customer-auth-text-button" onClick={onPassword} disabled={pending}>Acceder con contraseña</button>
  </form>;
}
