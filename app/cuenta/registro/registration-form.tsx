"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { registerCustomerAction } from "./registration-actions";
import { initialCustomerRegistrationState } from "./registration-state";

function Submit() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending}>{pending ? "Creando cuenta…" : "Crear mi cuenta"}</button>; }
export function CustomerRegistrationForm({ next, returnTo, claim }: Readonly<{ next: string | null; returnTo: string | null; claim: boolean }>) { const [state, action] = useActionState(registerCustomerAction, initialCustomerRegistrationState); const loginHref = `/cuenta/login?${new URLSearchParams({ ...(next ? { next } : {}), ...(returnTo ? { returnTo } : {}), ...(claim ? { claim: "1" } : {}) }).toString()}`; return <form action={action} className="customer-login-form">{next && <input type="hidden" name="next" value={next}/>} {returnTo && <input type="hidden" name="returnTo" value={returnTo}/>} {claim && <input type="hidden" name="claim" value="1"/>}<label>Correo electrónico<input name="email" type="email" autoComplete="email" required/></label><label>Contraseña<input name="password" type="password" autoComplete="new-password" minLength={8} required/></label>{state.error && <p className="customer-form-error" role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}<Submit/><p className="customer-auth-switch">¿Ya tienes cuenta? <Link href={loginHref}>Iniciar sesión</Link></p></form>; }
