"use client";

import { useEffect, useState } from "react";
import type { TripSectionConfig } from "@/types";
import styles from "./lavella-detail.module.css";

export function LavellaTripNavigation({ sections }: { sections: TripSectionConfig[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-190px 0px -58% 0px", threshold: [0, 0.1] },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);
  return (
    <nav className={styles.tripNav} aria-label="Contenido del viaje">
      <div>
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={active === section.id ? styles.tripNavActive : undefined}
            aria-current={active === section.id ? "location" : undefined}
          >
            {section.anchorLabel ?? section.title ?? section.type}
          </a>
        ))}
      </div>
    </nav>
  );
}
