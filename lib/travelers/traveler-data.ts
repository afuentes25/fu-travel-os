import "server-only";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";

import {
  createReservationTravelerDataService,
  type GetReservationTravelerDataInput,
  type GetReservationTravelerDataResult,
  type SaveReservationTravelerDataInput,
  type SaveReservationTravelerDataResult,
} from "./traveler-data-core";
import { createSupabaseTravelerDataRepository } from "./traveler-data-repository";
import { revokeChangedTravelerTickets } from "@/lib/travel-documents/ticket-lifecycle";

export {
  createReservationTravelerDataService,
  TravelerDataError,
  validateReservationTravelerData,
  type GetReservationTravelerDataResult,
  type ReservationTravelerData,
  type SaveReservationTravelerDataResult,
  type TravelerDataValidationErrors,
} from "./traveler-data-core";

function travelerDataService() {
  return createReservationTravelerDataService({
    resolveAccess: resolveCustomerAgencyAccess,
    repository: () => createSupabaseTravelerDataRepository(),
    afterNameChanged: revokeChangedTravelerTickets,
  });
}

export async function getReservationTravelerData(
  input: GetReservationTravelerDataInput,
): Promise<GetReservationTravelerDataResult> {
  return travelerDataService().get(input);
}

export async function saveReservationTravelerData(
  input: SaveReservationTravelerDataInput,
): Promise<SaveReservationTravelerDataResult> {
  return travelerDataService().save(input);
}
