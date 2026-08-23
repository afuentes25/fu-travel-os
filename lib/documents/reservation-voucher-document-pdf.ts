import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReservationVoucherPdfData = Readonly<{
  agencyName: string;
  version: number;
  generatedAt: string;
  reservation: Readonly<{ code: string; tripName: string | null; tripCode: string | null; departureDate: string; boarding: string | null; rooms: number | null; adults: number | null; minors: number | null; travelers: number | null; total: number; depositRequired: number; currency: string }>;
  travelers: readonly Readonly<{ firstName: string; lastName: string; travelerType: "adult" | "minor" }>[];
}>;

const width = 612, height = 792, left = 54, top = 736, bottom = 64;
const date = (value: string) => new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) + " UTC";
const money = (value: number, currency: string) => new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(value);

/** Paginated operational voucher; receives only server-projected non-sensitive traveler data. */
export async function renderReservationVoucherPdf(data: ReservationVoucherPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create(); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: Array<{ page: ReturnType<typeof pdf.addPage>; y: number }> = [];
  const add = () => { const current = { page: pdf.addPage([width, height]), y: top }; pages.push(current); return current; }; let current = add();
  const fit = (amount: number) => { if (current.y - amount < bottom) current = add(); };
  const line = (value: string, size = 10, emphasis = false) => { fit(size + 6); current.page.drawText(value, { x: left, y: current.y, size, font: emphasis ? bold : regular, color: rgb(.09,.14,.13) }); current.y -= size + 6; };
  const section = (title: string) => { fit(30); current.page.drawText(title, { x: left, y: current.y, size: 12, font: bold, color: rgb(.79,.34,.07) }); current.y -= 20; };
  line(data.agencyName, 17, true); line("Voucher de viaje", 15, true); line("Confirmación de reservación", 11); line(`${data.reservation.code} · VOUCHER · V${data.version}`, 10); line(`Emitido: ${date(data.generatedAt)}`); current.y -= 8;
  section("Reservación"); [
    `Folio: ${data.reservation.code}`, `Tour: ${data.reservation.tripName ?? "No disponible"}`, `Clave: ${data.reservation.tripCode ?? "No disponible"}`, `Salida: ${date(data.reservation.departureDate)}`, `Punto de abordaje: ${data.reservation.boarding ?? "No disponible"}`, `Habitaciones: ${data.reservation.rooms ?? "No disponible"}`, `Adultos: ${data.reservation.adults ?? "No disponible"}`, `Menores: ${data.reservation.minors ?? "No disponible"}`, `Total de viajeros: ${data.reservation.travelers ?? "No disponible"}`,
  ].forEach((value) => line(value)); current.y -= 8;
  section("Viajeros"); data.travelers.forEach((traveler, index) => line(`${index + 1}. ${traveler.firstName} ${traveler.lastName} · ${traveler.travelerType === "adult" ? "Adulto" : "Menor"}`)); current.y -= 8;
  section("Condición económica"); line(`Total contratado: ${money(data.reservation.total, data.reservation.currency)}`); line(`Moneda: ${data.reservation.currency}`); line(`Anticipo requerido: ${money(data.reservation.depositRequired, data.reservation.currency)}`); line("Estado: Anticipo requerido cubierto"); line("Contrato: Aceptado"); current.y -= 8;
  line("Este Voucher confirma los servicios registrados para la reservación al momento de su emisión."); line("No sustituye el boleto o documento de abordaje correspondiente.");
  for (const [index, item] of pages.entries()) item.page.drawText(`${data.reservation.code} · Voucher V${data.version} · Página ${index + 1} de ${pages.length}`, { x: left, y: 30, size: 8, font: regular, color: rgb(.36,.41,.39) });
  return pdf.save();
}
