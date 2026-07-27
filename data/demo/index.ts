import type { Agency, AgencyDeparturePoint, AgencyDomain, TravelDeparture, TravelDestination, TravelProduct } from "@/types";

const visualLibrary = [
  "/images/destination-town.webp",
  "/images/destination-beach.webp",
  "/images/destination-mountain.webp",
  "/images/destination-europe.webp",
  "/images/destination-patagonia.webp",
  "/images/destination-japan.webp",
  "/images/destination-canyon.webp",
  "/images/destination-caribbean.webp",
  "/images/destination-sailing.webp",
] as const;
let visualIndex = 0;
const image = (_seed: string) => visualLibrary[visualIndex++ % visualLibrary.length];
export const agencies: Agency[] = [
  { id: "a-furiver", slug: "furiver", name: "Furiver", status: "active", theme: "explorer", plan: "growth", currency: "MXN", timezone: "America/Mexico_City", locale: "es-MX", contact: { whatsapp: "525500000101", email: "hola@furiver.demo", facebook: "furiver.demo" }, branding: { logoText: "FURIVER", primaryColor: "#101b22", accentColor: "#ef8b45", heroImage: "/images/explorer-hero.webp", heroTitle: "México se vive en el camino", heroDescription: "Excursiones, playa y pueblos mágicos con salidas desde la ciudad.", buttonStyle: "rounded" }, settings: { visibleSections: ["featured", "departures", "destinations", "benefits", "testimonials"], modules: ["catalog", "booking", "whatsapp"], legalNotice: "Información demostrativa. No constituye una oferta comercial.", whatsapp: { enabled: true, phone: "525500000101", defaultMessage: "Necesito ayuda para reservar.", showOnMobile: true, showOnDesktop: true }, roomCapacityPolicy: { enabled: true, defaultMaxGuestsPerRoom: 4, allowMultipleRooms: false, adultCountsTowardCapacity: true, minorCountsTowardCapacity: true, infantCountsTowardCapacity: false }, socialSettings: { links: [
    { id: "furiver-facebook", network: "facebook", url: "https://social.example/furiver/facebook", enabled: true, order: 1, showInHeader: true, showInFooter: true },
    { id: "furiver-instagram", network: "instagram", url: "https://social.example/furiver/instagram", enabled: true, order: 2, showInHeader: true, showInFooter: true },
    { id: "furiver-youtube", network: "youtube", url: "https://social.example/furiver/youtube", enabled: true, order: 3, showInHeader: false, showInFooter: true },
    { id: "furiver-disabled", network: "tiktok", url: "https://social.example/furiver/tiktok", enabled: false, order: 4, showInHeader: true, showInFooter: true },
  ] }, availabilityDisplayMode: "hidden", travelerCategories: [{ id: "adult", label: "Adultos", minAge: 12, pricingRule: "adult", active: true, order: 1 }, { id: "child", label: "Menores", minAge: 3, maxAge: 11, pricingRule: "child", active: true, order: 2 }], extraVisibility: "hidden", heroSliderSettings: { autoplay: true, autoplayDelayMs: 5000, transitionDurationMs: 650, resumeAfterInteractionMs: 7000 } } },
  {
    id: "a-crisenix", slug: "crisenix", name: "Crisenix Demo", status: "active",
    theme: "marketplace", plan: "scale", currency: "MXN",
    timezone: "America/Mexico_City", locale: "es-MX",
    contact: { whatsapp: "525500000202", email: "ventas@crisenix.demo" },
    branding: {
      logoText: "CRISENIX", primaryColor: "#173f86", accentColor: "#f05a3e",
      heroImage: "/images/marketplace-hero.webp",
      heroTitle: "Viajes para todos, opciones para comparar",
      heroDescription: "Catálogo nacional e internacional con fechas, tarifas y disponibilidad.",
      buttonStyle: "square",
    },
    settings: {
      visibleSections: ["search", "departures", "categories", "promotions"],
      modules: ["catalog", "booking", "reports"],
      legalNotice: "Demo comercial sin inventario ni pagos reales.",
      heroSliderSettings: {
        autoplay: true, autoplayDelayMs: 5000,
        transitionDurationMs: 650, resumeAfterInteractionMs: 7000,
      },
      exchangeRatePolicy: {
        enabled: true,
        providerId: "demo-deterministic-v1",
        quoteTtlSeconds: 900,
        requireExplicitConsent: true,
        markup: { type: "percentage", basisPoints: 200 },
        rounding: { mode: "up", incrementMinor: 100 },
      },
    },
  },
  { id: "a-boutique", slug: "boutique", name: "Maison Voyage Demo", status: "active", theme: "boutique", plan: "commerce", currency: "USD", timezone: "America/Mexico_City", locale: "es-MX", contact: { whatsapp: "525500000303", email: "concierge@maison.demo", instagram: "maison.demo" }, branding: { logoText: "MAISON / VOYAGE", primaryColor: "#3d4536", accentColor: "#a45f47", heroImage: "/images/boutique-hero.webp", heroTitle: "El arte de viajar despacio", heroDescription: "Lunas de miel y experiencias privadas diseñadas con intención.", buttonStyle: "pill" }, settings: { visibleSections: ["story", "featured", "destinations", "testimonials"], modules: ["catalog", "booking", "concierge"], legalNotice: "Experiencias y precios creados exclusivamente para esta demostración." } },
];
export const domains: AgencyDomain[] = [
  { id: "d1", agencyId: "a-furiver", hostname: "furiver.travel.fu.land", type: "subdomain", isPrimary: true, status: "active" },
  { id: "d2", agencyId: "a-crisenix", hostname: "crisenix.travel.fu.land", type: "subdomain", isPrimary: true, status: "active" },
  { id: "d3", agencyId: "a-boutique", hostname: "agenciaejemplo.com", type: "custom_domain", isPrimary: true, status: "active" },
];
export const departurePoints: AgencyDeparturePoint[] = [
  ["p1","a-furiver","Metro Aragón","Gustavo A. Madero"],
  ["p2","a-furiver","Metro San Cosme","Cuauhtémoc"],
  ["p3","a-furiver","Parque Central","Azcapotzalco"],
  ["p4","a-crisenix","Oceanía","Venustiano Carranza"],
  ["p5","a-crisenix","Naucalpan","Naucalpan"],
  ["p6","a-crisenix","Guelatao","Iztapalapa"],
  ["p8","a-crisenix","Revolución","Cuauhtémoc"],
  ["p9","a-crisenix","Aeropuerto por confirmar","Ciudad de México"],
  ["p7","a-boutique","Terminal Ejecutiva","Miguel Hidalgo"],
].map(([id,agencyId,name,city]) => ({ id, agencyId, name, city, address: `Punto público de encuentro, zona ${name}`, state: "Ciudad de México", reference: "Ubicación exacta al confirmar", mapUrl: "https://maps.google.com", isActive: true }));

