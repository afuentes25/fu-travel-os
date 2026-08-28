import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import {
  CustomerReservationDetailError,
  getCustomerReservationDetail,
} from "@/lib/customers/customer-reservation-detail";
import { buildTravelerSlotStructure } from "@/lib/travelers/traveler-slots-core";
import { getReservationTravelerData } from "@/lib/travelers/traveler-data";
import { getReservationFinancialSummary } from "@/lib/payments/reservation-financial";
import { getCustomerTransferReportability } from "@/lib/payments/customer-transfer";
import { listCustomerReservationPayments } from "@/lib/payments/customer-payment-list";
import { listCustomerReservationDocuments } from "@/lib/documents/customer-document-list";
import { createSupabaseCustomerContractAcceptanceRepository } from "@/lib/contracts/customer-contract-acceptance-repository";

import { CustomerThemeShell } from "../../../customer-theme-shell";
import { TravelerDataForm } from "./traveler-data-form";
import { CustomerTransferForm } from "./customer-transfer-form";
import { DocumentOpenButton } from "./document-open-button";
import { ContractAcceptanceForm } from "./contract-acceptance-form";
import { AcceptanceCertificateRetry } from "./acceptance-certificate-retry";
import {
  customerReservationDetailNextStep,
  customerReservationStatusLabel,
} from "../../../customer-reservation-utils";
import styles from "../../../cuenta.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function valueOrUnavailable(value: number | string | null) {
  return value ?? "No disponible";
}

