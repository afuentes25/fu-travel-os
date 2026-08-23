import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";
import { listAdminReservationPayments } from "@/lib/payments/admin-payment-list";
import { getReservationDocumentEligibility } from "@/lib/travel-documents/document-eligibility";
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
import { ContractDocumentControl } from "./contract-document-control";
import { VoucherControl } from "./voucher-control";
import { TicketControl } from "./ticket-control";
import { createSupabaseReservationContractDocumentRepository } from "@/lib/documents/reservation-contract-document-repository";
import { createSupabaseReservationVoucherRepository } from "@/lib/documents/reservation-voucher-document-repository";
import { createSupabaseReservationTicketRepository } from "@/lib/documents/reservation-ticket-document-repository";
import { reconcileReservationVoucherLifecycle } from "@/lib/travel-documents/voucher-lifecycle";
import { reconcileReservationTicketLifecycle } from "@/lib/travel-documents/ticket-lifecycle";
import type { ReservationContractDocumentRow, ReservationContractInstanceRow } from "@/lib/documents/reservation-contract-document-core";
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

const documentBlockerLabels = {
  contract_not_accepted: "Contrato pendiente de aceptación.", deposit_not_covered: "El anticipo requerido aún no está cubierto.", travelers_incomplete: "Faltan datos de viajeros.", departure_missing: "Falta la fecha de salida.", boarding_point_missing: "Falta el punto de abordaje.", payment_threshold_not_met: "El pago confirmado aún no alcanza el porcentaje requerido para emitir el boleto.", invalid_structure: "La reservación tiene información incompleta o inconsistente.",
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
  let documentEligibility: Awaited<ReturnType<typeof getReservationDocumentEligibility>> | null = null;
  try { documentEligibility = await getReservationDocumentEligibility({ requestedAgencySlug: access.agency.agencySlug, reservationId }); } catch { documentEligibility = null; }
  let voucherAvailable = false;
  let voucherRevoked = false;
  let voucherNextVersion = 1;
  let voucherReconciliationError = false;
  try {
    const vouchers = await createSupabaseReservationVoucherRepository().listVouchers({ agencyId: access.agency.agencyId, reservationId: reservation.id });
    voucherAvailable = vouchers.some((voucher) => voucher.status === "available");
    voucherRevoked = !voucherAvailable && vouchers.some((voucher) => voucher.status === "revoked" || voucher.status === "superseded");
    voucherNextVersion = Math.max(0, ...vouchers.map((voucher) => voucher.version)) + 1;
    if (voucherAvailable && documentEligibility?.status === "authorized" && !documentEligibility.eligibility.voucher.eligible) {
      const lifecycle = await reconcileReservationVoucherLifecycle({ requestedAgencySlug: access.agency.agencySlug, reservationId: reservation.id });
      if (lifecycle === "revoked") {
        voucherAvailable = false;
        voucherRevoked = true;
        voucherNextVersion = Math.max(voucherNextVersion, 2);
      } else if (lifecycle === "document_error") {
        voucherReconciliationError = true;
      }
    }
  } catch { voucherAvailable = false; voucherReconciliationError = true; }
  let ticketTravelers: Awaited<ReturnType<ReturnType<typeof createSupabaseReservationTicketRepository>["listTravelers"]>> = [];
  let ticketsByTraveler = new Map<string, Readonly<{ status: string; version: number }>>();
  let ticketReconciliationError = false;
  try {
    const ticketRepository = createSupabaseReservationTicketRepository();
    ticketTravelers = await ticketRepository.listTravelers({ agencyId: access.agency.agencyId, reservationId: reservation.id });
    const tickets = await ticketRepository.listReservationTickets({ agencyId: access.agency.agencyId, reservationId: reservation.id });
    if (tickets.some((ticket) => ticket.status === "available") && documentEligibility?.status === "authorized" && !documentEligibility.eligibility.ticket.eligible) {
      const lifecycle = await reconcileReservationTicketLifecycle({ requestedAgencySlug: access.agency.agencySlug, reservationId: reservation.id });
      if (lifecycle === "document_error") ticketReconciliationError = true;
    }
    if (!ticketReconciliationError) {
      const refreshed = await ticketRepository.listReservationTickets({ agencyId: access.agency.agencyId, reservationId: reservation.id });
      ticketsByTraveler = new Map();
      for (const ticket of refreshed) {
        const current = ticketsByTraveler.get(ticket.travelerId);
        if (!current || ticket.status === "available" || (current.status !== "available" && ticket.version > current.version)) {
          ticketsByTraveler.set(ticket.travelerId, { status: ticket.status, version: ticket.version });
        }
      }
    }
  } catch { ticketReconciliationError = true; }
  let contractInstance: ReservationContractInstanceRow | null = null;
  let contractDocument: ReservationContractDocumentRow | null = null;
  try {
    const contractRepository = createSupabaseReservationContractDocumentRepository();
    contractInstance = await contractRepository.findLatestInstance({ agencyId: access.agency.agencyId, reservationId: reservation.id });
    if (contractInstance && (contractInstance.status === "prepared" || contractInstance.status === "accepted")) contractDocument = await contractRepository.findExistingDocument({ agencyId: access.agency.agencyId, reservationId: reservation.id, contractInstanceId: contractInstance.id });
  } catch {
    contractInstance = null;
    contractDocument = null;
  }
  const completedTravelers = reservation.travelers.filter((traveler) => traveler.status === "complete").length;
  const availableTicketCount = [...ticketsByTraveler.values()].filter((ticket) => ticket.status === "available").length;
  const contractSummary = !contractInstance ? "Sin preparar" : contractInstance.status === "accepted" ? "Aceptado" : "Pendiente de aceptación";

  return (
    <AdminShell agency={access.agency} memberships={access.memberships}>
      <section className={`${styles.content} ${detailStyles.detailContent}`} aria-labelledby="admin-reservation-title">
        <Link className={detailStyles.backLink} href={`/admin/${encodeURIComponent(access.agency.agencySlug)}/reservaciones`}>← Volver a reservaciones</Link>
        <header className={detailStyles.detailHeading}>
          <div className={detailStyles.heroCopy}><span className={detailStyles.sectionEyebrow}>Reservación</span><h1 id="admin-reservation-title">{valueOrUnavailable(reservation.trip.name)}</h1><p className={detailStyles.reservationCode}>{reservation.reservationCode}</p></div>
          <div className={detailStyles.detailActions}><span className={detailStyles.headerStatus}>{adminReservationStatusLabel(reservation.status)}</span><p>Salida: {date(reservation.trip.departureDate)}</p><ManualPaymentForm requestedAgencySlug={access.agency.agencySlug} reservationId={reservation.id} currency={reservation.amounts.currency} /></div>
        </header>
        <div className={detailStyles.adminDetailLayout}>
          <main className={detailStyles.adminDetailMain}>
            <section className={`${detailStyles.detailCard} ${detailStyles.reservationOverview}`} aria-labelledby="detail-trip-title">
              <div className={detailStyles.sectionTitle}><span>Operación</span><h2 id="detail-trip-title">Reservación</h2></div>
              <div className={detailStyles.overviewGrid}>
                <dl><div><dt>Tour</dt><dd>{valueOrUnavailable(reservation.trip.name)}</dd></div><div><dt>Clave</dt><dd>{valueOrUnavailable(reservation.trip.code)}</dd></div><div><dt>Fecha de salida</dt><dd>{date(reservation.trip.departureDate)}</dd></div><div><dt>Punto de abordaje</dt><dd>{valueOrUnavailable(reservation.trip.boardingPointName)}</dd></div></dl>
                <dl><div><dt>Habitaciones</dt><dd>{valueOrUnavailable(reservation.occupancy.rooms)}</dd></div><div><dt>Adultos</dt><dd>{valueOrUnavailable(reservation.occupancy.adults)}</dd></div><div><dt>Menores</dt><dd>{valueOrUnavailable(reservation.occupancy.minors)}</dd></div><div><dt>Total viajeros</dt><dd>{valueOrUnavailable(reservation.occupancy.totalTravelers)}</dd></div></dl>
                <dl>{reservation.primaryContact ? <><div><dt>Contacto</dt><dd>{valueOrUnavailable(reservation.primaryContact.fullName)}</dd></div><div><dt>Correo</dt><dd>{valueOrUnavailable(reservation.primaryContact.email)}</dd></div><div><dt>Teléfono</dt><dd>{valueOrUnavailable(reservation.primaryContact.phone)}</dd></div></> : <div><dt>Contacto principal</dt><dd>No disponible</dd></div>}</dl>
              </div>
            </section>

            <section className={detailStyles.detailCard} aria-labelledby="detail-travelers-title">
              <div className={detailStyles.detailCardHeader}><div><span className={detailStyles.sectionEyebrow}>Pasajeros</span><h2 id="detail-travelers-title">Viajeros</h2></div><p className={reservation.travelerDataStatus === "pending" ? detailStyles.summaryPending : detailStyles.summaryComplete} role="status">{reservation.travelerDataStatus === "pending" ? "Datos pendientes" : `${completedTravelers} completos`}</p></div>
              {reservation.travelers.length ? <div className={detailStyles.travelersTableWrap}><table className={detailStyles.travelersTable}><thead><tr><th>Categoría</th><th>Nombre</th><th>Edad</th><th>Estado</th></tr></thead><tbody>{reservation.travelers.map((traveler, index) => <tr key={`${traveler.category ?? "viajero"}-${index}`}><td>{valueOrUnavailable(traveler.category)}</td><td>{valueOrUnavailable(traveler.fullName)}</td><td>{valueOrUnavailable(traveler.age)}</td><td><span className={traveler.status === "complete" ? detailStyles.inlineComplete : detailStyles.inlinePending}>{valueOrUnavailable(traveler.status)}</span></td></tr>)}</tbody></table></div> : <p className={detailStyles.unavailable}>No disponible</p>}
            </section>

            <section className={detailStyles.detailCard} aria-labelledby="detail-payments-title">
              <div className={detailStyles.detailCardHeader}><div><span className={detailStyles.sectionEyebrow}>Finanzas</span><h2 id="detail-payments-title">Pagos</h2></div></div>
              {financialSummary ? <div className={detailStyles.financeStrip}><div><span>Total contratado</span><strong>{money(financialSummary.contract.total, financialSummary.currency)}</strong></div><div><span>Confirmado</span><strong>{money(financialSummary.payments.confirmedTotal, financialSummary.currency)}</strong></div><div><span>Saldo</span><strong>{money(financialSummary.balance.remaining, financialSummary.currency)}</strong></div><div><span>Anticipo</span><strong>{money(financialSummary.contract.depositRequired, financialSummary.currency)}</strong></div>{financialSummary.payments.pendingTotal > 0 && <div><span>En validación</span><strong>{money(financialSummary.payments.pendingTotal, financialSummary.currency)}</strong></div>}</div> : <p className={detailStyles.unavailable}>No fue posible calcular el estado financiero de esta reservación.</p>}
              <div className={detailStyles.subsectionHeading}><h3>Movimientos</h3><p>{payments.length === 0 ? "Sin movimientos" : `${payments.length} ${payments.length === 1 ? "movimiento" : "movimientos"}`}</p></div>
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
            <section className={`${detailStyles.detailCard} ${detailStyles.contractPanel}`} aria-labelledby="detail-contract-title"><div className={detailStyles.detailCardHeader}><div><span className={detailStyles.sectionEyebrow}>Ciclo contractual</span><h2 id="detail-contract-title">Contrato</h2></div><p className={contractInstance?.status === "accepted" ? detailStyles.summaryComplete : detailStyles.summaryPending}>{contractSummary}</p></div>{contractInstance && (contractInstance.status === "prepared" || contractInstance.status === "accepted") ? <ContractDocumentControl agencySlug={access.agency.agencySlug} reservationId={reservation.id} templateVersion={contractInstance.contractTemplateVersion} contractStatus={contractInstance.status} hasDocument={contractDocument?.status === "available" && contractDocument.version === 1} /> : <ContractPreparationControl agencySlug={access.agency.agencySlug} reservationId={reservation.id} />}</section>
            <section className={`${detailStyles.detailCard} ${detailStyles.travelDocumentsPanel}`} aria-labelledby="detail-travel-documents-title"><div className={detailStyles.detailCardHeader}><div><span className={detailStyles.sectionEyebrow}>Operación</span><h2 id="detail-travel-documents-title">Documentos de viaje</h2></div></div>{documentEligibility?.status === "authorized" ? <div className={detailStyles.travelDocumentGrid}><article className={detailStyles.travelDocumentCard}><div className={detailStyles.travelDocumentHeader}><h3>Voucher</h3><span className={voucherAvailable ? detailStyles.summaryComplete : detailStyles.summaryPending}>{voucherAvailable ? "Disponible" : "Pendiente"}</span></div>{voucherReconciliationError ? <p className={detailStyles.unavailable}>No fue posible reconciliar el estado del Voucher. Intenta nuevamente.</p> : voucherAvailable ? <p className={detailStyles.documentState}>Voucher disponible</p> : documentEligibility.eligibility.voucher.eligible ? <><p className={detailStyles.documentState}>{voucherRevoked ? "Listo para reemitir" : "Listo para generar"}</p><VoucherControl agencySlug={access.agency.agencySlug} reservationId={reservation.id} revoked={voucherRevoked} nextVersion={voucherNextVersion}/></> : <div className={detailStyles.blockers}><strong>Pendiente para emitir</strong><ul>{documentEligibility.eligibility.voucher.blockers.map((blocker) => <li key={blocker}>{documentBlockerLabels[blocker]}</li>)}</ul></div>}</article><article className={detailStyles.travelDocumentCard}><div className={detailStyles.travelDocumentHeader}><h3>Boleto</h3><span className={documentEligibility.eligibility.ticket.eligible ? detailStyles.summaryComplete : detailStyles.summaryPending}>{documentEligibility.eligibility.ticket.eligible ? "Listo" : "Pendiente"}</span></div>{ticketReconciliationError ? <p className={detailStyles.unavailable}>No fue posible reconciliar el estado de los boletos. Intenta nuevamente.</p> : <><p className={detailStyles.ticketThreshold}>Pago confirmado: <strong>{documentEligibility.eligibility.ticket.confirmedPaymentPercent === null ? "No disponible" : `${documentEligibility.eligibility.ticket.confirmedPaymentPercent}%`}</strong><span>Requerido: {documentEligibility.eligibility.ticket.requiredPaymentPercent}%</span></p>{documentEligibility.eligibility.ticket.blockers.length > 0 ? <div className={detailStyles.blockers}><strong>Pendiente para emitir</strong><ul>{documentEligibility.eligibility.ticket.blockers.map((blocker) => <li key={blocker}>{documentBlockerLabels[blocker]}</li>)}</ul></div> : <div className={detailStyles.ticketTravelerList}>{ticketTravelers.map((traveler) => { const ticket = ticketsByTraveler.get(traveler.id); const fullName = traveler.firstName && traveler.lastName ? `${traveler.firstName} ${traveler.lastName}` : "Viajero sin datos completos"; const reissueVersion = ticket && ticket.status !== "available" ? ticket.version + 1 : null; return <article key={traveler.id}><div><strong>{fullName}</strong><span>{traveler.travelerType === "adult" ? "Adulto" : "Menor"}</span></div>{ticket?.status === "available" ? <p role="status">Boleto V{ticket.version} disponible</p> : <div><p>{reissueVersion ? "Versión anterior no vigente" : "Boleto no emitido"}</p><TicketControl agencySlug={access.agency.agencySlug} reservationId={reservation.id} travelerKey={traveler.id} reissueVersion={reissueVersion}/></div>}</article>; })}</div>}</>}</article></div> : <p className={detailStyles.unavailable}>No fue posible calcular la elegibilidad de documentos de viaje.</p>}</section>
          </main>
          <aside className={detailStyles.adminSummary} aria-label="Resumen de la reservación">
            <span className={detailStyles.sectionEyebrow}>Resumen</span>
            <div><span>Total contratado</span><strong>{financialSummary ? money(financialSummary.contract.total, financialSummary.currency) : "No disponible"}</strong></div>
            <div><span>Saldo pendiente</span><strong>{financialSummary ? money(financialSummary.balance.remaining, financialSummary.currency) : "No disponible"}</strong></div>
            <div><span>Viajeros</span><strong>{completedTravelers} / {reservation.occupancy.totalTravelers ?? reservation.travelers.length}</strong></div>
            <div><span>Contrato</span><strong>{contractSummary}</strong></div>
            <div><span>Voucher</span><strong>{voucherAvailable ? "Disponible" : "Pendiente"}</strong></div>
            <div><span>Boletos</span><strong>{availableTicketCount} / {ticketTravelers.length}</strong></div>
          </aside>
        </div>
      </section>
    </AdminShell>
  );
}
