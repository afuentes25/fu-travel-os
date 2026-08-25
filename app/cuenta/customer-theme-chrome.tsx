"use client";

import type { CSSProperties, ReactNode } from "react";

import { ExplorerHeader } from "@/components/travel-app";
import { LavellaHeader } from "@/components/themes/lavella/lavella-theme";
import type { Agency, TravelTheme } from "@/types";

import styles from "./cuenta.module.css";

function navigateToStorefront(path: string, agency: Agency, theme: TravelTheme) {
  const url = new URL(path, window.location.origin);
  if (!url.pathname.startsWith("/cuenta")) {
    url.searchParams.set("tenant", agency.slug);
    url.searchParams.set("theme", theme);
  }
  window.location.assign(`${url.pathname}${url.search}${url.hash}`);
}

export function CustomerThemeSurface({
  agency,
  theme,
  authenticated = false,
  children,
}: Readonly<{
  agency: Agency;
  theme: TravelTheme;
  authenticated?: boolean;
  children: ReactNode;
}>) {
  const onNavigate = (path: string) => navigateToStorefront(path, agency, theme);
  return (
    <div
      className={`${styles.customerThemeSurface} ${theme === "lavella" ? styles.customerThemeLavella : styles.customerThemeExplorer} ${theme === "lavella" ? "theme-v2-lavella lavella-commerce" : "theme-v2-explorer"}`}
      style={{ "--brand": agency.branding.primaryColor, "--accent": agency.branding.accentColor } as CSSProperties}
    >
      {theme === "lavella" ? (
        <LavellaHeader agency={agency} cartCount={0} customerEmail={authenticated ? "authenticated" : null} embedded onNavigate={onNavigate} />
      ) : (
        <ExplorerHeader agency={agency} cartCount={0} customerEmail={authenticated ? "authenticated" : null} onNavigate={onNavigate} />
      )}
      {children}
    </div>
  );
}
