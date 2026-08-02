import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agencies, departurePoints, travels } from "../data/demo/index";
import {
  filterCatalog,
  getAvailabilityLabel,
  getCatalogNextDeparture,
} from "../lib/catalog/index";
import {
  appendFxPaymentAllocation,
  createDeterministicDemoPaymentQuote,
  createFxConsent,
  DeterministicDemoExchangeRateProvider,
  ensureFreshDeterministicDemoPaymentQuote,
  formatAppliedRate,
  fxContractualPaymentLabel,
  isFxSnapshotExpired,
  requireFreshFxSnapshot,
  toMinorUnits,
  validateFxConsent,
  validateFxPaymentContext,
} from "../lib/fx/index";
import {
  createDepositSelectionSnapshot,
  isValidDepositOptionsPercent,
  resolveDepositOptionsPercent,
} from "../lib/deposit-options/index";
import {
  EXPLORER_BOOKING_COLORS,
  EXPLORER_SLIDER_LABELS,
  EXPLORER_STICKY_METRICS,
  explorerAdultRateOccupancy,
  explorerBookingMessage,
  explorerBookingOccupancy,
  explorerSlideIndex,
  explorerVisibleRateOccupancies,
} from "../lib/explorer/index";
import {
  confirmBoardingPoint,
  estimateCartLines,
  formatMoney,
  priceLine,
  priceLinePending,
  validateCart,
  validateCartCurrencies,
  validateDemoFxOrderShape,
  validateCartRoomCapacity,
} from "../lib/pricing/index";
import {
  createReservationSnapshotRepository,
  finalizeReservation,
  formatReservationTravelerSummary,
  readReservations,
  ReservationSnapshotConflictError,
  type ReservationSnapshot,
  type ReservationSnapshotInput,
} from "../lib/reservations/index";
import {
  createReservationServerCommand,
  ReservationServerCommandError,
  type ReservationServerCommandInput,
} from "../lib/reservations/server-command";
import { createPersistedAgencyResolver } from "../lib/agencies/index";
import {
  AdminAgencyAccessError,
  createAdminAgencyAccessResolver,
  type AdminAgencyMembershipRecord,
} from "../lib/agencies/admin-access-core";
import {
  parseAdminReservationPage,
  parseAdminReservationStatus,
  safeAdminNext,
  validateAdminLoginCredentials,
} from "../app/admin/admin-utils";
import { getSupabasePublicEnvironment } from "../lib/supabase/auth-env";
import { resolveVerifiedSupabaseIdentity } from "../lib/supabase/auth-identity-core";
import { isReservedInternalPath } from "../lib/routing/public-route-guard";
import { getSupabaseServerEnvironment } from "../lib/supabase/env";
import {
  AdminReservationListError,
  createAdminReservationListing,
  type AdminReservationListRow,
} from "../lib/reservations/admin-listing";
import { createReservationPostHandler } from "../app/api/reservations/route";
import { lavellaDeparture } from "../components/themes/lavella/lavella-utils";
import {
  createLavellaCartTransition,
  createLavellaReservationMirror,
  createLavellaReservationRequest,
  getLavellaBookingQuote,
  lavellaCartHref,
  updateLavellaTravelerCounts,
} from "../components/themes/lavella/lavella-booking-cart";
import {
  clearLavellaCatalogFilters,
  countLavellaActiveFilters,
} from "../components/themes/lavella/lavella-catalog-filters";
import {
  LAVELLA_CATALOG_COLUMN_OPTIONS,
  resolveLavellaCatalogColumns,
} from "../components/themes/lavella/lavella-catalog-config";
import {
  canLavellaAutoplay,
  lavellaRailTarget,
  lavellaSlideIndex,
  LAVELLA_SLIDER_TIMING,
  subscribeLavellaMediaQuery,
  updateLavellaHoverPause,
  updateLavellaPauseReasons,
} from "../components/themes/lavella/lavella-slider";
import type { SliderPauseReason } from "../components/themes/lavella/lavella-slider";
import {
  DEFAULT_ROOM_CAPACITY_POLICY,
  getRoomCapacity,
  resolveRoomCapacityPolicy,
  validateRoomCapacity,
} from "../lib/room-capacity/index";
import {
  createTravelerDrafts,
  reconcileTravelerDrafts,
  travelerFollowUpMessage,
  travelerWhatsAppSummary,
  validateTravelerDrafts,
} from "../lib/travelers/index";
import { getAgencySocialLinks, isValidSocialUrl } from "../lib/social/index";
import {
  isValidTheme,
  normalizeHostname,
  resolveTenant,
  resolveTheme,
} from "../lib/tenancy/index";
import { demoQuerySchema } from "../lib/validation/index";
import { whatsappUrl } from "../lib/whatsapp/index";
import {
  DEFAULT_TRIP_SECTIONS,
  TRIP_SECTION_RENDERER_KEYS,
  formatTripDuration,
  getEffectiveRateAmount,
  getEffectiveTaxesPerTraveler,
  getInitialItineraryOpenDays,
  getOrderedRouteStops,
  getPublicDeparturePoints,
  getSafeVideoPresentation,
  getStickyTripSections,
  getTripDisplayStartingPrice,
  getVisitedDestinations,
  isSafeCustomIconUrl,
  isSafeDownloadUrl,
  parseBulletedRecommendations,
  resolveTripSections,
  validateLead,
} from "../lib/trip-sections/index";
import type {
  CartLine,
  PricedCartLine,
  TravelerDraft,
  TravelProduct,
} from "../types/index";

const configuredTrip = () => travels.find((trip) => trip.pageConfiguration)!;

const adminMembership = (
  input: Partial<AdminAgencyMembershipRecord> = {},
): AdminAgencyMembershipRecord => ({
  agencyId: "agency-furiver",
  agencySlug: "furiver",
  agencyName: "Furiver",
  role: "admin",
  status: "active",
  ...input,
});

function adminAccessFixture(input: Readonly<{
  identity?: { userId: string; email: string | null } | null;
  memberships?: readonly AdminAgencyMembershipRecord[];
  failIdentity?: boolean;
  failMemberships?: boolean;
}> = {}) {
  const queriedUserIds: string[] = [];
  const resolver = createAdminAgencyAccessResolver({
    async getIdentity() {
      if (input.failIdentity) throw new Error("token details");
      return input.identity === undefined
        ? { userId: "user-verified", email: "admin@furiver.test" }
        : input.identity;
    },
    membershipRepository: {
      async listByUserId(userId) {
        queriedUserIds.push(userId);
        if (input.failMemberships) throw new Error("SQL details");
        return input.memberships ?? [];
      },
    },
  });
  return { resolver, queriedUserIds };
}

test("configuración pública de Supabase falla de forma segura cuando faltan variables", () => {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    assert.throws(
      () => getSupabasePublicEnvironment(),
      /configuración pública de autenticación/i,
    );
  } finally {
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = savedKey;
  }
});

test("configuración de Supabase servidor falla de forma segura cuando faltan variables", () => {
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    assert.throws(
      () => getSupabaseServerEnvironment(),
      /configuración de Supabase del servidor/i,
    );
  } finally {
    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }
});

test("identidad Supabase devuelve null sin sesión y proyecta solo claims verificados", async () => {
  const withoutSession = await resolveVerifiedSupabaseIdentity({
    auth: {
      async getClaims() {
        return { data: { claims: null }, error: null };
      },
    },
  } as never);
  assert.equal(withoutSession, null);

  const identity = await resolveVerifiedSupabaseIdentity({
    auth: {
      async getClaims() {
        return {
          data: {
            claims: {
              sub: "a6318a7e-ff74-4c16-b83e-bd219f7dd480",
              email: "admin@furiver.test",
              user_metadata: { role: "owner", agencyId: "forged" },
            },
          },
          error: null,
        };
      },
    },
  } as never);
  assert.deepEqual(identity, {
    userId: "a6318a7e-ff74-4c16-b83e-bd219f7dd480",
    email: "admin@furiver.test",
  });
});

test("clientes Auth no exponen service role y el proxy usa claims verificados", () => {
  const browserClient = readFileSync(
    "lib/supabase/browser-client.ts",
    "utf8",
  );
  const authServer = readFileSync(
    "lib/supabase/auth-server.ts",
    "utf8",
  );
  const proxy = readFileSync("proxy.ts", "utf8");

  assert.equal(browserClient.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(authServer.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.match(browserClient, /createBrowserClient/);
  assert.match(authServer, /createServerClient/);
  assert.match(proxy, /updateSupabaseAuthSession/);
  assert.equal(proxy.includes("getSession"), false);
});

test("rutas administrativas e internas no caen en el renderer público ni el demo heredado", () => {
  assert.equal(isReservedInternalPath("/admin/login"), true);
  assert.equal(isReservedInternalPath("/admin/furiver/reservaciones"), true);
  assert.equal(isReservedInternalPath("/api/reservations"), true);
  assert.equal(isReservedInternalPath("/_next/static/chunk.js"), true);
  assert.equal(isReservedInternalPath("/favicon.ico"), true);
  assert.equal(isReservedInternalPath("/viajes/barrancas-del-cobre"), false);

  const catchAll = readFileSync("app/[...route]/page.tsx", "utf8");
  const publicRenderer = readFileSync("components/travel-app.tsx", "utf8");
  const legacyRenderer = readFileSync("components/legacy-travel-app.tsx", "utf8");
  const proxy = readFileSync("lib/supabase/auth-proxy.ts", "utf8");
  assert.match(catchAll, /isReservedInternalPath\(pathname\)\)notFound\(\)/);
  assert.equal(
    publicRenderer.includes(
      'route.startsWith("/admin") ||\n    route.startsWith("/superadmin")',
    ),
    false,
  );
  assert.match(publicRenderer, /route\.startsWith\("\/demo\/admin"\)\s*\|\|/);
  assert.match(publicRenderer, /window\.location\.href = `\/demo\/admin\?\$\{next\}`/);
  assert.match(legacyRenderer, /route\.startsWith\("\/demo\/admin"\)/);
  assert.equal(proxy.includes("NextResponse.rewrite"), false);
  assert.match(proxy, /NextResponse\.next\(\{ request \}\)/);
});

test("acceso administrativo no consulta membresías sin una sesión verificada", async () => {
  const { resolver, queriedUserIds } = adminAccessFixture({ identity: null });
  assert.deepEqual(await resolver.resolve(), { status: "unauthenticated" });
  assert.deepEqual(queriedUserIds, []);
});

test("acceso administrativo rechaza usuarios sin membresías activas", async () => {
  const { resolver } = adminAccessFixture({
    memberships: [
      adminMembership({ status: "invited" }),
      adminMembership({ agencyId: "agency-crisenix", status: "suspended" }),
    ],
  });
  assert.deepEqual(await resolver.resolve(), { status: "forbidden" });
});

test("una membresía activa se selecciona automáticamente", async () => {
  const { resolver, queriedUserIds } = adminAccessFixture({
    memberships: [adminMembership({ role: "owner" })],
  });
  const access = await resolver.resolve();

  assert.equal(access.status, "authorized");
  if (access.status === "authorized") {
    assert.equal(access.agency.agencySlug, "furiver");
    assert.equal(access.agency.role, "owner");
    assert.deepEqual(access.identity, {
      userId: "user-verified",
      email: "admin@furiver.test",
    });
  }
  assert.deepEqual(queriedUserIds, ["user-verified"]);
});

test("múltiples membresías exigen selección y el slug autorizado se resuelve", async () => {
  const { resolver } = adminAccessFixture({
    memberships: [
      adminMembership(),
      adminMembership({
        agencyId: "agency-crisenix",
        agencySlug: "crisenix",
        agencyName: "Crisenix",
        role: "staff",
      }),
    ],
  });
  const selection = await resolver.resolve();
  assert.equal(selection.status, "selection_required");

  const selected = await resolver.resolve({ requestedAgencySlug: "crisenix" });
  assert.equal(selected.status, "authorized");
  if (selected.status === "authorized") {
    assert.equal(selected.agency.agencyId, "agency-crisenix");
  }
});

test("un slug ajeno no revela agencias y devuelve forbidden", async () => {
  const { resolver } = adminAccessFixture({ memberships: [adminMembership()] });
  assert.deepEqual(await resolver.resolve({ requestedAgencySlug: "crisenix" }), {
    status: "forbidden",
  });
});

test("errores administrativos se sanejan y la consulta queda limitada al usuario", async () => {
  const failing = adminAccessFixture({ failMemberships: true });
  await assert.rejects(
    failing.resolver.resolve(),
    (error: unknown) =>
      error instanceof AdminAgencyAccessError &&
      !error.message.includes("SQL"),
  );

  const source = readFileSync(
    "lib/agencies/admin-access-repository.ts",
    "utf8",
  );
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /\.eq\("status", "active"\)/);
  assert.equal(source.includes("reservation_snapshots"), false);

  const { resolver } = adminAccessFixture({ memberships: [adminMembership()] });
  const access = await resolver.resolve();
  assert.equal(JSON.stringify(access).includes("token"), false);
  assert.equal(JSON.stringify(access).includes("cookie"), false);
  assert.equal(JSON.stringify(access).includes("serviceRole"), false);
});

test("login administrativo valida credenciales en servidor y limita next a rutas internas", () => {
  assert.deepEqual(
    validateAdminLoginCredentials({
      email: " Admin@Furiver.test ",
      password: "password-seguro",
    }),
    { email: "admin@furiver.test", password: "password-seguro" },
  );
  assert.equal(validateAdminLoginCredentials({ email: "no-es-correo", password: "password-seguro" }), null);
  assert.equal(validateAdminLoginCredentials({ email: "admin@furiver.test", password: "corta" }), null);
  assert.equal(safeAdminNext("/admin/furiver/reservaciones?page=2"), "/admin/furiver/reservaciones?page=2");
  assert.equal(safeAdminNext("https://malicioso.example/admin"), null);
  assert.equal(safeAdminNext("//malicioso.example/admin"), null);
  assert.equal(safeAdminNext("/admin\\malicioso"), null);
});

