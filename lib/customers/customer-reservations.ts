import "server-only";

import { resolveCustomerAgencyAccess } from "./customer-access";
import {
  createCustomerReservationLister,
  type CustomerReservationListInput,
  type CustomerReservationListResult,
} from "./customer-reservations-core";
import { createSupabaseCustomerReservationRepository } from "./customer-reservations-repository";

export {
  CustomerReservationListError,
  CUSTOMER_RESERVATION_STATUSES,
  normalizeCustomerReservationLimit,
  normalizeCustomerReservationOffset,
  normalizeCustomerReservationStatus,
  type CustomerReservationListResult,
  type CustomerReservationSummary,
} from "./customer-reservations-core";

/** Lists only snapshots explicitly linked to the resolved active customer account. */
export async function listCustomerReservations(
  input: CustomerReservationListInput = {},
): Promise<CustomerReservationListResult> {
  return createCustomerReservationLister({
    resolveAccess: resolveCustomerAgencyAccess,
    reservationRepository: () => createSupabaseCustomerReservationRepository(),
  }).list(input);
}
