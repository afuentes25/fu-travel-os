export { LavellaHeader } from "./lavella-header";
export { LavellaHome } from "./lavella-home";
export { LavellaTourCard as LavellaCard } from "./lavella-tour-card";
export { LavellaFooter } from "./lavella-footer";
export { LavellaCatalog } from "./lavella-catalog";
export { LavellaTripDetail } from "./lavella-trip-detail";

export const lavellaTokens = {
  colors: { background: "#f4f4f4", surface: "#fff", surfaceDark: "#050505", text: "#3e4559", textMuted: "#818693", accent: "#ff7f00", accentHover: "#e66f00", border: "#e6e6e6" },
  typography: { heading: "var(--font-explorer)", body: "var(--font-explorer)" },
  radius: { small: "0", medium: "4px", large: "18px" },
  spacing: { section: "clamp(72px, 8vw, 110px)", container: "min(1200px, calc(100% - 80px))" },
} as const;
