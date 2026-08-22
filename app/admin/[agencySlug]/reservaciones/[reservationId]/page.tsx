import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { listAdminReservationPayments } from "@/lib/payments/admin-payment-list";
import {
  AdminReservationDetailError,
  createAdminReservationDetailRepository,
} from "@/lib/reservations/admin-detail-repository";

import { AdminShell } from "../../../admin-shell";
import { adminReservationStatusLabel } from "../../../admin-utils";
import { ManualPaymentForm } from "./manual-payment-form";
import { PaymentEvidenceButton } from "./payment-evidence-button";
import { PaymentStatusControls } from "./payment-status-controls";
import { PaymentReceiptControl } from "./payment-receipt-control";
import { ContractPreparationControl } from "./contract-preparation-control";
import styles from "../../../admin.module.css";
import detailStyles from "./admin-detail.module.css";

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

function dateTime(value: string | null) {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "No disponible"
    : parsed.toLocaleString("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

const paymentMethodLabels = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  payment_link: "Enlace de pago",
  other: "Otro",
} as const;

const paymentStatusLabels = {
  pending: "En validación",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
} as const;

export default async function AdminReservationDetailPage({
  params,
}: {
  params: Promise<{ agencySlug: string; reservationId: string }>;
}) {
  noStore();
  const { agencySlug, reservationId } = await params;
  let access: Awaited<ReturnType<typeof resolveAdminAgencyAccess>>;
  try {
    access = await resolveAdminAgencyAccess({ requestedAgencySlug: agencySlug });
  } catch {
    return <AdminShell><section className={styles.stateCard} role="alert"><h1>No fue posible cargar la reservación</h1><p>Intenta nuevamente en unos momentos.</p></section></AdminShell>;
  }

  if (access.status === "unauthenticated") {
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/${agencySlug}/reservaciones/${reservationId}`)}`);
  }
  if (access.status === "selection_required") redirect("/admin");
  if (access.status === "forbidden") {
    return <AdminShell><section className={styles.stateCard}><h1>Acceso no autorizado</h1><p>No tienes permiso para administrar esta sección.</p></section></AdminShell>;
  }

  let reservation;
  try {
    reservation = await createAdminReservationDetailRepository().find({
      agencyId: access.agency.agencyId,
      reservationId,
    });
  } catch (error) {
    const unavailable = error instanceof AdminReservationDetailError && (error.kind === "invalid" || error.kind === "not_found");
    return (
      <AdminShell agency={access.agency} memberships={access.memberships}>
        <section className={styles.stateCard}>
          <h1>{unavailable ? "Reservación no disponible" : "No fue posible cargar la reservación"}</h1>
          <p>{unavailable ? "No encontramos una reservación disponible para esta agencia." : "Intenta nuevamente en unos momentos."}</p>
          <Link className={detailStyles.detailLink} href={`/admin/${encodeURIComponent(access.agency.agencySlug)}/reservaciones`}>Volver a reservaciones</Link>
        </section>
      </AdminShell>
    );
  }

  let paymentHistory: Awaited<ReturnType<typeof listAdminReservationPayments>>;
  try {
    paymentHistory = await listAdminReservationPayments({
      requestedAgencySlug: access.agency.agencySlug,
      reservationId,
    });
  } catch {
    paymentHistory = { status: "not_found" };
  }
  const payments = paymentHistory.status === "authorized" ? paymentHistory.payments : [];
  const financialSummary = paymentHistory.status === "authorized" ? paymentHistory.financialSummary : null;

  return (
    <AdminShell agency={access.agency} memberships={access.memberships}>
      <section className={`${styles.content} ${detailStyles.detailContent}`} aria-labelledby="admin-reservation-title">
        <Link className={detailStyles.backLink} href={`/admin/${encodeURIComponent(access.agency.agencySlug)}/reservaciones`}>← Volver a reservaciones</Link>
        <header className={detailStyles.detailHeading}>
          <div><span className={styles.kicker}>Reservación</span><h1 id="admin-reservation-title">{reservation.reservationCode}</h1><span className={styles.status}>{adminReservationStatusLabel(reservation.status)}</span></div>
          <div className={detailStyles.detailActions}><p>Creada: {date(reservation.createdAt)}</p><ManualPaymentForm requestedAgencySlug={access.agency.agencySlug} reservationId={reservation.id} currency={reservation.amounts.currency} /></div>
        </header>
        <div className={detailStyles.detailGrid}>
          <section className={detailStyles.detailCard} aria-labelledby="detail-trip-title"><h2 id="detail-trip-title">Viaje y salida</h2><dl><div><dt>Tour</dt><dd>{valueOrUnavailable(reservation.trip.name)}</dd></div><div><dt>Clave</dt><dd>{valueOrUnavailable(reservation.trip.code)}</dd></div><div><dt>Fecha de salida</dt><dd>{date(reservation.trip.departureDate)}</dd></div><div><dt>Punto de abordaje</dt><dd>{valueOrUnavailable(reservation.trip.boardingPointName)}</dd></div></dl></section>
          <section className={detailStyles.detailCard} aria-labelledby="detail-occupancy-title"><h2 id="detail-occupancy-title">Ocupación</h2><dl><div><dt>Habitaciones</dt><dd>{valueOrUnavailable(reservation.occupancy.rooms)}</dd></div><div><dt>Adultos</dt><dd>{valueOrUnavailable(reservation.occupancy.adults)}</dd></div><div><dt>Menores</dt><dd>{valueOrUnavailable(reservation.occupancy.minors)}</dd></div><div><dt>Total de viajeros</dt><dd>{valueOrUnavailable(reservation.occupancy.totalTravelers)}</dd></div></dl></section>
          <section className={detailStyles.detailCard} aria-labelledby="detail-amounts-title"><h2 id="detail-amounts-title">Estado financiero</h2>{financialSummary ? <dl><div><dt>Total del Tour</dt><dd>{money(financialSummary.contract.total, financialSummary.currency)}</dd></div><div><dt>Anticipo requerido {financialSummary.contract.depositPercent === null ? "" : `(${financialSummary.contract.depositPercent}%)`}</dt><dd>{money(financialSummary.contract.depositRequired, financialSummary.currency)}</dd></div><div><dt>Pagos confirmados</dt><dd>{money(financialSummary.payments.confirmedTotal, financialSummary.currency)}</dd></div>{financialSummary.payments.pendingTotal > 0 && <div><dt>Pagos en validación</dt><dd>{money(financialSummary.payments.pendingTotal, financialSummary.currency)}</dd></div>}<div><dt>Saldo pendiente</dt><dd>{money(financialSummary.balance.remaining, financialSummary.currency)}</dd></div></dl> : <p className={detailStyles.unavailable}>No fue posible calcular el estado financiero de esta reservación.</p>}</section>
          <section className={detailStyles.detailCard} aria-labelledby="detail-contact-title"><h2 id="detail-contact-title">Contacto principal</h2>{reservation.primaryContact ? <dl><div><dt>Nombre</dt><dd>{valueOrUnavailable(reservation.primaryContact.fullName)}</dd></div><div><dt>Correo</dt><dd>{valueOrUnavailable(reservation.primaryContact.email)}</dd></div><div><dt>Teléfono</dt><dd>{valueOrUnavailable(reservation.primaryContact.phone)}</dd></div></dl> : <p className={detailStyles.unavailable}>No disponible</p>}</section>
        </div>
        <section className={detailStyles.detailCard} aria-labelledby="detail-travelers-title">
          <div className={detailStyles.detailCardHeader}><h2 id="detail-travelers-title">Viajeros</h2>{reservation.travelerDataStatus === "pending" && <p role="status">Datos de viajeros pendientes de completar.</p>}</div>
          {reservation.travelers.length ? <div className={detailStyles.travelersTableWrap}><table className={detailStyles.travelersTable}><thead><tr><th>Categoría</th><th>Nombre</th><th>Edad</th><th>Estado</th></tr></thead><tbody>{reservation.travelers.map((traveler, index) => <tr key={`${traveler.category ?? "viajero"}-${index}`}><td>{valueOrUnavailable(traveler.category)}</td><td>{valueOrUnavailable(traveler.fullName)}</td><td>{valueOrUnavailable(traveler.age)}</td><td>{valueOrUnavailable(traveler.status)}</td></tr>)}</tbody></table></div> : <p className={detailStyles.unavailable}>No disponible</p>}
        </section>
        <section className={detailStyles.detailCard} aria-labelledby="detail-payments-title">
          <div className={detailStyles.detailCardHeader}><h2 id="detail-payments-title">Pagos</h2></div>
          {paymentHistory.status !== "authorized" ? <p className={detailStyles.unavailable}>No fue posible cargar los pagos de esta reservación.</p> : payments.length === 0 ? <p className={detailStyles.unavailable}>Aún no hay pagos registrados.</p> : <div className={detailStyles.paymentsList}>{payments.map((payment) => <article className={detailStyles.paymentItem} key={payment.paymentId}>
            <div className={detailStyles.paymentItemHeading}><div><strong>{money(payment.amount, payment.currency)}</strong><span className={detailStyles.paymentMeta}>{paymentMethodLabels[payment.method]}</span></div><span className={`${detailStyles.paymentStatus} ${detailStyles[`paymentStatus${payment.status}`]}`}>{paymentStatusLabels[payment.status]}</span></div>
            <dl className={detailStyles.paymentDetails}><div><dt>Fecha de pago</dt><dd>{dateTime(payment.paidAt)}</dd></div><div><dt>Registrado</dt><dd>{dateTime(payment.createdAt)}</dd></div>{payment.reference && <div><dt>Referencia</dt><dd>{payment.reference}</dd></div>}{payment.createdBy && <div><dt>Registrado por</dt><dd>{payment.createdBy.displayName}</dd></div>}{payment.statusChangedAt && <div><dt>Estado actualizado</dt><dd>{dateTime(payment.statusChangedAt)}</dd></div>}</dl>
            {payment.source === "customer" && payment.status === "pending" && !payment.hasEvidence && <p className={detailStyles.unavailable}>Comprobante no disponible</p>}
            {payment.hasEvidence && <PaymentEvidenceButton requestedAgencySlug={access.agency.agencySlug} reservationId={reservation.id} paymentId={payment.paymentId} />}
            <PaymentStatusControls requestedAgencySlug={access.agency.agencySlug} reservationId={reservation.id} paymentId={payment.paymentId} status={payment.status} canConfirm={!(payment.source === "customer" && !payment.hasEvidence)} />
            {payment.status === "confirmed" && payment.receiptStatus !== "available" && <PaymentReceiptControl requestedAgencySlug={access.agency.agencySlug} reservationId={reservation.id} paymentId={payment.paymentId} />}
            {payment.status === "cancelled" && payment.receiptStatus === "revoked" && <p className={detailStyles.unavailable}>Comprobante revocado</p>}
          </article>)}</div>}
        </section>
        <section className={detailStyles.detailCard} aria-labelledby="detail-contract-title"><h2 id="detail-contract-title">Contrato</h2><ContractPreparationControl agencySlug={access.agency.agencySlug} reservationId={reservation.id} /></section>
      </section>
    </AdminShell>
  );
}
