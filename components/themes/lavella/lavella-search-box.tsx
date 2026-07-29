"use client";

import { useState } from "react";
import { FaChevronDown, FaMagnifyingGlass } from "react-icons/fa6";
import styles from "./lavella-home.module.css";

export function LavellaSearchBox({
  onSearch,
  compact = false,
}: {
  onSearch: (query: string) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  return (
    <form
      className={`${styles.searchBox} ${
        compact ? styles.searchCompact : styles.searchHome
      } ${mobileFiltersOpen ? styles.searchFiltersOpen : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(query);
      }}
    >
      {!compact && (
        <header>
          <small>BUSCAR VIAJE</small>
          <h2>¿A dónde quieres ir?</h2>
        </header>
      )}
      <div className={styles.searchFields}>
        <label className={styles.searchKeyword}>
          Palabras clave
          <span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Destino o viaje"
            />
            <FaMagnifyingGlass />
          </span>
        </label>
        <label className={styles.searchOptional}>
          Actividad
          <select defaultValue="">
            <option value="">Cualquiera</option>
            <option>Naturaleza</option>
            <option>Cultura</option>
            <option>Aventura</option>
          </select>
        </label>
        <label className={styles.searchDestination}>
          Destino
          <select defaultValue="">
            <option value="">Cualquiera</option>
            <option>México</option>
            <option>Internacional</option>
          </select>
        </label>
        <label className={styles.searchOptional}>
          Duración
          <select defaultValue="">
            <option value="">Cualquiera</option>
            <option>1 día</option>
            <option>2–4 días</option>
            <option>5+ días</option>
          </select>
        </label>
        <label className={styles.searchOptional}>
          Fecha
          <input type="month" />
        </label>
        {!compact && (
          <button
            className={styles.searchFilterToggle}
            type="button"
            aria-expanded={mobileFiltersOpen}
            onClick={() => setMobileFiltersOpen((value) => !value)}
          >
            Más filtros
            <FaChevronDown aria-hidden="true" />
          </button>
        )}
        <button className={styles.searchSubmit} type="submit">
          <FaMagnifyingGlass aria-hidden="true" />
          <span>Buscar viajes</span>
        </button>
      </div>
    </form>
  );
}
