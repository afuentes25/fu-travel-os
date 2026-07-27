import type {
  Currency,
  ExchangeRatePolicy,
  ExchangeRateProvider,
  ExchangeRateQuote,
  FxConsent,
  FxSnapshot,
  ForeignCurrencyPaymentAllocation,
  PaymentAllocation,
} from "@/types";

const CURRENCY_DECIMALS: Record<Currency, number> = { MXN: 2, USD: 2 };

export const toMinorUnits = (amount: number, currency: Currency) => {
  const result = Math.round(amount * 10 ** CURRENCY_DECIMALS[currency]);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(result))
    throw new Error("El importe no puede representarse de forma segura.");
  return result;
};

export const fromMinorUnits = (amountMinor: number, currency: Currency) =>
  amountMinor / 10 ** CURRENCY_DECIMALS[currency];

export const formatMinorUnits = (amountMinor: number, currency: Currency) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinorUnits(amountMinor, currency));

const stableId = (parts: Array<string | number>) =>
  parts.join("-").replace(/[^a-zA-Z0-9._-]+/g, "_");

export class DeterministicDemoExchangeRateProvider
  implements ExchangeRateProvider
{
  readonly id: string;
  private readonly rates: Partial<Record<`${Currency}/${Currency}`, number>>;
  private readonly rateScale: number;
  private readonly quoteTtlSeconds: number;

  constructor(options?: {
    id?: string;
    rates?: Partial<Record<`${Currency}/${Currency}`, number>>;
    rateScale?: number;
    quoteTtlSeconds?: number;
  }) {
    this.id = options?.id ?? "demo-deterministic-v1";
    this.rates = options?.rates ?? { "USD/MXN": 17_250_000 };
    this.rateScale = options?.rateScale ?? 1_000_000;
    this.quoteTtlSeconds = options?.quoteTtlSeconds ?? 900;
  }

  async getQuote({
    baseCurrency,
    quoteCurrency,
    quotedAt,
  }: {
    baseCurrency: Currency;
    quoteCurrency: Currency;
    quotedAt: string;
  }): Promise<ExchangeRateQuote> {
    const sourceRateUnits =
      baseCurrency === quoteCurrency
        ? this.rateScale
        : this.rates[`${baseCurrency}/${quoteCurrency}`];
    if (!sourceRateUnits)
      throw new Error(
        `No existe una cotización demo para ${baseCurrency}/${quoteCurrency}.`,
      );
    const expiresAt = new Date(
      new Date(quotedAt).getTime() + this.quoteTtlSeconds * 1000,
    ).toISOString();
    return Object.freeze({
      id: stableId([
        this.id,
        baseCurrency,
        quoteCurrency,
        sourceRateUnits,
        quotedAt,
      ]),
      providerId: this.id,
      baseCurrency,
      quoteCurrency,
      sourceRateUnits,
      rateScale: this.rateScale,
      quotedAt,
      expiresAt,
    });
  }
}

const roundToIncrement = (
  amountMinor: number,
  incrementMinor: number,
  mode: "nearest" | "up",
) => {
  const increment = Math.max(1, Math.trunc(incrementMinor));
  const ratio = amountMinor / increment;
  return (mode === "up" ? Math.ceil(ratio) : Math.round(ratio)) * increment;
};

export const createFxSnapshot = ({
  quote,
  policy,
  sourceAmountMinor,
  createdAt = quote.quotedAt,
}: {
  quote: ExchangeRateQuote;
  policy: ExchangeRatePolicy;
  sourceAmountMinor: number;
  createdAt?: string;
}): FxSnapshot => {
  if (!Number.isSafeInteger(sourceAmountMinor) || sourceAmountMinor < 0)
    throw new Error("El importe contractual debe expresarse en unidades menores.");
  if (quote.providerId !== policy.providerId)
    throw new Error("La cotización no corresponde al proveedor configurado.");

  const sourceNumerator = sourceAmountMinor * quote.sourceRateUnits;
  const unroundedChargeMinor =
    policy.markup.type === "percentage"
      ? (sourceNumerator * (10_000 + policy.markup.basisPoints)) /
        (quote.rateScale * 10_000)
      : (() => {
          if (policy.markup.currency !== quote.quoteCurrency)
            throw new Error("El margen fijo debe usar la moneda de cobro.");
          return (
            sourceNumerator / quote.rateScale + policy.markup.amountMinor
          );
        })();
  const chargeAmountMinor = roundToIncrement(
    unroundedChargeMinor,
    policy.rounding.incrementMinor,
    policy.rounding.mode,
  );
  const appliedRateUnits =
    sourceAmountMinor === 0
      ? quote.sourceRateUnits
      : Math.round(
          (unroundedChargeMinor * quote.rateScale) / sourceAmountMinor,
        );
  return Object.freeze({
    id: stableId([
      quote.id,
      sourceAmountMinor,
      chargeAmountMinor,
      policy.markup.type,
      policy.markup.type === "percentage"
        ? policy.markup.basisPoints
        : policy.markup.amountMinor,
    ]),
    quoteId: quote.id,
    providerId: quote.providerId,
    sourceCurrency: quote.baseCurrency,
    chargeCurrency: quote.quoteCurrency,
    sourceRateUnits: quote.sourceRateUnits,
    appliedRateUnits,
    rateScale: quote.rateScale,
    markup: Object.freeze({ ...policy.markup }),
    rounding: Object.freeze({ ...policy.rounding }),
    sourceAmountMinor,
    chargeAmountMinor,
    createdAt,
    expiresAt: quote.expiresAt,
  });
};

