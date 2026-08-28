import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import QRCode from "qrcode";
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
import { AtomicReservationPersistenceError } from "../lib/reservations/atomic-customer-access-core";
import { createPersistedAgencyResolver } from "../lib/agencies/index";
import {
  AdminAgencyAccessError,
  createAdminAgencyAccessResolver,
  type AdminAgencyMembershipRecord,
} from "../lib/agencies/admin-access-core";
import {
  CustomerAgencyAccessError,
  createCustomerAgencyAccessResolver,
  type CustomerAgencyAccountRecord,
} from "../lib/customers/customer-access-core";
import { normalizeCustomerEmail } from "../lib/customers/customer-email";
import {
  createCustomerProfileService,
  normalizeCustomerProfileInput,
} from "../lib/customers/customer-profile-core";
import {
  DEMO_RESERVATIONS_RESET_CONFIRMATION,
  getSupabaseProjectRef,
  isStoragePathOwnedByReservation,
  parseDemoReservationResetArgs,
  RESERVATION_RESET_DELETE_ORDER,
} from "../scripts/reset-demo-reservations-core";
import {
  ORPHAN_CUSTOMER_ACCESS_CONFIRMATION,
  normalizeMaintenanceEmail,
  parseOrphanCustomerAccessArgs,
} from "../scripts/reconcile-orphan-customer-access-core";
import {
  hasMaterializableTravelerData,
  parseReservationTravelerReconciliationArgs,
  planReservationTravelerReconciliation,
  RESERVATION_TRAVELER_RECONCILIATION_CONFIRMATION,
  type HistoricalReservationTravelerRow,
} from "../scripts/reconcile-reservation-travelers-core";
import { createReservationClaimService } from "../lib/customers/reservation-claim-core";
import {
  CustomerReservationListError,
  createCustomerReservationLister,
  normalizeCustomerReservationLimit,
  normalizeCustomerReservationOffset,
  normalizeCustomerReservationStatus,
} from "../lib/customers/customer-reservations-core";
import {
  CustomerReservationDetailError,
  createCustomerReservationDetail,
  isCustomerReservationUuid,
} from "../lib/customers/customer-reservation-detail-core";
import {
  buildTravelerSlotStructure,
  createReservationTravelerSlotEnsurer,
  deriveTravelerSlotStructure,
  TravelerSlotsError,
  type ReservationTravelerSlotRow,
} from "../lib/travelers/traveler-slots-core";
import {
  createReservationTravelerDataService,
  TravelerDataError,
  validateReservationTravelerData,
  type ReservationTravelerDataRow,
} from "../lib/travelers/traveler-data-core";
import {
  calculateCustomerTransferReportability,
  calculateReservationFinancialSummary,
  createReservationFinancialSummaryService,
  ReservationFinancialError,
  type ReservationPaymentFinancialRow,
} from "../lib/payments/reservation-financial-core";
import {
  createManualReservationPaymentService,
  ManualPaymentError,
  type ManualPaymentInsert,
  type ManualPaymentStoredRow,
} from "../lib/payments/manual-payment-core";
import {
  AdminPaymentHistoryError,
  createAdminPaymentHistoryService,
  type AdminPaymentHistoryRow,
} from "../lib/payments/admin-payment-list-core";
import {
  AdminPaymentStatusError,
  canTransitionManualPaymentStatus,
  createAdminPaymentStatusService,
  type ManualPaymentStatus,
} from "../lib/payments/admin-payment-status-core";
import {
  AdminPaymentEvidenceError,
  createAdminPaymentEvidenceService,
} from "../lib/payments/admin-payment-evidence-core";
import {
  CustomerPaymentHistoryError,
  createCustomerPaymentHistoryService,
  type CustomerPaymentHistoryRow,
} from "../lib/payments/customer-payment-list-core";
import {
  CUSTOMER_TRANSFER_MAX_FILE_BYTES,
  CustomerTransferError,
  createCustomerTransferEvidenceService,
  createCustomerTransferUploadService,
  detectCustomerTransferFile,
  type CustomerTransferPaymentInsert,
  type CustomerTransferPaymentRow,
} from "../lib/payments/customer-transfer-core";
import {
  createPaymentReceiptService,
  PaymentReceiptError,
  type PaymentReceiptDocumentInsert,
  type PaymentReceiptDocumentRow,
} from "../lib/documents/payment-receipt-core";
import { renderPaymentReceiptPdf } from "../lib/documents/payment-receipt-pdf";
import {
  createPaymentReceiptRevocationService,
  PaymentReceiptRevocationError,
} from "../lib/documents/payment-receipt-revocation-core";
import { createCustomerDocumentListService } from "../lib/documents/customer-document-list-core";
import {
  createCustomerDocumentAccessService,
  CustomerDocumentAccessError,
} from "../lib/documents/customer-document-access-core";
import {
  AdminContractSettingsError,
  createAdminContractSettingsService,
} from "../lib/contracts/admin-contract-settings-core";
import {
  AdminContractActivationError,
  createAdminContractActivationService,
} from "../lib/contracts/admin-contract-activation-core";
import { createReservationContractService } from "../lib/contracts/reservation-contract-core";
import {
  createCustomerContractAcceptanceService,
  CONTRACT_ACCEPTANCE_STATEMENT,
  CONTRACT_ACCEPTANCE_STATEMENT_VERSION,
} from "../lib/contracts/customer-contract-acceptance-core";
import {
  createReservationContractDocumentService,
  calculateContractDocumentSha256,
  ReservationContractDocumentError,
  type ReservationContractDocumentInsert,
  type ReservationContractDocumentRow,
} from "../lib/documents/reservation-contract-document-core";
import { renderReservationContractPdf } from "../lib/documents/reservation-contract-document-pdf";
import {
  createAcceptanceCertificateService,
  type AcceptanceCertificateInsert,
} from "../lib/documents/acceptance-certificate-core";
import { renderAcceptanceCertificatePdf } from "../lib/documents/acceptance-certificate-pdf";
import {
  BOARDING_QR_PREFIX,
  boardingQrPayload,
  hashBoardingToken,
} from "../lib/documents/ticket-boarding-credential-core";
import {
  createBoardingScanService,
  extractBoardingRawToken,
} from "../lib/boarding/boarding-scan-core";
import {
  createAdminDepartureManifestService,
  departureKeyForIdentity,
} from "../lib/departures/admin-departure-manifest-core";
import {
  createReservationDocumentEligibilityService,
  DEFAULT_TICKET_PAYMENT_THRESHOLD_BPS,
} from "../lib/travel-documents/document-eligibility-core";
import {
  createReservationVoucherDocumentService,
  ReservationVoucherDocumentError,
  type VoucherDocumentRow,
} from "../lib/documents/reservation-voucher-document-core";
import { createVoucherLifecycleService } from "../lib/travel-documents/voucher-lifecycle-core";
import { renderReservationVoucherPdf } from "../lib/documents/reservation-voucher-document-pdf";
import {
  createReservationTicketDocumentService,
  ReservationTicketDocumentError,
  type ReservationTicketDocumentRow,
} from "../lib/documents/reservation-ticket-document-core";
import { renderReservationTicketPdf } from "../lib/documents/reservation-ticket-document-pdf";
import {
  createChangedTravelerTicketLifecycleService,
  createReservationTicketLifecycleService,
} from "../lib/travel-documents/ticket-lifecycle-core";
import {
  createCustomerTransferIdempotencyKey,
  localTransferDateTimeToIso,
  localTransferDateTimeValue,
} from "../app/cuenta/[agencySlug]/reservaciones/[reservationId]/customer-transfer-form-core";
import {
  createManualPaymentIdempotencyKey,
  localDateTimeToIso,
  localDateTimeValue,
} from "../app/admin/[agencySlug]/reservaciones/[reservationId]/manual-payment-form-core";
import {
  parseAdminReservationPage,
  parseAdminReservationStatus,
  safeAdminNext,
  validateAdminLoginCredentials,
} from "../app/admin/admin-utils";
import {
  safeCustomerAuthReturnTo,
  safeCustomerNext,
  parseCustomerReservationClaimNext,
  validateCustomerLoginCredentials,
} from "../app/cuenta/customer-utils";
import { runCustomerLoginFlow } from "../app/cuenta/customer-login-core";
import {
  customerReservationHref,
  customerReservationDetailNextStep,
  customerReservationNextStep,
  customerReservationStatusLabel,
  parseCustomerReservationPage,
} from "../app/cuenta/customer-reservation-utils";
import { getSupabasePublicEnvironment } from "../lib/supabase/auth-env";
import { resolveVerifiedSupabaseIdentity } from "../lib/supabase/auth-identity-core";
import { isReservedInternalPath } from "../lib/routing/public-route-guard";
import { getSupabaseServerEnvironment } from "../lib/supabase/env";
import {
  AdminReservationListError,
  createAdminReservationListing,
  type AdminReservationListRow,
} from "../lib/reservations/admin-listing";
import {
  AdminReservationDetailError,
  createAdminReservationDetail,
  type AdminReservationDetailRow,
} from "../lib/reservations/admin-detail";
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
  createTravelerDraftAttemptScope,
  createTravelerDrafts,
  isTravelerDraftAttemptScoped,
  reconcileTravelerDrafts,
  travelerFollowUpMessage,
  travelerWhatsAppSummary,
  validateTravelerDrafts,
} from "../lib/travelers/index";
import {
  createReservationTravelerMaterializer,
  projectReservationTravelerMaterialization,
} from "../lib/travelers/traveler-materialization-core";
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

// Demo departures are intentionally dated around August 2026. Freeze the
// test clock before invoking any pricing/reservation helper so the suite does
// not expire when the real calendar advances.
const REAL_DATE = Date;
const TEST_NOW = "2026-07-26T12:00:00.000Z";
globalThis.Date = class extends REAL_DATE {
  constructor(value?: string | number | Date) {
    if (arguments.length === 0) super(TEST_NOW);
    else super(value as never);
  }

  static now() {
    return REAL_DATE.parse(TEST_NOW);
  }
} as DateConstructor;

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

function adminAccessFixture(
  input: Readonly<{
  identity?: { userId: string; email: string | null } | null;
  memberships?: readonly AdminAgencyMembershipRecord[];
  failIdentity?: boolean;
  failMemberships?: boolean;
  }> = {},
) {
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

const customerAccount = (
  input: Partial<CustomerAgencyAccountRecord> = {},
): CustomerAgencyAccountRecord => ({
  customerAccountId: "customer-furiver",
  agencyId: "agency-furiver",
  agencySlug: "furiver",
  agencyName: "Furiver",
  status: "active",
  ...input,
});

function customerAccessFixture(
  input: Readonly<{
  identity?: { userId: string; email: string | null } | null;
  accounts?: readonly CustomerAgencyAccountRecord[];
  failIdentity?: boolean;
  failAccounts?: boolean;
  }> = {},
) {
  const queriedUserIds: string[] = [];
  const resolver = createCustomerAgencyAccessResolver({
    async getIdentity() {
      if (input.failIdentity) throw new Error("token details");
      return input.identity === undefined
        ? { userId: "customer-verified", email: "cliente@furiver.test" }
        : input.identity;
    },
    accountRepository: {
      async listActiveByUserId(userId) {
        queriedUserIds.push(userId);
        if (input.failAccounts) throw new Error("SQL details");
        return input.accounts ?? [];
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
    if (savedKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
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
  const browserClient = readFileSync("lib/supabase/browser-client.ts", "utf8");
  const authServer = readFileSync("lib/supabase/auth-server.ts", "utf8");
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
  assert.equal(isReservedInternalPath("/cuenta/login"), true);
  assert.equal(isReservedInternalPath("/cuenta/furiver/reservaciones"), true);
  assert.equal(isReservedInternalPath("/api/reservations"), true);
  assert.equal(isReservedInternalPath("/_next/static/chunk.js"), true);
  assert.equal(isReservedInternalPath("/favicon.ico"), true);
  assert.equal(isReservedInternalPath("/viajes/barrancas-del-cobre"), false);

  const catchAll = readFileSync("app/[...route]/page.tsx", "utf8");
  const publicRenderer = readFileSync("components/travel-app.tsx", "utf8");
  const legacyRenderer = readFileSync(
    "components/legacy-travel-app.tsx",
    "utf8",
  );
  const proxy = readFileSync("lib/supabase/auth-proxy.ts", "utf8");
  assert.match(catchAll, /isReservedInternalPath\(pathname\)\)notFound\(\)/);
  assert.equal(
    publicRenderer.includes(
      'route.startsWith("/admin") ||\n    route.startsWith("/superadmin")',
    ),
    false,
  );
  assert.match(publicRenderer, /route\.startsWith\("\/demo\/admin"\)\s*\|\|/);
  assert.match(
    publicRenderer,
    /window\.location\.href = `\/demo\/admin\?\$\{next\}`/,
  );
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
  assert.deepEqual(
    await resolver.resolve({ requestedAgencySlug: "crisenix" }),
    {
    status: "forbidden",
    },
  );
});

test("errores administrativos se sanejan y la consulta queda limitada al usuario", async () => {
  const failing = adminAccessFixture({ failMemberships: true });
  await assert.rejects(
    failing.resolver.resolve(),
    (error: unknown) =>
      error instanceof AdminAgencyAccessError && !error.message.includes("SQL"),
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

test("acceso de cliente no consulta cuentas sin una sesión verificada", async () => {
  const { resolver, queriedUserIds } = customerAccessFixture({
    identity: null,
  });
  assert.deepEqual(await resolver.resolve(), { status: "unauthenticated" });
  assert.deepEqual(queriedUserIds, []);
});

test("acceso de cliente rechaza cuentas inexistentes, invitadas o suspendidas", async () => {
  for (const accounts of [
    [],
    [customerAccount({ status: "invited" })],
    [customerAccount({ status: "suspended" })],
  ]) {
    const { resolver } = customerAccessFixture({ accounts });
    assert.deepEqual(await resolver.resolve(), { status: "forbidden" });
  }
});

test("una cuenta de cliente activa se selecciona automáticamente", async () => {
  const { resolver, queriedUserIds } = customerAccessFixture({
    accounts: [customerAccount()],
  });
  const access = await resolver.resolve();
  assert.equal(access.status, "authorized");
  if (access.status === "authorized") {
    assert.deepEqual(access.account, {
      customerAccountId: "customer-furiver",
      agencyId: "agency-furiver",
      agencySlug: "furiver",
      agencyName: "Furiver",
    });
    assert.deepEqual(access.identity, {
      userId: "customer-verified",
      email: "cliente@furiver.test",
    });
  }
  assert.deepEqual(queriedUserIds, ["customer-verified"]);
});

test("múltiples cuentas activas exigen selección y un slug ajeno permanece prohibido", async () => {
  const { resolver } = customerAccessFixture({
    accounts: [
      customerAccount(),
      customerAccount({
        customerAccountId: "customer-crisenix",
        agencyId: "agency-crisenix",
        agencySlug: "crisenix",
        agencyName: "Crisenix",
      }),
    ],
  });
  assert.equal((await resolver.resolve()).status, "selection_required");
  const selected = await resolver.resolve({ requestedAgencySlug: "crisenix" });
  assert.equal(selected.status, "authorized");
  assert.deepEqual(
    await resolver.resolve({ requestedAgencySlug: "otra-agencia" }),
    { status: "forbidden" },
  );
});

test("acceso de cliente permanece separado del administrativo y sanea errores", async () => {
  const { resolver } = customerAccessFixture({ accounts: [] });
  assert.deepEqual(await resolver.resolve(), { status: "forbidden" });

  const failing = customerAccessFixture({ failAccounts: true });
  await assert.rejects(
    failing.resolver.resolve(),
    (error: unknown) =>
      error instanceof CustomerAgencyAccessError &&
      !error.message.includes("SQL"),
  );

  const source = readFileSync(
    "lib/customers/customer-access-repository.ts",
    "utf8",
  );
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /\.eq\("status", "active"\)/);
  assert.equal(source.includes("agency_memberships"), false);
  assert.equal(source.includes("reservation_customer_access"), false);
  assert.equal(source.includes("SUPABASE_SERVICE_ROLE_KEY"), false);

  const access = await customerAccessFixture({
    accounts: [customerAccount()],
  }).resolver.resolve();
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
  assert.equal(
    validateAdminLoginCredentials({
      email: "no-es-correo",
      password: "password-seguro",
    }),
    null,
  );
  assert.equal(
    validateAdminLoginCredentials({
      email: "admin@furiver.test",
      password: "corta",
    }),
    null,
  );
  assert.equal(
    safeAdminNext("/admin/furiver/reservaciones?page=2"),
    "/admin/furiver/reservaciones?page=2",
  );
  assert.equal(safeAdminNext("https://malicioso.example/admin"), null);
  assert.equal(safeAdminNext("//malicioso.example/admin"), null);
  assert.equal(safeAdminNext("/admin\\malicioso"), null);
});

test("login de cliente valida credenciales y limita next exclusivamente a cuenta", () => {
  assert.deepEqual(
    validateCustomerLoginCredentials({
      email: " Cliente@Furiver.test ",
      password: "password-seguro",
    }),
    { email: "cliente@furiver.test", password: "password-seguro" },
  );
  assert.equal(
    validateCustomerLoginCredentials({
      email: "no-es-correo",
      password: "password-seguro",
    }),
    null,
  );
  assert.equal(
    validateCustomerLoginCredentials({
      email: "cliente@furiver.test",
      password: "corta",
    }),
    null,
  );
  assert.equal(
    safeCustomerNext("/cuenta/furiver/reservaciones?page=2"),
    "/cuenta/furiver/reservaciones?page=2",
  );
  assert.equal(safeCustomerNext("https://malicioso.example/cuenta"), null);
  assert.equal(safeCustomerNext("//malicioso.example/cuenta"), null);
  assert.equal(safeCustomerNext("/cuenta//malicioso"), null);
  assert.equal(safeCustomerNext("/admin/furiver/reservaciones"), null);
  assert.equal(safeCustomerNext("/cuenta%2fmalicioso"), null);
});

test("login de cliente distingue Auth de acceso activo y no atrapa redirects", async () => {
  const credentials = {
    email: "cliente@furiver.test",
    password: "password-seguro",
  };
  const authorized = await runCustomerLoginFlow(
    {
    async signInWithPassword() {
      return { error: null };
    },
    async resolveAccess() {
      return {
        status: "authorized",
          identity: {
            userId: "verified-customer",
            email: "cliente@furiver.test",
          },
        account: {
          customerAccountId: "customer-furiver",
          agencyId: "agency-furiver",
          agencySlug: "furiver",
          agencyName: "Furiver",
        },
        accounts: [],
      };
    },
    },
    credentials,
  );
  assert.equal(authorized.status, "authorized");
  if (authorized.status === "authorized") {
    assert.equal(authorized.access.account.agencySlug, "furiver");
  }

  const authFailed = await runCustomerLoginFlow(
    {
    async signInWithPassword() {
      return { error: { code: "invalid_credentials" } };
    },
    async resolveAccess() {
      throw new Error("must not resolve access after failed auth");
    },
    },
    credentials,
  );
  assert.deepEqual(authFailed, { status: "auth_failed" });

  const noAccount = await runCustomerLoginFlow(
    {
    async signInWithPassword() {
      return { error: null };
    },
    async resolveAccess() {
      return { status: "forbidden" };
    },
    },
    credentials,
  );
  assert.deepEqual(noAccount, { status: "forbidden" });

  const actionsSource = readFileSync("app/cuenta/actions.ts", "utf8");
  assert.match(actionsSource, /resolveCustomerAgencyAccess\(\{\}, auth\)/);
  assert.ok(
    actionsSource.indexOf("redirect(") > actionsSource.lastIndexOf("catch"),
  );
});

test("RLS permite resolver agencias solo para cuentas de cliente activas", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801040000_customer_agency_read_policy.sql",
    "utf8",
  );
  assert.match(
    migration,
    /grant select on table public\.agencies to authenticated/i,
  );
  assert.match(migration, /agencies_select_active_customer_account/);
  assert.match(migration, /public\.has_customer_agency_access\(id\)/);
  assert.equal(migration.includes("service_role"), false);
});

test("rutas de cuenta usan autorización de cliente y el listado seguro de reservaciones", () => {
  const actions = readFileSync("app/cuenta/actions.ts", "utf8");
  const accountPage = readFileSync("app/cuenta/page.tsx", "utf8");
  const reservationsPage = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/page.tsx",
    "utf8",
  );
  const shell = readFileSync("app/cuenta/customer-shell.tsx", "utf8");

  assert.match(actions, /signInWithPassword/);
  assert.match(actions, /auth\.signOut/);
  assert.equal(actions.includes("getSupabaseServerClient"), false);
  assert.equal(actions.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.match(accountPage, /resolveCustomerAgencyAccess/);
  assert.match(reservationsPage, /listCustomerReservations/);
  assert.equal(reservationsPage.includes("resolveCustomerAgencyAccess"), false);
  assert.equal(reservationsPage.includes("reservation_customer_access"), false);
  assert.equal(shell.includes("customerAccountId"), false);
  assert.equal(shell.includes("agencyId"), false);
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
  const authorizationIndex = pageSource.indexOf(
    "resolveAdminAgencyAccess({ requestedAgencySlug: agencySlug })",
  );
  const listingIndex = pageSource.indexOf(
    "createAdminReservationRepository().list",
  );
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
      boardingPointId: departure.boardingOptions[0].agencyDeparturePointId,
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

function adminReservationRow(
  input: Readonly<{
  id: string;
  code: string;
  status: ReservationSnapshot["status"];
  createdAt: string;
  }>,
): AdminReservationListRow {
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
  const trip = travels.find(
    (candidate) => candidate.slug === "barrancas-del-cobre",
  )!;
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
  const { idempotencyKey: _idempotencyKey, ...body } =
    serverReservationRequest();
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
  customerLinkStatus: "not_authenticated" as const,
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
    agencyResolver: {
      async findBySlug() {
        return {
          id: "agency-furiver-persisted",
          slug: "furiver",
          name: "Furiver",
        };
      },
    },
    reservationClient: {
      async list() {
        return [historical, modern];
      },
    },
  });

  const reservations = await repository.list({ agencySlug: "furiver" });
  assert.equal(reservations.length, 2);
  assert.equal(
    reservations[0].rooms,
    modern.snapshot && (modern.snapshot as ReservationSnapshot).rooms,
  );
  assert.equal(reservations[1].rooms, null);
  assert.deepEqual(reservations[1].occupancy, {
    adults: 2,
    minors: 1,
    totalTravelers: 3,
  });
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
    agencyResolver: {
      async findBySlug() {
        return {
          id: "agency-furiver-persisted",
          slug: "furiver",
          name: "Furiver",
        };
      },
    },
    reservationClient: {
      async list() {
        return [{ ...source, snapshot: snapshotWithoutOccupancy }];
      },
    },
  });

  const [reservation] = await repository.list({ agencySlug: "furiver" });
  assert.deepEqual(reservation.occupancy, {
    adults: 2,
    minors: 1,
    totalTravelers: 3,
  });
});

test("listado administrativo marca campos históricos irrecuparables como no disponibles", async () => {
  const source = adminReservationRow({
    id: "reservation-historical-incomplete",
    code: "FT-001-HISTORICAL-INCOMPLETE",
    status: "pending",
    createdAt: "2026-08-02T08:00:00.000Z",
  });
  const snapshot = source.snapshot as ReservationSnapshot;
  const {
    rooms: _rooms,
    occupancy: _occupancy,
    boarding: _boarding,
    ...partialSnapshot
  } = snapshot;
  const repository = createAdminReservationListing({
    agencyResolver: {
      async findBySlug() {
        return {
          id: "agency-furiver-persisted",
          slug: "furiver",
          name: "Furiver",
        };
      },
    },
    reservationClient: {
      async list() {
        return [{ ...source, snapshot: partialSnapshot }];
      },
    },
  });

  const [reservation] = await repository.list({ agencySlug: "furiver" });
  assert.equal(reservation.rooms, null);
  assert.equal(reservation.boardingPointName, null);
  assert.deepEqual(reservation.occupancy, {
    adults: 2,
    minors: 1,
    totalTravelers: 3,
  });

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
    agencyResolver: {
      async findBySlug() {
        return {
          id: "agency-furiver-persisted",
          slug: "furiver",
          name: "Furiver",
        };
      },
    },
    reservationClient: {
      async list() {
        return rows;
      },
    },
  });

  assert.equal(
    (await repository.list({ agencySlug: "furiver", limit: 25 })).length,
    5,
  );
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

const adminDetailReservationId = "0d2b0aa2-d3b0-4cf6-9cb9-cf92641aa001";

function adminReservationDetailRow(
  snapshot: unknown = adminReservationRow({
    id: adminDetailReservationId,
    code: "FT-001-DETAIL",
    status: "pending",
    createdAt: "2026-08-03T08:00:00.000Z",
  }).snapshot,
): AdminReservationDetailRow {
  return {
    id: adminDetailReservationId,
    reservation_code: "FT-001-DETAIL",
    status: "pending",
    currency: "MXN",
    created_at: "2026-08-03T08:00:00.000Z",
    snapshot,
  };
}

function adminReservationTravelerRows() {
  return [
    {
      position: 1,
      traveler_type: "adult",
      status: "complete",
      first_name: "Juan",
      last_name: "Pérez",
    },
    {
      position: 2,
      traveler_type: "adult",
      status: "pending",
      first_name: null,
      last_name: null,
    },
    {
      position: 3,
      traveler_type: "minor",
      status: "pending",
      first_name: null,
      last_name: null,
    },
  ] as const;
}

test("detalle administrativo valida UUID antes de consultar y exige agencia autorizada", async () => {
  let calls = 0;
  const detail = createAdminReservationDetail({
    reservationClient: {
      async find() {
        calls += 1;
        return null;
      },
      async listTravelers() {
        return [];
      },
    },
  });
  await assert.rejects(
    detail.find({ agencyId: "agency-furiver", reservationId: "no-es-uuid" }),
    (error: unknown) =>
      error instanceof AdminReservationDetailError && error.kind === "invalid",
  );
  assert.equal(calls, 0);

  const requests: Array<{ agencyId: string; reservationId: string }> = [];
  const authorized = createAdminReservationDetail({
    reservationClient: {
      async find(input) {
        requests.push(input);
        return adminReservationDetailRow();
      },
      async listTravelers(input) {
        requests.push(input);
        return adminReservationTravelerRows();
      },
    },
  });
  await authorized.find({
    agencyId: "agency-furiver",
    reservationId: adminDetailReservationId,
  });
  assert.deepEqual(requests, [
    { agencyId: "agency-furiver", reservationId: adminDetailReservationId },
    { agencyId: "agency-furiver", reservationId: adminDetailReservationId },
  ]);
});

test("detalle administrativo proyecta snapshots modernos e históricos de forma segura", async () => {
  const modern = adminReservationDetailRow();
  const modernSnapshot = modern.snapshot as ReservationSnapshot;
  const detail = createAdminReservationDetail({
    reservationClient: {
      async find() {
        return modern;
      },
      async listTravelers() {
        return adminReservationTravelerRows();
      },
    },
  });
  const result = await detail.find({
    agencyId: "agency-furiver",
    reservationId: adminDetailReservationId,
  });
  assert.deepEqual(result.occupancy, {
    rooms: modernSnapshot.rooms,
    adults: 2,
    minors: 1,
    totalTravelers: 3,
  });
  assert.equal(result.primaryContact, null);
  assert.equal(result.travelerDataStatus, "pending");
  assert.deepEqual(result.travelers[0], {
    position: 1,
    travelerType: "adult",
    firstName: "Juan",
    lastName: "Pérez",
    status: "complete",
  });
  assert.equal("snapshot" in result, false);
  assert.equal("idempotencyKey" in result, false);
  assert.equal("agencyId" in result, false);

  const {
    rooms: _rooms,
    occupancy: _occupancy,
    ...historical
  } = modernSnapshot;
  const historicalDetail = createAdminReservationDetail({
    reservationClient: {
      async find() {
        return adminReservationDetailRow(historical);
      },
      async listTravelers() {
        return adminReservationTravelerRows();
      },
    },
  });
  const recovered = await historicalDetail.find({
    agencyId: "agency-furiver",
    reservationId: adminDetailReservationId,
  });
  assert.deepEqual(recovered.occupancy, {
    rooms: null,
    adults: 2,
    minors: 1,
    totalTravelers: 3,
  });
  assert.equal(recovered.travelers.length, 3);
});

test("detalle administrativo usa reservation_travelers como fuente canónica y conserva slots pendientes", async () => {
  const snapshot = {
    ...(adminReservationDetailRow().snapshot as ReservationSnapshot),
    travelers: {
      adults: 2,
      minors: 1,
      status: "pending",
      drafts: [
        {
          category: "adult",
          fullName: "Nombre del snapshot",
          completionStatus: "complete",
        },
      ],
    },
  };
  const rows = [
    {
      position: 2,
      traveler_type: "adult",
      status: "pending",
      first_name: null,
      last_name: null,
    },
    {
      position: 3,
      traveler_type: "minor",
      status: "pending",
      first_name: null,
      last_name: null,
    },
    {
      position: 1,
      traveler_type: "adult",
      status: "complete",
      first_name: "Juan Carlos",
      last_name: "Pérez",
    },
  ] as const;
  const snapshotBeforeRead = JSON.stringify(snapshot);
  const detail = createAdminReservationDetail({
    reservationClient: {
      async find() {
        return adminReservationDetailRow(snapshot);
      },
      async listTravelers() {
        return rows;
      },
    },
  });
  const result = await detail.find({
    agencyId: "agency-furiver",
    reservationId: adminDetailReservationId,
  });
  assert.deepEqual(result.travelers, [
    {
      position: 1,
      travelerType: "adult",
      firstName: "Juan Carlos",
      lastName: "Pérez",
      status: "complete",
    },
    {
      position: 2,
      travelerType: "adult",
      firstName: null,
      lastName: null,
      status: "pending",
    },
    {
      position: 3,
      travelerType: "minor",
      firstName: null,
      lastName: null,
      status: "pending",
    },
  ]);
  assert.equal(
    JSON.stringify(result.travelers).includes("Nombre del snapshot"),
    false,
  );
  assert.equal(result.travelerDataStatus, "pending");
  assert.equal(JSON.stringify(snapshot), snapshotBeforeRead);

  const malformed = createAdminReservationDetail({
    reservationClient: {
      async find() {
        return adminReservationDetailRow(snapshot);
      },
      async listTravelers() {
        return rows.slice(0, 2);
      },
    },
  });
  assert.equal(
    (
      await malformed.find({
        agencyId: "agency-furiver",
        reservationId: adminDetailReservationId,
      })
    ).travelerDataStatus,
    "invalid_structure",
  );

  const action = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/traveler-actions.ts",
    "utf8",
  );
  const adminPage = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  assert.match(
    action,
    /revalidatePath\(\s*`\/cuenta\/\$\{encodeURIComponent\(requestedAgencySlug\)\}\/reservaciones\/\$\{reservationId\}`/,
  );
  assert.match(
    action,
    /revalidatePath\(\s*`\/admin\/\$\{encodeURIComponent\(requestedAgencySlug\)\}\/reservaciones\/\$\{reservationId\}`/,
  );
  assert.match(adminPage, /Viajero \$\{traveler\.position\}/);
  assert.match(adminPage, /traveler\.firstName, traveler\.lastName/);
});

test("detalle administrativo mantiene aislamiento y sanea errores internos", async () => {
  const isolated = createAdminReservationDetail({
    reservationClient: {
      async find() {
        return null;
      },
      async listTravelers() {
        return [];
      },
    },
  });
  await assert.rejects(
    isolated.find({
      agencyId: "agency-crisenix",
      reservationId: adminDetailReservationId,
    }),
    (error: unknown) =>
      error instanceof AdminReservationDetailError &&
      error.kind === "not_found",
  );
  const failing = createAdminReservationDetail({
    reservationClient: {
      async find() {
        throw new Error("SQL secret details");
      },
      async listTravelers() {
        return [];
      },
    },
  });
  await assert.rejects(
    failing.find({
      agencyId: "agency-furiver",
      reservationId: adminDetailReservationId,
    }),
    (error: unknown) =>
      error instanceof AdminReservationDetailError &&
      error.kind === "internal" &&
      !error.message.includes("SQL"),
  );
});

test("página de detalle autoriza antes de consultar y repositorio filtra por agencia", () => {
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  assert.ok(
    page.indexOf("resolveAdminAgencyAccess") <
      page.indexOf("createAdminReservationDetailRepository().find"),
  );
  assert.equal(page.includes("error.message"), false);
  const repository = readFileSync(
    "lib/reservations/admin-detail-repository.ts",
    "utf8",
  );
  assert.match(
    repository,
    /\.eq\("id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)/,
  );
  assert.match(
    repository,
    /from\("reservation_travelers"\)[\s\S]*\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)[\s\S]*\.order\("position", \{ ascending: true \}\)/,
  );
});

function customerReservationListingFixture(
  input: Readonly<{
  accounts?: readonly CustomerAgencyAccountRecord[];
  rows?: readonly AdminReservationListRow[];
  total?: number;
  failReservations?: boolean;
  }> = {},
) {
  const requests: Array<{
    customerAccountId: string;
    agencyId: string;
    status?: string;
    limit: number;
    offset: number;
  }> = [];
  const access = customerAccessFixture({
    accounts: input.accounts ?? [customerAccount()],
  });
  const lister = createCustomerReservationLister({
    resolveAccess: access.resolver.resolve,
    reservationRepository: {
      async list(request) {
        requests.push(request);
        if (input.failReservations) throw new Error("snapshot SQL details");
        return {
          rows: input.rows ?? [],
          total: input.total ?? (input.rows ?? []).length,
        };
      },
    },
  });
  return { lister, requests };
}

test("mis reservaciones no consulta vínculos sin cuenta activa o con varias cuentas", async () => {
  let repositoryCreated = false;
  const unauthenticated = createCustomerReservationLister({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    reservationRepository: () => {
      repositoryCreated = true;
      return {
        async list() {
          throw new Error("No debe consultar");
        },
      };
    },
  });
  assert.deepEqual(await unauthenticated.list(), { status: "unauthenticated" });
  assert.equal(repositoryCreated, false);

  const forbidden = customerReservationListingFixture({ accounts: [] });
  assert.deepEqual(await forbidden.lister.list(), { status: "forbidden" });
  assert.deepEqual(forbidden.requests, []);

  const multiple = customerReservationListingFixture({
    accounts: [
      customerAccount(),
      customerAccount({
        customerAccountId: "customer-crisenix",
        agencyId: "agency-crisenix",
        agencySlug: "crisenix",
        agencyName: "Crisenix",
      }),
    ],
  });
  const result = await multiple.lister.list();
  assert.equal(result.status, "selection_required");
  assert.deepEqual(multiple.requests, []);
});

test("mis reservaciones filtra por cuenta y agencia autorizadas, pagina y ordena", async () => {
  const older = adminReservationRow({
    id: "customer-old",
    code: "FT-CUSTOMER-OLD",
    status: "pending",
    createdAt: "2026-08-01T08:00:00.000Z",
  });
  const newer = adminReservationRow({
    id: "customer-new",
    code: "FT-CUSTOMER-NEW",
    status: "confirmed",
    createdAt: "2026-08-02T08:00:00.000Z",
  });
  const { lister, requests } = customerReservationListingFixture({
    rows: [older, newer],
    total: 2,
  });
  const result = await lister.list({
    requestedAgencySlug: "furiver",
    status: "pending",
    limit: 999,
    offset: -3,
  });

  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    assert.equal(result.total, 2);
    assert.equal(result.limit, 50);
    assert.equal(result.offset, 0);
    assert.deepEqual(
      result.items.map((item) => item.reservationCode),
      ["FT-CUSTOMER-NEW", "FT-CUSTOMER-OLD"],
    );
  }
  assert.deepEqual(requests, [
    {
      customerAccountId: "customer-furiver",
      agencyId: "agency-furiver",
      status: "pending",
      limit: 50,
      offset: 0,
    },
  ]);
});

test("cliente autorizado proyecta exclusivamente su reservación vinculada", async () => {
  const linkedReservation = adminReservationRow({
    id: "customer-linked-reservation",
    code: "FT-004-260801-D01B4E",
    status: "pending",
    createdAt: "2026-08-01T08:00:00.000Z",
  });
  const { lister, requests } = customerReservationListingFixture({
    rows: [linkedReservation],
    total: 1,
  });
  const result = await lister.list({
    requestedAgencySlug: "furiver",
    limit: 20,
    offset: 0,
  });

  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    assert.equal(result.total, 1);
    assert.deepEqual(
      result.items.map((item) => item.reservationCode),
      ["FT-004-260801-D01B4E"],
    );
  }
  assert.deepEqual(requests, [
    {
    customerAccountId: "customer-furiver",
    agencyId: "agency-furiver",
    limit: 20,
    offset: 0,
    },
  ]);
});

test("mis reservaciones conserva snapshots históricos y no expone PII ni datos técnicos", async () => {
  const source = adminReservationRow({
    id: "customer-historical",
    code: "FT-CUSTOMER-HIST",
    status: "pending",
    createdAt: "2026-08-02T08:00:00.000Z",
  });
  const snapshot = source.snapshot as ReservationSnapshot;
  const {
    rooms: _rooms,
    occupancy: _occupancy,
    boarding: _boarding,
    ...historical
  } = snapshot;
  const { lister } = customerReservationListingFixture({
    rows: [{ ...source, snapshot: historical }],
  });
  const result = await lister.list({ requestedAgencySlug: "furiver" });
  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    const [item] = result.items;
    assert.deepEqual(item.occupancy, {
      rooms: null,
      adults: 2,
      minors: 1,
      totalTravelers: 3,
    });
    assert.equal(item.trip.boardingPointName, null);
    const serialized = JSON.stringify(item);
    assert.equal(serialized.includes("Dato privado"), false);
    assert.equal(serialized.includes("snapshot"), false);
    assert.equal(serialized.includes("agencyId"), false);
    assert.equal(serialized.includes("customerAccountId"), false);
    assert.equal(serialized.includes("idempotency"), false);
  }
});

test("mis reservaciones sanea filtros, errores y mantiene la separación de clientes", async () => {
  assert.equal(normalizeCustomerReservationStatus("pending"), "pending");
  assert.equal(
    normalizeCustomerReservationStatus("deposit_pending"),
    undefined,
  );
  assert.equal(normalizeCustomerReservationLimit(undefined), 20);
  assert.equal(normalizeCustomerReservationLimit(100), 50);
  assert.equal(normalizeCustomerReservationOffset(-1), 0);

  const otherAccount = customerReservationListingFixture({
    accounts: [customerAccount({ customerAccountId: "another-customer" })],
  });
  await otherAccount.lister.list({ requestedAgencySlug: "furiver" });
  assert.equal(otherAccount.requests[0].customerAccountId, "another-customer");

  const failing = customerReservationListingFixture({ failReservations: true });
  await assert.rejects(
    failing.lister.list({ requestedAgencySlug: "furiver" }),
    (error: unknown) =>
      error instanceof CustomerReservationListError &&
      !error.message.includes("SQL"),
  );

  const repository = readFileSync(
    "lib/customers/customer-reservations-repository.ts",
    "utf8",
  );
  assert.match(repository, /\.eq\("customer_account_id", customerAccountId\)/);
  assert.match(repository, /\.eq\("agency_id", agencyId\)/);
  assert.match(repository, /reservation_snapshots\.agency_id", agencyId/);
  assert.equal(repository.includes("agency_memberships"), false);
});

const customerDetailReservationId = "46a10852-8620-4a59-9187-a21b07ce3f05";

function customerReservationDetailRow(
  snapshot: unknown = adminReservationRow({
  id: customerDetailReservationId,
  code: "FT-004-260801-D01B4E",
  status: "pending",
  createdAt: "2026-08-01T08:00:00.000Z",
  }).snapshot,
) {
  return {
    id: customerDetailReservationId,
    reservation_code: "FT-004-260801-D01B4E",
    status: "pending",
    currency: "MXN" as const,
    created_at: "2026-08-01T08:00:00.000Z",
    snapshot,
  };
}

function customerReservationDetailFixture(
  input: Readonly<{
  accounts?: readonly CustomerAgencyAccountRecord[];
  row?: ReturnType<typeof customerReservationDetailRow> | null;
  failRepository?: boolean;
  }> = {},
) {
  const requests: Array<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
  }> = [];
  const access = customerAccessFixture({
    accounts: input.accounts ?? [customerAccount()],
  });
  const detail = createCustomerReservationDetail({
    resolveAccess: access.resolver.resolve,
    repository: {
      async find(request) {
        requests.push(request);
        if (input.failRepository) throw new Error("SQL detail");
        return input.row === undefined
          ? customerReservationDetailRow()
          : input.row;
      },
    },
  });
  return { detail, requests };
}

test("detalle de cliente valida UUID antes de consultar y exige una cuenta activa", async () => {
  let repositoryCalls = 0;
  const invalid = createCustomerReservationDetail({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async find() {
        repositoryCalls += 1;
        return null;
      },
    },
  });
  assert.deepEqual(
    await invalid.get({
      requestedAgencySlug: "furiver",
      reservationId: "no-es-uuid",
    }),
    { status: "not_found" },
  );
  assert.equal(repositoryCalls, 0);
  assert.equal(isCustomerReservationUuid(customerDetailReservationId), true);

  const unauthenticated = createCustomerReservationDetail({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async find() {
        throw new Error("No debe consultar");
      },
    },
  });
  assert.deepEqual(
    await unauthenticated.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "unauthenticated" },
  );
});

test("detalle de cliente requiere vínculo por cuenta, agencia y reservación", async () => {
  const { detail, requests } = customerReservationDetailFixture();
  const result = await detail.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    assert.equal(result.reservation.reservationCode, "FT-004-260801-D01B4E");
  }
  assert.deepEqual(requests, [
    {
    customerAccountId: "customer-furiver",
    agencyId: "agency-furiver",
    reservationId: customerDetailReservationId,
    },
  ]);

  const absent = customerReservationDetailFixture({ row: null });
  assert.deepEqual(
    await absent.detail.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "not_found" },
  );

  const otherAccount = customerReservationDetailFixture({
    accounts: [customerAccount({ customerAccountId: "another-customer" })],
  });
  await otherAccount.detail.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(otherAccount.requests[0].customerAccountId, "another-customer");
});

test("detalle de cliente mantiene aislamiento frente a otras agencias y cuentas inactivas", async () => {
  const otherTenant = customerReservationDetailFixture();
  assert.deepEqual(
    await otherTenant.detail.get({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(otherTenant.requests, []);

  for (const status of ["invited", "suspended"] as const) {
    const inactive = customerReservationDetailFixture({
      accounts: [customerAccount({ status })],
    });
    assert.deepEqual(
      await inactive.detail.get({
        requestedAgencySlug: "furiver",
        reservationId: customerDetailReservationId,
      }),
      { status: "forbidden" },
    );
  }

  const administratorOnly = customerReservationDetailFixture({ accounts: [] });
  assert.deepEqual(
    await administratorOnly.detail.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
});

test("detalle de cliente proyecta datos modernos, pendientes e históricos sin exponer el snapshot", async () => {
  const modern = customerReservationDetailRow({
    ...(customerReservationDetailRow().snapshot as ReservationSnapshot),
    primaryContact: {
      fullName: "Contacto propio",
      email: "cliente@example.test",
      phone: "5555555555",
    },
  });
  const complete = customerReservationDetailFixture({ row: modern });
  const result = await complete.detail.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    assert.deepEqual(result.reservation.occupancy, {
      rooms: 0,
      adults: 2,
      minors: 1,
      totalTravelers: 3,
    });
    assert.equal(
      result.reservation.primaryContact?.fullName,
      "Contacto propio",
    );
    assert.equal("travelers" in result.reservation, false);
    assert.equal("historicalTravelerDrafts" in result.reservation, false);
    assert.equal(result.reservation.travelerDataStatus, "pending");
    assert.equal("snapshot" in result.reservation, false);
    assert.equal("agencyId" in result.reservation, false);
    assert.equal("customerAccountId" in result.reservation, false);
    assert.equal("idempotencyKey" in result.reservation, false);
  }

  const source = customerReservationDetailRow().snapshot as ReservationSnapshot;
  const {
    rooms: _rooms,
    occupancy: _occupancy,
    boarding: _boarding,
    travelers: _travelers,
    ...historical
  } = source;
  const historicalResult = await customerReservationDetailFixture({
    row: customerReservationDetailRow(historical),
  }).detail.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(historicalResult.status, "authorized");
  if (historicalResult.status === "authorized") {
    assert.deepEqual(historicalResult.reservation.occupancy, {
      rooms: null,
      adults: null,
      minors: null,
      totalTravelers: null,
    });
    assert.equal(historicalResult.reservation.trip.boardingPointName, null);
    assert.equal(
      "historicalTravelerDrafts" in historicalResult.reservation,
      false,
    );
    assert.equal(historicalResult.reservation.primaryContact, null);
  }
});

test("detalle de cliente sanea errores internos y la UI mantiene navegación protegida", async () => {
  const failing = customerReservationDetailFixture({ failRepository: true });
  await assert.rejects(
    failing.detail.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    (error: unknown) =>
      error instanceof CustomerReservationDetailError &&
      !error.message.includes("SQL"),
  );

  assert.equal(
    customerReservationDetailNextStep("pending"),
    "Tu reservación está recibida. Sigue las instrucciones de la agencia para completar tu anticipo.",
  );
  const listPage = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/page.tsx",
    "utf8",
  );
  const detailPage = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const repository = readFileSync(
    "lib/customers/customer-reservation-detail-repository.ts",
    "utf8",
  );
  assert.match(listPage, /Ver reservación/);
  assert.match(detailPage, /Volver a Mis reservaciones/);
  assert.equal(detailPage.includes("resolveCustomerAgencyAccess"), false);
  assert.match(repository, /\.eq\("customer_account_id", customerAccountId\)/);
  assert.match(repository, /\.eq\("agency_id", agencyId\)/);
  assert.match(repository, /\.eq\("reservation_id", reservationId\)/);
  assert.match(repository, /reservation_snapshots\.agency_id", agencyId/);
});

function travelerSlotFixture(
  input: Readonly<{
  accounts?: readonly CustomerAgencyAccountRecord[];
  row?: ReturnType<typeof customerReservationDetailRow> | null;
  slots?: readonly ReservationTravelerSlotRow[];
  failRepository?: boolean;
  }> = {},
) {
  const reads: Array<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
  }> = [];
  const inserts: Array<
    readonly { position: number; travelerType: "adult" | "minor" }[]
  > = [];
  const slotRows = [...(input.slots ?? [])];
  const access = customerAccessFixture({
    accounts: input.accounts ?? [customerAccount()],
  });
  const ensurer = createReservationTravelerSlotEnsurer({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findAuthorizedReservation(request) {
        reads.push(request);
        if (input.failRepository) throw new Error("SQL traveler details");
        const row =
          input.row === undefined ? customerReservationDetailRow() : input.row;
        return row ? { snapshot: row, slots: slotRows } : null;
      },
      async insertMissing(request) {
        inserts.push(request.slots);
        for (const slot of request.slots) {
          if (
            !slotRows.some((existing) => existing.position === slot.position)
          ) {
            slotRows.push({
              id: `slot-${slot.position}`,
              position: slot.position,
              traveler_type: slot.travelerType,
              status: "pending",
            });
          }
        }
      },
    },
  });
  return { ensurer, reads, inserts, slotRows };
}

test("slots operativos validan UUID y autorización antes de cualquier lectura o escritura", async () => {
  let repositoryCreated = false;
  const invalid = createReservationTravelerSlotEnsurer({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: () => {
      repositoryCreated = true;
      return {
        async findAuthorizedReservation() {
          throw new Error("No debe consultar");
        },
        async insertMissing() {},
      };
    },
  });
  assert.deepEqual(
    await invalid.ensure({
      requestedAgencySlug: "furiver",
      reservationId: "no-es-uuid",
    }),
    { status: "not_found" },
  );
  assert.equal(repositoryCreated, false);

  const unauthenticated = createReservationTravelerSlotEnsurer({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async findAuthorizedReservation() {
        throw new Error("No debe consultar");
      },
      async insertMissing() {},
    },
  });
  assert.deepEqual(
    await unauthenticated.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "unauthenticated" },
  );

  const forbidden = travelerSlotFixture();
  assert.deepEqual(
    await forbidden.ensurer.ensure({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(forbidden.reads, []);

  const notLinked = travelerSlotFixture({ row: null });
  assert.deepEqual(
    await notLinked.ensurer.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "not_found" },
  );

  const otherCustomer = travelerSlotFixture({
    accounts: [customerAccount({ customerAccountId: "another-customer" })],
  });
  await otherCustomer.ensurer.ensure({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(otherCustomer.reads[0].customerAccountId, "another-customer");

  const suspended = travelerSlotFixture({
    accounts: [customerAccount({ status: "suspended" })],
  });
  assert.deepEqual(
    await suspended.ensurer.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(suspended.reads, []);
});

test("slots operativos derivan adultos y menores del snapshot, de forma determinista e idempotente", async () => {
  assert.deepEqual(buildTravelerSlotStructure({ adults: 2, minors: 1 }), [
    { position: 1, travelerType: "adult" },
    { position: 2, travelerType: "adult" },
    { position: 3, travelerType: "minor" },
  ]);
  assert.deepEqual(buildTravelerSlotStructure({ adults: 1, minors: 2 }), [
    { position: 1, travelerType: "adult" },
    { position: 2, travelerType: "minor" },
    { position: 3, travelerType: "minor" },
  ]);

  const fixture = travelerSlotFixture();
  const first = await fixture.ensurer.ensure({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(first.status, "ready");
  if (first.status === "ready") {
    assert.deepEqual(
      first.slots.map(({ position, travelerType, status }) => ({
        position,
        travelerType,
        status,
      })),
      [
      { position: 1, travelerType: "adult", status: "pending" },
      { position: 2, travelerType: "adult", status: "pending" },
      { position: 3, travelerType: "minor", status: "pending" },
      ],
    );
    assert.equal(JSON.stringify(first).includes("agencyId"), false);
    assert.equal(JSON.stringify(first).includes("customerAccountId"), false);
    assert.equal(JSON.stringify(first).includes("snapshot"), false);
  }
  assert.equal(fixture.inserts.length, 1);
  const second = await fixture.ensurer.ensure({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.deepEqual(second, first);
  assert.equal(fixture.inserts.length, 1);
  assert.deepEqual(fixture.reads[0], {
    customerAccountId: "customer-furiver",
    agencyId: "agency-furiver",
    reservationId: customerDetailReservationId,
  });
});

test("slots operativos completan solo posiciones faltantes y nunca sobrescriben slots existentes", async () => {
  const fixture = travelerSlotFixture({
    slots: [
      {
        id: "existing-adult",
        position: 1,
        traveler_type: "adult",
        status: "complete",
      },
    ],
  });
  const result = await fixture.ensurer.ensure({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.slots[0].id, "existing-adult");
    assert.equal(result.slots[0].status, "complete");
  }
  assert.deepEqual(fixture.inserts, [
    [
    { position: 2, travelerType: "adult" },
    { position: 3, travelerType: "minor" },
    ],
  ]);
});

test("slots operativos rechazan estructuras ambiguas o incompatibles sin escribir", async () => {
  const source = customerReservationDetailRow().snapshot as ReservationSnapshot;
  const frozenSource = JSON.stringify(source);
  const {
    occupancy: _occupancy,
    travelers: _travelers,
    ...ambiguousSnapshot
  } = source;
  const ambiguous = travelerSlotFixture({
    row: customerReservationDetailRow(ambiguousSnapshot),
  });
  assert.deepEqual(
    await ambiguous.ensurer.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "invalid_structure" },
  );
  assert.deepEqual(ambiguous.inserts, []);

  const incompatible = travelerSlotFixture({
    slots: [
      {
        id: "wrong-type",
        position: 1,
        traveler_type: "minor",
        status: "pending",
      },
    ],
  });
  assert.deepEqual(
    await incompatible.ensurer.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "invalid_structure" },
  );
  assert.deepEqual(incompatible.inserts, []);

  const recoverable = { ...source, occupancy: undefined };
  assert.deepEqual(
    deriveTravelerSlotStructure(customerReservationDetailRow(recoverable)),
    buildTravelerSlotStructure({ adults: 2, minors: 1 }),
  );
  assert.equal(JSON.stringify(source), frozenSource);

  const failing = travelerSlotFixture({ failRepository: true });
  await assert.rejects(
    failing.ensurer.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    (error: unknown) =>
      error instanceof TravelerSlotsError && !error.message.includes("SQL"),
  );
  const repository = readFileSync(
    "lib/travelers/traveler-slots-repository.ts",
    "utf8",
  );
  assert.match(repository, /\.eq\("customer_account_id", customerAccountId\)/);
  assert.match(repository, /\.eq\("agency_id", agencyId\)/);
  assert.match(repository, /\.eq\("reservation_id", reservationId\)/);
  assert.match(
    repository,
    /onConflict: "reservation_id,position", ignoreDuplicates: true/,
  );
  assert.equal(repository.includes("first_name"), false);
});

test("detalle de cliente lee viajeros canónicos sin materializar durante GET", () => {
  const page = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const detailIndex = page.indexOf("getCustomerReservationDetail({");
  const travelerReadIndex = page.indexOf("getReservationTravelerData({");
  assert.ok(detailIndex >= 0 && travelerReadIndex > detailIndex);
  assert.equal(page.includes("ensureReservationTravelerSlots"), false);
  assert.match(page, /Viajero \{traveler\.position\}/);
  assert.match(
    page,
    /traveler\.travelerType === "adult" \? "Adulto" : "Menor"/,
  );
  assert.match(
    page,
    /traveler\.status === "complete" \? "Datos completos" : "Datos pendientes"/,
  );
  assert.match(page, /Datos de viajeros pendientes de completar/);
  assert.match(page, /Datos de viajeros completos/);
  assert.match(
    page,
    /No fue posible preparar los datos de viajeros de esta reservación/,
  );
  assert.equal(page.includes("reservation.historicalTravelerDrafts"), false);
  assert.equal(page.includes("reservation.travelers"), false);
  assert.equal(page.includes("traveler.fullName"), false);
  assert.match(page, /getReservationTravelerData/);
  assert.match(page, /<TravelerDataForm/);
  assert.match(page, /travelerId=\{traveler\.travelerId\}/);

  const styles = readFileSync("app/cuenta/cuenta.module.css", "utf8");
  assert.match(
    styles,
    /\.travelerSlotGrid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,
  );
  assert.match(
    styles,
    /@media\(max-width:760px\)\{\.travelerSlotGrid\{grid-template-columns:1fr\}\}/,
  );
});

test("materialización ignora draft.id y aísla dos reservaciones del mismo tour y salida", async () => {
  const reservationA = "aa110852-8620-4a59-9187-a21b07ce3f05";
  const reservationB = "bb110852-8620-4a59-9187-a21b07ce3f05";
  const agencyId = "cc110852-8620-4a59-9187-a21b07ce3f05";
  const snapshot = (
    reservationId: string,
    fullName: string,
  ): ReservationSnapshot => {
    const base = finalizedReservationForRepository(
      `travelers-${reservationId}`,
    );
    return {
      ...base,
      id: reservationId,
      occupancy: { adults: 1, minors: 0, totalTravelers: 1 },
      travelers: {
        status: "complete",
        adults: 1,
        minors: 0,
        drafts: [
          {
            id: "trip-4-trip-4-dep-2-adult-1",
            category: "adult",
            sequence: 1,
            fullName,
            birthDate: "1992-01-25",
            completionStatus: "complete",
          },
        ],
      },
    };
  };
  const snapshotA = snapshot(reservationA, "Alice Example");
  const snapshotB = snapshot(reservationB, "Bob Example");
  const rows = new Map<string, ReservationTravelerDataRow[]>();
  const materializer = createReservationTravelerMaterializer({
    repository: {
      async insertMissing(input) {
        if (rows.has(input.reservationId)) return;
        rows.set(
          input.reservationId,
          input.travelers.map((traveler, index) => ({
            id:
              input.reservationId === reservationA
                ? `1${index}110852-8620-4a59-9187-a21b07ce3f05`
                : `2${index}110852-8620-4a59-9187-a21b07ce3f05`,
            position: traveler.position,
            traveler_type: traveler.travelerType,
            status: traveler.status,
            first_name: traveler.firstName,
            last_name: traveler.lastName,
            birth_date: traveler.birthDate,
          })),
        );
      },
    },
  });
  const frozenA = JSON.stringify(snapshotA);
  await materializer.materialize({
    agencyId,
    reservationId: reservationA,
    snapshot: snapshotA,
  });
  await materializer.materialize({
    agencyId,
    reservationId: reservationB,
    snapshot: snapshotB,
  });

  assert.equal(rows.get(reservationA)?.[0]?.first_name, "Alice");
  assert.equal(rows.get(reservationB)?.[0]?.first_name, "Bob");
  assert.notEqual(
    rows.get(reservationA)?.[0]?.id,
    rows.get(reservationB)?.[0]?.id,
  );
  assert.equal(JSON.stringify(snapshotA), frozenA);
  assert.deepEqual(projectReservationTravelerMaterialization(snapshotA)[0], {
    position: 1,
    travelerType: "adult",
    firstName: "Alice",
    lastName: "Example",
    birthDate: "1992-01-25",
    status: "complete",
  });

  const service = createReservationTravelerDataService({
    resolveAccess: customerAccessFixture({
      accounts: [customerAccount({ agencyId })],
    }).resolver.resolve,
    repository: {
      async listAuthorized(input) {
        return rows.get(input.reservationId) ?? null;
      },
      async updateAuthorized(input) {
        const reservationRows = rows.get(input.reservationId);
        const row = reservationRows?.find(
          (candidate) =>
            candidate.id === input.travelerId &&
            candidate.position === input.position,
        );
        if (!row) return null;
        const updated = {
          ...row,
          first_name: input.firstName,
          last_name: input.lastName,
          birth_date: input.birthDate,
          status: "complete",
        };
        reservationRows![reservationRows!.indexOf(row)] = updated;
        return updated;
      },
    },
  });
  const travelerAId = rows.get(reservationA)![0].id;
  const travelerBId = rows.get(reservationB)![0].id;
  assert.equal(
    (
      await service.save({
        requestedAgencySlug: "furiver",
        reservationId: reservationB,
        travelerId: travelerAId,
        position: 1,
        firstName: "Intruso",
        lastName: "Cross",
        birthDate: "1990-01-01",
      })
    ).status,
    "not_found",
  );
  assert.equal(rows.get(reservationA)?.[0]?.first_name, "Alice");
  assert.equal(rows.get(reservationB)?.[0]?.first_name, "Bob");
  assert.equal(
    (
      await service.save({
        requestedAgencySlug: "furiver",
        reservationId: reservationB,
        travelerId: travelerBId,
        position: 1,
        firstName: "Robert",
        lastName: "Example",
        birthDate: "1992-01-25",
      })
    ).status,
    "saved",
  );
  assert.equal(rows.get(reservationB)?.[0]?.first_name, "Robert");
  assert.equal(rows.get(reservationA)?.[0]?.first_name, "Alice");
});

test("materialización crea slots pending vacíos y forma parte del comando de creación", () => {
  const base = finalizedReservationForRepository(
    "pending-traveler-materialization",
  );
  const pending = {
    ...base,
    id: customerDetailReservationId,
    travelers: {
      status: "pending" as const,
      adults: 2,
      minors: 1,
      drafts: [],
    },
  };
  assert.deepEqual(projectReservationTravelerMaterialization(pending), [
    {
      position: 1,
      travelerType: "adult",
      firstName: null,
      lastName: null,
      birthDate: null,
      status: "pending",
    },
    {
      position: 2,
      travelerType: "adult",
      firstName: null,
      lastName: null,
      birthDate: null,
      status: "pending",
    },
    {
      position: 3,
      travelerType: "minor",
      firstName: null,
      lastName: null,
      birthDate: null,
      status: "pending",
    },
  ]);

  const command = readFileSync("lib/reservations/server-command.ts", "utf8");
  const persisted = command.indexOf("await atomicPersistence.persist(");
  const materialized = command.indexOf(
    "await travelerMaterialization.materializeReservationTravelers(",
  );
  assert.ok(persisted >= 0 && materialized > persisted);
  assert.match(command, /reservationId: persisted\.reservation\.id/);
});

test("reconciliación histórica usa sólo drafts de la misma reservación y jamás sobrescribe datos canónicos", () => {
  const agencyId = "cc110852-8620-4a59-9187-a21b07ce3f05";
  const reservationA = "aa110852-8620-4a59-9187-a21b07ce3f05";
  const reservationB = "bb110852-8620-4a59-9187-a21b07ce3f05";
  const snapshot = (
    reservationId: string,
    fullName: string,
  ): ReservationSnapshot => {
    const base = finalizedReservationForRepository(
      `reconcile-${reservationId}`,
    );
    return {
      ...base,
      id: reservationId,
      occupancy: { adults: 1, minors: 0, totalTravelers: 1 },
      travelers: {
        status: "complete",
        adults: 1,
        minors: 0,
        drafts: [
          {
            // This collision is deliberately harmless: draft.id is ignored.
            id: "trip-4-trip-4-dep-2-adult-1",
            category: "adult",
            sequence: 1,
            fullName,
            birthDate: "1992-01-25",
            completionStatus: "complete",
          },
        ],
      },
    };
  };
  const reservation = (
    reservationId: string,
    code: string,
    fullName: string,
  ) => ({
    reservationId,
    agencyId,
    reservationCode: code,
    snapshot: snapshot(reservationId, fullName),
  });
  const emptyRow = (
    reservationId: string,
  ): HistoricalReservationTravelerRow => ({
    id: `${reservationId.slice(0, 2)}110852-8620-4a59-9187-a21b07ce3f05`,
    agency_id: agencyId,
    reservation_id: reservationId,
    position: 1,
    traveler_type: "adult",
    first_name: null,
    last_name: null,
    birth_date: null,
    status: "pending",
  });

  const planA = planReservationTravelerReconciliation({
    reservation: reservation(reservationA, "FT-A", "Alice Example"),
    travelers: [],
  });
  const planB = planReservationTravelerReconciliation({
    reservation: reservation(reservationB, "FT-B", "Bob Example"),
    travelers: [emptyRow(reservationB)],
  });
  assert.deepEqual(planA, {
    status: "candidate",
    missingSlots: 1,
    emptySlots: 0,
    pendingWithoutSourceSlots: 0,
    preservedSlots: 0,
  });
  assert.deepEqual(planB, {
    status: "candidate",
    missingSlots: 0,
    emptySlots: 1,
    pendingWithoutSourceSlots: 0,
    preservedSlots: 0,
  });

  const preserved = planReservationTravelerReconciliation({
    reservation: reservation(reservationB, "FT-B", "Alice Example"),
    travelers: [
      {
        ...emptyRow(reservationB),
        first_name: "Charlie",
        last_name: "Canonical",
        birth_date: "1990-01-01",
        status: "complete",
      },
    ],
  });
  assert.deepEqual(preserved, {
    status: "no_action",
    missingSlots: 0,
    emptySlots: 0,
    pendingWithoutSourceSlots: 0,
    preservedSlots: 1,
  });
  assert.equal(
    JSON.stringify(snapshot(reservationA, "Alice Example")).includes(
      "Bob Example",
    ),
    false,
  );
});

test("draft pending vacío no convierte un slot canonical vacío en write de reconciliación", () => {
  const agencyId = "cc110852-8620-4a59-9187-a21b07ce3f05";
  const reservationId = "dd110852-8620-4a59-9187-a21b07ce3f05";
  const base = finalizedReservationForRepository("reconcile-empty-pending");
  const snapshot: ReservationSnapshot = {
    ...base,
    id: reservationId,
    occupancy: { adults: 2, minors: 0, totalTravelers: 2 },
    travelers: {
      status: "pending",
      adults: 2,
      minors: 0,
      drafts: [
        {
          id: "trip-4-trip-4-dep-2-adult-1",
          category: "adult",
          sequence: 1,
          fullName: "",
          birthDate: undefined,
          completionStatus: "pending",
        },
        {
          id: "trip-4-trip-4-dep-2-adult-2",
          category: "adult",
          sequence: 2,
          fullName: "",
          birthDate: undefined,
          completionStatus: "pending",
        },
      ],
    },
  };
  const emptyRow = (position: number): HistoricalReservationTravelerRow => ({
    id: `${position}d110852-8620-4a59-9187-a21b07ce3f05`,
    agency_id: agencyId,
    reservation_id: reservationId,
    position,
    traveler_type: "adult",
    first_name: null,
    last_name: null,
    birth_date: null,
    status: "pending",
  });
  const input = {
    reservation: {
      reservationId,
      agencyId,
      reservationCode: "FT-PENDING",
      snapshot,
    },
    travelers: [emptyRow(1), emptyRow(2)],
  };

  const plan = planReservationTravelerReconciliation(input);
  assert.deepEqual(plan, {
    status: "no_action",
    missingSlots: 0,
    emptySlots: 0,
    pendingWithoutSourceSlots: 2,
    preservedSlots: 0,
  });
  assert.deepEqual(planReservationTravelerReconciliation(input), plan);
  assert.equal(
    hasMaterializableTravelerData({
      position: 1,
      travelerType: "adult",
      firstName: null,
      lastName: null,
      birthDate: null,
      status: "pending",
    }),
    false,
  );
  assert.equal(
    hasMaterializableTravelerData({
      position: 1,
      travelerType: "adult",
      firstName: "Angel",
      lastName: "Fuentes",
      birthDate: "1992-01-25",
      status: "complete",
    }),
    true,
  );
});

test("herramienta de reconciliación de viajeros es dry-run por defecto y delega toda escritura a la RPC tenant-safe", () => {
  assert.equal(parseReservationTravelerReconciliationArgs([]), "dry-run");
  assert.equal(
    parseReservationTravelerReconciliationArgs([
      `--confirm=${RESERVATION_TRAVELER_RECONCILIATION_CONFIRMATION}`,
    ]),
    "confirmed",
  );
  assert.throws(() =>
    parseReservationTravelerReconciliationArgs(["--confirm=force"]),
  );

  const script = readFileSync(
    "scripts/reconcile-reservation-travelers.ts",
    "utf8",
  );
  const migration = readFileSync(
    "supabase/migrations/20260801290000_reconcile_reservation_travelers_noop_guard.sql",
    "utf8",
  );
  assert.match(script, /preflightRequiredTables/);
  assert.match(script, /select\("\*", \{ count: "exact", head: true \}\)/);
  assert.match(script, /reconcile_reservation_travelers_atomic/);
  assert.doesNotMatch(
    script,
    /\.from\("reservation_travelers"\)\.(insert|update|delete)/,
  );
  assert.match(
    migration,
    /create or replace function public\.reconcile_reservation_travelers_atomic/,
  );
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public, pg_temp/i);
  assert.match(
    migration,
    /reservation\.id = target_reservation_id[\s\S]*reservation\.agency_id = target_agency_id[\s\S]*for update/i,
  );
  assert.match(
    migration,
    /traveler\.agency_id = target_agency_id[\s\S]*traveler\.reservation_id = target_reservation_id[\s\S]*traveler\.position = traveler_position/i,
  );
  assert.match(
    migration,
    /status = 'pending'[\s\S]*first_name is null[\s\S]*last_name is null[\s\S]*birth_date is null/i,
  );
  assert.match(
    migration,
    /first_name_value is null[\s\S]*last_name_value is null[\s\S]*birth_date_value is null[\s\S]*traveler_status = 'pending'[\s\S]*intentionally do not update/i,
  );
  assert.match(script, /Slots pendientes sin datos fuente/);
  assert.match(migration, /from public, anon, authenticated/i);
  assert.match(migration, /to service_role/i);
  assert.doesNotMatch(migration, /draft\s*->>\s*'id'/i);
});

test("cada intento Lavella usa drafts locales distintos y limpia el carrito al confirmar", () => {
  const scopeA = createTravelerDraftAttemptScope(
    "trip-4",
    "trip-4-dep-2",
    "attempt-a",
  );
  const scopeB = createTravelerDraftAttemptScope(
    "trip-4",
    "trip-4-dep-2",
    "attempt-b",
  );
  const draftA = createTravelerDrafts(1, 0, scopeA)[0];
  const draftB = createTravelerDrafts(1, 0, scopeB)[0];
  assert.notEqual(draftA.id, draftB.id);
  assert.equal(isTravelerDraftAttemptScoped(draftA.id), true);
  assert.equal(
    isTravelerDraftAttemptScoped("trip-4-trip-4-dep-2-adult-1"),
    false,
  );

  const panel = readFileSync(
    "components/themes/lavella/lavella-booking-panel.tsx",
    "utf8",
  );
  assert.match(
    panel,
    /createTravelerDraftAttemptScope\(trip\.id, departure\.id\)/,
  );
  assert.equal(panel.includes("previousDrafts"), false);
  const checkout = readFileSync("components/legacy-travel-app.tsx", "utf8");
  assert.match(checkout, /hasUnscopedLavellaTravelerData/);
  assert.match(checkout, /travelerDataStatus: "pending"/);
  assert.match(checkout, /localStorage\.removeItem\("fu-travel-demo-cart"\)/);
  assert.match(
    checkout,
    /localStorage\.removeItem\("fu-travel-booking-draft"\)/,
  );
});

function travelerDataFixture(
  input: Readonly<{
  accounts?: readonly CustomerAgencyAccountRecord[];
  linked?: boolean;
  rows?: readonly ReservationTravelerDataRow[];
  failRepository?: boolean;
  }> = {},
) {
  const travelerIds = [
    "11a10852-8620-4a59-9187-a21b07ce3f05",
    "22a10852-8620-4a59-9187-a21b07ce3f05",
    "33a10852-8620-4a59-9187-a21b07ce3f05",
  ];
  const rows = [
    ...(input.rows ?? [
      {
        id: travelerIds[0],
        position: 1,
        traveler_type: "adult",
        status: "pending",
        first_name: null,
        last_name: null,
        birth_date: null,
      },
      {
        id: travelerIds[1],
        position: 2,
        traveler_type: "adult",
        status: "complete",
        first_name: "Ana",
        last_name: "Pérez",
        birth_date: "1990-02-03",
      },
      {
        id: travelerIds[2],
        position: 3,
        traveler_type: "minor",
        status: "pending",
        first_name: null,
        last_name: null,
        birth_date: null,
      },
    ]),
  ];
  const requests: Array<Record<string, unknown>> = [];
  const access = customerAccessFixture({
    accounts: input.accounts ?? [customerAccount()],
  });
  const service = createReservationTravelerDataService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async listAuthorized(request) {
        requests.push({ kind: "list", ...request });
        if (input.failRepository) throw new Error("SQL traveler PII");
        return input.linked === false ? null : rows;
      },
      async updateAuthorized(request) {
        requests.push({ kind: "update", ...request });
        if (input.failRepository) throw new Error("SQL traveler PII");
        if (input.linked === false) return null;
        const index = rows.findIndex(
          (row) =>
            row.id === request.travelerId && row.position === request.position,
        );
        if (index < 0) return null;
        const existing = rows[index];
        const updated: ReservationTravelerDataRow = {
          ...existing,
          first_name: request.firstName,
          last_name: request.lastName,
          birth_date: request.birthDate,
          status: "complete",
        };
        rows[index] = updated;
        return updated;
      },
    },
  });
  return { service, rows, requests };
}

test("datos operativos de viajeros se leen solo después de autorización y sin IDs internos", async () => {
  let repositoryCreated = false;
  const unauthenticated = createReservationTravelerDataService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: () => {
      repositoryCreated = true;
      return {
        async listAuthorized() {
          throw new Error("No debe leer PII");
        },
        async updateAuthorized() {
          throw new Error("No debe escribir PII");
        },
      };
    },
  });
  assert.deepEqual(
    await unauthenticated.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "unauthenticated" },
  );
  assert.equal(repositoryCreated, false);

  const invalid = travelerDataFixture();
  assert.deepEqual(
    await invalid.service.get({
      requestedAgencySlug: "furiver",
      reservationId: "no-es-uuid",
    }),
    { status: "not_found" },
  );
  assert.deepEqual(invalid.requests, []);

  const fixture = travelerDataFixture();
  const result = await fixture.service.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    assert.deepEqual(
      result.travelers.map((traveler) => [
        traveler.position,
        traveler.travelerType,
      ]),
      [
        [1, "adult"],
        [2, "adult"],
        [3, "minor"],
      ],
    );
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes("agencyId"), false);
    assert.equal(serialized.includes("customerAccountId"), false);
    assert.equal(serialized.includes("snapshot"), false);
    assert.equal(serialized.includes("idempotency"), false);
  }
  assert.deepEqual(fixture.requests[0], {
    kind: "list",
    customerAccountId: "customer-furiver",
    agencyId: "agency-furiver",
    reservationId: customerDetailReservationId,
  });
});

test("datos operativos aíslan reservaciones, cuentas y agencias ajenas", async () => {
  const unlinked = travelerDataFixture({ linked: false });
  assert.deepEqual(
    await unlinked.service.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "not_found" },
  );

  const otherAgency = travelerDataFixture();
  assert.deepEqual(
    await otherAgency.service.get({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(otherAgency.requests, []);

  const otherCustomer = travelerDataFixture({
    accounts: [customerAccount({ customerAccountId: "another-customer" })],
  });
  await otherCustomer.service.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(otherCustomer.requests[0].customerAccountId, "another-customer");

  const suspended = travelerDataFixture({
    accounts: [customerAccount({ status: "suspended" })],
  });
  assert.deepEqual(
    await suspended.service.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(suspended.requests, []);
});

test("datos de viajeros validan, normalizan y actualizan solo las columnas permitidas", async () => {
  const travelerId = "11a10852-8620-4a59-9187-a21b07ce3f05";
  assert.ok(
    "errors" in
      validateReservationTravelerData({
        travelerId,
        position: 1,
        firstName: "",
        lastName: "Pérez",
        birthDate: "1990-01-01",
      }),
  );
  assert.ok(
    "errors" in
      validateReservationTravelerData({
        travelerId,
        position: 1,
        firstName: "Ana",
        lastName: "",
        birthDate: "1990-01-01",
      }),
  );
  assert.ok(
    "errors" in
      validateReservationTravelerData({
        travelerId,
        position: 1,
        firstName: "Ana",
        lastName: "Pérez",
        birthDate: "fecha",
      }),
  );
  assert.ok(
    "errors" in
      validateReservationTravelerData({
        travelerId,
        position: 1,
        firstName: "Ana",
        lastName: "Pérez",
        birthDate: "2999-01-01",
      }),
  );
  assert.deepEqual(
    validateReservationTravelerData({
      travelerId,
      position: 1,
      firstName: "  Ana  ",
      lastName: "  Pérez  ",
      birthDate: "1990-01-01",
    }),
    {
      value: {
        travelerId,
        position: 1,
        firstName: "Ana",
        lastName: "Pérez",
        birthDate: "1990-01-01",
      },
    },
  );

  const fixture = travelerDataFixture();
  const originalType = fixture.rows[0].traveler_type;
  const saved = await fixture.service.save({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    travelerId,
    position: 1,
    firstName: "  Sofía ",
    lastName: "  Rivera ",
    birthDate: "1991-04-05",
  });
  assert.equal(saved.status, "saved");
  if (saved.status === "saved") {
    assert.deepEqual(saved.traveler, {
      travelerId,
      position: 1,
      travelerType: "adult",
      status: "complete",
      firstName: "Sofía",
      lastName: "Rivera",
      birthDate: "1991-04-05",
    });
  }
  assert.equal(fixture.rows[0].traveler_type, originalType);
  assert.equal(fixture.rows[0].position, 1);
  assert.ok(fixture.requests.some((request) => request.kind === "update"));
  assert.equal("agencyId" in fixture.rows[0], false);
  const reloaded = await fixture.service.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(reloaded.status, "authorized");
  if (reloaded.status === "authorized") {
    assert.equal(reloaded.travelers[0].firstName, "Sofía");
    assert.equal(reloaded.travelers[0].status, "complete");
    assert.equal(
      reloaded.travelers.some((traveler) => traveler.status === "pending"),
      true,
    );
  }
});

test("repositorio de datos de viajeros conserva el alcance y sanea errores", async () => {
  const missingSlot = travelerDataFixture({ rows: [] });
  assert.deepEqual(
    await missingSlot.service.save({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      position: 1,
      travelerId: "11a10852-8620-4a59-9187-a21b07ce3f05",
      firstName: "Ana",
      lastName: "Pérez",
      birthDate: "1990-01-01",
    }),
    { status: "not_found" },
  );
  const failing = travelerDataFixture({ failRepository: true });
  await assert.rejects(
    failing.service.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    (error: unknown) =>
      error instanceof TravelerDataError && !error.message.includes("SQL"),
  );
  const repository = readFileSync(
    "lib/travelers/traveler-data-repository.ts",
    "utf8",
  );
  assert.match(
    repository,
    /\.eq\("customer_account_id", input\.customerAccountId\)/,
  );
  assert.match(repository, /\.eq\("agency_id", input\.agencyId\)/);
  assert.match(repository, /\.eq\("reservation_id", input\.reservationId\)/);
  assert.match(repository, /\.eq\("id", input\.travelerId\)/);
  assert.match(repository, /\.eq\("position", input\.position\)/);
  assert.match(
    repository,
    /\.update\(\{[\s\S]*first_name:[\s\S]*last_name:[\s\S]*birth_date:[\s\S]*status: "complete"/,
  );
  assert.equal(repository.includes("traveler_type:"), false);
});

function financialReservationRow(
  input: Readonly<{
  total?: number;
  depositPercent?: number | null;
  depositRequired?: number | null;
  currency?: "MXN" | "USD";
  snapshot?: unknown;
  }> = {},
) {
  const source = customerReservationDetailRow();
  const snapshot = source.snapshot as ReservationSnapshot;
  return {
    ...source,
    currency: input.currency ?? "MXN",
    snapshot: input.snapshot ?? {
      ...snapshot,
      total: input.total ?? 47817,
      depositPercent:
        input.depositPercent === undefined ? 20 : input.depositPercent,
      depositAmount:
        input.depositRequired === undefined ? 9563.4 : input.depositRequired,
    },
  };
}

function financialSummaryFixture(
  input: Readonly<{
  accounts?: readonly CustomerAgencyAccountRecord[];
  linked?: boolean;
  row?: ReturnType<typeof financialReservationRow>;
  payments?: readonly ReservationPaymentFinancialRow[];
  failRepository?: boolean;
  }> = {},
) {
  const requests: Array<{
    customerAccountId: string;
    agencyId: string;
    reservationId: string;
  }> = [];
  const access = customerAccessFixture({
    accounts: input.accounts ?? [customerAccount()],
  });
  const service = createReservationFinancialSummaryService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findAuthorized(request) {
        requests.push(request);
        if (input.failRepository) throw new Error("SQL payment references");
        return input.linked === false
          ? null
          : {
              snapshot: input.row ?? financialReservationRow(),
              payments: input.payments ?? [],
            };
      },
    },
  });
  return { service, requests };
}

test("resumen financiero calcula el contrato en centavos y solo pagos confirmados reducen saldo", () => {
  const base = financialReservationRow();
  const noPayments = calculateReservationFinancialSummary({
    snapshot: base,
    payments: [],
  });
  assert.deepEqual(noPayments, {
    currency: "MXN",
    contract: { total: 47817, depositPercent: 20, depositRequired: 9563.4 },
    payments: {
      confirmedTotal: 0,
      pendingTotal: 0,
      cancelledTotal: 0,
      confirmedCount: 0,
    },
    balance: {
      remaining: 47817,
      paidPercent: 0,
      depositCovered: false,
      fullyPaid: false,
    },
  });

  const deposit = calculateReservationFinancialSummary({
    snapshot: base,
    payments: [{ amount: 9563.4, currency: "MXN", status: "confirmed" }],
  });
  assert.equal(deposit?.payments.confirmedTotal, 9563.4);
  assert.equal(deposit?.balance.remaining, 38253.6);
  assert.equal(deposit?.balance.depositCovered, true);

  const partial = calculateReservationFinancialSummary({
    snapshot: base,
    payments: [{ amount: 5000, currency: "MXN", status: "confirmed" }],
  });
  assert.deepEqual(partial?.balance, {
    remaining: 42817,
    paidPercent: 10.46,
    depositCovered: false,
    fullyPaid: false,
  });

  const mixedStatuses = calculateReservationFinancialSummary({
    snapshot: base,
    payments: [
      { amount: 5000, currency: "MXN", status: "confirmed" },
      { amount: 10000, currency: "MXN", status: "confirmed" },
      { amount: 3000, currency: "MXN", status: "pending" },
      { amount: 2000, currency: "MXN", status: "cancelled" },
    ],
  });
  assert.deepEqual(mixedStatuses?.payments, {
    confirmedTotal: 15000,
    pendingTotal: 3000,
    cancelledTotal: 2000,
    confirmedCount: 2,
  });
  assert.equal(mixedStatuses?.balance.remaining, 32817);

  const total = calculateReservationFinancialSummary({
    snapshot: base,
    payments: [{ amount: 47817, currency: "MXN", status: "confirmed" }],
  });
  assert.deepEqual(total?.balance, {
    remaining: 0,
    paidPercent: 100,
    depositCovered: true,
    fullyPaid: true,
  });

  const overpaid = calculateReservationFinancialSummary({
    snapshot: base,
    payments: [{ amount: 50000, currency: "MXN", status: "confirmed" }],
  });
  assert.equal(overpaid?.balance.remaining, 0);
  assert.equal(overpaid?.balance.fullyPaid, true);
  assert.equal(overpaid?.balance.paidPercent, 104.57);
});

test("resumen financiero conserva históricos y rechaza moneda o contrato incompatibles", () => {
  const base = financialReservationRow();
  const historicalSnapshot = base.snapshot as ReservationSnapshot;
  const {
    depositPercent: _depositPercent,
    depositAmount: _depositAmount,
    ...withoutDeposit
  } = historicalSnapshot;
  const historical = calculateReservationFinancialSummary({
    snapshot: financialReservationRow({ snapshot: withoutDeposit }),
    payments: [],
  });
  assert.deepEqual(historical?.contract, {
    total: 47817,
    depositPercent: null,
    depositRequired: null,
  });
  assert.equal(historical?.balance.depositCovered, null);

  assert.equal(
    calculateReservationFinancialSummary({
    snapshot: base,
    payments: [{ amount: 10, currency: "USD", status: "confirmed" }],
    }),
    null,
  );
  assert.equal(
    calculateReservationFinancialSummary({
    snapshot: financialReservationRow({ total: 0 }),
    payments: [],
    }),
    null,
  );
  const immutable = JSON.stringify(base.snapshot);
  calculateReservationFinancialSummary({ snapshot: base, payments: [] });
  assert.equal(JSON.stringify(base.snapshot), immutable);
});

test("saldo reportable para transferencias reserva pending sin alterar el saldo financiero", () => {
  const snapshot = financialReservationRow({
    total: 10000,
    depositPercent: 20,
    depositRequired: 2000,
  });
  const partial = calculateCustomerTransferReportability({
    snapshot,
    payments: [
    { amount: 4000, currency: "MXN", status: "confirmed" },
    { amount: 2000, currency: "MXN", status: "pending" },
    { amount: 1000, currency: "MXN", status: "cancelled" },
    ],
  });
  assert.deepEqual(partial, {
    currency: "MXN",
    contractTotalCents: 1000000,
    confirmedPaymentCents: 400000,
    relevantPendingPaymentCents: 200000,
    remainingBalanceCents: 600000,
    reportableRemainingCents: 400000,
  });
  const pendingCoversRest = calculateCustomerTransferReportability({
    snapshot,
    payments: [
    { amount: 7000, currency: "MXN", status: "confirmed" },
    { amount: 3000, currency: "MXN", status: "pending" },
    ],
  });
  assert.equal(pendingCoversRest?.remainingBalanceCents, 300000);
  assert.equal(pendingCoversRest?.reportableRemainingCents, 0);
  const paid = calculateCustomerTransferReportability({
    snapshot,
    payments: [{ amount: 11000, currency: "MXN", status: "confirmed" }],
  });
  assert.equal(paid?.reportableRemainingCents, 0);
});

test("resumen financiero autoriza antes de consultar pagos y mantiene aislamiento de cliente", async () => {
  let repositoryCreated = false;
  const unauthenticated = createReservationFinancialSummaryService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: () => {
      repositoryCreated = true;
      return {
        async findAuthorized() {
          throw new Error("No debe consultar pagos");
        },
      };
    },
  });
  assert.deepEqual(
    await unauthenticated.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "unauthenticated" },
  );
  assert.equal(repositoryCreated, false);

  const invalid = financialSummaryFixture();
  assert.deepEqual(
    await invalid.service.get({
      requestedAgencySlug: "furiver",
      reservationId: "no-es-uuid",
    }),
    { status: "not_found" },
  );
  assert.deepEqual(invalid.requests, []);

  const linked = financialSummaryFixture();
  const result = await linked.service.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    const serialized = JSON.stringify(result.summary);
    assert.equal(serialized.includes("agencyId"), false);
    assert.equal(serialized.includes("customerAccountId"), false);
    assert.equal(serialized.includes("snapshot"), false);
    assert.equal(serialized.includes("reference"), false);
  }
  assert.deepEqual(linked.requests, [
    {
      customerAccountId: "customer-furiver",
      agencyId: "agency-furiver",
      reservationId: customerDetailReservationId,
    },
  ]);

  const unlinked = financialSummaryFixture({ linked: false });
  assert.deepEqual(
    await unlinked.service.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "not_found" },
  );
  const crisenix = financialSummaryFixture();
  assert.deepEqual(
    await crisenix.service.get({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(crisenix.requests, []);
  const suspended = financialSummaryFixture({
    accounts: [customerAccount({ status: "suspended" })],
  });
  assert.deepEqual(
    await suspended.service.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
});

test("repositorio financiero limita pagos por vínculo, agencia y reservación sin exponer referencias", async () => {
  const failing = financialSummaryFixture({ failRepository: true });
  await assert.rejects(
    failing.service.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    (error: unknown) =>
      error instanceof ReservationFinancialError &&
      !error.message.includes("SQL"),
  );
  const repository = readFileSync(
    "lib/payments/reservation-financial-repository.ts",
    "utf8",
  );
  assert.match(repository, /\.eq\("customer_account_id", customerAccountId\)/);
  assert.match(repository, /\.eq\("agency_id", agencyId\)/);
  assert.match(repository, /\.eq\("reservation_id", reservationId\)/);
  assert.match(
    repository,
    /\.from\("reservation_payments"\)[\s\S]*\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)/,
  );
  assert.equal(repository.includes("reference"), false);
});

test("detalle de cliente presenta el resumen financiero servidor sin tratar el anticipo contractual como pago", () => {
  const page = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const authorizationIndex = page.indexOf("getCustomerReservationDetail({");
  const financialIndex = page.indexOf("getReservationFinancialSummary({");
  assert.ok(authorizationIndex >= 0);
  assert.ok(financialIndex > authorizationIndex);

  assert.match(page, /Total del Tour/);
  assert.match(page, /Anticipo requerido/);
  assert.match(page, /Pagos confirmados/);
  assert.match(page, /financialSummary\.payments\.pendingTotal > 0/);
  assert.match(page, /Pagos en validación/);
  assert.match(page, /Saldo pendiente/);
  assert.match(page, /financialSummary\.balance\.fullyPaid/);
  assert.match(page, /financialSummary\.balance\.depositCovered === true/);
  assert.match(page, /financialSummary\.balance\.depositCovered === false/);
  assert.match(
    page,
    /No fue posible calcular el estado financiero de esta reservación/,
  );
  assert.match(page, /financialRemaining/);

  assert.equal(page.includes("reservation.amounts.remainingAmount"), false);
  assert.equal(page.includes("reservation_payments"), false);
  assert.equal(page.includes("cancelledTotal"), false);
  assert.equal(page.includes("Anticipo pagado"), false);
  assert.equal(page.includes("paymentId"), false);
  assert.equal(page.includes("reference"), false);
});

function manualPaymentStored(
  payment: ManualPaymentInsert,
): ManualPaymentStoredRow {
  return {
    id: adminPaymentId,
    reservationId: payment.reservationId,
    agencyId: payment.agencyId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
    source: payment.source,
    reference: payment.reference,
    paidAt: payment.paidAt,
    createdAt: "2026-07-26T12:00:01.000Z",
  };
}

function manualPaymentFixture(
  input: Readonly<{
  identity?: { userId: string; email: string | null } | null;
  memberships?: readonly AdminAgencyMembershipRecord[];
  reservation?: ReturnType<typeof customerReservationDetailRow> | null;
  failRepository?: boolean;
    afterConfirmedPayment?: (
      input: Readonly<{
    requestedAgencySlug: string | undefined;
    reservationId: string;
    paymentId: string;
      }>,
    ) => Promise<
      "ready" | "existing" | "revoked" | "document_error" | "not_applicable"
    >;
  }> = {},
) {
  const rows: ManualPaymentStoredRow[] = [];
  const byIdempotency = new Map<string, ManualPaymentStoredRow>();
  const writes: ManualPaymentInsert[] = [];
  const reservationRequests: Array<{
    agencyId: string;
    reservationId: string;
  }> = [];
  const access = adminAccessFixture({
    identity: input.identity,
    memberships: input.memberships ?? [adminMembership()],
  });
  const service = createManualReservationPaymentService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date(TEST_NOW),
    repository: {
      async findReservation(request) {
        reservationRequests.push(request);
        if (input.failRepository) throw new Error("SQL snapshot details");
        return input.reservation === undefined
          ? customerReservationDetailRow()
          : input.reservation;
      },
      async findByIdempotencyKey({ agencyId, idempotencyKey }) {
        const row = byIdempotency.get(`${agencyId}:${idempotencyKey}`);
        return row ?? null;
      },
      async createAtomic({ payment }) {
        const key = `${payment.agencyId}:${payment.idempotencyKey}`;
        if (byIdempotency.has(key)) {
          return {
            status: "existing" as const,
            payment: byIdempotency.get(key) as ManualPaymentStoredRow,
          };
        }
        const row = manualPaymentStored(payment);
        writes.push(payment);
        rows.push(row);
        byIdempotency.set(key, row);
        return { status: "created" as const, payment: row };
      },
    },
    afterConfirmedPayment: input.afterConfirmedPayment,
  });
  return { service, rows, writes, reservationRequests };
}

function manualPaymentInput(input: Partial<Record<string, unknown>> = {}) {
  return {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    amount: "9563.40",
    method: "transfer",
    initialStatus: "confirmed",
    reference: "  QA-TRANSFER-01  ",
    paidAt: "2026-07-26T12:00:00.000Z",
    idempotencyKey: "58d8cc3a-a91b-491d-b209-02df25bb4f6a",
    ...input,
  };
}

test("pago manual autoriza a administradores antes de consultar o escribir", async () => {
  let queried = false;
  const unauthenticated = createManualReservationPaymentService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async findReservation() {
        queried = true;
        return null;
      },
      async findByIdempotencyKey() {
        queried = true;
        return null;
      },
      async createAtomic() {
        queried = true;
        throw new Error("No debe escribir");
      },
    },
  });
  assert.deepEqual(await unauthenticated.create(manualPaymentInput()), {
    status: "unauthenticated",
  });
  assert.equal(queried, false);

  const customerOnly = manualPaymentFixture({ memberships: [] });
  assert.deepEqual(await customerOnly.service.create(manualPaymentInput()), {
    status: "forbidden",
  });
  assert.deepEqual(customerOnly.reservationRequests, []);
  assert.equal(customerOnly.writes.length, 0);

  const invalidUuid = manualPaymentFixture();
  const result = await invalidUuid.service.create(
    manualPaymentInput({ reservationId: "not-a-uuid" }),
  );
  assert.equal(result.status, "invalid_input");
  assert.deepEqual(invalidUuid.reservationRequests, []);

  const crossTenant = manualPaymentFixture();
  assert.deepEqual(
    await crossTenant.service.create(
      manualPaymentInput({ requestedAgencySlug: "crisenix" }),
    ),
    { status: "forbidden" },
  );
  assert.deepEqual(crossTenant.reservationRequests, []);

  const crisenixAdmin = manualPaymentFixture({
    memberships: [
      adminMembership({ agencyId: "agency-crisenix", agencySlug: "crisenix" }),
    ],
  });
  assert.deepEqual(await crisenixAdmin.service.create(manualPaymentInput()), {
    status: "forbidden",
  });
  assert.deepEqual(crisenixAdmin.reservationRequests, []);
});

test("pago manual valida importe, método, estado, fecha, referencia e idempotencia", async () => {
  for (const [field, value] of [
    ["amount", "0"],
    ["amount", "-1"],
    ["amount", "10.001"],
    ["method", "wire"],
    ["initialStatus", "cancelled"],
    ["paidAt", "fecha-inválida"],
    ["paidAt", "2026-07-27T12:00:00.000Z"],
    ["idempotencyKey", "not-a-uuid"],
  ] as const) {
    const fixture = manualPaymentFixture();
    const result = await fixture.service.create(
      manualPaymentInput({ [field]: value }),
    );
    assert.equal(result.status, "invalid_input");
    if (result.status === "invalid_input") assert.ok(result.fieldErrors[field]);
    assert.equal(fixture.writes.length, 0);
  }

  const trimmed = manualPaymentFixture();
  const created = await trimmed.service.create(manualPaymentInput());
  assert.equal(created.status, "created");
  if (created.status === "created")
    assert.equal(created.payment.reference, "QA-TRANSFER-01");
  assert.equal(trimmed.writes[0].reference, "QA-TRANSFER-01");

  const emptyReference = manualPaymentFixture();
  const empty = await emptyReference.service.create(
    manualPaymentInput({ reference: "   " }),
  );
  assert.equal(empty.status, "created");
  if (empty.status === "created") assert.equal(empty.payment.reference, null);
  assert.equal(emptyReference.writes[0].reference, null);
});

test("pago manual deriva contrato, actor y receipt seguro sin tocar el snapshot", async () => {
  const base = customerReservationDetailRow();
  const contractRow = {
    ...base,
    snapshot: {
      ...(base.snapshot as ReservationSnapshot),
      total: 47817,
      depositAmount: 9563.4,
      depositPercent: 20,
    },
  };
  const fixture = manualPaymentFixture({ reservation: contractRow });
  const before = JSON.stringify(contractRow.snapshot);
  const created = await fixture.service.create(
    manualPaymentInput({ initialStatus: "pending" }),
  );
  assert.equal(created.status, "created");
  assert.deepEqual(fixture.reservationRequests, [
    { agencyId: "agency-furiver", reservationId: customerDetailReservationId },
  ]);
  assert.equal(fixture.writes[0].currency, "MXN");
  assert.equal(fixture.writes[0].createdByUserId, "user-verified");
  assert.equal(fixture.writes[0].source, "manual");
  assert.equal(fixture.writes[0].status, "pending");
  assert.equal(JSON.stringify(contractRow.snapshot), before);
  if (created.status === "created") {
    const receipt = JSON.stringify(created.payment);
    assert.equal(receipt.includes("agencyId"), false);
    assert.equal(receipt.includes("createdByUserId"), false);
    assert.equal(receipt.includes("idempotency"), false);
    assert.equal(receipt.includes("reservationId"), false);
  }

  const pendingSummary = calculateReservationFinancialSummary({
    snapshot: contractRow,
    payments: fixture.rows.map(({ amount, currency, status }) => ({
      amount,
      currency,
      status,
    })),
  });
  assert.equal(pendingSummary?.balance.remaining, 47817);

  const confirmed = manualPaymentFixture({ reservation: contractRow });
  await confirmed.service.create(manualPaymentInput());
  const confirmedSummary = calculateReservationFinancialSummary({
    snapshot: contractRow,
    payments: confirmed.rows.map(({ amount, currency, status }) => ({
      amount,
      currency,
      status,
    })),
  });
  assert.equal(confirmedSummary?.balance.remaining, 38253.6);
});

test("pago manual es idempotente ante reintentos, conflicto y concurrencia", async () => {
  const fixture = manualPaymentFixture();
  const input = manualPaymentInput();
  const [first, second] = await Promise.all([
    fixture.service.create(input),
    fixture.service.create(input),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [
    "already_exists",
    "created",
  ]);
  assert.equal(fixture.rows.length, 1);
  assert.equal(fixture.writes.length, 1);

  const changed = await fixture.service.create(
    manualPaymentInput({ amount: "9000.00" }),
  );
  assert.deepEqual(changed, { status: "idempotency_conflict" });
  assert.equal(fixture.rows.length, 1);

  const missing = manualPaymentFixture({ reservation: null });
  assert.deepEqual(await missing.service.create(manualPaymentInput()), {
    status: "not_found",
  });
  assert.equal(missing.writes.length, 0);

  const failing = manualPaymentFixture({ failRepository: true });
  await assert.rejects(
    failing.service.create(manualPaymentInput()),
    (error: unknown) =>
      error instanceof ManualPaymentError && !error.message.includes("SQL"),
  );

  const repository = readFileSync(
    "lib/payments/manual-payment-repository.ts",
    "utf8",
  );
  assert.match(
    repository,
    /\.eq\("id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)/,
  );
  assert.match(
    repository,
    /\.eq\("agency_id", agencyId\)[\s\S]*\.eq\("idempotency_key", idempotencyKey\)/,
  );
  assert.match(repository, /\.rpc\("create_manual_reservation_payment_atomic"/);
  assert.match(
    repository,
    /target_created_by_user_id: payment\.createdByUserId/,
  );
  assert.match(repository, /target_status: payment\.status/);
});

test("capacidad atómica administrativa limita pending y confirmed sin alterar pagos históricos", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const ledger: Array<{
    amount: number;
    currency: string;
    status: "pending" | "confirmed" | "cancelled";
  }> = [];
  const existing = new Map<string, ManualPaymentStoredRow>();
  let sequence = 0;
  const service = createManualReservationPaymentService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date(TEST_NOW),
    repository: {
      async findReservation() {
        return financialReservationRow({ total: 10000 });
      },
      async findByIdempotencyKey({ agencyId, idempotencyKey }) {
        return existing.get(`${agencyId}:${idempotencyKey}`) ?? null;
      },
      async createAtomic({ contractTotalCents, payment }) {
        const key = `${payment.agencyId}:${payment.idempotencyKey}`;
        const prior = existing.get(key);
        if (prior) return { status: "existing" as const, payment: prior };
        const confirmed = ledger
          .filter((row) => row.status === "confirmed")
          .reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
        const pending = ledger
          .filter((row) => row.status === "pending")
          .reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
        if (ledger.some((row) => row.currency !== payment.currency))
          return { status: "invalid_structure" as const };
        if (confirmed > contractTotalCents)
          return { status: "historical_overpayment" as const };
        if (confirmed >= contractTotalCents)
          return { status: "reservation_paid_in_full" as const };
        const amountCents = Math.round(payment.amount * 100);
        if (
          payment.status === "pending" &&
          amountCents > Math.max(contractTotalCents - confirmed - pending, 0)
        )
          return { status: "amount_exceeds_reportable_balance" as const };
        if (
          payment.status === "confirmed" &&
          amountCents > Math.max(contractTotalCents - confirmed, 0)
        )
          return { status: "amount_exceeds_confirmable_balance" as const };
        const row = {
          ...manualPaymentStored(payment),
          id: `manual-${++sequence}`,
        };
        existing.set(key, row);
        ledger.push({
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
        });
        return { status: "created" as const, payment: row };
      },
    },
  });
  ledger.push(
    { amount: 4000, currency: "MXN", status: "confirmed" },
    { amount: 4000, currency: "MXN", status: "pending" },
  );
  assert.equal(
    (
      await service.create(
        manualPaymentInput({
          initialStatus: "pending",
          amount: "2000.00",
          idempotencyKey: "48d8cc3a-a91b-491d-b209-02df25bb4f6a",
        }),
      )
    ).status,
    "created",
  );
  assert.deepEqual(
    await service.create(
      manualPaymentInput({
        initialStatus: "pending",
        amount: "0.01",
        idempotencyKey: "49d8cc3a-a91b-491d-b209-02df25bb4f6a",
      }),
    ),
    { status: "amount_exceeds_reportable_balance" },
  );
  // Pending rows do not block a real confirmed payment; only confirmed does.
  assert.equal(
    (
      await service.create(
        manualPaymentInput({
          initialStatus: "confirmed",
          amount: "6000.00",
          idempotencyKey: "50d8cc3a-a91b-491d-b209-02df25bb4f6a",
        }),
      )
    ).status,
    "created",
  );
  assert.deepEqual(
    await service.create(
      manualPaymentInput({
        initialStatus: "confirmed",
        amount: "0.01",
        idempotencyKey: "51d8cc3a-a91b-491d-b209-02df25bb4f6a",
      }),
    ),
    { status: "reservation_paid_in_full" },
  );
  assert.equal(
    ledger
      .filter((row) => row.status === "confirmed")
      .reduce((sum, row) => sum + row.amount, 0),
    10000,
  );
  assert.equal(
    ledger
      .filter((row) => row.status === "pending")
      .reduce((sum, row) => sum + row.amount, 0),
    6000,
  );
});

test("confirmación atómica conserva pending que excede capacidad y nunca genera documentos al bloquearse", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const rows = new Map<
    string,
    { id: string; status: ManualPaymentStatus; source: string; amount: number }
  >([
    [
      "1c8f51f4-bacd-457c-8267-b173a2994f57",
      {
        id: "1c8f51f4-bacd-457c-8267-b173a2994f57",
        status: "pending",
        source: "manual",
        amount: 200000,
      },
    ],
    [
      "2c8f51f4-bacd-457c-8267-b173a2994f57",
      {
        id: "2c8f51f4-bacd-457c-8267-b173a2994f57",
        status: "pending",
        source: "manual",
        amount: 200000,
      },
    ],
  ]);
  let confirmed = 800000;
  let previous = Promise.resolve();
  let documentCalls = 0;
  const service = createAdminPaymentStatusService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date(TEST_NOW),
    repository: {
      async findReservation() {
        return financialReservationRow({ total: 10000 });
      },
      async findPayment({ paymentId }) {
        const row = rows.get(paymentId);
        return row
          ? { id: row.id, status: row.status, source: row.source }
          : null;
      },
      async hasEvidence() {
        return false;
      },
      async updateStatus({ paymentId, nextStatus }) {
        const row = rows.get(paymentId);
        if (!row || row.status !== "pending") return false;
        row.status = nextStatus;
        return true;
      },
      async confirmAtomic({ paymentId, contractTotalCents }) {
        const before = previous;
        let release: () => void = () => undefined;
        previous = new Promise<void>((resolve) => {
          release = resolve;
        });
        await before;
        try {
          const row = rows.get(paymentId);
          if (!row || row.status !== "pending") return "conflict" as const;
          if (row.amount > contractTotalCents - confirmed)
            return "payment_exceeds_remaining_balance" as const;
          confirmed += row.amount;
          row.status = "confirmed";
          return "updated" as const;
        } finally {
          release();
        }
      },
      },
    async afterStatusChanged() {
      documentCalls += 1;
      return "ready";
    },
  });
  const [first, second] = await Promise.all([
    service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: "1c8f51f4-bacd-457c-8267-b173a2994f57",
      nextStatus: "confirmed",
    }),
    service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: "2c8f51f4-bacd-457c-8267-b173a2994f57",
      nextStatus: "confirmed",
    }),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [
    "payment_exceeds_remaining_balance",
    "updated",
  ]);
  assert.equal(confirmed, 1000000);
  assert.equal(
    [...rows.values()].filter((row) => row.status === "pending").length,
    1,
  );
  assert.equal(documentCalls, 1);
  assert.equal(
    (
      await service.change({
        requestedAgencySlug: "furiver",
        reservationId: customerDetailReservationId,
        paymentId: "2c8f51f4-bacd-457c-8267-b173a2994f57",
        nextStatus: "cancelled",
      })
    ).status,
    "updated",
  );
});

test("migración de capacidad administrativa bloquea por reservación y la UI conserva pagos pending revisables", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801200000_atomic_admin_payment_capacity.sql",
    "utf8",
  );
  const createRepository = readFileSync(
    "lib/payments/manual-payment-repository.ts",
    "utf8",
  );
  const statusRepository = readFileSync(
    "lib/payments/admin-payment-status-repository.ts",
    "utf8",
  );
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const actions = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-status-actions.ts",
    "utf8",
  );
  assert.match(migration, /create_manual_reservation_payment_atomic/);
  assert.match(migration, /confirm_reservation_payment_atomic/);
  assert.match(migration, /for update/i);
  assert.match(migration, /security definer/gi);
  assert.match(migration, /set search_path = public, pg_temp/gi);
  assert.match(migration, /amount_exceeds_reportable_balance/);
  assert.match(migration, /amount_exceeds_confirmable_balance/);
  assert.match(migration, /payment_exceeds_remaining_balance/);
  assert.match(migration, /historical_overpayment/);
  assert.match(migration, /grant execute[\s\S]*service_role/i);
  assert.match(
    createRepository,
    /\.rpc\("create_manual_reservation_payment_atomic"/,
  );
  assert.match(statusRepository, /\.rpc\("confirm_reservation_payment_atomic"/);
  assert.match(page, /reservationPaidInFull/);
  assert.match(actions, /supera el saldo pendiente y no puede confirmarse/);
});

test("formulario administrativo convierte fecha local a ISO inequívoco y crea UUIDs no predecibles", () => {
  const iso = localDateTimeToIso("2026-07-26T08:30");
  assert.ok(iso?.endsWith("Z"));
  assert.equal(
    new Date(iso as string).getTime(),
    new Date(2026, 6, 26, 8, 30).getTime(),
  );
  assert.equal(localDateTimeToIso("2026-02-31T08:30"), null);
  assert.equal(localDateTimeToIso("fecha-inválida"), null);
  assert.match(
    localDateTimeValue(new Date("2026-07-26T12:00:00.000Z")),
    /^2026-07-\d{2}T\d{2}:\d{2}$/,
  );
  assert.equal(
    createManualPaymentIdempotencyKey({
      randomUUID: () => "58d8cc3a-a91b-491d-b209-02df25bb4f6a",
    } as Crypto),
    "58d8cc3a-a91b-491d-b209-02df25bb4f6a",
  );
});

test("acción y diálogo de pago administrativo delegan al comando y mantienen idempotencia por intento", () => {
  const action = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-actions.ts",
    "utf8",
  );
  const form = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/manual-payment-form.tsx",
    "utf8",
  );
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const clientPortal = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );

  assert.match(action, /createManualReservationPayment\(\{/);
  assert.equal(
    action.includes("export const initialManualPaymentFormState"),
    false,
  );
  assert.equal(action.includes("export const"), false);
  assert.match(
    readFileSync(
      "app/admin/[agencySlug]/reservaciones/[reservationId]/manual-payment-form-core.ts",
      "utf8",
    ),
    /initialManualPaymentFormState/,
  );
  assert.match(
    action,
    /revalidatePath\(detailPath\(requestedAgencySlug, reservationId\)\)/,
  );
  assert.match(
    action,
    /\/cuenta\/\$\{encodeURIComponent\(requestedAgencySlug\)\}\/reservaciones\/\$\{reservationId\}/,
  );
  assert.match(action, /Pago registrado correctamente\./);
  assert.match(action, /El pago ya había sido registrado\./);
  assert.match(
    action,
    /Este intento de registro ya fue utilizado con datos diferentes/,
  );
  assert.match(
    action,
    /No fue posible registrar el pago\. Verifica la reservación o contacta al administrador del sistema\./,
  );
  assert.equal(action.includes("agencyId:"), false);
  assert.equal(action.includes("currency:"), false);
  assert.equal(action.includes("createdByUserId:"), false);
  assert.equal(action.includes("source:"), false);

  assert.match(form, /<dialog/);
  assert.match(form, /dialog\.showModal\(\)/);
  assert.match(form, /onCancel/);
  assert.match(form, /type="datetime-local"/);
  assert.match(form, /localDateTimeToIso\(localValue\)/);
  assert.match(form, /name="idempotencyKey"/);
  assert.match(
    form,
    /setIdempotencyKey\(createManualPaymentIdempotencyKey\(\)\)/,
  );
  assert.match(form, /state\.outcome === "idempotency_conflict"/);
  assert.match(form, /Registrando…/);
  assert.match(form, /No modifica el saldo hasta ser confirmado\./);
  assert.equal(form.includes("Math.random"), false);
  assert.equal(form.includes("currency"), true); // Informational display only; the action does not receive it.
  assert.match(page, /<ManualPaymentForm/);
  assert.match(clientPortal, /getReservationFinancialSummary/);
});

const adminPaymentId = "3e38c1e6-62b5-4e76-8e12-a9272e3fd710";
const secondAdminPaymentId = "3e38c1e6-62b5-4e76-8e12-a9272e3fd711";

function adminPaymentRow(
  input: Partial<AdminPaymentHistoryRow> = {},
): AdminPaymentHistoryRow {
  return {
    id: input.id ?? adminPaymentId,
    amount: input.amount ?? 9563.4,
    currency: input.currency ?? "MXN",
    status: input.status ?? "pending",
    method: input.method ?? "transfer",
    reference: input.reference ?? "REFERENCIA-INTERNA",
    paidAt: input.paidAt ?? "2026-07-26T12:00:00.000Z",
    createdAt: input.createdAt ?? "2026-07-26T12:01:00.000Z",
    createdByUserId:
      input.createdByUserId === undefined
        ? "user-verified"
        : input.createdByUserId,
    statusChangedAt: input.statusChangedAt ?? null,
    source: input.source ?? "manual",
    hasEvidence: input.hasEvidence ?? false,
    evidenceMimeType: input.evidenceMimeType ?? null,
  };
}

function adminPaymentHistoryFixture(
  input: Readonly<{
  memberships?: readonly AdminAgencyMembershipRecord[];
  reservation?: ReturnType<typeof customerReservationDetailRow> | null;
  rows?: readonly AdminPaymentHistoryRow[];
  fail?: boolean;
  }> = {},
) {
  const requests: string[] = [];
  const access = adminAccessFixture({
    memberships: input.memberships ?? [adminMembership()],
  });
  const service = createAdminPaymentHistoryService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findReservation({ agencyId, reservationId }) {
        requests.push(`reservation:${agencyId}:${reservationId}`);
        if (input.fail) throw new Error("SQL internal detail");
        return input.reservation === undefined
          ? financialReservationRow()
          : input.reservation;
      },
      async listPayments({ agencyId, reservationId }) {
        requests.push(`payments:${agencyId}:${reservationId}`);
        return input.rows ?? [adminPaymentRow()];
      },
      async findDisplayNames(userIds) {
        requests.push(`profiles:${userIds.join(",")}`);
        return new Map(
          userIds.map((userId) => [userId, "Administración Furiver"]),
        );
      },
    },
  });
  return { service, requests };
}

function adminPaymentStatusFixture(
  input: Readonly<{
  memberships?: readonly AdminAgencyMembershipRecord[];
  paymentStatus?: ManualPaymentStatus;
  reservationExists?: boolean;
  conflict?: boolean;
  paymentSource?: string;
  hasEvidence?: boolean;
    afterStatusChanged?: (
      input: Readonly<{
    requestedAgencySlug: string | undefined;
    reservationId: string;
    paymentId: string;
    nextStatus: ManualPaymentStatus;
      }>,
    ) => Promise<
      "ready" | "existing" | "revoked" | "document_error" | "not_applicable"
    >;
  }> = {},
) {
  const row = {
    id: adminPaymentId,
    status: input.paymentStatus ?? ("pending" as ManualPaymentStatus),
    source: input.paymentSource ?? "manual",
  };
  const writes: Array<Record<string, unknown>> = [];
  const requests: string[] = [];
  const access = adminAccessFixture({
    memberships: input.memberships ?? [adminMembership()],
  });
  const service = createAdminPaymentStatusService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date(TEST_NOW),
    repository: {
      async findReservation({ agencyId, reservationId }) {
        requests.push(`reservation:${agencyId}:${reservationId}`);
        return input.reservationExists === false
          ? null
          : financialReservationRow();
      },
      async findPayment({ agencyId, reservationId, paymentId }) {
        requests.push(`payment:${agencyId}:${reservationId}:${paymentId}`);
        return paymentId === row.id ? { ...row } : null;
      },
      async hasEvidence({ agencyId, reservationId, paymentId }) {
        requests.push(`evidence:${agencyId}:${reservationId}:${paymentId}`);
        return input.hasEvidence === true && paymentId === row.id;
      },
      async updateStatus(update) {
        writes.push(update);
        if (input.conflict || update.expectedStatus !== row.status)
          return false;
        row.status = update.nextStatus;
        return true;
      },
      async confirmAtomic(update) {
        writes.push(update);
        if (input.conflict || row.status !== "pending")
          return "conflict" as const;
        row.status = "confirmed";
        return "updated" as const;
      },
    },
    afterStatusChanged: input.afterStatusChanged,
  });
  return { service, row, writes, requests };
}

test("historial administrativo autoriza antes de consultar, ordena y proyecta solamente datos operativos", async () => {
  let queried = false;
  const unauthenticated = createAdminPaymentHistoryService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: () => ({
      async findReservation() {
        queried = true;
        return null;
      },
      async listPayments() {
        queried = true;
        return [];
      },
      async findDisplayNames() {
        queried = true;
        return new Map();
      },
    }),
  });
  assert.deepEqual(
    await unauthenticated.list({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "unauthenticated" },
  );
  assert.equal(queried, false);

  const fixture = adminPaymentHistoryFixture({
    rows: [
      adminPaymentRow({
        id: adminPaymentId,
        status: "confirmed",
        paidAt: "2026-07-25T12:00:00.000Z",
        createdAt: "2026-07-25T12:01:00.000Z",
      }),
      adminPaymentRow({
        id: secondAdminPaymentId,
        status: "pending",
        paidAt: "2026-07-26T12:00:00.000Z",
        createdAt: "2026-07-26T12:01:00.000Z",
        createdByUserId: null,
      }),
    ],
  });
  const listed = await fixture.service.list({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(listed.status, "authorized");
  if (listed.status === "authorized") {
    assert.deepEqual(
      listed.payments.map((payment) => payment.status),
      ["pending", "confirmed"],
    );
    assert.equal(listed.payments[0].createdBy, null);
    assert.equal(
      listed.payments[1].createdBy?.displayName,
      "Administración Furiver",
    );
    assert.equal(listed.financialSummary?.payments.confirmedTotal, 9563.4);
    const serialized = JSON.stringify(listed.payments);
    assert.equal(serialized.includes("agencyId"), false);
    assert.equal(serialized.includes("createdByUserId"), false);
    assert.equal(serialized.includes("idempotency"), false);
    assert.equal(serialized.includes("snapshot"), false);
  }
  assert.deepEqual(fixture.requests.slice(0, 2), [
    `reservation:agency-furiver:${customerDetailReservationId}`,
    `payments:agency-furiver:${customerDetailReservationId}`,
  ]);
  const crossTenant = adminPaymentHistoryFixture();
  assert.deepEqual(
    await crossTenant.service.list({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(crossTenant.requests, []);

  const failing = adminPaymentHistoryFixture({ fail: true });
  await assert.rejects(
    failing.service.list({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    (error: unknown) =>
      error instanceof AdminPaymentHistoryError &&
      !error.message.includes("SQL"),
  );
});

test("transiciones administrativas de pagos son auditadas, inmutables y evitan lost updates", async () => {
  assert.equal(canTransitionManualPaymentStatus("pending", "confirmed"), true);
  assert.equal(canTransitionManualPaymentStatus("pending", "cancelled"), true);
  assert.equal(
    canTransitionManualPaymentStatus("confirmed", "cancelled"),
    true,
  );
  assert.equal(
    canTransitionManualPaymentStatus("cancelled", "confirmed"),
    false,
  );
  assert.equal(canTransitionManualPaymentStatus("confirmed", "pending"), false);
  assert.equal(canTransitionManualPaymentStatus("cancelled", "pending"), false);

  const fixture = adminPaymentStatusFixture();
  assert.deepEqual(
    await fixture.service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
      nextStatus: "confirmed",
    }),
    { status: "updated", nextStatus: "confirmed" },
  );
  assert.equal(fixture.row.status, "confirmed");
  assert.equal(fixture.writes[0].actorUserId, "user-verified");
  assert.equal(fixture.writes[0].changedAt, TEST_NOW);
  assert.equal("amount" in fixture.writes[0], false);
  assert.equal("currency" in fixture.writes[0], false);
  assert.equal("idempotencyKey" in fixture.writes[0], false);
  assert.deepEqual(
    await fixture.service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
      nextStatus: "pending",
    }),
    { status: "invalid_transition" },
  );
  assert.deepEqual(
    await fixture.service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
      nextStatus: "cancelled",
    }),
    { status: "updated", nextStatus: "cancelled" },
  );
  assert.deepEqual(
    await fixture.service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
      nextStatus: "cancelled",
    }),
    { status: "invalid_transition" },
  );

  const concurrent = adminPaymentStatusFixture({ conflict: true });
  assert.deepEqual(
    await concurrent.service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
      nextStatus: "confirmed",
    }),
    { status: "conflict" },
  );
  const customerOnly = adminPaymentStatusFixture({ memberships: [] });
  assert.deepEqual(
    await customerOnly.service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
      nextStatus: "confirmed",
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(customerOnly.requests, []);
  const crossTenant = adminPaymentStatusFixture();
  assert.deepEqual(
    await crossTenant.service.change({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
      nextStatus: "confirmed",
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(crossTenant.requests, []);
  const invalid = adminPaymentStatusFixture();
  assert.deepEqual(
    await invalid.service.change({
      requestedAgencySlug: "furiver",
      reservationId: "invalid",
      paymentId: adminPaymentId,
      nextStatus: "confirmed",
    }),
    { status: "invalid_input" },
  );
  assert.deepEqual(invalid.requests, []);
});

test("historial y cambio de status reflejan el efecto financiero sin mutar el snapshot", () => {
  const snapshot = financialReservationRow();
  const before = JSON.stringify(snapshot.snapshot);
  const pending = calculateReservationFinancialSummary({
    snapshot,
    payments: [{ amount: 9563.4, currency: "MXN", status: "pending" }],
  });
  const confirmed = calculateReservationFinancialSummary({
    snapshot,
    payments: [{ amount: 9563.4, currency: "MXN", status: "confirmed" }],
  });
  const cancelled = calculateReservationFinancialSummary({
    snapshot,
    payments: [{ amount: 9563.4, currency: "MXN", status: "cancelled" }],
  });
  assert.equal(pending?.balance.remaining, 47817);
  assert.equal(confirmed?.balance.remaining, 38253.6);
  assert.equal(cancelled?.balance.remaining, 47817);
  assert.equal(JSON.stringify(snapshot.snapshot), before);

  const listRepository = readFileSync(
    "lib/payments/admin-payment-list-repository.ts",
    "utf8",
  );
  const statusRepository = readFileSync(
    "lib/payments/admin-payment-status-repository.ts",
    "utf8",
  );
  const action = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-status-actions.ts",
    "utf8",
  );
  const controls = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-status-controls.tsx",
    "utf8",
  );
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  assert.match(
    listRepository,
    /.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)/,
  );
  assert.match(
    statusRepository,
    /.eq\("id", paymentId\)[\s\S]*\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)[\s\S]*\.eq\("status", expectedStatus\)/,
  );
  assert.match(statusRepository, /status_changed_by_user_id: actorUserId/);
  assert.match(statusRepository, /status_changed_at: changedAt/);
  assert.match(action, /changeManualPaymentStatus\(\{/);
  assert.equal(action.includes("export const"), false);
  assert.match(
    action,
    /revalidatePath\(detailPath\(requestedAgencySlug, reservationId\)\)/,
  );
  assert.match(
    action,
    /\/cuenta\/\$\{encodeURIComponent\(requestedAgencySlug\)\}\/reservaciones\/\$\{reservationId\}/,
  );
  assert.match(
    controls,
    /Cancelar este movimiento hará que deje de contabilizarse dentro de los pagos confirmados/,
  );
  assert.match(page, /<PaymentStatusControls/);
  assert.match(page, /Aún no hay pagos registrados\./);
  assert.equal(page.includes("idempotency_key"), false);
  assert.equal(page.includes("created_by_user_id"), false);
});

test("comprobante administrativo se autoriza antes de generar URL temporal y no expone rutas", async () => {
  const requests: string[] = [];
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const service = createAdminPaymentEvidenceService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findReservation({ agencyId, reservationId }) {
        requests.push(`reservation:${agencyId}:${reservationId}`);
        return true;
      },
      async findPayment({ agencyId, reservationId, paymentId }) {
        requests.push(`payment:${agencyId}:${reservationId}:${paymentId}`);
        return paymentId === adminPaymentId;
      },
      async findEvidence({ agencyId, reservationId, paymentId }) {
        requests.push(`evidence:${agencyId}:${reservationId}:${paymentId}`);
        return paymentId === adminPaymentId
          ? {
              storagePath: "agency-furiver/reservation/payment/evidence.pdf",
              mimeType: "application/pdf",
            }
          : null;
      },
    },
    storage: {
      async createSignedReadUrl({ path, expiresInSeconds }) {
        requests.push(`storage:${expiresInSeconds}`);
        assert.equal(path.includes("agency-furiver"), true);
        return "https://storage.example/signed-temporary";
      },
    },
  });
  const ready = await service.request({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    paymentId: adminPaymentId,
  });
  assert.deepEqual(ready, {
    status: "ready",
    signedUrl: "https://storage.example/signed-temporary",
    mimeType: "application/pdf",
  });
  assert.deepEqual(
    requests.map((request) => request.split(":")[0]),
    ["reservation", "payment", "evidence", "storage"],
  );
  assert.equal(JSON.stringify(ready).includes("storagePath"), false);

  const noEvidence = createAdminPaymentEvidenceService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findReservation() {
        return true;
      },
      async findPayment() {
        return true;
      },
      async findEvidence() {
        return null;
      },
    },
    storage: {
      async createSignedReadUrl() {
        throw new Error("should not read storage");
      },
    },
  });
  assert.deepEqual(
    await noEvidence.request({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
    }),
    { status: "no_evidence" },
  );
  const unauthenticated = createAdminPaymentEvidenceService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async findReservation() {
        throw new Error();
      },
      async findPayment() {
        throw new Error();
      },
      async findEvidence() {
        throw new Error();
      },
    },
    storage: {
      async createSignedReadUrl() {
        throw new Error();
      },
    },
  });
  assert.deepEqual(
    await unauthenticated.request({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
    }),
    { status: "unauthenticated" },
  );
  const failing = createAdminPaymentEvidenceService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findReservation() {
        throw new Error("SQL private");
      },
      async findPayment() {
        return false;
      },
      async findEvidence() {
        return null;
      },
    },
    storage: {
      async createSignedReadUrl() {
        return "";
      },
    },
  });
  await assert.rejects(
    failing.request({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
    }),
    (error: unknown) =>
      error instanceof AdminPaymentEvidenceError &&
      !error.message.includes("SQL"),
  );
});

test("confirmación administrativa exige evidencia para pending customer, no para manual", async () => {
  const customerWithoutEvidence = adminPaymentStatusFixture({
    paymentSource: "customer",
    hasEvidence: false,
  });
  assert.deepEqual(
    await customerWithoutEvidence.service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
      nextStatus: "confirmed",
    }),
    { status: "evidence_required" },
  );
  assert.equal(customerWithoutEvidence.writes.length, 0);
  assert.deepEqual(
    await customerWithoutEvidence.service.change({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      paymentId: adminPaymentId,
      nextStatus: "cancelled",
    }),
    { status: "updated", nextStatus: "cancelled" },
  );
  const customerWithEvidence = adminPaymentStatusFixture({
    paymentSource: "customer",
    hasEvidence: true,
  });
  assert.equal(
    (
      await customerWithEvidence.service.change({
        requestedAgencySlug: "furiver",
        reservationId: customerDetailReservationId,
        paymentId: adminPaymentId,
        nextStatus: "confirmed",
      })
    ).status,
    "updated",
  );
  const manual = adminPaymentStatusFixture({
    paymentSource: "manual",
    hasEvidence: false,
  });
  assert.equal(
    (
      await manual.service.change({
        requestedAgencySlug: "furiver",
        reservationId: customerDetailReservationId,
        paymentId: adminPaymentId,
        nextStatus: "confirmed",
      })
    ).status,
    "updated",
  );
});

test("UI administrativa solicita evidencia bajo demanda sin rutas internas ni descarga por Vercel", () => {
  const action = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-evidence-actions.ts",
    "utf8",
  );
  const button = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-evidence-button.tsx",
    "utf8",
  );
  const evidenceRepository = readFileSync(
    "lib/payments/admin-payment-evidence-repository.ts",
    "utf8",
  );
  const storage = readFileSync(
    "lib/payments/admin-payment-evidence-storage.ts",
    "utf8",
  );
  const core = readFileSync(
    "lib/payments/admin-payment-evidence-core.ts",
    "utf8",
  );
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  assert.equal(action.includes("export const"), false);
  assert.match(action, /getAdminPaymentEvidenceAccess/);
  assert.equal(action.includes("storagePath"), false);
  assert.match(button, /Preparando comprobante…/);
  assert.match(button, /window\.open/);
  assert.match(button, /noopener,noreferrer/);
  assert.equal(button.includes("storagePath"), false);
  assert.match(
    evidenceRepository,
    /.eq\("payment_id", paymentId\)[\s\S]*\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)/,
  );
  assert.match(storage, /createSignedUrl\(path, expiresInSeconds\)/);
  assert.match(core, /expiresInSeconds: 60/);
  assert.match(page, /<PaymentEvidenceButton/);
  assert.match(page, /Comprobante no disponible/);
});

function customerPaymentRow(
  input: Partial<CustomerPaymentHistoryRow> = {},
): CustomerPaymentHistoryRow {
  return {
    amount: input.amount ?? 9563.4,
    currency: input.currency ?? "MXN",
    status: input.status ?? "confirmed",
    method: input.method ?? "transfer",
    paidAt: input.paidAt ?? "2026-08-20T12:00:00.000Z",
    createdAt: input.createdAt ?? "2026-08-20T12:01:00.000Z",
  };
}

function customerPaymentHistoryFixture(
  input: Readonly<{
  accounts?: readonly CustomerAgencyAccountRecord[];
  linked?: boolean;
  rows?: readonly CustomerPaymentHistoryRow[];
  fail?: boolean;
  }> = {},
) {
  const requests: string[] = [];
  const access = customerAccessFixture({
    accounts: input.accounts ?? [customerAccount()],
  });
  const service = createCustomerPaymentHistoryService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findLinkedReservation({
        customerAccountId,
        agencyId,
        reservationId,
      }) {
        requests.push(
          `linked:${customerAccountId}:${agencyId}:${reservationId}`,
        );
        if (input.fail) throw new Error("SQL payment reference");
        return input.linked !== false;
      },
      async listPayments({ agencyId, reservationId }) {
        requests.push(`payments:${agencyId}:${reservationId}`);
        return input.rows ?? [customerPaymentRow()];
      },
    },
  });
  return { service, requests };
}

test("historial de pagos del cliente se autoriza antes de leer el ledger y conserva el aislamiento", async () => {
  let queried = false;
  const unauthenticated = createCustomerPaymentHistoryService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: () => ({
      async findLinkedReservation() {
        queried = true;
        return false;
      },
      async listPayments() {
        queried = true;
        return [];
      },
    }),
  });
  assert.deepEqual(
    await unauthenticated.list({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "unauthenticated" },
  );
  assert.equal(queried, false);

  const fixture = customerPaymentHistoryFixture();
  const result = await fixture.service.list({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    assert.equal(result.payments.length, 1);
    const serialized = JSON.stringify(result.payments[0]);
    assert.equal(serialized.includes("reference"), false);
    assert.equal(serialized.includes("paymentId"), false);
    assert.equal(serialized.includes("createdBy"), false);
    assert.equal(serialized.includes("agencyId"), false);
    assert.equal(serialized.includes("idempotency"), false);
  }
  assert.deepEqual(fixture.requests, [
    `linked:customer-furiver:agency-furiver:${customerDetailReservationId}`,
    `payments:agency-furiver:${customerDetailReservationId}`,
  ]);

  const otherAccount = customerPaymentHistoryFixture({
    accounts: [customerAccount({ customerAccountId: "other-customer" })],
    linked: false,
  });
  assert.deepEqual(
    await otherAccount.service.list({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "not_found" },
  );
  assert.equal(
    otherAccount.requests.some((request) => request.startsWith("payments:")),
    false,
  );
  const crisenix = customerPaymentHistoryFixture();
  assert.deepEqual(
    await crisenix.service.list({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(crisenix.requests, []);
  const suspended = customerPaymentHistoryFixture({
    accounts: [customerAccount({ status: "suspended" })],
  });
  assert.deepEqual(
    await suspended.service.list({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  const administratorWithoutCustomerAccount = customerPaymentHistoryFixture({
    accounts: [],
  });
  assert.deepEqual(
    await administratorWithoutCustomerAccount.service.list({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(administratorWithoutCustomerAccount.requests, []);
  const invalidUuid = customerPaymentHistoryFixture();
  assert.deepEqual(
    await invalidUuid.service.list({
      requestedAgencySlug: "furiver",
      reservationId: "not-a-uuid",
    }),
    { status: "not_found" },
  );
  assert.deepEqual(invalidUuid.requests, []);
});

test("historial del cliente ordena y proyecta pagos confirmed, pending, cancelled y el QA histórico", async () => {
  const fixture = customerPaymentHistoryFixture({
    rows: [
      customerPaymentRow({
        status: "confirmed",
        method: "transfer",
        paidAt: "2026-08-18T12:00:00.000Z",
        createdAt: "2026-08-18T12:01:00.000Z",
      }),
      customerPaymentRow({
        status: "pending",
        method: "cash",
        paidAt: "2026-08-20T12:00:00.000Z",
        createdAt: "2026-08-20T12:01:00.000Z",
      }),
      customerPaymentRow({
        status: "cancelled",
        method: "payment_link",
        paidAt: "2026-08-19T12:00:00.000Z",
        createdAt: "2026-08-19T12:01:00.000Z",
      }),
    ],
  });
  const result = await fixture.service.list({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    assert.deepEqual(
      result.payments.map((payment) => payment.status),
      ["pending", "cancelled", "confirmed"],
    );
    assert.deepEqual(
      result.payments.map((payment) => payment.method),
      ["cash", "payment_link", "transfer"],
    );
  }
  const empty = customerPaymentHistoryFixture({ rows: [] });
  const emptyResult = await empty.service.list({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(emptyResult.status, "authorized");
  if (emptyResult.status === "authorized")
    assert.deepEqual(emptyResult.payments, []);
  const failing = customerPaymentHistoryFixture({ fail: true });
  await assert.rejects(
    failing.service.list({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    (error: unknown) =>
      error instanceof CustomerPaymentHistoryError &&
      !error.message.includes("SQL"),
  );
});

test("detalle cliente usa historial seguro sin recalcular el saldo ni exponer campos operativos", () => {
  const page = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const repository = readFileSync(
    "lib/payments/customer-payment-list-repository.ts",
    "utf8",
  );
  const detailIndex = page.indexOf("getCustomerReservationDetail({");
  const historyIndex = page.indexOf("listCustomerReservationPayments({");
  assert.ok(detailIndex >= 0);
  assert.ok(historyIndex > detailIndex);
  assert.match(
    repository,
    /.eq\("customer_account_id", customerAccountId\)[\s\S]*\.eq\("agency_id", agencyId\)[\s\S]*\.eq\("reservation_id", reservationId\)/,
  );
  assert.match(
    repository,
    /.from\("reservation_payments"\)[\s\S]*\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)/,
  );
  assert.match(
    repository,
    /select\("amount, currency, status, method, paid_at, created_at"\)/,
  );
  assert.equal(repository.includes("reference"), false);
  assert.equal(repository.includes("idempotency"), false);
  assert.match(page, /No hay pagos registrados todavía\./);
  assert.match(page, /Cuando la agencia confirme un pago, aparecerá aquí\./);
  assert.match(page, /todavía no reduce tu saldo/);
  assert.match(page, /no se contabiliza en tu saldo/);
  assert.equal(page.includes("reference"), false);
  assert.equal(page.includes("paymentId"), false);
  assert.equal(page.includes("createdBy"), false);
  assert.equal(page.includes("reservation_payments"), false);
  assert.equal(page.includes("calculateReservationFinancialSummary"), false);
  assert.match(page, /TravelerDataForm/);
});

const customerTransferPaymentId = "6f3b5ea4-f3bf-4ccd-8979-7c08da34df51";

function customerTransferFile(bytes: readonly number[], size = bytes.length) {
  const copy = new Uint8Array(bytes);
  return {
    size,
    type: "application/not-trusted",
    name: "referencia-privada.exe",
    async arrayBuffer() {
      return copy.buffer.slice(0) as ArrayBuffer;
    },
  };
}

const validTransferPdf = () =>
  customerTransferFile([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

function customerTransferStored(
  insert: CustomerTransferPaymentInsert,
): CustomerTransferPaymentRow {
  return {
    id: customerTransferPaymentId,
    reservationId: insert.reservationId,
    agencyId: insert.agencyId,
    amount: insert.amount,
    currency: insert.currency,
    status: insert.status,
    method: insert.method,
    source: insert.source,
    reference: insert.reference,
    paidAt: insert.paidAt,
    submittedByCustomerAccountId: insert.submittedByCustomerAccountId,
    createdAt: "2026-07-26T12:00:01.000Z",
  };
}

function customerTransferFixture(
  input: Readonly<{
  accounts?: readonly CustomerAgencyAccountRecord[];
  linked?: boolean;
  reservation?: ReturnType<typeof financialReservationRow> | null;
  }> = {},
) {
  const payments = new Map<string, CustomerTransferPaymentRow>();
  const evidence = new Set<string>();
  const state = {
    failUpload: false,
    failEvidence: false,
    uploads: [] as string[],
    removals: [] as string[],
    writes: [] as CustomerTransferPaymentInsert[],
    reads: [] as string[],
  };
  const access = customerAccessFixture({
    accounts: input.accounts ?? [customerAccount()],
  });
  const keyFor = (agencyId: string, idempotencyKey: string) =>
    `${agencyId}:${idempotencyKey}`;
  const evidenceKey = (
    paymentId: string,
    reservationId: string,
    agencyId: string,
  ) => `${paymentId}:${reservationId}:${agencyId}`;
  const service = createCustomerTransferEvidenceService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date(TEST_NOW),
    repository: {
      async findAuthorizedReservation({
        customerAccountId,
        agencyId,
        reservationId,
      }) {
        state.reads.push(
          `reservation:${customerAccountId}:${agencyId}:${reservationId}`,
        );
        return input.linked === false
          ? null
          : input.reservation === undefined
            ? financialReservationRow()
            : input.reservation;
      },
      async findByIdempotencyKey({ agencyId, idempotencyKey }) {
        state.reads.push(`idempotency:${agencyId}`);
        return payments.get(keyFor(agencyId, idempotencyKey)) ?? null;
      },
      async insertPayment(payment) {
        const key = keyFor(payment.agencyId, payment.idempotencyKey);
        if (payments.has(key))
          throw Object.assign(new Error("duplicate"), { code: "23505" });
        const stored = customerTransferStored(payment);
        payments.set(key, stored);
        state.writes.push(payment);
        return stored;
      },
      async hasEvidence({ paymentId, reservationId, agencyId }) {
        state.reads.push(`evidence:${paymentId}`);
        return evidence.has(evidenceKey(paymentId, reservationId, agencyId));
      },
      async insertEvidence({ paymentId, reservationId, agencyId }) {
        if (state.failEvidence) throw new Error("metadata unavailable");
        const key = evidenceKey(paymentId, reservationId, agencyId);
        if (evidence.has(key))
          throw Object.assign(new Error("duplicate evidence"), {
            code: "23505",
          });
        evidence.add(key);
      },
    },
    storage: {
      async upload({ path }) {
        if (state.failUpload) throw new Error("storage unavailable");
        if (state.uploads.includes(path))
          throw new Error("object already exists");
        state.uploads.push(path);
      },
      async remove(path) {
        state.removals.push(path);
      },
    },
  });
  return { service, payments, evidence, state, keyFor, evidenceKey };
}

function customerTransferInput(input: Partial<Record<string, unknown>> = {}) {
  return {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    amount: "9563.40",
    paidAt: "2026-07-26T12:00:00.000Z",
    reference: "  TRANSFERENCIA-QA  ",
    idempotencyKey: "9164b7b3-7f98-4b39-9569-4fbd5041376d",
    file: validTransferPdf(),
    ...input,
  };
}

test("comprobante de transferencia valida firmas reales, tamaño y no confía en MIME o nombre", async () => {
  assert.equal(
    (await detectCustomerTransferFile(validTransferPdf()))?.mimeType,
    "application/pdf",
  );
  assert.equal(
    (
      await detectCustomerTransferFile(
        customerTransferFile([0xff, 0xd8, 0xff, 0x00]),
      )
    )?.mimeType,
    "image/jpeg",
  );
  assert.equal(
    (
      await detectCustomerTransferFile(
        customerTransferFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    )?.mimeType,
    "image/png",
  );
  assert.equal(
    (
      await detectCustomerTransferFile(
        customerTransferFile([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ]),
      )
    )?.mimeType,
    "image/webp",
  );
  assert.equal(
    await detectCustomerTransferFile(customerTransferFile([0x00, 0x01], 2)),
    null,
  );
  assert.equal(
    await detectCustomerTransferFile(customerTransferFile([], 0)),
    null,
  );
  assert.equal(
    await detectCustomerTransferFile(
      customerTransferFile(
        [0x25, 0x50, 0x44, 0x46, 0x2d],
        CUSTOMER_TRANSFER_MAX_FILE_BYTES + 1,
      ),
    ),
    null,
  );
});

test("cliente autorizado crea un payment pending customer con evidencia privada y receipt seguro", async () => {
  const fixture = customerTransferFixture();
  const source = financialReservationRow();
  const before = JSON.stringify(source.snapshot);
  const submitted = await fixture.service.submit(customerTransferInput());
  assert.equal(submitted.status, "submitted");
  assert.equal(fixture.payments.size, 1);
  assert.equal(fixture.evidence.size, 1);
  assert.equal(fixture.state.writes[0].status, "pending");
  assert.equal(fixture.state.writes[0].method, "transfer");
  assert.equal(fixture.state.writes[0].source, "customer");
  assert.equal(fixture.state.writes[0].currency, "MXN");
  assert.equal(
    fixture.state.writes[0].submittedByCustomerAccountId,
    "customer-furiver",
  );
  assert.equal(fixture.state.writes[0].reference, "TRANSFERENCIA-QA");
  assert.match(
    fixture.state.uploads[0],
    /^agency-furiver\/[0-9a-f-]+\/[0-9a-f-]+\/evidence\.pdf$/i,
  );
  assert.equal(fixture.state.uploads[0].includes("referencia-privada"), false);
  assert.equal(JSON.stringify(source.snapshot), before);
  if (submitted.status === "submitted") {
    const receipt = JSON.stringify(submitted.payment);
    assert.equal(receipt.includes("paymentId"), false);
    assert.equal(receipt.includes("storage"), false);
    assert.equal(receipt.includes("customerAccount"), false);
    assert.equal(receipt.includes("idempotency"), false);
  }
  const financial = calculateReservationFinancialSummary({
    snapshot: financialReservationRow(),
    payments: [...fixture.payments.values()].map(
      ({ amount, currency, status }) => ({ amount, currency, status }),
    ),
  });
  assert.equal(financial?.balance.remaining, 47817);
});

test("transferencia de cliente conserva aislamiento y valida campos antes de DB o Storage", async () => {
  let wrote = false;
  const unauthenticated = createCustomerTransferEvidenceService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async findAuthorizedReservation() {
        wrote = true;
        return null;
      },
      async findByIdempotencyKey() {
        wrote = true;
        return null;
      },
      async insertPayment() {
        wrote = true;
        throw new Error();
      },
      async hasEvidence() {
        wrote = true;
        return false;
      },
      async insertEvidence() {
        wrote = true;
      },
    },
    storage: {
      async upload() {
        wrote = true;
      },
      async remove() {
        wrote = true;
      },
    },
  });
  assert.deepEqual(await unauthenticated.submit(customerTransferInput()), {
    status: "unauthenticated",
  });
  assert.equal(wrote, false);

  const invalid = customerTransferFixture();
  for (const [field, value] of [
    ["reservationId", "invalid"],
    ["amount", "0"],
    ["amount", "1.001"],
    ["paidAt", "fecha"],
    ["idempotencyKey", "invalid"],
  ] as const) {
    const result = await invalid.service.submit(
      customerTransferInput({ [field]: value }),
    );
    assert.equal(result.status, "invalid_input");
  }
  assert.equal(invalid.payments.size, 0);
  assert.equal(invalid.state.uploads.length, 0);
  const fileInvalid = await invalid.service.submit(
    customerTransferInput({ file: customerTransferFile([1, 2]) }),
  );
  assert.deepEqual(fileInvalid, { status: "invalid_file" });
  assert.equal(invalid.payments.size, 0);

  const otherAccount = customerTransferFixture({
    accounts: [customerAccount({ customerAccountId: "other-account" })],
    linked: false,
  });
  assert.deepEqual(await otherAccount.service.submit(customerTransferInput()), {
    status: "not_found",
  });
  assert.equal(otherAccount.state.writes.length, 0);
  const crisenix = customerTransferFixture();
  assert.deepEqual(
    await crisenix.service.submit(
      customerTransferInput({ requestedAgencySlug: "crisenix" }),
    ),
    { status: "forbidden" },
  );
  assert.equal(crisenix.state.writes.length, 0);
  const suspended = customerTransferFixture({
    accounts: [customerAccount({ status: "suspended" })],
  });
  assert.deepEqual(await suspended.service.submit(customerTransferInput()), {
    status: "forbidden",
  });
  const administratorWithoutCustomerAccount = customerTransferFixture({
    accounts: [],
  });
  assert.deepEqual(
    await administratorWithoutCustomerAccount.service.submit(
      customerTransferInput(),
    ),
    { status: "forbidden" },
  );
  assert.equal(administratorWithoutCustomerAccount.state.writes.length, 0);
});

test("transferencia cliente recupera reintentos y compensa evidencia sin duplicar payment", async () => {
  const fixture = customerTransferFixture();
  const input = customerTransferInput();
  const first = await fixture.service.submit(input);
  const retry = await fixture.service.submit(input);
  assert.equal(first.status, "submitted");
  assert.equal(retry.status, "already_submitted");
  assert.equal(fixture.payments.size, 1);
  assert.equal(fixture.evidence.size, 1);
  assert.equal(fixture.state.uploads.length, 1);
  assert.deepEqual(
    await fixture.service.submit(customerTransferInput({ amount: "5000.00" })),
    { status: "idempotency_conflict" },
  );

  const resumable = customerTransferFixture();
  resumable.state.failUpload = true;
  assert.deepEqual(await resumable.service.submit(customerTransferInput()), {
    status: "storage_error",
  });
  assert.equal(resumable.payments.size, 1);
  resumable.state.failUpload = false;
  assert.equal(
    (await resumable.service.submit(customerTransferInput())).status,
    "submitted",
  );
  assert.equal(resumable.payments.size, 1);
  assert.equal(resumable.evidence.size, 1);

  const metadataFailure = customerTransferFixture();
  metadataFailure.state.failEvidence = true;
  await assert.rejects(
    metadataFailure.service.submit(customerTransferInput()),
    (error: unknown) =>
      error instanceof CustomerTransferError &&
      !error.message.includes("metadata"),
  );
  assert.equal(metadataFailure.payments.size, 1);
  assert.equal(metadataFailure.state.removals.length, 1);

  const concurrent = customerTransferFixture();
  const results = await Promise.all([
    concurrent.service.submit(customerTransferInput()),
    concurrent.service.submit(customerTransferInput()),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [
    "already_submitted",
    "submitted",
  ]);
  assert.equal(concurrent.payments.size, 1);
  assert.equal(concurrent.evidence.size, 1);
  assert.equal(concurrent.state.uploads.length, 1);

  const repository = readFileSync(
    "lib/payments/customer-transfer-repository.ts",
    "utf8",
  );
  const storage = readFileSync(
    "lib/payments/customer-transfer-storage.ts",
    "utf8",
  );
  assert.match(
    repository,
    /submitted_by_customer_account_id: payment\.submittedByCustomerAccountId/,
  );
  assert.match(repository, /source: "customer"/);
  assert.match(repository, /status: "pending"/);
  assert.match(repository, /created_by_user_id: null/);
  assert.match(
    repository,
    /\.eq\("customer_account_id", customerAccountId\)[\s\S]*\.eq\("agency_id", agencyId\)[\s\S]*\.eq\("reservation_id", reservationId\)/,
  );
  assert.match(
    repository,
    /\.from\("payment_evidence"\)[\s\S]*\.eq\("payment_id", paymentId\)[\s\S]*\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)/,
  );
  assert.match(storage, /upsert: false/);
  assert.equal(storage.includes("createSignedUrl"), false);
  assert.equal(storage.includes("getPublicUrl"), false);
});

test("transferencia staged firma después de autorizar, valida bytes y crea payment sólo al finalizar", async () => {
  const access = customerAccessFixture({ accounts: [customerAccount()] });
  const payments = new Map<string, CustomerTransferPaymentRow>();
  const evidence = new Set<string>();
  const objects = new Map<string, Uint8Array>();
  const keyFor = (agencyId: string, idempotencyKey: string) =>
    `${agencyId}:${idempotencyKey}`;
  const service = createCustomerTransferUploadService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date(TEST_NOW),
    repository: {
      async findAuthorizedReservation({ agencyId, reservationId }) {
        return agencyId === "agency-furiver" &&
          reservationId === customerDetailReservationId
          ? financialReservationRow()
          : null;
      },
      async listReservationPayments() {
        return [...payments.values()].map(({ amount, currency, status }) => ({
          amount,
          currency,
          status,
        }));
      },
      async findByIdempotencyKey({ agencyId, idempotencyKey }) {
        return payments.get(keyFor(agencyId, idempotencyKey)) ?? null;
      },
      async finalizePaymentAndEvidence({
        paymentId,
        payment,
        evidence: evidenceInput,
      }) {
        const key = keyFor(payment.agencyId, payment.idempotencyKey);
        if (payments.has(key)) return { status: "existing" as const };
        payments.set(key, {
          ...customerTransferStored(payment),
          id: paymentId,
        });
        evidence.add(
          `${evidenceInput.paymentId}:${evidenceInput.reservationId}:${evidenceInput.agencyId}`,
        );
        return { status: "created" as const };
      },
      async insertPayment(insert) {
        const key = keyFor(insert.agencyId, insert.idempotencyKey);
        if (payments.has(key))
          throw Object.assign(new Error("duplicate"), { code: "23505" });
        const payment = customerTransferStored(insert);
        payments.set(key, payment);
        return payment;
      },
      async hasEvidence({ paymentId, reservationId, agencyId }) {
        return evidence.has(`${paymentId}:${reservationId}:${agencyId}`);
      },
      async insertEvidence({ paymentId, reservationId, agencyId }) {
        evidence.add(`${paymentId}:${reservationId}:${agencyId}`);
      },
    },
    storage: {
      async createSignedUpload({ path }) {
        return { path, token: "temporary-upload-token" };
      },
      async download(path) {
        const bytes = objects.get(path);
        if (!bytes) throw new Error("missing");
        return bytes;
      },
      async move({ fromPath, toPath }) {
        const bytes = objects.get(fromPath);
        if (!bytes || objects.has(toPath)) throw new Error("move");
        objects.delete(fromPath);
        objects.set(toPath, bytes);
      },
      async remove(path) {
        objects.delete(path);
      },
    },
  });
  const input = customerTransferInput();
  const prepared = await service.prepare({ ...input, fileSize: 8 });
  assert.equal(prepared.status, "ready");
  assert.equal(payments.size, 0);
  if (prepared.status !== "ready") return;
  assert.match(
    prepared.upload.path,
    /^agency-furiver\/[0-9a-f-]+\/staging\/[0-9a-f-]+$/i,
  );
  objects.set(
    prepared.upload.path,
    new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
  );
  const finalized = await service.finalize(input);
  assert.equal(finalized.status, "submitted");
  assert.equal(payments.size, 1);
  assert.equal(evidence.size, 1);
  assert.equal(
    [...objects.keys()].some((path) => /\/evidence\.pdf$/.test(path)),
    true,
  );
  assert.equal((await service.finalize(input)).status, "already_submitted");

  const invalidKey = "48f3dddf-5c89-43b2-8fec-a42199f5a9f8";
  const invalidPrepared = await service.prepare({
    ...input,
    idempotencyKey: invalidKey,
    fileSize: 2,
  });
  if (invalidPrepared.status !== "ready")
    throw new Error("expected signed staging upload");
  objects.set(invalidPrepared.upload.path, new Uint8Array([0, 1]));
  assert.deepEqual(
    await service.finalize({ ...input, idempotencyKey: invalidKey }),
    { status: "invalid_file" },
  );
  assert.equal(objects.has(invalidPrepared.upload.path), false);
  assert.equal(payments.size, 1);
});

test("reporte de transferencia limita nuevos pending por saldo reportable en prepare y finalize", async () => {
  const access = customerAccessFixture({ accounts: [customerAccount()] });
  const payments = new Map<string, CustomerTransferPaymentRow>();
  const objects = new Map<string, Uint8Array>();
  const removals: string[] = [];
  const keyFor = (key: string) => `agency-furiver:${key}`;
  const basePayments: ReservationPaymentFinancialRow[] = [
    { amount: 4000, currency: "MXN", status: "confirmed" },
    { amount: 2000, currency: "MXN", status: "pending" },
    { amount: 1000, currency: "MXN", status: "cancelled" },
  ];
  const service = createCustomerTransferUploadService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date(TEST_NOW),
    repository: {
      async findAuthorizedReservation() {
        return financialReservationRow({
          total: 10000,
          depositPercent: 20,
          depositRequired: 2000,
        });
      },
      async listReservationPayments() {
        return [...basePayments, ...payments.values()].map(
          ({ amount, currency, status }) => ({ amount, currency, status }),
        );
      },
      async findByIdempotencyKey({ idempotencyKey }) {
        return payments.get(keyFor(idempotencyKey)) ?? null;
      },
      async finalizePaymentAndEvidence({
        paymentId,
        payment,
        evidence: evidenceInput,
        contractTotalCents,
      }) {
        const key = keyFor(payment.idempotencyKey);
        if (payments.has(key)) return { status: "existing" as const };
        const financialRows = [...basePayments, ...payments.values()];
        const confirmed = financialRows
          .filter((row) => row.status === "confirmed")
          .reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
        const pending = financialRows
          .filter((row) => row.status === "pending")
          .reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
        if (confirmed >= contractTotalCents)
          return { status: "reservation_paid_in_full" as const };
        const remaining = Math.max(contractTotalCents - confirmed - pending, 0);
        if (remaining === 0)
          return { status: "pending_covers_balance" as const };
        if (Math.round(payment.amount * 100) > remaining)
          return { status: "amount_exceeds_reportable_balance" as const };
        payments.set(key, {
          ...customerTransferStored(payment),
          id: paymentId,
        });
        void evidenceInput;
        return { status: "created" as const };
      },
      async insertPayment(insert) {
        const key = keyFor(insert.idempotencyKey);
        if (payments.has(key))
          throw Object.assign(new Error("duplicate"), { code: "23505" });
        const payment = customerTransferStored(insert);
        payments.set(key, payment);
        return payment;
      },
      async hasEvidence() {
        return false;
      },
      async insertEvidence() {},
    },
    storage: {
      async createSignedUpload({ path }) {
        return { path, token: "temporary" };
    },
      async download(path) {
        const bytes = objects.get(path);
        if (!bytes) throw new Error("missing");
        return bytes;
      },
      async move({ fromPath, toPath }) {
        const bytes = objects.get(fromPath);
        if (!bytes) throw new Error("missing");
        objects.delete(fromPath);
        objects.set(toPath, bytes);
      },
      async remove(path) {
        removals.push(path);
        objects.delete(path);
      },
    },
  });
  const firstKey = "0dce1e1a-5d14-4cff-b2ea-d506aa4c7eb3";
  const secondKey = "1dce1e1a-5d14-4cff-b2ea-d506aa4c7eb3";
  const tooLarge = await service.prepare({
    ...customerTransferInput({ amount: "4000.01", idempotencyKey: firstKey }),
    fileSize: 8,
  });
  assert.deepEqual(tooLarge, { status: "amount_exceeds_reportable_balance" });
  const first = await service.prepare({
    ...customerTransferInput({ amount: "4000.00", idempotencyKey: firstKey }),
    fileSize: 8,
  });
  const second = await service.prepare({
    ...customerTransferInput({ amount: "4000.00", idempotencyKey: secondKey }),
    fileSize: 8,
  });
  assert.equal(first.status, "ready");
  assert.equal(second.status, "ready");
  if (first.status !== "ready" || second.status !== "ready") return;
  objects.set(
    first.upload.path,
    new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
  );
  objects.set(
    second.upload.path,
    new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
  );
  assert.equal(
    (
      await service.finalize(
        customerTransferInput({ amount: "4000.00", idempotencyKey: firstKey }),
      )
    ).status,
    "submitted",
  );
  assert.deepEqual(
    await service.finalize(
      customerTransferInput({ amount: "4000.00", idempotencyKey: secondKey }),
    ),
    { status: "pending_payments_cover_remaining" },
  );
  assert.equal(payments.size, 1);
  assert.equal(objects.has(second.upload.path), false);
  assert.ok(removals.some((path) => /\/evidence\.pdf$/.test(path)));

  const full = createCustomerTransferUploadService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findAuthorizedReservation() {
        return financialReservationRow({ total: 10000 });
      },
      async listReservationPayments() {
        return [{ amount: 10000, currency: "MXN", status: "confirmed" }];
      },
      async findByIdempotencyKey() {
        return null;
      },
      async finalizePaymentAndEvidence() {
        throw new Error("must not finalize");
      },
      async insertPayment() {
        throw new Error("must not insert");
      },
      async hasEvidence() {
        return false;
      },
      async insertEvidence() {},
    },
    storage: {
      async createSignedUpload() {
        throw new Error("must not sign");
      },
      async download() {
        throw new Error("must not download");
      },
      async move() {},
      async remove() {},
    },
  });
  assert.deepEqual(
    await full.prepare({
      ...customerTransferInput({ amount: "1.00" }),
      fileSize: 8,
    }),
    { status: "reservation_paid_in_full" },
  );
});

test("finalización atómica serializa una reservación y no sobre-reserva con idempotency keys distintas", async () => {
  const access = customerAccessFixture({ accounts: [customerAccount()] });
  const payments = new Map<string, CustomerTransferPaymentRow>();
  const evidence = new Set<string>();
  const objects = new Map<string, Uint8Array>();
  const base: ReservationPaymentFinancialRow[] = [
    { amount: 7000, currency: "MXN", status: "confirmed" },
  ];
  const keyFor = (key: string) => `agency-furiver:${key}`;
  let previous = Promise.resolve();
  const service = createCustomerTransferUploadService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date(TEST_NOW),
    repository: {
      async findAuthorizedReservation() {
        return financialReservationRow({ total: 10000 });
      },
      async listReservationPayments() {
        return [...base, ...payments.values()].map(
          ({ amount, currency, status }) => ({ amount, currency, status }),
        );
      },
      async findByIdempotencyKey({ idempotencyKey }) {
        return payments.get(keyFor(idempotencyKey)) ?? null;
      },
      async finalizePaymentAndEvidence({
        paymentId,
        payment,
        evidence: evidenceInput,
        contractTotalCents,
      }) {
        const before = previous;
        let release: () => void = () => undefined;
        previous = new Promise<void>((resolve) => {
          release = resolve;
        });
        await before;
        try {
          const key = keyFor(payment.idempotencyKey);
          if (payments.has(key)) return { status: "existing" as const };
          const rows = [...base, ...payments.values()];
          const confirmed = rows
            .filter((row) => row.status === "confirmed")
            .reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
          const pending = rows
            .filter((row) => row.status === "pending")
            .reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
          if (confirmed >= contractTotalCents)
            return { status: "reservation_paid_in_full" as const };
          const reportable = Math.max(
            contractTotalCents - confirmed - pending,
            0,
          );
          if (reportable === 0)
            return { status: "pending_covers_balance" as const };
          if (Math.round(payment.amount * 100) > reportable)
            return { status: "amount_exceeds_reportable_balance" as const };
          payments.set(key, {
            ...customerTransferStored(payment),
            id: paymentId,
          });
          evidence.add(
            `${evidenceInput.paymentId}:${evidenceInput.reservationId}:${evidenceInput.agencyId}`,
          );
          return { status: "created" as const };
        } finally {
          release();
        }
      },
      async insertPayment() {
        throw new Error("atomic RPC must be the payment barrier");
      },
      async hasEvidence({ paymentId, reservationId, agencyId }) {
        return evidence.has(`${paymentId}:${reservationId}:${agencyId}`);
      },
      async insertEvidence() {
        throw new Error("atomic RPC must create evidence");
      },
    },
    storage: {
      async createSignedUpload({ path }) {
        return { path, token: "temporary" };
      },
      async download(path) {
        const bytes = objects.get(path);
        if (!bytes) throw new Error("missing");
        return bytes;
      },
      async move({ fromPath, toPath }) {
        const bytes = objects.get(fromPath);
        if (!bytes) throw new Error("missing");
        objects.delete(fromPath);
        objects.set(toPath, bytes);
      },
      async remove(path) {
        objects.delete(path);
      },
    },
  });
  const keyA = "1dce1e1a-5d14-4cff-b2ea-d506aa4c7eb3";
  const keyB = "2dce1e1a-5d14-4cff-b2ea-d506aa4c7eb3";
  const [preparedA, preparedB] = await Promise.all([
    service.prepare({
      ...customerTransferInput({ amount: "3000.00", idempotencyKey: keyA }),
      fileSize: 8,
    }),
    service.prepare({
      ...customerTransferInput({ amount: "3000.00", idempotencyKey: keyB }),
      fileSize: 8,
    }),
  ]);
  if (preparedA.status !== "ready" || preparedB.status !== "ready")
    throw new Error("both preflights should be ready");
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  objects.set(preparedA.upload.path, pdf);
  objects.set(preparedB.upload.path, pdf);
  const results = await Promise.all([
    service.finalize(
      customerTransferInput({ amount: "3000.00", idempotencyKey: keyA }),
    ),
    service.finalize(
      customerTransferInput({ amount: "3000.00", idempotencyKey: keyB }),
    ),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [
    "pending_payments_cover_remaining",
    "submitted",
  ]);
  assert.equal(payments.size, 1);
  assert.equal(evidence.size, 1);
  assert.equal(
    [...payments.values()].reduce((sum, payment) => sum + payment.amount, 0),
    3000,
  );
});

test("RPC de finalize bloquea por reservación y conserva payment más evidencia en un solo límite server-only", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801190000_atomic_customer_transfer_finalize.sql",
    "utf8",
  );
  const core = readFileSync("lib/payments/customer-transfer-core.ts", "utf8");
  const repository = readFileSync(
    "lib/payments/customer-transfer-repository.ts",
    "utf8",
  );
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public, pg_temp/i);
  assert.match(migration, /reservation_snapshots[\s\S]*for update/i);
  assert.match(migration, /Idempotency precedes capacity/i);
  assert.match(migration, /reservation_payments[\s\S]*idempotency_key/i);
  assert.match(migration, /pending_covers_balance/);
  assert.match(
    migration,
    /insert into public\.reservation_payments[\s\S]*insert into public\.payment_evidence/i,
  );
  assert.match(
    migration,
    /revoke all on function[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(migration, /grant execute on function[\s\S]*to service_role/i);
  assert.match(
    repository,
    /\.rpc\("finalize_customer_transfer_payment_atomic"/,
  );
  assert.match(core, /finalizePaymentAndEvidence/);
  assert.doesNotMatch(
    core.slice(
      core.indexOf("async finalize(input"),
      core.indexOf("// Kept as an in-memory"),
    ),
    /repository\(\)\.insertPayment/,
  );
});

test("formulario cliente usa URL firmada, conserva UTC e idempotencia sin enviar File a Vercel", () => {
  const action = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/transfer-actions.ts",
    "utf8",
  );
  const form = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/customer-transfer-form.tsx",
    "utf8",
  );
  const core = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/customer-transfer-form-core.ts",
    "utf8",
  );
  const page = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const iso = localTransferDateTimeToIso("2026-07-26T08:30");
  assert.ok(iso?.endsWith("Z"));
  assert.match(iso as string, /^2026-07-26T/);
  assert.equal(localTransferDateTimeToIso("2026-02-31T08:30"), null);
  assert.match(
    localTransferDateTimeValue(new Date("2026-07-26T12:00:00.000Z")),
    /^2026-07-\d{2}T\d{2}:\d{2}$/,
  );
  assert.equal(
    createCustomerTransferIdempotencyKey({
      randomUUID: () => "2dce1e1a-5d14-4cff-b2ea-d506aa4c7eb3",
    } as Crypto),
    "2dce1e1a-5d14-4cff-b2ea-d506aa4c7eb3",
  );

  assert.match(action, /prepareCustomerTransferUpload\(/);
  assert.match(action, /finalizeCustomerTransferUpload\(/);
  assert.match(
    action,
    /revalidatePath\(customerDetailPath\(input\.requestedAgencySlug, input\.reservationId\)\)/,
  );
  assert.match(
    action,
    /\/admin\/\$\{encodeURIComponent\(input\.requestedAgencySlug\)\}\/reservaciones\/\$\{input\.reservationId\}/,
  );
  assert.equal(action.includes("export const"), false);
  assert.equal(action.includes('formData.get("file")'), false);
  assert.equal(action.includes("agencyId:"), false);
  assert.equal(action.includes("currency:"), false);
  assert.equal(action.includes("customerAccountId:"), false);
  assert.equal(action.includes("storagePath:"), false);
  assert.match(form, /<dialog/);
  assert.match(form, /type="datetime-local"/);
  assert.match(form, /localTransferDateTimeToIso\(/);
  assert.match(
    form,
    /accept="application\/pdf,image\/jpeg,image\/png,image\/webp"/,
  );
  assert.match(form, /PDF, JPG, PNG o WebP\. Máximo 10 MB\./);
  assert.match(form, /uploadToSignedUrl/);
  assert.match(form, /prepared\.upload\.path, prepared\.upload\.token, file/);
  assert.match(form, /Preparando carga…/);
  assert.match(form, /Subiendo comprobante…/);
  assert.match(form, /Validando comprobante…/);
  assert.equal(form.includes("action={"), false);
  assert.equal(form.includes("localStorage"), false);
  assert.equal(form.includes("storagePath"), false);
  assert.equal(form.includes("paymentId"), false);
  assert.match(page, /<CustomerTransferForm/);
  assert.throws(() => readFileSync("next.config.mjs", "utf8"));
});

test("vista de mis reservaciones usa el repositorio seguro, pagina y no filtra por datos privados", () => {
  assert.equal(parseCustomerReservationPage("3"), 3);
  assert.equal(parseCustomerReservationPage("0"), 1);
  assert.equal(parseCustomerReservationPage("-1"), 1);
  assert.equal(parseCustomerReservationPage("texto"), 1);
  assert.equal(
    customerReservationHref("furiver", "pending", 2),
    "/cuenta/furiver/reservaciones?status=pending&page=2",
  );

  const page = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/page.tsx",
    "utf8",
  );
  const queryIndex = page.indexOf("listCustomerReservations({");
  assert.ok(queryIndex >= 0);
  assert.match(page, /limit: PAGE_SIZE/);
  assert.match(page, /offset: \(page - 1\) \* PAGE_SIZE/);
  assert.match(page, /Aún no tienes reservaciones vinculadas\./);
  assert.equal(page.includes("resolveCustomerAgencyAccess"), false);
  assert.equal(page.includes("reservation_customer_access"), false);
  assert.equal(page.includes("customerAccountId"), false);
  assert.equal(page.includes("agencyId"), false);
  assert.equal(page.includes("fullName"), false);
  assert.equal(page.includes("email"), false);
  assert.equal(page.includes("phone"), false);
  assert.equal(page.includes("snapshot"), false);
});

test("vista de cliente traduce estados y próximos pasos sin cambiar la reservación", () => {
  assert.equal(customerReservationStatusLabel("pending"), "Pendiente");
  assert.equal(customerReservationStatusLabel("paid"), "Pagada");
  assert.equal(
    customerReservationNextStep("pending"),
    "Espera las instrucciones de la agencia para completar tu anticipo.",
  );
  assert.equal(
    customerReservationNextStep("paid"),
    "Tu reservación está pagada. Consulta próximamente tus documentos de viaje.",
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
      error instanceof ReservationServerCommandError &&
      error.kind === "not_found",
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
  assert.equal(
    retry.reservation.depositAmount,
    first.reservation.depositAmount,
  );
  assert.equal(
    retry.reservation.remainingAmount,
    first.reservation.remainingAmount,
  );
});

test("la persistencia conserva el UUID de la fila sin convertir un retry en conflicto", async () => {
  const reservation = finalizedReservationForRepository("persisted-row-id");
  const persistedId = "46a10852-8620-4a59-9187-a21b07ce3f05";
  const persisted = {
    agencyId: reservation.agency.id,
    idempotencyKey: reservation.idempotencyKey,
    reservationCode: reservation.reservationCode,
    status: reservation.status,
    currency: reservation.currency,
    snapshot: { ...reservation, id: persistedId },
  };
  const repository = createReservationSnapshotRepository({
    async findByIdempotency() {
      return persisted;
    },
    async findByReservationCode() {
      return null;
    },
    async insert() {
      throw new Error("No debe insertar durante un retry");
    },
  });

  const result = await repository.insert({
    agencyId: reservation.agency.id,
    idempotencyKey: reservation.idempotencyKey,
    snapshot: reservation,
  });
  assert.equal(result.created, false);
  assert.equal(result.reservation.id, persistedId);

  const source = readFileSync(
    "lib/reservations/supabase-repository.ts",
    "utf8",
  );
  assert.match(source, /id, agency_id, idempotency_key/);
  assert.match(source, /id: row\.id/);
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
    reservationApiRequest(publicReservationBody(), {
      contentType: "text/plain",
    }),
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
  assert.equal(
    retry.reservation.reservationCode,
    first.reservation.reservationCode,
  );
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

  assert.equal(reservation.reservationCode, `${input.tour.code}-260729-A1B2C3`);
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
  assert.equal(
    second.reservation.reservationCode,
    first.reservation.reservationCode,
  );
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
    {
      id: "faq",
      type: "faq",
      enabled: true,
      order: 2,
      showInStickyNavigation: true,
    },
    {
      id: "summary",
      type: "summary",
      enabled: true,
      order: 1,
      showInStickyNavigation: true,
    },
    { id: "off", type: "video", enabled: false, order: 0 },
  ];
  trip.faqContent = { displayMode: "accordion", items: [] };
  assert.deepEqual(
    resolveTripSections(trip).map((item) => item.type),
    ["summary"],
  );
});
test("sticky nav refleja orden y visibilidad reales", () => {
  const trip = configuredTrip();
  const sticky = getStickyTripSections(trip);
  assert.ok(sticky.length > 1);
  assert.deepEqual(
    sticky,
    [...sticky].sort((a, b) => a.order - b.order),
  );
  assert.ok(
    sticky.every((item) => item.enabled && item.showInStickyNavigation),
  );
});
test("la configuración predeterminada tiene identificadores y orden estable", () => {
  assert.equal(DEFAULT_TRIP_SECTIONS[0].type, "summary");
  assert.equal(
    new Set(DEFAULT_TRIP_SECTIONS.map((item) => item.id)).size,
    DEFAULT_TRIP_SECTIONS.length,
  );
});
test("duración singular y con noches se formatea sin cero noches", () => {
  assert.equal(formatTripDuration(1, 0), "1 día");
  assert.equal(formatTripDuration(2, 1), "2 días · 1 noche");
});
test("destinos del itinerario se ordenan, deduplican y limitan", () => {
  const days = [
    {
      day: 2,
      order: 2,
      title: "B",
      description: "",
      stops: [{ id: "3", name: "Aculco", order: 1 }],
    },
    {
      day: 1,
      order: 1,
      title: "A",
      description: "",
      stops: [
        { id: "1", name: "Amealco", order: 1 },
        { id: "2", name: "Aculco", order: 2 },
      ],
    },
  ];
  assert.deepEqual(getVisitedDestinations(days, 2), ["Amealco", "Aculco"]);
});
test("precio con hospedaje usa adulto doble", () => {
  const trip = travels.find(
    (item) => item.accommodationMode === "hotel_occupancy",
  )!;
  assert.equal(
    getTripDisplayStartingPrice({ trip }).amount,
    trip.pricingOptions.find((item) => item.occupancy === "double")!.amount,
  );
  assert.equal(getTripDisplayStartingPrice({ trip }).basis, "adult_double");
});
test("precio sin hospedaje usa adulto general", () => {
  const trip = travels.find((item) => item.accommodationMode === "none")!;
  assert.equal(
    getTripDisplayStartingPrice({ trip }).amount,
    trip.pricingOptions.find((item) => item.occupancy === "general")!.amount,
  );
  assert.equal(getTripDisplayStartingPrice({ trip }).basis, "adult_general");
});
test("override de salida sustituye el precio sin mutar el viaje", () => {
  const trip = travels.find((item) =>
    item.departures.some((departure) => departure.pricing?.mode === "custom"),
  )!;
  const departure = trip.departures.find(
    (item) => item.pricing?.mode === "custom",
  )!;
  const base = trip.basePrice.amount;
  assert.notEqual(
    getTripDisplayStartingPrice({ trip, departure }).amount,
    base,
  );
  assert.equal(trip.basePrice.amount, base);
});
test("modos del itinerario producen estados de apertura correctos", () => {
  assert.deepEqual(getInitialItineraryOpenDays("all_open", 3), [0, 1, 2]);
  assert.deepEqual(getInitialItineraryOpenDays("first_open", 3), [0]);
  assert.deepEqual(getInitialItineraryOpenDays("all_closed", 3), []);
});
test("video vacío y proveedor desconocido se rechazan", () => {
  assert.equal(
    getSafeVideoPresentation({ enabled: true, provider: "html5", url: "" }),
    null,
  );
  assert.equal(
    getSafeVideoPresentation({
      enabled: true,
      provider: "youtube",
      url: "https://evil.example/watch?v=abcdef",
    }),
    null,
  );
});
test("YouTube, Vimeo, TikTok, Instagram y HTML5 usan presentaciones controladas", () => {
  assert.equal(
    getSafeVideoPresentation({
      enabled: true,
      provider: "youtube",
      url: "https://youtube.com/watch?v=abcdef1",
    })?.mode,
    "iframe",
  );
  assert.equal(
    getSafeVideoPresentation({
      enabled: true,
      provider: "vimeo",
      url: "https://vimeo.com/123456",
    })?.mode,
    "iframe",
  );
  assert.equal(
    getSafeVideoPresentation({
      enabled: true,
      provider: "tiktok",
      url: "https://www.tiktok.com/@demo/video/123",
    })?.mode,
    "link",
  );
  assert.equal(
    getSafeVideoPresentation({
      enabled: true,
      provider: "instagram",
      url: "https://instagram.com/reel/demo",
    })?.mode,
    "link",
  );
  assert.equal(
    getSafeVideoPresentation({
      enabled: true,
      provider: "html5",
      url: "https://cdn.example/demo.mp4",
    })?.mode,
    "html5",
  );
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
  assert.deepEqual(
    parseBulletedRecommendations("• Calzado\n\n- Agua\n* Bloqueador").map(
      (item) => item.text,
    ),
    ["Calzado", "Agua", "Bloqueador"],
  );
});
test("ruta mantiene orden por día y orden interno", () => {
  assert.deepEqual(
    getOrderedRouteStops({
      enabled: true,
      mode: "route",
      routeStops: [
    { id: "b", dayNumber: 2, name: "B", order: 1 },
    { id: "a2", dayNumber: 1, name: "A2", order: 2 },
    { id: "a1", dayNumber: 1, name: "A1", order: 1 },
      ],
    }).map((item) => item.id),
    ["a1", "a2", "b"],
  );
});
test("puntos públicos filtran desactivados y conservan orden", () => {
  assert.deepEqual(
    getPublicDeparturePoints([
    { id: "2", type: "airport", name: "Aeropuerto", enabled: true, order: 2 },
    { id: "off", type: "hotel", name: "Oculto", enabled: false, order: 0 },
      {
        id: "1",
        type: "city_boarding",
        name: "Centro",
        enabled: true,
        order: 1,
      },
    ]).map((item) => item.id),
    ["1", "2"],
  );
});
test("formulario de descarga valida nombre, WhatsApp y consentimiento", () => {
  assert.deepEqual(
    Object.keys(
      validateLead({ name: " ", whatsapp: "55", consent: false }),
    ).sort(),
    ["consent", "name", "whatsapp"],
  );
  assert.deepEqual(
    validateLead({ name: "Ana", whatsapp: "+525512345678", consent: true }),
    {},
  );
});
test("demos incluyen descarga directa y descarga con formulario", () => {
  const configured = travels.filter((trip) => trip.itineraryDownload?.enabled);
  assert.ok(
    configured.some((trip) => !trip.itineraryDownload?.requireLeadForm),
  );
  assert.ok(configured.some((trip) => trip.itineraryDownload?.requireLeadForm));
});
test("día sin imagen no requiere hueco estructural", () => {
  const trip = configuredTrip();
  assert.ok(
    trip.itinerary.some((day) => !day.images?.length) ||
      trip.itinerary.length <= 2,
  );
});
test("demos incluyen mapa destino y mapa de ruta", () => {
  assert.ok(
    travels.some((trip) => trip.mapSettings?.mode === "main_destination"),
  );
  assert.ok(travels.some((trip) => trip.mapSettings?.mode === "route"));
});
test("demos incluyen punto terrestre y aeropuerto", () => {
  const points = travels.flatMap((trip) => trip.publicDeparturePoints ?? []);
  assert.ok(points.some((point) => point.type === "city_boarding"));
  assert.ok(
    points.some((point) => point.type === "airport" && point.airportCode),
  );
});
test("información importante y FAQ solo existen con contenido útil", () => {
  const trip = configuredTrip();
  assert.ok(trip.importantInformation!.items.length > 0);
  assert.ok(
    trip.faqContent!.items.every((item) => item.question && item.answer),
  );
});
const barrancasTrip = () =>
  travels.find((trip) => trip.slug === "barrancas-del-cobre")!;
test("viaje de cinco días usa secciones configurables", () => {
  const trip = barrancasTrip();
  assert.equal(trip.durationDays, 5);
  assert.ok(resolveTripSections(trip).length >= 12);
});
test("viaje de un día sigue usando secciones configurables", () => {
  const trip = travels.find((item) => item.slug === "bosque-de-luciernagas")!;
  assert.equal(trip.durationDays, 1);
  assert.ok(
    resolveTripSections(trip).some((section) => section.type === "itinerary"),
  );
});
test("el número de días no controla el orquestador modular", () => {
  const oneDay = travels.find((item) => item.slug === "bosque-de-luciernagas")!;
  const multiday = barrancasTrip();
  assert.ok(oneDay.pageConfiguration);
  assert.ok(multiday.pageConfiguration);
  assert.equal(
    typeof resolveTripSections(oneDay)[0].order,
    typeof resolveTripSections(multiday)[0].order,
  );
});
test("Barrancas contiene cinco días con identificadores estables", () => {
  const days = barrancasTrip().itinerary;
  assert.equal(days.length, 5);
  assert.deepEqual(
    days.map((day) => day.day),
    [1, 2, 3, 4, 5],
  );
  assert.equal(new Set(days.map((day) => day.id)).size, 5);
});
test("Barrancas extrae destinos desde los cinco días sin duplicados", () => {
  assert.deepEqual(getVisitedDestinations(barrancasTrip().itinerary), [
    "Chihuahua",
    "Creel",
    "Divisadero",
    "Barrancas del Cobre",
  ]);
});
test("precio desde de Barrancas usa la base doble", () => {
  const result = getTripDisplayStartingPrice({ trip: barrancasTrip() });
  assert.equal(result.amount, 14990);
  assert.equal(result.basis, "adult_double");
});
test("la misma salida activa alimenta resumen y panel", () => {
  const trip = barrancasTrip();
  const selected = trip.departures[1];
  assert.equal(
    getTripDisplayStartingPrice({ trip, departure: selected }).amount,
    selected.pricing?.pricingOverrides?.adultDouble,
  );
});
test("cambiar fecha conserva viajeros y actualiza el texto de WhatsApp", () => {
  const trip = barrancasTrip();
  const first = explorerBookingMessage({
    agencyName: "Furiver",
    trip,
    departureLabel: "10 de agosto",
    adults: 2,
    children: 0,
    occupancyLabel: "Doble",
    totalLabel: "$29,980 MXN",
    depositLabel: "$2,000 MXN",
    url: "https://demo.test",
  });
  const second = explorerBookingMessage({
    agencyName: "Furiver",
    trip,
    departureLabel: "7 de septiembre",
    adults: 2,
    children: 0,
    occupancyLabel: "Doble",
    totalLabel: "$32,378 MXN",
    depositLabel: "$2,000 MXN",
    url: "https://demo.test",
  });
  assert.match(first, /10 de agosto/);
  assert.match(second, /7 de septiembre/);
  assert.match(second, /2 adultos/);
});
test("override de salida aplica a la tarifa doble efectiva", () => {
  const trip = barrancasTrip();
  const departure = trip.departures[1];
  const rate = trip.pricingOptions.find((item) => item.occupancy === "double")!;
  assert.equal(
    getEffectiveRateAmount({ trip, departure, rate }),
    departure.pricing!.pricingOverrides!.adultDouble,
  );
});
test("dos adultos no duplican la tarifa más de una vez", () => {
  const trip = barrancasTrip();
  const departure = trip.departures[0];
  const rate = trip.pricingOptions.find((item) => item.occupancy === "double")!;
  const priced = priceLinePending({
    id: "barrancas-double",
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: departure.id,
    boardingOptionId: null,
    pricingOptionId: rate.id,
    travelers: 2,
    extraIds: [],
  });
  assert.equal(priced.subtotal, 29980);
});
test("impuestos de Barrancas se aplican una sola vez por viajero", () => {
  const trip = barrancasTrip();
  const departure = trip.departures[0];
  const rate = trip.pricingOptions.find((item) => item.occupancy === "double")!;
  const perTraveler = getEffectiveTaxesPerTraveler({ trip, departure, rate });
  const priced = priceLinePending({
    id: "barrancas-tax",
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: departure.id,
    boardingOptionId: null,
    pricingOptionId: rate.id,
    travelers: 2,
    extraIds: [],
  });
  assert.equal(priced.taxes, perTraveler * 2);
  assert.equal(priced.total, priced.subtotal + priced.taxes);
});
test("cargos adicionales permanecen separados del subtotal e impuestos", () => {
  const trip = barrancasTrip();
  const rate = trip.pricingOptions.find((item) => item.occupancy === "double")!;
  const priced = priceLinePending({
    id: "barrancas-extra",
    agencyId: trip.agencyId,
    travelId: trip.id,
    departureId: trip.departures[0].id,
    boardingOptionId: null,
    pricingOptionId: rate.id,
    travelers: 2,
    extraIds: [trip.extras[0].id],
  });
  assert.equal(
    priced.total,
    priced.subtotal + priced.taxes + priced.extrasTotal,
  );
});
test("capacidad hotelera continúa activa para Barrancas", () => {
  const result = validateRoomCapacity({
    adults: 2,
    minors: 2,
    maxGuestsPerRoom: 4,
    adultCountsTowardCapacity: true,
    minorCountsTowardCapacity: true,
  });
  assert.equal(result.valid, true);
});
test("menores no cambian la base adulta de Barrancas", () => {
  const trip = barrancasTrip();
  assert.equal(explorerAdultRateOccupancy(trip, 2), "double");
  assert.equal(explorerAdultRateOccupancy(trip, 3), "triple");
});
test("viaje sin hospedaje no expone tarifas hoteleras", () => {
  const trip = travels.find((item) => item.slug === "bosque-de-luciernagas")!;
  assert.ok(
    trip.pricingOptions.every(
      (rate) =>
        !["single", "double", "triple", "quadruple"].includes(rate.occupancy),
    ),
  );
});
test("sticky nav multiday refleja contenido y orden", () => {
  const nav = getStickyTripSections(barrancasTrip());
  assert.ok(nav.some((section) => section.type === "rates"));
  assert.deepEqual(
    nav,
    [...nav].sort((a, b) => a.order - b.order),
  );
});
test("descarga de Barrancas usa su documento específico", () => {
  assert.equal(
    barrancasTrip().itineraryDownload?.fileUrl,
    "/documents/itinerario-barrancas-del-cobre-demo.txt",
  );
});
test("mapa de Barrancas conserva días del itinerario", () => {
  const stops = getOrderedRouteStops(barrancasTrip().mapSettings);
  assert.deepEqual(
    [...new Set(stops.map((stop) => stop.dayNumber))],
    [1, 2, 3, 4, 5],
  );
});
test("Lavella queda registrado sin reemplazar el renderer Explorer", () => {
  assert.equal(TRIP_SECTION_RENDERER_KEYS.explorer, "explorer-cinematic");
  assert.equal(TRIP_SECTION_RENDERER_KEYS.lavella, "lavella-native");
  assert.notEqual(
    TRIP_SECTION_RENDERER_KEYS.lavella,
    TRIP_SECTION_RENDERER_KEYS.explorer,
  );
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
    assert.equal(demoQuerySchema.safeParse({ theme: value }).success, false);
  }
});
test("los selectores públicos y administrativos contienen exactamente dos temas", () => {
  for (const file of [
    "components/travel-app.tsx",
    "components/legacy-travel-app.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    const options = [
      ...source.matchAll(
        /<option value="([^"]+)">(?:Explorer|Lavella)<\/option>/g,
      ),
    ].map((match) => match[1]);
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
  assert.doesNotMatch(
    commerce,
    /(^|\n)\s*\.(container|row|col|header|button|title|active)\b/m,
  );
});

test("Lavella no carga scripts heredados del template", () => {
  const files = [
    "components/themes/lavella/lavella-home-hero.tsx",
    "components/themes/lavella/lavella-mobile-menu.tsx",
    "components/themes/lavella/lavella-trip-sections.tsx",
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    files,
    /jquery|slick\(|lightGallery|dangerouslySetInnerHTML/i,
  );
});

test("detalle Lavella no depende de SharedDetail ni de markup Explorer", () => {
  const files = [
    "lavella-trip-detail.tsx",
    "lavella-trip-hero.tsx",
    "lavella-trip-gallery.tsx",
    "lavella-trip-sections.tsx",
    "lavella-booking-panel.tsx",
  ]
    .map((name) => readFileSync(`components/themes/lavella/${name}`, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    files,
    /SharedDetail|ExplorerBookingPanel|className=["'`]explorer-/,
  );
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
  sourcedTripIds.map((id) => travels.find((trip) => trip.id === id)!);

const patagonia = () =>
  travels.find((trip) => trip.id === "crisenix-patagonia-fin-del-mundo")!;

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
  assert.match(
    homeCss,
    /\.heroArrow \{[\s\S]*display: inline-grid;[\s\S]*place-items: center;/,
  );
  assert.match(
    arrowCss,
    /\.container \{[\s\S]*display: inline-grid;[\s\S]*place-items: center;[\s\S]*padding: 0;[\s\S]*line-height: 0;/,
  );
  assert.match(
    arrowCss,
    /\.container svg \{[\s\S]*display: block;[\s\S]*width: 18px;[\s\S]*height: 18px;/,
  );
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
    canLavellaAutoplay({
      autoplay: true,
      slideCount: 4,
      pauseReasons: resumed,
    }),
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
  assert.equal(
    (home.match(/className=\{styles\.carouselArrowButton\}/g) ?? []).length,
    4,
  );
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
  assert.match(
    css,
    /\.destinationImageCode \{[\s\S]*var\(--lavella-text-on-dark\)/,
  );
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
    .map((name) => readFileSync(`components/themes/lavella/${name}`, "utf8"))
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
  assert.match(app, /new URLSearchParams\(\{ tenant: agency\.slug, theme \}\)/);
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
  assert.match(css, /\.travelerRows[\s\S]*grid-template-columns: 1fr 1fr/);
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
      (trip) =>
        (trip.mapSettings?.routeStops?.length ?? 0) >= trip.durationDays,
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
    sourcedTrips().map((trip) => [trip.durationDays, trip.durationNights]),
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
    () => requireFreshFxSnapshot(result.snapshot, "2026-07-26T12:16:00.000Z"),
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
      item.agencyId === agency.id && item.slug === "barrancas-del-cobre",
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
    (item) => item.agencyId === agency.id && item.basePrice.currency === "MXN",
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
  assert.match(
    booking,
    /if \(!canReserve \|\| !adultLine \|\| reservingRef\.current\) return/,
  );
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
    "primaryContact",
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
  assert.match(
    checkout,
    /"Idempotency-Key": reservationSubmissionKeyRef\.current/,
  );
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
      validateDemoFxOrderShape([makeLine(foreignTrip), makeLine(usdWithoutFx)]),
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

const paymentReceiptDocumentId = "24cf2e61-23bd-4d4a-85ca-e1d7a36fc183";

function paymentReceiptFixture(
  input: Readonly<{
  memberships?: readonly AdminAgencyMembershipRecord[];
  paymentStatus?: string;
  paymentSource?: string;
  reservation?: ReturnType<typeof financialReservationRow> | null;
  payments?: readonly ReservationPaymentFinancialRow[];
  failStorage?: boolean;
  failInsert?: boolean;
  }> = {},
) {
  const documents = new Map<string, PaymentReceiptDocumentRow>();
  const state = {
    requests: [] as string[],
    uploads: [] as string[],
    removals: [] as string[],
    inserts: [] as PaymentReceiptDocumentInsert[],
    pdfs: [] as Parameters<typeof renderPaymentReceiptPdf>[0][],
  };
  const access = adminAccessFixture({
    memberships: input.memberships ?? [adminMembership()],
  });
  const service = createPaymentReceiptService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date(TEST_NOW),
    createDocumentId: () => paymentReceiptDocumentId,
    renderPdf: async (data) => {
      state.pdfs.push(data);
      return new TextEncoder().encode("%PDF-1.7 private receipt");
    },
    repository: {
      async findReservation({ agencyId, reservationId }) {
        state.requests.push(`reservation:${agencyId}:${reservationId}`);
        return input.reservation === undefined
          ? financialReservationRow()
          : input.reservation;
      },
      async findPayment({ agencyId, reservationId, paymentId }) {
        state.requests.push(
          `payment:${agencyId}:${reservationId}:${paymentId}`,
        );
        return paymentId === adminPaymentId
          ? {
              id: paymentId,
              status: input.paymentStatus ?? "confirmed",
              source: input.paymentSource ?? "manual",
              amount: 9563.4,
              currency: "MXN",
              method: "transfer",
              reference: "  REFERENCIA-OPERATIVA  ",
              paidAt: "2026-07-26T12:00:00.000Z",
            }
          : null;
      },
      async listPayments({ agencyId, reservationId }) {
        state.requests.push(`payments:${agencyId}:${reservationId}`);
        return (
          input.payments ?? [
            { amount: 9563.4, currency: "MXN", status: "confirmed" },
          ]
        );
      },
      async findExistingDocument({ agencyId, reservationId, paymentId }) {
        state.requests.push(
          `document:${agencyId}:${reservationId}:${paymentId}`,
        );
        return (
          documents.get(`${agencyId}:${reservationId}:${paymentId}`) ?? null
        );
      },
      async revokeAvailableDocument() {},
      async insertDocument(document) {
        state.inserts.push(document);
        if (input.failInsert) throw new Error("database unavailable");
        const key = `${document.agencyId}:${document.reservationId}:${document.paymentId}`;
        if (documents.has(key))
          throw Object.assign(new Error("duplicate"), { code: "23505" });
        const row = {
          status: document.status,
          version: document.version,
          generatedAt: document.generatedAt,
        } as const;
        documents.set(key, row);
        return row;
      },
    },
    storage: {
      async upload({ path }) {
        if (input.failStorage) throw new Error("storage unavailable");
        state.uploads.push(path);
      },
      async remove(path) {
        state.removals.push(path);
      },
    },
  });
  return { service, documents, state };
}

function paymentReceiptInput(input: Partial<Record<string, unknown>> = {}) {
  return {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    paymentId: adminPaymentId,
    ...input,
  };
}

test("comprobante privado exige acceso administrativo y pago confirmado antes de generar", async () => {
  let queried = false;
  const unauthenticated = createPaymentReceiptService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async findReservation() {
        queried = true;
        return null;
      },
      async findPayment() {
        queried = true;
        return null;
      },
      async listPayments() {
        queried = true;
        return [];
      },
      async findExistingDocument() {
        queried = true;
        return null;
      },
      async revokeAvailableDocument() {
        queried = true;
      },
      async insertDocument() {
        queried = true;
        throw new Error();
      },
    },
    storage: {
      async upload() {
        queried = true;
      },
      async remove() {
        queried = true;
      },
    },
    renderPdf: async () => new TextEncoder().encode("%PDF"),
  });
  assert.deepEqual(await unauthenticated.ensure(paymentReceiptInput()), {
    status: "unauthenticated",
  });
  assert.equal(queried, false);

  const invalid = paymentReceiptFixture();
  assert.deepEqual(
    await invalid.service.ensure(
      paymentReceiptInput({ reservationId: "invalid" }),
    ),
    { status: "not_found" },
  );
  assert.deepEqual(invalid.state.requests, []);
  const pending = paymentReceiptFixture({ paymentStatus: "pending" });
  assert.deepEqual(await pending.service.ensure(paymentReceiptInput()), {
    status: "payment_not_confirmed",
  });
  assert.equal(pending.state.uploads.length, 0);
  const cancelled = paymentReceiptFixture({ paymentStatus: "cancelled" });
  assert.deepEqual(await cancelled.service.ensure(paymentReceiptInput()), {
    status: "payment_not_confirmed",
  });
  const customer = paymentReceiptFixture({ paymentSource: "customer" });
  assert.equal(
    (await customer.service.ensure(paymentReceiptInput())).status,
    "generated",
  );
  const crossTenant = paymentReceiptFixture();
  assert.deepEqual(
    await crossTenant.service.ensure(
      paymentReceiptInput({ requestedAgencySlug: "crisenix" }),
    ),
    { status: "forbidden" },
  );
  assert.deepEqual(crossTenant.state.requests, []);
});

test("comprobante de pago usa ledger real, genera PDF privado e idempotente sin PII", async () => {
  const fixture = paymentReceiptFixture({
    payments: [
      { amount: 9563.4, currency: "MXN", status: "confirmed" },
      { amount: 1000, currency: "MXN", status: "pending" },
    ],
  });
  const beforeSnapshot = JSON.stringify(financialReservationRow().snapshot);
  const first = await fixture.service.ensure(paymentReceiptInput());
  assert.equal(first.status, "generated");
  assert.deepEqual(first.status === "generated" ? first.document : null, {
    documentType: "payment_receipt",
    version: 1,
    generatedAt: TEST_NOW,
  });
  assert.equal(fixture.state.inserts.length, 1);
  assert.equal(fixture.state.inserts[0].mimeType, "application/pdf");
  assert.ok(fixture.state.inserts[0].fileSizeBytes > 0);
  assert.match(
    fixture.state.inserts[0].storagePath,
    /^agency-furiver\/[0-9a-f-]+\/payment_receipt\/[0-9a-f-]+\/v1\.pdf$/i,
  );
  assert.equal(
    fixture.state.inserts[0].storagePath.includes("REFERENCIA"),
    false,
  );
  assert.equal(fixture.state.pdfs[0].confirmedTotal, 9563.4);
  assert.equal(fixture.state.pdfs[0].remaining, 38253.6);
  assert.equal(fixture.state.pdfs[0].reference, "REFERENCIA-OPERATIVA");
  assert.equal(
    JSON.stringify(financialReservationRow().snapshot),
    beforeSnapshot,
  );
  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes("paymentId"), false);
  assert.equal(serialized.includes("storagePath"), false);
  assert.equal(serialized.includes("userId"), false);

  const retry = await fixture.service.ensure(paymentReceiptInput());
  assert.equal(retry.status, "existing");
  assert.equal(fixture.state.uploads.length, 1);
  assert.equal(fixture.state.inserts.length, 1);

  const bytes = await renderPaymentReceiptPdf({
    ...fixture.state.pdfs[0],
    reference: null,
  });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  assert.ok(bytes.length > 0);
  const renderer = readFileSync("lib/documents/payment-receipt-pdf.ts", "utf8");
  assert.match(renderer, /Documento no fiscal/);
  assert.equal(renderer.includes("email"), false);
  assert.equal(renderer.includes("birthDate"), false);
});

test("comprobante privado recupera fallos de Storage o DB sin metadata falsa ni duplicados", async () => {
  const storageFailure = paymentReceiptFixture({ failStorage: true });
  assert.deepEqual(await storageFailure.service.ensure(paymentReceiptInput()), {
    status: "document_storage_error",
  });
  assert.equal(storageFailure.state.inserts.length, 0);

  const databaseFailure = paymentReceiptFixture({ failInsert: true });
  await assert.rejects(
    databaseFailure.service.ensure(paymentReceiptInput()),
    (error: unknown) =>
      error instanceof PaymentReceiptError &&
      !error.message.includes("database"),
  );
  assert.equal(databaseFailure.state.uploads.length, 1);
  assert.equal(databaseFailure.state.removals.length, 1);

  const concurrent = paymentReceiptFixture();
  const results = await Promise.all([
    concurrent.service.ensure(paymentReceiptInput()),
    concurrent.service.ensure(paymentReceiptInput()),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [
    "existing",
    "generated",
  ]);
  assert.equal(concurrent.documents.size, 1);
  assert.ok(concurrent.state.removals.length <= 1);
  const repository = readFileSync(
    "lib/documents/payment-receipt-repository.ts",
    "utf8",
  );
  const storage = readFileSync(
    "lib/documents/payment-receipt-storage.ts",
    "utf8",
  );
  assert.match(
    repository,
    /\.eq\("id", paymentId\)[\s\S]*\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)/,
  );
  assert.match(
    repository,
    /\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)[\s\S]*\.eq\("payment_id", paymentId\)/,
  );
  assert.match(storage, /upsert: false/);
  assert.equal(storage.includes("createSignedUrl"), false);
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

test("el ciclo documental se ejecuta después del ledger y nunca revierte un pago confirmado", async () => {
  const generated: string[] = [];
  const confirmed = manualPaymentFixture({
    async afterConfirmedPayment({ paymentId }) {
      generated.push(paymentId);
      return "ready";
    },
  });
  const result = await confirmed.service.create(manualPaymentInput());
  assert.equal(result.status, "created");
  if (result.status === "created") assert.equal(result.documentStatus, "ready");
  assert.deepEqual(generated, [adminPaymentId]);

  const pending = manualPaymentFixture({
    async afterConfirmedPayment() {
      throw new Error("No debe generar para pending");
    },
  });
  const pendingResult = await pending.service.create(
    manualPaymentInput({ initialStatus: "pending" }),
  );
  assert.equal(pendingResult.status, "created");
  if (pendingResult.status === "created")
    assert.equal(pendingResult.documentStatus, undefined);

  const failedDocument = manualPaymentFixture({
    async afterConfirmedPayment() {
      throw new Error("storage unavailable");
    },
  });
  const failedResult =
    await failedDocument.service.create(manualPaymentInput());
  assert.equal(failedResult.status, "created");
  if (failedResult.status === "created")
    assert.equal(failedResult.documentStatus, "document_error");
  assert.equal(failedDocument.rows[0].status, "confirmed");
  const retried = await failedDocument.service.create(manualPaymentInput());
  assert.equal(retried.status, "already_exists");
  if (retried.status === "already_exists")
    assert.equal(retried.documentStatus, "document_error");
});

test("transiciones exitosas reconcilian recibos y preservan la cancelación ante fallos documentales", async () => {
  const calls: string[] = [];
  const fixture = adminPaymentStatusFixture({
    async afterStatusChanged({ nextStatus }) {
      calls.push(nextStatus);
      return nextStatus === "confirmed" ? "ready" : "revoked";
    },
  });
  const confirmed = await fixture.service.change({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    paymentId: adminPaymentId,
    nextStatus: "confirmed",
  });
  assert.deepEqual(confirmed, {
    status: "updated",
    nextStatus: "confirmed",
    documentStatus: "ready",
  });
  const cancelled = await fixture.service.change({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    paymentId: adminPaymentId,
    nextStatus: "cancelled",
  });
  assert.deepEqual(cancelled, {
    status: "updated",
    nextStatus: "cancelled",
    documentStatus: "revoked",
  });
  assert.deepEqual(calls, ["confirmed", "cancelled"]);

  const pendingCancelled = adminPaymentStatusFixture({
    async afterStatusChanged({ nextStatus }) {
      return nextStatus === "cancelled" ? "not_applicable" : "ready";
    },
  });
  const noGeneration = await pendingCancelled.service.change({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    paymentId: adminPaymentId,
    nextStatus: "cancelled",
  });
  assert.deepEqual(noGeneration, {
    status: "updated",
    nextStatus: "cancelled",
    documentStatus: "not_applicable",
  });

  const documentFailure = adminPaymentStatusFixture({
    async afterStatusChanged() {
      throw new Error("document database failure");
    },
  });
  const failureResult = await documentFailure.service.change({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    paymentId: adminPaymentId,
    nextStatus: "confirmed",
  });
  assert.deepEqual(failureResult, {
    status: "updated",
    nextStatus: "confirmed",
    documentStatus: "document_error",
  });
  assert.equal(documentFailure.row.status, "confirmed");
  assert.equal(
    canTransitionManualPaymentStatus("cancelled", "confirmed"),
    false,
  );
});

test("revocación de recibo conserva metadata y PDF, exige pago cancelado y aislamiento administrativo", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const state = {
    paymentStatus: "cancelled",
    document: "available" as "available" | "revoked" | null,
    updates: 0,
  };
  const service = createPaymentReceiptRevocationService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findReservation({ agencyId, reservationId }) {
        return (
          agencyId === "agency-furiver" &&
          reservationId === customerDetailReservationId
        );
      },
      async findPayment({ paymentId }) {
        return paymentId === adminPaymentId
          ? { status: state.paymentStatus }
          : null;
      },
      async revokeAvailableReceipts() {
        if (state.document !== "available") return 0;
        state.document = "revoked";
        state.updates += 1;
        return 1;
      },
      async hasReceipt() {
        return state.document !== null;
    },
    },
  });
  assert.deepEqual(await service.revoke(paymentReceiptInput()), {
    status: "revoked",
  });
  assert.equal(state.document, "revoked");
  assert.equal(state.updates, 1);
  assert.deepEqual(await service.revoke(paymentReceiptInput()), {
    status: "already_revoked",
  });
  state.paymentStatus = "confirmed";
  assert.deepEqual(await service.revoke(paymentReceiptInput()), {
    status: "payment_not_cancelled",
  });
  assert.equal(state.document, "revoked");
  assert.deepEqual(
    await service.revoke(
      paymentReceiptInput({ requestedAgencySlug: "crisenix" }),
    ),
    { status: "forbidden" },
  );

  const failing = createPaymentReceiptRevocationService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findReservation() {
        throw new Error("SQL private path");
      },
      async findPayment() {
        return null;
      },
      async revokeAvailableReceipts() {
        return 0;
      },
      async hasReceipt() {
        return false;
      },
    },
  });
  await assert.rejects(
    failing.revoke(paymentReceiptInput()),
    (error: unknown) =>
      error instanceof PaymentReceiptRevocationError &&
      !error.message.includes("SQL"),
  );
  const revocationRepository = readFileSync(
    "lib/documents/payment-receipt-revocation-repository.ts",
    "utf8",
  );
  assert.match(revocationRepository, /\.update\(\{ status: "revoked" \}\)/);
  assert.equal(revocationRepository.includes("storage"), false);
  assert.equal(revocationRepository.includes("remove("), false);
});

test("reintento de recibo sólo se presenta para pagos confirmed sin receipt vigente", () => {
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const action = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-actions.ts",
    "utf8",
  );
  const statusAction = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-status-actions.ts",
    "utf8",
  );
  const control = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-receipt-control.tsx",
    "utf8",
  );
  const historyRepository = readFileSync(
    "lib/payments/admin-payment-list-repository.ts",
    "utf8",
  );
  assert.match(
    page,
    /payment\.status === "confirmed" && payment\.receiptStatus !== "available"/,
  );
  assert.match(page, /Comprobante revocado/);
  assert.match(action, /ensurePaymentReceiptDocument\(/);
  assert.match(
    action,
    /El comprobante solo puede generarse para un pago confirmado/,
  );
  assert.match(
    statusAction,
    /Pago confirmado\. El comprobante no pudo generarse/,
  );
  assert.match(control, /Generar comprobante/);
  assert.match(
    historyRepository,
    /from\("reservation_documents"\)[\s\S]*\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)/,
  );
  assert.equal(action.includes("storagePath"), false);
  assert.equal(action.includes("signedUrl"), false);
});

test("documentos cliente se autorizan antes de listar, excluyen revoked y proyectan solamente datos seguros", async () => {
  let queried = false;
  const unauthenticated = createCustomerDocumentListService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async findLinkedReservation() {
        queried = true;
        return false;
      },
      async listAvailableDocuments() {
        queried = true;
        return [];
      },
      async findPaymentContexts() {
        queried = true;
        return new Map();
      },
    },
  });
  assert.deepEqual(
    await unauthenticated.list({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "unauthenticated" },
  );
  assert.equal(queried, false);
  const access = customerAccessFixture({ accounts: [customerAccount()] });
  const list = createCustomerDocumentListService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findLinkedReservation({
        customerAccountId,
        agencyId,
        reservationId,
      }) {
        return (
          customerAccountId === "customer-furiver" &&
          agencyId === "agency-furiver" &&
          reservationId === customerDetailReservationId
        );
      },
      async listAvailableDocuments() {
        return [
          {
            id: paymentReceiptDocumentId,
            documentType: "payment_receipt",
            version: 1,
            generatedAt: "2026-08-20T12:00:00.000Z",
            paymentId: adminPaymentId,
          },
          {
            id: "5bd3cecf-8f8d-4e55-aa98-16fe38e4e8d1",
            documentType: "ticket",
            version: 1,
            generatedAt: "2026-08-19T12:00:00.000Z",
            paymentId: null,
            reservationTravelerId: "74cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
          },
        ];
      },
      async findPaymentContexts() {
        return new Map([
          [
            adminPaymentId,
            {
              id: adminPaymentId,
              amount: 9563.4,
              currency: "MXN",
              paidAt: "2026-08-20T11:00:00.000Z",
            },
          ],
        ]);
      },
      async findTicketContexts() {
        return new Map([
          [
            "74cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
            {
              id: "74cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
              position: 1,
              travelerType: "adult",
              firstName: "Ana",
              lastName: "Pérez",
            },
          ],
        ]);
      },
    },
  });
  const result = await list.list({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    assert.deepEqual(
      result.documents.map((document) => document.documentType),
      ["ticket", "payment_receipt"],
    );
    assert.deepEqual(result.documents[1].paymentContext, {
      amount: 9563.4,
      currency: "MXN",
      paidAt: "2026-08-20T11:00:00.000Z",
    });
    const serialized = JSON.stringify(result.documents);
    assert.equal(serialized.includes("storagePath"), false);
    assert.equal(serialized.includes("paymentId"), false);
    assert.equal(serialized.includes("reference"), false);
    assert.equal(serialized.includes("signedUrl"), false);
  }
  assert.deepEqual(
    await list.list({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  const suspended = createCustomerDocumentListService({
    resolveAccess: customerAccessFixture({
      accounts: [customerAccount({ status: "suspended" })],
    }).resolver.resolve,
    repository: {
      async findLinkedReservation() {
        throw new Error();
      },
      async listAvailableDocuments() {
        return [];
      },
      async findPaymentContexts() {
        return new Map();
      },
    },
  });
  assert.deepEqual(
    await suspended.list({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
});

test("apertura de documento reautoriza, usa path del servidor y URL temporal de 60 segundos", async () => {
  const requests: string[] = [];
  const access = customerAccessFixture({ accounts: [customerAccount()] });
  const service = createCustomerDocumentAccessService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findLinkedReservation({
        customerAccountId,
        agencyId,
        reservationId,
      }) {
        requests.push(`link:${customerAccountId}:${agencyId}:${reservationId}`);
        return true;
      },
      async findAvailableDocument({ agencyId, reservationId, documentKey }) {
        requests.push(`document:${agencyId}:${reservationId}:${documentKey}`);
        return documentKey === paymentReceiptDocumentId
          ? { storagePath: "agency-furiver/private/receipt.pdf" }
          : null;
      },
    },
    storage: {
      async createSignedReadUrl({ path, expiresInSeconds }) {
        requests.push(`storage:${expiresInSeconds}`);
        assert.equal(path, "agency-furiver/private/receipt.pdf");
        return "https://storage.example/temporary";
      },
    },
  });
  const ready = await service.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    documentKey: paymentReceiptDocumentId,
  });
  assert.deepEqual(ready, {
    status: "ready",
    signedUrl: "https://storage.example/temporary",
  });
  assert.deepEqual(
    requests.map((item) => item.split(":")[0]),
    ["link", "document", "storage"],
  );
  const revoked = createCustomerDocumentAccessService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findLinkedReservation() {
        return true;
      },
      async findAvailableDocument() {
        return null;
      },
    },
    storage: {
      async createSignedReadUrl() {
        throw new Error("must not sign revoked");
      },
    },
  });
  assert.deepEqual(
    await revoked.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      documentKey: paymentReceiptDocumentId,
    }),
    { status: "unavailable" },
  );
  const failing = createCustomerDocumentAccessService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findLinkedReservation() {
        throw new Error("SQL path");
      },
      async findAvailableDocument() {
        return null;
      },
    },
    storage: {
      async createSignedReadUrl() {
        return "";
      },
    },
  });
  await assert.rejects(
    failing.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      documentKey: paymentReceiptDocumentId,
    }),
    (error: unknown) =>
      error instanceof CustomerDocumentAccessError &&
      !error.message.includes("SQL"),
  );
});

test("detalle cliente muestra documentos disponibles y apertura bajo demanda sin exponer rutas", () => {
  const page = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const action = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/document-actions.ts",
    "utf8",
  );
  const button = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/document-open-button.tsx",
    "utf8",
  );
  const listRepository = readFileSync(
    "lib/documents/customer-document-list-repository.ts",
    "utf8",
  );
  const accessRepository = readFileSync(
    "lib/documents/customer-document-access-repository.ts",
    "utf8",
  );
  const storage = readFileSync(
    "lib/documents/customer-document-access-storage.ts",
    "utf8",
  );
  assert.match(page, /<h2 id="customer-documents-title">Documentos/);
  assert.match(page, /Documento no fiscal/);
  assert.match(page, /Aún no hay documentos disponibles/);
  assert.match(
    listRepository,
    /\.eq\("reservation_id", reservationId\)\.eq\("agency_id", agencyId\)\.eq\("status", "available"\)/,
  );
  assert.match(
    accessRepository,
    /\.eq\("id", documentKey\)[\s\S]*\.eq\("reservation_id", reservationId\)[\s\S]*\.eq\("agency_id", agencyId\)[\s\S]*\.eq\("status", "available"\)/,
  );
  assert.match(storage, /CUSTOMER_DOCUMENTS_BUCKET = "reservation-documents"/);
  assert.match(storage, /createSignedUrl\(path, expiresInSeconds\)/);
  assert.match(button, /noopener,noreferrer/);
  assert.equal(action.includes("export const"), false);
  assert.equal(action.includes("storagePath"), false);
  assert.equal(page.includes("storagePath"), false);
  assert.equal(page.includes("signedUrl"), false);
});

test("configuración contractual administrativa aísla la agencia, normaliza perfil y versiona borradores en servidor", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const records: { profiles: unknown[]; drafts: unknown[] } = {
    profiles: [],
    drafts: [],
  };
  const service = createAdminContractSettingsService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findLegalProfile() {
        return null;
      },
      async listTemplates() {
        return [];
      },
      async upsertLegalProfile(input) {
        records.profiles.push(input);
      },
      async getMaxVersion() {
        return records.drafts.length;
      },
      async insertDraft(input) {
        records.drafts.push(input);
      },
      async findTemplate() {
        return null;
      },
      async updateDraft() {
        return false;
      },
    },
  });
  const settings = await service.get({ requestedAgencySlug: "furiver" });
  assert.equal(settings.status, "authorized");
  if (settings.status === "authorized")
    assert.deepEqual(settings.settings, { legalProfile: null, templates: [] });
  const saved = await service.saveLegalProfile({
    requestedAgencySlug: "furiver",
    legalName: "  Agencia Real  ",
    taxId: " ",
    legalAddress: "",
    supportEmail: "atencion@example.com ",
    supportPhone: " ",
    jurisdiction: " México ",
  });
  assert.deepEqual(saved, { status: "saved" });
  assert.deepEqual(records.profiles[0], {
    agencyId: "agency-furiver",
    legalName: "Agencia Real",
    taxId: null,
    legalAddress: null,
    supportEmail: "atencion@example.com",
    supportPhone: null,
    jurisdiction: "México",
  });
  assert.equal(
    (
      await service.saveLegalProfile({
        requestedAgencySlug: "furiver",
        legalName: "X",
        taxId: "",
        legalAddress: "",
        supportEmail: "not-an-email",
        supportPhone: "",
        jurisdiction: "",
      })
    ).status,
    "invalid_input",
  );
  const draftInput = {
    requestedAgencySlug: "furiver",
    title: "  Términos  ",
    introductoryText: "",
    termsText: " Condiciones ",
    paymentPolicyText: "",
    cancellationPolicyText: "",
    travelerResponsibilityText: "",
    jurisdictionText: "",
    effectiveFrom: "2026-09-01",
  };
  assert.deepEqual(await service.createDraft(draftInput), {
    status: "created",
    version: 1,
  });
  assert.deepEqual(await service.createDraft(draftInput), {
    status: "created",
    version: 2,
  });
  assert.deepEqual(
    records.drafts.map((draft) => ({
      version: (draft as { version: number }).version,
      agencyId: (draft as { agencyId: string }).agencyId,
      createdByUserId: (draft as { createdByUserId: string }).createdByUserId,
      title: (draft as { title: string }).title,
    })),
    [
      {
        version: 1,
        agencyId: "agency-furiver",
        createdByUserId: "user-verified",
        title: "Términos",
      },
      {
        version: 2,
        agencyId: "agency-furiver",
        createdByUserId: "user-verified",
        title: "Términos",
      },
    ],
  );
  assert.deepEqual(
    await service.createDraft({
      ...draftInput,
      requestedAgencySlug: "crisenix",
    }),
    { status: "forbidden" },
  );
  assert.equal(
    (await service.createDraft({ ...draftInput, title: "<b>HTML</b>" })).status,
    "invalid_input",
  );
});

test("solo borradores contractuales pueden editarse y conflictos de versión se reintentan sin sobrescribir", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const draft = {
    templateKey: "d2175825-1085-4854-a4b5-cd2d4e521f5c",
    version: 1,
    status: "draft" as const,
    title: "v1",
    introductoryText: null,
    termsText: "texto",
    paymentPolicyText: null,
    cancellationPolicyText: null,
    travelerResponsibilityText: null,
    jurisdictionText: null,
    effectiveFrom: null,
    activatedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  let updates = 0;
  let attempts = 0;
  const service = createAdminContractSettingsService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findLegalProfile() {
        return null;
      },
      async listTemplates() {
        return [];
      },
      async upsertLegalProfile() {},
      async getMaxVersion() {
        return 4;
      },
      async insertDraft() {
        attempts += 1;
        if (attempts === 1) {
          const error = new Error() as Error & { code: string };
          error.code = "23505";
          throw error;
        }
      },
      async findTemplate({ templateKey }) {
        return templateKey === draft.templateKey
          ? draft
          : { ...draft, status: "active" as const };
      },
      async updateDraft(input) {
        updates += 1;
        return input.templateKey === draft.templateKey;
      },
    },
  });
  const values = {
    requestedAgencySlug: "furiver",
    templateKey: draft.templateKey,
    title: "actualizado",
    introductoryText: "",
    termsText: "texto actualizado",
    paymentPolicyText: "",
    cancellationPolicyText: "",
    travelerResponsibilityText: "",
    jurisdictionText: "",
    effectiveFrom: "",
  };
  assert.deepEqual(await service.updateDraft(values), { status: "updated" });
  assert.equal(updates, 1);
  assert.deepEqual(
    await service.updateDraft({
      ...values,
      templateKey: "c2175825-1085-4854-a4b5-cd2d4e521f5c",
    }),
    { status: "immutable_version" },
  );
  const { templateKey: _templateKey, ...newDraftValues } = values;
  assert.deepEqual(await service.createDraft(newDraftValues), {
    status: "created",
    version: 5,
  });
  assert.equal(attempts, 2);
  const failing = createAdminContractSettingsService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findLegalProfile() {
        throw new Error("SQL");
      },
      async listTemplates() {
        return [];
      },
      async upsertLegalProfile() {},
      async getMaxVersion() {
        return 0;
      },
      async insertDraft() {},
      async findTemplate() {
        return null;
      },
      async updateDraft() {
        return false;
      },
    },
  });
  await assert.rejects(
    failing.get({ requestedAgencySlug: "furiver" }),
    (error: unknown) =>
      error instanceof AdminContractSettingsError &&
      !error.message.includes("SQL"),
  );
});

test("ruta y acciones de contratos usan comandos server-only sin activar ni exponer IDs", () => {
  const page = readFileSync(
    "app/admin/[agencySlug]/configuracion/contratos/page.tsx",
    "utf8",
  );
  const forms = readFileSync(
    "app/admin/[agencySlug]/configuracion/contratos/contract-settings-forms.tsx",
    "utf8",
  );
  const actions = readFileSync(
    "app/admin/[agencySlug]/configuracion/contratos/contract-actions.ts",
    "utf8",
  );
  const core = readFileSync(
    "lib/contracts/admin-contract-settings-core.ts",
    "utf8",
  );
  const repository = readFileSync(
    "lib/contracts/admin-contract-settings-repository.ts",
    "utf8",
  );
  assert.match(page, /Datos legales de la agencia/);
  assert.match(page, /Plantillas de contrato/);
  assert.match(forms, /Crear nueva versión/);
  assert.match(core, /status !== "draft"/);
  assert.match(core, /for \(let attempt = 0; attempt < 3/);
  assert.match(repository, /created_by_user_id: input\.createdByUserId/);
  assert.equal(actions.includes("export const"), false);
  assert.equal(/export\s+(?!async function|type\b)/.test(actions), false);
  assert.equal(page.includes("templateKey}"), false);
  assert.equal(forms.includes(">Activar<"), false);
  assert.equal(repository.includes("reservation_documents"), false);
});

test("activación contractual exige autorización, perfil legal y un draft perteneciente a la agencia", async () => {
  let queried = false;
  const unauthenticated = createAdminContractActivationService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async findTemplate() {
        queried = true;
        return null;
      },
      async hasLegalProfile() {
        queried = true;
        return false;
      },
      async activate() {
        queried = true;
        return { resultStatus: "activated", activatedVersion: 1 };
      },
    },
  });
  assert.deepEqual(
    await unauthenticated.activate({
      requestedAgencySlug: "furiver",
      templateKey: "d2175825-1085-4854-a4b5-cd2d4e521f5c",
      expectedActiveTemplateKey: null,
    }),
    { status: "unauthenticated" },
  );
  assert.equal(queried, false);
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const withoutLegal = createAdminContractActivationService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findTemplate() {
        return {
          templateKey: "d2175825-1085-4854-a4b5-cd2d4e521f5c",
          status: "draft" as const,
        };
      },
      async hasLegalProfile() {
        return false;
      },
      async activate() {
        throw new Error("must not activate");
      },
    },
  });
  assert.deepEqual(
    await withoutLegal.activate({
      requestedAgencySlug: "furiver",
      templateKey: "d2175825-1085-4854-a4b5-cd2d4e521f5c",
      expectedActiveTemplateKey: null,
    }),
    { status: "legal_profile_required" },
  );
  assert.deepEqual(
    await withoutLegal.activate({
      requestedAgencySlug: "crisenix",
      templateKey: "d2175825-1085-4854-a4b5-cd2d4e521f5c",
      expectedActiveTemplateKey: null,
    }),
    { status: "forbidden" },
  );
});

test("activación contractual retira el active esperado, conserva contenido y detecta pantalla obsoleta", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const v2 = "b2175825-1085-4854-a4b5-cd2d4e521f5c";
  const v3 = "c2175825-1085-4854-a4b5-cd2d4e521f5c";
  const v4 = "e2175825-1085-4854-a4b5-cd2d4e521f5c";
  const templates = new Map<
    string,
    { status: "draft" | "active" | "retired"; content: string }
  >([
    [v2, { status: "active", content: "v2" }],
    [v3, { status: "draft", content: "v3" }],
    [v4, { status: "draft", content: "v4" }],
  ]);
  const service = createAdminContractActivationService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findTemplate({ templateKey }) {
        const row = templates.get(templateKey);
        return row ? { templateKey, status: row.status } : null;
      },
      async hasLegalProfile() {
        return true;
      },
      async activate({ templateKey, expectedActiveTemplateKey }) {
        const active =
          [...templates.entries()].find(
            ([, row]) => row.status === "active",
          )?.[0] ?? null;
        if (active !== expectedActiveTemplateKey)
          return { resultStatus: "conflict", activatedVersion: null };
        const target = templates.get(templateKey);
        if (!target || target.status !== "draft")
          return {
            resultStatus: target ? "immutable_version" : "not_found",
            activatedVersion: null,
          };
        if (active)
          templates.set(active, {
            ...templates.get(active)!,
            status: "retired",
          });
        templates.set(templateKey, { ...target, status: "active" });
        return {
          resultStatus: "activated",
          activatedVersion: templateKey === v3 ? 3 : 4,
        };
      },
    },
  });
  assert.deepEqual(
    await service.activate({
      requestedAgencySlug: "furiver",
      templateKey: v3,
      expectedActiveTemplateKey: v2,
    }),
    { status: "activated", version: 3 },
  );
  assert.equal(templates.get(v2)?.status, "retired");
  assert.equal(templates.get(v3)?.status, "active");
  assert.equal(templates.get(v2)?.content, "v2");
  assert.deepEqual(
    await service.activate({
      requestedAgencySlug: "furiver",
      templateKey: v4,
      expectedActiveTemplateKey: v2,
    }),
    { status: "conflict" },
  );
  assert.equal(templates.get(v3)?.status, "active");
  assert.equal(templates.get(v4)?.status, "draft");
  assert.deepEqual(
    await service.activate({
      requestedAgencySlug: "furiver",
      templateKey: v3,
      expectedActiveTemplateKey: v3,
    }),
    { status: "immutable_version" },
  );
});

test("RPC de activación bloquea por agencia, compara el activo esperado y la UI delega al dominio", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801120000_activate_contract_template.sql",
    "utf8",
  );
  const action = readFileSync(
    "app/admin/[agencySlug]/configuracion/contratos/contract-activation-actions.ts",
    "utf8",
  );
  const control = readFileSync(
    "app/admin/[agencySlug]/configuracion/contratos/contract-activation-control.tsx",
    "utf8",
  );
  const repository = readFileSync(
    "lib/contracts/admin-contract-activation-repository.ts",
    "utf8",
  );
  assert.match(migration, /for update/i);
  assert.match(migration, /is distinct from expected_active_template_id/i);
  assert.match(migration, /status = 'retired'/);
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /set search_path = public, pg_temp/i);
  assert.match(migration, /to service_role/i);
  assert.match(action, /activateContractTemplate\(values\)/);
  assert.equal(/export\s+(?!async function|type\b)/.test(action), false);
  assert.match(control, /Activar versión/);
  assert.match(control, /expectedActiveTemplateKey/);
  assert.match(repository, /activate_agency_contract_template/);
  assert.equal(migration.includes("reservation_documents"), false);
  assert.equal(migration.includes("reservation_snapshots"), false);
  const failing = createAdminContractActivationService({
    resolveAccess: adminAccessFixture({ memberships: [adminMembership()] })
      .resolver.resolve,
    repository: {
      async findTemplate() {
        throw new Error("SQL internal");
      },
      async hasLegalProfile() {
        return false;
      },
      async activate() {
        return { resultStatus: "conflict", activatedVersion: null };
      },
    },
  });
  assert.rejects(
    failing.activate({
      requestedAgencySlug: "furiver",
      templateKey: "d2175825-1085-4854-a4b5-cd2d4e521f5c",
      expectedActiveTemplateKey: null,
    }),
    (error: unknown) =>
      error instanceof AdminContractActivationError &&
      !error.message.includes("SQL"),
  );
});

test("instancia contractual congela perfil y plantilla activa, es idempotente y no expone snapshots", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const state: {
    current: {
      status: "prepared";
      templateVersion: number;
      preparedAt: string;
      legal?: unknown;
      content?: unknown;
    } | null;
  } = { current: null };
  const template = {
    id: "d2175825-1085-4854-a4b5-cd2d4e521f5c",
    version: 2,
    status: "active",
    title: "Contrato v2",
    introductoryText: null,
    termsText: "Términos v2",
    paymentPolicyText: null,
    cancellationPolicyText: null,
    travelerResponsibilityText: null,
    jurisdictionText: null,
    effectiveFrom: null,
  };
  const service = createReservationContractService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findReservation({ agencyId }) {
        return agencyId === "agency-furiver";
      },
      async findCurrent() {
        return state.current
          ? {
              status: state.current.status,
              templateVersion: state.current.templateVersion,
              preparedAt: state.current.preparedAt,
            }
          : null;
      },
      async findLegalProfile() {
        return {
          legalName: "Agencia Legal",
          taxId: null,
          legalAddress: null,
          supportEmail: null,
          supportPhone: null,
          jurisdiction: null,
        };
      },
      async findActiveTemplate() {
        return template;
      },
      async insert(input) {
        state.current = {
          status: "prepared",
          templateVersion: input.template.version,
          preparedAt: "2026-08-22T00:00:00.000Z",
          legal: structuredClone(input.legal),
          content: structuredClone(input.template),
        };
        return {
          status: state.current.status,
          templateVersion: state.current.templateVersion,
          preparedAt: state.current.preparedAt,
        };
      },
    },
  });
  const input = {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  };
  assert.equal((await service.prepare(input)).status, "prepared");
  template.version = 3;
  template.title = "Contrato mutable";
  const second = await service.prepare(input);
  assert.equal(second.status, "existing");
  if (second.status === "existing") {
    assert.equal(second.contract.templateVersion, 2);
    assert.equal(JSON.stringify(second.contract).includes("legal"), false);
  }
  assert.equal(
    (state.current?.content as { title: string }).title,
    "Contrato v2",
  );
  assert.equal(
    (await service.prepare({ ...input, requestedAgencySlug: "crisenix" }))
      .status,
    "forbidden",
  );
});

test("preparación y PDF contractual no dependen del saldo ni de la elegibilidad de viaje", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const prepared = new Set<string>();
  const repository = {
    async findReservation() {
      return true;
    },
    async findCurrent({ reservationId }: { reservationId: string }) {
      return prepared.has(reservationId)
        ? {
            status: "prepared" as const,
            templateVersion: 1,
            preparedAt: TEST_NOW,
          }
        : null;
    },
    async findLegalProfile() {
      return {
        legalName: "Agencia Legal",
        taxId: null,
        legalAddress: null,
        supportEmail: null,
        supportPhone: null,
        jurisdiction: null,
      };
    },
    async findActiveTemplate() {
      return {
        id: "d2175825-1085-4854-a4b5-cd2d4e521f5c",
        version: 1,
        status: "active",
        title: "Contrato",
        introductoryText: null,
        termsText: "Términos",
        paymentPolicyText: null,
        cancellationPolicyText: null,
        travelerResponsibilityText: null,
        jurisdictionText: null,
        effectiveFrom: null,
      };
    },
    async insert({ reservationId }: { reservationId: string }) {
      prepared.add(reservationId);
      return {
        status: "prepared" as const,
        templateVersion: 1,
        preparedAt: TEST_NOW,
      };
    },
  };
  const service = createReservationContractService({
    resolveAccess: access.resolver.resolve,
    repository,
  });
  const ids = [
    "a9ce1e1a-5d14-4cff-b2ea-d506aa4c7eb3",
    "b9ce1e1a-5d14-4cff-b2ea-d506aa4c7eb3",
    "c9ce1e1a-5d14-4cff-b2ea-d506aa4c7eb3",
  ];
  for (const reservationId of ids)
    assert.equal(
      (await service.prepare({ requestedAgencySlug: "furiver", reservationId }))
        .status,
      "prepared",
    );
  const withoutLegal = createReservationContractService({
    resolveAccess: access.resolver.resolve,
    repository: {
      ...repository,
      async findLegalProfile() {
        return null;
      },
    },
  });
  assert.deepEqual(
    await withoutLegal.inspect({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "legal_profile_required" },
  );
  const withoutActive = createReservationContractService({
    resolveAccess: access.resolver.resolve,
    repository: {
      ...repository,
      async findActiveTemplate() {
        return null;
      },
    },
  });
  assert.deepEqual(
    await withoutActive.inspect({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "active_template_required" },
  );
  const contractCore = readFileSync(
    "lib/contracts/reservation-contract-core.ts",
    "utf8",
  );
  const pdfCore = readFileSync(
    "lib/documents/reservation-contract-document-core.ts",
    "utf8",
  );
  const control = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/contract-preparation-control.tsx",
    "utf8",
  );
  assert.equal(contractCore.includes("confirmedPayment"), false);
  assert.equal(contractCore.includes("remainingBalance"), false);
  assert.equal(pdfCore.includes("calculateReservationFinancialSummary"), false);
  assert.match(
    control,
    /Completa los datos legales de la agencia antes de preparar el contrato\./,
  );
  assert.match(
    control,
    /Activa una plantilla contractual antes de preparar el contrato\./,
  );
  assert.match(control, /Configurar contratos/);
});

test("migración de instancia contractual aplica FKs, inmutabilidad y RLS sin tocar documentos", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801130000_reservation_contract_instances.sql",
    "utf8",
  );
  const repo = readFileSync(
    "lib/contracts/reservation-contract-repository.ts",
    "utf8",
  );
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const control = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/contract-preparation-control.tsx",
    "utf8",
  );
  assert.match(migration, /unique \(id, agency_id\)/);
  assert.match(migration, /where status in \('prepared', 'accepted'\)/);
  assert.match(migration, /context is immutable/);
  assert.match(migration, /has_customer_reservation_access/);
  assert.match(repo, /legal_profile_snapshot:legal/);
  assert.match(repo, /contract_content_snapshot/);
  assert.match(page, /ContractPreparationControl/);
  assert.match(control, /Contrato aún no preparado/);
  assert.equal(migration.includes("reservation_documents"), false);
});

const contractInstanceDocumentId = "14cf2e61-23bd-4d4a-85ca-e1d7a36fc183";
const contractInstanceId = "34cf2e61-23bd-4d4a-85ca-e1d7a36fc183";

function contractDocumentFixture(
  input: Readonly<{
    status?: string;
    failStorage?: boolean;
    failDownload?: boolean;
    failInsert?: boolean;
    mismatch?: boolean;
  }> = {},
) {
  const documents = new Map<string, ReservationContractDocumentRow>();
  const state = {
    inserts: [] as ReservationContractDocumentInsert[],
    uploads: [] as string[],
    removals: [] as string[],
    pdfs: [] as Parameters<typeof renderReservationContractPdf>[0][],
  };
  const service = createReservationContractDocumentService({
    resolveAccess: adminAccessFixture({ memberships: [adminMembership()] })
      .resolver.resolve,
    now: () => new Date(TEST_NOW),
    createDocumentId: () => contractInstanceDocumentId,
    renderPdf: async (data) => {
      state.pdfs.push(data);
      return new TextEncoder().encode("%PDF-1.7 frozen contract");
    },
    repository: {
      async findReservation({ agencyId }) {
        return agencyId === "agency-furiver" ? financialReservationRow() : null;
      },
      async findLatestInstance() {
        return {
          id: contractInstanceId,
          status: input.status ?? "prepared",
          contractTemplateVersion: 2,
          preparedAt: TEST_NOW,
          legalProfileSnapshot: {
            legalName: "Agencia Congelada",
            taxId: null,
            legalAddress: null,
            supportEmail: null,
            supportPhone: null,
            jurisdiction: "México",
          },
          contractContentSnapshot: {
            templateVersion: input.mismatch ? 3 : 2,
            title: "Contrato congelado",
            introductoryText: "Introducción",
            termsText: "Términos congelados.",
            paymentPolicyText: "Política de pagos",
            cancellationPolicyText: null,
            travelerResponsibilityText: null,
            jurisdictionText: "Jurisdicción congelada",
            effectiveFrom: null,
          },
        };
      },
      async findExistingDocument({ contractInstanceId: instanceId }) {
        return documents.get(instanceId) ?? null;
      },
      async updateContentSha256({
        contractInstanceId: instanceId,
        contentSha256,
      }) {
        const row = documents.get(instanceId);
        if (!row) throw new Error("missing document");
        documents.set(instanceId, { ...row, contentSha256 });
      },
      async insertDocument(document) {
        state.inserts.push(document);
        if (input.failInsert) throw new Error("database unavailable");
        if (documents.has(document.contractInstanceId))
          throw Object.assign(new Error("duplicate"), { code: "23505" });
        const row = {
          status: document.status,
          version: document.version,
          generatedAt: document.generatedAt,
          storagePath: document.storagePath,
          contentSha256: document.contentSha256,
        } as const;
        documents.set(document.contractInstanceId, row);
        return row;
      },
    },
    storage: {
      async upload({ path }) {
        if (input.failStorage) throw new Error("storage unavailable");
        state.uploads.push(path);
      },
      async download() {
        if (input.failDownload) throw new Error("storage unavailable");
        return new TextEncoder().encode("%PDF-1.7 frozen contract");
      },
      async remove(path) {
        state.removals.push(path);
      },
    },
  });
  return { service, documents, state };
}

test("contrato PDF usa exclusivamente la instancia congelada y registra metadata privada idempotente", async () => {
  const fixture = contractDocumentFixture();
  const input = {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  };
  const first = await fixture.service.ensure(input);
  assert.deepEqual(first.status === "generated" ? first.document : null, {
    documentType: "contract",
    documentVersion: 1,
    contractTemplateVersion: 2,
    contractStatus: "prepared",
    generatedAt: TEST_NOW,
  });
  assert.equal(fixture.state.inserts.length, 1);
  assert.equal(fixture.state.inserts[0].paymentId, null);
  assert.equal(fixture.state.inserts[0].contractInstanceId, contractInstanceId);
  assert.match(fixture.state.inserts[0].contentSha256, /^[0-9a-f]{64}$/);
  assert.equal(
    fixture.state.inserts[0].contentSha256,
    calculateContractDocumentSha256(
      new TextEncoder().encode("%PDF-1.7 frozen contract"),
    ),
  );
  assert.match(
    fixture.state.inserts[0].storagePath,
    /^agency-furiver\/[0-9a-f-]+\/contract\/[0-9a-f-]+\/v1\.pdf$/i,
  );
  assert.equal(fixture.state.pdfs[0].agency.legalName, "Agencia Congelada");
  assert.equal(fixture.state.pdfs[0].contract.title, "Contrato congelado");
  assert.equal(fixture.state.pdfs[0].reservation.total, 47817);
  assert.equal("remainingAmount" in fixture.state.pdfs[0].reservation, false);
  assert.equal(JSON.stringify(first).includes("contractInstanceId"), false);
  assert.equal(JSON.stringify(first).includes("storagePath"), false);
  assert.equal((await fixture.service.ensure(input)).status, "existing");
  assert.equal(fixture.state.uploads.length, 1);
  const historical = fixture.documents.get(contractInstanceId)!;
  fixture.documents.set(contractInstanceId, {
    ...historical,
    contentSha256: null,
  });
  assert.equal((await fixture.service.ensure(input)).status, "existing");
  assert.equal(
    fixture.documents.get(contractInstanceId)?.contentSha256,
    historical.contentSha256,
  );
  assert.equal(fixture.state.pdfs.length, 1);
});

test("contrato PDF exige admin e instancia vigente, valida snapshots y recupera errores sin mutar contratos", async () => {
  let queried = false;
  const unauthenticated = createReservationContractDocumentService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async findReservation() {
        queried = true;
        return null;
      },
      async findLatestInstance() {
        queried = true;
        return null;
      },
      async findExistingDocument() {
        queried = true;
        return null;
      },
      async updateContentSha256() {
        queried = true;
      },
      async insertDocument() {
        queried = true;
        throw new Error();
      },
    },
    storage: {
      async upload() {
        queried = true;
      },
      async download() {
        queried = true;
        return new Uint8Array();
      },
      async remove() {
        queried = true;
      },
    },
    renderPdf: async () => new TextEncoder().encode("%PDF"),
  });
  assert.deepEqual(
    await unauthenticated.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "unauthenticated" },
  );
  assert.equal(queried, false);
  assert.deepEqual(
    await contractDocumentFixture({ status: "superseded" }).service.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "contract_unavailable" },
  );
  assert.deepEqual(
    await contractDocumentFixture({ status: "revoked" }).service.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "contract_unavailable" },
  );
  assert.deepEqual(
    await contractDocumentFixture({ mismatch: true }).service.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "invalid_structure" },
  );
  assert.deepEqual(
    await contractDocumentFixture().service.ensure({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  assert.deepEqual(
    await contractDocumentFixture().service.ensure({
      requestedAgencySlug: "furiver",
      reservationId: "bad",
    }),
    { status: "not_found" },
  );
  const storageFailure = contractDocumentFixture({ failStorage: true });
  assert.deepEqual(
    await storageFailure.service.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "document_storage_error" },
  );
  assert.equal(storageFailure.state.inserts.length, 0);
  const dbFailure = contractDocumentFixture({ failInsert: true });
  await assert.rejects(
    dbFailure.service.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    (error: unknown) =>
      error instanceof ReservationContractDocumentError &&
      !error.message.includes("database"),
  );
  assert.equal(dbFailure.state.removals.length, 1);
  const historicalDownloadFailure = contractDocumentFixture();
  await historicalDownloadFailure.service.ensure({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  const existing = historicalDownloadFailure.documents.get(contractInstanceId)!;
  historicalDownloadFailure.documents.set(contractInstanceId, {
    ...existing,
    contentSha256: null,
  });
  const noDownload = createReservationContractDocumentService({
    resolveAccess: adminAccessFixture({ memberships: [adminMembership()] })
      .resolver.resolve,
    repository: {
      async findReservation() {
        return financialReservationRow();
      },
      async findLatestInstance() {
        return {
          id: contractInstanceId,
          status: "prepared",
          contractTemplateVersion: 2,
          preparedAt: TEST_NOW,
          legalProfileSnapshot: {
            legalName: "Agencia",
            taxId: null,
            legalAddress: null,
            supportEmail: null,
            supportPhone: null,
            jurisdiction: null,
          },
          contractContentSnapshot: {
            templateVersion: 2,
            title: "Contrato",
            introductoryText: null,
            termsText: "Términos",
            paymentPolicyText: null,
            cancellationPolicyText: null,
            travelerResponsibilityText: null,
            jurisdictionText: null,
            effectiveFrom: null,
          },
        };
      },
      async findExistingDocument() {
        return { ...existing, contentSha256: null };
      },
      async updateContentSha256() {
        throw new Error("must not update");
      },
      async insertDocument() {
        throw new Error("must not insert");
      },
    },
    storage: {
      async upload() {},
      async download() {
        throw new Error("storage internal");
      },
      async remove() {},
    },
    renderPdf: async () => new TextEncoder().encode("%PDF"),
  });
  assert.deepEqual(
    await noDownload.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "document_storage_error" },
  );
});

test("render y UI de contrato mantienen estado pendiente, paginación y documentos cliente sin IDs internos", async () => {
  const bytes = await renderReservationContractPdf({
    agency: {
      legalName: "Agencia Española",
      taxId: null,
      legalAddress: null,
      supportEmail: null,
      supportPhone: null,
      jurisdiction: null,
    },
    contract: {
      templateVersion: 2,
      status: "prepared",
      preparedAt: TEST_NOW,
      title: "Contrato",
      introductoryText: null,
      termsText: "á é í ó ú ñ ü ".repeat(2200),
      paymentPolicyText: null,
      cancellationPolicyText: null,
      travelerResponsibilityText: null,
      jurisdictionText: null,
      effectiveFrom: null,
    },
    reservation: {
      code: "FT-004-260801-D01B4E",
      tripName: null,
      tripCode: null,
      departureDate: null,
      boarding: null,
      rooms: null,
      adults: null,
      minors: null,
      travelers: null,
      currency: "MXN",
      total: 47817,
      depositAmount: 9563.4,
      depositPercent: 20,
    },
  });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  assert.ok(bytes.length > 0);
  const core = readFileSync(
    "lib/documents/reservation-contract-document-core.ts",
    "utf8",
  );
  const repository = readFileSync(
    "lib/documents/reservation-contract-document-repository.ts",
    "utf8",
  );
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const action = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/contract-actions.ts",
    "utf8",
  );
  assert.match(core, /legalProfileSnapshot/);
  assert.match(core, /contractContentSnapshot/);
  assert.equal(core.includes("agency_legal_profiles"), false);
  assert.equal(core.includes("agency_contract_templates"), false);
  assert.match(
    repository,
    /contract_instance_id: document\.contractInstanceId/,
  );
  assert.match(repository, /payment_id: document\.paymentId/);
  assert.match(page, /ContractDocumentControl/);
  assert.match(action, /ensureReservationContractDocument/);
  assert.equal(/export\s+(?!async function|type\b)/.test(action), false);
  assert.match(repository, /update\(\{ content_sha256: contentSha256 \}\)/);
  assert.equal(page.includes("contentSha256"), false);
  assert.equal(core.includes("contentSha256"), true);
});

test("migración de integridad conserva documentos históricos y restringe SHA-256 a hex lowercase", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801150000_document_content_hash.sql",
    "utf8",
  );
  const customerDocuments = readFileSync(
    "lib/documents/customer-document-list-core.ts",
    "utf8",
  );
  assert.match(migration, /add column content_sha256 text/i);
  assert.match(migration, /content_sha256 is null[\s\S]*\^\[0-9a-f\]\{64\}\$/i);
  assert.equal(
    migration.includes("update public.reservation_documents"),
    false,
  );
  assert.equal(customerDocuments.includes("contentSha256"), false);
});

test("aceptación contractual exige cuenta primary, verifica bytes privados y guarda declaración de servidor", async () => {
  const access = customerAccessFixture({ accounts: [customerAccount()] });
  const calls: string[] = [];
  const service = createCustomerContractAcceptanceService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findPrimaryLink() {
        calls.push("primary");
        return true;
      },
      async findInstance() {
        return { id: contractInstanceId, status: "prepared" };
      },
      async findDocument() {
        return {
          id: contractInstanceDocumentId,
          status: "available",
          version: 1,
          storagePath: "private.pdf",
          contentSha256: calculateContractDocumentSha256(
            new TextEncoder().encode("%PDF contract"),
          ),
        };
      },
      async updateDocumentHash() {
        calls.push("hash");
      },
      async accept(input) {
        calls.push(input.statementVersion);
        assert.equal(input.statement, CONTRACT_ACCEPTANCE_STATEMENT);
        return { status: "accepted", acceptedAt: TEST_NOW };
      },
    },
    storage: {
      async upload() {},
      async download() {
        return new TextEncoder().encode("%PDF contract");
      },
      async remove() {},
    },
  });
  const result = await service.accept({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "accepted");
  assert.ok(calls.includes(CONTRACT_ACCEPTANCE_STATEMENT_VERSION));
  const mismatch = createCustomerContractAcceptanceService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findPrimaryLink() {
        return true;
      },
      async findInstance() {
        return { id: contractInstanceId, status: "prepared" };
      },
      async findDocument() {
        return {
          id: contractInstanceDocumentId,
          status: "available",
          version: 1,
          storagePath: "x",
          contentSha256: "a".repeat(64),
        };
      },
      async updateDocumentHash() {},
      async accept() {
        throw new Error("must not accept");
      },
    },
    storage: {
      async upload() {},
      async download() {
        return new TextEncoder().encode("%PDF changed");
      },
      async remove() {},
    },
  });
  assert.deepEqual(
    await mismatch.accept({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "document_integrity_error" },
  );
  const migration = readFileSync(
    "supabase/migrations/20260801160000_contract_acceptance.sql",
    "utf8",
  );
  assert.match(migration, /for update/i);
  assert.match(migration, /unique \(contract_instance_id\)/i);
  assert.match(migration, /to service_role/i);
  assert.equal(
    readFileSync(
      "app/cuenta/[agencySlug]/reservaciones/[reservationId]/contract-acceptance-actions.ts",
      "utf8",
    ).includes("export const"),
    false,
  );
});

test("la migración de constancia vincula acceptance, instancia, reservación y agencia sin tocar documentos históricos", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801170000_acceptance_certificate_document.sql",
    "utf8",
  );
  assert.match(migration, /drop constraint reservation_documents_type_check/);
  assert.match(migration, /acceptance_certificate/);
  assert.match(migration, /contract_acceptance_id uuid/);
  assert.match(
    migration,
    /foreign key \(contract_acceptance_id, contract_instance_id, reservation_id, agency_id\)/,
  );
  assert.match(migration, /on delete restrict/);
  assert.match(
    migration,
    /document_type = 'acceptance_certificate'[\s\S]*contract_acceptance_id is not null/,
  );
  assert.match(
    migration,
    /document_type = 'contract'[\s\S]*contract_acceptance_id is null/,
  );
  assert.match(
    migration,
    /document_type = 'payment_receipt'[\s\S]*contract_acceptance_id is null/,
  );
  assert.match(migration, /reservation_documents_acceptance_version_unique/);
  assert.equal(migration.includes("insert into"), false);
});

test("constancia de aceptación usa evidencia congelada, verifica el contrato y es idempotente", async () => {
  const access = customerAccessFixture({ accounts: [customerAccount()] });
  const contractBytes = new TextEncoder().encode("%PDF-1.7 contract accepted");
  const contractHash = calculateContractDocumentSha256(contractBytes);
  const certificateBytes = new TextEncoder().encode(
    "%PDF-1.7 acceptance certificate",
  );
  const certificates: AcceptanceCertificateInsert[] = [];
  let uploaded = 0;
  const service = createAcceptanceCertificateService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findPrimaryLink() {
        return true;
      },
      async findReservation() {
        return financialReservationRow();
      },
      async findInstance() {
        return {
          id: contractInstanceId,
          status: "accepted",
          contractTemplateVersion: 2,
          legalProfileSnapshot: {
            legalName: "Agencia Congelada",
            taxId: "ABC",
            legalAddress: null,
            supportEmail: null,
            supportPhone: null,
            jurisdiction: null,
          },
          contractContentSnapshot: {
            templateVersion: 2,
            title: "Contrato congelado",
            termsText: "Términos congelados",
          },
        };
      },
      async findAcceptance() {
        return {
          id: "44cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
          contractDocumentId: contractInstanceDocumentId,
          documentContentSha256: contractHash,
          acceptedAt: TEST_NOW,
          statementVersion: "contract_acceptance_v1",
          statement: "Texto histórico",
        };
      },
      async findContractDocument() {
        return {
          id: contractInstanceDocumentId,
          status: "available",
          version: 1,
          generatedAt: TEST_NOW,
          storagePath: "private/contract.pdf",
          contentSha256: contractHash,
        };
      },
      async findExistingCertificate({ contractAcceptanceId }) {
        const row = certificates.find(
          (item) => item.contractAcceptanceId === contractAcceptanceId,
        );
        return row
          ? {
              status: "available",
              version: 1,
              generatedAt: row.generatedAt,
              storagePath: row.storagePath,
              contentSha256: row.contentSha256,
            }
          : null;
      },
      async updateExistingHash() {},
      async insertCertificate(input) {
        certificates.push(input);
        return {
          status: "available",
          version: 1,
          generatedAt: input.generatedAt,
          storagePath: input.storagePath,
          contentSha256: input.contentSha256,
        };
      },
    },
    storage: {
      async upload() {
        uploaded += 1;
      },
      async download(path) {
        return path.includes("contract") ? contractBytes : certificateBytes;
    },
      async remove() {},
    },
    renderPdf: async (data) => {
      assert.equal(data.legalName, "Agencia Congelada");
      assert.equal(data.statement, "Texto histórico");
      assert.equal(data.contractSha256, contractHash);
      return certificateBytes;
    },
    now: () => new Date(TEST_NOW),
    createDocumentId: () => "54cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
  });
  const input = {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  };
  assert.equal((await service.ensure(input)).status, "generated");
  assert.equal(certificates.length, 1);
  assert.equal(certificates[0].paymentId, null);
  assert.equal(
    certificates[0].contentSha256,
    calculateContractDocumentSha256(certificateBytes),
  );
  assert.match(
    certificates[0].storagePath,
    /^agency-furiver\/[0-9a-f-]+\/acceptance_certificate\/[0-9a-f-]+\/v1\.pdf$/i,
  );
  assert.equal((await service.ensure(input)).status, "existing");
  assert.equal(uploaded, 1);
  const mismatch = createAcceptanceCertificateService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findPrimaryLink() {
        return true;
      },
      async findReservation() {
        return financialReservationRow();
      },
      async findInstance() {
        return {
          id: contractInstanceId,
          status: "accepted",
          contractTemplateVersion: 2,
          legalProfileSnapshot: { legalName: "A", taxId: null },
          contractContentSnapshot: {
            templateVersion: 2,
            title: "T",
            termsText: "x",
          },
        };
      },
      async findAcceptance() {
        return {
          id: "44cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
          contractDocumentId: contractInstanceDocumentId,
          documentContentSha256: contractHash,
          acceptedAt: TEST_NOW,
          statementVersion: "v",
          statement: "x",
        };
      },
      async findContractDocument() {
        return {
          id: contractInstanceDocumentId,
          status: "available",
          version: 1,
          generatedAt: TEST_NOW,
          storagePath: "contract",
          contentSha256: "a".repeat(64),
        };
      },
      async findExistingCertificate() {
        return null;
      },
      async updateExistingHash() {},
      async insertCertificate() {
        throw new Error("must not insert");
      },
    },
    storage: {
      async upload() {
        throw new Error("must not upload");
      },
      async download() {
        return contractBytes;
      },
      async remove() {},
    },
    renderPdf: async () => certificateBytes,
  });
  assert.deepEqual(await mismatch.ensure(input), {
    status: "invalid_structure",
  });
  const pdf = await renderAcceptanceCertificatePdf({
    legalName: "Agencia Española",
    taxId: null,
    reservationCode: "FT-004-260801-D01B4E",
    tripName: "Viaje",
    departureDate: null,
    contractTemplateVersion: 2,
    contractDocumentVersion: 1,
    contractGeneratedAt: TEST_NOW,
    contractSha256: contractHash,
    acceptedAt: TEST_NOW,
    statementVersion: "contract_acceptance_v1",
    statement: "á é í ó ú ñ ü ".repeat(300),
  });
  assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), "%PDF");
});

test("constancia se integra como documento privado sin exponer hash, acceptance ni rutas", () => {
  const core = readFileSync(
    "lib/documents/acceptance-certificate-core.ts",
    "utf8",
  );
  const repository = readFileSync(
    "lib/documents/acceptance-certificate-repository.ts",
    "utf8",
  );
  const customerDocuments = readFileSync(
    "lib/documents/customer-document-list-core.ts",
    "utf8",
  );
  const page = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  assert.match(core, /contractContentSnapshot/);
  assert.match(core, /documentContentSha256/);
  assert.match(core, /acceptance_certificate/);
  assert.equal(core.includes("agency_legal_profiles"), false);
  assert.equal(core.includes("agency_contract_templates"), false);
  assert.match(repository, /contract_acceptance_id/);
  assert.match(customerDocuments, /acceptance_certificate/);
  assert.match(page, /Constancia de aceptación/);
  assert.equal(customerDocuments.includes("contentSha256"), false);
  assert.equal(page.includes("contractAcceptanceId"), false);
});

test("elegibilidad de voucher y boleto reutiliza ledger, slots, contrato aceptado y basis points", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const snapshot = financialReservationRow();
  const expected = deriveTravelerSlotStructure(snapshot)!;
  const slots = expected.map((slot, index) => ({
    id: `slot-${index}`,
    position: slot.position,
    traveler_type: slot.travelerType,
    status: "complete",
  }));
  const service = createReservationDocumentEligibilityService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findReservation() {
        return snapshot;
      },
      async findPayments() {
        return [
          { amount: 9563.4, currency: "MXN", status: "confirmed" },
          { amount: 10000, currency: "MXN", status: "pending" },
          { amount: 10000, currency: "MXN", status: "cancelled" },
        ];
      },
      async findTravelerSlots() {
        return slots;
      },
      async hasAcceptedContract() {
        return true;
    },
    },
  });
  const result = await service.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(result.status, "authorized");
  if (result.status === "authorized") {
    assert.equal(result.eligibility.voucher.eligible, true);
    assert.equal(result.eligibility.ticket.eligible, false);
    assert.deepEqual(result.eligibility.ticket.blockers, [
      "payment_threshold_not_met",
    ]);
    assert.equal(result.eligibility.ticket.requiredPaymentPercent, 75);
    assert.equal(DEFAULT_TICKET_PAYMENT_THRESHOLD_BPS, 7500);
  }
  const threshold = createReservationDocumentEligibilityService({
    resolveAccess: access.resolver.resolve,
    repository: {
      async findReservation() {
        return snapshot;
      },
      async findPayments() {
        return [{ amount: 35862.75, currency: "MXN", status: "confirmed" }];
      },
      async findTravelerSlots() {
        return slots;
      },
      async hasAcceptedContract() {
        return true;
      },
    },
  });
  const atThreshold = await threshold.get({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.equal(
    atThreshold.status === "authorized" &&
      atThreshold.eligibility.ticket.eligible,
    true,
  );
  const blocked = createReservationDocumentEligibilityService({
    async resolveAccess() {
      return { status: "unauthenticated" } as const;
    },
    repository: {
      async findReservation() {
        throw new Error("must not query");
      },
      async findPayments() {
        return [];
      },
      async findTravelerSlots() {
        return [];
      },
      async hasAcceptedContract() {
        return false;
      },
    },
  });
  assert.deepEqual(
    await blocked.get({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    { status: "unauthenticated" },
  );
  assert.deepEqual(
    await service.get({
      requestedAgencySlug: "crisenix",
      reservationId: customerDetailReservationId,
    }),
    { status: "forbidden" },
  );
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  assert.match(page, /Documentos de viaje/);
  assert.match(page, /Pago confirmado:/);
  assert.match(page, /Listo para generar/);
  assert.equal(page.includes("Generar voucher"), false);
});

test("migración de tickets exige traveler tenant-safe y conserva voucher/documentos generales a nivel reservación", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801180000_ticket_traveler_provenance.sql",
    "utf8",
  );
  assert.match(migration, /add column reservation_traveler_id uuid/i);
  assert.match(migration, /unique \(id, reservation_id, agency_id\)/i);
  assert.match(
    migration,
    /foreign key \(reservation_traveler_id, reservation_id, agency_id\)/i,
  );
  assert.match(
    migration,
    /references public\.reservation_travelers \(id, reservation_id, agency_id\)[\s\S]*on delete restrict/i,
  );
  assert.match(
    migration,
    /drop constraint reservation_documents_acceptance_consistency_check/i,
  );
  assert.match(
    migration,
    /document_type = 'ticket'[\s\S]*reservation_traveler_id is not null/i,
  );
  assert.match(
    migration,
    /document_type = 'voucher'[\s\S]*reservation_traveler_id is null/i,
  );
  assert.match(
    migration,
    /document_type = 'contract'[\s\S]*reservation_traveler_id is null/i,
  );
  assert.match(
    migration,
    /document_type = 'payment_receipt'[\s\S]*reservation_traveler_id is null/i,
  );
  assert.match(
    migration,
    /document_type = 'acceptance_certificate'[\s\S]*reservation_traveler_id is null/i,
  );
  assert.match(
    migration,
    /reservation_documents_ticket_traveler_version_unique/,
  );
  assert.equal(migration.includes("create policy"), false);
  assert.equal(
    migration.includes("update public.reservation_snapshots"),
    false,
  );
});

test("fundación de abordaje conserva credenciales hash, estado operacional y eventos tenant-safe sin QR", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801210000_boarding_foundation.sql",
    "utf8",
  );
  assert.match(
    migration,
    /create table public\.traveler_boarding_credentials/i,
  );
  assert.match(migration, /token_sha256 text not null/i);
  assert.match(migration, /token_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(migration, /unique \(token_sha256\)/i);
  assert.doesNotMatch(migration, /\braw_token\b|\btoken\s+text\b/i);
  assert.match(migration, /status in \('active', 'revoked'\)/i);
  assert.match(
    migration,
    /foreign key \(reservation_traveler_id, reservation_id, agency_id\)[\s\S]*references public\.reservation_travelers \(id, reservation_id, agency_id\)[\s\S]*on delete restrict/i,
  );
  assert.match(
    migration,
    /foreign key \(ticket_document_id, reservation_traveler_id, reservation_id, agency_id\)[\s\S]*references public\.reservation_documents \(id, reservation_traveler_id, reservation_id, agency_id\)[\s\S]*on delete restrict/i,
  );
  assert.match(
    migration,
    /traveler_boarding_credentials_one_active_traveler_unique[\s\S]*where status = 'active'/i,
  );
  assert.match(migration, /create table public\.traveler_boarding_state/i);
  assert.match(
    migration,
    /status = 'pending' and checked_in_at is null and boarded_at is null/i,
  );
  assert.match(
    migration,
    /status = 'checked_in' and checked_in_at is not null and boarded_at is null/i,
  );
  assert.match(
    migration,
    /status = 'boarded' and checked_in_at is not null and boarded_at is not null/i,
  );
  assert.match(migration, /create table public\.traveler_boarding_events/i);
  assert.match(migration, /event_type in \('checked_in', 'boarded'\)/i);
  assert.match(
    migration,
    /traveler_boarding_events_credential_fk[\s\S]*on delete restrict/i,
  );
  assert.match(migration, /enable row level security/gi);
  assert.match(
    migration,
    /has_agency_role\(agency_id, array\['owner', 'admin', 'staff'\]/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.traveler_boarding_credentials from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.traveler_boarding_state from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /revoke all on table public\.traveler_boarding_events from public, anon, authenticated/i,
  );
  assert.doesNotMatch(migration, /create (table|function|index) [^;]*\bqr\b/i);
  assert.doesNotMatch(
    migration,
    /insert into public\.(traveler_boarding_credentials|traveler_boarding_state|traveler_boarding_events)/i,
  );
});

test("Voucher reutiliza la elegibilidad, genera V1 privada con SHA y reemite V2 sin datos sensibles", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const travelers = deriveTravelerSlotStructure(financialReservationRow())!.map(
    (slot, index) => ({
    position: slot.position,
    travelerType: slot.travelerType,
    status: "complete",
    firstName: index ? "Luis" : "Ana",
    lastName: index ? "García" : "Pérez",
    }),
  );
  const rows: VoucherDocumentRow[] = [];
  const state = {
    uploads: [] as string[],
    removals: [] as string[],
    inserted: [] as unknown[],
    pdf: null as Parameters<typeof renderReservationVoucherPdf>[0] | null,
  };
  const bytes = new TextEncoder().encode("%PDF-1.7 voucher privado");
  const service = createReservationVoucherDocumentService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: { voucher: { eligible: true, blockers: [] } },
    }),
    repository: {
      async findReservation() {
        return financialReservationRow();
      },
      async listTravelers() {
        return travelers;
      },
      async listVouchers() {
        return rows;
      },
      async insertVoucher(input) {
        state.inserted.push(input);
        const row = {
          status: "available",
          version: input.version,
          generatedAt: input.generatedAt,
        };
        rows.push(row);
        return row;
      },
    },
    storage: {
      async upload({ path }) {
        state.uploads.push(path);
      },
      async remove(path) {
        state.removals.push(path);
      },
      async download() {
        return bytes;
      },
    },
    renderPdf: async (data) => {
      state.pdf = data;
      return bytes;
    },
    now: () => new Date(TEST_NOW),
    createDocumentId: () => "64cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
  });
  const input = {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  };
  assert.deepEqual(await service.ensure(input), {
    status: "generated",
    voucher: { version: 1, generatedAt: TEST_NOW },
  });
  assert.match(
    state.uploads[0],
    /^agency-furiver\/[0-9a-f-]+\/voucher\/[0-9a-f-]+\/v1\.pdf$/i,
  );
  const inserted = state.inserted[0] as Record<string, unknown>;
  assert.equal(inserted.contentSha256, calculateContractDocumentSha256(bytes));
  assert.equal(JSON.stringify(inserted).includes("paymentId"), false);
  assert.equal(state.pdf?.travelers[0].firstName, "Ana");
  assert.equal(JSON.stringify(state.pdf).includes("birthDate"), false);
  assert.equal((await service.ensure(input)).status, "existing");
  rows[0] = { ...rows[0], status: "revoked" };
  assert.deepEqual(await service.ensure(input), {
    status: "generated",
    voucher: { version: 2, generatedAt: TEST_NOW },
  });
  assert.equal(state.uploads.length, 2);

  const blocked = createReservationVoucherDocumentService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: {
        voucher: { eligible: false, blockers: ["deposit_not_covered"] },
      },
    }),
    repository: {
      async findReservation() {
        throw new Error("must not query");
      },
      async listTravelers() {
        return [];
      },
      async listVouchers() {
        return [];
      },
      async insertVoucher() {
        throw new Error("must not insert");
      },
    },
    storage: {
      async upload() {
        throw new Error("must not upload");
      },
      async remove() {},
      async download() {
        return new Uint8Array();
      },
    },
    renderPdf: async () => bytes,
  });
  assert.deepEqual(await blocked.ensure(input), {
    status: "not_eligible",
    blockers: ["deposit_not_covered"],
  });
  await assert.rejects(
    createReservationVoucherDocumentService({
    resolveAccess: access.resolver.resolve,
      eligibility: async () => ({
        status: "authorized",
        eligibility: { voucher: { eligible: true, blockers: [] } },
      }),
      repository: {
        async findReservation() {
          return financialReservationRow();
        },
        async listTravelers() {
          return travelers;
        },
        async listVouchers() {
          return [];
        },
        async insertVoucher() {
          throw new Error("DB secret");
        },
      },
      storage: {
        async upload() {},
        async remove(path) {
          state.removals.push(path);
        },
        async download() {
          return bytes;
        },
      },
    renderPdf: async () => bytes,
    createDocumentId: () => "64cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
    }).ensure(input),
    (error: unknown) =>
      error instanceof ReservationVoucherDocumentError &&
      !error.message.includes("DB"),
  );
  assert.ok(state.removals.length > 0);
});

test("ciclo de vida del Voucher revoca sólo tras perder elegibilidad y no revierte el ledger", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  let revoked = 0;
  const ineligible = createVoucherLifecycleService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: { voucher: { eligible: false } },
    }),
    repository: {
      async hasAvailableVoucher() {
        return true;
      },
      async revokeAvailableVoucher() {
        revoked += 1;
      },
    },
  });
  assert.equal(
    await ineligible.reconcile({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    "revoked",
  );
  assert.equal(revoked, 1);
  const stillEligible = createVoucherLifecycleService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: { voucher: { eligible: true } },
    }),
    repository: {
      async hasAvailableVoucher() {
        return true;
      },
      async revokeAvailableVoucher() {
        throw new Error("must not revoke");
      },
    },
  });
  assert.equal(
    await stillEligible.reconcile({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    "not_applicable",
  );
  const uncertain = createVoucherLifecycleService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => {
      throw new Error("temporary read failure");
    },
    repository: {
      async hasAvailableVoucher() {
        return true;
      },
      async revokeAvailableVoucher() {
        throw new Error("must not revoke");
      },
    },
  });
  assert.equal(
    await uncertain.reconcile({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    "document_error",
  );
  const repository = readFileSync(
    "lib/documents/reservation-voucher-document-repository.ts",
    "utf8",
  );
  const lifecycleRepository = readFileSync(
    "lib/travel-documents/voucher-lifecycle-repository.ts",
    "utf8",
  );
  const action = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/voucher-actions.ts",
    "utf8",
  );
  const page = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const control = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/voucher-control.tsx",
    "utf8",
  );
  assert.match(repository, /payment_id\s*:\s*null/);
  assert.match(repository, /contract_instance_id\s*:\s*null/);
  assert.match(repository, /contract_acceptance_id\s*:\s*null/);
  assert.match(repository, /reservation_traveler_id\s*:\s*null/);
  assert.match(lifecycleRepository, /status\s*:\s*"revoked"/);
  assert.match(action, /ensureReservationVoucherDocument/);
  assert.equal(/export\s+(?!async function|type\b)/.test(action), false);
  assert.match(control, /Generar Voucher/);
  assert.match(page, /reconcileReservationVoucherLifecycle/);
  assert.match(page, /Voucher disponible/);
});

test("Ticket individual reutiliza la elegibilidad global, versiona por traveler y conserva provenance privada", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const travelerOne = "74cf2e61-23bd-4d4a-85ca-e1d7a36fc183";
  const travelerTwo = "84cf2e61-23bd-4d4a-85ca-e1d7a36fc183";
  const travelers = new Map([
    [
      travelerOne,
      {
        id: travelerOne,
        position: 1,
        travelerType: "adult",
        status: "complete",
        firstName: "María",
        lastName: "Pérez",
      },
    ],
    [
      travelerTwo,
      {
        id: travelerTwo,
        position: 2,
        travelerType: "minor",
        status: "complete",
        firstName: "Ana",
        lastName: "Pérez",
      },
    ],
  ]);
  const tickets = new Map<string, ReservationTicketDocumentRow[]>();
  const state = {
    uploads: [] as string[],
    removals: [] as string[],
    inserts: [] as unknown[],
    pdf: null as Parameters<typeof renderReservationTicketPdf>[0] | null,
  };
  const credentials = new Set<string>();
  const bytes = new TextEncoder().encode("%PDF-1.7 ticket individual");
  const credentialMaterial = async () => ({
    tokenSha256: "a".repeat(64),
    qrPng: new Uint8Array([137]),
  });
  const service = createReservationTicketDocumentService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: { ticket: { eligible: true, blockers: [] } },
    }),
    repository: {
      async findReservation() {
        return financialReservationRow();
      },
      async findTraveler({ travelerKey, agencyId, reservationId }) {
        return agencyId === "agency-furiver" &&
          reservationId === customerDetailReservationId
          ? (travelers.get(travelerKey) ?? null)
          : null;
      },
      async listTickets({ travelerId }) {
        return tickets.get(travelerId) ?? [];
      },
      async hasActiveBoardingCredential({ ticketDocumentId }) {
        return credentials.has(ticketDocumentId);
      },
      async finalizeTicketWithCredential(input) {
        state.inserts.push(input);
        const rows = tickets.get(input.travelerId) ?? [];
        const historical = rows.map((row) => {
          if (row.status === "available") credentials.delete(row.id);
          return row.status === "available"
            ? { ...row, status: "superseded" }
            : row;
        });
        const row = {
          id: input.documentId,
          status: "available",
          version: input.version,
          generatedAt: input.generatedAt,
        };
        tickets.set(input.travelerId, [...historical, row]);
        credentials.add(row.id);
        return {
          status: "created" as const,
          version: row.version,
          generatedAt: row.generatedAt,
        };
      },
    },
    storage: {
      async upload({ path }) {
        state.uploads.push(path);
      },
      async remove(path) {
        state.removals.push(path);
      },
      async download() {
        return bytes;
      },
    },
    renderPdf: async (data) => {
      state.pdf = data;
      return bytes;
    },
    createCredentialMaterial: credentialMaterial,
    now: () => new Date(TEST_NOW),
    createDocumentId: () => "94cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
  });
  const request = {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    travelerKey: travelerOne,
  };
  const first = await service.ensure(request);
  assert.deepEqual(first.status === "generated" ? first.ticket : null, {
    travelerPosition: 1,
    travelerName: "María Pérez",
    travelerType: "adult",
    version: 1,
    generatedAt: TEST_NOW,
  });
  assert.match(
    state.uploads[0],
    /^agency-furiver\/[0-9a-f-]+\/ticket\/[0-9a-f-]+\/[0-9a-f-]+\/v1\.pdf$/i,
  );
  const inserted = state.inserts[0] as Record<string, unknown>;
  assert.equal(inserted.travelerId, travelerOne);
  assert.equal(inserted.contentSha256, calculateContractDocumentSha256(bytes));
  assert.equal(JSON.stringify(inserted).includes("paymentId"), false);
  assert.equal(state.pdf?.traveler.firstName, "María");
  assert.equal(state.pdf?.traveler.travelerType, "adult");
  assert.equal((await service.ensure(request)).status, "existing");
  assert.equal(
    (await service.ensure({ ...request, travelerKey: travelerTwo })).status,
    "generated",
  );
  tickets.set(travelerOne, [
    { ...tickets.get(travelerOne)![0], status: "revoked" },
  ]);
  const reissued = await service.ensure(request);
  assert.equal(
    reissued.status === "generated" ? reissued.ticket.version : null,
    2,
  );
  const blocked = createReservationTicketDocumentService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: {
        ticket: { eligible: false, blockers: ["payment_threshold_not_met"] },
      },
    }),
    repository: {
      async findReservation() {
        throw new Error("must not query");
      },
      async findTraveler() {
        throw new Error("must not query");
      },
      async listTickets() {
        return [];
      },
      async hasActiveBoardingCredential() {
        return false;
      },
      async finalizeTicketWithCredential() {
        throw new Error("must not insert");
      },
    },
    storage: {
      async upload() {
        throw new Error("must not upload");
      },
      async remove() {},
      async download() {
        return bytes;
      },
    },
    renderPdf: async () => bytes,
    createCredentialMaterial: credentialMaterial,
  });
  assert.deepEqual(await blocked.ensure(request), {
    status: "not_eligible",
    blockers: ["payment_threshold_not_met"],
  });
  const pending = createReservationTicketDocumentService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: { ticket: { eligible: true, blockers: [] } },
    }),
    repository: {
      async findReservation() {
        return financialReservationRow();
      },
      async findTraveler() {
        return { ...travelers.get(travelerOne)!, status: "pending" };
      },
      async listTickets() {
        return [];
      },
      async hasActiveBoardingCredential() {
        return false;
      },
      async finalizeTicketWithCredential() {
        throw new Error("must not insert");
      },
    },
    storage: {
      async upload() {
        throw new Error("must not upload");
      },
      async remove() {},
      async download() {
        return bytes;
      },
    },
    renderPdf: async () => bytes,
    createCredentialMaterial: credentialMaterial,
  });
  assert.deepEqual(await pending.ensure(request), {
    status: "traveler_incomplete",
  });
  assert.deepEqual(
    await service.ensure({ ...request, requestedAgencySlug: "crisenix" }),
    { status: "forbidden" },
  );
});

test("Ticket recupera fallos y el lifecycle revoca todos sólo al perder la elegibilidad global", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const travelerId = "74cf2e61-23bd-4d4a-85ca-e1d7a36fc183";
  const bytes = new TextEncoder().encode("%PDF-1.7 ticket");
  const credentialMaterial = async () => ({
    tokenSha256: "b".repeat(64),
    qrPng: new Uint8Array([137]),
  });
  const failure = createReservationTicketDocumentService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: { ticket: { eligible: true, blockers: [] } },
    }),
    repository: {
      async findReservation() {
        return financialReservationRow();
      },
      async findTraveler() {
        return {
          id: travelerId,
          position: 1,
          travelerType: "adult",
          status: "complete",
          firstName: "Ana",
          lastName: "Pérez",
        };
      },
      async listTickets() {
        return [];
      },
      async hasActiveBoardingCredential() {
        return false;
      },
      async finalizeTicketWithCredential() {
        throw new Error("database private");
      },
    },
    storage: {
      async upload() {},
      async remove() {},
      async download() {
        return bytes;
      },
    },
    renderPdf: async () => bytes,
    createCredentialMaterial: credentialMaterial,
    createDocumentId: () => "94cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
  });
  await assert.rejects(
    failure.ensure({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      travelerKey: travelerId,
    }),
    (error: unknown) =>
      error instanceof ReservationTicketDocumentError &&
      !error.message.includes("database"),
  );
  let revoked = 0;
  const lifecycle = createReservationTicketLifecycleService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: { ticket: { eligible: false } },
    }),
    repository: {
      async hasAvailableTickets() {
        return true;
      },
      async revokeAvailableTickets() {
        revoked += 1;
      },
      async findTravelerByPosition() {
        return { id: travelerId };
      },
      async revokeAvailableTicketsForTraveler() {
        throw new Error("must not run");
      },
    },
  });
  assert.equal(
    await lifecycle.reconcile({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    "revoked",
  );
  assert.equal(revoked, 1);
  const retained = createReservationTicketLifecycleService({
    resolveAccess: access.resolver.resolve,
    eligibility: async () => ({
      status: "authorized",
      eligibility: { ticket: { eligible: true } },
    }),
    repository: {
      async hasAvailableTickets() {
        return true;
      },
      async revokeAvailableTickets() {
        throw new Error("must not revoke");
      },
      async findTravelerByPosition() {
        return null;
      },
      async revokeAvailableTicketsForTraveler() {},
    },
  });
  assert.equal(
    await retained.reconcile({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
    }),
    "not_applicable",
  );
  const tinyPng = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+wwf7WQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  const pdf = await renderReservationTicketPdf({
    agencyName: "Furiver",
    version: 1,
    generatedAt: TEST_NOW,
    boardingQrPng: tinyPng,
    traveler: {
      position: 1,
      firstName: "María",
      lastName: "Pérez",
      travelerType: "adult",
    },
    reservation: {
      code: "FT-004-260801-D01B4E",
      tripName: "Viaje",
      tripCode: "FT",
      departureDate: TEST_NOW,
      boarding: "Terminal",
      currency: "MXN",
    },
  });
  assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), "%PDF");
  const repository = readFileSync(
    "lib/documents/reservation-ticket-document-repository.ts",
    "utf8",
  );
  const lifecycleRepository = readFileSync(
    "lib/travel-documents/ticket-lifecycle-repository.ts",
    "utf8",
  );
  const action = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/ticket-actions.ts",
    "utf8",
  );
  assert.match(repository, /finalize_ticket_with_boarding_credential_atomic/);
  assert.match(repository, /target_traveler_id: input\.travelerId/);
  assert.match(repository, /target_content_sha256: input\.contentSha256/);
  assert.match(repository, /target_token_sha256: input\.tokenSha256/);
  assert.match(
    lifecycleRepository,
    /revoke_available_tickets_with_credentials_atomic/,
  );
  assert.match(action, /ensureReservationTravelerTicket/);
  assert.equal(/export\s+(?!async function|type\b)/.test(action), false);
});

test("credencial de abordaje emite un QR opaco, finaliza Ticket y credencial de forma atómica y conserva el estado operativo", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801220000_atomic_ticket_boarding_credential.sql",
    "utf8",
  );
  const issuer = readFileSync(
    "lib/documents/ticket-boarding-credential.ts",
    "utf8",
  );
  const core = readFileSync(
    "lib/documents/reservation-ticket-document-core.ts",
    "utf8",
  );
  const renderer = readFileSync(
    "lib/documents/reservation-ticket-document-pdf.ts",
    "utf8",
  );
  const lifecycleRepository = readFileSync(
    "lib/travel-documents/ticket-lifecycle-repository.ts",
    "utf8",
  );
  const adminPage = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const rawToken = "a-opaque-token-that-is-never-an-id";
  const payload = boardingQrPayload(rawToken);
  assert.equal(payload, `${BOARDING_QR_PREFIX}${rawToken}`);
  assert.equal(hashBoardingToken(rawToken).length, 64);
  assert.match(hashBoardingToken(rawToken), /^[0-9a-f]{64}$/);
  assert.equal(payload.includes("74cf2e61-23bd-4d4a-85ca-e1d7a36fc183"), false);
  assert.match(issuer, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(issuer, /QRCode\.toDataURL\(boardingQrPayload\(rawToken\)/);
  assert.doesNotMatch(migration, /raw_token|token_raw|token\s+text/i);
  assert.match(
    migration,
    /security definer set search_path = public, pg_temp/i,
  );
  assert.match(
    migration,
    /from public\.reservation_travelers[\s\S]*for update/i,
  );
  assert.match(
    migration,
    /insert into public\.reservation_documents[\s\S]*insert into public\.traveler_boarding_credentials[\s\S]*insert into public\.traveler_boarding_state/i,
  );
  assert.match(
    migration,
    /on conflict \(reservation_traveler_id\) do nothing/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.finalize_ticket_with_boarding_credential_atomic[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.finalize_ticket_with_boarding_credential_atomic[\s\S]*to service_role/i,
  );
  assert.match(migration, /set status = 'superseded'/i);
  assert.match(migration, /set status = 'revoked', revoked_at = issued_time/i);
  assert.match(core, /hasActiveBoardingCredential/);
  assert.match(core, /finalizeTicketWithCredential/);
  assert.match(core, /calculateContractDocumentSha256\(bytes\)/);
  assert.match(renderer, /embedPng\(data\.boardingQrPng\)/);
  assert.match(renderer, /Código de abordaje/);
  assert.match(
    renderer,
    /no sustituye los procedimientos de check-in o abordaje/i,
  );
  assert.match(
    lifecycleRepository,
    /revoke_available_tickets_with_credentials_atomic/,
  );
  assert.match(adminPage, /Boleto sin credencial de abordaje/);
  assert.match(adminPage, /Credencial de abordaje: Activa/);
});

test("payload de abordaje genera PNG QR sin incorporar identificadores internos", async () => {
  const rawToken = "hXU3s9YQq8aYlV1Wq7E1F6WqRk8cB2zM-opaque";
  const dataUrl = await QRCode.toDataURL(boardingQrPayload(rawToken), {
    type: "image/png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
  assert.match(dataUrl, /^data:image\/png;base64,/);
  assert.equal(boardingQrPayload(rawToken).includes("agency-furiver"), false);
  assert.equal(
    boardingQrPayload(rawToken).includes(customerDetailReservationId),
    false,
  );
});

test("scanner administrativo valida QR opaco y las transiciones de abordaje son explícitas e idempotentes", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const rawToken = "A".repeat(43);
  const travelerId = "74cf2e61-23bd-4d4a-85ca-e1d7a36fc183";
  const ticketId = "84cf2e61-23bd-4d4a-85ca-e1d7a36fc183";
  let credentialStatus = "active";
  let ticketStatus = "available";
  let boarding = {
    status: "pending",
    checkedInAt: null as string | null,
    boardedAt: null as string | null,
  };
  const events: string[] = [];
  const repository = {
    async findCredential({
      agencyId,
      tokenSha256,
    }: {
      agencyId: string;
      tokenSha256: string;
    }) {
      return agencyId === "agency-furiver" &&
        tokenSha256 === hashBoardingToken(rawToken)
        ? {
            id: "94cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
            reservationId: customerDetailReservationId,
            travelerId,
            ticketDocumentId: ticketId,
            status: credentialStatus,
          }
        : null;
    },
    async findTicket() {
      return {
        id: ticketId,
        documentType: "ticket",
        status: ticketStatus,
        reservationId: customerDetailReservationId,
        travelerId,
      };
    },
    async findTraveler() {
      return {
        id: travelerId,
        reservationId: customerDetailReservationId,
        position: 1,
        travelerType: "adult",
        status: "complete",
        firstName: "María",
        lastName: "Pérez",
      };
    },
    async findReservation() {
      return financialReservationRow();
    },
    async findBoardingState() {
      return boarding;
    },
    async checkIn() {
      if (boarding.status === "boarded")
        return {
          status: "already_boarded" as const,
          checkedInAt: boarding.checkedInAt,
          boardedAt: boarding.boardedAt,
        };
      if (boarding.status === "checked_in")
        return {
          status: "already_checked_in" as const,
          checkedInAt: boarding.checkedInAt,
          boardedAt: null,
        };
      boarding = {
        status: "checked_in",
        checkedInAt: TEST_NOW,
        boardedAt: null,
      };
      events.push("checked_in");
      return {
        status: "checked_in" as const,
        checkedInAt: TEST_NOW,
        boardedAt: null,
      };
    },
    async board() {
      if (boarding.status === "pending")
        return {
          status: "check_in_required" as const,
          checkedInAt: null,
          boardedAt: null,
        };
      if (boarding.status === "boarded")
        return {
          status: "already_boarded" as const,
          checkedInAt: boarding.checkedInAt,
          boardedAt: boarding.boardedAt,
        };
      boarding = {
        status: "boarded",
        checkedInAt: TEST_NOW,
        boardedAt: TEST_NOW,
      };
      events.push("boarded");
      return {
        status: "boarded" as const,
        checkedInAt: TEST_NOW,
        boardedAt: TEST_NOW,
      };
    },
    async listBoardingStates() {
      return [boarding];
    },
  };
  const service = createBoardingScanService({
    resolveAccess: access.resolver.resolve,
    repository,
  });
  assert.equal(
    extractBoardingRawToken(`FUTRAVEL:BOARDING:1:${rawToken}`),
    rawToken,
  );
  assert.equal(
    extractBoardingRawToken(`FUTRAVEL:BOARDING:2:${rawToken}`),
    null,
  );
  assert.equal(extractBoardingRawToken("https://example.com/scan"), null);
  const scan = await service.resolve({
    requestedAgencySlug: "furiver",
    rawToken,
  });
  assert.deepEqual(scan.status === "valid" ? scan.preview.traveler : null, {
    position: 1,
    name: "María Pérez",
    travelerType: "adult",
  });
  assert.equal(events.length, 0);
  assert.equal(JSON.stringify(scan).includes(rawToken), false);
  assert.equal(
    (await service.board({ requestedAgencySlug: "furiver", rawToken })).status,
    "check_in_required",
  );
  assert.equal(
    (await service.checkIn({ requestedAgencySlug: "furiver", rawToken }))
      .status,
    "checked_in",
  );
  assert.equal(
    (await service.checkIn({ requestedAgencySlug: "furiver", rawToken }))
      .status,
    "already_checked_in",
  );
  assert.equal(events.filter((event) => event === "checked_in").length, 1);
  assert.equal(
    (await service.board({ requestedAgencySlug: "furiver", rawToken })).status,
    "boarded",
  );
  assert.equal(
    (await service.board({ requestedAgencySlug: "furiver", rawToken })).status,
    "already_boarded",
  );
  assert.deepEqual(events, ["checked_in", "boarded"]);
  assert.equal(
    (await service.resolve({ requestedAgencySlug: "furiver", rawToken }))
      .status,
    "valid",
  );
  assert.equal(
    (
      await service.resolve({
        requestedAgencySlug: "furiver",
        rawToken: "B".repeat(43),
      })
    ).status,
    "invalid",
  );
  credentialStatus = "revoked";
  assert.equal(
    (await service.resolve({ requestedAgencySlug: "furiver", rawToken }))
      .status,
    "credential_unavailable",
  );
  credentialStatus = "active";
  ticketStatus = "revoked";
  assert.equal(
    (await service.resolve({ requestedAgencySlug: "furiver", rawToken }))
      .status,
    "credential_unavailable",
  );
  ticketStatus = "available";
  assert.deepEqual(
    await service.summary({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      travelerCount: 1,
    }),
    { status: "authorized", checkedIn: 1, boarded: 1, travelerCount: 1 },
  );
  assert.equal(
    (await service.resolve({ requestedAgencySlug: "crisenix", rawToken }))
      .status,
    "forbidden",
  );
  assert.equal(
    (
      await service.resolve({
        requestedAgencySlug: "furiver",
        rawToken: "not-a-token",
      })
    ).status,
    "invalid",
  );
  const migration = readFileSync(
    "supabase/migrations/20260801230000_atomic_boarding_transitions.sql",
    "utf8",
  );
  const repositorySource = readFileSync(
    "lib/boarding/boarding-scan-repository.ts",
    "utf8",
  );
  const control = readFileSync(
    "app/admin/[agencySlug]/abordaje/boarding-control.tsx",
    "utf8",
  );
  assert.match(
    migration,
    /traveler_boarding_events_one_transition_per_traveler_unique/,
  );
  assert.match(
    migration,
    /check_in_traveler_atomic[\s\S]*for update[\s\S]*insert into public\.traveler_boarding_events/i,
  );
  assert.match(
    migration,
    /board_traveler_atomic[\s\S]*check_in_required[\s\S]*insert into public\.traveler_boarding_events/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.check_in_traveler_atomic[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.board_traveler_atomic[\s\S]*to service_role/i,
  );
  assert.match(repositorySource, /check_in_traveler_atomic/);
  assert.match(repositorySource, /board_traveler_atomic/);
  assert.doesNotMatch(repositorySource, /\.download\(/);
  assert.doesNotMatch(control, /localStorage|sessionStorage|rawToken.*value=/i);
  assert.match(control, /BrowserQRCodeReader/);
  assert.match(control, /Escanear siguiente/);
  assert.match(
    readFileSync(
      "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
      "utf8",
    ),
    /Abrir control de abordaje/,
  );
});

test("contexto cliente y cambios de nombre distinguen tickets sin exponer IDs ni revocar otros viajeros", async () => {
  const ticketTravelerId = "74cf2e61-23bd-4d4a-85ca-e1d7a36fc183";
  const list = createCustomerDocumentListService({
    resolveAccess: customerAccessFixture({ accounts: [customerAccount()] })
      .resolver.resolve,
    repository: {
      async findLinkedReservation() {
        return true;
      },
      async listAvailableDocuments() {
        return [
          {
            id: "a4cf2e61-23bd-4d4a-85ca-e1d7a36fc183",
            documentType: "ticket",
            version: 1,
            generatedAt: TEST_NOW,
            paymentId: null,
            reservationTravelerId: ticketTravelerId,
          },
        ];
      },
      async findPaymentContexts() {
        return new Map();
      },
      async findTicketContexts() {
        return new Map([
          [
            ticketTravelerId,
            {
              id: ticketTravelerId,
              position: 2,
              travelerType: "minor",
              firstName: "Ana",
              lastName: "Pérez",
            },
          ],
        ]);
      },
    },
  });
  const documents = await list.list({
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  });
  assert.deepEqual(
    documents.status === "authorized"
      ? documents.documents[0]?.travelerContext
      : null,
    { name: "Ana Pérez", travelerType: "minor", position: 2 },
  );
  assert.equal(JSON.stringify(documents).includes(ticketTravelerId), false);
  let revokedTraveler: string | null = null;
  const changed = createChangedTravelerTicketLifecycleService({
    resolveAccess: customerAccessFixture({ accounts: [customerAccount()] })
      .resolver.resolve,
    repository: {
      async hasAvailableTickets() {
        return false;
      },
      async revokeAvailableTickets() {},
      async findTravelerByPosition() {
        return { id: ticketTravelerId };
      },
      async revokeAvailableTicketsForTraveler({ travelerId }) {
        revokedTraveler = travelerId;
      },
    },
  });
  assert.equal(
    await changed.revokeForNameChange({
      requestedAgencySlug: "furiver",
      reservationId: customerDetailReservationId,
      position: 2,
    }),
    "revoked",
  );
  assert.equal(revokedTraveler, ticketTravelerId);
  const customerDocuments = readFileSync(
    "lib/documents/customer-document-list-core.ts",
    "utf8",
  );
  const customerPage = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const travelerCore = readFileSync(
    "lib/travelers/traveler-data-core.ts",
    "utf8",
  );
  assert.match(customerDocuments, /travelerContext/);
  assert.match(customerPage, /travelerContext\.name/);
  assert.equal(customerDocuments.includes("birthDate"), false);
  assert.match(travelerCore, /afterNameChanged/);
});

test("guardar viajero revoca sólo su Ticket cuando cambia nombre o apellido, no por birth_date", async () => {
  const rows: ReservationTravelerDataRow[] = [
    {
      id: "11a10852-8620-4a59-9187-a21b07ce3f05",
      position: 1,
      traveler_type: "adult",
      status: "complete",
      first_name: "Maria",
      last_name: "Perez",
      birth_date: "1990-01-01",
    },
    {
      id: "22a10852-8620-4a59-9187-a21b07ce3f05",
      position: 2,
      traveler_type: "adult",
      status: "complete",
      first_name: "Juan",
      last_name: "Pérez",
      birth_date: "1991-01-01",
    },
  ];
  const revocations: number[] = [];
  const service = createReservationTravelerDataService({
    resolveAccess: customerAccessFixture({ accounts: [customerAccount()] })
      .resolver.resolve,
    repository: {
      async listAuthorized() {
        return rows;
      },
      async updateAuthorized(input) {
        const row = rows.find(
          (item) =>
            item.id === input.travelerId && item.position === input.position,
        );
        if (!row) return null;
        const next = {
          ...row,
          first_name: input.firstName,
          last_name: input.lastName,
          birth_date: input.birthDate,
          status: "complete",
        } as const;
        rows[rows.indexOf(row)] = next;
        return next;
      },
    },
    async afterNameChanged({ position }) {
      revocations.push(position);
    },
  });
  const base = {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
    travelerId: rows[0].id,
    position: 1,
  };
  assert.equal(
    (
      await service.save({
        ...base,
        firstName: "María",
        lastName: "Pérez",
        birthDate: "1990-01-01",
      })
    ).status,
    "saved",
  );
  assert.deepEqual(revocations, [1]);
  assert.equal(
    (
      await service.save({
        ...base,
        firstName: "María",
        lastName: "Pérez",
        birthDate: "1990-01-02",
      })
    ).status,
    "saved",
  );
  assert.deepEqual(revocations, [1]);
});

test("manifiesto de salidas usa la identidad canónica congelada y compone estados operativos en bulk", async () => {
  const access = adminAccessFixture({ memberships: [adminMembership()] });
  const departureSnapshot = (
    id: string,
    reservationCode: string,
    boardingPoint: string,
  ) => ({
    id,
    reservation_code: reservationCode,
    status: "confirmed",
    currency: "MXN" as const,
    created_at: TEST_NOW,
    snapshot: {
      tour: { id: "tour-cancun", code: "CUN", title: "Cancún · Hotel Xcaret" },
      departure: {
        id: "departure-2026-08-28",
        startDate: "2026-08-28T06:00:00.000Z",
      },
      boarding: { pointName: boardingPoint },
      occupancy: { adults: 1, minors: 1, totalTravelers: 2 },
      total: 10000,
      depositPercent: 20,
      depositAmount: 2000,
    },
  });
  const firstId = customerDetailReservationId;
  const secondId = "15cf2e61-23bd-4d4a-85ca-e1d7a36fc183";
  const snapshots = [
    departureSnapshot(firstId, "FT-001", "Terminal Norte"),
    departureSnapshot(secondId, "FT-002", "Hotel Centro"),
  ];
  const service = createAdminDepartureManifestService({
    resolveAccess: access.resolver.resolve,
    now: () => new Date("2026-08-20T00:00:00.000Z"),
    repository: {
      async listRecentSnapshots() {
        return snapshots;
      },
      async listDepartureSnapshots({ identity }) {
        return identity.tourId === "tour-cancun" &&
          identity.departureId === "departure-2026-08-28"
          ? snapshots
          : [];
      },
      async listTravelers() {
        return [
          {
            id: "traveler-a",
            reservationId: firstId,
            position: 1,
            travelerType: "adult",
            firstName: "María",
            lastName: "Pérez",
          },
          {
            id: "traveler-b",
            reservationId: firstId,
            position: 2,
            travelerType: "minor",
            firstName: "Juan",
            lastName: "Pérez",
          },
          {
            id: "traveler-c",
            reservationId: secondId,
            position: 1,
            travelerType: "adult",
            firstName: "Ana",
            lastName: "López",
          },
        ];
      },
      async listTickets() {
        return [
          {
            id: "ticket-a",
            reservationId: firstId,
            travelerId: "traveler-a",
            status: "available",
          },
          {
            id: "ticket-b",
            reservationId: firstId,
            travelerId: "traveler-b",
            status: "revoked",
          },
        ];
      },
      async listCredentials() {
        return [
          {
            reservationId: firstId,
            travelerId: "traveler-a",
            ticketDocumentId: "ticket-a",
            status: "active",
          },
          {
            reservationId: firstId,
            travelerId: "traveler-b",
            ticketDocumentId: "ticket-b",
            status: "revoked",
          },
        ];
      },
      async listBoardingStates() {
        return [
          {
            reservationId: firstId,
            travelerId: "traveler-a",
            status: "checked_in",
            checkedInAt: TEST_NOW,
            boardedAt: null,
          },
          {
            reservationId: firstId,
            travelerId: "traveler-b",
            status: "boarded",
            checkedInAt: TEST_NOW,
            boardedAt: TEST_NOW,
          },
        ];
      },
    },
  });
  const listed = await service.list({ requestedAgencySlug: "furiver" });
  assert.equal(listed.status, "authorized");
  if (listed.status !== "authorized") return;
  assert.equal(listed.departures.length, 1);
  assert.deepEqual(listed.departures[0]?.summary, {
    reservations: 2,
    travelers: 3,
    pending: 1,
    checkInCompleted: 2,
    boarded: 1,
  });
  const key = listed.departures[0]!.key;
  assert.equal(
    key,
    departureKeyForIdentity({
      tourId: "tour-cancun",
      departureId: "departure-2026-08-28",
    }),
  );
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(key.includes("tour-cancun"), false);
  const manifest = await service.get({
    requestedAgencySlug: "furiver",
    departureKey: key,
  });
  assert.equal(manifest.status, "authorized");
  if (manifest.status !== "authorized") return;
  assert.deepEqual(
    manifest.manifest.travelers.map((traveler) => traveler.name),
    ["Ana López", "María Pérez", "Juan Pérez"],
  );
  assert.equal(manifest.manifest.travelers[1]?.ticketStatus, "available");
  assert.equal(manifest.manifest.travelers[1]?.credentialStatus, "active");
  assert.equal(manifest.manifest.travelers[2]?.ticketStatus, "unavailable");
  assert.equal(manifest.manifest.travelers[0]?.boardingStatus, "pending");
  assert.equal(JSON.stringify(manifest).includes(firstId), false);
  assert.equal(JSON.stringify(manifest).includes("ticket-a"), false);
  const searched = await service.get({
    requestedAgencySlug: "furiver",
    departureKey: key,
    search: "María",
  });
  assert.deepEqual(
    searched.status === "authorized"
      ? searched.visibleTravelers.map((traveler) => traveler.name)
      : [],
    ["María Pérez"],
  );
  const pending = await service.get({
    requestedAgencySlug: "furiver",
    departureKey: key,
    filter: "pending",
  });
  assert.deepEqual(
    pending.status === "authorized"
      ? pending.visibleTravelers.map((traveler) => traveler.name)
      : [],
    ["Ana López"],
  );
  assert.equal(
    (await service.get({ requestedAgencySlug: "crisenix", departureKey: key }))
      .status,
    "forbidden",
  );
  assert.equal(
    (
      await service.get({
        requestedAgencySlug: "furiver",
        departureKey: "not-a-departure",
      })
    ).status,
    "not_found",
  );
  const unauthenticated = createAdminDepartureManifestService({
    resolveAccess: async () => ({ status: "unauthenticated" }),
    repository: {
      async listRecentSnapshots() {
        throw new Error("must not read");
      },
      async listDepartureSnapshots() {
        throw new Error("must not read");
      },
      async listTravelers() {
        throw new Error("must not read");
      },
      async listTickets() {
        throw new Error("must not read");
      },
      async listCredentials() {
        throw new Error("must not read");
      },
      async listBoardingStates() {
        throw new Error("must not read");
      },
    },
  });
  assert.equal(
    (await unauthenticated.list({ requestedAgencySlug: "furiver" })).status,
    "unauthenticated",
  );
  const repository = readFileSync(
    "lib/departures/admin-departure-manifest-repository.ts",
    "utf8",
  );
  const core = readFileSync(
    "lib/departures/admin-departure-manifest-core.ts",
    "utf8",
  );
  const detailPage = readFileSync(
    "app/admin/[agencySlug]/salidas/[departureKey]/page.tsx",
    "utf8",
  );
  assert.match(repository, /snapshot->tour->>id/);
  assert.match(repository, /snapshot->departure->>id/);
  assert.match(repository, /\.in\("reservation_id"/);
  assert.doesNotMatch(repository, /traveler_boarding_events/);
  assert.doesNotMatch(core, /travelers\.drafts/);
  assert.match(detailPage, /Abrir control de abordaje/);
  assert.doesNotMatch(detailPage, /rawToken|tokenSha256|credentialId/);
});

test("acciones que cambian viajeros, Ticket, pagos o boarding invalidan el manifiesto operativo", () => {
  const travelerAction = readFileSync(
    "app/cuenta/[agencySlug]/reservaciones/[reservationId]/traveler-actions.ts",
    "utf8",
  );
  const ticketAction = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/ticket-actions.ts",
    "utf8",
  );
  const paymentAction = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-actions.ts",
    "utf8",
  );
  const paymentStatusAction = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/payment-status-actions.ts",
    "utf8",
  );
  const boardingAction = readFileSync(
    "app/admin/[agencySlug]/abordaje/boarding-actions.ts",
    "utf8",
  );
  for (const source of [
    travelerAction,
    ticketAction,
    paymentAction,
    paymentStatusAction,
    boardingAction,
  ]) {
    assert.match(
      source,
      /revalidatePath\(`\/admin\/\$\{encodeURIComponent\([^)]*\)\}\/salidas`, "layout"\)/,
    );
  }
  assert.match(boardingAction, /resolveBoardingScan/);
  assert.doesNotMatch(
    boardingAction,
    /reservation_documents.*download|\.download\(/,
  );
});

test("migración de primary customer access audita duplicados y limita sólo un primary por reservación tenant-safe", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801240000_unique_primary_customer_access.sql",
    "utf8",
  );
  const acceptanceMigration = readFileSync(
    "supabase/migrations/20260801160000_contract_acceptance.sql",
    "utf8",
  );
  assert.match(migration, /from public\.reservation_customer_access/);
  assert.match(migration, /where role = 'primary'/);
  assert.match(migration, /group by agency_id, reservation_id/);
  assert.match(migration, /having count\(\*\) > 1/);
  assert.match(migration, /raise exception using/);
  assert.match(
    migration,
    /Resolve duplicate primary reservation_customer_access rows manually/,
  );
  assert.match(
    migration,
    /create unique index reservation_customer_access_one_primary_per_reservation_idx/,
  );
  assert.match(
    migration,
    /on public\.reservation_customer_access \(agency_id, reservation_id\)/,
  );
  assert.match(migration, /where role = 'primary'/);
  assert.doesNotMatch(migration, /\b(delete|update|insert)\b/i);
  assert.equal(migration.includes("'traveler'"), false);
  assert.equal(migration.includes("'payer'"), false);
  assert.equal(migration.includes("'viewer'"), false);
  assert.match(acceptanceMigration, /primary_count <> 1/);
});

test("claim de reservación exige Auth y correo histórico coincidente, crea un único primary idempotente", async () => {
  let primary: string | null = null;
  let accountCreates = 0;
  const repository = {
    async findReservation() {
      return {
        agencyId: "agency-furiver",
        bookingEmail: " Cliente@Furiver.Test ",
      };
    },
    async findOrCreateActiveAccount() {
      accountCreates += 1;
      return "account-furiver";
    },
    async findPrimaryAccountId() {
      return primary;
    },
    async upsertPrimaryAccess({
      customerAccountId,
    }: {
      customerAccountId: string;
    }) {
      primary = customerAccountId;
    },
  };
  const service = createReservationClaimService({
    getIdentity: async () => ({
      userId: "customer-user",
      email: "cliente@furiver.test",
    }),
    repository,
  });
  const input = {
    requestedAgencySlug: "furiver",
    reservationId: customerDetailReservationId,
  };
  assert.equal(
    normalizeCustomerEmail(" Cliente@Furiver.Test "),
    "cliente@furiver.test",
  );
  assert.equal((await service.claim(input)).status, "claimed");
  assert.equal((await service.claim(input)).status, "existing");
  assert.equal(primary, "account-furiver");
  assert.equal(accountCreates, 2);
  const anonymous = createReservationClaimService({
    getIdentity: async () => null,
    repository,
  });
  assert.equal((await anonymous.claim(input)).status, "unauthenticated");
  const wrongEmail = createReservationClaimService({
    getIdentity: async () => ({ userId: "other", email: "other@furiver.test" }),
    repository,
  });
  assert.equal((await wrongEmail.claim(input)).status, "email_mismatch");
  const claimedByAnother = createReservationClaimService({
    getIdentity: async () => ({
      userId: "customer-user",
      email: "cliente@furiver.test",
    }),
    repository: {
      ...repository,
      async findPrimaryAccountId() {
        return "other-account";
      },
    },
  });
  assert.equal(
    (await claimedByAnother.claim(input)).status,
    "reservation_already_claimed",
  );
  assert.deepEqual(
    parseCustomerReservationClaimNext(
      `/cuenta/furiver/reservaciones/${customerDetailReservationId}`,
    ),
    { agencySlug: "furiver", reservationId: customerDetailReservationId },
  );
  assert.equal(
    parseCustomerReservationClaimNext(
      "https://malicioso.example/cuenta/furiver/reservaciones/x",
    ),
    null,
  );
  const snapshot = finalizedReservationForRepository("contact-snapshot");
  const withContact = finalizeReservation({
    storage: reservationStorage(),
    input: {
      ...reservationInput("contact-snapshot"),
      primaryContact: {
        firstName: "Juan",
        lastName: "Pérez",
        email: "Juan@Example.Test",
        phone: "55 1234",
      },
    },
    now: () => "2026-08-01T12:00:00.000Z",
    suffix: () => "CONTACT",
  }).reservation;
  assert.equal(withContact.primaryContact?.email, "Juan@Example.Test");
  assert.equal(JSON.stringify(snapshot).includes("Juan@Example.Test"), false);
  const adminPage = readFileSync(
    "app/admin/[agencySlug]/reservaciones/[reservationId]/page.tsx",
    "utf8",
  );
  const checkout = readFileSync("components/legacy-travel-app.tsx", "utf8");
  const claimRepository = readFileSync(
    "lib/customers/reservation-claim-repository.ts",
    "utf8",
  );
  assert.match(adminPage, /Sin cuenta vinculada/);
  assert.match(adminPage, /Cuenta vinculada/);
  assert.match(checkout, /Ya tengo cuenta/);
  assert.match(checkout, /Crear mi cuenta/);
  assert.match(claimRepository, /reservation_customer_access/);
  assert.match(claimRepository, /role: "primary"/);
});

test("POST entrega identidad Auth verificada a la persistencia atómica y reporta linked", async () => {
  let contact: unknown = null;
  let verifiedUserId: unknown = null;
  let revalidated: unknown = null;
  const handler = createReservationPostHandler({
    resolveVerifiedAuthUserId: async () => "auth-user-id",
    execute: async (input) => {
      contact = input.primaryContact;
      verifiedUserId = input.verifiedAuthUserId;
      return { ...reservationApiSuccess(), customerLinkStatus: "linked" };
    },
    revalidateLinkedReservation: async (input) => {
      revalidated = input;
    },
  });
  const response = await handler(
    reservationApiRequest({
      ...publicReservationBody(),
      primaryContact: {
        firstName: "Juan",
        lastName: "Pérez",
        email: "Juan@Example.Test",
        phone: null,
      },
    }),
  );
  const body = (await response.json()) as { customerLinkStatus?: string };
  assert.deepEqual(contact, {
    firstName: "Juan",
    lastName: "Pérez",
    email: "Juan@Example.Test",
    phone: null,
  });
  assert.equal(verifiedUserId, "auth-user-id");
  assert.deepEqual(revalidated, {
    agencySlug: "furiver",
    reservationRowId: reservationApiSuccess().reservation.id,
  });
  assert.equal(body.customerLinkStatus, "linked");
});

test("checkout autenticado persiste y revalida usando el UUID real", async () => {
  const persistedReservationId = "46a10852-8620-4a59-9187-a21b07ce3f05";
  let revalidationInput: unknown = null;
  const handler = createReservationPostHandler({
    resolveVerifiedAuthUserId: async () => "auth-user-id",
    execute: async (input) => ({
      reservation: {
        ...reservationApiSuccess().reservation,
        id: persistedReservationId,
      },
      created: true,
      customerLinkStatus: input.verifiedAuthUserId
        ? "linked"
        : "not_authenticated",
    }),
    revalidateLinkedReservation: async (input) => {
      revalidationInput = input;
    },
  });

  const response = await handler(
    reservationApiRequest({
    ...publicReservationBody(),
      primaryContact: {
        firstName: "Demo",
        lastName: null,
        email: "demo@example.com",
        phone: null,
      },
    }),
  );
  const body = (await response.json()) as {
    reservationId: string;
    customerLinkStatus: string;
  };
  assert.equal(body.reservationId, persistedReservationId);
  assert.equal(body.customerLinkStatus, "linked");
  assert.deepEqual(revalidationInput, {
    agencySlug: "furiver",
    reservationRowId: persistedReservationId,
  });

  const checkout = readFileSync("components/legacy-travel-app.tsx", "utf8");
  assert.match(checkout, /credentials: "same-origin"/);
  assert.match(checkout, /Reservación asociada a tu cuenta/);
  assert.doesNotMatch(checkout, /Vincular mi reservación/);
});

test("la continuidad checkout → Auth sólo admite retornos internos sin PII y no autoriza por correo anónimo", async () => {
  assert.equal(
    safeCustomerAuthReturnTo("/checkout?tenant=furiver&theme=lavella"),
    "/checkout?tenant=furiver&theme=lavella",
  );
  assert.equal(
    safeCustomerAuthReturnTo("/carrito?tenant=furiver&theme=lavella"),
    "/carrito?tenant=furiver&theme=lavella",
  );
  assert.equal(
    safeCustomerAuthReturnTo("https://malicioso.example/checkout"),
    null,
  );
  assert.equal(safeCustomerAuthReturnTo("//malicioso.example/checkout"), null);
  assert.equal(
    safeCustomerAuthReturnTo("/checkout?email=cliente@example.test"),
    null,
  );
  assert.equal(safeCustomerAuthReturnTo("/admin/furiver/reservaciones"), null);

  const handler = createReservationPostHandler({
    resolveVerifiedAuthUserId: async () => null,
    execute: async (input) => {
      assert.equal(input.verifiedAuthUserId, null);
      return reservationApiSuccess();
    },
  });
  const response = await handler(
    reservationApiRequest({
      ...publicReservationBody(),
      primaryContact: {
        firstName: "Invitado",
        lastName: null,
        email: "cliente@example.test",
        phone: null,
      },
    }),
  );
  const body = (await response.json()) as { customerLinkStatus?: string };
  assert.equal(body.customerLinkStatus, "not_authenticated");
});

test("la creación atómica expone estados definitivos y un fallo primary responde 500", async () => {
  const statuses = [
    "linked",
    "already_linked",
    "email_mismatch",
    "not_authenticated",
  ] as const;
  for (const expected of statuses) {
    const handler = createReservationPostHandler({
      execute: async () => ({
        ...reservationApiSuccess(),
        customerLinkStatus: expected,
      }),
    });
    const response = await handler(
      reservationApiRequest({
        ...publicReservationBody(),
        primaryContact: {
          firstName: "Juan",
          lastName: null,
          email: "cliente@example.test",
          phone: null,
        },
      }),
    );
    const body = (await response.json()) as {
      reservationId?: string;
      customerLinkStatus?: string;
    };
    assert.equal(body.reservationId, reservationApiSuccess().reservation.id);
    assert.equal(body.customerLinkStatus, expected);
  }
  const unexpectedFailure = createReservationPostHandler({
    resolveVerifiedAuthUserId: async () => "auth-user-id",
    execute: async () => {
      throw new AtomicReservationPersistenceError("primary_access_failed");
    },
  });
  const response = await unexpectedFailure(
    reservationApiRequest({
      ...publicReservationBody(),
      primaryContact: {
        firstName: "Juan",
        lastName: null,
        email: "cliente@example.test",
        phone: null,
      },
    }),
  );
  const body = (await response.json()) as {
    reservationId?: string;
    customerLinkStatus?: string;
  };
  assert.equal(response.status, 500);
  assert.equal(body.reservationId, undefined);
  assert.equal(body.customerLinkStatus, undefined);
});

test("el journey Lavella ofrece cuenta temprana, conserva retorno y muestra recuperación explícita del enlace", () => {
  const storefrontHeader = readFileSync(
    "components/themes/lavella/lavella-header.tsx",
    "utf8",
  );
  const checkout = readFileSync("components/legacy-travel-app.tsx", "utf8");
  const login = readFileSync("app/cuenta/login/page.tsx", "utf8");
  const registration = readFileSync(
    "app/cuenta/registro/registration-actions.ts",
    "utf8",
  );
  const callback = readFileSync("app/cuenta/auth/callback/route.ts", "utf8");
  const confirmationStyles = readFileSync(
    "app/themes/lavella-commerce.css",
    "utf8",
  );
  assert.match(storefrontHeader, /Mi cuenta/);
  assert.match(storefrontHeader, /Crear una cuenta/);
  assert.match(checkout, /¿Ya tienes cuenta\?/);
  assert.match(checkout, /Esta reservación se asociará a tu cuenta/);
  assert.doesNotMatch(checkout, /link_failed/);
  assert.match(checkout, /Ir a mi reserva/);
  assert.doesNotMatch(checkout, /Vincular mi reservación/);
  assert.match(login, /safeCustomerAuthReturnTo/);
  assert.match(registration, /returnTo/);
  assert.match(callback, /safeCustomerAuthReturnTo/);
  assert.match(confirmationStyles, /checkout-account-gate/);
  assert.doesNotMatch(checkout, /customerAccountId|auth user ID/);
});

test("la cuenta cliente reutiliza el modal Lavella y el shell sin alterar los flujos de reservación", () => {
  const modal = readFileSync("app/cuenta/customer-auth-modal.tsx", "utf8");
  const loginForm = readFileSync("app/cuenta/login/login-form.tsx", "utf8");
  const registrationForm = readFileSync(
    "app/cuenta/registro/registration-form.tsx",
    "utf8",
  );
  const storefrontHeader = readFileSync(
    "components/themes/lavella/lavella-header.tsx",
    "utf8",
  );
  const checkout = readFileSync("components/legacy-travel-app.tsx", "utf8");
  const shell = readFileSync("app/cuenta/customer-shell.tsx", "utf8");
  const dashboard = readFileSync("app/cuenta/page.tsx", "utf8");

  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /Escape/);
  assert.match(modal, /CustomerLoginForm/);
  assert.match(modal, /CustomerRegistrationForm/);
  assert.match(loginForm, /inline/);
  assert.match(registrationForm, /inline/);
  assert.match(storefrontHeader, /CustomerAuthModal/);
  assert.match(checkout, /onOpenAuth/);
  assert.match(checkout, /CustomerAuthModal/);
  assert.match(shell, /Resumen/);
  assert.match(shell, /Mis reservas/);
  assert.match(shell, /Cerrar sesión/);
  assert.match(shell, /customerDrawer/);
  assert.match(dashboard, /Próxima reservación/);
  assert.match(dashboard, /Aún no tienes reservaciones/);
  assert.match(dashboard, /listCustomerReservations/);
  assert.doesNotMatch(
    modal,
    /customerAccountId|tokenSha256|reservationTravelerId/,
  );
});

test("el chrome del tema acompaña checkout y cuenta sin aplicar Lavella sobre Explorer", () => {
  const tenancy = readFileSync("lib/tenancy/index.ts", "utf8");
  const commerce = readFileSync("components/legacy-travel-app.tsx", "utf8");
  const customerFrame = readFileSync(
    "app/cuenta/customer-theme-shell.tsx",
    "utf8",
  );
  const customerChrome = readFileSync(
    "app/cuenta/customer-theme-chrome.tsx",
    "utf8",
  );
  const customerStyles = readFileSync("app/cuenta/cuenta.module.css", "utf8");
  const login = readFileSync("app/cuenta/login/page.tsx", "utf8");
  const registration = readFileSync("app/cuenta/registro/page.tsx", "utf8");

  assert.match(
    tenancy,
    /return isValidTheme\(requested\) \? requested : agency\.theme/,
  );
  assert.match(commerce, /theme === "lavella" \? <LavellaHeader/);
  assert.match(commerce, /theme === "lavella" \? <LavellaFooter/);
  assert.match(customerFrame, /resolveTenant\(/);
  assert.match(customerFrame, /resolveTheme\(/);
  assert.match(customerFrame, /account\?\.agencySlug/);
  assert.match(customerChrome, /LavellaHeader/);
  assert.match(customerChrome, /ExplorerHeader/);
  assert.match(customerStyles, /customerThemeLavella/);
  assert.match(customerStyles, /customerThemeExplorer/);
  assert.match(login, /CustomerThemeFrame/);
  assert.match(registration, /CustomerThemeFrame/);
  assert.doesNotMatch(customerChrome, /localStorage|document\.cookie/);
});

test("checkout autenticado usa el UUID real, perfil tenant-safe y CTA visible sin alterar snapshots históricos", async () => {
  const accountProfile = {
    firstName: "Ana",
    lastName: "López",
    phone: "55 0101 0101",
  };
  const updated: unknown[] = [];
  const profileService = createCustomerProfileService({
    resolveAccess: async ({ requestedAgencySlug }) =>
      requestedAgencySlug === "furiver"
      ? {
          status: "authorized",
          identity: { userId: "customer-user", email: "ana@example.test" },
            account: {
              customerAccountId: "customer-account",
              agencyId: "agency-furiver",
              agencySlug: "furiver",
              agencyName: "Furiver",
              ...accountProfile,
            },
          accounts: [],
        }
      : { status: "forbidden" },
    repository: {
      async updateOwnProfile(input) {
        updated.push(input);
        return (
          input.customerAccountId === "customer-account" &&
          input.agencyId === "agency-furiver" &&
          input.userId === "customer-user"
        );
      },
    },
  });
  assert.deepEqual(
    normalizeCustomerProfileInput({
      firstName: " Ana ",
      lastName: " López ",
      phone: "55 0101 0101",
    }),
    accountProfile,
  );
  assert.equal(
    (
      await profileService.update({
        requestedAgencySlug: "furiver",
        ...accountProfile,
      })
    ).status,
    "updated",
  );
  assert.equal(
    (
      await profileService.update({
        requestedAgencySlug: "crisenix",
        ...accountProfile,
      })
    ).status,
    "forbidden",
  );
  assert.equal(updated.length, 1);

  const persistedReservationId = "46a10852-8620-4a59-9187-a21b07ce3f05";
  const reservationHandler = createReservationPostHandler({
    resolveVerifiedAuthUserId: async () => "customer-user",
    execute: async (input) => {
      assert.equal(input.verifiedAuthUserId, "customer-user");
      return {
        reservation: {
          ...reservationApiSuccess().reservation,
          id: persistedReservationId,
        },
        created: true,
        customerLinkStatus: "linked",
      };
    },
  });
  const response = await reservationHandler(
    reservationApiRequest({
    ...publicReservationBody(),
      primaryContact: {
        firstName: accountProfile.firstName,
        lastName: accountProfile.lastName,
        email: "ana@example.test",
        phone: accountProfile.phone,
      },
    }),
  );
  const responseBody = (await response.json()) as {
    reservationId: string;
    customerLinkStatus: string;
  };
  assert.equal(responseBody.reservationId, persistedReservationId);
  assert.equal(responseBody.customerLinkStatus, "linked");

  const migration = readFileSync(
    "supabase/migrations/20260801260000_customer_account_profile.sql",
    "utf8",
  );
  const profileRepository = readFileSync(
    "lib/customers/customer-profile-repository.ts",
    "utf8",
  );
  const checkout = readFileSync("components/legacy-travel-app.tsx", "utf8");
  const snapshotRepository = readFileSync(
    "lib/reservations/supabase-repository.ts",
    "utf8",
  );
  const dashboard = readFileSync("app/cuenta/page.tsx", "utf8");
  const listingRepository = readFileSync(
    "lib/customers/customer-reservations-repository.ts",
    "utf8",
  );
  const commerce = readFileSync("app/themes/lavella-commerce.css", "utf8");
  assert.match(migration, /add column first_name text null/);
  assert.match(migration, /add column last_name text null/);
  assert.match(migration, /add column phone text null/);
  assert.match(
    profileRepository,
    /\.eq\("id", customerAccountId\)[\s\S]*\.eq\("agency_id", agencyId\)[\s\S]*\.eq\("user_id", userId\)/,
  );
  assert.match(
    checkout,
    /current\.firstName \|\| customerProfile\?\.firstName/,
  );
  assert.match(checkout, /current\.email \|\| customerProfile\?\.email/);
  assert.match(checkout, /Ir a mi reserva/);
  assert.doesNotMatch(checkout, /Vincular mi reservación/);
  assert.match(
    snapshotRepository,
    /snapshot: \{ \.\.\.row\.snapshot, id: row\.id \}/,
  );
  assert.match(dashboard, /CustomerProfileForm/);
  assert.match(listingRepository, /reservation_customer_access/);
  assert.match(commerce, /theme-v2-explorer \.reservation-account-cta/);
  assert.match(commerce, /lavella-commerce \.reservation-account-cta/);
  const historical = finalizeReservation({
    storage: reservationStorage(),
    input: {
      ...reservationInput("profile-history"),
      primaryContact: {
        firstName: "Antes",
        lastName: "Histórico",
        email: "ana@example.test",
        phone: "55 0000 0000",
      },
    },
    now: () => TEST_NOW,
    suffix: () => "PROFILE",
  }).reservation;
  assert.equal(historical.primaryContact?.firstName, "Antes");
  assert.equal(historical.primaryContact?.phone, "55 0000 0000");
});

test("la creación de reservación y primary comparte una frontera PostgreSQL atómica y privada", () => {
  const migration = readFileSync(
    "supabase/migrations/20260801270000_atomic_reservation_customer_access.sql",
    "utf8",
  );
  const route = readFileSync("app/api/reservations/route.ts", "utf8");
  const serverCommand = readFileSync(
    "lib/reservations/server-command.ts",
    "utf8",
  );
  const repository = readFileSync(
    "lib/reservations/atomic-customer-access-repository.ts",
    "utf8",
  );

  assert.match(
    migration,
    /create function public\.create_reservation_with_customer_access_atomic/,
  );
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public, pg_temp/);
  assert.match(migration, /from auth\.users/);
  assert.match(migration, /lower\(btrim\(auth_user\.email\)\)/);
  assert.match(
    migration,
    /from public\.reservation_snapshots[\s\S]*for update/,
  );
  assert.match(migration, /insert into public\.reservation_snapshots/);
  assert.match(migration, /insert into public\.agency_customer_accounts/);
  assert.match(migration, /insert into public\.reservation_customer_access/);
  assert.match(migration, /primary_count <> 1/);
  assert.match(
    migration,
    /raise exception using errcode = 'P0001', message = 'primary_access_failed'/,
  );
  assert.match(migration, /from public, anon, authenticated/);
  assert.match(migration, /to service_role/);
  assert.match(serverCommand, /createAtomicReservationPersistenceClient/);
  assert.match(repository, /create_reservation_with_customer_access_atomic/);
  assert.match(repository, /id: row\.reservation_row_id/);
  assert.match(route, /resolveVerifiedAuthUserId/);
  assert.doesNotMatch(
    route,
    /claimReservationForAuthenticatedCustomer|linkCustomerReservation/,
  );
});

test("el POST no devuelve 201 cuando falla la identidad o el primary atómico", async () => {
  let writes = 0;
  const authFailure = createReservationPostHandler({
    resolveVerifiedAuthUserId: async () => {
      throw new Error("raw auth failure");
    },
    execute: async () => {
      writes += 1;
      return reservationApiSuccess();
    },
  });
  const authResponse = await authFailure(reservationApiRequest());
  assert.equal(authResponse.status, 500);
  assert.equal(writes, 0);

  const primaryFailure = createReservationPostHandler({
    resolveVerifiedAuthUserId: async () => "verified-user",
    execute: async () => {
      throw new AtomicReservationPersistenceError("primary_access_failed");
    },
  });
  const primaryResponse = await primaryFailure(
    reservationApiRequest({
    ...publicReservationBody(),
    primaryContact: {
      firstName: "Demo",
      lastName: null,
      email: "demo@example.test",
      phone: null,
    },
    }),
  );
  const primaryBody = (await primaryResponse.json()) as {
    reservationId?: string;
    error?: string;
  };
  assert.equal(primaryResponse.status, 500);
  assert.equal(primaryBody.reservationId, undefined);
  assert.equal(primaryBody.error, "No fue posible registrar la reservación.");
});

test("la reconciliación de huérfanas es dry-run, exige frase exacta y usa RPC idempotente", () => {
  assert.equal(parseOrphanCustomerAccessArgs([]), "dry-run");
  assert.equal(
    parseOrphanCustomerAccessArgs([
      `--confirm=${ORPHAN_CUSTOMER_ACCESS_CONFIRMATION}`,
    ]),
    "confirmed",
  );
  assert.throws(() => parseOrphanCustomerAccessArgs(["--confirm=force"]));
  assert.equal(
    normalizeMaintenanceEmail(" Same@Example.Test "),
    "same@example.test",
  );

  const script = readFileSync(
    "scripts/reconcile-orphan-customer-access.ts",
    "utf8",
  );
  const migration = readFileSync(
    "supabase/migrations/20260801270000_atomic_reservation_customer_access.sql",
    "utf8",
  );
  const databaseHarness = readFileSync(
    "supabase/tests/20260801270000_atomic_reservation_customer_access_test.sql",
    "utf8",
  );
  assert.match(script, /auth\.admin\.listUsers/);
  assert.match(script, /access\.length !== 0/);
  assert.match(script, /account\.status === "active"/);
  assert.match(script, /reconcile_orphan_customer_access_atomic/);
  assert.doesNotMatch(
    script,
    /\.from\("reservation_customer_access"\)\.insert/,
  );
  assert.match(
    migration,
    /create function public\.reconcile_orphan_customer_access_atomic/,
  );
  assert.match(migration, /matching_auth_users <> 1/);
  assert.match(migration, /reservation_already_claimed/);
  assert.match(databaseHarness, /forced_primary_failure/);
  assert.match(
    databaseHarness,
    /primary insert failure rolls back the new reservation/,
  );
  assert.match(databaseHarness, /already_linked/);
});

test("el reset de demo es dry-run por defecto, exige confirmación exacta y atribuye Storage por prefijo estricto", () => {
  const target = {
    agencyId: "11111111-1111-1111-1111-111111111111",
    reservationId: "22222222-2222-2222-2222-222222222222",
    reservationCode: "FT-TEST",
  };
  assert.equal(parseDemoReservationResetArgs([]), "dry-run");
  assert.equal(
    parseDemoReservationResetArgs([
      `--confirm=${DEMO_RESERVATIONS_RESET_CONFIRMATION}`,
    ]),
    "confirmed",
  );
  assert.throws(() => parseDemoReservationResetArgs(["--confirm=force"]));
  assert.equal(
    isStoragePathOwnedByReservation(
      "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/ticket/v1.pdf",
      target,
    ),
    true,
  );
  assert.equal(
    isStoragePathOwnedByReservation(
      "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222-other/ticket/v1.pdf",
      target,
    ),
    false,
  );
  assert.equal(getSupabaseProjectRef("https://abc123.supabase.co"), "abc123");
  assert.equal(getSupabaseProjectRef("http://127.0.0.1:54321"), null);
});

test("el reset de demo conserva configuración, usa la RPC privada y elimina dependencias en orden FK", () => {
  const script = readFileSync("scripts/reset-demo-reservations.ts", "utf8");
  const foundation = readFileSync(
    "supabase/migrations/20260801000000_reservation_foundation.sql",
    "utf8",
  );
  const maintenanceMigration = readFileSync(
    "supabase/migrations/20260801250000_reservation_maintenance_purge.sql",
    "utf8",
  );
  assert.deepEqual(RESERVATION_RESET_DELETE_ORDER, [
    "traveler_boarding_events",
    "traveler_boarding_credentials",
    "traveler_boarding_state",
    "acceptance_certificate_documents",
    "reservation_contract_acceptances",
    "remaining_reservation_documents",
    "reservation_contract_instances",
    "payment_evidence",
    "reservation_payments",
    "reservation_travelers",
    "reservation_customer_access",
    "reservation_snapshots",
  ]);
  assert.match(script, /createClient\(url, serviceRoleKey/);
  assert.match(script, /select\("\*", \{ count: "exact", head: true \}\)/);
  assert.doesNotMatch(
    script,
    /select\("id", \{ count: "exact", head: true \}\)/,
  );
  assert.match(script, /payment-evidence/);
  assert.match(script, /reservation-documents/);
  assert.match(script, /--confirm=DELETE-DEMO-RESERVATIONS/);
  assert.match(script, /preflightRequiredTables/);
  assert.match(script, /purge_demo_reservation_atomic/);
  assert.match(script, /storage\.from\(bucket\)\.remove/);
  assert.doesNotMatch(script, /\.from\([^)]*\)\.delete/);
  assert.doesNotMatch(script, /from\("agency_customer_accounts"\)\.delete/);
  assert.doesNotMatch(script, /from\("agencies"\)\.delete/);
  assert.match(
    foundation,
    /before update or delete on public\.reservation_snapshots/,
  );
  assert.match(
    maintenanceMigration,
    /create or replace function public\.prevent_reservation_snapshot_mutation/,
  );
  assert.match(
    maintenanceMigration,
    /if tg_op = 'DELETE'[\s\S]*current_setting\('app\.reservation_maintenance_delete', true\) = 'enabled'[\s\S]*return old;[\s\S]*raise exception 'Reservation snapshots are immutable'/,
  );
  assert.match(
    maintenanceMigration,
    /set_config\('app\.reservation_maintenance_delete', 'enabled', true\)/,
  );
  assert.match(maintenanceMigration, /security definer/i);
  assert.match(maintenanceMigration, /set search_path = public, pg_temp/i);
  assert.match(maintenanceMigration, /for update/i);
  assert.match(maintenanceMigration, /from public, anon, authenticated/i);
  assert.match(maintenanceMigration, /to service_role/i);
  assert.match(
    maintenanceMigration,
    /delete from public\.traveler_boarding_events[\s\S]*delete from public\.traveler_boarding_credentials[\s\S]*delete from public\.traveler_boarding_state/,
  );
  assert.match(
    maintenanceMigration,
    /delete from public\.reservation_contract_acceptances[\s\S]*delete from public\.reservation_documents[\s\S]*delete from public\.reservation_contract_instances/,
  );
  assert.match(
    maintenanceMigration,
    /delete from public\.reservation_snapshots/,
  );
});
