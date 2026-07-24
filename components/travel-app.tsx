"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { agencies, departurePoints, destinations, travels } from "@/data/demo";
import { filterCatalog, type CatalogFilters } from "@/lib/catalog";
import { formatMoney, priceLine } from "@/lib/pricing";
import { resolveTenant, resolveTheme } from "@/lib/tenancy";
import { whatsappUrl } from "@/lib/whatsapp";
import type {
  Agency,
  CartLine,
  TravelProduct,
  TravelTheme,
} from "@/types";
import { TravelApp as LegacyTravelApp } from "./legacy-travel-app";

type OpenTrip = (trip: TravelProduct) => void;
type HeaderProps = { agency: Agency; cartCount: number; onNavigate: (path: string) => void };
type HomeProps = { agency: Agency; trips: TravelProduct[]; onOpen: OpenTrip; onNavigate: (path: string) => void };
type CardProps = { trip: TravelProduct; onOpen: OpenTrip };
type FooterProps = { agency: Agency; onNavigate: (path: string) => void };
type ThemeComponents = {
  Header: ComponentType<HeaderProps>;
  Home: ComponentType<HomeProps>;
  Card: ComponentType<CardProps>;
  Footer: ComponentType<FooterProps>;
};

const heroImages: Record<TravelTheme, string> = {
  explorer: "/images/explorer-hero.webp",
  boutique: "/images/boutique-hero.webp",
  marketplace: "/images/marketplace-hero.webp",
};
const navItems = ["Viajes", "Destinos", "Promociones", "Nosotros", "Contacto"];
const currentPath = () => (typeof window === "undefined" ? "/" : window.location.pathname);
const currentParams = () =>
  typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
const dateLabel = (date: string, long = false) =>
  new Date(date).toLocaleDateString("es-MX", long ? { day: "numeric", month: "long", year: "numeric" } : { day: "2-digit", month: "short" });
const travelUrl = (trip: TravelProduct) => `/viajes/${trip.slug}`;
const available = (trip: TravelProduct) =>
  trip.departures.find((departure) => departure.saleStatus !== "sold_out" && departure.availableSpaces > 0) ??
  trip.departures[0];

function Logo({ agency, light = false }: { agency: Agency; light?: boolean }) {
  return (
    <span className={`v2-logo ${light ? "is-light" : ""}`}>
      <span className="v2-logo-symbol">F</span>
      <span>
        {agency.branding.logoText}
        <small>{agency.theme === "marketplace" ? "VIAJES Y CIRCUITOS" : "TRAVEL STUDIO"}</small>
      </span>
    </span>
  );
}

function ExplorerHeader({ agency, cartCount, onNavigate }: HeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="explorer-header">
      <button onClick={() => onNavigate("/")} aria-label="Inicio"><Logo agency={agency} light /></button>
      <nav className={open ? "is-open" : ""} aria-label="Navegación Explorer">
        {navItems.slice(0, 4).map((item) => (
          <button key={item} onClick={() => onNavigate(`/${item.toLowerCase()}`)}>{item}</button>
        ))}
      </nav>
      <div className="explorer-header-actions">
        <a href={`https://wa.me/${agency.contact.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <button className="outline-cta" onClick={() => onNavigate("/viajes")}>Explorar viajes ↗</button>
        <button className="v2-cart" onClick={() => onNavigate("/carrito")} aria-label={`Carrito, ${cartCount} viajes`}>Bag <b>{cartCount}</b></button>
        <button className="v2-menu" onClick={() => setOpen(!open)} aria-expanded={open}>Menu</button>
      </div>
    </header>
  );
}

function BoutiqueHeader({ agency, cartCount, onNavigate }: HeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="boutique-header">
      <div className="boutique-mini">DISEÑO DE VIAJES · CIUDAD DE MÉXICO</div>
      <div className="boutique-nav">
        <button className="v2-menu boutique-menu" onClick={() => setOpen(!open)} aria-expanded={open}>Menú</button>
        <nav className={open ? "is-open" : ""} aria-label="Navegación Boutique">
          {["Viajes", "Destinos", "Nosotros"].map((item) => (
            <button key={item} onClick={() => onNavigate(`/${item.toLowerCase()}`)}>{item}</button>
          ))}
        </nav>
        <button onClick={() => onNavigate("/")} aria-label="Inicio"><Logo agency={agency} /></button>
        <div className="boutique-actions">
          <button onClick={() => onNavigate("/contacto")}>Concierge</button>
          <button onClick={() => onNavigate("/carrito")} aria-label={`Carrito, ${cartCount} viajes`}>Reserva ({cartCount})</button>
        </div>
      </div>
    </header>
  );
}

function MarketplaceHeader({ agency, cartCount, onNavigate }: HeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="market-topbar">
        <span>Atención demo: {agency.contact.email}</span>
        <span>Moneda: MXN / USD</span>
        <span>Salidas desde CDMX · GDL · MTY</span>
      </div>
      <header className="market-header">
        <button onClick={() => onNavigate("/")} aria-label="Inicio"><Logo agency={agency} /></button>
        <label className="market-header-search">
          <span>Buscar</span>
          <input placeholder="Destino, código o ciudad" onKeyDown={(event) => event.key === "Enter" && onNavigate(`/viajes?q=${encodeURIComponent(event.currentTarget.value)}`)} />
        </label>
        <a className="market-phone" href={`https://wa.me/${agency.contact.whatsapp}`} target="_blank" rel="noreferrer"><small>RESERVAS Y DUDAS</small>55 0000 0202</a>
        <button className="market-cart" onClick={() => onNavigate("/carrito")}>Mi viaje <b>{cartCount}</b></button>
        <button className="v2-menu" onClick={() => setOpen(!open)} aria-expanded={open}>Menú</button>
      </header>
      <nav className={`market-nav ${open ? "is-open" : ""}`} aria-label="Categorías Marketplace">
        {["Destinos", "Circuitos", "Playa", "Internacional", "Experiencias", "Promociones"].map((item) => (
          <button key={item} onClick={() => onNavigate(item === "Promociones" ? "/promociones" : `/viajes?categoria=${item.toLowerCase()}`)}>{item}</button>
        ))}
        <button className="market-book" onClick={() => onNavigate("/viajes")}>Cotizar un viaje</button>
      </nav>
    </>
  );
}

