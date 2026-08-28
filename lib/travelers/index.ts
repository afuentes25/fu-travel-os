import type {
  Agency,
  CartLine,
  TravelerDataStatus,
  TravelerDraft,
} from "@/types";

export function createTravelerDrafts(
  adults: number,
  minors: number,
  scope = "booking",
): TravelerDraft[] {
  return [
    ...Array.from({ length: adults }, (_, index) => ({
      id: `${scope}-adult-${index + 1}`,
      category: "adult" as const,
      sequence: index + 1,
      fullName: "",
      completionStatus: "pending" as const,
    })),
    ...Array.from({ length: minors }, (_, index) => ({
      id: `${scope}-minor-${index + 1}`,
      category: "minor" as const,
      sequence: index + 1,
      fullName: "",
      completionStatus: "pending" as const,
    })),
  ];
}

/** A checkout draft scope is ephemeral and must never identify a traveler. */
export function createTravelerDraftAttemptScope(
  tripId: string,
  departureId: string,
  attemptId = globalThis.crypto.randomUUID(),
) {
  return `checkout-v2:${attemptId}:${tripId}:${departureId}`;
}

export function isTravelerDraftAttemptScoped(id: unknown) {
  return typeof id === "string" && id.startsWith("checkout-v2:");
}

export function travelerCountsFromLines(lines: CartLine[]) {
  return lines.reduce(
    (counts, line) => {
      const category = line.travelerDrafts?.[0]?.category;
      if (category === "minor") counts.minors += line.travelers;
      else counts.adults += line.travelers;
      return counts;
    },
    { adults: 0, minors: 0 },
  );
}

export function draftsFromLines(lines: CartLine[]): TravelerDraft[] {
  const saved = lines.flatMap((line) => line.travelerDrafts ?? []);
  if (saved.length) return saved;
  const { adults, minors } = travelerCountsFromLines(lines);
  const scope = lines[0]
    ? `${lines[0].travelId}-${lines[0].departureId}`
    : "booking";
  return createTravelerDrafts(adults, minors, scope);
}

export function validateTravelerDrafts(
  drafts: TravelerDraft[],
  status: TravelerDataStatus,
) {
  if (status === "pending") return { valid: true, missingIds: [] as string[] };
  const missingIds = drafts
    .filter((draft) => !draft.fullName.trim())
    .map((draft) => draft.id);
  return { valid: missingIds.length === 0, missingIds };
}

export function reconcileTravelerDrafts(input: {
  drafts: TravelerDraft[];
  adults: number;
  minors: number;
  scope?: string;
  confirmDiscard?: boolean;
}) {
  const desired = createTravelerDrafts(input.adults, input.minors, input.scope);
  const desiredIds = new Set(desired.map((draft) => draft.id));
  const discardedWithData = input.drafts.filter(
    (draft) => !desiredIds.has(draft.id) && Boolean(draft.fullName.trim()),
  );
  if (discardedWithData.length && !input.confirmDiscard) {
    return {
      drafts: input.drafts,
      requiresConfirmation: true,
      discardedWithData,
    };
  }
  const existing = new Map(input.drafts.map((draft) => [draft.id, draft]));
  return {
    drafts: desired.map((draft) => existing.get(draft.id) ?? draft),
    requiresConfirmation: false,
    discardedWithData,
  };
}

export function travelerFollowUpMessage(agency: Agency) {
  return `Podrás completar estos datos más adelante. Es posible que un agente de ${agency.name} se ponga en contacto contigo para solicitar más detalles sobre tu reserva.`;
}

export function travelerWhatsAppSummary(
  status: TravelerDataStatus,
  drafts: TravelerDraft[],
) {
  if (status === "pending")
    return "Datos de viajeros: pendientes de completar.";
  const names = drafts.map((draft) => draft.fullName.trim()).filter(Boolean);
  return names.length ? `Viajeros: ${names.join(", ")}.` : "";
}

export function applyTravelerDataToLines(
  lines: CartLine[],
  status: TravelerDataStatus,
  drafts: TravelerDraft[],
) {
  return lines.map((line) => ({
    ...line,
    travelerDataStatus: status,
    travelerDrafts: drafts.filter((draft) =>
      line.travelerDrafts?.[0]?.category
        ? draft.category === line.travelerDrafts[0].category
        : true,
    ),
  }));
}
