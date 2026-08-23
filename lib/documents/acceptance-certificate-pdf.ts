import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type AcceptanceCertificatePdfData = Readonly<{
  legalName: string;
  taxId: string | null;
  reservationCode: string;
  tripName: string | null;
  departureDate: string | null;
  contractTemplateVersion: number;
  contractDocumentVersion: 1;
  contractGeneratedAt: string;
  contractSha256: string;
  acceptedAt: string;
  statementVersion: string;
  statement: string;
}>;

const WIDTH = 612;
const HEIGHT = 792;
const LEFT = 54;
const RIGHT = WIDTH - LEFT;
const TOP = 736;
const BOTTOM = 64;

function utcDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "UTC", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date).replace(",", "") + " UTC";
}

/** Deterministic, paginated PDF rendered exclusively from persisted acceptance data. */
export async function renderAcceptanceCertificatePdf(data: AcceptanceCertificatePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: Array<{ page: ReturnType<typeof pdf.addPage>; y: number }> = [];
  const addPage = () => { const state = { page: pdf.addPage([WIDTH, HEIGHT]), y: TOP }; pages.push(state); return state; };
  let current = addPage();
  const space = (height: number) => { if (current.y - height < BOTTOM) current = addPage(); };
  const line = (value: string, size = 10, emphasis = false) => {
    space(size + 6);
    current.page.drawText(value, { x: LEFT, y: current.y, size, font: emphasis ? bold : regular, color: rgb(0.09, 0.14, 0.13) });
    current.y -= size + 6;
  };
  const write = (value: string, size = 10) => {
    for (const sourceLine of value.split("\n")) {
      const words = sourceLine.trim().split(/\s+/).filter(Boolean);
      if (!words.length) { current.y -= size + 4; continue; }
      let valueLine = "";
      for (const word of words) {
        const candidate = valueLine ? `${valueLine} ${word}` : word;
        if (regular.widthOfTextAtSize(candidate, size) > RIGHT - LEFT && valueLine) { line(valueLine, size); valueLine = word; } else valueLine = candidate;
      }
      if (valueLine) line(valueLine, size);
    }
  };
  const section = (title: string, body: string) => {
    space(30);
    current.page.drawText(title, { x: LEFT, y: current.y, size: 12, font: bold, color: rgb(0.79, 0.34, 0.07) });
    current.y -= 20;
    write(body);
    current.y -= 9;
  };
  line(data.legalName, 17, true);
  line("Constancia de aceptación contractual", 15, true);
  line(`Reservación ${data.reservationCode}`, 11, true);
  current.y -= 8;
  section("Agencia", [data.taxId ? `Identificador fiscal: ${data.taxId}` : null].filter(Boolean).join("\n") || "Información legal registrada en el contrato.");
  section("Reservación", [`Folio: ${data.reservationCode}`, `Tour: ${data.tripName ?? "No disponible"}`, `Salida: ${data.departureDate ? utcDate(data.departureDate) : "No disponible"}`].join("\n"));
  section("Contrato aceptado", [
    `Versión contractual: ${data.contractTemplateVersion}`,
    `Versión documental del contrato: ${data.contractDocumentVersion}`,
    `Generado el: ${utcDate(data.contractGeneratedAt)}`,
    "Huella SHA-256 del contrato aceptado:",
    data.contractSha256,
  ].join("\n"));
  section("Aceptación", [
    `Registrada el: ${utcDate(data.acceptedAt)}`,
    "La aceptación fue registrada mediante la cuenta principal autorizada para esta reservación.",
    "Declaración de aceptación:",
    data.statement,
    `Versión de declaración: ${data.statementVersion}`,
  ].join("\n"));
  write("Esta constancia documenta el registro de aceptación realizado dentro de la plataforma y referencia mediante SHA-256 el contrato digital asociado.");
  for (const [index, { page }] of pages.entries()) page.drawText(`${data.reservationCode} · Constancia de aceptación · Página ${index + 1} de ${pages.length}`, { x: LEFT, y: 30, size: 8, font: regular, color: rgb(0.36, 0.41, 0.39) });
  return pdf.save();
}
