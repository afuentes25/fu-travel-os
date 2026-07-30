"use client";
import "@/app/themes/lavella-commerce.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { agencies, departurePoints, destinations, travels } from "@/data/demo";
import { filterCatalog } from "@/lib/catalog";
import {
  createFxConsent,
  ensureFreshDeterministicDemoPaymentQuote,
  fxContractualPaymentLabel,
  formatAppliedRate,
  formatFxMarkup,
  formatMinorUnits,
  formatSourceRate,
  toMinorUnits,
  validateFxConsent,
  validateFxPaymentContext,
} from "@/lib/fx";
import {
  createDepositSelectionSnapshot,
  resolveDepositOptionsPercent,
} from "@/lib/deposit-options";
import {
  confirmBoardingPoint,
  estimateCartLines,
  formatMoney,
  priceLine,
  priceLinePending,
  validateCartCurrencies,
  validateDemoFxOrderShape,
  validateFxGroupConsistency,
  validateCartRoomCapacity,
} from "@/lib/pricing";
import {
  finalizeReservation,
  type ReservationSnapshot,
} from "@/lib/reservations";
import { resolveTenant, resolveTheme } from "@/lib/tenancy";
import {
  applyTravelerDataToLines,
  draftsFromLines,
  travelerFollowUpMessage,
  validateTravelerDrafts,
} from "@/lib/travelers";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  LAVELLA_CATALOG_COLUMN_OPTIONS,
  resolveLavellaCatalogColumns,
} from "@/components/themes/lavella/lavella-catalog-config";
import type {
  Agency,
  CartLine,
  TravelerDataStatus,
  TravelerDraft,
  TravelProduct,
  TripSectionConfig,
  TravelTheme,
  FxConsent,
  FxSnapshot,
  PaymentAllocation,
} from "@/types";

const nav = [
  ["Viajes", "/viajes"],
  ["Destinos", "/destinos"],
  ["Promociones", "/promociones"],
  ["Nosotros", "/nosotros"],
  ["Contacto", "/contacto"],
];
const path = () =>
  typeof window === "undefined" ? "/" : window.location.pathname;
