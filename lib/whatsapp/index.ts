import { travelerWhatsAppSummary } from "@/lib/travelers";
import {
  formatAppliedRate,
  formatMinorUnits,
  fxContractualPaymentLabel,
} from "@/lib/fx";
import type { Agency, PricedCartLine, TravelerDataStatus, TravelerDraft } from "@/types";
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
  const allocation = line.paymentAllocation;
  const snapshot = line.fxSnapshot;
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
    allocation
      ? `${fxContractualPaymentLabel(allocation.kind)}: ${formatMinorUnits(allocation.contractualPaymentMinor, allocation.contractCurrency)}.`
      : `Anticipo: ${travelerData?.deposit ?? line.deposit} ${line.travel.basePrice.currency}.`,
    allocation
      ? `Cobro demo actual: ${formatMinorUnits(allocation.chargeNowMinor, allocation.chargeCurrency)}.`
      : "",
    allocation
      ? `Saldo contractual: ${formatMinorUnits(allocation.remainingContractMinor, allocation.contractCurrency)}.`
      : "",
    snapshot
      ? `Tasa demo aplicada: ${formatAppliedRate(snapshot)} MXN/USD.`
      : "",
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
