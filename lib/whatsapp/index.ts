import { travelerWhatsAppSummary } from "@/lib/travelers";
import type {
  Agency,
  PricedCartLine,
  TravelerDataStatus,
  TravelerDraft,
} from "@/types";
export function whatsappUrl(
  agency: Agency,
  line: PricedCartLine,
  folio?: string,
  travelerData?: {
    status: TravelerDataStatus;
    drafts: TravelerDraft[];
    adults?: number;
    minors?: number;
    total?: number;
    deposit?: number;
  },
) {
  const msg = [
    `Hola ${agency.name}, me interesa ${line.travel.title}.`,
    `Salida: ${new Date(line.travel.departures.find((d) => d.id === line.departureId)!.startDate).toLocaleDateString("es-MX")}.`,
    `Punto de abordaje: ${line.boarding.pointName}.`,
    line.boarding.meetingTime
      ? `Hora de reunión: ${line.boarding.meetingTime}.`
      : "",
    line.boarding.departureTime
      ? `Hora de salida: ${line.boarding.departureTime}.`
      : "",
    travelerData?.adults !== undefined
      ? `Adultos: ${travelerData.adults}.`
      : `Viajeros: ${line.travelers}.`,
    travelerData?.minors ? `Menores: ${travelerData.minors}.` : "",
    `Total estimado: ${travelerData?.total ?? line.total} ${line.travel.basePrice.currency}.`,
    `Anticipo: ${travelerData?.deposit ?? line.deposit} ${line.travel.basePrice.currency}.`,
    travelerData
      ? travelerWhatsAppSummary(travelerData.status, travelerData.drafts)
      : "",
    folio ? `Folio: ${folio}.` : "",
    typeof window !== "undefined" ? `URL: ${window.location.href}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return `https://wa.me/${agency.contact.whatsapp}?text=${encodeURIComponent(msg)}`;
}
