"use client";

import { useState } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";
import styles from "./lavella-home.module.css";

export function LavellaSearchBox({
  onSearch,
  compact = false,
}: {
  onSearch: (query: string) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  return (
    <form
      className={`${styles.searchBox} ${compact ? styles.searchCompact : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(query);
      }}
    >
      {!compact && (
        <header>
          <small>BUSCAR VIAJE</small>
          <h2>¿Listo para descansar? Te ayudamos a encontrar la ruta.</h2>
        </header>
      )}
      <div className={styles.searchFields}>
        <label>
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
        <label>
          Actividad
          <select defaultValue="">
            <option value="">Cualquiera</option>
            <option>Naturaleza</option>
            <option>Cultura</option>
            <option>Aventura</option>
          </select>
        </label>
        <label>
          Destino
          <select defaultValue="">
            <option value="">Cualquiera</option>
            <option>México</option>
            <option>Internacional</option>
          </select>
        </label>
        <label>
          Duración
          <select defaultValue="">
            <option value="">Cualquiera</option>
            <option>1 día</option>
            <option>2–4 días</option>
            <option>5+ días</option>
          </select>
        </label>
        <label>
          Fecha
          <input type="month" />
        </label>
        <button aria-label="Buscar viajes"><FaMagnifyingGlass /></button>
      </div>
    </form>
  );
}
