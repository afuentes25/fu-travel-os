import { hashBoardingToken } from "@/lib/documents/ticket-boarding-credential-core";
import type { AdminAgencyAccess } from "@/lib/agencies/admin-access-core";
import {
  projectReservationSnapshotOperational,
  type ReservationSnapshotProjectionSource,
} from "@/lib/reservations/snapshot-projection";
import { isBoardingRawToken } from "./boarding-qr-core";

export { BOARDING_QR_PREFIX, extractBoardingRawToken } from "./boarding-qr-core";

export type BoardingCredentialRow = Readonly<{
  id: string;
  reservationId: string;
  travelerId: string;
  ticketDocumentId: string;
  status: string;
}>;
export type BoardingTicketRow = Readonly<{
  id: string;
  documentType: string;
  status: string;
  reservationId: string;
  travelerId: string;
}>;
export type BoardingTravelerRow = Readonly<{
  id: string;
  reservationId: string;
  position: number;
  travelerType: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
}>;
export type BoardingStateRow = Readonly<{
  status: string;
  checkedInAt: string | null;
  boardedAt: string | null;
}>;
export type BoardingTransitionStatus = "checked_in" | "already_checked_in" | "already_boarded" | "boarded" | "check_in_required" | "credential_unavailable" | "invalid_structure";

