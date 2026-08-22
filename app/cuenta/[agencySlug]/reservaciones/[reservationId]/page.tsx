import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import {
  CustomerReservationDetailError,
  getCustomerReservationDetail,
} from "@/lib/customers/customer-reservation-detail";
import { ensureReservationTravelerSlots } from "@/lib/travelers/traveler-slots";
import { getReservationTravelerData } from "@/lib/travelers/traveler-data";
import { getReservationFinancialSummary } from "@/lib/payments/reservation-financial";
import { listCustomerReservationPayments } from "@/lib/payments/customer-payment-list";
import { listCustomerReservationDocuments } from "@/lib/documents/customer-document-list";

import { CustomerShell } from "../../../customer-shell";
import { TravelerDataForm } from "./traveler-data-form";
import { CustomerTransferForm } from "./customer-transfer-form";
import { DocumentOpenButton } from "./document-open-button";
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
      <CustomerShell>
        <section className={styles.stateCard} role="alert">
          <h1>{unavailable ? "Reservación no disponible" : "No fue posible cargar la reservación"}</h1>
          <p>{unavailable ? "No encontramos una reservación disponible para tu cuenta." : "Intenta nuevamente en unos momentos."}</p>
        </section>
      </CustomerShell>
    );
  }

  if (detail.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (detail.status === "selection_required") redirect("/cuenta");
  if (detail.status === "forbidden" || detail.status === "not_found") {
    return (
      <CustomerShell>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
          <Link className={styles.reservationLink} href={`/cuenta/${encodeURIComponent(agencySlug)}/reservaciones`}>Volver a Mis reservaciones</Link>
        </section>
      </CustomerShell>
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
      <CustomerShell>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
        </section>
      </CustomerShell>
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
      <CustomerShell>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
        </section>
      </CustomerShell>
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
    return <CustomerShell><section className={styles.stateCard}><h1>Reservación no disponible</h1><p>No encontramos una reservación disponible para tu cuenta.</p></section></CustomerShell>;
  }

  let travelerSlots: Awaited<ReturnType<typeof ensureReservationTravelerSlots>>;
  try {
    travelerSlots = await ensureReservationTravelerSlots({
      requestedAgencySlug: agencySlug,
      reservationId,
    });
  } catch {
    travelerSlots = { status: "invalid_structure" };
  }

  if (travelerSlots.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (travelerSlots.status === "selection_required") redirect("/cuenta");
  if (travelerSlots.status === "forbidden" || travelerSlots.status === "not_found") {
    return (
      <CustomerShell>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
          <Link className={styles.reservationLink} href={`/cuenta/${encodeURIComponent(agencySlug)}/reservaciones`}>Volver a Mis reservaciones</Link>
        </section>
      </CustomerShell>
    );
  }

  const { reservation } = detail;
  const financialSummary = financial.status === "authorized" ? financial.summary : null;
  const payments = paymentHistory.payments;
  const documents = documentList.documents;
  const slots = travelerSlots.status === "ready" ? travelerSlots.slots : [];
  let travelerData: Awaited<ReturnType<typeof getReservationTravelerData>> | null = null;
  if (travelerSlots.status === "ready") {
    try {
      travelerData = await getReservationTravelerData({
        requestedAgencySlug: agencySlug,
        reservationId,
      });
    } catch {
      travelerData = null;
    }
  }
  if (travelerData?.status === "unauthenticated") {
    redirect(`/cuenta/login?next=${encodeURIComponent(`/cuenta/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (travelerData?.status === "selection_required") redirect("/cuenta");
  if (travelerData?.status === "forbidden" || travelerData?.status === "not_found") {
    return (
      <CustomerShell>
        <section className={styles.stateCard}>
          <h1>Reservación no disponible</h1>
          <p>No encontramos una reservación disponible para tu cuenta.</p>
        </section>
      </CustomerShell>
    );
  }
  const travelersByPosition = new Map(
    travelerData?.status === "authorized"
      ? travelerData.travelers.map((traveler) => [traveler.position, traveler])
      : [],
  );
  const travelerDataComplete = slots.length > 0 && slots.every((slot) => slot.status === "complete");
  return (
    <CustomerShell account={detail.account}>
      <section className={styles.content} aria-labelledby="customer-reservation-title">
        <Link className={styles.backLink} href={`/cuenta/${encodeURIComponent(detail.account.agencySlug)}/reservaciones`}>← Volver a Mis reservaciones</Link>
        <header className={styles.detailHeading}>
          <div>
            <span className={styles.kicker}>Mi reservación</span>
            <h1 id="customer-reservation-title">{reservation.reservationCode}</h1>
            <span className={styles.status}>{customerReservationStatusLabel(reservation.status)}</span>
          </div>
          <p>Creada: {date(reservation.createdAt)}</p>
        </header>

        <aside className={styles.nextStep} aria-label="Próximo paso">
          <strong>Próximo paso</strong>
          <p>{customerReservationDetailNextStep(reservation.status)}</p>
        </aside>

        <div className={styles.detailGrid}>
          <section className={styles.detailCard} aria-labelledby="customer-trip-title"><h2 id="customer-trip-title">Resumen del viaje</h2><dl><div><dt>Tour</dt><dd>{valueOrUnavailable(reservation.trip.name)}</dd></div><div><dt>Clave</dt><dd>{valueOrUnavailable(reservation.trip.code)}</dd></div><div><dt>Fecha de salida</dt><dd>{date(reservation.trip.departureDate)}</dd></div><div><dt>Punto de abordaje</dt><dd>{valueOrUnavailable(reservation.trip.boardingPointName)}</dd></div></dl></section>
          <section className={styles.detailCard} aria-labelledby="customer-occupancy-title"><h2 id="customer-occupancy-title">Ocupación</h2><dl><div><dt>Habitaciones</dt><dd>{valueOrUnavailable(reservation.occupancy.rooms)}</dd></div><div><dt>Adultos</dt><dd>{valueOrUnavailable(reservation.occupancy.adults)}</dd></div><div><dt>Menores</dt><dd>{valueOrUnavailable(reservation.occupancy.minors)}</dd></div><div><dt>Total viajeros</dt><dd>{valueOrUnavailable(reservation.occupancy.totalTravelers)}</dd></div></dl></section>
          <section className={styles.detailCard} aria-labelledby="customer-finance-title"><h2 id="customer-finance-title">Estado financiero</h2>{financialSummary ? <><dl><div><dt>Total del Tour</dt><dd>{financialMoney(financialSummary.contract.total, financialSummary.currency)}</dd></div><div><dt>Anticipo requerido</dt><dd>{financialMoney(financialSummary.contract.depositRequired, financialSummary.currency)}{financialSummary.contract.depositPercent === null ? "" : ` · ${financialSummary.contract.depositPercent}%`}</dd></div><div><dt>Pagos confirmados</dt><dd>{financialMoney(financialSummary.payments.confirmedTotal, financialSummary.currency)}</dd></div>{financialSummary.payments.pendingTotal > 0 && <div><dt>Pagos en validación</dt><dd>{financialMoney(financialSummary.payments.pendingTotal, financialSummary.currency)}</dd></div>}<div><dt>Saldo pendiente</dt><dd className={styles.financialRemaining}>{financialMoney(financialSummary.balance.remaining, financialSummary.currency)}</dd></div></dl><p className={styles.financialMessage} role="status">{financialSummary.balance.fullyPaid ? "Tu reservación está pagada." : financialSummary.balance.depositCovered === true ? `Tu anticipo está cubierto. Saldo pendiente: ${financialMoney(financialSummary.balance.remaining, financialSummary.currency)}.` : financialSummary.balance.depositCovered === false ? `Tu anticipo requerido es de ${financialMoney(financialSummary.contract.depositRequired, financialSummary.currency)}.` : "Consulta con la agencia las condiciones de pago de tu reservación."}</p><CustomerTransferForm requestedAgencySlug={detail.account.agencySlug} reservationId={reservationId} currency={financialSummary.currency} /></> : <p className={styles.travelerNotice} role="alert">No fue posible calcular el estado financiero de esta reservación. Contacta a la agencia para recibir asistencia.</p>}</section>
          <section className={styles.detailCard} aria-labelledby="customer-contact-title"><h2 id="customer-contact-title">Contacto principal</h2>{reservation.primaryContact ? <dl><div><dt>Nombre</dt><dd>{valueOrUnavailable(reservation.primaryContact.fullName)}</dd></div><div><dt>Correo</dt><dd>{valueOrUnavailable(reservation.primaryContact.email)}</dd></div><div><dt>Teléfono</dt><dd>{valueOrUnavailable(reservation.primaryContact.phone)}</dd></div></dl> : <p className={styles.unavailable}>No disponible</p>}</section>
        </div>

        <section className={styles.detailCard} aria-labelledby="customer-payments-title">
          <h2 id="customer-payments-title">Pagos</h2>
          {payments.length === 0 ? <div className={styles.paymentEmpty}><p>No hay pagos registrados todavía.</p><span>Cuando la agencia confirme un pago, aparecerá aquí.</span></div> : <div className={styles.customerPaymentList}>{payments.map((payment, index) => <article className={`${styles.customerPaymentItem} ${payment.status === "cancelled" ? styles.customerPaymentCancelled : ""}`} key={`${payment.createdAt}-${index}`}>
            <div className={styles.customerPaymentHeading}><strong>{financialMoney(payment.amount, payment.currency)}</strong><span className={styles.customerPaymentMethod}>{customerPaymentMethodLabels[payment.method]}</span><span className={`${styles.customerPaymentStatus} ${styles[`customerPayment${payment.status}`]}`}>{customerPaymentStatusLabels[payment.status]}</span></div>
            <p className={styles.customerPaymentDate}>{date(payment.paidAt ?? payment.createdAt)}</p>
            <p className={styles.customerPaymentMessage}>{customerPaymentMessages[payment.status]}</p>
          </article>)}</div>}
        </section>

        <section className={styles.detailCard} aria-labelledby="customer-documents-title">
          <h2 id="customer-documents-title">Documentos</h2>
          {documents.length === 0 ? <div className={styles.paymentEmpty}><p>Aún no hay documentos disponibles.</p><span>Los documentos de tu viaje aparecerán aquí conforme estén disponibles.</span></div> : <div className={styles.customerPaymentList}>{documents.map((document) => <article className={styles.customerPaymentItem} key={document.documentKey}>
            <div className={styles.customerPaymentHeading}><strong>{customerDocumentLabels[document.documentType]}</strong>{document.documentType === "payment_receipt" && <span className={styles.customerPaymentMethod}>Documento no fiscal</span>}</div>
            {document.paymentContext && <p className={styles.customerPaymentMessage}>{financialMoney(document.paymentContext.amount, document.paymentContext.currency)} · {date(document.paymentContext.paidAt)}</p>}
            {document.documentType !== "payment_receipt" && <p className={styles.customerPaymentDate}>{date(document.generatedAt)}</p>}
            <DocumentOpenButton requestedAgencySlug={detail.account.agencySlug} reservationId={reservationId} documentKey={document.documentKey} />
          </article>)}</div>}
        </section>

        <section className={styles.detailCard} aria-labelledby="customer-travelers-title">
          <div className={styles.detailCardHeader}><h2 id="customer-travelers-title">Viajeros</h2>{travelerSlots.status === "ready" && <p role="status">{travelerDataComplete ? "Datos de viajeros completos" : "Datos de viajeros pendientes de completar"}</p>}</div>
          <p className={styles.travelerIntro}>Completa los datos de las personas que viajarán en esta reservación.</p>
          {travelerSlots.status === "invalid_structure" || travelerData === null ? <p className={styles.travelerNotice} role="alert">No fue posible preparar los datos de viajeros de esta reservación. Contacta a la agencia para recibir asistencia.</p> : <div className={styles.travelerSlotGrid}>{slots.map((slot) => { const traveler = travelersByPosition.get(slot.position); return <article className={styles.travelerSlot} key={slot.id}><div className={styles.travelerSlotHeader}><strong>Viajero {slot.position}</strong><span className={styles.travelerType}>{slot.travelerType === "adult" ? "Adulto" : "Menor"}</span><span className={slot.status === "complete" ? styles.travelerComplete : styles.travelerPending}>{slot.status === "complete" ? "Datos completos" : "Datos pendientes"}</span></div>{traveler && <TravelerDataForm requestedAgencySlug={detail.account.agencySlug} reservationId={reservationId} position={traveler.position} firstName={traveler.firstName} lastName={traveler.lastName} birthDate={traveler.birthDate} complete={traveler.status === "complete"} />}</article>; })}</div>}
        </section>
      </section>
    </CustomerShell>
  );
}
