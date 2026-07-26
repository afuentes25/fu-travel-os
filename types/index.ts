export type TravelTheme = "explorer" | "boutique" | "marketplace";
/** Extensible theme contract. `lavella` is reserved and is not publicly selectable yet. */
export type ThemeId = TravelTheme | "lavella";
export type AgencyPlan = "start" | "commerce" | "growth" | "scale";
export type AgencyStatus = "draft" | "active" | "suspended";
export type Currency = "MXN" | "USD";
export type GeographicScope = "national" | "international";
export type TravelProductType =
  | "day_tour"
  | "excursion"
  | "short_break"
  | "circuit"
  | "vacation_package"
  | "beach"
  | "magical_town"
  | "cruise"
  | "experience"
  | "group_trip"
  | "custom_trip";
export type TransportType =
  "ground" | "air" | "cruise" | "train" | "mixed" | "not_included";
export type TravelThemeTag =
  | "nature"
  | "culture"
  | "adventure"
  | "gastronomy"
  | "wellness"
  | "romance"
  | "family"
  | "religious"
  | "premium"
  | "all_inclusive"
  | "seasonal";
export type TravelRegion =
  | "mexico"
  | "north_america"
  | "central_america_caribbean"
  | "south_america"
  | "europe"
  | "asia"
  | "africa"
  | "middle_east"
  | "oceania";
export type AvailabilityDisplayMode =
  "hidden" | "status_only" | "remaining_places";
export type ExtraVisibility = "hidden" | "checkout" | "booking_step";
export type AccommodationMode = "none" | "hotel_occupancy" | "custom";
export type DepositPolicy = {
  enabled: boolean;
  type: "percentage" | "fixed";
  percentage?: number;
  fixedAmount?: number;
  minimumAmount?: number;
  dueDate?: string;
};
export type TravelerCategory = {
  id: string;
  label: string;
  minAge?: number;
  maxAge?: number;
  pricingRule: "adult" | "child" | "infant" | "custom";
  active: boolean;
  order: number;
};
export type AgencyWhatsAppSettings = {
  enabled: boolean;
  phone: string;
  defaultMessage?: string;
  showOnMobile?: boolean;
  showOnDesktop?: boolean;
};
export type SocialNetwork =
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok"
  | "linkedin"
  | "x"
  | "whatsapp";
export type AgencySocialLink = {
  id: string;
  network: SocialNetwork;
  url: string;
  enabled: boolean;
  label?: string;
  order: number;
  showInHeader: boolean;
  showInFooter: boolean;
};
export type AgencySocialSettings = { links: AgencySocialLink[] };
export type RoomCapacityPolicy = {
  enabled: boolean;
  defaultMaxGuestsPerRoom: number;
  allowMultipleRooms: boolean;
  maxRoomsPerBooking?: number;
  adultCountsTowardCapacity: boolean;
  minorCountsTowardCapacity: boolean;
  infantCountsTowardCapacity?: boolean;
};
export type RoomAllocation = {
  roomNumber: number;
  adults: number;
  minors: number;
  occupancyBase: "single" | "double" | "triple" | "quadruple";
};