function money(value: number | null, currency: string) {
  if (value === null) return "No disponible";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function financialMoney(value: number | null, currency: string) {
  return value === null ? "No disponible" : `${money(value, currency)} ${currency}`;
}

function date(value: string | null) {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "No disponible"
    : parsed.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

const customerPaymentMethodLabels = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  payment_link: "Enlace de pago",
  other: "Otro",
} as const;

const customerPaymentStatusLabels = {
  confirmed: "Confirmado",
  pending: "En validación",
  cancelled: "Cancelado",
} as const;

const customerPaymentMessages = {
  confirmed: "Este pago ya se refleja en tu saldo.",
  pending: "Este pago está en validación y todavía no reduce tu saldo.",
  cancelled: "Este movimiento fue cancelado y no se contabiliza en tu saldo.",
} as const;

const customerDocumentLabels = {
  payment_receipt: "Comprobante de pago",
  contract: "Contrato",
  acceptance_certificate: "Constancia de aceptación",
  voucher: "Voucher de viaje",
  ticket: "Boleto de viaje",
} as const;

export default async function CustomerReservationDetailPage({
  params,
}: Readonly<{ params: Promise<{ agencySlug: string; reservationId: string }> }>) {
  noStore();
  const { agencySlug, reservationId } = await params;
  let detail: Awaited<ReturnType<typeof getCustomerReservationDetail>>;
  try {
    detail = await getCustomerReservationDetail({
      requestedAgencySlug: agencySlug,
      reservationId,
    });
  } catch (error) {
    const unavailable = error instanceof CustomerReservationDetailError;
    return (
      <CustomerThemeShell agencySlug={agencySlug}>
        <section className={styles.stateCard} role="alert">
          <h1>{unavailable ? "Reservación no disponible" : "No fue posible cargar la reservación"}</h1>
          <p>{unavailable ? "No encontramos una reservación disponible para tu cuenta." : "Intenta nuevamente en unos momentos."}</p>
        </section>
      </CustomerThemeShell>
    );
  }

  if (detail.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (detail.status === "selection_required") redirect("/cuenta");
  if (detail.status === "forbidden" || detail.status === "not_found") {
    return (
      <CustomerThemeShell agencySlug={agencySlug}>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
          <Link className={styles.reservationLink} href={`/cuenta/${encodeURIComponent(agencySlug)}/reservaciones`}>Volver a Mis reservaciones</Link>
        </section>
      </CustomerThemeShell>
    );
  }

  let financial: Awaited<ReturnType<typeof getReservationFinancialSummary>>;
  try {
    financial = await getReservationFinancialSummary({
      requestedAgencySlug: agencySlug,
      reservationId,
    });
  } catch {
    financial = { status: "invalid_structure" };
  }
  if (financial.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (financial.status === "selection_required") redirect("/cuenta");
  if (financial.status === "forbidden" || financial.status === "not_found") {
    return (
      <CustomerThemeShell agencySlug={agencySlug}>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
        </section>
      </CustomerThemeShell>
    );
  }

  let transferCapacity: Awaited<ReturnType<typeof getCustomerTransferReportability>>;
  try {
    transferCapacity = await getCustomerTransferReportability({
      requestedAgencySlug: agencySlug,
      reservationId,
    });
  } catch {
    transferCapacity = { status: "invalid_structure" };
  }
  if (transferCapacity.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (transferCapacity.status === "selection_required") redirect("/cuenta");
  if (transferCapacity.status === "forbidden" || transferCapacity.status === "not_found") {
    return (
      <CustomerThemeShell agencySlug={agencySlug}>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
        </section>
      </CustomerThemeShell>
    );
  }

  let paymentHistory: Awaited<ReturnType<typeof listCustomerReservationPayments>>;
  try {
    paymentHistory = await listCustomerReservationPayments({
      requestedAgencySlug: agencySlug,
      reservationId,
    });
  } catch {
    paymentHistory = { status: "not_found" };
  }
  if (paymentHistory.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (paymentHistory.status === "selection_required") redirect("/cuenta");
  if (paymentHistory.status === "forbidden" || paymentHistory.status === "not_found") {
    return (
      <CustomerThemeShell agencySlug={agencySlug}>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
        </section>
      </CustomerThemeShell>
    );
  }

  let documentList: Awaited<ReturnType<typeof listCustomerReservationDocuments>>;
  try {
    documentList = await listCustomerReservationDocuments({ requestedAgencySlug: agencySlug, reservationId });
  } catch {
    documentList = { status: "not_found" };
  }
  if (documentList.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (documentList.status === "selection_required") redirect("/cuenta");
  if (documentList.status === "forbidden" || documentList.status === "not_found") {
    return <CustomerThemeShell agencySlug={agencySlug}><section className={styles.stateCard}><h1>Reservación no disponible</h1><p>No encontramos una reservación disponible para tu cuenta.</p></section></CustomerThemeShell>;
  }

  let travelerData: Awaited<ReturnType<typeof getReservationTravelerData>> | null;
  try {
    travelerData = await getReservationTravelerData({
      requestedAgencySlug: agencySlug,
      reservationId,
    });
  } catch {
    travelerData = null;
  }

  if (travelerData?.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (travelerData?.status === "selection_required") redirect("/cuenta");
  if (travelerData?.status === "forbidden" || travelerData?.status === "not_found") {
    return (
      <CustomerThemeShell agencySlug={agencySlug}>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
          <Link className={styles.reservationLink} href={`/cuenta/${encodeURIComponent(agencySlug)}/reservaciones`}>Volver a Mis reservaciones</Link>
        </section>
      </CustomerThemeShell>
    );
  }

  const { reservation } = detail;
  const financialSummary = financial.status === "authorized" ? financial.summary : null;
  const payments = paymentHistory.payments;
  const documents = documentList.documents;
  const contractDocument = documents.find((document) => document.documentType === "contract") ?? null;
  const acceptanceCertificate = documents.find((document) => document.documentType === "acceptance_certificate") ?? null;
  const voucherDocument = documents.find((document) => document.documentType === "voucher") ?? null;
  const ticketDocuments = documents.filter((document) => document.documentType === "ticket");
  let contractAccepted = false;
  let contractPrimary = false;
  if (contractDocument) try { const acceptanceRepository = createSupabaseCustomerContractAcceptanceRepository(); contractPrimary = await acceptanceRepository.findPrimaryLink({ customerAccountId: detail.account.customerAccountId, agencyId: detail.account.agencyId, reservationId }); const instance = await acceptanceRepository.findInstance({ agencyId: detail.account.agencyId, reservationId }); contractAccepted = instance?.status === "accepted"; } catch { contractPrimary = false; }
  const canonicalTravelers = travelerData?.status === "authorized"
    ? travelerData.travelers
    : [];
  const expectedTravelerSlots =
    Number.isInteger(reservation.occupancy.adults) &&
    Number.isInteger(reservation.occupancy.minors) &&
    (reservation.occupancy.adults ?? 0) > 0 &&
    (reservation.occupancy.minors ?? 0) >= 0
      ? buildTravelerSlotStructure({
          adults: reservation.occupancy.adults as number,
          minors: reservation.occupancy.minors as number,
        })
      : [];
  const travelerStructureReady =
    expectedTravelerSlots.length > 0 &&
    canonicalTravelers.length === expectedTravelerSlots.length &&
    expectedTravelerSlots.every((expected, index) => {
      const traveler = canonicalTravelers[index];
      return traveler?.position === expected.position &&
        traveler.travelerType === expected.travelerType;
    });
  const travelerDataComplete = travelerStructureReady &&
    canonicalTravelers.every((traveler) => traveler.status === "complete");
  const depositCovered = financialSummary?.balance.depositCovered === true;
  return (
    <CustomerThemeShell account={detail.account}>
      <section className={`${styles.content} ${styles.customerReservationDetail}`} aria-labelledby="customer-reservation-title">
        <Link className={styles.backLink} href={`/cuenta/${encodeURIComponent(detail.account.agencySlug)}/reservaciones`}>← Volver a Mis reservaciones</Link>
        <header className={styles.customerReservationHero}>
          <div className={styles.customerHeroCopy}>
            <span className={styles.kicker}>Reservación</span>
            <h1 id="customer-reservation-title">{valueOrUnavailable(reservation.trip.name)}</h1>
            <p className={styles.customerReservationCode}>{reservation.reservationCode}</p>
          </div>
          <div className={styles.customerHeroMeta}>
            <span className={styles.status}>{customerReservationStatusLabel(reservation.status)}</span>
            <p>Salida: {date(reservation.trip.departureDate)}</p>
          </div>
        </header>

        <section className={styles.customerSection} aria-labelledby="customer-trip-title">
          <div className={styles.sectionHeading}><div><span className={styles.sectionEyebrow}>Tu viaje</span><h2 id="customer-trip-title">Resumen del viaje</h2></div><p>{reservation.trip.code ?? ""}</p></div>
          <dl className={styles.travelFacts}>
            <div><dt>Fecha de salida</dt><dd>{date(reservation.trip.departureDate)}</dd></div>
            <div><dt>Viajeros</dt><dd>{valueOrUnavailable(reservation.occupancy.totalTravelers)}</dd></div>
            <div><dt>Habitaciones</dt><dd>{valueOrUnavailable(reservation.occupancy.rooms)}</dd></div>
            <div><dt>Punto de abordaje</dt><dd>{valueOrUnavailable(reservation.trip.boardingPointName)}</dd></div>
          </dl>
          {reservation.primaryContact && <div className={styles.contactStrip}><span>Contacto principal</span><p>{valueOrUnavailable(reservation.primaryContact.fullName)}{reservation.primaryContact.email ? ` · ${reservation.primaryContact.email}` : ""}{reservation.primaryContact.phone ? ` · ${reservation.primaryContact.phone}` : ""}</p></div>}
        </section>

        <section className={`${styles.customerSection} ${styles.customerNextSteps}`} aria-labelledby="customer-next-steps-title">
          <div className={styles.sectionHeading}><div><span className={styles.sectionEyebrow}>Organiza tu viaje</span><h2 id="customer-next-steps-title">Estado y próximos pasos</h2></div><p>{customerReservationDetailNextStep(reservation.status)}</p></div>
          <div className={styles.nextStepsGrid}>
            <div className={`${styles.nextStepItem} ${travelerDataComplete ? styles.nextStepComplete : ""}`}><strong>{travelerDataComplete ? "Viajeros completos" : "Completar datos de viajeros"}</strong><span>{travelerDataComplete ? "La información de las personas que viajan está lista." : "Captura la información de cada persona que viajará."}</span></div>
            <div className={`${styles.nextStepItem} ${depositCovered ? styles.nextStepComplete : ""}`}><strong>{depositCovered ? "Anticipo cubierto" : "Estado del anticipo"}</strong><span>{depositCovered ? "Tu anticipo requerido ya está cubierto." : "Consulta el resumen financiero para conocer el importe requerido."}</span></div>
            {contractDocument && <div className={`${styles.nextStepItem} ${contractAccepted ? styles.nextStepComplete : ""}`}><strong>{contractAccepted ? "Contrato aceptado" : "Aceptar contrato"}</strong><span>{contractAccepted ? "El registro de aceptación está disponible para tu reservación." : "Consulta las condiciones antes de confirmar su aceptación."}</span></div>}
            {voucherDocument && <div className={`${styles.nextStepItem} ${styles.nextStepComplete}`}><strong>Voucher disponible</strong><span>Encuéntralo junto con los demás documentos del viaje.</span></div>}
            {ticketDocuments.length > 0 && <div className={`${styles.nextStepItem} ${styles.nextStepComplete}`}><strong>{ticketDocuments.length === 1 ? "Boleto disponible" : "Boletos disponibles"}</strong><span>{ticketDocuments.length === 1 ? "Tu boleto está disponible en Documentos." : "Los boletos individuales están disponibles en Documentos."}</span></div>}
          </div>
          {contractDocument && <div className={styles.contractJourney} aria-labelledby="customer-contract-acceptance-title">
            <div><span className={styles.sectionEyebrow}>Contrato</span><h3 id="customer-contract-acceptance-title">{contractAccepted ? "Contrato aceptado" : "Contrato pendiente de aceptación"}</h3></div>
            {contractAccepted ? <>{acceptanceCertificate ? <p role="status">Contrato aceptado. La constancia de aceptación está disponible en Documentos.</p> : <><p role="status">Contrato aceptado. La constancia de aceptación aún no está disponible.</p>{contractPrimary && <AcceptanceCertificateRetry agencySlug={detail.account.agencySlug} reservationId={reservationId} />}</>}</> : contractPrimary ? <ContractAcceptanceForm agencySlug={detail.account.agencySlug} reservationId={reservationId} /> : <p>La aceptación contractual debe realizarla la cuenta principal vinculada a esta reservación.</p>}
          </div>}
        </section>

        <section className={styles.customerSection} aria-labelledby="customer-travelers-title">
          <div className={styles.sectionHeading}><div><span className={styles.sectionEyebrow}>Pasajeros</span><h2 id="customer-travelers-title">Viajeros</h2></div>{travelerStructureReady && <p className={travelerDataComplete ? styles.summaryComplete : styles.summaryPending} role="status">{travelerDataComplete ? "Datos de viajeros completos" : "Datos de viajeros pendientes de completar"}</p>}</div>
          <p className={styles.travelerIntro}>Completa los datos de las personas que viajarán en esta reservación.</p>
          {!travelerStructureReady ? <p className={styles.travelerNotice} role="alert">No fue posible preparar los datos de viajeros de esta reservación. Contacta a la agencia para recibir asistencia.</p> : <div className={styles.travelerSlotGrid}>{canonicalTravelers.map((traveler) => <article className={styles.travelerSlot} key={traveler.travelerId}><div className={styles.travelerSlotHeader}><strong>Viajero {traveler.position}</strong><span className={styles.travelerType}>{traveler.travelerType === "adult" ? "Adulto" : "Menor"}</span><span className={traveler.status === "complete" ? styles.travelerComplete : styles.travelerPending}>{traveler.status === "complete" ? "Datos completos" : "Datos pendientes"}</span></div><TravelerDataForm requestedAgencySlug={detail.account.agencySlug} reservationId={reservationId} travelerId={traveler.travelerId} position={traveler.position} firstName={traveler.firstName} lastName={traveler.lastName} birthDate={traveler.birthDate} complete={traveler.status === "complete"} /></article>)}</div>}
        </section>

        <section className={styles.customerSection} aria-labelledby="customer-payments-title">
          <div className={styles.sectionHeading}><div><span className={styles.sectionEyebrow}>Finanzas</span><h2 id="customer-payments-title">Pagos</h2></div></div>
          {financialSummary ? <><div className={styles.financialOverview}><div><span>Total del Tour</span><strong>{financialMoney(financialSummary.contract.total, financialSummary.currency)}</strong></div><div><span>Pagos confirmados</span><strong>{financialMoney(financialSummary.payments.confirmedTotal, financialSummary.currency)}</strong></div><div><span>Saldo pendiente</span><strong className={styles.financialRemaining}>{financialMoney(financialSummary.balance.remaining, financialSummary.currency)}</strong></div><div><span>Anticipo requerido</span><strong>{financialMoney(financialSummary.contract.depositRequired, financialSummary.currency)}{financialSummary.contract.depositPercent === null ? "" : ` · ${financialSummary.contract.depositPercent}%`}</strong></div>{financialSummary.payments.pendingTotal > 0 && <div><span>Pagos en validación</span><strong>{financialMoney(financialSummary.payments.pendingTotal, financialSummary.currency)}</strong></div>}</div><p className={styles.financialMessage} role="status">{financialSummary.balance.fullyPaid ? "Tu reservación está pagada." : financialSummary.balance.depositCovered === true ? `Tu anticipo está cubierto. Saldo pendiente: ${financialMoney(financialSummary.balance.remaining, financialSummary.currency)}.` : financialSummary.balance.depositCovered === false ? `Tu anticipo requerido es de ${financialMoney(financialSummary.contract.depositRequired, financialSummary.currency)}.` : "Consulta con la agencia las condiciones de pago de tu reservación."}</p></> : <p className={styles.travelerNotice} role="alert">No fue posible calcular el estado financiero de esta reservación. Contacta a la agencia para recibir asistencia.</p>}
          {financialSummary && <div className={styles.paymentActionPanel}>{transferCapacity.status === "available" ? <><div><h3>¿Ya realizaste una transferencia?</h3><p>Envíanos los datos y el comprobante para que la agencia pueda validarlo.</p><strong>Máximo disponible para reportar: {financialMoney(transferCapacity.reportability.reportableRemainingCents / 100, transferCapacity.reportability.currency)}</strong></div><CustomerTransferForm requestedAgencySlug={detail.account.agencySlug} reservationId={reservationId} currency={financialSummary.currency} reportableRemaining={transferCapacity.reportability.reportableRemainingCents / 100} /></> : transferCapacity.status === "reservation_paid_in_full" ? <div className={styles.paymentActionStatus}><h3>Reservación pagada</h3><p>Tu reservación está cubierta al 100%. No es necesario reportar más pagos.</p></div> : transferCapacity.status === "pending_payments_cover_remaining" ? <div className={styles.paymentActionStatus}><h3>Pago en validación</h3><p>Los pagos que están en validación cubren actualmente el saldo pendiente. Podrás reportar otro pago si alguno es rechazado o cancelado.</p></div> : <div className={styles.paymentActionStatus}><h3>Reporte de transferencia no disponible</h3><p>No fue posible calcular el saldo disponible para nuevos pagos. Contacta a la agencia para recibir asistencia.</p></div>}</div>}
          <div className={styles.subsectionHeading}><h3>Historial de pagos</h3><p>{payments.length === 0 ? "Sin movimientos registrados" : `${payments.length} ${payments.length === 1 ? "movimiento" : "movimientos"}`}</p></div>
          {payments.length === 0 ? <div className={styles.paymentEmpty}><p>No hay pagos registrados todavía.</p><span>Cuando la agencia confirme un pago, aparecerá aquí.</span></div> : <div className={styles.customerPaymentList}>{payments.map((payment, index) => <article className={`${styles.customerPaymentItem} ${payment.status === "cancelled" ? styles.customerPaymentCancelled : ""}`} key={`${payment.createdAt}-${index}`}>
            <div className={styles.customerPaymentHeading}><strong>{financialMoney(payment.amount, payment.currency)}</strong><span className={styles.customerPaymentMethod}>{customerPaymentMethodLabels[payment.method]}</span><span className={`${styles.customerPaymentStatus} ${styles[`customerPayment${payment.status}`]}`}>{customerPaymentStatusLabels[payment.status]}</span></div>
            <p className={styles.customerPaymentDate}>{date(payment.paidAt ?? payment.createdAt)}</p>
            <p className={styles.customerPaymentMessage}>{customerPaymentMessages[payment.status]}</p>
          </article>)}</div>}
        </section>

        <section className={styles.customerSection} aria-labelledby="customer-documents-title">
          <div className={styles.sectionHeading}><div><span className={styles.sectionEyebrow}>Tu archivo de viaje</span><h2 id="customer-documents-title">Documentos</h2></div></div>
          {documents.length === 0 ? <div className={styles.paymentEmpty}><p>Aún no hay documentos disponibles.</p><span>Los documentos de tu viaje aparecerán aquí conforme estén disponibles.</span></div> : <div className={styles.documentList}>{documents.map((document) => <article className={styles.documentRow} key={document.documentKey}>
            <div className={styles.documentIcon} aria-hidden="true">PDF</div>
            <div className={styles.documentCopy}><strong>{customerDocumentLabels[document.documentType]}</strong>{document.documentType === "payment_receipt" && <span>Documento no fiscal</span>}{document.paymentContext && <p>{financialMoney(document.paymentContext.amount, document.paymentContext.currency)} · {date(document.paymentContext.paidAt)}</p>}{document.acceptanceContext && <p>Aceptado el {date(document.acceptanceContext.acceptedAt)}</p>}{document.travelerContext && <p>{document.travelerContext.name} · {document.travelerContext.travelerType === "adult" ? "Adulto" : "Menor"}</p>}{!document.paymentContext && !document.acceptanceContext && !document.travelerContext && <p>Emitido {date(document.generatedAt)}</p>}</div>
            <DocumentOpenButton requestedAgencySlug={detail.account.agencySlug} reservationId={reservationId} documentKey={document.documentKey} />
          </article>)}</div>}
        </section>
      </section>
    </CustomerThemeShell>
  );
}
