import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import { toMinorUnits } from "@/lib/fx";
import { calculateReservationFinancialSummary, type ReservationPaymentFinancialRow } from "@/lib/payments/reservation-financial-core";
import { isAdminReservationUuid } from "@/lib/reservations/admin-detail";
import { projectReservationSnapshotOperational, type ReservationSnapshotProjectionSource } from "@/lib/reservations/snapshot-projection";
import { deriveTravelerSlotStructure, type ReservationTravelerSlotRow } from "@/lib/travelers/traveler-slots-core";

export const DEFAULT_TICKET_PAYMENT_THRESHOLD_BPS = 7500;
export type VoucherEligibilityBlocker = "contract_not_accepted" | "deposit_not_covered" | "travelers_incomplete" | "departure_missing" | "invalid_structure";
export type TicketEligibilityBlocker = VoucherEligibilityBlocker | "boarding_point_missing" | "payment_threshold_not_met";
export type ReservationDocumentEligibility = Readonly<{
  voucher: Readonly<{ eligible: boolean; blockers: readonly VoucherEligibilityBlocker[] }>;
  ticket: Readonly<{ eligible: boolean; blockers: readonly TicketEligibilityBlocker[]; confirmedPaymentPercent: number | null; requiredPaymentPercent: number }>;
}>;
export type GetReservationDocumentEligibilityResult =
  | Readonly<{ status: "authorized"; eligibility: ReservationDocumentEligibility }>
  | Readonly<{ status: "unauthenticated" | "selection_required" | "forbidden" | "not_found" | "invalid_structure" }>;

export interface DocumentEligibilityRepository {
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<ReservationSnapshotProjectionSource | null>;
  findPayments(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<readonly ReservationPaymentFinancialRow[]>;
  findTravelerSlots(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<readonly ReservationTravelerSlotRow[]>;
  hasAcceptedContract(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<boolean>;
}

export class DocumentEligibilityError extends Error { readonly name = "DocumentEligibilityError"; constructor() { super("No fue posible calcular la elegibilidad documental."); } }

function denied(access: AdminAgencyAccess): Exclude<GetReservationDocumentEligibilityResult, Readonly<{ status: "authorized"; eligibility: ReservationDocumentEligibility }> | Readonly<{ status: "not_found" }> | Readonly<{ status: "invalid_structure" }>> | null {
  if (access.status === "unauthenticated") return { status: "unauthenticated" };
  if (access.status === "selection_required") return { status: "selection_required" };
  if (access.status === "forbidden") return { status: "forbidden" };
  return null;
}

function slotsComplete(snapshot: ReservationSnapshotProjectionSource, rows: readonly ReservationTravelerSlotRow[]) {
  const expected = deriveTravelerSlotStructure(snapshot);
  if (!expected || rows.length !== expected.length) return null;
  const byPosition = new Map<number, ReservationTravelerSlotRow>();
  for (const row of rows) { if (byPosition.has(row.position)) return null; byPosition.set(row.position, row); }
  return expected.every((slot) => {
    const row = byPosition.get(slot.position);
    return row?.traveler_type === slot.travelerType && row.status === "complete";
  });
}

/** Pure policy evaluator. Financial totals are delegated to the existing cent-based ledger engine. */
export function calculateReservationDocumentEligibility(input: Readonly<{
  snapshot: ReservationSnapshotProjectionSource;
  payments: readonly ReservationPaymentFinancialRow[];
  slots: readonly ReservationTravelerSlotRow[];
  contractAccepted: boolean;
  ticketPaymentThresholdBps?: number;
}>): ReservationDocumentEligibility | null {
  const financial = calculateReservationFinancialSummary({ snapshot: input.snapshot, payments: input.payments });
  const projected = projectReservationSnapshotOperational(input.snapshot);
  const complete = slotsComplete(input.snapshot, input.slots);
  const threshold = input.ticketPaymentThresholdBps ?? DEFAULT_TICKET_PAYMENT_THRESHOLD_BPS;
  const invalid = (): ReservationDocumentEligibility => ({ voucher: { eligible: false, blockers: ["invalid_structure"] }, ticket: { eligible: false, blockers: ["invalid_structure"], confirmedPaymentPercent: null, requiredPaymentPercent: (Number.isInteger(threshold) && threshold >= 0 && threshold <= 10000 ? threshold : DEFAULT_TICKET_PAYMENT_THRESHOLD_BPS) / 100 } });
  if (!financial || complete === null || !Number.isInteger(threshold) || threshold < 0 || threshold > 10000 || financial.contract.depositRequired === null) return invalid();
  const totalCents = toMinorUnits(financial.contract.total, financial.currency);
  const confirmedCents = toMinorUnits(financial.payments.confirmedTotal, financial.currency);
  const depositCents = toMinorUnits(financial.contract.depositRequired, financial.currency);
  if (totalCents <= 0 || confirmedCents < 0 || depositCents < 0) return invalid();
  const bps = Math.floor((confirmedCents * 10000) / totalCents);
  const voucherBlockers: VoucherEligibilityBlocker[] = [];
  if (!input.contractAccepted) voucherBlockers.push("contract_not_accepted");
  if (confirmedCents < depositCents) voucherBlockers.push("deposit_not_covered");
  if (!complete) voucherBlockers.push("travelers_incomplete");
  if (!projected.trip.departureDate) voucherBlockers.push("departure_missing");
  const ticketBlockers: TicketEligibilityBlocker[] = [...voucherBlockers];
  if (!projected.trip.boardingPointName) ticketBlockers.push("boarding_point_missing");
  if (bps < threshold) ticketBlockers.push("payment_threshold_not_met");
  return {
    voucher: { eligible: voucherBlockers.length === 0, blockers: voucherBlockers },
    ticket: { eligible: ticketBlockers.length === 0, blockers: ticketBlockers, confirmedPaymentPercent: Math.min(100, Math.floor(bps) / 100), requiredPaymentPercent: threshold / 100 },
  };
}

/** Admin-only, read-only orchestration. Authorization completes before any reservation-derived query. */
export function createReservationDocumentEligibilityService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: DocumentEligibilityRepository | (() => DocumentEligibilityRepository);
  ticketPaymentThresholdBps?: number;
}>) {
  return { async get(input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>): Promise<GetReservationDocumentEligibilityResult> {
    if (!isAdminReservationUuid(input.reservationId)) return { status: "not_found" };
    let access: AdminAgencyAccess;
    try { access = await dependencies.resolveAccess({ requestedAgencySlug: input.requestedAgencySlug }); } catch { throw new DocumentEligibilityError(); }
    const blocked = denied(access); if (blocked) return blocked;
    if (access.status !== "authorized") return { status: "forbidden" };
    try {
      const repository = typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
      const scope = { agencyId: access.agency.agencyId, reservationId: input.reservationId };
      const reservation = await repository.findReservation(scope);
      if (!reservation) return { status: "not_found" };
      const [payments, slots, contractAccepted] = await Promise.all([repository.findPayments(scope), repository.findTravelerSlots(scope), repository.hasAcceptedContract(scope)]);
      const eligibility = calculateReservationDocumentEligibility({ snapshot: reservation, payments, slots, contractAccepted, ticketPaymentThresholdBps: dependencies.ticketPaymentThresholdBps });
      return eligibility ? { status: "authorized", eligibility } : { status: "invalid_structure" };
    } catch { throw new DocumentEligibilityError(); }
  } };
}
