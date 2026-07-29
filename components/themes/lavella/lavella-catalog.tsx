"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaArrowRight, FaSliders } from "react-icons/fa6";
import { filterCatalog, type CatalogFilters } from "@/lib/catalog";
import styles from "./lavella-catalog.module.css";
import {
  clearLavellaCatalogFilters,
  countLavellaActiveFilters,
} from "./lavella-catalog-filters";
import { LavellaCatalogCard } from "./lavella-catalog-card";
import { LavellaSearchBox } from "./lavella-search-box";
import type { LavellaCatalogProps } from "./lavella-types";

export function LavellaCatalog({
  agency,
  trips,
  onOpen,
}: LavellaCatalogProps) {
  const [filters, setFilters] = useState<CatalogFilters>({ sort: "next" });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const results = useMemo(() => filterCatalog(trips, filters), [trips, filters]);
  const activeFilterCount = countLavellaActiveFilters(filters);
  const update = (key: keyof CatalogFilters, value: string | boolean) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () =>
    setFilters((current) => clearLavellaCatalogFilters(current));

  useEffect(() => {
    if (!filterPanelOpen) return;
    const mobileQuery = window.matchMedia("(max-width: 1000px)");
    const originalOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterPanelOpen(false);
    };
    const syncScrollLock = () => {
      document.body.style.overflow = mobileQuery.matches
        ? "hidden"
        : originalOverflow;
    };
    window.addEventListener("keydown", closeOnEscape);
    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncScrollLock);
    } else {
      mobileQuery.addListener(syncScrollLock);
    }
    syncScrollLock();
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (typeof mobileQuery.removeEventListener === "function") {
        mobileQuery.removeEventListener("change", syncScrollLock);
      } else {
        mobileQuery.removeListener(syncScrollLock);
      }
      document.body.style.overflow = originalOverflow;
    };
  }, [filterPanelOpen]);

  return (
    <main className={styles.catalog} data-lavella-surface="light">
      <section
        className={styles.catalogHero}
        data-lavella-surface="image"
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
        <header className={styles.resultsHeading}>
          <div>
            <small>VIAJES DISPONIBLES</small>
            <h2>{results.length} rutas para descubrir</h2>
          </div>
        </header>
        <div className={styles.filterBar}>
          <button
            className={`${styles.filterToggle} ${activeFilterCount ? styles.filterToggleActive : ""}`}
            type="button"
            onClick={() => setFilterPanelOpen((open) => !open)}
            aria-expanded={filterPanelOpen}
            aria-controls="lavella-catalog-filters"
          >
            <FaSliders />
            {activeFilterCount
              ? `Filtros (${activeFilterCount})`
              : "Filtros"}
          </button>
          {activeFilterCount > 0 && (
            <button
              className={styles.toolbarClear}
              type="button"
              onClick={clearFilters}
            >
              Limpiar
            </button>
          )}
          <label className={styles.sortControl}>
              <span>
              Ordenar
              </span>
              <select value={String(filters.sort)} onChange={(event) => update("sort", event.target.value)}>
                <option value="next">Próxima salida</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
                <option value="duration">Duración</option>
              </select>
          </label>
        </div>
        <div
          className={`${styles.resultsLayout} ${filterPanelOpen ? styles.resultsLayoutWithFilters : ""}`}
        >
          <div className={styles.resultsList}>
            <div className={styles.resultsGrid}>
              {results.map((trip) => (
                <LavellaCatalogCard
                  key={trip.id}
                  trip={trip}
                  onOpen={onOpen}
                />
              ))}
            </div>
            {!results.length && (
              <div className={styles.empty}>
                <h3>No encontramos una ruta así.</h3>
                <p>Prueba con menos filtros.</p>
                <button onClick={clearFilters}>Restablecer</button>
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

          {filterPanelOpen && (
            <button
              className={styles.filterBackdrop}
              type="button"
              aria-label="Cerrar filtros"
              onClick={() => setFilterPanelOpen(false)}
            />
          )}
          <aside
            id="lavella-catalog-filters"
            className={`${styles.sidebar} ${filterPanelOpen ? styles.sidebarOpen : ""}`}
            data-lavella-surface="light"
            aria-hidden={!filterPanelOpen}
            inert={!filterPanelOpen}
          >
            <header>
              <h3>Filtrar viajes</h3>
              <button
                type="button"
                onClick={() => setFilterPanelOpen(false)}
                aria-label="Cerrar panel de filtros"
              >
                Cerrar
              </button>
            </header>
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
            <div className={styles.sidebarHelp}>
              <small>¿NECESITAS AYUDA?</small>
              <h3>Encontramos la ruta contigo.</h3>
              <p>{agency.contact.email}</p>
            </div>
            <footer className={styles.panelActions}>
              <button
                className={styles.applyFilters}
                type="button"
                onClick={() => setFilterPanelOpen(false)}
              >
                Ver {results.length} {results.length === 1 ? "viaje" : "viajes"}
              </button>
              {activeFilterCount > 0 && (
                <button
                  className={styles.clear}
                  type="button"
                  onClick={clearFilters}
                >
                  Limpiar filtros
                </button>
              )}
            </footer>
          </aside>
        </div>
      </section>
    </main>
  );
}
