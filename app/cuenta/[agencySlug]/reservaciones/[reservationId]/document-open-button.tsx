"use client";
import { useState } from "react";
import { requestCustomerDocumentAction } from "./document-actions";
import styles from "./document-open-button.module.css";
export function DocumentOpenButton({ requestedAgencySlug, reservationId, documentKey }: Readonly<{ requestedAgencySlug: string; reservationId: string; documentKey: string }>) {
  const [state, setState] = useState<"idle" | "loading" | "unavailable" | "error">("idle");
  async function open() { setState("loading"); const result = await requestCustomerDocumentAction({ requestedAgencySlug, reservationId, documentKey }); if (result.status === "ready") { window.open(result.signedUrl, "_blank", "noopener,noreferrer"); setState("idle"); return; } setState(result.status === "unavailable" ? "unavailable" : "error"); }
  return <div className={styles.control}><button type="button" onClick={open} disabled={state === "loading"}>{state === "loading" ? "Preparando documento…" : "Ver documento"}</button>{state === "unavailable" && <p role="alert">Este documento ya no está disponible.</p>}{state === "error" && <p role="alert">No fue posible abrir el documento. Inténtalo nuevamente.</p>}</div>;
}
