"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { FaArrowLeft, FaArrowRight, FaSliders } from "react-icons/fa6";
import { filterCatalog, type CatalogFilters } from "@/lib/catalog";
import styles from "./lavella-catalog.module.css";
import { LavellaSearchBox } from "./lavella-search-box";
import { LavellaTourCard } from "./lavella-tour-card";
import type { LavellaCatalogProps } from "./lavella-types";
import { lavellaDate, lavellaDeparture } from "./lavella-utils";

export function LavellaCatalog({
  agency,
  trips,
  onOpen,
}: LavellaCatalogProps) {
  const [filters, setFilters] = useState<CatalogFilters>({ sort: "next" });
  const [mobileFilters, setMobileFilters] = useState(false);
  const results = useMemo(() => filterCatalog(trips, filters), [trips, filters]);
  const update = (key: keyof CatalogFilters, value: string | boolean) =>
    setFilters((current) => ({ ...current, [key]: value }));
  return (
    <main className={styles.catalog}>
      <section
        className={styles.catalogHero}
        style={{ backgroundImage: `url(${trips[0]?.featuredImage ?? agency.branding.heroImage})` }}
      >
        <div className={styles.heroShade} />
        <div className={styles.catalogHead}>
          <p>Inicio <span>/</span> Viajes</p>
          <h1>Buscar viajes</h1>
          <LavellaSearchBox
            compact
            onSearch={(query) =>
              setFilters((current) => ({ ...current, q: query }))
            }
          />
        </div>
        <div className={styles.catalogDestinations}>
          {trips.slice(0, 10).map((trip) => (
            <button key={trip.id} onClick={() => onOpen(trip)}>
              <Image src={trip.featuredImage} alt="" fill sizes="120px" />
              <span>{trip.cities[0] ?? trip.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.resultsArea}>
        <header>
          <div>
            <small>VIAJES DISPONIBLES</small>
            <h2>{results.length} rutas para descubrir</h2>
          </div>
          <div className={styles.resultsTools}>
            <button className={styles.mobileFilterButton} onClick={() => setMobileFilters(true)}>
              <FaSliders /> Filtros
            </button>
            <label>
              Ordenar
              <select value={String(filters.sort)} onChange={(event) => update("sort", event.target.value)}>
                <option value="next">Próxima salida</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
                <option value="duration">Duración</option>
              </select>
            </label>
          </div>
        </header>
        <div className={styles.resultsLayout}>
          <div className={styles.resultsList}>
            {results.map((trip) => {
              const departure = lavellaDeparture(trip);
              return (
                <div className={styles.listCard} key={trip.id}>
                  <LavellaTourCard trip={trip} onOpen={onOpen} />
                  <div className={styles.listMeta}>
                    <span><b>{lavellaDate(departure?.startDate, true)}</b><small>Próxima salida</small></span>
                    <span><b>{trip.transportTypes.join(" · ")}</b><small>Transporte</small></span>
                    <button onClick={() => onOpen(trip)}>Ver detalles <FaArrowRight /></button>
                  </div>
                </div>
              );
            })}
            {!results.length && (
              <div className={styles.empty}>
                <h3>No encontramos una ruta así.</h3>
                <p>Prueba con menos filtros.</p>
                <button onClick={() => setFilters({ sort: "next" })}>Restablecer</button>
              </div>
            )}
            <nav className={styles.pagination} aria-label="Paginación">
              <button aria-label="Página anterior"><FaArrowLeft /></button>
              <button className={styles.activePage}>1</button>
              <button>2</button>
              <button>3</button>
              <button aria-label="Página siguiente"><FaArrowRight /></button>
            </nav>
          </div>

          <aside className={`${styles.sidebar} ${mobileFilters ? styles.sidebarOpen : ""}`}>
            <header><h3>Filtrar viajes</h3><button onClick={() => setMobileFilters(false)}>Cerrar</button></header>
            <label>
              Palabra clave
              <input
                value={String(filters.q ?? "")}
                onChange={(event) => update("q", event.target.value)}
                placeholder="Destino o programa"
              />
            </label>
            <label>
              Alcance
              <select value={String(filters.scope ?? "")} onChange={(event) => update("scope", event.target.value)}>
                <option value="">Todos</option>
                <option value="national">Nacional</option>
                <option value="international">Internacional</option>
              </select>
            </label>
            <label>
              Región
              <select value={String(filters.region ?? "")} onChange={(event) => update("region", event.target.value)}>
                <option value="">Todas</option>
                <option value="mexico">México</option>
                <option value="europe">Europa</option>
                <option value="south_america">Sudamérica</option>
                <option value="asia">Asia</option>
              </select>
            </label>
            <label>
              Transporte
              <select value={String(filters.transport ?? "")} onChange={(event) => update("transport", event.target.value)}>
                <option value="">Todos</option>
                <option value="ground">Terrestre</option>
                <option value="air">Aéreo</option>
                <option value="train">Tren</option>
                <option value="mixed">Mixto</option>
              </select>
            </label>
            <label>
              Moneda
              <select value={String(filters.currency ?? "")} onChange={(event) => update("currency", event.target.value)}>
                <option value="">MXN y USD</option>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={Boolean(filters.promotion)}
                onChange={(event) => update("promotion", event.target.checked)}
              />
              Solo promociones
            </label>
            <button className={styles.clear} onClick={() => setFilters({ sort: "next" })}>
              Limpiar filtros
            </button>
            <div className={styles.sidebarHelp}>
              <small>¿NECESITAS AYUDA?</small>
              <h3>Encontramos la ruta contigo.</h3>
              <p>{agency.contact.email}</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
