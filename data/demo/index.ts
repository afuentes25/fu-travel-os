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
  { id: "a-furiver", slug: "furiver", name: "Furiver", status: "active", theme: "explorer", plan: "growth", currency: "MXN", timezone: "America/Mexico_City", locale: "es-MX", contact: { whatsapp: "525500000101", email: "hola@furiver.demo", facebook: "furiver.demo" }, branding: { logoText: "FURIVER", primaryColor: "#101b22", accentColor: "#ef8b45", heroImage: "/images/explorer-hero.webp", heroTitle: "México se vive en el camino", heroDescription: "Excursiones, playa y pueblos mágicos con salidas desde la ciudad.", buttonStyle: "rounded" }, settings: { visibleSections: ["featured", "departures", "destinations", "benefits", "testimonials"], modules: ["catalog", "booking", "whatsapp"], legalNotice: "Información demostrativa. No constituye una oferta comercial.", whatsapp: { enabled: true, phone: "525500000101", defaultMessage: "Necesito ayuda para reservar.", showOnMobile: true, showOnDesktop: true }, availabilityDisplayMode: "hidden", travelerCategories: [{ id: "adult", label: "Adultos", minAge: 12, pricingRule: "adult", active: true, order: 1 }, { id: "child", label: "Menores", minAge: 3, maxAge: 11, pricingRule: "child", active: true, order: 2 }], extraVisibility: "hidden" } },
  { id: "a-crisenix", slug: "crisenix", name: "Crisenix Demo", status: "active", theme: "marketplace", plan: "scale", currency: "MXN", timezone: "America/Mexico_City", locale: "es-MX", contact: { whatsapp: "525500000202", email: "ventas@crisenix.demo" }, branding: { logoText: "CRISENIX", primaryColor: "#173f86", accentColor: "#f05a3e", heroImage: "/images/marketplace-hero.webp", heroTitle: "Viajes para todos, opciones para comparar", heroDescription: "Catálogo nacional e internacional con fechas, tarifas y disponibilidad.", buttonStyle: "square" }, settings: { visibleSections: ["search", "departures", "categories", "promotions"], modules: ["catalog", "booking", "reports"], legalNotice: "Demo comercial sin inventario ni pagos reales." } },
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
  return { id, agencyId:aid, code:`FT-${String(idx+1).padStart(3,"0")}`, slug:title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""), title, subtitle:summary, summary, description:`Una propuesta original para descubrir ${place} con ritmo equilibrado, acompañamiento y tiempos para disfrutar.`, scope:region==="mexico"?"national":"international", productType:type as TravelProduct["productType"], transportTypes:[transport as TravelProduct["transportTypes"][number]], tags:tags as TravelProduct["tags"], region:region as TravelProduct["region"], countries:[countryBy(region,place)], cities:[place], destinationIds:[`dest-${idx+1}`], categoryIds:[type], durationDays:days, durationNights:Math.max(0,days-1), featuredImage:image(["1501785888041-af3ef285b470","1507525428034-b723cf961d3e","1500530855697-b586d89ba3ee","1528127269322-539801943592"][idx%4]), gallery:[], includes:["Coordinación durante el recorrido","Experiencias indicadas","Asistencia antes de la salida"], excludes:["Gastos personales","Servicios no especificados"], requirements:["Identificación vigente","Llegar 20 minutos antes"], recommendations:["Equipaje ligero","Calzado cómodo"], policies:{ cancellation:"Cambios sujetos a disponibilidad. Política demostrativa.", payment:"El anticipo reserva provisionalmente el lugar.", responsibility:"Los horarios pueden ajustarse por operación." }, itinerary:Array.from({length:Math.min(days,4)},(_,d)=>({day:d+1,title:d?"Exploración y tiempo personal":"Bienvenida y primer encuentro",description:"Actividades organizadas con pausas y orientación local."})), basePrice:{amount,currency:cur,taxesAmount:cur==="USD"&&idx===6?899:Math.round(amount*.08),taxesIncluded:idx%3!==0,taxesLabel:"Impuestos y cargos",depositAmount:cur==="MXN"?Math.min(2000,Math.round(amount*.3)):Math.round(amount*.25),priceType:"per_person",displayFrom:true}, pricingOptions:[{id:`${id}-general`,label:"Adulto / ocupación doble",occupancy:"double",amount,currency:cur,inventoryImpact:1},{id:`${id}-single`,label:"Ocupación sencilla",occupancy:"single",amount:Math.round(amount*1.28),currency:cur,inventoryImpact:1},{id:`${id}-child`,label:"Menor",occupancy:"child",amount:Math.round(amount*.78),currency:cur,inventoryImpact:1}], departures:makeDeparture(id,idx,aid,cur), extras:[{id:`${id}-extra-1`,name:"Protección flexible demo",price:cur==="MXN"?390:45,currency:cur,pricingMode:"per_booking",optional:true,visibility:"hidden"},{id:`${id}-extra-2`,name:"Experiencia gastronómica",price:cur==="MXN"?650:75,currency:cur,pricingMode:"per_person",optional:true,visibility:"booking_step"}], status:"published", featured:idx%2===0, promotion, availabilityDisplayMode:tenant==="furiver"?"hidden":"status_only", depositPolicy:{enabled:true,type:"fixed",fixedAmount:cur==="MXN"?Math.min(2000,Math.round(amount*.3)):Math.round(amount*.25)}, travelerCategories:agencies.find((item)=>item.id===aid)?.settings.travelerCategories, extraVisibility:tenant==="furiver"?"hidden":"booking_step", allowManualOccupancy:false };
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
    pricingOptions: source.pricingOptions.map((price, index) => ({
      ...price,
      id: `${id}-rate-${index}`,
      amount: Math.round(spec.amount * (index === 1 ? 1.28 : index === 2 ? 0.78 : 1)),
      currency: spec.currency,
    })),
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
export const destinations: TravelDestination[] = travels.map(t=>({id:t.destinationIds[0],agencyId:t.agencyId,slug:t.cities[0].toLowerCase().replaceAll(" ","-"),name:t.cities[0],region:t.region,country:t.countries[0],city:t.cities[0],summary:`Ideas para descubrir ${t.cities[0]}`,description:t.description,featuredImage:t.featuredImage,gallery:[],featured:true,status:"published"}));
