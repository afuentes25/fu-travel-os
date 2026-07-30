export const DEFAULT_DEPOSIT_OPTIONS_PERCENT = [100] as const;

export type DepositSelectionSnapshot = Readonly<{
  depositPercent: number;
  depositAmount: number;
  remainingAmount: number;
}>;

export function isValidDepositOptionsPercent(
  options: number[] | undefined,
): options is number[] {
  if (!options || options.length < 1 || options.length > 3) return false;
  return options.every(
    (option, index) =>
      Number.isInteger(option) &&
      option >= 1 &&
      option <= 100 &&
      (index === 0 || option > options[index - 1]),
  );
}

export function resolveDepositOptionsPercent(
  options: number[] | undefined,
): number[] {
  return isValidDepositOptionsPercent(options)
    ? [...options]
    : [...DEFAULT_DEPOSIT_OPTIONS_PERCENT];
}

export function createDepositSelectionSnapshot(
  total: number,
  depositPercent: number,
): DepositSelectionSnapshot {
  if (!Number.isFinite(total) || total < 0)
    throw new Error("El total de la reserva no es válido.");
  if (
    !Number.isInteger(depositPercent) ||
    depositPercent < 1 ||
    depositPercent > 100
  )
    throw new Error("El porcentaje de anticipo no es válido.");

  const depositAmount = Math.round(total * depositPercent) / 100;
  return Object.freeze({
    depositPercent,
    depositAmount,
    remainingAmount: Math.round((total - depositAmount) * 100) / 100,
  });
}