function ExplorerCard({ trip, onOpen }: CardProps) {
  const departure = available(trip);
  return (
    <article className="explorer-card">
      <Image src={trip.featuredImage} alt="" fill sizes="(max-width: 720px) 100vw, 40vw" />
      <div className="explorer-card-shade" />
      <div className="explorer-card-top">
        {trip.promotion && <span>{trip.promotion}</span>}
        <small>{trip.durationDays} DÍAS · {trip.transportTypes[0]}</small>
      </div>
      <button className="explorer-card-body" onClick={() => onOpen(trip)}>
        <span>{trip.cities[0]} · {trip.countries[0]}</span>
        <h3>{trip.title}</h3>
        <div>
          <b>{formatMoney(trip.basePrice.amount, trip.basePrice.currency)}</b>
          <small>{dateLabel(departure.startDate)} · {departure.availableSpaces} lugares</small>
        </div>
      </button>
    </article>
  );
}

function BoutiqueCard({ trip, onOpen }: CardProps) {
  return (
    <article className="boutique-card">
      <button className="boutique-card-image" onClick={() => onOpen(trip)}>
        <Image src={trip.featuredImage} alt="" fill sizes="(max-width: 720px) 100vw, 33vw" />
      </button>
      <div className="boutique-card-copy">
        <span>{trip.countries[0]} · {trip.durationDays} días</span>
        <h3>{trip.title}</h3>
        <p>{trip.summary}</p>
        <div><small>Desde {formatMoney(trip.basePrice.amount, trip.basePrice.currency)}</small><button onClick={() => onOpen(trip)}>Descubrir →</button></div>
      </div>
    </article>
  );
}

function MarketplaceCard({ trip, onOpen }: CardProps) {
  const departure = available(trip);
  return (
    <article className="market-card">
      <div className="market-card-image">
        <Image src={trip.featuredImage} alt="" fill sizes="(max-width: 720px) 100vw, 24vw" />
        {trip.promotion && <span>{trip.promotion}</span>}
      </div>
      <div className="market-card-main">
        <div className="market-card-code">{trip.code} · {trip.scope === "national" ? "NACIONAL" : "INTERNACIONAL"}</div>
        <h3>{trip.title}</h3>
        <p><b>{trip.countries.join(", ")}</b><br />{trip.cities.slice(0, 3).join(" · ")}</p>
        <div className="market-tags"><span>{trip.durationDays}d / {trip.durationNights}n</span><span>{trip.transportTypes[0]}</span><span>{trip.departures.length} salidas</span></div>
      </div>
      <div className="market-card-price">
        <small>Próxima: {dateLabel(departure.startDate)}</small>
        <span>Desde</span>
        <strong>{formatMoney(trip.basePrice.amount, trip.basePrice.currency)}</strong>
        {!trip.basePrice.taxesIncluded && <small>+ {formatMoney(trip.basePrice.taxesAmount ?? 0, trip.basePrice.currency)} imp.</small>}
        <small>Anticipo {formatMoney(trip.basePrice.depositAmount ?? 0, trip.basePrice.currency)}</small>
        <b className={departure.availableSpaces < 6 ? "is-limited" : ""}>{departure.availableSpaces} lugares</b>
        <button onClick={() => onOpen(trip)}>Ver programa</button>
      </div>
    </article>
  );
}

