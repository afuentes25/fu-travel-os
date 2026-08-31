"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { useRouter } from "next/navigation";

import { CustomerLoginForm } from "./login/login-form";
import { CustomerOtpForm } from "./customer-otp-form";
import styles from "./cuenta.module.css";

export type CustomerAuthMode = "otp" | "password";

function focusableControls(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(
    "button:not([disabled]), input:not([disabled]), a[href]:not([tabindex='-1'])",
  )];
}

export function CustomerAuthModal({
  open,
  mode,
  agencySlug,
  next = null,
  returnTo = null,
  claim = false,
  triggerRef,
  onClose,
  onModeChange,
}: Readonly<{
  open: boolean;
  mode: CustomerAuthMode;
  agencySlug: string;
  next?: string | null;
  returnTo?: string | null;
  claim?: boolean;
  triggerRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onModeChange: (mode: CustomerAuthMode) => void;
}>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const titleId = useId();
  const inline = Boolean(returnTo && !claim);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = focusableControls(dialogRef.current);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      (triggerRef?.current ?? previousFocusRef.current)?.focus();
    };
  }, [onClose, open, triggerRef]);

  if (!open) return null;
  const onAuthenticated = ({ destination }: Readonly<{ destination: string | null }>) => {
    onClose();
    router.refresh();
    if (destination) router.push(destination);
  };
  const password = mode === "password";
  return (
    <div
      className={styles.customerAuthBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.customerAuthModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.customerAuthModalHeader}>
          <div>
            <span className={styles.kicker}>FU TRAVEL OS · MI CUENTA</span>
            <h2 id={titleId}>{password ? "Acceder con contraseña" : "Accede a tu cuenta"}</h2>
            <p>{password ? "Usa tu contraseña si ya la tienes configurada." : "Consulta tus reservaciones, pagos y documentos."}</p>
          </div>
          <button className={styles.customerAuthClose} type="button" onClick={onClose} aria-label="Cerrar acceso a mi cuenta">×</button>
        </div>
        {returnTo && <p className={styles.authContext}>Después de continuar volverás a tu reservación.</p>}
        <div className={styles.customerAuthModalBody}>
          {password ? (
            <CustomerLoginForm next={next} returnTo={returnTo} claim={claim} inline={inline} onOtp={() => onModeChange("otp")} onAuthenticated={() => onAuthenticated({ destination: inline ? null : next })} />
          ) : (
            <CustomerOtpForm agencySlug={agencySlug} next={next} returnTo={returnTo} claim={claim} inline={inline} onPassword={() => onModeChange("password")} onAuthenticated={onAuthenticated} />
          )}
        </div>
      </div>
    </div>
  );
}
