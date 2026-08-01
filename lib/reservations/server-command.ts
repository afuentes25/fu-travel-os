import { agencies, travels } from "@/data/demo";
import type { PersistedAgency } from "@/lib/agencies";
import { createDeterministicDemoPaymentQuote, toMinorUnits } from "@/lib/fx";
import { confirmBoardingPoint, priceLine, validateCartRoomCapacity } from "@/lib/pricing";
import {
  finalizeReservation,
  ReservationSnapshotConflictError,
  type ReservationSnapshot,
  type ReservationSnapshotPersistenceInput,
} from "@/lib/reservations";
import type {
  Agency,
  CartLine,
  TravelerDataStatus,
  TravelerDraft,
  TravelProduct,
} from "@/types";

export type ReservationServerCommandInput = Readonly<{
  tenantSlug: string;
  idempotencyKey: string;
  tripId?: string;
  tripCode?: string;
  departureId: string;
  adults: number;
  minors: number;
  rooms: number;
  extraIds: readonly string[];
  boardingPointId: string;
  depositPercent: number;
  travelers: Readonly<{
    status: TravelerDataStatus;
    drafts: readonly TravelerDraft[];
  }>;
}>;

export type ReservationServerCommandDependencies = Readonly<{
  agencies: readonly Agency[];
  travels: readonly TravelProduct[];
  resolvePersistedAgency: (tenantSlug: string) => Promise<PersistedAgency | null>;
  findExisting: (input: Readonly<{
    agencyId: string;
    idempotencyKey: string;
  }>) => Promise<ReservationSnapshot | null>;
  persist: (
    input: ReservationSnapshotPersistenceInput,
  ) => Promise<{ reservation: ReservationSnapshot; created: boolean }>;
  now: () => string;
  suffix: () => string;
}>;

export class ReservationServerCommandError extends Error {
  readonly name = "ReservationServerCommandError";

  constructor(readonly kind: "invalid" | "not_found" = "invalid") {
    super("La solicitud de reservación no es válida.");
  }
}

const emptyReservationStorage = {
  getItem: () => null,
  setItem: () => undefined,
};

const adultOccupancy = (adults: number) => {
  if (adults === 1) return "single" as const;
  if (adults === 2) return "double" as const;
  if (adults === 3) return "triple" as const;
  if (adults === 4) return "quadruple" as const;
  return null;
};

function validateTravelerData(
  travelers: ReservationServerCommandInput["travelers"],
  adults: number,
  minors: number,
) {
  if (travelers.status === "pending") return;
  const expected = adults + minors;
  const validDrafts = travelers.drafts.filter(
    (draft) => draft.fullName.trim() && draft.completionStatus === "complete",
  );
  const completedAdults = validDrafts.filter(
    (draft) => draft.category === "adult",
  ).length;
  const completedMinors = validDrafts.filter(
    (draft) => draft.category === "minor",
  ).length;
  if (
    validDrafts.length !== expected ||
    completedAdults !== adults ||
    completedMinors !== minors
  ) {
    throw new ReservationServerCommandError();
  }
}

function makeLines({
  agency,
  trip,
  departureId,
  adults,
  minors,
  extraIds,
  travelerData,
}: {
  agency: Agency;
  trip: TravelProduct;
  departureId: string;
  adults: number;
  minors: number;
  extraIds: readonly string[];
  travelerData: ReservationServerCommandInput["travelers"];
}) {
  const occupancy =
    trip.accommodationMode === "hotel_occupancy"
      ? adultOccupancy(adults)
      : "general";
  if (!occupancy) throw new ReservationServerCommandError();

  const adultRate = trip.pricingOptions.find(
    (rate) => rate.occupancy === occupancy,
  );
  const minorRate = trip.pricingOptions.find(
    (rate) => rate.occupancy === "child",
  );
  if (!adultRate || (minors > 0 && !minorRate)) {
    throw new ReservationServerCommandError();
  }

  const shared = {
    agencyId: agency.id,
    travelId: trip.id,
    departureId,
    boardingOptionId: null,
    travelerDataStatus: travelerData.status,
  };
  const adultLine: CartLine = {
    ...shared,
    id: `server-${trip.id}-adults`,
    pricingOptionId: adultRate.id,
    travelers: adults,
    extraIds: [...extraIds],
    travelerDrafts: travelerData.drafts.filter(
      (draft) => draft.category === "adult",
    ),
  };
  const minorLine: CartLine | undefined =
    minors > 0 && minorRate
      ? {
          ...shared,
          id: `server-${trip.id}-minors`,
          pricingOptionId: minorRate.id,
          travelers: minors,
          extraIds: [],
          travelerDrafts: travelerData.drafts.filter(
            (draft) => draft.category === "minor",
          ),
        }
      : undefined;
  return [adultLine, minorLine].filter(Boolean) as CartLine[];
}

