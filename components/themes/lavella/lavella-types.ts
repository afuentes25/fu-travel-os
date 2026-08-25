import type { Agency, TravelProduct } from "@/types";

export type LavellaNavigate = (path: string) => void;
export type LavellaOpenTrip = (trip: TravelProduct) => void;
export type LavellaHeaderProps = {
  agency: Agency;
  cartCount: number;
  onNavigate: LavellaNavigate;
  customerEmail?: string | null;
};
export type LavellaHomeProps = {
  agency: Agency;
  trips: TravelProduct[];
  onOpen: LavellaOpenTrip;
  onNavigate: LavellaNavigate;
};
export type LavellaCardProps = {
  trip: TravelProduct;
  onOpen: LavellaOpenTrip;
  featured?: boolean;
  variant?: "cinematic" | "classic";
};
export type LavellaFooterProps = {
  agency: Agency;
  onNavigate: LavellaNavigate;
};
export type LavellaCatalogProps = {
  agency: Agency;
  trips: TravelProduct[];
  onOpen: LavellaOpenTrip;
};
export type LavellaTripDetailProps = {
  agency: Agency;
  trip: TravelProduct;
  related: TravelProduct[];
  onNavigate: LavellaNavigate;
};
