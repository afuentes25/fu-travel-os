import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReservationTicketPdfData = Readonly<{
  agencyName: string;
  version: number;
  generatedAt: string;
  traveler: Readonly<{ position: number; firstName: string; lastName: string; travelerType: "adult" | "minor" }>;
  reservation: Readonly<{ code: string; tripName: string | null; tripCode: string | null; departureDate: string; boarding: string; currency: string }>;
}>;

function utcDate(value: string) {
  return `${new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value))} UTC`;
}

/** Compact, QR-free operational ticket. It receives only server-projected passenger data. */
export async function renderReservationTicketPdf(data: ReservationTicketPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  const left = 54;
  let y = 730;
  const line = (text: string, size = 10, emphasis = false, color = rgb(0.09, 0.14, 0.13)) => {
    page.drawText(text, { x: left, y, size, font: emphasis ? bold : regular, color });
    y -= size + 9;
  };
  const section = (text: string) => { y -= 8; line(text, 12, true, rgb(0.79, 0.34, 0.07)); y -= 3; };
  const passenger = `${data.traveler.firstName} ${data.traveler.lastName}`;
  const passengerType = data.traveler.travelerType === "adult" ? "Adulto" : "Menor";

  line(data.agencyName, 17, true);
  line("Boleto de viaje", 16, true);
  line(`${data.reservation.code} · P${String(data.traveler.position).padStart(2, "0")} · BOLETO V${data.version}`, 10);
  line(`Emitido: ${utcDate(data.generatedAt)}`, 9);
  section("Pasajero");
  line(passenger, 14, true);
  line(passengerType);
  section("Viaje");
  line(`Reservación: ${data.reservation.code}`);
  line(`Tour: ${data.reservation.tripName ?? "No disponible"}`);
  if (data.reservation.tripCode) line(`Clave: ${data.reservation.tripCode}`);
  line(`Salida: ${utcDate(data.reservation.departureDate)}`);
  line(`Punto de abordaje: ${data.reservation.boarding}`);
  line(`Moneda contractual: ${data.reservation.currency}`);
  section("Emisión");
  line("Condición de emisión: cumplida", 11, true);
  y -= 6;
  line("Este boleto identifica al pasajero registrado para el viaje indicado.");
  line("Su emisión no sustituye los procedimientos de check-in o abordaje que determine la agencia.");
  page.drawText(`${data.reservation.code} · Pasajero P${data.traveler.position} · Boleto V${data.version}`, { x: left, y: 30, size: 8, font: regular, color: rgb(0.36, 0.41, 0.39) });
  return pdf.save();
}