export async function createDeterministicDemoPaymentQuote({
  policy,
  sourceCurrency,
  chargeCurrency,
  contractTotalMinor,
  contractualPaymentMinor,
  kind,
  quotedAt = new Date().toISOString(),
}: {
  policy: ExchangeRatePolicy;
  sourceCurrency: Currency;
  chargeCurrency: Currency;
  contractTotalMinor: number;
  contractualPaymentMinor: number;
  kind: "deposit" | "full";
  quotedAt?: string;
}) {
  if (policy.providerId !== "demo-deterministic-v1")
    throw new Error("Esta demostración solo admite el proveedor determinista.");
  const provider = new DeterministicDemoExchangeRateProvider({
    id: policy.providerId,
    quoteTtlSeconds: policy.quoteTtlSeconds,
  });
  const quote = await provider.getQuote({
    baseCurrency: sourceCurrency,
    quoteCurrency: chargeCurrency,
    quotedAt,
  });
  const snapshot = createFxSnapshot({
    quote,
    policy,
    sourceAmountMinor: contractualPaymentMinor,
  });
  return Object.freeze({
    snapshot,
    allocation: buildPaymentAllocation({
      kind,
      contractTotalMinor,
      contractualPaymentMinor,
      snapshot,
    }),
  });
}

export const isFxSnapshotExpired = (
  snapshot: FxSnapshot,
  now = new Date().toISOString(),
) => {
  const nowTime = new Date(now).getTime();
  const expiresAt = new Date(snapshot.expiresAt).getTime();
  if (!Number.isFinite(nowTime) || !Number.isFinite(expiresAt))
    throw new Error("La vigencia de la cotización no es válida.");
  return nowTime >= expiresAt;
};

export const requireFreshFxSnapshot = (
  snapshot: FxSnapshot,
  now = new Date().toISOString(),
) => {
  if (isFxSnapshotExpired(snapshot, now))
    throw new Error("La cotización venció. Actualiza el tipo de cambio.");
  return snapshot;
};

export const createFxConsent = ({
  snapshot,
  acceptedAt,
  disclosureVersion = "fx-demo-v1",
}: {
  snapshot: FxSnapshot;
  acceptedAt: string;
  disclosureVersion?: string;
}): FxConsent => {
  if (!Number.isFinite(new Date(acceptedAt).getTime()))
    throw new Error("La fecha de aceptación no es válida.");
  return Object.freeze({
    snapshotId: snapshot.id,
    acceptedAt,
    disclosureVersion,
    acceptedChargeAmountMinor: snapshot.chargeAmountMinor,
  });
};

export const validateFxConsent = ({
  snapshot,
  consent,
  now,
}: {
  snapshot: FxSnapshot;
  consent?: FxConsent;
  now?: string;
}) => {
  requireFreshFxSnapshot(snapshot, now);
  if (
    !consent ||
    consent.snapshotId !== snapshot.id ||
    consent.acceptedChargeAmountMinor !== snapshot.chargeAmountMinor
  )
    throw new Error("Debes aceptar la cotización vigente antes de continuar.");
  return true;
};

export const validateFxPaymentContext = ({
  snapshot,
  allocation,
  sourceCurrency,
  chargeCurrency,
  contractTotalMinor,
  contractualPaymentMinor,
  kind,
  now,
}: {
  snapshot: FxSnapshot;
  allocation: PaymentAllocation;
  sourceCurrency: Currency;
  chargeCurrency: Currency;
  contractTotalMinor: number;
  contractualPaymentMinor: number;
  kind: "deposit" | "full";
  now?: string;
}) => {
  requireFreshFxSnapshot(snapshot, now);
  if (
    snapshot.sourceCurrency !== sourceCurrency ||
    snapshot.chargeCurrency !== chargeCurrency ||
    snapshot.sourceAmountMinor !== contractualPaymentMinor ||
    allocation.fxSnapshotId !== snapshot.id ||
    allocation.kind !== kind ||
    allocation.contractCurrency !== sourceCurrency ||
    allocation.chargeCurrency !== chargeCurrency ||
    allocation.contractTotalMinor !== contractTotalMinor ||
    allocation.contractualPaymentMinor !== contractualPaymentMinor ||
    allocation.chargeNowMinor !== snapshot.chargeAmountMinor ||
    allocation.remainingContractMinor !==
      contractTotalMinor - contractualPaymentMinor
  )
    throw new Error("La cotización no coincide con este intento de pago.");
  return true;
};

