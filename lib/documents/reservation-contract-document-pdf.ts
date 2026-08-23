import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReservationContractPdfData = Readonly<{
  agency: Readonly<{ legalName: string; taxId: string | null; legalAddress: string | null; supportEmail: string | null; supportPhone: string | null; jurisdiction: string | null }>;
  contract: Readonly<{ templateVersion: number; status: "prepared" | "accepted"; preparedAt: string; title: string; introductoryText: string | null; termsText: string; paymentPolicyText: string | null; cancellationPolicyText: string | null; travelerResponsibilityText: string | null; jurisdictionText: string | null; effectiveFrom: string | null }>;
  reservation: Readonly<{ code: string; tripName: string | null; tripCode: string | null; departureDate: string | null; boarding: string | null; rooms: number | null; adults: number | null; minors: number | null; travelers: number | null; currency: string; total: number | null; depositAmount: number | null; depositPercent: number | null }>;
}>;

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const TOP = 736;
const BOTTOM = 72;

function formatMoney(value: number | null, currency: string) {
  return value === null ? "No disponible" : new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value);
}

function formatDate(value: string | null) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "No disponible";
  return new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

/** Renders exclusively from immutable, prevalidated contract-instance data. */
export async function renderReservationContractPdf(data: ReservationContractPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: Array<{ page: ReturnType<typeof pdf.addPage>; y: number }> = [];
  const addPage = () => {
    const state = { page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]), y: TOP };
    pages.push(state);
    return state;
  };
  let current = addPage();
  const ensureSpace = (height: number) => { if (current.y - height < BOTTOM) current = addPage(); };
  const drawLine = (line: string, size = 10, emphasis = false) => {
    ensureSpace(size + 5);
    current.page.drawText(line, { x: MARGIN_X, y: current.y, size, font: emphasis ? bold : regular, color: rgb(0.09, 0.14, 0.13) });
    current.y -= size + 5;
  };
  const write = (text: string, size = 10, emphasis = false) => {
    for (const rawLine of text.split("\n")) {
      const words = rawLine.trim().split(/\s+/).filter(Boolean);
      if (!words.length) { current.y -= size + 3; continue; }
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (regular.widthOfTextAtSize(candidate, size) > CONTENT_WIDTH && line) { drawLine(line, size, emphasis); line = word; } else line = candidate;
      }
      if (line) drawLine(line, size, emphasis);
    }
  };
  const section = (title: string, body: string | null) => {
    if (!body?.trim()) return;
    ensureSpace(32);
    current.page.drawText(title, { x: MARGIN_X, y: current.y, size: 12, font: bold, color: rgb(0.79, 0.34, 0.07) });
    current.y -= 20;
    write(body);
    current.y -= 10;
  };
  drawLine(data.agency.legalName, 18, true);
  drawLine("Contrato de reservación y servicios de viaje", 15, true);
  drawLine(data.contract.title, 12, true);
  drawLine(`Versión contractual ${data.contract.templateVersion} - Estado: ${data.contract.status === "prepared" ? "Pendiente de aceptación" : "Aceptado"}`);
  drawLine(`Preparado el: ${formatDate(data.contract.preparedAt)}`);
  if (data.contract.effectiveFrom) drawLine(`Vigente a partir de: ${formatDate(data.contract.effectiveFrom)}`);
  current.y -= 8;
  section("Agencia", [data.agency.taxId ? `Identificador fiscal: ${data.agency.taxId}` : null, data.agency.legalAddress, data.agency.supportEmail, data.agency.supportPhone, data.agency.jurisdiction].filter((value): value is string => Boolean(value)).join("\n"));
  section("Reservación", [`Folio: ${data.reservation.code}`, `Tour: ${data.reservation.tripName ?? "No disponible"}`, `Clave: ${data.reservation.tripCode ?? "No disponible"}`, `Salida: ${formatDate(data.reservation.departureDate)}`, `Abordaje: ${data.reservation.boarding ?? "No disponible"}`, `Habitaciones: ${data.reservation.rooms ?? "No disponible"}`, `Adultos: ${data.reservation.adults ?? "No disponible"}`, `Menores: ${data.reservation.minors ?? "No disponible"}`, `Total de viajeros: ${data.reservation.travelers ?? "No disponible"}`].join("\n"));
  const deposit = data.reservation.depositAmount === null ? "Anticipo requerido: No disponible" : `Anticipo requerido: ${formatMoney(data.reservation.depositAmount, data.reservation.currency)}${data.reservation.depositPercent === null ? "" : ` (${data.reservation.depositPercent}%)`}`;
  section("Condiciones económicas", [`Total contratado: ${formatMoney(data.reservation.total, data.reservation.currency)}`, `Moneda: ${data.reservation.currency}`, deposit].join("\n"));
  section("Texto introductorio", data.contract.introductoryText);
  section("Términos y condiciones", data.contract.termsText);
  section("Política de pagos", data.contract.paymentPolicyText);
  section("Política de cancelaciones", data.contract.cancellationPolicyText);
  section("Responsabilidades del viajero", data.contract.travelerResponsibilityText);
  section("Jurisdicción contractual", data.contract.jurisdictionText);
  write("Este documento contiene las condiciones contractuales preparadas para esta reservación. La aceptación del cliente se registra por separado.");
  for (const [index, { page }] of pages.entries()) page.drawText(`${data.reservation.code} - CONTRATO V1 - Versión contractual ${data.contract.templateVersion} - Página ${index + 1} de ${pages.length}`, { x: MARGIN_X, y: 32, size: 8, font: regular, color: rgb(0.36, 0.41, 0.39) });
  return pdf.save();
}
