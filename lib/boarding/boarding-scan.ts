import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import { createBoardingScanService } from "./boarding-scan-core";
import { createSupabaseBoardingScanRepository } from "./boarding-scan-repository";

function service() {
  return createBoardingScanService({
    resolveAccess: resolveAdminAgencyAccess,
    repository: () => createSupabaseBoardingScanRepository(),
  });
}

export async function resolveBoardingScan(input: Readonly<{ requestedAgencySlug?: unknown; rawToken: unknown }>) {
  return service().resolve(input);
}

export async function checkInBoardingTraveler(input: Readonly<{ requestedAgencySlug?: unknown; rawToken: unknown }>) {
  return service().checkIn(input);
}

export async function boardBoardingTraveler(input: Readonly<{ requestedAgencySlug?: unknown; rawToken: unknown }>) {
  return service().board(input);
}

export async function getAdminReservationBoardingSummary(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: string; travelerCount: number }>) {
  return service().summary(input);
}
