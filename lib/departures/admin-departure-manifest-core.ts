import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import {
  asSnapshotRecord,
  optionalSnapshotText,
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";

export type DepartureIdentity = Readonly<{ tourId: string; departureId: string }>;
export type ManifestFilter = "all" | "pending" | "checked_in" | "boarded" | "without_ticket";

export type DepartureManifestTraveler = Readonly<{
  reservationCode: string;
  position: number;
  name: string;
  travelerType: "adult" | "minor";
  boardingPoint: string | null;
  ticketStatus: "available" | "unavailable";
  credentialStatus: "active" | "unavailable";
  boardingStatus: "pending" | "checked_in" | "boarded";
  checkedInAt: string | null;
  boardedAt: string | null;
}>;

export type DepartureManifest = Readonly<{
  departure: Readonly<{
    key: string;
    tourName: string | null;
    tourCode: string | null;
    departureDate: string | null;
    departureTime: string | null;
  }>;
  summary: Readonly<{
    reservations: number;
    travelers: number;
    pending: number;
    checkInCompleted: number;
    boarded: number;
  }>;
  travelers: readonly DepartureManifestTraveler[];
}>;

export type DepartureListItem = Readonly<{
  key: string;
  tourName: string | null;
  tourCode: string | null;
  departureDate: string | null;
  departureTime: string | null;
  summary: DepartureManifest["summary"];
}>;

export type DepartureTravelerRow = Readonly<{
  id: string;
  reservationId: string;
  position: number;
  travelerType: string;
  firstName: string | null;
  lastName: string | null;
}>;
export type DepartureTicketRow = Readonly<{
  id: string;
  reservationId: string;
  travelerId: string;
  status: string;
}>;
export type DepartureCredentialRow = Readonly<{
  reservationId: string;
  travelerId: string;
  ticketDocumentId: string;
  status: string;
}>;
export type DepartureBoardingStateRow = Readonly<{
  reservationId: string;
  travelerId: string;
  status: string;
  checkedInAt: string | null;
  boardedAt: string | null;
}>;

export interface AdminDepartureManifestRepository {
  listRecentSnapshots(input: Readonly<{ agencyId: string; since: string }>): Promise<readonly ReservationSnapshotProjectionSource[]>;
  listDepartureSnapshots(input: Readonly<{ agencyId: string; identity: DepartureIdentity }>): Promise<readonly ReservationSnapshotProjectionSource[]>;
  listTravelers(input: Readonly<{ agencyId: string; reservationIds: readonly string[] }>): Promise<readonly DepartureTravelerRow[]>;
  listTickets(input: Readonly<{ agencyId: string; reservationIds: readonly string[] }>): Promise<readonly DepartureTicketRow[]>;
  listCredentials(input: Readonly<{ agencyId: string; reservationIds: readonly string[] }>): Promise<readonly DepartureCredentialRow[]>;
  listBoardingStates(input: Readonly<{ agencyId: string; reservationIds: readonly string[] }>): Promise<readonly DepartureBoardingStateRow[]>;
}

function authorized(access: AdminAgencyAccess): access is Extract<AdminAgencyAccess, Readonly<{ status: "authorized" }>> {
  return access.status === "authorized";
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-MX");
}

function validTravelerType(value: string): value is "adult" | "minor" {
  return value === "adult" || value === "minor";
}

function validBoardingState(value: string): value is "pending" | "checked_in" | "boarded" {
  return value === "pending" || value === "checked_in" || value === "boarded";
}

/**
 * The pair is frozen with the reservation: a departure id is only meaningful
 * within its Tour, so both values form the canonical operational identity.
 */
export function departureIdentityFromSnapshot(row: ReservationSnapshotProjectionSource): DepartureIdentity | null {
  const snapshot = asSnapshotRecord(row.snapshot);
  const tour = asSnapshotRecord(snapshot?.tour);
  const departure = asSnapshotRecord(snapshot?.departure);
  const tourId = optionalSnapshotText(tour?.id);
  const departureId = optionalSnapshotText(departure?.id);
  return tourId && departureId ? { tourId, departureId } : null;
}

/**
 * Navigation receives an opaque fingerprint, never the IDs frozen in the
 * snapshot. It conveys no authority; every lookup remains agency-scoped.
 */
export function departureKeyForIdentity(identity: DepartureIdentity): string {
  return createHash("sha256").update(`${identity.tourId}\u0000${identity.departureId}`, "utf8").digest("hex");
}

function isDepartureKey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function departureDateValue(value: string | null) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function stateFor(
  traveler: DepartureTravelerRow,
  states: ReadonlyMap<string, DepartureBoardingStateRow>,
): DepartureManifestTraveler["boardingStatus"] {
  const state = states.get(traveler.id);
  return state && validBoardingState(state.status) ? state.status : "pending";
}

function manifestFromRows(
  identity: DepartureIdentity,
  snapshots: readonly ReservationSnapshotProjectionSource[],
  travelers: readonly DepartureTravelerRow[],
  tickets: readonly DepartureTicketRow[],
  credentials: readonly DepartureCredentialRow[],
  states: readonly DepartureBoardingStateRow[],
): DepartureManifest | null {
  const reservations = snapshots.filter((row) => {
    const current = departureIdentityFromSnapshot(row);
    return current?.tourId === identity.tourId && current.departureId === identity.departureId;
  });
  if (!reservations.length) return null;

  const reservationIds = new Set(reservations.map((row) => row.id));
  const projectedByReservation = new Map(reservations.map((row) => [row.id, projectReservationSnapshotOperational(row)]));
  const availableTicketByTraveler = new Map<string, DepartureTicketRow>();
  for (const ticket of tickets) {
    if (reservationIds.has(ticket.reservationId) && ticket.status === "available") availableTicketByTraveler.set(ticket.travelerId, ticket);
  }
  const activeCredentialTicketIds = new Set(
    credentials
      .filter((credential) => reservationIds.has(credential.reservationId) && credential.status === "active")
      .map((credential) => credential.ticketDocumentId),
  );
  const statesByTraveler = new Map(
    states
      .filter((state) => reservationIds.has(state.reservationId))
      .map((state) => [state.travelerId, state]),
  );

  const output: DepartureManifestTraveler[] = [];
  for (const traveler of travelers) {
    const reservation = projectedByReservation.get(traveler.reservationId);
    if (!reservation || !validTravelerType(traveler.travelerType) || !Number.isInteger(traveler.position) || traveler.position <= 0) continue;
    const ticket = availableTicketByTraveler.get(traveler.id);
    const state = statesByTraveler.get(traveler.id);
    const name = [traveler.firstName, traveler.lastName].filter((part): part is string => Boolean(part?.trim())).join(" ") || `Viajero ${traveler.position}`;
    output.push({
      reservationCode: reservation.reservationCode,
      position: traveler.position,
      name,
      travelerType: traveler.travelerType,
      boardingPoint: reservation.trip.boardingPointName,
      ticketStatus: ticket ? "available" : "unavailable",
      credentialStatus: ticket && activeCredentialTicketIds.has(ticket.id) ? "active" : "unavailable",
      boardingStatus: stateFor(traveler, statesByTraveler),
      checkedInAt: state?.checkedInAt ?? null,
      boardedAt: state?.boardedAt ?? null,
    });
  }
  output.sort((left, right) =>
    (left.boardingPoint ?? "").localeCompare(right.boardingPoint ?? "", "es-MX")
    || left.reservationCode.localeCompare(right.reservationCode, "es-MX")
    || left.position - right.position,
  );
  const primary = projectReservationSnapshotOperational(reservations[0]);
  const primarySnapshot = asSnapshotRecord(reservations[0].snapshot);
  const primaryBoarding = asSnapshotRecord(primarySnapshot?.boarding);
  const boarded = output.filter((traveler) => traveler.boardingStatus === "boarded").length;
  const checkedIn = output.filter((traveler) => traveler.boardingStatus === "checked_in").length;
  return {
    departure: {
      key: departureKeyForIdentity(identity),
      tourName: primary.trip.name,
      tourCode: primary.trip.code,
      departureDate: primary.trip.departureDate,
      departureTime: optionalSnapshotText(primaryBoarding?.departureTime),
    },
    summary: {
      reservations: reservations.length,
      travelers: output.length,
      pending: output.length - checkedIn - boarded,
      checkInCompleted: checkedIn + boarded,
      boarded,
    },
    travelers: output,
  };
}

function filterTravelers(
  travelers: readonly DepartureManifestTraveler[],
  filter: ManifestFilter,
  search: string | undefined,
) {
  const needle = search?.trim() ? normalizedText(search.trim()) : null;
  return travelers.filter((traveler) => {
    const matchesFilter = filter === "all" || filter === "without_ticket"
      ? filter !== "without_ticket" || traveler.ticketStatus === "unavailable"
      : traveler.boardingStatus === filter;
    return matchesFilter && (!needle || normalizedText(`${traveler.name} ${traveler.reservationCode}`).includes(needle));
  });
}

function parseFilter(value: unknown): ManifestFilter {
  return value === "pending" || value === "checked_in" || value === "boarded" || value === "without_ticket" ? value : "all";
}

function sinceDate(now: Date) {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() - 2);
  return value.toISOString();
}

