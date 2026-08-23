import { isCustomerReservationUuid } from "@/lib/customers/customer-reservation-detail-core";
import type { CustomerAgencyAccess } from "@/lib/customers/customer-access-core";
import type { Currency } from "@/types";

export type CustomerDocumentType = "payment_receipt" | "contract" | "acceptance_certificate" | "voucher" | "ticket";
export type CustomerDocumentItem = Readonly<{
  documentKey: string;
  documentType: CustomerDocumentType;
  version: number;
  generatedAt: string;
  paymentContext?: Readonly<{ amount: number; currency: Currency; paidAt: string }> | null;
  acceptanceContext?: Readonly<{ acceptedAt: string }> | null;
}>;
export type CustomerDocumentListResult =
  | Readonly<{ status: "authorized"; documents: readonly CustomerDocumentItem[] }>
  | Readonly<{ status: "unauthenticated" } | { status: "selection_required" } | { status: "forbidden" } | { status: "not_found" }>;
export type CustomerDocumentRow = Readonly<{ id: string; documentType: string; version: number; generatedAt: string; paymentId: string | null; contractAcceptanceId?: string | null }>;
export type CustomerDocumentPaymentRow = Readonly<{ id: string; amount: number; currency: string; paidAt: string | null }>;
export interface CustomerDocumentListRepositoryClient {
  findLinkedReservation(input: Readonly<{ customerAccountId: string; agencyId: string; reservationId: string }>): Promise<boolean>;
  listAvailableDocuments(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<readonly CustomerDocumentRow[]>;
  findPaymentContexts(input: Readonly<{ agencyId: string; reservationId: string; paymentIds: readonly string[] }>): Promise<ReadonlyMap<string, CustomerDocumentPaymentRow>>;
  findAcceptanceContexts?(input: Readonly<{ agencyId: string; reservationId: string; acceptanceIds: readonly string[] }>): Promise<ReadonlyMap<string, Readonly<{ acceptedAt: string }>>>;
}
export class CustomerDocumentListError extends Error { readonly name = "CustomerDocumentListError"; constructor() { super("No fue posible consultar los documentos."); } }
const types: readonly CustomerDocumentType[] = ["payment_receipt", "contract", "acceptance_certificate", "voucher", "ticket"];
const order: Record<CustomerDocumentType, number> = { acceptance_certificate: 0, ticket: 1, voucher: 2, contract: 3, payment_receipt: 4 };
function isType(value: string): value is CustomerDocumentType { return (types as readonly string[]).includes(value); }
function isCurrency(value: string): value is Currency { return value === "MXN" || value === "USD"; }

/** Lists only currently available documents after the customer-reservation link is verified. */
export function createCustomerDocumentListService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<CustomerAgencyAccess>;
  repository: CustomerDocumentListRepositoryClient | (() => CustomerDocumentListRepositoryClient);
}>) {
  return { async list(input: Readonly<{ requestedAgencySlug?: string; reservationId: string }>): Promise<CustomerDocumentListResult> {
    if (!isCustomerReservationUuid(input.reservationId)) return { status: "not_found" };
    let access: CustomerAgencyAccess;
    try { access = await dependencies.resolveAccess({ requestedAgencySlug: input.requestedAgencySlug }); } catch { throw new CustomerDocumentListError(); }
    if (access.status !== "authorized") return access;
    const repository = typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
    try {
      const scope = { customerAccountId: access.account.customerAccountId, agencyId: access.account.agencyId, reservationId: input.reservationId };
      if (!await repository.findLinkedReservation(scope)) return { status: "not_found" };
      const rows = await repository.listAvailableDocuments({ agencyId: scope.agencyId, reservationId: scope.reservationId });
      const paymentIds = rows.flatMap((row) => row.documentType === "payment_receipt" && row.paymentId ? [row.paymentId] : []);
      const payments = paymentIds.length ? await repository.findPaymentContexts({ agencyId: scope.agencyId, reservationId: scope.reservationId, paymentIds }) : new Map<string, CustomerDocumentPaymentRow>();
      const acceptanceIds = rows.flatMap((row) => row.documentType === "acceptance_certificate" && row.contractAcceptanceId ? [row.contractAcceptanceId] : []);
      const acceptances = acceptanceIds.length && repository.findAcceptanceContexts ? await repository.findAcceptanceContexts({ agencyId: scope.agencyId, reservationId: scope.reservationId, acceptanceIds }) : new Map<string, Readonly<{ acceptedAt: string }>>();
      const documents = rows.flatMap((row): CustomerDocumentItem[] => {
        if (!isType(row.documentType) || !Number.isInteger(row.version) || row.version <= 0 || !row.id || !row.generatedAt) return [];
        if (row.documentType === "acceptance_certificate") {
          const acceptance = row.contractAcceptanceId ? acceptances.get(row.contractAcceptanceId) : null;
          return acceptance ? [{ documentKey: row.id, documentType: row.documentType, version: row.version, generatedAt: row.generatedAt, paymentContext: null, acceptanceContext: acceptance }] : [];
        }
        if (row.documentType !== "payment_receipt") return [{ documentKey: row.id, documentType: row.documentType, version: row.version, generatedAt: row.generatedAt, paymentContext: null, acceptanceContext: null }];
        const payment = row.paymentId ? payments.get(row.paymentId) : null;
        return payment && Number.isFinite(payment.amount) && isCurrency(payment.currency) && payment.paidAt
          ? [{ documentKey: row.id, documentType: row.documentType, version: row.version, generatedAt: row.generatedAt, paymentContext: { amount: payment.amount, currency: payment.currency, paidAt: payment.paidAt }, acceptanceContext: null }]
          : [];
      }).sort((a, b) => order[a.documentType] - order[b.documentType] || new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
      return { status: "authorized", documents };
    } catch { throw new CustomerDocumentListError(); }
  } };
}
