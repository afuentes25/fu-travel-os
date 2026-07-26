import test from "node:test";
import assert from "node:assert/strict";
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
import type { CartLine, TravelerDraft } from "../types/index";

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