const catalog: Array<[string,string,string,string,string,string,number,number,string,string[],string,string?]> = [
  ["furiver","Bosque de luciérnagas","Una noche entre destellos naturales","mexico","excursion","ground",1,1490,"MXN",["nature","family"],"Tlaxcala","15% web"],
  ["furiver","Rincones de Bernal","Peña, sabores y calles con historia","mexico","magical_town","ground",1,1190,"MXN",["culture","gastronomy"],"Querétaro"],
  ["furiver","Costa Esmeralda","Fin de semana frente al Golfo","mexico","beach","ground",3,4990,"MXN",["family","nature"],"Veracruz","Niños -10%"],
  ["furiver","Barrancas del Cobre","Ruta serrana y miradores del norte","mexico","circuit","train",5,14990,"MXN",["adventure","culture"],"Chihuahua"],
  ["crisenix","Tren Maya Esencial","Ciudades mayas y selva en movimiento","mexico","circuit","mixed",6,18990,"MXN",["culture","nature"],"Yucatán","Meses sin intereses demo"],
  ["crisenix","Ruta Colonial del Bajío","Cuatro ciudades, una historia compartida","mexico","group_trip","ground",4,7490,"MXN",["culture","gastronomy"],"Guanajuato"],
  ["crisenix","Europa en Contrastes","Madrid, París, Ámsterdam y Berlín","europe","circuit","air",12,1599,"USD",["culture","seasonal"],"Europa","Reserva anticipada"],
  ["crisenix","Colombia Viva","Bogotá, cafetales y Cartagena","south_america","vacation_package","air",8,1399,"USD",["culture","gastronomy"],"Colombia"],
  ["crisenix","Valle de Bravo Express","Lago, bosque y tarde libre","mexico","day_tour","ground",1,990,"MXN",["nature","adventure"],"Estado de México"],
  ["boutique","Santorini Íntimo","Una luna de miel entre calderas y mar","europe","custom_trip","air",8,4890,"USD",["romance","premium"],"Grecia","Detalle de bienvenida"],
  ["boutique","Kioto en Calma","Templos, jardines y hospitalidad japonesa","asia","experience","air",9,5790,"USD",["culture","wellness","premium"],"Japón"],
  ["boutique","Patagonia Privada","Glaciares, estancias y cielos australes","south_america","custom_trip","not_included",7,6250,"USD",["adventure","premium"],"Argentina","Traslado privado incluido"],
];
const agencyId = (slug:string) => agencies.find(a=>a.slug===slug)!.id;
const countryBy = (region:string, place:string) => region === "mexico" ? "México" : place === "Europa" ? "España" : place;
const makeDeparture = (travelId:string, idx:number, aid:string, currency:"MXN"|"USD") => {
  const points = departurePoints.filter(p=>p.agencyId===aid).slice(0, idx % 2 ? 3 : 1);
  const start = new Date(Date.UTC(2026, 7 + (idx%3), 9 + idx));
  return [0, 28].map((offset,n) => {
    const date = new Date(start); date.setUTCDate(date.getUTCDate()+offset);
    const id = `${travelId}-dep-${n+1}`;
    return { id, travelId, startDate: date.toISOString(), endDate: new Date(date.getTime()+86400000*((idx%5)+1)).toISOString(), timezone:"America/Mexico_City", capacity:32, reservedSpaces: n ? 27 : 12+idx, availableSpaces: n ? 5 : 20-idx, saleStatus: (n ? "limited":"scheduled") as TravelDeparture["saleStatus"], boardingOptions: points.map((p,pi)=>({ id:`${id}-b-${pi}`, departureId:id, agencyDeparturePointId:p.id, meetingTime: pi ? "05:40":"05:20", departureTime:pi ? "06:00":"05:40", surchargeAmount:pi===1?150:0, surchargeType:(pi===1&&idx%2?"per_booking":"per_person") as "per_booking"|"per_person", currency, capacity:16, availableSpaces:pi===2?2:10, boardingOrder:pi+1, status:(pi===2?"limited":"available") as "limited"|"available" })) };
  });
};
export const travels: TravelProduct[] = catalog.map((row,idx) => {
  const [tenant,title,summary,region,type,transport,days,amount,currency,tags,place,promotion] = row;
  const aid=agencyId(tenant); const id=`trip-${idx+1}`; const cur=currency as "MXN"|"USD";
  const accommodationMode: TravelProduct["accommodationMode"] = days === 1 ? "none" : "hotel_occupancy";
  const pricingOptions: TravelProduct["pricingOptions"] = accommodationMode === "none"
    ? [{id:`${id}-general`,label:"Adulto",occupancy:"general",amount,currency:cur,inventoryImpact:1},{id:`${id}-child`,label:"Menor",occupancy:"child",amount:Math.round(amount*.78),currency:cur,inventoryImpact:1}]
    : [{id:`${id}-general`,label:"Adulto / ocupación doble",occupancy:"double",amount,currency:cur,inventoryImpact:1},{id:`${id}-single`,label:"Ocupación sencilla",occupancy:"single",amount:Math.round(amount*1.28),currency:cur,inventoryImpact:1},{id:`${id}-child`,label:"Menor",occupancy:"child",amount:Math.round(amount*.78),currency:cur,inventoryImpact:1}];
  return { id, agencyId:aid, code:`FT-${String(idx+1).padStart(3,"0")}`, slug:title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""), title, subtitle:summary, summary, description:`Una propuesta original para descubrir ${place} con ritmo equilibrado, acompañamiento y tiempos para disfrutar.`, scope:region==="mexico"?"national":"international", productType:type as TravelProduct["productType"], transportTypes:[transport as TravelProduct["transportTypes"][number]], tags:tags as TravelProduct["tags"], region:region as TravelProduct["region"], countries:[countryBy(region,place)], cities:[place], destinationIds:[`dest-${idx+1}`], categoryIds:[type], durationDays:days, durationNights:Math.max(0,days-1), accommodationMode, featuredImage:image(["1501785888041-af3ef285b470","1507525428034-b723cf961d3e","1500530855697-b586d89ba3ee","1528127269322-539801943592"][idx%4]), gallery:[], includes:["Coordinación durante el recorrido","Experiencias indicadas","Asistencia antes de la salida"], excludes:["Gastos personales","Servicios no especificados"], requirements:["Identificación vigente","Llegar 20 minutos antes"], recommendations:["Equipaje ligero","Calzado cómodo"], policies:{ cancellation:"Cambios sujetos a disponibilidad. Política demostrativa.", payment:"El anticipo reserva provisionalmente el lugar.", responsibility:"Los horarios pueden ajustarse por operación." }, itinerary:Array.from({length:Math.min(days,4)},(_,d)=>({day:d+1,title:d?"Exploración y tiempo personal":"Bienvenida y primer encuentro",description:"Actividades organizadas con pausas y orientación local."})), basePrice:{amount,currency:cur,taxesAmount:cur==="USD"&&idx===6?899:Math.round(amount*.08),taxesIncluded:idx%3!==0,taxesLabel:"Impuestos y cargos",depositAmount:cur==="MXN"?Math.min(2000,Math.round(amount*.3)):Math.round(amount*.25),priceType:"per_person",displayFrom:true}, pricingOptions, departures:makeDeparture(id,idx,aid,cur), extras:[{id:`${id}-extra-1`,name:"Protección flexible demo",price:cur==="MXN"?390:45,currency:cur,pricingMode:"per_booking",optional:true,visibility:"hidden"},{id:`${id}-extra-2`,name:"Experiencia gastronómica",price:cur==="MXN"?650:75,currency:cur,pricingMode:"per_person",optional:true,visibility:"booking_step"}], status:"published", featured:idx%2===0, promotion, availabilityDisplayMode:tenant==="furiver"?"hidden":"status_only", depositPolicy:{enabled:true,type:"fixed",fixedAmount:cur==="MXN"?Math.min(2000,Math.round(amount*.3)):Math.round(amount*.25)}, travelerCategories:agencies.find((item)=>item.id===aid)?.settings.travelerCategories, extraVisibility:tenant==="furiver"?"hidden":"booking_step", allowManualOccupancy:false };
});

travels.forEach((travel) => {
  const double = travel.pricingOptions.find((rate) => rate.occupancy === "double");
  if (!double) return;
  travel.pricingOptions.splice(2, 0,
    { ...double, id: `${travel.id}-triple`, label: "Base triple", occupancy: "triple", amount: Math.round(double.amount * .94) },
    { ...double, id: `${travel.id}-quadruple`, label: "Base cuádruple", occupancy: "quadruple", amount: Math.round(double.amount * .9) },
  );
});