function ExplorerSearch({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [destination, setDestination] = useState("");
  return (
    <form className="explorer-search" onSubmit={(event) => { event.preventDefault(); onNavigate(`/viajes?q=${encodeURIComponent(destination)}`); }}>
      <label><span>Destino</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="¿A dónde quieres escapar?" /></label>
      <label><span>Tipo de aventura</span><select><option>Explorar todo</option><option>Fin de semana</option><option>Playa</option><option>Montaña</option></select></label>
      <label><span>Próxima salida</span><select><option>Agosto — octubre</option><option>Noviembre</option><option>Diciembre</option></select></label>
      <button>Buscar rutas ↗</button>
    </form>
  );
}

function BoutiqueSearch({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="boutique-search">
      <span>ENCUENTRA TU PRÓXIMA HISTORIA</span>
      <button onClick={() => onNavigate("/viajes")}>Destino <b>Cualquier lugar</b></button>
      <button onClick={() => onNavigate("/viajes")}>Momento <b>Cuando estés listo</b></button>
      <button onClick={() => onNavigate("/viajes")}>Intención <b>Celebrar y descubrir</b></button>
      <button className="boutique-search-go" onClick={() => onNavigate("/viajes")}>Explorar colección</button>
    </div>
  );
}

function MarketplaceSearch({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [destination, setDestination] = useState("");
  return (
    <form className="market-search" onSubmit={(event) => { event.preventDefault(); onNavigate(`/viajes?q=${encodeURIComponent(destination)}`); }}>
      <div className="market-search-tabs"><b>Paquetes y circuitos</b><span>Excursiones</span><span>Experiencias</span></div>
      <div className="market-search-fields">
        <label>Destino<input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="País, ciudad o región" /></label>
        <label>Tipo de viaje<select><option>Todos los tipos</option><option>Circuito</option><option>Playa</option><option>Tour</option></select></label>
        <label>Mes<select><option>Cualquier mes</option><option>Agosto 2026</option><option>Septiembre 2026</option><option>Octubre 2026</option></select></label>
        <label>Duración<select><option>Cualquier duración</option><option>1–4 días</option><option>5–9 días</option><option>10+ días</option></select></label>
        <label>Origen<select><option>CDMX · todos</option><option>Oceanía</option><option>Naucalpan</option><option>Guelatao</option></select></label>
        <button>Buscar viajes</button>
      </div>
    </form>
  );
}

function ExplorerHome({ agency, trips, onOpen, onNavigate }: HomeProps) {
  const places = destinations.filter((item) => item.agencyId === agency.id).slice(0, 5);
  return (
    <main className="explorer-home">
      <section className="explorer-hero">
        <Image src={heroImages.explorer} alt="" fill priority sizes="100vw" />
        <div className="explorer-hero-grain" />
        <div className="explorer-hero-copy">
          <span className="explorer-kicker">RUTA 01 · MÉXICO PROFUNDO</span>
          <h1>Donde termina<br />el mapa, <em>empieza</em><br />la historia.</h1>
          <p>{agency.branding.heroDescription}</p>
          <div><button onClick={() => onNavigate("/viajes")}>Explorar viajes</button><a href={`https://wa.me/${agency.contact.whatsapp}`} target="_blank" rel="noreferrer">Consultar por WhatsApp ↗</a></div>
        </div>
        <div className="explorer-hero-index"><b>01</b><span>04</span><i /></div>
        <ExplorerSearch onNavigate={onNavigate} />
      </section>
      <section className="explorer-destinations">
        <header><span>COORDENADAS FAVORITAS</span><h2>Destinos que piden<br />un poco más de ti.</h2><p>Rutas elegidas por su paisaje, su carácter y la historia que cuentan cuando cae el sol.</p></header>
        <div className="explorer-mosaic">
          {places.map((place, index) => (
            <button key={place.id} className={`mosaic-${index + 1}`} onClick={() => onNavigate(`/viajes?q=${encodeURIComponent(place.name)}`)}>
              <Image src={place.featuredImage} alt="" fill sizes="50vw" />
              <span><small>0{index + 1}</small><b>{place.name}</b><em>{place.country}</em></span>
            </button>
          ))}
        </div>
      </section>
      <section className="explorer-featured">
        <header><span>VIAJES PARA SALIR DE LO CONOCIDO</span><h2>Próximas expediciones</h2><button onClick={() => onNavigate("/viajes")}>Ver calendario completo →</button></header>
        <div className="explorer-card-grid">{trips.slice(0, 4).map((trip) => <ExplorerCard key={trip.id} trip={trip} onOpen={onOpen} />)}</div>
      </section>
      <section className="explorer-benefits">
        <div><span>01</span><h3>Salidas claras</h3><p>Fecha, hora y punto de abordaje sin letras pequeñas.</p></div>
        <div><span>02</span><h3>Grupo acompañado</h3><p>Coordinación humana antes y durante cada ruta.</p></div>
        <div><span>03</span><h3>Precio honesto</h3><p>Anticipo, impuestos y saldo visibles desde el inicio.</p></div>
      </section>
      <blockquote className="explorer-quote">“No coleccionamos destinos.<br /><em>Coleccionamos el momento exacto</em><br />en que algo cambia.”<cite>— Diario de ruta Furiver</cite></blockquote>
      <section className="explorer-final" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,14,18,.92),rgba(8,14,18,.25)),url(${trips[3].featuredImage})` }}><span>LA CARRETERA ESTÁ LISTA</span><h2>Tu siguiente historia<br />sale este fin de semana.</h2><button onClick={() => onNavigate("/viajes")}>Ver próximas salidas ↗</button></section>
    </main>
  );
}

function BoutiqueHome({ agency, trips, onOpen, onNavigate }: HomeProps) {
  const curated = trips.slice(0, 4);
  return (
    <main className="boutique-home">
      <section className="boutique-hero">
        <div className="boutique-hero-copy"><span>MAISON VOYAGE · EST. 2026</span><h1>El arte<br />de viajar<br /><em>despacio.</em></h1><p>{agency.branding.heroDescription}</p><button onClick={() => onNavigate("/viajes")}>Comenzar una conversación</button></div>
        <div className="boutique-hero-image"><Image src={heroImages.boutique} alt="" fill priority sizes="60vw" /><span>01 — MEDITERRÁNEO</span></div>
        <blockquote>“Cada viaje comienza con una pregunta: ¿cómo quieres recordarlo?”</blockquote>
      </section>
      <BoutiqueSearch onNavigate={onNavigate} />
      <section className="boutique-intro"><span>NUESTRA MIRADA</span><h2>No vendemos itinerarios.<br />Diseñamos <em>formas de estar</em><br />en el mundo.</h2><p>Tiempo, sensibilidad y conocimiento local. Curamos cada experiencia para que tenga ritmo propio.</p></section>
      <section className="boutique-collection">
        <header><span>COLECCIÓN 2026</span><h2>Viajes elegidos<br />con intención</h2><button onClick={() => onNavigate("/viajes")}>Ver toda la colección →</button></header>
        <div>{curated.map((trip) => <BoutiqueCard key={trip.id} trip={trip} onOpen={onOpen} />)}</div>
      </section>
      <section className="boutique-story">
        <div className="boutique-story-image"><Image src={trips[4]?.featuredImage ?? trips[0].featuredImage} alt="" fill sizes="50vw" /></div>
        <div><span>NUESTRA HISTORIA</span><h2>Viajar bien es saber qué dejar fuera.</h2><p>Menos traslados apresurados. Más conversaciones, sobremesas y lugares donde quedarse un poco más.</p><div className="boutique-signature">Maison Voyage</div><button onClick={() => onNavigate("/nosotros")}>Conocer nuestra filosofía</button></div>
      </section>
      <section className="boutique-editorial">
        <span>EL VIAJE DEL MES</span><h2>{trips[0].title}</h2><p>{trips[0].description}</p><button onClick={() => onOpen(trips[0])}>Leer la historia completa →</button>
      </section>
      <section className="boutique-journal"><header><span>NOTAS DE VIAJE</span><h2>Para inspirar la próxima partida</h2></header><div>{["La belleza de llegar sin prisa","Cinco mesas frente al mar","Qué llevar cuando viajas ligero"].map((title, index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>Una breve mirada editorial para imaginar el viaje antes de partir.</p><button>Leer nota →</button></article>)}</div></section>
      <section className="boutique-final"><span>UN VIAJE HECHO PARA TI</span><h2>Cuéntanos qué estás celebrando.</h2><p>Diseñaremos una propuesta personal, sin fórmulas ni itinerarios prefabricados.</p><button onClick={() => onNavigate("/contacto")}>Hablar con concierge</button></section>
    </main>
  );
}

function MarketplaceHome({ agency, trips, onOpen, onNavigate }: HomeProps) {
  const featured = trips[0];
  return (
    <main className="market-home">
      <section className="market-hero">
        <Image src={heroImages.marketplace} alt="" fill priority sizes="100vw" />
        <div className="market-hero-shade" />
        <div className="market-hero-copy"><span>MÁS DE {trips.length} PROGRAMAS DISPONIBLES</span><h1>Encuentra el viaje<br />que sí cabe en tus planes.</h1><p>Compara fechas, rutas, impuestos y lugares disponibles antes de reservar.</p></div>
        <MarketplaceSearch onNavigate={onNavigate} />
      </section>
      <section className="market-categories">
        {[
          ["◉","Tours","Un día"],
          ["⌁","Circuitos","Multi-destino"],
          ["≈","Playa","Todo incluido"],
          ["✈","Internacional","8 regiones"],
          ["◇","Experiencias","Especiales"],
          ["✦","A tu medida","Personalizados"],
        ].map(([icon, name, detail]) => <button key={name} onClick={() => onNavigate(`/viajes?categoria=${name.toLowerCase()}`)}><i>{icon}</i><b>{name}</b><small>{detail}</small></button>)}
      </section>
      <section className="market-feature">
        <div className="market-feature-image"><Image src={featured.featuredImage} alt="" fill sizes="50vw" /><span>VIAJE DESTACADO</span></div>
        <div><small>{featured.code} · {featured.countries.join(", ")}</small><h2>{featured.title}</h2><p>{featured.description}</p><div className="market-feature-facts"><span><b>{featured.durationDays}</b>días</span><span><b>{featured.cities.length}</b>ciudades</span><span><b>{featured.departures.length}</b>salidas</span></div><strong>{formatMoney(featured.basePrice.amount, featured.basePrice.currency)}</strong><small>+ impuestos cuando aplique</small><button onClick={() => onOpen(featured)}>Ver programa y fechas</button></div>
      </section>
      <section className="market-offers"><header><div><span>OFERTAS ACTIVAS</span><h2>Viajes con beneficio especial</h2></div><button onClick={() => onNavigate("/promociones")}>Ver todas las ofertas →</button></header><div className="market-home-grid">{trips.filter((trip) => trip.promotion).slice(0, 6).map((trip) => <MarketplaceCard key={trip.id} trip={trip} onOpen={onOpen} />)}</div></section>
      <section className="market-departures"><header><span>CALENDARIO COMERCIAL</span><h2>Próximas salidas</h2></header>{trips.slice(0, 8).map((trip) => { const departure = available(trip); return <button key={trip.id} onClick={() => onOpen(trip)}><time>{dateLabel(departure.startDate)}</time><span><b>{trip.title}</b><small>{trip.cities.slice(0, 2).join(" · ")}</small></span><em>{departure.availableSpaces < 6 ? "Limitada" : "Disponible"}</em><strong>{formatMoney(trip.basePrice.amount, trip.basePrice.currency)}</strong><i>→</i></button>; })}</section>
      <section className="market-why"><div><span>FU TRAVEL OS DEMO</span><h2>Compra informada,<br />operación acompañada.</h2></div>{["Precios desglosados","Fechas estructuradas","Abordajes confirmados","Atención por WhatsApp"].map((item, index) => <article key={item}><b>0{index + 1}</b><h3>{item}</h3><p>Información visible y verificable durante todo el proceso.</p></article>)}</section>
    </main>
  );
}

function ExplorerFooter({ agency, onNavigate }: FooterProps) {
  return <footer className="explorer-footer"><Logo agency={agency} light /><h2>La ruta sigue.</h2><div>{navItems.map((item) => <button key={item} onClick={() => onNavigate(`/${item.toLowerCase()}`)}>{item}</button>)}</div><p>{agency.contact.email} · WhatsApp {agency.contact.whatsapp}</p><small>© 2026 · EXPERIENCIAS DEMO · SIN PAGOS REALES</small></footer>;
}
function BoutiqueFooter({ agency, onNavigate }: FooterProps) {
  return <footer className="boutique-footer"><span>MAISON VOYAGE</span><h2>El mundo, bien mirado.</h2><div><nav>{navItems.slice(0, 4).map((item) => <button key={item} onClick={() => onNavigate(`/${item.toLowerCase()}`)}>{item}</button>)}</nav><p>Concierge<br />{agency.contact.email}<br />{agency.contact.whatsapp}</p></div><small>Ciudad de México · Viajes diseñados individualmente · Demo 2026</small></footer>;
}
function MarketplaceFooter({ agency, onNavigate }: FooterProps) {
  return <footer className="market-footer"><div><Logo agency={agency} light /><p>Catálogo nacional e internacional con información clara para comparar y reservar.</p></div>{[["Explora",["Nacionales","Internacionales","Playa","Circuitos"]],["Ayuda",["Cómo reservar","Formas de pago","Políticas","Contacto"]],["Agencia",["Nosotros","Puntos de salida","Promociones","WhatsApp"]]].map(([title, items]) => <nav key={title as string}><b>{title}</b>{(items as string[]).map((item) => <button key={item} onClick={() => onNavigate("/viajes")}>{item}</button>)}</nav>)}<section><b>Recibe nuevas salidas</b><input placeholder="tu@correo.com" /><button>Suscribirme</button></section><small>© 2026 {agency.name} · Datos y pagos simulados · No indexable</small></footer>;
}

const themeRegistry: Record<TravelTheme, ThemeComponents> = {
  explorer: { Header: ExplorerHeader, Home: ExplorerHome, Card: ExplorerCard, Footer: ExplorerFooter },
  boutique: { Header: BoutiqueHeader, Home: BoutiqueHome, Card: BoutiqueCard, Footer: BoutiqueFooter },
  marketplace: { Header: MarketplaceHeader, Home: MarketplaceHome, Card: MarketplaceCard, Footer: MarketplaceFooter },
};

function DemoControls({ agency, theme, onChange }: { agency: Agency; theme: TravelTheme; onChange: (key: string, value: string) => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <aside className="demo-controls" data-testid="demo-controls">
      <header><span><b>FU TRAVEL OS</b>Demo studio</span><button onClick={() => setOpen(false)}>Ocultar ×</button></header>
      <label>Agencia<select value={agency.slug} onChange={(event) => onChange("tenant", event.target.value)}>{agencies.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
      <label>Tema<select value={theme} onChange={(event) => onChange("theme", event.target.value)}><option value="explorer">Explorer</option><option value="boutique">Boutique</option><option value="marketplace">Marketplace</option></select></label>
      <label>Vista<select defaultValue="public" onChange={(event) => onChange("view", event.target.value)}><option value="public">Sitio público</option><option value="admin">Administración</option></select></label>
    </aside>
  );
}

function SharedCatalog({ agency, theme, Card, onOpen }: { agency: Agency; theme: TravelTheme; Card: ComponentType<CardProps>; onOpen: OpenTrip }) {
  const query = currentParams().get("q") ?? "";
  const [filters, setFilters] = useState<CatalogFilters>({ q: query, sort: "next" });
  const [table, setTable] = useState(theme === "marketplace");
  const [mobileFilters, setMobileFilters] = useState(false);
  const own = travels.filter((trip) => trip.agencyId === agency.id);
  const results = filterCatalog(own, filters);
  const update = (key: keyof CatalogFilters, value: string | boolean) => setFilters((current) => ({ ...current, [key]: value }));
  const counts = {
    national: own.filter((trip) => trip.scope === "national").length,
    international: own.filter((trip) => trip.scope === "international").length,
    usd: own.filter((trip) => trip.basePrice.currency === "USD").length,
  };
  return (
    <main className={`v2-catalog ${theme}-catalog`}>
      <header className="v2-catalog-hero">
        {theme !== "boutique" && <Image src={theme === "explorer" ? heroImages.explorer : heroImages.marketplace} alt="" fill priority sizes="100vw" />}
        <div><span>{theme === "marketplace" ? "CATÁLOGO DE PROGRAMAS" : "COLECCIÓN DE VIAJES"}</span><h1>{theme === "explorer" ? "Elige tu próxima coordenada." : theme === "boutique" ? "Una colección para viajar distinto." : `${results.length} viajes para comparar`}</h1><p>{theme === "marketplace" ? "Precios, impuestos, ciudades, fechas y disponibilidad en un solo lugar." : "Filtra sin perder la inspiración."}</p></div>
      </header>
      {theme === "boutique" && (
        <div className="boutique-filter-strip">
          <label>Buscar<input value={String(filters.q ?? "")} onChange={(event) => update("q", event.target.value)} placeholder="Destino o experiencia" /></label>
          <label>Alcance<select value={String(filters.scope ?? "")} onChange={(event) => update("scope", event.target.value)}><option value="">Todo el mundo</option><option value="national">México</option><option value="international">Internacional</option></select></label>
          <label>Orden<select value={String(filters.sort)} onChange={(event) => update("sort", event.target.value)}><option value="next">Próxima salida</option><option value="price-asc">Precio ascendente</option><option value="duration">Duración</option></select></label>
          <button onClick={() => setFilters({ sort: "next" })}>Restablecer</button>
        </div>
      )}
      <div className="v2-catalog-layout">
        {theme !== "boutique" && (
          <aside className={`v2-filters ${mobileFilters ? "is-open" : ""}`}>
            <header><h2>Filtrar resultados</h2><button onClick={() => setMobileFilters(false)}>Cerrar</button></header>
            <label>Palabra clave<input value={String(filters.q ?? "")} onChange={(event) => update("q", event.target.value)} placeholder="Destino, ciudad, código" /></label>
            <fieldset><legend>Alcance</legend><label><input type="radio" name="scope" checked={!filters.scope} onChange={() => update("scope", "")} /> Todos <b>{own.length}</b></label><label><input type="radio" name="scope" checked={filters.scope === "national"} onChange={() => update("scope", "national")} /> Nacional <b>{counts.national}</b></label><label><input type="radio" name="scope" checked={filters.scope === "international"} onChange={() => update("scope", "international")} /> Internacional <b>{counts.international}</b></label></fieldset>
            <label>Región<select value={String(filters.region ?? "")} onChange={(event) => update("region", event.target.value)}><option value="">Todas</option><option value="mexico">México</option><option value="europe">Europa</option><option value="south_america">Sudamérica</option><option value="asia">Asia</option><option value="central_america_caribbean">Caribe</option></select></label>
            <label>Transporte<select value={String(filters.transport ?? "")} onChange={(event) => update("transport", event.target.value)}><option value="">Todos</option><option value="ground">Terrestre</option><option value="air">Aéreo</option><option value="cruise">Crucero</option><option value="mixed">Mixto</option></select></label>
            <label>Moneda<select value={String(filters.currency ?? "")} onChange={(event) => update("currency", event.target.value)}><option value="">MXN y USD</option><option value="MXN">MXN ({own.length - counts.usd})</option><option value="USD">USD ({counts.usd})</option></select></label>
            {theme === "marketplace" && <><label>País<select><option>Todos los países</option>{[...new Set(own.flatMap((trip) => trip.countries))].map((country) => <option key={country}>{country}</option>)}</select></label><label>Ciudad<select><option>Todas las ciudades</option>{[...new Set(own.flatMap((trip) => trip.cities))].slice(0, 14).map((city) => <option key={city}>{city}</option>)}</select></label><label>Tipo de salida<select><option>Bloqueo y regular</option><option>Salida terrestre</option><option>Salida aérea</option></select></label><label>Mes<select><option>Todos los meses</option><option>Agosto 2026</option><option>Septiembre 2026</option><option>Octubre 2026</option></select></label><label>Duración<select><option>Cualquier duración</option><option>1–4 días</option><option>5–9 días</option><option>10+ días</option></select></label><label>Origen<select><option>Todos los orígenes</option><option>Oceanía</option><option>Naucalpan</option><option>Guelatao</option></select></label><label className="filter-check"><input type="checkbox" checked={Boolean(filters.promotion)} onChange={(event) => update("promotion", event.target.checked)} /> Solo promociones</label><label className="filter-check"><input type="checkbox" checked={Boolean(filters.availability)} onChange={(event) => update("availability", event.target.checked)} /> Con disponibilidad</label></>}
            <button className="clear-filters" onClick={() => setFilters({ sort: "next" })}>Limpiar todos los filtros</button>
          </aside>
        )}
        <section className="v2-results">
          <div className="v2-results-toolbar">
            <button className="mobile-filter-button" onClick={() => setMobileFilters(true)}>Filtros <b>{results.length}</b></button>
            <span><b>{results.length}</b> programas encontrados</span>
            {theme === "marketplace" && <div className="view-toggle"><button className={!table ? "active" : ""} onClick={() => setTable(false)}>Tarjetas</button><button className={table ? "active" : ""} onClick={() => setTable(true)}>Tabla</button></div>}
            <label>Ordenar por<select value={String(filters.sort)} onChange={(event) => update("sort", event.target.value)}><option value="next">Más relevantes</option><option value="price-asc">Precio: menor a mayor</option><option value="price-desc">Precio: mayor a menor</option><option value="duration">Duración</option></select></label>
          </div>
          {results.length === 0 ? <div className="v2-empty"><h2>No encontramos una ruta así.</h2><p>Prueba con menos filtros o restablece la búsqueda.</p><button onClick={() => setFilters({ sort: "next" })}>Limpiar filtros</button></div> : table && theme === "marketplace" ? <MarketplaceTable trips={results} onOpen={onOpen} /> : <div className={`v2-card-grid ${theme}-results-grid`}>{results.map((trip) => <Card key={trip.id} trip={trip} onOpen={onOpen} />)}</div>}
        </section>
      </div>
    </main>
  );
}

function MarketplaceTable({ trips, onOpen }: { trips: TravelProduct[]; onOpen: OpenTrip }) {
  return (
    <div className="market-table">
      <div className="market-table-head"><span>Código / programa</span><span>Duración</span><span>Países y ciudades</span><span>Próxima salida / origen</span><span>Precio</span><span>Disponibilidad</span></div>
      {trips.map((trip) => {
        const departure = available(trip);
        const point = departurePoints.find((item) => item.id === departure.boardingOptions[0]?.agencyDeparturePointId);
        return <article key={trip.id}><span><small>{trip.code}</small><button onClick={() => onOpen(trip)}>{trip.title}</button><em>{trip.promotion}</em></span><span><b>{trip.durationDays} días</b><small>{trip.durationNights} noches · {trip.transportTypes[0]}</small></span><span><b>{trip.countries.join(", ")}</b><small>{trip.cities.join(" · ")}</small></span><span><b>{dateLabel(departure.startDate, true)}</b><small>{point?.name ?? "Por confirmar"} · {trip.departures.length} fechas</small></span><span><b>{formatMoney(trip.basePrice.amount, trip.basePrice.currency)}</b><small>{trip.basePrice.taxesIncluded ? "Impuestos incluidos" : `+ ${formatMoney(trip.basePrice.taxesAmount ?? 0, trip.basePrice.currency)} imp.`}</small><small>Anticipo {formatMoney(trip.basePrice.depositAmount ?? 0, trip.basePrice.currency)}</small></span><span><b className={departure.availableSpaces < 6 ? "is-limited" : ""}>{departure.availableSpaces} lugares</b><button onClick={() => onOpen(trip)}>Ver programa →</button></span></article>;
      })}
    </div>
  );
}

function SharedBookingPanel({ agency, trip, theme }: { agency: Agency; trip: TravelProduct; theme: TravelTheme }) {
  const [departureId, setDepartureId] = useState(available(trip).id);
  const departure = trip.departures.find((item) => item.id === departureId)!;
  const validBoarding = departure.boardingOptions.filter((item) => item.status !== "sold_out" && item.status !== "disabled");
  const [boardingId, setBoardingId] = useState(validBoarding[0]?.id ?? "");
  const [travelers, setTravelers] = useState(2);
  const [rateId, setRateId] = useState(trip.pricingOptions[0].id);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const line: CartLine = { id: `line-${trip.id}`, agencyId: agency.id, travelId: trip.id, departureId, boardingOptionId: boardingId, pricingOptionId: rateId, travelers, extraIds };
  let priced: ReturnType<typeof priceLine> | undefined;
  try { priced = priceLine(line); } catch { priced = undefined; }
  const changeDeparture = (id: string) => {
    setDepartureId(id);
    const next = trip.departures.find((item) => item.id === id)?.boardingOptions.find((item) => item.status !== "sold_out" && item.status !== "disabled");
    setBoardingId(next?.id ?? "");
  };
  const add = () => {
    if (!priced) return;
    const existing = JSON.parse(localStorage.getItem("fu-travel-demo-cart") ?? "[]") as CartLine[];
    if (existing.length && existing[0].agencyId !== agency.id) { window.alert("El carrito pertenece a otra agencia."); return; }
    localStorage.setItem("fu-travel-demo-cart", JSON.stringify([...existing.filter((item) => item.id !== line.id), line]));
    window.location.assign(`/carrito${window.location.search}`);
  };
  return (
    <aside className={`v2-booking ${theme}-booking`}>
      <header><span>{theme === "boutique" ? "Tu propuesta" : "Reserva este viaje"}</span><small>{trip.code}</small><strong>{formatMoney(trip.basePrice.amount, trip.basePrice.currency)}</strong><em>por persona desde</em></header>
      <label>Salida programada<select value={departureId} onChange={(event) => changeDeparture(event.target.value)}>{trip.departures.map((item) => <option key={item.id} value={item.id} disabled={item.saleStatus === "sold_out"}>{dateLabel(item.startDate, true)} · {item.saleStatus === "sold_out" ? "Agotada" : `${item.availableSpaces} lugares`}</option>)}</select></label>
      <fieldset><legend>Punto de salida</legend>{validBoarding.map((option) => { const point = departurePoints.find((item) => item.id === option.agencyDeparturePointId)!; return <label className={boardingId === option.id ? "selected" : ""} key={option.id}><input type="radio" name="v2-boarding" checked={boardingId === option.id} onChange={() => setBoardingId(option.id)} /><span><b>{point.name}</b><small>{point.city} · {option.departureTime}</small><em>{option.surchargeAmount ? `+ ${formatMoney(option.surchargeAmount, option.currency ?? trip.basePrice.currency)}` : "Sin suplemento"}</em></span></label>; })}</fieldset>
      <div className="v2-booking-two"><label>Viajeros<input type="number" min="1" max={8} value={travelers} onChange={(event) => setTravelers(Number(event.target.value))} /></label><label>Tarifa<select value={rateId} onChange={(event) => setRateId(event.target.value)}>{trip.pricingOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
      <fieldset className="v2-extras"><legend>Experiencias adicionales</legend>{trip.extras.map((extra) => <label key={extra.id}><input type="checkbox" checked={extraIds.includes(extra.id)} onChange={() => setExtraIds((items) => items.includes(extra.id) ? items.filter((item) => item !== extra.id) : [...items, extra.id])} /><span>{extra.name}<b>{formatMoney(extra.price, extra.currency)}</b></span></label>)}</fieldset>
      {priced && <div className="v2-total"><span>Subtotal <b>{formatMoney(priced.subtotal, trip.basePrice.currency)}</b></span><span>Impuestos + abordaje <b>{formatMoney(priced.taxes + priced.surcharge, trip.basePrice.currency)}</b></span><strong>Total estimado <b>{formatMoney(priced.total, trip.basePrice.currency)}</b></strong><small>Anticipo desde {formatMoney(priced.deposit, trip.basePrice.currency)}</small></div>}
      <button className="v2-booking-add" disabled={!priced} onClick={add}>Agregar al carrito</button>
      {priced && <a href={whatsappUrl(agency, priced)} target="_blank" rel="noreferrer">Consultar por WhatsApp ↗</a>}
    </aside>
  );
}

function SharedDetail({ agency, trip, theme, onNavigate }: { agency: Agency; trip: TravelProduct; theme: TravelTheme; onNavigate: (path: string) => void }) {
  const departure = available(trip);
  return (
    <main className={`v2-detail ${theme}-detail`}>
      {theme === "explorer" && <section className="explorer-detail-hero"><Image src={trip.featuredImage} alt="" fill priority sizes="100vw" /><button onClick={() => onNavigate("/viajes")}>← Catálogo</button><div><span>{trip.code} · {trip.countries.join(", ")}</span><h1>{trip.title}</h1><p>{trip.subtitle}</p></div><aside><b>{trip.durationDays}</b><span>días de ruta</span></aside></section>}
      {theme === "boutique" && <section className="boutique-detail-hero"><button onClick={() => onNavigate("/viajes")}>← Volver a la colección</button><div><span>{trip.countries.join(" · ")}</span><h1>{trip.title}</h1><p>{trip.summary}</p><small>{trip.durationDays} días · desde {formatMoney(trip.basePrice.amount, trip.basePrice.currency)}</small></div><div className="boutique-detail-image"><Image src={trip.featuredImage} alt="" fill priority sizes="60vw" /></div></section>}
      {theme === "marketplace" && <><section className="market-detail-head"><button onClick={() => onNavigate("/viajes")}>← Resultados</button><div><span>{trip.code} · {trip.scope === "national" ? "Programa nacional" : "Programa internacional"}</span><h1>{trip.title}</h1><p>{trip.countries.join(", ")} · {trip.cities.join(" · ")}</p></div><div className="market-detail-price"><small>Desde</small><strong>{formatMoney(trip.basePrice.amount, trip.basePrice.currency)}</strong><span>{trip.basePrice.taxesIncluded ? "Impuestos incluidos" : `+ ${formatMoney(trip.basePrice.taxesAmount ?? 0, trip.basePrice.currency)} impuestos`}</span><button onClick={() => document.getElementById("reserva")?.scrollIntoView()}>Reservar</button></div></section><section className="market-detail-facts">{[[trip.code,"Código"],[`${trip.durationDays}d / ${trip.durationNights}n`,"Duración"],[trip.countries.length,"Países"],[trip.cities.length,"Ciudades"],[trip.transportTypes.join(", "),"Transporte"],[trip.departures.length,"Salidas"],[departure.availableSpaces,"Lugares"]].map(([value,label]) => <span key={label}><b>{value}</b><small>{label}</small></span>)}</section><nav className="market-detail-nav">{["Descripción","Itinerario","Tarifas","Fechas","Abordajes","Condiciones"].map((item) => <a key={item} href={`#${item.toLowerCase()}`}>{item}</a>)}</nav></>}
      <div className="v2-detail-layout">
        <article className="v2-detail-story">
          {theme !== "marketplace" && <div className="v2-detail-facts">{[[`${trip.durationDays} días`,"Duración"],[trip.countries.join(", "),"País"],[trip.transportTypes.join(", "),"Transporte"],[`${departure.availableSpaces} lugares`,"Disponibilidad"]].map(([value,label]) => <span key={label}><b>{value}</b><small>{label}</small></span>)}</div>}
          <section id="descripción"><span className="section-label">{theme === "boutique" ? "LA HISTORIA" : "LA EXPERIENCIA"}</span><h2>{theme === "explorer" ? "Una ruta para mirar más lejos." : theme === "boutique" ? "Cada día tiene su propio ritmo." : "Descripción del programa"}</h2><p>{trip.description}</p></section>
          <section id="itinerario"><span className="section-label">ITINERARIO</span><h2>{theme === "boutique" ? "El viaje, día a día" : "Ruta programada"}</h2>{trip.itinerary.map((day) => <details key={day.day} open={day.day === 1}><summary><b>{String(day.day).padStart(2, "0")}</b><span>{day.title}</span><i>+</i></summary><p>{day.description}</p></details>)}</section>
          <section id="tarifas" className="v2-rate-section"><span className="section-label">TARIFAS Y OCUPACIÓN</span>{trip.pricingOptions.map((rate) => <div key={rate.id}><span><b>{rate.label}</b><small>{rate.occupancy}</small></span><strong>{formatMoney(rate.amount, rate.currency)}</strong></div>)}</section>
          <section className="v2-includes"><div><h3>Incluye</h3>{trip.includes.map((item) => <p key={item}>✓ {item}</p>)}</div><div><h3>No incluye</h3>{trip.excludes.map((item) => <p key={item}>— {item}</p>)}</div></section>
          <section id="fechas" className="v2-date-list"><span className="section-label">FECHAS Y SALIDAS</span>{trip.departures.map((item) => <div key={item.id}><time>{dateLabel(item.startDate, true)}</time><span>{item.availableSpaces} / {item.capacity} lugares</span><b>{item.saleStatus.replace("_", " ")}</b></div>)}</section>
          <section id="condiciones"><span className="section-label">CONDICIONES</span><p>{trip.policies.cancellation}</p><p>{trip.policies.payment}</p><p>{trip.policies.responsibility}</p></section>
        </article>
        <div id="reserva"><SharedBookingPanel agency={agency} trip={trip} theme={theme} /></div>
      </div>
    </main>
  );
}