const qp = () =>
  typeof window === "undefined"
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search);
function go(to: string) {
  window.history.pushState({}, "", to + window.location.search);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function createReservationSubmissionKey() {
  const suffix =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `checkout-${suffix}`;
}
function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    search: "⌕",
    calendar: "▣",
    pin: "⌖",
    users: "♙",
    arrow: "→",
    check: "✓",
    menu: "☰",
    cart: "◌",
    wa: "↗",
    plane: "✈",
    spark: "✦",
    close: "×",
  };
  return <span aria-hidden>{icons[name] ?? "•"}</span>;
}
function DemoBar({
  tenant,
  theme,
  admin,
  onChange,
}: {
  tenant: Agency;
  theme: TravelTheme;
  admin: boolean;
  onChange: (t: string, v: string) => void;
}) {
  return (
    <div className="demo-bar">
      <span>
        <b>DEMO</b> Datos simulados
      </span>
      <label>
        Agencia
        <select
          value={tenant.slug}
          onChange={(e) => onChange("tenant", e.target.value)}
        >
          {agencies.map((a) => (
            <option key={a.id} value={a.slug}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tema
        <select
          value={theme}
          onChange={(e) => onChange("theme", e.target.value)}
        >
          <option value="explorer">Explorer</option>
          <option value="lavella">Lavella</option>
        </select>
      </label>
      <button onClick={() => onChange("view", admin ? "public" : "admin")}>
        {admin ? "Ver sitio público" : "Abrir administración"}{" "}
        <Icon name="arrow" />
      </button>
    </div>
  );
}
function Header({ agency, cartCount }: { agency: Agency; cartCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <button className="brand" onClick={() => go("/")}>
        <span className="brand-mark">
          <Icon name="plane" />
        </span>
        <span>
          {agency.branding.logoText}
          <small>TRAVEL STUDIO</small>
        </span>
      </button>
      <nav className={open ? "open" : ""} aria-label="Navegación principal">
        {nav.map(([label, href]) => (
          <button
            key={href}
            onClick={() => {
              go(href);
              setOpen(false);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <button className="ghost" onClick={() => go("/viajes")}>
          <Icon name="search" />
        </button>
        <button className="cart-button" onClick={() => go("/carrito")}>
          <Icon name="cart" /> <span>{cartCount}</span>
        </button>
        <button
          className="menu"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Abrir menú"
        >
          <Icon name="menu" />
        </button>
      </div>
    </header>
  );
}
function Price({ trip }: { trip: TravelProduct }) {
  return (
    <div className="price">
      {trip.basePrice.displayFrom && <small>DESDE</small>}
      <strong>
        {formatMoney(trip.basePrice.amount, trip.basePrice.currency)}
      </strong>
      {trip.basePrice.taxesAmount && !trip.basePrice.taxesIncluded ? (
        <span>
          + {formatMoney(trip.basePrice.taxesAmount, trip.basePrice.currency)}{" "}
          impuestos
        </span>
      ) : (
        <span>Impuestos incluidos</span>
      )}
    </div>
  );
}
function TripCard({
  trip,
  onOpen,
}: {
  trip: TravelProduct;
  onOpen: (t: TravelProduct) => void;
}) {
  const dep = trip.departures[0];
  return (
    <article className="trip-card">
      <button
        className="trip-image"
        onClick={() => onOpen(trip)}
        style={{
          backgroundImage: `linear-gradient(180deg,transparent 45%,rgba(8,20,18,.72)),url(${trip.featuredImage})`,
        }}
        aria-label={`Ver ${trip.title}`}
      >
        <span className="trip-code">{trip.code}</span>
        {trip.promotion && <span className="promo">{trip.promotion}</span>}
        <span className="trip-place">
          <Icon name="pin" /> {trip.cities[0]}
        </span>
      </button>
      <div className="trip-content">
        <div className="eyebrow">
          {trip.scope === "national" ? "MÉXICO" : "INTERNACIONAL"} ·{" "}
          {trip.durationDays} DÍAS
        </div>
        <h3>{trip.title}</h3>
        <p>{trip.summary}</p>
        <div className="next-date">
          <Icon name="calendar" />
          <span>
            Próxima salida
            <small>
              {new Date(dep.startDate).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </small>
          </span>
          <b>{dep.availableSpaces} lugares</b>
        </div>
        <div className="trip-footer">
          <Price trip={trip} />
          <button
            onClick={() => onOpen(trip)}
            aria-label={`Explorar ${trip.title}`}
          >
            <Icon name="arrow" />
          </button>
        </div>
      </div>
    </article>
  );
}
function SearchBox({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <form
      className="search-box"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q);
      }}
    >
      <div>
        <label>¿A dónde quieres ir?</label>
        <span>
          <Icon name="search" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Destino, ciudad o experiencia"
          />
        </span>
      </div>
      <div>
        <label>¿Cuándo?</label>
        <span>
          <Icon name="calendar" />
          <input type="month" min="2026-08" />
        </span>
      </div>
      <div>
        <label>Viajeros</label>
        <span>
          <Icon name="users" />
          <select defaultValue="2">
            <option value="1">1 viajero</option>
            <option value="2">2 viajeros</option>
            <option value="3">3 viajeros</option>
          </select>
        </span>
      </div>
      <button>
        Buscar viajes <Icon name="arrow" />
      </button>
    </form>
  );
}
function Home({
  agency,
  onOpen,
}: {
  agency: Agency;
  onOpen: (t: TravelProduct) => void;
}) {
  const own = travels.filter((t) => t.agencyId === agency.id);
  const stats = ["12 años creando rutas", "4.9 de 5 viajeros", "Atención humana"];
  return (
    <main>
      <section
        className="hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(8,25,22,.86),rgba(8,25,22,.16)),url(${agency.branding.heroImage})`,
        }}
      >
        <div className="hero-copy">
          <div className="eyebrow">
            <Icon name="spark" /> VIAJES DISEÑADOS PARA RECORDAR
          </div>
          <h1>{agency.branding.heroTitle}</h1>
          <p>{agency.branding.heroDescription}</p>
          <button className="primary" onClick={() => go("/viajes")}>
            Explorar experiencias <Icon name="arrow" />
          </button>
        </div>
        <div className="hero-note">
          <Icon name="pin" />
          <span>
            PRÓXIMA AVENTURA
            <strong>
              {own[0].cities[0]} · {own[0].durationDays} días
            </strong>
          </span>
        </div>
      </section>
      <SearchBox onSearch={(q) => go(`/viajes?q=${encodeURIComponent(q)}`)} />
      <section className="intro">
        <div>
          <div className="eyebrow">SELECCIÓN DE LA CASA</div>
          <h2>Tu próxima historia comienza aquí</h2>
        </div>
        <p>
          Rutas originales, fechas reales y precios claros. Tú eliges el
          destino; nosotros hacemos visible cada detalle.
        </p>
      </section>
      <section className="card-grid">
        {own.slice(0, 3).map((t) => (
          <TripCard key={t.id} trip={t} onOpen={onOpen} />
        ))}
      </section>
      <button className="text-link" onClick={() => go("/viajes")}>
        Ver todos los viajes <Icon name="arrow" />
      </button>
      <section className="stats">
        {stats.map((s, i) => (
          <div key={s}>
            <strong>{s.split(" ")[0]}</strong>
            <span>{s.split(" ").slice(1).join(" ")}</span>
            {i < 2 && <i />}
          </div>
        ))}
      </section>
      <section className="split-story">
        <div
          className="story-image"
          style={{ backgroundImage: `url(${own[1].featuredImage})` }}
        />
        <div>
          <div className="eyebrow">VIAJAR CON NOSOTROS</div>
          <h2>Todo claro antes de hacer la maleta.</h2>
          <p>
            Fechas, lugares disponibles, puntos de abordaje, anticipos e
            itinerarios viven en un mismo espacio.
          </p>
          {[
            "Acompañamiento por WhatsApp",
            "Pagos y saldos transparentes",
            "Operación pensada por salida",
          ].map((x) => (
            <span key={x}>
              <Icon name="check" />
              {x}
            </span>
          ))}
        </div>
      </section>
      <Lead agency={agency} />
    </main>
  );
}
function Lead({ agency }: { agency: Agency }) {
  const [done, setDone] = useState(false);
  return (
    <section className="lead">
      <div>
        <div className="eyebrow">NO TE PIERDAS LA PRÓXIMA SALIDA</div>
        <h2>Recibe rutas nuevas y promociones.</h2>
      </div>
      {done ? (
        <p role="status">¡Listo! En demo no enviamos ni guardamos tus datos.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDone(true);
          }}
        >
          <label className="sr-only" htmlFor="lead-email">
            Correo
          </label>
          <input
            id="lead-email"
            type="email"
            required
            placeholder="tu@correo.com"
          />
          <button>Quiero recibirlas</button>
        </form>
      )}
      <small>{agency.settings.legalNotice}</small>
    </section>
  );
}
function Catalog({
  agency,
  onOpen,
}: {
  agency: Agency;
  onOpen: (t: TravelProduct) => void;
}) {
  const [q, setQ] = useState(qp().get("q") ?? "");
  const [scope, setScope] = useState("");
  const [currency, setCurrency] = useState("");
  const [sort, setSort] = useState("next");
  const [promo, setPromo] = useState(false);
  const items = filterCatalog(
    travels.filter((t) => t.agencyId === agency.id),
    { q, scope, currency, sort, promotion: promo },
  );
  return (
    <main className="catalog-page">
      <header className="page-title">
        <div className="eyebrow">CATÁLOGO 2026</div>
        <h1>Encuentra tu próximo viaje</h1>
        <p>Filtra por destino, tipo de aventura, moneda y disponibilidad.</p>
      </header>
      <div className="catalog-layout">
        <aside className="filters">
          <h2>Filtros</h2>
          <label>
            Buscar
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej. playa o Europa"
            />
          </label>
          <label>
            Alcance
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">Todos</option>
              <option value="national">Nacional</option>
              <option value="international">Internacional</option>
            </select>
          </label>
          <label>
            Moneda
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="">Todas</option>
              <option>MXN</option>
              <option>USD</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={promo}
              onChange={(e) => setPromo(e.target.checked)}
            />{" "}
            Solo promociones
          </label>
          <button
            onClick={() => {
              setQ("");
              setScope("");
              setCurrency("");
              setPromo(false);
            }}
          >
            Limpiar filtros
          </button>
        </aside>
        <section>
          <div className="results-bar">
            <b>{items.length} resultados</b>
            <label>
              Ordenar
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="next">Próxima salida</option>
                <option value="price-asc">Precio menor</option>
                <option value="price-desc">Precio mayor</option>
                <option value="duration">Duración</option>
              </select>
            </label>
          </div>
          {items.length ? (
            <div className="card-grid catalog-cards">
              {items.map((t) => (
                <TripCard key={t.id} trip={t} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <Icon name="search" />
              <h2>No encontramos viajes</h2>
              <p>Prueba con menos filtros o una búsqueda diferente.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
function BookingPanel({
  trip,
  agency,
  onAdd,
}: {
  trip: TravelProduct;
  agency: Agency;
  onAdd: (l: CartLine) => void;
}) {
  const [depId, setDepId] = useState(trip.departures[0].id);
  const dep = trip.departures.find((d) => d.id === depId)!;
  const valid = dep.boardingOptions.filter(
    (b) => !["sold_out", "disabled"].includes(b.status),
  );
  const [boarding, setBoarding] = useState(valid[0]?.id ?? "");
  const [travelers, setTravelers] = useState(2);
  const [rate, setRate] = useState(trip.pricingOptions[0].id);
  const [extras, setExtras] = useState<string[]>([]);
  useEffect(() => {
    const next = trip.departures
      .find((d) => d.id === depId)!
      .boardingOptions.filter(
        (b) => !["sold_out", "disabled"].includes(b.status),
      );
    setBoarding(next[0]?.id ?? "");
  }, [depId, trip]);
  const raw: CartLine = {
    id: `line-${trip.id}`,
    agencyId: agency.id,
    travelId: trip.id,
    departureId: depId,
    boardingOptionId: boarding,
    pricingOptionId: rate,
    travelers,
    extraIds: extras,
  };
  let priced;
  try {
    priced = priceLine(raw);
  } catch {}
  return (
    <aside className="booking-panel">
      <div className="panel-head">
        <div>
          <small>DESDE</small>
          <Price trip={trip} />
        </div>
        <span>
          <b>{dep.availableSpaces}</b> lugares
        </span>
      </div>
      <label>
        1. Elige tu salida
        <select value={depId} onChange={(e) => setDepId(e.target.value)}>
          {trip.departures.map((d) => (
            <option key={d.id} value={d.id}>
              {new Date(d.startDate).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
              })}{" "}
              · {d.availableSpaces} lugares
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>2. Punto de abordaje</legend>
        {valid.length ? (
          valid.map((b) => {
            const p = departurePoints.find(
              (p) => p.id === b.agencyDeparturePointId,
            )!;
            return (
              <label
                className={`boarding ${boarding === b.id ? "selected" : ""}`}
                key={b.id}
              >
                <input
                  type="radio"
                  name="boarding"
                  checked={boarding === b.id}
                  onChange={() => setBoarding(b.id)}
                />
                <span>
                  <b>{p.name}</b>
                  <small>
                    {p.city} · reunión {b.meetingTime}
                  </small>
                  <small>
                    {b.availableSpaces} lugares{" "}
                    {b.surchargeAmount
                      ? `· +${formatMoney(b.surchargeAmount, b.currency!)}`
                      : "· sin suplemento"}
                  </small>
                </span>
              </label>
            );
          })
        ) : (
          <p>No hay puntos disponibles. Consulta por WhatsApp.</p>
        )}
      </fieldset>
      <div className="two-cols">
        <label>
          3. Viajeros
          <input
            type="number"
            min="1"
            max={Math.min(8, dep.availableSpaces)}
            value={travelers}
            onChange={(e) => setTravelers(Number(e.target.value))}
          />
        </label>
        <label>
          4. Tarifa
          <select value={rate} onChange={(e) => setRate(e.target.value)}>
            {trip.pricingOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>5. Extras opcionales</legend>
        {trip.extras.map((x) => (
          <label className="check" key={x.id}>
            <input
              type="checkbox"
              checked={extras.includes(x.id)}
              onChange={() =>
                setExtras((v) =>
                  v.includes(x.id)
                    ? v.filter((id) => id !== x.id)
                    : [...v, x.id],
                )
              }
            />
            {x.name} · {formatMoney(x.price, x.currency)}
          </label>
        ))}
      </fieldset>
      {priced && (
        <div className="estimate">
          <span>
            Subtotal{" "}
            <b>{formatMoney(priced.subtotal, trip.basePrice.currency)}</b>
          </span>
          <span>
            Impuestos y suplementos{" "}
            <b>
              {formatMoney(
                priced.taxes + priced.surcharge,
                trip.basePrice.currency,
              )}
            </b>
          </span>
          <span className="total">
            Total estimado{" "}
            <b>{formatMoney(priced.total, trip.basePrice.currency)}</b>
          </span>
          <small>
            Anticipo estimado:{" "}
            {formatMoney(priced.deposit, trip.basePrice.currency)}
          </small>
        </div>
      )}
      <button
        className="primary full"
        disabled={!priced}
        onClick={() => onAdd(raw)}
      >
        Agregar al carrito <Icon name="arrow" />
      </button>
      {priced && (
        <a
          className="wa"
          target="_blank"
          rel="noreferrer"
          href={whatsappUrl(agency, priced)}
        >
          <Icon name="wa" /> Consultar por WhatsApp
        </a>
      )}
    </aside>
  );
}
function Detail({
  trip,
  agency,
  onAdd,
}: {
  trip: TravelProduct;
  agency: Agency;
  onAdd: (l: CartLine) => void;
}) {
  return (
    <main className="detail">
      <button className="back" onClick={() => go("/viajes")}>
        ← Volver al catálogo
      </button>
      <div
        className="detail-hero"
        style={{
          backgroundImage: `linear-gradient(0deg,rgba(8,20,18,.65),transparent),url(${trip.featuredImage})`,
        }}
      >
        <span>{trip.code}</span>
        <div>
          <div className="eyebrow">
            {trip.countries.join(" · ")} · {trip.transportTypes.join(", ")}
          </div>
          <h1>{trip.title}</h1>
          <p>{trip.subtitle}</p>
        </div>
      </div>
      <div className="detail-layout">
        <article>
          <div className="facts">
            {[
              [`${trip.durationDays} días`, "Duración"],
              [trip.countries.join(", "), "Países"],
              [trip.cities.join(", "), "Destinos"],
              [trip.departures.length + " fechas", "Salidas"],
            ].map(([a, b]) => (
              <span key={b}>
                <b>{a}</b>
                <small>{b}</small>
              </span>
            ))}
          </div>
          <section>
            <div className="eyebrow">LA EXPERIENCIA</div>
            <h2>Un viaje para mirar más de cerca</h2>
            <p>{trip.description}</p>
          </section>
          <section>
            <h2>Itinerario</h2>
            {trip.itinerary.map((d) => (
              <details key={d.day} open={d.day === 1}>
                <summary>
                  <b>DÍA {String(d.day).padStart(2, "0")}</b>
                  {d.title}
                  <Icon name="arrow" />
                </summary>
                <p>{d.description}</p>
              </details>
            ))}
          </section>
          <section className="includes">
            <div>
              <h3>Incluye</h3>
              {trip.includes.map((x) => (
                <p key={x}>
                  <Icon name="check" />
                  {x}
                </p>
              ))}
            </div>
            <div>
              <h3>No incluye</h3>
              {trip.excludes.map((x) => (
                <p key={x}>
                  <Icon name="close" />
                  {x}
                </p>
              ))}
            </div>
          </section>
          <section>
            <h2>Políticas</h2>
            <p>{trip.policies.cancellation}</p>
            <p>{trip.policies.payment}</p>
          </section>
        </article>
        <BookingPanel trip={trip} agency={agency} onAdd={onAdd} />
      </div>
    </main>
  );
}
function Cart({
  lines,
  agency,
  theme,
  onRemove,
  onCheckout,
}: {
  lines: CartLine[];
  agency: Agency;
  theme: TravelTheme;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}) {
  const items = lines
    .map((line) => {
      try {
        return {
          line,
          estimate: line.boardingOptionId
            ? priceLine(line)
            : priceLinePending(line),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{
    line: CartLine;
    estimate:
      ReturnType<typeof priceLine> | ReturnType<typeof priceLinePending>;
  }>;
  const total = items.reduce((sum, item) => sum + item.estimate.total, 0);
  let roomError = "";
  try {
    validateCartRoomCapacity(lines);
  } catch (error) {
    roomError =
      error instanceof Error
        ? error.message
        : "La cantidad de viajeros excede la capacidad máxima de la habitación.";
  }
  let currencyError = "";
  try {
    validateCartCurrencies(lines);
    validateDemoFxOrderShape(lines);
    if (
      lines.some(
        (line) => Boolean(line.fxSnapshot || line.paymentAllocation),
      )
    )
      validateFxGroupConsistency(lines);
  } catch (error) {
    currencyError =
      error instanceof Error
        ? error.message
        : "No puedes mezclar monedas en una misma orden.";
  }
  const fxLine = lines.find(
    (line) => line.fxSnapshot && line.paymentAllocation,
  );
  const fxSnapshot = fxLine?.fxSnapshot;
  const paymentAllocation = fxLine?.paymentAllocation;
  const commercialError = roomError || currencyError;
  return (
    <main
      className={`simple-page ${theme === "lavella" ? "lavella-cart" : ""}`}
    >
      <header className="page-title">
        <div className="eyebrow">RESUMEN SEGURO</div>
        <h1>Tu carrito</h1>
        <p>
          Los importes se recalculan desde el catálogo confiable, no desde el
          navegador.
        </p>
      </header>
      {items.length ? (
        <>
          {roomError && (
            <p className="cart-room-error" role="alert">
              {roomError} Reduce viajeros o solicita apoyo para distribuirlos en
              más habitaciones.
            </p>
          )}
          {currencyError && (
            <p className="cart-room-error" role="alert">
              {currencyError} Ajusta el carrito antes de continuar.
            </p>
          )}
          <div className="cart-list">
            {items.map(({ line, estimate }) => (
              <article key={line.id}>
                <img src={estimate.travel.featuredImage} alt="" />
                <div>
                  <span>{estimate.travel.code}</span>
                  <h2>{estimate.travel.title}</h2>
                  <p>
                    {new Date(estimate.departure.startDate).toLocaleDateString(
                      "es-MX",
                    )}{" "}
                    · {line.travelers}{" "}
                    {estimate.travel.pricingOptions.find(
                      (rate) => rate.id === line.pricingOptionId,
                    )?.occupancy === "child"
                      ? "menores"
                      : "adultos"}
                  </p>
                  {(theme === "explorer" || theme === "lavella") && (
                    <p>
                      Tarifa:{" "}
                      <b>
                        {
                          estimate.travel.pricingOptions.find(
                            (rate) => rate.id === line.pricingOptionId,
                          )?.label
                        }
                      </b>
                      <br />
                      Datos de viajeros:{" "}
                      <b>
                        {line.travelerDataStatus === "complete"
                          ? "por completar en checkout"
                          : "pendientes"}
                      </b>
                    </p>
                  )}
                  <p
                    className={line.boardingSnapshot ? "" : "boarding-pending"}
                  >
                    <Icon name="pin" /> Punto de abordaje
                    <br />
                    <b>
                      {line.boardingSnapshot
                        ? `${line.boardingSnapshot.pointName} · ${line.boardingSnapshot.departureTime}`
                        : "Pendiente de seleccionar"}
                    </b>
                    {line.boardingSnapshot?.surchargeAmount
                      ? ` · ${formatMoney(line.boardingSnapshot.surchargeAmount, line.boardingSnapshot.currency)} ${line.boardingSnapshot.surchargeType === "per_booking" ? "por reserva" : "por persona"}`
                      : ""}
                  </p>
                  {line.boardingSnapshot && (
                    <button className="change-boarding" onClick={onCheckout}>
                      Cambiar punto
                    </button>
                  )}
                </div>
                <div>
                  <b>
                    {formatMoney(
                      estimate.total,
                      estimate.travel.basePrice.currency,
                    )}
                  </b>
                  <button onClick={() => onRemove(line.id)}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
          <div className="cart-total">
            <span>
              {currencyError
                ? currencyError.includes("mezclar monedas")
                  ? "Totales separados por moneda"
                  : "Total no disponible"
                : "Total antes de confirmar abordaje"}
            </span>
            <b>
              {currencyError
                ? "No disponible"
                : formatMoney(
                    total,
                    items[0].estimate.travel.basePrice.currency,
                  )}
            </b>
            {fxSnapshot && paymentAllocation && (
              <div className="fx-cart-summary" role="note">
                <span>
                  {fxContractualPaymentLabel(paymentAllocation.kind)}{" "}
                  <b>
                    {formatMinorUnits(
                      paymentAllocation.contractualPaymentMinor,
                      paymentAllocation.contractCurrency,
                    )}
                  </b>
                </span>
                <span>
                  Cobro demo en México{" "}
                  <b>
                    {formatMinorUnits(
                      paymentAllocation.chargeNowMinor,
                      paymentAllocation.chargeCurrency,
                    )}
                  </b>
                </span>
                <small>
                  Tasa fuente demo {formatSourceRate(fxSnapshot)} + margen{" "}
                  {formatFxMarkup(fxSnapshot)} · aplicada{" "}
                  {formatAppliedRate(fxSnapshot)} MXN/USD · saldo{" "}
                  {formatMinorUnits(
                    paymentAllocation.remainingContractMinor,
                    paymentAllocation.contractCurrency,
                  )}
                </small>
              </div>
            )}
            <button
              className="primary"
              disabled={Boolean(commercialError)}
              onClick={onCheckout}
            >
              {commercialError
                ? roomError
                  ? "Ajusta la cantidad de viajeros"
                  : "Ajusta el carrito"
                : "Continuar al checkout"}{" "}
              <Icon name="arrow" />
            </button>
          </div>
        </>
      ) : (
        <div className="empty">
          <h2>Tu carrito está esperando una aventura</h2>
          <button className="primary" onClick={() => go("/viajes")}>
            Explorar viajes
          </button>
        </div>
      )}
    </main>
  );
}

function BoardingStep({
  lines,
  agency,
  theme,
  onUpdate,
  error,
}: {
  lines: CartLine[];
  agency: Agency;
  theme: TravelTheme;
  onUpdate: (line: CartLine) => void;
  error: string;
}) {
  const groups = [
    ...new Map(
      lines.map((line) => [`${line.travelId}:${line.departureId}`, line]),
    ).values(),
  ];
  const [choices, setChoices] = useState<Record<string, string>>({});
  const isLavella = theme === "lavella";
  return (
    <section
      className={`checkout-boarding ${theme === "explorer" ? "is-explorer" : ""} ${isLavella ? "is-lavella" : ""}`}
      aria-labelledby="boarding-title"
    >
      <h2 id="boarding-title">Elige tu punto de abordaje</h2>
      <p>
        {isLavella
          ? "Selecciona un punto antes de continuar."
          : "Debes seleccionar y confirmar un punto antes de continuar."}
      </p>
      {groups.map((group) => {
        const trip = travels.find(
          (item) => item.id === group.travelId && item.agencyId === agency.id,
        )!;
        const departure = trip.departures.find(
          (item) => item.id === group.departureId,
        )!;
        const options = departure.boardingOptions
          .filter((option) => !["sold_out", "disabled"].includes(option.status))
          .map((option) => ({
            option,
            point: departurePoints.find(
              (point) =>
                point.id === option.agencyDeparturePointId &&
                point.agencyId === agency.id &&
                point.isActive,
            ),
          }))
          .filter((item) => item.point);
        const key = `${group.travelId}:${group.departureId}`;
        const groupLines = lines.filter(
          (line) =>
            line.travelId === group.travelId &&
            line.departureId === group.departureId,
        );
        const selected =
          choices[key] ??
          groupLines.find((line) => line.boardingOptionId)?.boardingOptionId ??
          "";
        const confirmed = lines
          .filter(
            (line) =>
              line.travelId === group.travelId &&
              line.departureId === group.departureId,
          )
          .every((line) => Boolean(line.boardingOptionId));
        const message = `Hola ${agency.name}, me interesa ${trip.title} para la salida del ${new Date(departure.startDate).toLocaleDateString("es-MX")}. ¿Me pueden compartir o confirmar los puntos de ascenso disponibles?`;
        return (
          <fieldset
            key={key}
            aria-describedby={`${key}-help ${error ? `${key}-error` : ""}`}
          >
            <legend>
              {trip.title} ·{" "}
              {new Date(departure.startDate).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </legend>
            <p id={`${key}-help`}>
              {options.length === 1
                ? isLavella
                  ? "Esta salida tiene un punto disponible. Selecciónalo para continuar."
                  : "Esta salida tiene un punto disponible. Revísalo y confírmalo explícitamente."
                : "Selecciona exactamente una opción."}
            </p>
            {options.length ? (
              options.map(({ option, point }) => (
                <label
                  className={`boarding-option ${selected === option.id ? "selected" : ""}`}
                  key={option.id}
                >
                  <input
                    type="radio"
                    name={`boarding-${key}`}
                    value={option.id}
                    checked={selected === option.id}
                    onChange={() => {
                      setChoices((current) => ({
                        ...current,
                        [key]: option.id,
                      }));
                      if (isLavella)
                        groupLines.forEach((line) =>
                          onUpdate(confirmBoardingPoint(line, option.id)),
                        );
                    }}
                  />
                  <span>
                    <b>{point!.name}</b>
                    <small>
                      {point!.address}
                      {point!.reference ? ` · ${point!.reference}` : ""}
                    </small>
                    <small>
                      Reunión {option.meetingTime} · salida{" "}
                      {option.departureTime}
                    </small>
                    <small>
                      {option.surchargeAmount
                        ? `Suplemento ${formatMoney(option.surchargeAmount, option.currency ?? trip.basePrice.currency)} ${option.surchargeType === "per_booking" ? "por reserva" : "por persona"}`
                        : "Sin suplemento"}
                    </small>
                    {(option.instructionsOverride ?? point!.instructions) && (
                      <em>
                        {option.instructionsOverride ?? point!.instructions}
                      </em>
                    )}
                  </span>
                </label>
              ))
            ) : (
              <div className="boarding-unavailable">
                <b>No hay puntos de abordaje disponibles para esta salida.</b>
                <p>La reserva en línea está temporalmente bloqueada.</p>
                <a
                  className="wa"
                  href={`https://wa.me/${agency.contact.whatsapp}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Consultar por WhatsApp
                </a>
              </div>
            )}
            {options.length > 0 && !isLavella && (
              <button
                type="button"
                className="confirm-boarding"
                disabled={!selected}
                onClick={() => {
                  groupLines.forEach((line) =>
                    onUpdate(confirmBoardingPoint(line, selected)),
                  );
                }}
              >
                Confirmar punto de abordaje
              </button>
            )}
            {confirmed && (
              <p className="boarding-confirmed" role="status">
                ✓ Punto confirmado
              </p>
            )}
            {error && !confirmed && (
              <p id={`${key}-error`} className="boarding-error" role="alert">
                {error}
              </p>
            )}
          </fieldset>
        );
      })}
    </section>
  );
}

function TravelerStep({
  agency,
  status,
  drafts,
  error,
  onChange,
}: {
  agency: Agency;
  status: TravelerDataStatus;
  drafts: TravelerDraft[];
  error: string;
  onChange: (status: TravelerDataStatus, drafts: TravelerDraft[]) => void;
}) {
  const update = (id: string, patch: Partial<TravelerDraft>) => {
    const next = drafts.map((draft) => {
      if (draft.id !== id) return draft;
      const updated = { ...draft, ...patch };
      return {
        ...updated,
        completionStatus: updated.fullName.trim() ? "complete" : "pending",
      } as TravelerDraft;
    });
    onChange(status, next);
  };
  const missingNames =
    status === "complete" && error.includes("nombre completo");
  return (
    <section className="traveler-step" aria-labelledby="traveler-title">
      <header>
        <div>
          <h2 id="traveler-title">Datos de viajeros</h2>
          <p>
            Solo necesitamos el nombre ahora. Los demás datos son opcionales.
          </p>
        </div>
        <span>{drafts.length} viajeros</span>
      </header>
      <fieldset className="traveler-mode">
        <legend>¿Cuándo deseas completar los datos?</legend>
        <label>
          <input
            type="radio"
            name="traveler-mode"
            checked={status === "complete"}
            onChange={() => onChange("complete", drafts)}
          />
          <span>
            <b>Completar ahora</b>
            <small>Captura el nombre de cada viajero.</small>
          </span>
        </label>
        <label>
          <input
            type="radio"
            name="traveler-mode"
            checked={status === "pending"}
            onChange={() =>
              onChange(
                "pending",
                drafts.map((draft) => ({
                  ...draft,
                  completionStatus: "pending",
                })),
              )
            }
          />
          <span>
            <b>Llenar después</b>
            <small>Continúa sin fricción y completa más adelante.</small>
          </span>
        </label>
      </fieldset>
      {status === "pending" ? (
        <p className="traveler-later-note" role="status">
          {travelerFollowUpMessage(agency)}
        </p>
      ) : (
        <div className="traveler-grid">
          {drafts.map((draft) => {
            const label = `${draft.category === "adult" ? "Adulto" : "Menor"} ${draft.sequence}`;
            const missing = missingNames && !draft.fullName.trim();
            return (
              <details className="traveler-card" key={draft.id} open>
                <summary>
                  <span>{label}</span>
                  <small>
                    {draft.fullName.trim() ? "Completo" : "Pendiente"}
                  </small>
                </summary>
                <div>
                  <label>
                    Nombre completo
                    <input
                      value={draft.fullName}
                      required
                      aria-invalid={missing}
                      aria-describedby={
                        missing ? `${draft.id}-error` : undefined
                      }
                      onChange={(event) =>
                        update(draft.id, { fullName: event.target.value })
                      }
                    />
                    {missing && (
                      <small
                        id={`${draft.id}-error`}
                        className="traveler-error"
                      >
                        Escribe el nombre completo.
                      </small>
                    )}
                  </label>
                  <label>
                    Fecha de nacimiento <small>(opcional)</small>
                    <input
                      type="date"
                      value={draft.birthDate ?? ""}
                      onChange={(event) =>
                        update(draft.id, { birthDate: event.target.value })
                      }
                    />
                  </label>
                  {draft.category === "adult" ? (
                    <>
                      <label>
                        Teléfono <small>(opcional)</small>
                        <input
                          type="tel"
                          value={draft.phone ?? ""}
                          onChange={(event) =>
                            update(draft.id, { phone: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Correo <small>(opcional)</small>
                        <input
                          type="email"
                          value={draft.email ?? ""}
                          onChange={(event) =>
                            update(draft.id, { email: event.target.value })
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <label>
                      Edad <small>(opcional)</small>
                      <input
                        type="number"
                        min="0"
                        max="17"
                        value={draft.age ?? ""}
                        onChange={(event) =>
                          update(draft.id, {
                            age: event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LavellaReservationConfirmation({
  reservation,
  whatsappHref,
  onContinue,
}: {
  reservation: ReservationSnapshot;
  whatsappHref: string;
  onContinue: () => void;
}) {
  const depositPaid = [
    "partially_paid",
    "confirmed",
    "completed",
  ].includes(reservation.status);
  const travelerCount =
    reservation.travelers.adults + reservation.travelers.minors;
  return (
    <section
      className="confirmation lavella-confirmation"
      aria-labelledby="lavella-confirmation-title"
    >
      <header className="lavella-confirmation-header">
        <span className="success">
          <Icon name="check" />
        </span>
        <div>
          <div className="eyebrow">RESERVACIÓN CONFIRMADA</div>
          <h2 id="lavella-confirmation-title">Reservación confirmada</h2>
          <p>
            Conserva tu folio para cualquier seguimiento con{" "}
            {reservation.agency.name}.
          </p>
        </div>
      </header>

      <div className="lavella-confirmation-folio">
        <small>FOLIO</small>
        <strong>{reservation.reservationCode}</strong>
        <span>
          Creada el{" "}
          {new Date(reservation.createdAt).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="lavella-confirmation-grid">
        <section>
          <h3>Tu viaje</h3>
          <dl>
            <div>
              <dt>Tour</dt>
              <dd>{reservation.tour.title}</dd>
            </div>
            <div>
              <dt>Clave</dt>
              <dd>{reservation.tour.code}</dd>
            </div>
            <div>
              <dt>Salida</dt>
              <dd>
                {new Date(
                  reservation.departure.startDate,
                ).toLocaleDateString("es-MX", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3>Punto de abordaje</h3>
          <dl>
            <div>
              <dt>Punto</dt>
              <dd>{reservation.boarding.pointName}</dd>
            </div>
            {reservation.boarding.meetingTime && (
              <div>
                <dt>Reunión</dt>
                <dd>{reservation.boarding.meetingTime}</dd>
              </div>
            )}
            {(reservation.boarding.reference ||
              reservation.boarding.address) && (
              <div>
                <dt>Referencia</dt>
                <dd>
                  {reservation.boarding.reference ??
                    reservation.boarding.address}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section>
          <h3>Viajeros</h3>
          <p className="lavella-traveler-count">
            {travelerCount} {travelerCount === 1 ? "viajero" : "viajeros"} ·{" "}
            {reservation.travelers.adults} adultos
            {reservation.travelers.minors
              ? ` · ${reservation.travelers.minors} menores`
              : ""}
          </p>
          {reservation.travelers.status === "pending" ? (
            <p className="lavella-confirmation-note">
              Datos de viajeros pendientes. La agencia podrá solicitarlos
              posteriormente.
            </p>
          ) : (
            <ul>
              {reservation.travelers.drafts.map((draft) => (
                <li key={draft.id}>
                  <span>
                    {draft.category === "adult" ? "Adulto" : "Menor"}{" "}
                    {draft.sequence}
                  </span>
                  <b>{draft.fullName}</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lavella-confirmation-totals">
          <h3>Resumen de pago</h3>
          <dl>
            <div>
              <dt>Total</dt>
              <dd>{formatMoney(reservation.total, reservation.currency)}</dd>
            </div>
            <div>
              <dt>
                {depositPaid ? "Anticipo pagado" : "Anticipo por pagar"}{" "}
                {reservation.depositPercent < 100
                  ? `(${reservation.depositPercent}%)`
                  : ""}
              </dt>
              <dd>
                {formatMoney(
                  reservation.depositAmount,
                  reservation.currency,
                )}
              </dd>
            </div>
            <div className="is-balance">
              <dt>Saldo pendiente</dt>
              <dd>
                {formatMoney(
                  reservation.remainingAmount,
                  reservation.currency,
                )}
              </dd>
            </div>
            <div>
              <dt>Moneda</dt>
              <dd>{reservation.currency}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="lavella-confirmation-next">
        <div className="eyebrow">PRÓXIMOS PASOS</div>
        <h3>¿Qué sigue?</h3>
        <ol>
          <li>
            {reservation.agency.name} revisará la solicitud y te compartirá
            las instrucciones para completar el anticipo.
          </li>
          {reservation.travelers.status === "pending" && (
            <li>
              Ten disponibles los nombres de los viajeros para completar el
              expediente.
            </li>
          )}
          <li>
            Usa el folio {reservation.reservationCode} para cualquier
            aclaración.
          </li>
        </ol>
      </section>

      <div className="lavella-confirmation-actions">
        <a
          className="wa"
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
        >
          Enviar folio por WhatsApp
        </a>
        <button type="button" onClick={onContinue}>
          Volver a viajes
        </button>
      </div>
    </section>
  );
}

function Checkout({
  lines,
  agency,
  theme,
  onDone,
  onUpdate,
}: {
  lines: CartLine[];
  agency: Agency;
  theme: TravelTheme;
  onDone: () => void;
  onUpdate: (line: CartLine) => void;
}) {
  const configuredDepositOptions = resolveDepositOptionsPercent(
    agency.settings.depositOptionsPercent,
  );
  const [persistedDepositSnapshot] = useState(() => {
    const line = lines.find(
      (item) =>
        item.depositPercent !== undefined &&
        item.depositAmount !== undefined &&
        item.remainingAmount !== undefined,
    );
    return line
      ? {
          depositPercent: line.depositPercent!,
          depositAmount: line.depositAmount!,
          remainingAmount: line.remainingAmount!,
        }
      : undefined;
  });
  const lavellaDepositOptions = persistedDepositSnapshot
    ? [persistedDepositSnapshot.depositPercent]
    : configuredDepositOptions;
  const initialDepositPercent =
    persistedDepositSnapshot?.depositPercent ?? lavellaDepositOptions[0];
  const [selectedDepositPercent, setSelectedDepositPercent] = useState(
    initialDepositPercent,
  );
  const [step, setStep] = useState(1);
  const [reservation, setReservation] = useState<ReservationSnapshot>();
  const finalizingRef = useRef(false);
  const reservationSubmissionKeyRef = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [travelerStatus, setTravelerStatus] = useState<TravelerDataStatus>(
    lines[0]?.travelerDataStatus ?? "complete",
  );
  const [travelerDrafts, setTravelerDrafts] = useState<TravelerDraft[]>(() =>
    draftsFromLines(lines),
  );
  const [paymentKind, setPaymentKind] = useState<"deposit" | "full">(
    theme === "lavella"
      ? initialDepositPercent === 100
        ? "full"
        : "deposit"
      : lines[0]?.paymentAllocation?.kind ?? "deposit",
  );
  const [checkoutFxSnapshot, setCheckoutFxSnapshot] = useState<
    FxSnapshot | undefined
  >(lines.find((line) => line.fxSnapshot)?.fxSnapshot);
  const [checkoutPaymentAllocation, setCheckoutPaymentAllocation] = useState<
    PaymentAllocation | undefined
  >(lines.find((line) => line.paymentAllocation)?.paymentAllocation);
  const [fxAccepted, setFxAccepted] = useState(false);
  const [checkoutFxConsent, setCheckoutFxConsent] = useState<
    FxConsent | undefined
  >(lines.find((line) => line.fxConsent)?.fxConsent);
  const [fxQuoteStatus, setFxQuoteStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [fxQuoteError, setFxQuoteError] = useState("");
  const [fxQuoteRequestNonce, setFxQuoteRequestNonce] = useState(0);
  let roomError = "";
  try {
    validateCartRoomCapacity(lines);
  } catch (capacityError) {
    roomError =
      capacityError instanceof Error
        ? capacityError.message
        : "La cantidad de viajeros excede la capacidad máxima de la habitación.";
  }
  let currencyError = "";
  try {
    validateCartCurrencies(lines);
    validateDemoFxOrderShape(lines);
  } catch (currencyIssue) {
    currencyError =
      currencyIssue instanceof Error
        ? currencyIssue.message
        : "No puedes mezclar monedas en una misma orden.";
  }
  const estimateResults = estimateCartLines(lines);
  const pricingError =
    estimateResults.find((result) => !result.estimate)?.error ?? "";
  const estimates = estimateResults.flatMap((result) =>
    result.estimate ? [result.estimate] : [],
  );
  const boardingComplete =
    lines.length > 0 &&
    !roomError &&
    !currencyError &&
    !pricingError &&
    lines.every((line) => Boolean(line.boardingOptionId));
  const priced = boardingComplete
    ? (estimates as ReturnType<typeof priceLine>[])
    : [];
  const total = estimates.reduce((sum, item) => sum + item.total, 0);
  const contractualDeposit = estimates.reduce(
    (sum, item) => sum + item.deposit,
    0,
  );
  const selectedDepositSnapshot =
    theme === "lavella"
      ? persistedDepositSnapshot &&
        persistedDepositSnapshot.depositPercent === selectedDepositPercent
        ? persistedDepositSnapshot
        : createDepositSelectionSnapshot(total, selectedDepositPercent)
      : undefined;
  const foreignTravel = estimates.find(
    (item) => item.travel.foreignCurrencyPricing?.convertDepositAtCheckout,
  )?.travel;
  const foreignPricing = foreignTravel?.foreignCurrencyPricing;
  const fxPolicy = agency.settings.exchangeRatePolicy;
  const fxRequired = Boolean(
    foreignPricing &&
      fxPolicy?.enabled &&
      foreignPricing.pricingCurrency !==
        foreignPricing.checkoutChargeCurrency,
  );
  const contractualPayment =
    theme === "lavella"
      ? selectedDepositSnapshot!.depositAmount
      : paymentKind === "full"
        ? total
        : contractualDeposit;
  const requestFxRequote = (message = "") => {
    setFxAccepted(false);
    setCheckoutFxConsent(undefined);
    setCheckoutFxSnapshot(undefined);
    setCheckoutPaymentAllocation(undefined);
    setFxQuoteError(message);
    setFxQuoteStatus("loading");
    setFxQuoteRequestNonce((current) => current + 1);
  };
  const selectLavellaDeposit = (depositPercent: number) => {
    const snapshot = createDepositSelectionSnapshot(total, depositPercent);
    setSelectedDepositPercent(depositPercent);
    setPaymentKind(depositPercent === 100 ? "full" : "deposit");
    setFxAccepted(false);
    setCheckoutFxConsent(undefined);
    setCheckoutFxSnapshot(undefined);
    setCheckoutPaymentAllocation(undefined);
    lines.forEach((line) =>
      onUpdate({
        ...line,
        ...snapshot,
        fxSnapshot: undefined,
        paymentAllocation: undefined,
        fxConsent: undefined,
      }),
    );
  };
  useEffect(() => {
    let cancelled = false;
    if (
      step < 4 ||
      !fxRequired ||
      !foreignPricing ||
      !fxPolicy ||
      !total ||
      !contractualPayment
    ) {
      if (!fxRequired) {
        setFxQuoteStatus("idle");
        setFxQuoteError("");
      }
      return;
    }
    const contractTotalMinor = toMinorUnits(
      total,
      foreignPricing.pricingCurrency,
    );
    const contractualPaymentMinor = toMinorUnits(
      contractualPayment,
      foreignPricing.pricingCurrency,
    );
    const existing = lines.find(
      (line) =>
        line.fxSnapshot &&
        line.paymentAllocation &&
        line.paymentAllocation.kind === paymentKind &&
        line.fxSnapshot.sourceAmountMinor === contractualPaymentMinor &&
        line.paymentAllocation.contractTotalMinor === contractTotalMinor,
    );
    setFxQuoteStatus("loading");
    setFxQuoteError("");
    setFxAccepted(false);
    ensureFreshDeterministicDemoPaymentQuote({
      current:
        existing?.fxSnapshot && existing.paymentAllocation
          ? {
              snapshot: existing.fxSnapshot,
              allocation: existing.paymentAllocation,
            }
          : undefined,
      policy: fxPolicy,
      sourceCurrency: foreignPricing.pricingCurrency,
      chargeCurrency: foreignPricing.checkoutChargeCurrency,
      contractTotalMinor,
      contractualPaymentMinor,
      kind: paymentKind,
    })
      .then(({ snapshot, allocation }) => {
        if (cancelled) return;
        setCheckoutFxSnapshot(snapshot);
        setCheckoutPaymentAllocation(allocation);
        setFxQuoteStatus("ready");
      })
      .catch((quoteError) => {
        if (cancelled) return;
        setCheckoutFxSnapshot(undefined);
        setCheckoutPaymentAllocation(undefined);
        setFxQuoteStatus("error");
        setFxQuoteError(
          quoteError instanceof Error
            ? quoteError.message
            : "No fue posible calcular el tipo de cambio demo.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    contractualPayment,
    foreignPricing,
    fxPolicy,
    fxRequired,
    fxQuoteRequestNonce,
    lines,
    paymentKind,
    step,
    total,
  ]);
  const adultCount = travelerDrafts.filter(
    (draft) => draft.category === "adult",
  ).length;
  const minorCount = travelerDrafts.filter(
    (draft) => draft.category === "minor",
  ).length;
  const steps = [
    "Resumen",
    "Titular",
    "Abordaje y viajeros",
    "Pago",
    "Políticas",
    "Confirmación",
  ];
  if (!lines.length)
    return (
      <Cart
        lines={[]}
        agency={agency}
        theme={theme}
        onRemove={() => {}}
        onCheckout={() => {}}
      />
    );
  const next = () => {
    if (pricingError) {
      setError(`${pricingError} Actualiza o elimina esta reserva del carrito.`);
      return;
    }
    if (currencyError) {
      setError(`${currencyError} Ajusta el carrito antes de continuar.`);
      return;
    }
    if (roomError) {
      setError(roomError);
      return;
    }
    if (step === 3 && !boardingComplete) {
      setError(
        theme === "lavella"
          ? "Selecciona un punto de abordaje antes de continuar."
          : "Selecciona y confirma un punto de abordaje antes de continuar.",
      );
      return;
    }
    if (
      step === 3 &&
      (theme === "explorer" || theme === "lavella")
    ) {
      const validation = validateTravelerDrafts(travelerDrafts, travelerStatus);
      if (!validation.valid) {
        setError(
          "Escribe el nombre completo de cada viajero o elige Llenar después.",
        );
        return;
      }
    }
    if (step === 4 && theme === "lavella" && !fxRequired) {
      lines.forEach((line) =>
        onUpdate({
          ...line,
          ...selectedDepositSnapshot!,
        }),
      );
    }
    if (step === 4 && fxRequired) {
      if (
        fxQuoteStatus !== "ready" ||
        !checkoutFxSnapshot ||
        !checkoutPaymentAllocation
      ) {
        setError(
          fxQuoteError ||
            "Espera mientras actualizamos el tipo de cambio demo.",
        );
        return;
      }
      if (fxPolicy?.requireExplicitConsent && !fxAccepted) {
        setError(
          "Acepta la conversión de USD a MXN antes de continuar.",
        );
        return;
      }
      try {
        validateFxPaymentContext({
          snapshot: checkoutFxSnapshot,
          allocation: checkoutPaymentAllocation,
          sourceCurrency: foreignPricing!.pricingCurrency,
          chargeCurrency: foreignPricing!.checkoutChargeCurrency,
          contractTotalMinor: toMinorUnits(
            total,
            foreignPricing!.pricingCurrency,
          ),
          contractualPaymentMinor: toMinorUnits(
            contractualPayment,
            foreignPricing!.pricingCurrency,
          ),
          kind: paymentKind,
        });
        const consent = createFxConsent({
          snapshot: checkoutFxSnapshot,
          acceptedAt: new Date().toISOString(),
        });
        validateFxConsent({
          snapshot: checkoutFxSnapshot,
          consent,
        });
        setCheckoutFxConsent(consent);
        lines.forEach((line) =>
          onUpdate({
            ...line,
            ...(selectedDepositSnapshot ?? {}),
            fxSnapshot: checkoutFxSnapshot,
            paymentAllocation: checkoutPaymentAllocation,
            fxConsent: consent,
          }),
        );
      } catch (consentError) {
        requestFxRequote(
          "La cotización venció. Estamos calculando un nuevo importe.",
        );
        setError(
          consentError instanceof Error
            ? consentError.message
            : "La cotización ya no está vigente.",
        );
        return;
      }
    }
    if (
      step === 5 &&
      fxRequired &&
      checkoutFxSnapshot &&
      fxPolicy?.requireExplicitConsent
    ) {
      try {
        if (!checkoutPaymentAllocation || !foreignPricing)
          throw new Error("La asignación del pago no está disponible.");
        validateFxPaymentContext({
          snapshot: checkoutFxSnapshot,
          allocation: checkoutPaymentAllocation,
          sourceCurrency: foreignPricing.pricingCurrency,
          chargeCurrency: foreignPricing.checkoutChargeCurrency,
          contractTotalMinor: toMinorUnits(
            total,
            foreignPricing.pricingCurrency,
          ),
          contractualPaymentMinor: toMinorUnits(
            contractualPayment,
            foreignPricing.pricingCurrency,
          ),
          kind: paymentKind,
        });
        validateFxConsent({
          snapshot: checkoutFxSnapshot,
          consent: checkoutFxConsent,
        });
      } catch (consentError) {
        requestFxRequote(
          "La cotización venció. Estamos calculando un nuevo importe.",
        );
        setError(
          consentError instanceof Error
            ? consentError.message
            : "Actualiza y acepta nuevamente la cotización.",
        );
        setStep(4);
        return;
      }
    }
    setError("");
    if (step === 5) {
      if (finalizingRef.current) return;
      if (!reservationSubmissionKeyRef.current) {
        reservationSubmissionKeyRef.current =
          createReservationSubmissionKey();
      }
      finalizingRef.current = true;
      try {
        const primary = priced[0];
        if (!primary)
          throw new Error("No hay una reserva válida para confirmar.");
        const depositSnapshot =
          selectedDepositSnapshot ??
          (() => {
            const depositAmount =
              paymentKind === "full" ? total : contractualDeposit;
            return {
              depositPercent: total
                ? Math.round((depositAmount / total) * 10_000) / 100
                : 100,
              depositAmount,
              remainingAmount:
                Math.round((total - depositAmount) * 100) / 100,
            };
          })();
        const result = finalizeReservation({
          storage: window.localStorage,
          input: {
            idempotencyKey: reservationSubmissionKeyRef.current,
            agency,
            theme,
            tour: {
              id: primary.travel.id,
              code: primary.travel.code,
              title: primary.travel.title,
            },
            departure: {
              id: primary.departure.id,
              startDate: primary.departure.startDate,
            },
            boarding: primary.boarding,
            travelers: {
              status: travelerStatus,
              adults: adultCount,
              minors: minorCount,
              drafts: travelerDrafts,
            },
            currency: primary.travel.basePrice.currency,
            ...(checkoutFxSnapshot ||
            checkoutPaymentAllocation ||
            checkoutFxConsent
              ? {
                  fx: {
                    snapshot: checkoutFxSnapshot,
                    allocation: checkoutPaymentAllocation,
                    consent: checkoutFxConsent,
                  },
                }
              : {}),
            total,
            ...depositSnapshot,
          },
        });
        setReservation(result.reservation);
        setStep(6);
        onDone();
      } catch (reservationError) {
        finalizingRef.current = false;
        setError(
          reservationError instanceof Error
            ? reservationError.message
            : "No fue posible crear la reservación.",
        );
      }
    } else setStep((value) => value + 1);
  };
  const updateTravelers = (
    status: TravelerDataStatus,
    drafts: TravelerDraft[],
  ) => {
    setTravelerStatus(status);
    setTravelerDrafts(drafts);
    applyTravelerDataToLines(lines, status, drafts).forEach(onUpdate);
  };
  const reservationWhatsappHref = reservation
    ? `https://wa.me/${reservation.agency.whatsapp}?text=${encodeURIComponent(
        [
          `Hola ${reservation.agency.name}, mi reservación es ${reservation.reservationCode}.`,
          `Viaje: ${reservation.tour.title}.`,
          `Salida: ${new Date(reservation.departure.startDate).toLocaleDateString("es-MX")}.`,
          `Punto de abordaje: ${reservation.boarding.pointName}.`,
          `Total: ${formatMoney(reservation.total, reservation.currency)}.`,
          `Anticipo: ${formatMoney(reservation.depositAmount, reservation.currency)}.`,
          `Saldo: ${formatMoney(reservation.remainingAmount, reservation.currency)}.`,
        ].join("\n"),
      )}`
    : "#";
  return (
    <main className={`checkout ${theme === "lavella" ? "lavella-checkout" : ""}`}>
      <header>
        <div className="eyebrow">
          CHECKOUT DEMOSTRATIVO · NO SE REALIZARÁ NINGÚN COBRO
        </div>
        <h1>{step === 6 ? "Reserva recibida" : steps[step - 1]}</h1>
      </header>
      <ol className="stepper">
        {steps.map((label, index) => (
          <li className={index + 1 <= step ? "active" : ""} key={label}>
            <span>{index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>
      <section className="checkout-card">
        {(roomError || error === roomError) && roomError && (
          <p className="cart-room-error" role="alert">
            {roomError} Reduce viajeros o solicita apoyo para distribuirlos en
            más habitaciones.
          </p>
        )}
        {currencyError && (
          <p className="cart-room-error" role="alert">
            {currencyError} Ajusta el carrito antes de continuar.
          </p>
        )}
        {pricingError && (
          <p className="cart-room-error" role="alert">
            {pricingError} Actualiza o elimina esta reserva del carrito.
          </p>
        )}
        {error &&
          error !== roomError &&
          !error.includes("punto de abordaje") &&
          !error.includes("nombre completo") && (
            <p className="cart-room-error" role="alert">
              {error}
            </p>
          )}
        {step === 1 && (
          <>
            <h2>Revisa tu viaje</h2>
            {estimateResults.map(({ line, estimate, error: lineError }) =>
              estimate ? (
                <div className="summary-row" key={line.id}>
                  <span>
                    {estimate.travel.title}
                    <small>
                      {line.boardingSnapshot
                        ? `${line.boardingSnapshot.pointName} · ${line.travelers} viajeros`
                        : `Punto pendiente · ${line.travelers} viajeros`}
                    </small>
                  </span>
                  <b>
                    {formatMoney(
                      estimate.total,
                      estimate.travel.basePrice.currency,
                    )}
                  </b>
                </div>
              ) : (
                <div className="summary-row" key={line.id} role="alert">
                  <span>
                    Reserva guardada no disponible
                    <small>{lineError}</small>
                  </span>
                  <b>Revisar</b>
                </div>
              ),
            )}
            <div className="summary-total">
              {currencyError || pricingError
                ? currencyError.includes("mezclar monedas")
                  ? "Totales separados por moneda"
                  : "Total no disponible"
                : "Total estimado"}{" "}
              <b>
                {currencyError || pricingError
                  ? "No disponible"
                  : formatMoney(
                      total,
                      estimates[0].travel.basePrice.currency,
                    )}
              </b>
            </div>
          </>
        )}
        {step === 2 && (
          <FormGrid
            useMexicoLocationSelectors={theme === "lavella"}
            fields={[
              "Nombre",
              "Apellidos",
              "Correo",
              "WhatsApp",
              "País",
              "Estado",
              "Ciudad",
              "Contacto de emergencia (opcional)",
            ]}
          />
        )}{" "}
        {step === 3 && (
          <>
            <BoardingStep
              lines={lines}
              agency={agency}
              theme={theme}
              onUpdate={onUpdate}
              error={roomError ? "" : error}
            />
            {theme === "explorer" || theme === "lavella" ? (
              <TravelerStep
                agency={agency}
                status={travelerStatus}
                drafts={travelerDrafts}
                error={error}
                onChange={updateTravelers}
              />
            ) : (
              <>
                <h2>Datos de viajeros</h2>
                <p>
                  Captura datos ficticios únicamente. No se almacenan ni
                  transmiten.
                </p>
                <FormGrid
                  fields={[
                    "Nombre del viajero",
                    "Apellidos",
                    "Fecha de nacimiento",
                    "Nacionalidad",
                    "Tipo de viajero",
                    "Pasaporte (si aplica)",
                    "Necesidades especiales",
                  ]}
                />
              </>
            )}
          </>
        )}
        {step === 4 && boardingComplete && (
          <>
            <h2>¿Cómo deseas continuar?</h2>
            {theme === "lavella" ? (
              <div className="choice-grid lavella-deposit-options">
                {lavellaDepositOptions.map((depositPercent) => {
                  const snapshot =
                    persistedDepositSnapshot?.depositPercent === depositPercent
                      ? persistedDepositSnapshot
                      : createDepositSelectionSnapshot(total, depositPercent);
                  return (
                    <label key={depositPercent}>
                      <input
                        type="radio"
                        name="paymentAmount"
                        checked={selectedDepositPercent === depositPercent}
                        onChange={() => selectLavellaDeposit(depositPercent)}
                      />
                      <b>
                        {depositPercent === 100
                          ? "Pago total"
                          : `${depositPercent}% de anticipo`}
                      </b>
                      <small>
                        Pagar ahora:{" "}
                        {formatMoney(
                          snapshot.depositAmount,
                          priced[0].travel.basePrice.currency,
                        )}
                      </small>
                      <small>
                        Saldo restante:{" "}
                        {formatMoney(
                          snapshot.remainingAmount,
                          priced[0].travel.basePrice.currency,
                        )}
                      </small>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="choice-grid">
                {([
                  { label: "Anticipo", value: "deposit" },
                  { label: "Pago total", value: "full" },
                ] as const).map((option) => (
                  <label key={option.value}>
                    <input
                      type="radio"
                      name="paymentAmount"
                      checked={paymentKind === option.value}
                      onChange={() => {
                        setPaymentKind(option.value);
                        setFxAccepted(false);
                        setCheckoutFxConsent(undefined);
                      }}
                    />
                    <b>{option.label}</b>
                    <small>
                      {option.value === "deposit"
                        ? formatMoney(
                            contractualDeposit,
                            priced[0].travel.basePrice.currency,
                          )
                        : formatMoney(
                            total,
                            priced[0].travel.basePrice.currency,
                          )}
                    </small>
                  </label>
                ))}
              </div>
            )}
            {fxRequired && (
              <div className="fx-checkout-disclosure">
                <h3>Conversión de moneda para este pago</h3>
                <p>
                  La tarifa está denominada en dólares. El cobro demo se
                  procesa en pesos mexicanos con la cotización vigente para
                  este intento.
                </p>
                {fxQuoteStatus === "loading" && (
                  <p role="status">Actualizando la tasa demo…</p>
                )}
                {fxQuoteStatus === "error" && (
                  <>
                    <p role="alert">{fxQuoteError}</p>
                    <button
                      type="button"
                      onClick={() => requestFxRequote()}
                    >
                      Reintentar cotización
                    </button>
                  </>
                )}
                {checkoutFxSnapshot && checkoutPaymentAllocation && (
                  <dl>
                    <div>
                      <dt>
                        {fxContractualPaymentLabel(paymentKind)}
                      </dt>
                      <dd>
                        {formatMinorUnits(
                          checkoutPaymentAllocation.contractualPaymentMinor,
                          checkoutPaymentAllocation.contractCurrency,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Importe a cobrar</dt>
                      <dd>
                        {formatMinorUnits(
                          checkoutPaymentAllocation.chargeNowMinor,
                          checkoutPaymentAllocation.chargeCurrency,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Tasa fuente demo</dt>
                      <dd>
                        {formatSourceRate(checkoutFxSnapshot)} +{" "}
                        {formatFxMarkup(checkoutFxSnapshot)}
                      </dd>
                    </div>
                    <div>
                      <dt>Tasa final aplicada</dt>
                      <dd>
                        {formatAppliedRate(checkoutFxSnapshot)} MXN/USD
                      </dd>
                    </div>
                    <div>
                      <dt>Saldo contractual</dt>
                      <dd>
                        {formatMinorUnits(
                          checkoutPaymentAllocation.remainingContractMinor,
                          checkoutPaymentAllocation.contractCurrency,
                        )}
                      </dd>
                    </div>
                  </dl>
                )}
                {fxPolicy?.requireExplicitConsent &&
                  checkoutFxSnapshot &&
                  checkoutPaymentAllocation && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={fxAccepted}
                        onChange={(event) =>
                          setFxAccepted(event.target.checked)
                        }
                      />
                      Entiendo que la tarifa está expresada en USD y que el
                      cargo en MXN se calcula con la tasa vigente al momento de
                      cada pago.
                    </label>
                  )}
              </div>
            )}
            <div className="choice-grid">
              {[
                "Transferencia",
                "Tarjeta simulada",
                "Efectivo en sucursal",
                "Terminar por WhatsApp",
              ].map((label) => (
                <label key={label}>
                  <input
                    type="radio"
                    name="method"
                    required
                    defaultChecked={label === "Transferencia"}
                  />
                  <b>{label}</b>
                </label>
              ))}
            </div>
          </>
        )}
        {step === 5 && boardingComplete && (
          <>
            <h2>Contrato y políticas</h2>
            <div className="policy-box">
              <p>{priced[0].travel.policies.cancellation}</p>
              <p>{priced[0].travel.policies.responsibility}</p>
              <p>
                Aviso de privacidad demostrativo: ningún dato se envía ni
                almacena.
              </p>
            </div>
            <label className="check">
              <input type="checkbox" required defaultChecked /> Acepto las
              políticas y autorizo contacto simulado.
            </label>
          </>
        )}
        {step === 6 && reservation && theme === "lavella" && (
          <LavellaReservationConfirmation
            reservation={reservation}
            whatsappHref={reservationWhatsappHref}
            onContinue={() => go("/viajes")}
          />
        )}
        {step === 6 && reservation && theme !== "lavella" && (
          <div className="confirmation">
            <span className="success">
              <Icon name="check" />
            </span>
            <div className="eyebrow">FOLIO DEMO</div>
            <h2>{reservation.reservationCode}</h2>
            <p>Tu solicitud quedó confirmada en modo demostración.</p>
            <div>
              <span>
                Fecha{" "}
                <b>
                  {new Date(
                    reservation.departure.startDate,
                  ).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </b>
              </span>
              <span>
                Punto de abordaje <b>{reservation.boarding.pointName}</b>
              </span>
              {reservation.boarding.meetingTime && (
                <span>
                  Hora de reunión <b>{reservation.boarding.meetingTime}</b>
                </span>
              )}
              <span>
                Dirección o referencia{" "}
                <b>
                  {reservation.boarding.reference ??
                    reservation.boarding.address}
                </b>
              </span>
              {reservation.boarding.instructions && (
                <span>
                  Instrucciones <b>{reservation.boarding.instructions}</b>
                </span>
              )}
              <span>
                Total{" "}
                <b>
                  {formatMoney(reservation.total, reservation.currency)}
                </b>
              </span>
              <span>
                {reservation.depositPercent === 100
                  ? "Pago total"
                  : `Anticipo (${reservation.depositPercent}%)`}{" "}
                <b>
                  {formatMoney(
                    reservation.depositAmount,
                    reservation.currency,
                  )}
                </b>
              </span>
              <span>
                Saldo restante{" "}
                <b>
                  {formatMoney(
                    reservation.remainingAmount,
                    reservation.currency,
                  )}
                </b>
              </span>
              {reservation.fx?.snapshot && reservation.fx.allocation && (
                <>
                  <span>
                    {fxContractualPaymentLabel(
                      reservation.fx.allocation.kind,
                    )}{" "}
                    <b>
                      {formatMinorUnits(
                        reservation.fx.allocation.contractualPaymentMinor,
                        reservation.fx.allocation.contractCurrency,
                      )}
                    </b>
                  </span>
                  <span>
                    Cargo demo en México{" "}
                    <b>
                      {formatMinorUnits(
                        reservation.fx.allocation.chargeNowMinor,
                        reservation.fx.allocation.chargeCurrency,
                      )}
                    </b>
                  </span>
                  <span>
                    Tasa demo aplicada{" "}
                    <b>
                      {formatAppliedRate(reservation.fx.snapshot)} MXN/USD
                    </b>
                  </span>
                  <span>
                    Saldo contractual{" "}
                    <b>
                      {formatMinorUnits(
                        reservation.fx.allocation.remainingContractMinor,
                        reservation.fx.allocation.contractCurrency,
                      )}
                    </b>
                  </span>
                  {reservation.fx.consent && (
                    <span>
                      Conversión aceptada{" "}
                      <b>
                        {new Date(
                          reservation.fx.consent.acceptedAt,
                        ).toLocaleString("es-MX")}
                      </b>
                    </span>
                  )}
                </>
              )}
            </div>
            {reservation.travelers.status === "pending" ? (
                <div className="confirmation-travelers is-pending">
                  <h3>Datos de viajeros pendientes de completar</h3>
                  <p>
                    Un agente de {reservation.agency.name} podría ponerse en
                    contacto contigo para solicitar esta información.
                  </p>
                </div>
              ) : (
                <div className="confirmation-travelers">
                  <h3>Viajeros</h3>
                  {reservation.travelers.drafts.map((draft) => (
                    <p key={draft.id}>
                      <span>
                        {draft.category === "adult" ? "Adulto" : "Menor"}{" "}
                        {draft.sequence}
                      </span>
                      <b>{draft.fullName}</b>
                    </p>
                  ))}
                </div>
              )}
            <a
              className="wa"
              href={reservationWhatsappHref}
              target="_blank"
              rel="noreferrer"
            >
              Continuar por WhatsApp
            </a>
            <button onClick={() => go("/viajes")}>Volver a viajes</button>
          </div>
        )}{" "}
        {step < 6 && (
          <div className="checkout-actions">
            <button
              disabled={step === 1}
              onClick={() => {
                setError("");
                setStep((value) => value - 1);
              }}
            >
              Atrás
            </button>
            <button
              className="primary"
              disabled={Boolean(roomError || currencyError || pricingError)}
              onClick={next}
            >
              {roomError
                ? "Ajusta la cantidad de viajeros"
                : currencyError || pricingError
                  ? "Revisa el carrito"
                  : step === 5
                    ? "Confirmar reserva demo"
                    : "Continuar"}{" "}
              <Icon name="arrow" />
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
const mexicoStates = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

function FormGrid({
  fields,
  useMexicoLocationSelectors = false,
}: {
  fields: string[];
  useMexicoLocationSelectors?: boolean;
}) {
  return (
    <div className="form-grid">
      {fields.map((f, i) => (
        <label key={f}>
          {f}
          {useMexicoLocationSelectors && f === "País" ? (
            <select required defaultValue="México">
              <option value="México">México</option>
            </select>
          ) : useMexicoLocationSelectors && f === "Estado" ? (
            <select required defaultValue="Ciudad de México">
              {mexicoStates.map((state) => (
                <option value={state} key={state}>
                  {state}
                </option>
              ))}
            </select>
          ) : (
            <input
              required={!f.includes("opcional")}
              type={
                f.includes("Correo")
                  ? "email"
                  : f.includes("Fecha")
                    ? "date"
                    : "text"
              }
              placeholder={i < 2 ? "Dato de demostración" : ""}
            />
          )}
        </label>
      ))}
    </div>
  );
}
function Admin({
  agency,
  role,
  setRole,
  onPreview,
}: {
  agency: Agency;
  role: string;
  setRole: (r: string) => void;
  onPreview: () => void;
}) {
  const own = travels.filter((t) => t.agencyId === agency.id);
  const [section, setSection] = useState("dashboard");
  const [toast, setToast] = useState("");
  const act = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  };
  const menu = [
    "dashboard",
    "viajes",
    "contenido del viaje",
    "destinos",
    "salidas",
    "puntos de salida",
    "reservas",
    "clientes",
    "viajeros",
    "promociones",
    "configuración",
    "temas",
  ];
  return (
    <main className="admin">
      <aside>
        <button className="admin-brand">
          <Icon name="plane" /> FU TRAVEL <small>OPERATING SYSTEM</small>
        </button>
        <nav>
          {menu.map((x) => (
            <button
              className={section === x ? "active" : ""}
              key={x}
              onClick={() => setSection(x)}
            >
              <Icon
                name={
                  x === "dashboard"
                    ? "spark"
                    : x === "salidas"
                      ? "calendar"
                      : x.includes("punto")
                        ? "pin"
                        : "arrow"
                }
              />
              {x}
            </button>
          ))}
        </nav>
        <div className="admin-user">
          <span>FA</span>
          <div>
            <b>Fernando Admin</b>
            <small>{role.replaceAll("_", " ")}</small>
          </div>
        </div>
      </aside>
      <section className="admin-main">
        <header>
          <div>
            <small>MODO DEMO · {agency.plan.toUpperCase()}</small>
            <h1>{section[0].toUpperCase() + section.slice(1)}</h1>
          </div>
          <label>
            Rol visual
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {[
                "platform_owner",
                "agency_owner",
                "agency_admin",
                "manager",
                "sales_agent",
                "operator",
                "coordinator",
                "accountant",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <button onClick={onPreview}>Previsualizar sitio ↗</button>
        </header>
        {section === "dashboard" && <Dashboard agency={agency} own={own} />}{" "}
        {section === "viajes" && <AdminTrips own={own} act={act} />}{" "}
        {section === "contenido del viaje" && <TripContentManager own={own} act={act} />}{" "}
        {section === "puntos de salida" && (
          <AdminPoints agency={agency} act={act} />
        )}{" "}
        {section === "salidas" && <AdminDepartures own={own} />}{" "}
        {section === "temas" && <ThemeManager agency={agency} act={act} />}{" "}
        {![
          "dashboard",
          "viajes",
          "contenido del viaje",
          "puntos de salida",
          "salidas",
          "temas",
        ].includes(section) && <Coming section={section} />}
      </section>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function TripContentManager({ own, act }: { own: TravelProduct[]; act: (message: string) => void }) {
  const configured = own.find((trip) => trip.pageConfiguration);
  const [tripId, setTripId] = useState(configured?.id ?? own[0]?.id ?? "");
  const selected = own.find((trip) => trip.id === tripId);
  const [sections, setSections] = useState<TripSectionConfig[]>(selected?.pageConfiguration?.sections ?? []);
  useEffect(() => setSections(selected?.pageConfiguration?.sections ?? []), [selected]);
  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    const next = [...sections];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setSections(next.map((item, order) => ({ ...item, order: order + 1 })));
  };
  return (
    <section className="admin-trip-content">
      <header className="admin-section-head">
        <div><small>CONFIGURACIÓN DEMO LOCAL</small><h2>Contenido del viaje</h2><p>Define visibilidad, orden, títulos y comportamiento del itinerario sin duplicar la página.</p></div>
        <label>Viaje<select value={tripId} onChange={(event) => setTripId(event.target.value)}>{own.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
      </header>
      {sections.length ? <div className="admin-section-list">{[...sections].sort((a,b)=>a.order-b.order).map((item,index)=><article key={item.id}><label><input type="checkbox" checked={item.enabled} onChange={(event)=>setSections((current)=>current.map((section)=>section.id===item.id?{...section,enabled:event.target.checked}:section))}/> Activa</label><span><b>{item.anchorLabel ?? item.type}</b><input aria-label={`Título de ${item.type}`} value={item.title ?? ""} placeholder="Título personalizado" onChange={(event)=>setSections((current)=>current.map((section)=>section.id===item.id?{...section,title:event.target.value}:section))}/></span><div><button onClick={()=>move(index,-1)} disabled={index===0} aria-label={`Subir ${item.type}`}>↑</button><button onClick={()=>move(index,1)} disabled={index===sections.length-1} aria-label={`Bajar ${item.type}`}>↓</button></div></article>)}</div>:<p>Este viaje usa la estructura predeterminada. Selecciona uno de los viajes demo configurados.</p>}
      {selected?.itinerarySettings && <fieldset><legend>Itinerario</legend><label>Modo inicial<select value={selected.itinerarySettings.displayMode} onChange={()=>act("El modo se conserva en estado demo durante esta vista.")}><option value="all_open">Todos abiertos</option><option value="first_open">Primer día abierto</option><option value="all_closed">Todos cerrados</option></select></label><label>Video<input defaultValue={selected.videoContent?.url} placeholder="URL segura de video" /></label><label>Documento<input defaultValue={selected.itineraryDownload?.fileUrl} placeholder="/documents/itinerario.pdf" /></label><label><input type="checkbox" defaultChecked={selected.itineraryDownload?.requireLeadForm}/> Solicitar nombre y WhatsApp</label></fieldset>}
      <button className="primary" onClick={()=>act("Configuración guardada en la demostración local.")}>Guardar configuración demo</button>
    </section>
  );
}
function Dashboard({ agency, own }: { agency: Agency; own: TravelProduct[] }) {
  return (
    <>
      <div className="metrics">
        {[
          ["Reservas del mes", "28", "+12%"],
          ["Venta estimada", "$184,620", "+8.4%"],
          ["Lugares próximos", "67", "3 limitadas"],
          ["Conversión demo", "4.8%", "+0.6%"],
        ].map((x) => (
          <article key={x[0]}>
            <small>{x[0]}</small>
            <strong>{x[1]}</strong>
            <span>{x[2]}</span>
          </article>
        ))}
      </div>
      <div className="admin-grid">
        <section className="chart">
          <div>
            <h2>Actividad comercial</h2>
            <span>Últimos 7 días</span>
          </div>
          <div className="bars">
            {[38, 56, 44, 73, 61, 88, 66].map((n, i) => (
              <i key={i} style={{ height: `${n}%` }}>
                <b>{n}</b>
              </i>
            ))}
          </div>
        </section>
        <section className="admin-list">
          <h2>Próximas salidas</h2>
          {own.slice(0, 3).map((t) => (
            <div key={t.id}>
              <span className="date-box">
                {new Date(t.departures[0].startDate).getDate()}
                <small>AGO</small>
              </span>
              <div>
                <b>{t.title}</b>
                <small>
                  {t.departures[0].availableSpaces} lugares ·{" "}
                  {t.departures[0].saleStatus}
                </small>
              </div>
            </div>
          ))}
        </section>
      </div>
      <section className="admin-list wide">
        <div>
          <h2>Reservas recientes</h2>
          <button>Ver todas</button>
        </div>
        {["FTO-26-A8K21", "FTO-26-J93DM", "FTO-26-P4ZQ7"].map((x, i) => (
          <div key={x}>
            <b>{x}</b>
            <span>{own[i].title}</span>
            <span>{i + 2} viajeros</span>
            <span className="status">
              {i ? "Anticipo pendiente" : "Confirmada"}
            </span>
            <b>{formatMoney(3990 + i * 2100, agency.currency)}</b>
          </div>
        ))}
      </section>
    </>
  );
}
function AdminTrips({
  own,
  act,
}: {
  own: TravelProduct[];
  act: (m: string) => void;
}) {
  return (
    <>
      <div className="toolbar">
        <button
          onClick={() => act("Asistente de 16 pasos abierto en modo demo")}
        >
          + Crear viaje
        </button>
        <button
          onClick={() =>
            act("Plantillas: tour, excursión, circuito, playa, premium")
          }
        >
          Usar plantilla
        </button>
        <button
          onClick={() =>
            act(
              "Importador simulado: PDF, Word o texto; no se procesan archivos",
            )
          }
        >
          Importar con IA (simulada)
        </button>
      </div>
      <section className="admin-table">
        <div className="tr head">
          <span>Viaje</span>
          <span>Próxima salida</span>
          <span>Precio</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>
        {own.map((t) => (
          <div className="tr" key={t.id}>
            <span>
              <b>{t.title}</b>
              <small>
                {t.code} · {t.durationDays} días
              </small>
            </span>
            <span>
              {new Date(t.departures[0].startDate).toLocaleDateString("es-MX")}
            </span>
            <span>{formatMoney(t.basePrice.amount, t.basePrice.currency)}</span>
            <span className="status">{t.status}</span>
            <span>
              <button
                onClick={() => act(`${t.title}: editor por pasos abierto`)}
              >
                Editar
              </button>
              <button
                onClick={() =>
                  act(`Copia en borrador creada sin ventas; salidas opcionales`)
                }
              >
                Duplicar
              </button>
              <button
                onClick={() =>
                  act(`${t.title} archivado solo localmente en demo`)
                }
              >
                Archivar
              </button>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
function AdminPoints({
  agency,
  act,
}: {
  agency: Agency;
  act: (m: string) => void;
}) {
  const pts = departurePoints.filter((p) => p.agencyId === agency.id);
  return (
    <>
      <div className="toolbar">
        <button onClick={() => act("Formulario de nuevo punto abierto")}>
          + Crear punto
        </button>
      </div>
      <div className="point-grid">
        {pts.map((p, i) => (
          <article key={p.id}>
            <span>
              <Icon name="pin" />
            </span>
            <h2>{p.name}</h2>
            <p>{p.address}</p>
            <small>
              {p.city}, {p.state}
            </small>
            <div>
              <b>{i + 2} salidas asignadas</b>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <i />
              </label>
            </div>
            <button
              onClick={() =>
                act(
                  `Editando ${p.name}: horarios, suplemento, capacidad y orden`,
                )
              }
            >
              Editar y asignar
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
function AdminDepartures({ own }: { own: TravelProduct[] }) {
  return (
    <section className="admin-table">
      <div className="tr head">
        <span>Salida</span>
        <span>Fecha</span>
        <span>Abordajes</span>
        <span>Capacidad</span>
        <span>Estado</span>
      </div>
      {own.flatMap((t) =>
        t.departures.slice(0, 1).map((d) => (
          <div className="tr" key={d.id}>
            <span>
              <b>{t.title}</b>
              <small>{d.id}</small>
            </span>
            <span>{new Date(d.startDate).toLocaleDateString("es-MX")}</span>
            <span>{d.boardingOptions.length} puntos configurados</span>
            <span>
              {d.availableSpaces}/{d.capacity}
            </span>
            <span className="status">{d.saleStatus}</span>
          </div>
        )),
      )}
    </section>
  );
}
function ThemeManager({
  agency,
  act,
}: {
  agency: Agency;
  act: (m: string) => void;
}) {
  return (
    <div className="theme-grid">
      {(["explorer", "lavella"] as const).map((t) => (
        <article className={agency.theme === t ? "selected" : ""} key={t}>
          <div className={`theme-preview ${t}`}>
            <i />
            <i />
            <i />
          </div>
          <h2>{t[0].toUpperCase() + t.slice(1)}</h2>
          <p>
            {t === "explorer"
              ? "Fotográfico, enérgico y orientado a excursiones."
              : "Clásico, luminoso y basado en el sistema visual Lavella."}
          </p>
          <button
            onClick={() =>
              act(
                `Vista previa del tema ${t}; misma información, nueva capa visual`,
              )
            }
          >
            {agency.theme === t ? "Tema activo" : "Previsualizar"}
          </button>
          {t === "lavella" && (
            <label>
              Columnas del catálogo
              <select
                defaultValue={resolveLavellaCatalogColumns(agency)}
                onChange={(event) =>
                  act(
                    `Catálogo Lavella configurado en ${event.target.value} columnas para ${agency.name}.`,
                  )
                }
              >
                {LAVELLA_CATALOG_COLUMN_OPTIONS.map((columns) => (
                  <option key={columns} value={columns}>
                    {columns} columnas
                  </option>
                ))}
              </select>
            </label>
          )}
        </article>
      ))}
    </div>
  );
}
function Coming({ section }: { section: string }) {
  return (
    <div className="empty prepared">
      <Icon name="spark" />
      <h2>{section} está preparado para la siguiente fase</h2>
      <p>
        La navegación, el modelo multi-tenant y los estados demo ya están
        listos. La persistencia real llegará con Supabase y autenticación.
      </p>
    </div>
  );
}
function Footer({ agency }: { agency: Agency }) {
  return (
    <footer>
      <div className="brand">{agency.branding.logoText}</div>
      <p>Un sistema para descubrir, reservar y operar viajes con claridad.</p>
      <div>
        {nav.slice(0, 4).map(([l, h]) => (
          <button key={h} onClick={() => go(h)}>
            {l}
          </button>
        ))}
      </div>
      <small>
        © 2026 {agency.name} · Demostración no indexable · Sin pagos reales
      </small>
    </footer>
  );
}
export function TravelApp({
  hostname,
  initialTenant,
  initialTheme,
  initialPath = "/",
}: {
  hostname: string;
  initialTenant?: string;
  initialTheme?: string;
  initialPath?: string;
}) {
  const [route, setRoute] = useState(initialPath);
  const [version, setVersion] = useState(0);
  const params = useMemo(() => qp(), [version]);
  const agency = resolveTenant(hostname, params.get("tenant") ?? initialTenant);
  const theme = resolveTheme(agency, params.get("theme") ?? initialTheme);
  const admin =
    params.get("view") === "admin" ||
    route.startsWith("/admin") ||
    route.startsWith("/superadmin");
  const [role, setRole] = useState("agency_admin");
  const [cart, setCart] = useState<CartLine[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem("fu-travel-demo-cart");
    if (saved)
      try {
        setCart(JSON.parse(saved) as CartLine[]);
      } catch {}
    const sync = () => setRoute(path());
    sync();
    addEventListener("popstate", sync);
    return () => removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    localStorage.setItem("fu-travel-demo-cart", JSON.stringify(cart));
  }, [cart]);
  const change = (key: string, value: string) => {
    const search = qp();
    search.set(key, value);
    localStorage.setItem(`fu-travel-demo-${key}`, value);
    history.replaceState({}, "", `${route}?${search}`);
    setVersion((current) => current + 1);
  };
  const open = (travel: TravelProduct) => go(`/viajes/${travel.slug}`);
  const trip = travels.find(
    (travel) =>
      route === `/viajes/${travel.slug}` && travel.agencyId === agency.id,
  );
  const add = (line: CartLine) => {
    if (cart.length && cart[0].agencyId !== line.agencyId) {
      alert("El carrito pertenece a otra agencia.");
      return;
    }
    setCart((current) => [
      ...current.filter((item) => item.id !== line.id),
      line,
    ]);
    go("/carrito");
  };
  const updateLine = (line: CartLine) => {
    setCart((current) => {
      const next = current.map((item) => (item.id === line.id ? line : item));
      if (
        line.boardingSnapshot ||
        line.fxSnapshot ||
        line.paymentAllocation ||
        line.fxConsent ||
        line.depositPercent !== undefined
      )
        try {
          const draft = JSON.parse(
            localStorage.getItem("fu-travel-booking-draft") ?? "null",
          );
          if (
            draft?.travelId === line.travelId &&
            draft?.departureId === line.departureId
          ) {
            const related = next.filter(
              (item) =>
                item.travelId === line.travelId &&
                item.departureId === line.departureId,
            );
            const priced = related.every((item) => item.boardingOptionId)
              ? related.map(priceLine)
              : [];
            localStorage.setItem(
              "fu-travel-booking-draft",
              JSON.stringify({
                ...draft,
                ...(line.boardingSnapshot
                  ? { boarding: line.boardingSnapshot }
                  : {}),
                ...(line.fxSnapshot ? { fxSnapshot: line.fxSnapshot } : {}),
                ...(line.paymentAllocation
                  ? { paymentAllocation: line.paymentAllocation }
                  : {}),
                ...(line.fxConsent ? { fxConsent: line.fxConsent } : {}),
                ...(line.depositPercent !== undefined &&
                line.depositAmount !== undefined &&
                line.remainingAmount !== undefined
                  ? {
                      depositPercent: line.depositPercent,
                      depositAmount: line.depositAmount,
                      remainingAmount: line.remainingAmount,
                    }
                  : {}),
                total: priced.length
                  ? priced.reduce((sum, item) => sum + item.total, 0)
                  : draft.total,
                deposit:
                  line.depositAmount ??
                  (priced.length
                    ? priced.reduce((sum, item) => sum + item.deposit, 0)
                    : draft.deposit),
              }),
            );
          }
        } catch {}
      return next;
    });
  };
  let content: React.ReactNode;
  if (admin)
    content = (
      <Admin
        agency={agency}
        role={role}
        setRole={setRole}
        onPreview={() => change("view", "public")}
      />
    );
  else if (trip) content = <Detail trip={trip} agency={agency} onAdd={add} />;
  else if (route === "/viajes")
    content = <Catalog agency={agency} onOpen={open} />;
  else if (route === "/carrito")
    content = (
      <Cart
        lines={cart}
        agency={agency}
        theme={theme}
        onRemove={(id) =>
          setCart((current) => current.filter((item) => item.id !== id))
        }
        onCheckout={() => go("/checkout")}
      />
    );
  else if (route === "/checkout" || route === "/confirmacion")
    content = (
      <Checkout
        lines={cart}
        agency={agency}
        theme={theme}
        onDone={() => {}}
        onUpdate={updateLine}
      />
    );
  else if (route === "/destinos")
    content = (
      <main className="simple-page">
        <header className="page-title">
          <div className="eyebrow">DESTINOS</div>
          <h1>Lugares que abren conversaciones</h1>
        </header>
        <div className="destination-grid">
          {destinations
            .filter((destination) => destination.agencyId === agency.id)
            .map((destination) => (
              <article
                style={{
                  backgroundImage: `linear-gradient(0deg,rgba(0,0,0,.72),transparent),url(${destination.featuredImage})`,
                }}
                key={destination.id}
              >
                <div>
                  <small>{destination.country}</small>
                  <h2>{destination.name}</h2>
                  <p>{destination.summary}</p>
                </div>
              </article>
            ))}
        </div>
      </main>
    );
  else if (route === "/promociones")
    content = <Catalog agency={agency} onOpen={open} />;
  else if (
    route === "/nosotros" ||
    route === "/contacto" ||
    route.startsWith("/categorias")
  )
    content = (
      <main className="simple-page">
        <header className="page-title">
          <div className="eyebrow">{route.slice(1).toUpperCase()}</div>
          <h1>
            {route === "/contacto"
              ? "Hablemos de tu próximo viaje"
              : "Viajar bien empieza con información clara"}
          </h1>
          <p>
            Esta vista demuestra que todas las rutas conservan el tenant, tema y
            contexto comercial.
          </p>
        </header>
        <Lead agency={agency} />
      </main>
    );
  else content = <Home agency={agency} onOpen={open} />;
  return (
    <div
      className={`app theme-${theme} ${theme === "lavella" ? "theme-v2-lavella lavella-commerce" : ""}`}
      style={
        {
          "--brand": agency.branding.primaryColor,
          "--accent": agency.branding.accentColor,
        } as React.CSSProperties
      }
    >
      <DemoBar tenant={agency} theme={theme} admin={admin} onChange={change} />
      {!admin && <Header agency={agency} cartCount={cart.length} />} {content}
      {!admin && <Footer agency={agency} />}
    </div>
  );
}
