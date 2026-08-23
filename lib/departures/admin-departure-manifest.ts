import "server-only";

import { resolveAdminAgencyAccess } from "@/lib/agencies/admin-access";

import { createAdminDepartureManifestService } from "./admin-departure-manifest-core";
import { createSupabaseAdminDepartureManifestRepository } from "./admin-departure-manifest-repository";

function service() {
  return createAdminDepartureManifestService({
    resolveAccess: resolveAdminAgencyAccess,
    repository: () => createSupabaseAdminDepartureManifestRepository(),
  });
}

export async function listAdminDepartures(input: Readonly<{ requestedAgencySlug?: unknown }>) {
  return service().list(input);
}

export async function getAdminDepartureManifest(input: Readonly<{
  requestedAgencySlug?: unknown;
  departureKey: unknown;
  filter?: unknown;
  search?: unknown;
}>) {
  return service().get(input);
}
