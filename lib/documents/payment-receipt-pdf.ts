import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { Currency } from "@/types";

export type PaymentReceiptPdfData = Readonly<{
  agencyName: string;
  documentLabel: string;
  reservationCode: string;
  tripName: string | null;
  departureDate: string | null;
  paidAt: string | null;
  amount: number;
  currency: Currency;
  methodLabel: string;
  reference: string | null;
  contractTotal: number;
  confirmedTotal: number;
  remaining: number;
}>;

function money(value: number, currency: Currency) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function date(value: string | null) {
  if (!value) return "No disponible";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(parsed)
    : "No disponible";
}

/** Renders a one-page operational PDF. It deliberately receives no customer PII. */
export async function renderPaymentReceiptPdf(data: PaymentReceiptPdfData): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.09, 0.14, 0.13);
  const accent = rgb(0.79, 0.34, 0.07);
  const muted = rgb(0.36, 0.41, 0.39);
  let y = 736;
  const line = (label: string, value: string, emphasis = false) => {
    page.drawText(label, { x: 54, y, size: 9, font: bold, color: muted });
    page.drawText(value, { x: 238, y, size: emphasis ? 12 : 10, font: emphasis ? bold : regular, color: dark, maxWidth: 318 });
    y -= emphasis ? 28 : 22;
  };
  page.drawText(data.agencyName, { x: 54, y, size: 18, font: bold, color: dark });
  y -= 31;
  page.drawText("COMPROBANTE DE PAGO", { x: 54, y, size: 15, font: bold, color: accent });
  y -= 18;
  page.drawText("Documento no fiscal", { x: 54, y, size: 10, font: regular, color: muted });
  y -= 38;
  page.drawLine({ start: { x: 54, y }, end: { x: 558, y }, thickness: 1, color: rgb(0.84, 0.86, 0.84) });
  y -= 27;
  line("DOCUMENTO", data.documentLabel);
  line("FOLIO DE RESERVACIÓN", data.reservationCode);
  line("TOUR", data.tripName ?? "No disponible");
  line("SALIDA", date(data.departureDate));
  y -= 8;
  page.drawText("PAGO CONFIRMADO", { x: 54, y, size: 11, font: bold, color: accent });
  y -= 25;
  line("FECHA DE PAGO", date(data.paidAt));
  line("IMPORTE", money(data.amount, data.currency), true);
  line("MONEDA", data.currency);
  line("MÉTODO", data.methodLabel);
  if (data.reference) line("REFERENCIA DE PAGO", data.reference);
  y -= 8;
  page.drawText("RESUMEN POSTERIOR AL PAGO", { x: 54, y, size: 11, font: bold, color: accent });
  y -= 25;
  line("TOTAL CONTRATADO", money(data.contractTotal, data.currency));
  line("PAGOS CONFIRMADOS", money(data.confirmedTotal, data.currency));
  line("SALDO PENDIENTE", money(data.remaining, data.currency), true);
  y -= 8;
  page.drawLine({ start: { x: 54, y }, end: { x: 558, y }, thickness: 1, color: rgb(0.84, 0.86, 0.84) });
  y -= 22;
  page.drawText("Este documento confirma el registro de un pago dentro de la reservación y no sustituye una factura o CFDI.", {
    x: 54, y, size: 8.5, font: regular, color: muted, maxWidth: 504, lineHeight: 12,
  });
  return document.save();
}
