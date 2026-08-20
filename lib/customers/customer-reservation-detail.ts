import "server-only";

import { resolveCustomerAgencyAccess } from "./customer-access";
import {
  createCustomerReservationDetail,
  type CustomerReservationDetailInput,
  type CustomerReservationDetailResult,
} from "./customer-reservation-detail-core";
import { createSupabaseCustomerReservationDetailRepository } from "./customer-reservation-detail-repository";

export {
  CustomerReservationDetailError,
  isCustomerReservationUuid,
  projectCustomerReservationDetail,
  type CustomerReservationDetail,
  type CustomerReservationDetailResult,
} from "./customer-reservation-detail-core";

export async function getCustomerReservationDetail(
  input: CustomerReservationDetailInput,
): Promise<CustomerReservationDetailResult> {
  return createCustomerReservationDetail({
    resolveAccess: resolveCustomerAgencyAccess,
    repository: () => createSupabaseCustomerReservationDetailRepository(),
  }).get(input);
}
