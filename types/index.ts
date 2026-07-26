export type TravelTheme = "explorer" | "boutique" | "marketplace";
export type AgencyPlan = "start" | "commerce" | "growth" | "scale";
export type AgencyStatus = "draft" | "active" | "suspended";
export type Currency = "MXN" | "USD";
export type GeographicScope = "national" | "international";
export type TravelProductType =
  | "day_tour" | "excursion" | "short_break" | "circuit"
  | "vacation_package" | "beach" | "magical_town" | "cruise"
  | "experience" | "group_trip" | "custom_trip";
export type TransportType = "ground" | "air" | "cruise" | "train" | "mixed" | "not_included";
export type TravelThemeTag = "nature" | "culture" | "adventure" | "gastronomy" | "wellness" | "romance" | "family" | "religious" | "premium" | "all_inclusive" | "seasonal";
export type TravelRegion = "mexico" | "north_america" | "central_america_caribbean" | "south_america" | "europe" | "asia" | "africa" | "middle_east" | "oceania";
export type AvailabilityDisplayMode = "hidden" | "status_only" | "remaining_places";
export type ExtraVisibility = "hidden" | "checkout" | "booking_step";
export type AccommodationMode = "none" | "hotel_occupancy" | "custom";
export type DepositPolicy = { enabled: boolean; type: "percentage" | "fixed"; percentage?: number; fixedAmount?: number; minimumAmount?: number; dueDate?: string };
export type TravelerCategory = { id: string; label: string; minAge?: number; maxAge?: number; pricingRule: "adult" | "child" | "infant" | "custom"; active: boolean; order: number };
export type AgencyWhatsAppSettings = { enabled: boolean; phone: string; defaultMessage?: string; showOnMobile?: boolean; showOnDesktop?: boolean };

export type AgencyContact = { whatsapp: string; email: string; phone?: string; instagram?: string; facebook?: string };
export type AgencyBranding = { logoText: string; primaryColor: string; accentColor: string; heroImage: string; heroTitle: string; heroDescription: string; buttonStyle: "rounded" | "square" | "pill" };
export type AgencySettings = { visibleSections: string[]; modules: string[]; legalNotice: string; whatsapp?: AgencyWhatsAppSettings; availabilityDisplayMode?: AvailabilityDisplayMode; travelerCategories?: TravelerCategory[]; extraVisibility?: ExtraVisibility };
export type Agency = { id: string; slug: string; name: string; legalName?: string; status: AgencyStatus; theme: TravelTheme; plan: AgencyPlan; currency: Currency; timezone: string; locale: string; contact: AgencyContact; branding: AgencyBranding; settings: AgencySettings };
export type AgencyDomain = { id: string; agencyId: string; hostname: string; type: "subdomain" | "custom_domain"; isPrimary: boolean; status: "pending" | "verified" | "active" };
export type TravelDestination = { id: string; agencyId: string; slug: string; name: string; region: TravelRegion; country: string; state?: string; city?: string; summary: string; description: string; featuredImage: string; gallery: string[]; featured: boolean; status: "draft" | "published" | "archived" };
export type TravelPrice = { amount: number; currency: Currency; taxesAmount?: number; taxesIncluded: boolean; taxesLabel?: string; depositAmount?: number; priceType: "per_person" | "per_room" | "per_package"; displayFrom: boolean };
export type TravelPricingOption = { id: string; label: string; occupancy: "single" | "double" | "triple" | "quadruple" | "child" | "infant" | "general"; amount: number; currency: Currency; taxesAmount?: number; inventoryImpact: number };
export type AgencyDeparturePoint = { id: string; agencyId: string; name: string; shortName?: string; address: string; city: string; state?: string; reference?: string; instructions?: string; mapUrl?: string; isActive: boolean };
export type DepartureBoardingOption = { id: string; departureId: string; agencyDeparturePointId: string; meetingTime: string; departureTime: string; surchargeAmount?: number; surchargeType?: "per_booking" | "per_person"; currency?: Currency; capacity?: number; availableSpaces?: number; bookingDeadline?: string; boardingOrder?: number; instructionsOverride?: string; status: "available" | "limited" | "sold_out" | "disabled" };
export type TravelDeparture = { id: string; travelId: string; startDate: string; endDate: string; timezone: string; boardingOptions: DepartureBoardingOption[]; capacity: number; reservedSpaces: number; availableSpaces: number; saleStatus: "scheduled" | "limited" | "sold_out" | "cancelled"; bookingDeadline?: string; coordinator?: string; priceOverride?: TravelPrice; depositPolicy?: DepositPolicy };
export type TravelExtra = { id: string; name: string; description?: string; price: number; currency: Currency; pricingMode: "per_person" | "per_booking" | "per_night"; optional: boolean; visibility?: ExtraVisibility };
export type TravelItineraryDay = { day: number; title: string; description: string; meals?: string[]; accommodation?: string; activities?: string[] };
export type TravelPolicies = { cancellation: string; payment: string; responsibility: string };
export type TravelProduct = { id: string; agencyId: string; code: string; slug: string; title: string; subtitle?: string; summary: string; description: string; scope: GeographicScope; productType: TravelProductType; transportTypes: TransportType[]; tags: TravelThemeTag[]; region: TravelRegion; countries: string[]; cities: string[]; destinationIds: string[]; categoryIds: string[]; durationDays: number; durationNights: number; accommodationMode: AccommodationMode; featuredImage: string; gallery: string[]; includes: string[]; excludes: string[]; requirements: string[]; recommendations: string[]; policies: TravelPolicies; itinerary: TravelItineraryDay[]; basePrice: TravelPrice; pricingOptions: TravelPricingOption[]; departures: TravelDeparture[]; extras: TravelExtra[]; status: "draft" | "review" | "published" | "archived"; featured: boolean; promotion?: string; availabilityDisplayMode?: AvailabilityDisplayMode; depositPolicy?: DepositPolicy; travelerCategories?: TravelerCategory[]; extraVisibility?: ExtraVisibility; allowManualOccupancy?: boolean };
export type BookingBoardingSnapshot = { boardingOptionId: string; boardingPointId: string; pointName: string; address?: string; reference?: string; city: string; meetingTime?: string; departureTime?: string; surchargeAmount: number; surchargeType?: "per_booking" | "per_person"; currency: Currency; instructions?: string };
export type BookingStatus = "draft" | "pending" | "deposit_pending" | "partially_paid" | "confirmed" | "cancelled" | "refunded" | "completed";
export type CartLine = { id: string; agencyId: string; travelId: string; departureId: string; boardingOptionId: string | null; boardingSnapshot?: BookingBoardingSnapshot; pricingOptionId: string; travelers: number; extraIds: string[] };
export type PricedCartLine = Omit<CartLine, "boardingOptionId"> & { boardingOptionId: string; travel: TravelProduct; departure: TravelDeparture; boarding: BookingBoardingSnapshot; subtotal: number; taxes: number; surcharge: number; extrasTotal: number; total: number; deposit: number };