export function TravelApp({ hostname, initialTenant, initialTheme }: { hostname: string; initialTenant?: string; initialTheme?: string }) {
  const [route, setRoute] = useState(currentPath);
  const [version, setVersion] = useState(0);
  useEffect(() => { const sync = () => { setRoute(currentPath()); setVersion((value) => value + 1); }; sync(); addEventListener("popstate", sync); return () => removeEventListener("popstate", sync); }, []);
  const params = useMemo(() => { void version; return currentParams(); }, [version]);
  const agency = resolveTenant(hostname, params.get("tenant") ?? initialTenant);
  const theme = resolveTheme(agency, params.get("theme") ?? initialTheme);
  const ownTrips = travels.filter((trip) => trip.agencyId === agency.id);
  const cartCount = typeof window === "undefined" ? 0 : (() => { try { return (JSON.parse(localStorage.getItem("fu-travel-demo-cart") ?? "[]") as CartLine[]).length; } catch { return 0; } })();
  const navigate = (next: string) => {
    const separator = next.includes("?") ? "&" : "?";
    const demo = new URLSearchParams({ tenant: agency.slug, theme });
    window.history.pushState({}, "", `${next}${separator}${demo}`);
    setRoute(currentPath());
    setVersion((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changeDemo = (key: string, value: string) => {
    const next = currentParams();
    next.set(key, value);
    localStorage.setItem(`fu-travel-demo-${key}`, value);
    if (key === "view" && value === "admin") window.location.href = `/admin?${next}`;
    else { window.history.replaceState({}, "", `${route}?${next}`); setVersion((item) => item + 1); }
  };
  if (route.startsWith("/admin") || route.startsWith("/superadmin") || ["/carrito", "/checkout", "/confirmacion"].includes(route)) return <LegacyTravelApp hostname={hostname} />;
  const components = themeRegistry[theme];
  const trip = ownTrips.find((item) => route === travelUrl(item));
  const content = trip ? <SharedDetail agency={agency} trip={trip} theme={theme} onNavigate={navigate} /> : route === "/viajes" || route === "/promociones" ? <SharedCatalog agency={agency} theme={theme} Card={components.Card} onOpen={(item) => navigate(travelUrl(item))} /> : route === "/destinos" ? <SharedCatalog agency={agency} theme={theme} Card={components.Card} onOpen={(item) => navigate(travelUrl(item))} /> : <components.Home agency={agency} trips={ownTrips} onOpen={(item) => navigate(travelUrl(item))} onNavigate={navigate} />;
  return (
    <div className={`visual-v2 theme-v2-${theme}`} style={{ "--brand": agency.branding.primaryColor, "--accent": agency.branding.accentColor } as React.CSSProperties}>
      <components.Header agency={agency} cartCount={cartCount} onNavigate={navigate} />
      {content}
      <components.Footer agency={agency} onNavigate={navigate} />
      <DemoControls agency={agency} theme={theme} onChange={changeDemo} />
    </div>
  );
}
