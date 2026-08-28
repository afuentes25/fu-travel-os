import "server-only";

import {
  createReservationTravelerMaterializer,
  type MaterializeReservationTravelersInput,
} from "./traveler-materialization-core";
import { createSupabaseReservationTravelerMaterializationRepository } from "./traveler-materialization-repository";

export {
  createReservationTravelerMaterializer,
  projectReservationTravelerMaterialization,
  ReservationTravelerMaterializationError,
  splitHistoricalTravelerName,
  type MaterializeReservationTravelersInput,
  type ReservationTravelerMaterializationRow,
} from "./traveler-materialization-core";

export async function materializeReservationTravelers(
  input: MaterializeReservationTravelersInput,
) {
  return createReservationTravelerMaterializer({
    repository: () => createSupabaseReservationTravelerMaterializationRepository(),
  }).materialize(input);
}
