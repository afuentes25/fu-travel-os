import type { TravelProduct } from "@/types";

const catalogTransportLabels: Record<
  TravelProduct["transportTypes"][number],
  string
> = {
  air: "Aéreo",
  ground: "Terrestre",
  train: "Tren",
  cruise: "Marítimo",
  mixed: "Aéreo · Terrestre",
  not_included: "Por confirmar",
};

export const lavellaCatalogDuration = (days: number) =>
  `${days} ${days === 1 ? "día" : "días"}`;

export const lavellaCatalogTransport = (
  values: TravelProduct["transportTypes"],
) => values.map((value) => catalogTransportLabels[value]).join(" · ");
