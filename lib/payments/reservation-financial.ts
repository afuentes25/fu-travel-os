import "server-only";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";

import {
  createReservationFinancialSummaryService,
  type GetReservationFinancialSummaryInput,
  type GetReservationFinancialSummaryResult,
} from "./reservation-financial-core";
import { createSupabaseReservationFinancialRepository } from "./reservation-financial-repository";

export {
  calculateReservationFinancialSummary,
  createReservationFinancialSummaryService,
  ReservationFinancialError,
  type ReservationFinancialSummary,
  type GetReservationFinancialSummaryResult,
} from "./reservation-financial-core";

export async function getReservationFinancialSummary(
  input: GetReservationFinancialSummaryInput,
): Promise<GetReservationFinancialSummaryResult> {
  return createReservationFinancialSummaryService({
    resolveAccess: resolveCustomerAgencyAccess,
    repository: () => createSupabaseReservationFinancialRepository(),
  }).get(input);
}
