"use client";
import { useEffect, useMemo, useState } from "react";
import { agencies, departurePoints, destinations, travels } from "@/data/demo";
import { filterCatalog } from "@/lib/catalog";
import {
  confirmBoardingPoint,
  formatMoney,
  priceLine,
  priceLinePending,
  validateCartRoomCapacity,
} from "@/lib/pricing";
import { resolveTenant, resolveTheme } from "@/lib/tenancy";
import {
  applyTravelerDataToLines,
  draftsFromLines,
  travelerFollowUpMessage,
  travelerWhatsAppSummary,
  validateTravelerDrafts,
} from "@/lib/travelers";
import { whatsappUrl } from "@/lib/whatsapp";
import type {
  Agency,
  CartLine,
  TravelerDataStatus,
  TravelerDraft,
  TravelProduct,
  TripSectionConfig,
  TravelTheme,
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
          <option value="boutique">Boutique</option>
          <option value="marketplace">Marketplace</option>
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
  theme,
  onOpen,
}: {
  agency: Agency;
  theme: TravelTheme;
  onOpen: (t: TravelProduct) => void;
}) {
  const own = travels.filter((t) => t.agencyId === agency.id);
  const stats =
    theme === "marketplace"
      ? ["12 países", "24 salidas", "2 monedas"]
      : ["12 años creando rutas", "4.9 de 5 viajeros", "Atención humana"];
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
          <h2>
            {theme === "boutique"
              ? "Historias para vivir despacio"
              : "Tu próxima historia comienza aquí"}
          </h2>
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
  onRemove,
  onCheckout,
}: {
  lines: CartLine[];
  agency: Agency;
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
  return (
    <main className="simple-page">
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
                  {agency.theme === "explorer" && (
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
            <span>Total antes de confirmar abordaje</span>
            <b>
              {formatMoney(total, items[0].estimate.travel.basePrice.currency)}
            </b>
            <button
              className="primary"
              disabled={Boolean(roomError)}
              onClick={onCheckout}
            >
              {roomError
                ? "Ajusta la cantidad de viajeros"
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
  onUpdate,
  error,
}: {
  lines: CartLine[];
  agency: Agency;
  onUpdate: (line: CartLine) => void;
  error: string;
}) {
  const groups = [
    ...new Map(
      lines.map((line) => [`${line.travelId}:${line.departureId}`, line]),
    ).values(),
  ];
  const [choices, setChoices] = useState<Record<string, string>>({});
  return (
    <section
      className={`checkout-boarding ${agency.theme === "explorer" ? "is-explorer" : ""}`}
      aria-labelledby="boarding-title"
    >
      <h2 id="boarding-title">Elige tu punto de abordaje</h2>
      <p>Debes seleccionar y confirmar un punto antes de continuar.</p>
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
        const selected = choices[key];
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
                ? "Esta salida tiene un punto disponible. Revísalo y confírmalo explícitamente."
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
                    onChange={() =>
                      setChoices((current) => ({
                        ...current,
                        [key]: option.id,
                      }))
                    }
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
            {options.length > 0 && (
              <button
                type="button"
                className="confirm-boarding"
                disabled={!selected}
                onClick={() => {
                  lines
                    .filter(
                      (line) =>
                        line.travelId === group.travelId &&
                        line.departureId === group.departureId,
                    )
                    .forEach((line) =>
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

function Checkout({
  lines,
  agency,
  onDone,
  onUpdate,
}: {
  lines: CartLine[];
  agency: Agency;
  onDone: () => void;
  onUpdate: (line: CartLine) => void;
}) {
  const [step, setStep] = useState(1);
  const [folio, setFolio] = useState("");
  const [error, setError] = useState("");
  const [travelerStatus, setTravelerStatus] = useState<TravelerDataStatus>(
    lines[0]?.travelerDataStatus ?? "complete",
  );
  const [travelerDrafts, setTravelerDrafts] = useState<TravelerDraft[]>(() =>
    draftsFromLines(lines),
  );
  let roomError = "";
  try {
    validateCartRoomCapacity(lines);
  } catch (capacityError) {
    roomError =
      capacityError instanceof Error
        ? capacityError.message
        : "La cantidad de viajeros excede la capacidad máxima de la habitación.";
  }
  const boardingComplete =
    lines.length > 0 &&
    !roomError &&
    lines.every((line) => Boolean(line.boardingOptionId));
  const estimates = lines
    .map((line) => {
      try {
        return line.boardingOptionId ? priceLine(line) : priceLinePending(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<
    ReturnType<typeof priceLine> | ReturnType<typeof priceLinePending>
  >;
  const priced = boardingComplete ? lines.map(priceLine) : [];
  const total = estimates.reduce((sum, item) => sum + item.total, 0);
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
        onRemove={() => {}}
        onCheckout={() => {}}
      />
    );
  const next = () => {
    if (roomError) {
      setError(roomError);
      return;
    }
    if (step === 3 && !boardingComplete) {
      setError(
        "Selecciona y confirma un punto de abordaje antes de continuar.",
      );
      return;
    }
    if (step === 3 && agency.theme === "explorer") {
      const validation = validateTravelerDrafts(travelerDrafts, travelerStatus);
      if (!validation.valid) {
        setError(
          "Escribe el nombre completo de cada viajero o elige Llenar después.",
        );
        return;
      }
    }
    setError("");
    if (step === 5) {
      setFolio(
        `FTO-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      );
      setStep(6);
      onDone();
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
  const firstPriced = priced[0];
  return (
    <main className="checkout">
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
        {step === 1 && (
          <>
            <h2>Revisa tu viaje</h2>
            {lines.map((line, index) => (
              <div className="summary-row" key={line.id}>
                <span>
                  {estimates[index].travel.title}
                  <small>
                    {line.boardingSnapshot
                      ? `${line.boardingSnapshot.pointName} · ${line.travelers} viajeros`
                      : `Punto pendiente · ${line.travelers} viajeros`}
                  </small>
                </span>
                <b>
                  {formatMoney(
                    estimates[index].total,
                    estimates[index].travel.basePrice.currency,
                  )}
                </b>
              </div>
            ))}
            <div className="summary-total">
              Total estimado{" "}
              <b>
                {formatMoney(total, estimates[0].travel.basePrice.currency)}
              </b>
            </div>
          </>
        )}
        {step === 2 && (
          <FormGrid
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
              onUpdate={onUpdate}
              error={roomError ? "" : error}
            />
            {agency.theme === "explorer" ? (
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
            <div className="choice-grid">
              {["Anticipo", "Pago total"].map((label) => (
                <label key={label}>
                  <input
                    type="radio"
                    name="paymentAmount"
                    defaultChecked={label === "Anticipo"}
                  />
                  <b>{label}</b>
                  <small>
                    {label === "Anticipo"
                      ? formatMoney(
                          priced.reduce((sum, item) => sum + item.deposit, 0),
                          priced[0].travel.basePrice.currency,
                        )
                      : formatMoney(total, priced[0].travel.basePrice.currency)}
                  </small>
                </label>
              ))}
            </div>
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
        {step === 6 && firstPriced && (
          <div className="confirmation">
            <span className="success">
              <Icon name="check" />
            </span>
            <div className="eyebrow">FOLIO DEMO</div>
            <h2>{folio}</h2>
            <p>Tu solicitud quedó confirmada en modo demostración.</p>
            <div>
              <span>
                Fecha{" "}
                <b>
                  {new Date(
                    firstPriced.travel.departures.find(
                      (item) => item.id === firstPriced.departureId,
                    )!.startDate,
                  ).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </b>
              </span>
              <span>
                Punto de abordaje <b>{firstPriced.boarding.pointName}</b>
              </span>
              <span>
                Hora de reunión <b>{firstPriced.boarding.meetingTime}</b>
              </span>
              <span>
                Dirección o referencia{" "}
                <b>
                  {firstPriced.boarding.reference ??
                    firstPriced.boarding.address}
                </b>
              </span>
              {firstPriced.boarding.instructions && (
                <span>
                  Instrucciones <b>{firstPriced.boarding.instructions}</b>
                </span>
              )}
              <span>
                Total{" "}
                <b>
                  {formatMoney(total, firstPriced.travel.basePrice.currency)}
                </b>
              </span>
              <span>
                Anticipo{" "}
                <b>
                  {formatMoney(
                    priced.reduce((sum, item) => sum + item.deposit, 0),
                    firstPriced.travel.basePrice.currency,
                  )}
                </b>
              </span>
            </div>
            {agency.theme === "explorer" &&
              (travelerStatus === "pending" ? (
                <div className="confirmation-travelers is-pending">
                  <h3>Datos de viajeros pendientes de completar</h3>
                  <p>
                    Un agente de {agency.name} podría ponerse en contacto contigo
                    para solicitar esta información.
                  </p>
                </div>
              ) : (
                <div className="confirmation-travelers">
                  <h3>Viajeros</h3>
                  {travelerDrafts.map((draft) => (
                    <p key={draft.id}>
                      <span>
                        {draft.category === "adult" ? "Adulto" : "Menor"}{" "}
                        {draft.sequence}
                      </span>
                      <b>{draft.fullName}</b>
                    </p>
                  ))}
                </div>
              ))}
            <a
              className="wa"
              href={whatsappUrl(
                agency,
                firstPriced,
                folio,
                agency.theme === "explorer"
                  ? {
                      status: travelerStatus,
                      drafts: travelerDrafts,
                      adults: adultCount,
                      minors: minorCount,
                      total,
                      deposit: priced.reduce(
                        (sum, item) => sum + item.deposit,
                        0,
                      ),
                    }
                  : undefined,
              )}
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
              disabled={Boolean(roomError)}
              onClick={next}
            >
              {roomError
                ? "Ajusta la cantidad de viajeros"
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
function FormGrid({ fields }: { fields: string[] }) {
  return (
    <div className="form-grid">
      {fields.map((f, i) => (
        <label key={f}>
          {f}
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
      {(["explorer", "boutique", "marketplace"] as const).map((t) => (
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
              : t === "boutique"
                ? "Editorial, elegante y enfocado en storytelling."
                : "Denso, comparable y optimizado para catálogo amplio."}
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
export function TravelApp({ hostname }: { hostname: string }) {
  const [route, setRoute] = useState("/");
  const [version, setVersion] = useState(0);
  const params = useMemo(() => qp(), [version]);
  const agency = resolveTenant(hostname, params.get("tenant"));
  const theme = resolveTheme(agency, params.get("theme"));
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
      if (line.boardingSnapshot)
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
                boarding: line.boardingSnapshot,
                total: priced.length
                  ? priced.reduce((sum, item) => sum + item.total, 0)
                  : draft.total,
                deposit: priced.length
                  ? priced.reduce((sum, item) => sum + item.deposit, 0)
                  : draft.deposit,
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
  else content = <Home agency={agency} theme={theme} onOpen={open} />;
  return (
    <div
      className={`app theme-${theme}`}
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