type DemoExpansion = {
  tenant: "furiver" | "crisenix" | "boutique";
  title: string;
  place: string;
  country: string;
  region: TravelProduct["region"];
  type: TravelProduct["productType"];
  transport: TravelProduct["transportTypes"][number];
  days: number;
  amount: number;
  currency: "MXN" | "USD";
  image: number;
  promotion?: string;
};
const demoExpansion: DemoExpansion[] = [
  {tenant:"furiver",title:"Amanecer en Mineral del Chico",place:"Mineral del Chico",country:"México",region:"mexico",type:"magical_town",transport:"ground",days:1,amount:1290,currency:"MXN",image:2,promotion:"Fin de semana"},
  {tenant:"furiver",title:"Grutas y Cañones de Hidalgo",place:"Zimapán",country:"México",region:"mexico",type:"excursion",transport:"ground",days:2,amount:2790,currency:"MXN",image:6},
  {tenant:"furiver",title:"Arena Dorada de Tecolutla",place:"Tecolutla",country:"México",region:"mexico",type:"beach",transport:"ground",days:3,amount:4590,currency:"MXN",image:1,promotion:"Últimos lugares"},
  {tenant:"furiver",title:"Callejones de Taxco",place:"Taxco",country:"México",region:"mexico",type:"magical_town",transport:"ground",days:1,amount:1390,currency:"MXN",image:0},
  {tenant:"furiver",title:"Cascadas de la Sierra Norte",place:"Cuetzalan",country:"México",region:"mexico",type:"short_break",transport:"ground",days:2,amount:3290,currency:"MXN",image:2},
  {tenant:"furiver",title:"Santuario de Mariposas",place:"Valle de Bravo",country:"México",region:"mexico",type:"day_tour",transport:"ground",days:1,amount:1090,currency:"MXN",image:2,promotion:"Temporada 2026"},
  {tenant:"crisenix",title:"Oaxaca Sabores y Textiles",place:"Oaxaca",country:"México",region:"mexico",type:"circuit",transport:"ground",days:5,amount:8990,currency:"MXN",image:0,promotion:"Precio especial"},
  {tenant:"crisenix",title:"Chiapas Selva y Agua",place:"Palenque",country:"México",region:"mexico",type:"circuit",transport:"air",days:6,amount:14990,currency:"MXN",image:2},
  {tenant:"crisenix",title:"Baja Sur entre Mares",place:"La Paz",country:"México",region:"mexico",type:"vacation_package",transport:"air",days:5,amount:17490,currency:"MXN",image:1},
  {tenant:"crisenix",title:"Ruta del Tequila y Agave",place:"Guadalajara",country:"México",region:"mexico",type:"experience",transport:"ground",days:4,amount:7690,currency:"MXN",image:0,promotion:"3x2 en experiencia"},
  {tenant:"crisenix",title:"Huasteca de Agua Turquesa",place:"Ciudad Valles",country:"México",region:"mexico",type:"group_trip",transport:"ground",days:4,amount:8290,currency:"MXN",image:2},
  {tenant:"crisenix",title:"Mérida, Cenotes y Costa",place:"Mérida",country:"México",region:"mexico",type:"vacation_package",transport:"air",days:6,amount:15990,currency:"MXN",image:7},
  {tenant:"crisenix",title:"Huatulco a Tu Ritmo",place:"Huatulco",country:"México",region:"mexico",type:"beach",transport:"air",days:5,amount:13990,currency:"MXN",image:1,promotion:"Incluye traslado"},
  {tenant:"crisenix",title:"Norte Colonial Completo",place:"Zacatecas",country:"México",region:"mexico",type:"circuit",transport:"ground",days:7,amount:12990,currency:"MXN",image:0},
  {tenant:"crisenix",title:"Portugal Atlántico",place:"Lisboa",country:"Portugal",region:"europe",type:"circuit",transport:"air",days:10,amount:1799,currency:"USD",image:3,promotion:"Salida confirmada"},
  {tenant:"crisenix",title:"Andes, Lagos y Viñedos",place:"Santiago",country:"Chile",region:"south_america",type:"circuit",transport:"air",days:9,amount:1649,currency:"USD",image:4},
  {tenant:"crisenix",title:"Caribe de Tres Islas",place:"Bridgetown",country:"Barbados",region:"central_america_caribbean",type:"cruise",transport:"cruise",days:8,amount:1899,currency:"USD",image:7,promotion:"Cabina garantizada"},
  {tenant:"crisenix",title:"Canadá de Costa a Bosque",place:"Vancouver",country:"Canadá",region:"north_america",type:"circuit",transport:"air",days:9,amount:2199,currency:"USD",image:2},
  {tenant:"crisenix",title:"Marruecos de Medinas",place:"Marrakech",country:"Marruecos",region:"africa",type:"circuit",transport:"air",days:11,amount:1999,currency:"USD",image:6},
  {tenant:"crisenix",title:"Turquía entre Continentes",place:"Estambul",country:"Turquía",region:"middle_east",type:"circuit",transport:"air",days:12,amount:1849,currency:"USD",image:3,promotion:"Impuestos preferentes"},
  {tenant:"boutique",title:"Amalfi en Residencia",place:"Ravello",country:"Italia",region:"europe",type:"custom_trip",transport:"air",days:8,amount:6490,currency:"USD",image:8,promotion:"Diseño privado"},
  {tenant:"boutique",title:"Provenza para Dos",place:"Aix-en-Provence",country:"Francia",region:"europe",type:"experience",transport:"mixed",days:7,amount:5890,currency:"USD",image:3},
  {tenant:"boutique",title:"Bali Ritual y Descanso",place:"Ubud",country:"Indonesia",region:"asia",type:"custom_trip",transport:"air",days:10,amount:7190,currency:"USD",image:5},
  {tenant:"boutique",title:"Islas Griegas en Velero",place:"Milos",country:"Grecia",region:"europe",type:"cruise",transport:"cruise",days:9,amount:7890,currency:"USD",image:8,promotion:"Navegación privada"},
  {tenant:"boutique",title:"Buenos Aires de Autor",place:"Buenos Aires",country:"Argentina",region:"south_america",type:"experience",transport:"air",days:6,amount:4290,currency:"USD",image:4},
];
demoExpansion.forEach((spec, offset) => {
  const source = travels.find((travel) => travel.agencyId === agencyId(spec.tenant))!;
  const id = `trip-${travels.length + 1}`;
  const departures = makeDeparture(id, travels.length + offset, agencyId(spec.tenant), spec.currency);
  if (offset % 7 === 0) {
    departures[1].saleStatus = "sold_out";
    departures[1].availableSpaces = 0;
  }
  if (spec.tenant === "furiver" && spec.title === "Santuario de Mariposas") {
    departures[0].boardingOptions = [];
    departures[0].saleStatus = "scheduled";
    departures[0].availableSpaces = 20;
  }
  travels.push({
    ...source,
    id,
    agencyId: agencyId(spec.tenant),
    code: `FT-${String(travels.length + 1).padStart(3, "0")}`,
    slug: spec.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    title: spec.title,
    subtitle: `Una ruta original por ${spec.place}`,
    summary: `Descubre ${spec.place} con una operación clara y momentos bien elegidos.`,
    description: `Una experiencia original por ${spec.place}, diseñada para equilibrar descubrimiento, descanso y acompañamiento.`,
    scope: spec.region === "mexico" ? "national" : "international",
    productType: spec.type,
    transportTypes: [spec.transport],
    region: spec.region,
    countries: [spec.country],
    cities: [spec.place, ...(spec.days > 7 ? ["Ruta panorámica", "Centro histórico"] : [])],
    destinationIds: [`dest-${travels.length + 1}`],
    categoryIds: [spec.type],
    durationDays: spec.days,
    durationNights: Math.max(0, spec.days - 2),
    accommodationMode: spec.days === 1 ? "none" : "hotel_occupancy",
    featuredImage: visualLibrary[spec.image],
    basePrice: {
      amount: spec.amount,
      currency: spec.currency,
      taxesAmount: spec.currency === "USD" ? 699 + (offset % 3) * 100 : Math.round(spec.amount * 0.08),
      taxesIncluded: offset % 4 !== 0,
      taxesLabel: "Impuestos y cargos",
      depositAmount: spec.currency === "USD" ? Math.round(spec.amount * 0.22) : Math.min(3000, Math.round(spec.amount * 0.28)),
      priceType: "per_person",
      displayFrom: true,
    },
    pricingOptions: spec.days === 1
      ? [
          { id: `${id}-rate-adult`, label: "Adulto", occupancy: "general", amount: spec.amount, currency: spec.currency, inventoryImpact: 1 },
          { id: `${id}-rate-child`, label: "Menor", occupancy: "child", amount: Math.round(spec.amount * .78), currency: spec.currency, inventoryImpact: 1 },
        ]
      : [
          { id: `${id}-rate-single`, label: "Base sencilla", occupancy: "single", amount: Math.round(spec.amount * 1.28), currency: spec.currency, inventoryImpact: 1 },
          { id: `${id}-rate-double`, label: "Base doble", occupancy: "double", amount: spec.amount, currency: spec.currency, inventoryImpact: 1 },
          { id: `${id}-rate-triple`, label: "Base triple", occupancy: "triple", amount: Math.round(spec.amount * .94), currency: spec.currency, inventoryImpact: 1 },
          { id: `${id}-rate-quadruple`, label: "Base cuádruple", occupancy: "quadruple", amount: Math.round(spec.amount * .9), currency: spec.currency, inventoryImpact: 1 },
          { id: `${id}-rate-child`, label: "Menor", occupancy: "child", amount: Math.round(spec.amount * .78), currency: spec.currency, inventoryImpact: 1 },
        ],
    departures,
    extras: source.extras.map((extra, index) => ({
      ...extra,
      id: `${id}-extra-${index}`,
      price: spec.currency === "USD" ? 55 + index * 40 : 450 + index * 300,
      currency: spec.currency,
    })),
    featured: offset % 3 === 0,
    promotion: spec.promotion,
  });
});

type CrisenixSourceSpec = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  sourceUrl: string;
  cities: string[];
  durationDays: number;
  durationNights: number;
  productType: TravelProduct["productType"];
  transportTypes: TravelProduct["transportTypes"];
  accommodationMode: TravelProduct["accommodationMode"];
  featuredImage: string;
  dates: string[];
  pricingOptions: Array<{
    occupancy: TravelProduct["pricingOptions"][number]["occupancy"];
    label: string;
    amount: number;
    currency: "MXN" | "USD";
  }>;
  itinerary: Array<{
    title: string;
    description: string;
    stops: string[];
  }>;
  includes: string[];
  excludes: string[];
  recommendations: string[];
  difficulty: "facil" | "moderado";
  airport?: boolean;
  preTripSegment?: TravelProduct["preTripSegment"];
  taxesIncluded?: boolean;
  foreignCurrencyPricing?: TravelProduct["foreignCurrencyPricing"];
};