export interface BoardingScanRepository {
  findCredential(input: Readonly<{ agencyId: string; tokenSha256: string }>): Promise<BoardingCredentialRow | null>;
  findTicket(input: Readonly<{ agencyId: string; ticketDocumentId: string; reservationId: string; travelerId: string }>): Promise<BoardingTicketRow | null>;
  findTraveler(input: Readonly<{ agencyId: string; reservationId: string; travelerId: string }>): Promise<BoardingTravelerRow | null>;
  findReservation(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<ReservationSnapshotProjectionSource | null>;
  findBoardingState(input: Readonly<{ agencyId: string; reservationId: string; travelerId: string }>): Promise<BoardingStateRow | null>;
  checkIn(input: Readonly<{ agencyId: string; tokenSha256: string; actorUserId: string }>): Promise<Readonly<{ status: BoardingTransitionStatus; checkedInAt: string | null; boardedAt: string | null }>>;
  board(input: Readonly<{ agencyId: string; tokenSha256: string; actorUserId: string }>): Promise<Readonly<{ status: BoardingTransitionStatus; checkedInAt: string | null; boardedAt: string | null }>>;
  listBoardingStates(input: Readonly<{ agencyId: string; reservationId: string }>): Promise<readonly BoardingStateRow[]>;
}

export type BoardingScanPreview = Readonly<{
  traveler: Readonly<{ position: number; name: string; travelerType: "adult" | "minor" }>;
  trip: Readonly<{ reservationCode: string; tourName: string | null; departureDate: string | null; boardingPoint: string | null }>;
  boarding: Readonly<{ status: "pending" | "checked_in" | "boarded"; checkedInAt: string | null; boardedAt: string | null }>;
}>;
export type ResolveBoardingScanResult =
  | Readonly<{ status: "valid"; preview: BoardingScanPreview }>
  | Readonly<{ status: "invalid" | "credential_unavailable" | "invalid_structure" }>
  | Extract<AdminAgencyAccess, Readonly<{ status: "unauthenticated" | "selection_required" | "forbidden" }>>;
export type BoardingTransitionResult =
  | Readonly<{ status: BoardingTransitionStatus; checkedInAt: string | null; boardedAt: string | null }>
  | Readonly<{ status: "invalid" }>
  | Extract<AdminAgencyAccess, Readonly<{ status: "unauthenticated" | "selection_required" | "forbidden" }>>;

function authorized(access: AdminAgencyAccess): access is Extract<AdminAgencyAccess, Readonly<{ status: "authorized" }>> {
  return access.status === "authorized";
}

function validState(state: BoardingStateRow): state is BoardingStateRow & Readonly<{ status: "pending" | "checked_in" | "boarded" }> {
  return (state.status === "pending" || state.status === "checked_in" || state.status === "boarded")
    && (state.status !== "pending" || (!state.checkedInAt && !state.boardedAt))
    && (state.status !== "checked_in" || (Boolean(state.checkedInAt) && !state.boardedAt))
    && (state.status !== "boarded" || (Boolean(state.checkedInAt) && Boolean(state.boardedAt)));
}

function preview(
  traveler: BoardingTravelerRow,
  reservation: ReservationSnapshotProjectionSource,
  state: BoardingStateRow,
): BoardingScanPreview | null {
  if (!Number.isInteger(traveler.position) || traveler.position <= 0 || !traveler.firstName || !traveler.lastName
    || (traveler.travelerType !== "adult" && traveler.travelerType !== "minor") || !validState(state)) return null;
  const projected = projectReservationSnapshotOperational(reservation);
  return {
    traveler: { position: traveler.position, name: `${traveler.firstName} ${traveler.lastName}`, travelerType: traveler.travelerType },
    trip: { reservationCode: projected.reservationCode, tourName: projected.trip.name, departureDate: projected.trip.departureDate, boardingPoint: projected.trip.boardingPointName },
    boarding: { status: state.status, checkedInAt: state.checkedInAt, boardedAt: state.boardedAt },
  };
}

/** Admin-only orchestration. Tokens stay in memory at the caller and are only hashed here. */
export function createBoardingScanService(dependencies: Readonly<{
  resolveAccess: (input: Readonly<{ requestedAgencySlug?: string }>) => Promise<AdminAgencyAccess>;
  repository: BoardingScanRepository | (() => BoardingScanRepository);
}>) {
  const repository = () => typeof dependencies.repository === "function" ? dependencies.repository() : dependencies.repository;
  async function resolveAccess(requestedAgencySlug: unknown): Promise<AdminAgencyAccess> {
    return dependencies.resolveAccess({ requestedAgencySlug: typeof requestedAgencySlug === "string" ? requestedAgencySlug : undefined });
  }
  return {
    async resolve(input: Readonly<{ requestedAgencySlug?: unknown; rawToken: unknown }>): Promise<ResolveBoardingScanResult> {
      const access = await resolveAccess(input.requestedAgencySlug);
      if (!authorized(access)) return access;
      if (!isBoardingRawToken(input.rawToken)) return { status: "invalid" };
      try {
        const data = repository();
        const credential = await data.findCredential({ agencyId: access.agency.agencyId, tokenSha256: hashBoardingToken(input.rawToken) });
        if (!credential) return { status: "invalid" };
        if (credential.status !== "active") return { status: "credential_unavailable" };
        const [ticket, traveler, reservation, state] = await Promise.all([
          data.findTicket({ agencyId: access.agency.agencyId, ticketDocumentId: credential.ticketDocumentId, reservationId: credential.reservationId, travelerId: credential.travelerId }),
          data.findTraveler({ agencyId: access.agency.agencyId, reservationId: credential.reservationId, travelerId: credential.travelerId }),
          data.findReservation({ agencyId: access.agency.agencyId, reservationId: credential.reservationId }),
          data.findBoardingState({ agencyId: access.agency.agencyId, reservationId: credential.reservationId, travelerId: credential.travelerId }),
        ]);
        if (!ticket || ticket.documentType !== "ticket" || ticket.status !== "available") return { status: "credential_unavailable" };
        if (!traveler || !reservation || !state || traveler.reservationId !== credential.reservationId || ticket.reservationId !== credential.reservationId || ticket.travelerId !== credential.travelerId) return { status: "invalid_structure" };
        const value = preview(traveler, reservation, state);
        return value ? { status: "valid", preview: value } : { status: "invalid_structure" };
      } catch {
        return { status: "invalid_structure" };
      }
    },
    async checkIn(input: Readonly<{ requestedAgencySlug?: unknown; rawToken: unknown }>): Promise<BoardingTransitionResult> {
      const access = await resolveAccess(input.requestedAgencySlug);
      if (!authorized(access)) return access;
      if (!isBoardingRawToken(input.rawToken)) return { status: "invalid" };
      try {
        return await repository().checkIn({ agencyId: access.agency.agencyId, tokenSha256: hashBoardingToken(input.rawToken), actorUserId: access.identity.userId });
      } catch { return { status: "invalid_structure", checkedInAt: null, boardedAt: null }; }
    },
    async board(input: Readonly<{ requestedAgencySlug?: unknown; rawToken: unknown }>): Promise<BoardingTransitionResult> {
      const access = await resolveAccess(input.requestedAgencySlug);
      if (!authorized(access)) return access;
      if (!isBoardingRawToken(input.rawToken)) return { status: "invalid" };
      try {
        return await repository().board({ agencyId: access.agency.agencyId, tokenSha256: hashBoardingToken(input.rawToken), actorUserId: access.identity.userId });
      } catch { return { status: "invalid_structure", checkedInAt: null, boardedAt: null }; }
    },
    async summary(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: string; travelerCount: number }>) {
      const access = await resolveAccess(input.requestedAgencySlug);
      if (!authorized(access)) return access;
      if (!Number.isInteger(input.travelerCount) || input.travelerCount < 0) return { status: "invalid_structure" as const };
      try {
        const states = await repository().listBoardingStates({ agencyId: access.agency.agencyId, reservationId: input.reservationId });
        return { status: "authorized" as const, checkedIn: states.filter((state) => state.status === "checked_in" || state.status === "boarded").length, boarded: states.filter((state) => state.status === "boarded").length, travelerCount: input.travelerCount };
      } catch { return { status: "invalid_structure" as const }; }
    },
  };
}