export async function ensureFreshDeterministicDemoPaymentQuote({
  current,
  policy,
  sourceCurrency,
  chargeCurrency,
  contractTotalMinor,
  contractualPaymentMinor,
  kind,
  quotedAt = new Date().toISOString(),
}: {
  current?: {
    snapshot: FxSnapshot;
    allocation: PaymentAllocation;
  };
  policy: ExchangeRatePolicy;
  sourceCurrency: Currency;
  chargeCurrency: Currency;
  contractTotalMinor: number;
  contractualPaymentMinor: number;
  kind: "deposit" | "full";
  quotedAt?: string;
}) {
  if (current) {
    try {
      validateFxPaymentContext({
        snapshot: current.snapshot,
        allocation: current.allocation,
        sourceCurrency,
        chargeCurrency,
        contractTotalMinor,
        contractualPaymentMinor,
        kind,
        now: quotedAt,
      });
      return Object.freeze({
        snapshot: current.snapshot,
        allocation: current.allocation,
      });
    } catch {
      // A stale or incompatible attempt must receive a new immutable quote.
    }
  }
  return createDeterministicDemoPaymentQuote({
    policy,
    sourceCurrency,
    chargeCurrency,
    contractTotalMinor,
    contractualPaymentMinor,
    kind,
    quotedAt,
  });
}

export const buildPaymentAllocation = ({
  kind,
  contractTotalMinor,
  contractualPaymentMinor,
  snapshot,
}: {
  kind: "deposit" | "full";
  contractTotalMinor: number;
  contractualPaymentMinor: number;
  snapshot: FxSnapshot;
}): PaymentAllocation => {
  if (
    !Number.isSafeInteger(contractTotalMinor) ||
    !Number.isSafeInteger(contractualPaymentMinor) ||
    contractTotalMinor < 0 ||
    contractualPaymentMinor < 0
  )
    throw new Error("Los saldos deben expresarse en unidades menores válidas.");
  if (contractualPaymentMinor > contractTotalMinor)
    throw new Error("El pago contractual no puede superar el total.");
  if (kind === "full" && contractualPaymentMinor !== contractTotalMinor)
    throw new Error("El pago total debe liquidar la obligación contractual.");
  if (snapshot.sourceAmountMinor !== contractualPaymentMinor)
    throw new Error("La cotización no corresponde al importe del pago.");
  return Object.freeze({
    kind,
    contractTotalMinor,
    contractualPaymentMinor,
    chargeNowMinor: snapshot.chargeAmountMinor,
    remainingContractMinor: contractTotalMinor - contractualPaymentMinor,
    contractCurrency: snapshot.sourceCurrency,
    chargeCurrency: snapshot.chargeCurrency,
    fxSnapshotId: snapshot.id,
  });
};

export const formatAppliedRate = (snapshot: FxSnapshot) =>
  (
    snapshot.appliedRateUnits / snapshot.rateScale
  ).toLocaleString("es-MX", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

export const formatSourceRate = (snapshot: FxSnapshot) =>
  (snapshot.sourceRateUnits / snapshot.rateScale).toLocaleString("es-MX", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

export const formatFxMarkup = (snapshot: FxSnapshot) =>
  snapshot.markup.type === "percentage"
    ? `${(snapshot.markup.basisPoints / 100).toLocaleString("es-MX", {
        maximumFractionDigits: 2,
      })}%`
    : formatMinorUnits(
        snapshot.markup.amountMinor,
        snapshot.markup.currency,
      );

export const fxContractualPaymentLabel = (
  kind: PaymentAllocation["kind"],
) => (kind === "full" ? "Pago contractual" : "Anticipo contractual");

export const appendFxPaymentAllocation = ({
  history,
  allocation,
  paymentId,
  appliedAt,
}: {
  history: ForeignCurrencyPaymentAllocation[];
  allocation: PaymentAllocation;
  paymentId: string;
  appliedAt: string;
}) => {
  if (!paymentId.trim())
    throw new Error("El identificador del pago es obligatorio.");
  if (!Number.isFinite(new Date(appliedAt).getTime()))
    throw new Error("La fecha del abono no es válida.");
  if (history.some((item) => item.paymentId === paymentId))
    throw new Error("El abono ya existe en el historial.");
  return Object.freeze([
    ...history,
    Object.freeze({ ...allocation, paymentId, appliedAt }),
  ]);
};