export type AgencyContact = {
  whatsapp: string;
  email: string;
  phone?: string;
  instagram?: string;
  facebook?: string;
};
export type AgencyBranding = {
  logoText: string;
  primaryColor: string;
  accentColor: string;
  heroImage: string;
  heroTitle: string;
  heroDescription: string;
  buttonStyle: "rounded" | "square" | "pill";
};
export type AgencySettings = {
  visibleSections: string[];
  modules: string[];
  legalNotice: string;
  whatsapp?: AgencyWhatsAppSettings;
  socialSettings?: AgencySocialSettings;
  roomCapacityPolicy?: RoomCapacityPolicy;
  availabilityDisplayMode?: AvailabilityDisplayMode;
  travelerCategories?: TravelerCategory[];
  extraVisibility?: ExtraVisibility;
};
export type Agency = {
  id: string;
  slug: string;
  name: string;
  legalName?: string;
  status: AgencyStatus;
  theme: TravelTheme;
  plan: AgencyPlan;
  currency: Currency;
  timezone: string;
  locale: string;
  contact: AgencyContact;
  branding: AgencyBranding;
  settings: AgencySettings;
};
export type AgencyDomain = {
  id: string;
  agencyId: string;
  hostname: string;
  type: "subdomain" | "custom_domain";
  isPrimary: boolean;
  status: "pending" | "verified" | "active";
};
export type TravelDestination = {
  id: string;
  agencyId: string;
  slug: string;
  name: string;
  region: TravelRegion;
  country: string;
  state?: string;
  city?: string;
  summary: string;
  description: string;
  featuredImage: string;
  gallery: string[];
  featured: boolean;
  status: "draft" | "published" | "archived";
};
export type TravelPrice = {
  amount: number;
  currency: Currency;
  taxesAmount?: number;
  taxesIncluded: boolean;
  taxesLabel?: string;
  depositAmount?: number;
  priceType: "per_person" | "per_room" | "per_package";
  displayFrom: boolean;
};
export type TravelPricingOption = {
  id: string;
  label: string;
  occupancy:
    | "single"
    | "double"
    | "triple"
    | "quadruple"
    | "child"
    | "infant"
    | "general";
  amount: number;
  currency: Currency;
  taxesAmount?: number;
  inventoryImpact: number;
  maxGuestsPerRoom?: number;
};
export type AgencyDeparturePoint = {
  id: string;
  agencyId: string;
  name: string;
  shortName?: string;
  address: string;
  city: string;
  state?: string;
  reference?: string;
  instructions?: string;
  mapUrl?: string;
  isActive: boolean;
};
export type DepartureBoardingOption = {
  id: string;
  departureId: string;
  agencyDeparturePointId: string;
  meetingTime: string;
  departureTime: string;
  surchargeAmount?: number;
  surchargeType?: "per_booking" | "per_person";
  currency?: Currency;
  capacity?: number;
  availableSpaces?: number;
  bookingDeadline?: string;
  boardingOrder?: number;
  instructionsOverride?: string;
  status: "available" | "limited" | "sold_out" | "disabled";
};
export type TravelDeparture = {
  id: string;
  travelId: string;
  startDate: string;
  endDate: string;
  timezone: string;
  boardingOptions: DepartureBoardingOption[];
  capacity: number;
  reservedSpaces: number;
  availableSpaces: number;
  saleStatus: "scheduled" | "limited" | "sold_out" | "cancelled";
  bookingDeadline?: string;
  coordinator?: string;
  priceOverride?: TravelPrice;
  depositPolicy?: DepositPolicy;
  pricing?: ScheduledDeparturePricing;
};
export type TravelExtra = {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: Currency;
  pricingMode: "per_person" | "per_booking" | "per_night";
  optional: boolean;
  visibility?: ExtraVisibility;
};
export type TravelItineraryDay = {
  day: number;
  id?: string;
  dayNumber?: number;
  order?: number;
  title: string;
  shortDescription?: string;
  description: string;
  startTime?: string;
  endTime?: string;
  stops?: ItineraryStop[];
  highlights?: string[];
  meals?: string[];
  accommodation?: string;
  activities?: string[];
  notes?: string[];
  images?: TripGalleryImage[];
  optionalActivities?: string[];
};
export type TripSectionType =
  | "summary" | "video" | "gallery" | "itinerary" | "included" | "map"
  | "departures" | "rates" | "recommendations" | "departure_points"
  | "important_information" | "faq" | "related_trips" | "custom";
export type TripSectionConfig = {
  id: string;
  type: TripSectionType;
  enabled: boolean;
  order: number;
  title?: string;
  subtitle?: string;
  anchorLabel?: string;
  showInStickyNavigation?: boolean;
  themeVariant?: "default" | "light" | "dark" | "accent";
};
export type TripPageConfiguration = { sections: TripSectionConfig[] };
export type TripHeroMedia =
  | { type: "image"; imageUrl: string; imageAlt: string; focalPoint?: { x: number; y: number }; overlay?: number; mobilePosterUrl?: string }
  | { type: "video"; videoUrl: string; posterUrl?: string; autoplay: boolean; muted: boolean; loop: boolean };