test("listado administrativo sanea filtros y mantiene paginación fija sin exponer datos privados", () => {
  assert.equal(parseAdminReservationStatus("pending"), "pending");
  assert.equal(parseAdminReservationStatus("DROP TABLE"), undefined);
  assert.equal(parseAdminReservationPage("3"), 3);
  assert.equal(parseAdminReservationPage("0"), 1);
  assert.equal(parseAdminReservationPage("-3"), 1);

  const pageSource = readFileSync(
    "app/admin/[agencySlug]/reservaciones/page.tsx",
    "utf8",
  );
  const authorizationIndex = pageSource.indexOf("resolveAdminAgencyAccess({ requestedAgencySlug: agencySlug })");
  const listingIndex = pageSource.indexOf("createAdminReservationRepository().list");
  assert.ok(authorizationIndex >= 0 && listingIndex > authorizationIndex);
  assert.match(pageSource, /const PAGE_SIZE = 25/);
  assert.match(pageSource, /limit: PAGE_SIZE/);
  assert.equal(pageSource.includes("snapshot"), false);
  assert.equal(pageSource.includes("fullName"), false);
  assert.equal(pageSource.includes("email"), false);

  const actionsSource = readFileSync("app/admin/actions.ts", "utf8");
  assert.match(actionsSource, /signInWithPassword/);
  assert.match(actionsSource, /auth\.signOut/);
  assert.equal(actionsSource.includes("getSupabaseServerClient"), false);
  assert.equal(actionsSource.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
});

const reservationStorage = () => {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
};

const reservationInput = (
  idempotencyKey = "checkout-reservation-test",
): ReservationSnapshotInput => {
  const agency = structuredClone(agencies[0]);
  const tour = travels.find((trip) => trip.agencyId === agency.id)!;
  const departure = tour.departures[0];
  return {
    idempotencyKey,
    agency,
    theme: "lavella",
    tour: { id: tour.id, code: tour.code, title: tour.title },
    departure: { id: departure.id, startDate: departure.startDate },
    boarding: {
      boardingOptionId: departure.boardingOptions[0].id,
      boardingPointId:
        departure.boardingOptions[0].agencyDeparturePointId,
      pointName: "Punto Centro",
      city: "Ciudad de México",
      meetingTime: "05:20",
      surchargeAmount: 0,
      currency: tour.basePrice.currency,
    },
    travelers: {
      status: "pending",
      adults: 2,
      minors: 1,
      drafts: [],
    },
    rooms: 0,
    currency: tour.basePrice.currency,
    total: 29_980,
    depositPercent: 50,
    depositAmount: 14_990,
    remainingAmount: 14_990,
  };
};

const reservationSnapshotRepositoryClient = () => {
  const snapshots: Array<{
    agencyId: string;
    idempotencyKey: string;
    reservationCode: string;
    status: ReservationSnapshot["status"];
    currency: "MXN" | "USD";
    snapshot: ReservationSnapshot;
  }> = [];

  return {
    snapshots,
    client: {
      async findByIdempotency({
        agencyId,
        idempotencyKey,
      }: {
        agencyId: string;
        idempotencyKey: string;
      }) {
        return (
          snapshots.find(
            (snapshot) =>
              snapshot.agencyId === agencyId &&
              snapshot.idempotencyKey === idempotencyKey,
          ) ?? null
        );
      },
      async findByReservationCode({
        agencyId,
        reservationCode,
      }: {
        agencyId: string;
        reservationCode: string;
      }) {
        return (
          snapshots.find(
            (snapshot) =>
              snapshot.agencyId === agencyId &&
              snapshot.reservationCode === reservationCode,
          ) ?? null
        );
      },
      async insert(snapshot: (typeof snapshots)[number]) {
        if (
          snapshots.some(
            (existing) =>
              existing.agencyId === snapshot.agencyId &&
              (existing.idempotencyKey === snapshot.idempotencyKey ||
                existing.reservationCode === snapshot.reservationCode),
          )
        ) {
          const error = new Error("duplicate") as Error & { code?: string };
          error.code = "23505";
          throw error;
        }
        snapshots.push(snapshot);
        return snapshot;
      },
    },
  };
};

function finalizedReservationForRepository(idempotencyKey = "repository-key") {
  return finalizeReservation({
    storage: reservationStorage(),
    input: reservationInput(idempotencyKey),
    now: () => "2026-08-01T12:00:00.000Z",
    suffix: () => "R3P0S1",
  }).reservation;
}

function adminReservationRow(input: Readonly<{
  id: string;
  code: string;
  status: ReservationSnapshot["status"];
  createdAt: string;
}>): AdminReservationListRow {
  const snapshot = finalizedReservationForRepository(`admin-${input.id}`);
  return {
    id: input.id,
    reservation_code: input.code,
    status: input.status,
    currency: snapshot.currency,
    created_at: input.createdAt,
    snapshot: {
      ...snapshot,
      reservationCode: input.code,
      status: input.status,
      createdAt: input.createdAt,
      travelers: {
        ...snapshot.travelers,
        drafts: [
          {
            id: "adult-1",
            category: "adult",
            sequence: 1,
            fullName: "Dato privado",
            completionStatus: "complete",
          },
        ],
      },
    },
  };
}

function adminReservationRepositoryFixture() {
  const requests: Array<{
    agencyId: string;
    status?: ReservationSnapshot["status"];
    limit: number;
    offset: number;
  }> = [];
  const rows = [
    adminReservationRow({
      id: "reservation-old",
      code: "FT-001-OLD",
      status: "pending",
      createdAt: "2026-08-01T08:00:00.000Z",
    }),
    adminReservationRow({
      id: "reservation-new",
      code: "FT-001-NEW",
      status: "confirmed",
      createdAt: "2026-08-02T08:00:00.000Z",
    }),
  ];
  const repository = createAdminReservationListing({
    agencyResolver: {
      async findBySlug(slug) {
        return slug === "furiver"
          ? {
              id: "agency-furiver-persisted",
              slug: "furiver",
              name: "Furiver",
            }
          : null;
      },
    },
    reservationClient: {
      async list(input) {
        requests.push(input);
        return rows;
      },
    },
  });
  return { repository, requests };
}

const reservationServerCommand = (options?: {
  resolvePersistedAgency?: (slug: string) => Promise<{
    id: string;
    slug: string;
    name: string;
  } | null>;
}) => {
  const { client } = reservationSnapshotRepositoryClient();
  const repository = createReservationSnapshotRepository(client);
  const persistedAgencyIds: string[] = [];
  const command = createReservationServerCommand({
    agencies,
    travels,
    resolvePersistedAgency:
      options?.resolvePersistedAgency ??
      (async () => ({
        id: "00000000-0000-4000-8000-000000000001",
        slug: "furiver",
        name: "Furiver",
      })),
    findExisting: async (input) =>
      (await client.findByIdempotency(input))?.snapshot ?? null,
    persist: async (input) => {
      persistedAgencyIds.push(input.agencyId);
      return repository.insert(input);
    },
    now: () => "2026-08-01T12:00:00.000Z",
    suffix: () => "S3RV3R",
  });
  return Object.assign(command, { persistedAgencyIds });
};

const serverReservationRequest = (
  idempotencyKey = "server-command-key",
): ReservationServerCommandInput => {
  const trip = travels.find((candidate) => candidate.slug === "barrancas-del-cobre")!;
  const departure = trip.departures.find(
    (candidate) => candidate.boardingOptions.length > 0,
  )!;
  return {
    tenantSlug: "furiver",
    idempotencyKey,
    tripId: trip.id,
    departureId: departure.id,
    adults: 2,
    minors: 1,
    rooms: 1,
    extraIds: [],
    boardingPointId: departure.boardingOptions[0].agencyDeparturePointId,
    depositPercent: 20,
    travelers: { status: "pending", drafts: [] },
  };
};

const publicReservationBody = () => {
  const { idempotencyKey: _idempotencyKey, ...body } = serverReservationRequest();
  return body;
};

const reservationApiRequest = (
  body: unknown = publicReservationBody(),
  options?: { contentType?: string; idempotencyKey?: string; rawBody?: string },
) =>
  new Request("http://localhost/api/reservations", {
    method: "POST",
    headers: {
      "Content-Type": options?.contentType ?? "application/json",
      ...(options?.idempotencyKey === undefined
        ? { "Idempotency-Key": "api-idempotency-key" }
        : options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
    },
    body: options?.rawBody ?? JSON.stringify(body),
  });

const reservationApiSuccess = () => ({
  reservation: finalizedReservationForRepository("api-idempotency-key"),
  created: true,
});

test("resolvedor de agencias devuelve únicamente el UUID persistido", async () => {
  const resolver = createPersistedAgencyResolver({
    async findBySlug(slug) {
      return slug === "furiver"
        ? {
            id: "00000000-0000-4000-8000-000000000001",
            slug: "furiver",
            name: "Furiver",
          }
        : null;
    },
  });

  assert.deepEqual(await resolver.findBySlug("furiver"), {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "furiver",
    name: "Furiver",
  });
  assert.equal(await resolver.findBySlug("missing"), null);
});

test("repositorio administrativo aísla reservaciones por UUID persistido y ordena por creación", async () => {
  const { repository, requests } = adminReservationRepositoryFixture();
  const reservations = await repository.list({ agencySlug: "furiver" });

  assert.deepEqual(requests, [
    {
      agencyId: "agency-furiver-persisted",
      limit: 25,
      offset: 0,
    },
  ]);
  assert.deepEqual(
    reservations.map((reservation) => reservation.reservationCode),
    ["FT-001-NEW", "FT-001-OLD"],
  );
});

test("repositorio administrativo aplica status, paginación y límite máximo", async () => {
  const { repository, requests } = adminReservationRepositoryFixture();
  await repository.list({
    agencySlug: "furiver",
    status: "pending",
    limit: 999,
    offset: -4,
  });

  assert.deepEqual(requests[0], {
    agencyId: "agency-furiver-persisted",
    status: "pending",
    limit: 100,
    offset: 0,
  });
});

test("repositorio administrativo proyecta campos seguros sin snapshot ni viajeros", async () => {
  const { repository } = adminReservationRepositoryFixture();
  const [reservation] = await repository.list({ agencySlug: "furiver" });

  assert.equal("snapshot" in reservation, false);
  assert.equal(JSON.stringify(reservation).includes("Dato privado"), false);
  assert.equal(JSON.stringify(reservation).includes("travelers"), false);
  assert.deepEqual(reservation.occupancy, {
    adults: 2,
    minors: 1,
    totalTravelers: 3,
  });
});

test("listado administrativo conserva snapshots históricos sin habitaciones", async () => {
  const modern = adminReservationRow({
    id: "reservation-modern",
    code: "FT-001-MODERN",
    status: "pending",
    createdAt: "2026-08-03T08:00:00.000Z",
  });
  const historicalSource = adminReservationRow({
    id: "reservation-historical-rooms",
    code: "FT-001-HISTORICAL-ROOMS",
    status: "pending",
    createdAt: "2026-08-02T08:00:00.000Z",
  });
  const historicalSnapshot = historicalSource.snapshot as ReservationSnapshot;
  const { rooms: _rooms, ...snapshotWithoutRooms } = historicalSnapshot;
  const historical = { ...historicalSource, snapshot: snapshotWithoutRooms };
  const repository = createAdminReservationListing({
    agencyResolver: { async findBySlug() { return { id: "agency-furiver-persisted", slug: "furiver", name: "Furiver" }; } },
    reservationClient: { async list() { return [historical, modern]; } },
  });

  const reservations = await repository.list({ agencySlug: "furiver" });
  assert.equal(reservations.length, 2);
  assert.equal(reservations[0].rooms, modern.snapshot && (modern.snapshot as ReservationSnapshot).rooms);
  assert.equal(reservations[1].rooms, null);
  assert.deepEqual(reservations[1].occupancy, { adults: 2, minors: 1, totalTravelers: 3 });
});

test("listado administrativo recupera ocupación histórica desde viajeros sin inventar datos", async () => {
  const source = adminReservationRow({
    id: "reservation-historical-occupancy",
    code: "FT-001-HISTORICAL-OCCUPANCY",
    status: "pending",
    createdAt: "2026-08-02T08:00:00.000Z",
  });
  const snapshot = source.snapshot as ReservationSnapshot;
  const { occupancy: _occupancy, ...snapshotWithoutOccupancy } = snapshot;
  const repository = createAdminReservationListing({
    agencyResolver: { async findBySlug() { return { id: "agency-furiver-persisted", slug: "furiver", name: "Furiver" }; } },
    reservationClient: { async list() { return [{ ...source, snapshot: snapshotWithoutOccupancy }]; } },
  });

  const [reservation] = await repository.list({ agencySlug: "furiver" });
  assert.deepEqual(reservation.occupancy, { adults: 2, minors: 1, totalTravelers: 3 });
});

test("listado administrativo marca campos históricos irrecuparables como no disponibles", async () => {
  const source = adminReservationRow({
    id: "reservation-historical-incomplete",
    code: "FT-001-HISTORICAL-INCOMPLETE",
    status: "pending",
    createdAt: "2026-08-02T08:00:00.000Z",
  });
  const snapshot = source.snapshot as ReservationSnapshot;
  const { rooms: _rooms, occupancy: _occupancy, boarding: _boarding, ...partialSnapshot } = snapshot;
  const repository = createAdminReservationListing({
    agencyResolver: { async findBySlug() { return { id: "agency-furiver-persisted", slug: "furiver", name: "Furiver" }; } },
    reservationClient: { async list() { return [{ ...source, snapshot: partialSnapshot }]; } },
  });

  const [reservation] = await repository.list({ agencySlug: "furiver" });
  assert.equal(reservation.rooms, null);
  assert.equal(reservation.boardingPointName, null);
  assert.deepEqual(reservation.occupancy, { adults: 2, minors: 1, totalTravelers: 3 });

  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/page.tsx",
    "utf8",
  );
  assert.match(page, /value \?\? "No disponible"/);
});

test("listado administrativo conserva una página completa de cinco filas", async () => {
  const rows = Array.from({ length: 5 }, (_, index) =>
    adminReservationRow({
      id: `reservation-${index}`,
      code: `FT-001-${index}`,
      status: "pending",
      createdAt: `2026-08-0${index + 1}T08:00:00.000Z`,
    }),
  );
  const repository = createAdminReservationListing({
    agencyResolver: { async findBySlug() { return { id: "agency-furiver-persisted", slug: "furiver", name: "Furiver" }; } },
    reservationClient: { async list() { return rows; } },
  });

  assert.equal((await repository.list({ agencySlug: "furiver", limit: 25 })).length, 5);
});

test("repositorio administrativo entrega not found e internal saneados", async () => {
  const { repository } = adminReservationRepositoryFixture();
  await assert.rejects(
    repository.list({ agencySlug: "missing" }),
    (error: unknown) =>
      error instanceof AdminReservationListError && error.kind === "not_found",
  );

  const failing = createAdminReservationListing({
    agencyResolver: {
      async findBySlug() {
        throw new Error("SQL details must stay private");
      },
    },
    reservationClient: {
      async list() {
        return [];
      },
    },
  });
  await assert.rejects(
    failing.list({ agencySlug: "furiver" }),
    (error: unknown) =>
      error instanceof AdminReservationListError &&
      error.kind === "internal" &&
      !error.message.includes("SQL"),
  );
});

test("comando usa UUID persistido y rechaza una agencia inexistente", async () => {
  const command = reservationServerCommand();
  await command.execute(serverReservationRequest("persisted-agency"));
  assert.deepEqual(command.persistedAgencyIds, [
    "00000000-0000-4000-8000-000000000001",
  ]);

  const missing = reservationServerCommand({
    resolvePersistedAgency: async () => null,
  });
  await assert.rejects(
    missing.execute(serverReservationRequest("missing-agency")),
    (error: unknown) =>
      error instanceof ReservationServerCommandError && error.kind === "not_found",
  );
});

test("snapshot conserva habitaciones y ocupación server-side", () => {
  const reservation = finalizedReservationForRepository();

  assert.equal(reservation.rooms, 0);
  assert.deepEqual(reservation.occupancy, {
    adults: 2,
    minors: 1,
    totalTravelers: 3,
  });
});

test("reintento idempotente conserva habitaciones, ocupación e importes", async () => {
  const command = reservationServerCommand();
  const request = serverReservationRequest("rooms-occupancy-retry");
  const first = await command.execute(request);
  const retry = await command.execute(request);

  assert.equal(retry.created, false);
  assert.equal(retry.reservation.rooms, 1);
  assert.deepEqual(retry.reservation.occupancy, {
    adults: 2,
    minors: 1,
    totalTravelers: 3,
  });
  assert.equal(retry.reservation.total, first.reservation.total);
  assert.equal(retry.reservation.depositAmount, first.reservation.depositAmount);
  assert.equal(retry.reservation.remainingAmount, first.reservation.remainingAmount);
});

test("POST público devuelve una confirmación segura desde el snapshot servidor", async () => {
  const handler = createReservationPostHandler({
    execute: async () => reservationApiSuccess(),
  });
  const response = await handler(reservationApiRequest());
  const body = (await response.json()) as {
    reservationCode: string;
    confirmation: {
      tripCode: string;
      tripName: string;
      departureDate: string;
      boardingPointName: string;
      rooms: number;
      occupancy: { adults: number; minors: number; totalTravelers: number };
      currency: string;
      total: number;
      depositPercent: number;
      depositAmount: number;
      remainingAmount: number;
    };
  };

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(body.reservationCode, "FT-001-260801-R3P0S1");
  assert.deepEqual(Object.keys(body).sort(), [
    "confirmation",
    "createdAt",
    "reservationCode",
    "reservationId",
    "status",
  ]);
  assert.deepEqual(body.confirmation, {
    tripCode: "FT-001",
    tripName: "Bosque de luciérnagas",
    departureDate: travels[0].departures[0].startDate,
    boardingPointName: "Punto Centro",
    rooms: 0,
    occupancy: { adults: 2, minors: 1, totalTravelers: 3 },
    currency: "MXN",
    total: 29_980,
    depositPercent: 50,
    depositAmount: 14_990,
    remainingAmount: 14_990,
  });
  assert.equal("snapshot" in body, false);
  assert.equal(JSON.stringify(body).includes("travelers"), false);
  assert.equal(JSON.stringify(body).includes("fullName"), false);
});

test("reintento POST devuelve exactamente la misma confirmación", async () => {
  const handler = createReservationPostHandler({
    execute: async () => reservationApiSuccess(),
  });
  const first = await handler(reservationApiRequest());
  const retry = await handler(reservationApiRequest());
  const firstBody = (await first.json()) as { confirmation: unknown };
  const retryBody = (await retry.json()) as { confirmation: unknown };

  assert.deepEqual(retryBody.confirmation, firstBody.confirmation);
});

test("POST público rechaza Content-Type incorrecto", async () => {
  const handler = createReservationPostHandler({
    execute: async () => reservationApiSuccess(),
  });
  const response = await handler(
    reservationApiRequest(publicReservationBody(), { contentType: "text/plain" }),
  );
  assert.equal(response.status, 400);
});

test("POST público exige Idempotency-Key", async () => {
  const handler = createReservationPostHandler({
    execute: async () => reservationApiSuccess(),
  });
  const response = await handler(
    reservationApiRequest(publicReservationBody(), { idempotencyKey: "" }),
  );
  assert.equal(response.status, 400);
});

test("POST público rechaza JSON inválido", async () => {
  const handler = createReservationPostHandler({
    execute: async () => reservationApiSuccess(),
  });
  const response = await handler(
    reservationApiRequest(undefined, { rawBody: "{" }),
  );
  assert.equal(response.status, 400);
});

test("POST público rechaza campos manipulados antes de llamar al comando", async () => {
  let calls = 0;
  const handler = createReservationPostHandler({
    execute: async () => {
      calls += 1;
      return reservationApiSuccess();
    },
  });
  const response = await handler(
    reservationApiRequest({ ...publicReservationBody(), total: 1 }),
  );
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("POST público convierte conflictos seguros en 409", async () => {
  const handler = createReservationPostHandler({
    execute: async () => {
      throw new ReservationSnapshotConflictError("idempotency");
    },
  });
  const response = await handler(reservationApiRequest());
  assert.equal(response.status, 409);
});

test("POST público oculta errores internos", async () => {
  const handler = createReservationPostHandler({
    execute: async () => {
      throw new Error("database password must not be returned");
    },
  });
  const response = await handler(reservationApiRequest());
  const body = (await response.json()) as { error: string };
  assert.equal(response.status, 500);
  assert.equal(body.error, "No fue posible registrar la reservación.");
});

test("POST público llama al comando exactamente una vez", async () => {
  let calls = 0;
  const handler = createReservationPostHandler({
    execute: async (input) => {
      calls += 1;
      assert.equal(input.idempotencyKey, "api-idempotency-key");
      return reservationApiSuccess();
    },
  });
  const response = await handler(reservationApiRequest());
  assert.equal(response.status, 201);
  assert.equal(calls, 1);
});

test("comando servidor crea una reservación válida desde datos confiables", async () => {
  const result = await reservationServerCommand().execute(
    serverReservationRequest(),
  );

  assert.equal(result.created, true);
  assert.equal(result.reservation.agency.id, "a-furiver");
  assert.equal(result.reservation.tour.title, "Barrancas del Cobre");
  assert.equal(result.reservation.depositPercent, 20);
});

test("comando servidor ignora importes manipulados fuera de la entrada permitida", async () => {
  const request = {
    ...serverReservationRequest(),
    total: 1,
    depositAmount: 1,
    remainingAmount: 0,
    currency: "USD",
  };
  const result = await reservationServerCommand().execute(request);

  assert.notEqual(result.reservation.total, 1);
  assert.equal(result.reservation.currency, "MXN");
});

test("comando servidor rechaza un tour de otra agencia", async () => {
  const otherTrip = travels.find(
    (candidate) => candidate.agencyId === "a-crisenix",
  )!;
  await assert.rejects(
    reservationServerCommand().execute({
      ...serverReservationRequest(),
      tripId: otherTrip.id,
    }),
    /La solicitud de reservación no es válida/,
  );
});

test("comando servidor rechaza salida y abordaje inválidos", async () => {
  const command = reservationServerCommand();
  await assert.rejects(
    command.execute({ ...serverReservationRequest(), departureId: "missing" }),
    /La solicitud de reservación no es válida/,
  );
  await assert.rejects(
    command.execute({
      ...serverReservationRequest("invalid-boarding"),
      boardingPointId: "missing",
    }),
    /La solicitud de reservación no es válida/,
  );
});

test("comando servidor rechaza un anticipo no configurado", async () => {
  await assert.rejects(
    reservationServerCommand().execute({
      ...serverReservationRequest(),
      depositPercent: 30,
    }),
    /La solicitud de reservación no es válida/,
  );
});

test("comando servidor conserva idempotencia al reintentar", async () => {
  const command = reservationServerCommand();
  const request = serverReservationRequest("server-command-retry");
  const first = await command.execute(request);
  const retry = await command.execute(request);

  assert.equal(first.created, true);
  assert.equal(retry.created, false);
  assert.equal(retry.reservation.reservationCode, first.reservation.reservationCode);
});

test("repositorio de snapshots inserta una reservación inmutable", async () => {
  const { client, snapshots } = reservationSnapshotRepositoryClient();
  const reservation = finalizedReservationForRepository();
  const repository = createReservationSnapshotRepository(client);

  const result = await repository.insert({
    agencyId: "agency-uuid",
    idempotencyKey: reservation.idempotencyKey,
    snapshot: reservation,
  });

  assert.equal(result.created, true);
  assert.equal(result.reservation.reservationCode, reservation.reservationCode);
  assert.equal(snapshots.length, 1);
});

test("reintento de snapshot devuelve la reservación existente", async () => {
  const { client, snapshots } = reservationSnapshotRepositoryClient();
  const reservation = finalizedReservationForRepository();
  const repository = createReservationSnapshotRepository(client);
  const input = {
    agencyId: "agency-uuid",
    idempotencyKey: reservation.idempotencyKey,
    snapshot: reservation,
  };

  await repository.insert(input);
  const retry = await repository.insert(input);

  assert.equal(retry.created, false);
  assert.equal(retry.reservation.reservationCode, reservation.reservationCode);
  assert.equal(snapshots.length, 1);
});

test("misma idempotencia con contenido distinto produce conflicto seguro", async () => {
  const { client } = reservationSnapshotRepositoryClient();
  const reservation = finalizedReservationForRepository();
  const repository = createReservationSnapshotRepository(client);
  await repository.insert({
    agencyId: "agency-uuid",
    idempotencyKey: reservation.idempotencyKey,
    snapshot: reservation,
  });

  await assert.rejects(
    repository.insert({
      agencyId: "agency-uuid",
      idempotencyKey: reservation.idempotencyKey,
      snapshot: { ...reservation, total: reservation.total + 1 },
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.name === "ReservationSnapshotConflictError" &&
      "kind" in error &&
      error.kind === "idempotency",
  );
});

test("folio duplicado distinto produce conflicto seguro", async () => {
  const { client } = reservationSnapshotRepositoryClient();
  const first = finalizedReservationForRepository("repository-key-a");
  const second = finalizedReservationForRepository("repository-key-b");
  const repository = createReservationSnapshotRepository(client);
  await repository.insert({
    agencyId: "agency-uuid",
    idempotencyKey: first.idempotencyKey,
    snapshot: first,
  });

  await assert.rejects(
    repository.insert({
      agencyId: "agency-uuid",
      idempotencyKey: second.idempotencyKey,
      snapshot: second,
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.name === "ReservationSnapshotConflictError" &&
      "kind" in error &&
      error.kind === "reservation_code",
  );
});

test("errores internos del repositorio no exponen detalles de Supabase", async () => {
  const reservation = finalizedReservationForRepository();
  const repository = createReservationSnapshotRepository({
    async findByIdempotency() {
      throw new Error("database password should never be exposed");
    },
    async findByReservationCode() {
      return null;
    },
    async insert() {
      throw new Error("unreachable");
    },
  });

  await assert.rejects(
    repository.insert({
      agencyId: "agency-uuid",
      idempotencyKey: reservation.idempotencyKey,
      snapshot: reservation,
    }),
    /No fue posible guardar la reservación/,
  );
});

test("folio de reservación incluye la clave actual del tour", () => {
  const storage = reservationStorage();
  const input = reservationInput();
  const { reservation } = finalizeReservation({
    storage,
    input,
    now: () => "2026-07-29T12:00:00.000Z",
    suffix: () => "A1B2C3",
  });

  assert.equal(
    reservation.reservationCode,
    `${input.tour.code}-260729-A1B2C3`,
  );
});

test("snapshot de reservación conserva anticipo y saldo", () => {
  const storage = reservationStorage();
  const { reservation } = finalizeReservation({
    storage,
    input: reservationInput(),
    suffix: () => "D4E5F6",
  });

  assert.equal(reservation.depositPercent, 50);
  assert.equal(reservation.depositAmount, 14_990);
  assert.equal(reservation.remainingAmount, 14_990);
  assert.equal(Object.isFrozen(reservation), true);
  assert.equal(Object.isFrozen(reservation.travelers), true);
});

test("resumen de viajeros pendientes usa la ocupación del snapshot", () => {
  assert.equal(
    formatReservationTravelerSummary({ adults: 2, minors: 2 }),
    "4 viajeros · 2 adultos · 2 menores",
  );
  assert.equal(
    formatReservationTravelerSummary({ adults: 1, minors: 1 }),
    "2 viajeros · 1 adulto · 1 menor",
  );
  assert.equal(
    formatReservationTravelerSummary({ adults: 1, minors: 0 }),
    "1 viajero · 1 adulto",
  );
});

test("doble envío de checkout no duplica la reservación", () => {
  const storage = reservationStorage();
  const input = reservationInput();
  const first = finalizeReservation({
    storage,
    input,
    suffix: () => "G7H8I9",
  });
  const second = finalizeReservation({
    storage,
    input,
    suffix: () => "J1K2L3",
  });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.reservation.reservationCode, first.reservation.reservationCode);
  assert.equal(readReservations(storage).length, 1);
});

test("cambios posteriores de configuración no alteran la reservación", () => {
  const storage = reservationStorage();
  const input = reservationInput();
  finalizeReservation({
    storage,
    input,
    suffix: () => "M4N5P6",
  });
  input.agency.settings.depositOptionsPercent = [100];

  const [stored] = readReservations(storage);
  assert.equal(stored.depositPercent, 50);
  assert.equal(stored.depositAmount, 14_990);
  assert.equal(stored.remainingAmount, 14_990);
});

test("opciones de anticipo validan límites, enteros, orden y duplicados", () => {
  assert.equal(isValidDepositOptionsPercent([20, 50, 100]), true);
  assert.equal(isValidDepositOptionsPercent([]), false);
  assert.equal(isValidDepositOptionsPercent([20, 40, 60, 80]), false);
  assert.equal(isValidDepositOptionsPercent([20.5, 100]), false);
  assert.equal(isValidDepositOptionsPercent([0, 100]), false);
  assert.equal(isValidDepositOptionsPercent([50, 20]), false);
  assert.equal(isValidDepositOptionsPercent([20, 20]), false);
  assert.deepEqual(resolveDepositOptionsPercent(undefined), [100]);
  assert.deepEqual(resolveDepositOptionsPercent([50, 20]), [100]);
});

test("anticipo porcentual calcula pagar ahora y saldo restante", () => {
  assert.deepEqual(createDepositSelectionSnapshot(29_980, 20), {
    depositPercent: 20,
    depositAmount: 5_996,
    remainingAmount: 23_984,
  });
  assert.deepEqual(createDepositSelectionSnapshot(1_599, 100), {
    depositPercent: 100,
    depositAmount: 1_599,
    remainingAmount: 0,
  });
});

test("snapshot de anticipo permanece inmutable ante cambios de configuración", () => {
  const snapshot = createDepositSelectionSnapshot(29_980, 50);
  const laterOptions = resolveDepositOptionsPercent([20, 100]);

  assert.equal(Object.isFrozen(snapshot), true);
  assert.deepEqual(snapshot, {
    depositPercent: 50,
    depositAmount: 14_990,
    remainingAmount: 14_990,
  });
  assert.deepEqual(laterOptions, [20, 100]);
});

test("secciones configurables se ordenan, ocultan desactivadas y omiten contenido vacío", () => {
  const trip = structuredClone(configuredTrip());
  trip.pageConfiguration!.sections = [
    { id: "faq", type: "faq", enabled: true, order: 2, showInStickyNavigation: true },
    { id: "summary", type: "summary", enabled: true, order: 1, showInStickyNavigation: true },
    { id: "off", type: "video", enabled: false, order: 0 },
  ];
  trip.faqContent = { displayMode: "accordion", items: [] };
  assert.deepEqual(resolveTripSections(trip).map((item) => item.type), ["summary"]);
});
test("sticky nav refleja orden y visibilidad reales", () => {
  const trip = configuredTrip();
  const sticky = getStickyTripSections(trip);
  assert.ok(sticky.length > 1);
  assert.deepEqual(sticky, [...sticky].sort((a, b) => a.order - b.order));
  assert.ok(sticky.every((item) => item.enabled && item.showInStickyNavigation));
});
test("la configuración predeterminada tiene identificadores y orden estable", () => {
  assert.equal(DEFAULT_TRIP_SECTIONS[0].type, "summary");
  assert.equal(new Set(DEFAULT_TRIP_SECTIONS.map((item) => item.id)).size, DEFAULT_TRIP_SECTIONS.length);
});
test("duración singular y con noches se formatea sin cero noches", () => {
  assert.equal(formatTripDuration(1, 0), "1 día");
  assert.equal(formatTripDuration(2, 1), "2 días · 1 noche");
});
test("destinos del itinerario se ordenan, deduplican y limitan", () => {
  const days = [
    { day: 2, order: 2, title: "B", description: "", stops: [{ id: "3", name: "Aculco", order: 1 }] },
    { day: 1, order: 1, title: "A", description: "", stops: [{ id: "1", name: "Amealco", order: 1 }, { id: "2", name: "Aculco", order: 2 }] },
  ];
  assert.deepEqual(getVisitedDestinations(days, 2), ["Amealco", "Aculco"]);
});
test("precio con hospedaje usa adulto doble", () => {
  const trip = travels.find((item) => item.accommodationMode === "hotel_occupancy")!;
  assert.equal(getTripDisplayStartingPrice({ trip }).amount, trip.pricingOptions.find((item) => item.occupancy === "double")!.amount);
  assert.equal(getTripDisplayStartingPrice({ trip }).basis, "adult_double");
});
test("precio sin hospedaje usa adulto general", () => {
  const trip = travels.find((item) => item.accommodationMode === "none")!;
  assert.equal(getTripDisplayStartingPrice({ trip }).amount, trip.pricingOptions.find((item) => item.occupancy === "general")!.amount);
  assert.equal(getTripDisplayStartingPrice({ trip }).basis, "adult_general");
});
test("override de salida sustituye el precio sin mutar el viaje", () => {
  const trip = travels.find((item) => item.departures.some((departure) => departure.pricing?.mode === "custom"))!;
  const departure = trip.departures.find((item) => item.pricing?.mode === "custom")!;
  const base = trip.basePrice.amount;
  assert.notEqual(getTripDisplayStartingPrice({ trip, departure }).amount, base);
  assert.equal(trip.basePrice.amount, base);
});
test("modos del itinerario producen estados de apertura correctos", () => {
  assert.deepEqual(getInitialItineraryOpenDays("all_open", 3), [0, 1, 2]);
  assert.deepEqual(getInitialItineraryOpenDays("first_open", 3), [0]);
  assert.deepEqual(getInitialItineraryOpenDays("all_closed", 3), []);
});
test("video vacío y proveedor desconocido se rechazan", () => {
  assert.equal(getSafeVideoPresentation({ enabled: true, provider: "html5", url: "" }), null);
  assert.equal(getSafeVideoPresentation({ enabled: true, provider: "youtube", url: "https://evil.example/watch?v=abcdef" }), null);
});
test("YouTube, Vimeo, TikTok, Instagram y HTML5 usan presentaciones controladas", () => {
  assert.equal(getSafeVideoPresentation({ enabled: true, provider: "youtube", url: "https://youtube.com/watch?v=abcdef1" })?.mode, "iframe");
  assert.equal(getSafeVideoPresentation({ enabled: true, provider: "vimeo", url: "https://vimeo.com/123456" })?.mode, "iframe");
  assert.equal(getSafeVideoPresentation({ enabled: true, provider: "tiktok", url: "https://www.tiktok.com/@demo/video/123" })?.mode, "link");
  assert.equal(getSafeVideoPresentation({ enabled: true, provider: "instagram", url: "https://instagram.com/reel/demo" })?.mode, "link");
  assert.equal(getSafeVideoPresentation({ enabled: true, provider: "html5", url: "https://cdn.example/demo.mp4" })?.mode, "html5");
});
test("URLs y archivos peligrosos se rechazan", () => {
  assert.equal(isSafeDownloadUrl("javascript:alert(1)"), false);
  assert.equal(isSafeDownloadUrl("https://example.com/payload.exe"), false);
  assert.equal(isSafeDownloadUrl("/documents/itinerario-demo.txt"), true);
});
test("icono personalizado solo admite imágenes seguras", () => {
  assert.equal(isSafeCustomIconUrl("https://example.com/icon.webp"), true);
  assert.equal(isSafeCustomIconUrl("https://example.com/icon.svg"), false);
});
test("parser de recomendaciones elimina viñetas y líneas vacías", () => {
  assert.deepEqual(parseBulletedRecommendations("• Calzado\n\n- Agua\n* Bloqueador").map((item) => item.text), ["Calzado", "Agua", "Bloqueador"]);
});
test("ruta mantiene orden por día y orden interno", () => {
  assert.deepEqual(getOrderedRouteStops({ enabled: true, mode: "route", routeStops: [
    { id: "b", dayNumber: 2, name: "B", order: 1 },
    { id: "a2", dayNumber: 1, name: "A2", order: 2 },
    { id: "a1", dayNumber: 1, name: "A1", order: 1 },
  ] }).map((item) => item.id), ["a1", "a2", "b"]);
});
test("puntos públicos filtran desactivados y conservan orden", () => {
  assert.deepEqual(getPublicDeparturePoints([
    { id: "2", type: "airport", name: "Aeropuerto", enabled: true, order: 2 },
    { id: "off", type: "hotel", name: "Oculto", enabled: false, order: 0 },
    { id: "1", type: "city_boarding", name: "Centro", enabled: true, order: 1 },
  ]).map((item) => item.id), ["1", "2"]);
});
test("formulario de descarga valida nombre, WhatsApp y consentimiento", () => {
  assert.deepEqual(Object.keys(validateLead({ name: " ", whatsapp: "55", consent: false })).sort(), ["consent", "name", "whatsapp"]);
  assert.deepEqual(validateLead({ name: "Ana", whatsapp: "+525512345678", consent: true }), {});
});
test("demos incluyen descarga directa y descarga con formulario", () => {
  const configured = travels.filter((trip) => trip.itineraryDownload?.enabled);
  assert.ok(configured.some((trip) => !trip.itineraryDownload?.requireLeadForm));
  assert.ok(configured.some((trip) => trip.itineraryDownload?.requireLeadForm));
});
test("día sin imagen no requiere hueco estructural", () => {
  const trip = configuredTrip();
  assert.ok(trip.itinerary.some((day) => !day.images?.length) || trip.itinerary.length <= 2);
});
test("demos incluyen mapa destino y mapa de ruta", () => {
  assert.ok(travels.some((trip) => trip.mapSettings?.mode === "main_destination"));
  assert.ok(travels.some((trip) => trip.mapSettings?.mode === "route"));
});
test("demos incluyen punto terrestre y aeropuerto", () => {
  const points = travels.flatMap((trip) => trip.publicDeparturePoints ?? []);
  assert.ok(points.some((point) => point.type === "city_boarding"));
  assert.ok(points.some((point) => point.type === "airport" && point.airportCode));
});
test("información importante y FAQ solo existen con contenido útil", () => {
  const trip = configuredTrip();
  assert.ok(trip.importantInformation!.items.length > 0);
  assert.ok(trip.faqContent!.items.every((item) => item.question && item.answer));
});
const barrancasTrip = () => travels.find((trip) => trip.slug === "barrancas-del-cobre")!;
test("viaje de cinco días usa secciones configurables", () => {
  const trip = barrancasTrip();
  assert.equal(trip.durationDays, 5);
  assert.ok(resolveTripSections(trip).length >= 12);
});
test("viaje de un día sigue usando secciones configurables", () => {
  const trip = travels.find((item) => item.slug === "bosque-de-luciernagas")!;
  assert.equal(trip.durationDays, 1);
  assert.ok(resolveTripSections(trip).some((section) => section.type === "itinerary"));
});
test("el número de días no controla el orquestador modular", () => {
  const oneDay = travels.find((item) => item.slug === "bosque-de-luciernagas")!;
  const multiday = barrancasTrip();
  assert.ok(oneDay.pageConfiguration);
  assert.ok(multiday.pageConfiguration);
  assert.equal(typeof resolveTripSections(oneDay)[0].order, typeof resolveTripSections(multiday)[0].order);
});
test("Barrancas contiene cinco días con identificadores estables", () => {
  const days = barrancasTrip().itinerary;
  assert.equal(days.length, 5);
  assert.deepEqual(days.map((day) => day.day), [1, 2, 3, 4, 5]);
  assert.equal(new Set(days.map((day) => day.id)).size, 5);
});
test("Barrancas extrae destinos desde los cinco días sin duplicados", () => {
  assert.deepEqual(getVisitedDestinations(barrancasTrip().itinerary), ["Chihuahua", "Creel", "Divisadero", "Barrancas del Cobre"]);
});
test("precio desde de Barrancas usa la base doble", () => {
  const result = getTripDisplayStartingPrice({ trip: barrancasTrip() });
  assert.equal(result.amount, 14990);
  assert.equal(result.basis, "adult_double");
});
test("la misma salida activa alimenta resumen y panel", () => {
  const trip = barrancasTrip();
  const selected = trip.departures[1];
  assert.equal(getTripDisplayStartingPrice({ trip, departure: selected }).amount, selected.pricing?.pricingOverrides?.adultDouble);
});
test("cambiar fecha conserva viajeros y actualiza el texto de WhatsApp", () => {
  const trip = barrancasTrip();
  const first = explorerBookingMessage({ agencyName: "Furiver", trip, departureLabel: "10 de agosto", adults: 2, children: 0, occupancyLabel: "Doble", totalLabel: "$29,980 MXN", depositLabel: "$2,000 MXN", url: "https://demo.test" });
  const second = explorerBookingMessage({ agencyName: "Furiver", trip, departureLabel: "7 de septiembre", adults: 2, children: 0, occupancyLabel: "Doble", totalLabel: "$32,378 MXN", depositLabel: "$2,000 MXN", url: "https://demo.test" });
  assert.match(first, /10 de agosto/);
  assert.match(second, /7 de septiembre/);
  assert.match(second, /2 adultos/);
});
test("override de salida aplica a la tarifa doble efectiva", () => {
  const trip = barrancasTrip();
  const departure = trip.departures[1];
  const rate = trip.pricingOptions.find((item) => item.occupancy === "double")!;
  assert.equal(getEffectiveRateAmount({ trip, departure, rate }), departure.pricing!.pricingOverrides!.adultDouble);
});
test("dos adultos no duplican la tarifa más de una vez", () => {
  const trip = barrancasTrip();
  const departure = trip.departures[0];
  const rate = trip.pricingOptions.find((item) => item.occupancy === "double")!;
  const priced = priceLinePending({ id: "barrancas-double", agencyId: trip.agencyId, travelId: trip.id, departureId: departure.id, boardingOptionId: null, pricingOptionId: rate.id, travelers: 2, extraIds: [] });
  assert.equal(priced.subtotal, 29980);
});
test("impuestos de Barrancas se aplican una sola vez por viajero", () => {
  const trip = barrancasTrip();
  const departure = trip.departures[0];
  const rate = trip.pricingOptions.find((item) => item.occupancy === "double")!;
  const perTraveler = getEffectiveTaxesPerTraveler({ trip, departure, rate });
  const priced = priceLinePending({ id: "barrancas-tax", agencyId: trip.agencyId, travelId: trip.id, departureId: departure.id, boardingOptionId: null, pricingOptionId: rate.id, travelers: 2, extraIds: [] });
  assert.equal(priced.taxes, perTraveler * 2);
  assert.equal(priced.total, priced.subtotal + priced.taxes);
});
test("cargos adicionales permanecen separados del subtotal e impuestos", () => {
  const trip = barrancasTrip();
  const rate = trip.pricingOptions.find((item) => item.occupancy === "double")!;
  const priced = priceLinePending({ id: "barrancas-extra", agencyId: trip.agencyId, travelId: trip.id, departureId: trip.departures[0].id, boardingOptionId: null, pricingOptionId: rate.id, travelers: 2, extraIds: [trip.extras[0].id] });
  assert.equal(priced.total, priced.subtotal + priced.taxes + priced.extrasTotal);
});
test("capacidad hotelera continúa activa para Barrancas", () => {
  const result = validateRoomCapacity({ adults: 2, minors: 2, maxGuestsPerRoom: 4, adultCountsTowardCapacity: true, minorCountsTowardCapacity: true });
  assert.equal(result.valid, true);
});
test("menores no cambian la base adulta de Barrancas", () => {
  const trip = barrancasTrip();
  assert.equal(explorerAdultRateOccupancy(trip, 2), "double");
  assert.equal(explorerAdultRateOccupancy(trip, 3), "triple");
});
test("viaje sin hospedaje no expone tarifas hoteleras", () => {
  const trip = travels.find((item) => item.slug === "bosque-de-luciernagas")!;
  assert.ok(trip.pricingOptions.every((rate) => !["single", "double", "triple", "quadruple"].includes(rate.occupancy)));
});
test("sticky nav multiday refleja contenido y orden", () => {
  const nav = getStickyTripSections(barrancasTrip());
  assert.ok(nav.some((section) => section.type === "rates"));
  assert.deepEqual(nav, [...nav].sort((a, b) => a.order - b.order));
});
test("descarga de Barrancas usa su documento específico", () => {
  assert.equal(barrancasTrip().itineraryDownload?.fileUrl, "/documents/itinerario-barrancas-del-cobre-demo.txt");
});
test("mapa de Barrancas conserva días del itinerario", () => {
  const stops = getOrderedRouteStops(barrancasTrip().mapSettings);
  assert.deepEqual([...new Set(stops.map((stop) => stop.dayNumber))], [1, 2, 3, 4, 5]);
});
test("Lavella queda registrado sin reemplazar el renderer Explorer", () => {
  assert.equal(TRIP_SECTION_RENDERER_KEYS.explorer, "explorer-cinematic");
  assert.equal(TRIP_SECTION_RENDERER_KEYS.lavella, "lavella-native");
  assert.notEqual(TRIP_SECTION_RENDERER_KEYS.lavella, TRIP_SECTION_RENDERER_KEYS.explorer);
});
test("resuelve tenant por hostname, query demo y fallback local", () => {
  assert.equal(resolveTenant("FURIVER.TRAVEL.FU.LAND:443").slug, "furiver");
  assert.equal(resolveTenant("localhost:3000", "crisenix").slug, "crisenix");
  assert.equal(resolveTenant("dominio-invalido.test").slug, "furiver");
  assert.equal(
    normalizeHostname("https://AgenciaEjemplo.com/"),
    "agenciaejemplo.com",
  );
});
test("Explorer y Lavella son los únicos temas registrados", () => {
  assert.deepEqual(Object.keys(TRIP_SECTION_RENDERER_KEYS).sort(), [
    "explorer",
    "lavella",
  ]);
  assert.equal(isValidTheme("explorer"), true);
  assert.equal(isValidTheme("lavella"), true);
});
test("los temas retirados son inválidos y usan el fallback general", () => {
  const removedThemes = [
    ["bou", "tique"].join(""),
    ["market", "place"].join(""),
  ];
  for (const value of removedThemes) {
    assert.equal(isValidTheme(value), false);
    assert.equal(resolveTheme(agencies[0], value), "explorer");
    assert.equal(
      demoQuerySchema.safeParse({ theme: value }).success,
      false,
    );
  }
});
test("los selectores públicos y administrativos contienen exactamente dos temas", () => {
  for (const file of [
    "components/travel-app.tsx",
    "components/legacy-travel-app.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    const options = [...source.matchAll(/<option value="([^"]+)">(?:Explorer|Lavella)<\/option>/g)]
      .map((match) => match[1]);
    assert.deepEqual(options, ["explorer", "lavella"]);
  }
});
test("no se importan renderers ni se cargan estilos de temas retirados", () => {
  const removedThemes = [
    ["bou", "tique"].join(""),
    ["market", "place"].join(""),
  ];
  const source = [
    readFileSync("components/travel-app.tsx", "utf8"),
    readFileSync("components/legacy-travel-app.tsx", "utf8"),
    readFileSync("app/globals.css", "utf8"),
  ].join("\n");
  for (const value of removedThemes) {
    assert.equal(source.toLowerCase().includes(value), false);
  }
});
test("Lavella es seleccionable y un tema inválido usa Explorer", () => {
  assert.equal(resolveTheme(agencies[0], "lavella"), "lavella");
  assert.equal(resolveTheme(agencies[0], "tema-inexistente"), "explorer");
});
test("catálogo busca, filtra y ordena sin mutar origen", () => {
  const own = travels.filter((t) => t.agencyId === agencies[1].id);
  assert.equal(filterCatalog(own, { q: "Europa" }).length, 1);
  assert.ok(
    filterCatalog(own, { currency: "USD" }).every(
      (t) => t.basePrice.currency === "USD",
    ),
  );
  assert.deepEqual(
    filterCatalog(own, { sort: "price-asc" }).map((t) => t.basePrice.amount),
    [
      ...filterCatalog(own, { sort: "price-asc" }).map(
        (t) => t.basePrice.amount,
      ),
    ].sort((a, b) => a - b),
  );
});
test("precio recalcula tarifa, impuesto, extra, suplemento y snapshot", () => {
  const travel = travels.find(
    (t) => t.departures[0].boardingOptions.length > 0,
  )!;
  const dep = travel.departures[0];
  const board = dep.boardingOptions[0];
  const priced = priceLine({
    id: "x",
    agencyId: travel.agencyId,
    travelId: travel.id,
    departureId: dep.id,
    boardingOptionId: board.id,
    pricingOptionId: travel.pricingOptions[0].id,
    travelers: 2,
    extraIds: [travel.extras[0].id],
  });
  assert.ok(priced.total >= priced.subtotal);
  assert.ok(priced.boarding.pointName);
  assert.match(
    formatMoney(priced.total, travel.basePrice.currency),
    /(MXN|USD)/,
  );
});
test("carrito bloquea mezcla de agencias y precios manipulados no forman parte del modelo", () => {
  const line = (t: (typeof travels)[number]) => ({
    id: t.id,
    agencyId: t.agencyId,
    travelId: t.id,
    departureId: t.departures[0].id,
    boardingOptionId: t.departures[0].boardingOptions[0].id,
    pricingOptionId: t.pricingOptions[0].id,
    travelers: 1,
    extraIds: [],
  });
  assert.throws(
    () => validateCart([line(travels[0]), line(travels[4])]),
    /mezclar agencias/,
  );
  assert.equal("price" in line(travels[0]), false);
});
test("punto de otra salida y punto agotado se rechazan", () => {
  const t = travels[0];
  const invalid = {
    id: "bad",
    agencyId: t.agencyId,
    travelId: t.id,
    departureId: t.departures[0].id,
    boardingOptionId: "otro",
    pricingOptionId: t.pricingOptions[0].id,
    travelers: 1,
    extraIds: [],
  };
  assert.throws(() => priceLine(invalid), /punto/);
});

const pendingLine = (): CartLine => {
  const travel = travels[0];
  return {
    id: "pending",
    agencyId: travel.agencyId,
    travelId: travel.id,
    departureId: travel.departures[0].id,
    boardingOptionId: null,
    pricingOptionId: travel.pricingOptions[0].id,
    travelers: 2,
    extraIds: [],
  };
};
test("no se asigna automáticamente el primer punto", () => {
  const line = pendingLine();
  assert.equal(line.boardingOptionId, null);
  assert.doesNotThrow(() => priceLinePending(line));
});
test("no se puede cotizar definitivamente sin confirmar abordaje", () => {
  assert.throws(() => priceLine(pendingLine()), /seleccionar y confirmar/);
});
test("un único punto se muestra pero requiere confirmación explícita", () => {
  const line = pendingLine();
  const travel = travels.find((item) => item.id === line.travelId)!;
  assert.equal(
    travel.departures.find((item) => item.id === line.departureId)!
      .boardingOptions.length,
    1,
  );
  assert.equal(line.boardingOptionId, null);
});
test("una salida sin puntos bloquea la confirmación en línea", () => {
  const travel = travels.find(
    (item) => item.title === "Santuario de Mariposas",
  )!;
  const departure = travel.departures.find(
    (item) => item.boardingOptions.length === 0,
  )!;
  const line: CartLine = {
    id: "none",
    agencyId: travel.agencyId,
    travelId: travel.id,
    departureId: departure.id,
    boardingOptionId: null,
    pricingOptionId: travel.pricingOptions[0].id,
    travelers: 1,
    extraIds: [],
  };
  assert.throws(
    () => confirmBoardingPoint(line, "inexistente"),
    /no es válido/,
  );
  assert.throws(() => priceLine(line), /seleccionar y confirmar/);
});
test("varios puntos permiten elegir exactamente uno", () => {
  const travel = travels.find(
    (item) =>
      item.agencyId === agencies[0].id &&
      item.departures.some((departure) => departure.boardingOptions.length > 1),
  )!;
  const departure = travel.departures.find(
    (item) => item.boardingOptions.length > 1,
  )!;
  const line: CartLine = {
    id: "multi",
    agencyId: travel.agencyId,
    travelId: travel.id,
    departureId: departure.id,
    boardingOptionId: null,
    pricingOptionId: travel.pricingOptions[0].id,
    travelers: 1,
    extraIds: [],
  };
  const selected = confirmBoardingPoint(line, departure.boardingOptions[1].id);
  assert.equal(selected.boardingOptionId, departure.boardingOptions[1].id);
});
test("cambiar de salida invalida un punto incompatible", () => {
  const travel = travels.find(
    (item) =>
      item.departures.length > 1 && item.departures[0].boardingOptions.length,
  )!;
  const selected = confirmBoardingPoint(
    {
      ...pendingLine(),
      travelId: travel.id,
      agencyId: travel.agencyId,
      departureId: travel.departures[0].id,
      pricingOptionId: travel.pricingOptions[0].id,
    },
    travel.departures[0].boardingOptions[0].id,
  );
  assert.throws(
    () =>
      confirmBoardingPoint(
        {
          ...selected,
          departureId: travel.departures[1].id,
          boardingOptionId: null,
          boardingSnapshot: undefined,
        },
        selected.boardingOptionId!,
      ),
    /no es válido/,
  );
});
test("el suplemento respeta modalidad por reserva o persona", () => {
  const travel = travels.find((item) =>
    item.departures.some((departure) =>
      departure.boardingOptions.some((option) => option.surchargeAmount),
    ),
  )!;
  const departure = travel.departures.find((item) =>
    item.boardingOptions.some((option) => option.surchargeAmount),
  )!;
  const option = departure.boardingOptions.find(
    (item) => item.surchargeAmount,
  )!;
  const line: CartLine = {
    id: "surcharge",
    agencyId: travel.agencyId,
    travelId: travel.id,
    departureId: departure.id,
    boardingOptionId: option.id,
    pricingOptionId: travel.pricingOptions[0].id,
    travelers: 3,
    extraIds: [],
  };
  const priced = priceLine(line);
  assert.equal(
    priced.surcharge,
    (option.surchargeAmount ?? 0) *
      (option.surchargeType === "per_booking" ? 1 : 3),
  );
  assert.equal(
    priced.total,
    priced.subtotal + priced.taxes + priced.extrasTotal + priced.surcharge,
  );
});
test("la selección guarda un snapshot completo", () => {
  const line = pendingLine();
  const travel = travels.find((item) => item.id === line.travelId)!;
  const option = travel.departures[0].boardingOptions[0];
  const selected = confirmBoardingPoint(line, option.id);
  const point = departurePoints.find(
    (item) => item.id === option.agencyDeparturePointId,
  )!;
  assert.equal(selected.boardingSnapshot?.boardingPointId, point.id);
  assert.equal(selected.boardingSnapshot?.pointName, point.name);
  assert.equal(selected.boardingSnapshot?.meetingTime, option.meetingTime);
});
test("WhatsApp incluye el punto después de seleccionarlo", () => {
  const line = pendingLine();
  const travel = travels.find((item) => item.id === line.travelId)!;
  const priced = priceLine(
    confirmBoardingPoint(line, travel.departures[0].boardingOptions[0].id),
  );
  const message = decodeURIComponent(
    whatsappUrl(agencies[0], priced).split("text=")[1],
  );
  assert.match(message, /Punto de abordaje:/);
  assert.match(message, new RegExp(priced.boarding.pointName));
});
test("el resumen de confirmación conserva punto, hora y dirección", () => {
  const line = pendingLine();
  const travel = travels.find((item) => item.id === line.travelId)!;
  const priced = priceLine(
    confirmBoardingPoint(line, travel.departures[0].boardingOptions[0].id),
  );
  assert.ok(priced.boarding.pointName);
  assert.ok(priced.boarding.meetingTime);
  assert.ok(priced.boarding.reference ?? priced.boarding.address);
});

test("slider móvil cambia de slide y conserva navegación circular", () => {
  assert.equal(explorerSlideIndex(0, 1, 4), 1);
  assert.equal(explorerSlideIndex(3, 1, 4), 0);
  assert.equal(explorerSlideIndex(0, -1, 4), 3);
});
test("controles del slider tienen nombres accesibles", () => {
  assert.equal(EXPLORER_SLIDER_LABELS.previous, "Viaje anterior");
  assert.equal(EXPLORER_SLIDER_LABELS.next, "Viaje siguiente");
});
test("viaje sin hospedaje no requiere ni guarda ocupación", () => {
  const trip = travels.find(
    (item) =>
      item.agencyId === agencies[0].id && item.accommodationMode === "none",
  )!;
  assert.equal(explorerAdultRateOccupancy(trip, 2), "general");
  assert.equal(explorerBookingOccupancy(trip, 2), undefined);
});
test("WhatsApp omite base para viaje sin hospedaje", () => {
  const trip = travels.find(
    (item) =>
      item.agencyId === agencies[0].id && item.accommodationMode === "none",
  )!;
  const message = explorerBookingMessage({
    agencyName: agencies[0].name,
    trip,
    departureLabel: "9 de agosto",
    adults: 2,
    children: 1,
    occupancyLabel: "Doble",
    totalLabel: "$3,000 MXN",
    depositLabel: "$900 MXN",
    url: "https://travel.fu.land/demo",
  });
  assert.doesNotMatch(message, /Base de ocupación/);
});
test("viaje con hospedaje conserva base automática", () => {
  const trip = travels.find(
    (item) =>
      item.agencyId === agencies[0].id &&
      item.accommodationMode === "hotel_occupancy",
  )!;
  assert.equal(explorerBookingOccupancy(trip, 1), "single");
  assert.equal(explorerBookingOccupancy(trip, 2), "double");
  assert.equal(explorerBookingOccupancy(trip, 3), "triple");
  assert.equal(explorerBookingOccupancy(trip, 4), "quadruple");
});
test("tarifas de un día muestran categorías de viajero", () => {
  const trip = travels.find(
    (item) =>
      item.agencyId === agencies[0].id && item.accommodationMode === "none",
  )!;
  assert.deepEqual(
    [...explorerVisibleRateOccupancies(trip)],
    ["general", "child", "infant"],
  );
  assert.ok(trip.pricingOptions.some((rate) => rate.occupancy === "general"));
  assert.ok(
    !trip.pricingOptions.some((rate) =>
      ["single", "double", "triple", "quadruple"].includes(rate.occupancy),
    ),
  );
});
test("total de viaje de un día usa tarifas adulto y menor", () => {
  const trip = travels.find(
    (item) =>
      item.agencyId === agencies[0].id && item.accommodationMode === "none",
  )!;
  const departure = trip.departures[0];
  const adult = trip.pricingOptions.find(
    (rate) => rate.occupancy === "general",
  )!;
  const child = trip.pricingOptions.find((rate) => rate.occupancy === "child")!;
  const adultPrice = priceLinePending({
    id: "day-adult",
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: departure.id,
    boardingOptionId: null,
    pricingOptionId: adult.id,
    travelers: 2,
    extraIds: [],
  });
  const childPrice = priceLinePending({
    id: "day-child",
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: departure.id,
    boardingOptionId: null,
    pricingOptionId: child.id,
    travelers: 1,
    extraIds: [],
  });
  assert.equal(
    adultPrice.subtotal + childPrice.subtotal,
    adult.amount * 2 + child.amount,
  );
});
test("submenú Explorer usa offsets de header documentados", () => {
  assert.deepEqual(EXPLORER_STICKY_METRICS, {
    desktopHeader: 88,
    mobileHeader: 68,
    detailNav: 58,
    anchorGap: 16,
  });
});
test("panel de reserva conserva contraste semántico", () => {
  assert.equal(EXPLORER_BOOKING_COLORS.text, "#ffffff");
  assert.notEqual(
    EXPLORER_BOOKING_COLORS.background,
    EXPLORER_BOOKING_COLORS.text,
  );
  assert.notEqual(
    EXPLORER_BOOKING_COLORS.surface,
    EXPLORER_BOOKING_COLORS.text,
  );
});
test("capacidad de habitación usa fallback global de 4", () => {
  assert.equal(DEFAULT_ROOM_CAPACITY_POLICY.defaultMaxGuestsPerRoom, 4);
  assert.equal(getRoomCapacity({}), 4);
});
test("capacidad respeta prioridad agencia, viaje y tarifa", () => {
  assert.equal(getRoomCapacity({ agencyMax: 5 }), 5);
  assert.equal(getRoomCapacity({ agencyMax: 5, tripMax: 3 }), 3);
  assert.equal(getRoomCapacity({ agencyMax: 5, tripMax: 3, rateMax: 2 }), 2);
});
test("Furiver configura capacidad por agencia", () => {
  const furiver = agencies.find((item) => item.slug === "furiver")!;
  assert.equal(furiver.settings.roomCapacityPolicy?.defaultMaxGuestsPerRoom, 4);
  assert.equal(furiver.settings.roomCapacityPolicy?.allowMultipleRooms, false);
});
test("override por viaje y tarifa se resuelve sin alterar la agencia", () => {
  const agency = agencies.find((item) => item.slug === "furiver")!;
  const trip = travels.find(
    (item) =>
      item.agencyId === agency.id &&
      item.accommodationMode === "hotel_occupancy",
  )!;
  const policy = resolveRoomCapacityPolicy(
    agency,
    {
      ...trip,
      roomCapacityPolicy: {
        ...DEFAULT_ROOM_CAPACITY_POLICY,
        defaultMaxGuestsPerRoom: 3,
      },
    },
    { ...trip.pricingOptions[0], maxGuestsPerRoom: 2 },
  );
  assert.equal(policy.defaultMaxGuestsPerRoom, 2);
  assert.equal(agency.settings.roomCapacityPolicy?.defaultMaxGuestsPerRoom, 4);
});
test("2 adultos y 2 menores caben; 2 adultos y 3 menores exceden", () => {
  assert.equal(
    validateRoomCapacity({
      adults: 2,
      minors: 2,
      maxGuestsPerRoom: 4,
      minorCountsTowardCapacity: true,
      infantCountsTowardCapacity: false,
    }).valid,
    true,
  );
  const invalid = validateRoomCapacity({
    adults: 2,
    minors: 3,
    maxGuestsPerRoom: 4,
    minorCountsTowardCapacity: true,
    infantCountsTowardCapacity: false,
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.excessGuests, 1);
});
test("menores cuentan para capacidad pero no cambian la base", () => {
  const trip = travels.find(
    (item) =>
      item.agencyId === agencies[0].id &&
      item.accommodationMode === "hotel_occupancy",
  )!;
  assert.equal(explorerBookingOccupancy(trip, 1), "single");
  assert.equal(
    validateRoomCapacity({
      adults: 1,
      minors: 3,
      maxGuestsPerRoom: 4,
      minorCountsTowardCapacity: true,
      infantCountsTowardCapacity: false,
    }).valid,
    true,
  );
  assert.equal(explorerBookingOccupancy(trip, 3), "triple");
  assert.equal(
    validateRoomCapacity({
      adults: 3,
      minors: 1,
      maxGuestsPerRoom: 4,
      minorCountsTowardCapacity: true,
      infantCountsTowardCapacity: false,
    }).valid,
    true,
  );
  assert.equal(
    validateRoomCapacity({
      adults: 4,
      minors: 1,
      maxGuestsPerRoom: 4,
      minorCountsTowardCapacity: true,
      infantCountsTowardCapacity: false,
    }).valid,
    false,
  );
});
test("viajes sin hospedaje ignoran la capacidad en carrito", () => {
  const trip = travels.find(
    (item) =>
      item.agencyId === agencies[0].id && item.accommodationMode === "none",
  )!;
  const rate = trip.pricingOptions.find(
    (item) => item.occupancy === "general",
  )!;
  const line: CartLine = {
    id: "day-many",
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: trip.departures[0].id,
    boardingOptionId: null,
    pricingOptionId: rate.id,
    travelers: 7,
    extraIds: [],
  };
  assert.doesNotThrow(() => validateCartRoomCapacity([line]));
});
const hotelCapacityLines = (children: number): CartLine[] => {
  const trip = travels.find(
    (item) =>
      item.agencyId === agencies[0].id &&
      item.accommodationMode === "hotel_occupancy" &&
      item.pricingOptions.some((rate) => rate.occupancy === "double") &&
      item.pricingOptions.some((rate) => rate.occupancy === "child"),
  )!;
  const adult = trip.pricingOptions.find(
    (rate) => rate.occupancy === "double",
  )!;
  const child = trip.pricingOptions.find((rate) => rate.occupancy === "child")!;
  return [
    {
      id: "hotel-adults",
      agencyId: trip.agencyId,
      travelId: trip.id,
      departureId: trip.departures[0].id,
      boardingOptionId: null,
      pricingOptionId: adult.id,
      travelers: 2,
      extraIds: [],
    },
    {
      id: "hotel-minors",
      agencyId: trip.agencyId,
      travelId: trip.id,
      departureId: trip.departures[0].id,
      boardingOptionId: null,
      pricingOptionId: child.id,
      travelers: children,
      extraIds: [],
    },
  ];
};
test("carrito y checkout defensivos rechazan ocupación inválida", () => {
  assert.doesNotThrow(() => validateCartRoomCapacity(hotelCapacityLines(2)));
  assert.throws(
    () => validateCartRoomCapacity(hotelCapacityLines(3)),
    /excede la capacidad máxima/,
  );
  assert.throws(
    () => validateCart(hotelCapacityLines(3)),
    /excede la capacidad máxima/,
  );
});
test("estado inválido permite bloquear CTA con valores configurados", () => {
  const result = validateRoomCapacity({
    adults: 2,
    minors: 3,
    maxGuestsPerRoom: 4,
    minorCountsTowardCapacity: true,
    infantCountsTowardCapacity: false,
  });
  const canReserve = result.valid;
  assert.equal(canReserve, false);
  assert.equal(result.totalCountedGuests, 5);
});
test("WhatsApp solicita más habitaciones cuando se excede capacidad", () => {
  const trip = travels.find(
    (item) =>
      item.agencyId === agencies[0].id &&
      item.accommodationMode === "hotel_occupancy",
  )!;
  const message = explorerBookingMessage({
    agencyName: agencies[0].name,
    trip,
    departureLabel: "9 de agosto",
    adults: 2,
    children: 3,
    occupancyLabel: "Doble",
    totalLabel: "Por confirmar",
    depositLabel: "Por confirmar",
    url: "https://travel.fu.land/demo",
    roomCapacity: { exceeded: true, maxGuestsPerRoom: 4, totalGuests: 5 },
  });
  assert.match(message, /Total de personas: 5/);
  assert.match(message, /Capacidad máxima por habitación: 4/);
  assert.match(message, /distribución en más habitaciones/);
});
test("3 adultos y 1 menor generan cuatro formularios con secuencias correctas", () => {
  const drafts = createTravelerDrafts(3, 1, "demo");
  assert.equal(drafts.length, 4);
  assert.deepEqual(
    drafts.map(({ category, sequence }) => ({ category, sequence })),
    [
      { category: "adult", sequence: 1 },
      { category: "adult", sequence: 2 },
      { category: "adult", sequence: 3 },
      { category: "minor", sequence: 1 },
    ],
  );
});
test("Completar ahora exige nombre completo para cada viajero", () => {
  const drafts = createTravelerDrafts(2, 1);
  assert.equal(validateTravelerDrafts(drafts, "complete").valid, false);
  const complete = drafts.map((draft) => ({
    ...draft,
    fullName: `${draft.category} ${draft.sequence}`,
    completionStatus: "complete" as const,
  }));
  assert.equal(validateTravelerDrafts(complete, "complete").valid, true);
});
test("Llenar después permite continuar y conserva estado pendiente", () => {
  const drafts = createTravelerDrafts(2, 2);
  assert.equal(validateTravelerDrafts(drafts, "pending").valid, true);
  assert.ok(drafts.every((draft) => draft.completionStatus === "pending"));
});
test("mensaje de seguimiento utiliza la agencia activa", () => {
  assert.match(
    travelerFollowUpMessage(agencies[0]),
    new RegExp(agencies[0].name),
  );
});
test("resumen pendiente no inventa nombres", () => {
  const drafts = createTravelerDrafts(2, 1);
  const summary = travelerWhatsAppSummary("pending", drafts);
  assert.equal(summary, "Datos de viajeros: pendientes de completar.");
  assert.doesNotMatch(summary, /Viajero \d/);
});
test("reducir viajeros conserva datos hasta recibir confirmación", () => {
  const drafts: TravelerDraft[] = createTravelerDrafts(3, 0).map(
    (draft, index) => ({
      ...draft,
      fullName: index === 2 ? "Persona con datos" : "",
      completionStatus: index === 2 ? "complete" : "pending",
    }),
  );
  const blocked = reconcileTravelerDrafts({ drafts, adults: 2, minors: 0 });
  assert.equal(blocked.requiresConfirmation, true);
  assert.equal(blocked.drafts.length, 3);
  const confirmed = reconcileTravelerDrafts({
    drafts,
    adults: 2,
    minors: 0,
    confirmDiscard: true,
  });
  assert.equal(confirmed.requiresConfirmation, false);
  assert.equal(confirmed.drafts.length, 2);
});
test("carrito persistente conserva borradores y estado", () => {
  const line = {
    ...pendingLine(),
    travelerDataStatus: "pending" as const,
    travelerDrafts: createTravelerDrafts(2, 0, "persist"),
  };
  assert.deepEqual(JSON.parse(JSON.stringify(line)), line);
});
test("WhatsApp distingue datos completos y pendientes", () => {
  const drafts = createTravelerDrafts(1, 1).map((draft) => ({
    ...draft,
    fullName: draft.category === "adult" ? "Ana Pérez" : "Leo Pérez",
    completionStatus: "complete" as const,
  }));
  assert.match(travelerWhatsAppSummary("complete", drafts), /Ana Pérez/);
  assert.match(travelerWhatsAppSummary("pending", drafts), /pendientes/);
});
test("redes sociales solo aceptan URLs HTTPS válidas", () => {
  assert.equal(isValidSocialUrl("https://social.example/furiver"), true);
  assert.equal(isValidSocialUrl("http://social.example/furiver"), false);
  assert.equal(isValidSocialUrl("javascript:alert(1)"), false);
  assert.equal(isValidSocialUrl("perfil-sin-protocolo"), false);
});
test("redes Explorer respetan activación, orden y ubicación", () => {
  const furiver = agencies.find((item) => item.slug === "furiver")!;
  assert.deepEqual(
    getAgencySocialLinks(furiver, "header").map((link) => link.network),
    ["facebook", "instagram"],
  );
  assert.deepEqual(
    getAgencySocialLinks(furiver, "footer").map((link) => link.network),
    ["facebook", "instagram", "youtube"],
  );
  assert.ok(
    getAgencySocialLinks(furiver, "footer").every((link) => link.enabled),
  );
});
test("Lavella usa renderers visuales propios y no monta panel Explorer", () => {
  const detail = readFileSync(
    "components/themes/lavella/lavella-trip-detail.tsx",
    "utf8",
  );
  const booking = readFileSync(
    "components/themes/lavella/lavella-booking-panel.tsx",
    "utf8",
  );
  assert.match(detail, /LavellaTripHero/);
  assert.match(detail, /LavellaTripSections/);
  assert.doesNotMatch(detail + booking, /ExplorerBookingPanel/);
});

test("Lavella registra home, catálogo y detalle independientes", () => {
  const theme = readFileSync(
    "components/themes/lavella/lavella-theme.tsx",
    "utf8",
  );
  assert.match(theme, /LavellaHome/);
  assert.match(theme, /LavellaCatalog/);
  assert.match(theme, /LavellaTripDetail/);
});

test("los estilos Lavella no se importan como hoja global del layout", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const commerce = readFileSync("app/themes/lavella-commerce.css", "utf8");
  assert.doesNotMatch(layout, /lavella\.css/);
  assert.match(commerce, /^\.lavella-commerce/m);
  assert.doesNotMatch(commerce, /(^|\n)\s*\.(container|row|col|header|button|title|active)\b/m);
});

test("Lavella no carga scripts heredados del template", () => {
  const files = [
    "components/themes/lavella/lavella-home-hero.tsx",
    "components/themes/lavella/lavella-mobile-menu.tsx",
    "components/themes/lavella/lavella-trip-sections.tsx",
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(files, /jquery|slick\(|lightGallery|dangerouslySetInnerHTML/i);
});

test("detalle Lavella no depende de SharedDetail ni de markup Explorer", () => {
  const files = [
    "lavella-trip-detail.tsx",
    "lavella-trip-hero.tsx",
    "lavella-trip-gallery.tsx",
    "lavella-trip-sections.tsx",
    "lavella-booking-panel.tsx",
  ]
    .map((name) =>
      readFileSync(`components/themes/lavella/${name}`, "utf8"),
    )
    .join("\n");
  assert.doesNotMatch(files, /SharedDetail|ExplorerBookingPanel|className=["'`]explorer-/);
  assert.match(files, /LavellaTripGallery/);
  assert.match(files, /LavellaBookingPanel/);
});

test("reserva móvil Lavella incluye barra y bottom sheet propios", () => {
  const booking = readFileSync(
    "components/themes/lavella/lavella-booking-panel.tsx",
    "utf8",
  );
  assert.match(booking, /mobileBookingBar/);
  assert.match(booking, /bookingSheet/);
  assert.match(booking, /IntersectionObserver/);
  assert.match(booking, /aria-modal="true"/);
});

test("detalle Lavella conserva tenant y tema al iniciar carrito", () => {
  assert.equal(
    lavellaCartHref("?tenant=furiver&theme=explorer", "furiver"),
    "/carrito?tenant=furiver&theme=lavella",
  );
});

test("CSS de detalle Lavella permanece aislado de home y otros temas", () => {
  const detailCss = readFileSync(
    "components/themes/lavella/lavella-detail.module.css",
    "utf8",
  );
  const bookingCss = readFileSync(
    "components/themes/lavella/lavella-booking.module.css",
    "utf8",
  );
  const removedClassFragments = [
    ["bou", "tique"].join(""),
    ["market", "place"].join(""),
  ];
  assert.doesNotMatch(detailCss + bookingCss, /\.explorer-/);
  for (const fragment of removedClassFragments) {
    assert.equal((detailCss + bookingCss).includes(`.${fragment}-`), false);
  }
  assert.doesNotMatch(detailCss + bookingCss, /\.home\b|\.catalog\b/);
});

const sourcedTripIds = [
  "crisenix-muralla-china-mexicana",
  "crisenix-guadalajara-mariachi",
  "crisenix-playas-riscos-veracruz",
  "crisenix-costas-oaxaca",
  "crisenix-velada-astronomica-vip",
  "crisenix-chepe-premier",
  "crisenix-patagonia-fin-del-mundo",
] as const;

const sourcedTrips = () =>
  sourcedTripIds.map(
    (id) => travels.find((trip) => trip.id === id)!,
  );

const patagonia = () =>
  travels.find(
    (trip) => trip.id === "crisenix-patagonia-fin-del-mundo",
  )!;

const crisenixFxPolicy = () =>
  agencies.find((agency) => agency.id === "a-crisenix")!.settings
    .exchangeRatePolicy!;

test("flecha izquierda Lavella retrocede y flecha derecha avanza", () => {
  assert.equal(lavellaSlideIndex(1, -1, 4), 0);
  assert.equal(lavellaSlideIndex(1, 1, 4), 2);
  assert.equal(lavellaSlideIndex(0, -1, 4), 3);
  assert.equal(lavellaSlideIndex(3, 1, 4), 0);
});

test("siguiente del hero Lavella usa dirección next", () => {
  const hero = readFileSync(
    "components/themes/lavella/lavella-home-hero.tsx",
    "utf8",
  );
  assert.match(hero, /setDirection\(step < 0 \? "previous" : "next"\)/);
  assert.match(hero, /onClick=\{\(\) => move\(1\)\}/);
});

test("anterior del hero Lavella usa dirección previous", () => {
  const hero = readFileSync(
    "components/themes/lavella/lavella-home-hero.tsx",
    "utf8",
  );
  assert.match(hero, /onClick=\{\(\) => move\(-1\)\}/);
  assert.match(hero, /styles\.heroSlideExitRight/);
  assert.match(hero, /styles\.heroSlideEnterLeft/);
});

test("autoplay y wrap 04 a 01 del hero Lavella usan next", () => {
  const hero = readFileSync(
    "components/themes/lavella/lavella-home-hero.tsx",
    "utf8",
  );
  assert.match(hero, /startLavellaAutoplay\(\s*\(\) => changeSlide\(1\)/);
  assert.equal(lavellaSlideIndex(3, 1, 4), 0);
  assert.match(hero, /styles\.heroSlideExitLeft/);
  assert.match(hero, /styles\.heroSlideEnterRight/);
});

test("reduced motion evita la animación horizontal Lavella", () => {
  const hero = readFileSync(
    "components/themes/lavella/lavella-home-hero.tsx",
    "utf8",
  );
  const css = readFileSync(
    "components/themes/lavella/lavella-home.module.css",
    "utf8",
  );
  assert.match(hero, /if \(!reducedMotion\)/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.heroSlide,[\s\S]*transition: none;/,
  );
});

test("controles Lavella tienen labels inequívocos y SVG compartido", () => {
  const hero = readFileSync(
    "components/themes/lavella/lavella-home-hero.tsx",
    "utf8",
  );
  assert.match(hero, /aria-label="Mostrar viaje anterior"/);
  assert.match(hero, /aria-label="Mostrar siguiente viaje"/);
  assert.match(hero, /LavellaArrowIcon direction="previous"/);
  assert.match(hero, /LavellaArrowIcon direction="next"/);
  assert.doesNotMatch(hero, />\s*[<>]\s*</);
});

test("flechas Lavella usan una estructura de centrado estable", () => {
  const homeCss = readFileSync(
    "components/themes/lavella/lavella-home.module.css",
    "utf8",
  );
  const arrowCss = readFileSync(
    "components/themes/lavella/lavella-arrow-icon.module.css",
    "utf8",
  );
  assert.match(homeCss, /\.heroArrow \{[\s\S]*display: inline-grid;[\s\S]*place-items: center;/);
  assert.match(arrowCss, /\.container \{[\s\S]*display: inline-grid;[\s\S]*place-items: center;[\s\S]*padding: 0;[\s\S]*line-height: 0;/);
  assert.match(arrowCss, /\.container svg \{[\s\S]*display: block;[\s\S]*width: 18px;[\s\S]*height: 18px;/);
  assert.doesNotMatch(arrowCss, /translate[XY]\(/);
});

test("autoplay Lavella usa 5000, transición 650 y reanudación 7000", () => {
  assert.equal(LAVELLA_SLIDER_TIMING.autoplayDelayMs, 5000);
  assert.equal(LAVELLA_SLIDER_TIMING.transitionDurationMs, 650);
  assert.equal(LAVELLA_SLIDER_TIMING.resumeAfterInteractionMs, 7000);
});

test("autoplay Lavella avanza y una sola slide no lo activa", () => {
  assert.equal(lavellaSlideIndex(0, 1, 4), 1);
  assert.equal(
    canLavellaAutoplay({
      autoplay: true,
      slideCount: 4,
      pauseReasons: new Set(),
    }),
    true,
  );
  assert.equal(
    canLavellaAutoplay({
      autoplay: true,
      slideCount: 1,
      pauseReasons: new Set(),
    }),
    false,
  );
});

test("hero Lavella inicia autoplay sin interacción en WebKit móvil", () => {
  const noInitialPause = new Set<SliderPauseReason>();
  assert.equal(
    canLavellaAutoplay({
      autoplay: true,
      slideCount: 4,
      pauseReasons: noInitialPause,
    }),
    true,
  );
  let legacyListener: (() => void) | undefined;
  let removed = false;
  const legacyMedia = {
    matches: false,
    addListener: (listener: () => void) => {
      legacyListener = listener;
    },
    removeListener: (listener: () => void) => {
      removed = listener === legacyListener;
    },
  } as unknown as MediaQueryList;
  const unsubscribe = subscribeLavellaMediaQuery(legacyMedia, () => undefined);
  assert.equal(typeof legacyListener, "function");
  unsubscribe();
  assert.equal(removed, true);
});

test("hero Lavella avanza dos veces antes de doce segundos", () => {
  assert.ok(LAVELLA_SLIDER_TIMING.autoplayDelayMs * 2 < 12000);
  const firstAdvance = lavellaSlideIndex(0, 1, 4);
  assert.equal(firstAdvance, 1);
  assert.equal(lavellaSlideIndex(firstAdvance, 1, 4), 2);
});

test("interacción pausa y después permite reanudar autoplay Lavella", () => {
  const paused = updateLavellaPauseReasons(
    new Set<SliderPauseReason>(),
    "interaction",
    true,
  );
  assert.equal(
    canLavellaAutoplay({ autoplay: true, slideCount: 4, pauseReasons: paused }),
    false,
  );
  const resumed = updateLavellaPauseReasons(paused, "interaction", false);
  assert.equal(
    canLavellaAutoplay({ autoplay: true, slideCount: 4, pauseReasons: resumed }),
    true,
  );
});

test("hover no pausa autoplay Lavella en dispositivos táctiles", () => {
  const touchHover = updateLavellaHoverPause(
    new Set<SliderPauseReason>(),
    true,
    false,
  );
  assert.equal(touchHover.has("hover"), false);
  assert.equal(
    canLavellaAutoplay({
      autoplay: true,
      slideCount: 4,
      pauseReasons: touchHover,
    }),
    true,
  );
  const mouseHover = updateLavellaHoverPause(
    new Set<SliderPauseReason>(),
    true,
    true,
  );
  assert.equal(mouseHover.has("hover"), true);
});

test("visibilidad de pestaña pausa y reanuda autoplay Lavella", () => {
  const hidden = updateLavellaPauseReasons(
    new Set<SliderPauseReason>(),
    "hidden",
    true,
  );
  assert.equal(hidden.has("hidden"), true);
  const visible = updateLavellaPauseReasons(hidden, "hidden", false);
  assert.equal(visible.size, 0);
});

test("reduced motion desactiva autoplay Lavella", () => {
  const reduced = updateLavellaPauseReasons(
    new Set<SliderPauseReason>(),
    "reduced-motion",
    true,
  );
  assert.equal(
    canLavellaAutoplay({
      autoplay: true,
      slideCount: 4,
      pauseReasons: reduced,
    }),
    false,
  );
});

test("slider Lavella mantiene un solo intervalo y limpia ambos timers", () => {
  const hero = readFileSync(
    "components/themes/lavella/lavella-home-hero.tsx",
    "utf8",
  );
  assert.equal((hero.match(/setInterval\(/g) ?? []).length, 1);
  assert.match(hero, /clearInterval/);
  assert.match(hero, /setTimeout/);
  assert.match(hero, /clearTimeout/);
  assert.match(hero, /visibilitychange/);
  assert.match(hero, /prefers-reduced-motion/);
  assert.match(hero, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(hero, /keyboardNavigation\.current &&/);
  assert.match(hero, /onPointerMove/);
  assert.doesNotMatch(hero, /onMouseEnter/);
});

test("flechas de carruseles y lupa conservan centrado y submit", () => {
  const home = readFileSync(
    "components/themes/lavella/lavella-home.tsx",
    "utf8",
  );
  const search = readFileSync(
    "components/themes/lavella/lavella-search-box.tsx",
    "utf8",
  );
  const css = readFileSync(
    "components/themes/lavella/lavella-home.module.css",
    "utf8",
  );
  const arrowCss = readFileSync(
    "components/themes/lavella/lavella-arrow-icon.module.css",
    "utf8",
  );
  assert.equal((home.match(/className=\{styles\.carouselArrowButton\}/g) ?? []).length, 4);
  assert.match(
    css,
    /\.carouselArrowButton[\s\S]*display: inline-grid;[\s\S]*place-items: center;[\s\S]*padding: 0;[\s\S]*line-height: 0;/,
  );
  assert.match(
    arrowCss,
    /\.container svg \{[\s\S]*display: block;[\s\S]*width: 18px;[\s\S]*height: 18px;/,
  );
  assert.match(search, /className=\{styles\.searchSubmit\} type="submit"/);
  assert.match(
    css,
    /\.searchSubmit \{[\s\S]*display: inline-grid;[\s\S]*place-items: center;[\s\S]*padding: 0;[\s\S]*line-height: 0;/,
  );
});

test("flechas de Viajes populares desplazan el rail y conservan labels", () => {
  assert.equal(
    lavellaRailTarget({
      currentScroll: 83,
      maxScroll: 2200,
      itemStep: 764,
      direction: -1,
    }),
    2200,
  );
  assert.equal(
    lavellaRailTarget({
      currentScroll: 764,
      maxScroll: 2200,
      itemStep: 764,
      direction: -1,
    }),
    0,
  );
  assert.equal(
    lavellaRailTarget({
      currentScroll: 0,
      maxScroll: 2200,
      itemStep: 764,
      direction: 1,
    }),
    764,
  );
  const home = readFileSync(
    "components/themes/lavella/lavella-home.tsx",
    "utf8",
  );
  assert.match(home, /ref=\{popularRail\}/);
  assert.match(home, /aria-label="Viaje popular anterior"/);
  assert.match(home, /aria-label="Siguiente viaje popular"/);
  assert.match(home, /onClick=\{\(\) => movePopular\(-1\)\}/);
  assert.match(home, /onClick=\{\(\) => movePopular\(1\)\}/);
  assert.equal(
    (
      home.match(
        /className=\{styles\.carouselArrowButton\}[\s\S]{0,120}type="button"/g,
      ) ?? []
    ).length,
    2,
  );
});

test("slider Lavella deshabilita controles cuando solo existe una slide", () => {
  const hero = readFileSync(
    "components/themes/lavella/lavella-home-hero.tsx",
    "utf8",
  );
  assert.match(hero, /const controlsDisabled = slides\.length < 2/);
  assert.ok((hero.match(/disabled=\{controlsDisabled\}/g) ?? []).length >= 3);
});

test("destinos populares usa el carrusel proporcional de Lavella", () => {
  const home = readFileSync(
    "components/themes/lavella/lavella-home.tsx",
    "utf8",
  );
  assert.match(home, /destinationRail/);
  assert.match(home, /LavellaDestinationCard/);
  assert.match(home, /moveDestinations/);
  assert.doesNotMatch(home, /destinationMosaic/);
});

test("cards de destinos declaran superficie de imagen y tokens on-dark", () => {
  const card = readFileSync(
    "components/themes/lavella/lavella-destination-card.tsx",
    "utf8",
  );
  const css = readFileSync(
    "components/themes/lavella/lavella-home.module.css",
    "utf8",
  );
  assert.match(card, /data-lavella-surface="image"/);
  assert.match(card, /destinationImageOverlay/);
  assert.match(
    css,
    /\.destinationImage \{[\s\S]*aspect-ratio: 20 \/ 13;[\s\S]*color: var\(--lavella-text-on-dark\)/,
  );
  assert.match(
    css,
    /\.destinationImageOverlay \{[\s\S]*rgba\(0, 0, 0, \.72\)[\s\S]*rgba\(0, 0, 0, \.08\)/,
  );
  assert.match(css, /\.destinationImageCode \{[\s\S]*var\(--lavella-text-on-dark\)/);
});

test("componentes Lavella declaran superficies claras, oscuras e imagen", () => {
  const files = [
    "lavella-home.tsx",
    "lavella-header.tsx",
    "lavella-mobile-menu.tsx",
    "lavella-catalog.tsx",
    "lavella-trip-detail.tsx",
    "lavella-trip-hero.tsx",
    "lavella-booking-panel.tsx",
    "lavella-footer.tsx",
  ]
    .map((name) =>
      readFileSync(`components/themes/lavella/${name}`, "utf8"),
    )
    .join("\n");
  assert.match(files, /data-lavella-surface="light"/);
  assert.match(files, /data-lavella-surface="dark"/);
  assert.match(files, /data-lavella-surface="image"/);
});

test("viajes populares usa cuatro columnas en el viewport compatible", () => {
  const css = readFileSync(
    "components/themes/lavella/lavella-home.module.css",
    "utf8",
  );
  assert.match(
    css,
    /\.classicPopularGrid[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/,
  );
});

test("card Lavella no inventa rating ni reseñas", () => {
  const card = readFileSync(
    "components/themes/lavella/lavella-tour-card.tsx",
    "utf8",
  );
  assert.doesNotMatch(card, /reseñas|reviews|FaStar|★★★★★/i);
});

test("home Lavella solicita ocho próximas expediciones", () => {
  const home = readFileSync(
    "components/themes/lavella/lavella-home.tsx",
    "utf8",
  );
  assert.match(home, /trips\.slice\(0, 8\)/);
});

test("contador Lavella incluye únicamente filtros activos", () => {
  assert.equal(
    countLavellaActiveFilters({
      q: "playa",
      scope: "",
      region: "mexico",
      transport: "todos",
      promotion: true,
      availability: false,
      sort: "price-asc",
    }),
    3,
  );
});

test("panel de filtros Lavella abre y cierra con controles accesibles", () => {
  const catalog = readFileSync(
    "components/themes/lavella/lavella-catalog.tsx",
    "utf8",
  );
  assert.match(catalog, /setFilterPanelOpen\(\(open\) => !open\)/);
  assert.match(catalog, /aria-expanded=\{filterPanelOpen\}/);
  assert.match(catalog, /aria-label="Cerrar filtros"/);
  assert.match(catalog, /event\.key === "Escape"/);
});

test("limpiar filtros Lavella conserva solo el ordenamiento", () => {
  assert.deepEqual(
    clearLavellaCatalogFilters({
      q: "Europa",
      region: "europe",
      promotion: true,
      sort: "duration",
    }),
    { sort: "duration" },
  );
});

test("catálogo Lavella conserva tenant y tema mediante navegación compartida", () => {
  const catalog = readFileSync(
    "components/themes/lavella/lavella-catalog.tsx",
    "utf8",
  );
  const app = readFileSync("components/travel-app.tsx", "utf8");
  assert.match(catalog, /<LavellaTourCard[\s\S]*onOpen=\{onOpen\}/);
  assert.doesNotMatch(catalog, /history\.(?:pushState|replaceState)/);
  assert.match(
    app,
    /new URLSearchParams\(\{ tenant: agency\.slug, theme \}\)/,
  );
});

test("Ordenar no cuenta como filtro Lavella", () => {
  assert.equal(countLavellaActiveFilters({ sort: "price-desc" }), 0);
  assert.equal(countLavellaActiveFilters({ sort: "duration", q: " " }), 0);
});

test("catálogo Lavella reutiliza la card compacta de Próximas expediciones", () => {
  const catalog = readFileSync(
    "components/themes/lavella/lavella-catalog.tsx",
    "utf8",
  );
  assert.match(catalog, /<LavellaTourCard[\s\S]*variant="classic"/);
  assert.doesNotMatch(catalog, /LavellaCatalogCard/);
});

test("configuración Lavella acepta tres o cuatro columnas y usa cuatro por defecto", () => {
  const agency = structuredClone(agencies[0]);
  const admin = readFileSync("components/legacy-travel-app.tsx", "utf8");
  assert.deepEqual(LAVELLA_CATALOG_COLUMN_OPTIONS, [3, 4]);
  assert.equal(resolveLavellaCatalogColumns(agency), 4);
  agency.settings.lavella = { catalogColumns: 3 };
  assert.equal(resolveLavellaCatalogColumns(agency), 3);
  agency.settings.lavella = { catalogColumns: 4 };
  assert.equal(resolveLavellaCatalogColumns(agency), 4);
  assert.match(admin, /Columnas del catálogo/);
  assert.match(admin, /LAVELLA_CATALOG_COLUMN_OPTIONS\.map/);
});

test("grid compacto del catálogo conserva una columna en móvil", () => {
  const css = readFileSync(
    "components/themes/lavella/lavella-catalog.module.css",
    "utf8",
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*\.resultsGrid,[\s\S]*grid-template-columns: 1fr/,
  );
});

test("sidebar Lavella es sticky en escritorio con altura de viewport", () => {
  const css = readFileSync(
    "components/themes/lavella/lavella-catalog.module.css",
    "utf8",
  );
  assert.match(css, /\.sidebar \{[\s\S]*position: sticky/);
  assert.match(css, /max-height: calc\(100dvh/);
  assert.match(css, /align-self: start/);
});

test("sidebar Lavella solo usa fixed dentro del breakpoint móvil", () => {
  const css = readFileSync(
    "components/themes/lavella/lavella-catalog.module.css",
    "utf8",
  );
  const desktop = css.slice(0, css.indexOf("@media (max-width: 1000px)"));
  const mobile = css.slice(css.indexOf("@media (max-width: 1000px)"));
  assert.doesNotMatch(desktop, /\.sidebar \{[\s\S]*position: fixed/);
  assert.match(mobile, /\.sidebar \{[\s\S]*position: fixed/);
});

test("detalle Lavella elimina la franja de introducción previa al submenú", () => {
  const detail = readFileSync(
    "components/themes/lavella/lavella-trip-detail.tsx",
    "utf8",
  );
  assert.doesNotMatch(detail, /styles\.introduction/);
});

test("hero de detalle separa contenido editorial y oferta comercial", () => {
  const css = readFileSync(
    "components/themes/lavella/lavella-detail.module.css",
    "utf8",
  );
  assert.match(
    css,
    /\.tripHeroRow[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(300px, 370px\)/,
  );
  assert.match(css, /\.tripHeroOffer[\s\S]*gap: 14px/);
});

test("adultos y menores comparten fila en el panel Lavella", () => {
  const css = readFileSync(
    "components/themes/lavella/lavella-booking.module.css",
    "utf8",
  );
  assert.match(
    css,
    /\.travelerRows[\s\S]*grid-template-columns: 1fr 1fr/,
  );
});

test("reserva y WhatsApp comparten fila en escritorio Lavella", () => {
  const css = readFileSync(
    "components/themes/lavella/lavella-booking.module.css",
    "utf8",
  );
  assert.match(
    css,
    /\.bookingFooter[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
});

test("itinerario Lavella no muestra HORARIO", () => {
  const itinerary = readFileSync(
    "components/themes/lavella/lavella-trip-sections.tsx",
    "utf8",
  );
  assert.doesNotMatch(itinerary, />HORARIO</);
});

test("itinerario Lavella no muestra PARADAS", () => {
  const itinerary = readFileSync(
    "components/themes/lavella/lavella-trip-sections.tsx",
    "utf8",
  );
  assert.doesNotMatch(itinerary, />PARADAS</);
});

test("paradas tipadas siguen disponibles para el mapa", () => {
  assert.ok(
    sourcedTrips().every((trip) =>
      trip.itinerary.every((day) => (day.stops?.length ?? 0) > 0),
    ),
  );
  assert.ok(
    sourcedTrips().every(
      (trip) => (trip.mapSettings?.routeStops?.length ?? 0) >= trip.durationDays,
    ),
  );
});

test("existen exactamente los siete viajes fuente Crisenix", () => {
  assert.equal(sourcedTrips().filter(Boolean).length, 7);
  assert.ok(
    sourcedTrips().every(
      (trip) =>
        trip.sourceReference?.provider === "Crisenix" &&
        trip.sourceReference.reviewedAt === "2026-07-26",
    ),
  );
});

test("slugs de viajes fuente son únicos en el catálogo compartido", () => {
  const slugs = travels.map((trip) => trip.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("los siete viajes usan un único dato compartido para los dos temas", () => {
  const registry = readFileSync("components/travel-app.tsx", "utf8");
  for (const theme of ["explorer", "lavella"]) {
    assert.match(registry, new RegExp(`${theme}:`));
  }
  assert.equal(
    travels.filter((trip) => sourcedTripIds.includes(trip.id as never)).length,
    7,
  );
});

for (const activeTheme of ["explorer", "lavella"] as const) {
  test(`carrito conserva el tema ${activeTheme}`, () => {
    const shell = readFileSync("components/travel-app.tsx", "utf8");
    const commerce = readFileSync("components/legacy-travel-app.tsx", "utf8");
    assert.equal(resolveTheme(agencies[0], activeTheme), activeTheme);
    assert.match(shell, /initialTheme=\{theme\}/);
    assert.match(commerce, /to \+ window\.location\.search/);
  });
  test(`checkout conserva el tema ${activeTheme}`, () => {
    const commerce = readFileSync("components/legacy-travel-app.tsx", "utf8");
    assert.equal(resolveTheme(agencies[0], activeTheme), activeTheme);
    assert.match(commerce, /const theme = resolveTheme\(agency,/);
    assert.match(commerce, /new URLSearchParams\(window\.location\.search\)/);
  });
}

test("duraciones y noches de los siete viajes coinciden con las fuentes", () => {
  assert.deepEqual(
    sourcedTrips().map((trip) => [
      trip.durationDays,
      trip.durationNights,
    ]),
    [
      [1, 0],
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
      [6, 5],
      [13, 12],
    ],
  );
});

test("tarifas dobles publicadas son la referencia de hospedaje", () => {
  assert.deepEqual(
    sourcedTrips()
      .slice(1)
      .map(
        (trip) =>
          trip.pricingOptions.find((rate) => rate.occupancy === "double")
            ?.amount,
      ),
    [3490, 4990, 6990, 19390, 27900, 5290],
  );
});

test("tarifas no publicadas no se inventan", () => {
  const [muralla, , , , velada, chepe, argentina] = sourcedTrips();
  assert.equal(
    muralla.pricingOptions.some((rate) => rate.occupancy === "child"),
    false,
  );
  assert.equal(
    velada.pricingOptions.some((rate) => rate.occupancy === "quadruple"),
    false,
  );
  assert.equal(
    chepe.pricingOptions.some((rate) => rate.occupancy === "quadruple"),
    false,
  );
  assert.deepEqual(
    argentina.pricingOptions.map((rate) => rate.occupancy),
    ["double"],
  );
});

test("Muralla de un día no usa hospedaje", () => {
  const muralla = sourcedTrips()[0];
  assert.equal(muralla.accommodationMode, "none");
  assert.equal(muralla.durationNights, 0);
});

test("Día 0 se conserva como segmento previo sin aumentar duración", () => {
  for (const trip of sourcedTrips().slice(1, 4)) {
    assert.ok(trip.preTripSegment);
  }
  assert.deepEqual(
    sourcedTrips()
      .slice(1, 4)
      .map((trip) => trip.durationDays),
    [2, 3, 4],
  );
});

test("Patagonia conserva precio y obligación contractual en USD", () => {
  const trip = patagonia();
  assert.equal(trip.basePrice.currency, "USD");
  assert.equal(trip.basePrice.amount, 5290);
  assert.equal(trip.foreignCurrencyPricing?.pricingCurrency, "USD");
  assert.equal(trip.foreignCurrencyPricing?.settlementCurrency, "USD");
  assert.equal(trip.foreignCurrencyPricing?.checkoutChargeCurrency, "MXN");
});

test("la conversión no sobrescribe el total contractual USD", async () => {
  const quote = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: toMinorUnits(5290, "USD"),
    contractualPaymentMinor: toMinorUnits(1587, "USD"),
    kind: "deposit",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(quote.allocation.contractTotalMinor, 529000);
  assert.equal(quote.allocation.contractCurrency, "USD");
  assert.equal(quote.allocation.chargeCurrency, "MXN");
});

test("conversión genera snapshot enlazado al intento", async () => {
  const result = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 158700,
    kind: "deposit",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(result.allocation.fxSnapshotId, result.snapshot.id);
  assert.equal(result.snapshot.providerId, "demo-deterministic-v1");
});

test("snapshot FX es inmutable", async () => {
  const result = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 158700,
    kind: "deposit",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(Object.isFrozen(result.snapshot), true);
  assert.equal(Object.isFrozen(result.snapshot.markup), true);
});

test("snapshot expirado requiere una nueva cotización", async () => {
  const result = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 158700,
    kind: "deposit",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(
    isFxSnapshotExpired(result.snapshot, "2026-07-26T12:16:00.000Z"),
    true,
  );
  assert.throws(
    () =>
      requireFreshFxSnapshot(
        result.snapshot,
        "2026-07-26T12:16:00.000Z",
      ),
    /venció/,
  );
});

test("recotización reemplaza un snapshot vencido y valida el nuevo intento", async () => {
  const context = {
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD" as const,
    chargeCurrency: "MXN" as const,
    contractTotalMinor: 529000,
    contractualPaymentMinor: 158700,
    kind: "deposit" as const,
  };
  const original = await createDeterministicDemoPaymentQuote({
    ...context,
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  const refreshed = await ensureFreshDeterministicDemoPaymentQuote({
    ...context,
    current: original,
    quotedAt: "2026-07-26T12:16:00.000Z",
  });
  assert.notEqual(refreshed.snapshot.id, original.snapshot.id);
  assert.equal(
    validateFxPaymentContext({
      snapshot: refreshed.snapshot,
      allocation: refreshed.allocation,
      sourceCurrency: context.sourceCurrency,
      chargeCurrency: context.chargeCurrency,
      contractTotalMinor: context.contractTotalMinor,
      contractualPaymentMinor: context.contractualPaymentMinor,
      kind: context.kind,
      now: "2026-07-26T12:16:01.000Z",
    }),
    true,
  );
});

test("anticipo mantiene saldo contractual en USD", async () => {
  const result = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 158700,
    kind: "deposit",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(result.allocation.remainingContractMinor, 370300);
  assert.equal(result.allocation.contractCurrency, "USD");
});

test("cada abono puede conservar un snapshot nuevo en el historial", async () => {
  const first = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 100000,
    kind: "deposit",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  const second = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 429000,
    contractualPaymentMinor: 100000,
    kind: "deposit",
    quotedAt: "2026-08-26T12:00:00.000Z",
  });
  let history = appendFxPaymentAllocation({
    history: [],
    allocation: first.allocation,
    paymentId: "payment-1",
    appliedAt: "2026-07-26T12:05:00.000Z",
  });
  history = appendFxPaymentAllocation({
    history: [...history],
    allocation: second.allocation,
    paymentId: "payment-2",
    appliedAt: "2026-08-26T12:05:00.000Z",
  });
  assert.notEqual(first.snapshot.id, second.snapshot.id);
  assert.equal(history.length, 2);
});

test("pago total liquida el saldo USD", async () => {
  const result = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 529000,
    kind: "full",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(result.allocation.remainingContractMinor, 0);
  assert.equal(result.allocation.kind, "full");
  assert.equal(
    fxContractualPaymentLabel(result.allocation.kind),
    "Pago contractual",
  );
});

test("WhatsApp describe pago total sin etiquetarlo como anticipo", async () => {
  const trip = patagonia();
  const departure = trip.departures[0];
  const agency = agencies.find((item) => item.id === trip.agencyId)!;
  const option = departure.boardingOptions[0];
  const point = departurePoints.find(
    (item) => item.id === option.agencyDeparturePointId,
  )!;
  const result = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 529000,
    kind: "full",
    quotedAt: new Date().toISOString(),
  });
  const boarding = {
    boardingOptionId: option.id,
    boardingPointId: point.id,
    pointName: point.name,
    address: point.address,
    reference: point.reference,
    city: point.city,
    meetingTime: option.meetingTime,
    departureTime: option.departureTime,
    surchargeAmount: option.surchargeAmount ?? 0,
    surchargeType: option.surchargeType ?? ("per_person" as const),
    currency: option.currency ?? trip.basePrice.currency,
    instructions: option.instructionsOverride ?? point.instructions,
  };
  const priced = {
    id: "patagonia-whatsapp-full",
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: departure.id,
    boardingOptionId: option.id,
    boardingSnapshot: boarding,
    pricingOptionId: trip.pricingOptions[0].id,
    travelers: 1,
    extraIds: [],
    fxSnapshot: result.snapshot,
    paymentAllocation: result.allocation,
    travel: trip,
    departure,
    boarding,
    subtotal: 5290,
    taxes: 0,
    surcharge: 0,
    extrasTotal: 0,
    total: 5290,
    deposit: 1587,
  } satisfies PricedCartLine;
  const message = decodeURIComponent(
    whatsappUrl(agency, priced).split("text=")[1],
  );
  assert.match(message, /Pago contractual:/);
  assert.doesNotMatch(message, /Anticipo:/);
});

test("carrito no suma MXN y USD", () => {
  const mxn = sourcedTrips()[0];
  const usd = patagonia();
  const makeLine = (trip: TravelProduct): CartLine => ({
    id: `line-${trip.id}`,
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: trip.departures[0].id,
    boardingOptionId: null,
    pricingOptionId: trip.pricingOptions[0].id,
    travelers: 1,
    extraIds: [],
  });
  assert.throws(
    () => validateCartCurrencies([makeLine(mxn), makeLine(usd)]),
    /mezclar monedas/,
  );
});

test("redondeo FX ocurre al final según política de agencia", async () => {
  const deposit = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 158700,
    kind: "deposit",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  const full = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 529000,
    kind: "full",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(deposit.snapshot.chargeAmountMinor, 2_792_400);
  assert.equal(full.snapshot.chargeAmountMinor, 9_307_800);
  assert.equal(formatAppliedRate(deposit.snapshot), "17.5950");
});

test("consentimiento enlaza tasa, monto y versión del texto", async () => {
  const result = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 158700,
    kind: "deposit",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  const consent = createFxConsent({
    snapshot: result.snapshot,
    acceptedAt: "2026-07-26T12:05:00.000Z",
  });
  assert.equal(
    validateFxConsent({
      snapshot: result.snapshot,
      consent,
      now: "2026-07-26T12:06:00.000Z",
    }),
    true,
  );
  assert.equal(consent.acceptedChargeAmountMinor, 2_792_400);
  assert.equal(consent.disclosureVersion, "fx-demo-v1");
});

test("checkout valida defensivamente snapshot y asignación", async () => {
  const result = await createDeterministicDemoPaymentQuote({
    policy: crisenixFxPolicy(),
    sourceCurrency: "USD",
    chargeCurrency: "MXN",
    contractTotalMinor: 529000,
    contractualPaymentMinor: 158700,
    kind: "deposit",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(
    validateFxPaymentContext({
      snapshot: result.snapshot,
      allocation: result.allocation,
      sourceCurrency: "USD",
      chargeCurrency: "MXN",
      contractTotalMinor: 529000,
      contractualPaymentMinor: 158700,
      kind: "deposit",
      now: "2026-07-26T12:05:00.000Z",
    }),
    true,
  );
  assert.throws(
    () =>
      validateFxPaymentContext({
        snapshot: result.snapshot,
        allocation: result.allocation,
        sourceCurrency: "USD",
        chargeCurrency: "MXN",
        contractTotalMinor: 529001,
        contractualPaymentMinor: 158700,
        kind: "deposit",
        now: "2026-07-26T12:05:00.000Z",
      }),
    /no coincide/,
  );
});

test("carrito conserva theme y tenant al reservar Lavella", () => {
  assert.equal(
    lavellaCartHref("?tenant=furiver", "furiver"),
    "/carrito?tenant=furiver&theme=lavella",
  );
});

test("panel Lavella prepara una sola reserva consistente para el carrito", () => {
  const agency = agencies.find((item) => item.slug === "furiver")!;
  const trip = travels.find(
    (item) =>
      item.agencyId === agency.id &&
      item.slug === "barrancas-del-cobre",
  )!;
  const departure = lavellaDeparture(trip);
  const adultRate = trip.pricingOptions.find(
    (item) => item.occupancy === "double",
  )!;
  const minorRate = trip.pricingOptions.find(
    (item) => item.occupancy === "child",
  )!;
  const lines: CartLine[] = [
    {
      id: `line-${trip.id}-adultos`,
      agencyId: agency.id,
      travelId: trip.id,
      departureId: departure.id,
      boardingOptionId: null,
      pricingOptionId: adultRate.id,
      travelers: 2,
      extraIds: [],
    },
    {
      id: `line-${trip.id}-menores`,
      agencyId: agency.id,
      travelId: trip.id,
      departureId: departure.id,
      boardingOptionId: null,
      pricingOptionId: minorRate.id,
      travelers: 1,
      extraIds: [],
    },
  ];
  const quote = getLavellaBookingQuote({
    trip,
    departureId: departure.id,
    lines,
  });
  const first = createLavellaCartTransition({
    agency,
    trip,
    departureId: departure.id,
    adults: 2,
    minors: 1,
    occupancy: "double",
    incomingLines: lines,
    existingCart: [],
    search: "?tenant=furiver&theme=lavella",
  });
  const second = createLavellaCartTransition({
    agency,
    trip,
    departureId: departure.id,
    adults: 2,
    minors: 1,
    occupancy: "double",
    incomingLines: lines,
    existingCart: first.cart,
    search: "?tenant=furiver&theme=lavella",
  });

  assert.equal(first.cart.length, 2);
  assert.equal(second.cart.length, 2);
  assert.equal(first.draft.travelId, trip.id);
  assert.equal(first.draft.travelCode, trip.code);
  assert.equal(first.draft.departureId, departure.id);
  assert.equal(first.draft.adults, 2);
  assert.equal(first.draft.children, 1);
  assert.equal(first.draft.rooms, 1);
  assert.equal(first.draft.occupancy, "double");
  assert.equal(first.draft.boardingOptionId, null);
  assert.deepEqual(first.draft.extraIds, []);
  assert.equal(first.draft.total, quote.total);
  assert.equal(first.draft.deposit, quote.deposit);
  assert.equal(first.draft.currency, trip.basePrice.currency);
  assert.equal(first.draft.tenant, agency.slug);
  assert.equal(first.draft.theme, "lavella");
  assert.equal(first.href, "/carrito?tenant=furiver&theme=lavella");
});

test("panel Lavella bloquea mezcla de monedas antes de escribir el carrito", () => {
  const agency = agencies.find((item) => item.slug === "crisenix")!;
  const trip = travels.find(
    (item) =>
      item.agencyId === agency.id &&
      item.basePrice.currency === "USD" &&
      item.departures.some((departure) =>
        departure.boardingOptions.some(
          (option) => !["sold_out", "disabled"].includes(option.status),
        ),
      ),
  )!;
  const departure = lavellaDeparture(trip);
  const rate =
    trip.pricingOptions.find((item) => item.occupancy === "double") ??
    trip.pricingOptions[0];
  const existingTrip = travels.find(
    (item) =>
      item.agencyId === agency.id &&
      item.basePrice.currency === "MXN",
  )!;
  const existingDeparture = lavellaDeparture(existingTrip);
  const existingRate = existingTrip.pricingOptions[0];
  const incoming: CartLine = {
    id: `line-${trip.id}-adultos`,
    agencyId: agency.id,
    travelId: trip.id,
    departureId: departure.id,
    boardingOptionId: null,
    pricingOptionId: rate.id,
    travelers: 2,
    extraIds: [],
  };
  const existing: CartLine = {
    id: `line-${existingTrip.id}-adultos`,
    agencyId: agency.id,
    travelId: existingTrip.id,
    departureId: existingDeparture.id,
    boardingOptionId: null,
    pricingOptionId: existingRate.id,
    travelers: 2,
    extraIds: [],
  };

  assert.throws(
    () =>
      createLavellaCartTransition({
        agency,
        trip,
        departureId: departure.id,
        adults: 2,
        minors: 0,
        occupancy: rate.occupancy,
        incomingLines: [incoming],
        existingCart: [existing],
        search: "?tenant=crisenix&theme=lavella",
      }),
    /mezclar monedas/,
  );
});

test("panel Lavella rechaza salida sin abordaje operativo", () => {
  const agency = agencies.find((item) => item.slug === "furiver")!;
  const source = travels.find((item) => item.agencyId === agency.id)!;
  const trip = structuredClone(source);
  const departure = lavellaDeparture(trip);
  departure.boardingOptions = [];
  const rate = trip.pricingOptions[0];
  const line: CartLine = {
    id: `line-${trip.id}-adultos`,
    agencyId: agency.id,
    travelId: trip.id,
    departureId: departure.id,
    boardingOptionId: null,
    pricingOptionId: rate.id,
    travelers: 1,
    extraIds: [],
  };

  assert.throws(
    () =>
      createLavellaCartTransition({
        agency,
        trip,
        departureId: departure.id,
        adults: 1,
        minors: 0,
        occupancy: rate.occupancy,
        incomingLines: [line],
        existingCart: [],
        search: "?tenant=furiver&theme=lavella",
      }),
    /No hay puntos de abordaje/,
  );
});

test("panel Lavella impide doble activación del agregado", () => {
  const booking = readFileSync(
    "components/themes/lavella/lavella-booking-panel.tsx",
    "utf8",
  );
  assert.match(booking, /reservingRef\.current/);
  assert.match(booking, /if \(!canReserve \|\| !adultLine \|\| reservingRef\.current\) return/);
});

test("controles Lavella actualizan adultos y menores una sola vez", () => {
  const adults = updateLavellaTravelerCounts({
    current: { adults: 2, minors: 0 },
    category: "adults",
    direction: 1,
    hotel: true,
  });
  const minors = updateLavellaTravelerCounts({
    current: adults,
    category: "minors",
    direction: 1,
    hotel: true,
  });

  assert.deepEqual(adults, { adults: 3, minors: 0 });
  assert.deepEqual(minors, { adults: 3, minors: 1 });
});

test("controles Lavella respetan mínimos y conservan ocupación para el borrador", () => {
  const minimum = updateLavellaTravelerCounts({
    current: { adults: 1, minors: 0 },
    category: "adults",
    direction: -1,
    hotel: true,
  });
  const unchangedMinors = updateLavellaTravelerCounts({
    current: minimum,
    category: "minors",
    direction: -1,
    hotel: true,
  });
  const booking = readFileSync(
    "components/themes/lavella/lavella-booking-panel.tsx",
    "utf8",
  );

  assert.deepEqual(unchangedMinors, { adults: 1, minors: 0 });
  assert.match(booking, /adults,\s*minors,\s*occupancy,/);
  assert.match(booking, /type="button" onClick=\{\(\) => changeTravelerCount/);
});

test("checkout Lavella envía únicamente el payload permitido al endpoint", () => {
  const payload = createLavellaReservationRequest({
    tenantSlug: "furiver",
    tripId: "trip-4",
    departureId: "trip-4-dep-1",
    adults: 2,
    minors: 1,
    rooms: 1,
    extraIds: ["extra-1", "extra-1"],
    boardingPointId: "p1",
    depositPercent: 20,
    travelers: { status: "pending", drafts: [] },
  });

  assert.deepEqual(Object.keys(payload).sort(), [
    "adults",
    "boardingPointId",
    "departureId",
    "depositPercent",
    "extraIds",
    "minors",
    "rooms",
    "tenantSlug",
    "travelers",
    "tripId",
  ]);
  assert.deepEqual(payload.extraIds, ["extra-1"]);
  assert.equal("agencyId" in payload, false);
  assert.equal("total" in payload, false);
  assert.equal("currency" in payload, false);
  assert.equal("snapshot" in payload, false);
});

test("checkout Lavella usa la confirmación del servidor sin recalcular importes", () => {
  const agency = agencies.find((item) => item.slug === "furiver")!;
  const response = {
    reservationId: "FT-004-260801-SERVER",
    reservationCode: "FT-004-260801-SERVER",
    status: "pending" as const,
    createdAt: "2026-08-01T12:00:00.000Z",
    confirmation: {
      tripCode: "FT-004",
      tripName: "Barrancas del Cobre",
      departureDate: "2026-08-12T00:00:00.000Z",
      boardingPointName: "Metro Aragón",
      rooms: 1,
      occupancy: { adults: 2, minors: 1, totalTravelers: 3 },
      currency: "MXN" as const,
      total: 45_269,
      depositPercent: 20,
      depositAmount: 9_053.8,
      remainingAmount: 36_215.2,
    },
  };
  const mirror = createLavellaReservationMirror({
    response,
    agency,
    theme: "lavella",
    idempotencyKey: "checkout-same-key",
    tripId: "trip-4",
    departureId: "trip-4-dep-1",
    boarding: {
      boardingOptionId: "trip-4-dep-1-b-0",
      boardingPointId: "p1",
      pointName: "Valor del cliente que no debe prevalecer",
      city: "Ciudad de México",
      meetingTime: "05:20",
      surchargeAmount: 0,
      currency: "MXN",
    },
    travelers: { status: "pending", drafts: [] },
  });

  assert.equal(mirror.total, response.confirmation.total);
  assert.equal(mirror.depositAmount, response.confirmation.depositAmount);
  assert.equal(mirror.remainingAmount, response.confirmation.remainingAmount);
  assert.equal(mirror.boarding.pointName, "Metro Aragón");
  assert.deepEqual(mirror.occupancy, response.confirmation.occupancy);
});

test("checkout Lavella conserva la clave al reintentar y bloquea doble envío", () => {
  const checkout = readFileSync("components/legacy-travel-app.tsx", "utf8");
  assert.match(checkout, /"Idempotency-Key": reservationSubmissionKeyRef\.current/);
  assert.match(checkout, /if \(finalizingRef\.current\) return/);
  assert.match(checkout, /setIsSubmittingReservation\(true\)/);
  assert.match(checkout, /setIsSubmittingReservation\(false\)/);
  assert.match(checkout, /fetch\("\/api\/reservations"/);
  assert.match(checkout, /setStep\(6\);\s+onDone\(\);/);
  assert.match(checkout, /apiResponse\.status === 400/);
  assert.match(checkout, /apiResponse\.status === 404/);
  assert.match(checkout, /apiResponse\.status === 409/);
});

test("proveedor determinista no se presenta como Banxico", async () => {
  const provider = new DeterministicDemoExchangeRateProvider();
  const quote = await provider.getQuote({
    baseCurrency: "USD",
    quoteCurrency: "MXN",
    quotedAt: "2026-07-26T12:00:00.000Z",
  });
  assert.equal(quote.providerId, "demo-deterministic-v1");
  assert.doesNotMatch(quote.providerId, /banxico/i);
});

test("utilidades monetarias usan unidades menores seguras", () => {
  assert.equal(toMinorUnits(1587, "USD"), 158700);
  assert.equal(toMinorUnits(27924, "MXN"), 2792400);
  assert.throws(() => toMinorUnits(Number.POSITIVE_INFINITY, "MXN"));
});

test("catálogo y Lavella eligen la próxima salida futura", () => {
  const muralla = sourcedTrips()[0];
  const now = new Date("2026-07-26T12:00:00.000Z");
  assert.equal(
    lavellaDeparture(muralla, now).startDate.slice(0, 10),
    "2026-09-19",
  );
  assert.equal(
    getCatalogNextDeparture(muralla, now).startDate.slice(0, 10),
    "2026-09-19",
  );
});

test("impuestos desconocidos no se representan como cero confirmado", () => {
  const [muralla, guadalajara, veracruz, oaxaca] = sourcedTrips();
  for (const trip of [muralla, guadalajara, veracruz, oaxaca]) {
    assert.equal(trip.basePrice.taxesIncluded, false);
    assert.equal(trip.basePrice.taxesAmount, undefined);
  }
});

test("la demo restringe múltiples grupos FX para no compartir snapshot", () => {
  const trip = patagonia();
  const base: CartLine = {
    id: "patagonia-1",
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: trip.departures[0].id,
    boardingOptionId: null,
    pricingOptionId: trip.pricingOptions[0].id,
    travelers: 1,
    extraIds: [],
  };
  assert.throws(
    () =>
      validateDemoFxOrderShape([
        base,
        {
          ...base,
          id: "patagonia-2",
          departureId: `${base.departureId}-otra`,
        },
      ]),
    /un viaje internacional/,
  );
});

test("un viaje FX debe reservarse sin otro viaje aunque ambos usen USD", () => {
  const foreignTrip = patagonia();
  const usdWithoutFx = travels.find(
    (trip) =>
      trip.agencyId === foreignTrip.agencyId &&
      trip.basePrice.currency === "USD" &&
      !trip.foreignCurrencyPricing,
  )!;
  const makeLine = (trip: TravelProduct): CartLine => ({
    id: `line-${trip.id}`,
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: trip.departures[0].id,
    boardingOptionId: null,
    pricingOptionId: trip.pricingOptions[0].id,
    travelers: 1,
    extraIds: [],
  });
  assert.equal(
    validateCartCurrencies([makeLine(foreignTrip), makeLine(usdWithoutFx)]),
    true,
  );
  assert.throws(
    () =>
      validateDemoFxOrderShape([
        makeLine(foreignTrip),
        makeLine(usdWithoutFx),
      ]),
    /sin otros viajes/,
  );
});

test("checkout puede representar una línea persistida inválida sin lanzar", () => {
  const trip = patagonia();
  const [result] = estimateCartLines([
    {
      id: "persisted-invalid-line",
      agencyId: trip.agencyId,
      travelId: trip.id,
      departureId: "departure-removed",
      boardingOptionId: null,
      pricingOptionId: trip.pricingOptions[0].id,
      travelers: 1,
      extraIds: [],
    },
  ]);
  assert.equal(result.estimate, null);
  assert.match(result.error, /reserva inválida|no está disponible/);
});

test("itinerarios fuente no fabrican horarios públicos", () => {
  assert.ok(
    sourcedTrips().every((trip) =>
      trip.itinerary.every((day) => day.startTime === undefined),
    ),
  );
});

test("visibilidad de disponibilidad distingue oculto, estado y conteo", () => {
  const departure = {
    ...sourcedTrips()[0].departures[0],
    saleStatus: "scheduled" as const,
    availableSpaces: 40,
  };
  assert.equal(getAvailabilityLabel("hidden", departure), null);
  assert.equal(getAvailabilityLabel("status_only", departure), "Disponible");
  assert.equal(
    getAvailabilityLabel("remaining_places", departure),
    "40 lugares",
  );
});

test("estados de salida prevalecen sobre un conteo operativo", () => {
  const departure = sourcedTrips()[0].departures[0];
  assert.equal(
    getAvailabilityLabel("status_only", {
      ...departure,
      saleStatus: "limited",
    }),
    "Últimos lugares",
  );
  assert.equal(
    getAvailabilityLabel("remaining_places", {
      ...departure,
      saleStatus: "sold_out",
    }),
    "Agotado",
  );
  assert.equal(
    getAvailabilityLabel("remaining_places", {
      ...departure,
      saleStatus: "cancelled",
    }),
    "Cancelada",
  );
});
