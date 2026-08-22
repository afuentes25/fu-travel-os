"use client";

import { useState } from "react";

import { requestPaymentEvidenceAccessAction } from "./payment-evidence-actions";
import styles from "./payment-evidence-button.module.css";

export function PaymentEvidenceButton({
  requestedAgencySlug,
  reservationId,
  paymentId,
}: Readonly<{
  requestedAgencySlug: string;
  reservationId: string;
  paymentId: string;
}>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openEvidence() {
    if (pending) return;
    const tab = window.open("", "_blank", "noopener,noreferrer");
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("requestedAgencySlug", requestedAgencySlug);
    formData.set("reservationId", reservationId);
    formData.set("paymentId", paymentId);
    try {
      const result = await requestPaymentEvidenceAccessAction(formData);
      if (result.status === "ready") {
        if (tab) {
          tab.opener = null;
          tab.location.replace(result.signedUrl);
        } else {
          window.open(result.signedUrl, "_blank", "noopener,noreferrer");
        }
        return;
      }
      tab?.close();
      setError(result.status === "forbidden" || result.status === "not_found"
        ? "No tienes permiso para abrir este comprobante."
        : "No fue posible abrir el comprobante. Intenta nuevamente.");
    } catch {
      tab?.close();
      setError("No fue posible abrir el comprobante. Intenta nuevamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.access}>
      <button type="button" onClick={openEvidence} disabled={pending}>
        {pending ? "Preparando comprobante…" : "Ver comprobante"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
