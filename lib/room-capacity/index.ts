import type { Agency, RoomCapacityPolicy, TravelPricingOption, TravelProduct } from "@/types";

export const DEFAULT_ROOM_CAPACITY_POLICY: RoomCapacityPolicy = {
  enabled: true,
  defaultMaxGuestsPerRoom: 4,
  allowMultipleRooms: false,
  adultCountsTowardCapacity: true,
  minorCountsTowardCapacity: true,
  infantCountsTowardCapacity: false,
};

export function getRoomCapacity({
  agencyMax,
  tripMax,
  rateMax,
}: {
  agencyMax?: number;
  tripMax?: number;
  rateMax?: number;
}) {
  return [rateMax, tripMax, agencyMax, DEFAULT_ROOM_CAPACITY_POLICY.defaultMaxGuestsPerRoom]
    .find((value) => Number.isInteger(value) && (value ?? 0) > 0)!;
}

export function resolveRoomCapacityPolicy(
  agency: Agency,
  trip: TravelProduct,
  rate?: TravelPricingOption,
): RoomCapacityPolicy {
  const agencyPolicy = agency.settings.roomCapacityPolicy;
  const tripPolicy = trip.roomCapacityPolicy;
  return {
    ...DEFAULT_ROOM_CAPACITY_POLICY,
    ...agencyPolicy,
    ...tripPolicy,
    defaultMaxGuestsPerRoom: getRoomCapacity({
      agencyMax: agencyPolicy?.defaultMaxGuestsPerRoom,
      tripMax: tripPolicy?.defaultMaxGuestsPerRoom,
      rateMax: rate?.maxGuestsPerRoom,
    }),
  };
}

export function validateRoomCapacity({
  adults,
  minors,
  infants = 0,
  maxGuestsPerRoom,
  adultCountsTowardCapacity = true,
  minorCountsTowardCapacity = true,
  infantCountsTowardCapacity = false,
}: {
  adults: number;
  minors: number;
  infants?: number;
  maxGuestsPerRoom: number;
  adultCountsTowardCapacity?: boolean;
  minorCountsTowardCapacity?: boolean;
  infantCountsTowardCapacity?: boolean;
}) {
  const totalCountedGuests =
    (adultCountsTowardCapacity ? adults : 0) +
    (minorCountsTowardCapacity ? minors : 0) +
    (infantCountsTowardCapacity ? infants : 0);
  return {
    valid: totalCountedGuests <= maxGuestsPerRoom,
    totalCountedGuests,
    excessGuests: Math.max(0, totalCountedGuests - maxGuestsPerRoom),
  };
}