export function createAdminDepartureManifestService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: AdminDepartureManifestRepository | (() => AdminDepartureManifestRepository);
  now?: () => Date;
}>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  const now = dependencies.now ?? (() => new Date());
  async function accessFor(slug: unknown) {
    return dependencies.resolveAccess({ requestedAgencySlug: typeof slug === "string" ? slug : undefined });
  }
  return {
    async list(input: Readonly<{ requestedAgencySlug?: unknown }>): Promise<
      | Readonly<{ status: "authorized"; departures: readonly DepartureListItem[] }>
      | Exclude<AdminAgencyAccess, Readonly<{ status: "authorized" }>>
      | Readonly<{ status: "invalid_structure" }>
    > {
      const access = await accessFor(input.requestedAgencySlug);
      if (!authorized(access)) return access;
      try {
        const data = repository();
        const snapshots = await data.listRecentSnapshots({ agencyId: access.agency.agencyId, since: sinceDate(now()) });
        const byIdentity = new Map<string, { identity: DepartureIdentity; snapshots: ReservationSnapshotProjectionSource[] }>();
        for (const snapshot of snapshots) {
          const identity = departureIdentityFromSnapshot(snapshot);
          if (!identity) continue;
          const key = departureKeyForIdentity(identity);
          const group = byIdentity.get(key) ?? { identity, snapshots: [] };
          group.snapshots.push(snapshot);
          byIdentity.set(key, group);
        }
        const allReservationIds = snapshots.map((row) => row.id);
        if (!allReservationIds.length) return { status: "authorized", departures: [] };
        const [travelers, tickets, credentials, states] = await Promise.all([
          data.listTravelers({ agencyId: access.agency.agencyId, reservationIds: allReservationIds }),
          data.listTickets({ agencyId: access.agency.agencyId, reservationIds: allReservationIds }),
          data.listCredentials({ agencyId: access.agency.agencyId, reservationIds: allReservationIds }),
          data.listBoardingStates({ agencyId: access.agency.agencyId, reservationIds: allReservationIds }),
        ]);
        const departures = [...byIdentity.values()]
          .map((group) => manifestFromRows(group.identity, group.snapshots, travelers, tickets, credentials, states))
          .filter((item): item is DepartureManifest => item !== null)
          .sort((left, right) => departureDateValue(left.departure.departureDate) - departureDateValue(right.departure.departureDate))
          .map(({ departure, summary }) => ({ key: departure.key, tourName: departure.tourName, tourCode: departure.tourCode, departureDate: departure.departureDate, departureTime: departure.departureTime, summary }));
        return { status: "authorized", departures };
      } catch {
        return { status: "invalid_structure" };
      }
    },
    async get(input: Readonly<{ requestedAgencySlug?: unknown; departureKey: unknown; filter?: unknown; search?: unknown }>): Promise<
      | Readonly<{ status: "authorized"; manifest: DepartureManifest; visibleTravelers: readonly DepartureManifestTraveler[]; filter: ManifestFilter; search: string }>
      | Exclude<AdminAgencyAccess, Readonly<{ status: "authorized" }>>
      | Readonly<{ status: "not_found" | "invalid_structure" }>
    > {
      const access = await accessFor(input.requestedAgencySlug);
      if (!authorized(access)) return access;
      if (!isDepartureKey(input.departureKey)) return { status: "not_found" };
      try {
        const data = repository();
        const candidates = await data.listRecentSnapshots({ agencyId: access.agency.agencyId, since: sinceDate(now()) });
        const identity = candidates
          .map(departureIdentityFromSnapshot)
          .find((candidate): candidate is DepartureIdentity => candidate !== null && departureKeyForIdentity(candidate) === input.departureKey);
        if (!identity) return { status: "not_found" };
        const snapshots = await data.listDepartureSnapshots({ agencyId: access.agency.agencyId, identity });
        const reservationIds = snapshots.map((row) => row.id);
        if (!reservationIds.length) return { status: "not_found" };
        const [travelers, tickets, credentials, states] = await Promise.all([
          data.listTravelers({ agencyId: access.agency.agencyId, reservationIds }),
          data.listTickets({ agencyId: access.agency.agencyId, reservationIds }),
          data.listCredentials({ agencyId: access.agency.agencyId, reservationIds }),
          data.listBoardingStates({ agencyId: access.agency.agencyId, reservationIds }),
        ]);
        const manifest = manifestFromRows(identity, snapshots, travelers, tickets, credentials, states);
        if (!manifest) return { status: "not_found" };
        const filter = parseFilter(input.filter);
        const search = typeof input.search === "string" ? input.search.slice(0, 120) : "";
        return { status: "authorized", manifest, visibleTravelers: filterTravelers(manifest.travelers, filter, search), filter, search };
      } catch {
        return { status: "invalid_structure" };
      }
    },
  };
}
import { createHash } from "node:crypto";
