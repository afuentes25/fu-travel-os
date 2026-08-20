import "server-only";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";

import {
  createReservationTravelerSlotEnsurer,
  type EnsureTravelerSlotsInput,
  type EnsureTravelerSlotsResult,
} from "./traveler-slots-core";
import { createSupabaseTravelerSlotsRepository } from "./traveler-slots-repository";

export {
  buildTravelerSlotStructure,
  createReservationTravelerSlotEnsurer,
  deriveTravelerSlotStructure,
  TravelerSlotsError,
  type EnsureTravelerSlotsInput,
  type EnsureTravelerSlotsResult,
  type ReservationTravelerSlotRow,
  type TravelerSlot,
  type TravelerSlotStructure,
} from "./traveler-slots-core";

export async function ensureReservationTravelerSlots(
  input: EnsureTravelerSlotsInput,
): Promise<EnsureTravelerSlotsResult> {
  return createReservationTravelerSlotEnsurer({
    resolveAccess: resolveCustomerAgencyAccess,
    repository: () => createSupabaseTravelerSlotsRepository(),
  }).ensure(input);
}