const sourceTripSpecs: CrisenixSourceSpec[] = [
  {
    id: "crisenix-muralla-china-mexicana",
    slug: "muralla-china-mexicana",
    title: "Muralla China Mexicana",
    summary: "Una escapada por Xicotepec, la Cruz Celestial y una finca cafetalera de la Huasteca Poblana.",
    description: "Recorre el Pueblo Mágico de Xicotepec, contempla la sierra desde la Cruz Celestial y conoce una finca donde el café se explica de la tierra a la taza.",
    sourceUrl: "https://crisenix.com.mx/tour/muralla-china-mexicana/",
    cities: ["Xicotepec", "Cruz Celestial", "Muralla China Mexicana", "Finca El Paraíso"],
    durationDays: 1, durationNights: 0, productType: "day_tour",
    transportTypes: ["ground"], accommodationMode: "none",
    featuredImage: "/images/destination-town.webp",
    dates: ["2026-04-25", "2026-09-19"],
    pricingOptions: [{ occupancy: "general", label: "Tarifa general", amount: 1170, currency: "MXN" }],
    itinerary: [{
      title: "Xicotepec, miradores y café de la sierra",
      description: "Salida desde Ciudad de México hacia Xicotepec, tiempo para conocer el pueblo y ascenso al Mirador de la Cruz Celestial. El recorrido continúa por el tramo panorámico conocido como Muralla China Mexicana y cierra con una visita cafetalera antes del regreso.",
      stops: ["Ciudad de México", "Xicotepec", "Cruz Celestial", "Muralla China Mexicana", "Finca El Paraíso"],
    }],
    includes: ["Transporte terrestre", "Visita al Mirador de la Cruz Celestial", "Visita a Finca Cafetalera El Paraíso", "Coordinación de grupo desde Ciudad de México"],
    excludes: ["Alimentos y bebidas", "Propinas", "Gastos personales", "Servicios no mencionados"],
    recommendations: ["Calzado adecuado para caminata", "Chamarra y bloqueador solar", "Efectivo y batería externa"],
    difficulty: "moderado",
  },
  {
    id: "crisenix-guadalajara-mariachi",
    slug: "guadalajara-mariachi-y-tradicion",
    title: "Guadalajara, Mariachi y Tradición",
    summary: "Historia tapatía, cultura ranchera, tequila y mariachi en una salida de dos días.",
    description: "Una ruta por el centro de Guadalajara, el Hospicio Cabañas, un rancho emblemático y una hacienda tequilera con degustación y música.",
    sourceUrl: "https://crisenix.com.mx/tour/guadalajara-guadalajara-mariachi-y-tradicion-en-hacienda-los-3-potrillos/",
    cities: ["Guadalajara", "Hospicio Cabañas", "Rancho Los 3 Potrillos", "Tequila"],
    durationDays: 2, durationNights: 1, productType: "short_break",
    transportTypes: ["ground"], accommodationMode: "hotel_occupancy",
    featuredImage: "/images/destination-town.webp",
    dates: ["2026-03-13", "2026-09-11"],
    pricingOptions: [
      { occupancy: "single", label: "Base sencilla", amount: 4190, currency: "MXN" },
      { occupancy: "double", label: "Base doble", amount: 3490, currency: "MXN" },
      { occupancy: "triple", label: "Base triple", amount: 3340, currency: "MXN" },
      { occupancy: "quadruple", label: "Base cuádruple", amount: 3190, currency: "MXN" },
      { occupancy: "child", label: "Menor", amount: 2690, currency: "MXN" },
    ],
    preTripSegment: { title: "Traslado nocturno previo", description: "Salida nocturna desde Ciudad de México hacia Guadalajara. Este traslado operativo no incrementa la duración comercial de dos días." },
    itinerary: [
      { title: "Guadalajara y tradición ranchera", description: "Recorrido por el centro histórico, la Catedral, el Teatro Degollado y el Hospicio Cabañas. La jornada continúa en el Rancho Los 3 Potrillos antes del registro en el hotel.", stops: ["Guadalajara", "Hospicio Cabañas", "Rancho Los 3 Potrillos"] },
      { title: "Tequila, hacienda y mariachi", description: "Después del desayuno, visita a Tequila y a una hacienda para conocer el proceso de producción, realizar una degustación y disfrutar mariachi antes del regreso.", stops: ["Tequila", "Hacienda tequilera", "Ciudad de México"] },
    ],
    includes: ["Transporte terrestre", "Una noche de hospedaje", "Un desayuno", "Hacienda tequilera con degustación y mariachi", "Acceso al Hospicio Cabañas", "Coordinación desde Ciudad de México"],
    excludes: ["Alimentos y bebidas no indicados", "Propinas", "Gastos personales", "Servicios no mencionados"],
    recommendations: ["Calzado cómodo y chamarra", "Bloqueador y agua", "Efectivo y batería externa"],
    difficulty: "facil",
  },
  {
    id: "crisenix-playas-riscos-veracruz",
    slug: "playas-y-riscos-de-veracruz",
    title: "Playas y Riscos de Veracruz",
    summary: "Los Tuxtlas entre selva, manglares, playas escondidas y riscos frente al Golfo.",
    description: "Tres días para conocer Catemaco, Nanciyaga, Sontecomapan, Barra de Oro y la costa rocosa de Veracruz.",
    sourceUrl: "https://crisenix.com.mx/tour/playas-y-riscos-de-veracruz-los-tuxtlas-y-roca-partida/",
    cities: ["Catemaco", "Nanciyaga", "Sontecomapan", "Barra de Oro", "Roca Partida", "Veracruz"],
    durationDays: 3, durationNights: 2, productType: "beach",
    transportTypes: ["ground"], accommodationMode: "hotel_occupancy",
    featuredImage: "/images/destination-beach.webp",
    dates: ["2026-05-14", "2026-07-16", "2026-12-30"],
    pricingOptions: [
      { occupancy: "single", label: "Base sencilla", amount: 6390, currency: "MXN" },
      { occupancy: "double", label: "Base doble", amount: 4990, currency: "MXN" },
      { occupancy: "triple", label: "Base triple", amount: 4790, currency: "MXN" },
      { occupancy: "quadruple", label: "Base cuádruple", amount: 4590, currency: "MXN" },
      { occupancy: "child", label: "Menor", amount: 3790, currency: "MXN" },
    ],
    preTripSegment: { title: "Traslado nocturno previo", description: "Salida nocturna desde Ciudad de México hacia Los Tuxtlas; no se contabiliza como día comercial." },
    itinerary: [
      { title: "Montepío y llegada a Catemaco", description: "Primera jornada de costa en Playa Montepío y traslado posterior a Catemaco para el registro de hospedaje.", stops: ["Playa Montepío", "Catemaco"] },
      { title: "Catemaco, Nanciyaga y manglares", description: "Recorrido por la laguna de Catemaco, la reserva de Nanciyaga y los canales de Sontecomapan entre vegetación y manglares.", stops: ["Catemaco", "Nanciyaga", "Sontecomapan"] },
      { title: "Barra de Oro y Roca Partida", description: "Navegación por Barra de Oro hacia islas, cuevas y Playa Escondida. Roca Partida se mantiene como actividad opcional y el regreso incluye una parada en Veracruz.", stops: ["Barra de Oro", "Playa Escondida", "Roca Partida", "Veracruz"] },
    ],
    includes: ["Transporte terrestre", "Dos noches de hospedaje", "Dos desayunos", "Recorridos en lancha indicados", "Acceso a Nanciyaga", "Coordinación de grupo"],
    excludes: ["Alimentos y bebidas no indicados", "Actividad opcional en Roca Partida", "Propinas", "Gastos personales"],
    recommendations: ["Equipaje de mano para la llegada a playa", "Repelente y bloqueador biodegradables", "Traje de baño y calzado acuático", "Efectivo y batería externa"],
    difficulty: "moderado",
  },
  {
    id: "crisenix-costas-oaxaca",
    slug: "costas-de-oaxaca",
    title: "Costas de Oaxaca",
    summary: "Puerto Escondido, Manialtepec, Mazunte, Zipolite y Huatulco en una ruta de cuatro días.",
    description: "Una travesía terrestre por playas, miradores y comunidades costeras de Oaxaca, con tiempo de mar y naturaleza.",
    sourceUrl: "https://crisenix.com.mx/tour/costas-de-oaxaca/",
    cities: ["Puerto Escondido", "Manialtepec", "Mazunte", "Zipolite", "Huatulco", "Playa La Entrega"],
    durationDays: 4, durationNights: 3, productType: "beach",
    transportTypes: ["ground"], accommodationMode: "hotel_occupancy",
    featuredImage: "/images/destination-caribbean.webp",
    dates: ["2026-04-01", "2026-07-22", "2026-09-02", "2026-12-25"],
    pricingOptions: [
      { occupancy: "single", label: "Base sencilla", amount: 9390, currency: "MXN" },
      { occupancy: "double", label: "Base doble", amount: 6990, currency: "MXN" },
      { occupancy: "triple", label: "Base triple", amount: 6790, currency: "MXN" },
      { occupancy: "quadruple", label: "Base cuádruple", amount: 6590, currency: "MXN" },
      { occupancy: "child", label: "Menor", amount: 4990, currency: "MXN" },
    ],
    preTripSegment: { title: "Traslado nocturno previo", description: "Salida nocturna desde Ciudad de México hacia la costa de Oaxaca; no suma un día al programa comercial." },
    itinerary: [
      { title: "Puerto Angelito y Manialtepec", description: "Llegada a Puerto Angelito, registro de hospedaje y navegación programada en la Laguna de Manialtepec.", stops: ["Puerto Angelito", "Laguna de Manialtepec"] },
      { title: "Mazunte, Zipolite y Playa del Panteón", description: "Recorrido por Mazunte, Punta Cometa como actividad opcional, Zipolite y Playa del Panteón antes del traslado hacia Huatulco.", stops: ["Mazunte", "Punta Cometa", "Zipolite", "Playa del Panteón", "Huatulco"] },
      { title: "Miradores y Playa El Maguey", description: "Panorámica por los miradores de Huatulco y tiempo de playa en El Maguey.", stops: ["Huatulco", "Playa El Maguey"] },
      { title: "Playa La Entrega y regreso", description: "Mañana en Playa La Entrega, con snorkel opcional, y salida nocturna de regreso a Ciudad de México.", stops: ["Playa La Entrega", "Ciudad de México"] },
    ],
    includes: ["Transporte terrestre", "Tres noches de hospedaje", "Tres desayunos", "Lancha en Manialtepec", "Accesos indicados", "Coordinación de grupo"],
    excludes: ["Alimentos y bebidas no indicados", "Actividades opcionales", "Propinas", "Gastos personales"],
    recommendations: ["Calzado antiderrapante y acuático", "Traje de baño y chamarra ligera", "Bloqueador, efectivo y batería externa"],
    difficulty: "moderado",
  },
  {
    id: "crisenix-velada-astronomica-vip",
    slug: "velada-astronomica-vip",
    title: "Velada Astronómica VIP",
    summary: "Cielos del norte, Cuatro Ciénegas, dunas, vino y paisajes de montaña en una experiencia Fly & Drive.",
    description: "Una ruta premium por los ecosistemas de Cuatro Ciénegas, Parras, Saltillo, Arteaga, Santiago y Monterrey.",
    sourceUrl: "https://crisenix.com.mx/tour/velada-astronomica-vip/",
    cities: ["Monterrey", "Cuatro Ciénegas", "Dunas de Yeso", "Poza Azul", "Parras", "Saltillo", "Monterreal", "Santiago"],
    durationDays: 5, durationNights: 4, productType: "vacation_package",
    transportTypes: ["air", "ground"], accommodationMode: "hotel_occupancy",
    featuredImage: "/images/destination-mountain.webp",
    dates: ["2026-04-11", "2026-05-09", "2026-06-20", "2026-07-25", "2026-08-22", "2026-09-19", "2026-10-10", "2026-11-07"],
    pricingOptions: [
      { occupancy: "single", label: "Base sencilla", amount: 22990, currency: "MXN" },
      { occupancy: "double", label: "Base doble", amount: 19390, currency: "MXN" },
      { occupancy: "triple", label: "Base triple", amount: 19090, currency: "MXN" },
      { occupancy: "child", label: "Menor de 3 a 11 años", amount: 15500, currency: "MXN" },
    ],
    itinerary: [
      { title: "Monterrey y mármol bajo las estrellas", description: "Vuelo hacia Monterrey, traslado a Cuatro Ciénegas, visita a Minas de Mármol y experiencia nocturna programada antes del alojamiento.", stops: ["Monterrey", "Cuatro Ciénegas", "Minas de Mármol"] },
      { title: "Dunas, pozas y velada astronómica", description: "Exploración de Dunas de Yeso, Poza Azul y Río Mezquite. Por la noche, velada astronómica con expositores.", stops: ["Dunas de Yeso", "Poza Azul", "Río Mezquite"] },
      { title: "Parras, vino y tradición", description: "Ruta a Parras de la Fuente, visita y degustación en Casa Madero y continuación hacia Saltillo.", stops: ["Parras", "Casa Madero", "Saltillo"] },
      { title: "Museo del Desierto y Monterreal", description: "Visita al Museo del Desierto y recorrido de naturaleza por Monterreal antes de seguir a Monterrey.", stops: ["Museo del Desierto", "Monterreal", "Monterrey"] },
      { title: "Santiago y regreso", description: "Visita a Cola de Caballo y Santiago; traslado posterior al aeropuerto para el vuelo de regreso.", stops: ["Cola de Caballo", "Santiago", "Monterrey"] },
    ],
    includes: ["Vuelos redondos Ciudad de México–Monterrey", "Traslados del itinerario", "Cuatro noches de hospedaje", "Cuatro desayunos", "Velada astronómica", "Visita y degustación en Casa Madero", "Museo del Desierto", "Asistencia, impuestos y coordinación"],
    excludes: ["Alimentos y bebidas no indicados", "Propinas", "Gastos personales", "Servicios no mencionados"],
    recommendations: ["Chamarra ligera y calzado cómodo", "Bloqueador y gorra", "Efectivo y batería externa"],
    difficulty: "facil", airport: true, taxesIncluded: true,
  },
  {
    id: "crisenix-chepe-premier",
    slug: "chepe-premier-barrancas-del-cobre",
    title: "Chepe Premier: Barrancas del Cobre",
    summary: "Una travesía Fly & Train por El Fuerte, el Chepe, las barrancas, Creel y Chihuahua.",
    description: "Seis días entre paisajes ferroviarios, miradores serranos, pueblos históricos y naturaleza del norte de México.",
    sourceUrl: "https://crisenix.com.mx/tour/chepe-premier-barrancas-del-cobre-con-estilo/",
    cities: ["El Fuerte", "Cerocahui", "Divisadero", "Creel", "Lago de Arareko", "Basaseachi", "Chihuahua"],
    durationDays: 6, durationNights: 5, productType: "circuit",
    transportTypes: ["air", "train", "ground"], accommodationMode: "hotel_occupancy",
    featuredImage: "/images/destination-canyon.webp",
    dates: ["2026-04-12", "2026-07-19", "2026-10-25", "2026-12-20", "2026-12-27"],
    pricingOptions: [
      { occupancy: "single", label: "Base sencilla", amount: 34900, currency: "MXN" },
      { occupancy: "double", label: "Base doble", amount: 27900, currency: "MXN" },
      { occupancy: "triple", label: "Base triple", amount: 27300, currency: "MXN" },
      { occupancy: "child", label: "Menor de 3 a 11 años", amount: 20890, currency: "MXN" },
    ],
    itinerary: [
      { title: "El Fuerte, historia y tradición", description: "Vuelo hacia Los Mochis y traslado al Pueblo Mágico de El Fuerte para recorrer su centro histórico.", stops: ["Los Mochis", "El Fuerte"] },
      { title: "El Chepe hacia la Sierra Tarahumara", description: "Trayecto en Chepe Primera Clase hasta Bahuichivo y continuación a Cerocahui.", stops: ["El Fuerte", "Bahuichivo", "Cerocahui"] },
      { title: "Cerro del Gallego y Divisadero", description: "Jornada de miradores en el Cerro del Gallego y traslado a Divisadero entre panorámicas de las barrancas.", stops: ["Cerro del Gallego", "Divisadero"] },
      { title: "Parque de Aventura y Creel", description: "Teleférico, tiempo para actividades opcionales y recorrido por el Valle de los Hongos y Lago de Arareko antes de llegar a Creel.", stops: ["Parque de Aventura", "Valle de los Hongos", "Lago de Arareko", "Creel"] },
      { title: "Basaseachi y cultura menonita", description: "Visita a la Cascada de Basaseachi, panorámica por una comunidad menonita y traslado a Chihuahua.", stops: ["Cascada de Basaseachi", "Cuauhtémoc", "Chihuahua"] },
      { title: "Chihuahua y regreso", description: "Recorrido panorámico por la ciudad y traslado al aeropuerto para el vuelo de regreso.", stops: ["Chihuahua"] },
    ],
    includes: ["Vuelos Ciudad de México–Los Mochis y Chihuahua–Ciudad de México", "Traslados del itinerario", "Cinco noches de hospedaje", "Cinco desayunos", "Chepe Primera Clase", "Cerro del Gallego y teleférico", "Accesos indicados", "Asistencia, impuestos y coordinación"],
    excludes: ["Alimentos y bebidas no indicados", "Actividades opcionales en Parque de Aventura", "Propinas", "Gastos personales"],
    recommendations: ["Chamarra y calzado cómodo", "Gorra y bloqueador", "Efectivo y batería externa"],
    difficulty: "facil", airport: true, taxesIncluded: true,
  },
  {
    id: "crisenix-patagonia-fin-del-mundo",
    slug: "patagonia-encuentro-con-el-fin-del-mundo",
    title: "Patagonia: Encuentro con el Fin del Mundo",
    summary: "Buenos Aires, Bariloche, El Calafate y Ushuaia en una ruta aérea de trece días.",
    description: "Glaciares, lagos, bosques fueguinos y ciudades australes en un circuito por la Patagonia argentina.",
    sourceUrl: "https://crisenix.com.mx/tour/patagonia-encuentro-con-el-fin-del-mundo/",
    cities: ["Buenos Aires", "Bariloche", "San Martín de los Andes", "El Calafate", "Ushuaia"],
    durationDays: 13, durationNights: 12, productType: "circuit",
    transportTypes: ["air", "ground"], accommodationMode: "hotel_occupancy",
    featuredImage: "/images/destination-patagonia.webp",
    dates: ["2026-10-02"],
    pricingOptions: [{ occupancy: "double", label: "Base doble", amount: 5290, currency: "USD" }],
    itinerary: [
      { title: "Rumbo al sur del mundo", description: "Vuelo desde México hacia Buenos Aires, recepción y traslado al hotel.", stops: ["Ciudad de México", "Buenos Aires"] },
      { title: "Buenos Aires, historia y tango", description: "Recorrido panorámico por barrios y espacios representativos, seguido de una cena show de tango.", stops: ["Buenos Aires"] },
      { title: "De Buenos Aires a Bariloche", description: "Traslado al aeropuerto, vuelo a Bariloche y tiempo libre después del registro.", stops: ["Buenos Aires", "Bariloche"] },
      { title: "Circuito Chico", description: "Ruta panorámica por el Lago Nahuel Huapi, lagos Moreno, Llao Llao y miradores de Bariloche.", stops: ["Bariloche", "Lago Nahuel Huapi", "Llao Llao"] },
      { title: "La Ruta de los Siete Lagos", description: "Excursión hacia San Martín de los Andes por paisajes lacustres de los parques Nahuel Huapi y Lanín.", stops: ["Bariloche", "Ruta de los Siete Lagos", "San Martín de los Andes"] },
      { title: "Rumbo al mundo del hielo", description: "Vuelo hacia El Calafate, recepción y traslado al hotel.", stops: ["Bariloche", "El Calafate"] },
      { title: "Perito Moreno y Safari Náutico", description: "Jornada en el Parque Nacional Los Glaciares, navegación y pasarelas frente al Glaciar Perito Moreno.", stops: ["El Calafate", "Glaciar Perito Moreno"] },
      { title: "El Calafate a tu ritmo", description: "Día libre con alternativas opcionales sujetas a disponibilidad y contratación.", stops: ["El Calafate"] },
      { title: "Ushuaia, el fin del continente", description: "Vuelo a Ushuaia, recepción y traslado al hotel.", stops: ["El Calafate", "Ushuaia"] },
      { title: "Tierra del Fuego", description: "Recorrido por el Parque Nacional Tierra del Fuego, bosques, lagunas y Bahía Lapataia.", stops: ["Ushuaia", "Parque Nacional Tierra del Fuego", "Bahía Lapataia"] },
      { title: "Aventuras australes", description: "Día libre para descubrir Ushuaia o contratar navegaciones opcionales por el Canal Beagle.", stops: ["Ushuaia"] },
      { title: "Regreso a Buenos Aires", description: "Vuelo de Ushuaia a Buenos Aires y traslado al hotel.", stops: ["Ushuaia", "Buenos Aires"] },
      { title: "Hasta pronto, Argentina", description: "Traslado al aeropuerto y vuelo de regreso a México.", stops: ["Buenos Aires", "Ciudad de México"] },
    ],
    includes: ["Vuelos internacionales y domésticos indicados", "Doce noches de hospedaje", "Doce desayunos", "Recorridos y excursiones descritos", "Traslados", "Seguro de asistencia", "Guía de habla hispana", "Impuestos y representación de grupo"],
    excludes: ["Alimentos y bebidas no indicados", "Gastos personales y extras de hotel", "Tours opcionales", "Servicios no mencionados"],
    recommendations: ["Pasaporte con vigencia suficiente y requisitos migratorios verificados", "Ropa térmica por capas e impermeable", "Calzado cómodo y documentación de viaje"],
    difficulty: "moderado", airport: true, taxesIncluded: true,
    foreignCurrencyPricing: {
      pricingCurrency: "USD", settlementCurrency: "USD",
      checkoutChargeCurrency: "MXN", convertDepositAtCheckout: true,
      balanceCurrency: "USD", displayCurrencyMode: "source_and_estimated_mxn",
    },
  },
];