function reservationSuffix(reservation: ReservationSnapshot) {
  const suffix = reservation.reservationCode.split("-").at(-1);
  if (!suffix) throw new ReservationServerCommandError();
  return () => suffix;
}

export function createReservationServerCommand(
  dependencies: ReservationServerCommandDependencies,
) {
  return {
    async execute(input: ReservationServerCommandInput) {
      try {
        if (
          !input.tenantSlug.trim() ||
          !input.idempotencyKey.trim() ||
          (!input.tripId && !input.tripCode) ||
          !input.departureId.trim() ||
          !input.boardingPointId.trim() ||
          !Number.isInteger(input.adults) ||
          input.adults < 1 ||
          !Number.isInteger(input.minors) ||
          input.minors < 0 ||
          !Number.isInteger(input.rooms) ||
          input.rooms < 0 ||
          !Number.isInteger(input.depositPercent)
        ) {
          throw new ReservationServerCommandError();
        }

        const agency = dependencies.agencies.find(
          (candidate) => candidate.slug === input.tenantSlug,
        );
        if (!agency) throw new ReservationServerCommandError("not_found");
        const trip = dependencies.travels.find(
          (candidate) =>
            candidate.agencyId === agency.id &&
            (!input.tripId || candidate.id === input.tripId) &&
            (!input.tripCode || candidate.code === input.tripCode),
        );
        if (!trip || trip.status !== "published") {
          throw new ReservationServerCommandError("not_found");
        }
        if (trip.accommodationMode === "hotel_occupancy" && input.rooms !== 1) {
          throw new ReservationServerCommandError();
        }
        if (trip.accommodationMode === "none" && input.rooms !== 0) {
          throw new ReservationServerCommandError();
        }
        if (
          new Set(input.extraIds).size !== input.extraIds.length ||
          input.extraIds.some(
            (extraId) => !trip.extras.some((extra) => extra.id === extraId),
          )
        ) {
          throw new ReservationServerCommandError();
        }
        if (
          !(agency.settings.depositOptionsPercent ?? [100]).includes(
            input.depositPercent,
          )
        ) {
          throw new ReservationServerCommandError();
        }
        validateTravelerData(input.travelers, input.adults, input.minors);

        const departure = trip.departures.find(
          (candidate) => candidate.id === input.departureId,
        );
        const boardingOption = departure?.boardingOptions.find(
          (candidate) =>
            candidate.agencyDeparturePointId === input.boardingPointId &&
            !["sold_out", "disabled"].includes(candidate.status),
        );
        if (!departure || !boardingOption) {
          throw new ReservationServerCommandError("not_found");
        }
        if (departure.availableSpaces < input.adults + input.minors) {
          throw new ReservationServerCommandError();
        }

        let pricedLines: ReturnType<typeof priceLine>[];
        try {
          const lines = makeLines({
            agency,
            trip,
            departureId: departure.id,
            adults: input.adults,
            minors: input.minors,
            extraIds: input.extraIds,
            travelerData: input.travelers,
          }).map((line) => confirmBoardingPoint(line, boardingOption.id));
          validateCartRoomCapacity(lines);
          pricedLines = lines.map((line) => priceLine(line));
        } catch (error) {
          if (error instanceof ReservationServerCommandError) throw error;
          throw new ReservationServerCommandError();
        }
        const totalTravelers = input.adults + input.minors;
        const surcharge =
          (boardingOption.surchargeAmount ?? 0) *
          (boardingOption.surchargeType === "per_booking" ? 1 : totalTravelers);
        const total =
          pricedLines.reduce(
            (sum, line) => sum + line.subtotal + line.taxes + line.extrasTotal,
            0,
          ) + surcharge;
        const depositAmount =
          Math.round(total * input.depositPercent) / 100;
        const remainingAmount = Math.round((total - depositAmount) * 100) / 100;

        const persistedAgency = await dependencies.resolvePersistedAgency(
          agency.slug,
        );
        if (!persistedAgency || persistedAgency.slug !== agency.slug) {
          throw new ReservationServerCommandError("not_found");
        }
        const persistenceAgencyId = persistedAgency.id;
        const existing = await dependencies.findExisting({
          agencyId: persistenceAgencyId,
          idempotencyKey: input.idempotencyKey,
        });
        const createdAt = existing?.createdAt ?? dependencies.now();
        const fx = trip.foreignCurrencyPricing?.convertDepositAtCheckout
          ? await (() => {
              const policy = agency.settings.exchangeRatePolicy;
              if (!policy) throw new ReservationServerCommandError();
              return createDeterministicDemoPaymentQuote({
                policy,
                sourceCurrency: trip.basePrice.currency,
                chargeCurrency: trip.foreignCurrencyPricing.checkoutChargeCurrency,
                contractTotalMinor: toMinorUnits(total, trip.basePrice.currency),
                contractualPaymentMinor: toMinorUnits(
                  depositAmount,
                  trip.basePrice.currency,
                ),
                kind: input.depositPercent === 100 ? "full" : "deposit",
                quotedAt: createdAt,
              });
            })()
          : undefined;
        const snapshot = finalizeReservation({
          storage: emptyReservationStorage,
          input: {
            idempotencyKey: input.idempotencyKey,
            agency,
            theme: agency.theme,
            tour: { id: trip.id, code: trip.code, title: trip.title },
            departure: { id: departure.id, startDate: departure.startDate },
            boarding: pricedLines[0].boarding,
            travelers: {
              status: input.travelers.status,
              adults: input.adults,
              minors: input.minors,
              drafts: [...input.travelers.drafts],
            },
            currency: trip.basePrice.currency,
            ...(fx ? { fx } : {}),
            total,
            depositPercent: input.depositPercent,
            depositAmount,
            remainingAmount,
          },
          now: () => createdAt,
          suffix: existing ? reservationSuffix(existing) : dependencies.suffix,
        }).reservation;

        return await dependencies.persist({
          agencyId: persistenceAgencyId,
          idempotencyKey: input.idempotencyKey,
          snapshot,
        });
      } catch (error) {
        if (
          error instanceof ReservationServerCommandError ||
          error instanceof ReservationSnapshotConflictError
        ) {
          throw error;
        }
        throw error;
      }
    },
  };
}

/**
 * Production entrypoint. It dynamically loads the server-only Supabase
 * adapter so unit tests can use the injected command without a remote client.
 */
export async function executeReservationServerCommand(
  input: ReservationServerCommandInput,
) {
  const [reservationRepository, agencyRepository] = await Promise.all([
    import("@/lib/reservations/supabase-repository"),
    import("@/lib/agencies/supabase-repository"),
  ]);
  return createReservationServerCommand({
    agencies,
    travels,
    resolvePersistedAgency: agencyRepository.findPersistedAgencyBySlug,
    findExisting: reservationRepository.findReservationSnapshotByIdempotency,
    persist: reservationRepository.insertReservationSnapshot,
    now: () => new Date().toISOString(),
    suffix: () => {
      const uuid = globalThis.crypto?.randomUUID?.();
      return (uuid ?? `${Date.now()}-${Math.random()}`)
        .replace(/[^a-z0-9]/gi, "")
        .slice(-6)
        .toUpperCase()
        .padStart(6, "0");
    },
  }).execute(input);
}