export type TripSummaryContent = {
  shortDescription: string;
  showDuration: boolean;
  showUpcomingDepartures: boolean;
  showVisitedDestinations: boolean;
  showStartingPrice: boolean;
  maxUpcomingDepartures?: number;
  maxVisitedDestinations?: number;
  visitedDestinationsOverride?: string[];
};
export type ItineraryStop = {
  id: string;
  name: string;
  destinationId?: string;
  order: number;
  coordinates?: { latitude: number; longitude: number };
};
export type TripGalleryImage = {
  id: string; url: string; alt: string; caption?: string; destinationId?: string;
  itineraryDayId?: string; order: number; featured?: boolean;
};
export type TripVideoProvider = "youtube" | "vimeo" | "tiktok" | "instagram" | "html5";
export type TripVideoContent = {
  enabled: boolean; provider: TripVideoProvider; url: string; title?: string;
  caption?: string; posterUrl?: string; aspectRatio?: "16:9" | "9:16" | "4:3" | "1:1";
};
export type ItineraryDisplayMode = "all_open" | "first_open" | "all_closed";
export type TripItinerarySettings = {
  displayMode: ItineraryDisplayMode; allowExpandAll: boolean; allowCollapseAll: boolean;
  showTimes: boolean; showImages: boolean; showStops: boolean; showHighlights: boolean;
  showMeals: boolean; showAccommodation: boolean;
};
export type ItineraryDownloadSettings = {
  enabled: boolean; fileUrl?: string; fileName?: string; fileType?: "pdf" | "docx" | "xlsx" | "other";
  fileSizeLabel?: string; requireLeadForm: boolean; leadFormFields?: Array<"name" | "whatsapp">;
  title?: string; description?: string;
};
export type ItineraryLeadInput = {
  agencyId: string; tripId: string; name: string; whatsapp: string; documentUrl: string;
  pageUrl?: string; capturedAt: string;
};
export interface ItineraryLeadCaptureService { capture(input: ItineraryLeadInput): Promise<void> }
export type TripFeatureIcon = "check" | "transport" | "hotel" | "meal" | "guide" | "ticket" | "insurance" | "activity" | "flight" | "baggage" | "custom";
export type TripFeatureItem = { id: string; text: string; icon: TripFeatureIcon; customIconUrl?: string; order: number };
export type TripInclusionsContent = { included: TripFeatureItem[]; excluded: TripFeatureItem[] };
export type TripMapMode = "none" | "main_destination" | "route";
export type TripMapSettings = {
  enabled: boolean; mode: TripMapMode;
  mainDestination?: { name: string; latitude?: number; longitude?: number };
  routeStops?: Array<{ id: string; dayNumber: number; name: string; latitude?: number; longitude?: number; order: number }>;
  generatedFromItinerary?: boolean;
};
export interface ItineraryMapGenerator { generate(input: { itinerary: TravelItineraryDay[] }): Promise<TripMapSettings> }
export type DeparturePricingMode = "inherit_trip" | "custom";
export type ScheduledDeparturePricing = {
  mode: DeparturePricingMode;
  pricingOverrides?: {
    adultGeneral?: number; adultSingle?: number; adultDouble?: number; adultTriple?: number;
    adultQuadruple?: number; minor?: number; infant?: number; packagePrice?: number;
    taxes?: number; depositPolicy?: DepositPolicy;
  };
};
export type TripRecommendationItem = { id: string; title?: string; text: string; icon?: string; order: number };
export type TripRecommendationsContent = {
  mode: "items" | "bulleted_text"; items?: TripRecommendationItem[]; bulletedText?: string;
  difficulty?: { level: "muy_facil" | "facil" | "moderado" | "exigente"; label: string; description?: string };
};
export type DeparturePointType = "city_boarding" | "airport" | "bus_terminal" | "hotel" | "port" | "custom";
export type PublicDeparturePoint = {
  id: string; type: DeparturePointType; name: string; address?: string; reference?: string;
  city?: string; state?: string; airportCode?: string; meetingTime?: string; departureTime?: string;
  instructions?: string; mapUrl?: string; enabled: boolean; order: number;
};
export type DeparturePointsDisplayMode = "general" | "selected_departure" | "all_departures";
export type ImportantInformationItem = {
  id: string; title: string; description: string;
  icon?: "info" | "pricing" | "security" | "documents" | "operation" | "terms" | "baggage" | "custom";
  severity?: "info" | "warning" | "critical"; order: number;
};
export type ImportantInformationContent = { introduction?: string; items: ImportantInformationItem[] };
export type TripFaqItem = { id: string; question: string; answer: string; category?: string; order: number };
export type TripFaqContent = { introduction?: string; items: TripFaqItem[]; displayMode: "accordion" | "list" };
export type TravelPolicies = {
  cancellation: string;
  payment: string;
  responsibility: string;
};
export type TravelProduct = {
  id: string;
  agencyId: string;
  code: string;
  slug: string;
  title: string;
  subtitle?: string;
  summary: string;
  description: string;
  scope: GeographicScope;
  productType: TravelProductType;
  transportTypes: TransportType[];
  tags: TravelThemeTag[];
  region: TravelRegion;
  countries: string[];
  cities: string[];
  destinationIds: string[];
  categoryIds: string[];
  durationDays: number;
  durationNights: number;
  accommodationMode: AccommodationMode;
  roomCapacityPolicy?: RoomCapacityPolicy;
  featuredImage: string;
  gallery: string[];
  includes: string[];
  excludes: string[];
  requirements: string[];
  recommendations: string[];
  policies: TravelPolicies;
  itinerary: TravelItineraryDay[];
  basePrice: TravelPrice;
  pricingOptions: TravelPricingOption[];
  departures: TravelDeparture[];
  extras: TravelExtra[];
  status: "draft" | "review" | "published" | "archived";
  featured: boolean;
  promotion?: string;
  availabilityDisplayMode?: AvailabilityDisplayMode;
  depositPolicy?: DepositPolicy;
  travelerCategories?: TravelerCategory[];
  extraVisibility?: ExtraVisibility;
  allowManualOccupancy?: boolean;
  pageConfiguration?: TripPageConfiguration;
  heroMedia?: TripHeroMedia;
  summaryContent?: TripSummaryContent;
  videoContent?: TripVideoContent;
  galleryImages?: TripGalleryImage[];
  itinerarySettings?: TripItinerarySettings;
  itineraryDownload?: ItineraryDownloadSettings;
  inclusionsContent?: TripInclusionsContent;
  mapSettings?: TripMapSettings;
  recommendationsContent?: TripRecommendationsContent;
  publicDeparturePoints?: PublicDeparturePoint[];
  departurePointsDisplayMode?: DeparturePointsDisplayMode;
  importantInformation?: ImportantInformationContent;
  faqContent?: TripFaqContent;
};
export type BookingBoardingSnapshot = {
  boardingOptionId: string;
  boardingPointId: string;
  pointName: string;
  address?: string;
  reference?: string;
  city: string;
  meetingTime?: string;
  departureTime?: string;
  surchargeAmount: number;
  surchargeType?: "per_booking" | "per_person";
  currency: Currency;
  instructions?: string;
};
export type BookingStatus =
  | "draft"
  | "pending"
  | "deposit_pending"
  | "partially_paid"
  | "confirmed"
  | "cancelled"
  | "refunded"
  | "completed";
export type TravelerDataStatus = "complete" | "pending";
export type TravelerDraft = {
  id: string;
  category: "adult" | "minor";
  sequence: number;
  fullName: string;
  birthDate?: string;
  age?: number;
  phone?: string;
  email?: string;
  completionStatus: "complete" | "pending";
};
export type CartLine = {
  id: string;
  agencyId: string;
  travelId: string;
  departureId: string;
  boardingOptionId: string | null;
  boardingSnapshot?: BookingBoardingSnapshot;
  pricingOptionId: string;
  travelers: number;
  extraIds: string[];
  travelerDataStatus?: TravelerDataStatus;
  travelerDrafts?: TravelerDraft[];
};
export type PricedCartLine = Omit<CartLine, "boardingOptionId"> & {
  boardingOptionId: string;
  travel: TravelProduct;
  departure: TravelDeparture;
  boarding: BookingBoardingSnapshot;
  subtotal: number;
  taxes: number;
  surcharge: number;
  extrasTotal: number;
  total: number;
  deposit: number;
};
