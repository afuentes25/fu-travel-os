"use client";

import { useEffect, useRef, useState } from "react";

import { extractBoardingRawToken } from "@/lib/boarding/boarding-qr-core";
import type { BoardingScanPreview } from "@/lib/boarding/boarding-scan-core";

import {
  boardBoardingTravelerAction,
  checkInBoardingTravelerAction,
  resolveBoardingScanAction,
} from "./boarding-actions";
import styles from "./boarding.module.css";

type ScannerControls = Readonly<{ stop: () => void }>;

function dateTime(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function scanMessage(status: string) {
  if (status === "credential_unavailable") return "Este código ya no está vigente.";
  if (status === "forbidden") return "No tienes permiso para operar abordaje en esta agencia.";
  if (status === "invalid") return "No reconocimos este código de abordaje.";
  return "No fue posible validar este código. Inténtalo nuevamente.";
}

export function BoardingControl({ agencySlug }: Readonly<{ agencySlug: string }>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const rawTokenRef = useRef<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<BoardingScanPreview | null>(null);
  const [busy, setBusy] = useState<"checkin" | "board" | null>(null);
  const [confirmBoarding, setConfirmBoarding] = useState(false);

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => () => controlsRef.current?.stop(), []);

  const scanPayload = async (payload: string) => {
    const rawToken = extractBoardingRawToken(payload);
    stopCamera();
    setPreview(null);
    setConfirmBoarding(false);
    if (!rawToken) {
      rawTokenRef.current = null;
      setScannerMessage("No reconocimos este código de abordaje.");
      return;
    }
    setScannerMessage("Validando boleto…");
    try {
      const result = await resolveBoardingScanAction({ agencySlug, rawToken });
      if (result.status !== "valid") {
        rawTokenRef.current = null;
        setScannerMessage(scanMessage(result.status));
        return;
      }
      rawTokenRef.current = rawToken;
      setPreview(result.preview);
      setScannerMessage(null);
    } catch {
      rawTokenRef.current = null;
      setScannerMessage("No fue posible validar este código. Inténtalo nuevamente.");
    }
  };

  const startCamera = async () => {
    setScannerMessage(null);
    stopCamera();
    setCameraActive(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      let resolved = false;
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        videoRef.current ?? undefined,
        (result) => {
          if (!result || resolved) return;
          resolved = true;
          void scanPayload(result.getText());
        },
      );
      controlsRef.current = controls;
      if (resolved) stopCamera();
    } catch {
      setCameraActive(false);
      setScannerMessage("Activa el permiso de cámara en tu navegador e inténtalo nuevamente.");
    }
  };

  const clearScan = () => {
    rawTokenRef.current = null;
    setPreview(null);
    setConfirmBoarding(false);
    setScannerMessage(null);
  };

  const checkIn = async () => {
    const rawToken = rawTokenRef.current;
    if (!rawToken) return;
    setBusy("checkin");
    try {
      const result = await checkInBoardingTravelerAction({ agencySlug, rawToken });
      if (result.transition.status === "credential_unavailable") { clearScan(); setScannerMessage("Este código ya no está vigente."); return; }
      if (result.transition.status === "invalid_structure") { setScannerMessage("No fue posible registrar el check-in. Inténtalo nuevamente."); return; }
      if (result.transition.status !== "checked_in" && result.transition.status !== "already_checked_in" && result.transition.status !== "already_boarded") { setScannerMessage("No fue posible registrar el check-in. Inténtalo nuevamente."); return; }
      const refreshed = "scan" in result ? result.scan : undefined;
      if (refreshed?.status === "valid") setPreview(refreshed.preview);
    } catch { setScannerMessage("No fue posible registrar el check-in. Inténtalo nuevamente."); }
    finally { setBusy(null); }
  };

  const board = async () => {
    const rawToken = rawTokenRef.current;
    if (!rawToken) return;
    setBusy("board");
    try {
      const result = await boardBoardingTravelerAction({ agencySlug, rawToken });
      if (result.transition.status === "credential_unavailable") { clearScan(); setScannerMessage("Este código ya no está vigente."); return; }
      if (result.transition.status === "check_in_required") { setConfirmBoarding(false); setScannerMessage("Primero realiza el check-in del pasajero."); return; }
      if (result.transition.status === "invalid_structure") { setScannerMessage("No fue posible confirmar el abordaje. Inténtalo nuevamente."); return; }
      if (result.transition.status !== "boarded" && result.transition.status !== "already_boarded") { setScannerMessage("No fue posible confirmar el abordaje. Inténtalo nuevamente."); return; }
      const refreshed = "scan" in result ? result.scan : undefined;
      if (refreshed?.status === "valid") setPreview(refreshed.preview);
      setConfirmBoarding(false);
    } catch { setScannerMessage("No fue posible confirmar el abordaje. Inténtalo nuevamente."); }
    finally { setBusy(null); }
  };

  const boardingStatus = preview?.boarding.status;
  return <div className={styles.control}>
    <section className={styles.scannerCard} aria-labelledby="boarding-scanner-title">
      <div><span className={styles.eyebrow}>Control operativo</span><h2 id="boarding-scanner-title">Escanear boleto</h2><p>Permite el acceso a la cámara para escanear boletos.</p></div>
      <div className={styles.cameraViewport} data-active={cameraActive}>
        <video ref={videoRef} muted playsInline aria-label="Vista previa de cámara para escanear boletos" />
        {!cameraActive && <span>La cámara se activará únicamente al solicitarla.</span>}
      </div>
      <div className={styles.scannerActions}>
        {!cameraActive ? <button className={styles.primaryButton} type="button" onClick={() => void startCamera()}>Activar cámara</button> : <button className={styles.secondaryButton} type="button" onClick={stopCamera}>Detener cámara</button>}
      </div>
      {scannerMessage && <p className={styles.notice} role="status">{scannerMessage}</p>}
    </section>

    {preview && <section className={styles.previewCard} aria-live="polite" aria-labelledby="boarding-preview-title">
      <span className={styles.eyebrow}>Pasajero</span>
      <h2 id="boarding-preview-title">{preview.traveler.name}</h2>
      <p className={styles.type}>{preview.traveler.travelerType === "adult" ? "Adulto" : "Menor"}</p>
      <dl className={styles.tripFacts}>
        <div><dt>Reservación</dt><dd>{preview.trip.reservationCode}</dd></div>
        <div><dt>Tour</dt><dd>{preview.trip.tourName ?? "No disponible"}</dd></div>
        <div><dt>Salida</dt><dd>{dateTime(preview.trip.departureDate) ?? "No disponible"}</dd></div>
        <div><dt>Abordaje</dt><dd>{preview.trip.boardingPoint ?? "No disponible"}</dd></div>
      </dl>
      <div className={styles.statusPanel} data-status={boardingStatus}>
        {boardingStatus === "pending" && <><strong>Pendiente de check-in</strong><span>El escaneo no modifica el estado del pasajero.</span></>}
        {boardingStatus === "checked_in" && <><strong>✓ Check-in realizado</strong><span>{dateTime(preview.boarding.checkedInAt) ?? "Registrado"}</span></>}
        {boardingStatus === "boarded" && <><strong>✓ Abordaje confirmado</strong><span>{dateTime(preview.boarding.boardedAt) ?? "Registrado"}</span></>}
      </div>
      <div className={styles.previewActions}>
        {boardingStatus === "pending" && <button className={styles.primaryButton} type="button" disabled={busy !== null} onClick={() => void checkIn()}>{busy === "checkin" ? "Registrando check-in…" : "Realizar check-in"}</button>}
        {boardingStatus === "checked_in" && <button className={styles.primaryButton} type="button" disabled={busy !== null} onClick={() => setConfirmBoarding(true)}>Confirmar abordaje</button>}
        <button className={styles.secondaryButton} type="button" onClick={clearScan}>Escanear siguiente</button>
      </div>
      {confirmBoarding && <div className={styles.dialogBackdrop} role="presentation"><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="confirm-board-title"><h3 id="confirm-board-title">Confirmar abordaje</h3><p>Confirmar que {preview.traveler.name} abordó este viaje.</p><div><button className={styles.secondaryButton} type="button" onClick={() => setConfirmBoarding(false)}>Cancelar</button><button className={styles.primaryButton} type="button" disabled={busy !== null} onClick={() => void board()}>{busy === "board" ? "Confirmando…" : "Confirmar abordaje"}</button></div></section></div>}
    </section>}
  </div>;
}
