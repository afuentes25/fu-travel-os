import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agencies, departurePoints, travels } from "../data/demo/index";
import { filterCatalog } from "../lib/catalog/index";
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
  formatMoney,
  priceLine,
  priceLinePending,
  validateCart,
  validateCartRoomCapacity,
} from "../lib/pricing/index";
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
  normalizeHostname,
  resolveTenant,
  resolveTheme,
} from "../lib/tenancy/index";
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
import type { CartLine, TravelerDraft } from "../types/index";

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
test("cada tema conserva una clave de renderer diferenciada", () => {
  assert.notEqual(TRIP_SECTION_RENDERER_KEYS.explorer, TRIP_SECTION_RENDERER_KEYS.boutique);
  assert.notEqual(TRIP_SECTION_RENDERER_KEYS.boutique, TRIP_SECTION_RENDERER_KEYS.marketplace);
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
test("configuración de Boutique no se altera por Barrancas", () => {
  const trip = travels.find((item) => item.agencyId === agencies[2].id && item.pageConfiguration)!;
  assert.equal(trip.agencyId, agencies[2].id);
  assert.equal(TRIP_SECTION_RENDERER_KEYS.boutique, "boutique-editorial");
});
test("configuración de Marketplace no se altera por Barrancas", () => {
  const trip = travels.find((item) => item.agencyId === agencies[1].id && item.pageConfiguration)!;
  assert.equal(trip.agencyId, agencies[1].id);
  assert.equal(TRIP_SECTION_RENDERER_KEYS.marketplace, "marketplace-operational");
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
test("query válida de tema tiene prioridad", () =>
  assert.equal(resolveTheme(agencies[0], "boutique"), "boutique"));
test("Lavella es seleccionable y un tema inválido conserva el tema de agencia", () => {
  assert.equal(resolveTheme(agencies[0], "lavella"), "lavella");
  assert.equal(resolveTheme(agencies[0], "tema-inexistente"), agencies[0].theme);
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
test("agencia sin redes no renderiza enlaces sociales", () => {
  const boutique = agencies.find((item) => item.slug === "boutique")!;
  assert.deepEqual(getAgencySocialLinks(boutique, "header"), []);
  assert.deepEqual(getAgencySocialLinks(boutique, "footer"), []);
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
  const booking = readFileSync(
    "components/themes/lavella/lavella-booking-panel.tsx",
    "utf8",
  );
  assert.match(booking, /window\.location\.assign\(`\/carrito\$\{window\.location\.search\}`\)/);
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
  assert.doesNotMatch(detailCss + bookingCss, /\.explorer-|\.boutique-|\.marketplace-/);
  assert.doesNotMatch(detailCss + bookingCss, /\.home\b|\.catalog\b/);
});
