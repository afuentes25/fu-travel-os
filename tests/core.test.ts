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
import { lavellaDeparture } from "../components/themes/lavella/lavella-utils";
import {
  createLavellaCartTransition,
  getLavellaBookingQuote,
  lavellaCartHref,
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
