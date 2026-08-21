import "server-only";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";

import {
  createCustomerPaymentHistoryService,
  type CustomerPaymentHistoryResult,
} from "./customer-payment-list-core";
import { createSupabaseCustomerPaymentHistoryRepository } from "./customer-payment-list-repository";

export {
  createCustomerPaymentHistoryService,
  CustomerPaymentHistoryError,
  type CustomerPaymentHistoryItem,
  type CustomerPaymentHistoryResult,
} from "./customer-payment-list-core";

export async function listCustomerReservationPayments(input: Readonly<{
  requestedAgencySlug?: string;
  reservationId: string;
}>): Promise<CustomerPaymentHistoryResult> {
  return createCustomerPaymentHistoryService({
    resolveAccess: resolveCustomerAgencyAccess,
    repository: () => createSupabaseCustomerPaymentHistoryRepository(),
  }).list(input);
}