const sourceDeparture = (
  spec: CrisenixSourceSpec,
  date: string,
  index: number,
): TravelDeparture => {
  const start = new Date(`${date}T12:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Math.max(0, spec.durationDays - 1));
  const departureId = `${spec.id}-departure-${index + 1}`;
  const allowedPointIds = spec.airport ? ["p9"] : ["p4", "p5", "p6", "p8"];
  return {
    id: departureId,
    travelId: spec.id,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    timezone: "America/Mexico_City",
    capacity: 40,
    reservedSpaces: 0,
    availableSpaces: 40,
    saleStatus: "scheduled",
    depositPolicy: { enabled: true, type: "percentage", percentage: 30 },
    boardingOptions: departurePoints
      .filter((point) => allowedPointIds.includes(point.id))
      .map((point, pointIndex) => ({
        id: `${departureId}-boarding-${point.id}`,
        departureId,
        agencyDeparturePointId: point.id,
        meetingTime: "Por confirmar",
        departureTime: "Por confirmar",
        surchargeAmount: 0,
        surchargeType: "per_booking",
        currency: spec.pricingOptions[0].currency,
        boardingOrder: pointIndex + 1,
        status: "available",
      })),
  };
};

const sourceTrips = sourceTripSpecs.map((spec): TravelProduct => {
  const referenceRate =
    spec.pricingOptions.find((rate) => rate.occupancy === "double") ??
    spec.pricingOptions[0];
  const currency = referenceRate.currency;
  return {
    id: spec.id,
    agencyId: "a-crisenix",
    code: `CRX-${spec.durationDays}-${spec.id.slice(-4).toUpperCase()}`,
    slug: spec.slug,
    title: spec.title,
    subtitle: spec.summary,
    summary: spec.summary,
    description: spec.description,
    scope: spec.foreignCurrencyPricing ? "international" : "national",
    productType: spec.productType,
    transportTypes: spec.transportTypes,
    tags: spec.foreignCurrencyPricing ? ["adventure", "culture"] : ["culture", "nature"],
    region: spec.foreignCurrencyPricing ? "south_america" : "mexico",
    countries: spec.foreignCurrencyPricing ? ["Argentina"] : ["México"],
    cities: spec.cities,
    destinationIds: [`destination-${spec.id}`],
    categoryIds: [spec.productType],
    durationDays: spec.durationDays,
    durationNights: spec.durationNights,
    accommodationMode: spec.accommodationMode,
    featuredImage: spec.featuredImage,
    gallery: [
      spec.featuredImage,
      spec.foreignCurrencyPricing ? "/images/destination-mountain.webp" : "/images/destination-town.webp",
      spec.transportTypes.includes("air") ? "/images/destination-canyon.webp" : "/images/destination-beach.webp",
    ],
    includes: spec.includes,
    excludes: spec.excludes,
    requirements: spec.foreignCurrencyPricing
      ? ["Pasaporte vigente", "Revisar requisitos migratorios antes de reservar"]
      : ["Identificación vigente", "Confirmar disponibilidad antes de pagar"],
    recommendations: spec.recommendations,
    policies: {
      cancellation: "Cambios y cancelaciones sujetos a las condiciones confirmadas al reservar.",
      payment: "Anticipo de 30%; los plazos de liquidación se confirman con la salida.",
      responsibility: "El itinerario puede ajustarse por condiciones climáticas, logísticas u operativas.",
    },
    itinerary: spec.itinerary.map((day, index) => ({
      id: `${spec.id}-day-${index + 1}`,
      day: index + 1,
      dayNumber: index + 1,
      order: index + 1,
      title: day.title,
      description: day.description,
      stops: day.stops.map((name, stopIndex) => ({
        id: `${spec.id}-day-${index + 1}-stop-${stopIndex + 1}`,
        name,
        order: stopIndex + 1,
      })),
      images: index < 3 ? [{
        id: `${spec.id}-day-${index + 1}-image`,
        url: index === 0 ? spec.featuredImage : visualLibrary[(index + spec.durationDays) % visualLibrary.length],
        alt: `${spec.title}: ${day.title}`,
        order: 1,
      }] : [],
    })),
    basePrice: {
      amount: referenceRate.amount,
      currency,
      taxesIncluded: Boolean(spec.taxesIncluded),
      taxesLabel: "Impuestos",
      ...(spec.taxesIncluded ? { taxesAmount: 0 } : {}),
      depositAmount: Math.round(referenceRate.amount * .3),
      priceType: "per_person",
      displayFrom: true,
    },
    pricingOptions: spec.pricingOptions.map((rate, index) => ({
      id: `${spec.id}-rate-${rate.occupancy}`,
      ...rate,
      inventoryImpact: 1,
      ...(spec.accommodationMode === "hotel_occupancy" ? { maxGuestsPerRoom: 4 } : {}),
    })),
    departures: spec.dates.map((date, index) => sourceDeparture(spec, date, index)),
    extras: [],
    status: "published",
    featured: true,
    availabilityDisplayMode: "status_only",
    depositPolicy: { enabled: true, type: "percentage", percentage: 30 },
    travelerCategories: [
      { id: `${spec.id}-adult`, label: "Adultos", minAge: 12, pricingRule: "adult", active: true, order: 1 },
      { id: `${spec.id}-child`, label: "Menores", minAge: 3, maxAge: 11, pricingRule: "child", active: spec.pricingOptions.some((rate) => rate.occupancy === "child"), order: 2 },
    ],
    extraVisibility: "hidden",
    allowManualOccupancy: false,
    preTripSegment: spec.preTripSegment,
    sourceReference: {
      provider: "Crisenix",
      sourceUrl: spec.sourceUrl,
      reviewedAt: "2026-07-26",
    },
    foreignCurrencyPricing: spec.foreignCurrencyPricing,
    seo: {
      title: `${spec.title} | Crisenix Demo`,
      description: spec.summary,
      keywords: [...spec.cities.slice(0, 4), "viaje demo"],
    },
  };
});
travels.push(...sourceTrips);

const sectionOrder = [
  "summary", "video", "gallery", "itinerary", "included", "map", "departures", "rates",
  "recommendations", "departure_points", "important_information", "faq", "related_trips",
] as const;
const sectionLabels: Record<(typeof sectionOrder)[number], string> = {
  summary: "Resumen", video: "Video", gallery: "Galería", itinerary: "Itinerario",
  included: "Incluye", map: "Ruta", departures: "Fechas", rates: "Tarifas", recommendations: "Recomendaciones",
  departure_points: "Puntos de salida", important_information: "Información importante",
  faq: "Preguntas frecuentes", related_trips: "Viajes relacionados",
};

function configureTripPage(trip: TravelProduct, options: { video?: boolean; lead?: boolean; airport?: boolean; route?: boolean }) {
  trip.pageConfiguration = {
    sections: sectionOrder.map((type, index) => ({
      id: `${trip.id}-${type}`, type, enabled: type !== "video" || Boolean(options.video),
      order: index + 1, anchorLabel: sectionLabels[type],
      showInStickyNavigation: !["video", "related_trips"].includes(type),
      themeVariant: type === "video" ? "dark" : "light",
    })),
  };
  trip.heroMedia = { type: "image", imageUrl: trip.featuredImage, imageAlt: `Vista de ${trip.cities[0]}`, focalPoint: { x: 50, y: 45 }, overlay: .55 };
  trip.summaryContent = {
    shortDescription: trip.summary, showDuration: true, showUpcomingDepartures: true,
    showVisitedDestinations: true, showStartingPrice: true, maxUpcomingDepartures: 3, maxVisitedDestinations: 5,
  };
  trip.galleryImages = [trip.featuredImage, ...trip.gallery].filter(Boolean).slice(0, 5).map((url, index) => ({
    id: `${trip.id}-gallery-${index + 1}`, url, alt: `${trip.title}, escena ${index + 1}`,
    order: index + 1, featured: index === 0,
  }));
  trip.itinerary = trip.itinerary.map((day, index) => ({
    ...day, id: `${trip.id}-day-${day.day}`, dayNumber: day.day, order: index + 1,
    shortDescription: day.description.slice(0, 115),
    ...(!trip.sourceReference
      ? { startTime: index === 0 ? "07:00" : "09:00" }
      : {}),
    stops: day.stops?.length
      ? day.stops
      : [
          { id: `${trip.id}-stop-${index}-1`, name: trip.cities[index % trip.cities.length] ?? trip.cities[0], order: 1 },
          ...(trip.cities[index + 1] ? [{ id: `${trip.id}-stop-${index}-2`, name: trip.cities[index + 1], order: 2 }] : []),
        ],
    highlights: day.activities?.slice(0, 3) ?? ["Acompañamiento durante la ruta"],
    images: index < 2 ? [{ id: `${trip.id}-day-image-${index}`, url: trip.gallery[index] ?? trip.featuredImage, alt: day.title, order: 1 }] : [],
  }));
  trip.itinerarySettings = {
    displayMode: trip.agencyId === "a-boutique" ? "all_open" : "first_open",
    allowExpandAll: true, allowCollapseAll: true, showTimes: true, showImages: true,
    showStops: true, showHighlights: true, showMeals: true, showAccommodation: true,
  };
  trip.itineraryDownload = {
    enabled: true, fileUrl: "/documents/itinerario-demo.txt", fileName: `itinerario-${trip.slug}.txt`,
    fileType: "other", fileSizeLabel: "3 KB", requireLeadForm: Boolean(options.lead),
    leadFormFields: options.lead ? ["name", "whatsapp"] : [], title: "Lleva la ruta contigo",
    description: options.lead ? "Recibe el itinerario después de compartir tus datos." : "Descarga el programa para consultarlo sin conexión.",
  };
  trip.inclusionsContent = {
    included: trip.includes.map((text, index) => ({ id: `${trip.id}-in-${index}`, text, icon: index ? "check" : "transport", order: index + 1 })),
    excluded: trip.excludes.map((text, index) => ({ id: `${trip.id}-out-${index}`, text, icon: "custom", order: index + 1 })),
  };
  trip.videoContent = options.video
    ? { enabled: true, provider: "youtube", url: "https://www.youtube.com/watch?v=Scxs7L0vhZ4", title: `Una mirada a ${trip.cities[0]}`, caption: "Video ilustrativo de la atmósfera del destino.", aspectRatio: "16:9" }
    : { enabled: false, provider: "html5", url: "" };
  trip.mapSettings = options.route
    ? { enabled: true, mode: "route", routeStops: trip.itinerary.flatMap((day) => (day.stops ?? []).map((stop) => ({ id: stop.id, dayNumber: day.day, name: stop.name, order: stop.order }))), generatedFromItinerary: true }
    : { enabled: true, mode: "main_destination", mainDestination: { name: trip.cities[0] } };
  trip.recommendationsContent = {
    mode: "bulleted_text", bulletedText: "• Lleva calzado cómodo\n• Conserva una batería externa\n• Considera efectivo para comercios locales",
    difficulty: { level: trip.durationDays > 4 ? "moderado" : "facil", label: trip.durationDays > 4 ? "Ritmo moderado" : "Ruta fácil", description: "Adecuada para viajeros con movilidad cotidiana." },
  };
  trip.publicDeparturePoints = options.airport
    ? [{ id: `${trip.id}-airport`, type: "airport", name: "Aeropuerto de salida", airportCode: "MEX", city: "Ciudad de México", meetingTime: "3 horas antes", instructions: "La terminal se confirma en los documentos finales.", enabled: true, order: 1 }]
    : [{ id: `${trip.id}-ground`, type: "city_boarding", name: "Punto centro", city: "Ciudad de México", reference: "Frente al acceso principal", meetingTime: "06:30", departureTime: "07:00", instructions: "Llega 15 minutos antes.", enabled: true, order: 1 }];
  trip.departurePointsDisplayMode = "selected_departure";
  trip.importantInformation = {
    introduction: "Consulta estas condiciones antes de reservar.",
    items: [
      { id: `${trip.id}-important-1`, title: "Operación de la ruta", description: "Los horarios pueden ajustarse por clima, tránsito o seguridad.", icon: "operation", severity: "info", order: 1 },
      { id: `${trip.id}-important-2`, title: "Documentación", description: options.airport ? "Verifica vigencia y requisitos migratorios antes de viajar." : "Conserva tu confirmación y una identificación vigente.", icon: "documents", severity: "warning", order: 2 },
    ],
  };
  trip.faqContent = {
    introduction: "Respuestas breves para preparar tu salida.",
    displayMode: "accordion",
    items: [
      { id: `${trip.id}-faq-1`, question: "¿Cuándo recibo la confirmación?", answer: "Al concluir la reserva demo verás el resumen y el folio de seguimiento.", category: "pagos", order: 1 },
      { id: `${trip.id}-faq-2`, question: "¿Qué equipaje conviene llevar?", answer: "Recomendamos equipaje compacto y adecuado a la duración y clima de la ruta.", category: "equipaje", order: 2 },
    ],
  };
  if (trip.departures[1]) {
    trip.departures[1].pricing = {
      mode: "custom",
      pricingOverrides: trip.accommodationMode === "hotel_occupancy"
        ? { adultDouble: Math.round(trip.basePrice.amount * 1.08), depositPolicy: trip.departures[1].depositPolicy }
        : { adultGeneral: Math.round(trip.basePrice.amount * 1.08), depositPolicy: trip.departures[1].depositPolicy },
    };
  }
}

for (const spec of sourceTripSpecs) {
  const trip = travels.find((item) => item.id === spec.id);
  if (!trip) continue;
  configureTripPage(trip, {
    video: false,
    lead: false,
    airport: Boolean(spec.airport),
    route: true,
  });
  trip.departures.forEach((departure) => {
    delete departure.pricing;
  });
  trip.recommendationsContent = {
    mode: "items",
    items: spec.recommendations.map((text, index) => ({
      id: `${trip.id}-recommendation-${index + 1}`,
      text,
      order: index + 1,
    })),
    difficulty: {
      level: spec.difficulty,
      label: spec.difficulty === "moderado" ? "Ritmo moderado" : "Ruta fácil",
    },
  };
  trip.publicDeparturePoints = spec.airport
    ? [{
        id: `${trip.id}-airport`,
        type: "airport",
        name: "Aeropuerto por confirmar",
        city: "Ciudad de México",
        instructions: "El aeropuerto y la terminal se confirman en la documentación final de la salida.",
        enabled: true,
        order: 1,
      }]
    : ["Guelatao", "Oceanía", "Revolución", "Naucalpan"].map((name, index) => ({
        id: `${trip.id}-point-${index + 1}`,
        type: "city_boarding" as const,
        name,
        city: "Ciudad de México",
        instructions: "El horario y la referencia exacta se confirman antes de viajar.",
        enabled: true,
        order: index + 1,
      }));
  trip.importantInformation = {
    introduction: "Información tomada de la publicación revisada y estructurada para esta demostración.",
    items: [
      {
        id: `${trip.id}-important-operation`,
        title: "Programa sujeto a operación",
        description: "El orden y los horarios pueden ajustarse por clima, logística o causas de fuerza mayor sin eliminar los servicios confirmados.",
        icon: "operation",
        severity: "info",
        order: 1,
      },
      {
        id: `${trip.id}-important-pricing`,
        title: "Precio y disponibilidad",
        description: "Confirma disponibilidad, condiciones y forma de pago antes de realizar cualquier depósito.",
        icon: "pricing",
        severity: "warning",
        order: 2,
      },
    ],
  };
  trip.faqContent = {
    introduction: "Respuestas breves basadas en la información publicada.",
    displayMode: "accordion",
    items: [
      {
        id: `${trip.id}-faq-includes`,
        question: "¿Qué incluye la tarifa?",
        answer: spec.includes.join(", ") + ".",
        category: "servicios",
        order: 1,
      },
      {
        id: `${trip.id}-faq-departures`,
        question: "¿Cuándo hay salidas?",
        answer: `Las fechas demo cargadas son ${spec.dates.map((date) => new Date(`${date}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "long" })).join(", ")}; están sujetas a disponibilidad.`,
        category: "fechas",
        order: 2,
      },
    ],
  };
}

const configurableDemos = [
  { agency: "a-furiver", hotel: false, options: { video: false, lead: false, airport: false, route: false } },
  { agency: "a-furiver", hotel: true, options: { video: false, lead: true, airport: false, route: true } },
  { agency: "a-crisenix", hotel: false, options: { video: false, lead: false, airport: false, route: false } },
  { agency: "a-crisenix", hotel: true, options: { video: false, lead: true, airport: true, route: true } },
  { agency: "a-boutique", hotel: true, options: { video: true, lead: true, airport: true, route: true } },
] as const;
for (const demo of configurableDemos) {
  const trip = travels.find((item) => item.agencyId === demo.agency && (item.accommodationMode === "hotel_occupancy") === demo.hotel && !item.pageConfiguration);
  if (trip) configureTripPage(trip, demo.options);
}

const barrancas = travels.find((trip) => trip.slug === "barrancas-del-cobre" && trip.agencyId === "a-furiver");
if (barrancas) {
  configureTripPage(barrancas, { video: true, lead: true, airport: false, route: true });
  barrancas.featuredImage = "/images/destination-canyon.webp";
  barrancas.heroMedia = {
    type: "image", imageUrl: barrancas.featuredImage,
    imageAlt: "Paisaje serrano demostrativo de Barrancas del Cobre",
    focalPoint: { x: 50, y: 48 }, overlay: .58,
  };
  barrancas.summary = "Circuito demostrativo por paisajes serranos, pueblos de montaña y miradores del norte.";
  barrancas.description = "Una ruta demostrativa de cinco días que conecta Chihuahua, Creel y la zona de barrancas con tiempos claros, acompañamiento y pausas panorámicas.";
  barrancas.gallery = [
    "/images/destination-canyon.webp",
    "/images/destination-mountain.webp",
    "/images/destination-town.webp",
    "/images/explorer-hero.webp",
  ];
  barrancas.galleryImages = [barrancas.featuredImage, ...barrancas.gallery].map((url, index) => ({
    id: `${barrancas.id}-gallery-${index + 1}`, url,
    alt: `${barrancas.title}, paisaje demostrativo ${index + 1}`,
    order: index + 1, featured: index === 0,
  }));
  const days = [
    {
      title: "Llegada a Chihuahua y recorrido inicial",
      description: "Recepción demostrativa en Chihuahua, orientación del circuito y paseo introductorio por espacios representativos del centro.",
      startTime: "15:00", stops: ["Chihuahua"], highlights: ["Orientación de la ruta", "Tiempo de adaptación"],
      meals: [], accommodation: "Hospedaje demostrativo en Chihuahua",
    },
    {
      title: "Camino serrano hacia Creel",
      description: "Traslado por carretera hacia Creel con pausas panorámicas y tiempo para reconocer el ritmo de la Sierra Tarahumara.",
      startTime: "08:00", stops: ["Chihuahua", "Creel"], highlights: ["Paradas panorámicas", "Llegada a Creel"],
      meals: ["Desayuno demostrativo"], accommodation: "Hospedaje demostrativo en Creel",
    },
    {
      title: "Ruta escénica hacia Divisadero",
      description: "Jornada demostrativa por una ruta escénica con vistas amplias, tramos ferroviarios sujetos a operación y llegada a Divisadero.",
      startTime: "07:30", stops: ["Creel", "Divisadero"], highlights: ["Paisaje ferroviario", "Miradores serranos"],
      meals: ["Desayuno demostrativo"], accommodation: "Hospedaje demostrativo en la zona de barrancas",
    },
    {
      title: "Miradores y comunidades serranas",
      description: "Recorrido interpretativo y respetuoso por miradores y comunidades de la región, con horarios ajustables por clima y operación.",
      startTime: "09:00", stops: ["Divisadero", "Barrancas del Cobre"], highlights: ["Miradores", "Contexto cultural de la sierra"],
      meals: ["Desayuno demostrativo"], accommodation: "Hospedaje demostrativo en la zona de barrancas",
    },
    {
      title: "Regreso y cierre del circuito",
      description: "Salida de regreso, pausas operativas y cierre acompañado del circuito. El horario final se confirma antes de viajar.",
      startTime: "08:00", stops: ["Barrancas del Cobre", "Chihuahua"], highlights: ["Regreso acompañado", "Cierre de ruta"],
      meals: ["Desayuno demostrativo"], accommodation: undefined,
    },
  ];
  barrancas.itinerary = days.map((day, index) => ({
    id: `${barrancas.id}-day-${index + 1}`, day: index + 1, dayNumber: index + 1,
    order: index + 1, title: day.title, shortDescription: day.description.slice(0, 120),
    description: day.description, startTime: day.startTime,
    stops: day.stops.map((name, stopIndex) => ({
      id: `${barrancas.id}-day-${index + 1}-stop-${stopIndex + 1}`,
      name, order: stopIndex + 1,
    })),
    highlights: day.highlights, meals: day.meals, accommodation: day.accommodation,
    images: [{
      id: `${barrancas.id}-day-${index + 1}-image`, url: barrancas.galleryImages![index % barrancas.galleryImages!.length].url,
      alt: `${day.title}, imagen demostrativa`, order: 1,
    }],
  }));
  barrancas.summaryContent = {
    shortDescription: barrancas.summary, showDuration: true, showUpcomingDepartures: true,
    showVisitedDestinations: true, showStartingPrice: true, maxUpcomingDepartures: 2,
    maxVisitedDestinations: 6,
  };
  barrancas.itineraryDownload = {
    enabled: true, fileUrl: "/documents/itinerario-barrancas-del-cobre-demo.txt",
    fileName: "itinerario-barrancas-del-cobre-demo.txt", fileType: "other",
    fileSizeLabel: "4 KB", requireLeadForm: true, leadFormFields: ["name", "whatsapp"],
    title: "Descarga la ruta de Barrancas", description: "Consulta el programa demostrativo de cinco días y sus notas operativas.",
  };
  barrancas.mapSettings = {
    enabled: true, mode: "route", generatedFromItinerary: true,
    mainDestination: { name: "Barrancas del Cobre" },
    routeStops: barrancas.itinerary.flatMap((day) => (day.stops ?? []).map((stop) => ({
      id: `map-${stop.id}`, dayNumber: day.day, name: stop.name, order: stop.order,
    }))),
  };
  barrancas.videoContent = {
    enabled: true, provider: "youtube", url: "https://www.youtube.com/watch?v=Scxs7L0vhZ4",
    title: "Paisajes de una ruta serrana", caption: "Material ilustrativo para esta demostración; la operación final puede variar.",
    aspectRatio: "16:9",
  };
}

export const destinations: TravelDestination[] = travels.map(t=>({id:t.destinationIds[0],agencyId:t.agencyId,slug:t.cities[0].toLowerCase().replaceAll(" ","-"),name:t.cities[0],region:t.region,country:t.countries[0],city:t.cities[0],summary:`Ideas para descubrir ${t.cities[0]}`,description:t.description,featuredImage:t.featuredImage,gallery:[],featured:true,status:"published"}));
